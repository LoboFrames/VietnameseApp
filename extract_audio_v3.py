"""
extract_audio_v3.py — same job as extract_audio_from_anki.py, for Anki's
NEW export format.

Anki 2.1.50+ writes a v3 .apkg when "Support older Anki versions" is OFF:
  meta                 protobuf, contains version 3
  collection.anki21b   zstd-compressed sqlite (was plain sqlite .anki21)
  media                zstd-compressed protobuf (was a plain JSON {index: name})
The old script assumes JSON + plain sqlite, so it dies with
"UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb5" on the media file.

Everything downstream is unchanged: writes audio/<voice>/<ID>.mp3, so
apply_audio_copies.py still works exactly as before.

USAGE:  python extract_audio_v3.py <export>.apkg <female|male>
"""
import os, re, sys, io, json, sqlite3, zipfile, tempfile, shutil

ID_FIELD_NAME = "id"
# One entry per language whose note type this script can read. Matching by NAME
# rather than by position is what stops a two-sound-field note from handing back
# the wrong voice; carrying both languages here means the Cantonese note type
# (Cantonese_Text / Cantonese_Male_Sound) resolves just as exactly.
AUDIO_FIELD_NAMES_BY_VOICE = {
    "female": ["vietnamese_female_sound", "cantonese_female_sound"],
    "male":   ["vietnamese_male_sound",   "cantonese_male_sound"],
}

def _varint(b, i):
    n = s = 0
    while True:
        x = b[i]; i += 1
        n |= (x & 0x7F) << s
        if not x & 0x80: return n, i
        s += 7

def parse_media_entries(buf):
    """Minimal reader for Anki's MediaEntries protobuf.
    MediaEntries{ repeated MediaEntry entries = 1 }, MediaEntry{ string name = 1 }.
    Entry i corresponds to the file named str(i) inside the zip."""
    names, i = [], 0
    while i < len(buf):
        tag, i = _varint(buf, i)
        field, wire = tag >> 3, tag & 7
        if field == 1 and wire == 2:
            ln, i = _varint(buf, i)
            entry, i = buf[i:i+ln], i + ln
            j, name = 0, None
            while j < len(entry):
                t2, j = _varint(entry, j)
                f2, w2 = t2 >> 3, t2 & 7
                if f2 == 1 and w2 == 2:
                    l2, j = _varint(entry, j)
                    name, j = entry[j:j+l2].decode("utf-8", "replace"), j + l2
                elif w2 == 0: _, j = _varint(entry, j)
                elif w2 == 2:
                    l2, j = _varint(entry, j); j += l2
                elif w2 == 5: j += 4
                elif w2 == 1: j += 8
                else: break
            names.append(name)
        elif wire == 0: _, i = _varint(buf, i)
        elif wire == 2:
            ln, i = _varint(buf, i); i += ln
        elif wire == 5: i += 4
        elif wire == 1: i += 8
        else: break
    return names

def resolve(field_names, voice):
    low = [(n or "").strip().lower() for n in field_names]
    idx = next((i for i, n in enumerate(low) if n == ID_FIELD_NAME), 0)
    want = AUDIO_FIELD_NAMES_BY_VOICE[voice]
    aud = next((i for i, n in enumerate(low) if n in want), None)
    if aud is None:
        for i, n in enumerate(low):
            if voice == "male" and "male" in n and "sound" in n: aud = i; break
            if voice == "female" and "sound" in n and "male" not in n: aud = i; break
    return idx, aud

def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ("female", "male"):
        sys.exit("Usage: python extract_audio_v3.py <export>.apkg <female|male> [out_folder]\n"
                 "  e.g. python extract_audio_v3.py yue_main.apkg male yue   -> audio/yue/")
    apkg, voice = sys.argv[1], sys.argv[2]
    # Optional third argument names the output folder under audio/. The Cantonese
    # decks use their own note type (Cantonese_* fields, resolved above) and
    # belong in audio/yue/, not in the Vietnamese folder.
    folder = sys.argv[3] if len(sys.argv) > 3 else voice
    import zstandard
    out = os.path.join("audio", folder); os.makedirs(out, exist_ok=True)
    dctx = zstandard.ZstdDecompressor()
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(apkg) as z: z.extractall(tmp)
        mp = os.path.join(tmp, "media")
        raw = open(mp, "rb").read()
        if raw[:4] == b"\x28\xb5\x2f\xfd":          # zstd magic -> new v3 format
            try:
                blob = dctx.decompress(raw, max_output_size=1 << 28)
            except zstandard.ZstdError:               # frame without a declared size
                with dctx.stream_reader(io.BytesIO(raw)) as r:
                    blob = r.read()
            names = parse_media_entries(blob)
        else:                                        # legacy: plain JSON {index: name}
            names = [v for _, v in sorted(json.loads(raw.decode("utf-8")).items(),
                                          key=lambda kv: int(kv[0]))]
        fn2idx = {n: str(i) for i, n in enumerate(names) if n}
        print(f"[{voice}] media entries: {len(fn2idx)}")

        db = os.path.join(tmp, "collection.anki21b")
        if os.path.exists(db):
            plain = os.path.join(tmp, "collection.sqlite")
            with open(db, "rb") as f, open(plain, "wb") as g: dctx.copy_stream(f, g)
            db = plain
        else:
            db = os.path.join(tmp, "collection.anki21")
            if not os.path.exists(db): db = os.path.join(tmp, "collection.anki2")
        cur = sqlite3.connect(db).cursor()
        # Anki's newer schema empties col.models and moves note types into their
        # own `notetypes` / `fields` tables. `fields` gives the names directly,
        # which is all we need — no protobuf decoding required.
        fields = {}
        have = {r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        if "fields" in have:
            for ntid, ordv, name in cur.execute(
                    "SELECT ntid, ord, name FROM fields ORDER BY ntid, ord"):
                fields.setdefault(str(ntid), []).append(name)
        if not fields:                                    # legacy collections
            models = json.loads(cur.execute("SELECT models FROM col").fetchone()[0])
            fields = {m: [f["name"] for f in sorted(v["flds"], key=lambda f: f["ord"])]
                      for m, v in models.items()}
        wrote = skipped = 0
        for mid, flds in cur.execute("SELECT mid, flds FROM notes"):
            fl = flds.split("\x1f")
            fn = fields.get(str(mid), [])
            i_id, i_au = resolve(fn, voice)
            cid = fl[i_id].strip() if i_id < len(fl) else ""
            if not cid or "/" in cid: skipped += 1; continue
            m = re.search(r"\[sound:([^\]]+)\]", fl[i_au] if i_au is not None and i_au < len(fl) else "")
            if not m: skipped += 1; continue
            src = fn2idx.get(m.group(1))
            if not src: skipped += 1; continue
            # v3 .apkg stores every media member as its own zstd frame. Copying
            # the member verbatim yields a file that decoders resync into and
            # play as noise, so decompress it here. Legacy .apkg members are
            # already plain bytes and are passed through unchanged.
            sp = os.path.join(tmp, src)
            dp = os.path.join(out, cid + ".mp3")
            with open(sp, "rb") as fh:
                head = fh.read(4)
            if head == b"\x28\xb5\x2f\xfd":
                with open(sp, "rb") as fh, open(dp, "wb") as gh:
                    dctx.copy_stream(fh, gh)
            else:
                shutil.copyfile(sp, dp)
            wrote += 1
    print(f"\nDone. Wrote {wrote} files to ./{out}/  ({skipped} skipped)")
    print("Next: python apply_audio_copies.py . " + voice)

if __name__ == "__main__":
    main()
