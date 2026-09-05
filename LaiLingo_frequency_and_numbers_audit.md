# LaiLingo vocabulary frequency and number audit

Audit date: 2026-09-04

## Verdict

The exported ranks and frequency fields were rebuilt from the retained source files and compared row by row. After the corrections recorded below, all nine CSVs pass the structural and source-reproduction checks: rank, headword, frequency, frequency unit, POS, pronunciation/romanization, source, source quality, milestone, word unit, and source rank agree with the documented build.

This does **not** make every frequency an actual conversational-speech frequency. Five datasets are derived from recorded speech: Cantonese, Japanese, Spanish, English, and Korean. Vietnamese is a mixed text/subtitle estimate; Mandarin, Thai, and Tagalog are subtitle proxies. A frequency is always specific to its corpus, period, region, tokenization, and filtering rules. It is not a universal probability for the language.

## Source status by language

| Language | Final rows | Frequency source used | Frequency value | Actual recorded speech? | Audit conclusion |
|---|---:|---|---|---|---|
| Vietnamese | 5,000 | [vn-freqs](https://github.com/tabidots/vn-freqs): Leipzig mixed-source sentences plus OpenSubtitles2016 | Observed mixed-corpus count | No | Correctly labeled `estimated`; useful as a segmented ranking proxy, not measured conversation. |
| Mandarin | 5,000 | [FrequencyWords OpenSubtitles2018](https://github.com/hermitdave/FrequencyWords#opensubtitle-tokenized-source), with exact CC-CEDICT headword validation | Subtitle occurrence count | No | Correctly labeled `media_proxy`; it does not reproduce Taiwan Mandarin conversational frequencies. |
| Cantonese | 4,574 | [HKCanCor](https://github.com/fcbond/hkcancor#introduction-), spontaneous-conversation transcripts only | Recomputed transcript token count | Yes | `measured_spoken`; all `FC-R*` radio files are now excluded. The clean subset cannot supply 5,000 eligible entries, so it is not padded. |
| Japanese | 5,000 | [CEJC](https://www2.ninjal.ac.jp/conversation/cejc/design.html) short-unit vocabulary table | Published short-unit token count | Yes | `measured_spoken`; authentic everyday conversation. Identical lemma spellings may pool readings/POS. |
| Spanish | 5,000 | [CORLEC](https://www.lllf.uam.es/ESP/Info%20Corlec.html), selected non-broadcast conversation transcripts | Recomputed lowercase surface-form count | Yes | `measured_spoken`; inflected forms remain separate and no source POS/lemma is available. |
| English | 4,078 | [BNC spoken WFWSE](https://ucrel.lancs.ac.uk/bncfreq/files.html) | Published rounded frequency per million | Yes | `measured_spoken`; the source combines about 4.2M conversational and 6.2M context-governed spoken words and has a publication cutoff. |
| Thai | 5,000 | [OpenSubtitles2018 cleaned word counts](https://github.com/orgtre/top-open-subtitles-sentences) with Thai dictionary validation | Subtitle occurrence count | No | Correctly labeled `media_proxy`; segmentation and dictionary filtering can omit valid colloquial words. |
| Korean | 5,000 | [KoFREN](https://aclanthology.org/2024.lrec-main.866/) all-speakers frequency file | Spontaneous-speech morpheme/stem count | Yes | `measured_spoken`; the main CSV pools identical spellings across POS, so homographs are not sense-specific. |
| Tagalog | 5,000 | [FrequencyWords OpenSubtitles2018](https://github.com/hermitdave/FrequencyWords#opensubtitle-tokenized-source) | Subtitle occurrence count | No | Correctly labeled `media_proxy`; the small corpus has a weak, English/name-heavy tail. |

## Relationship to the Conversation Coverage reference

The vocabulary CSVs and the supplied Conversation Coverage table do not use one common source or one common definition of “word.” They therefore should not be presented as if the CSV rank 2,000 directly generates the table’s 2,000-word percentage.

| Language | Relationship between the CSV and the coverage reference |
|---|---|
| Vietnamese | Both are estimates; the CSV is a mixed text/subtitle proxy. |
| Mandarin | The coverage reference cites Taiwan Mandarin conversation; the CSV uses Mainland-script subtitles. These are different corpora. |
| Cantonese | Both point to HKCanCor, but the displayed coverage percentages remain estimates and have not been derived from this filtered CSV. |
| Japanese | Both point to CEJC, but learner-word normalization and the coverage denominator still need to be defined before calculating a product metric. |
| Spanish | The reference cites lemma-based published anchors; this CSV contains CORLEC surface forms. |
| English | The reference cites CANCODE coverage; this CSV uses the BNC spoken list. These are different corpora. |
| Thai | The reference is an estimated conversational curve; the CSV uses subtitles. |
| Korean | Both point toward KoFREN, but the CSV is a morpheme/stem ranking and pools POS homographs; it is not yet a learner-lemma coverage curve. |
| Tagalog | The reference is an estimated conversational curve; the CSV uses a small subtitle list. |

## Number coverage

All main CSVs exclude tokens made only of Arabic digits or native numeral glyphs. They include spelled-out number words when those forms survive the source and language-specific filters. This is appropriate for a vocabulary list, but it means frequent numeric content written as digits does not raise the rank of the spelled-out word.

The detailed inventory is in `lailingo_number_coverage.csv`. Its `surface_frequency` is the main form’s total corpus frequency. `numeral_specific_frequency` is filled only when the source supplies a usable number POS: Cantonese `m`, Japanese number nouns, English `Num`, and Korean `NR`.

| Language | Basic 0–10 meanings represented in main CSV | Main gaps and qualifications |
|---|---:|---|
| Vietnamese | 9 of 11 | “one” (`một`) and “ten” (`mười`) fall outside the top 5,000. Canonical “four” (`bốn`) is outside, while the contextual form `tư` is present. The source places `một` at 7,329 with count 186, `bốn` at 5,299 with 356, and `mười` at 5,575 with 326. These are mixed-source proxy counts. |
| Mandarin | 11 of 11 | Zero through ten are present. `百` “hundred” is outside the main CSV; it is source rank 14,161 with subtitle count 354. |
| Cantonese | 11 of 11 | Zero through ten are present in the spontaneous-conversation subset. `億` was not observed/retained. |
| Japanese | 11 of 11 | Complete, including `零` and the common loanword `ゼロ`; scale words through `億` are present. Number counts are clean number-POS counts. |
| Spanish | 11 of 11 | Complete. Singular `millón` occurs once and falls outside the main CSV; plural `millones` is present. Counts are spoken surface forms without sense tagging. |
| English | 11 of 11 | Complete, with `oh` also retained as a common spoken zero/digit form. The main frequency pools same-spelling POS rows; the supplemental file separately records `Num` where available. |
| Thai | 11 of 11 | Complete through ten; `ร้อย`, `พัน`, `หมื่น`, `แสน`, and `ล้าน` are present. Counts are subtitle proxy counts. |
| Korean | 11 of 11 in each required system | Both native Korean and Sino-Korean one-through-ten forms are present, with `영`/`공` for zero. Use `numeral_specific_frequency`, because pooled surface counts can be much larger than number use. Example: `이` has pooled count 1,745,337 but NR count 16,626; `사` has 118,831 pooled versus 8,029 NR. |
| Tagalog | 10 of 11 meanings | The English borrowing `zero` is present, while native `sero` is not listed. `pito` “seven” occurs once at source rank 9,363 and is outside the main CSV. |

Number words are common, but their observed ranks can be distorted by written digits, compounds, counters, inflection, segmentation, and homographs. The supplemental inventory keeps missing or out-of-cutoff forms visible without assigning them invented top-5,000 ranks.

## Corrections made during this audit

- Removed 16 Cantonese `FC-R*` radio files and retained spontaneous conversation only. This changed the final Cantonese list from 5,000 mixed-speech entries to 4,574 verified conversation entries.
- Excluded three malformed Cantonese source headwords with romanization accidentally attached to the written word.
- Removed a Spanish transcription speaker label that had been counted as speech and restored parenthetically omitted letters where the transcript convention supports reconstruction.
- Removed English explanatory asterisks and incomplete tilde-marked fragments; retained source multiword expressions with the correct word-unit label.
- Changed dictionary matching to exact case-sensitive headwords, eliminating a Tagalog common-word/proper-name collision.
- Made dictionary selection prefer the numeral sense for recognized number headwords. This fixes misleading definitions for Japanese, Thai, Korean, Vietnamese, Spanish, and Tagalog number forms where a source definition is available.
- Deduplicated repeated manifest limitations.

## Validation performed

- Rebuilt all rankings from the retained input files and documented selection rules.
- Compared all source-derived columns after the translation and definition edits: zero mismatches.
- Confirmed sequential ranks, unique headwords, non-increasing frequency, valid milestone assignments, expected frequency units, and source-quality labels for every CSV.
- Confirmed each retained input’s byte size and SHA-256 digest against the manifest.
- Confirmed that no main headword is made only of digits.

Licensing and redistribution terms remain recorded separately for every language and annotation source in `lailingo_vocabulary_manifest.json`.
