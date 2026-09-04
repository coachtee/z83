"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { DocumentTypeCode, FullProfile, AppDocument } from "@z83/types";

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

export default function ProfilePage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  async function refresh() {
    const [profileRes, documentsRes] = await Promise.all([api.getProfile(), api.listDocuments()]);
    setProfile(profileRes);
    setDocuments(documentsRes.documents);
  }

  useEffect(() => {
    if (user) void refresh();
  }, [user]);

  if (loading || !user || !profile) return null;

  const p = profile.profile;

  async function handlePersonalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalSaved(false);
    const form = new FormData(e.currentTarget);
    const driversLicenceCodes = DRIVERS_LICENCE_CODES.filter((code) => form.get(`licence-${code}`));
    await api.updateProfile({
      idNumber: form.get("idNumber") || null,
      dateOfBirth: form.get("dateOfBirth") || null,
      gender: form.get("gender") || null,
      nationality: form.get("nationality") || null,
      race: form.get("race") || null,
      addressLine1: form.get("addressLine1") || null,
      city: form.get("city") || null,
      province: form.get("province") || null,
      postalCode: form.get("postalCode") || null,
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      driversLicenceCodes,
    });
    await refresh();
    setSavingPersonal(false);
    setPersonalSaved(true);
  }

  async function handleAddQualification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.addQualification({
      institution: form.get("institution"),
      qualificationName: form.get("qualificationName"),
      nqfLevel: form.get("nqfLevel") ? Number(form.get("nqfLevel")) : null,
      yearCompleted: form.get("yearCompleted") ? Number(form.get("yearCompleted")) : null,
      stillStudying: false,
      orderIndex: profile!.qualifications.length,
    });
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function handleAddExperience(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.addWorkExperience({
      employer: form.get("employer"),
      jobTitle: form.get("jobTitle"),
      startDate: form.get("startDate"),
      isCurrent: Boolean(form.get("isCurrent")),
      orderIndex: profile!.workExperience.length,
    });
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function handleAddReference(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.addReference({
      fullName: form.get("fullName"),
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      organisation: form.get("organisation") || null,
      orderIndex: profile!.references.length,
    });
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, documentTypeCode: DocumentTypeCode) {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.uploadDocument(file, documentTypeCode);
    e.target.value = "";
    await refresh();
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-xl font-semibold">Your Z83 profile</h1>
          <p className="text-sm text-muted-foreground">
            Fill this in once. We&apos;ll reuse it for every application you make.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal particulars</CardTitle>
            <CardDescription>Use N/A-style blanks only where a field truly doesn&apos;t apply.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePersonalSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ID number" name="idNumber" defaultValue={p.idNumber ?? ""} />
                <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={p.dateOfBirth ?? ""} />
                <Field label="Gender" name="gender" defaultValue={p.gender ?? ""} />
                <Field label="Nationality" name="nationality" defaultValue={p.nationality ?? ""} />
                <Field label="Race" name="race" defaultValue={p.race ?? ""} />
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
                <Checkbox name="isCurrent" /> This is my current job
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
            <CardDescription>Most vacancies expect at least three.</CardDescription>
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
