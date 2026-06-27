import { describe, expect, it } from "vitest";
import { appendPhrase } from "./quickPhrases";

describe("appendPhrase", () => {
  it("capitalizes the first phrase in an empty field", () => {
    expect(appendPhrase("", "participa com interesse")).toBe("Participa com interesse");
  });

  it("adds a readable separator when appending to existing text", () => {
    expect(appendPhrase("Mantém boa convivência", "realiza atividades com autonomia")).toBe(
      "Mantém boa convivência; realiza atividades com autonomia",
    );
  });

  it("does not duplicate an existing phrase", () => {
    expect(appendPhrase("Participa com interesse.", "participa com interesse")).toBe("Participa com interesse.");
  });
});
