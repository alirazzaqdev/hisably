"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";

const CHART_COLORS = {
  invoiced: "#0d9488",
  collected: "#3b82f6",
  agingBuckets: ["#0d9488", "#3b82f6", "#f59e0b", "#fb7185", "#94a3b8"],
  topCustomers: "#0d9488",
  topItems: "#3b82f6",
  outputVat: "#10b981",
  inputVat: "#f59e0b",
};

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "var(--color-fg)",
};

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-body-sm text-muted-foreground">{label}</div>
  );
}

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

  const trendData = (trend ?? []).map((p) => ({
    period: p.period,
    Invoiced: Number(p.invoiced_total),
    Collected: Number(p.paid_total),
  }));
  const hasTrendData = trendData.some((p) => p.Invoiced > 0 || p.Collected > 0);

  const agingData = (aging ?? [])
    .map((b) => ({ name: b.label, value: Number(b.total), count: b.count }))
    .filter((b) => b.value > 0);
  const agingTotal = agingData.reduce((sum, b) => sum + b.value, 0);

  const topCustomersData = (topCustomers ?? []).map((c) => ({
    name: c.name,
    Invoiced: Number(c.total_invoiced),
    Paid: Number(c.total_paid),
  }));

  const topItemsData = (topItems ?? []).map((i) => ({
    name: i.description,
    Revenue: Number(i.revenue),
  }));

  const outputVat = Number(vat?.output_vat ?? 0);
  const inputVat = Number(vat?.input_vat ?? 0);
  const vatData = [
    { name: "Output VAT", value: outputVat },
    { name: "Input VAT", value: inputVat },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Reports</h1>
        <div className="flex gap-4">
          <Link href="/reports/day-book" className="text-body-sm text-accent-700 hover:underline">
            Day book →
          </Link>
          <Link href="/reports/stock-summary" className="text-body-sm text-accent-700 hover:underline">
            Stock summary →
          </Link>
          <Link href="/reports/profit-loss" className="text-body-sm text-accent-700 hover:underline">
            Profit &amp; Loss →
          </Link>
          <Link href="/reports/balance-sheet" className="text-body-sm text-accent-700 hover:underline">
            Balance sheet →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent-500/10" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription>Revenue (paid)</CardDescription>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/10 text-accent-700">
                <TrendingUp className="h-4.5 w-4.5" />
              </span>
            </div>
            <CardTitle className="text-h1">
              {currency} {kpis?.revenue_paid ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-info-500/10" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription>Outstanding receivables</CardDescription>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-500/10 text-info-500">
                <ArrowUpRight className="h-4.5 w-4.5" />
              </span>
            </div>
            <CardTitle className="text-h1">
              {currency} {kpis?.outstanding_receivables ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-warning-50" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription>Expenses this month</CardDescription>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-50 text-warning-500">
                <Wallet className="h-4.5 w-4.5" />
              </span>
            </div>
            <CardTitle className="text-h1">
              {currency} {kpis?.expenses_this_month ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-danger-50" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription>Overdue invoices</CardDescription>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-50 text-danger-500">
                <AlertTriangle className="h-4.5 w-4.5" />
              </span>
            </div>
            <CardTitle className="text-h1">{kpis?.invoices_overdue ?? "—"}</CardTitle>
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
            {!hasTrendData ? (
              <ChartEmptyState label="No data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="invoicedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.invoiced} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.invoiced} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.collected} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.collected} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${currency} ${value.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="Invoiced"
                    stroke={CHART_COLORS.invoiced}
                    strokeWidth={2}
                    fill="url(#invoicedGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Collected"
                    stroke={CHART_COLORS.collected}
                    strokeWidth={2}
                    fill="url(#collectedGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receivables aging</CardTitle>
            <CardDescription>Outstanding balances by age.</CardDescription>
          </CardHeader>
          <CardContent>
            {agingData.length === 0 ? (
              <ChartEmptyState label="No outstanding receivables." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-[220px] w-[220px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agingData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={2}
                        stroke="var(--color-surface)"
                        strokeWidth={2}
                      >
                        {agingData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS.agingBuckets[index % CHART_COLORS.agingBuckets.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${currency} ${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-caption text-muted-foreground">Total due</span>
                    <span className="text-h3 text-foreground">
                      {currency} {agingTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {agingData.map((bucket, index) => (
                    <div key={bucket.name} className="flex items-center justify-between text-body-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: CHART_COLORS.agingBuckets[index % CHART_COLORS.agingBuckets.length] }}
                        />
                        {bucket.name}
                        <span className="text-caption text-muted-foreground">({bucket.count})</span>
                      </span>
                      <span className="tabular-nums font-medium text-foreground">
                        {currency} {bucket.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>By total invoiced amount.</CardDescription>
          </CardHeader>
          <CardContent>
            {topCustomersData.length === 0 ? (
              <ChartEmptyState label="No data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, topCustomersData.length * 44)}>
                <BarChart data={topCustomersData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="topCustomersGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={CHART_COLORS.topCustomers} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={CHART_COLORS.topCustomers} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${currency} ${value.toLocaleString()}`} />
                  <Bar dataKey="Invoiced" fill="url(#topCustomersGradient)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
            <CardDescription>By revenue.</CardDescription>
          </CardHeader>
          <CardContent>
            {topItemsData.length === 0 ? (
              <ChartEmptyState label="No data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, topItemsData.length * 44)}>
                <BarChart data={topItemsData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="topItemsGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={CHART_COLORS.topItems} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={CHART_COLORS.topItems} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${currency} ${value.toLocaleString()}`} />
                  <Bar dataKey="Revenue" fill="url(#topItemsGradient)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>VAT position</CardTitle>
          <CardDescription>All-time output vs. input VAT.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-[160px] w-[160px] shrink-0">
              {vatData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-body-sm text-muted-foreground">
                  No data yet.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={vatData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2}>
                        <Cell fill={CHART_COLORS.outputVat} />
                        <Cell fill={CHART_COLORS.inputVat} />
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${currency} ${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-caption text-muted-foreground">Net due</span>
                    <span className="text-body-lg font-semibold text-foreground">
                      {currency} {(outputVat - inputVat).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.outputVat }} />
                  Output VAT (collected)
                </span>
                <span className="tabular-nums">
                  {currency} {vat?.output_vat ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.inputVat }} />
                  Input VAT (paid)
                </span>
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
