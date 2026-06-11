"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";

export default function ReportsPage() {
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: kpis } = useQuery({ queryKey: ["reports", "kpis"], queryFn: reportsApi.kpis });
  const { data: trend } = useQuery({ queryKey: ["reports", "sales-trend"], queryFn: () => reportsApi.salesTrend(6) });
  const { data: topCustomers } = useQuery({
    queryKey: ["reports", "top-customers"],
    queryFn: () => reportsApi.topCustomers(5),
  });
  const { data: topItems } = useQuery({ queryKey: ["reports", "top-items"], queryFn: () => reportsApi.topItems(5) });
  const { data: aging } = useQuery({ queryKey: ["reports", "aging"], queryFn: reportsApi.receivablesAging });
  const { data: vat } = useQuery({ queryKey: ["reports", "vat-summary"], queryFn: () => reportsApi.vatSummary() });

  const currency = tenant?.currency ?? "AED";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Reports</h1>
        <Link href="/reports/day-book" className="text-body-sm text-accent-700 hover:underline">
          Day book →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Revenue (paid)</CardDescription>
            <CardTitle>
              {currency} {kpis?.revenue_paid ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Outstanding receivables</CardDescription>
            <CardTitle>
              {currency} {kpis?.outstanding_receivables ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Expenses this month</CardDescription>
            <CardTitle>
              {currency} {kpis?.expenses_this_month ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Overdue invoices</CardDescription>
            <CardTitle>{kpis?.invoices_overdue ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales trend</CardTitle>
            <CardDescription>Invoiced vs. collected, last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 text-right font-medium">Invoiced</th>
                  <th className="py-2 text-right font-medium">Collected</th>
                </tr>
              </thead>
              <tbody>
                {(!trend || trend.length === 0) && (
                  <tr>
                    <td className="py-4 text-center text-muted-foreground" colSpan={3}>
                      No data yet.
                    </td>
                  </tr>
                )}
                {trend?.map((point) => (
                  <tr key={point.period} className="border-b border-border last:border-0">
                    <td className="py-2">{point.period}</td>
                    <td className="py-2 text-right tabular-nums">{point.invoiced_total}</td>
                    <td className="py-2 text-right tabular-nums">{point.paid_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receivables aging</CardTitle>
            <CardDescription>Outstanding balances by age.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Bucket</th>
                  <th className="py-2 text-right font-medium">Invoices</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {aging?.map((bucket) => (
                  <tr key={bucket.label} className="border-b border-border last:border-0">
                    <td className="py-2">{bucket.label}</td>
                    <td className="py-2 text-right tabular-nums">{bucket.count}</td>
                    <td className="py-2 text-right tabular-nums">
                      {currency} {bucket.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>By total invoiced amount.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 text-right font-medium">Invoiced</th>
                  <th className="py-2 text-right font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {(!topCustomers || topCustomers.length === 0) && (
                  <tr>
                    <td className="py-4 text-center text-muted-foreground" colSpan={3}>
                      No data yet.
                    </td>
                  </tr>
                )}
                {topCustomers?.map((c) => (
                  <tr key={c.customer_id} className="border-b border-border last:border-0">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 text-right tabular-nums">{c.total_invoiced}</td>
                    <td className="py-2 text-right tabular-nums">{c.total_paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
            <CardDescription>By revenue.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(!topItems || topItems.length === 0) && (
                  <tr>
                    <td className="py-4 text-center text-muted-foreground" colSpan={3}>
                      No data yet.
                    </td>
                  </tr>
                )}
                {topItems?.map((item) => (
                  <tr key={item.item_id ?? item.description} className="border-b border-border last:border-0">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{item.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>VAT position</CardTitle>
          <CardDescription>All-time output vs. input VAT.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-body-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Output VAT (collected)</span>
            <span className="tabular-nums">
              {currency} {vat?.output_vat ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Input VAT (paid)</span>
            <span className="tabular-nums">
              {currency} {vat?.input_vat ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
            <span>Net VAT due</span>
            <span className="tabular-nums">
              {currency} {vat?.net_vat_due ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
