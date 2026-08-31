"""
apply_yue_copies.py
-------------------
The Cantonese counterpart of apply_audio_copies.py. Run it AFTER
extract_audio_v3.py has filled ./audio/yue/ from the HyperTTS exports.

Why it exists: the same Cantonese sentence is asked for under several ids. A
lesson's dialogue line is `lesson_yue_l3_d1` on the lesson screen and
`cphrase_yue_47` in the phrase deck; a vocab item `lesson_yue_l3_v0` is the same
single word as `word_yue_係` in the frequency deck. Rather than pay to record
the same audio two or three times, the CSVs ask for one recording per unique
text per deck, and this script duplicates it to every other filename the app
looks for.

Kept separate from apply_audio_copies.py on purpose: that script is wired to the
Vietnamese pairs file and its female/male folders, it works, and there is no
reason to risk it. This one only ever touches audio/yue/.

USAGE:
    python3 apply_yue_copies.py            # from the folder holding ./audio
    python3 apply_yue_copies.py . force    # overwrite existing destinations
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAIRS = os.path.join(HERE, "yue_audio_copy_pairs.json")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "."
    force = "force" in sys.argv[1:]
    audio_dir = os.path.join(base, "audio", "yue")

    if not os.path.isdir(audio_dir):
        sys.exit("Can't find %s — run extract_audio_v3.py <deck>.apkg male yue first." % audio_dir)
    if not os.path.exists(PAIRS):
        sys.exit("Can't find yue_audio_copy_pairs.json next to this script.")

    with open(PAIRS, encoding="utf-8") as f:
        pairs = json.load(f)

    copied = skipped = 0
    missing = []
    for pair in pairs:
        src = os.path.join(audio_dir, pair["from"] + ".mp3")
        dst = os.path.join(audio_dir, pair["to"] + ".mp3")
        if not os.path.exists(src) or os.path.getsize(src) == 0:
            missing.append(pair["from"])
            continue
        if not force and os.path.exists(dst) and os.path.getsize(dst) > 0:
            skipped += 1
            continue
        shutil.copyfile(src, dst)
        copied += 1

    print("[yue] Copied %d files." % copied)
    print("[yue] Already present (skipped): %d" % skipped)
    print("[yue] Missing source (couldn't copy): %d" % len(missing))
    if missing:
        # A missing source means that deck has not been generated and extracted
        # yet — not a fault in the map. Naming a few makes which deck obvious.
        print("      e.g. " + ", ".join(sorted(set(missing))[:8]))
        print("      (generate and extract the deck those ids belong to, then re-run)")


if __name__ == "__main__":
    main()
