/* test_coverage.js — the coverage milestones.

   The risk here is not a crash, it is a NUMBER THAT LIES. A milestone card is
   read as a fact about the language, so the tests below are mostly about
   whether the figures are the ones they claim to be: monotonic, anchored to the
   measured corpus where the card says "measured", and never quietly presenting
   an estimate as a measurement. */
const fs = require('fs');
require('./dom_stub.js');
const vm = require('vm');
vm.runInThisContext(fs.readFileSync('app.js', 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if(cond){ pass++; console.log('  ok  ' + msg); } else { fail++; console.log('FAIL  ' + msg); } };
const section = t => console.log('\n== ' + t);
const LANGS = ['vi2','zh','yue','ja','ko','th','tl','en','es'];

section('the curves themselves');
for(const lang of LANGS){
  selectLanguage(lang); setCoverageUnit('words');
  const t = coverageTiers();
  ok(t.length > 0, `${lang}: has a curve`);
  ok(t.every((x, i) => i === 0 || x.pct > t[i-1].pct), `${lang}: percentages strictly increase`);
  ok(t.every((x, i) => i === 0 || x.words > t[i-1].words), `${lang}: word counts strictly increase`);
  ok(t.every(x => x.pct > 0 && x.pct < 100), `${lang}: no tier claims 0% or 100%`);
  // the curve must FLATTEN — that is the whole point of showing it. Words per
  // percentage point has to grow as you climb, or it is not a Zipf curve and
  // the card is telling the learner something false about the language.
  const cost = t.map((x, i) => i === 0 ? x.words / x.pct : (x.words - t[i-1].words) / (x.pct - t[i-1].pct));
  ok(cost.every((c, i) => i === 0 || c >= cost[i-1]), `${lang}: each point of coverage costs more than the last`);
}

section('the word curve is Migaku’s, in Migaku’s unit');
selectLanguage('yue'); setCoverageUnit('words');
{
  /* This curve was rebuilt after two checks on the earlier HKCanCor-anchored
     version. Subsampling showed 43-words-for-50% is stable (48/44/44/43/44/44
     from 8k to 100k tokens) so it is not an artifact — but Heaps' law gives
     V = K·N^0.531 for that corpus, projecting ~237,000 distinct words at
     Migaku's 110M-token scale against the 6,324 actually present. Held-out
     scoring removes overfitting to particular words; it cannot conjure a long
     tail the corpus never had. And the unit differed: Nation counts word
     families, Davies counts lemmas, this app counts surface words. */
  const want = { 50:220, 60:370, 70:600, 80:1000, 85:1800, 90:3500, 95:9000 };
  const got = {};
  coverageTiers().forEach(t => { got[t.pct] = t.words; });
  ok(JSON.stringify(got) === JSON.stringify(want), 'the word tiers are the Migaku-anchored ones');
  ok(Math.round(coverageForWords(1000)) === 80,
     '1,000 words is 80% — the figure Migaku state and the one this rests on');
  const at2000 = coverageForWords(2000);
  ok(at2000 >= 85 && at2000 <= 87,
     `and 2,000 lands at ${at2000.toFixed(0)}%, matching their "next 1,000 adds 5-7%"`);
  ok(got[95] / got[80] > 8, 'the tail stays steep — 95% costs nine times what 80% did');
}

section('every course uses the same word curve, in the same unit');
{
  /* The per-language curves that used to sit here were in three units and three
     registers, so identical effort read as 80% in one course and 50% in another
     for reasons about corpora rather than languages. */
  selectLanguage('yue'); setCoverageUnit('words');
  const ref = JSON.stringify(coverageTiers());
  for(const lang of LANGS){
    selectLanguage(lang); setCoverageUnit('words');
    ok(JSON.stringify(coverageTiers()) === ref, `${lang}: same word curve as every other course`);
  }
  // but each still names its own source
  selectLanguage('ja');
  ok(/Netflix/i.test(coverageNote()), 'Japanese still names its own measured corpus');
  selectLanguage('yue');
  ok(/HKCanCor/.test(coverageNote()) && /237,000/.test(coverageNote()),
     'Cantonese keeps its own measurement and the reason it is not the curve');
  selectLanguage('es');
  ok(/LEMMAS/.test(coverageNote()), 'Spanish explains that its figure is in a coarser unit');
  selectLanguage('en');
  ok(/WORD FAMILIES/.test(coverageNote()), 'English explains the same for word families');
  selectLanguage('yue'); setCoverageUnit('words');
}

section('characters stay measured — that inventory really is closed');
{
  selectLanguage('yue'); setCoverageUnit('chars');
  ok(coverageIsMeasured(), 'the Cantonese character curve is still a measurement');
  /* Characters survive the same Heaps check the words failed: b=0.282 against
     0.531, and the projection is bounded by reality — about 3,500 characters in
     the standard list and ~7,000 in everyday use, where the word vocabulary is
     effectively unbounded. */
  const t = coverageTiers();
  ok(t[0].words < 60 && t[t.length-1].words < 1000,
     'and it climbs far faster than the word curve, as a closed inventory should');
  selectLanguage('yue'); setCoverageUnit('words');
}

section('interpolation');
selectLanguage('yue');
{
  ok(coverageForWords(0) === 0, 'nothing known is 0%');
  ok(coverageForWords(-5) === 0, 'a negative count does not go negative');
  ok(coverageForWords(220) === 50, 'landing exactly on a tier gives that tier');
  ok(coverageForWords(9000) === 95, 'and the top tier too');
  ok(coverageForWords(999999) === 95, 'past the end it clamps rather than exceeding the list');
  let mono = true;
  for(let n = 1; n < 3000; n += 7) if(coverageForWords(n) < coverageForWords(n - 1)) mono = false;
  ok(mono, 'coverage never goes down as you learn more words');
  ok(coverageForWords(500) > 60 && coverageForWords(500) < 70, '500 words interpolates into the 60s');
  const nx = nextCoverageTier(220);
  ok(nx && nx.pct === 60, 'the next tier after landing on one is the one above it');
  ok(nextCoverageTier(999999) === null, 'past the top there is no next tier');
}

section('what counts as a word you know');
selectLanguage('yue');
{
  state.srs = {};
  const pool = wordStudyPool();
  ok(knownWordCount() === 0, 'a fresh course knows nothing');
  // a card seen once is NOT coverage
  state.srs[pool[0].srsId] = { interval:1, ease:2.5, reps:1, lapses:0, due:new Date().toISOString() };
  ok(knownWordCount() === 0, 'a card seen yesterday does not count');
  state.srs[pool[0].srsId].interval = 20;
  ok(knownWordCount() === 0, 'nor does one at 20 days');
  state.srs[pool[0].srsId].interval = 21;
  ok(knownWordCount() === 1, 'it counts at 21 days — the same Known the Cards tab uses');
  // phrases must not inflate the word count
  state.srs['lesson_yue_l1_0'] = { interval:100, ease:2.5, reps:9, lapses:0, due:new Date().toISOString() };
  ok(knownWordCount() === 1, 'a known phrase does not count as a known word');
  state.srs = {};
}

section('the milestone fires once, and per course');
selectLanguage('yue');
{
  state.srs = {}; state.milestones = {};
  const pool = wordStudyPool();
  const know = n => pool.slice(0, n).forEach(w => {
    state.srs[w.srsId] = { interval:30, ease:2.5, reps:5, lapses:0, due:new Date().toISOString() };
  });
  const back = document.getElementById('milestoneBackdrop');

  know(219);
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), '219 words does not fire the 50% milestone');
  ok(seenMilestones().length === 0, 'and banks nothing');

  know(220);
  checkCoverageMilestone();
  ok(back.classList.contains('open'), '220 words fires it');
  ok(seenMilestones().join(',') === '50', 'and banks exactly that tier');
  const html = document.getElementById('milestoneBody').innerHTML;
  ok(/50%/.test(html), 'the popup names the percentage');
  ok(/Cantonese/.test(html), 'and the language');
  ok(/370/.test(html), 'and how many words the next rung needs');
  ok(!/undefined|NaN/.test(html), 'with nothing undefined in it');

  back.classList.remove('open');
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), 'it does not fire again for the same tier');

  // jumping several tiers at once banks all of them and announces the highest,
  // so the lower ones cannot ambush you on later cards
  know(1000);
  checkCoverageMilestone();
  ok(seenMilestones().join(',') === '50,60,70,80', 'crossing several tiers banks every one');
  ok(/80%/.test(document.getElementById('milestoneBody').innerHTML), 'and announces the highest reached');
  back.classList.remove('open');
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), 'and none of the skipped ones fire later');

  // per course
  selectLanguage('vi2');
  ok(seenMilestones().length === 0, 'a different course starts with no milestones banked');
  selectLanguage('yue');
  ok(seenMilestones().length === 4, 'and coming back does not lose the ones you had');
  state.srs = {}; state.milestones = {};
}

