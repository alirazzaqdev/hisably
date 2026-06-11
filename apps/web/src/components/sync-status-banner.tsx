"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { offlineDb } from "@/lib/offline/db";
import { syncNow } from "@/lib/offline/sync-engine";

export function SyncStatusBanner() {
  const isOnline = useOnlineStatus();
  const pendingCount = useLiveQuery(() => offlineDb.outbox.count(), [], 0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isOnline) return;

    let cancelled = false;
    async function run() {
      setIsSyncing(true);
      try {
        await syncNow();
      } catch {
        // Will retry on the next reconnect or interval tick.
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    }

    run();
    const interval = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOnline, pendingCount]);

  if (isOnline && !pendingCount && !isSyncing) return null;

  return (
    <div
      className={
        "flex items-center gap-2 border-b px-6 py-2 text-body-sm md:px-10 " +
        (isOnline
          ? "border-info-500/20 bg-info-500/10 text-info-500"
          : "border-warning-50 bg-warning-50 text-warning-500")
      }
    >
      {isOnline ? (
        <RefreshCw className={"h-4 w-4" + (isSyncing ? " animate-spin" : "")} />
      ) : (
        <CloudOff className="h-4 w-4" />
      )}
      {!isOnline && pendingCount ? (
        <span>Offline — {pendingCount} change{pendingCount === 1 ? "" : "s"} pending sync</span>
      ) : !isOnline ? (
        <span>Offline — changes will sync once you&apos;re back online</span>
      ) : pendingCount ? (
        <span>Syncing {pendingCount} pending change{pendingCount === 1 ? "" : "s"}…</span>
      ) : (
        <span>Syncing…</span>
      )}
    </div>
  );
}
