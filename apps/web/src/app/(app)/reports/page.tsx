"use client";

import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";

const COLORS = {
  teal: "#0d9488",
  blue: "#3b82f6",
  amber: "#f59e0b",
  red: "#fb7185",
  purple: "#8b5cf6",
  green: "#10b981",
  slate: "#94a3b8",
};

const AGING_COLORS = [COLORS.teal, COLORS.blue, COLORS.amber, COLORS.red, COLORS.slate];
const ASSET_COLORS = [COLORS.teal, COLORS.blue, COLORS.amber];
const LE_COLORS = [COLORS.red, COLORS.purple];
const EXPENSE_COLORS = [COLORS.teal, COLORS.blue, COLORS.amber, COLORS.purple, COLORS.red, COLORS.green, COLORS.slate];

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "var(--color-fg)",
};

function fmt(value: number | string | undefined, currency: string): string {
  if (value === undefined || value === null) return "—";
  const n = Number(value);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-body-sm text-muted-foreground">{label}</div>
  );
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(yearStart());
  const [dateTo, setDateTo] = useState(todayIso());

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: kpis } = useQuery({ queryKey: ["reports", "kpis"], queryFn: reportsApi.kpis });
  const { data: trend } = useQuery({
    queryKey: ["reports", "sales-trend"],
    queryFn: () => reportsApi.salesTrend(6),
  });
  const { data: topCustomers } = useQuery({
    queryKey: ["reports", "top-customers"],
    queryFn: () => reportsApi.topCustomers(5),
  });
  const { data: topItems } = useQuery({
    queryKey: ["reports", "top-items"],
    queryFn: () => reportsApi.topItems(5),
  });
  const { data: aging } = useQuery({
    queryKey: ["reports", "aging"],
    queryFn: reportsApi.receivablesAging,
  });
  const { data: vat } = useQuery({
    queryKey: ["reports", "vat-summary", dateFrom, dateTo],
    queryFn: () => reportsApi.vatSummary({ dateFrom, dateTo }),
  });
  const { data: profitLoss } = useQuery({
    queryKey: ["reports", "profit-loss", dateFrom, dateTo],
    queryFn: () => reportsApi.profitLoss({ dateFrom, dateTo }),
  });
  const { data: balanceSheet } = useQuery({
    queryKey: ["reports", "balance-sheet"],
    queryFn: reportsApi.balanceSheet,
  });

  const currency = tenant?.currency ?? "AED";

  // Sales Trend
  const trendData = (trend ?? []).map((p) => ({
    period: p.period,
    Invoiced: Number(p.invoiced_total),
    Collected: Number(p.paid_total),
  }));
  const hasTrendData = trendData.some((p) => p.Invoiced !== 0 || p.Collected !== 0);

  // Receivables Aging
  const agingData = (aging ?? [])
    .map((b) => ({ name: b.label, value: Number(b.total), count: b.count }))
    .filter((b) => b.value > 0);
  const agingTotal = agingData.reduce((s, b) => s + b.value, 0);

  // Top Customers / Items
  const topCustomersData = (topCustomers ?? []).map((c) => ({
    name: c.name,
    Invoiced: Number(c.total_invoiced),
  }));
  const topItemsData = (topItems ?? []).map((i) => ({
    name: i.description,
    Revenue: Number(i.revenue),
  }));


  // Expense breakdown
  const expenseData = (profitLoss?.expenses_by_category ?? [])
    .map((e) => ({ name: e.category, value: Number(e.amount) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
  const expenseTotal = expenseData.reduce((s, e) => s + e.value, 0);

  // Balance Sheet
  const assetsData = balanceSheet
    ? [
        { name: "Cash & bank", value: Number(balanceSheet.cash_and_bank) },
        { name: "Receivables", value: Number(balanceSheet.accounts_receivable) },
        { name: "Inventory", value: Number(balanceSheet.inventory_value) },
      ].filter((d) => d.value > 0)
    : [];
  const totalAssets = Number(balanceSheet?.total_assets ?? 0);
  const liabEquity = Number(balanceSheet?.liabilities_and_equity ?? totalAssets);

  const liabEquityData = balanceSheet
    ? [
        { name: "Payables", value: Number(balanceSheet.total_liabilities) },
        { name: "Equity", value: Number(balanceSheet.equity) },
      ].filter((d) => d.value !== 0)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1 text-foreground">Reports</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Overview of business performance. Use the sidebar links for detailed reports.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue (paid)</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{fmt(kpis?.revenue_paid, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-muted-foreground">Paid sales invoices, net of returns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding receivables</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{fmt(kpis?.outstanding_receivables, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-muted-foreground">Sent + partially paid invoices, balance due</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expenses this month</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{fmt(kpis?.expenses_this_month, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-muted-foreground">All expense entries from the 1st</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue invoices</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{kpis?.invoices_overdue ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-muted-foreground">Past due date and still unpaid/partial</p>
          </CardContent>
        </Card>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-body-sm font-medium text-foreground">Period</span>
        <Input id="rpt_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-body-sm" />
        <span className="text-body-sm text-muted-foreground">to</span>
        <Input id="rpt_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-body-sm" />
        <span className="text-caption text-muted-foreground">· Applies to P&amp;L, VAT, Expenses</span>
      </div>

      {/* Charts row 1: Sales Trend + Receivables Aging */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales trend</CardTitle>
            <CardDescription>Invoiced (by issue date) vs. collected (by payment date), last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasTrendData ? (
              <EmptyChart label="No invoices or payments yet." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gInvoiced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area type="monotone" dataKey="Invoiced" stroke={COLORS.teal} strokeWidth={2} fill="url(#gInvoiced)" />
                  <Area type="monotone" dataKey="Collected" stroke={COLORS.blue} strokeWidth={2} fill="url(#gCollected)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receivables aging</CardTitle>
            <CardDescription>Outstanding customer balances by age — sent, partial, overdue</CardDescription>
          </CardHeader>
          <CardContent>
            {agingData.length === 0 ? (
              <EmptyChart label="No outstanding receivables." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agingData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2}>
                        {agingData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-caption text-muted-foreground">Total due</span>
                    <span className="text-body font-semibold tabular-nums text-foreground">{fmt(agingTotal, currency)}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {agingData.map((b, i) => (
                    <div key={b.name} className="flex items-center justify-between text-body-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: AGING_COLORS[i % AGING_COLORS.length] }} />
                        {b.name} <span className="text-caption">({b.count})</span>
                      </span>
                      <span className="tabular-nums font-medium text-foreground">{fmt(b.value, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Top Customers + Top Items */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>By total invoiced amount (all time, non-void)</CardDescription>
          </CardHeader>
          <CardContent>
            {topCustomersData.length === 0 ? (
              <EmptyChart label="No customer invoices yet." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, topCustomersData.length * 44)}>
                <BarChart data={topCustomersData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                  <Bar dataKey="Invoiced" fill={COLORS.teal} radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
            <CardDescription>By line-item revenue (all time, non-void)</CardDescription>
          </CardHeader>
          <CardContent>
            {topItemsData.length === 0 ? (
              <EmptyChart label="No invoiced items yet." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, topItemsData.length * 44)}>
                <BarChart data={topItemsData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                  <Bar dataKey="Revenue" fill={COLORS.blue} radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* P&L Summary (date-filtered) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit &amp; loss summary</CardTitle>
            <CardDescription>
              {dateFrom} → {dateTo} · uses invoice issue dates and expense dates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!profitLoss ? (
              <EmptyChart label="Loading…" />
            ) : (
              <div className="flex flex-col gap-1.5 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales revenue</span>
                  <span className="tabular-nums text-foreground">{fmt(profitLoss.sales_revenue, currency)}</span>
                </div>
                {Number(profitLoss.sales_returns) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sales returns</span>
                    <span className="tabular-nums text-danger-600">({fmt(profitLoss.sales_returns, currency)})</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 font-medium text-foreground">
                  <span>Net revenue</span>
                  <span className="tabular-nums">{fmt(profitLoss.net_revenue, currency)}</span>
                </div>
                {Number(profitLoss.cost_of_goods_sold) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost of goods sold</span>
                    <span className="tabular-nums text-amber-600">({fmt(profitLoss.cost_of_goods_sold, currency)})</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 font-medium text-foreground">
                  <span>Gross profit</span>
                  <span className="tabular-nums">{fmt(profitLoss.gross_profit, currency)}</span>
                </div>
                {Number(profitLoss.total_expenses) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total expenses</span>
                    <span className="tabular-nums text-danger-600">({fmt(profitLoss.total_expenses, currency)})</span>
                  </div>
                )}
                <div className={`flex justify-between border-t border-border pt-1.5 font-semibold ${Number(profitLoss.net_profit) >= 0 ? "text-green-700" : "text-danger-600"}`}>
                  <span>Net profit</span>
                  <span className="tabular-nums">{fmt(profitLoss.net_profit, currency)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense breakdown</CardTitle>
            <CardDescription>{dateFrom} → {dateTo}</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseData.length === 0 ? (
              <EmptyChart label="No expenses in this period." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2}>
                        {expenseData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-caption text-muted-foreground">Total</span>
                    <span className="text-body font-semibold tabular-nums text-foreground">{fmt(expenseTotal, currency)}</span>
                  </div>
                </div>
                <div className="flex max-h-52 flex-1 flex-col gap-2 overflow-y-auto">
                  {expenseData.map((e, i) => (
                    <div key={e.name} className="flex items-center justify-between text-body-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                        <span className="truncate">{e.name}</span>
                      </span>
                      <span className="tabular-nums font-medium text-foreground">{fmt(e.value, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* VAT Position */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>VAT position</CardTitle>
          <CardDescription>{dateFrom} → {dateTo} · output VAT collected vs. input VAT on expenses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-body-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output VAT (billed to customers)</span>
              <span className="tabular-nums">{fmt(vat?.output_vat, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input VAT (paid on expenses)</span>
              <span className="tabular-nums">({fmt(vat?.input_vat, currency)})</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
              <span>Net VAT due</span>
              <span className="tabular-nums">{fmt(vat?.net_vat_due, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Sheet Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>Balance sheet snapshot</CardTitle>
          <CardDescription>As of today · Assets = Liabilities + Equity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 sm:grid-cols-2">
            {/* Assets */}
            <div>
              <p className="mb-3 text-body-sm font-medium text-foreground">Assets</p>
              {assetsData.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">No assets recorded.</p>
              ) : (
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="relative h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={assetsData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2}>
                          {assetsData.map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-caption text-muted-foreground">Total</span>
                      <span className="text-body-sm font-semibold tabular-nums">{fmt(totalAssets, currency)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-body-sm">
                    {assetsData.map((a, i) => (
                      <div key={a.name} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                          {a.name}
                        </span>
                        <span className="tabular-nums text-foreground">{fmt(a.value, currency)}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-1.5 font-semibold text-foreground">
                      <span>Total assets</span>
                      <span className="tabular-nums">{fmt(totalAssets, currency)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Liabilities + Equity */}
            <div>
              <p className="mb-3 text-body-sm font-medium text-foreground">Liabilities &amp; Equity</p>
              {liabEquityData.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">No data yet.</p>
              ) : (
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="relative h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={liabEquityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2}>
                          {liabEquityData.map((_, i) => <Cell key={i} fill={LE_COLORS[i % LE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v, currency)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-caption text-muted-foreground">Total</span>
                      <span className="text-body-sm font-semibold tabular-nums">{fmt(liabEquity, currency)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-body-sm">
                    {liabEquityData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LE_COLORS[i % LE_COLORS.length] }} />
                          {d.name}
                        </span>
                        <span className="tabular-nums text-foreground">{fmt(d.value, currency)}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-1.5 font-semibold text-foreground">
                      <span>Total L &amp; E</span>
                      <span className="tabular-nums">{fmt(liabEquity, currency)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
