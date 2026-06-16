"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { itemCategoriesApi } from "@/lib/api/item-categories";
import { itemsApi, type Item, type ItemInput } from "@/lib/api/items";
import { itemPricesApi, priceListsApi } from "@/lib/api/price-lists";
import { createOrQueue } from "@/lib/offline/sync-engine";

function generateEan13(): string {
  let digits = "";
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  const checksum = digits
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (checksum % 10)) % 10;
  return digits + checkDigit;
}

const UNITS = ["pcs", "sqm", "lm", "sqft", "kg", "m", "box", "ltr"] as const;
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
    barcode: item?.barcode ?? "",
    unit: item?.unit ?? "pcs",
    sale_price: item?.sale_price ?? "0",
    purchase_price: item?.purchase_price ?? "0",
    vat_category: item?.vat_category ?? "standard",
    track_inventory: item?.track_inventory ?? false,
    current_stock: item?.current_stock ?? "0",
    low_stock_threshold: item?.low_stock_threshold ?? "",
    category_id: item?.category_id ?? null,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => itemCategoriesApi.list(),
  });

  const { data: priceLists } = useQuery({
    queryKey: ["price-lists"],
    queryFn: () => priceListsApi.list(),
  });

  const { data: existingPrices } = useQuery({
    queryKey: ["item-prices", item?.id],
    queryFn: () => itemPricesApi.list(item!.id),
    enabled: isEditing,
  });

  const [priceListPrices, setPriceListPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!existingPrices) return;
    setPriceListPrices(Object.fromEntries(existingPrices.map((p) => [p.price_list_id, p.price])));
  }, [existingPrices]);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!form.barcode || !barcodeSvgRef.current) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (!barcodeSvgRef.current) return;
      try {
        JsBarcode(barcodeSvgRef.current, form.barcode!, { format: "EAN13", height: 50, displayValue: true });
      } catch {
        JsBarcode(barcodeSvgRef.current, form.barcode!, { format: "CODE128", height: 50, displayValue: true });
      }
    });
  }, [form.barcode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ItemInput = {
        ...form,
        current_stock: form.track_inventory ? form.current_stock || "0" : null,
        low_stock_threshold: form.track_inventory && form.low_stock_threshold ? form.low_stock_threshold : null,
      };
      const saved = isEditing
        ? await itemsApi.update(item!.id, payload)
        : await createOrQueue("item", payload, itemsApi.create);
      if (saved && priceLists?.length) {
        const entries = Object.entries(priceListPrices)
          .filter(([, price]) => price.trim() !== "")
          .map(([price_list_id, price]) => ({ price_list_id, price }));
        await itemPricesApi.set(saved.id, entries);
      }
      return saved;
    },
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
    <Card>
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
              <Label htmlFor="barcode">Barcode</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  value={form.barcode ?? ""}
                  onChange={(e) => update("barcode", e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => update("barcode", generateEan13())}>
                  Generate
                </Button>
              </div>
            </div>
          </div>

          {form.barcode && (
            <div className="flex flex-col items-start gap-1.5">
              <Label>Barcode preview</Label>
              <svg ref={barcodeSvgRef} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale_price">Sale price</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min="0"
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
                min="0"
                value={form.purchase_price ?? "0"}
                onChange={(e) => update("purchase_price", e.target.value)}
              />
            </div>
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

          <div className="flex flex-col gap-3 rounded-md border border-border p-4">
            <label className="flex items-center gap-2 text-body text-foreground">
              <Checkbox
                checked={form.track_inventory}
                onChange={(e) => update("track_inventory", e.target.checked)}
              />
              Track inventory for this item
            </label>

            {form.track_inventory && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="current_stock">Current stock</Label>
                  <Input
                    id="current_stock"
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.current_stock ?? "0"}
                    onChange={(e) => update("current_stock", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="low_stock_threshold">Low stock alert below</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="No alert"
                    value={form.low_stock_threshold ?? ""}
                    onChange={(e) => update("low_stock_threshold", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {priceLists && priceLists.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Price list prices</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {priceLists.map((priceList) => (
                  <div key={priceList.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={`price-${priceList.id}`} className="text-muted-foreground">
                      {priceList.name}
                    </Label>
                    <Input
                      id={`price-${priceList.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Use sale price"
                      value={priceListPrices[priceList.id] ?? ""}
                      onChange={(e) =>
                        setPriceListPrices((prev) => ({ ...prev, [priceList.id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
