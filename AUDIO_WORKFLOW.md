# Generating LaiLingo audio with Anki + HyperTTS

The app looks its audio up by **id**: `lesson_vi2_l73_d0` plays
`audio/male/lesson_vi2_l73_d0.mp3`. HyperTTS names what it generates after a
hash of the text, `hypertts-<hash>.mp3`, so there is one extra step at the end
to put the files where the app expects them. That is the only awkward part.

## 1. Import

`LaiLingo_vi_anki.txt` — 2,375 notes, tab-separated, five columns:

| Column | | |
|---|---|---|
| **ID** | the app's audio id | field 1 on purpose |
| **Vietnamese** | what gets spoken | HyperTTS source |
| **English** | the gloss | reference only |
| **Audio** | empty | HyperTTS target |
| **Why** | `missing` or `drifted` | see below |

In Anki: **File → Import**, pick the file. The header lines set the separator,
turn HTML off and name the columns, so the import screen should already be
right; you only need to confirm the note type has four or five fields and that
the columns map in order.

**Make a note type with the fields in this order first** — `ID`, `Vietnamese`,
`English`, `Audio`, `Why` — and call it `LaiLingo Audio`, which is what the file
asks for. If it does not exist Anki ignores the request and lets you pick.

The ID is field 1 deliberately. Anki treats the first field as a note's identity
and merges notes that share it; the same Vietnamese sentence appears under
several ids, so putting the text first would collapse those notes and lose ids.

## 2. Generate

HyperTTS → **Collection Audio**, source field `Vietnamese`, target field
`Audio`, pick your voice, Apply To Notes.

2,375 notes contain 2,365 distinct sentences, so that is roughly how many clips
it will actually make — identical text gets one file that several notes share.

## 3. Export

**File → Export → Notes in Plain Text**, with the ID and Audio columns included.
The Audio column will now hold `[sound:hypertts-….mp3]`.

## 4. Put the files where the app looks

```
node rename_hypertts.js <export.txt> \
  ~/Library/Application\ Support/Anki2/<Profile>/collection.media \
  audio/male
```

It copies each generated file to `audio/male/<id>.mp3`. Files are **copied, not
moved**, so the Anki collection is untouched, and one source file can land under
several ids where sentences repeat. Add `--dry-run` to see what it would do,
`--force` to overwrite files already there.

It prints anything it could not place, and why.

## What is in this batch, and what is not

2,375 rows: **1,709 missing** (no mp3 on disk) and **666 drifted**.

*Drifted* is the one worth understanding. Lesson audio ids are **positional** —
`lesson_vi2_l73_3` is whatever card happens to sit fourth in lesson 73 — so
re-cutting a lesson silently repoints its existing recordings at new sentences.
Nothing looks broken; the wrong sentence just plays. Before this batch,
Vietnamese lesson 1's first line read *"Chào anh. Anh là Nam phải không?"* on
screen and played *"Xin chào, tôi là Lan."*

**Vietnamese lesson vocab is deliberately excluded.** All 2,178 of those ids are
already correct, because vocab order comes from `vi_lesson_plan.json` and never
moved. Re-recording them would be wasted work.

By id prefix: 1,105 `word`, 756 `lesson`, 186 `slang`, 150 `textp`, 103
`slangp`, 75 `text`.

## Two things to know before you start

**The voice will not match the existing recordings.** Roughly 6,900 Vietnamese
clips are already correct and were made elsewhere. Anything HyperTTS generates
sits alongside them, so unless you pick a close match the course will switch
voices mid-lesson. Regenerating everything in one voice avoids that, at the cost
of a much larger run — `build_rerecord.js` will produce that list if you want
it.

**More lessons are coming.** Vietnamese teaches 2,162 of the ChatGPT list's
5,000 words; closing that gap adds roughly 181 lessons, each bringing new audio
ids. This batch is still worth doing — the 1,105 word clips and everything under
`slang`/`text` are stable — but expect a second, smaller run for the new
lessons.

## Rebuilding these files

```
node build_rerecord.js                      # → LaiLingo_vi_rerecord.csv, LaiLingo_yue_rerecord.csv
node build_anki.js LaiLingo_vi_rerecord.csv LaiLingo_vi_anki.txt "LaiLingo Vietnamese Audio"
```

After a successful run, `build_rerecord.js` should report nothing left to
record. That is the check that it landed.

Cantonese has its own list, `LaiLingo_yue_rerecord.csv`, 3,335 rows, all
missing. Same workflow, `audio/yue` as the destination.
