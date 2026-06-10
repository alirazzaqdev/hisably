"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { authApi } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const forgotPasswordMutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => {
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
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
    forgotPasswordMutation.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a code to reset your password.
        </CardDescription>
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

          <FormError>{formError}</FormError>

          <Button type="submit" className="mt-2" disabled={forgotPasswordMutation.isPending}>
            {forgotPasswordMutation.isPending ? "Sending code…" : "Send reset code"}
          </Button>
        </form>
      </CardContent>

      <p className="mt-6 text-center text-body-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">
          Log in
        </Link>
      </p>
    </Card>
  );
}
