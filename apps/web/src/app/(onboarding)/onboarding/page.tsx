"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelect } from "@/components/ui/country-select";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { onboardingApi } from "@/lib/api/onboarding";
import { getCountryInfo } from "@hisably/shared";
import type { Country } from "@hisably/shared";

const STEPS = ["Country", "Business", "Tax details", "Invoicing"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [country, setCountry] = useState<Country>("AE");
  const [businessName, setBusinessName] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [trn, setTrn] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [invoiceStartingNumber, setInvoiceStartingNumber] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      onboardingApi.updateBusiness({
        business_name: businessName.trim(),
        country,
        trn: vatRegistered ? trn.trim() : null,
        vat_registered: vatRegistered,
        invoice_prefix: invoicePrefix.trim() || "INV-",
        invoice_starting_number: invoiceStartingNumber,
      }),
    onSuccess: () => {
      router.push("/dashboard");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setStepError(error.detail);
      } else {
        setStepError("Something went wrong. Please try again.");
      }
    },
  });

  function goNext() {
    setStepError(null);

    if (step === 1 && businessName.trim().length === 0) {
      setStepError("Please enter your business name.");
      return;
    }
    if (step === 2 && vatRegistered && trn.trim().length === 0) {
      setStepError("Please enter your TRN, or mark your business as not VAT registered.");
      return;
    }

    if (step === STEPS.length - 1) {
      if (invoicePrefix.trim().length === 0) {
        setStepError("Please enter an invoice prefix.");
        return;
      }
      if (invoiceStartingNumber < 1) {
        setStepError("Starting number must be at least 1.");
        return;
      }
      submitMutation.mutate();
      return;
    }

    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepError(null);
    setStep((value) => Math.max(value - 1, 0));
  }

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-medium",
                  index < step
                    ? "bg-accent-600 text-white"
                    : index === step
                      ? "border-2 border-accent-600 text-accent-600"
                      : "border border-border text-muted-foreground"
                )}
              >
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn("h-px flex-1", index < step ? "bg-accent-600" : "bg-border")} />
              )}
            </div>
          ))}
        </div>
        <CardTitle>{STEPS[step]}</CardTitle>
        <CardDescription>{stepDescription(step)}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {step === 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="onboarding-country">Country</Label>
            <CountrySelect id="onboarding-country" value={country} onChange={(code) => setCountry(code)} />
            {(() => {
              const info = getCountryInfo(country);
              return info ? (
                <p className="text-body-sm text-muted-foreground">
                  Currency: {info.currency} · Default {info.vatName}: {info.vatRate}% — both editable later in
                  Settings.
                </p>
              ) : null;
            })()}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              required
              autoFocus
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Al Manara Trading LLC"
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setVatRegistered(true)}
                className={cn(
                  "rounded-md border px-4 py-3 text-start transition-colors",
                  vatRegistered ? "border-accent-600 bg-accent-50" : "border-border hover:bg-muted"
                )}
              >
                <span className="text-body-lg font-medium text-foreground">I&apos;m VAT registered</span>
                <p className="text-body-sm text-muted-foreground">I have a Tax Registration Number (TRN)</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVatRegistered(false);
                  setTrn("");
                }}
                className={cn(
                  "rounded-md border px-4 py-3 text-start transition-colors",
                  !vatRegistered ? "border-accent-600 bg-accent-50" : "border-border hover:bg-muted"
                )}
              >
                <span className="text-body-lg font-medium text-foreground">Not VAT registered yet</span>
                <p className="text-body-sm text-muted-foreground">
                  Invoices will be issued without VAT — you can add this later
                </p>
              </button>
            </div>

            {vatRegistered && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trn">Tax Registration Number (TRN)</Label>
                <Input
                  id="trn"
                  required
                  value={trn}
                  onChange={(e) => setTrn(e.target.value)}
                  placeholder="100123456700003"
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-prefix">Invoice number prefix</Label>
              <Input
                id="invoice-prefix"
                required
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV-"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-starting-number">Starting invoice number</Label>
              <Input
                id="invoice-starting-number"
                type="number"
                min={1}
                required
                value={invoiceStartingNumber}
                onChange={(e) => setInvoiceStartingNumber(Number(e.target.value) || 1)}
              />
              <p className="text-body-sm text-muted-foreground">
                Your first invoice will be {invoicePrefix.trim() || "INV-"}
                {String(invoiceStartingNumber).padStart(4, "0")}
              </p>
            </div>
          </div>
        )}

        <FormError>{stepError}</FormError>

        <div className="mt-2 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0 || submitMutation.isPending}>
            Back
          </Button>
          <Button type="button" onClick={goNext} disabled={submitMutation.isPending}>
            {step === STEPS.length - 1
              ? submitMutation.isPending
                ? "Saving…"
                : "Finish setup"
              : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function stepDescription(step: number): string {
  switch (step) {
    case 0:
      return "Where is your business based? This determines tax rules and invoice formats.";
    case 1:
      return "This appears on your invoices and quotations.";
    case 2:
      return "Tell us if your business is registered for VAT.";
    default:
      return "Choose how your invoice numbers are formatted.";
  }
}
