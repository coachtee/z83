import type { ApplicationSnapshotData, ValidationReport, Vacancy } from "@z83/types";

/**
 * Completeness checks derived from the Z83 guidance. Every rule here is one
 * the product spec calls out explicitly — this module does not invent
 * additional government requirements.
 */
export function checkApplicationReadiness(
  snapshot: ApplicationSnapshotData,
  vacancy: Pick<Vacancy, "referenceNumber" | "jobTitle" | "submissionMethod" | "submissionEmail" | "submissionAddress">,
): ValidationReport {
  const { profile, qualifications, workExperience, references, documents } = snapshot;

  const checks: ValidationReport["checks"] = [
    {
      rule: "has_id_or_passport",
      passed: Boolean(profile.idNumber || profile.passportNumber),
      message: "Add an ID number or passport number.",
    },
    {
      rule: "has_personal_particulars",
      passed: Boolean(profile.dateOfBirth && profile.gender && profile.nationality),
      message: "Complete date of birth, gender and nationality.",
    },
    {
      rule: "has_contact_details",
      passed: Boolean(profile.phone && profile.email),
      message: "Add a phone number and email address.",
    },
    {
      rule: "has_residential_address",
      passed: Boolean(profile.addressLine1 && profile.city && profile.province),
      message: "Add a residential address.",
    },
    {
      rule: "has_at_least_one_qualification",
      passed: qualifications.length > 0,
      message: "Add at least one qualification.",
    },
    {
      rule: "qualifications_order_valid",
      passed: hasValidOrder(qualifications.map((q) => q.orderIndex)),
      message: "Qualification order is inconsistent — remove and re-add them in order.",
    },
    {
      rule: "work_experience_order_valid",
      passed:
        workExperience.length === 0 || hasValidOrder(workExperience.map((w) => w.orderIndex)),
      message: "Work experience order is inconsistent — remove and re-add in order.",
    },
    {
      rule: "minimum_three_references",
      passed: references.length >= 3,
      message: "Add at least 3 contactable references.",
    },
    {
      rule: "has_id_document",
      passed: documents.some((d) => d.documentTypeCode === "id_document"),
      message: "Upload a copy of your ID document.",
    },
    {
      rule: "has_cv_document",
      passed: documents.some((d) => d.documentTypeCode === "cv"),
      message: "Upload your CV.",
    },
    {
      rule: "qualification_certificates_present",
      passed:
        qualifications.length === 0 ||
        documents.some((d) => d.documentTypeCode === "qualification_certificate"),
      message: "Upload at least one qualification certificate.",
    },
    {
      rule: "vacancy_reference_number_present",
      passed: Boolean(vacancy.referenceNumber && vacancy.jobTitle),
      message: "This vacancy is missing its reference number or title — contact an administrator.",
    },
    {
      rule: "submission_instructions_present",
      passed: hasSubmissionInstructions(vacancy),
      message: "This vacancy doesn't have complete submission instructions yet.",
    },
  ];

  return {
    complete: checks.every((c) => c.passed),
    checks,
  };
}

function hasValidOrder(indexes: number[]): boolean {
  const sorted = [...indexes].sort((a, b) => a - b);
  return sorted.every((value, i) => value === i);
}

function hasSubmissionInstructions(
  vacancy: Pick<Vacancy, "submissionMethod" | "submissionEmail" | "submissionAddress">,
): boolean {
  if (vacancy.submissionMethod === "email") return Boolean(vacancy.submissionEmail);
  if (vacancy.submissionMethod === "hand_delivery") return Boolean(vacancy.submissionAddress);
  if (vacancy.submissionMethod === "either") {
    return Boolean(vacancy.submissionEmail || vacancy.submissionAddress);
  }
  return true;
}
