"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APPLICANT_NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/vacancies", label: "Vacancies" },
  { href: "/applications", label: "My applications" },
];

const CAFE_NAV_LINKS = [{ href: "/cafe", label: "Assisted sessions" }];

function Logomark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-semibold text-primary-foreground">
      Z
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const navLinks = user?.role === "cafe_staff" ? CAFE_NAV_LINKS : APPLICANT_NAV_LINKS;

  async function handleLogout() {
    await api.logout();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logomark />
            <span className="font-display text-base font-semibold tracking-tight">Z83</span>
          </Link>
          {!loading && user && (
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              {navLinks.map((link) => {
                const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 transition-colors",
                      active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="flex items-center gap-2">
            {!loading && user ? (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            ) : !loading ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Create account</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {!loading && user && (
          <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2.5 text-sm sm:hidden">
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors",
                    active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        Z83 is an independent Naleli Innovations product. It is not part of, or endorsed
        by, DPSA or any government department.
      </footer>
    </div>
  );
}
