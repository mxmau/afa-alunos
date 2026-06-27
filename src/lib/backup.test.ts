import { describe, expect, it } from "vitest";
import { isIncidentBackup, isStudentBackup } from "./backup";
import { createStudent } from "./student";

describe("backup validation", () => {
  it("accepts a complete student backup", () => {
    const student = createStudent({ name: "Fernanda Lima", className: "9A" });
    student.incidents = [
      {
        id: "incident-1",
        date: "2026-06-26",
        type: "positivo",
        title: "Participação",
        notes: "Contribuiu na aula.",
      },
    ];

    expect(isStudentBackup(student)).toBe(true);
    expect(isIncidentBackup(student.incidents[0])).toBe(true);
  });

  it("rejects malformed students and incidents", () => {
    const student = createStudent({ name: "Gabriel Alves" });
    const malformedStudent = { ...student, profile: { resumoRapido: "faltam campos" } };
    const malformedIncident = { id: "1", date: "2026-06-26", type: "x", title: "Título", notes: "Texto" };

    expect(isStudentBackup(malformedStudent)).toBe(false);
    expect(isIncidentBackup(malformedIncident)).toBe(false);
    expect(isStudentBackup({})).toBe(false);
  });
});
