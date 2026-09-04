"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/signature-pad";
import type {
  Application,
  ApplicationDocument,
  ApplicationSnapshot,
  EmailPackage,
  MatchResult,
  Vacancy,
  ValidationReport,
} from "@z83/types";
import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  FileText,
  PaperPlaneTilt,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { VariantProps } from "class-variance-authority";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  signed: "Signed",
  email_prepared: "Email ready",
  print_prepared: "Print-ready",
  submitted: "Submitted",
  closed: "Closed",
};

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: "secondary",
  reviewed: "secondary",
  signed: "default",
  email_prepared: "warning",
  print_prepared: "warning",
  submitted: "success",
  closed: "secondary",
};

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading } = useSession();
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [review, setReview] = useState<ValidationReport | null>(null);
  const [emailPackage, setEmailPackage] = useState<EmailPackage | null>(null);
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    recipient: string;
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const refresh = useCallback(async () => {
    const res = await api.getApplication(id);
    setApplication(res.application);
    setSnapshot(res.snapshot);
    setVacancy(res.vacancy);
    setDocuments(res.documents);
    setMatch(res.match);
  }, [id]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  function sendApplication() {
    return runAction(async () => {
      const res = await api.sendApplication(id);
      setSendResult(res);
      await refresh();
    });
  }

  if (loading || !user) return null;

  if (!application || !vacancy) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  const status = application.status;

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6 pb-12"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{vacancy.jobTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {vacancy.departmentName} · Ref: {vacancy.referenceNumber}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className="shrink-0">
            {STATUS_LABEL[status] ?? status}
          </Badge>
        </div>

        {match && (
          <p className="text-sm text-muted-foreground">
            This application was prepared from your profile as it stood when you applied — {match.percentage}%
            match at that time.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {snapshot && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application summary</CardTitle>
              <CardDescription>Frozen at the moment you applied — later profile edits don&apos;t change this.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <SummaryRow label="ID number" value={snapshot.snapshotData.profile.idNumber} />
              <SummaryRow label="Contact" value={snapshot.snapshotData.profile.phone} />
              <SummaryRow
                label="Qualifications"
                value={snapshot.snapshotData.qualifications.map((q) => q.qualificationName).join(", ")}
              />
              <SummaryRow
                label="References"
                value={`${snapshot.snapshotData.references.length} added`}
              />
              <SummaryRow
                label="Documents"
                value={`${snapshot.snapshotData.documents.length} attached`}
              />
            </CardContent>
          </Card>
        )}

        {(status === "draft" || status === "reviewed") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review before you sign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() =>
                  runAction(async () => {
                    setReview(await api.reviewApplication(id));
                    await refresh();
                  })
                }
                disabled={busy}
              >
                {busy && <CircleNotch className="size-4 animate-spin" />}
                Run review
              </Button>
              {review && (
                <ul className="space-y-2 text-sm">
                  {review.checks.map((c) => (
                    <li key={c.rule} className="flex items-start gap-2">
                      {c.passed ? (
                        <CheckCircle weight="fill" className="size-4 shrink-0 text-success" />
                      ) : (
                        <XCircle weight="fill" className="size-4 shrink-0 text-destructive" />
                      )}
                      <span>{c.passed ? c.rule.replaceAll("_", " ") : c.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {(status === "reviewed" || status === "signed") && review?.complete && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sign your application</CardTitle>
              <CardDescription>Draw your signature below with your finger or mouse.</CardDescription>
            </CardHeader>
            <CardContent>
              {status === "signed" ? (
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle weight="fill" className="size-4" />
                  Signed.
                </p>
              ) : (
                <SignaturePad
                  onCapture={(dataUrl) =>
                    runAction(async () => {
                      await api.signApplication(id, dataUrl);
                      await refresh();
                    })
                  }
                />
              )}
            </CardContent>
          </Card>
        )}

        {(status === "signed" || status === "email_prepared" || status === "print_prepared") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send it</CardTitle>
              <CardDescription>
                Follow this vacancy&apos;s own submission instructions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {vacancy.submissionMethod !== "hand_delivery" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      runAction(async () => {
                        const res = await api.buildEmailPackage(id);
                        setEmailPackage(res.emailPackage);
                        await refresh();
                      })
                    }
                  >
                    Prepare email
                  </Button>
                )}
                {vacancy.submissionMethod !== "email" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      runAction(async () => {
                        const res = await api.buildPrintPackage(id);
                        setPrintUrl(res.url);
                        await refresh();
                      })
                    }
                  >
                    Prepare print-ready package
                  </Button>
                )}
              </div>

              {emailPackage && (
                <Alert>
                  <PaperPlaneTilt weight="fill" />
                  <AlertTitle>Email prepared — not sent yet</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>To: {emailPackage.recipient}</p>
                    <p>Subject: {emailPackage.subject}</p>
                    <p>{emailPackage.attachments.length} attachment(s).</p>
                    <Button disabled={busy} onClick={sendApplication}>
                      {busy && <CircleNotch className="size-4 animate-spin" />}
                      Send application
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {sendResult && (
                <Alert variant={sendResult.success ? "success" : "destructive"}>
                  {sendResult.success ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
                  <AlertTitle>{sendResult.success ? "Sent" : "Sending failed"}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {sendResult.success
                        ? `Sent to ${sendResult.recipient}.`
                        : `${sendResult.error ?? "Unknown error."} Nothing was submitted.`}
                    </p>
                    {!sendResult.success && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={sendApplication}>
                        {busy ? (
                          <CircleNotch className="size-4 animate-spin" />
                        ) : (
                          <ArrowClockwise className="size-4" />
                        )}
                        Try again
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {printUrl && (
                <Alert>
                  <FileText weight="fill" />
                  <AlertTitle>Print-ready package generated</AlertTitle>
                  <AlertDescription>
                    <a href={printUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">
                      Open the PDF
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {status === "print_prepared" && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => {
                      await api.updateApplicationStatus(id, "submitted");
                      await refresh();
                    })
                  }
                >
                  {busy && <CircleNotch className="size-4 animate-spin" />}
                  I&apos;ve delivered this — mark as submitted
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {status === "submitted" && (
          <Alert variant="success">
            <CheckCircle weight="fill" />
            <AlertTitle>Submitted</AlertTitle>
            <AlertDescription>
              This application is marked as submitted. Good luck.
            </AlertDescription>
          </Alert>
        )}

        <Separator />
        <div>
          <h2 className="mb-3 text-sm font-medium">Attached documents</h2>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents attached yet.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <FileText className="size-4" />
                  {d.documentRole.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-border/70 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "N/A"}</span>
    </div>
  );
}
