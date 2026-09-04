import { SMTPServer } from "smtp-server";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import { resetTransporterForTests, sendEmail } from "../email.js";

/**
 * Runs a real SMTP protocol server on localhost — not a mock of
 * nodemailer, an actual server that speaks the SMTP wire protocol and
 * receives the message nodemailer sends. Proves the whole send path works
 * against real SMTP, without needing a real internet-facing provider.
 */
describe("sendEmail", () => {
  let server: SMTPServer;
  let port: number;
  const receivedMessages: { from: string; to: string[]; raw: string }[] = [];

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS"],
      onData(stream, session, callback) {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          receivedMessages.push({
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
            to: session.envelope.rcptTo.map((r) => r.address),
            raw: Buffer.concat(chunks).toString("utf8"),
          });
          callback();
        });
      },
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    const address = server.server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test SMTP server.");
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterEach(() => {
    receivedMessages.length = 0;
    resetTransporterForTests();
  });

  it("reports not-configured when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST;
    const outcome = await sendEmail({
      recipient: "recruitment@example.org",
      subject: "Application: Test Post",
      body: "Please find my application attached.",
      attachments: [],
    });
    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/not configured/i);
  });

  it("really sends over SMTP to a live local server and the message arrives with the right envelope and attachment", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_FROM = "Z83 <no-reply@naleli.co.za>";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const outcome = await sendEmail({
      recipient: "recruitment@example.org",
      subject: "Application: Administration Clerk (Ref: DPSA/01/2026)",
      body: "Please find attached my application.",
      attachments: [
        { filename: "Z83 Application.pdf", content: Buffer.from("%PDF-1.4 fake"), contentType: "application/pdf" },
      ],
    });

    expect(outcome.success).toBe(true);
    expect(outcome.error).toBeUndefined();
    expect(receivedMessages).toHaveLength(1);
    const message = receivedMessages[0]!;
    expect(message.to).toEqual(["recruitment@example.org"]);
    expect(message.raw).toContain("Application: Administration Clerk (Ref: DPSA/01/2026)");
    expect(message.raw).toContain("Z83 Application.pdf");
  });

  it("reports failure clearly when the SMTP server is unreachable", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1"; // nothing listens on port 1
    process.env.SMTP_SECURE = "false";

    const outcome = await sendEmail({
      recipient: "recruitment@example.org",
      subject: "Application: Test Post",
      body: "Body",
      attachments: [],
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBeTruthy();
  });
});
