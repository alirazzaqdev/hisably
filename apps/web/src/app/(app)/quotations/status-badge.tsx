import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { QuotationStatus } from "@/lib/api/invoices";

const STATUS_VARIANTS: Record<QuotationStatus, BadgeProps["variant"]> = {
  draft: "neutral",
  pending: "info",
  approved: "success",
  rejected: "danger",
  expired: "warning",
};

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
