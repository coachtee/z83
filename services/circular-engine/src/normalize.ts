import type { SubmissionMethod } from "@z83/types";
import type { ExtractedVacancyBlock } from "./extract.js";
import { parseCircularDate } from "./dates.js";
import { extractRequirements, type ExtractedRequirement } from "./requirements.js";

export interface NormalizedVacancyDraft {
  departmentName: string;
  jobTitle: string | null;
  referenceNumber: string | null;
  salaryText: string | null;
  province: string | null;
  locationText: string | null;
  pageNumber: number;
  closingAt: string | null;
  submissionMethod: SubmissionMethod;
  submissionEmail: string | null;
  submissionAddress: string | null;
  specialInstructions: string | null;
  rawExtractedText: string;
  requirements: ExtractedRequirement[];
}

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "Northern Cape", "North West", "Western Cape",
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function normalizeVacancyBlock(block: ExtractedVacancyBlock): NormalizedVacancyDraft {
  const centre = block.fields.CENTRE ?? null;
  const applications = block.fields.APPLICATIONS ?? "";
  const emailMatch = applications.match(EMAIL_PATTERN);
  const mentionsHandDelivery = /hand[\s-]?deliver|hand in|drop off/i.test(applications);

  let submissionMethod: SubmissionMethod = "either";
  if (emailMatch && mentionsHandDelivery) submissionMethod = "either";
  else if (emailMatch) submissionMethod = "email";
  else if (mentionsHandDelivery || applications.length > 0) submissionMethod = "hand_delivery";

  const submissionAddress =
    submissionMethod === "hand_delivery" || submissionMethod === "either"
      ? (emailMatch ? applications.replace(emailMatch[0], "").trim() : applications.trim()) || null
      : null;

  const requirementsSource = [block.fields.REQUIREMENTS, block.fields.DUTIES]
    .filter(Boolean)
    .join("\n");
  const notesSource = [block.fields.COMPETENCIES, block.fields.KNOWLEDGE]
    .filter(Boolean)
    .join("\n");

  return {
    departmentName: block.departmentName,
    jobTitle: block.fields.POST ?? null,
    referenceNumber: block.fields["REF NO"] ?? null,
    salaryText: block.fields.SALARY ?? null,
    province: centre ? PROVINCES.find((p) => centre.toLowerCase().includes(p.toLowerCase())) ?? null : null,
    locationText: centre,
    pageNumber: block.pageNumber,
    closingAt: block.fields["CLOSING DATE"] ? parseCircularDate(block.fields["CLOSING DATE"]) : null,
    submissionMethod,
    submissionEmail: emailMatch?.[0] ?? null,
    submissionAddress,
    specialInstructions: block.fields.NOTE ?? null,
    rawExtractedText: block.rawText,
    requirements: extractRequirements(requirementsSource, notesSource),
  };
}
