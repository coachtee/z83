import type {
  Circular,
  CircularStatus,
  IngestionMethod,
  RequirementType,
  SubmissionMethod,
  Vacancy,
  VacancyRequirement,
  VacancyStatus,
} from "@z83/types";
import { query } from "../db.js";

interface VacancyRow {
  id: string;
  circular_id: string;
  department_id: string;
  department_name: string;
  job_title: string;
  reference_number: string;
  salary_text: string | null;
  province: string | null;
  location_text: string | null;
  page_number: number | null;
  closing_at: string | null;
  submission_method: SubmissionMethod;
  submission_email: string | null;
  submission_address: string | null;
  special_instructions: string | null;
  raw_extracted_text: string | null;
  status: VacancyStatus;
  verified_by_admin_id: string | null;
  verified_at: string | null;
  created_at: string;
}

function mapVacancy(row: VacancyRow): Vacancy {
  return {
    id: row.id,
    circularId: row.circular_id,
    departmentId: row.department_id,
    departmentName: row.department_name,
    jobTitle: row.job_title,
    referenceNumber: row.reference_number,
    salaryText: row.salary_text,
    province: row.province,
    locationText: row.location_text,
    pageNumber: row.page_number,
    closingAt: row.closing_at,
    submissionMethod: row.submission_method,
    submissionEmail: row.submission_email,
    submissionAddress: row.submission_address,
    specialInstructions: row.special_instructions,
    rawExtractedText: row.raw_extracted_text,
    status: row.status,
    verifiedByAdminId: row.verified_by_admin_id,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

const SELECT_VACANCY = `
  SELECT v.*, d.name AS department_name
  FROM vacancies v
  JOIN departments d ON d.id = v.department_id
`;

export async function listPublishedVacancies(filters: {
  province?: string | undefined;
  departmentId?: string | undefined;
}): Promise<Vacancy[]> {
  const conditions = ["v.status = 'published'"];
  const params: unknown[] = [];
  if (filters.province) {
    params.push(filters.province);
    conditions.push(`v.province = $${params.length}`);
  }
  if (filters.departmentId) {
    params.push(filters.departmentId);
    conditions.push(`v.department_id = $${params.length}`);
  }
  const { rows } = await query<VacancyRow>(
    `${SELECT_VACANCY} WHERE ${conditions.join(" AND ")} ORDER BY v.closing_at NULLS LAST`,
    params,
  );
  return rows.map(mapVacancy);
}

export async function getVacancyById(id: string): Promise<Vacancy | null> {
  const { rows } = await query<VacancyRow>(`${SELECT_VACANCY} WHERE v.id = $1`, [id]);
  const row = rows[0];
  return row ? mapVacancy(row) : null;
}

interface RequirementRow {
  id: string;
  vacancy_id: string;
  requirement_type: RequirementType;
  description: string;
  minimum_value: string | null;
  is_mandatory: boolean;
  order_index: number;
}

function mapRequirement(row: RequirementRow): VacancyRequirement {
  return {
    id: row.id,
    vacancyId: row.vacancy_id,
    requirementType: row.requirement_type,
    description: row.description,
    minimumValue: row.minimum_value,
    isMandatory: row.is_mandatory,
    orderIndex: row.order_index,
  };
}

export async function listRequirements(vacancyId: string): Promise<VacancyRequirement[]> {
  const { rows } = await query<RequirementRow>(
    `SELECT * FROM vacancy_requirements WHERE vacancy_id = $1 ORDER BY order_index`,
    [vacancyId],
  );
  return rows.map(mapRequirement);
}

export async function listPendingVacancies(): Promise<Vacancy[]> {
  const { rows } = await query<VacancyRow>(
    `${SELECT_VACANCY} WHERE v.status = 'pending_verification' ORDER BY v.created_at`,
  );
  return rows.map(mapVacancy);
}

export async function verifyVacancy(
  id: string,
  adminId: string,
  approve: boolean,
): Promise<Vacancy | null> {
  const { rows } = await query<VacancyRow>(
    `UPDATE vacancies SET status = $2, verified_by_admin_id = $3, verified_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, approve ? "published" : "rejected", adminId],
  );
  const row = rows[0];
  if (!row) return null;
  const full = await getVacancyById(row.id);
  return full;
}

export async function getOrCreateDepartment(name: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO departments (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to resolve department.");
  return id;
}

interface CircularRow {
  id: string;
  circular_number: string;
  publication_date: string;
  source_url: string | null;
  source_document_key: string | null;
  ingestion_method: IngestionMethod;
  status: CircularStatus;
  uploaded_by_admin_id: string | null;
  created_at: string;
}

function mapCircular(row: CircularRow): Circular {
  return {
    id: row.id,
    circularNumber: row.circular_number,
    publicationDate: row.publication_date,
    sourceUrl: row.source_url,
    sourceDocumentKey: row.source_document_key,
    ingestionMethod: row.ingestion_method,
    status: row.status,
    uploadedByAdminId: row.uploaded_by_admin_id,
    createdAt: row.created_at,
  };
}

export async function listCirculars(): Promise<Circular[]> {
  const { rows } = await query<CircularRow>(`SELECT * FROM circulars ORDER BY created_at DESC`);
  return rows.map(mapCircular);
}

export async function getCircularById(id: string): Promise<Circular | null> {
  const { rows } = await query<CircularRow>(`SELECT * FROM circulars WHERE id = $1`, [id]);
  const row = rows[0];
  return row ? mapCircular(row) : null;
}

export async function listVacanciesByCircular(circularId: string): Promise<Vacancy[]> {
  const { rows } = await query<VacancyRow>(`${SELECT_VACANCY} WHERE v.circular_id = $1`, [
    circularId,
  ]);
  return rows.map(mapVacancy);
}

export async function createCircular(input: {
  circularNumber: string;
  publicationDate: string;
  ingestionMethod: "manual_upload" | "automatic";
  sourceDocumentKey?: string | null;
  uploadedByAdminId?: string | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO circulars (circular_number, publication_date, ingestion_method, source_document_key, uploaded_by_admin_id, status)
     VALUES ($1,$2,$3,$4,$5,'processed') RETURNING id`,
    [
      input.circularNumber,
      input.publicationDate,
      input.ingestionMethod,
      input.sourceDocumentKey ?? null,
      input.uploadedByAdminId ?? null,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Insert did not return a row.");
  return id;
}

export async function createDraftVacancy(input: {
  circularId: string;
  departmentId: string;
  jobTitle: string;
  referenceNumber: string;
  salaryText: string | null;
  province: string | null;
  locationText: string | null;
  pageNumber: number | null;
  closingAt: string | null;
  submissionMethod: SubmissionMethod;
  submissionEmail: string | null;
  submissionAddress: string | null;
  specialInstructions: string | null;
  rawExtractedText: string | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO vacancies (
       circular_id, department_id, job_title, reference_number, salary_text, province,
       location_text, page_number, closing_at, submission_method, submission_email,
       submission_address, special_instructions, raw_extracted_text
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      input.circularId,
      input.departmentId,
      input.jobTitle,
      input.referenceNumber,
      input.salaryText,
      input.province,
      input.locationText,
      input.pageNumber,
      input.closingAt,
      input.submissionMethod,
      input.submissionEmail,
      input.submissionAddress,
      input.specialInstructions,
      input.rawExtractedText,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Insert did not return a row.");
  return id;
}

export async function addRequirement(
  vacancyId: string,
  input: {
    requirementType: RequirementType;
    description: string;
    minimumValue: string | null;
    isMandatory: boolean;
    orderIndex: number;
  },
): Promise<void> {
  await query(
    `INSERT INTO vacancy_requirements (vacancy_id, requirement_type, description, minimum_value, is_mandatory, order_index)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      vacancyId,
      input.requirementType,
      input.description,
      input.minimumValue,
      input.isMandatory,
      input.orderIndex,
    ],
  );
}
