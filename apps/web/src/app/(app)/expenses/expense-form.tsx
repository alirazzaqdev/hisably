"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { accountsApi } from "@/lib/api/accounts";
import { attachmentsApi } from "@/lib/api/attachments";
import { expensesApi, type Expense, type ExpenseInput } from "@/lib/api/expenses";
import { type PaymentMethod } from "@/lib/api/payments";
import { suppliersApi } from "@/lib/api/suppliers";
import { createOrQueue } from "@/lib/offline/sync-engine";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({ expense }: { expense?: Expense }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(expense);

  const [form, setForm] = useState<ExpenseInput>({
    category: expense?.category ?? "",
    amount: expense?.amount ?? "",
    vat_paid: expense?.vat_paid ?? "0",
    expense_date: expense?.expense_date ?? todayIso(),
    notes: expense?.notes ?? "",
    attachment_id: expense?.attachment_id ?? null,
    location: expense?.location ?? "",
    payment_method: expense?.payment_method ?? "cash",
    account_id: expense?.account_id ?? null,
    supplier_id: expense?.supplier_id ?? null,
  });
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(expense?.attachment_url ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", { search: "" }],
    queryFn: () => suppliersApi.list(),
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const attachment = await attachmentsApi.upload(file, "expense");
      update("attachment_id", attachment.id);
      setAttachmentUrl(attachment.file_url);
    } catch (error) {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
      } else {
        setFormError("Failed to upload receipt. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing ? expensesApi.update(expense!.id, form) : createOrQueue("expense", form, expensesApi.create),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      router.push("/expenses");
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
    mutationFn: () => expensesApi.remove(expense!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      router.push("/expenses");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  function update<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit expense" : "Add expense"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update this expense entry." : "Record a new business expense."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                required
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                placeholder="e.g. Rent, Utilities, Supplies"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense_date">Date</Label>
              <Input
                id="expense_date"
                type="date"
                required
                value={form.expense_date}
                onChange={(e) => update("expense_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vat_paid">VAT paid</Label>
              <Input
                id="vat_paid"
                type="number"
                step="0.01"
                min="0"
                value={form.vat_paid ?? "0"}
                onChange={(e) => update("vat_paid", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location ?? ""}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Site or office location"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment_method">Payment method</Label>
              <Select
                id="payment_method"
                value={form.payment_method ?? "cash"}
                onChange={(e) => update("payment_method", e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account">Account</Label>
              <Select
                id="account"
                value={form.account_id ?? ""}
                onChange={(e) => update("account_id", e.target.value || null)}
              >
                <option value="">No account</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier">Supplier (optional)</Label>
              <Select
                id="supplier"
                value={form.supplier_id ?? ""}
                onChange={(e) => update("supplier_id", e.target.value || null)}
              >
                <option value="">No supplier</option>
                {suppliers?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receipt">Receipt / bill</Label>
            <Input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} />
            {uploading && <p className="text-body-sm text-muted-foreground">Uploading…</p>}
            {attachmentUrl && !uploading && (
              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-body-sm text-accent-700 hover:underline">
                View attached receipt
              </a>
            )}
          </div>

          <FormError>{formError}</FormError>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/expenses")}>
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
