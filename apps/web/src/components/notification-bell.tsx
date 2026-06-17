"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationsApi, type NotificationItem } from "@/lib/api/notifications";

const TYPE_ICON: Record<string, string> = {
  quotation_expiring_soon: "🕐",
  quotation_expired: "❌",
  invoice_overdue: "⚠️",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = data?.unread_count ?? 0;
  const items = data?.items ?? [];

  function handleItemClick(n: NotificationItem) {
    if (!n.read_at) markReadMutation.mutate(n.id);
    setOpen(false);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg md:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-body-sm font-semibold text-foreground">
              Notifications {unread > 0 && <span className="ml-1 rounded-full bg-danger-100 px-1.5 py-0.5 text-caption font-bold text-danger-600">{unread} new</span>}
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllMutation.mutate()}
                  className="flex items-center gap-1 text-caption text-accent-700 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-body-sm text-muted-foreground">No notifications yet</p>
              </div>
            )}
            {items.map((n) => {
              const isUnread = !n.read_at;
              const icon = TYPE_ICON[n.type] ?? "•";
              const inner = (
                <div
                  className={cn(
                    "flex gap-3 border-b border-border px-4 py-3 transition-colors last:border-0",
                    isUnread ? "bg-accent-50/50" : "hover:bg-muted/40"
                  )}
                  onClick={() => handleItemClick(n)}
                >
                  <span className="mt-0.5 text-lg leading-none">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-body-sm", isUnread ? "font-semibold text-foreground" : "text-foreground")}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 truncate text-caption text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-caption text-muted-foreground/60">{timeAgo(n.created_at)}</p>
                  </div>
                  {isUnread && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-600" />
                  )}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="block cursor-pointer">
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="cursor-pointer">{inner}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
