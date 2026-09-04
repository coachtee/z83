import type { AppDocument, DocumentTypeCode } from "@z83/types";
import { query } from "../db.js";

interface DocumentRow {
  id: string;
  owner_user_id: string;
  document_type_id: string;
  document_type_code: DocumentTypeCode;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  verified_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

function mapDocument(row: DocumentRow): AppDocument {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    documentTypeId: row.document_type_id,
    documentTypeCode: row.document_type_code,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    verifiedAt: row.verified_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

const SELECT_DOCUMENT = `
  SELECT d.*, dt.code AS document_type_code
  FROM documents d
  JOIN document_types dt ON dt.id = d.document_type_id
`;

export async function getDocumentTypeIdByCode(code: DocumentTypeCode): Promise<string> {
  const { rows } = await query<{ id: string }>(`SELECT id FROM document_types WHERE code = $1`, [
    code,
  ]);
  const row = rows[0];
  if (!row) throw new Error(`Unknown document type code: ${code}`);
  return row.id;
}

export async function createDocument(input: {
  ownerUserId: string;
  documentTypeCode: DocumentTypeCode;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<AppDocument> {
  const documentTypeId = await getDocumentTypeIdByCode(input.documentTypeCode);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO documents (owner_user_id, document_type_id, storage_key, original_filename, mime_type, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      input.ownerUserId,
      documentTypeId,
      input.storageKey,
      input.originalFilename,
      input.mimeType,
      input.sizeBytes,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Insert did not return a row.");
  const created = await getDocumentById(id);
  if (!created) throw new Error("Document not found after insert.");
  return created;
}

export async function listDocumentsForUser(userId: string): Promise<AppDocument[]> {
  const { rows } = await query<DocumentRow>(
    `${SELECT_DOCUMENT} WHERE d.owner_user_id = $1 AND d.deleted_at IS NULL ORDER BY d.created_at DESC`,
    [userId],
  );
  return rows.map(mapDocument);
}

export async function getDocumentById(id: string): Promise<AppDocument | null> {
  const { rows } = await query<DocumentRow>(`${SELECT_DOCUMENT} WHERE d.id = $1`, [id]);
  const row = rows[0];
  return row ? mapDocument(row) : null;
}

export async function softDeleteDocument(id: string, ownerUserId: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE documents SET deleted_at = now() WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
    [id, ownerUserId],
  );
  return (rowCount ?? 0) > 0;
}
