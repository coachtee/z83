import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@z83/types";
import { config } from "./config.js";

export interface SessionPayload {
  userId: string;
  role: UserRole;
}

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h — short-lived per docs/ARCHITECTURE.md

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(config.sessionCookieName, { path: "/" });
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: SessionPayload;
  }
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = request.cookies[config.sessionCookieName];
  const session = token ? verifySession(token) : null;
  if (!session) {
    throw new HttpError(401, "UNAUTHENTICATED", "You need to be logged in.");
  }
  request.authUser = session;
}

/** Populates request.authUser when a valid session cookie is present, but
 * never rejects the request — used by routes that behave differently for
 * anonymous vs logged-in callers (e.g. vacancy match percentages). */
export async function tryAuthenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = request.cookies[config.sessionCookieName];
  const session = token ? verifySession(token) : null;
  if (session) {
    request.authUser = session;
  }
}

export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.authUser || !roles.includes(request.authUser.role)) {
      throw new HttpError(403, "FORBIDDEN", "You don't have access to do that.");
    }
  };
}
