"use client";

import { useQuery } from "@tanstack/react-query";
import { accountsApi } from "@/lib/api/accounts";
import { AccountForm } from "../../account-form";

export default function EditAccountPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data: account, isLoading } = useQuery({
    queryKey: ["accounts", id],
    queryFn: () => accountsApi.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Edit account</h1>
      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
      {account && <AccountForm account={account} />}
    </div>
  );
}
