"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Package, FileText } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { customersApi } from "@/lib/api/customers";
import { invoicesApi } from "@/lib/api/invoices";
import { itemsApi } from "@/lib/api/items";
import { tenantsApi } from "@/lib/api/tenants";

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1 text-foreground">Welcome{tenant ? `, ${tenant.business_name}` : ""}</h1>
        <p className="text-body text-muted-foreground">
          Here&apos;s a quick overview of your business.
        </p>
      </div>

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
