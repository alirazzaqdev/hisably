import Dexie, { type Table } from "dexie";

export type OutboxEntityType = "customer" | "item" | "expense";

export interface OutboxEntry {
  id?: number;
  entityType: OutboxEntityType;
  clientUuid: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface SyncMeta {
  key: string;
  value: string;
}

class HisablyDb extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<SyncMeta, string>;

  constructor() {
    super("hisably-offline");
    this.version(1).stores({
      outbox: "++id, entityType, clientUuid",
      meta: "key",
    });
  }
}

export const offlineDb = new HisablyDb();

export const LAST_SYNC_KEY = "lastSyncTime";

export async function getLastSyncTime(): Promise<string | null> {
  const row = await offlineDb.meta.get(LAST_SYNC_KEY);
  return row?.value ?? null;
}

export async function setLastSyncTime(value: string): Promise<void> {
  await offlineDb.meta.put({ key: LAST_SYNC_KEY, value });
}