section('the home card renders in every course');
for(const lang of LANGS){
  selectLanguage(lang);
  state.srs = {};
  let threw = null;
  try{
    coverageLadderOpen = false;
    renderCoverageCard();
    const closed = document.getElementById('covBody').innerHTML;
    coverageLadderOpen = true;
    renderCoverageCard();
    const open = document.getElementById('covBody').innerHTML;
    if(!closed || !open) threw = 'empty';
    if(/undefined|NaN/.test(closed + open)) threw = 'undefined leaked in';
    if(open.length <= closed.length) threw = 'the ladder did not expand';
    if(closed.indexOf('cov-ladder') !== -1) threw = 'the ladder shows while collapsed';
  }catch(e){ threw = e.message; }
  ok(!threw, `${lang}: the home card renders open and closed (${threw || 'clean'})`);
  coverageLadderOpen = false;
}

section('the card tells the truth about which kind of number it is');
selectLanguage('yue');
{
  coverageLadderOpen = true;
  renderCoverageCard();
  const h = document.getElementById('covBody').innerHTML;
  ok(/HKCanCor/.test(h), 'Cantonese shows the corpus on the card, not just in the source');
  selectLanguage('ja');
  renderCoverageCard();
  const j = document.getElementById('covBody').innerHTML;
  // the ladder is only rendered when the card is expanded; check the note itself
  ok(/Netflix/i.test(coverageNote()),
     'Japanese names the subtitle corpus it deliberately does NOT use, for contrast');
  ok(!/HKCanCor/.test(j), 'and does not borrow the Cantonese corpus to look authoritative');
  ok(/21 days/.test(j), 'and both say what counts as a known word');
  ok(/not understanding a sentence/i.test(j), 'and both carry the recognition-is-not-comprehension warning');
  coverageLadderOpen = false;
}

