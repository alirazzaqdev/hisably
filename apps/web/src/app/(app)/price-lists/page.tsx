"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { priceListsApi } from "@/lib/api/price-lists";

export default function PriceListsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { data: priceLists, isLoading } = useQuery({
    queryKey: ["price-lists"],
    queryFn: () => priceListsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => priceListsApi.create({ name }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => priceListsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-lists"] }),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Price lists</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Add price list</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wholesale, Retail"
            />
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-body">
          <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={2}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && priceLists?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={2}>
                  No price lists yet.
                </td>
              </tr>
            )}
            {priceLists?.map((priceList) => (
              <tr key={priceList.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 font-medium text-foreground">{priceList.name}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(priceList.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
