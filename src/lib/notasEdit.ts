import { NotasEditPeriod, NotasEditStudentGrades, Student, VirtualCheckEntry } from "../types";

export type NotasEditExportRow = {
  studentId: string;
  name: string;
  className: string;
  registration: string;
  campus: string;
  period: NotasEditPeriod;
  behaviorScore: number;
  vistosScore: number;
  completedVistos: number;
  expectedVistos: number;
  positiveIncidents: number;
  attentionIncidents: number;
  behaviorSummary: string;
};

export type NotasEditImportRecord = {
  name?: string;
  className?: string;
  registration?: string;
  behaviorScore: number;
  vistosScore: number;
  period?: NotasEditPeriod;
};

export type NotasEditClassInfo = {
  id: string;
  name: string;
  location: string;
};

export type NotasEditStudentInfo = {
  id: string;
  name?: string;
};

const positiveBehaviorWords = [
  "particip",
  "colabor",
  "respeit",
  "organiz",
  "atent",
  "respons",
  "dedic",
  "tranquil",
  "melhor",
  "evolu",
  "comprom",
  "pontual",
];

const attentionBehaviorWords = [
  "conflit",
  "agress",
  "desrespeit",
  "desorganiz",
  "dispers",
  "oscil",
  "pend",
  "dificuldade",
  "interromp",
  "conversa",
  "limite",
  "atras",
  "nao faz",
];

export function getPeriodLabel(period: NotasEditPeriod): string {
  if (period === "mes") return "mes atual";
  if (period === "bimestre") return "ultimos 60 dias";
  if (period === "semestre") return "semestre atual";
  return "historico completo";
}

export function filterVistosByPeriod(
  vistos: VirtualCheckEntry[],
  period: NotasEditPeriod,
  now = new Date(),
): VirtualCheckEntry[] {
  const start = getPeriodStart(period, now);
  if (!start) return vistos;
  return vistos.filter((visto) => parseDateOnly(visto.date) >= start);
}

export function calculateNotasEditVistosGrade(completedVistos: number, expectedVistos: number) {
  if (completedVistos <= 0) return 0;
  if (expectedVistos <= 0) return roundOne(Math.min(2, 0.5 + (completedVistos - 1) * 0.3));
  if (completedVistos >= expectedVistos) return 3;
  if (expectedVistos <= 2) return 0.5;

  const preAllMax = Math.max(1, expectedVistos - 1);
  const progressBeforeAll = (completedVistos - 1) / Math.max(1, preAllMax - 1);
  return roundOne(clamp(0.5 + progressBeforeAll * 1.5, 0.5, 2));
}

export function calculateNotasEditBehaviorGrade(
  student: Student,
  period: NotasEditPeriod,
  now = new Date(),
) {
  const baseByAlert = {
    tranquilo: 1.8,
    observacao: 1.5,
    atencao: 1.1,
    prioridade: 0.7,
  } as const;

  const start = getPeriodStart(period, now);
  const incidents = start
    ? student.incidents.filter((incident) => parseDateOnly(incident.date) >= start)
    : student.incidents;

  const positiveIncidents = incidents.filter((incident) => incident.type === "positivo").length;
  const attentionIncidents = incidents.filter((incident) => incident.type !== "positivo").length;

  const positiveText = normalizeText(
    [
      student.profile.resumoRapido,
      student.profile.personalidade,
      student.profile.positivos,
      student.profile.manter,
      student.tags.join(" "),
    ].join(" "),
  );
  const attentionText = normalizeText(
    [
      student.profile.atencao,
      student.profile.social,
      student.profile.pedagogico,
      student.profile.melhorar,
      student.profile.apoioFamilia,
      incidents.map((incident) => `${incident.title} ${incident.notes}`).join(" "),
    ].join(" "),
  );

  const positiveSignals = countMatches(positiveText, positiveBehaviorWords);
  const attentionSignals = countMatches(attentionText, attentionBehaviorWords);

  const raw =
    baseByAlert[student.alertLevel] +
    Math.min(0.3, positiveIncidents * 0.12) -
    Math.min(0.6, attentionIncidents * 0.12) +
    Math.min(0.25, positiveSignals * 0.05) -
    Math.min(0.45, attentionSignals * 0.05);

  const behaviorScore = roundOne(clamp(raw, 0, 2));
  const behaviorSummary = [
    `${positiveIncidents} registro(s) positivo(s)`,
    `${attentionIncidents} registro(s) de atencao`,
    `${positiveSignals} sinal(is) positivo(s) na ficha`,
    `${attentionSignals} sinal(is) de cuidado na ficha`,
  ].join("; ");

  return {
    behaviorScore,
    positiveIncidents,
    attentionIncidents,
    behaviorSummary,
  };
}