section('the card never claims comprehension');
for(const lang of LANGS){
  selectLanguage(lang);
  coverageLadderOpen = true; renderCoverageCard();
  const h = document.getElementById('covBody').innerHTML;
  /* The HEADLINE is what gets read as a claim about you — that is where "50% of
     everyday speech" did its damage. The source note may still describe the
     rule of thumb in those words, because there it is a statement about the
     research and not about the learner. So this checks the lead line only. */
  const lead = (h.match(/class="cov-lead">([^<]*)/) || [])[1] || '';
  ok(!/of everyday speech/i.test(lead), `${lang}: the headline never says "of everyday speech" (got "${lead.trim()}")`);
  ok(/you.{0,3}ll meet|you.{0,3}ll hear|recognise/i.test(lead), `${lang}: it says these are items you will RECOGNISE`);
  ok(/not understanding a sentence/i.test(h), `${lang}: and the card spells out that this is not comprehension`);
  coverageLadderOpen = false;
}

section('sources — what was verified and what was thrown out');
{
  /* Checked page by page on 2026-09-04. Lenguia serves the IDENTICAL sentence
     on its Vietnamese, Mandarin and Korean pages — "the top 1,000 cover roughly
     85% of everyday speech" — with no corpus, size or method, so it is template
     text, not three measurements. The ICATSD 2022 proceedings do not contain
     the Vietnamese coverage study attributed to them at all. GoCantonese states
     the generic "80% in any language" line rather than a Cantonese figure.
     None of the three may appear as a source in the app. */
  const notes = [];
  for(const lang of LANGS){
    selectLanguage(lang);
    setCoverageUnit('words'); notes.push(coverageNote());
    if(courseHasCharacters()){ setCoverageUnit('chars'); notes.push(coverageNote()); setCoverageUnit('words'); }
  }
  const all = notes.join(' | ');
  ok(!/Lenguia/i.test(all), 'Lenguia is not cited — its per-language pages carry one shared template sentence');
  ok(!/ICATSD|iuh\.edu/i.test(all), 'the ICATSD proceedings are not cited — they do not contain the study');
  ok(!/GoCantonese/i.test(all), 'GoCantonese is not cited — it states a generic figure, not a measurement');
  selectLanguage('ja');
  ok(/Netflix/i.test(coverageNote()) && /110 million/.test(coverageNote()),
     'Japanese names the corpus its published figures were measured on');
  selectLanguage('yue');
  ok(/119,783/.test(coverageNote()), 'Cantonese states the corpus it was measured on');
  ok(/237,000/.test(coverageNote()),
     'and the Heaps projection that explains why that measurement is not the curve');
}

