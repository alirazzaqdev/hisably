"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { itemCategoriesApi } from "@/lib/api/item-categories";
import { itemsApi, type Item, type ItemInput } from "@/lib/api/items";
import { createOrQueue } from "@/lib/offline/sync-engine";

const UNITS = ["pcs", "sqm", "sqft", "kg", "m", "box", "ltr"] as const;
const VAT_CATEGORIES = [
  { value: "standard", label: "Standard (5%)" },
  { value: "zero_rated", label: "Zero-rated" },
  { value: "exempt", label: "Exempt" },
] as const;

export function ItemForm({ item }: { item?: Item }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(item);

  const [form, setForm] = useState<ItemInput>({
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    unit: item?.unit ?? "pcs",
    sale_price: item?.sale_price ?? "0",
    purchase_price: item?.purchase_price ?? "0",
    vat_category: item?.vat_category ?? "standard",
    track_inventory: item?.track_inventory ?? false,
    category_id: item?.category_id ?? null,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => itemCategoriesApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing ? itemsApi.update(item!.id, form) : createOrQueue("item", form, itemsApi.create),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      router.push("/items");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => itemsApi.remove(item!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      router.push("/items");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  function update<K extends keyof ItemInput>(key: K, value: ItemInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit item" : "Add item"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update this item's details." : "Add a product or service you sell."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={form.sku ?? ""} onChange={(e) => update("sku", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Select id="unit" value={form.unit} onChange={(e) => update("unit", e.target.value as ItemInput["unit"])}>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale_price">Sale price</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                value={form.sale_price ?? "0"}
                onChange={(e) => update("sale_price", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase_price">Purchase price</Label>
              <Input
                id="purchase_price"
                type="number"
                step="0.01"
                value={form.purchase_price ?? "0"}
                onChange={(e) => update("purchase_price", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category_id">Category</Label>
            <Select
              id="category_id"
              value={form.category_id ?? ""}
              onChange={(e) => update("category_id", e.target.value || null)}
            >
              <option value="">No category</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vat_category">VAT category</Label>
            <Select
              id="vat_category"
              value={form.vat_category}
              onChange={(e) => update("vat_category", e.target.value as ItemInput["vat_category"])}
            >
              {VAT_CATEGORIES.map((vat) => (
                <option key={vat.value} value={vat.value}>
                  {vat.label}
                </option>
              ))}
            </Select>
          </div>

          <FormError>{formError}</FormError>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/items")}>
                Cancel
              </Button>
            </div>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
