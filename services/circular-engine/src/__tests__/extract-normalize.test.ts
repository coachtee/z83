import { describe, expect, it } from "vitest";
import { extractVacancyBlocks } from "../extract.js";
import { normalizeVacancyBlock } from "../normalize.js";

const PAGE_1 = `
DEPARTMENT OF PUBLIC SERVICE AND ADMINISTRATION
APPLICATIONS : Please email applications to recruitment@example.org or hand deliver to 123 Church Street, Pretoria.
POST : Administration Clerk: Registry Services
REF NO : DPSA/01/2026
SALARY : R202 233 - R238 269 per annum (Level 05)
CENTRE : Pretoria, Gauteng
REQUIREMENTS : Grade 12 certificate plus a National Diploma (NQF Level 6) in Public Administration. At least 3 years relevant experience. A valid Code B driving licence will be an added advantage.
DUTIES : Render effective registry services. Manage incoming and outgoing correspondence.
COMPETENCIES : Knowledge of the Public Finance Management Act (PFMA) and Batho Pele principles.
ENQUIRIES : Ms J Dlamini, Tel: (012) 000 0000
CLOSING DATE : 30 September 2026
NOTE : Shortlisted candidates will be required to undergo a competency assessment.
`;

const PAGE_2 = `
POST : Senior Admin Officer
REF NO : DPSA/02/2026
SALARY : R308 154 per annum
CENTRE : Cape Town, Western Cape
REQUIREMENTS : A Bachelor's Degree in Public Management. Registration with SAICA will be required. 5 years experience in a similar role.
CLOSING DATE : 2026/10/15
`;

describe("extractVacancyBlocks", () => {
  it("splits a two-page circular into two vacancy blocks with page numbers", () => {
    const blocks = extractVacancyBlocks([PAGE_1, PAGE_2]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.pageNumber).toBe(1);
    expect(blocks[1]?.pageNumber).toBe(2);
    expect(blocks[0]?.fields.POST).toBe("Administration Clerk: Registry Services");
    expect(blocks[0]?.fields["REF NO"]).toBe("DPSA/01/2026");
  });

  it("carries the department heading forward to posts that don't repeat it", () => {
    const blocks = extractVacancyBlocks([PAGE_1, PAGE_2]);
    expect(blocks[0]?.departmentName).toMatch(/PUBLIC SERVICE AND ADMINISTRATION/);
    expect(blocks[1]?.departmentName).toMatch(/PUBLIC SERVICE AND ADMINISTRATION/);
  });
});

describe("normalizeVacancyBlock", () => {
  it("normalizes fields, province, closing date and submission method for an email+hand-delivery post", () => {
    const [block] = extractVacancyBlocks([PAGE_1]);
    const normalized = normalizeVacancyBlock(block!);

    expect(normalized.jobTitle).toBe("Administration Clerk: Registry Services");
    expect(normalized.referenceNumber).toBe("DPSA/01/2026");
    expect(normalized.province).toBe("Gauteng");
    expect(normalized.closingAt).toBe("2026-09-30");
    expect(normalized.submissionMethod).toBe("either");
    expect(normalized.submissionEmail).toBe("recruitment@example.org");
    expect(normalized.submissionAddress).toMatch(/Church Street/);
  });

  it("extracts qualification, experience, driver's licence and competency requirements", () => {
    const [block] = extractVacancyBlocks([PAGE_1]);
    const normalized = normalizeVacancyBlock(block!);
    const types = normalized.requirements.map((r) => r.requirementType);

    expect(types).toContain("qualification");
    expect(types).toContain("experience_years");
    expect(types).toContain("drivers_licence");
    expect(types).toContain("competency");

    const experience = normalized.requirements.find((r) => r.requirementType === "experience_years");
    expect(experience?.minimumValue).toBe("3");

    const licence = normalized.requirements.find((r) => r.requirementType === "drivers_licence");
    expect(licence?.minimumValue).toBe("B");
    expect(licence?.isMandatory).toBe(false); // "added advantage"
  });

  it("extracts a professional registration requirement by body name", () => {
    const [block] = extractVacancyBlocks([PAGE_2]);
    const normalized = normalizeVacancyBlock(block!);
    const registration = normalized.requirements.find(
      (r) => r.requirementType === "professional_registration",
    );
    expect(registration?.minimumValue).toBe("SAICA");
    expect(normalized.closingAt).toBe("2026-10-15");
  });

  it("does not invent a requirement type the source text doesn't support", () => {
    const [block] = extractVacancyBlocks([
      "POST : Cleaner\nREF NO : X/1\nREQUIREMENTS : Ability to work independently.",
    ]);
    const normalized = normalizeVacancyBlock(block!);
    expect(normalized.requirements).toHaveLength(1);
    expect(normalized.requirements[0]?.requirementType).toBe("other");
  });
});
