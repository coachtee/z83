#!/usr/bin/env node
// Development-only seed data. No real applicant data ever goes here.
//
// Seeds: document types, one department, one admin account, one café
// account + staff account, and one synthetic-but-realistic vacancy
// (clearly marked as dev fixture data, not a scraped real circular) so the
// vertical slice can be exercised end to end without waiting on a real
// circular upload.
import bcrypt from "bcryptjs";
import pg from "pg";
import "dotenv/config";

const DOCUMENT_TYPES = [
  { code: "id_document", label: "ID document", requiresCertification: true },
  { code: "matric_certificate", label: "Matric certificate", requiresCertification: true },
  {
    code: "qualification_certificate",
    label: "Qualification certificate",
    requiresCertification: true,
  },
  { code: "cv", label: "Curriculum vitae", requiresCertification: false },
  { code: "drivers_licence", label: "Driver's licence", requiresCertification: true },
  {
    code: "professional_registration",
    label: "Professional registration",
    requiresCertification: true,
  },
  { code: "other", label: "Other supporting document", requiresCertification: false },
  { code: "z83_form_template", label: "Official Z83 form template (system use)", requiresCertification: false },
];

const DEV_ADMIN_PASSWORD = "DevPassword123!";
const DEV_CAFE_PASSWORD = "DevPassword123!";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    for (const dt of DOCUMENT_TYPES) {
      await client.query(
        `INSERT INTO document_types (code, label, requires_certification)
         VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
        [dt.code, dt.label, dt.requiresCertification],
      );
    }
    console.log(`Seeded ${DOCUMENT_TYPES.length} document types.`);

    const deptResult = await client.query(
      `INSERT INTO departments (name, code) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code
       RETURNING id`,
      ["Department of Public Service and Administration", "DPSA"],
    );
    const departmentId = deptResult.rows[0].id;

    const adminEmail = "admin@z83.naleli.co.za";
    const adminHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
    const adminUserResult = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'admin', 'Z83 Dev Admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [adminEmail, adminHash],
    );
    const adminUserId = adminUserResult.rows[0].id;
    const adminUsersResult = await client.query(
      `INSERT INTO admin_users (user_id, permission_level)
       VALUES ($1, 'superadmin')
       ON CONFLICT (user_id) DO UPDATE SET permission_level = EXCLUDED.permission_level
       RETURNING id`,
      [adminUserId],
    );
    const adminId = adminUsersResult.rows[0].id;
    console.log(`Seeded admin account: ${adminEmail} / ${DEV_ADMIN_PASSWORD}`);

    const cafeResult = await client.query(
      `INSERT INTO cafe_accounts (name, province, address)
       VALUES ('Tshwane Digital Hub', 'Gauteng', '123 Church Street, Pretoria')
       ON CONFLICT DO NOTHING
       RETURNING id`,
    );
    let cafeAccountId = cafeResult.rows[0]?.id;
    if (!cafeAccountId) {
      const existing = await client.query(
        `SELECT id FROM cafe_accounts WHERE name = 'Tshwane Digital Hub'`,
      );
      cafeAccountId = existing.rows[0].id;
    }

    const cafeStaffEmail = "cafe-staff@z83.naleli.co.za";
    const cafeHash = await bcrypt.hash(DEV_CAFE_PASSWORD, 10);
    const cafeUserResult = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'cafe_staff', 'Dev Café Staff')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [cafeStaffEmail, cafeHash],
    );
    await client.query(
      `INSERT INTO cafe_staff (user_id, cafe_account_id)
       VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [cafeUserResult.rows[0].id, cafeAccountId],
    );
    console.log(`Seeded café staff account: ${cafeStaffEmail} / ${DEV_CAFE_PASSWORD}`);

    const circularNumber = "DEV-SEED-01-2026";
    const circularResult = await client.query(
      `INSERT INTO circulars (circular_number, publication_date, ingestion_method, status, uploaded_by_admin_id)
       VALUES ($1, CURRENT_DATE, 'manual_upload', 'processed', $2)
       ON CONFLICT (circular_number) DO UPDATE SET status = EXCLUDED.status
       RETURNING id`,
      [circularNumber, adminId],
    );
    const circularId = circularResult.rows[0].id;

    const existingVacancy = await client.query(
      `SELECT id FROM vacancies WHERE reference_number = $1`,
      ["DPSA/DEV/2026/001"],
    );

    let vacancyId = existingVacancy.rows[0]?.id;
    if (!vacancyId) {
      const closingAt = new Date();
      closingAt.setDate(closingAt.getDate() + 21);

      const vacancyResult = await client.query(
        `INSERT INTO vacancies (
           circular_id, department_id, job_title, reference_number, salary_text,
           province, location_text, page_number, closing_at, submission_method,
           submission_email, special_instructions, status, verified_by_admin_id, verified_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published',$13, now())
         RETURNING id`,
        [
          circularId,
          departmentId,
          "Administration Clerk: Registry Services",
          "DPSA/DEV/2026/001",
          "R202 233 – R238 269 per annum (Level 05)",
          "Gauteng",
          "Pretoria",
          1,
          closingAt.toISOString(),
          "email",
          "recruitment-devseed@example.org",
          "Development seed fixture — not a live circular. Quote the reference number in the subject line.",
          adminId,
        ],
      );
      vacancyId = vacancyResult.rows[0].id;

      const requirements = [
        {
          type: "qualification",
          description:
            "Grade 12 certificate plus a National Diploma (NQF Level 6) in Public Administration or Office Management",
          minimumValue: "6",
          mandatory: true,
        },
        {
          type: "experience_years",
          description: "At least 3 years' relevant administrative experience",
          minimumValue: "3",
          mandatory: true,
        },
        {
          type: "drivers_licence",
          description: "A valid Code B driving licence will be an added advantage",
          minimumValue: "B",
          mandatory: false,
        },
        {
          type: "competency",
          description:
            "Knowledge of the Public Finance Management Act (PFMA) and Batho Pele principles",
          minimumValue: null,
          mandatory: true,
        },
      ];

      for (let i = 0; i < requirements.length; i++) {
        const r = requirements[i];
        await client.query(
          `INSERT INTO vacancy_requirements
             (vacancy_id, requirement_type, description, minimum_value, is_mandatory, order_index)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [vacancyId, r.type, r.description, r.minimumValue, r.mandatory, i],
        );
      }
      console.log(`Seeded sample vacancy DPSA/DEV/2026/001 with ${requirements.length} requirements.`);
    } else {
      console.log("Sample vacancy already seeded.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
