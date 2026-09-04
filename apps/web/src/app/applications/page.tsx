"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Application } from "@z83/types";
import { FileText, PaperPlaneTilt } from "@phosphor-icons/react";
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

export default function ApplicationsPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) void api.listApplications().then((res) => setApplications(res.applications));
  }, [user]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My applications</h1>

        {applications === null ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
            <PaperPlaneTilt className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No applications yet</p>
              <p className="text-sm text-muted-foreground">
                Find a vacancy and tap Apply to start one.
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
            {applications.map((a) => (
              <motion.div key={a.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <Link href={`/applications/${a.id}`}>
                  <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft">
                    <CardContent className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5 text-sm">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <FileText weight="bold" className="size-4" />
                        </span>
                        <span className="text-muted-foreground">
                          Started {new Date(a.createdAt).toLocaleDateString("en-ZA")}
                        </span>
                      </span>
                      <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
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
