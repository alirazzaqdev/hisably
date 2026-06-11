"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Country } from "@hisably/shared";
import { Plus } from "lucide-react";
import { firmsApi } from "@/lib/api/firms";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const COUNTRIES: { value: Country; label: string }[] = [
  { value: "AE", label: "UAE" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "PK", label: "Pakistan" },
];

export function FirmSwitcher() {
  const queryClient = useQueryClient();
  const { setSession } = useAuthStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState<Country>("AE");
  const [submitting, setSubmitting] = useState(false);

  const { data: firms } = useQuery({ queryKey: ["firms"], queryFn: firmsApi.list });

  async function handleSwitch(firmId: string) {
    if (!firmId) return;
    const tokens = await firmsApi.switch(firmId);
    setSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    await queryClient.invalidateQueries();
  }

  async function handleAddFirm(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const firm = await firmsApi.create({ business_name: newName.trim(), country: newCountry });
      await queryClient.invalidateQueries({ queryKey: ["firms"] });
      setNewName("");
      setShowAddForm(false);
      await handleSwitch(firm.id);
    } finally {
      setSubmitting(false);
    }
  }

  if (!firms) return null;

  return (
    <div className="px-3 pb-3">
      <Select
        value={firms.find((f) => f.is_active)?.id ?? ""}
        onChange={(e) => handleSwitch(e.target.value)}
        className="text-body-sm"
      >
        {firms.map((firm) => (
          <option key={firm.id} value={firm.id}>
            {firm.business_name}
          </option>
        ))}
      </Select>

      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-body-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another firm
        </button>
      ) : (
        <form onSubmit={handleAddFirm} className="mt-2 flex flex-col gap-2">
          <Input
            placeholder="Business name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-body-sm"
            autoFocus
          />
          <Select value={newCountry} onChange={(e) => setNewCountry(e.target.value as Country)} className="text-body-sm">
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="flex-1">
              Create
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
