"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";
import { downloadCsv } from "@/lib/csv";

export default function StockSummaryPage() {
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: stockSummary, isLoading } = useQuery({
    queryKey: ["reports", "stock-summary"],
    queryFn: () => reportsApi.stockSummary(),
  });

  const currency = tenant?.currency ?? "AED";

  function exportCsv() {
    if (!stockSummary) return;
    downloadCsv("stock-summary.csv", [
      ["Item", "SKU", "Unit", "Current stock", "Purchase price", "Stock value"],
      ...stockSummary.items.map((item) => [
        item.name,
        item.sku ?? "",
        item.unit,
        item.current_stock,
        item.purchase_price,
        item.stock_value,
      ]),
      ["", "", "", "", "Total stock value", stockSummary.total_stock_value],
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
          <h1 className="mt-2 text-h1 text-foreground">Stock summary</h1>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!stockSummary?.items.length}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory valuation</CardTitle>
          <CardDescription>Current stock levels and value for tracked items.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Current stock</th>
                  <th className="px-3 py-2 text-right font-medium">Purchase price</th>
                  <th className="px-3 py-2 text-right font-medium">Stock value</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && (!stockSummary || stockSummary.items.length === 0) && (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={6}>
                      No tracked inventory items yet.
                    </td>
                  </tr>
                )}
                {stockSummary?.items.map((item) => (
                  <tr key={item.item_id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.sku ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{item.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.current_stock}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.purchase_price}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.stock_value}</td>
                  </tr>
                ))}
              </tbody>
              {stockSummary && stockSummary.items.length > 0 && (
                <tfoot className="border-t border-border bg-muted font-semibold text-foreground">
                  <tr>
                    <td className="px-3 py-2" colSpan={5}>
                      Total stock value ({currency})
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{stockSummary.total_stock_value}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
