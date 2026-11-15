/**
 * The ship's log Outbox: entries and photos are saved on the device first
 * (IndexedDB) and sent when there is a connection. Each device has its own.
 */
import {
  ApiError,
  isOffline,
  sendEntry,
  sendPosition,
  uploadPhoto,
  type DevicePosition,
} from "@/lib/voyageApi";

export type OutboxStatus = "waiting" | "sent" | "failed";

export interface OutboxItem {
  /** Also the entry's id on the server, so sending twice never duplicates it. */
  id: string;
  kind: "entry" | "position";
  /** ISO time the entry was written. */
  createdAt: string;
  title: string;
  body: string;
  position: DevicePosition | null;
  photoIds: string[];
  status: OutboxStatus;
  error?: string;
  sentAt?: string;
}

interface StoredPhoto {
  id: string;
  itemId: string;
  buffer: ArrayBuffer;
  type: string;
  uploaded: boolean;
}

export interface NewPhoto {
  id: string;
  blob: Blob;
}

/**
 * - done: nothing is left waiting that could have gone
 * - problems: the server answered but could not take some items yet; they stay waiting
 * - offline: no answer from the server
 * - revoked / frozen: the server refused this link, or the log is paused
 * - busy: another send is already running (here or in another tab)
 */
export type SyncResult = "done" | "problems" | "busy" | "offline" | "revoked" | "frozen";

const DB_NAME = "voyage-log";
const ITEMS = "items";
const PHOTOS = "photos";
const KEEP_SENT = 30;
const STUCK_AFTER_MS = 10 * 60_000;

export const newId = (): string => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

// ---------------------------------------------------------------- storage

let dbPromise: Promise<IDBDatabase | null> | null = null;
let openedOnce = false;
/**
 * True when the browser refused IndexedDB from the start (some private windows).
 * Entries then live only until the page closes, and the page says so.
 */
let memoryOnly = false;
const memory = { items: new Map<string, OutboxItem>(), photos: new Map<string, StoredPhoto>() };

const openDb = (): Promise<IDBDatabase | null> => {
  if (memoryOnly) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const fail = () => {
        dbPromise = null;
        if (openedOnce) {
          // It worked before, so entries are in there: never switch to memory now.
          reject(new Error("This device's storage is not answering"));
        } else {
          memoryOnly = true;
          resolve(null);
        }
      };

      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore(ITEMS, { keyPath: "id" });
          db.createObjectStore(PHOTOS, { keyPath: "id" }).createIndex("itemId", "itemId");
        };
        request.onsuccess = () => {
          const db = request.result;
          openedOnce = true;
          // Phones can drop the connection while the page sleeps: open a new one next time.
          const forget = () => {
            dbPromise = null;
          };
          db.onclose = forget;
          db.onversionchange = () => {
            db.close();
            forget();
          };
          resolve(db);
        };
        request.onerror = fail;
        request.onblocked = fail;
      } catch {
        fail();
      }
    });
  }
  return dbPromise;
};

/** False when entries can only be kept until the page is closed. */
export const storageIsDurable = async () => (await openDb()) !== null;

const done = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Run `work` on the database, reopening it once if the handle has gone stale. */
const withDb = async <T>(work: (db: IDBDatabase) => Promise<T>, inMemory: () => T): Promise<T> => {
  let db = await openDb();
  if (!db) {
    return inMemory();
  }
  try {
    return await work(db);
  } catch (error) {
    const name = (error as DOMException | null)?.name;
    if (name !== "InvalidStateError" && name !== "UnknownError") {
      throw error;
    }
    dbPromise = null;
    db = await openDb();
    if (!db) {
      throw error;
    }
    return work(db);
  }
};

