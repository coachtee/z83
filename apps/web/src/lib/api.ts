import type {
  Application,
  ApplicationDocument,
  ApplicationEvent,
  ApplicationSnapshot,
  AssistedSession,
  DocumentTypeCode,
  EmailPackage,
  FullProfile,
  MatchResult,
  AppDocument as ProfileDocument,
  User,
  Vacancy,
  VacancyRequirement,
  ValidationReport,
} from "@z83/types";

/** Header naming an open café-assisted session, so profile/document/vacancy
 * requests act on the applicant the session names instead of the caller. */
export function assistedHeaders(sessionId: string): HeadersInit {
  return { "X-Assisted-Session-Id": sessionId };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers:
      options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.error?.message ?? "Something went wrong.";
    throw new ApiError(response.status, body?.error?.code ?? "UNKNOWN", message);
  }

  return body as T;
}

function json(data: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(data) };
}

export const api = {
  register: (input: { email: string; password: string; fullName: string }) =>
    request<{ user: User }>("/auth/register", json(input)),
  login: (input: { email: string; password: string }) =>
    request<{ user: User }>("/auth/login", json(input)),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),

  getProfile: (headers?: HeadersInit) => request<FullProfile>("/profile", { headers }),
  updateProfile: (input: Record<string, unknown>, headers?: HeadersInit) =>
    request<{ profile: FullProfile["profile"] }>("/profile", {
      method: "PUT",
      body: JSON.stringify(input),
      headers,
    }),
  getCompleteness: () => request<ValidationReport>("/profile/completeness"),
  addQualification: (input: Record<string, unknown>, headers?: HeadersInit) =>
    request<{ qualification: FullProfile["qualifications"][number] }>(
      "/profile/qualifications",
      { ...json(input), headers },
    ),
  deleteQualification: (id: string) =>
    request<void>(`/profile/qualifications/${id}`, { method: "DELETE" }),
  addWorkExperience: (input: Record<string, unknown>, headers?: HeadersInit) =>
    request<{ experience: FullProfile["workExperience"][number] }>(
      "/profile/work-experience",
      { ...json(input), headers },
    ),
  addReference: (input: Record<string, unknown>, headers?: HeadersInit) =>
    request<{ reference: FullProfile["references"][number] }>(
      "/profile/references",
      { ...json(input), headers },
    ),

  listDocuments: (headers?: HeadersInit) =>
    request<{ documents: ProfileDocument[] }>("/documents", { headers }),
  uploadDocument: (file: File, documentTypeCode: DocumentTypeCode, headers?: HeadersInit) => {
    const form = new FormData();
    form.append("documentTypeCode", documentTypeCode);
    form.append("file", file);
    return request<{ document: ProfileDocument }>("/documents", {
      method: "POST",
      body: form,
      headers,
    });
  },
  getDocumentUrl: (id: string) => request<{ url: string }>(`/documents/${id}/url`),
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),

  listVacancies: (params?: { province?: string }, headers?: HeadersInit) => {
    const query = params?.province ? `?province=${encodeURIComponent(params.province)}` : "";
    return request<{ vacancies: (Vacancy & { matchPercentage: number | null })[] }>(
      `/vacancies${query}`,
      { headers },
    );
  },
  getVacancy: (id: string, headers?: HeadersInit) =>
    request<{
      vacancy: Vacancy;
      requirements: VacancyRequirement[];
      match: MatchResult | null;
    }>(`/vacancies/${id}`, { headers }),

  listApplications: () => request<{ applications: Application[] }>("/applications"),
  createApplication: (vacancyId: string) =>
    request<{ application: Application }>("/applications", json({ vacancyId })),
  getApplication: (id: string) =>
    request<{
      application: Application;
      snapshot: ApplicationSnapshot | null;
      vacancy: Vacancy | null;
      documents: ApplicationDocument[];
      match: MatchResult | null;
    }>(`/applications/${id}`),
  getApplicationEvents: (id: string) =>
    request<{ events: ApplicationEvent[] }>(`/applications/${id}/events`),
  reviewApplication: (id: string) =>
    request<ValidationReport>(`/applications/${id}/review`, { method: "POST" }),
  signApplication: (id: string, imageBase64: string) =>
    request<{ status: string }>(`/applications/${id}/sign`, json({ imageBase64 })),
  buildEmailPackage: (id: string) =>
    request<{ emailPackage: EmailPackage; sent: boolean }>(
      `/applications/${id}/email-package`,
      { method: "POST" },
    ),
  buildPrintPackage: (id: string) =>
    request<{ url: string; expiresInSeconds: number }>(
      `/applications/${id}/print-package`,
      { method: "POST" },
    ),
  sendApplication: (id: string) =>
    request<{ success: boolean; recipient: string; attemptedAt: string; error?: string }>(
      `/applications/${id}/send`,
      json({ confirm: true }),
    ),
  updateApplicationStatus: (id: string, status: string) =>
    request<{ application: Application }>(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  cafeFindApplicant: (email: string) =>
    request<{ exists: boolean }>(`/cafe/applicants?email=${encodeURIComponent(email)}`),
  cafeOpenSession: (input: {
    applicantEmail: string;
    newApplicantPassword?: string;
    applicantFullName?: string;
    openedReason?: string;
  }) =>
    request<{ session: AssistedSession; newAccount: boolean }>("/cafe/sessions", json(input)),
  cafeAuthorizeSession: (id: string, password: string) =>
    request<{ session: AssistedSession }>(`/cafe/sessions/${id}/authorize`, json({ password })),
  cafeCloseSession: (id: string) =>
    request<{ session: AssistedSession }>(`/cafe/sessions/${id}/close`, { method: "POST" }),
  cafeGetSession: (id: string) => request<{ session: AssistedSession }>(`/cafe/sessions/${id}`),
};
