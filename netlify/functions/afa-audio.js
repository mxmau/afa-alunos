const PROFILE_FIELDS = [
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

const ALERT_LEVELS = new Set(["tranquilo", "observacao", "atencao", "prioridade"]);
const INCIDENT_TYPES = new Set(["positivo", "observacao", "familia", "pedagogico", "social"]);

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function createOpenAiError(response, result, defaultMessage) {
  const error = new Error(result.error?.message || defaultMessage);
  error.status = response.status;
  error.code = result.error?.code || result.error?.type || "";
  return error;
}

function canUseFreeFallback(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "").toLocaleLowerCase("pt-BR");
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");

  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 429 ||
    code.includes("quota") ||
    code.includes("billing") ||
    code.includes("credit") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("credit") ||
    message.includes("limite")
  );
}

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(value, maxLength = 900) {
  const text = toText(value).replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;
  if (!Array.isArray(responseJson.output)) return "";

  return responseJson.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

function parseJsonObject(rawText) {
  const text = toText(rawText);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1));
  }
}

function sanitizeDraft(input) {
  const draft = input && typeof input === "object" ? input : {};
  const profileSource = draft.profile && typeof draft.profile === "object" ? draft.profile : draft;
  const profile = {};

  for (const field of PROFILE_FIELDS) {
    const value = compactText(profileSource[field]);
    if (value) profile[field] = value;
  }

  const tags = Array.isArray(draft.tags)
    ? [...new Set(draft.tags.map((tag) => compactText(tag, 36).toLocaleLowerCase("pt-BR")).filter(Boolean))].slice(0, 8)
    : [];

  const incidents = Array.isArray(draft.incidents)
    ? draft.incidents
        .map((incident) => {
          const type = INCIDENT_TYPES.has(incident?.type) ? incident.type : "observacao";
          const title = compactText(incident?.title, 80);
          const notes = compactText(incident?.notes, 420);
          if (!title && !notes) return null;
          return {
            type,
            title: title || "Registro por audio",
            notes,
          };
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    profile,
    alertLevel: ALERT_LEVELS.has(draft.alertLevel) ? draft.alertLevel : undefined,
    tags,
    incidents,
  };
}

async function transcribeAudio({ audioBase64, mimeType, fileName, apiKey }) {
  if (!audioBase64) return "";

  const buffer = Buffer.from(audioBase64, "base64");
  if (!buffer.length) return "";

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });
  formData.append("file", blob, fileName || "afa-audio.webm");
  formData.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  formData.append("language", "pt");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createOpenAiError(response, result, "Falha ao transcrever o audio.");
  }

  return compactText(result.text, 12000);
}

async function structureTranscript({ transcript, student, existingProfile, apiKey }) {
  const prompt = {
    student,
    existingProfile,
    transcript,
    allowedProfileFields: PROFILE_FIELDS,
    allowedAlertLevels: [...ALERT_LEVELS],
    allowedIncidentTypes: [...INCIDENT_TYPES],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5-nano",
      input: [
        {
          role: "system",
          content:
            "Voce organiza observacoes escolares em portugues brasileiro. Retorne somente JSON valido, sem markdown. Nao invente fatos. Use frases curtas, objetivas e adequadas para conversa com familia. Se algo for incerto, escreva como observacao, nao como diagnostico.",
        },
        {
          role: "user",
          content:
            "Monte um rascunho AFA com este formato exato: {\"profile\":{\"resumoRapido\":\"\",\"personalidade\":\"\",\"positivos\":\"\",\"atencao\":\"\",\"social\":\"\",\"pedagogico\":\"\",\"melhorar\":\"\",\"manter\":\"\",\"apoioFamilia\":\"\"},\"alertLevel\":\"tranquilo|observacao|atencao|prioridade\",\"tags\":[\"\"],\"incidents\":[{\"type\":\"positivo|observacao|familia|pedagogico|social\",\"title\":\"\",\"notes\":\"\"}]}. Dados: " +
            JSON.stringify(prompt),
        },
      ],
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createOpenAiError(response, result, "Falha ao organizar o texto.");
  }

  const outputText = extractOutputText(result);
  return sanitizeDraft(parseJsonObject(outputText));
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Metodo nao permitido." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(500, {
      error: "OPENAI_API_KEY nao configurada no Netlify.",
      code: "missing_api_key",
      fallback: true,
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON invalido." });
  }

  try {
    const transcript =
      compactText(payload.transcript, 12000) ||
      (await transcribeAudio({
        audioBase64: payload.audioBase64,
        mimeType: payload.mimeType,
        fileName: payload.fileName,
        apiKey,
      }));

    if (!transcript) {
      return json(400, { error: "Envie um audio ou uma transcricao." });
    }

    const draft = await structureTranscript({
      transcript,
      student: payload.student || null,
      existingProfile: payload.existingProfile || null,
      apiKey,
    });

    return json(200, { transcript, draft, source: "openai" });
  } catch (error) {
    return json(502, {
      error: error instanceof Error ? error.message : "Erro ao processar audio AFA.",
      code: error?.code || "openai_request_failed",
      status: error?.status || 502,
      fallback: canUseFreeFallback(error),
    });
  }
}
