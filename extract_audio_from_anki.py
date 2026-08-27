"""
extract_audio_from_anki.py
----------------------------
Takes an Anki deck package (.apkg) you've exported after generating audio
with HyperTTS, and pulls the mp3s out with the filenames this app expects
(lesson_l1_0.mp3, pack_p21_2.mp3, chat_travel_1_t2_you0.mp3, etc.) instead
of Anki's internal content-hash names.

TWO-VOICE SETUP (2026-08-27): the app now has a Female/Male voice toggle
(Profile > Voice), reading from audio/female/ and audio/male/ instead of a
single flat audio/ folder. You'll run the SAME phrase list through HyperTTS
TWICE — once per voice — and this script needs to know which voice folder
each export belongs in. See VOICE_FOLDER usage below.

FIELD-NAME MATCHING (added once the male pass started, 2026-08-27): the
male .apkg export carries BOTH the original Vietnamese_Sound field (still
holding the female recordings from the first pass, since it's the same
Anki notes/deck reused) AND a new Vietnamese_Male_Sound field with the
fresh male recordings. This script resolves which field to read PER VOICE
BY NAME (see AUDIO_FIELD_NAME_BY_VOICE below) — it does NOT just grab the
first [sound:...] tag it finds in field order, because with two sound
fields present that would silently pull the female audio again for the
"male" extraction (whichever field happens to come first). If your actual
field names differ, edit AUDIO_FIELD_NAME_BY_VOICE to match (check
Tools > Manage Note Types > [your type] > Fields in Anki if unsure).

HOW TO GET HERE (do this in Anki first):

    1. Import vietnamese_audio_master.csv into a new note type with three
       fields: ID, Vietnamese_Text, English_Text (English is optional —
       just there so the cards read sensibly in Anki, not used by the app).
       File > Import... in Anki, map the CSV columns to those fields,
       put it all in a fresh deck (e.g. "LaiLingo TTS"). This file has
       ONE row per unique Vietnamese sentence (not one row per app id —
       duplicate sentences that back multiple ids, like "cảm ơn" appearing
       as both a lesson word and a concept-card example, are only listed
       once here; apply_audio_copies.py fans the single recording back out
       to every id after extraction, exactly like previous rounds).

    2. Install HyperTTS if you haven't: Tools > Add-ons > Get Add-ons >
       code 111623432. Restart Anki.

    3. Subscribe to HyperTTS Pro (from within the HyperTTS menu, or at
       vocab.ai) — this unlocks their bundled FPT.AI Vietnamese voices,
       no separate FPT.AI account needed.

    4. Tools > HyperTTS > Services Configuration: enable the FPT.AI
       service (the Pro-bundled one, not "FptAiClassic").

    5. Tools > HyperTTS > choose your "LaiLingo TTS" note type, set
       Source field = Vietnamese_Text, Target field = Vietnamese_Sound (for
       the female pass) or a separate Vietnamese_Male_Sound field (for the
       male pass, so you don't overwrite the female recordings already
       sitting in Vietnamese_Sound) — pick a Southern Vietnamese voice,
       Linh San (female) or Minh Quang (male), preview a few, then run
       batch generate for the whole deck/note type. ~7,300 cards, so this
       takes a while.

    6. File > Export > "Anki Deck Package (*.apkg)" after EACH voice pass,
       choose the "LaiLingo TTS" deck, make sure "Support older Anki
       versions" is OFF and media is included (it is by default). Save
       each export with a name that tells the voices apart, e.g.
       lailingo_female.apkg and lailingo_male.apkg — don't overwrite one
       with the other.

THEN RUN THIS SCRIPT ONCE PER VOICE EXPORT:

    python extract_audio_from_anki.py lailingo_female.apkg female
    python extract_audio_from_anki.py lailingo_male.apkg male

    Each run creates/fills an "audio/<voice>/" folder with correctly-named
    mp3s (just the ~7,300 unique-sentence masters at this point — see step
    7). Move/keep that "audio" folder next to LaiLingo.html.

AFTER BOTH EXTRACTIONS, fan the master recordings out to every duplicate id:

    python apply_audio_copies.py . female
    python apply_audio_copies.py . male

    (apply_audio_copies.py now takes the voice folder as its second
    argument and reads audio_copy_pairs_master.json — the full ~2,456-pair
    map covering every id in the app, not just the lessons/topics subset
    the old audio_copy_pairs.json covered. Every speaker button in the app
    will then use these instead of falling back to browser TTS, in
    whichever voice the user has picked in Profile > Voice.)

NOTES:
    - This only reads the .apkg (a zip file) — no Anki installation
      needed to run this script, just Python's standard library.
    - ID_FIELD_NAME / AUDIO_FIELD_NAME_BY_VOICE below are matched by name
      against your actual note type's field list (case-insensitive). If
      your CSV import used different field names, update these constants.
"""

import json
import os
import re
import sqlite3
import sys
import tempfile
import zipfile

ID_FIELD_NAME = "id"
AUDIO_FIELD_NAME_BY_VOICE = {
    "female": "vietnamese_female_sound",
    "male": "vietnamese_male_sound",
}


