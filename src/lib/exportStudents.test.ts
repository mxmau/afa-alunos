import { describe, expect, it } from "vitest";
import { buildStudentsCsv, buildStudentsJson, csvCell } from "./exportStudents";
import { createStudent } from "./student";

describe("student exports", () => {
  it("escapes CSV values safely", () => {
    expect(csvCell('Aluno "observador"')).toBe('"Aluno ""observador"""');
  });

  it("builds CSV with profile progress and summary", () => {
    const student = createStudent({ name: "Helena Dias", className: "6C" });
    student.alertLevel = "atencao";
    student.tags = ["rotina", "família"];
    student.profile.resumoRapido = 'Precisa de rotina "combinada".';
    student.profile.positivos = "Participa.";
    student.profile.atencao = "Organização.";

    const csv = buildStudentsCsv([student]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split("\n")[0]).toBe("nome,turma,unidade,status,nivel,progresso_ficha,tags,resumo");
    expect(csv).toContain('"Helena Dias","6C","Não definido","Cadastrado","Atenção","50%","rotina; família"');
    expect(csv).toContain('"Precisa de rotina ""combinada""."');
  });

  it("builds readable JSON backup content", () => {
    const student = createStudent({ name: "Igor Martins", className: "5A" });
    const json = buildStudentsJson([student]);
    const parsed = JSON.parse(json);

    expect(parsed[0].name).toBe("Igor Martins");
    expect(json).toContain("\n  ");
  });
});