section('the tail stops where the evidence does');
for(const lang of LANGS){
  selectLanguage(lang); setCoverageUnit('words');
  const top = coverageTiers()[coverageTiers().length - 1];
  /* Migaku's own data needs 37,247 words for 99%. A curve claiming 98%+ off a
     few thousand words is out by a factor that grows the further up you read,
     which is exactly the error in the table this replaced. Only a course with
     real published data at that height may claim it. */
  /* 98% and up may only be claimed by a course whose figure is CITED to a real
     study. The error being fenced is the invented smooth curve that ran to
     98.5% at 10,000 words off nothing; an estimate must stop at 95%. English
     reaches 98% at 6,500 word families because Nation measured it there, and
     the note says so — including that word families are a coarser unit. */
  if(top.pct >= 98){
    ok(coverageKind() === 'cited',
       `${lang}: only claims ${top.pct}% because a published study measured it there (${top.words.toLocaleString()})`);
  } else {
    ok(top.pct <= 95, `${lang}: stops at ${top.pct}%, which is where its evidence stops`);
  }
  if(coverageKind() === 'estimated'){
    ok(top.pct <= 95, `${lang}: an estimated curve never claims past 95%`);
  }
}

section('characters are tracked separately where they matter');
{
  selectLanguage('yue');
  ok(courseHasCharacters(), 'Cantonese offers a character ladder');
  selectLanguage('zh');
  ok(courseHasCharacters(), 'so does Mandarin');
  selectLanguage('vi2');
  ok(!courseHasCharacters(), 'Vietnamese does not — it has no characters to count');
  selectLanguage('yue');

  state.srs = {};
  const pool = wordStudyPool();
  pool.slice(0, 600).forEach(w => { state.srs[w.srsId] = { interval:30, ease:2.5, reps:5, lapses:0, due:new Date().toISOString() }; });
  setCoverageUnit('words');
  const wKnown = knownCountForUnit(), wPct = coverageForWords(wKnown);
  setCoverageUnit('chars');
  const cKnown = knownCountForUnit(), cPct = coverageForWords(cKnown);
  ok(cKnown > 0 && cKnown < wKnown * 3, `600 known words yields ${cKnown} known characters`);
  ok(cPct > wPct, `character coverage runs ahead of word coverage (${cPct.toFixed(0)}% vs ${wPct.toFixed(0)}%)`);
  ok(coverageIsMeasured(), 'and the Cantonese character curve is measured, not guessed');
  ok(/2,421|157,896/.test(coverageNote()), 'and says what it was measured on');

  // switching unit must not leak into a course that has no characters
  selectLanguage('vi2');
  renderCoverageCard();
  ok(coverageUnit === 'words', 'the character unit resets on a course without characters');
  selectLanguage('yue'); setCoverageUnit('words'); state.srs = {};
}

