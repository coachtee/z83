import { pool } from "../db.js";

const TABLES = [
  "audit_logs",
  "notifications",
  "signatures",
  "application_events",
  "application_documents",
  "application_snapshots",
  "applications",
  "vacancy_requirements",
  "vacancies",
  "circulars",
  "departments",
  "documents",
  "document_types",
  "applicant_references",
  "languages",
  "work_experience",
  "qualifications",
  "profile_versions",
  "profiles",
  "assisted_sessions",
  "cafe_staff",
  "cafe_accounts",
  "admin_users",
  "users",
];

export async function resetDatabase(): Promise<void> {
  await pool.query(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}
