"use client";

import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "danger" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(options: { title: string; description?: string; variant?: ToastVariant }) {
  const id = crypto.randomUUID();
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, title: options.title, description: options.description, variant: options.variant ?? "info" }],
  }));
  setTimeout(() => useToastStore.getState().dismiss(id), 5000);
}

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; classes: string }> = {
  success: { icon: CheckCircle2, classes: "border-success-100 bg-success-50 text-success-700" },
  danger: { icon: AlertCircle, classes: "border-danger-100 bg-danger-50 text-danger-700" },
  info: { icon: Info, classes: "border-info-100 bg-info-50 text-info-700" },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((item) => {
        const { icon: Icon, classes } = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-md animate-in slide-in-from-bottom-4",
              classes
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-body font-medium">{item.title}</p>
              {item.description && <p className="text-body-sm opacity-90">{item.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
              className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
