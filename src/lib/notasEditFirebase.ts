import { FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const defaultNotasEditConfig = {
  apiKey: "AIzaSyDYyB8HzPdjdcKWFfWvfeIzU0ex-kydQSw",
  authDomain: "gen-lang-client-0639147596.firebaseapp.com",
  projectId: "gen-lang-client-0639147596",
  storageBucket: "gen-lang-client-0639147596.firebasestorage.app",
  messagingSenderId: "531763841138",
  appId: "1:531763841138:web:f67f731110344f6a6d5aeb",
};

const notasEditConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_NOTASEDIT_FIREBASE_API_KEY || defaultNotasEditConfig.apiKey,
  authDomain: import.meta.env.VITE_NOTASEDIT_FIREBASE_AUTH_DOMAIN || defaultNotasEditConfig.authDomain,
  projectId: import.meta.env.VITE_NOTASEDIT_FIREBASE_PROJECT_ID || defaultNotasEditConfig.projectId,
  storageBucket: import.meta.env.VITE_NOTASEDIT_FIREBASE_STORAGE_BUCKET || defaultNotasEditConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_NOTASEDIT_FIREBASE_MESSAGING_SENDER_ID || defaultNotasEditConfig.messagingSenderId,
  appId: import.meta.env.VITE_NOTASEDIT_FIREBASE_APP_ID || defaultNotasEditConfig.appId,
};

const notasEditDatabaseId =
  import.meta.env.VITE_NOTASEDIT_FIRESTORE_DATABASE_ID ||
  "ai-studio-9893c1ba-998d-4f52-9fd1-8ffcb63d5e58";

const appName = "notasedit";
export const notasEditApp = getApps().some((app) => app.name === appName)
  ? getApp(appName)
  : initializeApp(notasEditConfig, appName);

export const notasEditAuth = getAuth(notasEditApp);
export const notasEditDb = getFirestore(notasEditApp, notasEditDatabaseId);
