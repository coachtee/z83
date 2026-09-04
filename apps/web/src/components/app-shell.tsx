"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/vacancies", label: "Vacancies" },
  { href: "/applications", label: "My applications" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();

  async function handleLogout() {
    await api.logout();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Z83
          </Link>
          {!loading && user && (
            <nav className="hidden items-center gap-5 text-sm sm:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
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
          <nav className="flex items-center gap-4 overflow-x-auto border-t px-4 py-2 text-sm sm:hidden">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground whitespace-nowrap">
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Z83 is an independent Naleli Innovations product. It is not part of, or endorsed
        by, DPSA or any government department.
      </footer>
    </div>
  );
}
