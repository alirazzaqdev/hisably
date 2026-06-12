"use client";

import { useQuery } from "@tanstack/react-query";
import { customersApi } from "@/lib/api/customers";
import { CustomerForm } from "../../customer-form";

export default function EditCustomerPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => customersApi.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Edit customer</h1>
      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
      {customer && <CustomerForm customer={customer} />}
    </div>
  );
}
