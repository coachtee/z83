"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Application } from "@z83/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  signed: "Signed",
  email_prepared: "Email ready",
  print_prepared: "Print-ready",
  submitted: "Submitted",
  closed: "Closed",
};

export default function ApplicationsPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) void api.listApplications().then((res) => setApplications(res.applications));
  }, [user]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">My applications</h1>
        {applications.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No applications yet. Find a vacancy and tap Apply to start one.
          </p>
        )}
        <div className="space-y-3">
          {applications.map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Started {new Date(a.createdAt).toLocaleDateString("en-ZA")}
                  </span>
                  <Badge variant="secondary">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
