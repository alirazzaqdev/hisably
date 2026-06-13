import { Logo } from "@/components/logo";

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <Logo size="md" />
          <p className="text-body-sm text-muted-foreground">Billing &amp; invoicing for growing businesses</p>
        </div>
        {children}
      </div>
    </main>
  );
}
