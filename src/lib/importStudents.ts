import { ImportedStudent, Student } from "../types";
import { createStudent, studentKey } from "./student";

export function buildStudentsFromImport(imported: ImportedStudent[], existingStudents: Student[]): Student[] {
  const existing = new Set(existingStudents.map(studentKey));
  const created: Student[] = [];

  for (const student of imported) {
    const cleaned = {
      ...student,
      name: student.name.trim(),
      className: student.className.trim(),
      registration: student.registration.trim(),
      campus: student.campus.trim(),
      status: student.status.trim(),
      source: student.source.trim(),
    };

    if (!cleaned.name) continue;

    const key = studentKey({ name: cleaned.name, className: cleaned.className, campus: cleaned.campus });
    if (existing.has(key)) continue;

    existing.add(key);
    created.push(createStudent(cleaned));
  }

  return created;
}
