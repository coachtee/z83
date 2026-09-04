"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vacancy } from "@z83/types";
import { Buildings, Compass, MapPin } from "@phosphor-icons/react";

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<(Vacancy & { matchPercentage: number | null })[] | null>(null);

  useEffect(() => {
    void api.listVacancies().then((res) => setVacancies(res.vacancies));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Published vacancies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From verified Public Service Vacancy Circulars. Sign in to see how each one matches you.
          </p>
        </div>

        {vacancies === null ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : vacancies.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
            <Compass className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No vacancies published yet</p>
              <p className="text-sm text-muted-foreground">
                Check back once a new Public Service Vacancy Circular is verified.
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            className="space-y-3"
          >
            {vacancies.map((v) => (
              <motion.div
                key={v.id}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              >
                <Link href={`/vacancies/${v.id}`}>
                  <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft">
                    <CardContent className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium">{v.jobTitle}</p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Buildings className="size-3.5" />
                            {v.departmentName}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {v.province ?? "Location N/A"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Ref: {v.referenceNumber}</p>
                      </div>
                      {v.matchPercentage !== null && (
                        <Badge variant={v.matchPercentage >= 50 ? "success" : "secondary"} className="shrink-0">
                          {v.matchPercentage}% match
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
