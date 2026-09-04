"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api, assistedHeaders } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AssistedSession, DocumentTypeCode, FullProfile, AppDocument, Vacancy } from "@z83/types";

const DRIVERS_LICENCE_CODES = ["A", "A1", "B", "EB", "C1", "C", "EC1", "EC"] as const;
const DOCUMENT_TYPES: { code: DocumentTypeCode; label: string }[] = [
  { code: "id_document", label: "ID document" },
  { code: "cv", label: "CV" },
  { code: "qualification_certificate", label: "Qualification certificate" },
  { code: "matric_certificate", label: "Matric certificate" },
  { code: "drivers_licence", label: "Driver's licence" },
  { code: "professional_registration", label: "Professional registration" },
  { code: "other", label: "Other" },
];

export default function CafeSessionPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <CafeSessionContent {...props} />
    </Suspense>
  );
}

function CafeSessionContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const searchParams = useSearchParams();
  const applicantEmail = searchParams.get("email");
  const { user, loading } = useSession();
  const router = useRouter();

  const [session, setSession] = useState<AssistedSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [vacancies, setVacancies] = useState<(Vacancy & { matchPercentage: number | null })[]>([]);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const headers = assistedHeaders(sessionId);

  const refresh = useCallback(async () => {
    try {
      const [sessionRes, profileRes, documentsRes, vacanciesRes] = await Promise.all([
        api.cafeGetSession(sessionId),
        api.getProfile(headers),
        api.listDocuments(headers),
        api.listVacancies(undefined, headers),
      ]);
      setSession(sessionRes.session);
      setProfile(profileRes);
      setDocuments(documentsRes.documents);
      setVacancies(vacanciesRes.vacancies);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't load this session.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role !== "cafe_staff") router.push("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "cafe_staff") void refresh();
  }, [user, refresh]);

  if (loading || !user || user.role !== "cafe_staff") return null;

  if (notFound) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-8">
          <Alert variant="destructive">
            <AlertDescription>
              This session has ended or was never authorized. Staff access to an applicant&apos;s
              information stops the moment a session closes.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" asChild>
            <Link href="/cafe">Start another session</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!session || !profile) return null;

  if (session.status === "pending") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-8">
          <Alert>
            <AlertDescription>
              This session hasn&apos;t been authorized yet. The applicant needs to type their own
              password on the &ldquo;Assist an applicant&rdquo; screen before you can continue.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" asChild>
            <Link href="/cafe">Back to start</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const p = profile.profile;

  async function handlePersonalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalSaved(false);
    const form = new FormData(e.currentTarget);
    const driversLicenceCodes = DRIVERS_LICENCE_CODES.filter((code) => form.get(`licence-${code}`));
    try {
      await api.updateProfile(
        {
          idNumber: form.get("idNumber") || null,
          dateOfBirth: form.get("dateOfBirth") || null,
          phone: form.get("phone") || null,
          email: form.get("email") || null,
          addressLine1: form.get("addressLine1") || null,
          city: form.get("city") || null,
          province: form.get("province") || null,
          postalCode: form.get("postalCode") || null,
          driversLicenceCodes,
        },
        headers,
      );
      await refresh();
      setPersonalSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those changes.");
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleAddQualification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.addQualification(
      {
        institution: form.get("institution"),
        qualificationName: form.get("qualificationName"),
        nqfLevel: form.get("nqfLevel") ? Number(form.get("nqfLevel")) : null,
        yearCompleted: form.get("yearCompleted") ? Number(form.get("yearCompleted")) : null,
        stillStudying: false,
        orderIndex: profile!.qualifications.length,
      },
      headers,
    );
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function handleAddExperience(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.addWorkExperience(
      {
        employer: form.get("employer"),
        jobTitle: form.get("jobTitle"),
        startDate: form.get("startDate"),
        isCurrent: Boolean(form.get("isCurrent")),
        orderIndex: profile!.workExperience.length,
      },
      headers,
    );
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function handleAddReference(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.addReference(
      {
        fullName: form.get("fullName"),
        phone: form.get("phone") || null,
        email: form.get("email") || null,
        organisation: form.get("organisation") || null,
        orderIndex: profile!.references.length,
      },
      headers,
    );
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, documentTypeCode: DocumentTypeCode) {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.uploadDocument(file, documentTypeCode, headers);
    e.target.value = "";
    await refresh();
  }

  async function handleClose() {
    setClosing(true);
    try {
      await api.cafeCloseSession(sessionId);
      router.push("/cafe");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't close this session.");
      setClosing(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              Assisting {applicantEmail ?? p.email ?? "this applicant"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Opened {new Date(session.openedAt).toLocaleString("en-ZA")}. Closing ends your
              access immediately.
            </p>
          </div>
          <Button variant="destructive" onClick={handleClose} disabled={closing}>
            {closing ? "Closing…" : "Close session"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription>
            You can help fill in the profile, upload documents, and find matching vacancies. The
            applicant has to review, sign and submit any application themselves — either now,
            logged in as themselves on this device, or later from their own phone.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal particulars</CardTitle>
            <CardDescription>Only what the applicant tells you — leave the rest blank.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePersonalSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ID number" name="idNumber" defaultValue={p.idNumber ?? ""} />
                <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={p.dateOfBirth ?? ""} />
                <Field label="Phone" name="phone" defaultValue={p.phone ?? ""} />
                <Field label="Email" name="email" type="email" defaultValue={p.email ?? ""} />
                <Field label="Address" name="addressLine1" defaultValue={p.addressLine1 ?? ""} />
                <Field label="City" name="city" defaultValue={p.city ?? ""} />
                <Field label="Province" name="province" defaultValue={p.province ?? ""} />
                <Field label="Postal code" name="postalCode" defaultValue={p.postalCode ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Driver&apos;s licence codes</Label>
                <div className="flex flex-wrap gap-4">
                  {DRIVERS_LICENCE_CODES.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        name={`licence-${code}`}
                        defaultChecked={p.driversLicenceCodes?.includes(code)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={savingPersonal}>
                  {savingPersonal ? "Saving…" : "Save"}
                </Button>
                {personalSaved && <span className="text-sm text-success">Saved.</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.qualifications.map((q) => (
              <div key={q.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{q.qualificationName}</p>
                <p className="text-muted-foreground">
                  {q.institution}
                  {q.yearCompleted ? `, ${q.yearCompleted}` : ""}
                  {q.nqfLevel ? ` — NQF ${q.nqfLevel}` : ""}
                </p>
              </div>
            ))}
            <Separator />
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAddQualification}>
              <Field label="Institution" name="institution" required />
              <Field label="Qualification name" name="qualificationName" required />
              <Field label="NQF level" name="nqfLevel" type="number" />
              <Field label="Year completed" name="yearCompleted" type="number" />
              <Button type="submit" className="sm:col-span-2 w-fit">
                Add qualification
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.workExperience.map((w) => (
              <div key={w.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{w.jobTitle}</p>
                <p className="text-muted-foreground">
                  {w.employer}, {w.startDate} – {w.isCurrent ? "present" : (w.endDate ?? "N/A")}
                </p>
              </div>
            ))}
            <Separator />
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAddExperience}>
              <Field label="Employer" name="employer" required />
              <Field label="Job title" name="jobTitle" required />
              <Field label="Start date" name="startDate" type="date" required />
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox name="isCurrent" /> This is their current job
              </label>
              <Button type="submit" className="sm:col-span-2 w-fit">
                Add work experience
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.references.map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{r.fullName}</p>
                <p className="text-muted-foreground">
                  {[r.organisation, r.phone, r.email].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
            <Separator />
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAddReference}>
              <Field label="Full name" name="fullName" required />
              <Field label="Organisation" name="organisation" />
              <Field label="Phone" name="phone" />
              <Field label="Email" name="email" type="email" />
              <Button type="submit" className="sm:col-span-2 w-fit">
                Add reference
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
            <CardDescription>ID, CV, certificates and registrations — stored securely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            )}
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{d.originalFilename}</span>
                <span className="text-muted-foreground">{d.documentTypeCode}</span>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              {DOCUMENT_TYPES.map((dt) => (
                <div key={dt.code} className="space-y-1">
                  <Label>{dt.label}</Label>
                  <Input type="file" onChange={(e) => handleUpload(e, dt.code)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matching vacancies</CardTitle>
            <CardDescription>
              Based on the profile above. Opening one still shows why it matches, but applying
              needs the applicant&apos;s own sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {vacancies.length === 0 && (
              <p className="text-sm text-muted-foreground">No published vacancies yet.</p>
            )}
            {vacancies.map((v) => (
              <Link
                key={v.id}
                href={`/vacancies/${v.id}?assist=${sessionId}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{v.jobTitle}</p>
                  <p className="text-muted-foreground">{v.departmentName}</p>
                </div>
                {v.matchPercentage !== null && (
                  <Badge variant="secondary">{v.matchPercentage}% match</Badge>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
