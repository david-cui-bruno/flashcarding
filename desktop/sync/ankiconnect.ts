// Typed AnkiConnect client (JSON-RPC over http://127.0.0.1:8765, API version 6).
// AnkiConnect is the de-facto local HTTP API add-on for desktop Anki (add-on 2055492159);
// docs/INTEGRATIONS.md §1 is the architecture this implements the Anki side of.
//
// Origin handling: AnkiConnect whitelists browser origins (webCorsOriginList) and pops a
// permission dialog for unknown ones — but requests with NO Origin header are always
// allowed (see its web.py allowOrigin: `else: allowed = True`). Node's fetch sends no
// Origin, so a native helper needs no permission dance. We still expose
// `requestPermission()` for completeness, and never set an Origin header ourselves.

export const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
export const ANKI_CONNECT_VERSION = 6;
export const ANKI_CONNECT_ADDON_CODE = "2055492159";

/** Thrown for every failure mode, with a `kind` the caller can branch on. */
export class AnkiConnectError extends Error {
  constructor(
    message: string,
    readonly kind: "not-running" | "plugin-missing" | "permission" | "api",
  ) {
    super(message);
    this.name = "AnkiConnectError";
  }
}

// ---- wire types (subset we use, shapes match the add-on's __init__.py) ----

export type NoteInfo = {
  noteId: number;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  modelName: string;
  /** note mod time, SECONDS since epoch (present in current AnkiConnect builds). */
  mod?: number;
  cards: number[];
};

export type CardInfo = {
  cardId: number;
  fields: Record<string, { value: string; order: number }>;
  fieldOrder: number;
  question: string;
  answer: string;
  modelName: string;
  ord: number;
  deckName: string;
  css: string;
  factor: number;
  interval: number;
  note: number; // note id
  type: number;
  queue: number;
  due: number;
  reps: number;
  lapses: number;
  left: number;
  mod: number; // card mod time, seconds
};

/** One revlog row (getReviewsOfCards). `id` is the review time in ms; `time` is ms taken. */
export type CardReview = {
  id: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
};

/** cardReviews returns positional rows: [reviewTime, cardID, usn, ease, ivl, lastIvl, factor, time, type] */
export type CardReviewRow = [number, number, number, number, number, number, number, number, number];

export type NoteModTime = { noteId: number; mod: number };

export type AddNoteParams = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
  options?: { allowDuplicate?: boolean; duplicateScope?: string };
};

export class AnkiConnectClient {
  constructor(private readonly url: string = ANKI_CONNECT_URL) {}

