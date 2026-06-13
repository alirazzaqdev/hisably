"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { customersApi } from "@/lib/api/customers";

export default function CustomersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => customersApi.list({ search: search || undefined, pageSize: 50 }),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="People and businesses you sell to."
        action={
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="h-4 w-4" />
              Add customer
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email"
          className="pl-9"
        />
      </div>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">No customers yet</p>
            <p className="text-body-sm text-muted-foreground">Add a customer to start billing them.</p>
          </div>
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="h-4 w-4" />
              Add customer
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 text-right font-medium">Opening balance</th>
                  <th className="px-4 py-3 text-right font-medium">Statement</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${customer.id}/edit`} className="font-medium text-foreground hover:text-accent-700">
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.email ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{customer.opening_balance}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/customers/${customer.id}/statement`} className="text-accent-700 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((customer) => (
              <div key={customer.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/customers/${customer.id}/edit`} className="font-medium text-foreground hover:text-accent-700">
                      {customer.name}
                    </Link>
                    <p className="text-body-sm text-muted-foreground">{customer.phone ?? customer.email ?? "—"}</p>
                  </div>
                  <p className="text-body font-medium tabular-nums text-foreground">{customer.opening_balance}</p>
                </div>
                <Link href={`/customers/${customer.id}/statement`} className="text-body-sm font-medium text-accent-700 hover:underline">
                  View statement
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
