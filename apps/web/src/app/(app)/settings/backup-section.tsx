"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { ApiError } from "@/lib/api-client";
import { backupApi } from "@/lib/api/backup";

export function BackupSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: () => backupApi.export(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hisably-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError(null);
      setSuccess(null);
    },
    onError: () => setError("Could not export your data. Please try again."),
  });

  const importMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => backupApi.import(payload),
    onSuccess: () => {
      setSuccess("Backup restored successfully.");
      setError(null);
    },
    onError: (err) => {
      setSuccess(null);
      if (err instanceof ApiError && typeof err.detail === "string") {
        setError(err.detail);
        return;
      }
      setError("Could not restore this backup file.");
    },
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      importMutation.mutate(payload);
    } catch {
      setError("This file isn't a valid backup.");
      setSuccess(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup &amp; restore</CardTitle>
        <CardDescription>
          Export all your business data to a JSON file, or restore from a previous backup. Restoring replaces all
          current data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? "Exporting…" : "Export backup"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? "Restoring…" : "Restore from backup"}
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
        </div>
        {success && <p className="text-body-sm text-success-500">{success}</p>}
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  );
}
