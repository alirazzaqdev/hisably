"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { accountsApi, type AccountTransferInput } from "@/lib/api/accounts";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState<AccountTransferInput>({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });

  const { data: transfers } = useQuery({
    queryKey: ["account-transfers"],
    queryFn: () => accountsApi.listTransfers(),
  });

  const accountById = new Map(data?.map((a) => [a.id, a]) ?? []);

  const transferMutation = useMutation({
    mutationFn: () =>
      accountsApi.createTransfer({
        ...form,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transfers"] });
      setTransferOpen(false);
      setForm({
        from_account_id: "",
        to_account_id: "",
        amount: "",
        transfer_date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
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

  function handleTransferSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!form.from_account_id || !form.to_account_id) {
      setFormError("Please select both accounts.");
      return;
    }
    if (form.from_account_id === form.to_account_id) {
      setFormError("Source and destination accounts must be different.");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("Enter a transfer amount greater than zero.");
      return;
    }
    transferMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounts"
        description="Cash and bank accounts used to receive and pay money."
        action={
          <div className="flex gap-2">
            {data && data.length >= 2 && (
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </Button>
            )}
            <Button asChild>
              <Link href="/accounts/new">
                <Plus className="h-4 w-4" />
                Add account
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">No accounts yet</p>
            <p className="text-body-sm text-muted-foreground">Add a cash or bank account to record payments against.</p>
          </div>
          <Button asChild>
            <Link href="/accounts/new">
              <Plus className="h-4 w-4" />
              Add account
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Bank</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((account) => (
                  <tr key={account.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/accounts/${account.id}/edit`} className="font-medium text-foreground hover:text-accent-700">
                        {account.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{account.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{account.bank_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{account.current_balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {data.map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}/edit`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{account.name}</p>
                  <p className="text-body-sm capitalize text-muted-foreground">
                    {account.type}
                    {account.bank_name ? ` · ${account.bank_name}` : ""}
                  </p>
                </div>
                <p className="text-body font-medium tabular-nums text-foreground">{account.current_balance}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {transfers && transfers.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <p className="font-medium text-foreground">Recent transfers</p>
            <p className="text-body-sm text-muted-foreground">
              Account-to-account transfers do not affect sales or profit reports.
            </p>
          </div>
          <table className="w-full text-left text-body">
            <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{t.transfer_date}</td>
                  <td className="px-4 py-3">{accountById.get(t.from_account_id)?.name ?? "—"}</td>
                  <td className="px-4 py-3">{accountById.get(t.to_account_id)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.amount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer between accounts</DialogTitle>
            <DialogDescription>Move funds between your cash and bank accounts.</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={handleTransferSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from_account">From account</Label>
              <Select
                id="from_account"
                value={form.from_account_id}
                onChange={(e) => setForm((f) => ({ ...f, from_account_id: e.target.value }))}
              >
                <option value="">Select account</option>
                {data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.current_balance})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_account">To account</Label>
              <Select
                id="to_account"
                value={form.to_account_id}
                onChange={(e) => setForm((f) => ({ ...f, to_account_id: e.target.value }))}
              >
                <option value="">Select account</option>
                {data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.current_balance})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="transfer_date">Date</Label>
                <Input
                  id="transfer_date"
                  type="date"
                  value={form.transfer_date}
                  onChange={(e) => setForm((f) => ({ ...f, transfer_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <FormError>{formError}</FormError>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={transferMutation.isPending}>
                {transferMutation.isPending ? "Transferring…" : "Transfer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