  /** Low-level invoke. Maps transport + API errors to AnkiConnectError. */
  async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, ...(params ? { params } : {}) }),
      });
    } catch (e) {
      // Node wraps ECONNREFUSED in a TypeError("fetch failed") with a cause.
      const cause = (e as { cause?: { code?: string } }).cause;
      if (cause?.code === "ECONNREFUSED" || cause?.code === "ECONNRESET") {
        throw new AnkiConnectError(
          `Anki is not running (connection refused at ${this.url}). Start Anki first: open -a Anki`,
          "not-running",
        );
      }
      throw new AnkiConnectError(
        `Could not reach AnkiConnect at ${this.url}: ${e instanceof Error ? e.message : String(e)}`,
        "not-running",
      );
    }
    // Anki running but the add-on missing → some OTHER server answered, or Anki's own
    // media server (403/404). AnkiConnect itself always answers 200 or 403(origin).
    if (res.status === 403) {
      throw new AnkiConnectError(
        "AnkiConnect refused this origin. Native clients should send no Origin header; " +
          "if calling from a browser, add the origin to webCorsOriginList or call requestPermission first.",
        "permission",
      );
    }
    if (!res.ok) {
      throw new AnkiConnectError(
        `Unexpected HTTP ${res.status} from ${this.url} — is AnkiConnect (add-on ${ANKI_CONNECT_ADDON_CODE}) installed? ` +
          "Anki → Tools → Add-ons → Get Add-ons.",
        "plugin-missing",
      );
    }
    const body = (await res.json()) as { result: T; error: string | null };
    if (body.error) {
      if (body.error.includes("unsupported action")) {
        throw new AnkiConnectError(
          `AnkiConnect does not support "${action}" — the installed add-on build is outdated. ` +
            `Update it (add-on ${ANKI_CONNECT_ADDON_CODE}) and restart Anki.`,
          "plugin-missing",
        );
      }
      if (body.error.includes("valid api key")) {
        throw new AnkiConnectError(
          "AnkiConnect requires an API key (apiKey is set in its config). Pass it or clear the config.",
          "permission",
        );
      }
      throw new AnkiConnectError(`AnkiConnect ${action} failed: ${body.error}`, "api");
    }
    return body.result;
  }

  /** True if Anki + AnkiConnect are reachable. */
  async ping(): Promise<boolean> {
    try {
      await this.version();
      return true;
    } catch {
      return false;
    }
  }

  version(): Promise<number> {
    return this.invoke<number>("version");
  }

  /** Only needed from browser contexts (see header note); native callers are always allowed. */
  requestPermission(): Promise<{ permission: "granted" | "denied"; requireApikey?: boolean; version?: number }> {
    return this.invoke("requestPermission");
  }

  deckNames(): Promise<string[]> {
    return this.invoke<string[]>("deckNames");
  }

  deckNamesAndIds(): Promise<Record<string, number>> {
    return this.invoke<Record<string, number>>("deckNamesAndIds");
  }

  /** Anki search query, e.g. `deck:"My Deck"`. Returns note ids. */
  findNotes(query: string): Promise<number[]> {
    return this.invoke<number[]>("findNotes", { query });
  }

  notesInfo(notes: number[]): Promise<NoteInfo[]> {
    return this.invoke<NoteInfo[]>("notesInfo", { notes });
  }

  /** Cheap id→mod listing for incremental sync. Needs a current AnkiConnect build. */
  notesModTime(notes: number[]): Promise<NoteModTime[]> {
    return this.invoke<NoteModTime[]>("notesModTime", { notes });
  }

  findCards(query: string): Promise<number[]> {
    return this.invoke<number[]>("findCards", { query });
  }

  cardsInfo(cards: number[]): Promise<CardInfo[]> {
    return this.invoke<CardInfo[]>("cardsInfo", { cards });
  }

  /** Full review history per card id (revlog rows keyed by card). */
  getReviewsOfCards(cards: number[]): Promise<Record<string, CardReview[]>> {
    return this.invoke<Record<string, CardReview[]>>("getReviewsOfCards", { cards });
  }

  /** Reviews in a deck after a revlog id (ms timestamp); positional rows. */
  cardReviews(deck: string, startID: number): Promise<CardReviewRow[]> {
    return this.invoke<CardReviewRow[]>("cardReviews", { deck, startID });
  }

  /** Base64 contents of a file in Anki's media folder, or false if absent. */
  retrieveMediaFile(filename: string): Promise<string | false> {
    return this.invoke<string | false>("retrieveMediaFile", { filename });
  }

  // -- used by tests/tooling (creating fixtures), not by the one-way sync itself --

  createDeck(deck: string): Promise<number> {
    return this.invoke<number>("createDeck", { deck });
  }

  addNote(note: AddNoteParams): Promise<number> {
    return this.invoke<number>("addNote", { note });
  }

  updateNoteFields(id: number, fields: Record<string, string>): Promise<null> {
    return this.invoke<null>("updateNoteFields", { note: { id, fields } });
  }

  deleteDecks(decks: string[], cardsToo = true): Promise<null> {
    return this.invoke<null>("deleteDecks", { decks, cardsToo });
  }
}

/** Escape a deck name for use inside an Anki search query: deck:"…". */
export function deckQuery(deckName: string): string {
  return `deck:"${deckName.replace(/([\\"])/g, "\\$1")}"`;
}
