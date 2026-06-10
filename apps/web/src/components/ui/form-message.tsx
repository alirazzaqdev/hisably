import * as React from "react";
import { cn } from "@/lib/utils";

export function FormError({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={cn("text-body-sm text-danger-500", className)}>{children}</p>;
}

export function FormSuccess({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={cn("text-body-sm text-success-500", className)}>{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-body-sm text-danger-500">{children}</p>;
}
