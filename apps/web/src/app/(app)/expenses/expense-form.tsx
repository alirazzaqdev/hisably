"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { expensesApi, type Expense, type ExpenseInput } from "@/lib/api/expenses";
import { createOrQueue } from "@/lib/offline/sync-engine";

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
  });
  const [formError, setFormError] = useState<string | null>(null);

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
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit expense" : "Add expense"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update this expense entry." : "Record a new business expense."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
            <Label htmlFor="expense_date">Date</Label>
            <Input
              id="expense_date"
              type="date"
              required
              value={form.expense_date}
              onChange={(e) => update("expense_date", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} />
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
