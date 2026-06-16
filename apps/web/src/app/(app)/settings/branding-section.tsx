"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { attachmentsApi } from "@/lib/api/attachments";
import type { InvoiceType } from "@/lib/api/invoices";
import { tenantsApi } from "@/lib/api/tenants";

const DOCUMENT_TYPES: { value: InvoiceType; label: string }[] = [
  { value: "tax_invoice", label: "Tax invoice" },
  { value: "quotation", label: "Quotation" },
  { value: "proforma", label: "Proforma invoice" },
  { value: "credit_note", label: "Credit note (sales return)" },
  { value: "purchase_bill", label: "Purchase bill" },
  { value: "debit_note", label: "Debit note (purchase return)" },
];

type ImageField = "logo_url" | "stamp_url" | "signature_url";

const IMAGE_FIELDS: { field: ImageField; entityType: string; label: string; description: string }[] = [
  { field: "logo_url", entityType: "logo", label: "Logo", description: "Shown in the invoice header." },
  { field: "stamp_url", entityType: "stamp", label: "Company stamp", description: "Shown in the invoice footer when enabled below." },
  { field: "signature_url", entityType: "signature", label: "Signature", description: "Shown above \"Authorized Signatory\" when enabled below." },
];

export function BrandingSection() {
  const queryClient = useQueryClient();
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });

  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: tenantsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", "me"] });
      setFormError(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  async function handleFileChange(field: ImageField, entityType: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingField(field);
    setFormError(null);
    try {
      const attachment = await attachmentsApi.upload(file, entityType);
      await updateMutation.mutateAsync({ [field]: attachment.file_url });
    } catch (error) {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
      } else {
        setFormError("Failed to upload image. Please try again.");
      }
    } finally {
      setUploadingField(null);
      event.target.value = "";
    }
  }

  function toggleBrandingOption(docType: InvoiceType, key: "show_stamp" | "show_signature", checked: boolean) {
    if (!tenant) return;
    const current = tenant.branding_options ?? {};
    const branding_options = {
      ...current,
      [docType]: { ...current[docType], [key]: checked },
    };
    setSuccessMessage(null);
    updateMutation.mutate(
      { branding_options },
      { onSuccess: () => setSuccessMessage("Branding options saved.") },
    );
  }

  const brandingOptions = tenant?.branding_options ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Upload your logo, stamp, and signature, and choose which documents show them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {IMAGE_FIELDS.map(({ field, entityType, label, description }) => {
            const url = tenant?.[field] ?? null;
            return (
              <div key={field} className="flex flex-col gap-1.5">
                <Label htmlFor={`branding_${field}`}>{label}</Label>
                <p className="text-body-sm text-muted-foreground">{description}</p>
                {url && (
                  <img
                    src={url}
                    alt={label}
                    className="h-16 w-16 rounded border border-border object-contain bg-surface"
                  />
                )}
                <input
                  id={`branding_${field}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileChange(field, entityType, e)}
                  className="text-body-sm text-foreground"
                />
                {uploadingField === field && <p className="text-body-sm text-muted-foreground">Uploading…</p>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-body font-medium text-foreground">Footer display per document type</Label>
            <CardDescription>
              Choose which documents print the stamp and/or signature in the footer.
            </CardDescription>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Document type</th>
                  <th className="px-4 py-3 font-medium">Show stamp</th>
                  <th className="px-4 py-3 font-medium">Show signature</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENT_TYPES.map((doc) => (
                  <tr key={doc.value} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{doc.label}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(brandingOptions[doc.value]?.show_stamp)}
                        onChange={(e) => toggleBrandingOption(doc.value, "show_stamp", e.target.checked)}
                        disabled={!tenant?.stamp_url}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(brandingOptions[doc.value]?.show_signature)}
                        onChange={(e) => toggleBrandingOption(doc.value, "show_signature", e.target.checked)}
                        disabled={!tenant?.signature_url}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {DOCUMENT_TYPES.map((doc) => (
              <div key={doc.value} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                <p className="font-medium text-foreground">{doc.label}</p>
                <label className="flex items-center gap-2 text-body-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(brandingOptions[doc.value]?.show_stamp)}
                    onChange={(e) => toggleBrandingOption(doc.value, "show_stamp", e.target.checked)}
                    disabled={!tenant?.stamp_url}
                  />
                  Show stamp
                </label>
                <label className="flex items-center gap-2 text-body-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(brandingOptions[doc.value]?.show_signature)}
                    onChange={(e) => toggleBrandingOption(doc.value, "show_signature", e.target.checked)}
                    disabled={!tenant?.signature_url}
                  />
                  Show signature
                </label>
              </div>
            ))}
          </div>

          {!tenant?.stamp_url && !tenant?.signature_url && (
            <p className="text-body-sm text-muted-foreground">
              Upload a stamp or signature above to enable these options.
            </p>
          )}
        </div>

        {successMessage && <p className="text-body-sm text-success-500">{successMessage}</p>}
        <FormError>{formError}</FormError>
      </CardContent>
    </Card>
  );
}
