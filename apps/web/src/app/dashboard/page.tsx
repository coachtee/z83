"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ValidationReport, Vacancy } from "@z83/types";
import { ArrowRight, Compass, FileText } from "@phosphor-icons/react";

export default function DashboardPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [completeness, setCompleteness] = useState<ValidationReport | null>(null);
  const [vacancies, setVacancies] = useState<(Vacancy & { matchPercentage: number | null })[] | null>(null);

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
  const isComplete = totalCount > 0 && passedCount === totalCount;

  return (
    <AppShell>
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {user.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s where your application stands.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Profile completeness</CardTitle>
              {completeness && (
                <span className="font-display text-lg font-semibold text-primary">
                  {percentage}%
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {completeness ? (
                <>
                  <Progress value={percentage} />
                  <p className="text-sm text-muted-foreground">
                    {passedCount} of {totalCount} checks passed.
                  </p>
                  <Button size="sm" asChild>
                    <Link href="/profile">
                      {isComplete ? "View your profile" : "Complete your profile"}
                      <ArrowRight />
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-36" />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vacancies that might match you</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vacancies === null ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : vacancies.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
                  <Compass className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No published vacancies yet — check back soon.
                  </p>
                </div>
              ) : (
                vacancies.map((v) => (
                  <Link
                    key={v.id}
                    href={`/vacancies/${v.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3.5 text-sm transition-colors hover:border-primary/30 hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <FileText weight="bold" className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium">{v.jobTitle}</p>
                        <p className="text-muted-foreground">{v.departmentName}</p>
                      </div>
                    </div>
                    {v.matchPercentage !== null && (
                      <Badge variant={v.matchPercentage >= 50 ? "success" : "secondary"}>
                        {v.matchPercentage}% match
                      </Badge>
                    )}
                  </Link>
                ))
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href="/vacancies">
                  See all vacancies
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppShell>
  );
}
