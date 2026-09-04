"""The same four checks as check_batch.py, but for World content — packs, SOS
   phrases, chat personas — which check_batch.py cannot see because it only
   parses blocks that start `{ id:'yue_l`.
   Run: python3 check_world.py yue_worlds_transit.js"""
import json, re, sys, unicodedata
from check_gam import check as gam_check

charmap = json.load(open('charmap.json', encoding='utf-8'))
# rime-cantonese citation readings, consulted per CHARACTER to decide which side
# of a lazy-tone pair is the careful one. It cannot be assumed: 啱 is ngaam1 and
# aam1 is the lazy form, but 晏 is aan3 and ngaan3 is the OVER-correction that
# yue_c3 warns about (愛 oi3 → ngoi3). Guessing from the ng- alone gets one of
# those two backwards.
rime = json.load(open('rime_words.json', encoding='utf-8'))
src = open(sys.argv[1], encoding='utf-8').read()

# 撩: two words share the character. The corpus only recorded the poke/pick one
# (liu1/liu2, 撩鼻); the wind-someone-up one is liu4, which rime lists as
# 撩佢 liu4keoi5 and 撩交嗌 liu4gaau1aai3. The corpus is silent, not wrong.
# 處: 處理 is cyu2lei5 (rime lists it first, cyu5lei5 second) and the facility
# deck settled on it for 處理房; the corpus only ever recorded 處 as cyu3, cyu5
# and syu2, never this word.
# 盒: the classifier takes the changed tone — rime lists hap2 and gives 飯盒 as
# faan6hap2; the corpus only recorded the citation hap6.
# 麻: 麻麻哋 "so-so" takes the changed tone on the SECOND syllable — rime lists
# 麻麻地 as maa4maa2dei2. The corpus only ever recorded the citation maa4.
HOUSE = {'呀': {'aa3'}, '傅': {'fu2'}, '㗎': {'gaa3'}, '撩': {'liu4'}, '處': {'cyu2'}, '盒': {'hap2'},
         '麻': {'maa2'}}
for ch, extra in HOUSE.items():
    charmap.setdefault(ch, {}).update({r: 0 for r in extra})

PUNCT = '，,。.？?！!、；;：:…—-“”‘’()（） '
HAN = lambda c: '㐀' <= c <= '鿿' or '豈' <= c <= '﫿' or ord(c) > 0x20000
SYL = re.compile(r'[a-z]+[1-6]')

# every v/p pair anywhere in the file, tagged with the nearest id: or name: above it
pairs, unpaired = [], []
label = '?'
for m in re.finditer(r"id:'([a-z0-9_]+)'|\{ *v:'([^']*)', *p:'([^']*)'|\{ *v:'([^']*)', *e:'", src):
    if m.group(1):
        label = m.group(1)
    elif m.group(2) is not None:
        pairs.append((label, m.group(2), m.group(3)))
    else:
        unpaired.append((label, m.group(4)))

def careful_form(wrote, readings):
    """HKCanCor transcribes what was said, and what Hong Kong says is lazy tone
       (懶音) — the very thing concept lesson yue_c3 teaches. The course writes
       the careful form throughout (nei5 241 times against lei5 25), so a
       mismatch that is exactly one of the lazy shifts, with the app on the
       careful side, is the corpus being colloquial, not an error.
       The reverse — the app writing the lazy form — IS an error, because it
       means the romanisation has drifted again the way 啱 aam1 and 粒 lap1 did."""
    for r in readings:
        if wrote.startswith('n') and r.startswith('l') and wrote[1:] == r[1:]:
            return 'n- → l-'
        if wrote.startswith('ng') and wrote[2:] == r:
            return 'ng- dropped'
        if wrote.startswith('gw') and r.startswith('g') and wrote[2:] == r[1:]:
            return 'gw- → g-'
        if wrote.startswith('kw') and r.startswith('k') and wrote[2:] == r[1:]:
            return 'kw- → k-'
    return None

def pairs_with(wrote, readings):
    """The readings this character also has that are the careful counterpart of
       what was written."""
    out = []
    for r in readings:
        if (r == 'ng' + wrote
            or (r.startswith('n') and wrote.startswith('l') and r[1:] == wrote[1:])
            or (r.startswith('gw') and wrote.startswith('g') and r[2:] == wrote[1:])
            or (r.startswith('kw') and wrote.startswith('k') and r[2:] == wrote[1:])):
            out.append(r)
    return out

