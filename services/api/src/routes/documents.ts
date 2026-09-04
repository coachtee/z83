import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { DOCUMENT_TYPE_CODES, type DocumentTypeCode } from "@z83/types";
import { HttpError, authenticate } from "../auth.js";
import { attachActingContext } from "../assisted-context.js";
import { recordAuditLog } from "../repo/auditLogs.js";
import {
  createDocument,
  getDocumentById,
  listDocumentsForUser,
  softDeleteDocument,
} from "../repo/documents.js";
import { getStorageProvider, verifyLocalStorageToken } from "../storage.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const APPLICANT_PRE_HANDLERS = [authenticate, attachActingContext];

// Every document here is a scan or PDF of a real ID/certificate — there's
// no legitimate reason to accept anything else, and rejecting other types
// (HTML, SVG, executables) closes off stored-content attacks via upload.
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export function registerDocumentRoutes(app: FastifyInstance): void {
  app.get(
    "/documents",
    { preHandler: APPLICANT_PRE_HANDLERS },
    async (request, reply) => {
      const documents = await listDocumentsForUser(request.actingContext!.effectiveUserId);
      return reply.send({ documents });
    },
  );

  app.post(
    "/documents",
    { preHandler: APPLICANT_PRE_HANDLERS },
    async (request, reply) => {
      const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
      if (!file) {
        throw new HttpError(400, "NO_FILE", "No file was uploaded.");
      }
      const documentTypeCode = file.fields.documentTypeCode
        ? String((file.fields.documentTypeCode as { value: string }).value)
        : undefined;
      if (!documentTypeCode || !DOCUMENT_TYPE_CODES.includes(documentTypeCode as DocumentTypeCode)) {
        throw new HttpError(400, "VALIDATION_ERROR", "documentTypeCode is required and must be valid.");
      }
      if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
        throw new HttpError(
          400,
          "UNSUPPORTED_FILE_TYPE",
          "Only PDF, JPEG and PNG files can be uploaded.",
        );
      }

      const ctx = request.actingContext!;
      const buffer = await file.toBuffer();
      const key = `documents/${ctx.effectiveUserId}/${randomUUID()}-${file.filename}`;
      await getStorageProvider().put(key, buffer, file.mimetype);

      const document = await createDocument({
        ownerUserId: ctx.effectiveUserId,
        documentTypeCode: documentTypeCode as DocumentTypeCode,
        storageKey: key,
        originalFilename: file.filename,
        mimeType: file.mimetype,
        sizeBytes: buffer.length,
      });

      await recordAuditLog({
        actorUserId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        action: "document.upload",
        entityType: "document",
        entityId: document.id,
        metadata: {
          documentTypeCode,
          ...(ctx.assistedSessionId ? { assistedSessionId: ctx.assistedSessionId } : {}),
        },
      });

      return reply.code(201).send({ document });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/documents/:id/url",
    { preHandler: APPLICANT_PRE_HANDLERS },
    async (request, reply) => {
      const document = await getDocumentById(request.params.id);
      if (!document || document.ownerUserId !== request.actingContext!.effectiveUserId || document.deletedAt) {
        throw new HttpError(404, "NOT_FOUND", "Document not found.");
      }
      const url = await getStorageProvider().getSignedUrl(document.storageKey, 300);
      return reply.send({ url, expiresInSeconds: 300 });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/documents/:id",
    { preHandler: APPLICANT_PRE_HANDLERS },
    async (request, reply) => {
      const ctx = request.actingContext!;
      const deleted = await softDeleteDocument(request.params.id, ctx.effectiveUserId);
      if (!deleted) throw new HttpError(404, "NOT_FOUND", "Document not found.");
      await recordAuditLog({
        actorUserId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        action: "document.delete",
        entityType: "document",
        entityId: request.params.id,
        metadata: ctx.assistedSessionId ? { assistedSessionId: ctx.assistedSessionId } : null,
      });
      return reply.code(204).send();
    },
  );

  // Verification endpoint behind the signed URLs LocalDiskStorageProvider
  // hands out — see docs/ARCHITECTURE.md#storage-abstraction. Not a static
  // file server: every request is checked against the HMAC signature and
  // expiry before anything is read from disk. Deliberately not behind
  // `authenticate` — the signature itself, scoped to one key and a short
  // expiry, is the access control here, matching how a real presigned URL
  // (Supabase/R2) works.
  app.get<{ Querystring: { key: string; exp: string; sig: string } }>(
    "/storage/local",
    async (request, reply) => {
      const { key, exp, sig } = request.query;
      const expiresAt = Number(exp);
      if (!key || !sig || Number.isNaN(expiresAt) || !verifyLocalStorageToken(key, expiresAt, sig)) {
        throw new HttpError(403, "INVALID_OR_EXPIRED_LINK", "This link is invalid or has expired.");
      }
      const buffer = await getStorageProvider().get(key);
      // Always a forced, generic-typed download — never rendered inline —
      // so an uploaded file can't be sniffed as HTML/SVG and executed in
      // this origin even if some future path let an unexpected type in.
      return reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", "attachment")
        .type("application/octet-stream")
        .send(buffer);
    },
  );
}
