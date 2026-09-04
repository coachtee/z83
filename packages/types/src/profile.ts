import type { LanguageProficiencyLevel } from "./enums.js";

export interface Profile {
  id: string;
  userId: string;
  idNumber: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  race: string | null;
  disabilityStatus: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  postalAddressLine1: string | null;
  postalAddressLine2: string | null;
  postalCity: string | null;
  postalProvince: string | null;
  postalPostalCode: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  driversLicenceCodes: string[] | null;
  professionalRegistrations: string[] | null;
  currentVersionId: string | null;
  updatedAt: string;
}

export interface Qualification {
  id: string;
  profileId: string;
  institution: string;
  qualificationName: string;
  fieldOfStudy: string | null;
  nqfLevel: number | null;
  yearCompleted: number | null;
  stillStudying: boolean;
  orderIndex: number;
}

export interface WorkExperience {
  id: string;
  profileId: string;
  employer: string;
  jobTitle: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  responsibilities: string | null;
  orderIndex: number;
}

export interface LanguageSkill {
  id: string;
  profileId: string;
  language: string;
  speakLevel: LanguageProficiencyLevel;
  readLevel: LanguageProficiencyLevel;
  writeLevel: LanguageProficiencyLevel;
}

export interface ApplicantReference {
  id: string;
  profileId: string;
  fullName: string;
  relationship: string | null;
  organisation: string | null;
  phone: string | null;
  email: string | null;
  orderIndex: number;
}

export interface FullProfile {
  profile: Profile;
  qualifications: Qualification[];
  workExperience: WorkExperience[];
  languages: LanguageSkill[];
  references: ApplicantReference[];
}
