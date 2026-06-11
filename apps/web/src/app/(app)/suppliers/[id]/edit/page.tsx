"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { suppliersApi } from "@/lib/api/suppliers";
import { SupplierForm } from "../../supplier-form";

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => suppliersApi.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Edit supplier</h1>
      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
      {supplier && <SupplierForm supplier={supplier} />}
    </div>
  );
}
