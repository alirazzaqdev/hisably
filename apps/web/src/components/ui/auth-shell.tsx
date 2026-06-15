import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

const HIGHLIGHTS = [
  "Quotations, proforma & tax invoices in one place",
  "Track payments, receivables and VAT effortlessly",
  "Works offline — syncs the moment you're back online",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-accent-600 to-accent-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:28px_28px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />

        <Logo size="md" monochrome className="relative text-white" />

        <div className="relative flex flex-col gap-6">
          <span className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-caption font-medium text-white/90">
            Free for growing businesses
          </span>
          <h1 className="max-w-md text-display text-balance text-white">
            Billing &amp; invoicing built for growing businesses.
          </h1>
          <ul className="flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-body-lg text-white/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-body-sm text-white/70">
          © {new Date().getFullYear()} Hisably. All rights reserved.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-1 text-center lg:hidden">
            <Logo size="md" />
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
