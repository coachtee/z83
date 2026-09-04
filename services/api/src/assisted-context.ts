import type { FastifyRequest } from "fastify";
import { HttpError } from "./auth.js";
import { getCafeStaffByUserId, getSessionById } from "./repo/cafe.js";

/**
 * Who a request is actually acting on behalf of, and who's really doing
 * it. Every profile/document route resolves this instead of reading
 * request.authUser.userId directly, so a café-assisted edit is both
 * effective (touches the applicant's own records) and attributable (the
 * audit trail shows the staff member, not just the applicant).
 */
export interface ActingContext {
  /** Whose profile/documents this request affects. */
  effectiveUserId: string;
  /** Who is actually making the request. */
  actorUserId: string;
  actorRole: string;
  assistedSessionId: string | null;
}

const ASSISTED_SESSION_HEADER = "x-assisted-session-id";

declare module "fastify" {
  interface FastifyRequest {
    actingContext?: ActingContext;
  }
}

/** preHandler: resolves and caches the acting context once per request so
 * every route handler downstream can just read request.actingContext. */
export async function attachActingContext(request: FastifyRequest): Promise<void> {
  request.actingContext = await resolveActingContext(request);
}

export async function resolveActingContext(request: FastifyRequest): Promise<ActingContext> {
  const authUser = request.authUser!;
  const sessionHeader = request.headers[ASSISTED_SESSION_HEADER];

  if (!sessionHeader || authUser.role !== "cafe_staff") {
    return {
      effectiveUserId: authUser.userId,
      actorUserId: authUser.userId,
      actorRole: authUser.role,
      assistedSessionId: null,
    };
  }

  const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
  const cafeStaff = await getCafeStaffByUserId(authUser.userId);
  const session = sessionId ? await getSessionById(sessionId) : null;

  if (
    !cafeStaff ||
    !session ||
    session.cafeStaffId !== cafeStaff.id ||
    session.status !== "open"
  ) {
    throw new HttpError(
      403,
      "ASSISTED_SESSION_NOT_AUTHORIZED",
      "This assisted session isn't open — the applicant needs to authorize it first, or it's already closed.",
    );
  }

  return {
    effectiveUserId: session.applicantUserId,
    actorUserId: authUser.userId,
    actorRole: authUser.role,
    assistedSessionId: session.id,
  };
}
