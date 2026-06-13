import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    title: "Invoices that just work",
    description:
      "Create VAT-compliant tax invoices, quotations, and credit notes in seconds, with automatic numbering and PDF export.",
  },
  {
    title: "Works offline, syncs later",
    description:
      "Keep billing your customers even without internet. Everything syncs automatically the moment you're back online.",
  },
  {
    title: "Built for the region",
    description:
      "UAE VAT rules today, with Saudi Arabia and Pakistan on the roadmap — one app as your business grows across borders.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo size="sm" />
          <nav className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/signup">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center">
          <h1 className="max-w-2xl text-display text-foreground text-balance">
            Billing & invoicing for growing businesses
          </h1>
          <p className="max-w-xl text-body-lg text-muted-foreground text-balance">
            Hisably helps small and medium businesses create invoices, track
            payments, and stay VAT-compliant — online or offline.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/signup">Start your free trial</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <CardTitle className="text-h3">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center text-body text-muted-foreground">
          © {new Date().getFullYear()} Hisably. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
