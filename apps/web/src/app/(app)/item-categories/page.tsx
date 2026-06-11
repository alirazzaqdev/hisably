"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { itemCategoriesApi } from "@/lib/api/item-categories";

export default function ItemCategoriesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => itemCategoriesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => itemCategoriesApi.create({ name }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["item-categories"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemCategoriesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["item-categories"] }),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Item categories</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Glass, Aluminium, Hardware"
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
            {!isLoading && categories?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={2}>
                  No categories yet.
                </td>
              </tr>
            )}
            {categories?.map((category) => (
              <tr key={category.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(category.id)}
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
