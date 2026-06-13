"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ledgerApi } from "@/lib/api/ledger";

export default function SupplierStatementPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data: statement, isLoading, isError } = useQuery({
    queryKey: ["suppliers", id, "statement"],
    queryFn: () => ledgerApi.supplierStatement(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={statement ? `Statement — ${statement.party_name}` : "Statement"}
        description="Supplier transaction history and running balance."
        action={
          statement && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          )
        }
      />

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

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

          {statement.entries.length === 0 && (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-body text-muted-foreground">No transactions yet.</p>
            </div>
          )}

          {statement.entries.length > 0 && (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
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

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {statement.entries.map((entry, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize text-foreground">{entry.type}</p>
                        <p className="text-body-sm text-muted-foreground">{entry.date} · {entry.reference}</p>
                      </div>
                      <p className="text-body font-medium tabular-nums text-foreground">{entry.balance}</p>
                    </div>
                    <div className="flex gap-4 text-body-sm text-muted-foreground">
                      <span>Debit: {entry.debit !== "0.00" ? entry.debit : "—"}</span>
                      <span>Credit: {entry.credit !== "0.00" ? entry.credit : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
