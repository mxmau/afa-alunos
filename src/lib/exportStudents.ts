import { AlertLevel, Student } from "../types";
import { getProfileCompletion } from "./profile";

const utf8Bom = "\uFEFF";

const alertLabels: Record<AlertLevel, string> = {
  tranquilo: "Tranquilo",
  observacao: "Observação",
  atencao: "Atenção",
  prioridade: "Prioridade",
};

export function buildStudentsJson(students: Student[]): string {
  return JSON.stringify(students, null, 2);
}

export function buildStudentsCsv(students: Student[]): string {
  const headers = ["nome", "turma", "unidade", "status", "nivel", "progresso_ficha", "tags", "resumo"];
  const rows = students.map((student) =>
    [
      student.name,
      student.className,
      student.campus,
      student.status,
      alertLabels[student.alertLevel],
      `${getProfileCompletion(student).percentage}%`,
      student.tags.join("; "),
      student.profile.resumoRapido,
    ]
      .map(csvCell)
      .join(","),
  );

  return `${utf8Bom}${[headers.join(","), ...rows].join("\n")}`;
}

export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
