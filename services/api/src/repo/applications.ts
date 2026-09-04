import type {
  Application,
  ApplicationDocument,
  ApplicationDocumentRole,
  ApplicationEvent,
  ApplicationEventType,
  ApplicationSnapshot,
  ApplicationSnapshotData,
  ApplicationStatus,
  Signature,
} from "@z83/types";
import { pool, query } from "../db.js";
import { getFullProfileByUserId } from "./profiles.js";
import { listDocumentsForUser } from "./documents.js";

interface ApplicationRow {
  id: string;
  user_id: string;
  vacancy_id: string;
  snapshot_id: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

function mapApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    userId: row.user_id,
    vacancyId: row.vacancy_id,
    snapshotId: row.snapshot_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findOpenApplication(
  userId: string,
  vacancyId: string,
): Promise<Application | null> {
  const { rows } = await query<ApplicationRow>(
    `SELECT * FROM applications WHERE user_id = $1 AND vacancy_id = $2 AND status <> 'closed'`,
    [userId, vacancyId],
  );
  const row = rows[0];
  return row ? mapApplication(row) : null;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const { rows } = await query<ApplicationRow>(`SELECT * FROM applications WHERE id = $1`, [id]);
  const row = rows[0];
  return row ? mapApplication(row) : null;
}

export async function listApplicationsForUser(userId: string): Promise<Application[]> {
  const { rows } = await query<ApplicationRow>(
    `SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapApplication);
}

/**
 * Creates the application and its immutable snapshot in one transaction.
 * The snapshot is built from the live profile + documents *right now* —
 * nothing here reads from it again after this function returns.
 */
export async function createApplicationWithSnapshot(
  userId: string,
  vacancyId: string,
): Promise<Application> {
  const fullProfile = await getFullProfileByUserId(userId);
  if (!fullProfile) throw new Error("Applicant has no profile yet.");
  const documents = await listDocumentsForUser(userId);

  const snapshotData: ApplicationSnapshotData = {
    profile: fullProfile.profile,
    qualifications: fullProfile.qualifications,
    workExperience: fullProfile.workExperience,
    languages: fullProfile.languages,
    references: fullProfile.references,
    documents: documents.map((d) => ({
      id: d.id,
      documentTypeCode: d.documentTypeCode,
      originalFilename: d.originalFilename,
    })),
    capturedAt: new Date().toISOString(),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const appResult = await client.query<ApplicationRow>(
      `INSERT INTO applications (user_id, vacancy_id) VALUES ($1, $2) RETURNING *`,
      [userId, vacancyId],
    );
    const applicationRow = appResult.rows[0];
    if (!applicationRow) throw new Error("Insert did not return a row.");

    const snapshotResult = await client.query<{ id: string }>(
      `INSERT INTO application_snapshots (application_id, snapshot_data) VALUES ($1, $2) RETURNING id`,
      [applicationRow.id, JSON.stringify(snapshotData)],
    );
    const snapshotId = snapshotResult.rows[0]?.id;

    await client.query(`UPDATE applications SET snapshot_id = $1 WHERE id = $2`, [
      snapshotId,
      applicationRow.id,
    ]);

    await client.query(
      `INSERT INTO application_events (application_id, event_type, actor_user_id, actor_role)
       VALUES ($1, 'created', $2, 'applicant')`,
      [applicationRow.id, userId],
    );

    // Attach the applicant's currently-uploaded documents to the
    // application in the order they were uploaded; the actual submission
    // order used for the print/email package is decided by the vacancy's
    // instructions in the packaging step, not here.
    let orderIndex = 0;
    for (const doc of documents) {
      await client.query(
        `INSERT INTO application_documents (application_id, document_id, document_role, order_index)
         VALUES ($1, $2, $3, $4)`,
        [applicationRow.id, doc.id, roleForDocumentType(doc.documentTypeCode), orderIndex],
      );
      orderIndex += 1;
    }

    await client.query("COMMIT");
    return mapApplication({ ...applicationRow, snapshot_id: snapshotId ?? null });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function roleForDocumentType(code: string): ApplicationDocumentRole {
  switch (code) {
    case "id_document":
      return "id";
    case "cv":
      return "cv";
    case "qualification_certificate":
    case "matric_certificate":
      return "certificate";
    case "drivers_licence":
    case "professional_registration":
      return "registration";
    default:
      return "other";
  }
}

export async function getSnapshot(applicationId: string): Promise<ApplicationSnapshot | null> {
  const { rows } = await query<{ id: string; application_id: string; snapshot_data: ApplicationSnapshotData; created_at: string }>(
    `SELECT * FROM application_snapshots WHERE application_id = $1`,
    [applicationId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    applicationId: row.application_id,
    snapshotData: row.snapshot_data,
    createdAt: row.created_at,
  };
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<Application> {
  const { rows } = await query<ApplicationRow>(
    `UPDATE applications SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status],
  );
  const row = rows[0];
  if (!row) throw new Error("Application not found.");
  return mapApplication(row);
}

