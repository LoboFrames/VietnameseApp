"""
apply_audio_copies.py
----------------------
Run this AFTER extract_audio_from_anki.py has already populated an
./audio/<voice>/ folder from your HyperTTS export.

Why this exists: several audio IDs the app needs share the exact same
Vietnamese sentence under two different filenames — e.g. a lesson's dialogue
line "lesson_l23_d1" and its matching flashcard "lesson_l23_1" are the same
spoken text, just referenced by two different features (the lesson detail
screen vs. the SRS/flashcard study screen). Rather than generating (and
paying for) the same sentence twice in HyperTTS, vietnamese_audio_master.csv
only asks for ONE recording per unique sentence across the ENTIRE app (7,327
unique sentences covering all ~9,783 real ids — every lesson, topic, pack,
chat persona, SOS phrase, core/common phrase, classic word, and concept-card
example, not just lessons/topics like the old audio_copy_pairs.json did).
This script duplicates each master recording to every filename the app
expects, using audio_copy_pairs_master.json as the map of "from -> to".

TWO-VOICE SETUP (2026-08-27): since audio now lives under audio/female/ and
audio/male/ (see the Profile > Voice toggle in the app), this needs to run
ONCE PER VOICE FOLDER — the mapping itself (audio_copy_pairs_master.json) is
voice-agnostic; you're just telling this script which folder to copy within.

REDO-IN-PROGRESS NOTE: if a voice folder already has OLD audio sitting in it
from before this two-voice redo (true for audio/female/, which inherited the
~9,685 pre-existing recordings when it was split out of the old flat audio/
folder), those stale files will already exist at the exact filenames this
script is about to copy INTO — e.g. lesson_l1_v5.mp3 might already exist as
old audio, even though it's really a copy-target for the fresh master
recording. The default behavior below skips a destination that already
exists, which is the right call when you're just filling in genuine gaps,
but WRONG mid-redo — it would leave stale old-voice audio sitting under
filenames that are supposed to have been refreshed. Pass `force` as a third
argument to always overwrite instead (safe here, since every destination is
either stale-and-due-for-replacement or a fresh master file this script
never touches anyway — masters are never a "to" of any pair).

USAGE:
    python apply_audio_copies.py . female force   # mid-redo: overwrite stale old-voice files
    python apply_audio_copies.py . male            # fresh folder, no stale files — no force needed
    (run it from the same folder as your ./audio directory, or pass a
    different base path as the first argument — same as before)
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ("female", "male"):
        sys.exit(
            "Usage: python apply_audio_copies.py <base_path> <female|male> [force]\n"
            "  e.g. python apply_audio_copies.py . female force"
        )
    base = sys.argv[1]
    voice = sys.argv[2]
    force = len(sys.argv) > 3 and sys.argv[3] == "force"
    audio_dir = os.path.join(base, "audio", voice)
    pairs_path = os.path.join(HERE, "audio_copy_pairs_master.json")
    if not os.path.exists(pairs_path):
        # Fall back to the older, lessons/topics-only map if the full master
        # one isn't present for some reason — better than hard-failing.
        legacy_path = os.path.join(HERE, "audio_copy_pairs.json")
        if os.path.exists(legacy_path):
            print("NOTE: audio_copy_pairs_master.json not found — falling back to the older, "
                  "smaller audio_copy_pairs.json (lessons/topics only, won't cover every id).")
            pairs_path = legacy_path

    if not os.path.isdir(audio_dir):
        sys.exit(f"Can't find an 'audio/{voice}' folder at {audio_dir} — run extract_audio_from_anki.py first, "
                  f"or pass the folder containing 'audio/{voice}' as the first argument.")
    if not os.path.exists(pairs_path):
        sys.exit(f"Can't find audio_copy_pairs_master.json (or the older audio_copy_pairs.json) next to this script.")

    with open(pairs_path, encoding="utf-8") as f:
        pairs = json.load(f)

    copied, missing_source, already_there = 0, 0, 0
    missing_list = []

    for pair in pairs:
        src = os.path.join(audio_dir, pair["from"] + ".mp3")
        dst = os.path.join(audio_dir, pair["to"] + ".mp3")

        if not force and os.path.exists(dst) and os.path.getsize(dst) > 0:
            already_there += 1
            continue
        if not os.path.exists(src) or os.path.getsize(src) == 0:
            missing_source += 1
            missing_list.append(pair["from"])
            continue

        shutil.copyfile(src, dst)
        copied += 1

    print(f"[{voice}]{' (force)' if force else ''} Copied {copied} files.")
    print(f"[{voice}] Already present (skipped): {already_there}")
    print(f"[{voice}] Missing source (couldn't copy): {missing_source}")
    if missing_list:
        print("\nThese source files were never found — check your HyperTTS export covered them:")
        for m in sorted(set(missing_list))[:30]:
            print(" -", m)
        if len(set(missing_list)) > 30:
            print(f"   ...and {len(set(missing_list)) - 30} more")


if __name__ == "__main__":
    main()
