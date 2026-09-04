import { describe, expect, it } from "vitest";
import type {
  ApplicationSnapshotData,
  Profile,
  Qualification,
  VacancyRequirement,
  WorkExperience,
} from "@z83/types";
import { computeMatch } from "../matching.js";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "profile-1",
    userId: "user-1",
    idNumber: "9001015800083",
    passportNumber: null,
    dateOfBirth: "1990-01-01",
    gender: "female",
    nationality: "South African",
    race: "African",
    disabilityStatus: null,
    addressLine1: "1 Church Street",
    addressLine2: null,
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0002",
    postalAddressLine1: null,
    postalAddressLine2: null,
    postalCity: null,
    postalProvince: null,
    postalPostalCode: null,
    phone: "0821234567",
    altPhone: null,
    email: "applicant@example.co.za",
    driversLicenceCodes: null,
    professionalRegistrations: null,
    currentVersionId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function requirement(overrides: Partial<VacancyRequirement>): VacancyRequirement {
  return {
    id: "req-1",
    vacancyId: "vacancy-1",
    requirementType: "other",
    description: "",
    minimumValue: null,
    isMandatory: true,
    orderIndex: 0,
    ...overrides,
  };
}

function snapshotOf(
  profile: Profile,
  qualifications: Qualification[] = [],
  workExperience: WorkExperience[] = [],
): Pick<ApplicationSnapshotData, "profile" | "qualifications" | "workExperience"> {
  return { profile, qualifications, workExperience };
}

describe("computeMatch", () => {
  it("returns 100% and no requirements when the vacancy has none", () => {
    const result = computeMatch(snapshotOf(baseProfile()), []);
    expect(result.percentage).toBe(100);
    expect(result.matched).toHaveLength(0);
  });

  it("matches a driver's licence requirement when the applicant has the exact code", () => {
    const profile = baseProfile({ driversLicenceCodes: ["B", "EB"] });
    const reqs = [
      requirement({
        id: "r1",
        requirementType: "drivers_licence",
        description: "Valid Code B driving licence",
        minimumValue: "B",
      }),
    ];
    const result = computeMatch(snapshotOf(profile), reqs);
    expect(result.percentage).toBe(100);
    expect(result.matched.map((m) => m.requirementId)).toEqual(["r1"]);
  });

  it("marks a driver's licence requirement missing when the applicant declared none", () => {
    const profile = baseProfile({ driversLicenceCodes: [] });
    const reqs = [
      requirement({ id: "r1", requirementType: "drivers_licence", minimumValue: "B" }),
    ];
    const result = computeMatch(snapshotOf(profile), reqs);
    expect(result.missing.map((m) => m.requirementId)).toEqual(["r1"]);
  });

  it("marks a driver's licence requirement unknown when not captured", () => {
    const profile = baseProfile({ driversLicenceCodes: null });
    const reqs = [
      requirement({ id: "r1", requirementType: "drivers_licence", minimumValue: "B" }),
    ];
    const result = computeMatch(snapshotOf(profile), reqs);
    expect(result.unknown.map((u) => u.requirementId)).toEqual(["r1"]);
  });

  it("marks professional registration unknown when not captured, per the spec's example", () => {
    const profile = baseProfile({ professionalRegistrations: null });
    const reqs = [
      requirement({
        id: "r1",
        requirementType: "professional_registration",
        description: "Registration with SAICA",
        minimumValue: "SAICA",
      }),
    ];
    const result = computeMatch(snapshotOf(profile), reqs);
    expect(result.unknown[0]?.requirementId).toBe("r1");
    expect(result.unknown[0]?.reason).toMatch(/not found/i);
  });

  it("matches qualification by NQF level", () => {
    const profile = baseProfile();
    const qualifications: Qualification[] = [
      {
        id: "q1",
        profileId: "profile-1",
        institution: "Tshwane University of Technology",
        qualificationName: "National Diploma in Public Administration",
        fieldOfStudy: "Public Administration",
        nqfLevel: 6,
        yearCompleted: 2015,
        stillStudying: false,
        orderIndex: 0,
      },
    ];
    const reqs = [
      requirement({ id: "r1", requirementType: "qualification", minimumValue: "6" }),
    ];
    const result = computeMatch(snapshotOf(profile, qualifications), reqs);
    expect(result.matched.map((m) => m.requirementId)).toEqual(["r1"]);
  });

  it("computes years of experience across multiple jobs, including a current one", () => {
    const profile = baseProfile();
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 5);
    const workExperience: WorkExperience[] = [
      {
        id: "w1",
        profileId: "profile-1",
        employer: "Department of Health",
        jobTitle: "Administration Clerk",
        startDate: "2015-01-01",
        endDate: "2018-01-01",
        isCurrent: false,
        responsibilities: null,
        orderIndex: 0,
      },
      {
        id: "w2",
        profileId: "profile-1",
        employer: "Department of Home Affairs",
        jobTitle: "Senior Admin Clerk",
        startDate: tenYearsAgo.toISOString().slice(0, 10),
        endDate: null,
        isCurrent: true,
        responsibilities: null,
        orderIndex: 1,
      },
    ];
    const reqs = [
      requirement({ id: "r1", requirementType: "experience_years", minimumValue: "3" }),
    ];
    const result = computeMatch(snapshotOf(profile, [], workExperience), reqs);
    expect(result.matched.map((m) => m.requirementId)).toEqual(["r1"]);
  });

  it("computes a partial percentage across a mix of outcomes", () => {
    const profile = baseProfile({ driversLicenceCodes: ["B"], professionalRegistrations: null });
    const reqs = [
      requirement({ id: "r1", requirementType: "drivers_licence", minimumValue: "B" }),
      requirement({
        id: "r2",
        requirementType: "professional_registration",
        minimumValue: "SAICA",
      }),
      requirement({ id: "r3", requirementType: "experience_years", minimumValue: "3" }),
      requirement({ id: "r4", requirementType: "qualification", minimumValue: "6" }),
    ];
    const result = computeMatch(snapshotOf(profile), reqs);
    // r1 matched, r2 unknown, r3 missing (no experience), r4 missing (no qualifications)
    expect(result.percentage).toBe(25);
    expect(result.disclaimer).toMatch(/appears to match/i);
    expect(result.disclaimer).not.toMatch(/eligible/i);
  });
});
