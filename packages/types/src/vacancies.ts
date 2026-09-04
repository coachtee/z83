import type {
  CircularStatus,
  IngestionMethod,
  RequirementType,
  SubmissionMethod,
  VacancyStatus,
} from "./enums.js";

export interface Department {
  id: string;
  name: string;
  code: string | null;
}

export interface Circular {
  id: string;
  circularNumber: string;
  publicationDate: string;
  sourceUrl: string | null;
  sourceDocumentKey: string | null;
  ingestionMethod: IngestionMethod;
  status: CircularStatus;
  uploadedByAdminId: string | null;
  createdAt: string;
}

export interface VacancyRequirement {
  id: string;
  vacancyId: string;
  requirementType: RequirementType;
  description: string;
  minimumValue: string | null;
  isMandatory: boolean;
  orderIndex: number;
}

export interface Vacancy {
  id: string;
  circularId: string;
  departmentId: string;
  departmentName: string;
  jobTitle: string;
  referenceNumber: string;
  salaryText: string | null;
  province: string | null;
  locationText: string | null;
  pageNumber: number | null;
  closingAt: string | null;
  submissionMethod: SubmissionMethod;
  submissionEmail: string | null;
  submissionAddress: string | null;
  specialInstructions: string | null;
  rawExtractedText: string | null;
  status: VacancyStatus;
  verifiedByAdminId: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface VacancyWithRequirements extends Vacancy {
  requirements: VacancyRequirement[];
}
