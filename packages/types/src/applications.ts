import type {
  ApplicationDocumentRole,
  ApplicationEventType,
  ApplicationStatus,
} from "./enums.js";
import type { FullProfile } from "./profile.js";

export interface ApplicationSnapshotData {
  profile: FullProfile["profile"];
  qualifications: FullProfile["qualifications"];
  workExperience: FullProfile["workExperience"];
  languages: FullProfile["languages"];
  references: FullProfile["references"];
  documents: {
    id: string;
    documentTypeCode: string;
    originalFilename: string;
  }[];
  capturedAt: string;
}

export interface ApplicationSnapshot {
  id: string;
  applicationId: string;
  snapshotData: ApplicationSnapshotData;
  createdAt: string;
}

export interface Application {
  id: string;
  userId: string;
  vacancyId: string;
  snapshotId: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  documentId: string | null;
  documentRole: ApplicationDocumentRole;
  storageKey: string | null;
  orderIndex: number;
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  eventType: ApplicationEventType;
  actorUserId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Signature {
  id: string;
  applicationId: string;
  userId: string;
  imageStorageKey: string;
  signedAt: string;
}

export interface ValidationCheckResult {
  rule: string;
  passed: boolean;
  message?: string;
}

export interface ValidationReport {
  complete: boolean;
  checks: ValidationCheckResult[];
}

export interface EmailPackage {
  recipient: string;
  subject: string;
  body: string;
  attachments: { label: string; storageKey: string }[];
}

export interface EmailDelivery {
  id: string;
  applicationId: string;
  recipient: string;
  subject: string;
  body: string;
  attachments: { label: string; storageKey: string }[];
  attemptedAt: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface SendResult {
  success: boolean;
  recipient: string;
  attemptedAt: string;
  error?: string;
}
