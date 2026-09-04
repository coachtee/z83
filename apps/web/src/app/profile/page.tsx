"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentTypeCode, FullProfile, AppDocument } from "@z83/types";
import {
  CheckCircle,
  FileText,
  GraduationCap,
  IdentificationCard,
  Trash,
  UploadSimple,
  Users,
  WarningCircle,
  Briefcase,
} from "@phosphor-icons/react";

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

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function ProfilePage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DocumentTypeCode | null>(null);

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

  if (loading || !user) return null;

  async function handlePersonalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalSaved(false);
    setError(null);
    const form = new FormData(e.currentTarget);
    const driversLicenceCodes = DRIVERS_LICENCE_CODES.filter((code) => form.get(`licence-${code}`));
    try {
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
      setPersonalSaved(true);
    } catch (err) {
      setError(friendlyError(err, "Couldn't save your personal particulars. Check the fields and try again."));
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleAddQualification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
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
    } catch (err) {
      setError(friendlyError(err, "Couldn't add that qualification."));
    }
  }

  async function handleDeleteQualification(id: string) {
    setError(null);
    try {
      await api.deleteQualification(id);
      await refresh();
    } catch (err) {
      setError(friendlyError(err, "Couldn't remove that qualification."));
    }
  }

  async function handleAddExperience(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.addWorkExperience({
        employer: form.get("employer"),
        jobTitle: form.get("jobTitle"),
        startDate: form.get("startDate"),
        isCurrent: Boolean(form.get("isCurrent")),
        orderIndex: profile!.workExperience.length,
      });
      (e.target as HTMLFormElement).reset();
      await refresh();
    } catch (err) {
      setError(friendlyError(err, "Couldn't add that work experience."));
    }
  }

  async function handleAddReference(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.addReference({
        fullName: form.get("fullName"),
        phone: form.get("phone") || null,
        email: form.get("email") || null,
        organisation: form.get("organisation") || null,
        orderIndex: profile!.references.length,
      });
      (e.target as HTMLFormElement).reset();
      await refresh();
    } catch (err) {
      setError(friendlyError(err, "Couldn't add that reference."));
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, documentTypeCode: DocumentTypeCode) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingType(documentTypeCode);
    try {
      await api.uploadDocument(file, documentTypeCode);
      await refresh();
    } catch (err) {
      setError(friendlyError(err, "Couldn't upload that document."));
    } finally {
      e.target.value = "";
      setUploadingType(null);
    }
  }

  async function handleDeleteDocument(id: string) {
    setError(null);
    try {
      await api.deleteDocument(id);
      await refresh();
    } catch (err) {
      setError(friendlyError(err, "Couldn't remove that document."));
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your Z83 profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill this in once. We&apos;ll reuse it for every application you make.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!profile ? (
          <ProfileSkeleton />
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-6"
          >
            <SectionCard
              variants={fadeUp}
              icon={IdentificationCard}
              title="Personal particulars"
              description="Use N/A-style blanks only where a field truly doesn't apply."
            >
              <form className="space-y-5" onSubmit={handlePersonalSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ID number" name="idNumber" defaultValue={profile.profile.idNumber ?? ""} />
                  <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={profile.profile.dateOfBirth ?? ""} />
                  <Field label="Gender" name="gender" defaultValue={profile.profile.gender ?? ""} />
                  <Field label="Nationality" name="nationality" defaultValue={profile.profile.nationality ?? ""} />
                  <Field label="Race" name="race" defaultValue={profile.profile.race ?? ""} />
                  <Field label="Phone" name="phone" defaultValue={profile.profile.phone ?? ""} />
                  <Field label="Email" name="email" type="email" defaultValue={profile.profile.email ?? ""} />
                  <Field label="Address" name="addressLine1" defaultValue={profile.profile.addressLine1 ?? ""} />
                  <Field label="City" name="city" defaultValue={profile.profile.city ?? ""} />
                  <Field label="Province" name="province" defaultValue={profile.profile.province ?? ""} />
                  <Field label="Postal code" name="postalCode" defaultValue={profile.profile.postalCode ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Driver&apos;s licence codes</Label>
                  <div className="flex flex-wrap gap-4">
                    {DRIVERS_LICENCE_CODES.map((code) => (
                      <label key={code} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          name={`licence-${code}`}
                          defaultChecked={profile.profile.driversLicenceCodes?.includes(code)}
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
                  {personalSaved && (
                    <span className="flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle weight="fill" className="size-4" />
                      Saved.
                    </span>
                  )}
                </div>
              </form>
            </SectionCard>

            <SectionCard variants={fadeUp} icon={GraduationCap} title="Qualifications">
              <div className="space-y-3">
                {profile.qualifications.map((q) => (
                  <ListRow
                    key={q.id}
                    title={q.qualificationName}
                    subtitle={`${q.institution}${q.yearCompleted ? `, ${q.yearCompleted}` : ""}${q.nqfLevel ? ` — NQF ${q.nqfLevel}` : ""}`}
                    onDelete={() => handleDeleteQualification(q.id)}
                  />
                ))}
              </div>
              <Separator />
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAddQualification}>
                <Field label="Institution" name="institution" required />
                <Field label="Qualification name" name="qualificationName" required />
                <Field label="NQF level" name="nqfLevel" type="number" />
                <Field label="Year completed" name="yearCompleted" type="number" />
                <Button type="submit" variant="outline" className="w-fit sm:col-span-2">
                  Add qualification
                </Button>
              </form>
            </SectionCard>

            <SectionCard variants={fadeUp} icon={Briefcase} title="Work experience">
              <div className="space-y-3">
                {profile.workExperience.map((w) => (
                  <ListRow
                    key={w.id}
                    title={w.jobTitle}
                    subtitle={`${w.employer}, ${w.startDate} – ${w.isCurrent ? "present" : (w.endDate ?? "N/A")}`}
                  />
                ))}
              </div>
              <Separator />
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAddExperience}>
                <Field label="Employer" name="employer" required />
                <Field label="Job title" name="jobTitle" required />
                <Field label="Start date" name="startDate" type="date" required />
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <Checkbox name="isCurrent" /> This is my current job
                </label>
                <Button type="submit" variant="outline" className="w-fit sm:col-span-2">
                  Add work experience
                </Button>
              </form>
            </SectionCard>

            <SectionCard
              variants={fadeUp}
              icon={Users}
              title="References"
              description="Most vacancies expect at least three."
            >
              <div className="space-y-3">
                {profile.references.map((r) => (
                  <ListRow
                    key={r.id}
                    title={r.fullName}
                    subtitle={[r.organisation, r.phone, r.email].filter(Boolean).join(" · ")}
                  />
                ))}
              </div>
              <Separator />
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAddReference}>
                <Field label="Full name" name="fullName" required />
                <Field label="Organisation" name="organisation" />
                <Field label="Phone" name="phone" />
                <Field label="Email" name="email" type="email" />
                <Button type="submit" variant="outline" className="w-fit sm:col-span-2">
                  Add reference
                </Button>
              </form>
            </SectionCard>

            <SectionCard
              variants={fadeUp}
              icon={FileText}
              title="Documents"
              description="ID, CV, certificates and registrations — stored securely."
            >
              <div className="space-y-3">
                {documents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                )}
                {documents.map((d) => (
                  <ListRow
                    key={d.id}
                    title={d.originalFilename}
                    subtitle={d.documentTypeCode}
                    onDelete={() => handleDeleteDocument(d.id)}
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DOCUMENT_TYPES.map((dt) => (
                  <label
                    key={dt.code}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <UploadSimple weight="bold" className="size-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{dt.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {uploadingType === dt.code ? "Uploading…" : "Tap to choose a file"}
                      </span>
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleUpload(e, dt.code)}
                      disabled={uploadingType !== null}
                    />
                  </label>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  variants,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  variants?: Variants;
}) {
  return (
    <motion.div variants={variants}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon weight="bold" className="size-4" />
            </span>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {description && <CardDescription className="pl-[42px]">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

function ListRow({
  title,
  subtitle,
  onDelete,
}: {
  title: string;
  subtitle: string;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-muted-foreground">{subtitle}</p>
      </div>
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label={`Remove ${title}`}
        >
          <Trash className="size-4" />
        </Button>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-9 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
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
