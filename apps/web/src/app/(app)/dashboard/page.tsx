"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Package, FileText, AlertTriangle } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { customersApi } from "@/lib/api/customers";
import { invoicesApi } from "@/lib/api/invoices";
import { itemsApi } from "@/lib/api/items";
import { tenantsApi } from "@/lib/api/tenants";
import { notificationsApi } from "@/lib/api/notifications";

export default function DashboardPage() {
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: customers } = useQuery({
    queryKey: ["customers", "count"],
    queryFn: () => customersApi.list({ pageSize: 1 }),
  });
  const { data: items } = useQuery({
    queryKey: ["items", "count"],
    queryFn: () => itemsApi.list({ pageSize: 1 }),
  });
  const { data: invoices } = useQuery({
    queryKey: ["invoices", "count"],
    queryFn: () => invoicesApi.list({ pageSize: 1 }),
  });
  const { data: lowStockItems } = useQuery({
    queryKey: ["items", "low-stock"],
    queryFn: () => itemsApi.lowStock(),
  });
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 60_000,
  });

  // Count distinct types from unread notifications for the "needs attention" summary
  const unreadItems = (notifications?.items ?? []).filter((n) => !n.read_at);
  const quotExpiring = unreadItems.filter((n) => n.type === "quotation_expiring_soon").length;
  const quotExpired = unreadItems.filter((n) => n.type === "quotation_expired").length;
  const invoiceOverdue = unreadItems.filter((n) => n.type === "invoice_overdue").length;
  const hasAttention = quotExpiring > 0 || quotExpired > 0 || invoiceOverdue > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1 text-foreground">Welcome{tenant ? `, ${tenant.business_name}` : ""}</h1>
        <p className="text-body text-muted-foreground">
          Here&apos;s a quick overview of your business.
        </p>
      </div>

      {/* Needs attention */}
      {hasAttention && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
          <div className="flex items-center gap-2 text-body-sm font-semibold text-warning-700">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            Needs attention
          </div>
          <div className="flex flex-wrap gap-3">
            {quotExpiring > 0 && (
              <Link href="/quotations" className="text-body-sm text-warning-700 underline hover:no-underline">
                {quotExpiring} quotation{quotExpiring > 1 ? "s" : ""} expiring soon
              </Link>
            )}
            {quotExpired > 0 && (
              <Link href="/quotations" className="text-body-sm text-warning-700 underline hover:no-underline">
                {quotExpired} quotation{quotExpired > 1 ? "s" : ""} expired
              </Link>
            )}
            {invoiceOverdue > 0 && (
              <Link href="/invoices" className="text-body-sm text-warning-700 underline hover:no-underline">
                {invoiceOverdue} invoice{invoiceOverdue > 1 ? "s" : ""} overdue
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Low stock */}
      {lowStockItems && lowStockItems.length > 0 && (
        <Link href="/items">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body text-red-800 transition-colors hover:border-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              {lowStockItems.length} item{lowStockItems.length === 1 ? "" : "s"} low on stock:{" "}
              {lowStockItems.slice(0, 5).map((i) => i.name).join(", ")}
              {lowStockItems.length > 5 ? "…" : ""}
            </span>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/customers">
          <Card className="transition-colors hover:border-accent-600">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent-600/10 text-accent-700">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle>{customers?.total ?? "—"}</CardTitle>
              <CardDescription>Customers</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/items">
          <Card className="transition-colors hover:border-accent-600">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent-600/10 text-accent-700">
                <Package className="h-5 w-5" />
              </div>
              <CardTitle>{items?.total ?? "—"}</CardTitle>
              <CardDescription>Items</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/invoices">
          <Card className="transition-colors hover:border-accent-600">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent-600/10 text-accent-700">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle>{invoices?.total ?? "—"}</CardTitle>
              <CardDescription>Invoices</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
