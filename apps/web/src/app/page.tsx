"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  FileText,
  MagnifyingGlass,
  PenNib,
  Sparkle,
} from "@phosphor-icons/react";

const STEPS = [
  {
    number: "01",
    title: "Fill in once",
    body: "Your personal particulars, qualifications, work experience and documents — captured once, reused for every application.",
    icon: FileText,
  },
  {
    number: "02",
    title: "See what matches",
    body: "We check your profile against real, verified Public Service Vacancy Circulars and show you exactly why a post fits — or doesn't.",
    icon: MagnifyingGlass,
  },
  {
    number: "03",
    title: "Sign and send",
    body: "Review the generated Z83, sign on your phone, then email or print for hand delivery — following that vacancy's own instructions.",
    icon: PenNib,
  },
];

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: EASE_OUT_EXPO },
  }),
};

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-24 pb-16">
        <section className="grid items-center gap-12 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <motion.div
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div variants={fadeUp} custom={0}>
              <Badge className="gap-1.5 py-1">
                <Sparkle weight="fill" className="size-3" />
                Built on real DPSA circulars
              </Badge>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl leading-[1.05] font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl"
            >
              Fill once.
              <br />
              Apply many times.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="max-w-[46ch] text-base leading-relaxed text-muted-foreground"
            >
              Build your Z83 profile once, upload your documents once, and apply
              to South African public service vacancies from your phone —
              matched against what you&apos;ve already told us, and ready to
              sign and send.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link href="/register">Create your profile</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT_EXPO }}
            className="relative mx-auto w-full max-w-sm lg:ml-auto lg:mr-0"
          >
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/40 blur-2xl" />
            <div className="rotate-2 rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-sm font-semibold">
                    Administration Clerk
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dept. of Public Service &amp; Administration
                  </p>
                </div>
                <Badge variant="success">78% match</Badge>
              </div>
              <Progress value={78} className="mt-4" />
              <ul className="mt-4 space-y-2 text-xs">
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle weight="fill" className="size-3.5 text-success" />
                  National Diploma, NQF 6
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle weight="fill" className="size-3.5 text-success" />
                  3+ years&apos; experience
                </li>
              </ul>
            </div>
            <div className="-translate-y-6 translate-x-6 rounded-2xl border bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground">
                Ref: DPSA/DEV/2026/001 · Closes in 9 days
              </p>
            </div>
          </motion.div>
        </section>

        <section className="space-y-10">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How it works
            </h2>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: EASE_OUT_EXPO }}
                className="grid gap-4 py-8 sm:grid-cols-[auto_auto_1fr] sm:items-start sm:gap-6"
              >
                <span className="font-display text-3xl font-semibold text-muted-foreground/40">
                  {step.number}
                </span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <step.icon weight="bold" className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-muted/40 p-6">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Z83 is an independent Naleli Innovations product built on publicly
            published Public Service Vacancy Circulars. It is not an official
            government system, and a match shown here is never a decision on
            eligibility — only the hiring department can confirm that.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
