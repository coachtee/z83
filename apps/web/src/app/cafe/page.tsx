"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError, api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CircleNotch,
  IdentificationCard,
  MagnifyingGlass,
  UserPlus,
  WarningCircle,
} from "@phosphor-icons/react";

type Step =
  | { kind: "lookup" }
  | { kind: "existing"; email: string; sessionId: string }
  | { kind: "new"; email: string };

const stepVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
} as const;

export default function CafeStartPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "lookup" });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role !== "cafe_staff") router.push("/dashboard");
  }, [loading, user, router]);

  if (loading || !user || user.role !== "cafe_staff") return null;

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmed = email.trim().toLowerCase();
      const { exists } = await api.cafeFindApplicant(trimmed);
      if (exists) {
        const { session } = await api.cafeOpenSession({ applicantEmail: trimmed });
        setStep({ kind: "existing", email: trimmed, sessionId: session.id });
      } else {
        setStep({ kind: "new", email: trimmed });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't look that email up.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthorize(e: React.FormEvent<HTMLFormElement>) {
    if (step.kind !== "existing") return;
    e.preventDefault();
    setError(null);
    setBusy(true);
    const password = new FormData(e.currentTarget).get("password") as string;
    try {
      await api.cafeAuthorizeSession(step.sessionId, password);
      router.push(`/cafe/session/${step.sessionId}?email=${encodeURIComponent(step.email)}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? "That doesn't match the applicant's own password. Ask them to type it themselves."
          : "Couldn't authorize this session.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAndOpen(e: React.FormEvent<HTMLFormElement>) {
    if (step.kind !== "new") return;
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirmPassword") as string;
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      setBusy(false);
      return;
    }
    try {
      const { session } = await api.cafeOpenSession({
        applicantEmail: step.email,
        newApplicantPassword: password,
        applicantFullName: (form.get("fullName") as string) || undefined,
      });
      router.push(`/cafe/session/${session.id}?email=${encodeURIComponent(step.email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this applicant's account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-6 py-8">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Assist an applicant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The applicant stays the owner of their information. Nothing here works until they
            authorize it themselves, and it stops the moment the session is closed.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
          {step.kind === "lookup" && (
            <motion.div key="lookup" variants={stepVariants} initial="hidden" animate="show" exit="exit" transition={{ duration: 0.2 }}>
              <Card>
                <CardHeader>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <MagnifyingGlass weight="bold" className="size-4.5" />
                  </div>
                  <CardTitle className="text-base">Find or create an applicant</CardTitle>
                  <CardDescription>Ask the applicant for the email they use for Z83.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleLookup}>
                    <div className="space-y-2">
                      <Label htmlFor="email">Applicant email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <CircleNotch className="size-4 animate-spin" />}
                      {busy ? "Looking up…" : "Continue"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step.kind === "existing" && (
            <motion.div key="existing" variants={stepVariants} initial="hidden" animate="show" exit="exit" transition={{ duration: 0.2 }}>
              <Card>
                <CardHeader>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <IdentificationCard weight="bold" className="size-4.5" />
                  </div>
                  <CardTitle className="text-base">Hand the keyboard to the applicant</CardTitle>
                  <CardDescription>
                    An account already exists for {step.email}. Only the applicant typing their own
                    password below turns this on — you opening it does nothing by itself.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleAuthorize}>
                    <div className="space-y-2">
                      <Label htmlFor="password">Applicant&apos;s password</Label>
                      <Input id="password" name="password" type="password" required autoFocus />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <CircleNotch className="size-4 animate-spin" />}
                      {busy ? "Authorizing…" : "Authorize assistance"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setStep({ kind: "lookup" })}
                    >
                      Cancel
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step.kind === "new" && (
            <motion.div key="new" variants={stepVariants} initial="hidden" animate="show" exit="exit" transition={{ duration: 0.2 }}>
              <Card>
                <CardHeader>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <UserPlus weight="bold" className="size-4.5" />
                  </div>
                  <CardTitle className="text-base">Create this applicant&apos;s account</CardTitle>
                  <CardDescription>
                    No account exists for {step.email} yet. The applicant should choose and type
                    their own password below — that&apos;s what lets you start helping them right
                    away, since there&apos;s no existing account to protect.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleCreateAndOpen}>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Applicant&apos;s full name</Label>
                      <Input id="fullName" name="fullName" required autoFocus />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Applicant chooses a password</Label>
                      <Input id="password" name="password" type="password" minLength={8} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        minLength={8}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <CircleNotch className="size-4 animate-spin" />}
                      {busy ? "Creating…" : "Create account & start assisting"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setStep({ kind: "lookup" })}
                    >
                      Cancel
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
