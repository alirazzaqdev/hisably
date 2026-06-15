"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import type { VatCategory } from "@/lib/api/onboarding";
import { tenantsApi, type TenantUpdateInput } from "@/lib/api/tenants";
import { usersApi } from "@/lib/api/users";
import { BackupSection } from "./backup-section";
import { BrandingSection } from "./branding-section";
import { TeamSection } from "./team-section";

const VAT_CATEGORIES: { value: VatCategory; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "zero_rated", label: "Zero-rated" },
  { value: "exempt", label: "Exempt" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: user } = useQuery({ queryKey: ["user", "me"], queryFn: usersApi.me });

  const [form, setForm] = useState<TenantUpdateInput>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      setForm({
        business_name: tenant.business_name,
        trn: tenant.trn ?? "",
        vat_registered: tenant.vat_registered,
        address: tenant.address ?? "",
        invoice_prefix: tenant.invoice_prefix,
        quotation_prefix: tenant.quotation_prefix,
        default_vat_category: tenant.default_vat_category,
        cheque_payee_name: tenant.cheque_payee_name ?? "",
        bank_name: tenant.bank_name ?? "",
        bank_account_number: tenant.bank_account_number ?? "",
        bank_iban: tenant.bank_iban ?? "",
        contact_person: tenant.contact_person ?? "",
        contact_phone: tenant.contact_phone ?? "",
      });
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: () => tenantsApi.update(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", "me"] });
      setSuccessMessage("Settings saved.");
      setFormError(null);
    },
    onError: (error) => {
      setSuccessMessage(null);
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  function update<K extends keyof TenantUpdateInput>(key: K, value: TenantUpdateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSuccessMessage(null);
    saveMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Settings</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>This information appears on your invoices and PDFs.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="business_name">Business name</Label>
              <Input
                id="business_name"
                required
                value={form.business_name ?? ""}
                onChange={(e) => update("business_name", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trn">TRN / Tax registration number</Label>
                <Input id="trn" value={form.trn ?? ""} onChange={(e) => update("trn", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice_prefix">Invoice prefix</Label>
                <Input
                  id="invoice_prefix"
                  value={form.invoice_prefix ?? ""}
                  onChange={(e) => update("invoice_prefix", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quotation_prefix">Quotation prefix</Label>
                <Input
                  id="quotation_prefix"
                  value={form.quotation_prefix ?? ""}
                  onChange={(e) => update("quotation_prefix", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Business address</Label>
              <Input id="address" value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="default_vat_category">Default VAT category</Label>
                <Select
                  id="default_vat_category"
                  value={form.default_vat_category ?? "standard"}
                  onChange={(e) => update("default_vat_category", e.target.value as VatCategory)}
                >
                  {VAT_CATEGORIES.map((vat) => (
                    <option key={vat.value} value={vat.value}>
                      {vat.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vat_registered">VAT registered</Label>
                <Select
                  id="vat_registered"
                  value={form.vat_registered ? "yes" : "no"}
                  onChange={(e) => update("vat_registered", e.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-body-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Country</p>
                <p>{tenant?.country ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Currency</p>
                <p>{tenant?.currency ?? "—"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-body font-medium text-foreground">Bank &amp; contact details</Label>
              <CardDescription>
                Used on Proforma invoices for payment instructions and contact info. Leave blank to hide.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cheque_payee_name">Cheque payee name</Label>
              <Input
                id="cheque_payee_name"
                placeholder="Make all cheques payable to..."
                value={form.cheque_payee_name ?? ""}
                onChange={(e) => update("cheque_payee_name", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank_name">Bank name</Label>
                <Input id="bank_name" value={form.bank_name ?? ""} onChange={(e) => update("bank_name", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank_account_number">Bank account number</Label>
                <Input
                  id="bank_account_number"
                  value={form.bank_account_number ?? ""}
                  onChange={(e) => update("bank_account_number", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank_iban">IBAN</Label>
                <Input id="bank_iban" value={form.bank_iban ?? ""} onChange={(e) => update("bank_iban", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact_person">Contact person</Label>
                <Input
                  id="contact_person"
                  value={form.contact_person ?? ""}
                  onChange={(e) => update("contact_person", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input
                id="contact_phone"
                value={form.contact_phone ?? ""}
                onChange={(e) => update("contact_phone", e.target.value)}
              />
            </div>

            {successMessage && <p className="text-body-sm text-success-500">{successMessage}</p>}
            <FormError>{formError}</FormError>

            <div>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <BrandingSection />

      {user?.role === "owner" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Document fields</CardTitle>
            <CardDescription>
              Pick an industry profile and customize which optional fields appear on your invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/settings/document-fields">Manage document fields</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your login details.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-body-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="text-foreground capitalize">{user?.role ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      {user?.role === "owner" && <TeamSection />}
      {user?.role === "owner" && <BackupSection />}
    </div>
  );
}
