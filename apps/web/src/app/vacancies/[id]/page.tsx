"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api, assistedHeaders } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { MatchResult, Vacancy, VacancyRequirement } from "@z83/types";
import {
  Buildings,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Info,
  MapPin,
  Question,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

export default function VacancyDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <VacancyDetailContent {...props} />
    </Suspense>
  );
}

function VacancyDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assistSessionId = searchParams.get("assist");
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [requirements, setRequirements] = useState<VacancyRequirement[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const headers = assistSessionId ? assistedHeaders(assistSessionId) : undefined;
    void api.getVacancy(id, headers).then((res) => {
      setVacancy(res.vacancy);
      setRequirements(res.requirements);
      setMatch(res.match);
    });
  }, [id, assistSessionId]);

  async function handleApply() {
    if (!user) {
      router.push("/login");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const { application } = await api.createApplication(id);
      router.push(`/applications/${application.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start this application.");
    } finally {
      setApplying(false);
    }
  }

  if (!vacancy) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6 pb-24"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{vacancy.jobTitle}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Buildings className="size-4" />
              {vacancy.departmentName}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {vacancy.province ?? "N/A"}
            </span>
            {vacancy.closingAt && (
              <span className="flex items-center gap-1.5">
                <CalendarBlank className="size-4" />
                Closes {new Date(vacancy.closingAt).toLocaleDateString("en-ZA")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ref: {vacancy.referenceNumber} · Salary: {vacancy.salaryText ?? "N/A"}
          </p>
        </div>

        {match ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why this matches</CardTitle>
              <CardDescription>{match.disclaimer}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <Progress value={match.percentage} className="flex-1" />
                <span className="font-display text-base font-semibold text-primary">
                  {match.percentage}%
                </span>
              </div>
              <RequirementList
                items={match.matched.map((m) => m.description)}
                icon={<CheckCircle weight="fill" className="size-4 shrink-0 text-success" />}
              />
              <RequirementList
                items={match.missing.map((m) => m.description)}
                icon={<XCircle weight="fill" className="size-4 shrink-0 text-destructive" />}
              />
              <RequirementList
                items={match.unknown.map((m) => `${m.description} (${m.reason})`)}
                icon={<Question weight="fill" className="size-4 shrink-0 text-warning" />}
              />
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <Info weight="fill" />
            <AlertDescription>
              Sign in to see how your profile matches this vacancy&apos;s requirements.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requirements as published</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {r.description}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {assistSessionId ? (
          <div className="space-y-3">
            <Alert>
              <Info weight="fill" />
              <AlertDescription>
                Applying needs the applicant&apos;s own sign-in — it isn&apos;t something staff can
                do on their behalf. Once they&apos;re ready, they can apply themselves on this
                device or from their own phone.
              </AlertDescription>
            </Alert>
            <Button variant="outline" asChild>
              <Link href={`/cafe/session/${assistSessionId}`}>Back to assisted session</Link>
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={handleApply} disabled={applying}>
            {applying && <CircleNotch className="size-4 animate-spin" />}
            {applying ? "Preparing…" : "Apply"}
          </Button>
        )}
      </motion.div>
    </AppShell>
  );
}

function RequirementList({ items, icon }: { items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          {icon}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
