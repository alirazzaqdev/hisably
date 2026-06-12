"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FIELD_CATALOG, INDUSTRY_PRESETS, resolveEnabledFields } from "@hisably/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { tenantsApi } from "@/lib/api/tenants";

export default function DocumentFieldsPage() {
  const queryClient = useQueryClient();
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });

  const [industryProfile, setIndustryProfile] = useState("general");
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({});
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      setIndustryProfile(tenant.industry_profile);
      setEnabledFields(tenant.enabled_fields);
      setFieldLabels(tenant.field_labels);
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: () =>
      tenantsApi.update({ industry_profile: industryProfile, enabled_fields: enabledFields, field_labels: fieldLabels }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", "me"] });
      setSuccessMessage("Document fields saved.");
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

  const resolved = resolveEnabledFields(industryProfile, enabledFields);

  function toggleField(fieldId: string) {
    setEnabledFields((prev) => ({ ...prev, [fieldId]: !resolved[fieldId] }));
  }

  function updateLabel(fieldId: string, value: string) {
    setFieldLabels((prev) => {
      const next = { ...prev };
      if (value.trim()) {
        next[fieldId] = value;
      } else {
        delete next[fieldId];
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSuccessMessage(null);
    saveMutation.mutate();
  }

  const headerFields = FIELD_CATALOG.filter((f) => f.scope === "header");
  const lineFields = FIELD_CATALOG.filter((f) => f.scope === "line");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Document fields</h1>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Industry profile</CardTitle>
            <CardDescription>
              Choose a starting point for your invoices. You can still enable or disable any field below, and
              picking a new profile won&apos;t change fields you&apos;ve already customized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="industry_profile">Business industry</Label>
              <Select
                id="industry_profile"
                value={industryProfile}
                onChange={(e) => setIndustryProfile(e.target.value)}
              >
                {INDUSTRY_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.labelEn}
                  </option>
                ))}
              </Select>
              <p className="text-body-sm text-muted-foreground">
                {INDUSTRY_PRESETS.find((p) => p.key === industryProfile)?.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Header fields</CardTitle>
            <CardDescription>Optional fields shown on the invoice header.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldList fields={headerFields} resolved={resolved} labels={fieldLabels} onToggle={toggleField} onLabelChange={updateLabel} />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Line-item fields</CardTitle>
            <CardDescription>Optional fields shown on each invoice line.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldList fields={lineFields} resolved={resolved} labels={fieldLabels} onToggle={toggleField} onLabelChange={updateLabel} />
          </CardContent>
        </Card>

        {successMessage && <p className="text-body-sm text-success-500">{successMessage}</p>}
        <FormError>{formError}</FormError>

        <div>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldList({
  fields,
  resolved,
  labels,
  onToggle,
  onLabelChange,
}: {
  fields: typeof FIELD_CATALOG;
  resolved: Record<string, boolean>;
  labels: Record<string, string>;
  onToggle: (fieldId: string) => void;
  onLabelChange: (fieldId: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-body text-foreground">
            <input type="checkbox" checked={Boolean(resolved[field.id])} onChange={() => onToggle(field.id)} />
            {field.labelEn}
          </label>
          <Input
            className="sm:max-w-xs"
            placeholder={field.labelEn}
            value={labels[field.id] ?? ""}
            onChange={(e) => onLabelChange(field.id, e.target.value)}
            aria-label={`Custom label for ${field.labelEn}`}
          />
        </div>
      ))}
    </div>
  );
}
