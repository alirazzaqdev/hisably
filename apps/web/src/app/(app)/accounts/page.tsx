"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountsApi } from "@/lib/api/accounts";

export default function AccountsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Accounts</h1>
        <Button asChild>
          <Link href="/accounts/new">
            <Plus className="h-4 w-4" />
            Add account
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
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
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                  No accounts yet.
                </td>
              </tr>
            )}
            {data?.map((account) => (
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
    </div>
  );
}
