"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { customersApi, type Customer, type CustomerInput } from "@/lib/api/customers";
import { priceListsApi } from "@/lib/api/price-lists";
import { createOrQueue } from "@/lib/offline/sync-engine";

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(customer);

  const [form, setForm] = useState<CustomerInput>({
    name: customer?.name ?? "",
    name_ar: customer?.name_ar ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    trn: customer?.trn ?? "",
    billing_address: customer?.billing_address ?? "",
    opening_balance: customer?.opening_balance ?? "0",
    price_list_id: customer?.price_list_id ?? null,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: priceLists } = useQuery({
    queryKey: ["price-lists"],
    queryFn: () => priceListsApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing
        ? customersApi.update(customer!.id, form)
        : createOrQueue("customer", form, customersApi.create),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push("/customers");
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
    mutationFn: () => customersApi.remove(customer!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push("/customers");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  function update<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit customer" : "Add customer"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update this customer's details." : "Add a new customer to bill."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name_ar">Name (Arabic)</Label>
              <Input
                id="name_ar"
                dir="rtl"
                value={form.name_ar ?? ""}
                onChange={(e) => update("name_ar", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trn">TRN</Label>
              <Input id="trn" value={form.trn ?? ""} onChange={(e) => update("trn", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opening_balance">Opening balance</Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                value={form.opening_balance ?? "0"}
                onChange={(e) => update("opening_balance", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billing_address">Billing address</Label>
            <Input
              id="billing_address"
              value={form.billing_address ?? ""}
              onChange={(e) => update("billing_address", e.target.value)}
            />
          </div>

          {priceLists && priceLists.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price_list_id">Price list</Label>
              <Select
                id="price_list_id"
                value={form.price_list_id ?? ""}
                onChange={(e) => update("price_list_id", e.target.value || null)}
              >
                <option value="">Default (sale price)</option>
                {priceLists.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <FormError>{formError}</FormError>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/customers")}>
                Cancel
              </Button>
            </div>
            {isEditing && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteMutation.isPending}>
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete customer?</DialogTitle>
                    <DialogDescription>
                      This will permanently remove {customer?.name}. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
