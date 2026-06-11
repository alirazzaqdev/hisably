import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Add customer</h1>
      <CustomerForm />
    </div>
  );
}
