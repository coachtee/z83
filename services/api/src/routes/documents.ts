import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { DOCUMENT_TYPE_CODES, type DocumentTypeCode } from "@z83/types";
import { HttpError, authenticate } from "../auth.js";
import {
  createDocument,
  getDocumentById,
  listDocumentsForUser,
  softDeleteDocument,
} from "../repo/documents.js";
import { getStorageProvider, verifyLocalStorageToken } from "../storage.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export function registerDocumentRoutes(app: FastifyInstance): void {
  app.get(
    "/documents",
    { preHandler: authenticate },
    async (request, reply) => {
      const documents = await listDocumentsForUser(request.authUser!.userId);
      return reply.send({ documents });
    },
  );

  app.post(
    "/documents",
    { preHandler: authenticate },
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

      const buffer = await file.toBuffer();
      const key = `documents/${request.authUser!.userId}/${randomUUID()}-${file.filename}`;
      await getStorageProvider().put(key, buffer, file.mimetype);

      const document = await createDocument({
        ownerUserId: request.authUser!.userId,
        documentTypeCode: documentTypeCode as DocumentTypeCode,
        storageKey: key,
        originalFilename: file.filename,
        mimeType: file.mimetype,
        sizeBytes: buffer.length,
      });

      return reply.code(201).send({ document });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/documents/:id/url",
    { preHandler: authenticate },
    async (request, reply) => {
      const document = await getDocumentById(request.params.id);
      if (!document || document.ownerUserId !== request.authUser!.userId || document.deletedAt) {
        throw new HttpError(404, "NOT_FOUND", "Document not found.");
      }
      const url = await getStorageProvider().getSignedUrl(document.storageKey, 300);
      return reply.send({ url, expiresInSeconds: 300 });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/documents/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const deleted = await softDeleteDocument(request.params.id, request.authUser!.userId);
      if (!deleted) throw new HttpError(404, "NOT_FOUND", "Document not found.");
      return reply.code(204).send();
    },
  );

  // Verification endpoint behind the signed URLs LocalDiskStorageProvider
  // hands out — see docs/ARCHITECTURE.md#storage-abstraction. Not a static
  // file server: every request is checked against the HMAC signature and
  // expiry before anything is read from disk.
  app.get<{ Querystring: { key: string; exp: string; sig: string } }>(
    "/storage/local",
    async (request, reply) => {
      const { key, exp, sig } = request.query;
      const expiresAt = Number(exp);
      if (!key || !sig || Number.isNaN(expiresAt) || !verifyLocalStorageToken(key, expiresAt, sig)) {
        throw new HttpError(403, "INVALID_OR_EXPIRED_LINK", "This link is invalid or has expired.");
      }
      const buffer = await getStorageProvider().get(key);
      return reply.type("application/octet-stream").send(buffer);
    },
  );
}
