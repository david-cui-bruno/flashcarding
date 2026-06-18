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

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      });
      if (res.status === 429 || res.status >= 500) {
        // rate-limited / transient — back off and retry
        throw new Error(`Google TTS ${res.status}`);
      }
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Google TTS ${res.status}: ${detail.slice(0, 300)}`);
      }
      const json = (await res.json()) as { audioContent?: string };
      if (!json.audioContent) throw new Error("Google TTS: empty audioContent");
      return Buffer.from(json.audioContent, "base64");
    } catch (err) {
      lastErr = err;
      // backoff: 0.5s, 1.5s
      await new Promise((r) => setTimeout(r, 500 + attempt * 1000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Google TTS failed");
}
