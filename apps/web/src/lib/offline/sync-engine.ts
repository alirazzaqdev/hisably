import { syncApi, type SyncEntityType, type SyncMutation } from "@/lib/api/sync";
import { getLastSyncTime, offlineDb, setLastSyncTime, type OutboxEntityType } from "@/lib/offline/db";

/**
 * Attempts to create an entity online; if the device is offline (or the
 * request fails with a network error), the mutation is queued for later sync.
 */
export async function createOrQueue<T, D extends object>(
  entityType: OutboxEntityType,
  data: D,
  createFn: (payload: D) => Promise<T>
): Promise<T | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await queueMutation(entityType, data as Record<string, unknown>);
    return null;
  }

  try {
    return await createFn(data);
  } catch (error) {
    if (error instanceof TypeError) {
      await queueMutation(entityType, data as Record<string, unknown>);
      return null;
    }
    throw error;
  }
}

export async function queueMutation(entityType: OutboxEntityType, data: Record<string, unknown>): Promise<string> {
  const clientUuid = crypto.randomUUID();
  await offlineDb.outbox.add({
    entityType,
    clientUuid,
    data,
    createdAt: new Date().toISOString(),
  });
  return clientUuid;
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.outbox.count();
}

/** Pushes all queued offline mutations to the server. Safe to call repeatedly — applied entries are removed. */
export async function flushOutbox(): Promise<{ flushed: number; failed: number }> {
  const entries = await offlineDb.outbox.toArray();
  if (entries.length === 0) return { flushed: 0, failed: 0 };

  const mutations: SyncMutation[] = entries.map((entry) => ({
    entity_type: entry.entityType as SyncEntityType,
    client_uuid: entry.clientUuid,
    data: entry.data,
  }));

  const response = await syncApi.push(mutations);

  let flushed = 0;
  let failed = 0;
  for (const result of response.results) {
    const entry = entries.find((e) => e.clientUuid === result.client_uuid);
    if (!entry?.id) continue;
    if (result.status === "applied" || result.status === "duplicate") {
      await offlineDb.outbox.delete(entry.id);
      flushed += 1;
    } else {
      failed += 1;
    }
  }

  return { flushed, failed };
}

/** Pulls server-side changes since the last sync and updates the local cursor. */
export async function pullUpdates() {
  const since = await getLastSyncTime();
  const response = await syncApi.pull(since);
  await setLastSyncTime(response.server_time);
  return response;
}

/** Flushes pending offline mutations then pulls the latest server state. */
export async function syncNow() {
  const flushResult = await flushOutbox();
  const pullResult = await pullUpdates();
  return { ...flushResult, pulled: pullResult };
}
