import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Check,
  ClipboardList,
  Cloud,
  Copy,
  Download,
  Edit,
  FilePlus,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  LogIn,
  MessageCircle,
  Mic,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { type User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, writeBatch, query, where, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { isStudentBackup } from "./lib/backup";
import { buildStudentsCsv, buildStudentsJson } from "./lib/exportStudents";
import { needsNameReview } from "./lib/importReview";
import { buildStudentsFromImport } from "./lib/importStudents";
import { readLocalStudents, writeLocalStudents } from "./lib/localStore";
import { getProfileCompletion, hasProfile, ProfileFilter } from "./lib/profile";
import { appendPhrase, incidentPhraseBank, PhraseGroup, profilePhraseBank } from "./lib/quickPhrases";
import { buildFamilyBriefing, formatDate } from "./lib/report";
import {
  buildNotasEditCsv,
  buildNotasEditJson,
  buildNotasEditRows,
  createNotasEditSnapshot,
  findNotasEditTargetClass,
  findNotasEditTargetStudent,
  filterVistosByPeriod,
  getCurrentNotasEditBimester,
  getNotasEditBimesterLabel,
  getPeriodLabel,
  NotasEditBimester,
  parseNotasEditImport,
} from "./lib/notasEdit";
import { notasEditAuth, notasEditDb } from "./lib/notasEditFirebase";
import {
  calculateStudentVistoMetrics,
  generateVistoIndicators,
  generateVistoPedagogicalPhrase,
} from "./lib/visto";
import {
  saveStudentLocal,
  saveStudentsLocalBatch,
  getStudentsLocal,
  deleteStudentLocal,
  queueOfflineOperation,
  getPendingOperations,
  updateOfflineOperation,
  deleteOfflineOperation,
  deletePendingAfaAudio,
  getPendingAfaAudio,
  addSyncLog,
  getSyncLogs,
  OfflineOperation,
  PendingAfaAudio,
  savePendingAfaAudio,
} from "./lib/offlineDb";
import {
  triggerSync,
  addSyncEngineListener,
} from "./lib/syncEngine";
import { auth, db } from "./lib/firebase";
import { createStudent, touchStudent } from "./lib/student";
import { buildWhatsAppShareUrl } from "./lib/whatsapp";
import {
  AlertLevel,
  ImportedStudent,
  Incident,
  NotasEditPeriod,
  Student,
  StudentProfile,
  VirtualCheckEntry,
  VirtualCheckTemplate,
  VirtualCheckConfig,
  VirtualCheckAuditLog,
  VirtualCheckStatus,
} from "./types";

const alertLabels: Record<AlertLevel, string> = {
  tranquilo: "Tranquilo",
  observacao: "Observação",
  atencao: "Atenção",
  prioridade: "Prioridade",
};

const quickProfiles: Array<{
  label: string;
  alertLevel: AlertLevel;
  tags: string[];
  profile: Partial<Student["profile"]>;
}> = [
  {
    label: "Participa bem",
    alertLevel: "tranquilo",
    tags: ["participativo", "colaborativo"],
    profile: {
      resumoRapido: "Aluno(a) participativo(a), com boa convivência e abertura para as atividades propostas.",
      positivos: "Participa das aulas, colabora com colegas e costuma responder bem às orientações.",
      manter: "Manter a participação, a organização e a postura colaborativa.",
    },
  },
  {
    label: "Reservado e atento",
    alertLevel: "observacao",
    tags: ["reservado", "atento"],
    profile: {
      resumoRapido: "Aluno(a) mais reservado(a), mas acompanha as atividades e demonstra atenção quando provocado(a).",
      personalidade: "Perfil calmo, discreto e observador.",
      melhorar: "Estimular mais participação oral e segurança para expor dúvidas.",
    },
  },
  {
    label: "Precisa de rotina",
    alertLevel: "atencao",
    tags: ["rotina", "organização"],
    profile: {
      resumoRapido: "Aluno(a) com potencial, mas precisa fortalecer rotina, organização e constância.",
      atencao: "Oscila na organização e precisa de lembretes para concluir etapas das atividades.",
      apoioFamilia: "A família pode apoiar com combinados de rotina, acompanhamento de materiais e reforço positivo.",
    },
  },
  {
    label: "Convivência em foco",
    alertLevel: "atencao",
    tags: ["convivência", "mediação"],
    profile: {
      resumoRapido: "Aluno(a) precisa de acompanhamento na convivência e na forma de lidar com combinados.",
      social: "Precisa de mediação em algumas interações e de reforço sobre escuta, limites e combinados.",
      melhorar: "Fortalecer autocontrole, comunicação respeitosa e resolução de conflitos.",
    },
  },
  {
    label: "Acompanhamento próximo",
    alertLevel: "prioridade",
    tags: ["acompanhamento", "família"],
    profile: {
      resumoRapido: "Aluno(a) exige acompanhamento próximo para alinhar escola, família e rotina pedagógica.",
      atencao: "Há pontos recorrentes que precisam ser observados com frequência.",
      apoioFamilia: "É importante manter diálogo frequente com a escola e acompanhar combinados semanais.",
    },
  },
  {
    label: "Autonomo e constante",
    alertLevel: "tranquilo",
    tags: ["autonomia", "constancia"],
    profile: {
      resumoRapido: "Aluno(a) demonstra autonomia, constancia e boa resposta aos combinados da rotina escolar.",
      positivos: "Organiza-se bem, conclui atividades com regularidade e contribui para um ambiente de trabalho.",
      manter: "Manter autonomia, responsabilidade com prazos e postura colaborativa.",
    },
  },
  {
    label: "Potencial com oscilacao",
    alertLevel: "observacao",
    tags: ["potencial", "oscilacao"],
    profile: {
      resumoRapido: "Aluno(a) apresenta potencial, mas oscila entre momentos de boa participacao e queda de foco.",
      atencao: "Precisa reduzir oscilacoes de concentracao e manter regularidade na conclusao das tarefas.",
      melhorar: "Fortalecer constancia, organizacao e retomada rapida apos momentos de dispersao.",
    },
  },
  {
    label: "Agitado responsivo",
    alertLevel: "atencao",
    tags: ["agitado", "mediacao"],
    profile: {
      resumoRapido: "Aluno(a) demonstra energia e participacao, mas precisa canalizar melhor sua postura em sala.",
      social: "Responde melhor quando recebe combinados objetivos e mediacao breve no momento da agitacao.",
      melhorar: "Controlar impulsos, respeitar turnos de fala e manter foco durante orientacoes coletivas.",
    },
  },
  {
    label: "Entrega irregular",
    alertLevel: "atencao",
    tags: ["entregas", "rotina"],
    profile: {
      resumoRapido: "Aluno(a) acompanha parte das propostas, mas apresenta irregularidade na entrega e finalizacao das atividades.",
      pedagogico: "Precisa registrar melhor as etapas, concluir tarefas e acompanhar correcoes com mais cuidado.",
      apoioFamilia: "A familia pode apoiar conferindo tarefas, materiais e rotina de estudo semanal.",
    },
  },
  {
    label: "Social reservado",
    alertLevel: "observacao",
    tags: ["reservado", "social"],
    profile: {
      resumoRapido: "Aluno(a) tem perfil reservado e pode precisar de incentivo para se integrar mais ao grupo.",
      personalidade: "Observa bastante antes de se posicionar e tende a participar melhor em interacoes menores.",
      social: "Estimular participacao gradual, vinculos positivos e seguranca para se expressar.",
    },
  },
  {
    label: "Lideranca positiva",
    alertLevel: "tranquilo",
    tags: ["lideranca", "colaboracao"],
    profile: {
      resumoRapido: "Aluno(a) exerce influencia positiva no grupo e costuma colaborar com a dinamica da turma.",
      positivos: "Demonstra iniciativa, ajuda colegas e contribui para a organizacao das atividades.",
      manter: "Manter lideranca respeitosa, cooperacao e responsabilidade nas atividades coletivas.",
    },
  },
  {
    label: "Desorganizacao recorrente",
    alertLevel: "atencao",
    tags: ["desorganizacao", "materiais"],
    profile: {
      resumoRapido: "Aluno(a) precisa fortalecer organizacao de materiais, registros e prazos para melhorar o rendimento.",
      atencao: "Esquecimentos e falta de registro interferem na continuidade das atividades.",
      melhorar: "Usar rotina de conferencia, registrar tarefas e organizar materiais antes das aulas.",
    },
  },
  {
    label: "Retomada positiva",
    alertLevel: "observacao",
    tags: ["retomada", "evolucao"],
    profile: {
      resumoRapido: "Aluno(a) apresenta sinais de retomada positiva e precisa consolidar os avancos recentes.",
      positivos: "Tem aceitado melhor orientacoes e demonstrado melhora gradual na postura.",
      manter: "Manter os avancos observados, valorizar pequenas conquistas e acompanhar a constancia.",
    },
  },
];

const incidentLabels: Record<Incident["type"], string> = {
  positivo: "Positivo",
  observacao: "Observação",
  familia: "Família",
  pedagogico: "Pedagógico",
  social: "Social",
};

type AppPage = "turmas" | "alunos" | "ficha" | "vistos" | "sync";
type QueueMode = "filtro-atual" | "sem-ficha" | "incompleta" | "prioridade" | "sem-vistos" | "nao-sincronizados";
type AfaAudioMode = "api" | "gratis" | "local";
type AfaAudioApplyMode = "merge" | "replace";
type AfaAudioDraft = {
  profile: Partial<StudentProfile>;
  alertLevel?: AlertLevel;
  tags: string[];
  chips?: string[];
  incidents: Array<{
    type: Incident["type"];
    title: string;
    notes: string;
  }>;
};
type AfaAudioApiError = Error & {
  fallback?: boolean;
  code?: string;
  status?: number;
  statusText?: string;
  endpoint?: string;
  request?: Record<string, unknown>;
  responseBody?: unknown;
  transcript?: string;
};
type AudioExpressionChip = {
  id: string;
  text: string;
  normalized: string;
  count: number;
  studentIds: string[];
  lastStudentName: string;
  createdAt: string;
  updatedAt: string;
};
type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};
type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
};
type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};
type BrowserSpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};
type NotasEditPreviewRow = {
  studentId: string;
  name: string;
  className: string;
  behaviorScore: number;
  vistosScore: number;
  status: "ok" | "turma" | "aluno";
  detail: string;
};

const afaAudioProfileFields: Array<keyof StudentProfile> = [
  "resumoRapido",
  "personalidade",
  "positivos",
  "atencao",
  "social",
  "pedagogico",
  "melhorar",
  "manter",
  "apoioFamilia",
];

const afaAudioProfileLabels: Record<keyof StudentProfile, string> = {
  resumoRapido: "Resumo rapido",
  personalidade: "Perfil observado",
  positivos: "Aspectos positivos",
  atencao: "Pontos de atencao",
  social: "Social",
  pedagogico: "Pedagogico",
  melhorar: "Precisa melhorar",
  manter: "Precisa manter",
  apoioFamilia: "Apoio da familia",
};

const afaAudioMimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const maxApiAudioUploadBytes = 4_200_000;

function getAfaAudioExtension(mimeType: string) {
  const baseType = mimeType.split(";")[0].toLocaleLowerCase("pt-BR");
  if (baseType.includes("mp4")) return "mp4";
  if (baseType.includes("mpeg")) return "mpeg";
  if (baseType.includes("ogg")) return "ogg";
  if (baseType.includes("wav")) return "wav";
  if (baseType.includes("webm")) return "webm";
  return "webm";
}

function getSupportedAfaAudioMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return afaAudioMimeCandidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function splitObservationSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickSentences(sentences: string[], keywords: string[], limit = 2) {
  return sentences
    .filter((sentence) => keywords.some((keyword) => normalizeForMatch(sentence).includes(keyword)))
    .slice(0, limit)
    .join(" ");
}

function inferAudioAlertLevel(normalized: string): AlertLevel {
  const priorityWords = ["agress", "ameac", "familia acionada", "recorrente", "grave", "fuga", "risco"];
  const attentionWords = ["dispers", "conversa", "nao fez", "pendencia", "conflito", "desorganiz", "impuls", "atrapalha"];
  const attentionScore = attentionWords.filter((word) => normalized.includes(word)).length;

  if (priorityWords.some((word) => normalized.includes(word))) return "prioridade";
  if (attentionScore >= 2) return "atencao";
  if (attentionScore === 1) return "observacao";
  return "tranquilo";
}

function buildLocalAudioDraft(transcript: string): AfaAudioDraft {
  const sentences = splitObservationSentences(transcript);
  const normalized = normalizeForMatch(transcript);
  const firstSentences = sentences.slice(0, 2).join(" ");
  const positive = pickSentences(sentences, ["particip", "colabora", "ajuda", "respeita", "melhor", "responsavel", "caprich"]);
  const attention = pickSentences(sentences, ["dispers", "conversa", "nao fez", "pendencia", "desorganiz", "impuls", "atras", "dificuldade"]);
  const social = pickSentences(sentences, ["colega", "grupo", "conviv", "conflito", "respeito", "interage", "social"]);
  const pedagogical = pickSentences(sentences, ["atividade", "tarefa", "registro", "caderno", "conteudo", "leitura", "visto", "producao"]);
  const family = pickSentences(sentences, ["familia", "responsavel", "casa", "acompanhar", "combinado"]);
  const profile = {
    resumoRapido: firstSentences || transcript.trim(),
    positivos: positive,
    atencao: attention,
    social,
    pedagogico: pedagogical,
    melhorar: attention ? `Fortalecer ${attention.charAt(0).toLocaleLowerCase("pt-BR")}${attention.slice(1)}` : "",
    manter: positive ? `Manter ${positive.charAt(0).toLocaleLowerCase("pt-BR")}${positive.slice(1)}` : "",
    apoioFamilia: family,
  };
  const tags = [
    positive ? "ponto positivo" : "",
    attention ? "acompanhar" : "",
    social ? "social" : "",
    pedagogical ? "pedagogico" : "",
  ].filter(Boolean);

  return {
    profile,
    alertLevel: inferAudioAlertLevel(normalized),
    tags,
    chips: extractAudioExpressionCandidates(transcript),
    incidents: [
      {
        type: attention ? "observacao" : "positivo",
        title: "Registro por audio",
        notes: transcript.trim().slice(0, 600),
      },
    ],
  };
}

function cleanAudioDraft(input: unknown): AfaAudioDraft {
  const source = input && typeof input === "object" ? (input as Partial<AfaAudioDraft>) : {};
  const profileSource = source.profile && typeof source.profile === "object" ? source.profile : {};
  const profile: Partial<StudentProfile> = {};

  for (const field of afaAudioProfileFields) {
    const value = profileSource[field];
    if (typeof value === "string" && value.trim()) profile[field] = value.trim();
  }

  const alertLevel = ["tranquilo", "observacao", "atencao", "prioridade"].includes(source.alertLevel || "")
    ? source.alertLevel
    : undefined;
  const tags = Array.isArray(source.tags)
    ? [...new Set(source.tags.map((tag) => (typeof tag === "string" ? tag.trim().toLocaleLowerCase("pt-BR") : "")).filter(Boolean))].slice(0, 8)
    : [];
  const chips = Array.isArray(source.chips)
    ? [...new Set(source.chips.map((chip) => (typeof chip === "string" ? chip.trim() : "")).filter(Boolean))].slice(0, 4)
    : [];
  const incidents = Array.isArray(source.incidents)
    ? source.incidents
        .map((incident) => {
          if (!incident || typeof incident !== "object") return null;
          const candidate = incident as Partial<Incident>;
          const type = ["positivo", "observacao", "familia", "pedagogico", "social"].includes(candidate.type || "")
            ? candidate.type
            : "observacao";
          const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
          const notes = typeof candidate.notes === "string" ? candidate.notes.trim() : "";
          if (!title && !notes) return null;
          return { type, title: title || "Registro por audio", notes };
        })
        .filter((incident): incident is AfaAudioDraft["incidents"][number] => Boolean(incident))
        .slice(0, 4)
    : [];

  return { profile, alertLevel, tags, chips, incidents };
}

function getBrowserSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as BrowserSpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function shouldUseAfaFreeFallback(error: unknown) {
  const apiError = error as Error & { fallback?: boolean; code?: string; status?: number };
  const text = `${apiError.message || ""} ${apiError.code || ""} ${apiError.status || ""}`.toLocaleLowerCase("pt-BR");
  return (
    Boolean(apiError.fallback) ||
    text.includes("quota") ||
    text.includes("credit") ||
    text.includes("billing") ||
    text.includes("openai_api_key") ||
    text.includes("missing_api_key") ||
    text.includes("401") ||
    text.includes("402") ||
    text.includes("403") ||
    text.includes("408") ||
    text.includes("429") ||
    text.includes("500") ||
    text.includes("502") ||
    text.includes("503") ||
    text.includes("504") ||
    text.includes("timeout")
  );
}

