import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readSmtpConfig() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "Z83 <no-reply@naleli.co.za>",
  };
}

const jwtSecret = required("JWT_SECRET");

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  /** Signs local-storage download URLs (see src/storage.ts). Separate from
   * jwtSecret so a leak of one doesn't also forge the other; falls back to
   * jwtSecret only so dev setups without the extra var still work. */
  storageSigningSecret: process.env.STORAGE_SIGNING_SECRET ?? jwtSecret,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "z83_session",
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "supabase" | "r2",
  storageLocalRoot: process.env.STORAGE_LOCAL_ROOT ?? "./storage-dev",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",
  /** null when SMTP_HOST isn't set — sending is then reported as
   * unconfigured rather than silently no-op'd. See src/email.ts. */
  get smtp() {
    return readSmtpConfig();
  },
};
