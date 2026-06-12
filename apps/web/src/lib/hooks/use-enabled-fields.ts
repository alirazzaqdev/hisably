import { useQuery } from "@tanstack/react-query";
import { FIELD_CATALOG, resolveEnabledFields, type FieldDefinition } from "@hisably/shared";
import { tenantsApi } from "@/lib/api/tenants";

/**
 * Resolves the current tenant's industry-profile field configuration:
 * which optional header/line fields are enabled, and their (possibly
 * tenant-renamed) labels. For a "general" tenant with no overrides, every
 * field resolves to disabled — identical to today's behavior.
 */
export function useEnabledFields() {
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });

  const enabled = tenant
    ? resolveEnabledFields(tenant.industry_profile, tenant.enabled_fields)
    : Object.fromEntries(FIELD_CATALOG.map((f) => [f.id, false]));

  function labelFor(fieldId: string): string {
    const override = tenant?.field_labels?.[fieldId];
    if (override) return override;
    return FIELD_CATALOG.find((f) => f.id === fieldId)?.labelEn ?? fieldId;
  }

  return { enabled, labelFor, catalog: FIELD_CATALOG as FieldDefinition[] };
}