def find_sound_filename(field_text):
    m = re.search(r"\[sound:([^\]]+)\]", field_text or "")
    return m.group(1) if m else None


def resolve_field_indices(field_names, voice):
    """Match this note type's field list by NAME (case-insensitive) rather
    than by position, since a note type can carry both Vietnamese_Sound
    (female) and Vietnamese_Male_Sound (male) at once — position/auto-detect
    logic would silently grab whichever sound field comes first regardless
    of which voice pass this is. Returns (id_idx, audio_idx, matched_name);
    audio_idx/matched_name are None if no exact or partial name match was
    found (caller falls back to scanning all fields, with a warning)."""
    lower = [(n or "").strip().lower() for n in field_names]
    id_idx = next((i for i, n in enumerate(lower) if n == ID_FIELD_NAME), 0)

    target = AUDIO_FIELD_NAME_BY_VOICE.get(voice, "")
    # Exact name match first (normalizing spaces/underscores away).
    norm = lambda s: s.replace("_", "").replace(" ", "")
    audio_idx = next((i for i, n in enumerate(lower) if norm(n) == norm(target)), None)
    matched_name = field_names[audio_idx] if audio_idx is not None else None

    if audio_idx is None:
        # Partial match: for "male" must contain both "male" and "sound";
        # for "female" must contain "sound" but NOT "male" (so it doesn't
        # accidentally match the male field when a name varies slightly).
        for i, n in enumerate(lower):
            if voice == "male" and "male" in n and "sound" in n:
                audio_idx, matched_name = i, field_names[i]
                break
            if voice == "female" and "sound" in n and "male" not in n:
                audio_idx, matched_name = i, field_names[i]
                break

    return id_idx, audio_idx, matched_name


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ("female", "male"):
        sys.exit(
            "Usage: python extract_audio_from_anki.py your_export.apkg <female|male>\n"
            "  The voice argument is required now that the app has two voice\n"
            "  folders (audio/female/, audio/male/) — say which one this\n"
            "  particular .apkg export's recordings are for."
        )
    apkg_path = sys.argv[1]
    voice = sys.argv[2]
    if not os.path.exists(apkg_path):
        sys.exit(f"Can't find {apkg_path}")

    output_dir = os.path.join("audio", voice)
    os.makedirs(output_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(apkg_path) as z:
            z.extractall(tmp)

        media_map_path = os.path.join(tmp, "media")
        with open(media_map_path, encoding="utf-8") as f:
            media_map = json.load(f)  # {"0": "actualfilename.mp3", ...}
        filename_to_index = {v: k for k, v in media_map.items()}

        db_path = os.path.join(tmp, "collection.anki21")
        if not os.path.exists(db_path):
            db_path = os.path.join(tmp, "collection.anki2")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        cur.execute("SELECT models FROM col")
        models_json = json.loads(cur.fetchone()[0])
        model_fields = {
            mid: [f["name"] for f in sorted(m["flds"], key=lambda f: f["ord"])]
            for mid, m in models_json.items()
        }

        cur.execute("SELECT mid, flds FROM notes")
        rows = cur.fetchall()

        written, skipped = 0, 0
        warned_fallback = False
        announced_match = False
        for mid, flds in rows:
            fields = flds.split("\x1f")
            field_names = model_fields.get(str(mid), [])
            id_idx, audio_idx, matched_name = resolve_field_indices(field_names, voice)
            if id_idx >= len(fields):
                id_idx = 0
            card_id = fields[id_idx].strip()
            if not card_id:
                skipped += 1
                continue

            if audio_idx is not None and not announced_match:
                print(f"[{voice}] Reading audio from field '{matched_name}' (matched by name).")
                announced_match = True

            sound_file = None
            if audio_idx is not None and audio_idx < len(fields):
                sound_file = find_sound_filename(fields[audio_idx])
            if not sound_file and audio_idx is None:
                if not warned_fallback:
                    wanted = AUDIO_FIELD_NAME_BY_VOICE.get(voice, voice)
                    print(
                        f"  WARNING: couldn't find a field named like '{wanted}' on this note "
                        f"type (fields seen: {field_names}) — falling back to scanning ALL "
                        f"fields for the first [sound:...] tag. If this note type has BOTH a "
                        f"female and male sound field, that fallback may grab the WRONG voice. "
                        f"Check field names in Anki if the extracted audio sounds off."
                    )
                    warned_fallback = True
                for f in fields:
                    sound_file = find_sound_filename(f)
                    if sound_file:
                        break
            if not sound_file:
                print(f"  no audio found for {card_id}")
                skipped += 1
                continue

            idx = filename_to_index.get(sound_file)
            if idx is None:
                print(f"  media file missing from package for {card_id}: {sound_file}")
                skipped += 1
                continue

            src = os.path.join(tmp, idx)
            dst = os.path.join(output_dir, f"{card_id}.mp3")
            with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
                fdst.write(fsrc.read())
            written += 1

        print(f"\nDone. Wrote {written} files to ./{output_dir}/  ({skipped} skipped)")
        print(f"Next: python apply_audio_copies.py . {voice}   (fans these master recordings out to every duplicate id)")


if __name__ == "__main__":
    main()
