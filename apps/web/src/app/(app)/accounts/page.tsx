"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { accountsApi } from "@/lib/api/accounts";

export default function AccountsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounts"
        description="Cash and bank accounts used to receive and pay money."
        action={
          <Button asChild>
            <Link href="/accounts/new">
              <Plus className="h-4 w-4" />
              Add account
            </Link>
          </Button>
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
    </div>
  );
}