section('every cited course names a verifiable corpus');
{
  const want = {
    yue:[/HKCanCor/, /119,783/],
    ja: [/Migaku/, /Netflix/],
    es: [/Davies/, /Corpus del/, /100 million/],
    en: [/Nation/, /WORD FAMILIES/],
    th: [/2\.2 million/, /WRITTEN/],
    es: [/Davies/, /LEMMAS/],
  };
  Object.entries(want).forEach(([lang, pats]) => {
    selectLanguage(lang); setCoverageUnit('words');
    const n = coverageNote();
    pats.forEach(p => ok(p.test(n), `${lang}: the note contains ${p}`));
  });
  // register matters and must be stated where it cuts against the course
  selectLanguage('th');
  ok(/WRITTEN/.test(coverageNote()) && /78%/.test(coverageNote()),
     'Thai names its written study and what it found, without using it as the curve');
  selectLanguage('es');
  ok(/76-80% of written|76–80% of written/.test(coverageNote()),
     'Spanish shows the written figure beside the spoken one, so the gap between registers is visible');
  selectLanguage('yue'); setCoverageUnit('words');
}

section('no course shows another course’s language or sources');
{
  /* Reported from the app: on Vietnamese, the expanded card printed Cantonese
     characters (係, 我, 唔, 呢 were hardcoded into the warning) and named
     Migaku's JAPANESE Netflix corpus in the source note — because the fallback
     curve for every unmeasured course WAS the Japanese curve. Vietnamese
     learners were being shown Japanese subtitle milestones as Vietnamese ones. */
  const CJK = /[㐀-鿿]/;
  const strip = h => h.replace(/<[^>]+>/g, ' ');
  const CJK_COURSES = ['yue','zh','ja'];
  for(const lang of LANGS){
    selectLanguage(lang); setCoverageUnit('words');
    coverageLadderOpen = true; renderCoverageCard();
    const card = strip(document.getElementById('covBody').innerHTML);
    if(CJK_COURSES.indexOf(lang) === -1){
      ok(!CJK.test(card), `${lang}: no Chinese characters anywhere on the card`);
    }
    /* Migaku is now the shared source for the word curve, so every course names
       them — that is the point. What no course may do is claim ANOTHER
       language's corpus as its own measurement. */
    if(lang !== 'ja') ok(!/Netflix/.test(card), `${lang}: does not claim the Japanese subtitle corpus`);
    if(lang !== 'yue') ok(!/HKCanCor/.test(card), `${lang}: does not name the Cantonese corpus`);
    if(lang !== 'es')  ok(!/Davies/.test(card), `${lang}: does not name the Spanish corpus`);
    if(lang !== 'th')  ok(!/WRITTEN Thai/.test(card), `${lang}: does not name the Thai corpus`);
    coverageLadderOpen = false;
  }
}

section('the example words come from this course, or not at all');
for(const lang of LANGS){
  selectLanguage(lang);
  const eg = coverageExampleWords();
  const pool = wordStudyPool();
  if(pool.length < 500){
    ok(eg === '', `${lang}: a stub course shows no examples — its list is a phrasebook, not a frequency spine`);
  } else {
    ok(eg.length > 0, `${lang}: shows examples (${eg})`);
    const words = eg.split(', ');
    ok(words.every(w => pool.slice(0, 10).some(p => p.word === w)),
       `${lang}: and every one comes from the top of ITS OWN list`);
  }
}

