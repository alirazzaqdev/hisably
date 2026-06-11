import { ItemForm } from "../item-form";

export default function NewItemPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Add item</h1>
      <ItemForm />
    </div>
  );
}
