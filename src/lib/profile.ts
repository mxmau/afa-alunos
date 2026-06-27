import { Student } from "../types";

export type ProfileFilter = "todos" | "com-ficha" | "sem-ficha" | "completa" | "incompleta";

export const profileCompletionFields: Array<{ field: keyof Student["profile"]; label: string }> = [
  { field: "resumoRapido", label: "Resumo rápido" },
  { field: "positivos", label: "Aspectos positivos" },
  { field: "atencao", label: "Pontos de atenção" },
  { field: "manter", label: "Precisa manter" },
  { field: "melhorar", label: "Precisa melhorar" },
  { field: "apoioFamilia", label: "Apoio da família" },
];

export function hasProfile(student: Student): boolean {
  return Object.values(student.profile).some(Boolean) || student.incidents.length > 0 || student.tags.length > 0;
}

export function getProfileCompletion(student: Student) {
  const missingLabels = profileCompletionFields
    .filter(({ field }) => !student.profile[field].trim())
    .map(({ label }) => label);
  const total = profileCompletionFields.length;
  const completed = total - missingLabels.length;

  return {
    completed,
    total,
    missingLabels,
    percentage: Math.round((completed / total) * 100),
    isComplete: completed === total,
  };
}
