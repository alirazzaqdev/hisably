"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { itemCategoriesApi } from "@/lib/api/item-categories";
import { itemsApi, type Item } from "@/lib/api/items";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function isLowStock(item: Item): boolean {
  return (
    item.track_inventory &&
    item.current_stock !== null &&
    item.low_stock_threshold !== null &&
    Number(item.current_stock) <= Number(item.low_stock_threshold)
  );
}

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const { data: categories } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => itemCategoriesApi.list(),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["items", search, categoryId, page],
    queryFn: () =>
      itemsApi.list({ search: search || undefined, categoryId: categoryId || undefined, page, pageSize: PAGE_SIZE }),
  });

  const categoryNameById = new Map(categories?.map((category) => [category.id, category.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Items"
        description="Products and services you buy or sell."
        action={
          <>
            <Button asChild variant="secondary">
              <Link href="/item-categories">Manage categories</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/price-lists">Manage price lists</Link>
            </Button>
            <Button asChild>
              <Link href="/items/new">
                <Plus className="h-4 w-4" />
                Add item
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or SKU"
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        >
          <option value="">All categories</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}

      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">No items yet</p>
            <p className="text-body-sm text-muted-foreground">Add the products or services you buy or sell.</p>
          </div>
          <Button asChild>
            <Link href="/items/new">
              <Plus className="h-4 w-4" />
              Add item
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
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 text-right font-medium">Sale price</th>
                  <th className="px-4 py-3 font-medium">VAT</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const lowStock = isLowStock(item);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/items/${item.id}/edit`}
                          className="font-medium text-foreground hover:text-accent-700"
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.sku ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.category_id ? categoryNameById.get(item.category_id) ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.sale_price}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.vat_category.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.track_inventory ? (
                          <span
                            className={cn("inline-flex items-center gap-1", lowStock && "font-medium text-danger-500")}
                          >
                            {lowStock && <AlertTriangle className="h-3.5 w-3.5" />}
                            {item.current_stock ?? "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((item) => {
              const lowStock = isLowStock(item);
              return (
                <Link
                  key={item.id}
                  href={`/items/${item.id}/edit`}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-body-sm text-muted-foreground">
                        {item.sku ?? "No SKU"} · {item.category_id ? categoryNameById.get(item.category_id) ?? "—" : "Uncategorized"}
                      </p>
                    </div>
                    <p className="text-body font-medium tabular-nums text-foreground">{item.sale_price}</p>
                  </div>
                  <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                    <span>
                      {item.unit} · {item.vat_category.replace("_", " ")}
                    </span>
                    {item.track_inventory && (
                      <span className={cn("inline-flex items-center gap-1 tabular-nums", lowStock && "font-medium text-danger-500")}>
                        {lowStock && <AlertTriangle className="h-3.5 w-3.5" />}
                        Stock: {item.current_stock ?? "—"}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
