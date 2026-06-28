import { describe, expect, it, vi, beforeEach } from "vitest";
import { triggerSync, getSyncEngineStatus } from "./syncEngine";
import { Student } from "../types";

// Mock the IndexedDB wrapper
vi.mock("./offlineDb", () => {
  let mockQueue: any[] = [];
  let mockLogs: any[] = [];
  const mockStudents: Record<string, Student> = {};
  
  return {
    getPendingOperations: vi.fn().mockImplementation(() => Promise.resolve(mockQueue)),
    updateOfflineOperation: vi.fn().mockImplementation((op) => {
      const idx = mockQueue.findIndex((o) => o.id === op.id);
      if (idx >= 0) mockQueue[idx] = op;
      return Promise.resolve();
    }),
    deleteOfflineOperation: vi.fn().mockImplementation((id) => {
      mockQueue = mockQueue.filter((o) => o.id !== id);
      return Promise.resolve();
    }),
    saveStudentLocal: vi.fn().mockImplementation((s) => {
      mockStudents[s.id] = s;
      return Promise.resolve();
    }),
    deleteStudentLocal: vi.fn().mockImplementation((id) => {
      delete mockStudents[id];
      return Promise.resolve();
    }),
    addSyncLog: vi.fn().mockImplementation((status, message) => {
      mockLogs.push({ status, message, createdAt: new Date().toISOString() });
      return Promise.resolve();
    }),
    getSyncLogs: vi.fn().mockImplementation(() => Promise.resolve(mockLogs)),
    __setMockQueue: (q: any[]) => { mockQueue = q; },
    __getMockQueue: () => mockQueue,
    __getMockStudents: () => mockStudents,
    __getMockLogs: () => mockLogs,
  };
});

// Mock Firestore
vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn().mockReturnValue({}),
    getDoc: vi.fn().mockImplementation(() =>
      Promise.resolve({
        exists: () => false,
      })
    ),
    setDoc: vi.fn().mockImplementation(() => Promise.resolve()),
    deleteDoc: vi.fn().mockImplementation(() => Promise.resolve()),
  };
});

// Mock Firebase config
vi.mock("./firebase", () => {
  return {
    db: {},
    auth: {},
  };
});

describe("Sync Engine and Offline Queue Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks online status correctly", () => {
    const status = getSyncEngineStatus();
    expect(status).toHaveProperty("isOnline");
    expect(status).toHaveProperty("isSyncing", false);
  });

  it("skips execution if user is undefined", async () => {
    await triggerSync(undefined);
    const status = getSyncEngineStatus();
    expect(status.isSyncing).toBe(false);
  });
});
