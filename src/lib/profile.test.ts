import { describe, expect, it } from "vitest";
import { createStudent } from "./student";
import { getProfileCompletion, hasProfile } from "./profile";

describe("profile completion", () => {
  it("reports an empty profile as not started and incomplete", () => {
    const student = createStudent({ name: "Daniel Rocha" });
    const completion = getProfileCompletion(student);

    expect(hasProfile(student)).toBe(false);
    expect(completion.completed).toBe(0);
    expect(completion.percentage).toBe(0);
    expect(completion.isComplete).toBe(false);
    expect(completion.missingLabels).toContain("Resumo rápido");
  });

  it("reports a fully filled essential profile as complete", () => {
    const student = createStudent({ name: "Elisa Costa" });
    student.profile.resumoRapido = "Boa evolução.";
    student.profile.positivos = "Participa bem.";
    student.profile.atencao = "Manter organização.";
    student.profile.manter = "Postura colaborativa.";
    student.profile.melhorar = "Rotina de estudo.";
    student.profile.apoioFamilia = "Acompanhar materiais.";

    const completion = getProfileCompletion(student);

    expect(hasProfile(student)).toBe(true);
    expect(completion.completed).toBe(completion.total);
    expect(completion.percentage).toBe(100);
    expect(completion.isComplete).toBe(true);
    expect(completion.missingLabels).toEqual([]);
  });
});
