import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center gap-8 py-10 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Z83</h1>
          <p className="text-lg text-muted-foreground">Fill once. Apply many times.</p>
        </div>
        <p className="max-w-lg text-sm text-muted-foreground">
          Build your Z83 profile once, upload your documents once, and apply to South
          African public service vacancies from your phone — matched against what
          you&apos;ve already told us, and ready to sign and send.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/register">Create your profile</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <div className="grid gap-4 pt-6 text-left sm:grid-cols-3">
          <Card>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">1. Fill in once</p>
              <p className="text-muted-foreground">
                Your Z83 details, qualifications and documents, saved securely.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">2. See what matches</p>
              <p className="text-muted-foreground">
                We check your profile against real vacancies and show you why.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">3. Sign and send</p>
              <p className="text-muted-foreground">
                Review, sign on your phone, then email or print — your call.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="max-w-md text-xs text-muted-foreground">
          Z83 is an independent Naleli Innovations product built on publicly published
          Public Service Vacancy Circulars. It is not an official government system, and
          a match shown here is never a decision on eligibility.
        </p>
      </div>
    </AppShell>
  );
}
