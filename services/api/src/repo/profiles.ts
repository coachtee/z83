import type {
  ApplicantReference,
  FullProfile,
  LanguageSkill,
  Profile,
  Qualification,
  WorkExperience,
} from "@z83/types";
import type { ProfileUpdateInput } from "@z83/validation";
import { pool, query } from "../db.js";

interface ProfileRow {
  id: string;
  user_id: string;
  id_number: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  race: string | null;
  disability_status: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  postal_address_line1: string | null;
  postal_address_line2: string | null;
  postal_city: string | null;
  postal_province: string | null;
  postal_postal_code: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  drivers_licence_codes: string[] | null;
  professional_registrations: string[] | null;
  current_version_id: string | null;
  updated_at: string;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    idNumber: row.id_number,
    passportNumber: row.passport_number,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    nationality: row.nationality,
    race: row.race,
    disabilityStatus: row.disability_status,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    postalAddressLine1: row.postal_address_line1,
    postalAddressLine2: row.postal_address_line2,
    postalCity: row.postal_city,
    postalProvince: row.postal_province,
    postalPostalCode: row.postal_postal_code,
    phone: row.phone,
    altPhone: row.alt_phone,
    email: row.email,
    driversLicenceCodes: row.drivers_licence_codes,
    professionalRegistrations: row.professional_registrations,
    currentVersionId: row.current_version_id,
    updatedAt: row.updated_at,
  };
}

