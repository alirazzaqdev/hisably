"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";
import { downloadCsv } from "@/lib/csv";

export default function BalanceSheetPage() {
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: bs, isLoading } = useQuery({
    queryKey: ["reports", "balance-sheet"],
    queryFn: reportsApi.balanceSheet,
  });

  const currency = tenant?.currency ?? "AED";

  function exportCsv() {
    if (!bs) return;
    downloadCsv("balance-sheet.csv", [
      ["Assets"],
      ["Cash and bank", bs.cash_and_bank],
      ["Accounts receivable", bs.accounts_receivable],
      ["Inventory", bs.inventory_value],
      ["Total assets", bs.total_assets],
      [],
      ["Liabilities & Equity"],
      ["Accounts payable", bs.accounts_payable],
      ["Total liabilities", bs.total_liabilities],
      ["Equity", bs.equity],
      ["Total liabilities & equity", bs.liabilities_and_equity ?? (Number(bs.total_liabilities) + Number(bs.equity))],
    ]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/reports" className="text-body-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Back to reports
          </Link>
          <h1 className="mt-2 text-h1 text-foreground">Balance sheet</h1>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!bs}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>What the business owns, as of today.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-body-sm text-muted-foreground">Loading…</p>}
            {bs && (
              <div className="flex flex-col gap-2 text-body-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cash and bank</span>
                  <span className="tabular-nums">
                    {currency} {bs.cash_and_bank}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Accounts receivable</span>
                  <span className="tabular-nums">
                    {currency} {bs.accounts_receivable}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Inventory</span>
                  <span className="tabular-nums">
                    {currency} {bs.inventory_value}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>Total assets</span>
                  <span className="tabular-nums">
                    {currency} {bs.total_assets}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liabilities &amp; Equity</CardTitle>
            <CardDescription>What the business owes and is worth, as of today.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-body-sm text-muted-foreground">Loading…</p>}
            {bs && (
              <div className="flex flex-col gap-2 text-body-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Accounts payable</span>
                  <span className="tabular-nums">
                    {currency} {bs.accounts_payable}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>Total liabilities</span>
                  <span className="tabular-nums">
                    {currency} {bs.total_liabilities}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-muted-foreground">Equity</span>
                  <span className="tabular-nums">
                    {currency} {bs.equity}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>Total liabilities &amp; equity</span>
                  <span className="tabular-nums">
                    {currency} {bs.liabilities_and_equity ?? (Number(bs.total_liabilities) + Number(bs.equity))}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
