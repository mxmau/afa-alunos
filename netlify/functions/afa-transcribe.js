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

function cleanMimeType(mimeType) {
  const type = typeof mimeType === "string" ? mimeType.split(";")[0].trim().toLowerCase() : "";
  return type || "audio/webm";
}

function getAudioExtension(mimeType) {
  const type = cleanMimeType(mimeType);
  if (type.includes("mp4")) return "mp4";
  if (type.includes("mpeg")) return "mpeg";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("webm")) return "webm";
  return "webm";
}

function compactText(value, maxLength = 12000) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
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

  if (!payload.audioBase64) {
    return json(400, { error: "audioBase64 obrigatorio." });
  }

  try {
    const buffer = Buffer.from(payload.audioBase64, "base64");
    if (!buffer.length) {
      return json(400, { error: "Audio vazio." });
    }

    const formData = new FormData();
    const safeMimeType = cleanMimeType(payload.mimeType);
    const safeFileName = payload.fileName || `afa-audio.${getAudioExtension(safeMimeType)}`;
    const blob = new Blob([buffer], { type: safeMimeType });
    formData.append("file", blob, safeFileName);
    formData.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error?.message || "Falha ao transcrever o audio.");
      error.status = response.status;
      error.code = result.error?.code || result.error?.type || "";
      throw error;
    }

    const transcript = compactText(result.text, 12000);
    return json(200, { transcript });
  } catch (error) {
    return json(502, {
      error: error instanceof Error ? error.message : "Erro ao transcrever audio AFA.",
      code: error?.code || "openai_request_failed",
      status: error?.status || 502,
      fallback: canUseFreeFallback(error),
    });
  }
}
