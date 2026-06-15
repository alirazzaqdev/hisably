"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { accountsApi } from "@/lib/api/accounts";

export default function AccountStatementPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null);

  const { data: account } = useQuery({
    queryKey: ["accounts", id],
    queryFn: () => accountsApi.get(id),
  });

  const { data: statement, isLoading, isError } = useQuery({
    queryKey: ["account-statement", id, dateFrom, dateTo],
    queryFn: () => accountsApi.getStatement(id, dateFrom || undefined, dateTo || undefined),
  });

  async function download(format: "pdf" | "csv") {
    setDownloading(format);
    try {
      const blob = await accountsApi.statementFileBlob(id, format, dateFrom || undefined, dateTo || undefined);
      const url = URL.createObjectURL(blob);
      if (format === "pdf") {
        window.open(url, "_blank");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${account?.name ?? "account"}_statement.csv`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Statement — ${account?.name ?? ""}`}
        description="Transaction history and running balance for this account."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/accounts">
                <ArrowLeft className="h-4 w-4" />
                Back to accounts
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => download("pdf")} disabled={downloading !== null}>
              <FileText className="h-4 w-4" />
              {downloading === "pdf" ? "Preparing…" : "PDF"}
            </Button>
            <Button variant="secondary" onClick={() => download("csv")} disabled={downloading !== null}>
              <Download className="h-4 w-4" />
              {downloading === "csv" ? "Preparing…" : "Excel (CSV)"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_from">From</Label>
          <Input id="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_to">To</Label>
          <Input id="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {statement && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-body">
            <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">In</th>
                <th className="px-4 py-3 text-right font-medium">Out</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border bg-muted/50 font-medium">
                <td className="px-4 py-3" colSpan={4}>
                  Opening balance
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{statement.opening_balance}</td>
              </tr>
              {statement.entries.map((entry, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{entry.date}</td>
                  <td className="px-4 py-3">{entry.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(entry.amount_in) > 0 ? entry.amount_in : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(entry.amount_out) > 0 ? entry.amount_out : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{entry.balance}</td>
                </tr>
              ))}
              {statement.entries.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                    No transactions in this period.
                  </td>
                </tr>
              )}
              <tr className="bg-muted/50 font-medium">
                <td className="px-4 py-3" colSpan={4}>
                  Closing balance
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{statement.closing_balance}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
