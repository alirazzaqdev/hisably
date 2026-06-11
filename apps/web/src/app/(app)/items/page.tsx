"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { itemsApi } from "@/lib/api/items";

export default function ItemsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["items", search],
    queryFn: () => itemsApi.list({ search: search || undefined, pageSize: 50 }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Items</h1>
        <Button asChild>
          <Link href="/items/new">
            <Plus className="h-4 w-4" />
            Add item
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-body">
          <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 text-right font-medium">Sale price</th>
              <th className="px-4 py-3 font-medium">VAT</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                  No items yet.
                </td>
              </tr>
            )}
            {data?.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link href={`/items/${item.id}/edit`} className="font-medium text-foreground hover:text-accent-700">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.sku ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums">{item.sale_price}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.vat_category.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
