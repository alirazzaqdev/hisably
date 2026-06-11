import { SupplierForm } from "../supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Add supplier</h1>
      <SupplierForm />
    </div>
  );
}
