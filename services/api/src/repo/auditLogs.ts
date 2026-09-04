import { query } from "../db.js";

/**
 * System-wide audit trail — broader than application_events (which is
 * scoped to one application's lifecycle). Every profile/document mutation,
 * assisted-session transition, and admin action goes through here.
 */
export async function recordAuditLog(input: {
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, metadata, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.actorUserId,
      input.actorRole,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.ipAddress ?? null,
    ],
  );
}

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export async function listAuditLogsForEntity(
  entityType: string,
  entityId: string,
): Promise<AuditLogRow[]> {
  const { rows } = await query<{
    id: string;
    actor_user_id: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
  }>(
    `SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [entityType, entityId],
  );
  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  }));
}