section('every figure is coverage of SPEECH, not writing');
{
  /* The standing rule for the whole app is real spoken register, and the
     coverage card was breaking it in two places: Japanese ran on Migaku's
     Netflix SUBTITLES (scripted drama, far wider than conversation) and Thai on
     a corpus of newspapers and web forums whose own authors said spoken data
     was unavailable. Both now fall through to the spoken curve and keep their
     published figures only as contrast. */
  for(const lang of LANGS){
    selectLanguage(lang); setCoverageUnit('words');
    const n = coverageNote();
    // A note may DISCUSS writing — Spanish contrasts 88% spoken against 76-80%
    // written, which is the most useful sentence on the card. What it must never
    // do is present the written number as the course's own curve.
    const usesWritten = /^[^.]*\bwritten\b/i.test(n) && !/spoken|SPOKEN/.test(n);
    ok(!usesWritten, `${lang}: never presents a written figure as its own curve`);
  }
  // the spoken anchor: the three real conversational sources agree near 86-88%
  selectLanguage('vi2'); setCoverageUnit('words');
  const at1000 = coverageForWords(1000);
  ok(Math.round(at1000) === 80,
     `the curve puts 1,000 words at ${at1000.toFixed(0)}% — Migaku's figure, in Migaku's unit`);
  selectLanguage('yue'); setCoverageUnit('words');
}

