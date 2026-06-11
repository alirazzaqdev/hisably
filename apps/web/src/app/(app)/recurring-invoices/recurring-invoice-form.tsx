"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { customersApi } from "@/lib/api/customers";
import { itemsApi, type VatCategory } from "@/lib/api/items";
import {
  recurringInvoicesApi,
  type RecurrenceFrequency,
  type RecurringInvoiceInput,
  type RecurringInvoiceLineItem,
} from "@/lib/api/recurring-invoices";

const VAT_CATEGORIES: { value: VatCategory; label: string }[] = [
  { value: "standard", label: "Standard (5%)" },
  { value: "zero_rated", label: "Zero-rated" },
  { value: "exempt", label: "Exempt" },
];

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function emptyLine(): RecurringInvoiceLineItem {
  return { description: "", quantity: "1", unit_price: "0", vat_category: "standard" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecurringInvoiceForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });
  const { data: items } = useQuery({
    queryKey: ["items", "all"],
    queryFn: () => itemsApi.list({ pageSize: 100 }),
  });

  const [customerId, setCustomerId] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [lines, setLines] = useState<RecurringInvoiceLineItem[]>([emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: RecurringInvoiceInput = {
        customer_id: customerId || null,
        frequency,
        start_date: startDate,
        end_date: endDate || null,
        discount_amount: discountAmount || "0",
        notes: notes || null,
        terms: terms || null,
        line_items: lines,
      };
      return recurringInvoicesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      router.push("/recurring-invoices");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  function updateLine(index: number, patch: Partial<RecurringInvoiceLineItem>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function applyItem(index: number, itemId: string) {
    const item = items?.items.find((i) => i.id === itemId);
    if (!item) {
      updateLine(index, { item_id: null });
      return;
    }
    updateLine(index, {
      item_id: item.id,
      description: item.name,
      unit_price: item.sale_price,
      vat_category: item.vat_category,
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>New recurring invoice</CardTitle>
        <CardDescription>Automatically generate a sales invoice on a repeating schedule.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer">Customer</Label>
              <Select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">No customer</option>
                {customers?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_date">End date (optional)</Label>
              <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Line items</Label>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="w-20 px-3 py-2 font-medium">Qty</th>
                    <th className="w-28 px-3 py-2 font-medium">Unit price</th>
                    <th className="w-32 px-3 py-2 font-medium">VAT</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Select value={line.item_id ?? ""} onChange={(e) => applyItem(index, e.target.value)}>
                          <option value="">Custom</option>
                          {items?.items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          required
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={line.vat_category}
                          onChange={(e) => updateLine(index, { vat_category: e.target.value as VatCategory })}
                        >
                          {VAT_CATEGORIES.map((vat) => (
                            <option key={vat.value} value={vat.value}>
                              {vat.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="text-muted-foreground hover:text-danger-500"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addLine} className="self-start">
              <Plus className="h-4 w-4" />
              Add line
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="terms">Terms &amp; conditions</Label>
              <Input id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">Discount</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
          </div>

          <FormError>{formError}</FormError>

          <div className="flex gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/recurring-invoices")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
