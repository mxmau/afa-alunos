import { describe, expect, it } from "vitest";
import { createStudent, studentKey, touchStudent } from "./student";

describe("student helpers", () => {
  it("creates a trimmed student with safe defaults", () => {
    const student = createStudent({
      name: "  Ana Maria  ",
      className: " 7A ",
      registration: " 123 ",
      campus: " São Lourenço ",
      status: " Cursando ",
      source: " manual ",
    });

    expect(student.name).toBe("Ana Maria");
    expect(student.className).toBe("7A");
    expect(student.registration).toBe("123");
    expect(student.campus).toBe("São Lourenço");
    expect(student.status).toBe("Cursando");
    expect(student.source).toBe("manual");
    expect(student.alertLevel).toBe("tranquilo");
    expect(student.tags).toEqual([]);
    expect(student.incidents).toEqual([]);
    expect(student.profile.resumoRapido).toBe("");
  });

  it("normalizes keys for duplicate detection", () => {
    expect(studentKey({ name: " ANA MARIA ", className: " 7A ", campus: "São Lourenço" })).toBe(
      studentKey({ name: "ana maria", className: "7a", campus: "são lourenço" }),
    );
  });

  it("updates the timestamp without changing the student id", () => {
    const student = createStudent({ name: "Bruno Lima" });
    const touched = touchStudent(student);

    expect(touched.id).toBe(student.id);
    expect(Date.parse(touched.updatedAt)).not.toBeNaN();
  });
});
