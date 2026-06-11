import { AccountForm } from "../account-form";

export default function NewAccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Add account</h1>
      <AccountForm />
    </div>
  );
}
