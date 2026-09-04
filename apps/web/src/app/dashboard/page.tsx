"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ValidationReport, Vacancy } from "@z83/types";

export default function DashboardPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [completeness, setCompleteness] = useState<ValidationReport | null>(null);
  const [vacancies, setVacancies] = useState<(Vacancy & { matchPercentage: number | null })[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    void api.getCompleteness().then(setCompleteness);
    void api.listVacancies().then((res) => setVacancies(res.vacancies.slice(0, 3)));
  }, [user]);

  if (loading || !user) return null;

  const passedCount = completeness?.checks.filter((c) => c.passed).length ?? 0;
  const totalCount = completeness?.checks.length ?? 0;
  const percentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Welcome back, {user.fullName.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s where your application stands.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile completeness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={percentage} />
            <p className="text-sm text-muted-foreground">
              {passedCount} of {totalCount} checks passed.
            </p>
            <Button size="sm" asChild>
              <Link href="/profile">Complete your profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vacancies that might match you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vacancies.length === 0 && (
              <p className="text-sm text-muted-foreground">No published vacancies yet.</p>
            )}
            {vacancies.map((v) => (
              <Link
                key={v.id}
                href={`/vacancies/${v.id}`}
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
            <Button size="sm" variant="outline" asChild>
              <Link href="/vacancies">See all vacancies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
