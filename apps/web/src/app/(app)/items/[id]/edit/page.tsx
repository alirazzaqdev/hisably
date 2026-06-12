"use client";

import { useQuery } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { ItemForm } from "../../item-form";

export default function EditItemPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data: item, isLoading } = useQuery({
    queryKey: ["items", id],
    queryFn: () => itemsApi.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Edit item</h1>
      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
      {item && <ItemForm item={item} />}
    </div>
  );
}
