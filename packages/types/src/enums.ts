export const USER_ROLES = ["applicant", "cafe_staff", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DOCUMENT_TYPE_CODES = [
  "id_document",
  "matric_certificate",
  "qualification_certificate",
  "cv",
  "drivers_licence",
  "professional_registration",
  "other",
  "z83_form_template",
] as const;
export type DocumentTypeCode = (typeof DOCUMENT_TYPE_CODES)[number];

export const REQUIREMENT_TYPES = [
  "qualification",
  "experience_years",
  "drivers_licence",
  "professional_registration",
  "competency",
  "other",
] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const SUBMISSION_METHODS = ["email", "hand_delivery", "online", "either"] as const;
export type SubmissionMethod = (typeof SUBMISSION_METHODS)[number];

export const VACANCY_STATUSES = [
  "pending_verification",
  "published",
  "closed",
  "rejected",
] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];

export const CIRCULAR_STATUSES = ["collected", "processing", "processed", "failed"] as const;
export type CircularStatus = (typeof CIRCULAR_STATUSES)[number];

export const INGESTION_METHODS = ["automatic", "manual_upload"] as const;
export type IngestionMethod = (typeof INGESTION_METHODS)[number];

export const APPLICATION_STATUSES = [
  "draft",
  "reviewed",
  "signed",
  "email_prepared",
  "print_prepared",
  "submitted",
  "closed",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_DOCUMENT_ROLES = [
  "id",
  "certificate",
  "cv",
  "registration",
  "generated_z83",
  "other",
] as const;
export type ApplicationDocumentRole = (typeof APPLICATION_DOCUMENT_ROLES)[number];

export const APPLICATION_EVENT_TYPES = [
  "created",
  "reviewed",
  "signed",
  "email_prepared",
  "print_prepared",
  "status_changed",
] as const;
export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];

export const LANGUAGE_PROFICIENCY_LEVELS = ["poor", "fair", "good"] as const;
export type LanguageProficiencyLevel = (typeof LANGUAGE_PROFICIENCY_LEVELS)[number];

export const ASSISTED_SESSION_STATUSES = ["open", "closed"] as const;
export type AssistedSessionStatus = (typeof ASSISTED_SESSION_STATUSES)[number];
