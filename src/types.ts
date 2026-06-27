export type AlertLevel = "tranquilo" | "observacao" | "atencao" | "prioridade";

export type Incident = {
  id: string;
  date: string;
  type: "positivo" | "observacao" | "familia" | "pedagogico" | "social";
  title: string;
  notes: string;
};

export type StudentProfile = {
  resumoRapido: string;
  personalidade: string;
  positivos: string;
  atencao: string;
  social: string;
  pedagogico: string;
  manter: string;
  melhorar: string;
  apoioFamilia: string;
};

export type Student = {
  id: string;
  name: string;
  className: string;
  registration: string;
  campus: string;
  status: string;
  source: string;
  tags: string[];
  alertLevel: AlertLevel;
  profile: StudentProfile;
  incidents: Incident[];
  createdAt: string;
  updatedAt: string;
};

export type ImportedStudent = {
  name: string;
  className: string;
  registration: string;
  campus: string;
  status: string;
  source: string;
};
