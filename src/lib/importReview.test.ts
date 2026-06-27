import { describe, expect, it } from "vitest";
import { needsNameReview } from "./importReview";

describe("needsNameReview", () => {
  it("flags names with likely broken accent fragments from PDF extraction", () => {
    expect(needsNameReview("Jo O Miguel dos Santos Ferreira")).toBe(true);
    expect(needsNameReview("Maria Vit Ria Amorim")).toBe(true);
    expect(needsNameReview("Leandro Jos da Silva Santos")).toBe(true);
  });

  it("flags isolated uppercase letters inside names", () => {
    expect(needsNameReview("Kelvis F Lix da Silva")).toBe(true);
  });

  it("keeps regular names unflagged", () => {
    expect(needsNameReview("Ana Beatriz Silva")).toBe(false);
    expect(needsNameReview("Carlos Fabricio da Silva Lima")).toBe(false);
    expect(needsNameReview("Jos\u00e9 Davi Silva Barros")).toBe(false);
    expect(needsNameReview("Ana J\u00falia da Silva Vieira")).toBe(false);
  });
});
