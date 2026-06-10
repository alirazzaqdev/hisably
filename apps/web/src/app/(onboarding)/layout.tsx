export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <span className="text-h1 text-foreground">Hisably</span>
          <p className="text-body-sm text-muted-foreground">Let&apos;s set up your business</p>
        </div>
        {children}
      </div>
    </main>
  );
}
