"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { PERMISSION_MODULES, usersApi, type StaffInput } from "@/lib/api/users";

function emptyPermissions(): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, false]));
}

export function TeamSection() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list() });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>(emptyPermissions());
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => usersApi.createStaff({ email, password, permissions } satisfies StaffInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEmail("");
      setPassword("");
      setPermissions(emptyPermissions());
      setFormError(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ id, perms }: { id: string; perms: Record<string, boolean> }) =>
      usersApi.updatePermissions(id, perms),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  const staff = users?.filter((u) => u.role === "staff") ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>Invite staff members and control which sections they can access.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {staff.length > 0 && (
          <div className="flex flex-col gap-4">
            {staff.map((member) => (
              <div key={member.id} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-body font-medium text-foreground">{member.email}</span>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeMutation.mutate(member.id)}
                    disabled={removeMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PERMISSION_MODULES.map((mod) => (
                    <label key={mod.key} className="flex items-center gap-2 text-body-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(member.permissions[mod.key])}
                        onChange={(e) =>
                          updatePermissionsMutation.mutate({
                            id: member.id,
                            perms: { ...member.permissions, [mod.key]: e.target.checked },
                          })
                        }
                      />
                      {mod.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="flex flex-col gap-4 border-t border-border pt-4" onSubmit={handleSubmit}>
          <p className="text-body-sm font-medium text-foreground">Invite staff member</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff_email">Email</Label>
              <Input
                id="staff_email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff_password">Temporary password</Label>
              <Input
                id="staff_password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PERMISSION_MODULES.map((mod) => (
              <label key={mod.key} className="flex items-center gap-2 text-body-sm text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(permissions[mod.key])}
                  onChange={(e) => setPermissions((prev) => ({ ...prev, [mod.key]: e.target.checked }))}
                />
                {mod.label}
              </label>
            ))}
          </div>
          <FormError>{formError}</FormError>
          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Inviting…" : "Invite staff member"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
