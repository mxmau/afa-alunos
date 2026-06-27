import { ImportedStudent, Student, StudentProfile } from "../types";

const emptyProfile: StudentProfile = {
  resumoRapido: "",
  personalidade: "",
  positivos: "",
  atencao: "",
  social: "",
  pedagogico: "",
  manter: "",
  melhorar: "",
  apoioFamilia: "",
};

export function createStudent(data: Partial<ImportedStudent> & { name: string }): Student {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    className: data.className?.trim() ?? "",
    registration: data.registration?.trim() ?? "",
    source: data.source?.trim() ?? "manual",
    tags: [],
    alertLevel: "tranquilo",
    profile: { ...emptyProfile },
    incidents: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touchStudent(student: Student): Student {
  return { ...student, updatedAt: new Date().toISOString() };
}

export function studentKey(student: Pick<Student, "name" | "className">): string {
  return `${student.name.trim().toLocaleLowerCase("pt-BR")}::${student.className
    .trim()
    .toLocaleLowerCase("pt-BR")}`;
}
