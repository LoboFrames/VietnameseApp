"""
process_lesson_images.py
-------------------------
Repeatable image pipeline for DailyViet's 62 lesson photos.

The app expects exactly this filename for every lesson:
    images/lesson_01.jpg, images/lesson_02.jpg, ... images/lesson_62.jpg
(lowercase, two-digit zero-padded, real JPEG, ~1200px wide)

You don't have to match that exactly when you drop files in from ChatGPT.
This script finds ANY file in the images folder that looks like it's meant
for a given lesson number -- regardless of case, exact spelling, or file
type (Lesson_24.png, lesson24.jpeg, LESSON_05.JPG, lesson_5.png all work)
-- picks the most recently added one for each lesson, and converts/resizes/
renames it to the exact filename the app needs. Anything left over (old
raw originals, duplicates) gets moved into images/_to_delete/ so the
images folder stays clean and GitHub-ready.

Already-correct, already-optimized files are left alone (not needlessly
recompressed).

USAGE:
    python3 process_lesson_images.py
(or just double-click process_lesson_images.command)
"""
import os
import re
import shutil
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit(
        "This needs the 'Pillow' image library, which isn't installed.\n"
        "Open Terminal and run:\n"
        "    pip3 install Pillow\n"
        "then run this script again."
    )

HERE = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(HERE, "images")
TRASH_DIR = os.path.join(IMAGES_DIR, "_to_delete")

TOTAL_LESSONS = 62
TARGET_WIDTH = 1200
JPEG_QUALITY = 82
ALREADY_GOOD_MAX_BYTES = 600_000
ALREADY_GOOD_MAX_WIDTH = 1300

# Matches: lesson_01.png, Lesson_24.png, lesson5.jpg, LESSON-07.jpeg, etc.
NAME_RE = re.compile(r'^lesson[_\-\s]?0*(\d{1,3})\.(png|jpe?g|webp)$', re.IGNORECASE)


def canonical_name(num):
    return f"lesson_{num:02d}.jpg"


def is_already_good(path, canonical_path):
    """True if this file IS the canonical file and is already a small, real JPEG."""
    if os.path.normcase(os.path.abspath(path)) != os.path.normcase(os.path.abspath(canonical_path)):
        return False
    try:
        size = os.path.getsize(path)
        if size == 0 or size > ALREADY_GOOD_MAX_BYTES:
            return False
        with Image.open(path) as im:
            if im.format != 'JPEG':
                return False
            if im.width > ALREADY_GOOD_MAX_WIDTH:
                return False
        return True
    except Exception:
        return False


def unique_trash_path(filename):
    dest = os.path.join(TRASH_DIR, filename)
    if not os.path.exists(dest):
        return dest
    base, ext = os.path.splitext(filename)
    i = 2
    while os.path.exists(os.path.join(TRASH_DIR, f"{base}_{i}{ext}")):
        i += 1
    return os.path.join(TRASH_DIR, f"{base}_{i}{ext}")


def process_one(num, candidates):
    canonical_path = os.path.join(IMAGES_DIR, canonical_name(num))

    if len(candidates) == 1 and is_already_good(candidates[0], canonical_path):
        return "already-good", None

    # Pick the most recently modified candidate as the source image.
    source = max(candidates, key=lambda p: os.path.getmtime(p))
    before_kb = round(os.path.getsize(source) / 1024)

    try:
        with Image.open(source) as im:
            im = im.convert("RGB")
            if im.width > TARGET_WIDTH:
                new_h = round(im.height * (TARGET_WIDTH / im.width))
                im = im.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
            # Save to a temp path first, then swap in, so a mid-write crash
            # never leaves lesson_NN.jpg half-written.
            tmp_path = canonical_path + ".tmp"
            im.save(tmp_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
        os.replace(tmp_path, canonical_path)
    except Exception as e:
        return "error", str(e)

    # Clean up every other file that matched this lesson number (including
    # the source itself, if it wasn't already the canonical path).
    os.makedirs(TRASH_DIR, exist_ok=True)
    moved = []
    for p in candidates:
        if os.path.normcase(os.path.abspath(p)) == os.path.normcase(os.path.abspath(canonical_path)):
            continue
        dest = unique_trash_path(os.path.basename(p))
        shutil.move(p, dest)
        moved.append(os.path.basename(p))

    after_kb = round(os.path.getsize(canonical_path) / 1024)
    return "converted", (os.path.basename(source), before_kb, after_kb, moved)


def main():
    if not os.path.isdir(IMAGES_DIR):
        sys.exit(f"Can't find an 'images' folder at {IMAGES_DIR}")

    by_lesson = {}
    unrecognized = []
    for fname in os.listdir(IMAGES_DIR):
        fpath = os.path.join(IMAGES_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        m = NAME_RE.match(fname)
        if not m:
            continue
        num = int(m.group(1))
        if 1 <= num <= TOTAL_LESSONS:
            by_lesson.setdefault(num, []).append(fpath)
        else:
            unrecognized.append(fname)

    print("=" * 56)
    print(" DailyViet — Lesson Image Processor")
    print("=" * 56)
    print()

    already_good, converted, missing, errors = [], [], [], []

    for num in range(1, TOTAL_LESSONS + 1):
        candidates = by_lesson.get(num)
        if not candidates:
            canonical_path = os.path.join(IMAGES_DIR, canonical_name(num))
            if os.path.exists(canonical_path):
                # Shouldn't normally happen (regex should've caught it) but
                # just in case, treat existing canonical file as fine.
                already_good.append(num)
            else:
                missing.append(num)
            continue

        status, detail = process_one(num, candidates)
        if status == "already-good":
            already_good.append(num)
        elif status == "converted":
            src, before_kb, after_kb, moved = detail
            converted.append(num)
            extra = f", moved {len(moved)} old file(s) to _to_delete/" if moved else ""
            print(f"  Lesson {num:2d}: {src}  ({before_kb}KB -> {after_kb}KB){extra}")
        elif status == "error":
            errors.append((num, detail))
            print(f"  Lesson {num:2d}: ERROR — {detail}")

    print()
    print("-" * 56)
    print(f"Already had a good image:  {len(already_good)}")
    print(f"Converted/renamed now:     {len(converted)}")
    print(f"Errors:                    {len(errors)}")
    print(f"Still missing:             {len(missing)}")
    if missing:
        print("  Lessons with no image yet: " + ", ".join(str(n) for n in missing))
    if unrecognized:
        print(f"\nFiles in images/ that didn't match a lesson number (left alone): {len(unrecognized)}")
        for f in unrecognized[:15]:
            print("  -", f)
    print("-" * 56)
    total_ready = len(already_good) + len(converted)
    print(f"\n{total_ready} / {TOTAL_LESSONS} lesson images ready to push.")
    if missing:
        print(f"{len(missing)} left to generate — just drop them in the images folder")
        print("named lesson_<number> (any case, .png or .jpg) and run this again.")
    else:
        print("All 62 lesson images are in place!")


if __name__ == "__main__":
    main()