export function buildNotasEditRows(
  students: Student[],
  options: { period: NotasEditPeriod; classFilter?: string; now?: Date },
): NotasEditExportRow[] {
  const now = options.now ?? new Date();
  const classFilter = options.classFilter ?? "todas";
  const filteredStudents = students.filter((student) => classFilter === "todas" || student.className === classFilter);

  return filteredStudents
    .map((student) => {
      const periodVistos = filterVistosByPeriod(student.vistos ?? [], options.period, now);
      const completedVistos = periodVistos.filter((visto) => visto.value > 0).length;
      const expectedVistos = countExpectedVistosForStudent(students, student, options.period, now);
      const behavior = calculateNotasEditBehaviorGrade(student, options.period, now);

      return {
        studentId: student.id,
        name: student.name,
        className: student.className,
        registration: student.registration,
        campus: student.campus,
        period: options.period,
        behaviorScore: behavior.behaviorScore,
        vistosScore: calculateNotasEditVistosGrade(completedVistos, expectedVistos),
        completedVistos,
        expectedVistos,
        positiveIncidents: behavior.positiveIncidents,
        attentionIncidents: behavior.attentionIncidents,
        behaviorSummary: behavior.behaviorSummary,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function buildNotasEditCsv(rows: NotasEditExportRow[]): string {
  const headers = [
    "nome",
    "turma",
    "matricula",
    "unidade",
    "periodo",
    "nota_comportamento",
    "nota_vistos",
    "vistos_feitos",
    "vistos_esperados",
    "resumo_comportamento",
  ];

  const lines = rows.map((row) =>
    [
      row.name,
      row.className,
      row.registration,
      row.campus,
      row.period,
      formatDecimal(row.behaviorScore),
      formatDecimal(row.vistosScore),
      row.completedVistos,
      row.expectedVistos,
      row.behaviorSummary,
    ]
      .map(csvCell)
      .join(";"),
  );

  return `\uFEFF${[headers.join(";"), ...lines].join("\n")}`;
}

export function buildNotasEditJson(rows: NotasEditExportRow[]) {
  return JSON.stringify(
    {
      app: "AFA Panorama Escolar",
      target: "NotasEdit",
      version: 1,
      generatedAt: new Date().toISOString(),
      grades: rows,
    },
    null,
    2,
  );
}

export function parseNotasEditImport(content: string): NotasEditImportRecord[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : parsed.grades;
    if (!Array.isArray(rows)) return [];
    return rows.map(normalizeImportRecord).filter(Boolean) as NotasEditImportRecord[];
  }

  return parseCsv(trimmed).map(normalizeImportRecord).filter(Boolean) as NotasEditImportRecord[];
}

export function createNotasEditSnapshot(
  row: Pick<NotasEditExportRow, "behaviorScore" | "vistosScore" | "period" | "completedVistos" | "expectedVistos">,
  source: NotasEditStudentGrades["source"],
): NotasEditStudentGrades {
  return {
    behaviorScore: row.behaviorScore,
    vistosScore: row.vistosScore,
    period: row.period,
    completedVistos: row.completedVistos,
    expectedVistos: row.expectedVistos,
    syncedAt: new Date().toISOString(),
    source,
  };
}

export function findNotasEditTargetClass(row: Pick<NotasEditExportRow, "className" | "campus">, classes: NotasEditClassInfo[]) {
  const rowLocation = normalizeText(row.campus);
  const rowClassKey = normalizeClassName(row.className);
  const rowClassText = normalizeText(row.className);

  return classes.find((classInfo) => {
    const sameLocation = !rowLocation || normalizeText(classInfo.location) === rowLocation;
    const sameClass =
      normalizeClassName(classInfo.name) === rowClassKey ||
      normalizeText(classInfo.name) === rowClassText;
    return sameLocation && sameClass;
  });
}

export function findNotasEditTargetStudent(row: Pick<NotasEditExportRow, "name">, students: NotasEditStudentInfo[]) {
  const rowName = normalizeText(row.name);
  return students.find((student) => normalizeText(student.name || "") === rowName);
}

export function normalizeClassName(value: string): string {
  const normalized = normalizeText(value)
    .replace(/º|°/g, "")
    .replace(/\bANO\b/g, "")
    .replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/(\d+)([A-Z])/);
  return match ? `${match[1]}${match[2]}` : normalized;
}

function countExpectedVistosForStudent(
  students: Student[],
  student: Student,
  period: NotasEditPeriod,
  now: Date,
): number {
  const sessionIds = new Set<string>();
  students
    .filter((candidate) => candidate.className === student.className)
    .flatMap((candidate) => filterVistosByPeriod(candidate.vistos ?? [], period, now))
    .forEach((visto) => {
      if (visto.sessionId) sessionIds.add(visto.sessionId);
    });
  return sessionIds.size;
}

function normalizeImportRecord(value: any): NotasEditImportRecord | null {
  const behaviorScore = parseGrade(value.behaviorScore ?? value.nota_comportamento ?? value.comportamento);
  const vistosScore = parseGrade(value.vistosScore ?? value.nota_vistos ?? value.vistos);
  if (!Number.isFinite(behaviorScore) || !Number.isFinite(vistosScore)) return null;

  return {
    name: value.name ?? value.nome ?? value.aluno,
    className: value.className ?? value.turma,
    registration: value.registration ?? value.matricula,
    behaviorScore: clamp(roundOne(behaviorScore), 0, 2),
    vistosScore: clamp(roundOne(vistosScore), 0, 3),
    period: normalizePeriod(value.period ?? value.periodo),
  };
}

function normalizePeriod(value: unknown): NotasEditPeriod | undefined {
  if (value === "mes" || value === "bimestre" || value === "semestre" || value === "todo") return value;
  return undefined;
}

function parseGrade(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  return Number(value.replace(",", "."));
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((header) => normalizeHeader(header.trim()));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, separator);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function splitCsvLine(line: string, separator: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.replace(/^"|"$/g, "").replace(/""/g, "\""));
}

function getPeriodStart(period: NotasEditPeriod, now: Date): Date | null {
  if (period === "todo") return null;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "mes") {
    start.setUTCDate(1);
    return start;
  }
  if (period === "bimestre") {
    start.setUTCDate(start.getUTCDate() - 60);
    return start;
  }
  const semesterStartMonth = now.getUTCMonth() < 6 ? 0 : 6;
  return new Date(Date.UTC(now.getUTCFullYear(), semesterStartMonth, 1));
}

function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function countMatches(text: string, words: string[]): number {
  const normalized = text.toLocaleLowerCase("pt-BR");
  return words.reduce((total, word) => (normalized.includes(word) ? total + 1 : total), 0);
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDecimal(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (!/[;"\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}
