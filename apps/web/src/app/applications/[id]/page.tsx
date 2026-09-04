"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import { CheckCircle2, XCircle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  signed: "Signed",
  email_prepared: "Email ready",
  print_prepared: "Print-ready",
  submitted: "Submitted",
  closed: "Closed",
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

  if (loading || !user || !application || !vacancy) return null;

  const status = application.status;

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{vacancy.jobTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {vacancy.departmentName} · Ref: {vacancy.referenceNumber}
            </p>
          </div>
          <Badge variant="secondary">{STATUS_LABEL[status] ?? status}</Badge>
        </div>

        {match && (
          <p className="text-sm text-muted-foreground">
            This application was prepared from your profile as it stood when you applied —
            {match.percentage}% match at that time.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {snapshot && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application summary</CardTitle>
              <CardDescription>Frozen at the moment you applied — later profile edits don&apos;t change this.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
                Run review
              </Button>
              {review && (
                <ul className="space-y-2 text-sm">
                  {review.checks.map((c) => (
                    <li key={c.rule} className="flex items-start gap-2">
                      {c.passed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      ) : (
                        <XCircle className="size-4 shrink-0 text-destructive" />
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
                <p className="text-sm text-success">Signed.</p>
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
                  <AlertTitle>Email prepared — not sent yet</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>To: {emailPackage.recipient}</p>
                    <p>Subject: {emailPackage.subject}</p>
                    <p>{emailPackage.attachments.length} attachment(s).</p>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const res = await api.sendApplication(id);
                          setSendResult(res);
                          await refresh();
                        })
                      }
                    >
                      Send application
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {sendResult && (
                <Alert variant={sendResult.success ? "success" : "destructive"}>
                  <AlertTitle>{sendResult.success ? "Sent" : "Sending failed"}</AlertTitle>
                  <AlertDescription>
                    {sendResult.success
                      ? `Sent to ${sendResult.recipient}.`
                      : `${sendResult.error ?? "Unknown error."} Nothing was submitted — try again.`}
                  </AlertDescription>
                </Alert>
              )}

              {printUrl && (
                <Alert>
                  <AlertTitle>Print-ready package generated</AlertTitle>
                  <AlertDescription>
                    <a href={printUrl} target="_blank" rel="noreferrer" className="underline">
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
                  I&apos;ve delivered this — mark as submitted
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {status === "submitted" && (
          <Alert>
            <AlertTitle>Submitted</AlertTitle>
            <AlertDescription>
              This application is marked as submitted. Good luck.
            </AlertDescription>
          </Alert>
        )}

        <Separator />
        <div>
          <h2 className="mb-2 text-sm font-medium">Attached documents</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {documents.map((d) => (
              <li key={d.id}>{d.documentRole}</li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "N/A"}</span>
    </div>
  );
}