section('the in-app explainer');
for(const lang of LANGS){
  selectLanguage(lang); setCoverageUnit('words');
  let threw = null, html = '';
  try{ html = coverageDocHtml(); }catch(e){ threw = e.message; }
  ok(!threw, `${lang}: the Coverage curves tool renders (${threw || 'clean'})`);
  if(threw) continue;
  ok(!/undefined|NaN|\[object/.test(html), `${lang}: with nothing undefined in it`);
  ok(/spoken/i.test(html), `${lang}: states that the figures are about speech`);
  ok(!/of everyday speech understood|understand this percentage/i.test(html),
     `${lang}: never claims the percentage is comprehension`);
  // it must show the course's own ladder, not another's
  const tiers = coverageTiers();
  ok(html.indexOf(tiers[tiers.length-1].words.toLocaleString()) !== -1,
     `${lang}: shows its own top rung`);
}

section('the proof lines are drawn from across the deck');
selectLanguage('yue');
{
  const t = coverageTiers().find(x => x.pct === 50);
  const lines = coverageProofLines(t.words, 4);
  ok(lines.length > 0, 'Cantonese produces demonstration lines');
  ok(lines.every(l => l.total >= 5 && l.total <= 12), 'every one is a readable length');
  ok(lines.every(l => l.hits > 0), 'and every one has something showing');
  /* The first entries of every deck are phrasebook greetings, so taking the
     first N matches gave four variations on "nice to meet you". A stride walks
     the whole deck instead. This asserts the spread rather than the wording. */
  const uniq = new Set(lines.map(l => l.e));
  ok(uniq.size === lines.length, 'the lines are distinct, not four variants of one greeting');
  ok(new Set(lines.map(l => l.hits + '/' + l.total)).size > 1,
     'and they vary in how much is known, which is the point of showing several');

  // the demonstration must actually leave gaps — otherwise it proves nothing
  ok(lines.some(l => l.hits < l.total), 'at least one line has words blanked out');
  const worst = Math.min(...lines.map(l => l.hits / l.total));
  ok(worst < 0.5, `and at least one is mostly blanks (${(worst*100).toFixed(0)}% known)`);
}

section('the masked demonstration');
selectLanguage('yue');
{
  state.srs = {};
  const pool = wordStudyPool();
  pool.slice(0, 309).forEach(w => { state.srs[w.srsId] = { interval:30, ease:2.5, reps:5, lapses:0, due:new Date().toISOString() }; });
  const s1 = maskedSample();
  ok(!!s1, 'there is a sample to show');
  ok(s1.hits > 0 && s1.hits < s1.total, 'it has both known words and gaps — an all-or-nothing line demonstrates nothing');
  ok(/cv-gap/.test(s1.html) && /cv-known/.test(s1.html), 'and marks up both');
  ok(!!s1.e, 'with the English underneath, so the gap is visible as meaning lost');
  const s2 = maskedSample();
  ok(s1.html === s2.html, 'the same line comes back on the same day rather than reshuffling every repaint');
  ok(s1.total >= 5 && s1.total <= 12, `the line is a readable length (${s1.total} words)`);

  // more known words must mean fewer gaps
  const gaps = h => (h.match(/cv-gap/g) || []).length;
  const few = gaps(maskedSample().html);
  pool.slice(0, 1400).forEach(w => { state.srs[w.srsId] = { interval:30, ease:2.5, reps:5, lapses:0, due:new Date().toISOString() }; });
  const many = gaps(maskedSample().html);
  ok(many <= few, `learning more words does not add gaps (${few} → ${many})`);
  /* Reported from the app: on Cantonese with nothing learned, this box showed
     a single unbroken bar of 53 blanks — because the length filter was only
     applied to the PREFERRED candidates and the fallback took any sentence at
     all. A line nobody can read demonstrates nothing. The cap is now
     unconditional, and a card with no known words says so in words instead of
     drawing an empty line. */
  state.srs = {};
  for(const lang of LANGS){
    selectLanguage(lang);
    const s = maskedSample();
    if(!s){ ok(true, `${lang}: no phrase deck, nothing to sample`); continue; }
    ok(s.total >= 5 && s.total <= 12,
       `${lang}: the sample is capped at a readable length even with nothing known (${s.total} words)`);
    ok(s.hits === 0, `${lang}: and correctly reports nothing known`);
  }
  selectLanguage('yue');

  // The explanation replaces the line ONLY when the course has not been studied
  // at all. Reported from the app: someone four hundred cards into Cantonese
  // with nothing yet at 21 days lost the line entirely and thought it broke.
  coverageLadderOpen = false;
  renderCoverageCard();
  const blankCard = document.getElementById('covBody').innerHTML;
  ok(/have not studied any words/.test(blankCard),
     'a course with no cards at all explains the box instead of drawing a blank line');
  ok(!/cv-gap/.test(blankCard), 'and draws no blanks at all in that state');

  // now: studied hard, nothing mature yet
  const midPool = wordStudyPool();
  midPool.slice(0, 400).forEach((w, i) => {
    state.srs[w.srsId] = { interval:[1,3,6,10,15][i%5], ease:2.5, reps:3, lapses:0, due:new Date().toISOString() };
  });
  ok(knownWordCount() === 0, '400 cards under 21 days still counts as nothing Known');
  const midSample = maskedSample();
  ok(midSample.learn > 0, 'but the sample line marks them as learning');
  renderCoverageCard();
  const midCard = document.getElementById('covBody').innerHTML;
  ok(!/have not studied any words/.test(midCard),
     'and the card shows the LINE, not the never-studied explanation');
  ok(/cv-learning/.test(midCard), 'with the in-progress words visibly distinct from the blanks');
  ok(/learning/.test(midCard), 'and the count names them');
  state.srs = {};

  const pool2 = wordStudyPool();
  pool2.slice(0, 400).forEach(w => { state.srs[w.srsId] = { interval:30, ease:2.5, reps:5, lapses:0, due:new Date().toISOString() }; });
  renderCoverageCard();
  const liveCard = document.getElementById('covBody').innerHTML;
  ok(/A real line from the course/.test(liveCard), 'once there are known words the card says what the box IS');
  ok(/known/.test(liveCard) && /not met yet/.test(liveCard), 'and breaks the line down into its three states');
  ok(/cv-gap/.test(liveCard) && /cv-known/.test(liveCard), 'and shows both the gaps and the words');
  state.srs = {};
}

console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
