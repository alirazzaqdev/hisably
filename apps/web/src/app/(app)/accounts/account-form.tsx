"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { accountsApi, type Account, type AccountInput, type AccountType } from "@/lib/api/accounts";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
];

export function AccountForm({ account }: { account?: Account }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(account);

  const [form, setForm] = useState<AccountInput>({
    name: account?.name ?? "",
    type: account?.type ?? "cash",
    bank_name: account?.bank_name ?? "",
    account_number: account?.account_number ?? "",
    opening_balance: account?.opening_balance ?? "0",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing ? accountsApi.update(account!.id, form) : accountsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      router.push("/accounts");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => accountsApi.remove(account!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      router.push("/accounts");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  function update<K extends keyof AccountInput>(key: K, value: AccountInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit account" : "Add account"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update this cash or bank account." : "Add a cash or bank account to track payments."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select id="type" value={form.type} onChange={(e) => update("type", e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opening_balance">Opening balance</Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                disabled={isEditing}
                value={form.opening_balance ?? "0"}
                onChange={(e) => update("opening_balance", e.target.value)}
              />
            </div>
          </div>

          {form.type === "bank" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank_name">Bank name</Label>
                <Input id="bank_name" value={form.bank_name ?? ""} onChange={(e) => update("bank_name", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account_number">Account number</Label>
                <Input
                  id="account_number"
                  value={form.account_number ?? ""}
                  onChange={(e) => update("account_number", e.target.value)}
                />
              </div>
            </div>
          )}

          <FormError>{formError}</FormError>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/accounts")}>
                Cancel
              </Button>
            </div>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
