import { ExpenseForm } from "../expense-form";

export default function NewExpensePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Add expense</h1>
      <ExpenseForm />
    </div>
  );
}
