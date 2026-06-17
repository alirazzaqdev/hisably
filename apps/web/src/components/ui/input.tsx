import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (type === "number") e.target.select();
    onFocus?.(e);
  };
  return (
    <input
      type={type}
      ref={ref}
      onFocus={handleFocus}
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-surface px-4 text-body-lg text-foreground placeholder:text-muted-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
