"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, digit: string) {
    const digits = value.padEnd(length, " ").split("");
    digits[index] = digit;
    onChange(digits.join("").replace(/ /g, "").slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setDigit(index, "");
      return;
    }
    if (digits.length > 1) {
      // Pasted content starting at this box
      const next = (value.slice(0, index) + digits).slice(0, length);
      onChange(next);
      const focusIndex = Math.min(next.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
      return;
    }
    setDigit(index, digits);
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          value={value[index] ?? ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          aria-label={`Digit ${index + 1}`}
          className={cn(
            "h-12 w-11 rounded-md border border-border bg-surface text-center text-h2 tabular-nums text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
      ))}
    </div>
  );
}