function normalizeAudioExpression(value: string) {
  return normalizeForMatch(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAudioExpressionId(value: string) {
  return normalizeAudioExpression(value).replace(/\s+/g, "-").slice(0, 90);
}

function getAudioChipLabel(value: string) {
  const words = value
    .replace(/[.!?,;:]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const stopWords = new Set(["o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com", "para", "por", "e", "que"]);
  const keywords = words.filter((word) => !stopWords.has(normalizeForMatch(word)));
  return (keywords.length >= 2 ? keywords : words).slice(0, 3).join(" ");
}

function extractAudioExpressionCandidates(transcript: string) {
  const normalizedInput = transcript.replace(/\s+/g, " ").trim();
  if (!normalizedInput) return [];

  const chunks = normalizedInput
    .split(/(?<=[.!?])\s+|\n+|;\s+|,\s+(?=mas|ainda|quando|precisa|necessita|tem|demonstra|participa)/i)
    .map((chunk) => chunk.trim().replace(/[.!?,;:]+$/g, ""))
    .filter(Boolean);

  const seen = new Set<string>();
  return chunks
    .map((chunk) => chunk.replace(/^(o aluno|a aluna|aluno|aluna)\s+/i, "").trim())
    .filter((chunk) => {
      const normalized = normalizeAudioExpression(chunk);
      const wordCount = normalized ? normalized.split(" ").length : 0;
      if (wordCount < 3 || wordCount > 18) return false;
      if (chunk.length < 18 || chunk.length > 145) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 10);
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState<AppPage>("turmas");

  // Tab for Ficha/Student Page
  const [fichaTab, setFichaTab] = useState<"perfil" | "vistos">("perfil");

  // Vistos Subpage Navigation
  const [vistosSubPage, setVistosSubPage] = useState<"dashboard" | "lancamento" | "templates" | "relatorios" | "config">("dashboard");

  // Vistos Configurations
  const [vistosConfig, setVistosConfig] = useState<VirtualCheckConfig>(() => {
    try {
      const saved = localStorage.getItem("afa-vistos-config:v1");
      return saved ? JSON.parse(saved) : {
        convertPoints: false,
        pointsPerCheck: 0.1,
        maxPointsPerBimester: 2.0,
        allowNegative: true,
        allowDecimal: false,
      };
    } catch {
      return {
        convertPoints: false,
        pointsPerCheck: 0.1,
        maxPointsPerBimester: 2.0,
        allowNegative: true,
        allowDecimal: false,
      };
    }
  });

  // Vistos Templates
  const [vistosTemplates, setVistosTemplates] = useState<VirtualCheckTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("afa-vistos-templates:v1");
      if (saved) return JSON.parse(saved);
    } catch {}

    return [
      {
        id: "tpl-classe",
        name: "Atividade de classe",
        activityType: "classe",
        defaultValue: 1,
        defaultStatus: "feito",
        defaultNote: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tpl-ficha",
        name: "Ficha entregue",
        activityType: "ficha",
        defaultValue: 3,
        defaultStatus: "entregou",
        defaultNote: "Ficha de exercícios concluída",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tpl-casa",
        name: "Tarefa de casa",
        activityType: "casa",
        defaultValue: 1,
        defaultStatus: "entregou",
        defaultNote: "Tarefa de casa realizada",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tpl-nao-fez",
        name: "Não fez atividade",
        activityType: "pendencia",
        defaultValue: -1,
        defaultStatus: "não fez",
        defaultNote: "Não realizou a atividade proposta",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tpl-participacao",
        name: "Participação",
        activityType: "participacao",
        defaultValue: 1,
        defaultStatus: "feito",
        defaultNote: "Participou de forma construtiva da aula",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  });



  // Search filter for Lançamento
  const [lancamentoSearch, setLancamentoSearch] = useState("");
  // Focused student row in Lançamento (for keyboard shortcuts navigation)
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);

  // For reports
  const [reportClass, setReportClass] = useState<string>("todas");
  const [reportPeriod, setReportPeriod] = useState<NotasEditPeriod>("mes");
  const [notasEditBimester, setNotasEditBimester] = useState<NotasEditBimester>(() => getCurrentNotasEditBimester());
  const [syncingNotasEdit, setSyncingNotasEdit] = useState(false);
  const [previewingNotasEdit, setPreviewingNotasEdit] = useState(false);
  const [notasEditPreviewRows, setNotasEditPreviewRows] = useState<NotasEditPreviewRow[]>([]);
  const [classPairDraft, setClassPairDraft] = useState({ afa: "", notas: "" });
  const [studentPairDraft, setStudentPairDraft] = useState({ afa: "", notas: "" });
  const [notasEditClassPairs, setNotasEditClassPairs] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("afa-notasedit-class-pairs:v1") || "{}");
    } catch {
      return {};
    }
  });
  const [notasEditStudentPairs, setNotasEditStudentPairs] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("afa-notasedit-student-pairs:v1") || "{}");
    } catch {
      return {};
    }
  });
  const [selectedReportSessionId, setSelectedReportSessionId] = useState<string>("");
  const [editingVistoId, setEditingVistoId] = useState<string | null>(null);
  const [queueMode, setQueueMode] = useState<QueueMode>("filtro-atual");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [quickIncidentOpen, setQuickIncidentOpen] = useState(false);
  const [quickIncidentStudentId, setQuickIncidentStudentId] = useState("");
  const [audioAfaOpen, setAudioAfaOpen] = useState(false);
  const [audioMode, setAudioMode] = useState<AfaAudioMode>("api");
  const [audioApplyMode, setAudioApplyMode] = useState<AfaAudioApplyMode>("merge");
  const [audioRecording, setAudioRecording] = useState(false);
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [audioDraft, setAudioDraft] = useState<AfaAudioDraft | null>(null);
  const [audioError, setAudioError] = useState("");
  const [audioDebugLog, setAudioDebugLog] = useState("");
  const [pendingAfaAudio, setPendingAfaAudio] = useState<PendingAfaAudio | null>(null);
  const [pendingAfaAudioUrl, setPendingAfaAudioUrl] = useState("");
  const [audioFreeSupported, setAudioFreeSupported] = useState(false);
  const [audioExpressionChips, setAudioExpressionChips] = useState<AudioExpressionChip[]>(() => {
    try {
      const saved = localStorage.getItem("afa-audio-expression-chips:v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const apiSpeechBackupRef = useRef(false);
  const speechBaseTranscriptRef = useRef("");
  const speechFinalTranscriptRef = useRef("");
  const speechCurrentTranscriptRef = useRef("");

  // Checkbox selection of students in Lançamento
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  // Tracks if draft restoration banner should be visible
  const [draftRestoredWarning, setDraftRestoredWarning] = useState(() => !!localStorage.getItem("afa-vistos-current-session-draft:v1"));
  // Undo entries stack for Lançamento
  const [undoStack, setUndoStack] = useState<Array<Record<string, { value: number; status: VirtualCheckStatus; note: string }>>>([]);
  // Duplicate session checking modal state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    className: string;
    date: string;
    title: string;
    existingSessionId: string;
  } | null>(null);

  // Load currentSession draft from localStorage
  const [currentSession, setCurrentSession] = useState<{
    id: string;
    className: string;
    title: string;
    date: string;
    activityType: string;
    defaultValue: number;
    defaultStatus: VirtualCheckStatus;
    entries: Record<string, {
      value: number;
      status: VirtualCheckStatus;
      note: string;
    }>;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("afa-vistos-current-session-draft:v1");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auto-save currentSession draft
  useEffect(() => {
    if (currentSession) {
      localStorage.setItem("afa-vistos-current-session-draft:v1", JSON.stringify(currentSession));
    } else {
      localStorage.removeItem("afa-vistos-current-session-draft:v1");
    }
  }, [currentSession]);

  // Persist saw configs and templates
  useEffect(() => {
    localStorage.setItem("afa-vistos-config:v1", JSON.stringify(vistosConfig));
  }, [vistosConfig]);

  useEffect(() => {
    localStorage.setItem("afa-vistos-templates:v1", JSON.stringify(vistosTemplates));
  }, [vistosTemplates]);

  useEffect(() => {
    localStorage.setItem("afa-notasedit-class-pairs:v1", JSON.stringify(notasEditClassPairs));
  }, [notasEditClassPairs]);

  useEffect(() => {
    localStorage.setItem("afa-notasedit-student-pairs:v1", JSON.stringify(notasEditStudentPairs));
  }, [notasEditStudentPairs]);

  useEffect(() => {
    function handleCommandShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("pt-BR") === "k") {
        event.preventDefault();
        setCommandOpen(true);
        if (!isTyping) setCommandQuery("");
      }
    }

    window.addEventListener("keydown", handleCommandShortcut);
    return () => window.removeEventListener("keydown", handleCommandShortcut);
  }, []);

  useEffect(() => {
    setAudioFreeSupported(Boolean(getBrowserSpeechRecognition()));
  }, []);

  useEffect(() => {
    localStorage.setItem("afa-audio-expression-chips:v1", JSON.stringify(audioExpressionChips.slice(0, 80)));
  }, [audioExpressionChips]);


  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("todas");
  const [campusFilter, setCampusFilter] = useState("todas");
  const [alertFilter, setAlertFilter] = useState<AlertLevel | "todos">("todos");
  const [reportSortKey, setReportSortKey] = useState<"nome" | "maior-saldo" | "menor-saldo" | "negativos" | "inativos">("nome");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("todos");
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [localOnly, setLocalOnly] = useState(
    !db || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("local")),
  );
  const [message, setMessage] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualClass, setManualClass] = useState("");
  const [manualCampus, setManualCampus] = useState("São Lourenço");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedStudent[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [incidentDraft, setIncidentDraft] = useState({
    type: "observacao" as Incident["type"],
    title: "",
    notes: "",
  });

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [syncEngineOnline, setSyncEngineOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [conflictOperations, setConflictOperations] = useState<OfflineOperation[]>([]);

  const cloudMode = Boolean(db && auth && user && !localOnly);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) setLocalOnly(false);
    });

    return unsubscribe;
  }, []);

  // Listen to sync engine events and keep pending counters and logs synced
  useEffect(() => {
    const unsub = addSyncEngineListener((event) => {
      setPendingSyncCount(event.pendingCount);
      setIsSyncing(event.isSyncing);
      setSyncEngineOnline(navigator.onLine);
      
      // Update logs & conflicts list
      getSyncLogs().then((logs) => setSyncLogs(logs));
      getPendingOperations().then((ops) => {
        setConflictOperations(ops.filter((o) => o.status === "conflict"));
      });
    });

    // Initial load
    getPendingOperations().then((ops) => {
      setPendingSyncCount(ops.length);
      setConflictOperations(ops.filter((o) => o.status === "conflict"));
    });
    getSyncLogs().then((logs) => setSyncLogs(logs));

    const checkNet = () => setSyncEngineOnline(navigator.onLine);
    window.addEventListener("online", checkNet);
    window.addEventListener("offline", checkNet);

    return () => {
      unsub();
      window.removeEventListener("online", checkNet);
      window.removeEventListener("offline", checkNet);
    };
  }, []);

  // Sync engine periodic trigger (every 30 seconds when online)
  useEffect(() => {
    if (cloudMode && user?.uid && syncEngineOnline) {
      triggerSync(user.uid);
      const interval = setInterval(() => {
        triggerSync(user.uid);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [cloudMode, user?.uid, syncEngineOnline]);

  useEffect(() => {
    let active = true;

    async function load() {
      setHydrated(false);

      // 1. Carregar local primeiro (IndexedDB)
      let localStudents = await getStudentsLocal();
      if (localStudents.length === 0) {
        // Fallback para localStorage legado para migração
        const legacy = readLocalStudents();
        if (legacy.length > 0) {
          await saveStudentsLocalBatch(legacy);
          localStudents = legacy;
        }
      }

      if (!active) return;
      setStudents(localStudents.map(withStudentDefaults));
      setSelectedId((current) => current || localStudents[0]?.id || "");
      setHydrated(true);

      // 2. Sincronizar em background se online
      if (cloudMode && db && user) {
        try {
          await triggerSync(user.uid);

          const qUser = query(collection(db, "afa_students"), where("user_id", "==", user.uid));
          const qImport = query(collection(db, "afa_students"), where("user_id", "==", "mxmau96_imported"));
          const [userSnap, importSnap] = await Promise.all([getDocs(qUser), getDocs(qImport)]);

          if (!active) return;

          const loadedMap = new Map<string, Student>();
          const pendingOps = await getPendingOperations();
          const pendingStudentIds = new Set(pendingOps.map((op) => op.entityId));

          userSnap.forEach((docSnap) => {
            const rowData = docSnap.data() as any;
            const studentData = rowData.data as Student;
            const studentId = docSnap.id;

            // Evitar sobrescrever alterações locais não sincronizadas
            if (!pendingStudentIds.has(studentId)) {
              loadedMap.set(
                studentId,
                withStudentDefaults({
                  ...studentData,
                  id: studentId,
                  name: rowData.name || studentData.name,
                  className: rowData.class_name || studentData.className || "",
                  registration: rowData.registration || studentData.registration || "",
                  campus: rowData.campus || studentData.campus || "Não definido",
                  status: rowData.student_status || studentData.status || "Cadastrado",
                })
              );
            }
          });

          const toMigrate: Student[] = [];
          importSnap.forEach((docSnap) => {
            const rowData = docSnap.data() as any;
            const studentData = rowData.data as Student;
            const studentId = docSnap.id;

            if (!pendingStudentIds.has(studentId)) {
              const student = withStudentDefaults({
                ...studentData,
                id: studentId,
                name: rowData.name || studentData.name,
                className: rowData.class_name || studentData.className || "",
                registration: rowData.registration || studentData.registration || "",
                campus: rowData.campus || studentData.campus || "Não definido",
                status: rowData.student_status || studentData.status || "Cadastrado",
              });

              if (!loadedMap.has(studentId)) {
                const isLocal = localStudents.some((s) => s.id === studentId);
                if (!isLocal) {
                  loadedMap.set(studentId, student);
                  toMigrate.push(student);
                }
              }
            }
          });

          if (user.email === "mxmau96@gmail.com" && toMigrate.length > 0) {
            const batch = writeBatch(db);
            for (const student of toMigrate) {
              const docRef = doc(db, "afa_students", student.id);
              batch.set(docRef, {
                user_id: user.uid,
                name: student.name,
                class_name: student.className,
                registration: student.registration,
                campus: student.campus || "Não definido",
                student_status: student.status || "Cadastrado",
                data: student,
                updated_at: new Date().toISOString(),
              });
            }
            await batch.commit();
          }

          const mergedList = [...localStudents];
          loadedMap.forEach((onlineStudent, studentId) => {
            const index = mergedList.findIndex((s) => s.id === studentId);
            if (index >= 0) {
              mergedList[index] = onlineStudent;
            } else {
              mergedList.push(onlineStudent);
            }
          });

          mergedList.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
          await saveStudentsLocalBatch(mergedList);

          if (!active) return;
          setStudents(mergedList);
          setSelectedId((current) => current || mergedList[0]?.id || "");
        } catch (error: any) {
          if (!active) return;
          setMessage(`Erro ao atualizar do Firebase: ${error.message}`);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [cloudMode]);

  // Local Autosave (salvamento local periódico)
  useEffect(() => {
    if (!hydrated) return;

    const timer = window.setTimeout(async () => {
      await saveStudentsLocalBatch(students);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [students, hydrated]);

  // Vistos helper actions
  function pushToUndoStack() {
    if (!currentSession) return;
    setUndoStack((prevStack) => {
      const nextStack = [...prevStack, { ...currentSession.entries }];
      if (nextStack.length > 15) {
        nextStack.shift();
      }
      return nextStack;
    });
  }

  function handleUndo() {
    if (!currentSession || undoStack.length === 0) return;
    setUndoStack((prevStack) => {
      const copy = [...prevStack];
      const previousEntries = copy.pop();
      if (previousEntries) {
        setCurrentSession((prev) => {
          if (!prev) return null;
          return { ...prev, entries: previousEntries };
        });
      }
      return copy;
    });
  }

  function updateSessionEntry(studentId: string, value: number, status: VirtualCheckStatus, note?: string) {
    if (!currentSession) return;
    pushToUndoStack();
    setCurrentSession((prev) => {
      if (!prev) return null;
      const existing = prev.entries[studentId] || { value: prev.defaultValue, status: prev.defaultStatus, note: "" };
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [studentId]: {
            value,
            status,
            note: note !== undefined ? note : existing.note,
          },
        },
      };
    });
  }

  function applyValueToAll(value: number, status: VirtualCheckStatus) {
    if (!currentSession) return;
    pushToUndoStack();
    const classStudents = students.filter((s) => s.className === currentSession.className);
    
    const targetIds = selectedStudentIds.length > 0
      ? selectedStudentIds
      : classStudents.map((s) => s.id);

    const newEntries = { ...currentSession.entries };
    targetIds.forEach((id) => {
      newEntries[id] = {
        value,
        status,
        note: currentSession.entries[id]?.note || "",
      };
    });

    setCurrentSession((prev) => prev ? { ...prev, entries: newEntries } : null);
    setSelectedStudentIds([]); // clear selection after batch apply
  }

  function executeSaveSession(bypassDuplicateCheck = false) {
    if (!currentSession || !currentSession.title.trim()) {
      alert("Por favor, preencha o título da atividade.");
      return;
    }

    const sessionId = currentSession.id;
    const sessionTitle = currentSession.title.trim();
    const date = currentSession.date;
    const activityType = currentSession.activityType;
    const className = currentSession.className;

    // Check for duplicate activity if not bypassed
    if (!bypassDuplicateCheck) {
      let existingSessionId = "";
      const classStudents = students.filter((s) => s.className === className);
      for (const student of classStudents) {
        const dup = student.vistos?.find((v) => v.date === date && v.sessionTitle === sessionTitle && v.sessionId !== sessionId);
        if (dup) {
          existingSessionId = dup.sessionId;
          break;
        }
      }

      if (existingSessionId) {
        setDuplicateWarning({
          className,
          date,
          title: sessionTitle,
          existingSessionId,
        });
        return;
      }
    }

    const classStudents = students.filter((s) => s.className === className);
    const now = new Date().toISOString();

    setStudents((prevStudents) => {
      const next = prevStudents.map((student) => {
        if (student.className !== className) return student;

        const sessionData = currentSession.entries[student.id] || {
          value: currentSession.defaultValue,
          status: currentSession.defaultStatus,
          note: "",
        };

        const existingVistos = student.vistos ? [...student.vistos] : [];
        const existingVistoIndex = existingVistos.findIndex((v) => v.sessionId === sessionId);

        if (existingVistoIndex >= 0) {
          // Edit existing entry
          const oldVisto = existingVistos[existingVistoIndex];
          existingVistos[existingVistoIndex] = {
            ...oldVisto,
            sessionTitle,
            date,
            activityType,
            value: sessionData.value,
            status: sessionData.status,
            note: sessionData.note,
            updatedAt: now,
          };

          const auditLog: VirtualCheckAuditLog = {
            id: crypto.randomUUID(),
            entryId: oldVisto.id,
            studentName: student.name,
            action: "update",
            oldValue: oldVisto.value,
            newValue: sessionData.value,
            oldStatus: oldVisto.status,
            newStatus: sessionData.status,
            reason: "Edição da atividade por turma",
            createdAt: now,
          };

          return {
            ...student,
            vistos: existingVistos,
            vistosAuditLogs: [auditLog, ...(student.vistosAuditLogs || [])],
            updatedAt: now,
          };
        } else {
          // Create new entry
          const entryId = crypto.randomUUID();
          const newEntry: VirtualCheckEntry = {
            id: entryId,
            sessionId,
            sessionTitle,
            date,
            activityType,
            value: sessionData.value,
            status: sessionData.status,
            note: sessionData.note,
            createdAt: now,
            updatedAt: now,
          };
          existingVistos.push(newEntry);

          const auditLog: VirtualCheckAuditLog = {
            id: crypto.randomUUID(),
            entryId,
            studentName: student.name,
            action: "create",
            oldValue: 0,
            newValue: sessionData.value,
            oldStatus: "pendente",
            newStatus: sessionData.status,
            reason: "Lançamento da atividade por turma",
            createdAt: now,
          };

          return {
            ...student,
            vistos: existingVistos,
            vistosAuditLogs: [auditLog, ...(student.vistosAuditLogs || [])],
            updatedAt: now,
          };
        }
      });

      // Salvar localmente e enfileirar sync offline
      const updatedClassStudents = next.filter((s) => s.className === className);
      saveStudentsLocalBatch(updatedClassStudents).then(() => {
        Promise.all(
          updatedClassStudents.map((student) => {
            return queueOfflineOperation({
              entityType: "student",
              entityId: student.id,
              operationType: "UPDATE",
              payload: student,
            });
          })
        ).then(() => {
          if (cloudMode && user) triggerSync(user.uid);
        });
      });

      return next;
    });

    setMessage(`Lançamento "${sessionTitle}" salvo com sucesso!`);
    setCurrentSession(null);
    setSelectedStudentIds([]);
    setUndoStack([]);
    setDuplicateWarning(null);
    setVistosSubPage("dashboard");
  }

  function saveSession() {
    executeSaveSession(false);
  }

  function deleteSession(sessionId: string) {
    if (!confirm("Tem certeza que deseja excluir esta atividade e todos os vistos correspondentes?")) return;
    
    const now = new Date().toISOString();
    setStudents((current) => {
      const next = current.map((student) => {
        const foundEntry = student.vistos?.find((v) => v.sessionId === sessionId);
        if (!foundEntry) return student;

        const updatedEntries = student.vistos?.filter((v) => v.sessionId !== sessionId) ?? [];
        const auditLog: VirtualCheckAuditLog = {
          id: crypto.randomUUID(),
          entryId: foundEntry.id,
          studentName: student.name,
          action: "delete",
          oldValue: foundEntry.value,
          oldStatus: foundEntry.status,
          reason: "Exclusão da atividade",
          createdAt: now,
        };

        return {
          ...student,
          vistos: updatedEntries,
          vistosAuditLogs: [auditLog, ...(student.vistosAuditLogs || [])],
          updatedAt: now,
        };
      });

      // Salvar localmente e enfileirar no sync engine
      const updatedStudents = next.filter(
        (s) =>
          s.vistos?.some((v) => v.sessionId === sessionId) ||
          current.find((cs) => cs.id === s.id)?.vistos?.some((v) => v.sessionId === sessionId)
      );
      saveStudentsLocalBatch(updatedStudents).then(() => {
        Promise.all(
          updatedStudents.map((student) => {
            return queueOfflineOperation({
              entityType: "student",
              entityId: student.id,
              operationType: "UPDATE",
              payload: student,
            });
          })
        ).then(() => {
          if (cloudMode && user) triggerSync(user.uid);
        });
      });

      return next;
    });
    setMessage("Atividade excluída do histórico.");
  }

  function addManualVisto(studentId: string, entryDraft: { title: string; date: string; activityType: string; value: number; status: VirtualCheckStatus; note: string }) {
    if (!entryDraft.title.trim()) return;

    const now = new Date().toISOString();
    const entryId = crypto.randomUUID();
    const newEntry: VirtualCheckEntry = {
      id: entryId,
      sessionId: crypto.randomUUID(),
      sessionTitle: entryDraft.title.trim(),
      date: entryDraft.date,
      activityType: entryDraft.activityType,
      value: entryDraft.value,
      status: entryDraft.status,
      note: entryDraft.note.trim(),
      createdAt: now,
      updatedAt: now,
    };

    updateStudent(studentId, (student) => {
      const auditLog: VirtualCheckAuditLog = {
        id: crypto.randomUUID(),
        entryId,
        studentName: student.name,
        action: "create",
        oldValue: 0,
        newValue: entryDraft.value,
        oldStatus: "pendente",
        newStatus: entryDraft.status,
        reason: "Criação manual",
        createdAt: now,
      };

      return {
        ...student,
        vistos: [newEntry, ...(student.vistos || [])],
        vistosAuditLogs: [auditLog, ...(student.vistosAuditLogs || [])],
        updatedAt: now,
      };
    });
  }

  function updateManualVisto(studentId: string, entryId: string, newValue: number, newStatus: VirtualCheckStatus, note: string, reason?: string) {
    const now = new Date().toISOString();
    updateStudent(studentId, (student) => {
      const entry = student.vistos?.find((e) => e.id === entryId);
      if (!entry) return student;

      const updated = student.vistos?.map((e) => {
        if (e.id === entryId) {
          return {
            ...e,
            value: newValue,
            status: newStatus,
            note: note.trim(),
            updatedAt: now,
          };
        }
        return e;
      }) ?? [];

      const auditLog: VirtualCheckAuditLog = {
        id: crypto.randomUUID(),
        entryId,
        studentName: student.name,
        action: "update",
        oldValue: entry.value,
        newValue,
        oldStatus: entry.status,
        newStatus,
        reason: reason || "Edição manual",
        createdAt: now,
      };

      return {
        ...student,
        vistos: updated,
        vistosAuditLogs: [auditLog, ...(student.vistosAuditLogs || [])],
        updatedAt: now,
      };
    });
  }

  function deleteManualVisto(studentId: string, entryId: string, reason?: string) {
    const now = new Date().toISOString();
    updateStudent(studentId, (student) => {
      const entry = student.vistos?.find((e) => e.id === entryId);
      if (!entry) return student;

      const updated = student.vistos?.filter((e) => e.id !== entryId) ?? [];
      const auditLog: VirtualCheckAuditLog = {
        id: crypto.randomUUID(),
        entryId,
        studentName: student.name,
        action: "delete",
        oldValue: entry.value,
        oldStatus: entry.status,
        reason: reason || "Exclusão manual",
        createdAt: now,
      };

      return {
        ...student,
        vistos: updated,
        vistosAuditLogs: [auditLog, ...(student.vistosAuditLogs || [])],
        updatedAt: now,
      };
    });
  }

  function loadSessionForEdit(sessionId: string) {
    const sessionEntries = students.flatMap((s) => (s.vistos ?? []).filter((v) => v.sessionId === sessionId));
    if (!sessionEntries.length) return;
    const sample = sessionEntries[0];

    const entriesMap: Record<string, { value: number; status: VirtualCheckStatus; note: string }> = {};
    students.forEach((student) => {
      const entry = student.vistos?.find((v) => v.sessionId === sessionId);
      if (entry) {
        entriesMap[student.id] = {
          value: entry.value,
          status: entry.status,
          note: entry.note || "",
        };
      }
    });

    const student = students.find((s) => s.vistos?.some((v) => v.sessionId === sessionId));
    const className = student?.className ?? "";

    setCurrentSession({
      id: sessionId,
      className,
      title: sample.sessionTitle,
      date: sample.date,
      activityType: sample.activityType,
      defaultValue: sample.value,
      defaultStatus: sample.status,
      entries: entriesMap,
    });
    setVistosSubPage("lancamento");
  }

  // Keyboard Shortcuts Hook
  useEffect(() => {
    if (page !== "vistos" || vistosSubPage !== "lancamento" || !currentSession || !focusedStudentId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const filtered = students.filter(
        (s) => s.className === currentSession!.className && s.name.toLowerCase().includes(lancamentoSearch.toLowerCase())
      );
      const currentIndex = filtered.findIndex((s) => s.id === focusedStudentId);

      if (key === "arrowdown" && currentIndex < filtered.length - 1) {
        e.preventDefault();
        const nextId = filtered[currentIndex + 1].id;
        setFocusedStudentId(nextId);
        document.getElementById(`row-${nextId}`)?.focus();
      } else if (key === "arrowup" && currentIndex > 0) {
        e.preventDefault();
        const prevId = filtered[currentIndex - 1].id;
        setFocusedStudentId(prevId);
        document.getElementById(`row-${prevId}`)?.focus();
      } else if (key === "1") {
        updateSessionEntry(focusedStudentId!, 1, "feito");
      } else if (key === "2") {
        updateSessionEntry(focusedStudentId!, 2, "feito");
      } else if (key === "3") {
        updateSessionEntry(focusedStudentId!, 3, "feito");
      } else if (key === "0") {
        updateSessionEntry(focusedStudentId!, 0, "não fez");
      } else if (key === "a") {
        updateSessionEntry(focusedStudentId!, 0, "ausente");
      } else if (key === "n") {
        updateSessionEntry(focusedStudentId!, -1, "não fez");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [page, vistosSubPage, currentSession, focusedStudentId, students, lancamentoSearch]);

  const selectedStudent = students.find((student) => student.id === selectedId) ?? students[0];

  useEffect(() => {
    let cancelled = false;

    if (!audioAfaOpen || !selectedStudent) {
      setPendingAfaAudio(null);
      return;
    }

    void getPendingAfaAudio(selectedStudent.id)
      .then((audio) => {
        if (!cancelled) setPendingAfaAudio(audio);
      })
      .catch(() => {
        if (!cancelled) setAudioError("Nao consegui consultar os audios pendentes deste aparelho.");
      });

    return () => {
      cancelled = true;
    };
  }, [audioAfaOpen, selectedStudent?.id]);

  useEffect(() => {
    if (!pendingAfaAudio) {
      setPendingAfaAudioUrl("");
      return;
    }

    const url = URL.createObjectURL(pendingAfaAudio.blob);
    setPendingAfaAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingAfaAudio]);

  // State to hold the editable auto-generated seen recommendation comment
  const [editedVistosPhrase, setEditedVistosPhrase] = useState("");

  // Sync recommendation comment when selected student changes
  useEffect(() => {
    if (selectedStudent) {
      setEditedVistosPhrase(generateVistoPedagogicalPhrase(selectedStudent.vistos || []));
    }
  }, [selectedStudent?.id, selectedStudent?.vistos]);

  const campuses = useMemo(
    () =>
      [...new Set(students.map((student) => student.campus || "Não definido").filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [students],
  );
  const campusNavItems = useMemo(
    () => [
      { value: "todas", label: "Todas", count: students.length },
      ...campuses.map((campus) => ({
        value: campus,
        label: campus,
        count: students.filter((student) => (student.campus || "Não definido") === campus).length,
      })),
    ],
    [campuses, students],
  );
  const classNavGroups = useMemo(() => {
    const groupedCampuses = campusFilter === "todas" ? campuses : [campusFilter];

    return groupedCampuses.map((campus) => {
      const campusStudents = students.filter((student) => (student.campus || "Não definido") === campus);
      const counts = new Map<string, number>();

      for (const student of campusStudents) {
        const className = student.className || "Sem turma";
        counts.set(className, (counts.get(className) ?? 0) + 1);
      }

      const classItems = [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
        .map(([label, count]) => ({ value: label, label, count }));

      return {
        campus,
        items:
          campusFilter === "todas"
            ? classItems
            : [{ value: "todas", label: "Todas", count: campusStudents.length }, ...classItems],
      };
    });
  }, [campusFilter, campuses, students]);

  const classOverview = useMemo(
    () =>
      campuses.map((campus) => {
        const campusStudents = students.filter((student) => (student.campus || "Não definido") === campus);
        const classNames = [...new Set(campusStudents.map((student) => student.className || "Sem turma"))].sort(
          (a, b) => a.localeCompare(b, "pt-BR", { numeric: true }),
        );

        return {
          campus,
          count: campusStudents.length,
          classes: classNames.map((className) => {
            const classStudents = campusStudents.filter((student) => (student.className || "Sem turma") === className);
            const complete = classStudents.filter((student) => getProfileCompletion(student).isComplete).length;
            const priority = classStudents.filter((student) => student.alertLevel === "prioridade").length;
            const started = classStudents.filter((student) => hasProfile(student)).length;

            return {
              name: className,
              count: classStudents.length,
              complete,
              priority,
              started,
              percentage: classStudents.length ? Math.round((complete / classStudents.length) * 100) : 0,
            };
          }),
        };
      }),
    [campuses, students],
  );

  const importReviewCount = useMemo(
    () => importPreview.filter((student) => needsNameReview(student.name)).length,
    [importPreview],
  );

  const filteredStudents = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase("pt-BR");
    return students.filter((student) => {
      const matchesQuery =
        !normalized ||
        student.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        student.tags.some((tag) => tag.toLocaleLowerCase("pt-BR").includes(normalized));
      const studentClass = student.className || "Sem turma";
      const matchesClass = classFilter === "todas" || studentClass === classFilter;
      const matchesCampus = campusFilter === "todas" || (student.campus || "Não definido") === campusFilter;
      const matchesAlert = alertFilter === "todos" || student.alertLevel === alertFilter;
      const studentHasProfile = hasProfile(student);
      const completion = getProfileCompletion(student);
      const matchesProfile =
        profileFilter === "todos" ||
        (profileFilter === "com-ficha" && studentHasProfile) ||
        (profileFilter === "sem-ficha" && !studentHasProfile) ||
        (profileFilter === "completa" && completion.isComplete) ||
        (profileFilter === "incompleta" && !completion.isComplete);

      return matchesQuery && matchesClass && matchesCampus && matchesAlert && matchesProfile;
    });
  }, [students, searchQuery, classFilter, campusFilter, alertFilter, profileFilter]);

  const studentQueue = useMemo(() => {
    const base = queueMode === "filtro-atual" ? filteredStudents : students;
    return base.filter((student) => {
      const completion = getProfileCompletion(student);
      if (queueMode === "sem-ficha") return !hasProfile(student);
      if (queueMode === "incompleta") return !completion.isComplete;
      if (queueMode === "prioridade") return student.alertLevel === "prioridade";
      if (queueMode === "sem-vistos") return (student.vistos?.length ?? 0) === 0;
      if (queueMode === "nao-sincronizados") return !student.notasEdit;
      return true;
    });
  }, [filteredStudents, queueMode, students]);

  const queueIndex = selectedStudent ? studentQueue.findIndex((student) => student.id === selectedStudent.id) : -1;

  const pendingDashboard = useMemo(() => {
    const withoutProfile = students.filter((student) => !hasProfile(student));
    const incomplete = students.filter((student) => !getProfileCompletion(student).isComplete);
    const withoutVistos = students.filter((student) => (student.vistos?.length ?? 0) === 0);
    const notSynced = students.filter((student) => !student.notasEdit);
    const lowBehavior = buildNotasEditRows(students, { period: "semestre" }).filter((row) => row.behaviorScore < 1.2);
    return { withoutProfile, incomplete, withoutVistos, notSynced, lowBehavior };
  }, [students]);

  const selectedNotasEditRow = useMemo(
    () =>
      selectedStudent
        ? buildNotasEditRows(students, {
            period: "bimestre",
            classFilter: selectedStudent.className || "todas",
            bimester: notasEditBimester,
          }).find(
            (row) => row.studentId === selectedStudent.id,
          ) ?? null
        : null,
    [notasEditBimester, selectedStudent, students],
  );

  const selectedEvolution = useMemo(() => {
    if (!selectedStudent) return null;
    const vistos = selectedStudent.vistos ?? [];
    const monthVistos = filterVistosByPeriod(vistos, "mes");
    const bimesterVistos = filterVistosByPeriod(vistos, "bimestre", new Date(), notasEditBimester);
    const monthBalance = monthVistos.reduce((sum, visto) => sum + visto.value, 0);
    const bimesterBalance = bimesterVistos.reduce((sum, visto) => sum + visto.value, 0);
    const recentIncidents = selectedStudent.incidents.filter((incident) => {
      const date = new Date(`${incident.date}T00:00:00.000Z`);
      const limit = new Date();
      limit.setDate(limit.getDate() - 30);
      return date >= limit;
    });
    const attentionCount = recentIncidents.filter((incident) => incident.type !== "positivo").length;
    const trend =
      monthBalance > 0 && attentionCount === 0
        ? "melhorando"
        : attentionCount >= 2 || monthBalance < 0
          ? "atenção"
          : "estável";
    return { monthBalance, bimesterBalance, recentIncidents: recentIncidents.length, attentionCount, trend };
  }, [notasEditBimester, selectedStudent]);

  const commandItems = useMemo(() => {
    const normalized = commandQuery.trim().toLocaleLowerCase("pt-BR");
    const studentItems = students
      .filter((student) => !normalized || student.name.toLocaleLowerCase("pt-BR").includes(normalized))
      .slice(0, 8)
      .map((student) => ({
        key: `student-${student.id}`,
        label: student.name,
        meta: `${student.className || "Sem turma"} · ${student.campus || "Não definido"}`,
        run: () => openStudent(student.id),
      }));

    const actionItems = [
      { key: "action-vistos", label: "Abrir lançamento de vistos", meta: "Vistos", run: () => setPage("vistos") },
      ...(students.length > 0
        ? [{ key: "action-quick", label: "Registrar ocorrência rápida", meta: "Ficha", run: () => openQuickIncident(selectedStudent?.id) }]
        : []),
      { key: "action-notasedit", label: "Abrir relatório NotasEdit", meta: "Sincronização", run: () => { setPage("vistos"); setVistosSubPage("relatorios"); } },
      { key: "action-pending", label: "Ver painel de pendências", meta: "Turmas", run: () => setPage("turmas") },
    ].filter((item) => !normalized || item.label.toLocaleLowerCase("pt-BR").includes(normalized));

    return [...actionItems, ...studentItems].slice(0, 12);
  }, [commandQuery, selectedStudent?.id, students]);

  const stats = useMemo(() => {
    const withRecords = students.filter((student) => hasProfile(student)).length;
    const complete = students.filter((student) => getProfileCompletion(student).isComplete).length;
    const priority = students.filter((student) => student.alertLevel === "prioridade").length;
    const incidents = students.reduce((total, student) => total + student.incidents.length, 0);
    return { withRecords, complete, priority, incidents };
  }, [students]);

  function updateStudent(id: string, updater: (student: Student) => Student) {
    setStudents((current) => {
      const next = current.map((student) => (student.id === id ? touchStudent(updater(student)) : student));
      const target = next.find((student) => student.id === id);
      if (target) {
        saveStudentLocal(target).then(() => {
          queueOfflineOperation({
            entityType: "student",
            entityId: id,
            operationType: "UPDATE",
            payload: target,
          }).then(() => {
            if (cloudMode && user) triggerSync(user.uid);
          });
        });
      }
      return next;
    });
  }

  function addManualStudent() {
    if (!manualName.trim()) return;

    const student = createStudent({
      name: manualName,
      className: manualClass,
      campus: manualCampus,
      status: "Cadastrado",
      source: "manual",
    });
    setStudents((current) => {
      const next = [student, ...current];
      saveStudentLocal(student).then(() => {
        queueOfflineOperation({
          entityType: "student",
          entityId: student.id,
          operationType: "CREATE",
          payload: student,
        }).then(() => {
          if (cloudMode && user) triggerSync(user.uid);
        });
      });
      return next;
    });
    setSelectedId(student.id);
    setCampusFilter(student.campus || "Não definido");
    setClassFilter(student.className || "todas");
    setPage("ficha");
    setManualName("");
    setManualClass("");
  }

  async function handlePdfImport(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true);
    setMessage("");

    try {
      const { extractStudentsFromPdfs } = await import("./lib/pdfImport");
      const imported = await extractStudentsFromPdfs([...files]);
      setImportPreview(imported);
      setMessage(`${imported.length} possível(is) aluno(s) encontrado(s). Revise e confirme.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui ler os PDFs.");
    } finally {
      setImporting(false);
    }
  }

  async function handleBackupImport(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      let restoredStudents: Student[] = [];
      let restoredTemplates: VirtualCheckTemplate[] = [];
      let restoredConfig: VirtualCheckConfig | null = null;

      if (Array.isArray(parsed)) {
        restoredStudents = parsed.filter(isStudentBackup).map(withStudentDefaults);
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as any;
        if (Array.isArray(obj.students)) {
          restoredStudents = obj.students.filter(isStudentBackup).map(withStudentDefaults);
        }
        if (Array.isArray(obj.templates)) {
          restoredTemplates = obj.templates;
        }
        if (obj.config) {
          restoredConfig = obj.config;
        }
      } else {
        throw new Error("Formato de backup desconhecido.");
      }

      if (!restoredStudents.length) throw new Error("Não encontrei alunos válidos nesse backup.");

      const existing = new Map(students.map((student) => [student.id, student]));
      for (const student of restoredStudents) {
        existing.set(student.id, touchStudent(student));
      }

      const merged = [...existing.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setStudents(merged);
      setSelectedId(restoredStudents[0]?.id || merged[0]?.id || "");

      if (restoredTemplates.length) {
        setVistosTemplates(restoredTemplates);
      }
      if (restoredConfig) {
        setVistosConfig(restoredConfig);
      }

      setMessage(`${restoredStudents.length} aluno(s) restaurados do backup (dados e configurações carregados).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui restaurar esse backup.");
    }
  }

  async function handleNotasEditImport(file: File | null) {
    if (!file) return;

    try {
      const records = parseNotasEditImport(await file.text());
      if (!records.length) throw new Error("NÃ£o encontrei notas vÃ¡lidas nesse arquivo.");

      const rowsByStudentId = new Map(
        buildNotasEditRows(students, { period: reportPeriod, classFilter: "todas" }).map((row) => [row.studentId, row]),
      );
      const now = new Date().toISOString();
      const changed: Student[] = [];

      const next = students.map((student) => {
        const match = records.find((record) => {
          if (record.registration && student.registration && normalizeKey(record.registration) === normalizeKey(student.registration)) {
            return true;
          }
          return (
            record.name &&
            normalizeKey(record.name) === normalizeKey(student.name) &&
            (!record.className || normalizeKey(record.className) === normalizeKey(student.className))
          );
        });

        if (!match) return student;

        const currentRow = rowsByStudentId.get(student.id);
        const updated = touchStudent({
          ...student,
          notasEdit: {
            behaviorScore: match.behaviorScore,
            vistosScore: match.vistosScore,
            period: match.period ?? reportPeriod,
            completedVistos: currentRow?.completedVistos ?? 0,
            expectedVistos: currentRow?.expectedVistos ?? 0,
            syncedAt: now,
            source: "notasedit-import",
          },
        });
        changed.push(updated);
        return updated;
      });

      if (!changed.length) {
        setMessage("Arquivo lido, mas nenhum aluno bateu por matrÃ­cula ou nome/turma.");
        return;
      }

      setStudents(next);
      await saveStudentsLocalBatch(next);
      await Promise.all(
        changed.map((student) =>
          queueOfflineOperation({
            entityType: "student",
            entityId: student.id,
            operationType: "UPDATE",
            payload: student,
          }),
        ),
      );
      if (cloudMode && user) triggerSync(user.uid);
      setMessage(`${changed.length} nota(s) importada(s) do NotasEdit.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "NÃ£o consegui importar esse arquivo do NotasEdit.");
    }
  }

  async function syncNotasEditDirect(rows = buildNotasEditRows(students, { period: "bimestre", classFilter: reportClass, bimester: notasEditBimester })) {
    if (!rows.length) {
      setMessage("Não há alunos no filtro atual para sincronizar com o NotasEdit.");
      return;
    }

    setSyncingNotasEdit(true);
    setMessage("Conectando ao NotasEdit...");

    try {
      let notasUser = notasEditAuth.currentUser;
      if (!notasUser) {
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(notasEditAuth, provider);
        notasUser = credential.user;
      }

      const classesSnap = await getDocs(query(collection(notasEditDb, "classes"), where("ownerId", "==", notasUser.uid)));
      const classes = classesSnap.docs.map((classDoc) => ({
        id: classDoc.id,
        name: String(classDoc.data().name ?? ""),
        location: String(classDoc.data().location ?? ""),
      }));

      if (!classes.length) {
        setMessage("Não encontrei turmas no NotasEdit para esse login.");
        return;
      }

      const studentsByClass = new Map<string, Array<{ id: string; name?: string }>>();
      for (const classInfo of classes) {
        const studentsSnap = await getDocs(collection(notasEditDb, `classes/${classInfo.id}/students`));
        studentsByClass.set(
          classInfo.id,
          studentsSnap.docs.map((studentDoc) => ({
            id: studentDoc.id,
            name: String(studentDoc.data().name ?? ""),
          })),
        );
      }

      const behaviorField = `${notasEditBimester}_comportamento`;
      const vistosField = `${notasEditBimester}_vistos`;
      const batches = [writeBatch(notasEditDb)];
      let batchWrites = 0;
      let synced = 0;
      let classMisses = 0;
      let studentMisses = 0;
      const syncedSnapshots = new Map<string, ReturnType<typeof createNotasEditSnapshot>>();

      const queueUpdate = (classId: string, studentId: string, row: (typeof rows)[number]) => {
        if (batchWrites >= 450) {
          batches.push(writeBatch(notasEditDb));
          batchWrites = 0;
        }
        batches[batches.length - 1].update(doc(notasEditDb, `classes/${classId}/students`, studentId), {
          [behaviorField]: row.behaviorScore,
          [vistosField]: row.vistosScore,
        });
        batchWrites += 1;
        synced += 1;
        syncedSnapshots.set(row.studentId, createNotasEditSnapshot(row, "afa-calculado"));
      };

      for (const row of rows) {
        const pairedRow = {
          ...row,
          className: notasEditClassPairs[row.className] || row.className,
          name: notasEditStudentPairs[row.name] || row.name,
        };
        const classInfo = findNotasEditTargetClass(pairedRow, classes);
        if (!classInfo) {
          classMisses += 1;
          continue;
        }

        const studentInfo = findNotasEditTargetStudent(pairedRow, studentsByClass.get(classInfo.id) ?? []);
        if (!studentInfo) {
          studentMisses += 1;
          continue;
        }

        queueUpdate(classInfo.id, studentInfo.id, row);
      }

      if (synced === 0) {
        setMessage(`Nenhum aluno foi sincronizado. Turmas não encontradas: ${classMisses}; alunos não encontrados: ${studentMisses}.`);
        return;
      }

      await Promise.all(batches.map((batch) => batch.commit()));

      const nextStudents = students.map((student) => {
        const snapshot = syncedSnapshots.get(student.id);
        return snapshot ? touchStudent({ ...student, notasEdit: snapshot }) : student;
      });
      setStudents(nextStudents);
      await saveStudentsLocalBatch(nextStudents);

      const changedStudents = nextStudents.filter((student) => syncedSnapshots.has(student.id));
      await Promise.all(
        changedStudents.map((student) =>
          queueOfflineOperation({
            entityType: "student",
            entityId: student.id,
            operationType: "UPDATE",
            payload: student,
          }),
        ),
      );
      if (cloudMode && user) triggerSync(user.uid);

      setMessage(
        `${synced} aluno(s) sincronizado(s) com o NotasEdit em ${notasEditBimester.toUpperCase()}. Turmas não encontradas: ${classMisses}; alunos não encontrados: ${studentMisses}.`,
      );
    } catch (error: any) {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code.includes("unauthorized-domain")) {
        setMessage("O domínio ainda não foi aceito pelo Firebase Auth do NotasEdit. Confira a lista de domínios autorizados.");
      } else if (code.includes("permission-denied")) {
        setMessage("O NotasEdit recusou a escrita. Publique as regras do Firestore com os campos comportamento e vistos liberados.");
      } else {
        setMessage(error instanceof Error ? `Erro ao sincronizar com o NotasEdit: ${error.message}` : "Erro ao sincronizar com o NotasEdit.");
      }
    } finally {
      setSyncingNotasEdit(false);
    }
  }

  async function previewNotasEditDirect(rows = buildNotasEditRows(students, { period: "bimestre", classFilter: reportClass, bimester: notasEditBimester })) {
    if (!rows.length) {
      setMessage("Não há alunos no filtro atual para pré-visualizar.");
      return;
    }

    setPreviewingNotasEdit(true);
    setMessage("Gerando prévia do NotasEdit...");

    try {
      let notasUser = notasEditAuth.currentUser;
      if (!notasUser) {
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(notasEditAuth, provider);
        notasUser = credential.user;
      }

      const classesSnap = await getDocs(query(collection(notasEditDb, "classes"), where("ownerId", "==", notasUser.uid)));
      const classes = classesSnap.docs.map((classDoc) => ({
        id: classDoc.id,
        name: String(classDoc.data().name ?? ""),
        location: String(classDoc.data().location ?? ""),
      }));

      const studentsByClass = new Map<string, Array<{ id: string; name?: string }>>();
      for (const classInfo of classes) {
        const studentsSnap = await getDocs(collection(notasEditDb, `classes/${classInfo.id}/students`));
        studentsByClass.set(
          classInfo.id,
          studentsSnap.docs.map((studentDoc) => ({
            id: studentDoc.id,
            name: String(studentDoc.data().name ?? ""),
          })),
        );
      }

      const previewRows: NotasEditPreviewRow[] = rows.map((row) => {
        const pairedRow = {
          ...row,
          className: notasEditClassPairs[row.className] || row.className,
          name: notasEditStudentPairs[row.name] || row.name,
        };
        const classInfo = findNotasEditTargetClass(pairedRow, classes);
        if (!classInfo) {
          return { ...row, status: "turma", detail: "Turma não encontrada no NotasEdit" };
        }
        const studentInfo = findNotasEditTargetStudent(pairedRow, studentsByClass.get(classInfo.id) ?? []);
        if (!studentInfo) {
          return { ...row, status: "aluno", detail: `Aluno não encontrado em ${classInfo.name}` };
        }
        return { ...row, status: "ok", detail: `${classInfo.name} · ${studentInfo.name}` };
      });

      setNotasEditPreviewRows(previewRows);
      const ok = previewRows.filter((row) => row.status === "ok").length;
      setMessage(`Prévia pronta: ${ok}/${previewRows.length} aluno(s) prontos para sincronizar.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Erro na prévia do NotasEdit: ${error.message}` : "Erro na prévia do NotasEdit.");
    } finally {
      setPreviewingNotasEdit(false);
    }
  }

  function confirmImport() {
    const created = buildStudentsFromImport(importPreview, students);

    setStudents((current) => [...created, ...current].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    setSelectedId(created[0]?.id || selectedId);
    if (created[0]) {
      setCampusFilter(created[0].campus || "Não definido");
      setClassFilter(created[0].className || "todas");
      setPage("alunos");
    }
    setMessage(`${created.length} aluno(s) adicionados. Duplicados foram ignorados.`);
    setImportPreview([]);
  }

  function updateImportPreview(
    index: number,
    field: keyof Pick<ImportedStudent, "name" | "className" | "campus" | "status">,
    value: string,
  ) {
    setImportPreview((current) =>
      current.map((student, currentIndex) => (currentIndex === index ? { ...student, [field]: value } : student)),
    );
  }

  function removeImportPreview(index: number) {
    setImportPreview((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function selectCohort(campus: string, className = "todas") {
    setCampusFilter(campus);
    setClassFilter(className);
    setPage("alunos");

    const nextStudent = students.find((student) => {
      const studentCampus = student.campus || "Não definido";
      const studentClass = student.className || "Sem turma";
      return studentCampus === campus && (className === "todas" || studentClass === className);
    });

    if (nextStudent) setSelectedId(nextStudent.id);
  }

  function showAllClasses() {
    setCampusFilter("todas");
    setClassFilter("todas");
    setPage("turmas");
  }

  function openStudent(id: string) {
    setSelectedId(id);
    setPage("ficha");
  }

  function openQueueOffset(offset: number) {
    if (!studentQueue.length) return;
    const current = queueIndex >= 0 ? queueIndex : 0;
    const nextIndex = Math.min(studentQueue.length - 1, Math.max(0, current + offset));
    openStudent(studentQueue[nextIndex].id);
  }

  function saveAndNext() {
    if (queueIndex < 0 || queueIndex >= studentQueue.length - 1) {
      setMessage("Fim da fila atual.");
      return;
    }
    openStudent(studentQueue[queueIndex + 1].id);
  }

  function applyQuickProfileAndNext(template: (typeof quickProfiles)[number]) {
    applyQuickProfile(template);
    window.setTimeout(saveAndNext, 0);
  }

  function openQuickIncident(studentId = selectedStudent?.id) {
    if (studentId) setQuickIncidentStudentId(studentId);
    setQuickIncidentOpen(true);
    setCommandOpen(false);
  }

  function resetAudioAfa() {
    setAudioTranscript("");
    setAudioDraft(null);
    setAudioError("");
    setAudioDebugLog("");
    setAudioApplyMode("merge");
  }

  function openAudioAfa() {
    resetAudioAfa();
    setAudioAfaOpen(true);
    setCommandOpen(false);
  }

  const recurringAudioChips = audioExpressionChips
    .filter((chip) => chip.count >= 2)
    .sort((a, b) => b.count - a.count || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 18);

  const recentAudioChips = audioExpressionChips
    .filter((chip) => chip.count < 2)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  function registerAudioExpressionChips(input: string | string[], student = selectedStudent) {
    if (!student) return;
    const candidates = Array.isArray(input) ? input : extractAudioExpressionCandidates(input);
    if (!candidates.length) return;

    const now = new Date().toISOString();
    setAudioExpressionChips((current) => {
      const byId = new Map(current.map((chip) => [chip.id, chip]));

      for (const text of candidates) {
        const normalized = normalizeAudioExpression(text);
        const id = getAudioExpressionId(text);
        if (!id || !normalized) continue;

        const existing = byId.get(id);
        if (!existing) {
          byId.set(id, {
            id,
            text,
            normalized,
            count: 1,
            studentIds: [student.id],
            lastStudentName: student.name,
            createdAt: now,
            updatedAt: now,
          });
          continue;
        }

        const studentIds = existing.studentIds.includes(student.id)
          ? existing.studentIds
          : [...existing.studentIds, student.id].slice(-80);

        byId.set(id, {
          ...existing,
          text: existing.text.length <= text.length ? existing.text : text,
          count: studentIds.length,
          studentIds,
          lastStudentName: student.name,
          updatedAt: now,
        });
      }

      return [...byId.values()]
        .sort((a, b) => b.count - a.count || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 80);
    });
  }

  function applyAudioDraftFromTranscript(transcript: string, source: "api" | "local" | "gratis", draft?: AfaAudioDraft) {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) return false;
    const nextDraft = draft || buildLocalAudioDraft(cleanTranscript);
    setAudioTranscript(cleanTranscript);
    setAudioDraft(nextDraft);
    registerAudioExpressionChips(nextDraft.chips && nextDraft.chips.length > 0 ? nextDraft.chips : cleanTranscript);
    if (source === "api") {
      setAudioError("");
      setAudioDebugLog("");
    }
    return true;
  }

  function insertAudioChipText(text: string) {
    setAudioTranscript((current) => appendPhrase(current, text));
  }

  function removeAudioChip(id: string) {
    setAudioExpressionChips((current) => current.filter((chip) => chip.id !== id));
  }

  function closeAudioAfa() {
    stopApiSpeechBackup();
    stopFreeSpeechRecognition(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    mediaRecorderRef.current = null;
    setAudioRecording(false);
    setAudioProcessing(false);
    setAudioAfaOpen(false);
  }

  function buildAudioDebugLog(
    error: unknown,
    context: { action: string; transcript?: string; audioBlob?: Blob; mode?: AfaAudioMode },
  ) {
    const apiError = error as AfaAudioApiError;
    const transcript = (context.transcript || audioTranscript || "").trim();
    const now = new Date();
    const payload = {
      createdAt: now.toISOString(),
      app: "AFA Panorama Escolar",
      area: "Ditado AFA",
      action: context.action,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      mode: context.mode || audioMode,
      student: selectedStudent
        ? {
            id: selectedStudent.id,
            name: selectedStudent.name,
            className: selectedStudent.className,
            campus: selectedStudent.campus,
          }
        : null,
      audio: {
        blobSize: context.audioBlob?.size || null,
        blobType: context.audioBlob?.type || null,
        transcriptLength: transcript.length,
        transcriptPreview: transcript.slice(0, 420),
      },
      browser: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        language: typeof navigator !== "undefined" ? navigator.language : "",
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      },
      error: {
        name: apiError.name || "Error",
        message: apiError.message || String(error),
        code: apiError.code || "",
        status: apiError.status || null,
        statusText: apiError.statusText || "",
        fallback: Boolean(apiError.fallback),
      },
      api: {
        endpoint: apiError.endpoint || "/api/afa-audio",
        request: apiError.request || null,
        responseBody: apiError.responseBody || null,
      },
    };

    return JSON.stringify(payload, null, 2);
  }

  async function copyAudioDebugLog() {
    if (!audioDebugLog) return;
    try {
      await navigator.clipboard.writeText(audioDebugLog);
      setMessage("Logs do audio copiados.");
    } catch {
      setMessage("Nao consegui copiar automaticamente. Abra 'Ver logs' e copie o texto manualmente.");
    }
  }

  function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Nao consegui ler o audio gravado."));
      reader.onloadend = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.readAsDataURL(blob);
    });
  }

  async function keepPendingAfaAudio(blob: Blob) {
    if (!selectedStudent) return;
    const pendingAudio: PendingAfaAudio = {
      studentId: selectedStudent.id,
      blob,
      mimeType: blob.type || "audio/webm",
      size: blob.size,
      createdAt: new Date().toISOString(),
    };
    await savePendingAfaAudio(pendingAudio);
    setPendingAfaAudio(pendingAudio);
  }

  async function discardPendingAfaAudio(studentId = selectedStudent?.id) {
    if (!studentId) return;
    setPendingAfaAudio((current) => (current?.studentId === studentId ? null : current));
    try {
      await deletePendingAfaAudio(studentId);
    } catch {
      setAudioError("A ficha foi organizada, mas nao consegui apagar o audio pendente deste aparelho.");
    }
  }

  async function requestAfaAudioDraft(options: { audioBlob?: Blob; transcript?: string }) {
    if (!selectedStudent) throw new Error("Selecione um aluno antes de processar o audio.");

    if (options.audioBlob && options.audioBlob.size > maxApiAudioUploadBytes) {
      const sizeError = new Error("O audio ficou grande demais para envio direto. Usei o texto capturado no aparelho quando disponivel.") as Error & {
        fallback?: boolean;
        code?: string;
        status?: number;
      };
      sizeError.fallback = true;
      sizeError.code = "audio_too_large";
      sizeError.status = 413;
      throw sizeError;
    }

    let currentTranscript = options.transcript || "";
    const requestSummary = {
      hasAudio: Boolean(options.audioBlob),
      audioSize: options.audioBlob?.size || 0,
      mimeType: options.audioBlob?.type || "audio/webm",
      transcriptLength: currentTranscript.trim().length || 0,
      studentId: selectedStudent.id,
      studentClass: selectedStudent.className,
      studentCampus: selectedStudent.campus,
    };

    if (options.audioBlob && !currentTranscript.trim()) {
      const audioBase64 = await blobToBase64(options.audioBlob);
      const mimeType = options.audioBlob.type || "audio/webm";
      
      const transcribeResponse = await fetch("/api/afa-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          fileName: `afa-${selectedStudent.id}.${getAfaAudioExtension(mimeType)}`,
        }),
      });

      const transcribeText = await transcribeResponse.text();
      let transcribeResult: Record<string, unknown> = {};
      try {
        transcribeResult = transcribeText ? JSON.parse(transcribeText) : {};
      } catch {
        transcribeResult = { raw: transcribeText.slice(0, 1600) };
      }

      if (!transcribeResponse.ok) {
        const errorMessage = typeof transcribeResult.error === "string" ? transcribeResult.error : "Nao consegui transcrever o audio.";
        const apiError = new Error(errorMessage) as AfaAudioApiError;
        apiError.fallback = Boolean(transcribeResult.fallback);
        apiError.code = typeof transcribeResult.code === "string" ? transcribeResult.code : "";
        apiError.status = Number(transcribeResult.status || transcribeResponse.status);
        apiError.statusText = transcribeResponse.statusText;
        apiError.endpoint = "/api/afa-transcribe";
        apiError.request = requestSummary;
        apiError.responseBody = transcribeResult;
        apiError.transcript = currentTranscript;
        throw apiError;
      }
      
      currentTranscript = typeof transcribeResult.transcript === "string" ? transcribeResult.transcript : "";
      requestSummary.transcriptLength = currentTranscript.length;
    }

    if (!currentTranscript.trim()) {
      const emptyTranscriptError = new Error("A transcricao voltou vazia. O audio foi mantido para uma nova tentativa.") as AfaAudioApiError;
      emptyTranscriptError.code = "empty_transcript";
      emptyTranscriptError.status = 422;
      emptyTranscriptError.endpoint = "/api/afa-transcribe";
      emptyTranscriptError.request = requestSummary;
      emptyTranscriptError.transcript = currentTranscript;
      throw emptyTranscriptError;
    }

    const structureResponse = await fetch("/api/afa-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: currentTranscript,
        student: {
          name: selectedStudent.name,
          className: selectedStudent.className,
          campus: selectedStudent.campus,
        },
        existingProfile: selectedStudent.profile,
      }),
    });

    const structureText = await structureResponse.text();
    let structureResult: Record<string, unknown> = {};
    try {
      structureResult = structureText ? JSON.parse(structureText) : {};
    } catch {
      structureResult = { raw: structureText.slice(0, 1600) };
    }

    if (!structureResponse.ok) {
      const errorMessage = typeof structureResult.error === "string" ? structureResult.error : "Nao consegui organizar a ficha.";
      const apiError = new Error(errorMessage) as AfaAudioApiError;
      apiError.fallback = Boolean(structureResult.fallback);
      apiError.code = typeof structureResult.code === "string" ? structureResult.code : "";
      apiError.status = Number(structureResult.status || structureResponse.status);
      apiError.statusText = structureResponse.statusText;
      apiError.endpoint = "/api/afa-structure";
      apiError.request = requestSummary;
      apiError.responseBody = structureResult;
      apiError.transcript = currentTranscript;
      throw apiError;
    }

    return applyAudioDraftFromTranscript(
      currentTranscript,
      "api",
      cleanAudioDraft(structureResult.draft),
    );
  }

  async function processAfaAudioBlob(blob: Blob, processingMode: AfaAudioMode = audioMode) {
    setAudioProcessing(true);
    setAudioError("");
    setAudioDebugLog("");
    let organized = false;
    try {
      if (processingMode === "local") {
        if (!audioTranscript.trim()) {
          throw new Error("No modo local, cole a transcricao antes de organizar a ficha.");
        }
        organized = applyAudioDraftFromTranscript(audioTranscript, "local");
        return;
      }
      if (processingMode === "gratis") {
        const transcript = audioTranscript.trim();
        if (!transcript) throw new Error("Use o ditado gratis do navegador ou cole a transcricao.");
        organized = applyAudioDraftFromTranscript(transcript, "gratis");
        return;
      }
      organized = await requestAfaAudioDraft({ audioBlob: blob });
    } catch (error) {
      const apiError = error as AfaAudioApiError;
      const fallbackText = (apiError.transcript || audioTranscript.trim() || speechCurrentTranscriptRef.current.trim()).trim();
      if (processingMode === "api") {
        setAudioDebugLog(buildAudioDebugLog(error, { action: "processar_audio_gravado", audioBlob: blob, transcript: fallbackText, mode: processingMode }));
      }
      if (fallbackText) {
        organized = applyAudioDraftFromTranscript(fallbackText, "local");
        if (shouldUseAfaFreeFallback(error)) setAudioMode("local");
        setAudioError(
          error instanceof Error
            ? `${error.message} Usei as regras locais com o texto disponivel.`
            : "Usei as regras locais com o texto disponivel.",
        );
      } else {
        if (shouldUseAfaFreeFallback(error)) {
          setAudioMode(audioFreeSupported ? "gratis" : "local");
          setAudioError(
            audioFreeSupported
              ? "A API paga falhou ou ficou sem credito. Ativei o modo gratis; grave novamente pelo navegador."
              : "A API paga falhou ou ficou sem credito. Cole a transcricao para usar as regras locais.",
          );
        } else {
          setAudioError(
            error instanceof Error
              ? `${error.message} Se estiver no celular, tente o modo Gratis para transcrever no proprio aparelho.`
              : "Nao consegui processar o audio. Se estiver no celular, tente o modo Gratis.",
          );
        }
      }
    } finally {
      if (organized) await discardPendingAfaAudio();
      setAudioProcessing(false);
    }
  }

  function retryPendingAfaAudio() {
    if (!pendingAfaAudio || audioProcessing) return;
    setAudioMode("api");
    void processAfaAudioBlob(pendingAfaAudio.blob, "api");
  }

  async function startAudioRecording() {
    if (audioMode === "gratis") {
      startFreeSpeechRecognition();
      return;
    }
    if (audioMode === "local") {
      setAudioError("No modo local, cole a transcricao e clique em Organizar texto. Para ditar sem custo, use o modo Gratis.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAudioError("Este navegador nao liberou gravacao de audio.");
      return;
    }

    setAudioError("");
    setAudioDraft(null);
    audioChunksRef.current = [];
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAfaAudioMimeType();
      const options: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
      if (mimeType) options.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recorder.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        void (async () => {
          try {
            await keepPendingAfaAudio(audioBlob);
          } catch {
            setAudioError("Nao consegui guardar o audio neste aparelho. Mantenha esta tela aberta durante o processamento.");
          }
          await processAfaAudioBlob(audioBlob);
        })();
      };
      recorder.start();
      setAudioRecording(true);
      startApiSpeechBackup();
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      stopApiSpeechBackup();
      setAudioRecording(false);
      setAudioError(error instanceof Error ? error.message : "Nao consegui iniciar a gravacao.");
    }
  }

  function stopAudioRecording() {
    if (audioMode === "gratis") {
      stopFreeSpeechRecognition(true);
      return;
    }
    stopApiSpeechBackup();
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setAudioRecording(false);
  }

  function startApiSpeechBackup() {
    const Recognition = getBrowserSpeechRecognition();
    if (!Recognition || speechRecognitionRef.current) return;

    setAudioFreeSupported(true);
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    apiSpeechBackupRef.current = true;
    speechBaseTranscriptRef.current = audioTranscript.trim();
    speechFinalTranscriptRef.current = "";
    speechCurrentTranscriptRef.current = speechBaseTranscriptRef.current;

    recognition.onresult = (event) => {
      let finalText = speechFinalTranscriptRef.current;
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        } else {
          interimText = `${interimText} ${transcript}`.trim();
        }
      }

      speechFinalTranscriptRef.current = finalText;
      const current = [speechBaseTranscriptRef.current, finalText, interimText].filter(Boolean).join(" ").trim();
      speechCurrentTranscriptRef.current = current;
      setAudioTranscript(current);
    };

    recognition.onerror = () => {
      apiSpeechBackupRef.current = false;
      speechRecognitionRef.current = null;
    };

    recognition.onend = () => {
      apiSpeechBackupRef.current = false;
      speechRecognitionRef.current = null;
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      apiSpeechBackupRef.current = false;
      speechRecognitionRef.current = null;
    }
  }

  function stopApiSpeechBackup() {
    if (!apiSpeechBackupRef.current) return;
    const recognition = speechRecognitionRef.current;
    apiSpeechBackupRef.current = false;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    try {
      recognition.stop();
    } catch {
      recognition.abort?.();
    }
    speechRecognitionRef.current = null;
  }

  function startFreeSpeechRecognition() {
    const Recognition = getBrowserSpeechRecognition();
    if (!Recognition) {
      setAudioFreeSupported(false);
      setAudioMode("local");
      setAudioError("Ditado gratis indisponivel neste navegador. Cole a transcricao para usar regras locais.");
      return;
    }

    setAudioFreeSupported(true);
    setAudioError("");
    setAudioDraft(null);
    setAudioProcessing(false);

    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    speechBaseTranscriptRef.current = audioTranscript.trim();
    speechFinalTranscriptRef.current = "";
    speechCurrentTranscriptRef.current = speechBaseTranscriptRef.current;

    recognition.onresult = (event) => {
      let finalText = speechFinalTranscriptRef.current;
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        } else {
          interimText = `${interimText} ${transcript}`.trim();
        }
      }

      speechFinalTranscriptRef.current = finalText;
      const current = [speechBaseTranscriptRef.current, finalText, interimText].filter(Boolean).join(" ").trim();
      speechCurrentTranscriptRef.current = current;
      setAudioTranscript(current);
    };

    recognition.onerror = (event) => {
      setAudioRecording(false);
      const detail = event.error || event.message || "erro desconhecido";
      setAudioError(`Ditado gratis interrompido pelo navegador: ${detail}. Voce ainda pode organizar o texto capturado.`);
    };

    recognition.onend = () => {
      setAudioRecording(false);
      speechRecognitionRef.current = null;
      const transcript = speechCurrentTranscriptRef.current.trim();
      if (transcript) applyAudioDraftFromTranscript(transcript, "gratis");
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
      setAudioRecording(true);
    } catch (error) {
      speechRecognitionRef.current = null;
      setAudioRecording(false);
      setAudioError(error instanceof Error ? error.message : "Nao consegui iniciar o ditado gratis.");
    }
  }

  function stopFreeSpeechRecognition(organizeDraft: boolean) {
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    recognition.onend = null;
    recognition.stop();
    speechRecognitionRef.current = null;
    setAudioRecording(false);

    const transcript = speechCurrentTranscriptRef.current.trim() || audioTranscript.trim();
    if (organizeDraft && transcript) {
      const organized = applyAudioDraftFromTranscript(transcript, "gratis");
      if (organized) void discardPendingAfaAudio();
    }
  }

  async function organizeAudioTranscript() {
    const transcript = audioTranscript.trim();
    if (!transcript) {
      setAudioError("Cole ou transcreva algum texto antes de organizar.");
      return;
    }

    setAudioProcessing(true);
    setAudioError("");
    setAudioDebugLog("");
    let organized = false;
    try {
      if (audioMode === "api") {
        organized = await requestAfaAudioDraft({ transcript });
      } else {
        organized = applyAudioDraftFromTranscript(transcript, audioMode);
      }
    } catch (error) {
      organized = applyAudioDraftFromTranscript(transcript, "local");
      if (audioMode === "api") {
        setAudioDebugLog(buildAudioDebugLog(error, { action: "organizar_transcricao_digitada", transcript }));
      }
      if (shouldUseAfaFreeFallback(error)) setAudioMode("local");
      setAudioError(
        error instanceof Error
          ? `${error.message} Usei as regras locais como fallback.`
          : "Usei as regras locais como fallback.",
      );
    } finally {
      if (organized) await discardPendingAfaAudio();
      setAudioProcessing(false);
    }
  }

  function applyAudioDraft() {
    if (!selectedStudent || !audioDraft) return;

    const today = new Date().toISOString().slice(0, 10);
    updateStudent(selectedStudent.id, (student) => {
      const nextProfile = { ...student.profile };
      for (const field of afaAudioProfileFields) {
        const value = audioDraft.profile[field];
        if (!value) continue;
        nextProfile[field] = audioApplyMode === "replace" ? value : appendPhrase(nextProfile[field], value);
      }

      const newIncidents: Incident[] = audioDraft.incidents.map((incident) => ({
        id: crypto.randomUUID(),
        date: today,
        type: incident.type,
        title: incident.title,
        notes: incident.notes,
      }));

      return {
        ...student,
        alertLevel: audioDraft.alertLevel || student.alertLevel,
        tags: [...new Set([...student.tags, ...audioDraft.tags])],
        profile: nextProfile,
        incidents: [...newIncidents, ...student.incidents],
      };
    });

    setMessage("Ditado AFA aplicado na ficha.");
    setAudioAfaOpen(false);
  }

  function addQuickIncident(title: string, type: Incident["type"] = "observacao", notes = "") {
    const studentId = quickIncidentOpen ? quickIncidentStudentId || selectedStudent?.id : selectedStudent?.id;
    if (!studentId) return;
    const incident: Incident = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      type,
      title,
      notes,
    };
    updateStudent(studentId, (student) => ({
      ...student,
      incidents: [incident, ...student.incidents],
    }));
    setQuickIncidentOpen(false);
    setMessage("Ocorrência rápida registrada.");
  }

  function addClassPair() {
    if (!classPairDraft.afa.trim() || !classPairDraft.notas.trim()) return;
    setNotasEditClassPairs((current) => ({
      ...current,
      [classPairDraft.afa.trim()]: classPairDraft.notas.trim(),
    }));
    setClassPairDraft({ afa: "", notas: "" });
  }

  function addStudentPair() {
    if (!studentPairDraft.afa.trim() || !studentPairDraft.notas.trim()) return;
    setNotasEditStudentPairs((current) => ({
      ...current,
      [studentPairDraft.afa.trim()]: studentPairDraft.notas.trim(),
    }));
    setStudentPairDraft({ afa: "", notas: "" });
  }

  function applyQuickProfile(template: (typeof quickProfiles)[number]) {
    if (!selectedStudent) return;
    updateStudent(selectedStudent.id, (student) => ({
      ...student,
      alertLevel: template.alertLevel,
      tags: [...new Set([...student.tags, ...template.tags])],
      profile: { ...student.profile, ...template.profile },
    }));
  }

  function generateSummary() {
    if (!selectedStudent) return;
    updateStudent(selectedStudent.id, (student) => ({
      ...student,
      profile: {
        ...student.profile,
        resumoRapido:
          student.profile.resumoRapido ||
          [
            student.profile.personalidade,
            student.profile.positivos,
            student.profile.atencao,
            student.profile.pedagogico,
          ]
            .filter(Boolean)
            .join(" "),
      },
    }));
  }

  function addIncident() {
    if (!selectedStudent || !incidentDraft.title.trim()) return;

    const incident: Incident = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      type: incidentDraft.type,
      title: incidentDraft.title.trim(),
      notes: incidentDraft.notes.trim(),
    };

    updateStudent(selectedStudent.id, (student) => ({
      ...student,
      incidents: [incident, ...student.incidents],
    }));
    setIncidentDraft({ type: "observacao", title: "", notes: "" });
  }

  async function deleteSelected() {
    if (!selectedStudent) return;

    const next = students.filter((student) => student.id !== selectedStudent.id);
    setStudents(next);
    setSelectedId(next[0]?.id || "");
    setDeleteConfirmId("");

    // Excluir localmente e enfileirar sync
    await deleteStudentLocal(selectedStudent.id);
    await deletePendingAfaAudio(selectedStudent.id).catch(() => undefined);
    setPendingAfaAudio((current) => (current?.studentId === selectedStudent.id ? null : current));
    await queueOfflineOperation({
      entityType: "student",
      entityId: selectedStudent.id,
      operationType: "DELETE",
      payload: null,
    });

    if (cloudMode && user) {
      triggerSync(user.uid);
    }

    setMessage(`Ficha de ${selectedStudent.name} excluída.`);
  }

  async function downloadBackup() {
    try {
      const dbStudents = await getStudentsLocal();
      const dbOperations = await getPendingOperations();
      const dbLogs = await getSyncLogs();

      const backup = {
        exportedAt: new Date().toISOString(),
        appName: "AFA Alunos PWA",
        version: "v1.0",
        data: {
          students: dbStudents,
          operations: dbOperations,
          logs: dbLogs,
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `afa-alunos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Backup de segurança exportado com sucesso!");
    } catch (err: any) {
      alert(`Falha ao exportar backup: ${err.message}`);
    }
  }

  async function resolveConflictKeepLocal(op: OfflineOperation) {
    const student = op.payload.localVersion as Student;
    student.updatedAt = new Date().toISOString();
    await saveStudentLocal(student);
    op.status = "pending";
    op.payload = student;
    await updateOfflineOperation(op);
    await addSyncLog("success", `Conflito resolvido: Mantida versão local de ${student.name}`);
    
    getPendingOperations().then((ops) => {
      setPendingSyncCount(ops.length);
      setConflictOperations(ops.filter((o) => o.status === "conflict"));
    });
    
    if (cloudMode && user) triggerSync(user.uid);
  }

  async function resolveConflictKeepServer(op: OfflineOperation) {
    const student = op.payload.serverVersion as Student;
    await saveStudentLocal(student);
    setStudents((prev) => prev.map((s) => (s.id === student.id ? student : s)));
    await deleteOfflineOperation(op.id);
    await addSyncLog("success", `Conflito resolvido: Mantida versão do servidor de ${student.name}`);

    getPendingOperations().then((ops) => {
      setPendingSyncCount(ops.length);
      setConflictOperations(ops.filter((o) => o.status === "conflict"));
    });
  }

  async function resolveConflictMerge(op: OfflineOperation) {
    const local = op.payload.localVersion as Student;
    const server = op.payload.serverVersion as Student;

    const localVistos = local.vistos || [];
    const serverVistos = server.vistos || [];
    const vistosMap = new Map();
    serverVistos.forEach((v) => vistosMap.set(v.id, v));
    localVistos.forEach((v) => vistosMap.set(v.id, v));
    const mergedVistos = Array.from(vistosMap.values());

    const localIncidents = local.incidents || [];
    const serverIncidents = server.incidents || [];
    const incidentsMap = new Map();
    serverIncidents.forEach((i) => incidentsMap.set(i.id, i));
    localIncidents.forEach((i) => incidentsMap.set(i.id, i));
    const mergedIncidents = Array.from(incidentsMap.values());

    const localLogs = local.vistosAuditLogs || [];
    const serverLogs = server.vistosAuditLogs || [];
    const logsMap = new Map();
    serverLogs.forEach((l) => logsMap.set(l.id, l));
    localLogs.forEach((l) => logsMap.set(l.id, l));
    const mergedLogs = Array.from(logsMap.values());

    const mergedStudent: Student = {
      ...local,
      vistos: mergedVistos,
      incidents: mergedIncidents,
      vistosAuditLogs: mergedLogs,
      profile: {
        ...server.profile,
        ...local.profile,
      },
      updatedAt: new Date().toISOString(),
    };

    await saveStudentLocal(mergedStudent);
    setStudents((prev) => prev.map((s) => (s.id === mergedStudent.id ? mergedStudent : s)));

    op.status = "pending";
    op.payload = mergedStudent;
    await updateOfflineOperation(op);
    await addSyncLog("success", `Conflito resolvido: Versões mescladas para ${local.name}`);

    getPendingOperations().then((ops) => {
      setPendingSyncCount(ops.length);
      setConflictOperations(ops.filter((o) => o.status === "conflict"));
    });

    if (cloudMode && user) triggerSync(user.uid);
  }

  async function login() {
    if (!auth) return;
    setMessage("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setMessage(`Erro ao entrar com o Google: ${error.message}`);
    }
  }

  async function logout() {
    if (auth) {
      try {
        await signOut(auth);
        setUser(null);
        setLocalOnly(true);
      } catch (error: any) {
        setMessage(`Erro ao sair: ${error.message}`);
      }
    }
  }

  function exportJson() {
    const backupObj = {
      version: 2,
      students,
      templates: vistosTemplates,
      config: vistosConfig
    };
    downloadFile("afa-alunos-visto.json", JSON.stringify(backupObj, null, 2), "application/json");
  }

  function exportCsv() {
    downloadFile("afa-alunos.csv", buildStudentsCsv(students), "text/csv;charset=utf-8");
  }

  async function copyFamilyBriefing() {
    if (!selectedStudent || !hasProfile(selectedStudent)) {
      setMessage("Preencha ao menos um campo da ficha antes de copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(familyBriefing);
      setMessage("Ficha copiada para a área de transferência.");
    } catch {
      setMessage("Não consegui copiar automaticamente. Selecione o texto da ficha e copie manualmente.");
    }
  }

  function shareFamilyBriefingOnWhatsApp() {
    if (!selectedStudent || !hasProfile(selectedStudent)) {
      setMessage("Preencha ao menos um campo da ficha antes de enviar pelo WhatsApp.");
      return;
    }

    const url = buildWhatsAppShareUrl(familyBriefing);
    if (!url) return;

    window.open(url, "_blank", "noopener,noreferrer");
    setMessage("Abri o WhatsApp com a ficha pronta para revisão e envio.");
  }

  const familyBriefing = selectedStudent ? buildFamilyBriefing(selectedStudent) : "";
  const selectedCompletion = selectedStudent ? getProfileCompletion(selectedStudent) : null;
  const pageTitle =
    page === "turmas"
      ? "Turmas"
      : page === "alunos"
        ? classFilter === "todas"
          ? "Alunos"
          : `Turma ${classFilter}`
        : page === "vistos"
          ? "Visto Virtual"
          : "Ficha do aluno";
  const pageSubtitle =
    page === "turmas"
      ? "Escolha uma unidade e uma turma antes de abrir as fichas."
      : page === "alunos"
        ? `${campusFilter === "todas" ? "Todas as unidades" : campusFilter} · ${
            classFilter === "todas" ? "todas as turmas" : classFilter
          }`
        : page === "vistos"
          ? "Acompanhamento de vistos por atividade, participação e pontuação pedagógica."
          : selectedStudent
            ? `${selectedStudent.campus || "Não definido"} · ${selectedStudent.className || "Sem turma"}`
            : "Abra um aluno para montar a ficha.";

  if (!user && !localOnly) {
    return (
      <main className="login-screen">
        <div className="login-card animate-fade-in">
          <div className="login-logo">
            <ClipboardList size={40} />
          </div>
          <h1>AFA Alunos</h1>
          <p>Painel de acompanhamento formativo dos alunos.</p>
          
          <div className="login-input-group">
            <button className="google-login-btn" onClick={login}>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Entrar com o Google
            </button>
            <button className="local-login-btn" onClick={() => setLocalOnly(true)}>
              Usar modo local
            </button>
          </div>
          
          {message && <div className="login-message">{message}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ClipboardList size={22} />
          </div>
          <div>
            <strong>AFA Alunos</strong>
            <span>{cloudMode ? "Salvando online" : "Modo local"}</span>
          </div>
        </div>

        <section className="login-strip">
          <Cloud size={17} />
          {auth ? (
            user && !localOnly ? (
              <>
                <span>{user.email}</span>
                <button className="icon-button" onClick={logout} title="Sair">
                  <X size={16} />
                </button>
              </>
            ) : localOnly ? (
              <>
                <span>Modo local ativo</span>
                <button onClick={login}>
                  <LogIn size={16} />
                  Entrar online
                </button>
              </>
            ) : (
              <div className="login-form">
                <button onClick={login}>
                  <LogIn size={16} />
                  Entrar com Google
                </button>
                <button className="ghost" onClick={() => setLocalOnly(true)}>
                  Usar local
                </button>
              </div>
            )
          ) : (
            <span>Configure o Firebase para login</span>
          )}
        </section>

        <label className="upload-zone">
          <Upload size={20} />
          <span>{importing ? "Lendo PDFs..." : "Importar PDFs"}</span>
          <input
            aria-label="Importar PDFs com alunos"
            type="file"
            accept="application/pdf"
            multiple
            onChange={(event) => handlePdfImport(event.target.files)}
          />
        </label>

        <div className="manual-add">
          <input
            aria-label="Nome do aluno"
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            placeholder="Nome do aluno"
          />
          <input
            aria-label="Turma do aluno"
            value={manualClass}
            onChange={(event) => setManualClass(event.target.value)}
            placeholder="Turma"
          />
          <select
            aria-label="Unidade do aluno"
            value={manualCampus}
            onChange={(event) => setManualCampus(event.target.value)}
          >
            <option value="São Lourenço">São Lourenço</option>
            <option value="Igarassu">Igarassu</option>
            <option value="Não definido">Não definido</option>
          </select>
          <button onClick={addManualStudent}>
            <Plus size={16} />
            Adicionar
          </button>
        </div>

        <nav className="page-tabs" aria-label="Navegação principal">
          <button className={page === "turmas" ? "selected" : ""} type="button" onClick={showAllClasses}>
            <LayoutDashboard size={16} />
            Turmas
          </button>
          <button className={page === "alunos" ? "selected" : ""} type="button" onClick={() => setPage("alunos")}>
            <Users size={16} />
            Alunos
          </button>
          <button
            className={page === "ficha" ? "selected" : ""}
            disabled={!selectedStudent}
            type="button"
            onClick={() => selectedStudent && setPage("ficha")}
          >
            <ClipboardList size={16} />
            Ficha
          </button>
          <button
            className={page === "vistos" ? "selected" : ""}
            type="button"
            onClick={() => setPage("vistos")}
          >
            <Award size={16} />
            Vistos
          </button>
          <button
            className={page === "sync" ? "selected" : ""}
            type="button"
            onClick={() => setPage("sync")}
          >
            <Cloud size={16} />
            Sincronização {pendingSyncCount > 0 && <span className="pending-sync-badge">{pendingSyncCount}</span>}
          </button>
        </nav>

        {page === "alunos" && (
          <>
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Buscar aluno ou tag"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar aluno ou tag"
          />
        </div>

        <div className="student-navigation">
          <div className="nav-label">
            <Cloud size={16} />
            <span>Unidades</span>
          </div>
          <div className="campus-tabs" role="tablist" aria-label="Filtrar por unidade">
            {campusNavItems.map((item) => (
              <button
                className={campusFilter === item.value ? "selected" : ""}
                key={item.value}
                onClick={() => {
                  if (item.value === "todas") {
                    setCampusFilter("todas");
                    setClassFilter("todas");
                    setPage("alunos");
                    return;
                  }
                  selectCohort(item.value);
                }}
                type="button"
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>

          <div className="nav-label">
            <Filter size={16} />
            <span>Turmas</span>
          </div>
          <div className="class-groups" aria-label="Filtrar por turma">
            {classNavGroups.map((group) => (
              <div className="class-group" key={group.campus}>
                {campusFilter === "todas" && <strong>{group.campus}</strong>}
                <div className="class-grid">
                  {group.items.map((item) => (
                    <button
                      className={campusFilter === group.campus && classFilter === item.value ? "selected" : ""}
                      key={`${group.campus}-${item.value}`}
                      onClick={() => selectCohort(group.campus, item.value)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <AlertTriangle size={16} />
          <select
            aria-label="Filtrar por nível de atenção"
            value={alertFilter}
            onChange={(event) => setAlertFilter(event.target.value as AlertLevel | "todos")}
          >
            <option value="todos">Todos os níveis</option>
            {Object.entries(alertLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-row">
          <ClipboardList size={16} />
          <select
            aria-label="Filtrar por status da ficha"
            value={profileFilter}
            onChange={(event) => setProfileFilter(event.target.value as ProfileFilter)}
          >
            <option value="todos">Todas as fichas</option>
            <option value="com-ficha">Com ficha iniciada</option>
            <option value="completa">Ficha completa</option>
            <option value="incompleta">Ficha incompleta</option>
            <option value="sem-ficha">Sem ficha iniciada</option>
          </select>
        </div>

          </>
        )}

        {page === "ficha" && selectedStudent && (
          <div className="current-student-card">
            <span>Ficha aberta</span>
            <strong>{selectedStudent.name}</strong>
            <small>
              {selectedStudent.campus || "Não definido"} · {selectedStudent.className || "Sem turma"}
            </small>
            <button type="button" onClick={() => setPage("alunos")}>
              <Users size={16} />
              Ver alunos da turma
            </button>
            <div className="queue-controls">
              <label>
                Fila
                <select
                  aria-label="Fila de trabalho"
                  value={queueMode}
                  onChange={(event) => setQueueMode(event.target.value as QueueMode)}
                >
                  <option value="filtro-atual">Filtro atual</option>
                  <option value="sem-ficha">Sem ficha</option>
                  <option value="incompleta">Incompletas</option>
                  <option value="prioridade">Prioridade</option>
                  <option value="sem-vistos">Sem vistos</option>
                  <option value="nao-sincronizados">Nao sincronizados</option>
                </select>
              </label>
              <span>
                {queueIndex >= 0 ? `${queueIndex + 1}/${studentQueue.length}` : `0/${studentQueue.length}`}
              </span>
            </div>
            <div className="queue-actions">
              <button type="button" onClick={() => openQueueOffset(-1)} disabled={queueIndex <= 0}>
                Anterior
              </button>
              <button type="button" onClick={saveAndNext} disabled={queueIndex < 0 || queueIndex >= studentQueue.length - 1}>
                Salvar e proximo
              </button>
            </div>
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setCommandOpen(true)}>
              <Search size={16} />
              Ctrl+K
            </button>
            <button type="button" className="ghost" onClick={() => openQuickIncident(selectedStudent?.id)} disabled={students.length === 0}>
              <PlusCircle size={16} />
              Ocorrencia
            </button>
            <button onClick={exportCsv}>
              <Download size={16} />
              CSV
            </button>
            <button onClick={exportJson}>
              <Download size={16} />
              Backup
            </button>
            <label className="file-action">
              <Upload size={16} />
              Restaurar
              <input
                aria-label="Restaurar backup JSON"
                type="file"
                accept="application/json"
                onChange={(event) => {
                  void handleBackupImport(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </header>

        {message && (
          <div className="message">
            <Check size={16} />
            {message}
          </div>
        )}

        {page === "turmas" && (
          <>
        <section className="metrics">
          <Metric icon={<Users size={19} />} label="Alunos" value={students.length} />
          <Metric icon={<LayoutDashboard size={19} />} label="Iniciadas" value={stats.withRecords} />
          <Metric icon={<ClipboardList size={19} />} label="Completas" value={stats.complete} />
          <Metric icon={<AlertTriangle size={19} />} label="Prioridade" value={stats.priority} />
          <Metric icon={<BookOpen size={19} />} label="Registros" value={stats.incidents} />
        </section>

        <section className="unit-board" aria-label="Navegação por unidade e turma">
          <section className="pending-grid" aria-label="Painel de pendencias">
            <button
              type="button"
              className="pending-card"
              onClick={() => {
                setProfileFilter("sem-ficha");
                setQueueMode("sem-ficha");
                setPage("alunos");
              }}
            >
              <span>Sem ficha</span>
              <strong>{pendingDashboard.withoutProfile.length}</strong>
              <small>Abrir fila de alunos ainda sem panorama.</small>
            </button>
            <button
              type="button"
              className="pending-card"
              onClick={() => {
                setProfileFilter("incompleta");
                setQueueMode("incompleta");
                setPage("alunos");
              }}
            >
              <span>Incompletas</span>
              <strong>{pendingDashboard.incomplete.length}</strong>
              <small>Priorizar fichas com campos essenciais pendentes.</small>
            </button>
            <button
              type="button"
              className="pending-card"
              onClick={() => {
                setQueueMode("sem-vistos");
                setPage("alunos");
              }}
            >
              <span>Sem vistos</span>
              <strong>{pendingDashboard.withoutVistos.length}</strong>
              <small>Conferir alunos sem registro de vistos.</small>
            </button>
            <button
              type="button"
              className="pending-card"
              onClick={() => {
                setQueueMode("nao-sincronizados");
                setPage("alunos");
              }}
            >
              <span>Nao sincronizados</span>
              <strong>{pendingDashboard.notSynced.length}</strong>
              <small>Preparar envio para o NotasEdit.</small>
            </button>
            <button
              type="button"
              className="pending-card"
              onClick={() => {
                setAlertFilter("prioridade");
                setQueueMode("prioridade");
                setPage("alunos");
              }}
            >
              <span>Baixo comportamento</span>
              <strong>{pendingDashboard.lowBehavior.length}</strong>
              <small>Revisar alunos abaixo de 1,2 no semestre.</small>
            </button>
          </section>

          <div className="section-heading">
            <div>
              <span>Entrada por turma</span>
              <h2>Escolha a unidade e abra uma turma</h2>
            </div>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setCampusFilter("todas");
                setClassFilter("todas");
              }}
            >
              Ver todos
            </button>
          </div>

          {students.length === 0 ? (
            <section className="empty-state empty-state-compact">
              <Users size={32} />
              <h2>Nenhum aluno cadastrado ainda.</h2>
              <p>Importe PDFs ou cadastre um aluno manualmente para visualizar as turmas.</p>
            </section>
          ) : (
            <div className="unit-columns">
              {classOverview.map((group) => (
                <article
                  className={`unit-column ${campusFilter === group.campus ? "active" : ""}`}
                  key={group.campus}
                >
                  <div className="unit-column-header">
                    <div>
                      <strong>{group.campus}</strong>
                      <span>{group.count} alunos</span>
                    </div>
                    <button type="button" onClick={() => selectCohort(group.campus)}>
                      Abrir unidade
                    </button>
                  </div>

                  <div className="cohort-list">
                    {group.classes.map((classItem) => (
                      <button
                        className={
                          campusFilter === group.campus && classFilter === classItem.name
                            ? "cohort-card selected"
                            : "cohort-card"
                        }
                        key={`${group.campus}-${classItem.name}`}
                        onClick={() => selectCohort(group.campus, classItem.name)}
                        type="button"
                      >
                        <span>
                          <strong>{classItem.name}</strong>
                          <small>{classItem.count} alunos</small>
                        </span>
                        <span className="cohort-progress">
                          <span>{classItem.complete} completas</span>
                          <span className="mini-progress" aria-label={`${classItem.percentage}% da turma completa`}>
                            <span style={{ width: `${classItem.percentage}%` }} />
                          </span>
                        </span>
                        <span className="cohort-meta">
                          <small>{classItem.started} iniciadas</small>
                          {classItem.priority > 0 && <small>{classItem.priority} prioridade</small>}
                        </span>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
          </>
        )}

        {page === "alunos" && (
          <section className="panel directory-panel">
            <div className="section-heading">
              <div>
                <span>{campusFilter === "todas" ? "Todas as unidades" : campusFilter}</span>
                <h2>{classFilter === "todas" ? "Alunos" : `Turma ${classFilter}`}</h2>
              </div>
              <button type="button" onClick={showAllClasses}>
                <LayoutDashboard size={16} />
                Voltar para turmas
              </button>
            </div>

            <div className="student-list-header page-list-header">
              <strong>{filteredStudents.length} aluno(s)</strong>
              <span>{students.length ? `${students.length} no total` : "Importe PDFs para começar"}</span>
            </div>

            <div className="student-list directory-list">
              {filteredStudents.map((student) => {
                const completion = getProfileCompletion(student);

                return (
                  <button
                    className={`student-item ${student.id === selectedStudent?.id ? "active" : ""}`}
                    key={student.id}
                    onClick={() => openStudent(student.id)}
                    type="button"
                  >
                    <span className={`status-dot ${student.alertLevel}`} />
                    <span className="student-card-body">
                      <span className="student-card-header">
                        <strong>{student.name}</strong>
                        <span>{completion.percentage}%</span>
                      </span>
                      <span className="student-card-meta">
                        <span>{student.className || "Sem turma"}</span>
                        <span>{student.campus || "Não definido"}</span>
                        <span>{alertLabels[student.alertLevel]}</span>
                      </span>
                      <span className="mini-progress" aria-label={`Ficha ${completion.percentage}% completa`}>
                        <span style={{ width: `${completion.percentage}%` }} />
                      </span>
                    </span>
                  </button>
                );
              })}
              {students.length > 0 && filteredStudents.length === 0 && (
                <div className="empty-list">
                  <strong>Nenhum aluno encontrado</strong>
                  <span>Ajuste a busca ou os filtros para ver outros alunos.</span>
                </div>
              )}
              {students.length === 0 && (
                <div className="empty-list">
                  <strong>Nenhum aluno cadastrado</strong>
                  <span>Importe PDFs ou use o cadastro manual para começar.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {page === "ficha" && (selectedStudent ? (
          <div className="student-grid">
            <section className="panel main-panel">
              <div className="student-header">
                <div>
                  <input
                    aria-label="Nome do aluno selecionado"
                    className="student-name"
                    value={selectedStudent.name}
                    onChange={(event) =>
                      updateStudent(selectedStudent.id, (student) => ({ ...student, name: event.target.value }))
                    }
                  />
                  <div className="student-meta">
                    <input
                      aria-label="Turma do aluno selecionado"
                      value={selectedStudent.className}
                      onChange={(event) =>
                        updateStudent(selectedStudent.id, (student) => ({ ...student, className: event.target.value }))
                      }
                      placeholder="Turma"
                    />
                    <input
                      aria-label="Matrícula do aluno selecionado"
                      value={selectedStudent.registration}
                      onChange={(event) =>
                        updateStudent(selectedStudent.id, (student) => ({ ...student, registration: event.target.value }))
                      }
                      placeholder="Matrícula"
                    />
                    <select
                      aria-label="Unidade do aluno selecionado"
                      value={selectedStudent.campus || "Não definido"}
                      onChange={(event) =>
                        updateStudent(selectedStudent.id, (student) => ({ ...student, campus: event.target.value }))
                      }
                    >
                      <option value="São Lourenço">São Lourenço</option>
                      <option value="Igarassu">Igarassu</option>
                      <option value="Não definido">Não definido</option>
                    </select>
                    <input
                      aria-label="Status escolar do aluno selecionado"
                      value={selectedStudent.status || "Cadastrado"}
                      onChange={(event) =>
                        updateStudent(selectedStudent.id, (student) => ({ ...student, status: event.target.value }))
                      }
                      placeholder="Status"
                    />
                  </div>
                </div>
                {deleteConfirmId === selectedStudent.id ? (
                  <div className="delete-confirm">
                    <span>Excluir ficha?</span>
                    <button type="button" onClick={() => setDeleteConfirmId("")}>
                      Cancelar
                    </button>
                    <button className="danger" type="button" onClick={deleteSelected}>
                      <Trash2 size={16} />
                      Confirmar
                    </button>
                  </div>
                ) : (
                  <button className="danger" onClick={() => setDeleteConfirmId(selectedStudent.id)}>
                    <Trash2 size={16} />
                    Excluir
                  </button>
                )}
              </div>

              <section className="student-360-grid" aria-label="Visao geral do aluno">
                <div className="student-360-card">
                  <span>Comportamento bimestral</span>
                  <strong>{selectedNotasEditRow ? selectedNotasEditRow.behaviorScore.toFixed(1) : "0.0"} / 2,0</strong>
                  <small>{getNotasEditBimesterLabel(notasEditBimester)}</small>
                </div>
                <div className="student-360-card">
                  <span>Vistos</span>
                  <strong>{selectedNotasEditRow ? selectedNotasEditRow.vistosScore.toFixed(1) : "0.0"} / 3,0</strong>
                  <small>
                    {selectedNotasEditRow
                      ? `${selectedNotasEditRow.completedVistos}/${selectedNotasEditRow.expectedVistos} feitos`
                      : "Sem base no periodo"}
                  </small>
                </div>
                <div className="student-360-card">
                  <span>Tendencia</span>
                  <strong>{selectedEvolution?.trend ?? "estavel"}</strong>
                  <small>
                    Mes {selectedEvolution?.monthBalance ?? 0} · bimestre {selectedEvolution?.bimesterBalance ?? 0}
                  </small>
                </div>
                <div className="student-360-card">
                  <span>Ultimos 30 dias</span>
                  <strong>{selectedEvolution?.recentIncidents ?? 0}</strong>
                  <small>{selectedEvolution?.attentionCount ?? 0} registros de atencao</small>
                </div>
                <div className="student-360-card">
                  <span>NotasEdit</span>
                  <strong>{selectedStudent.notasEdit?.syncedAt ? "Sincronizado" : "Pendente"}</strong>
                  <small>
                    {selectedStudent.notasEdit?.syncedAt
                      ? new Date(selectedStudent.notasEdit.syncedAt).toLocaleDateString("pt-BR")
                      : "Aguardando envio"}
                  </small>
                </div>
              </section>

              <div className="ficha-tabs">
                <button
                  className={fichaTab === "perfil" ? "active" : ""}
                  onClick={() => setFichaTab("perfil")}
                  type="button"
                >
                  <UserRound size={16} />
                  Perfil & Acompanhamento
                </button>
                <button
                  className={fichaTab === "vistos" ? "active" : ""}
                  onClick={() => setFichaTab("vistos")}
                  type="button"
                >
                  <Award size={16} />
                  Visto Virtual ({selectedStudent.vistos?.length ?? 0})
                </button>
              </div>

              {fichaTab === "perfil" ? (
                <>
                  <section className="audio-afa-card">
                    <div>
                      <span>Preenchimento rapido por audio</span>
                      <strong>Ditado AFA</strong>
                      <small>Grave ou cole uma transcricao para gerar um rascunho da ficha.</small>
                    </div>
                    <button className="primary" type="button" onClick={openAudioAfa}>
                      <Mic size={16} />
                      Abrir ditado
                    </button>
                  </section>

                  <div className="quick-row">
                    {quickProfiles.map((profile) => (
                      <div className="quick-profile-card" key={profile.label}>
                        <button type="button" onClick={() => applyQuickProfile(profile)}>
                          {profile.label}
                        </button>
                        <button type="button" className="ghost" onClick={() => applyQuickProfileAndNext(profile)}>
                          Aplicar e proximo
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="level-row">
                    {Object.entries(alertLabels).map(([value, label]) => (
                      <button
                        key={value}
                        className={selectedStudent.alertLevel === value ? "selected" : ""}
                        onClick={() =>
                          updateStudent(selectedStudent.id, (student) => ({ ...student, alertLevel: value as AlertLevel }))
                        }
                      >
                        <span className={`status-dot ${value}`} />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="quick-incident-strip" aria-label="Ocorrencias rapidas">
                    <span>Registro rapido</span>
                    <button type="button" onClick={() => addQuickIncident("Participou bem", "positivo")}>
                      Participou bem
                    </button>
                    <button type="button" onClick={() => addQuickIncident("Nao fez atividade", "pedagogico")}>
                      Nao fez atividade
                    </button>
                    <button type="button" onClick={() => addQuickIncident("Convivencia precisa de atencao", "social")}>
                      Convivencia
                    </button>
                    <button type="button" onClick={() => addQuickIncident("Familia acionada", "familia")}>
                      Familia acionada
                    </button>
                    <button type="button" onClick={() => openQuickIncident(selectedStudent.id)}>
                      <Plus size={14} />
                      Outro
                    </button>
                  </div>

                  {selectedCompletion && (
                    <div className="completion-box">
                      <div>
                        <strong>Progresso da ficha</strong>
                        <span>
                          {selectedCompletion.completed}/{selectedCompletion.total} campos essenciais ·{" "}
                          {selectedCompletion.percentage}%
                        </span>
                      </div>
                      <div className="completion-track" aria-label={`Ficha ${selectedCompletion.percentage}% completa`}>
                        <span style={{ width: `${selectedCompletion.percentage}%` }} />
                      </div>
                      {!selectedCompletion.isComplete && (
                        <p>Falta preencher: {selectedCompletion.missingLabels.join(", ")}.</p>
                      )}
                    </div>
                  )}

                  <ProfileField
                    label="Resumo rápido"
                    value={selectedStudent.profile.resumoRapido}
                    onChange={(value) => updateProfile(selectedStudent.id, "resumoRapido", value)}
                    groups={profilePhraseBank.resumoRapido}
                    placeholder="Uma síntese em 2 ou 3 frases para abrir a conversa com a família."
                  />
                  <div className="field-grid">
                    <ProfileField
                      label="Perfil observado"
                      value={selectedStudent.profile.personalidade}
                      onChange={(value) => updateProfile(selectedStudent.id, "personalidade", value)}
                      groups={profilePhraseBank.personalidade}
                    />
                    <ProfileField
                      label="Aspectos positivos"
                      value={selectedStudent.profile.positivos}
                      onChange={(value) => updateProfile(selectedStudent.id, "positivos", value)}
                      groups={profilePhraseBank.positivos}
                    />
                    <ProfileField
                      label="Pontos de atenção"
                      value={selectedStudent.profile.atencao}
                      onChange={(value) => updateProfile(selectedStudent.id, "atencao", value)}
                      groups={profilePhraseBank.atencao}
                    />
                    <ProfileField
                      label="Social"
                      value={selectedStudent.profile.social}
                      onChange={(value) => updateProfile(selectedStudent.id, "social", value)}
                      groups={profilePhraseBank.social}
                    />
                    <ProfileField
                      label="Pedagógico"
                      value={selectedStudent.profile.pedagogico}
                      onChange={(value) => updateProfile(selectedStudent.id, "pedagogico", value)}
                      groups={profilePhraseBank.pedagogico}
                    />
                    <ProfileField
                      label="Precisa melhorar"
                      value={selectedStudent.profile.melhorar}
                      onChange={(value) => updateProfile(selectedStudent.id, "melhorar", value)}
                      groups={profilePhraseBank.melhorar}
                    />
                    <ProfileField
                      label="Precisa manter"
                      value={selectedStudent.profile.manter}
                      onChange={(value) => updateProfile(selectedStudent.id, "manter", value)}
                      groups={profilePhraseBank.manter}
                    />
                    <ProfileField
                      label="Apoio da família"
                      value={selectedStudent.profile.apoioFamilia}
                      onChange={(value) => updateProfile(selectedStudent.id, "apoioFamilia", value)}
                      groups={profilePhraseBank.apoioFamilia}
                    />
                  </div>
                </>
              ) : (
                <div className="vistos-student-panel">
                  {(() => {
                    const studentVistos = selectedStudent.vistos ?? [];
                    const { balanceAll, balanceMonth, balanceBimester, calculatedPoints } = calculateStudentVistoMetrics(studentVistos, vistosConfig);
                    const indicators = generateVistoIndicators(studentVistos);

                    return (
                      <>
                        <div className="vistos-metrics-grid">
                          <div className="vistos-metric-card">
                            <span>Saldo Total</span>
                            <strong>{balanceAll > 0 ? `+${balanceAll}` : balanceAll}</strong>
                          </div>
                          <div className="vistos-metric-card">
                            <span>Saldo no Mês</span>
                            <strong>{balanceMonth > 0 ? `+${balanceMonth}` : balanceMonth}</strong>
                          </div>
                          <div className="vistos-metric-card">
                            <span>Saldo no Bimestre</span>
                            <strong>{balanceBimester > 0 ? `+${balanceBimester}` : balanceBimester}</strong>
                          </div>
                          {vistosConfig.convertPoints && (
                            <div className="vistos-metric-card highlight">
                              <span>Pontos Bimestrais</span>
                              <strong>{calculatedPoints.toFixed(1)} / {vistosConfig.maxPointsPerBimester.toFixed(1)}</strong>
                            </div>
                          )}
                        </div>

                        <div className="vistos-pedagogico-card">
                          <h3><Sparkles size={16} /> Acompanhamento de Vistos & AFA</h3>
                          <div className="vistos-indicators">
                            {indicators.length > 0 ? (
                              indicators.map(ind => (
                                <span key={ind} className={`badge-indicator ${ind.toLowerCase().replace(/\s/g, "-")}`}>
                                  {ind}
                                </span>
                              ))
                            ) : (
                              <span className="badge-indicator neutral">Sem alertas ou destaques</span>
                            )}
                          </div>
                          
                          {studentVistos.length > 0 && (
                            <div className="vistos-phrase-editor">
                              <label htmlFor="afa-vistos-phrase-text">
                                Recomendação Automática (Edite se necessário):
                              </label>
                              <textarea
                                id="afa-vistos-phrase-text"
                                value={editedVistosPhrase}
                                onChange={(e) => setEditedVistosPhrase(e.target.value)}
                                placeholder="Nenhuma frase gerada."
                                rows={2}
                              />
                              <button
                                type="button"
                                className="primary"
                                onClick={() => {
                                  if (!editedVistosPhrase.trim()) return;
                                  updateProfile(selectedStudent.id, "pedagogico", appendPhrase(selectedStudent.profile.pedagogico, editedVistosPhrase));
                                  setMessage("Recomendação de vistos incorporada ao relatório pedagógico do aluno!");
                                }}
                              >
                                <Sparkles size={14} /> Adicionar à Ficha Pedagógica
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="quick-add-visto-form">
                          <h3>Registrar Visto Individual</h3>
                          <div className="visto-form-row">
                            <input
                              aria-label="Atividade"
                              type="text"
                              placeholder="Nome da atividade (ex: Ficha de Frações)"
                              id="manual-visto-title"
                            />
                            <input
                              aria-label="Data"
                              type="date"
                              defaultValue={new Date().toISOString().slice(0, 10)}
                              id="manual-visto-date"
                            />
                            <select aria-label="Tipo" id="manual-visto-type">
                              <option value="classe">Classe</option>
                              <option value="casa">Casa</option>
                              <option value="ficha">Ficha</option>
                              <option value="participacao">Participação</option>
                              <option value="extra">Bônus</option>
                              <option value="pendencia">Pendência</option>
                            </select>
                            <input
                              aria-label="Vistos"
                              type="number"
                              defaultValue={1}
                              step={vistosConfig.allowDecimal ? "0.1" : "1"}
                              id="manual-visto-value"
                            />
                            <select aria-label="Status" id="manual-visto-status">
                              <option value="feito">Feito</option>
                              <option value="parcial">Parcial</option>
                              <option value="não fez">Não fez</option>
                              <option value="ausente">Ausente</option>
                              <option value="entregou">Entregou</option>
                              <option value="pendente">Pendente</option>
                              <option value="justificado">Justificado</option>
                            </select>
                            <input
                              aria-label="Observação"
                              type="text"
                              placeholder="Observação (opcional)"
                              id="manual-visto-note"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const titleEl = document.getElementById("manual-visto-title") as HTMLInputElement;
                                const dateEl = document.getElementById("manual-visto-date") as HTMLInputElement;
                                const typeEl = document.getElementById("manual-visto-type") as HTMLSelectElement;
                                const valEl = document.getElementById("manual-visto-value") as HTMLInputElement;
                                const statEl = document.getElementById("manual-visto-status") as HTMLSelectElement;
                                const noteEl = document.getElementById("manual-visto-note") as HTMLInputElement;
                                
                                if (!titleEl.value.trim()) {
                                  alert("Preencha o título da atividade.");
                                  return;
                                }

                                addManualVisto(selectedStudent.id, {
                                  title: titleEl.value,
                                  date: dateEl.value,
                                  activityType: typeEl.value,
                                  value: Number(valEl.value),
                                  status: statEl.value as VirtualCheckStatus,
                                  note: noteEl.value
                                });

                                titleEl.value = "";
                                noteEl.value = "";
                                setMessage(`Visto para "${selectedStudent.name}" registrado.`);
                              }}
                            >
                              <Plus size={16} /> Salvar
                            </button>
                          </div>
                        </div>

                        <div className="vistos-list-container">
                          <h3>Registros de Vistos</h3>
                          {studentVistos.length === 0 ? (
                            <p className="empty-vistos-message">Nenhum visto registrado para este aluno.</p>
                          ) : (
                            <div className="table-responsive">
                              <table className="vistos-table">
                                <thead>
                                  <tr>
                                    <th>Data</th>
                                    <th>Atividade</th>
                                    <th>Tipo</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Observação</th>
                                    <th>Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {studentVistos.map((visto) => {
                                    const isEditing = editingVistoId === visto.id;
                                    return (
                                      <tr key={visto.id}>
                                        <td>
                                          {isEditing ? (
                                            <input type="date" defaultValue={visto.date} id={`edit-visto-date-${visto.id}`} />
                                          ) : (
                                            formatDate(visto.date)
                                          )}
                                        </td>
                                        <td>
                                          {isEditing ? (
                                            <input type="text" defaultValue={visto.sessionTitle} id={`edit-visto-title-${visto.id}`} />
                                          ) : (
                                            visto.sessionTitle
                                          )}
                                        </td>
                                        <td>
                                          {isEditing ? (
                                            <select defaultValue={visto.activityType} id={`edit-visto-type-${visto.id}`}>
                                              <option value="classe">Classe</option>
                                              <option value="casa">Casa</option>
                                              <option value="ficha">Ficha</option>
                                              <option value="participacao">Participação</option>
                                              <option value="extra">Bônus</option>
                                              <option value="pendencia">Pendência</option>
                                            </select>
                                          ) : (
                                            <span className={`badge-type ${visto.activityType}`}>{visto.activityType}</span>
                                          )}
                                        </td>
                                        <td>
                                          {isEditing ? (
                                            <input type="number" defaultValue={visto.value} step={vistosConfig.allowDecimal ? "0.1" : "1"} id={`edit-visto-value-${visto.id}`} />
                                          ) : (
                                            <strong className={visto.value > 0 ? "positive-val" : visto.value < 0 ? "negative-val" : ""}>
                                              {visto.value > 0 ? `+${visto.value}` : visto.value}
                                            </strong>
                                          )}
                                        </td>
                                        <td>
                                          {isEditing ? (
                                            <select defaultValue={visto.status} id={`edit-visto-status-${visto.id}`}>
                                              <option value="feito">Feito</option>
                                              <option value="parcial">Parcial</option>
                                              <option value="não fez">Não fez</option>
                                              <option value="ausente">Ausente</option>
                                              <option value="entregou">Entregou</option>
                                              <option value="pendente">Pendente</option>
                                              <option value="justificado">Justificado</option>
                                            </select>
                                          ) : (
                                            <span className={`badge-status ${visto.status}`}>{visto.status}</span>
                                          )}
                                        </td>
                                        <td>
                                          {isEditing ? (
                                            <input type="text" defaultValue={visto.note || ""} id={`edit-visto-note-${visto.id}`} />
                                          ) : (
                                            visto.note || <span className="no-note">-</span>
                                          )}
                                        </td>
                                        <td>
                                          <div className="table-actions">
                                            {isEditing ? (
                                              <>
                                                <button
                                                  type="button"
                                                  className="primary"
                                                  onClick={() => {
                                                    const dateVal = (document.getElementById(`edit-visto-date-${visto.id}`) as HTMLInputElement).value;
                                                    const titleVal = (document.getElementById(`edit-visto-title-${visto.id}`) as HTMLInputElement).value;
                                                    const typeVal = (document.getElementById(`edit-visto-type-${visto.id}`) as HTMLSelectElement).value;
                                                    const valueVal = Number((document.getElementById(`edit-visto-value-${visto.id}`) as HTMLInputElement).value);
                                                    const statusVal = (document.getElementById(`edit-visto-status-${visto.id}`) as HTMLSelectElement).value as VirtualCheckStatus;
                                                    const noteVal = (document.getElementById(`edit-visto-note-${visto.id}`) as HTMLInputElement).value;
                                                    const reason = prompt("Motivo da alteração (opcional):") || "Edição manual";

                                                    updateManualVisto(selectedStudent.id, visto.id, valueVal, statusVal, noteVal, reason);
                                                    
                                                    setStudents(prev => prev.map(s => {
                                                      if (s.id !== selectedStudent.id) return s;
                                                      const updatedVistos = s.vistos?.map(v => {
                                                        if (v.id === visto.id) {
                                                          return {
                                                            ...v,
                                                            date: dateVal,
                                                            sessionTitle: titleVal,
                                                            activityType: typeVal,
                                                          };
                                                        }
                                                        return v;
                                                      });
                                                      return { ...s, vistos: updatedVistos };
                                                    }));

                                                    setEditingVistoId(null);
                                                    setMessage("Visto atualizado.");
                                                  }}
                                                >
                                                  Salvar
                                                </button>
                                                <button type="button" onClick={() => setEditingVistoId(null)}>Cancelar</button>
                                              </>
                                            ) : (
                                              <>
                                                <button type="button" onClick={() => setEditingVistoId(visto.id)}>
                                                  <Edit size={14} /> Editar
                                                </button>
                                                <button
                                                  type="button"
                                                  className="danger"
                                                  onClick={() => {
                                                    const reason = prompt("Motivo da exclusão (opcional):") || "Exclusão manual";
                                                    deleteManualVisto(selectedStudent.id, visto.id, reason);
                                                    setMessage("Visto removido.");
                                                  }}
                                                >
                                                  <Trash2 size={14} /> Excluir
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {selectedStudent.vistosAuditLogs && selectedStudent.vistosAuditLogs.length > 0 && (
                          <div className="vistos-audit-log-container">
                            <h3>Logs de Auditoria</h3>
                            <div className="audit-timeline">
                              {selectedStudent.vistosAuditLogs.map((log) => (
                                <div key={log.id} className="audit-log-item">
                                  <small>{formatDate(log.createdAt)} às {new Date(log.createdAt).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})}</small>
                                  <p>
                                    Ação: <strong>{log.action === "update" ? "Edição" : log.action === "delete" ? "Exclusão" : "Criação"}</strong>.
                                    {log.action === "update" && (
                                      <span> Alterado valor de {log.oldValue} para {log.newValue} (Status: {log.oldStatus} para {log.newStatus}).</span>
                                    )}
                                    {log.action === "delete" && (
                                      <span> Removido visto de valor {log.oldValue} ({log.oldStatus}).</span>
                                    )}
                                    {log.reason && <span> Motivo: <em>"{log.reason}"</em></span>}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </section>

            <aside className="panel briefing-panel">
              <div className="panel-title">
                <UserRound size={18} />
                <h2>Ficha para os pais</h2>
              </div>
              <textarea className="briefing" value={familyBriefing} readOnly />
              <div className="actions stacked">
                <button onClick={generateSummary}>
                  <FilePlus size={16} />
                  Montar resumo
                </button>
                <button onClick={copyFamilyBriefing}>
                  <Copy size={16} />
                  Copiar ficha
                </button>
                <button onClick={shareFamilyBriefingOnWhatsApp}>
                  <MessageCircle size={16} />
                  WhatsApp
                </button>
              </div>

              <div className="incident-box">
                <h3>Registro rápido</h3>
                <select
                  aria-label="Tipo do registro"
                  value={incidentDraft.type}
                  onChange={(event) =>
                    setIncidentDraft((current) => ({ ...current, type: event.target.value as Incident["type"] }))
                  }
                >
                  {Object.entries(incidentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Título do registro"
                  value={incidentDraft.title}
                  onChange={(event) => setIncidentDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Título do registro"
                />
                <textarea
                  aria-label="Detalhe do registro"
                  value={incidentDraft.notes}
                  onChange={(event) => setIncidentDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Detalhe curto"
                />
                <PhrasePicker
                  groups={incidentPhraseBank}
                  onPick={(phrase) =>
                    setIncidentDraft((current) => ({
                      ...current,
                      notes: appendPhrase(current.notes, phrase),
                    }))
                  }
                />
                <button onClick={addIncident}>
                  <Plus size={16} />
                  Salvar registro
                </button>
              </div>

              <div className="timeline">
                {selectedStudent.incidents.map((incident) => (
                  <article key={incident.id}>
                    <small>
                      {incidentLabels[incident.type]} · {formatDate(incident.date)}
                    </small>
                    <strong>{incident.title}</strong>
                    {incident.notes && <p>{incident.notes}</p>}
                  </article>
                ))}
              </div>
            </aside>
          </div>
        ) : (
          <section className="empty-state">
            <Users size={38} />
            <h2>Comece importando PDFs ou cadastrando um aluno.</h2>
            <p>Depois disso, cada aluno aparece na lista lateral para montar a ficha em poucos passos.</p>
          </section>
        ))}

        {page === "vistos" && (
          <div className="vistos-view-container animate-fade-in">
            {/* Seen subpage navigation header */}
            <div className="vistos-sub-navigation">
              <button
                className={vistosSubPage === "dashboard" ? "active" : ""}
                onClick={() => setVistosSubPage("dashboard")}
                type="button"
              >
                <LayoutDashboard size={16} /> Painel Geral
              </button>
              <button
                className={vistosSubPage === "lancamento" ? "active" : ""}
                onClick={() => {
                  if (!currentSession) {
                    const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
                    setCurrentSession({
                      id: crypto.randomUUID(),
                      className: classes[0] || "",
                      title: "",
                      date: new Date().toISOString().slice(0, 10),
                      activityType: "classe",
                      defaultValue: 1,
                      defaultStatus: "feito",
                      entries: {},
                    });
                  }
                  setVistosSubPage("lancamento");
                  setLancamentoSearch("");
                  setFocusedStudentId(null);
                }}
                type="button"
              >
                <PlusCircle size={16} /> Lançar Vistos
              </button>
              <button
                className={vistosSubPage === "templates" ? "active" : ""}
                onClick={() => setVistosSubPage("templates")}
                type="button"
              >
                <FileText size={16} /> Modelos (Templates)
              </button>
              <button
                className={vistosSubPage === "relatorios" ? "active" : ""}
                onClick={() => {
                  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
                  setReportClass(classes[0] || "todas");
                  setVistosSubPage("relatorios");
                }}
                type="button"
              >
                <Copy size={16} /> Relatórios & Cópia
              </button>
              <button
                className={vistosSubPage === "config" ? "active" : ""}
                onClick={() => setVistosSubPage("config")}
                type="button"
              >
                <Settings size={16} /> Configurações
              </button>
            </div>

            {/* subPage === dashboard */}
            {vistosSubPage === "dashboard" && (() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const totalToday = students.reduce((acc, s) => acc + (s.vistos?.filter((v) => v.date === todayStr).length ?? 0), 0);
              
              const currentMonthPrefix = new Date().toISOString().slice(0, 7);
              const totalThisMonth = students.reduce((acc, s) => acc + (s.vistos?.filter((v) => v.date.startsWith(currentMonthPrefix)).length ?? 0), 0);

              // Calculate balances
              const studentBalances = students.map((s) => {
                const monthly = s.vistos?.filter((v) => v.date.startsWith(currentMonthPrefix)) ?? [];
                const balance = monthly.reduce((sum, v) => sum + v.value, 0);
                return { id: s.id, name: s.name, className: s.className, balance };
              });

              const topThree = [...studentBalances]
                .filter((x) => x.balance > 0)
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 5);

              const bottomThree = [...studentBalances]
                .filter((s) => s.className) // only students with class
                .sort((a, b) => a.balance - b.balance)
                .slice(0, 5);

              // Unique recent activities/sessions
              const allEntries = students.flatMap((s) => (s.vistos ?? []).map((v) => ({ ...v, studentId: s.id, studentName: s.name })));
              const sessionMap = new Map<string, { id: string; className: string; title: string; date: string; activityType: string; count: number }>();
              
              allEntries.forEach((entry) => {
                const student = students.find((s) => s.id === entry.studentId);
                const className = student?.className ?? "Sem turma";
                if (!sessionMap.has(entry.sessionId)) {
                  sessionMap.set(entry.sessionId, {
                    id: entry.sessionId,
                    className,
                    title: entry.sessionTitle,
                    date: entry.date,
                    activityType: entry.activityType,
                    count: 0,
                  });
                }
                sessionMap.get(entry.sessionId)!.count += 1;
              });

              const recentSessions = [...sessionMap.values()]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 10);

              return (
                <div className="vistos-dashboard panel animate-fade-in">
                  <div className="seen-metrics">
                    <Metric icon={<Award size={19} />} label="Vistos dados hoje" value={totalToday} />
                    <Metric icon={<Calendar size={19} />} label="Vistos este mês" value={totalThisMonth} />
                    <Metric icon={<Users size={19} />} label="Alunos monitorados" value={students.length} />
                  </div>

                  <div className="dashboard-grid">
                    <div className="dashboard-card">
                      <h3><Award size={16} /> Mais participativos no mês</h3>
                      {topThree.length === 0 ? (
                        <p className="no-data-msg">Nenhum visto registrado este mês.</p>
                      ) : (
                        <ul className="dashboard-list">
                          {topThree.map((item, idx) => (
                            <li key={item.id}>
                              <span>{idx + 1}. {item.name} <small>({item.className})</small></span>
                              <strong className="positive-val">+{item.balance}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="dashboard-card">
                      <h3><AlertTriangle size={16} /> Baixa participação no mês</h3>
                      {bottomThree.length === 0 ? (
                        <p className="no-data-msg">Nenhum aluno registrado ou sem vistos.</p>
                      ) : (
                        <ul className="dashboard-list">
                          {bottomThree.map((item) => (
                            <li key={item.id}>
                              <span>{item.name} <small>({item.className})</small></span>
                              <strong className={item.balance < 0 ? "negative-val" : ""}>{item.balance}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="dashboard-sessions-card">
                    <h3><History size={16} /> Atividades registradas recentemente</h3>
                    {recentSessions.length === 0 ? (
                      <div className="empty-state empty-state-compact">
                        <FileText size={32} />
                        <h2>Nenhuma atividade lançada ainda.</h2>
                        <p>Clique em "Lançar Vistos" para realizar o primeiro registro de vistos por turma.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="sessions-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Atividade</th>
                              <th>Turma</th>
                              <th>Tipo</th>
                              <th>Alunos</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentSessions.map((session) => (
                              <tr key={session.id}>
                                <td>{formatDate(session.date)}</td>
                                <td><strong>{session.title}</strong></td>
                                <td>{session.className}</td>
                                <td><span className={`badge-type ${session.activityType}`}>{session.activityType}</span></td>
                                <td>{session.count} vistos</td>
                                <td>
                                  <div className="table-actions">
                                    <button type="button" onClick={() => loadSessionForEdit(session.id)}>
                                      <Edit size={14} /> Editar
                                    </button>
                                    <button type="button" className="danger" onClick={() => deleteSession(session.id)}>
                                      <Trash2 size={14} /> Excluir
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* subPage === lancamento */}
            {vistosSubPage === "lancamento" && currentSession && (() => {
              const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
              const classStudents = students.filter((s) => s.className === currentSession.className);
              
              const filteredClassStudents = classStudents.filter((s) =>
                s.name.toLowerCase().includes(lancamentoSearch.toLowerCase())
              );

              return (
                <div className="vistos-lancamento panel animate-fade-in">
                  {/* Draft Restoration Warning */}
                  {draftRestoredWarning && (
                    <div className="draft-warning-banner">
                      <span>⚠️ Você tem um rascunho em andamento para a turma <strong>{currentSession.className}</strong>.</span>
                      <div className="draft-actions">
                        <button type="button" onClick={() => setDraftRestoredWarning(false)}>Continuar Lançamento</button>
                        <button type="button" className="danger" onClick={() => {
                          if (confirm("Deseja mesmo descartar este rascunho?")) {
                            setCurrentSession(null);
                            localStorage.removeItem("afa-vistos-current-session-draft:v1");
                            setDraftRestoredWarning(false);
                            setVistosSubPage("dashboard");
                          }
                        }}>Descartar Rascunho</button>
                      </div>
                    </div>
                  )}

                  <div className="session-config-card">
                    <h3>Configurar Atividade</h3>
                    <div className="session-config-row">
                      <div className="input-group">
                        <label htmlFor="session-class">Turma</label>
                        <select
                          id="session-class"
                          value={currentSession.className}
                          onChange={(e) => {
                            const newClass = e.target.value;
                            setCurrentSession((prev) => {
                              if (!prev) return null;
                              return { ...prev, className: newClass, entries: {} };
                            });
                            setSelectedStudentIds([]);
                          }}
                        >
                          {classes.map((cls) => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group flex-2">
                        <label htmlFor="session-title">Título da Atividade</label>
                        <input
                          id="session-title"
                          type="text"
                          value={currentSession.title}
                          onChange={(e) => setCurrentSession((prev) => prev ? { ...prev, title: e.target.value } : null)}
                          placeholder="Ex: Ficha de Frações, Participação em Aula..."
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="session-date">Data</label>
                        <input
                          id="session-date"
                          type="date"
                          value={currentSession.date}
                          onChange={(e) => setCurrentSession((prev) => prev ? { ...prev, date: e.target.value } : null)}
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="session-type">Tipo</label>
                        <select
                          id="session-type"
                          value={currentSession.activityType}
                          onChange={(e) => setCurrentSession((prev) => prev ? { ...prev, activityType: e.target.value } : null)}
                        >
                          <option value="classe">Classe</option>
                          <option value="casa">Casa</option>
                          <option value="ficha">Ficha</option>
                          <option value="participacao">Participação</option>
                          <option value="extra">Bônus</option>
                          <option value="pendencia">Pendência</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label htmlFor="session-default-val">Visto Padrão</label>
                        <input
                          id="session-default-val"
                          type="number"
                          value={currentSession.defaultValue}
                          step={vistosConfig.allowDecimal ? "0.1" : "1"}
                          onChange={(e) => setCurrentSession((prev) => prev ? { ...prev, defaultValue: Number(e.target.value) } : null)}
                        />
                      </div>

                      {/* Templates dropdown */}
                      <div className="input-group">
                        <label htmlFor="session-template">Usar Modelo</label>
                        <select
                          id="session-template"
                          defaultValue=""
                          onChange={(e) => {
                            const tplId = e.target.value;
                            const tpl = vistosTemplates.find((t) => t.id === tplId);
                            if (tpl) {
                              setCurrentSession((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  title: tpl.name,
                                  activityType: tpl.activityType,
                                  defaultValue: tpl.defaultValue,
                                  defaultStatus: tpl.defaultStatus,
                                };
                              });
                              // Apply template values to all students
                              const newEntries: Record<string, { value: number; status: VirtualCheckStatus; note: string }> = {};
                              classStudents.forEach((s) => {
                                newEntries[s.id] = {
                                  value: tpl.defaultValue,
                                  status: tpl.defaultStatus,
                                  note: tpl.defaultNote || "",
                                };
                              });
                              setCurrentSession((prev) => prev ? { ...prev, entries: newEntries } : null);
                            }
                          }}
                        >
                          <option value="">-- Selecione --</option>
                          {vistosTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} ({t.defaultValue > 0 ? `+${t.defaultValue}` : t.defaultValue})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mass actions row */}
                    <div className="session-actions-row">
                      <button type="button" onClick={() => applyValueToAll(currentSession.defaultValue, currentSession.defaultStatus)}>
                        {selectedStudentIds.length > 0
                          ? `Aplicar visto padrão (+${currentSession.defaultValue}) para os ${selectedStudentIds.length} selecionados`
                          : `Aplicar visto padrão (+${currentSession.defaultValue}) para todos`}
                      </button>
                      <button type="button" onClick={() => applyValueToAll(0, "justificado")}>
                        {selectedStudentIds.length > 0 ? "Zerar selecionados (Justificado)" : "Zerar todos / Justificado"}
                      </button>
                      <button type="button" onClick={() => applyValueToAll(0, "ausente")}>
                        {selectedStudentIds.length > 0 ? "Ausente (selecionados)" : "Marcar todos como Ausentes"}
                      </button>
                      <button type="button" onClick={() => applyValueToAll(-1, "não fez")}>
                        {selectedStudentIds.length > 0 ? "Não fez (-1 selecionados)" : "Marcar todos como Não fez (-1)"}
                      </button>
                    </div>
                  </div>

                  {/* Launcher students search & batch select */}
                  <div className="launcher-search-box">
                    <Search size={16} />
                    <input
                      aria-label="Filtrar aluno pelo nome"
                      type="text"
                      placeholder="Buscar aluno na turma..."
                      value={lancamentoSearch}
                      onChange={(e) => setLancamentoSearch(e.target.value)}
                    />
                    
                    <div className="launcher-selection-toolbar">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={classStudents.length > 0 && classStudents.every(s => selectedStudentIds.includes(s.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(classStudents.map(s => s.id));
                            } else {
                              setSelectedStudentIds([]);
                            }
                          }}
                        />
                        <span>Selecionar Todos ({selectedStudentIds.length} / {classStudents.length})</span>
                      </label>

                      {selectedStudentIds.length > 0 && (
                        <div className="selection-actions">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => {
                              const newSelection = classStudents
                                .map(s => s.id)
                                .filter(id => !selectedStudentIds.includes(id));
                              setSelectedStudentIds(newSelection);
                            }}
                          >
                            Inverter Seleção
                          </button>
                          <button
                            type="button"
                            className="danger ghost"
                            onClick={() => setSelectedStudentIds([])}
                          >
                            Limpar Seleção
                          </button>
                        </div>
                      )}
                    </div>

                    <small>Dica: Use as setas ↑ ↓ para navegar pelos alunos e teclas de atalho: <strong>1</strong> (+1), <strong>2</strong> (+2), <strong>3</strong> (+3), <strong>0</strong> (Não fez), <strong>A</strong> (Ausente), <strong>N</strong> (-1 visto).</small>
                  </div>

                  {/* Launcher student grid */}
                  <div className="launcher-grid">
                    {filteredClassStudents.length === 0 ? (
                      <p className="no-data-msg">Nenhum aluno encontrado para os critérios de busca.</p>
                    ) : (
                      filteredClassStudents.map((student) => {
                        const entry = currentSession.entries[student.id] || {
                          value: currentSession.defaultValue,
                          status: currentSession.defaultStatus,
                          note: "",
                        };
                        const isFocused = student.id === focusedStudentId;
                        const isSelected = selectedStudentIds.includes(student.id);

                        return (
                          <div
                            key={student.id}
                            className={`launcher-card ${entry.status} ${isFocused ? "focused" : ""} ${isSelected ? "selected" : ""}`}
                            id={`row-${student.id}`}
                            tabIndex={0}
                            onFocus={() => setFocusedStudentId(student.id)}
                          >
                            <div className="launcher-card-header">
                              <label className="launcher-card-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStudentIds(prev => [...prev, student.id]);
                                    } else {
                                      setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                                    }
                                  }}
                                />
                                <h4>{student.name}</h4>
                              </label>
                              <span className={`badge-status ${entry.status}`}>{entry.status}</span>
                            </div>

                            <div className="launcher-card-controls">
                              <div className="value-badge">
                                <span className={entry.value > 0 ? "positive" : entry.value < 0 ? "negative" : "neutral"}>
                                  {entry.value > 0 ? `+${entry.value}` : entry.value}
                                </span>
                              </div>

                              <div className="button-group compact">
                                <button
                                  type="button"
                                  className={entry.value === -1 ? "active danger" : ""}
                                  onClick={() => updateSessionEntry(student.id, -1, "não fez")}
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  className={entry.value === 0 ? "active" : ""}
                                  onClick={() => updateSessionEntry(student.id, 0, "parcial")}
                                >
                                  0
                                </button>
                                <button
                                  type="button"
                                  className={entry.value === 1 ? "active primary" : ""}
                                  onClick={() => updateSessionEntry(student.id, 1, "feito")}
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  className={entry.value === 2 ? "active primary" : ""}
                                  onClick={() => updateSessionEntry(student.id, 2, "feito")}
                                >
                                  +2
                                </button>
                                <button
                                  type="button"
                                  className={entry.value === 3 ? "active primary" : ""}
                                  onClick={() => updateSessionEntry(student.id, 3, "entregou")}
                                >
                                  +3
                                </button>
                              </div>
                            </div>

                            <div className="launcher-card-notes">
                              <select
                                aria-label="Status do visto"
                                value={entry.status}
                                onChange={(e) => updateSessionEntry(student.id, entry.value, e.target.value as VirtualCheckStatus)}
                              >
                                <option value="feito">Feito</option>
                                <option value="parcial">Parcial</option>
                                <option value="não fez">Não fez</option>
                                <option value="ausente">Ausente</option>
                                <option value="entregou">Entregou</option>
                                <option value="pendente">Pendente</option>
                                <option value="justificado">Justificado</option>
                              </select>

                              <input
                                aria-label="Nota"
                                type="text"
                                placeholder="Observação curta..."
                                value={entry.note}
                                onChange={(e) => updateSessionEntry(student.id, entry.value, entry.status, e.target.value)}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="bottom-save-bar">
                    {undoStack.length > 0 && (
                      <button type="button" className="warning ghost" onClick={handleUndo}>
                        <Undo2 size={16} /> Desfazer ({undoStack.length})
                      </button>
                    )}
                    <button type="button" className="ghost" onClick={() => { setCurrentSession(null); setVistosSubPage("dashboard"); }}>
                      Cancelar
                    </button>
                    <button type="button" className="primary" onClick={saveSession}>
                      <Check size={16} /> Salvar Lançamento
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* subPage === templates */}
            {vistosSubPage === "templates" && (
              <div className="vistos-templates panel animate-fade-in">
                <div className="templates-editor-grid">
                  <div className="template-form-card">
                    <h3>Criar Novo Modelo</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const name = fd.get("name") as string;
                        const activityType = fd.get("activityType") as string;
                        const defaultValue = Number(fd.get("defaultValue"));
                        const defaultStatus = fd.get("defaultStatus") as VirtualCheckStatus;
                        const defaultNote = fd.get("defaultNote") as string;

                        if (!name.trim()) return;

                        const newTpl: VirtualCheckTemplate = {
                          id: crypto.randomUUID(),
                          name: name.trim(),
                          activityType,
                          defaultValue,
                          defaultStatus,
                          defaultNote,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };

                        setVistosTemplates((prev) => [newTpl, ...prev]);
                        e.currentTarget.reset();
                        setMessage(`Modelo "${name}" criado com sucesso.`);
                      }}
                    >
                      <div className="input-group">
                        <label htmlFor="tpl-name">Nome do Modelo</label>
                        <input id="tpl-name" name="name" type="text" placeholder="Ex: Ficha Completa, Lição de Casa" required />
                      </div>
                      
                      <div className="input-group">
                        <label htmlFor="tpl-type">Tipo de Atividade</label>
                        <select id="tpl-type" name="activityType">
                          <option value="classe">Classe</option>
                          <option value="casa">Casa</option>
                          <option value="ficha">Ficha</option>
                          <option value="participacao">Participação</option>
                          <option value="extra">Bônus</option>
                          <option value="pendencia">Pendência</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label htmlFor="tpl-value">Visto Padrão</label>
                        <input id="tpl-value" name="defaultValue" type="number" defaultValue={1} step={vistosConfig.allowDecimal ? "0.1" : "1"} />
                      </div>

                      <div className="input-group">
                        <label htmlFor="tpl-status">Status Padrão</label>
                        <select id="tpl-status" name="defaultStatus">
                          <option value="feito">Feito</option>
                          <option value="parcial">Parcial</option>
                          <option value="não fez">Não fez</option>
                          <option value="ausente">Ausente</option>
                          <option value="entregou">Entregou</option>
                          <option value="pendente">Pendente</option>
                          <option value="justificado">Justificado</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label htmlFor="tpl-note">Observação Padrão</label>
                        <input id="tpl-note" name="defaultNote" type="text" placeholder="Ex: Entregou caprichado (opcional)" />
                      </div>

                      <button type="submit" className="primary">
                        <Plus size={16} /> Salvar Modelo
                      </button>
                    </form>
                  </div>

                  <div className="templates-list-card">
                    <h3>Modelos Existentes</h3>
                    {vistosTemplates.length === 0 ? (
                      <p className="no-data-msg">Nenhum modelo cadastrado.</p>
                    ) : (
                      <div className="templates-chips-grid">
                        {vistosTemplates.map((t) => (
                          <div key={t.id} className="template-chip">
                            <div className="chip-info">
                              <strong>{t.name}</strong>
                              <span>
                                {t.activityType} · visto: <strong className={t.defaultValue > 0 ? "positive-val" : t.defaultValue < 0 ? "negative-val" : ""}>{t.defaultValue > 0 ? `+${t.defaultValue}` : t.defaultValue}</strong>
                              </span>
                              {t.defaultNote && <small>Nota: "{t.defaultNote}"</small>}
                            </div>
                            <button
                              type="button"
                              className="danger icon-button"
                              onClick={() => {
                                setVistosTemplates((prev) => prev.filter((x) => x.id !== t.id));
                                setMessage("Modelo removido.");
                              }}
                              title="Remover modelo"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {vistosSubPage === "relatorios" && (() => {
              const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
              const reportClassFilter = reportClass;
              const repStudents = students.filter((s) => reportClassFilter === "todas" || s.className === reportClassFilter);

              const allEntries = students.flatMap((s) => (s.vistos ?? []).map((v) => ({ ...v, studentId: s.id, studentName: s.name })));
              const sessionMap = new Map<string, { id: string; className: string; title: string; date: string }>();
              
              allEntries.forEach((entry) => {
                const student = students.find((s) => s.id === entry.studentId);
                const className = student?.className ?? "";
                if (reportClassFilter === "todas" || className === reportClassFilter) {
                  if (!sessionMap.has(entry.sessionId)) {
                    sessionMap.set(entry.sessionId, {
                      id: entry.sessionId,
                      className,
                      title: entry.sessionTitle,
                      date: entry.date,
                    });
                  }
                }
              });
              const classSessions = [...sessionMap.values()].sort((a, b) => b.date.localeCompare(a.date));

              const statsRows = repStudents.map((student) => {
                const sv = student.vistos ?? [];
                const filtered = filterVistosByPeriod(sv, reportPeriod);

                const totalValue = filtered.reduce((sum, v) => sum + v.value, 0);
                const countPositive = filtered.filter(v => v.value > 0).length;
                const countNegative = filtered.filter(v => v.value < 0).length;
                const countNaoFez = filtered.filter(v => v.status === "não fez").length;
                const countAusentes = filtered.filter(v => v.status === "ausente").length;

                const points = Math.min(
                  vistosConfig.maxPointsPerBimester,
                  Math.max(0, Number((totalValue * vistosConfig.pointsPerCheck).toFixed(2)))
                );

                return {
                  id: student.id,
                  name: student.name,
                  className: student.className,
                  totalValue,
                  countPositive,
                  countNegative,
                  countNaoFez,
                  countAusentes,
                  points,
                };
              });

              // Apply dynamic sorting to report statsRows
              const sortedStatsRows = [...statsRows].sort((a, b) => {
                if (reportSortKey === "nome") {
                  return a.name.localeCompare(b.name);
                }
                if (reportSortKey === "maior-saldo") {
                  return b.totalValue - a.totalValue;
                }
                if (reportSortKey === "menor-saldo") {
                  return a.totalValue - b.totalValue;
                }
                if (reportSortKey === "negativos") {
                  return b.countNegative - a.countNegative;
                }
                if (reportSortKey === "inativos") {
                  const actA = a.countPositive + a.countNegative + a.countNaoFez + a.countAusentes;
                  const actB = b.countPositive + b.countNegative + b.countNaoFez + b.countAusentes;
                  return actA - actB;
                }
                return 0;
              });

              const notasEditRows = buildNotasEditRows(students, {
                period: "bimestre",
                classFilter: reportClassFilter,
                bimester: notasEditBimester,
              });
              const averageBehavior = notasEditRows.length
                ? notasEditRows.reduce((sum, row) => sum + row.behaviorScore, 0) / notasEditRows.length
                : 0;
              const averageVistos = notasEditRows.length
                ? notasEditRows.reduce((sum, row) => sum + row.vistosScore, 0) / notasEditRows.length
                : 0;

              const selectedSession = classSessions.find(s => s.id === selectedReportSessionId) || classSessions[0];
              const whatsappText = selectedSession ? (() => {
                const sessionEntries = students.flatMap((s) => 
                  (s.vistos ?? [])
                    .filter((v) => v.sessionId === selectedSession.id)
                    .map((v) => ({ studentName: s.name, value: v.value, status: v.status }))
                );
                const title = selectedSession.title;
                const dateStr = formatDate(selectedSession.date);

                const entregaram = sessionEntries.filter(e => e.value > 0).map(e => e.studentName);
                const naoFizeram = sessionEntries.filter(e => e.status === "não fez" || e.value < 0).map(e => e.studentName);
                const ausentes = sessionEntries.filter(e => e.status === "ausente").map(e => e.studentName);

                let text = `*Resumo de Vistos - ${title} (${dateStr})*\n\n`;
                if (entregaram.length) {
                  text += `✅ *Receberam visto positivo:*\n${entregaram.join(", ")}\n\n`;
                }
                if (naoFizeram.length) {
                  text += `❌ *Não fizeram/entregaram:*\n${naoFizeram.join(", ")}\n\n`;
                }
                if (ausentes.length) {
                  text += `💤 *Ausentes:*\n${ausentes.join(", ")}\n`;
                }
                return text;
              })() : "";

              function exportCSV() {
                const headers = ["Aluno", "Turma", "Saldo Vistos", "Vistos (+)", "Vistos (-)", "Não Fez", "Ausências", "Pontos Bimestrais"];
                const rowsData = sortedStatsRows.map((row) => [
                  row.name,
                  row.className || "Sem turma",
                  row.totalValue,
                  row.countPositive,
                  row.countNegative,
                  row.countNaoFez,
                  row.countAusentes,
                  row.points.toFixed(2),
                ]);
                
                const csvContent = "\uFEFF" + [headers.join(";"), ...rowsData.map(e => e.join(";"))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `consolidado-vistos-${reportClass}-${reportPeriod}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setMessage("Relatório exportado em CSV!");
              }

              function exportNotasEditCSV() {
                downloadFile(
                  `notasedit-afa-${reportClass}-${notasEditBimester}.csv`,
                  buildNotasEditCsv(notasEditRows),
                  "text/csv;charset=utf-8",
                );
                setMessage("Arquivo CSV do NotasEdit gerado.");
              }

              function exportNotasEditJSON() {
                downloadFile(
                  `notasedit-afa-${reportClass}-${notasEditBimester}.json`,
                  buildNotasEditJson(notasEditRows),
                  "application/json",
                );
                setMessage("Arquivo JSON do NotasEdit gerado.");
              }

              function copyLowParticipation() {
                const lowList = sortedStatsRows
                  .filter(r => r.totalValue <= 0 || r.countNaoFez > 1 || r.countAusentes > 1)
                  .map(r => `• ${r.name} (${r.className || "Sem turma"}) - Saldo: ${r.totalValue}, Não Fez: ${r.countNaoFez}, Faltas: ${r.countAusentes}`);
                
                if (lowList.length === 0) {
                  alert("Nenhum aluno com baixa participação identificado no período.");
                  return;
                }
                
                const copyText = `Alunos com baixa participação/problemas de vistos (${getPeriodLabel(reportPeriod)}):\n\n` + lowList.join("\n");
                navigator.clipboard.writeText(copyText)
                  .then(() => setMessage("Lista de alunos com baixa participação copiada para a área de transferência!"))
                  .catch(() => alert("Falha ao copiar lista."));
              }

              return (
                <div className="vistos-relatorios panel animate-fade-in">
                  <div className="report-filters-card">
                    <h3>Filtros do Relatório</h3>
                    <div className="report-filters-row">
                      <div className="input-group">
                        <label htmlFor="rep-class">Turma</label>
                        <select id="rep-class" value={reportClass} onChange={(e) => { setReportClass(e.target.value); setSelectedReportSessionId(""); }}>
                          <option value="todas">Todas as Turmas</option>
                          {classes.map((cls) => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group">
                        <label htmlFor="rep-period">Período</label>
                        <select id="rep-period" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value as any)}>
                          <option value="mes">Mês Atual</option>
                          <option value="bimestre">Bimestre selecionado</option>
                          <option value="semestre">Semestre Atual</option>
                          <option value="todo">Histórico Completo</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label htmlFor="rep-sort">Ordenar por</label>
                        <select id="rep-sort" value={reportSortKey} onChange={(e) => setReportSortKey(e.target.value as any)}>
                          <option value="nome">Nome do Aluno</option>
                          <option value="maior-saldo">Maior Saldo de Vistos</option>
                          <option value="menor-saldo">Menor Saldo de Vistos</option>
                          <option value="negativos">Mais Negativos / Não Fez</option>
                          <option value="inativos">Inatividade / Menos Lançamentos</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="reports-dual-layout">
                    <div className="report-copy-card">
                      <h3><MessageCircle size={16} /> Resumo Rápido para WhatsApp</h3>
                      {classSessions.length === 0 ? (
                        <p className="no-data-msg">Nenhuma atividade registrada para esta turma.</p>
                      ) : (
                        <div className="whatsapp-generator">
                          <div className="input-group">
                            <label htmlFor="session-copy-select">Selecione a atividade:</label>
                            <select
                              id="session-copy-select"
                              value={selectedReportSessionId || (classSessions[0]?.id ?? "")}
                              onChange={(e) => setSelectedReportSessionId(e.target.value)}
                            >
                              {classSessions.map((s) => (
                                <option key={s.id} value={s.id}>{formatDate(s.date)} - {s.title} ({s.className})</option>
                              ))}
                            </select>
                          </div>
                          
                          <textarea
                            aria-label="Resumo gerado"
                            className="whatsapp-copy-area"
                            value={whatsappText}
                            readOnly
                            rows={8}
                          />

                          <button
                            type="button"
                            className="primary"
                            onClick={() => {
                              if (!whatsappText) return;
                              navigator.clipboard.writeText(whatsappText)
                                .then(() => setMessage("Resumo copiado para WhatsApp!"))
                                .catch(() => alert("Falha ao copiar texto."));
                            }}
                          >
                            <Copy size={16} /> Copiar Texto
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="low-participation-card">
                      <h3><AlertTriangle size={16} /> Alunos com saldo baixo / ausências no período</h3>
                      {sortedStatsRows.filter(r => r.totalValue <= 0 || r.countNaoFez > 1).length === 0 ? (
                        <p className="no-data-msg">Nenhum alerta de participação no período.</p>
                      ) : (
                        <>
                          <ul className="dashboard-list compact">
                            {sortedStatsRows
                              .filter(r => r.totalValue <= 0 || r.countNaoFez > 1 || r.countAusentes > 1)
                              .slice(0, 10)
                              .map((item) => (
                                <li key={item.id}>
                                  <span>{item.name} <small>({item.className || "Sem turma"})</small></span>
                                  <div>
                                    {item.countNaoFez > 0 && <span className="warning-badge">não fez: {item.countNaoFez}</span>}
                                    {item.countAusentes > 0 && <span className="neutral-badge">faltas: {item.countAusentes}</span>}
                                    <strong className={item.totalValue < 0 ? "negative-val" : ""}>{item.totalValue} vistos</strong>
                                  </div>
                                </li>
                              ))}
                          </ul>
                          <button type="button" className="ghost compact-btn" onClick={copyLowParticipation}>
                            <Copy size={13} /> Copiar lista de inativos
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="notasedit-card">
                    <div className="report-table-header">
                      <h3><Cloud size={16} /> NotasEdit</h3>
                      <div className="notasedit-actions">
                        <select
                          aria-label="Bimestre no NotasEdit"
                          className="notasedit-bimester-select"
                          value={notasEditBimester}
                          onChange={(event) => setNotasEditBimester(event.target.value as typeof notasEditBimester)}
                        >
                          <option value="b1">1º Bimestre</option>
                          <option value="b2">2º Bimestre</option>
                          <option value="b3">3º Bimestre</option>
                          <option value="b4">4º Bimestre</option>
                        </select>
                        <button
                          type="button"
                          className="ghost compact-btn"
                          onClick={() => previewNotasEditDirect(notasEditRows)}
                          disabled={previewingNotasEdit}
                        >
                          <Search size={14} /> {previewingNotasEdit ? "Verificando..." : "Previa"}
                        </button>
                        <button
                          type="button"
                          className="primary compact-btn"
                          onClick={() => syncNotasEditDirect(notasEditRows)}
                          disabled={syncingNotasEdit}
                        >
                          <Cloud size={14} /> {syncingNotasEdit ? "Sincronizando..." : "Sincronizar"}
                        </button>
                        <button type="button" className="primary compact-btn" onClick={exportNotasEditCSV}>
                          <Download size={14} /> CSV
                        </button>
                        <button type="button" className="ghost compact-btn" onClick={exportNotasEditJSON}>
                          <FileText size={14} /> JSON
                        </button>
                        <label className="ghost compact-btn file-button">
                          <Upload size={14} /> Importar
                          <input
                            type="file"
                            accept=".csv,.json,application/json,text/csv"
                            onChange={(event) => {
                              handleNotasEditImport(event.currentTarget.files?.[0] ?? null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="notasedit-summary">
                      <div className="vistos-metric-card">
                        <span>Bimestre-base</span>
                        <strong>{getNotasEditBimesterLabel(notasEditBimester)}</strong>
                      </div>
                      <div className="vistos-metric-card">
                        <span>Alunos</span>
                        <strong>{notasEditRows.length}</strong>
                      </div>
                      <div className="vistos-metric-card highlight">
                        <span>Comportamento</span>
                        <strong>{averageBehavior.toFixed(1)} / 2,0</strong>
                      </div>
                      <div className="vistos-metric-card highlight">
                        <span>Vistos</span>
                        <strong>{averageVistos.toFixed(1)} / 3,0</strong>
                      </div>
                    </div>

                    <div className="pairing-grid">
                      <div className="pairing-card">
                        <strong>Parear turma</strong>
                        <div className="pairing-form">
                          <input
                            aria-label="Turma no AFA"
                            value={classPairDraft.afa}
                            onChange={(event) => setClassPairDraft((current) => ({ ...current, afa: event.target.value }))}
                            placeholder="Turma no AFA"
                          />
                          <input
                            aria-label="Turma no NotasEdit"
                            value={classPairDraft.notas}
                            onChange={(event) => setClassPairDraft((current) => ({ ...current, notas: event.target.value }))}
                            placeholder="Turma no NotasEdit"
                          />
                          <button type="button" className="ghost compact-btn" onClick={addClassPair}>
                            <Plus size={13} /> Parear
                          </button>
                        </div>
                        <div className="pairing-list">
                          {Object.entries(notasEditClassPairs).length === 0 ? (
                            <small>Sem pareamentos de turma.</small>
                          ) : (
                            Object.entries(notasEditClassPairs).map(([afa, notas]) => (
                              <button
                                type="button"
                                key={afa}
                                onClick={() =>
                                  setNotasEditClassPairs((current) => {
                                    const next = { ...current };
                                    delete next[afa];
                                    return next;
                                  })
                                }
                              >
                                {afa} = {notas}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="pairing-card">
                        <strong>Parear aluno</strong>
                        <div className="pairing-form">
                          <input
                            aria-label="Aluno no AFA"
                            value={studentPairDraft.afa}
                            onChange={(event) => setStudentPairDraft((current) => ({ ...current, afa: event.target.value }))}
                            placeholder="Aluno no AFA"
                          />
                          <input
                            aria-label="Aluno no NotasEdit"
                            value={studentPairDraft.notas}
                            onChange={(event) => setStudentPairDraft((current) => ({ ...current, notas: event.target.value }))}
                            placeholder="Aluno no NotasEdit"
                          />
                          <button type="button" className="ghost compact-btn" onClick={addStudentPair}>
                            <Plus size={13} /> Parear
                          </button>
                        </div>
                        <div className="pairing-list">
                          {Object.entries(notasEditStudentPairs).length === 0 ? (
                            <small>Sem pareamentos de aluno.</small>
                          ) : (
                            Object.entries(notasEditStudentPairs).map(([afa, notas]) => (
                              <button
                                type="button"
                                key={afa}
                                onClick={() =>
                                  setNotasEditStudentPairs((current) => {
                                    const next = { ...current };
                                    delete next[afa];
                                    return next;
                                  })
                                }
                              >
                                {afa} = {notas}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {notasEditPreviewRows.length > 0 && (
                      <div className="notasedit-preview">
                        <div className="report-table-header">
                          <h4>Previa de sincronizacao</h4>
                          <span>
                            {notasEditPreviewRows.filter((row) => row.status === "ok").length}/{notasEditPreviewRows.length} prontos
                          </span>
                        </div>
                        <div className="table-responsive compact-preview">
                          <table className="relatorio-vistos-table">
                            <thead>
                              <tr>
                                <th>Aluno</th>
                                <th>Turma</th>
                                <th>Status</th>
                                <th>Comp.</th>
                                <th>Vistos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {notasEditPreviewRows.slice(0, 12).map((row) => (
                                <tr key={row.studentId}>
                                  <td><strong>{row.name}</strong></td>
                                  <td>{row.className || "Sem turma"}</td>
                                  <td>
                                    <span className={`preview-status ${row.status}`}>{row.detail}</span>
                                  </td>
                                  <td>{row.behaviorScore.toFixed(1)}</td>
                                  <td>{row.vistosScore.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="table-responsive compact-preview">
                      <table className="relatorio-vistos-table">
                        <thead>
                          <tr>
                            <th>Aluno</th>
                            <th>Turma</th>
                            <th>Comp.</th>
                            <th>Vistos</th>
                            <th>Feitos</th>
                            <th>Esperados</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notasEditRows.slice(0, 8).map((row) => (
                            <tr key={row.studentId}>
                              <td><strong>{row.name}</strong></td>
                              <td>{row.className || "Sem turma"}</td>
                              <td>{row.behaviorScore.toFixed(1)}</td>
                              <td>{row.vistosScore.toFixed(1)}</td>
                              <td>{row.completedVistos}</td>
                              <td>{row.expectedVistos}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="report-table-card">
                    <div className="report-table-header">
                      <h3>Frequência e Pontuação por Aluno</h3>
                      <button type="button" className="primary compact-btn" onClick={exportCSV}>
                        <FileText size={14} /> Exportar Planilha (CSV)
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="relatorio-vistos-table">
                        <thead>
                          <tr>
                            <th>Aluno</th>
                            <th>Turma</th>
                            <th>Saldo Vistos</th>
                            <th>Vistos (+)</th>
                            <th>Vistos (-)</th>
                            <th>Não Fez</th>
                            <th>Ausências</th>
                            {vistosConfig.convertPoints && <th>Pontos Bimestrais</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStatsRows.map((row) => (
                            <tr key={row.id}>
                              <td><strong>{row.name}</strong></td>
                              <td>{row.className || "Sem turma"}</td>
                              <td className={row.totalValue > 0 ? "positive-val text-bold" : row.totalValue < 0 ? "negative-val text-bold" : ""}>
                                {row.totalValue > 0 ? `+${row.totalValue}` : row.totalValue}
                              </td>
                              <td className="positive-val">+{row.countPositive}</td>
                              <td className="negative-val">-{row.countNegative}</td>
                              <td className={row.countNaoFez > 0 ? "negative-val text-bold" : ""}>{row.countNaoFez}</td>
                              <td>{row.countAusentes}</td>
                              {vistosConfig.convertPoints && (
                                <td>
                                  <strong>{row.points.toFixed(1)} / {vistosConfig.maxPointsPerBimester.toFixed(1)}</strong>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {vistosSubPage === "config" && (
              <div className="vistos-config panel animate-fade-in">
                <div className="config-form-card">
                  <h3>Regras de Pontuação Bimestrais</h3>
                  
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={vistosConfig.convertPoints}
                        onChange={(e) => setVistosConfig((prev) => ({ ...prev, convertPoints: e.target.checked }))}
                      />
                      <span>Ativar conversão de vistos acumulados em pontuação bimestral</span>
                    </label>
                  </div>

                  {vistosConfig.convertPoints && (
                    <div className="config-inputs-row">
                      <div className="input-group">
                        <label htmlFor="cfg-points-per-check">Valor em nota por visto (ex: 0.1 ponto por visto)</label>
                        <input
                          id="cfg-points-per-check"
                          type="number"
                          step="0.05"
                          value={vistosConfig.pointsPerCheck}
                          onChange={(e) => setVistosConfig((prev) => ({ ...prev, pointsPerCheck: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="cfg-max-points">Pontuação máxima permitida (limite bimestral)</label>
                        <input
                          id="cfg-max-points"
                          type="number"
                          step="0.5"
                          value={vistosConfig.maxPointsPerBimester}
                          onChange={(e) => setVistosConfig((prev) => ({ ...prev, maxPointsPerBimester: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  )}

                  <hr />
                  <h3>Restrições e Valores</h3>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={vistosConfig.allowNegative}
                        onChange={(e) => setVistosConfig((prev) => ({ ...prev, allowNegative: e.target.checked }))}
                      />
                      <span>Permitir vistos negativos (dedução de vistos por pendências de tarefas)</span>
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={vistosConfig.allowDecimal}
                        onChange={(e) => setVistosConfig((prev) => ({ ...prev, allowDecimal: e.target.checked }))}
                      />
                      <span>Permitir vistos fracionados/decimais (ex: +0.5 visto por atividade parcial)</span>
                    </label>
                  </div>

                  <div className="config-help-box">
                    <h4>Como funciona a conversão?</h4>
                    <p>
                      Quando ativado, o sistema calcula a pontuação somando os vistos no bimestre (últimos 60 dias) e multiplicando pelo valor individual.
                      Se um aluno tem <strong>15 vistos</strong> e cada visto vale <strong>{vistosConfig.pointsPerCheck}</strong>, ele recebe <strong>{(15 * vistosConfig.pointsPerCheck).toFixed(1)} pontos</strong> extras.
                      O valor final é limitado ao teto de <strong>{vistosConfig.maxPointsPerBimester.toFixed(1)} pontos</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {page === "sync" && (
          <div className="sync-view-container animate-fade-in">
            <header className="sync-view-header">
              <div className="sync-title-block">
                <h2>Central de Sincronização</h2>
                <p>Gerencie seus registros locais, alterações pendentes e resolva conflitos offline.</p>
              </div>
              <div className="sync-action-buttons">
                <button
                  type="button"
                  className="ghost"
                  onClick={downloadBackup}
                  title="Exportar dados locais de backup"
                >
                  <Download size={16} /> Exportar Backup JSON
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!syncEngineOnline || isSyncing}
                  onClick={() => {
                    if (user?.uid) {
                      triggerSync(user.uid);
                    } else {
                      alert("Faça login para poder sincronizar com o Firebase.");
                    }
                  }}
                >
                  {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                </button>
              </div>
            </header>

            <div className="sync-status-grid">
              <div className={`sync-status-card ${syncEngineOnline ? "online" : "offline"}`}>
                <div className="status-indicator">
                  <span className="pulse-dot"></span>
                  <strong>{syncEngineOnline ? "Online" : "Offline"}</strong>
                </div>
                <p>{syncEngineOnline ? "Conectado ao servidor AFA Alunos" : "Sem conexão. Os registros estão salvos com segurança no aparelho."}</p>
              </div>
              <div className="sync-status-card info">
                <span>Alterações Pendentes</span>
                <strong>{pendingSyncCount}</strong>
              </div>
              <div className="sync-status-card info">
                <span>Estado de Sincronização</span>
                <strong>{isSyncing ? "Enviando dados..." : pendingSyncCount > 0 ? "Aguardando conexão" : "Tudo Sincronizado"}</strong>
              </div>
            </div>

            {/* Conflict Resolution Section */}
            {conflictOperations.length > 0 && (
              <div className="conflicts-card">
                <h3><AlertTriangle size={18} /> Resolução de Conflitos ({conflictOperations.length})</h3>
                <p className="conflicts-intro">Os registros abaixo foram alterados no servidor após a última modificação neste aparelho. Escolha como resolver para prosseguir com a sincronização.</p>
                <div className="conflicts-list">
                  {conflictOperations.map((op) => {
                    const local = op.payload.localVersion as Student;
                    const server = op.payload.serverVersion as Student;
                    return (
                      <div className="conflict-item" key={op.id}>
                        <div className="conflict-item-header">
                          <h4>Conflito na Ficha de: <strong>{local.name}</strong> ({local.className})</h4>
                          <span className="conflict-badge">Pendente Decisão</span>
                        </div>
                        <div className="conflict-columns">
                          <div className="conflict-col local">
                            <h5>Sua Versão (Local)</h5>
                            <p>Última alteração: <small>{new Date(local.updatedAt).toLocaleString("pt-BR")}</small></p>
                            <ul>
                              <li>Vistos acumulados: <strong>{local.vistos?.length ?? 0}</strong></li>
                              <li>Ocorrências: <strong>{local.incidents?.length ?? 0}</strong></li>
                              <li>Resumo pedagógico: <em>{local.profile.resumoRapido || "Vazio"}</em></li>
                            </ul>
                          </div>
                          <div className="conflict-col server">
                            <h5>Versão do Servidor (Online)</h5>
                            <p>Última alteração: <small>{new Date(server.updatedAt || "").toLocaleString("pt-BR")}</small></p>
                            <ul>
                              <li>Vistos acumulados: <strong>{server.vistos?.length ?? 0}</strong></li>
                              <li>Ocorrências: <strong>{server.incidents?.length ?? 0}</strong></li>
                              <li>Resumo pedagógico: <em>{server.profile.resumoRapido || "Vazio"}</em></li>
                            </ul>
                          </div>
                        </div>
                        <div className="conflict-actions">
                          <button type="button" className="ghost danger" onClick={() => resolveConflictKeepServer(op)}>
                            Manter Versão do Servidor (Descartar Local)
                          </button>
                          <button type="button" className="ghost success" onClick={() => resolveConflictKeepLocal(op)}>
                            Manter Minha Versão (Sobrescrever Servidor)
                          </button>
                          <button type="button" className="primary" onClick={() => resolveConflictMerge(op)}>
                            Mesclar Ambas as Versões (Unir Vistos e Ocorrências)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sync logs history */}
            <div className="sync-logs-card">
              <h3>Histórico de Sincronizações</h3>
              {syncLogs.length === 0 ? (
                <p className="no-data-msg">Nenhum log gravado ainda.</p>
              ) : (
                <div className="table-responsive">
                  <table className="sync-logs-table">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Status</th>
                        <th>Mensagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.createdAt).toLocaleTimeString("pt-BR")}</td>
                          <td>
                            <span className={`sync-log-status-badge ${log.status}`}>
                              {log.status === "success" ? "Sucesso" : log.status === "conflict" ? "Conflito" : log.status === "failed" ? "Falha" : "Info"}
                            </span>
                          </td>
                          <td>{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {importPreview.length > 0 && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="modal-header">
              <div>
                <h2>Alunos encontrados</h2>
                <p>
                  Corrija nomes, turmas e unidades antes de importar. Repetidos por nome, turma e unidade serão ignorados.
                  {importReviewCount > 0 && <strong> {importReviewCount} nome(s) precisam de revisão.</strong>}
                </p>
              </div>
              <button className="icon-button" onClick={() => setImportPreview([])} title="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="preview-list">
              {importPreview.slice(0, 120).map((student, index) => {
                const shouldReviewName = needsNameReview(student.name);

                return (
                  <div className={`preview-row ${shouldReviewName ? "needs-review" : ""}`} key={`${student.source}-${index}`}>
                  <div className="preview-name-cell">
                    <input
                      aria-label={`Nome importado ${index + 1}`}
                      value={student.name}
                      onChange={(event) => updateImportPreview(index, "name", event.target.value)}
                    />
                    {shouldReviewName && <span className="review-badge">Revisar nome</span>}
                  </div>
                  <input
                    aria-label={`Turma importada ${index + 1}`}
                    value={student.className}
                    onChange={(event) => updateImportPreview(index, "className", event.target.value)}
                    placeholder="Sem turma"
                  />
                  <select
                    aria-label={`Unidade importada ${index + 1}`}
                    value={student.campus}
                    onChange={(event) => updateImportPreview(index, "campus", event.target.value)}
                  >
                    <option value="São Lourenço">São Lourenço</option>
                    <option value="Igarassu">Igarassu</option>
                    <option value="Não definido">Não definido</option>
                  </select>
                  <input
                    aria-label={`Status importado ${index + 1}`}
                    value={student.status}
                    onChange={(event) => updateImportPreview(index, "status", event.target.value)}
                    placeholder="Status"
                  />
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => removeImportPreview(index)}
                    title="Remover aluno da importação"
                  >
                    <X size={16} />
                  </button>
                  </div>
                );
              })}
            </div>
            <div className="actions">
              <button onClick={() => setImportPreview([])}>Cancelar</button>
              <button className="primary" onClick={confirmImport}>
                <Check size={16} />
                Importar {importPreview.length}
              </button>
            </div>
          </section>
        </div>
      )}

      {audioAfaOpen && selectedStudent && (
        <div className="modal-backdrop">
          <section className="modal audio-afa-modal" role="dialog" aria-modal="true" aria-label="Ditado AFA">
            <div className="modal-header">
              <div>
                <h2>Ditado AFA</h2>
                <p>{selectedStudent.name} - {selectedStudent.className || "Sem turma"}</p>
              </div>
              <button className="icon-button" onClick={closeAudioAfa} title="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="audio-mode-toggle" aria-label="Modo de processamento">
              <button
                type="button"
                className={audioMode === "api" ? "selected" : ""}
                disabled={audioRecording || audioProcessing}
                onClick={() => setAudioMode("api")}
              >
                <Cloud size={15} />
                API
              </button>
              <button
                type="button"
                className={audioMode === "gratis" ? "selected" : ""}
                disabled={audioRecording || audioProcessing}
                onClick={() => {
                  setAudioMode("gratis");
                  if (!audioFreeSupported) setAudioError("Ditado gratis depende do Chrome/Android ou navegador compativel.");
                }}
              >
                <Mic size={15} />
                Gratis
              </button>
              <button
                type="button"
                className={audioMode === "local" ? "selected" : ""}
                disabled={audioRecording || audioProcessing}
                onClick={() => setAudioMode("local")}
              >
                <Settings size={15} />
                Local
              </button>
            </div>
            <p className="audio-mode-hint">
              {audioMode === "api"
                ? "Transcreve e organiza pela OpenAI. Se houver erro de credito, usa fallback local quando houver texto."
                : audioMode === "gratis"
                  ? audioFreeSupported
                    ? "Usa o ditado do navegador e depois organiza por regras locais, sem custo de API."
                    : "Este navegador nao liberou ditado gratis. Use Chrome/Android ou cole o texto no modo local."
                  : "Nao envia nada para API. Cole a transcricao e organize por regras locais."}
            </p>

            <div className="audio-recorder">
              <button
                className={audioRecording ? "danger" : "primary"}
                type="button"
                onClick={audioRecording ? stopAudioRecording : startAudioRecording}
                disabled={audioProcessing || (audioMode === "gratis" && !audioFreeSupported)}
              >
                {audioRecording ? <Square size={16} /> : <Mic size={16} />}
                {audioRecording
                  ? audioMode === "gratis"
                    ? "Parar ditado"
                    : "Parar gravacao"
                  : audioMode === "gratis"
                    ? "Ditado gratis"
                    : audioMode === "local"
                      ? "Cole texto"
                      : "Gravar audio"}
              </button>
              <span className={audioRecording ? "recording-status active" : "recording-status"}>
                <span />
                {audioRecording ? "Gravando" : audioProcessing ? "Processando" : audioMode === "gratis" && !audioFreeSupported ? "Indisponivel" : "Pronto"}
              </span>
            </div>

            {pendingAfaAudio && (
              <div className="pending-audio-panel">
                <div className="pending-audio-heading">
                  <div>
                    <strong>Audio pendente</strong>
                    <span>{Math.max(1, Math.round(pendingAfaAudio.size / 1024))} KB guardados neste aparelho</span>
                  </div>
                  <button type="button" className="primary" onClick={retryPendingAfaAudio} disabled={audioProcessing || audioRecording}>
                    <Upload size={15} />
                    Enviar novamente
                  </button>
                </div>
                {pendingAfaAudioUrl && <audio controls preload="metadata" src={pendingAfaAudioUrl} />}
                <small>Ele sera excluido automaticamente quando a transcricao organizar a ficha.</small>
              </div>
            )}

            <label className="audio-transcript">
              <span>Transcricao ou observacao digitada</span>
              <textarea
                value={audioTranscript}
                onChange={(event) => setAudioTranscript(event.target.value)}
                placeholder="Ex.: O aluno tem participado mais, mas ainda se dispersa em explicacoes longas..."
              />
            </label>

            <div className="audio-chip-panel">
              <div className="audio-chip-heading">
                <strong>Chips aprendidos</strong>
                <span>{audioExpressionChips.length} expressao(oes)</span>
              </div>
              <div className="audio-chip-section">
                <span>Recorrentes</span>
                {recurringAudioChips.length > 0 ? (
                  <div className="audio-chip-list">
                    {recurringAudioChips.map((chip) => (
                      <div className="audio-chip-pill" key={chip.id}>
                        <button type="button" onClick={() => insertAudioChipText(chip.text)} title={`Inserir: ${chip.text}`}>
                          {getAudioChipLabel(chip.text)}
                          <small>{chip.count} alunos</small>
                        </button>
                        <button type="button" className="audio-chip-remove" onClick={() => removeAudioChip(chip.id)} title="Remover chip">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>As expressoes repetidas em alunos diferentes aparecem aqui.</p>
                )}
              </div>
              {recentAudioChips.length > 0 && (
                <div className="audio-chip-section">
                  <span>Em observacao</span>
                  <div className="audio-chip-list">
                    {recentAudioChips.map((chip) => (
                      <div className="audio-chip-pill muted" key={chip.id}>
                        <button type="button" onClick={() => insertAudioChipText(chip.text)} title={`Inserir: ${chip.text}`}>
                          {getAudioChipLabel(chip.text)}
                          <small>{chip.count} aluno</small>
                        </button>
                        <button type="button" className="audio-chip-remove" onClick={() => removeAudioChip(chip.id)} title="Remover chip">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {audioError && (
              <div className="audio-error">
                <AlertTriangle size={16} />
                <div className="audio-error-content">
                  <span>{audioError}</span>
                  {audioDebugLog && (
                    <div className="audio-debug-actions">
                      <button type="button" className="ghost compact-btn" onClick={copyAudioDebugLog}>
                        <Copy size={14} />
                        Copiar logs
                      </button>
                      <details>
                        <summary>Ver logs</summary>
                        <textarea readOnly value={audioDebugLog} onFocus={(event) => event.currentTarget.select()} />
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="actions">
              <button type="button" onClick={organizeAudioTranscript} disabled={audioProcessing || !audioTranscript.trim()}>
                <Sparkles size={16} />
                Organizar texto
              </button>
              <label className="compact-select">
                Aplicar
                <select value={audioApplyMode} onChange={(event) => setAudioApplyMode(event.target.value as AfaAudioApplyMode)}>
                  <option value="merge">Mesclar</option>
                  <option value="replace">Substituir</option>
                </select>
              </label>
            </div>

            <div className="audio-preview">
              <div className="audio-preview-header">
                <strong>Previa do rascunho</strong>
                {audioDraft?.alertLevel && <span>{alertLabels[audioDraft.alertLevel]}</span>}
              </div>
              {audioDraft ? (
                <>
                  <div className="audio-preview-grid">
                    {afaAudioProfileFields
                      .filter((field) => audioDraft.profile[field])
                      .map((field) => (
                        <div className="audio-preview-item" key={field}>
                          <span>{afaAudioProfileLabels[field]}</span>
                          <p>{audioDraft.profile[field]}</p>
                        </div>
                      ))}
                  </div>
                  {(audioDraft.tags.length > 0 || audioDraft.incidents.length > 0) && (
                    <div className="audio-preview-meta">
                      {audioDraft.tags.length > 0 && <p>Tags: {audioDraft.tags.join(", ")}</p>}
                      {audioDraft.incidents.length > 0 && (
                        <p>Ocorrencias: {audioDraft.incidents.map((incident) => incident.title).join(", ")}</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-list">
                  <strong>Nenhum rascunho ainda</strong>
                  <span>Grave um audio ou organize o texto digitado.</span>
                </div>
              )}
            </div>

            <div className="actions">
              <button type="button" onClick={closeAudioAfa}>Cancelar</button>
              <button className="primary" type="button" onClick={applyAudioDraft} disabled={!audioDraft || audioProcessing}>
                <Check size={16} />
                Aplicar na ficha
              </button>
            </div>
          </section>
        </div>
      )}

      {commandOpen && (
        <div className="modal-backdrop">
          <section className="modal command-palette" role="dialog" aria-modal="true" aria-label="Busca global">
            <div className="modal-header">
              <div>
                <h2>Busca global</h2>
                <p>Abra alunos, vistos, pendencias ou NotasEdit.</p>
              </div>
              <button className="icon-button" onClick={() => setCommandOpen(false)} title="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="command-search">
              <Search size={16} />
              <input
                autoFocus
                aria-label="Buscar comando ou aluno"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Digite aluno ou acao"
              />
            </div>
            <div className="command-list">
              {commandItems.length === 0 ? (
                <div className="empty-list">
                  <strong>Nada encontrado</strong>
                  <span>Tente buscar pelo nome do aluno ou por uma acao.</span>
                </div>
              ) : (
                commandItems.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => {
                      item.run();
                      setCommandOpen(false);
                      setCommandQuery("");
                    }}
                  >
                    <span>{item.label}</span>
                    <small>{item.meta}</small>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {quickIncidentOpen && (
        <div className="modal-backdrop">
          <section className="modal quick-incident-modal" role="dialog" aria-modal="true" aria-label="Ocorrencia rapida">
            <div className="modal-header">
              <div>
                <h2>Ocorrencia rapida</h2>
                <p>Selecione um aluno e registre em um clique.</p>
              </div>
              <button className="icon-button" onClick={() => setQuickIncidentOpen(false)} title="Fechar">
                <X size={18} />
              </button>
            </div>
            <select
              aria-label="Aluno da ocorrencia rapida"
              value={quickIncidentStudentId}
              onChange={(event) => setQuickIncidentStudentId(event.target.value)}
            >
              <option value="">Selecione o aluno</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} - {student.className || "Sem turma"}
                </option>
              ))}
            </select>
            <div className="quick-incident-grid">
              <button type="button" onClick={() => addQuickIncident("Participou bem", "positivo")} disabled={!quickIncidentStudentId}>
                Participou bem
              </button>
              <button type="button" onClick={() => addQuickIncident("Evoluiu na postura em sala", "positivo")} disabled={!quickIncidentStudentId}>
                Evoluiu na postura
              </button>
              <button type="button" onClick={() => addQuickIncident("Nao fez atividade", "pedagogico")} disabled={!quickIncidentStudentId}>
                Nao fez atividade
              </button>
              <button type="button" onClick={() => addQuickIncident("Disperso durante a aula", "observacao")} disabled={!quickIncidentStudentId}>
                Disperso
              </button>
              <button type="button" onClick={() => addQuickIncident("Convivencia precisa de atencao", "social")} disabled={!quickIncidentStudentId}>
                Convivencia
              </button>
              <button type="button" onClick={() => addQuickIncident("Familia acionada", "familia")} disabled={!quickIncidentStudentId}>
                Familia acionada
              </button>
            </div>
          </section>
        </div>
      )}

      {duplicateWarning && (
        <div className="modal-backdrop">
          <section className="modal duplicate-warning-modal">
            <div className="modal-header">
              <div>
                <h2>⚠️ Atividade Repetida Detectada</h2>
                <p>Já existe um registro com as mesmas características.</p>
              </div>
              <button className="icon-button" onClick={() => setDuplicateWarning(null)} title="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Encontramos uma atividade para a turma <strong>{duplicateWarning.className}</strong> em <strong>{formatDate(duplicateWarning.date)}</strong> sob o nome de <strong>"{duplicateWarning.title}"</strong>.
              </p>
              <p>Como deseja prosseguir?</p>
            </div>
            <div className="actions">
              <button onClick={() => setDuplicateWarning(null)}>Cancelar</button>
              <button className="primary" onClick={() => {
                const existingId = duplicateWarning.existingSessionId;
                setDuplicateWarning(null);
                loadSessionForEdit(existingId);
              }}>
                <Edit size={16} />
                Mesclar / Editar Registro Existente
              </button>
              <button className="danger" onClick={() => executeSaveSession(true)}>
                Salvar como Nova Atividade mesmo assim
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );

  function updateProfile(id: string, field: keyof Student["profile"], value: string) {
    updateStudent(id, (student) => ({
      ...student,
      profile: { ...student.profile, [field]: value },
    }));
  }
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileField({
  label,
  value,
  placeholder,
  groups,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  groups?: PhraseGroup[];
  onChange: (value: string) => void;
}) {
  const [customPhrase, setCustomPhrase] = useState("");

  function addCustomPhrase() {
    if (!customPhrase.trim()) return;
    onChange(appendPhrase(value, customPhrase));
    setCustomPhrase("");
  }

  return (
    <div className="profile-field">
      <span>{label}</span>
      <textarea
        aria-label={label}
        value={value}
        placeholder={placeholder || "Digite frases curtas e objetivas."}
        onChange={(event) => onChange(event.target.value)}
      />
      {groups && <PhrasePicker groups={groups} onPick={(phrase) => onChange(appendPhrase(value, phrase))} />}
      <div className="custom-phrase">
        <input
          aria-label={`Complemento para ${label}`}
          value={customPhrase}
          onChange={(event) => setCustomPhrase(event.target.value)}
          placeholder="Complemento próprio"
        />
        <button type="button" onClick={addCustomPhrase}>
          <Plus size={15} />
          Inserir
        </button>
      </div>
    </div>
  );
}

function PhrasePicker({
  groups,
  onPick,
}: {
  groups: PhraseGroup[];
  onPick: (phrase: string) => void;
}) {
  return (
    <div className="phrase-picker">
      {groups.map((group) => (
        <div className="phrase-group" key={group.title}>
          <strong>
            <Sparkles size={13} />
            {group.title}
          </strong>
          <div className="phrase-chips">
            {group.phrases.map((phrase) => (
              <button type="button" key={phrase} onClick={() => onPick(phrase)}>
                {phrase}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function withStudentDefaults(student: Student): Student {
  return {
    ...student,
    campus: student.campus || "Não definido",
    status: student.status || "Cadastrado",
  };
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
