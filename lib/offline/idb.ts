// Thin hand-rolled IndexedDB wrapper for Dory's offline study support (no deps —
// see docs/APP-STORE-PLAN.md, guideline 4.2 native value). Two stores:
//   `decks`  — cached study queues, keyed by deckId (lib/offline/deck-cache.ts)
//   `outbox` — reviews queued while offline; the auto-incrementing `seq` key
//              preserves insertion order for ordered replay (lib/offline/outbox.ts)
// Every function guards on IndexedDB availability so importing this module is
// safe anywhere (SSR, node scripts); only calling it requires a browser.

const DB_NAME = "dory-offline";
const DB_VERSION = 1;
export const DECKS_STORE = "decks";
export const OUTBOX_STORE = "outbox";
export const META_STORE = "meta"; // { key, ... } rows: cache owner, last refresh time

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DECKS_STORE)) {
          db.createObjectStore(DECKS_STORE, { keyPath: "deckId" });
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "seq", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Release the connection if a future version wants to upgrade.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null; // allow a retry (e.g. transient quota / private-mode errors)
        reject(req.error ?? new Error("IndexedDB open failed"));
      };
    });
  }
  return dbPromise;
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = op(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

export function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function idbGetAll<T>(store: string): Promise<T[]> {
  return run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export function idbPut(store: string, value: unknown): Promise<IDBValidKey> {
  return run<IDBValidKey>(store, "readwrite", (s) => s.put(value));
}

// add() with an autoIncrement keyPath returns the generated key (the outbox `seq`).
export function idbAdd(store: string, value: unknown): Promise<IDBValidKey> {
  return run<IDBValidKey>(store, "readwrite", (s) => s.add(value));
}

export function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.delete(key) as IDBRequest<undefined>).then(
    () => undefined,
  );
}

export function idbCount(store: string): Promise<number> {
  return run<number>(store, "readonly", (s) => s.count());
}

export function idbClear(store: string): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>).then(
    () => undefined,
  );
}
