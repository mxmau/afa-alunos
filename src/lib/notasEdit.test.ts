import { describe, expect, it } from "vitest";
import { createStudent } from "./student";
import {
  buildNotasEditRows,
  calculateNotasEditBehaviorGrade,
  calculateNotasEditVistosGrade,
  getCurrentNotasEditBimester,
  parseNotasEditImport,
} from "./notasEdit";
import { VirtualCheckEntry } from "../types";

function entry(sessionId: string, value: number, date = "2026-04-10"): VirtualCheckEntry {
  return {
    id: `${sessionId}-${value}`,
    sessionId,
    sessionTitle: `Atividade ${sessionId}`,
    date,
    activityType: "classe",
    value,
    status: value > 0 ? "feito" : "pendente",
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe("NotasEdit visto grade", () => {
  it("uses 0.5 for one visto, 2.0 before full completion, and 3.0 for all vistos", () => {
    expect(calculateNotasEditVistosGrade(0, 10)).toBe(0);
    expect(calculateNotasEditVistosGrade(1, 10)).toBe(0.5);
    expect(calculateNotasEditVistosGrade(9, 10)).toBe(2);
    expect(calculateNotasEditVistosGrade(10, 10)).toBe(3);
  });

  it("counts expected class sessions and completed student vistos in the selected period", () => {
    const ana = createStudent({ name: "Ana Souza", className: "6A", registration: "1" });
    ana.vistos = [entry("s1", 1), entry("s2", 1), entry("s3", 0)];

    const bruno = createStudent({ name: "Bruno Lima", className: "6A", registration: "2" });
    bruno.vistos = [entry("s1", 1), entry("s2", 1), entry("s3", 1)];

    const rows = buildNotasEditRows([ana, bruno], {
      period: "semestre",
      classFilter: "6A",
      now: new Date("2026-06-28T12:00:00.000Z"),
    });

    expect(rows.find((row) => row.name === "Ana Souza")).toMatchObject({
      completedVistos: 2,
      expectedVistos: 3,
      vistosScore: 2,
    });
    expect(rows.find((row) => row.name === "Bruno Lima")?.vistosScore).toBe(3);
  });
});

describe("NotasEdit behavior grade", () => {
  it("scores positive records above priority records with attention incidents", () => {
    const positive = createStudent({ name: "Clara", className: "7A" });
    positive.profile.positivos = "Participa, colabora e demonstra responsabilidade.";
    positive.incidents = [
      { id: "p1", date: "2026-04-02", type: "positivo", title: "Boa participacao", notes: "" },
    ];

    const attention = createStudent({ name: "Diego", className: "7A" });
    attention.alertLevel = "prioridade";
    attention.profile.atencao = "Apresenta conflitos, dispersao e pendencias.";
    attention.incidents = [
      { id: "a1", date: "2026-04-02", type: "social", title: "Conflito", notes: "" },
      { id: "a2", date: "2026-04-03", type: "pedagogico", title: "Pendencia", notes: "" },
    ];

    const now = new Date("2026-06-28T12:00:00.000Z");
    expect(calculateNotasEditBehaviorGrade(positive, "semestre", now).behaviorScore).toBeGreaterThan(
      calculateNotasEditBehaviorGrade(attention, "semestre", now).behaviorScore,
    );
  });

  it("uses the selected school bimester instead of the last 60 days", () => {
    const student = createStudent({ name: "Rafa", className: "7A" });
    student.incidents = [
      { id: "old", date: "2026-04-10", type: "pedagogico", title: "Pendencia antiga", notes: "" },
      { id: "current", date: "2026-07-10", type: "positivo", title: "Boa postura", notes: "" },
    ];

    const now = new Date("2026-07-15T12:00:00.000Z");
    const grade = calculateNotasEditBehaviorGrade(student, "bimestre", now, "b3");

    expect(getCurrentNotasEditBimester(now)).toBe("b3");
    expect(grade.positiveIncidents).toBe(1);
    expect(grade.attentionIncidents).toBe(0);
    expect(grade.behaviorScore).toBeGreaterThan(1.8);
  });
});

describe("NotasEdit import parser", () => {
  it("accepts semicolon CSV with Brazilian decimal comma", () => {
    const records = parseNotasEditImport("nome;turma;nota_comportamento;nota_vistos\nAna Souza;6A;1,7;3,0");

    expect(records).toEqual([
      {
        name: "Ana Souza",
        className: "6A",
        registration: undefined,
        behaviorScore: 1.7,
        vistosScore: 3,
        period: undefined,
      },
    ]);
  });
});
