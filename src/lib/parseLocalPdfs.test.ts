import { describe, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { extractStudentsFromPdfs } from "./pdfImport";
import { buildStudentsFromImport } from "./importStudents";

class MockFile {
  name: string;
  buffer: Buffer;

  constructor(name: string, buffer: Buffer) {
    this.name = name;
    this.buffer = buffer;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const arrayBuf = this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    );
    return arrayBuf as ArrayBuffer;
  }
}

describe("Script: Parse Local PDFs", () => {
  it("processes all PDFs in the workspace folder and writes a JSON backup", async () => {
    const workspaceDir = "c:/Users/Mauri/Documents/reltorio";
    const filesInDir = fs.readdirSync(workspaceDir);
    const pdfFiles = filesInDir.filter((file) => file.toLowerCase().endsWith(".pdf"));

    console.log(`Encontrados ${pdfFiles.length} arquivos PDF para processar.`);

    const mockFiles: MockFile[] = [];
    for (const pdfName of pdfFiles) {
      const fullPath = path.join(workspaceDir, pdfName);
      const buffer = fs.readFileSync(fullPath);
      mockFiles.push(new MockFile(pdfName, buffer));
      console.log(`Lendo arquivo: ${pdfName}`);
    }

    if (mockFiles.length === 0) {
      console.log("Nenhum arquivo PDF encontrado na pasta.");
      return;
    }

    console.log("Extraindo alunos dos PDFs (isso pode levar alguns segundos)...");
    // Cast mockFiles as File[] because they match the shape required by extractStudentsFromPdfs
    const imported = await extractStudentsFromPdfs(mockFiles as unknown as File[]);
    console.log(`Extração concluída. Total de registros brutos extraídos: ${imported.length}`);

    // Converte os registros brutos em objetos do tipo Student completos
    const students = buildStudentsFromImport(imported, []);
    console.log(`Conversão concluída. Total de alunos únicos estruturados: ${students.length}`);

    // Salva no formato JSON de backup compatível com o app
    const outputPath = path.join(workspaceDir, "students-import.json");
    fs.writeFileSync(outputPath, JSON.stringify(students, null, 2), "utf-8");

    console.log(`Arquivo de backup gerado com sucesso em: ${outputPath}`);
  });
});
