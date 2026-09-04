import type {
  ApplicationSnapshotData,
  MatchResult,
  Qualification,
  VacancyRequirement,
  WorkExperience,
} from "@z83/types";

const DISCLAIMER =
  "Your profile appears to match this vacancy. This is not a decision on eligibility — only the department can confirm that.";

/**
 * Deterministic, rule-based matching. No ML model, no external "AI" call —
 * every result here can be traced back to one of the branches below.
 */
export function computeMatch(
  profile: Pick<
    ApplicationSnapshotData,
    "qualifications" | "workExperience" | "profile"
  >,
  requirements: VacancyRequirement[],
): MatchResult {
  const matched: MatchResult["matched"] = [];
  const missing: MatchResult["missing"] = [];
  const unknown: MatchResult["unknown"] = [];

  for (const req of requirements) {
    const outcome = evaluateRequirement(profile, req);
    if (outcome.kind === "matched") {
      matched.push({ requirementId: req.id, description: req.description });
    } else if (outcome.kind === "missing") {
      missing.push({ requirementId: req.id, description: req.description });
    } else {
      unknown.push({
        requirementId: req.id,
        description: req.description,
        reason: outcome.reason,
      });
    }
  }

  const total = requirements.length;
  const percentage = total === 0 ? 100 : Math.round((matched.length / total) * 100);

  return { percentage, matched, missing, unknown, disclaimer: DISCLAIMER };
}

type Outcome =
  | { kind: "matched" }
  | { kind: "missing" }
  | { kind: "unknown"; reason: string };

function evaluateRequirement(
  profile: Pick<ApplicationSnapshotData, "qualifications" | "workExperience" | "profile">,
  req: VacancyRequirement,
): Outcome {
  switch (req.requirementType) {
    case "qualification":
      return evaluateQualification(profile.qualifications, req);
    case "experience_years":
      return evaluateExperience(profile.workExperience, req);
    case "drivers_licence":
      return evaluateDriversLicence(profile.profile.driversLicenceCodes, req);
    case "professional_registration":
      return evaluateProfessionalRegistration(
        profile.profile.professionalRegistrations,
        req,
      );
    case "competency":
      return {
        kind: "unknown",
        reason: "Z83 does not yet capture competency self-assessments on the profile.",
      };
    case "other":
    default:
      return {
        kind: "unknown",
        reason: "This requirement isn't in a structured category yet.",
      };
  }
}

function evaluateQualification(
  qualifications: Qualification[],
  req: VacancyRequirement,
): Outcome {
  if (qualifications.length === 0) {
    return { kind: "missing" };
  }

  const minNqf = req.minimumValue !== null ? parseInt(req.minimumValue, 10) : NaN;
  if (!Number.isNaN(minNqf)) {
    const withNqf = qualifications.filter((q) => q.nqfLevel !== null);
    if (withNqf.some((q) => (q.nqfLevel as number) >= minNqf)) {
      return { kind: "matched" };
    }
    if (withNqf.length < qualifications.length) {
      return {
        kind: "unknown",
        reason: "Some qualifications don't have an NQF level captured.",
      };
    }
    return { kind: "missing" };
  }

  const keywords = extractKeywords(req.description);
  const hit = qualifications.some((q) =>
    keywords.some(
      (kw) =>
        q.qualificationName.toLowerCase().includes(kw) ||
        (q.fieldOfStudy?.toLowerCase().includes(kw) ?? false),
    ),
  );
  if (hit) {
    return { kind: "matched" };
  }
  return {
    kind: "unknown",
    reason: "Couldn't confidently match a saved qualification to this requirement's wording.",
  };
}

function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function evaluateExperience(
  workExperience: WorkExperience[],
  req: VacancyRequirement,
): Outcome {
  const minYears = req.minimumValue !== null ? parseFloat(req.minimumValue) : NaN;
  if (Number.isNaN(minYears)) {
    return { kind: "unknown", reason: "Requirement doesn't state a parseable number of years." };
  }

  const totalYears = workExperience.reduce((sum, exp) => {
    const start = new Date(exp.startDate);
    const end = exp.isCurrent || !exp.endDate ? new Date() : new Date(exp.endDate);
    const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return sum + Math.max(0, years);
  }, 0);

  return totalYears >= minYears ? { kind: "matched" } : { kind: "missing" };
}

function evaluateDriversLicence(
  codes: string[] | null,
  req: VacancyRequirement,
): Outcome {
  if (codes === null) {
    return { kind: "unknown", reason: "Driver's licence hasn't been captured on the profile." };
  }
  if (codes.length === 0) {
    return { kind: "missing" };
  }
  if (!req.minimumValue) {
    return { kind: "matched" };
  }
  return codes.includes(req.minimumValue) ? { kind: "matched" } : { kind: "missing" };
}

function evaluateProfessionalRegistration(
  registrations: string[] | null,
  req: VacancyRequirement,
): Outcome {
  if (registrations === null) {
    return {
      kind: "unknown",
      reason: "Professional registration not found on the profile.",
    };
  }
  if (registrations.length === 0) {
    return { kind: "missing" };
  }
  if (!req.minimumValue) {
    return { kind: "matched" };
  }
  const target = req.minimumValue.toLowerCase();
  return registrations.some((r) => r.toLowerCase() === target)
    ? { kind: "matched" }
    : {
        kind: "unknown",
        reason: `Profile lists a registration, but not confirmed against "${req.minimumValue}".`,
      };
}
