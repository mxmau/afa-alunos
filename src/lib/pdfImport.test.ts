import { describe, expect, it } from "vitest";
import { parseStudentsFromText } from "./pdfImport";

describe("PDF text parser", () => {
  it("extracts likely student names and keeps the current class for generic lists", () => {
    const students = parseStudentsFromText(
      `
      Secretaria Municipal de Educação
      Turma: 7A
      1 - ANA MARIA SILVA
      2 - JOÃO PEDRO SANTOS
      Professor: Fulano
      `,
      "lista.pdf",
    );

    expect(students).toEqual([
      {
        name: "Ana Maria Silva",
        className: "7A",
        registration: "",
        campus: "Não definido",
        status: "Cadastrado",
        source: "lista.pdf",
      },
      {
        name: "João Pedro Santos",
        className: "7A",
        registration: "",
        campus: "Não definido",
        status: "Cadastrado",
        source: "lista.pdf",
      },
    ]);
  });

  it("ignores header-like lines", () => {
    const students = parseStudentsFromText(
      `
      Governo do Estado
      Relatório de frequência
      Página 1
      `,
      "cabecalho.pdf",
    );

    expect(students).toEqual([]);
  });

  it("detects class written as school year plus letter", () => {
    const students = parseStudentsFromText(
      `
      7º ano A
      1 - LUCAS DE SOUZA
      2 - MARIA CLARA DIAS
      `,
      "ano.pdf",
    );

    expect(students.map((student) => student.className)).toEqual(["7A", "7A"]);
    expect(students.map((student) => student.name)).toEqual(["Lucas de Souza", "Maria Clara Dias"]);
  });

  it("keeps leading numeric registration when it appears before the name", () => {
    const students = parseStudentsFromText(
      `
      Turma: 8B
      20231234 ANA BEATRIZ LIMA
      20231235 PEDRO HENRIQUE COSTA
      `,
      "matriculas.pdf",
    );

    expect(students).toEqual([
      {
        name: "Ana Beatriz Lima",
        className: "8B",
        registration: "20231234",
        campus: "Não definido",
        status: "Cadastrado",
        source: "matriculas.pdf",
      },
      {
        name: "Pedro Henrique Costa",
        className: "8B",
        registration: "20231235",
        campus: "Não definido",
        status: "Cadastrado",
        source: "matriculas.pdf",
      },
    ]);
  });

  it("keeps only cursando students from Sao Lourenco boletins and joins split names", () => {
    const students = parseStudentsFromText(
      `
      PREFEITURA MUNICIPAL DE SÃO LOURENÇO DA MATA
      Turma: 7º ANO A Ano: 2026
      ALICE MARIA FRANCA DO
      2 7,8 0 0 100,0% Cursando
      NASCIMENTO
      3CARLOS JOSE DA SILVA 3,0 1 1 98,1% Cursando
      4JOAO TRANSFERIDO DA SILVA 3,0 1 1 98,1% Transferido
      `,
      "BOLETIM 7A.pdf",
    );

    expect(students).toEqual([
      {
        name: "Alice Maria Franca do Nascimento",
        className: "7A",
        registration: "",
        campus: "São Lourenço",
        status: "Cursando",
        source: "BOLETIM 7A.pdf",
      },
      {
        name: "Carlos Jose da Silva",
        className: "7A",
        registration: "",
        campus: "São Lourenço",
        status: "Cursando",
        source: "BOLETIM 7A.pdf",
      },
    ]);
  });

  it("keeps only matriculado students from Igarassu SGE lists", () => {
    const students = parseStudentsFromText(
      `
      ESCOLA ECILDA RAMOS DE SOUZA
      ALUNOS MATRICULADOS NA TURMA
      8676 - 7º ANO C
      1 19304 ALICE DA SILVA RODRIGUES LIMA Feminino 13 anos e 3 meses Transferido 19/01/2026
      2 28617 ALYCE KARLLA RAIMUNDO DA SILVA Feminino 14 anos e 3 meses Matriculado 23/02/2026
      3 28617 ALYCE KARLLA RAIMUNDO DA SILVA Feminino 14 anos e 3 meses Remanejado 19/01/2026
      4 13277 ANDERSON FRANCISCO VITORIANO DE ANDRADE Masculino 12 anos e 11 meses Matriculado 19/01/2026
      `,
      "BOELTIM 7C IGARASSU.pdf",
    );

    expect(students).toEqual([
      {
        name: "Alyce Karlla Raimundo da Silva",
        className: "7C",
        registration: "28617",
        campus: "Igarassu",
        status: "Matriculado",
        source: "BOELTIM 7C IGARASSU.pdf",
      },
      {
        name: "Anderson Francisco Vitoriano de Andrade",
        className: "7C",
        registration: "13277",
        campus: "Igarassu",
        status: "Matriculado",
        source: "BOELTIM 7C IGARASSU.pdf",
      },
    ]);
  });

  it("keeps the class letter from the file when the PDF header only has the year", () => {
    const students = parseStudentsFromText(
      `
      6º ano
      1 Carlos Fabricio da Silva Lima Cursando
      2 Maria Alice Silva Campos Cursando
      `,
      "BOLETIM 6C.pdf",
    );

    expect(students.map((student) => student.className)).toEqual(["6C", "6C"]);
  });

  it("does not update the class from grade and attendance values in bulletin rows", () => {
    const students = parseStudentsFromText(
      `
      Curso: Ensino Fundamental - Anos Finais Turno: Matutino Série: 6º Ano Turma: 6º ANO C Ano: 2026
      2 CARLOS FABRICIO DA SILVA LIMA 3,0 3 4 93,4% Cursando
      `,
      "BOLETIM 6C.pdf",
    );

    expect(students[0].className).toBe("6C");
  });

  it("uses the class from the file when a real bulletin row only leaves the year", () => {
    const students = parseStudentsFromText(
      `
      Curso: Ensino Fundamental - Anos Finais Turno: Matutino S�rie: 6� Ano Turma: 6� ANO C Ano: 2026
      2 CARLOS FABRICIO DA SILVA LIMA 3,0 3 4 93,4% Cursando
      `,
      "BOLETIM 6C.pdf",
    );

    expect(students[0].className).toBe("6C");
  });
});
