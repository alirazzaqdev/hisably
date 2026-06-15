"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AuthShell } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
import { authApi } from "@/lib/api/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const signupMutation = useMutation({
    mutationFn: () => authApi.signup(email, password),
    onSuccess: () => {
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    signupMutation.mutate();
  }

  const strength = passwordStrength(password);

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start your free trial — no credit card required.</CardDescription>
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
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex h-1 flex-1 gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-full flex-1 rounded-full ${
                          i < strength.score ? strength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-caption text-muted-foreground">{strength.label}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <FormError>{formError}</FormError>

            <p className="text-caption text-muted-foreground">
              By creating an account, you agree to Hisably&apos;s Terms of Service and Privacy Policy.
            </p>

            <Button type="submit" className="mt-2" disabled={signupMutation.isPending}>
              {signupMutation.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </CardContent>

        <p className="mt-6 text-center text-body-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">
            Log in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: "", color: "bg-muted" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-danger-500" };
  if (score === 2) return { score: 2, label: "Okay", color: "bg-warning-500" };
  return { score: 3, label: "Strong", color: "bg-success-500" };
}
