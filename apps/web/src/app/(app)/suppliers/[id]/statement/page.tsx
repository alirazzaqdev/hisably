"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ledgerApi } from "@/lib/api/ledger";

export default function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: statement, isLoading } = useQuery({
    queryKey: ["suppliers", id, "statement"],
    queryFn: () => ledgerApi.supplierStatement(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">
        Statement{statement ? ` — ${statement.party_name}` : ""}
      </h1>

      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}

      {statement && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-8">
            <div>
              <p className="text-body-sm text-muted-foreground">Opening balance</p>
              <p className="text-h3 tabular-nums text-foreground">{statement.opening_balance}</p>
            </div>
            <div>
              <p className="text-body-sm text-muted-foreground">Closing balance</p>
              <p className="text-h3 tabular-nums text-foreground">{statement.closing_balance}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.entries.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {statement.entries.map((entry, index) => (
                  <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">{entry.date}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{entry.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.reference}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{entry.debit !== "0.00" ? entry.debit : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{entry.credit !== "0.00" ? entry.credit : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{entry.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
