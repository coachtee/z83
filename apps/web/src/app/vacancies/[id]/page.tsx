"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { MatchResult, Vacancy, VacancyRequirement } from "@z83/types";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";

export default function VacancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useSession();
  const router = useRouter();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [requirements, setRequirements] = useState<VacancyRequirement[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getVacancy(id).then((res) => {
      setVacancy(res.vacancy);
      setRequirements(res.requirements);
      setMatch(res.match);
    });
  }, [id]);

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

  if (!vacancy) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{vacancy.jobTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {vacancy.departmentName} · {vacancy.province ?? "N/A"}
          </p>
          <p className="text-xs text-muted-foreground">
            Ref: {vacancy.referenceNumber} · Salary: {vacancy.salaryText ?? "N/A"}
          </p>
          {vacancy.closingAt && (
            <p className="text-xs text-muted-foreground">
              Closes {new Date(vacancy.closingAt).toLocaleDateString("en-ZA")}
            </p>
          )}
        </div>

        {match ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why this matches</CardTitle>
              <CardDescription>{match.disclaimer}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Progress value={match.percentage} className="flex-1" />
                <Badge variant="secondary">{match.percentage}%</Badge>
              </div>
              <RequirementList
                items={match.matched.map((m) => m.description)}
                icon={<CheckCircle2 className="size-4 text-success" />}
              />
              <RequirementList
                items={match.missing.map((m) => m.description)}
                icon={<XCircle className="size-4 text-destructive" />}
              />
              <RequirementList
                items={match.unknown.map((m) => `${m.description} (${m.reason})`)}
                icon={<HelpCircle className="size-4 text-warning" />}
              />
            </CardContent>
          </Card>
        ) : (
          <Alert>
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
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {requirements.map((r) => (
                <li key={r.id}>{r.description}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button size="lg" onClick={handleApply} disabled={applying}>
          {applying ? "Preparing…" : "Apply"}
        </Button>
      </div>
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