export async function addApplicationEvent(input: {
  applicationId: string;
  eventType: ApplicationEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await query(
    `INSERT INTO application_events (application_id, event_type, actor_user_id, actor_role, metadata)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      input.applicationId,
      input.eventType,
      input.actorUserId ?? null,
      input.actorRole ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
}

export async function listApplicationEvents(applicationId: string): Promise<ApplicationEvent[]> {
  const { rows } = await query<{
    id: string;
    application_id: string;
    event_type: ApplicationEventType;
    actor_user_id: string | null;
    actor_role: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>(`SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at`, [
    applicationId,
  ]);
  return rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export async function getLatestSignature(applicationId: string): Promise<Signature | null> {
  const { rows } = await query<{
    id: string;
    application_id: string;
    user_id: string;
    image_storage_key: string;
    signed_at: string;
  }>(
    `SELECT * FROM signatures WHERE application_id = $1 ORDER BY signed_at DESC LIMIT 1`,
    [applicationId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    applicationId: row.application_id,
    userId: row.user_id,
    imageStorageKey: row.image_storage_key,
    signedAt: row.signed_at,
  };
}

export async function addSignature(input: {
  applicationId: string;
  userId: string;
  imageStorageKey: string;
}): Promise<Signature> {
  const { rows } = await query<{
    id: string;
    application_id: string;
    user_id: string;
    image_storage_key: string;
    signed_at: string;
  }>(
    `INSERT INTO signatures (application_id, user_id, image_storage_key) VALUES ($1,$2,$3) RETURNING *`,
    [input.applicationId, input.userId, input.imageStorageKey],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  return {
    id: row.id,
    applicationId: row.application_id,
    userId: row.user_id,
    imageStorageKey: row.image_storage_key,
    signedAt: row.signed_at,
  };
}

/**
 * Regenerating the same file (e.g. /email-package previewed it, then
 * /send rebuilds it fresh) reuses the same deterministic storage key —
 * replace that row rather than accumulating duplicates that all point at
 * the same (overwritten) file.
 */
export async function addGeneratedApplicationDocument(input: {
  applicationId: string;
  documentRole: ApplicationDocumentRole;
  storageKey: string;
  orderIndex: number;
}): Promise<void> {
  await query(
    `DELETE FROM application_documents WHERE application_id = $1 AND storage_key = $2`,
    [input.applicationId, input.storageKey],
  );
  await query(
    `INSERT INTO application_documents (application_id, document_role, storage_key, order_index)
     VALUES ($1,$2,$3,$4)`,
    [input.applicationId, input.documentRole, input.storageKey, input.orderIndex],
  );
}

export async function listApplicationDocuments(
  applicationId: string,
): Promise<ApplicationDocument[]> {
  const { rows } = await query<{
    id: string;
    application_id: string;
    document_id: string | null;
    document_role: ApplicationDocumentRole;
    storage_key: string | null;
    order_index: number;
  }>(
    `SELECT * FROM application_documents WHERE application_id = $1 ORDER BY order_index`,
    [applicationId],
  );
  return rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    documentId: row.document_id,
    documentRole: row.document_role,
    storageKey: row.storage_key,
    orderIndex: row.order_index,
  }));
}