export async function createEmptyProfile(userId: string): Promise<Profile> {
  const { rows } = await query<ProfileRow>(
    `INSERT INTO profiles (user_id) VALUES ($1) RETURNING *`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  return mapProfile(row);
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const { rows } = await query<ProfileRow>(`SELECT * FROM profiles WHERE user_id = $1`, [
    userId,
  ]);
  const row = rows[0];
  return row ? mapProfile(row) : null;
}

export async function getProfileById(profileId: string): Promise<Profile | null> {
  const { rows } = await query<ProfileRow>(`SELECT * FROM profiles WHERE id = $1`, [profileId]);
  const row = rows[0];
  return row ? mapProfile(row) : null;
}

const PROFILE_COLUMNS: Record<keyof ProfileUpdateInput, string> = {
  idNumber: "id_number",
  passportNumber: "passport_number",
  dateOfBirth: "date_of_birth",
  gender: "gender",
  nationality: "nationality",
  race: "race",
  disabilityStatus: "disability_status",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  city: "city",
  province: "province",
  postalCode: "postal_code",
  postalAddressLine1: "postal_address_line1",
  postalAddressLine2: "postal_address_line2",
  postalCity: "postal_city",
  postalProvince: "postal_province",
  postalPostalCode: "postal_postal_code",
  phone: "phone",
  altPhone: "alt_phone",
  email: "email",
  driversLicenceCodes: "drivers_licence_codes",
  professionalRegistrations: "professional_registrations",
};

export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<Profile> {
  const entries = Object.entries(input) as [keyof ProfileUpdateInput, unknown][];
  if (entries.length === 0) {
    const existing = await getProfileByUserId(userId);
    if (!existing) throw new Error("Profile not found.");
    return existing;
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  entries.forEach(([key, value], i) => {
    setClauses.push(`${PROFILE_COLUMNS[key]} = $${i + 2}`);
    values.push(value);
  });

  const { rows } = await query<ProfileRow>(
    `UPDATE profiles SET ${setClauses.join(", ")} WHERE user_id = $1 RETURNING *`,
    [userId, ...values],
  );
  const row = rows[0];
  if (!row) throw new Error("Profile not found.");

  await recordProfileVersion(row.id);

  return mapProfile(row);
}

async function recordProfileVersion(profileId: string): Promise<void> {
  const full = await getFullProfileByProfileId(profileId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO profile_versions (profile_id, data) VALUES ($1, $2) RETURNING id`,
      [profileId, JSON.stringify(full)],
    );
    await client.query(`UPDATE profiles SET current_version_id = $1 WHERE id = $2`, [
      rows[0]?.id,
      profileId,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

interface QualificationRow {
  id: string;
  profile_id: string;
  institution: string;
  qualification_name: string;
  field_of_study: string | null;
  nqf_level: number | null;
  year_completed: number | null;
  still_studying: boolean;
  order_index: number;
}

function mapQualification(row: QualificationRow): Qualification {
  return {
    id: row.id,
    profileId: row.profile_id,
    institution: row.institution,
    qualificationName: row.qualification_name,
    fieldOfStudy: row.field_of_study,
    nqfLevel: row.nqf_level,
    yearCompleted: row.year_completed,
    stillStudying: row.still_studying,
    orderIndex: row.order_index,
  };
}

export async function listQualifications(profileId: string): Promise<Qualification[]> {
  const { rows } = await query<QualificationRow>(
    `SELECT * FROM qualifications WHERE profile_id = $1 ORDER BY order_index`,
    [profileId],
  );
  return rows.map(mapQualification);
}

export async function addQualification(
  profileId: string,
  input: {
    institution: string;
    qualificationName: string;
    fieldOfStudy?: string | null | undefined;
    nqfLevel?: number | null | undefined;
    yearCompleted?: number | null | undefined;
    stillStudying: boolean;
    orderIndex: number;
  },
): Promise<Qualification> {
  const { rows } = await query<QualificationRow>(
    `INSERT INTO qualifications
       (profile_id, institution, qualification_name, field_of_study, nqf_level, year_completed, still_studying, order_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      profileId,
      input.institution,
      input.qualificationName,
      input.fieldOfStudy ?? null,
      input.nqfLevel ?? null,
      input.yearCompleted ?? null,
      input.stillStudying,
      input.orderIndex,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  await recordProfileVersion(profileId);
  return mapQualification(row);
}

export async function deleteQualification(profileId: string, id: string): Promise<void> {
  await query(`DELETE FROM qualifications WHERE id = $1 AND profile_id = $2`, [id, profileId]);
  await recordProfileVersion(profileId);
}

interface WorkExperienceRow {
  id: string;
  profile_id: string;
  employer: string;
  job_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  responsibilities: string | null;
  order_index: number;
}

function mapWorkExperience(row: WorkExperienceRow): WorkExperience {
  return {
    id: row.id,
    profileId: row.profile_id,
    employer: row.employer,
    jobTitle: row.job_title,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    responsibilities: row.responsibilities,
    orderIndex: row.order_index,
  };
}

export async function listWorkExperience(profileId: string): Promise<WorkExperience[]> {
  const { rows } = await query<WorkExperienceRow>(
    `SELECT * FROM work_experience WHERE profile_id = $1 ORDER BY order_index`,
    [profileId],
  );
  return rows.map(mapWorkExperience);
}

export async function addWorkExperience(
  profileId: string,
  input: {
    employer: string;
    jobTitle: string;
    startDate: string;
    endDate?: string | null | undefined;
    isCurrent: boolean;
    responsibilities?: string | null | undefined;
    orderIndex: number;
  },
): Promise<WorkExperience> {
  const { rows } = await query<WorkExperienceRow>(
    `INSERT INTO work_experience
       (profile_id, employer, job_title, start_date, end_date, is_current, responsibilities, order_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      profileId,
      input.employer,
      input.jobTitle,
      input.startDate,
      input.endDate ?? null,
      input.isCurrent,
      input.responsibilities ?? null,
      input.orderIndex,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  await recordProfileVersion(profileId);
  return mapWorkExperience(row);
}

interface LanguageRow {
  id: string;
  profile_id: string;
  language: string;
  speak_level: LanguageSkill["speakLevel"];
  read_level: LanguageSkill["readLevel"];
  write_level: LanguageSkill["writeLevel"];
}

function mapLanguage(row: LanguageRow): LanguageSkill {
  return {
    id: row.id,
    profileId: row.profile_id,
    language: row.language,
    speakLevel: row.speak_level,
    readLevel: row.read_level,
    writeLevel: row.write_level,
  };
}

export async function listLanguages(profileId: string): Promise<LanguageSkill[]> {
  const { rows } = await query<LanguageRow>(
    `SELECT * FROM languages WHERE profile_id = $1 ORDER BY language`,
    [profileId],
  );
  return rows.map(mapLanguage);
}

export async function addLanguage(
  profileId: string,
  input: {
    language: string;
    speakLevel: LanguageSkill["speakLevel"];
    readLevel: LanguageSkill["readLevel"];
    writeLevel: LanguageSkill["writeLevel"];
  },
): Promise<LanguageSkill> {
  const { rows } = await query<LanguageRow>(
    `INSERT INTO languages (profile_id, language, speak_level, read_level, write_level)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [profileId, input.language, input.speakLevel, input.readLevel, input.writeLevel],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  await recordProfileVersion(profileId);
  return mapLanguage(row);
}

interface ReferenceRow {
  id: string;
  profile_id: string;
  full_name: string;
  relationship: string | null;
  organisation: string | null;
  phone: string | null;
  email: string | null;
  order_index: number;
}

function mapReference(row: ReferenceRow): ApplicantReference {
  return {
    id: row.id,
    profileId: row.profile_id,
    fullName: row.full_name,
    relationship: row.relationship,
    organisation: row.organisation,
    phone: row.phone,
    email: row.email,
    orderIndex: row.order_index,
  };
}

export async function listReferences(profileId: string): Promise<ApplicantReference[]> {
  const { rows } = await query<ReferenceRow>(
    `SELECT * FROM applicant_references WHERE profile_id = $1 ORDER BY order_index`,
    [profileId],
  );
  return rows.map(mapReference);
}

export async function addReference(
  profileId: string,
  input: {
    fullName: string;
    relationship?: string | null | undefined;
    organisation?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    orderIndex: number;
  },
): Promise<ApplicantReference> {
  const { rows } = await query<ReferenceRow>(
    `INSERT INTO applicant_references (profile_id, full_name, relationship, organisation, phone, email, order_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      profileId,
      input.fullName,
      input.relationship ?? null,
      input.organisation ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.orderIndex,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  await recordProfileVersion(profileId);
  return mapReference(row);
}

export async function getFullProfileByProfileId(profileId: string): Promise<FullProfile> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found.");
  const [qualifications, workExperience, languages, references] = await Promise.all([
    listQualifications(profileId),
    listWorkExperience(profileId),
    listLanguages(profileId),
    listReferences(profileId),
  ]);
  return { profile, qualifications, workExperience, languages, references };
}

export async function getFullProfileByUserId(userId: string): Promise<FullProfile | null> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return null;
  return getFullProfileByProfileId(profile.id);
}
