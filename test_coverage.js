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
  selectLanguage(lang);
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
selectLanguage('yue');
{
  ok(coverageIsMeasured(), 'Cantonese is flagged measured');
  ok(/HKCanCor/.test(coverageNote()), 'and names the corpus it was measured on');
  ok(/119,783/.test(coverageNote()), 'and the token count, so the claim is checkable');
  // These are the figures computed from HKCanCor. If someone rounds them for
  // looks, this fails — which is the point.
  const want = { 50:43, 60:70, 70:125, 75:182, 80:284, 85:487, 90:941, 92:1269, 95:2112 };
  const got = {};
  coverageTiers().forEach(t => { got[t.pct] = t.words; });
  ok(JSON.stringify(got) === JSON.stringify(want), 'the tiers are exactly the measured numbers');
  ok(got[50] === 43, '43 words is half of everything spoken');
  ok(got[95] / got[80] > 7, 'and the tail is genuinely long — 95% costs 7x what 80% did');
}

section('every other course is honest about being an estimate');
for(const lang of LANGS.filter(l => l !== 'yue')){
  selectLanguage(lang);
  ok(!coverageIsMeasured(), `${lang}: not flagged measured`);
  ok(/[Ee]stimated/.test(coverageNote()), `${lang}: the note says estimated`);
  ok(!/measured on/i.test(coverageNote()), `${lang}: and never claims a measurement`);
}
selectLanguage('vi2');
ok(JSON.stringify(coverageTiers()) !== JSON.stringify(COVERAGE_MEASURED_YUE),
   'an estimated course does not silently reuse the Cantonese measurements');

section('interpolation');
selectLanguage('yue');
{
  ok(coverageForWords(0) === 0, 'nothing known is 0%');
  ok(coverageForWords(-5) === 0, 'a negative count does not go negative');
  ok(coverageForWords(43) === 50, 'landing exactly on a tier gives that tier');
  ok(coverageForWords(2112) === 95, 'and the top tier too');
  ok(coverageForWords(999999) === 95, 'past the end it clamps rather than exceeding the list');
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
  ok(/70/.test(html), 'and how many words the next rung needs');
  ok(!/undefined|NaN/.test(html), 'with nothing undefined in it');

  back.classList.remove('open');
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), 'it does not fire again for the same tier');

  // jumping several tiers at once banks all of them and announces the highest,
  // so the lower ones cannot ambush you on later cards
  know(500);
  checkCoverageMilestone();
  ok(seenMilestones().join(',') === '50,60,70,75,80,85', 'crossing several tiers banks every one');
  ok(/85%/.test(document.getElementById('milestoneBody').innerHTML), 'and announces the highest reached');
  back.classList.remove('open');
  checkCoverageMilestone();
  ok(!back.classList.contains('open'), 'and none of the skipped ones fire later');

  // per course
  selectLanguage('vi2');
  ok(seenMilestones().length === 0, 'a different course starts with no milestones banked');
  selectLanguage('yue');
  ok(seenMilestones().length === 6, 'and coming back does not lose the ones you had');
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
  ok(/[Ee]stimated/.test(j), 'Japanese shows that its figure is estimated');
  ok(!/HKCanCor/.test(j), 'and does not borrow the Cantonese corpus to look authoritative');
  ok(/21 days/.test(j), 'and both say what counts as a known word');
  coverageLadderOpen = false;
}

console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
