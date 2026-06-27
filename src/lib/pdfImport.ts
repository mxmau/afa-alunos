import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { ImportedStudent } from "../types";

const ignoredLine =
  /(governo|secretaria|escola|diario|diário|frequ[eê]ncia|professor|componente|curricular|turno|p[aá]gina|relat[oó]rio|assinatura|data\s+de\s+nascimento|situa[cç][aã]o|boletim|resultado|bimestre|exame|m[eé]dia|freq)/i;
const turmaPattern = /(turma|classe)\s*[:\-]?\s*([0-9][ºª°o]?\s*(?:ano)?\s*[A-Z]?|[A-Z]{1,4}[0-9]{0,2})/i;
const yearClassPattern = /([0-9]{1,2})\s*[ºª°o]?\s*(?:ano|s[eé]rie)\b\s*([A-Z])?/i;
const classOnlyPattern = /^\s*[0-9]{1,2}\s*[ºª°o]?\s*(?:ano|s[eé]rie)\s*[A-Z]?\s*$/i;
const sgeClassPattern = /^\s*\d+\s*-\s*([0-9]{1,2})\s*[ºª°o]?\s*ano\s*([A-Z])\s*$/i;
const fileClassPattern = /\b([0-9]{1,2})\s*([A-Z])\b/i;
const matriculaPattern = /(matr[ií]cula|inep|c[oó]digo)\s*[:\-]?\s*([A-Z0-9.-]{3,})/i;
const leadingRegistrationPattern = /^[0-9]{4,}\s+/;
const allowedStatusPattern = /\b(cursando|matriculado)\b/i;
const blockedStatusPattern = /\b(transferido|remanejado|desistente|cancelado|inativo)\b/i;
const sgeRowPattern =
  /^\s*\d+\s+([0-9]{2,})\s+(.+?)\s+(Masculino|Feminino)\s+.+?\s+(Matriculado|Cursando|Transferido|Remanejado|Desistente|Cancelado)\s+\d{2}\/\d{2}\/\d{4}\s*$/i;
const boletimScoreTailPattern =
  /(?:^|\s)(?:\d{1,2}(?:,\d)?|\d{1,2}\.\d|0)\s+\d+\s+\d+\s+\d{1,3},\d%?.*$/;
const nameCharsPattern = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ'´` -]+$/i;

export async function extractStudentsFromPdfs(files: File[]): Promise<ImportedStudent[]> {
  const results: ImportedStudent[] = [];

  for (const file of files) {
    const text = await extractPdfText(file);
    results.push(...parseStudentsFromText(text, file.name));
  }

  return dedupeImported(results);
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window === "undefined") {
    const pathModule = "path";
    const urlModule = "url";
    const path = await import(/* @vite-ignore */ pathModule);
    const { pathToFileURL } = await import(/* @vite-ignore */ urlModule);
    const resolved = path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolved).toString();
  } else {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
  }

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    chunks.push(groupTextItemsByLine(content.items));
  }

  return chunks.join("\n");
}

