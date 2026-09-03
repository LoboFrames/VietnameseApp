"""Turn yue_rows.json into the three HyperTTS import decks and the fan-out list.

Three decks, not one: the user keeps slang and swearing separate from the main
course for Cantonese exactly as for Vietnamese, so each deck is self-contained
(build_yue_audio.js dedupes WITHIN a deck, never across them).

The two Extension-B swear characters are substituted in the CSV TEXT ONLY —
Azure's Cantonese voice reads them as nothing, and the ids keep the real
character so the app still finds the file it asked for.
"""
import csv, json

# Written as literals, not \U escapes: the first version of this file had 𨳒 as
# U+28CB2 when it is U+28CD2, so nineteen rows sailed through untouched and the
# voice would have read them as a gap. The check at the bottom now fails loudly
# rather than trusting this table to be complete.
EXT_B = {'𨳒': '屌', '𨶙': '撚', '𨳊': '鳩', '𨳍': '柒'}

# Eight rare glyphs Azure's zh-HK voice returns SILENCE for when they arrive on
# their own. Measured, not guessed: of 669 single-character rows in the main
# deck, 661 came back with audio and these 8 came back empty — while every
# multi-character row containing the same character voiced fine (我都係囖。,
# 嗰嚿嘢啡色嘅, 佢讕醒, 你唔好㧬我). So the voice knows them in context and has
# no standalone entry.
#
# A homophone would be the obvious substitute and is the wrong answer: 拃 zaa6
# and 讕 laan2 have no common same-tone twin, so the card would teach the wrong
# tone — worse than silence. Instead each gets the collocation the character
# actually lives in, which for a classifier or a bound morpheme is the honest
# unit anyway: nobody says a bare 嚿. The ids are untouched, so the app still
# finds the file it asked for, and the card still SHOWS the bare character.
VOICE_CARRIER = {
    '囖': '係囖',   # hai6 lo1 — that's right, that's just how it is
    '嚹': '好嚹',   # hou2 laa3 — done now
    '咓': '係咓',   # hai6 aa5 — is that so?
    '拃': '一拃',   # jat1 zaa6 — a handful
    '嚿': '一嚿',   # jat1 gau6 — a lump of
    '鮓': '好鮓',   # hou2 zaa2 — pretty shoddy
    '讕': '讕醒',   # laan2 seng2 — acting clever
    '㧬': '㧬開',   # ung2 hoi1 — shove aside
}

d = json.load(open('yue_rows.json', encoding='utf-8'))
gloss = dict(d['gloss'])

DECKS = {'main': 'LaiLingo_yue_main_audio.csv',
         'slang': 'LaiLingo_yue_slang_audio.csv',
         'swear': 'LaiLingo_yue_swear_audio.csv'}

subbed = 0
for deck, path in DECKS.items():
    with open(path, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['ID', 'Cantonese_Text', 'English_Text',
                    'Cantonese_Female_Sound', 'Cantonese_Male_Sound'])
        for cid, text in d['rows'][deck]:
            say = text
            for a, b in EXT_B.items():
                say = say.replace(a, b)
            # carriers apply ONLY to a bare single character — the same glyph
            # inside a sentence already voices correctly and must not be padded
            say = VOICE_CARRIER.get(say, say)
            if say != text:
                subbed += 1
            w.writerow([cid, say, gloss.get(text, ''), '', ''])
    print('%-6s %5d rows -> %s' % (deck, len(d['rows'][deck]), path))

pairs = [{'from': src, 'to': dst} for dst, src in d['copies'].items()]
pairs.sort(key=lambda x: (x['from'], x['to']))
json.dump(pairs, open('yue_audio_copy_pairs.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('%d copy pairs -> yue_audio_copy_pairs.json' % len(pairs))
print('%d rows had an Extension-B character substituted for the voice' % subbed)

# nothing outside the BMP may reach the voice, whatever the table above says
left = []
for deck in DECKS:
    for cid, text in d['rows'][deck]:
        say = text
        for a, b in EXT_B.items():
            say = say.replace(a, b)
        for ch in say:
            if ord(ch) > 0xFFFF:
                left.append((cid, ch, hex(ord(ch))))
if left:
    print('\nUNSPOKEN CHARACTERS STILL IN THE TEXT COLUMN:')
    for x in left:
        print('   %-28s %s %s' % x)
    raise SystemExit(1)
print('no character outside the BMP reaches the voice')

missing = [cid for deck in DECKS for cid, t in d['rows'][deck] if not gloss.get(t)]
print('%d rows with no English gloss' % len(missing))
for m in missing[:8]:
    print('   ', m)
