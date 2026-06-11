"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api/customers";

export default function CustomersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => customersApi.list({ search: search || undefined, pageSize: 50 }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Customers</h1>
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="h-4 w-4" />
            Add customer
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-body">
          <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 text-right font-medium">Opening balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                  No customers yet.
                </td>
              </tr>
            )}
            {data?.items.map((customer) => (
              <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${customer.id}/edit`} className="font-medium text-foreground hover:text-accent-700">
                    {customer.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{customer.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{customer.email ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{customer.opening_balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
