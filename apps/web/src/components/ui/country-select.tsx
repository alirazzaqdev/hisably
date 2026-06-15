"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES } from "@hisably/shared";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function CountrySelect({ value, onChange, id, className, disabled }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find((c) => c.code === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        className={className}
        disabled={disabled}
        value={open ? query : selected ? `${selected.name} (${selected.code})` : value}
        placeholder="Search country…"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        readOnly={disabled}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-body-sm text-muted-foreground">No countries found</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onChange(c.code);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-start text-body-sm transition-colors hover:bg-muted",
                c.code === value && "bg-accent-50 text-accent-700"
              )}
            >
              <span>{c.name}</span>
              <span className="text-muted-foreground">{c.code} · {c.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
