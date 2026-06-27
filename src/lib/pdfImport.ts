import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { ImportedStudent } from "../types";

const ignoredLine = /(governo|secretaria|escola|diario|diário|frequ[eê]ncia|professor|componente|curricular|turno|p[aá]gina|relat[oó]rio|assinatura|data|nascimento|situa[cç][aã]o)/i;
const turmaPattern = /(turma|classe|ano|s[eé]rie)\s*[:\-]?\s*([0-9][ºo]?\s*[A-Z]?|[A-Z]{1,4}[0-9]{0,2})/i;
const matriculaPattern = /(matr[ií]cula|inep|c[oó]digo)\s*[:\-]?\s*([A-Z0-9.-]{3,})/i;

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
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

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

function parseStudentsFromText(text: string, source: string): ImportedStudent[] {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split(/\n| {2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

  const students: ImportedStudent[] = [];
  let currentClass = "";

  for (const line of normalized) {
    const turma = line.match(turmaPattern);
    if (turma?.[2]) currentClass = turma[2].toUpperCase().replace(/\s+/g, " ");

    const candidate = cleanupName(line);
    if (!candidate) continue;

    const registration = line.match(matriculaPattern)?.[2] ?? "";
    students.push({
      name: candidate,
      className: currentClass,
      registration,
      source,
    });
  }

  return students;
}

function cleanupName(line: string): string {
  if (ignoredLine.test(line)) return "";
  if (line.length < 8 || line.length > 90) return "";
  if (/\d{2,}/.test(line) && !/^[0-9]{1,3}\s+[-.)]?\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(line)) return "";

  const name = line
    .replace(/^[0-9]{1,3}\s*[-.)]?\s*/, "")
    .replace(matriculaPattern, "")
    .replace(turmaPattern, "")
    .replace(/\b(aluno|aluna|nome)\b\s*[:\-]?/gi, "")
    .replace(/[^A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = name.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 8) return "";
  if (words.some((word) => word.length === 1 && !/^[A-Z]$/i.test(word))) return "";

  return words
    .map((word) =>
      word.length <= 3 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR"),
    )
    .join(" ");
}

function dedupeImported(students: ImportedStudent[]): ImportedStudent[] {
  const map = new Map<string, ImportedStudent>();

  for (const student of students) {
    const key = `${student.name.toLocaleLowerCase("pt-BR")}::${student.className.toLocaleLowerCase(
      "pt-BR",
    )}`;
    if (!map.has(key)) map.set(key, student);
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