export const listItems = async (): Promise<OutboxItem[]> => {
  const items = await withDb(
    (db) => result(db.transaction(ITEMS).objectStore(ITEMS).getAll() as IDBRequest<OutboxItem[]>),
    () => [...memory.items.values()]
  );
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const getItem = (id: string): Promise<OutboxItem | undefined> =>
  withDb(
    (db) =>
      result(db.transaction(ITEMS).objectStore(ITEMS).get(id) as IDBRequest<OutboxItem | undefined>),
    () => memory.items.get(id)
  );

export const addItem = async (item: OutboxItem, photos: NewPhoto[]): Promise<void> => {
  const stored: StoredPhoto[] = await Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      itemId: item.id,
      buffer: await photo.blob.arrayBuffer(),
      type: photo.blob.type || "image/jpeg",
      uploaded: false,
    }))
  );

  await withDb(
    (db) => {
      const transaction = db.transaction([ITEMS, PHOTOS], "readwrite");
      transaction.objectStore(ITEMS).put(item);
      stored.forEach((photo) => transaction.objectStore(PHOTOS).put(photo));
      return done(transaction);
    },
    () => {
      memory.items.set(item.id, item);
      stored.forEach((photo) => memory.photos.set(photo.id, photo));
    }
  );
};

const putItem = (item: OutboxItem) =>
  withDb(
    (db) => {
      const transaction = db.transaction(ITEMS, "readwrite");
      transaction.objectStore(ITEMS).put(item);
      return done(transaction);
    },
    () => {
      memory.items.set(item.id, item);
    }
  );

const photosOf = (itemId: string): Promise<StoredPhoto[]> =>
  withDb(
    (db) =>
      result(
        db.transaction(PHOTOS).objectStore(PHOTOS).index("itemId").getAll(itemId) as IDBRequest<
          StoredPhoto[]
        >
      ),
    () => [...memory.photos.values()].filter((photo) => photo.itemId === itemId)
  );

/** Save a photo record; `replacing` removes the record it takes the place of. */
const putPhoto = (photo: StoredPhoto, replacing?: string) =>
  withDb(
    (db) => {
      const transaction = db.transaction(PHOTOS, "readwrite");
      if (replacing) {
        transaction.objectStore(PHOTOS).delete(replacing);
      }
      transaction.objectStore(PHOTOS).put(photo);
      return done(transaction);
    },
    () => {
      if (replacing) {
        memory.photos.delete(replacing);
      }
      memory.photos.set(photo.id, photo);
    }
  );

const deletePhotosOf = async (itemId: string) => {
  const photos = await photosOf(itemId);
  await withDb(
    (db) => {
      const transaction = db.transaction(PHOTOS, "readwrite");
      photos.forEach((photo) => transaction.objectStore(PHOTOS).delete(photo.id));
      return done(transaction);
    },
    () => {
      photos.forEach((photo) => memory.photos.delete(photo.id));
    }
  );
};

/** Throw away an entry that has not been sent, with its photos. */
export const removeItem = async (id: string): Promise<void> => {
  await deletePhotosOf(id);
  await withDb(
    (db) => {
      const transaction = db.transaction(ITEMS, "readwrite");
      transaction.objectStore(ITEMS).delete(id);
      return done(transaction);
    },
    () => {
      memory.items.delete(id);
    }
  );
};

const pruneSent = async () => {
  const sent = (await listItems()).filter((item) => item.status === "sent");
  for (const item of sent.slice(0, Math.max(0, sent.length - KEEP_SENT))) {
    await removeItem(item.id);
  }
};

// ---------------------------------------------------------------- sending

let runningSince = 0;

/** Answers that will not change by trying again later. */
const isRejected = (error: unknown): error is ApiError =>
  error instanceof ApiError && [400, 409, 413, 415, 422].includes(error.status);

const toBlob = (photo: StoredPhoto) => new Blob([photo.buffer], { type: photo.type });

