import { Student } from "../types";

export interface OfflineOperation {
  id: string;
  entityType: "student" | "config" | "templates";
  entityId: string;
  operationType: "CREATE" | "UPDATE" | "DELETE" | "SAVE_CONFIG" | "SAVE_TEMPLATES";
  payload: any;
  idempotencyKey: string;
  status: "pending" | "syncing" | "failed" | "conflict";
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  operationId?: string;
  status: "success" | "failed" | "info" | "conflict";
  message: string;
  createdAt: string;
}

export interface PendingAfaAudio {
  studentId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: string;
}

const DB_NAME = "afa_alunos_offline_db";
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Store for students (key path id)
      if (!db.objectStoreNames.contains("students")) {
        db.createObjectStore("students", { keyPath: "id" });
      }

      // Store for offline operations queue (key path id, with index on status & createdAt)
      if (!db.objectStoreNames.contains("offline_operations")) {
        const opStore = db.createObjectStore("offline_operations", { keyPath: "id" });
        opStore.createIndex("status", "status", { unique: false });
        opStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Store for sync logs
      if (!db.objectStoreNames.contains("sync_logs")) {
        const logStore = db.createObjectStore("sync_logs", { keyPath: "id" });
        logStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Store for seen virtual configurations
      if (!db.objectStoreNames.contains("app_config")) {
        db.createObjectStore("app_config", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("pending_afa_audio")) {
        db.createObjectStore("pending_afa_audio", { keyPath: "studentId" });
      }
    };
  });
}

export async function savePendingAfaAudio(audio: PendingAfaAudio): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_afa_audio", "readwrite");
    const request = tx.objectStore("pending_afa_audio").put(audio);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingAfaAudio(studentId: string): Promise<PendingAfaAudio | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_afa_audio", "readonly");
    const request = tx.objectStore("pending_afa_audio").get(studentId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingAfaAudio(studentId: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_afa_audio", "readwrite");
    const request = tx.objectStore("pending_afa_audio").delete(studentId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Student CRUD Operations
export async function saveStudentLocal(student: Student): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("students", "readwrite");
    const store = tx.objectStore("students");
    const request = store.put(student);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveStudentsLocalBatch(students: Student[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("students", "readwrite");
    const store = tx.objectStore("students");
    for (const student of students) {
      store.put(student);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStudentsLocal(): Promise<Student[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("students", "readonly");
    const store = tx.objectStore("students");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteStudentLocal(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("students", "readwrite");
    const store = tx.objectStore("students");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Queue Operations
export async function queueOfflineOperation(op: Omit<OfflineOperation, "id" | "idempotencyKey" | "retryCount" | "status" | "createdAt" | "updatedAt">): Promise<OfflineOperation> {
  const db = await getDb();
  const now = new Date().toISOString();
  const operation: OfflineOperation = {
    ...op,
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    status: "pending",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_operations", "readwrite");
    const store = tx.objectStore("offline_operations");
    const request = store.put(operation);
    request.onsuccess = () => resolve(operation);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingOperations(): Promise<OfflineOperation[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_operations", "readonly");
    const store = tx.objectStore("offline_operations");
    const index = store.index("createdAt");
    const request = index.openCursor();
    const results: OfflineOperation[] = [];

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateOfflineOperation(op: OfflineOperation): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_operations", "readwrite");
    const store = tx.objectStore("offline_operations");
    op.updatedAt = new Date().toISOString();
    const request = store.put(op);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineOperation(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_operations", "readwrite");
    const store = tx.objectStore("offline_operations");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllOfflineOperations(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_operations", "readwrite");
    const store = tx.objectStore("offline_operations");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Config Operations
export async function saveAppConfigLocal<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("app_config", "readwrite");
    const store = tx.objectStore("app_config");
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAppConfigLocal<T>(key: string): Promise<T | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("app_config", "readonly");
    const store = tx.objectStore("app_config");
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}

// Sync Logs
export async function addSyncLog(status: SyncLog["status"], message: string, operationId?: string): Promise<void> {
  const db = await getDb();
  const log: SyncLog = {
    id: crypto.randomUUID(),
    operationId,
    status,
    message,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_logs", "readwrite");
    const store = tx.objectStore("sync_logs");
    const request = store.put(log);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_logs", "readonly");
    const store = tx.objectStore("sync_logs");
    const index = store.index("createdAt");
    const request = index.openCursor(null, "prev"); // newest first
    const results: SyncLog[] = [];

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor && results.length < 50) { // Limit to 50 logs for performance
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
