"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Vacancy } from "@z83/types";

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<(Vacancy & { matchPercentage: number | null })[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api.listVacancies().then((res) => {
      setVacancies(res.vacancies);
      setLoaded(true);
    });
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Published vacancies</h1>
          <p className="text-sm text-muted-foreground">
            From verified Public Service Vacancy Circulars. Sign in to see how each one matches you.
          </p>
        </div>
        {loaded && vacancies.length === 0 && (
          <p className="text-sm text-muted-foreground">No vacancies published yet.</p>
        )}
        <div className="space-y-3">
          {vacancies.map((v) => (
            <Link key={v.id} href={`/vacancies/${v.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{v.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {v.departmentName} · {v.province ?? "Location N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Ref: {v.referenceNumber}</p>
                  </div>
                  {v.matchPercentage !== null && (
                    <Badge variant="secondary" className="shrink-0">
                      {v.matchPercentage}% match
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
