import { Incident, Student } from "../types";

const profileFields: Array<keyof Student["profile"]> = [
  "resumoRapido",
  "personalidade",
  "positivos",
  "atencao",
  "social",
  "pedagogico",
  "manter",
  "melhorar",
  "apoioFamilia",
];

export function isStudentBackup(value: unknown): value is Student {
  if (!value || typeof value !== "object") return false;

  const student = value as Partial<Student>;
  const profile = student.profile as Partial<Student["profile"]> | undefined;
  return (
    typeof student.id === "string" &&
    typeof student.name === "string" &&
    typeof student.className === "string" &&
    typeof student.registration === "string" &&
    (student.campus === undefined || typeof student.campus === "string") &&
    (student.status === undefined || typeof student.status === "string") &&
    typeof student.source === "string" &&
    typeof student.createdAt === "string" &&
    typeof student.updatedAt === "string" &&
    Array.isArray(student.tags) &&
    student.tags.every((tag) => typeof tag === "string") &&
    Boolean(profile) &&
    profileFields.every((field) => typeof profile?.[field] === "string") &&
    Array.isArray(student.incidents) &&
    student.incidents.every(isIncidentBackup) &&
    ["tranquilo", "observacao", "atencao", "prioridade"].includes(student.alertLevel ?? "")
  );
}

export function isIncidentBackup(value: unknown): value is Incident {
  if (!value || typeof value !== "object") return false;

  const incident = value as Partial<Incident>;
  return (
    typeof incident.id === "string" &&
    typeof incident.date === "string" &&
    typeof incident.title === "string" &&
    typeof incident.notes === "string" &&
    ["positivo", "observacao", "familia", "pedagogico", "social"].includes(incident.type ?? "")
  );
}
