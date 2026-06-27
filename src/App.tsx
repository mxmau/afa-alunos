import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardList,
  Cloud,
  Copy,
  Download,
  FilePlus,
  Filter,
  LayoutDashboard,
  LogIn,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { type User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { isStudentBackup } from "./lib/backup";
import { buildStudentsCsv, buildStudentsJson } from "./lib/exportStudents";
import { needsNameReview } from "./lib/importReview";
import { buildStudentsFromImport } from "./lib/importStudents";
import { readLocalStudents, writeLocalStudents } from "./lib/localStore";
import { extractStudentsFromPdfs } from "./lib/pdfImport";
import { getProfileCompletion, hasProfile, ProfileFilter } from "./lib/profile";
import { appendPhrase, incidentPhraseBank, PhraseGroup, profilePhraseBank } from "./lib/quickPhrases";
import { buildFamilyBriefing, formatDate } from "./lib/report";
import { supabase } from "./lib/supabase";
import { createStudent, touchStudent } from "./lib/student";
import { buildWhatsAppShareUrl } from "./lib/whatsapp";
import { AlertLevel, ImportedStudent, Incident, Student } from "./types";

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
];

const incidentLabels: Record<Incident["type"], string> = {
  positivo: "Positivo",
  observacao: "Observação",
  familia: "Família",
  pedagogico: "Pedagógico",
  social: "Social",
};

