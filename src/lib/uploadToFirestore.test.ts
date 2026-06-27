import { describe, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, writeBatch } from "firebase/firestore";

describe("Script: Upload Students to Firestore", () => {
  it("uploads all students from students-import.json to Firestore", async () => {

    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error(
        "Credenciais do Firebase ausentes no arquivo .env! Verifique se VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID estão configurados."
      );
    }

    console.log("Inicializando conexão com Firebase do projeto:", firebaseConfig.projectId);
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const filePath = path.resolve("students-import.json");
    if (!fs.existsSync(filePath)) {
      throw new Error("Arquivo students-import.json não encontrado na raiz do projeto!");
    }

    const students = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`Lidos ${students.length} alunos do arquivo de importação.`);

    const batchSize = 100;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = students.slice(i, i + batchSize);

      for (const student of chunk) {
        const docRef = doc(db, "afa_students", student.id);
        batch.set(docRef, {
          user_id: "mxmau96_imported", // ID padrão para controle dos registros importados inicialmente
          name: student.name,
          class_name: student.className,
          registration: student.registration,
          campus: student.campus || "Não definido",
          student_status: student.status || "Cadastrado",
          data: student,
          updated_at: new Date().toISOString(),
        });
      }

      console.log(`Enviando lote ${Math.floor(i / batchSize) + 1} (${chunk.length} alunos)...`);
      await batch.commit();
    }

    console.log("Todos os 316 alunos foram enviados com sucesso para o Firestore!");
  });
});
