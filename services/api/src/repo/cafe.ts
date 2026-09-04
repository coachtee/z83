import type { AssistedSession } from "@z83/types";
import { query } from "../db.js";

interface CafeStaffRow {
  id: string;
  user_id: string;
  cafe_account_id: string;
}

export async function getCafeStaffByUserId(userId: string): Promise<CafeStaffRow | null> {
  const { rows } = await query<CafeStaffRow>(`SELECT * FROM cafe_staff WHERE user_id = $1`, [
    userId,
  ]);
  return rows[0] ?? null;
}

interface SessionRow {
  id: string;
  cafe_staff_id: string;
  applicant_user_id: string;
  status: "pending" | "open" | "closed";
  opened_at: string;
  authorized_at: string | null;
  closed_at: string | null;
  opened_reason: string | null;
}

function mapSession(row: SessionRow): AssistedSession {
  return {
    id: row.id,
    cafeStaffId: row.cafe_staff_id,
    applicantUserId: row.applicant_user_id,
    status: row.status,
    openedAt: row.opened_at,
    authorizedAt: row.authorized_at,
    closedAt: row.closed_at,
    openedReason: row.opened_reason,
  };
}

/** Staff starts a session — this alone grants no access. It stays
 * 'pending' until the applicant authorizes it themselves. */
export async function openAssistedSession(input: {
  cafeStaffId: string;
  applicantUserId: string;
  openedReason?: string | null | undefined;
}): Promise<AssistedSession> {
  const { rows } = await query<SessionRow>(
    `INSERT INTO assisted_sessions (cafe_staff_id, applicant_user_id, opened_reason)
     VALUES ($1,$2,$3) RETURNING *`,
    [input.cafeStaffId, input.applicantUserId, input.openedReason ?? null],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  return mapSession(row);
}

export async function getSessionById(id: string): Promise<AssistedSession | null> {
  const { rows } = await query<SessionRow>(`SELECT * FROM assisted_sessions WHERE id = $1`, [id]);
  const row = rows[0];
  return row ? mapSession(row) : null;
}

/** The applicant's own explicit consent — the only thing that turns a
 * pending session into one staff can actually act within. */
export async function authorizeAssistedSession(id: string): Promise<AssistedSession | null> {
  const { rows } = await query<SessionRow>(
    `UPDATE assisted_sessions SET status = 'open', authorized_at = now()
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id],
  );
  const row = rows[0];
  return row ? mapSession(row) : null;
}

export async function closeAssistedSession(id: string): Promise<AssistedSession | null> {
  const { rows } = await query<SessionRow>(
    `UPDATE assisted_sessions SET status = 'closed', closed_at = now()
     WHERE id = $1 AND status IN ('pending', 'open') RETURNING *`,
    [id],
  );
  const row = rows[0];
  return row ? mapSession(row) : null;
}
