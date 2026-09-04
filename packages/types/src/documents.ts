import type { DocumentTypeCode } from "./enums.js";

export interface DocumentType {
  id: string;
  code: DocumentTypeCode;
  label: string;
  requiresCertification: boolean;
}

export interface AppDocument {
  id: string;
  ownerUserId: string;
  documentTypeId: string;
  documentTypeCode: DocumentTypeCode;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  verifiedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}
