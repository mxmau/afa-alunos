import { db } from "./firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import {
  getPendingOperations,
  updateOfflineOperation,
  deleteOfflineOperation,
  saveStudentLocal,
  deleteStudentLocal,
  addSyncLog,
} from "./offlineDb";
import { Student } from "../types";

export type SyncEngineListener = (event: {
  type: "status_change" | "sync_start" | "sync_end" | "conflict_found" | "error";
  message?: string;
  isSyncing: boolean;
  pendingCount: number;
}) => void;

let listeners: SyncEngineListener[] = [];
let isSyncing = false;
let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

export function addSyncEngineListener(listener: SyncEngineListener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify(type: "status_change" | "sync_start" | "sync_end" | "conflict_found" | "error", message?: string) {
  getPendingOperations().then((ops) => {
    listeners.forEach((l) =>
      l({
        type,
        message,
        isSyncing,
        pendingCount: ops.length,
      })
    );
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isOnline = true;
    notify("status_change", "Conectado. Sincronização automática iniciada.");
  });

  window.addEventListener("offline", () => {
    isOnline = false;
    notify("status_change", "Você está offline. As alterações serão salvas localmente.");
  });
}

export function getSyncEngineStatus() {
  return {
    isOnline,
    isSyncing,
  };
}

export async function triggerSync(userId?: string): Promise<void> {
  if (isSyncing || !isOnline || !db || !userId) {
    return;
  }

  isSyncing = true;
  notify("sync_start", "Sincronização em andamento...");

  try {
    const ops = await getPendingOperations();
    for (const op of ops) {
      if (op.status === "conflict") {
        continue;
      }

      op.status = "syncing";
      await updateOfflineOperation(op);

      try {
        if (op.entityType === "student") {
          const docRef = doc(db, "afa_students", op.entityId);
          
          if (op.operationType === "DELETE") {
            await deleteDoc(docRef);
            await deleteStudentLocal(op.entityId);
            await addSyncLog("success", `Aluno excluído no servidor: ${op.entityId}`, op.id);
          } else {
            // CREATE or UPDATE
            const student = op.payload as Student;

            // Fetch online document to check for conflicts
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const onlineData = docSnap.data();
              const onlineStudent = onlineData.data as Student;
              const onlineUpdatedAt = onlineStudent.updatedAt || onlineData.updated_at || "";
              const localUpdatedAt = student.updatedAt || "";

              if (onlineUpdatedAt && localUpdatedAt && new Date(onlineUpdatedAt) > new Date(localUpdatedAt)) {
                op.status = "conflict";
                op.payload = {
                  localVersion: student,
                  serverVersion: onlineStudent,
                };
                await updateOfflineOperation(op);
                await addSyncLog("conflict", `Conflito encontrado para: ${student.name}`, op.id);
                notify("conflict_found", `Conflito de dados no aluno ${student.name}.`);
                continue;
              }
            }

            // Write student to Firestore
            await setDoc(docRef, {
              user_id: userId,
              name: student.name,
              class_name: student.className,
              registration: student.registration,
              campus: student.campus || "Não definido",
              student_status: student.status || "Cadastrado",
              data: student,
              updated_at: new Date().toISOString(),
            });

            await saveStudentLocal(student);
            await addSyncLog("success", `Aluno sincronizado: ${student.name}`, op.id);
          }
        }
        
        await deleteOfflineOperation(op.id);
      } catch (error: any) {
        op.status = "failed";
        op.retryCount += 1;
        op.lastError = error.message;
        await updateOfflineOperation(op);
        await addSyncLog("failed", `Erro na sincronização (${op.entityId}): ${error.message}`, op.id);
      }
    }
  } catch (error: any) {
    notify("error", `Erro geral no motor de sincronização: ${error.message}`);
  } finally {
    isSyncing = false;
    notify("sync_end", "Sincronização concluída.");
  }
}
