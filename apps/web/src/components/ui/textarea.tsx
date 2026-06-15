import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, rows, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows ?? 3}
      className={cn(
        "flex w-full rounded-md border border-border bg-surface px-3 py-2 text-body-lg text-foreground placeholder:text-muted-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
