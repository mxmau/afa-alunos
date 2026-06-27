import { Student } from "../types";

export function buildFamilyBriefing(student: Student): string {
  const sections = [
    ["Resumo", student.profile.resumoRapido],
    ["Personalidade", student.profile.personalidade],
    ["Aspectos positivos", student.profile.positivos],
    ["Pontos de atenção", student.profile.atencao],
    ["Convivência social", student.profile.social],
    ["Pedagógico", student.profile.pedagogico],
    ["Manter", student.profile.manter],
    ["Melhorar", student.profile.melhorar],
    ["Como a família pode apoiar", student.profile.apoioFamilia],
  ].filter(([, value]) => value.trim());

  const incidents = student.incidents
    .slice(0, 5)
    .map((incident) => `- ${formatDate(incident.date)}: ${incident.title}. ${incident.notes}`.trim());

  return [
    `${student.name}${student.className ? ` - ${student.className}` : ""}`,
    "",
    ...sections.flatMap(([title, value]) => [`${title}:`, value, ""]),
    incidents.length ? "Registros recentes:" : "",
    ...incidents,
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
}

export function formatDate(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}
