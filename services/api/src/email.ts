import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config.js";

export interface OutgoingEmail {
  recipient: string;
  subject: string;
  body: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}

export interface SendOutcome {
  success: boolean;
  error?: string;
}

interface ResolvedTransport {
  transporter: Transporter;
  from: string;
}

let resolved: ResolvedTransport | null | undefined;

/** undefined = not yet resolved, null = deliberately unconfigured. */
function getTransport(): ResolvedTransport | null {
  if (resolved !== undefined) return resolved;
  const smtp = config.smtp;
  if (!smtp) {
    resolved = null;
    return null;
  }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user && smtp.pass ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
  });
  resolved = { transporter, from: smtp.from };
  return resolved;
}

/**
 * Real SMTP dispatch — no queue, no "fire and forget." The caller awaits
 * this and records the outcome (services/api/src/routes/applications.ts,
 * POST /applications/:id/send) before telling the applicant anything.
 * Never call this without the applicant's explicit confirmation.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendOutcome> {
  const transport = getTransport();
  if (!transport) {
    return { success: false, error: "Email sending is not configured on this server." };
  }
  try {
    await transport.transporter.sendMail({
      from: transport.from,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
      attachments: email.attachments,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown send error." };
  }
}

/** Test-only escape hatch so tests can point at a fresh local SMTP server per run. */
export function resetTransporterForTests(): void {
  resolved = undefined;
}