function groupTextItemsByLine(items: unknown[]): string {
  const lines = new Map<number, Array<{ x: number; text: string }>>();

  for (const item of items) {
    if (!isTextItem(item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    const current = lines.get(y) ?? [];
    current.push({ x, text: item.str });
    lines.set(y, current);
  }

  return [...lines.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .join("\n");
}

function isTextItem(item: unknown): item is TextItem {
  return Boolean(item && typeof item === "object" && "str" in item && "transform" in item);
}

export function parseStudentsFromText(text: string, source: string): ImportedStudent[] {
  const lines = normalizeLines(text);
  const campus = detectCampus(text, source);
  const fallbackClass = extractClassNameFromSource(source);
  const hasExplicitStatus = lines.some((line) => allowedStatusPattern.test(line) || blockedStatusPattern.test(line));
  const students: ImportedStudent[] = [];
  let currentClass = fallbackClass;
  let pendingNameFragments: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (canContainClassName(line)) currentClass = mergeClassName(currentClass, extractClassName(line));

    const sgeStudent = parseSgeRow(line, currentClass, campus, source);
    if (sgeStudent) {
      students.push(sgeStudent);
      pendingNameFragments = [];
      continue;
    }

    const boletimStudent = parseBoletimRow(line, pendingNameFragments, lines[index + 1], currentClass, campus, source);
    if (boletimStudent.student) {
      students.push(boletimStudent.student);
      pendingNameFragments = [];
      if (boletimStudent.usedNextLine) index += 1;
      continue;
    }

    if (isNameFragment(line)) {
      pendingNameFragments = [...pendingNameFragments, line].slice(-2);
    } else if (!line.includes("%") && !/^\d+\s/.test(line)) {
      pendingNameFragments = [];
    }
  }

  if (hasExplicitStatus) return dedupeImported(applyFallbackClass(students, fallbackClass));

  return dedupeImported(applyFallbackClass(parseGenericList(lines, source, campus, fallbackClass), fallbackClass));
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split(/\n| {2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSgeRow(line: string, currentClass: string, campus: string, source: string): ImportedStudent | null {
  const match = line.match(sgeRowPattern);
  if (!match) return null;

  const [, registration, rawName, , status] = match;
  if (!isAllowedStatus(status)) return null;

  return {
    name: cleanupName(rawName),
    className: currentClass,
    registration,
    campus,
    status: normalizeStatus(status),
    source,
  };
}

function parseBoletimRow(
  line: string,
  pendingNameFragments: string[],
  nextLine: string | undefined,
  currentClass: string,
  campus: string,
  source: string,
): { student: ImportedStudent | null; usedNextLine: boolean } {
  if (!/\bCursando\b/i.test(line) || blockedStatusPattern.test(line)) return { student: null, usedNextLine: false };

  const withoutStatus = line.replace(/\bCursando\b.*$/i, "").trim();
  const rowMatch = withoutStatus.match(/^\s*\d+\s*(.*)$/);
  if (!rowMatch) return { student: null, usedNextLine: false };

  const rawFromRow = rowMatch[1].replace(boletimScoreTailPattern, "").trim();
  let rawName = rawFromRow;
  let usedNextLine = false;

  if (!isPlausibleName(rawName)) {
    const nextFragment = nextLine && isNameFragment(nextLine) ? nextLine : "";
    rawName = [...pendingNameFragments, nextFragment].filter(Boolean).join(" ");
    usedNextLine = Boolean(nextFragment);
  }

  const name = cleanupName(rawName);
  if (!name) return { student: null, usedNextLine };

  return {
    usedNextLine,
    student: {
      name,
      className: currentClass,
      registration: "",
      campus,
      status: "Cursando",
      source,
    },
  };
}

function parseGenericList(lines: string[], source: string, campus: string, initialClass: string): ImportedStudent[] {
  const students: ImportedStudent[] = [];
  let currentClass = initialClass;

  for (const line of lines) {
    if (canContainClassName(line)) currentClass = mergeClassName(currentClass, extractClassName(line));

    const candidate = cleanupName(line);
    if (!candidate) continue;

    students.push({
      name: candidate,
      className: currentClass,
      registration: extractRegistration(line),
      campus,
      status: "Cadastrado",
      source,
    });
  }

  return students;
}

function cleanupName(line: string): string {
  if (ignoredLine.test(line)) return "";
  if (classOnlyPattern.test(line)) return "";
  if (blockedStatusPattern.test(line)) return "";
  if (line.length < 3 || line.length > 110) return "";
  if (/\d{2,}/.test(line) && !hasAllowedNumbers(line)) return "";

  const name = line
    .replace(/^[0-9]{1,3}\s*[-.)]?\s*/, "")
    .replace(leadingRegistrationPattern, "")
    .replace(matriculaPattern, "")
    .replace(turmaPattern, "")
    .replace(yearClassPattern, "")
    .replace(sgeClassPattern, "")
    .replace(allowedStatusPattern, "")
    .replace(blockedStatusPattern, "")
    .replace(/\b(aluno|aluna|nome)\b\s*[:\-]?/gi, "")
    .replace(/[^A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇÑáàâãéêíóôõúçñ'´` -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = name.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 9) return "";
  if (words.some((word) => word.length === 1 && !/^[A-Z]$/i.test(word))) return "";

  return words.map(normalizeNameWord).join(" ");
}

function hasAllowedNumbers(line: string): boolean {
  return (
    /^[0-9]{1,3}\s+[-.)]?\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ]/.test(line) ||
    /^[0-9]{4,}\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ]/.test(line) ||
    matriculaPattern.test(line) ||
    yearClassPattern.test(line) ||
    sgeClassPattern.test(line)
  );
}

function isNameFragment(line: string): boolean {
  const clean = line.trim();
  if (!clean || ignoredLine.test(clean) || allowedStatusPattern.test(clean) || blockedStatusPattern.test(clean)) return false;
  if (!nameCharsPattern.test(clean)) return false;
  const words = clean.split(/\s+/);
  return words.length >= 1 && words.length <= 7;
}

function isPlausibleName(value: string): boolean {
  return Boolean(cleanupName(value));
}

function extractClassName(line: string): string {
  const sge = line.match(sgeClassPattern);
  if (sge?.[1]) return normalizeClassName(`${sge[1]}${sge[2] ?? ""}`);

  const labeled = line.match(turmaPattern)?.[2];
  if (labeled) return normalizeClassName(labeled);

  const yearClass = line.match(yearClassPattern);
  if (yearClass?.[1]) return normalizeClassName(`${yearClass[1]}${yearClass[2] ?? ""}`);

  return "";
}

function canContainClassName(line: string): boolean {
  return /(turma|classe|ano|s[eé]rie)/i.test(line) || sgeClassPattern.test(line) || classOnlyPattern.test(line);
}

function extractClassNameFromSource(source: string): string {
  const fileClass = source.match(fileClassPattern);
  if (fileClass?.[1] && fileClass?.[2]) return normalizeClassName(`${fileClass[1]}${fileClass[2]}`);

  return "";
}

function mergeClassName(currentClass: string, detectedClass: string): string {
  if (!detectedClass) return currentClass;
  if (!currentClass) return detectedClass;
  if (/^[0-9]+[A-Z]$/.test(currentClass) && /^[0-9]+$/.test(detectedClass) && currentClass.startsWith(detectedClass)) {
    return currentClass;
  }

  return detectedClass;
}

function normalizeClassName(value: string): string {
  return value
    .replace(/(?:ano|s[eé]rie)/gi, "")
    .replace(/[ºª°o]/gi, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function applyFallbackClass(students: ImportedStudent[], fallbackClass: string): ImportedStudent[] {
  if (!fallbackClass) return students;

  return students.map((student) => {
    if (/^[0-9]+$/.test(student.className) && fallbackClass.startsWith(student.className)) {
      return { ...student, className: fallbackClass };
    }

    return student;
  });
}

function extractRegistration(line: string): string {
  const labeled = line.match(matriculaPattern)?.[2];
  if (labeled) return labeled;

  return line.match(leadingRegistrationPattern)?.[0].trim() ?? "";
}

function detectCampus(text: string, source: string): string {
  const haystack = `${source}\n${text}`.toLocaleUpperCase("pt-BR");
  if (haystack.includes("IGARASSU") || haystack.includes("ECILDA RAMOS")) return "Igarassu";
  if (haystack.includes("SÃO LOURENÇO") || haystack.includes("SAO LOURENCO") || haystack.includes("TIRADENTES")) {
    return "São Lourenço";
  }
  return "Não definido";
}

function isAllowedStatus(status: string): boolean {
  return allowedStatusPattern.test(status) && !blockedStatusPattern.test(status);
}

function normalizeStatus(status: string): string {
  const lower = status.toLocaleLowerCase("pt-BR");
  if (lower.includes("cursando")) return "Cursando";
  if (lower.includes("matriculado")) return "Matriculado";
  return status.trim();
}

function normalizeNameWord(word: string, index: number): string {
  const lower = word.toLocaleLowerCase("pt-BR");
  const particles = new Set(["da", "de", "di", "do", "das", "dos", "e"]);
  if (index > 0 && particles.has(lower)) return lower;

  return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR");
}

function dedupeImported(students: ImportedStudent[]): ImportedStudent[] {
  const map = new Map<string, ImportedStudent>();

  for (const student of students) {
    if (!student.name) continue;
    const key = `${student.name.toLocaleLowerCase("pt-BR")}::${student.className.toLocaleLowerCase(
      "pt-BR",
    )}::${student.campus.toLocaleLowerCase("pt-BR")}`;
    if (!map.has(key)) map.set(key, student);
  }

  return [...map.values()].sort((a, b) => {
    const campus = a.campus.localeCompare(b.campus, "pt-BR");
    if (campus) return campus;
    const className = a.className.localeCompare(b.className, "pt-BR");
    if (className) return className;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
