// Google Cloud Text-to-Speech (REST, API-key auth). Server/script only — the API key
// is a server secret (NOT NEXT_PUBLIC), so never import this into a client component.
// Used to synthesize Chinese audio for imported cards that ship without it (see
// scripts/import-apkg.ts). Voice/locale are env-configurable; defaults are Mandarin.
const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

export type TtsOptions = {
  voice?: string;
  languageCode?: string;
};

/** Synthesize `text` to an MP3 Buffer. Retries transient failures a few times. */
export async function synthesizeMp3(text: string, opts: TtsOptions = {}): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY is not set");
  const voice = opts.voice ?? process.env.GOOGLE_TTS_VOICE ?? "cmn-CN-Wavenet-A";
  const languageCode = opts.languageCode ?? process.env.GOOGLE_TTS_LANGUAGE_CODE ?? "cmn-CN";

  const body = JSON.stringify({
    input: { text },
    voice: { languageCode, name: voice },
    audioConfig: { audioEncoding: "MP3" },
  });

  const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 500 + attempt * 1000));
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      });
    } catch (err) {
      // network/transport error — retryable; don't sleep after the final attempt
      lastErr = err;
      if (attempt < 2) await backoff(attempt);
      continue;
    }
    if (res.ok) {
      const json = (await res.json()) as { audioContent?: string };
      if (!json.audioContent) throw new Error("Google TTS: empty audioContent");
      return Buffer.from(json.audioContent, "base64");
    }
    // Retry only rate-limit / server errors; fail fast on 4xx (bad key, bad request).
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Google TTS ${res.status}`);
      if (attempt < 2) await backoff(attempt);
      continue;
    }
    const detail = await res.text();
    throw new Error(`Google TTS ${res.status}: ${detail.slice(0, 300)}`);
  }
  throw lastErr instanceof Error ? lastErr : new Error("Google TTS failed");
}
