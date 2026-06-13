"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/form-message";
import { OtpInput } from "@/components/ui/otp-input";
import { ApiError } from "@/lib/api-client";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth-store";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const email = searchParams.get("email") ?? "";
  const [otpCode, setOtpCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifyOtp(email, otpCode),
    onSuccess: (tokens) => {
      setSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      router.push("/onboarding");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendOtp(email),
    onSuccess: () => {
      setResendMessage("A new code has been sent to your email.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
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
    verifyMutation.mutate();
  }

  function handleResend() {
    setFormError(null);
    setResendMessage(null);
    resendMutation.mutate();
  }

  return (
    <AuthCard>
      <Card>
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            {email ? (
              <>
                We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
              </>
            ) : (
              "Enter the 6-digit code we sent to your email."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <OtpInput value={otpCode} onChange={setOtpCode} autoFocus />

            <FormError>{formError}</FormError>
            <FormSuccess>{resendMessage}</FormSuccess>

            <Button type="submit" className="mt-2" disabled={verifyMutation.isPending || otpCode.length !== 6}>
              {verifyMutation.isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendMutation.isPending || cooldown > 0}
            className="mt-4 w-full text-center text-body-sm font-medium text-accent-600 hover:text-accent-700 disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </CardContent>
      </Card>
    </AuthCard>
  );
}
