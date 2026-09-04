import { z } from "zod";
import {
  DOCUMENT_TYPE_CODES,
  LANGUAGE_PROFICIENCY_LEVELS,
  APPLICATION_STATUSES,
} from "@z83/types";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().trim().min(2),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

const saDrivingLicenceCode = z.enum(["A", "A1", "B", "EB", "C1", "C", "EC1", "EC"]);

export const profileUpdateSchema = z.object({
  idNumber: z.string().trim().length(13).optional().nullable(),
  passportNumber: z.string().trim().min(1).optional().nullable(),
  dateOfBirth: z.string().date().optional().nullable(),
  gender: z.string().trim().min(1).optional().nullable(),
  nationality: z.string().trim().min(1).optional().nullable(),
  race: z.string().trim().min(1).optional().nullable(),
  disabilityStatus: z.string().trim().optional().nullable(),
  addressLine1: z.string().trim().min(1).optional().nullable(),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1).optional().nullable(),
  province: z.string().trim().min(1).optional().nullable(),
  postalCode: z.string().trim().optional().nullable(),
  postalAddressLine1: z.string().trim().optional().nullable(),
  postalAddressLine2: z.string().trim().optional().nullable(),
  postalCity: z.string().trim().optional().nullable(),
  postalProvince: z.string().trim().optional().nullable(),
  postalPostalCode: z.string().trim().optional().nullable(),
  phone: z.string().trim().min(1).optional().nullable(),
  altPhone: z.string().trim().optional().nullable(),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  driversLicenceCodes: z.array(saDrivingLicenceCode).optional().nullable(),
  professionalRegistrations: z.array(z.string().trim().min(1)).optional().nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const qualificationSchema = z.object({
  institution: z.string().trim().min(1),
  qualificationName: z.string().trim().min(1),
  fieldOfStudy: z.string().trim().optional().nullable(),
  nqfLevel: z.number().int().min(1).max(10).optional().nullable(),
  yearCompleted: z.number().int().min(1950).max(2100).optional().nullable(),
  stillStudying: z.boolean().default(false),
  orderIndex: z.number().int().min(0),
});
export type QualificationInput = z.infer<typeof qualificationSchema>;

export const workExperienceSchema = z.object({
  employer: z.string().trim().min(1),
  jobTitle: z.string().trim().min(1),
  startDate: z.string().date(),
  endDate: z.string().date().optional().nullable(),
  isCurrent: z.boolean().default(false),
  responsibilities: z.string().trim().optional().nullable(),
  orderIndex: z.number().int().min(0),
});
export type WorkExperienceInput = z.infer<typeof workExperienceSchema>;

export const languageSchema = z.object({
  language: z.string().trim().min(1),
  speakLevel: z.enum(LANGUAGE_PROFICIENCY_LEVELS),
  readLevel: z.enum(LANGUAGE_PROFICIENCY_LEVELS),
  writeLevel: z.enum(LANGUAGE_PROFICIENCY_LEVELS),
});
export type LanguageInput = z.infer<typeof languageSchema>;

export const referenceSchema = z.object({
  fullName: z.string().trim().min(1),
  relationship: z.string().trim().optional().nullable(),
  organisation: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  orderIndex: z.number().int().min(0),
});
export type ReferenceInput = z.infer<typeof referenceSchema>;

export const documentUploadMetaSchema = z.object({
  documentTypeCode: z.enum(DOCUMENT_TYPE_CODES),
});
export type DocumentUploadMetaInput = z.infer<typeof documentUploadMetaSchema>;

export const createApplicationSchema = z.object({
  vacancyId: z.string().uuid(),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const signApplicationSchema = z.object({
  imageBase64: z.string().min(100, "Signature image is required."),
});
export type SignApplicationInput = z.infer<typeof signApplicationSchema>;

export const updateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
});
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;

export const confirmSendSchema = z.object({
  confirm: z.literal(true),
});
export type ConfirmSendInput = z.infer<typeof confirmSendSchema>;