def careful_form_of(ch, wrote, readings):
    """Returns (careful_reading, verdict). verdict is 'drift' when rime backs the
       careful form and the app wrote the lazy one, 'ok' when rime backs what was
       written, and 'unknown' when rime has no entry to arbitrate."""
    cands = pairs_with(wrote, readings)
    if not cands:
        return None, 'ok'
    listed = rime.get(ch) or []
    if wrote in listed:
        return None, 'ok'                 # rime says the app is right (晏 aan3)
    for c in cands:
        if c in listed:
            return c, 'drift'             # rime says the careful one (啱 ngaam1)
    return cands[0], 'unknown' 

bad, unattested, shape, lazy, drift, unsure = [], {}, [], [], [], []
for cid, v, p in pairs:
    chars = [c for c in v if c not in PUNCT]
    syl = re.sub(r'[%s]' % re.escape(PUNCT), ' ', p).split()
    if len(syl) != len(chars):
        alt = SYL.findall(p)
        if len(alt) == len(chars) and ''.join(alt) == re.sub(r'\s+', '', p):
            syl = alt
        else:
            shape.append((cid, v, p, len(chars), len(syl)))
            continue
    for ch, s in zip(chars, syl):
        if not HAN(ch):
            continue
        readings = charmap.get(ch)
        if readings is None:
            unattested.setdefault(ch, []).append(cid)
        elif s in readings:
            # The corpus attests it — but HKCanCor transcribes lazy tone, so
            # being attested is not the same as being the careful form. This is
            # how 啱 aam1 and 粒 lap1 got in unannounced, and how m4 aam1 slipped
            # past again: the reading IS in the corpus.
            careful, verdict = careful_form_of(ch, s, readings)
            if verdict == 'drift':
                drift.append((cid, v, ch, s, careful))
            elif verdict == 'unknown':
                unsure.append((cid, v, ch, s, careful))
        elif s not in readings:
            why = careful_form(s, readings)
            if why:
                lazy.append((cid, v, ch, s, '/'.join(sorted(readings)), why))
            else:
                bad.append((cid, v, ch, s, '/'.join(sorted(readings))))

letters = []
for cid, v, p in pairs:
    for c in v:
        if c.isalpha() and not HAN(c):
            letters.append((cid, v, c, unicodedata.name(c, '?')))
            break

print('%d text/jyutping pairs  (+%d persona lines, which carry no jyutping)'
      % (len(pairs), len(unpaired)))
print('\n-- shape mismatches (char count != syllable count) --')
for s in shape:
    print('   %-10s %s | %s  (%d chars, %d syl)' % s)
print('   none' if not shape else '')
print('-- reading mismatches --')
for cid, v, ch, s, r in bad:
    print('   %-10s %-30s %s  wrote %-8s corpus has %s' % (cid, v, ch, s, r))
print('   none' if not bad else '')
print('-- LAZY FORM WRITTEN where the careful one exists (fix these) --')
for cid, v, ch, s2, careful in drift:
    print('   %-10s %-30s %s  wrote %-8s should be %s' % (cid, v, ch, s2, careful))
print('   none' if not drift else '')
print('-- lazy/careful pair that rime cannot arbitrate (eyeball these) --')
for cid, v, ch, s2, careful in unsure:
    print('   %-10s %-30s %s  wrote %-8s or %s?' % (cid, v, ch, s2, careful))
print('   none' if not unsure else '')
print('-- careful form kept where the corpus records lazy tone (fine) --')
for cid, v, ch, s2, r, why in lazy:
    print('   %-10s %-30s %s  %-8s corpus %-10s %s' % (cid, v, ch, s2, r, why))
print('   none' if not lazy else '')
print('-- gam rule --')
g = gam_check(pairs + [(c, v, '') for c, v in unpaired])
for x in g:
    print('   %-10s %-30s %s' % x)
print('   none' if not g else '')
# Persona lines carry no jyutping, so the deterministic 噉/咁 rule cannot run on
# them — 136 lines a world going unchecked. List every occurrence with its line
# so they get read, the same treatment unattested characters get.
print('-- 噉/咁 in persona lines (no jyutping to check against — read these) --')
gam_eyeball = [(c, v) for c, v in unpaired if '噉' in v or '咁' in v]
for c, v in gam_eyeball:
    print('   %-10s %s' % (c, v))
print('   none' if not gam_eyeball else '')
print('-- non-Chinese letters in a Chinese field --')
for x in letters:
    print('   %-10s %-30s %r %s' % x)
print('   none' if not letters else '')
print('-- characters the corpus cannot vouch for (eyeball these) --')
for ch, ids in sorted(unattested.items()):
    print('   %s  %s' % (ch, ' '.join(sorted(set(ids)))))
print('   none' if not unattested else '')
sys.exit(1 if (bad or shape or g or letters or drift) else 0)
