import type { EmailDelivery } from "@z83/types";
import { query } from "../db.js";

interface EmailDeliveryRow {
  id: string;
  application_id: string;
  recipient: string;
  subject: string;
  body: string;
  attachments: { label: string; storageKey: string }[];
  attempted_at: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

function mapEmailDelivery(row: EmailDeliveryRow): EmailDelivery {
  return {
    id: row.id,
    applicationId: row.application_id,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    attachments: row.attachments,
    attemptedAt: row.attempted_at,
    success: row.success,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function recordEmailDelivery(input: {
  applicationId: string;
  recipient: string;
  subject: string;
  body: string;
  attachments: { label: string; storageKey: string }[];
  success: boolean;
  errorMessage?: string | null;
}): Promise<EmailDelivery> {
  const { rows } = await query<EmailDeliveryRow>(
    `INSERT INTO email_deliveries (application_id, recipient, subject, body, attachments, success, error_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      input.applicationId,
      input.recipient,
      input.subject,
      input.body,
      JSON.stringify(input.attachments),
      input.success,
      input.errorMessage ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  return mapEmailDelivery(row);
}

export async function listEmailDeliveries(applicationId: string): Promise<EmailDelivery[]> {
  const { rows } = await query<EmailDeliveryRow>(
    `SELECT * FROM email_deliveries WHERE application_id = $1 ORDER BY attempted_at DESC`,
    [applicationId],
  );
  return rows.map(mapEmailDelivery);
}