/** Upload the photos of an entry that have not gone yet. Throws when it should be retried later. */
const uploadPhotos = async (key: string, item: OutboxItem, onChange: (id: string) => void) => {
  for (const stored of await photosOf(item.id)) {
    if (stored.uploaded) {
      continue;
    }
    let photo = stored;
    try {
      try {
        await uploadPhoto(key, photo.id, toBlob(photo));
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) {
          throw error;
        }
        // That id belongs to an upload made with an earlier link: send it under a new one.
        const renamed = { ...photo, id: newId() };
        await putPhoto(renamed, photo.id);
        item.photoIds = item.photoIds.map((id) => (id === photo.id ? renamed.id : id));
        await putItem(item);
        photo = renamed;
        await uploadPhoto(key, photo.id, toBlob(photo));
      }
      await putPhoto({ ...photo, uploaded: true });
    } catch (error) {
      if (!isRejected(error)) {
        throw error;
      }
      // One unreadable photo should not hold back the words.
      item.photoIds = item.photoIds.filter((id) => id !== photo.id);
      item.error = "One photo could not be sent";
      await putItem(item);
    }
    onChange(item.id);
  }
};

const sendAll = async (
  key: string,
  onChange: (sendingId: string | null) => void
): Promise<SyncResult> => {
  const waiting = (await listItems()).filter((item) => item.status === "waiting");
  let problems = false;

  for (const listed of waiting) {
    // The list is a moment old: this one may have been thrown away, or sent by another tab.
    const item = await getItem(listed.id);
    if (!item || item.status !== "waiting") {
      continue;
    }
    onChange(item.id);

    try {
      if (item.kind === "position") {
        const answer = item.position
          ? await sendPosition(key, item.position, item.createdAt)
          : null;
        if (answer && !answer.stored) {
          item.status = "failed";
          item.error = `Not accepted: ${answer.reason}`;
          await putItem(item);
          continue;
        }
      } else {
        await uploadPhotos(key, item, onChange);
        await sendEntry(key, {
          id: item.id,
          written_at: item.createdAt,
          title: item.title,
          body: item.body,
          position: item.position,
          photo_ids: item.photoIds,
        });
      }

      item.status = "sent";
      item.sentAt = new Date().toISOString();
      if (item.error !== "One photo could not be sent") {
        delete item.error;
      }
      await putItem(item);
      await deletePhotosOf(item.id);
    } catch (error) {
      if (isOffline(error)) {
        return "offline";
      }
      const { status, message, body } = error as ApiError;
      if (status === 401 || status === 403) {
        return "revoked";
      }
      if (status === 423) {
        return "frozen";
      }

      const missing = (body as { missing_photos?: unknown } | null)?.missing_photos;
      if (status === 409 && Array.isArray(missing)) {
        // The server does not have some photos after all: upload those again next time.
        for (const photo of await photosOf(item.id)) {
          if (missing.includes(photo.id)) {
            await putPhoto({ ...photo, uploaded: false });
          }
        }
        problems = true;
        continue;
      }

      if (isRejected(error)) {
        item.status = "failed";
        item.error = message;
      } else {
        // The server answered but could not take this one yet. Leave it waiting
        // and carry on, so one stubborn entry never holds back the others.
        item.error = `Server: ${message}. It will be tried again.`;
        problems = true;
      }
      await putItem(item);
    }
  }

  await pruneSent();
  return problems ? "problems" : "done";
};

/**
 * Send everything that is waiting, oldest first. Stops at the first sign of
 * no connection and leaves the rest for the next attempt.
 *
 * `onChange(sendingId)` is called whenever something worth redrawing happens.
 */
export const syncOutbox = async (
  key: string,
  onChange: (sendingId: string | null) => void
): Promise<SyncResult> => {
  if (runningSince && Date.now() - runningSince < STUCK_AFTER_MS) {
    return "busy";
  }
  runningSince = Date.now();

  try {
    // With two tabs open, only one of them sends: photos are not uploaded twice.
    if (navigator.locks?.request) {
      return await navigator.locks.request(
        "voyage-log-sync",
        { ifAvailable: true },
        (lock): Promise<SyncResult> => (lock ? sendAll(key, onChange) : Promise.resolve("busy"))
      );
    }
    return await sendAll(key, onChange);
  } finally {
    runningSince = 0;
    onChange(null);
  }
};
