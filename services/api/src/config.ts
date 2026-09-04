import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "z83_session",
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "supabase" | "r2",
  storageLocalRoot: process.env.STORAGE_LOCAL_ROOT ?? "./storage-dev",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",
};
