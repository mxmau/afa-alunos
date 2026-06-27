import { describe, expect, it } from "vitest";
import { buildStudentsFromImport } from "./importStudents";
import { createStudent } from "./student";

describe("buildStudentsFromImport", () => {
  it("trims imported rows and ignores empty names", () => {
    const created = buildStudentsFromImport(
      [
        {
          name: "  Laura Mendes  ",
          className: " 6A ",
          registration: " 99 ",
          campus: " São Lourenço ",
          status: " Cursando ",
          source: " chamada.pdf ",
        },
        { name: "   ", className: "6A", registration: "", campus: "São Lourenço", status: "Cursando", source: "chamada.pdf" },
      ],
      [],
    );

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      name: "Laura Mendes",
      className: "6A",
      registration: "99",
      campus: "São Lourenço",
      status: "Cursando",
      source: "chamada.pdf",
    });
  });

  it("ignores duplicates against existing students and inside the same import", () => {
    const existing = createStudent({ name: "Marcos Silva", className: "7B" });
    const created = buildStudentsFromImport(
      [
        { name: "marcos silva", className: "7b", registration: "", campus: "Não definido", status: "Cadastrado", source: "lista.pdf" },
        { name: "Nina Costa", className: "7B", registration: "", campus: "Não definido", status: "Cadastrado", source: "lista.pdf" },
        { name: " nina costa ", className: " 7b ", registration: "", campus: "Não definido", status: "Cadastrado", source: "lista.pdf" },
      ],
      [existing],
    );

    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Nina Costa");
  });
});
