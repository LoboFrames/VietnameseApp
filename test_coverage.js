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

section('the measured Cantonese curve is the measured one');
selectLanguage('yue'); setCoverageUnit('words');
{
  ok(coverageIsMeasured(), 'Cantonese is flagged measured');
  ok(/HKCanCor/.test(coverageNote()), 'and names the corpus it was measured on');
  ok(/119,783/.test(coverageNote()), 'and the token count, so the claim is checkable');
  /* HELD-OUT figures: ranked on 80% of the conversations and scored on the 20%
     the list had never seen, five ways round. The first version measured
     in-sample — ranked and scored on the same text — so every word in the test
     was guaranteed to be in the list, and the tail came out as fiction: it
     claimed 95% at 2,112 words when held-out data cannot reach 95% at all from
     this corpus. If someone re-measures in-sample for a nicer curve, this
     fails, which is the point. */
  const want = { 50:43, 60:71, 70:128, 75:192, 80:309, 85:582, 90:1400 };
  const got = {};
  coverageTiers().forEach(t => { got[t.pct] = t.words; });
  ok(JSON.stringify(got) === JSON.stringify(want), 'the tiers are exactly the held-out numbers');
  ok(got[50] === 43, '43 words is half the word-tokens — true, and not the same as half of speech');
  ok(!coverageTiers().some(t => t.pct > 90),
     'the ladder stops at 90% — past that a 120,000-token corpus cannot measure honestly');
  ok(got[90] / got[80] > 4, 'and the tail is still steep — 90% costs 4x what 80% did');
}

section('every other course says where its number came from');
for(const lang of LANGS.filter(l => l !== 'yue')){
  selectLanguage(lang);
  ok(!coverageIsMeasured(), `${lang}: not flagged measured`);
  // Japanese is CITED, not estimated — the Netflix figures are real published
  // counts of Japanese subtitles, so calling them an estimate would be its own
  // small lie. Everything else is estimated from that shape and says so.
  const kind = coverageKind();
  ok(kind === 'cited' || kind === 'estimated', `${lang}: labelled cited or estimated`);
  if(kind === 'cited') ok(/Migaku|Netflix|Davies|Corpus del|Nation|corpus study/.test(coverageNote()),
     `${lang}: and names the source`);
  else ok(/[Aa]pproximate|[Ee]stimated/.test(coverageNote()), `${lang}: and says approximate`);
  ok(!/measured on/i.test(coverageNote()), `${lang}: and never claims a measurement`);
}
selectLanguage('yue'); setCoverageUnit('words');
const YUE_TIERS = JSON.stringify(coverageTiers());
selectLanguage('vi2'); setCoverageUnit('words');
ok(JSON.stringify(coverageTiers()) !== YUE_TIERS,
   'an estimated course does not silently reuse the Cantonese measurements');

section('interpolation');
selectLanguage('yue');
{
  ok(coverageForWords(0) === 0, 'nothing known is 0%');
  ok(coverageForWords(-5) === 0, 'a negative count does not go negative');
  ok(coverageForWords(43) === 50, 'landing exactly on a tier gives that tier');
  ok(coverageForWords(1400) === 90, 'and the top tier too');
  ok(coverageForWords(999999) === 90, 'past the end it clamps rather than exceeding the list');
  let mono = true;
  for(let n = 1; n < 3000; n += 7) if(coverageForWords(n) < coverageForWords(n - 1)) mono = false;
  ok(mono, 'coverage never goes down as you learn more words');
  ok(coverageForWords(100) > 60 && coverageForWords(100) < 70, '100 words interpolates into the 60s');
  const nx = nextCoverageTier(43);
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

  know(42);
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), '42 words does not fire the 50% milestone');
  ok(seenMilestones().length === 0, 'and banks nothing');

  know(43);
  checkCoverageMilestone();
  ok(back.classList.contains('open'), '43 words fires it');
  ok(seenMilestones().join(',') === '50', 'and banks exactly that tier');
  const html = document.getElementById('milestoneBody').innerHTML;
  ok(/50%/.test(html), 'the popup names the percentage');
  ok(/Cantonese/.test(html), 'and the language');
  ok(/71/.test(html), 'and how many words the next rung needs');
  ok(!/undefined|NaN/.test(html), 'with nothing undefined in it');

  back.classList.remove('open');
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), 'it does not fire again for the same tier');

  // jumping several tiers at once banks all of them and announces the highest,
  // so the lower ones cannot ambush you on later cards
  know(500);
  checkCoverageMilestone();
  ok(seenMilestones().join(',') === '50,60,70,75,80', 'crossing several tiers banks every one');
  ok(/80%/.test(document.getElementById('milestoneBody').innerHTML), 'and announces the highest reached');
  back.classList.remove('open');
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), 'and none of the skipped ones fire later');

  // per course
  selectLanguage('vi2');
  ok(seenMilestones().length === 0, 'a different course starts with no milestones banked');
  selectLanguage('yue');
  ok(seenMilestones().length === 5, 'and coming back does not lose the ones you had');
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
  ok(/Netflix/.test(j), 'Japanese names the corpus its figure came from');
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
  ok(/Migaku/.test(coverageNote()) && /110 million|124,000/.test(coverageNote()),
     'Japanese cites Migaku and the corpus size that makes the claim checkable');
  selectLanguage('yue');
  ok(/119,783/.test(coverageNote()), 'Cantonese states the corpus it was measured on');
  ok(/never seen|held/.test(coverageNote()), 'and that it was scored held-out');
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
    ja: [/Migaku/, /110 million/],
    es: [/Davies/, /Corpus del/, /100 million/],
    en: [/Nation/, /WORD FAMILIES/],
    th: [/2\.2 million/, /WRITTEN/],
  };
  Object.entries(want).forEach(([lang, pats]) => {
    selectLanguage(lang); setCoverageUnit('words');
    const n = coverageNote();
    pats.forEach(p => ok(p.test(n), `${lang}: the note contains ${p}`));
  });
  // register matters and must be stated where it cuts against the course
  selectLanguage('th');
  ok(/spoken frequency data was not available|WRITTEN/.test(coverageNote()),
     'Thai says out loud that its figures are written, not speech — this course teaches speech');
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
    if(lang !== 'ja'){
      ok(!/Japanese|Netflix|Migaku/.test(card), `${lang}: does not name Japanese or Migaku`);
      ok(JSON.stringify(coverageTiers()) !== JSON.stringify(COVERAGE_NETFLIX),
         `${lang}: does not silently use the Japanese Netflix curve`);
    }
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

  // more known words must mean fewer gaps
  const gaps = h => (h.match(/cv-gap/g) || []).length;
  const few = gaps(maskedSample().html);
  pool.slice(0, 1400).forEach(w => { state.srs[w.srsId] = { interval:30, ease:2.5, reps:5, lapses:0, due:new Date().toISOString() }; });
  const many = gaps(maskedSample().html);
  ok(many <= few, `learning more words does not add gaps (${few} → ${many})`);
  state.srs = {};
  ok(maskedSample() !== null, 'and it still renders with nothing known at all');
}

console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
