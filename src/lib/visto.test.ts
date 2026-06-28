import { describe, expect, it } from "vitest";
import { calculateStudentVistoMetrics, generateVistoIndicators, generateVistoPedagogicalPhrase } from "./visto";
import { VirtualCheckEntry, VirtualCheckConfig } from "../types";

const mockConfig: VirtualCheckConfig = {
  convertPoints: true,
  pointsPerCheck: 0.1,
  maxPointsPerBimester: 2.0,
  allowNegative: true,
  allowDecimal: true,
};

function createMockEntry(value: number, status: any, date: string): VirtualCheckEntry {
  return {
    id: Math.random().toString(),
    sessionId: "session-1",
    sessionTitle: "Atividade",
    date,
    activityType: "classe",
    value,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("visto calculations and metrics", () => {
  it("calculates balance correctly", () => {
    const today = new Date().toISOString().slice(0, 10);
    const vistos = [
      createMockEntry(1, "feito", today),
      createMockEntry(2, "feito", today),
      createMockEntry(-1, "não fez", today),
    ];
    const metrics = calculateStudentVistoMetrics(vistos, mockConfig);
    expect(metrics.balanceAll).toBe(2);
    expect(metrics.balanceMonth).toBe(2);
    expect(metrics.balanceBimester).toBe(2);
    expect(metrics.calculatedPoints).toBe(0.2);
  });

  it("applies points limit config", () => {
    const today = new Date().toISOString().slice(0, 10);
    // 25 positive vistos = 2.5 points, but max points is 2.0
    const vistos = Array.from({ length: 25 }, () => createMockEntry(1, "feito", today));
    const metrics = calculateStudentVistoMetrics(vistos, mockConfig);
    expect(metrics.calculatedPoints).toBe(2.0);
  });
});

describe("visto pedagogical indicators", () => {
  it("flags excelente participação when ratio >= 0.8 and count >= 6", () => {
    const today = new Date().toISOString().slice(0, 10);
    const vistos = Array.from({ length: 7 }, () => createMockEntry(1, "feito", today));
    const indicators = generateVistoIndicators(vistos);
    expect(indicators).toContain("Excelente Participação");
  });

  it("flags muitas pendências when naoFez >= 3", () => {
    const today = new Date().toISOString().slice(0, 10);
    const vistos = [
      createMockEntry(-1, "não fez", today),
      createMockEntry(-1, "não fez", today),
      createMockEntry(-1, "não fez", today),
    ];
    const indicators = generateVistoIndicators(vistos);
    expect(indicators).toContain("Muitas Pendências");
  });
});

describe("visto pedagogical phrases", () => {
  it("returns proper message for excelente participação", () => {
    const today = new Date().toISOString().slice(0, 10);
    const vistos = Array.from({ length: 8 }, () => createMockEntry(1, "feito", today));
    const phrase = generateVistoPedagogicalPhrase(vistos);
    expect(phrase).toBe("O aluno tem apresentado excelente participação nas atividades propostas, com registros frequentes de vistos positivos.");
  });

  it("returns proper message for muitas pendências", () => {
    const today = new Date().toISOString().slice(0, 10);
    const vistos = [
      createMockEntry(-1, "não fez", today),
      createMockEntry(-1, "não fez", today),
      createMockEntry(-1, "não fez", today),
    ];
    const phrase = generateVistoPedagogicalPhrase(vistos);
    expect(phrase).toBe("O aluno acumula registros de atividades não realizadas, sendo necessário acompanhamento mais próximo.");
  });
});
