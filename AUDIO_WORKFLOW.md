# Generating LaiLingo audio with Anki + HyperTTS

Same five columns as `AllViet_MASTER.csv`, so this drops into the pipeline you
already use.

| File | Rows | Destination folder |
|---|---|---|
| `LaiLingo_vi_rerecord.csv` | 2,375 | `audio/male/` |
| `LaiLingo_yue_rerecord.csv` | 3,335 | `audio/yue/` |

```
ID,Vietnamese_Text,English_Text,Vietnamese_Female_Sound,Vietnamese_Male_Sound
lesson_vi2_l1_4,Một người thôi.,Just the one person.,,
lesson_vi2_l3_4,Bạn nói gì cơ?,"Sorry, what did you say?",,
```

The two sound columns are empty — they are the targets HyperTTS generates the
female and male voices into. Fields containing a comma are quoted; nothing else
needs escaping.

## The steps

1. **Import.** File → Import. Map the five columns in order. The ID must land in
   field 1: Anki treats the first field as a note's identity and merges notes
   that share it, and the same Vietnamese sentence appears under several ids, so
   any other order collapses notes and loses ids. All 2,375 ids are unique.
2. **Generate.** HyperTTS → Collection Audio. Source field `Vietnamese_Text`,
   target `Vietnamese_Female_Sound`; run it again for the male voice into
   `Vietnamese_Male_Sound`.
3. **Export.** File → Export → Notes in Plain Text, with the ID and sound
   columns included.
4. **Put the files where the app looks.**

```
node rename_hypertts.js <export.txt> \
  ~/Library/Application\ Support/Anki2/<Profile>/collection.media \
  audio/male
```

HyperTTS names what it generates `hypertts-<hash>.mp3`; the app looks audio up
by id, so this last step copies each file to `audio/male/<id>.mp3`. It **copies,
never moves**, so the Anki collection is untouched, and one source file can land
under several ids where sentences repeat. `--dry-run` shows what it would do,
`--force` overwrites what is already there. It prints anything it could not
place and why.

## What is in this batch

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
`slangp`, 75 `text`. 2,365 of the 2,375 sentences are distinct, so that is
roughly how many clips HyperTTS will actually make per voice.

## Two things to know before you start

**The voice will not match the recordings that already exist.** About 6,900
Vietnamese clips are already correct and were made elsewhere. Anything generated
now sits alongside them, so unless the voice is close the course will switch
voices mid-lesson. Regenerating everything in one voice avoids that at the cost
of a much larger run.

**More lessons are coming.** Vietnamese teaches 2,162 of the ChatGPT list's
5,000 words; closing that gap adds roughly 181 lessons, each bringing new audio
ids. This batch is still worth doing — the 1,105 word clips and everything under
`slang`/`text` are stable — but expect a second run for the new lessons.

## Rebuilding

```
node build_rerecord.js
```

Writes both CSVs. After a successful audio run it should report nothing left to
record; that is the check that it landed.
