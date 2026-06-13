"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth-store";

const HIGHLIGHTS = [
  "Quotations, proforma & tax invoices in one place",
  "Track payments, receivables and VAT effortlessly",
  "Works offline — syncs the moment you're back online",
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-accent-600 to-accent-900 p-12 text-white lg:flex">
        <Logo size="md" monochrome className="text-white" />

        <div className="flex flex-col gap-6">
          <h1 className="text-display max-w-md text-white">
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

        <p className="text-body-sm text-white/70">© {new Date().getFullYear()} Hisably. All rights reserved.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-1 text-center lg:hidden">
            <Logo size="md" />
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(email, password),
    onSuccess: (tokens) => {
      setSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }, rememberMe);
      const next = searchParams.get("next") ?? "/dashboard";
      router.push(next);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
          return;
        }
        if (typeof error.detail === "string") {
          setFormError(error.detail);
          return;
        }
      }
      setFormError("Couldn't sign you in. Check your details and try again.");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    loginMutation.mutate();
  }

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back — enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-body-sm font-medium text-accent-600 hover:text-accent-700">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-body-sm text-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            />
            Remember me
          </label>

          <FormError>{formError}</FormError>

          <Button type="submit" size="lg" className="mt-2" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </CardContent>

      <p className="mt-6 text-center text-body-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-accent-600 hover:text-accent-700">
          Sign up
        </Link>
      </p>
    </Card>
  );
}
