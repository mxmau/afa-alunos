import { describe, expect, it } from "vitest";
import { buildWhatsAppShareUrl } from "./whatsapp";

describe("buildWhatsAppShareUrl", () => {
  it("builds a wa.me link with the briefing text encoded", () => {
    const url = buildWhatsAppShareUrl("Joao - 7A\nResumo: participa bem.");

    expect(url).toBe("https://wa.me/?text=Joao%20-%207A%0AResumo%3A%20participa%20bem.");
  });

  it("returns an empty value when there is no message", () => {
    expect(buildWhatsAppShareUrl("   ")).toBe("");
  });
});
