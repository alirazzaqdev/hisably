"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { expensesApi } from "@/lib/api/expenses";
import { ExpenseForm } from "../../expense-form";

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: expense, isLoading } = useQuery({
    queryKey: ["expenses", id],
    queryFn: () => expensesApi.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Edit expense</h1>
      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
      {expense && <ExpenseForm expense={expense} />}
    </div>
  );
}
