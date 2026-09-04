import { describe, expect, it } from "vitest";
import type { ApplicationSnapshotData, Profile, Vacancy } from "@z83/types";
import { checkApplicationReadiness } from "../z83-rules.js";

function completeProfile(): Profile {
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
    driversLicenceCodes: ["B"],
    professionalRegistrations: null,
    currentVersionId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function completeSnapshot(): ApplicationSnapshotData {
  return {
    profile: completeProfile(),
    qualifications: [
      {
        id: "q1",
        profileId: "profile-1",
        institution: "UNISA",
        qualificationName: "National Diploma in Public Administration",
        fieldOfStudy: "Public Administration",
        nqfLevel: 6,
        yearCompleted: 2015,
        stillStudying: false,
        orderIndex: 0,
      },
    ],
    workExperience: [
      {
        id: "w1",
        profileId: "profile-1",
        employer: "Department of Health",
        jobTitle: "Admin Clerk",
        startDate: "2016-01-01",
        endDate: null,
        isCurrent: true,
        responsibilities: null,
        orderIndex: 0,
      },
    ],
    languages: [],
    references: [
      { id: "ref1", profileId: "profile-1", fullName: "A", relationship: null, organisation: null, phone: null, email: null, orderIndex: 0 },
      { id: "ref2", profileId: "profile-1", fullName: "B", relationship: null, organisation: null, phone: null, email: null, orderIndex: 1 },
      { id: "ref3", profileId: "profile-1", fullName: "C", relationship: null, organisation: null, phone: null, email: null, orderIndex: 2 },
    ],
    documents: [
      { id: "d1", documentTypeCode: "id_document", originalFilename: "id.pdf" },
      { id: "d2", documentTypeCode: "cv", originalFilename: "cv.pdf" },
      { id: "d3", documentTypeCode: "qualification_certificate", originalFilename: "cert.pdf" },
    ],
    capturedAt: "2026-01-01T00:00:00.000Z",
  };
}

function publishedVacancy(): Pick<
  Vacancy,
  "referenceNumber" | "jobTitle" | "submissionMethod" | "submissionEmail" | "submissionAddress"
> {
  return {
    referenceNumber: "REF/01/2026",
    jobTitle: "Administration Clerk",
    submissionMethod: "email",
    submissionEmail: "recruitment@example.gov.za",
    submissionAddress: null,
  };
}

describe("checkApplicationReadiness", () => {
  it("passes every rule for a fully completed snapshot", () => {
    const report = checkApplicationReadiness(completeSnapshot(), publishedVacancy());
    const failed = report.checks.filter((c) => !c.passed);
    expect(failed).toEqual([]);
    expect(report.complete).toBe(true);
  });

  it("fails minimum_three_references when fewer than three are present", () => {
    const snapshot = completeSnapshot();
    snapshot.references = snapshot.references.slice(0, 2);
    const report = checkApplicationReadiness(snapshot, publishedVacancy());
    expect(report.complete).toBe(false);
    const rule = report.checks.find((c) => c.rule === "minimum_three_references");
    expect(rule?.passed).toBe(false);
  });

  it("fails has_id_document when no ID document was uploaded", () => {
    const snapshot = completeSnapshot();
    snapshot.documents = snapshot.documents.filter((d) => d.documentTypeCode !== "id_document");
    const report = checkApplicationReadiness(snapshot, publishedVacancy());
    expect(report.checks.find((c) => c.rule === "has_id_document")?.passed).toBe(false);
    expect(report.complete).toBe(false);
  });

  it("fails submission_instructions_present when an email vacancy has no email", () => {
    const vacancy = { ...publishedVacancy(), submissionEmail: null };
    const report = checkApplicationReadiness(completeSnapshot(), vacancy);
    expect(report.checks.find((c) => c.rule === "submission_instructions_present")?.passed).toBe(
      false,
    );
  });

  it("does not require work experience to exist, only to be ordered if present", () => {
    const snapshot = completeSnapshot();
    snapshot.workExperience = [];
    const report = checkApplicationReadiness(snapshot, publishedVacancy());
    expect(report.checks.find((c) => c.rule === "work_experience_order_valid")?.passed).toBe(
      true,
    );
  });
});
