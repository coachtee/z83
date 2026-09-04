import type { RequirementType } from "@z83/types";

export interface ExtractedRequirement {
  requirementType: RequirementType;
  description: string;
  minimumValue: string | null;
  isMandatory: boolean;
}

const QUALIFICATION_PATTERN =
  /\b(grade\s*12|matric|national\s+diploma|bachelor'?s?\s+degree|degree|diploma|certificate|nqf\s*level\s*(\d+))\b/i;
const NQF_PATTERN = /nqf\s*level\s*(\d+)/i;
const EXPERIENCE_PATTERN = /(\d+)\s*[-–]?\s*(?:\+)?\s*years?['’]?\s*(?:of\s*)?(?:relevant\s*)?experience/i;
const DRIVERS_LICENCE_PATTERN = /(?:code\s*([a-z][0-9]?)\s*)?(?:valid\s*)?driv(?:er'?s|ing)\s*licen[cs]e/i;
const DRIVERS_CODE_PATTERN = /code\s*([a-z][0-9]?)/i;
const REGISTRATION_BODIES = [
  "SAICA", "ECSA", "HPCSA", "SACSSP", "SANC", "SAPC", "SACNASP", "SAICE",
  "LSSA", "SAIOSH", "PLATO", "SACAA", "SAQA", "CHE",
];
const REGISTRATION_PATTERN = new RegExp(
  `registration\\s+(?:with|as a member of)\\s+(?:the\\s+)?(${REGISTRATION_BODIES.join("|")}|[A-Z]{3,10})`,
  "i",
);
const COMPETENCY_KEYWORDS = /\b(knowledge of|understanding of|batho pele|pfma|skills?:)/i;

function splitClauses(text: string): string[] {
  return text
    .split(/[\n;]|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/**
 * Classifies each clause of a requirements/duties block into a structured
 * requirement. Anything that doesn't match a known pattern is kept as
 * `other` with the raw text — nothing is dropped, and nothing is invented
 * beyond what the clause actually says.
 */
export function extractRequirements(requirementsText: string, notesText = ""): ExtractedRequirement[] {
  const clauses = [...splitClauses(requirementsText), ...splitClauses(notesText)];
  const results: ExtractedRequirement[] = [];
  const seen = new Set<string>();

  for (const clause of clauses) {
    const key = clause.toLowerCase();
    if (seen.has(key)) continue;

    const experienceMatch = clause.match(EXPERIENCE_PATTERN);
    const licenceMatch = clause.match(DRIVERS_LICENCE_PATTERN);
    const registrationMatch = clause.match(REGISTRATION_PATTERN);
    const qualificationMatch = clause.match(QUALIFICATION_PATTERN);
    const competencyMatch = clause.match(COMPETENCY_KEYWORDS);

    if (experienceMatch) {
      seen.add(key);
      results.push({
        requirementType: "experience_years",
        description: clause,
        minimumValue: experienceMatch[1] ?? null,
        isMandatory: !/added advantage|recommendation|will be an advantage/i.test(clause),
      });
    } else if (licenceMatch) {
      seen.add(key);
      const codeMatch = clause.match(DRIVERS_CODE_PATTERN);
      results.push({
        requirementType: "drivers_licence",
        description: clause,
        minimumValue: codeMatch?.[1]?.toUpperCase() ?? null,
        isMandatory: !/added advantage|recommendation|will be an advantage/i.test(clause),
      });
    } else if (registrationMatch) {
      seen.add(key);
      results.push({
        requirementType: "professional_registration",
        description: clause,
        minimumValue: registrationMatch[1]?.toUpperCase() ?? null,
        isMandatory: !/added advantage|recommendation/i.test(clause),
      });
    } else if (qualificationMatch) {
      seen.add(key);
      const nqfMatch = clause.match(NQF_PATTERN);
      results.push({
        requirementType: "qualification",
        description: clause,
        minimumValue: nqfMatch?.[1] ?? null,
        isMandatory: true,
      });
    } else if (competencyMatch) {
      seen.add(key);
      results.push({
        requirementType: "competency",
        description: clause,
        minimumValue: null,
        isMandatory: true,
      });
    } else {
      seen.add(key);
      results.push({
        requirementType: "other",
        description: clause,
        minimumValue: null,
        isMandatory: true,
      });
    }
  }

  return results;
}
