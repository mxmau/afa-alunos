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

export type VirtualCheckStatus = "feito" | "parcial" | "não fez" | "ausente" | "entregou" | "pendente" | "justificado";

export type VirtualCheckEntry = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  date: string;
  activityType: string;
  value: number;
  status: VirtualCheckStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type VirtualCheckTemplate = {
  id: string;
  name: string;
  activityType: string;
  defaultValue: number;
  defaultStatus: VirtualCheckStatus;
  defaultNote: string;
  createdAt: string;
  updatedAt: string;
};

export type VirtualCheckConfig = {
  convertPoints: boolean;
  pointsPerCheck: number;
  maxPointsPerBimester: number;
  allowNegative: boolean;
  allowDecimal: boolean;
};

export type VirtualCheckAuditLog = {
  id: string;
  entryId: string;
  studentName: string;
  action: "create" | "update" | "delete";
  oldValue?: number;
  newValue?: number;
  oldStatus?: VirtualCheckStatus;
  newStatus?: VirtualCheckStatus;
  reason?: string;
  createdAt: string;
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
  vistos?: VirtualCheckEntry[];
  vistosAuditLogs?: VirtualCheckAuditLog[];
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

