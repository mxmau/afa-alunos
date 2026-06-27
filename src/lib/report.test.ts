import { describe, expect, it } from "vitest";
import { buildFamilyBriefing, formatDate } from "./report";
import { createStudent } from "./student";

describe("family briefing", () => {
  it("builds a concise briefing with filled profile sections and recent incidents", () => {
    const student = createStudent({ name: "Carla Souza", className: "8B" });
    student.profile.resumoRapido = "Demonstra evolução gradual.";
    student.profile.positivos = "Participa com interesse.";
    student.profile.apoioFamilia = "Manter rotina de estudo.";
    student.incidents = [
      {
        id: "1",
        date: "2026-06-25",
        type: "positivo",
        title: "Boa participação",
        notes: "Contribuiu na atividade em grupo.",
      },
    ];

    const briefing = buildFamilyBriefing(student);

    expect(briefing).toContain("Carla Souza - 8B");
    expect(briefing).toContain("Resumo:");
    expect(briefing).toContain("Aspectos positivos:");
    expect(briefing).toContain("Como a família pode apoiar:");
    expect(briefing).toContain("Registros recentes:");
    expect(briefing).toContain("Boa participação");
  });

  it("formats dates in Brazilian format", () => {
    expect(formatDate("2026-06-25")).toBe("25/06/2026");
  });
});
