#!/usr/bin/env python3
"""Parse an Anki .apkg into a JSON manifest the tsx importer can consume.

Stdlib only (sqlite3 + zipfile) — no deps, no native builds.

Usage: python3 scripts/apkg/parse-apkg.py <deck.apkg> <workdir>

Writes <workdir>/manifest.json:
  { "deckName": str,
    "notes": [ { "idx": int, "hanzi": str, "pinyin": str, "english": str,
                 "audioDiskPath": str|null, "audioMissing": bool } ] }
Notes are emitted in Anki note-creation order (= the intended study sequence for
ordered decks like Spoonfed Chinese). Present media files are referenced by absolute
disk path under <workdir>/unpacked; missing audio is flagged for TTS by the importer.
"""
import sys, os, json, zipfile, sqlite3, re

SOUND_RE = re.compile(r"\[sound:([^\]]+)\]")

# Map note-type field names -> our roles (case-insensitive substring match).
def classify(fieldnames):
    role = {}
    for i, raw in enumerate(fieldnames):
        n = raw.strip().lower()
        if any(k in n for k in ("hanzi", "chinese", "simplified", "traditional", "characters")):
            role.setdefault("hanzi", i)
        elif "pinyin" in n or "reading" in n:
            role.setdefault("pinyin", i)
        elif any(k in n for k in ("english", "meaning", "translation", "definition", "back")):
            role.setdefault("english", i)
        elif "audio" in n or "sound" in n:
            role.setdefault("audio", i)
    return role

def main():
    if len(sys.argv) != 3:
        print("usage: parse-apkg.py <deck.apkg> <workdir>", file=sys.stderr)
        sys.exit(2)
    apkg, workdir = sys.argv[1], sys.argv[2]
    unpacked = os.path.join(workdir, "unpacked")
    os.makedirs(unpacked, exist_ok=True)

    with zipfile.ZipFile(apkg) as z:
        z.extractall(unpacked)

    # Prefer the modern schema DB.
    db_path = next(
        (os.path.join(unpacked, n) for n in ("collection.anki21b", "collection.anki21", "collection.anki2")
         if os.path.exists(os.path.join(unpacked, n))), None)
    if not db_path:
        print("no collection DB found in apkg", file=sys.stderr); sys.exit(1)

    # media JSON maps numbered-on-disk -> original filename; reverse it.
    media = {}
    mpath = os.path.join(unpacked, "media")
    if os.path.exists(mpath):
        media = json.load(open(mpath, encoding="utf-8"))
    orig_to_num = {v: k for k, v in media.items()}

    db = sqlite3.connect(db_path)
    models = json.loads(db.execute("SELECT models FROM col LIMIT 1").fetchone()[0])
    decks = json.loads(db.execute("SELECT decks FROM col LIMIT 1").fetchone()[0])
    deck_name = next((d.get("name") for did, d in decks.items() if d.get("name") and d.get("name") != "Default"),
                     "Imported deck")

    # Per-model field role mapping.
    model_roles = {}
    for mid, m in models.items():
        names = [f["name"] for f in m["flds"]]
        roles = classify(names)
        # Fallback to Spoonfed positional layout [English, Pinyin, Hanzi, Audio] if names didn't resolve.
        if "hanzi" not in roles and len(names) >= 4:
            roles = {"english": 0, "pinyin": 1, "hanzi": 2, "audio": 3}
        model_roles[int(mid)] = roles

    notes = []
    present = missing = 0
    for idx, (mid, flds) in enumerate(
            db.execute("SELECT mid, flds FROM notes ORDER BY id ASC")):
        roles = model_roles.get(mid, {})
        parts = flds.split("\x1f")
        def get(role):
            i = roles.get(role)
            return parts[i] if i is not None and i < len(parts) else ""
        hanzi = get("hanzi").strip()
        pinyin = get("pinyin").strip()
        english = get("english").strip()
        audio_field = get("audio")

        disk = None
        m = SOUND_RE.findall(audio_field)
        if m and m[0] in orig_to_num:
            disk = os.path.abspath(os.path.join(unpacked, orig_to_num[m[0]]))
            present += 1
        else:
            missing += 1
        notes.append({
            "idx": idx, "hanzi": hanzi, "pinyin": pinyin, "english": english,
            "audioDiskPath": disk, "audioMissing": disk is None,
        })
    db.close()

    out = {"deckName": deck_name, "notes": notes}
    with open(os.path.join(workdir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(json.dumps({
        "deckName": deck_name, "noteCount": len(notes),
        "audioPresent": present, "audioMissing": missing,
        "manifest": os.path.join(workdir, "manifest.json"),
    }))

if __name__ == "__main__":
    main()