type StudentRow = {
  id: string;
  name: string;
  class_name: string | null;
  registration: string | null;
  data: Student;
};

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("todas");
  const [campusFilter, setCampusFilter] = useState("todas");
  const [alertFilter, setAlertFilter] = useState<AlertLevel | "todos">("todos");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("todos");
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [localOnly, setLocalOnly] = useState(!supabase);
  const [email, setEmail] = useState("");
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

  const cloudMode = Boolean(supabase && user && !localOnly);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setLocalOnly(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setHydrated(false);

      if (cloudMode && supabase) {
        const { data, error } = await supabase
          .from("afa_students")
          .select("id,name,class_name,registration,data")
          .order("name", { ascending: true });

        if (!active) return;
        if (error) {
          setMessage(`Não consegui carregar do Supabase: ${error.message}`);
          setStudents(readLocalStudents());
        } else {
          const loaded = ((data ?? []) as StudentRow[]).map((row) => ({
            ...row.data,
            id: row.id,
            name: row.name,
            className: row.class_name ?? row.data.className ?? "",
            registration: row.registration ?? row.data.registration ?? "",
          })).map(withStudentDefaults);
          setStudents(loaded);
          setSelectedId((current) => current || loaded[0]?.id || "");
        }
      } else {
        const local = readLocalStudents().map(withStudentDefaults);
        setStudents(local);
        setSelectedId((current) => current || local[0]?.id || "");
      }

      setHydrated(true);
    }

    load();
    return () => {
      active = false;
    };
  }, [cloudMode]);

  useEffect(() => {
    if (!hydrated) return;

    const timer = window.setTimeout(async () => {
      if (cloudMode && supabase && user) {
        const rows = students.map((student) => ({
          id: student.id,
          user_id: user.id,
          name: student.name,
          class_name: student.className,
          registration: student.registration,
          data: student,
          updated_at: new Date().toISOString(),
        }));

        if (rows.length) {
          const { error } = await supabase.from("afa_students").upsert(rows);
          if (error) setMessage(`Não consegui salvar online: ${error.message}`);
        }
      } else {
        writeLocalStudents(students);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [students, hydrated, cloudMode, user]);

  const selectedStudent = students.find((student) => student.id === selectedId) ?? students[0];
  const classes = useMemo(
    () =>
      [...new Set(students.map((student) => student.className).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [students],
  );
  const campuses = useMemo(
    () =>
      [...new Set(students.map((student) => student.campus || "Não definido").filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [students],
  );

  const importReviewCount = useMemo(
    () => importPreview.filter((student) => needsNameReview(student.name)).length,
    [importPreview],
  );

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return students.filter((student) => {
      const matchesQuery =
        !normalized ||
        student.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        student.tags.some((tag) => tag.toLocaleLowerCase("pt-BR").includes(normalized));
      const matchesClass = classFilter === "todas" || student.className === classFilter;
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
  }, [students, query, classFilter, campusFilter, alertFilter, profileFilter]);

  const stats = useMemo(() => {
    const withRecords = students.filter((student) => hasProfile(student)).length;
    const complete = students.filter((student) => getProfileCompletion(student).isComplete).length;
    const priority = students.filter((student) => student.alertLevel === "prioridade").length;
    const incidents = students.reduce((total, student) => total + student.incidents.length, 0);
    return { withRecords, complete, priority, incidents };
  }, [students]);

  function updateStudent(id: string, updater: (student: Student) => Student) {
    setStudents((current) =>
      current.map((student) => (student.id === id ? touchStudent(updater(student)) : student)),
    );
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
    setStudents((current) => [student, ...current]);
    setSelectedId(student.id);
    setManualName("");
    setManualClass("");
  }

  async function handlePdfImport(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true);
    setMessage("");

    try {
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
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!Array.isArray(parsed)) throw new Error("O arquivo precisa ser um backup JSON exportado pelo app.");

      const restored = parsed.filter(isStudentBackup).map(withStudentDefaults);
      if (!restored.length) throw new Error("Não encontrei alunos válidos nesse backup.");

      const existing = new Map(students.map((student) => [student.id, student]));
      for (const student of restored) {
        existing.set(student.id, touchStudent(student));
      }

      const merged = [...existing.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setStudents(merged);
      setSelectedId(restored[0]?.id || merged[0]?.id || "");
      setMessage(`${restored.length} aluno(s) restaurado(s) do backup.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui restaurar esse backup.");
    }
  }

  function confirmImport() {
    const created = buildStudentsFromImport(importPreview, students);

    setStudents((current) => [...created, ...current].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    setSelectedId(created[0]?.id || selectedId);
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

    if (cloudMode && supabase) {
      const { error } = await supabase.from("afa_students").delete().eq("id", selectedStudent.id);
      if (error) {
        setMessage(`Ficha removida localmente, mas não consegui excluir online: ${error.message}`);
        return;
      }
    }

    setMessage(`Ficha de ${selectedStudent.name} excluída.`);
  }

  async function login() {
    if (!supabase || !email.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setMessage(error ? error.message : "Enviei um link de acesso para seu e-mail.");
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setLocalOnly(true);
  }

  function exportJson() {
    downloadFile("afa-alunos.json", buildStudentsJson(students), "application/json");
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
          {supabase ? (
            user && !localOnly ? (
              <>
                <span>{user.email}</span>
                <button className="icon-button" onClick={logout} title="Sair">
                  <X size={16} />
                </button>
              </>
            ) : (
              <div className="login-form">
                <input
                  aria-label="E-mail para login"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu e-mail"
                  type="email"
                />
                <button onClick={login}>
                  <LogIn size={16} />
                  Entrar
                </button>
                <button className="ghost" onClick={() => setLocalOnly(true)}>
                  Usar local
                </button>
              </div>
            )
          ) : (
            <span>Configure o Supabase para login</span>
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

        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Buscar aluno ou tag"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar aluno ou tag"
          />
        </div>

        <div className="filter-row">
          <Filter size={16} />
          <select
            aria-label="Filtrar por turma"
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
          >
            <option value="todas">Todas as turmas</option>
            {classes.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-row">
          <Cloud size={16} />
          <select
            aria-label="Filtrar por unidade"
            value={campusFilter}
            onChange={(event) => setCampusFilter(event.target.value)}
          >
            <option value="todas">Todas as unidades</option>
            {campuses.map((campus) => (
              <option key={campus} value={campus}>
                {campus}
              </option>
            ))}
          </select>
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

        <div className="student-list">
          {filteredStudents.map((student) => (
            <button
              className={`student-item ${student.id === selectedStudent?.id ? "active" : ""}`}
              key={student.id}
              onClick={() => setSelectedId(student.id)}
            >
              <span className={`status-dot ${student.alertLevel}`} />
              <span>
                <strong>{student.name}</strong>
                <small>
                  {student.className || "Sem turma"} · {student.campus || "Não definido"} ·{" "}
                  {getProfileCompletion(student).percentage}% da ficha
                </small>
              </span>
            </button>
          ))}
          {students.length > 0 && filteredStudents.length === 0 && (
            <div className="empty-list">
              <strong>Nenhum aluno encontrado</strong>
              <span>Ajuste a busca ou os filtros para ver outros alunos.</span>
            </div>
          )}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Panorama do aluno</h1>
            <p>Ficha rápida para reuniões, atendimentos e acompanhamento formativo.</p>
          </div>
          <div className="actions">
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

        <section className="metrics">
          <Metric icon={<Users size={19} />} label="Alunos" value={students.length} />
          <Metric icon={<LayoutDashboard size={19} />} label="Iniciadas" value={stats.withRecords} />
          <Metric icon={<ClipboardList size={19} />} label="Completas" value={stats.complete} />
          <Metric icon={<AlertTriangle size={19} />} label="Prioridade" value={stats.priority} />
          <Metric icon={<BookOpen size={19} />} label="Registros" value={stats.incidents} />
        </section>

        {selectedStudent ? (
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

              <div className="quick-row">
                {quickProfiles.map((profile) => (
                  <button key={profile.label} onClick={() => applyQuickProfile(profile)}>
                    {profile.label}
                  </button>
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
