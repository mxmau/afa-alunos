import { Student } from "../types";

const STORAGE_KEY = "afa-alunos:v1";

export function readLocalStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Student[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalStudents(students: Student[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}
