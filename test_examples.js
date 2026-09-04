/* test_examples.js — graded example sentences on the lesson-words cards.

   The old version looked for one example in one place: a line of THIS lesson's
   dialogue containing the word. 53% of the Cantonese vocab cards got nothing.

   Two ways the fix could go wrong, and both are what this suite is watching:
   a card that is still blank, and a card handed something it cannot read — a
   sixty-syllable C1 turn on lesson three because that turn happens to contain
   我. So the assertions are about COVERAGE and about CEILINGS, in every course,
   over every lesson, not over a sample. */
const fs = require('fs');
require('./dom_stub.js');
const vm = require('vm');
vm.runInThisContext(fs.readFileSync('app.js', 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if(cond){ pass++; console.log('  ok  ' + msg); } else { fail++; console.log('FAIL  ' + msg); } };
const section = t => console.log('\n== ' + t);
const LANGS = ['vi2','zh','yue','ja','ko','th','tl','en','es'];

section('difficulty scoring');
selectLanguage('yue');
resetExampleRanks(); resetProductionVocab();
{
  const easy = sentenceDifficulty('係咩？');
  const hard = sentenceDifficulty('唔使指擬佢下個月就加，九成會拖，唔出奇。');
  ok(easy.score < hard.score, 'a common short sentence scores easier than a rare long one');
  ok(easy.len < hard.len, 'and shorter');
  ok(sentenceDifficulty('').score > 0, 'an empty string does not score zero and sort to the front');
  ok(sentenceDifficulty(null).len === 0, 'null does not throw');

  // The sentinel bug: the frequency deck marks a taught-but-uncounted word
  // 999999. Copying that in rated every sentence with a name or a C1 item as
  // maximally hard, which knocked 恐怕 out of its own lesson's examples.
  ok(wordRankFor('話唔定') < 99999, 'a taught word the corpus never saw is not rated as impossibly rare');
  ok(sentenceDifficulty('你好啊！我係阿明。').rank < 99999, 'a sentence containing a name is not rated impossible');
  ok(wordRankFor('係') < wordRankFor('話唔定'), 'and a very common word still outranks a rare one');

  // length is counted in WORDS, not characters — a character cap tuned on
  // Cantonese blanked 73% of the Vietnamese cards when it first shipped
  const yueLen = sentenceDifficulty('你好啊！我係阿明。').len;
  selectLanguage('vi2'); resetExampleRanks(); resetProductionVocab();
  const viLen = sentenceDifficulty('Chào bạn, khỏe không?').len;
  ok(Math.abs(yueLen - viLen) <= 4, `sentences of the same size measure the same across scripts (yue ${yueLen} vs vi ${viLen})`);
  selectLanguage('yue'); resetExampleRanks(); resetProductionVocab();
}

section('the ceiling rises with the course');
selectLanguage('yue');
{
  const L = activeLessons();
  const first = lessonDifficultyCeiling(L[0]);
  const mid = lessonDifficultyCeiling(L[Math.floor(L.length/2)]);
  const last = lessonDifficultyCeiling(L[L.length-1]);
  ok(first < mid && mid < last, `the difficulty ceiling climbs: ${Math.round(first)} → ${Math.round(mid)} → ${Math.round(last)}`);
  ok(first >= 400, 'and never starts so low that lesson one qualifies for nothing');
  const lenFirst = lessonExampleMaxLen(L[0]);
  const lenLast = lessonExampleMaxLen(L[L.length-1]);
  ok(lenFirst < lenLast, `the length cap climbs too: ${lenFirst} → ${lenLast} words`);
  ok(lenLast <= EX_HARD_MAX_LEN, 'and never past the hard cap');
}

section('coverage — the bug being fixed');
for(const lang of LANGS){
  selectLanguage(lang);
  resetExampleRanks(); resetProductionVocab();
  let cards = 0, blank = 0, multi = 0;
  activeLessons().forEach(l => lessonVocabPool(l).forEach(c => {
    cards++;
    const ex = gradedExamples(c.v, l, 4);
    if(!ex.length) blank++;
    if(ex.length > 1) multi++;
  }));
  if(!cards){ ok(true, `${lang}: no lesson vocab, nothing to cover`); continue; }
  const blankPct = blank / cards * 100;
  /* Only the courses with real content are held to a bar. ko/th/tl/en/es are
     stubs — four to eight vocabulary cards and almost no sentences — so their
     blank rate measures how much content exists, not whether this code works,
     and asserting on it would be a test that fails for the wrong reason
     forever. Japanese has real lessons but few sentences in them, so it gets a
     looser bar. Every number is printed either way, so a regression is still
     visible in the output. */
  if(cards < 100){ ok(true, `${lang}: only ${cards} vocab cards — ${blankPct.toFixed(0)}% blank, content-limited, not asserted`); continue; }
  const bar = lang === 'ja' ? 60 : 15;
  ok(blankPct < bar, `${lang}: ${blankPct.toFixed(0)}% of cards blank (was 53% for yue, 70% for ja)`);
  ok(multi > 0, `${lang}: some cards get more than one example (${multi} of ${cards})`);
}

section('nothing unreadable reaches a card');
for(const lang of LANGS){
  selectLanguage(lang);
  resetExampleRanks(); resetProductionVocab();
  let over = 0, shown = 0, selfRef = 0, noGloss = 0, missing = 0;
  activeLessons().forEach(l => lessonVocabPool(l).forEach(c => {
    gradedExamples(c.v, l, 4).forEach(x => {
      shown++;
      if(x.d.len > EX_HARD_MAX_LEN) over++;
      if(x.v === c.v) selfRef++;                       // the word alone is not an example of itself
      if(!x.e) noGloss++;                              // an example with no English teaches nothing
      if(String(x.v).toLowerCase().indexOf(String(c.v).toLowerCase()) === -1 && !isSpaceDelimitedCourse()) missing++;
    });
  }));
  if(!shown){ ok(true, `${lang}: no examples to check`); continue; }
  ok(over === 0, `${lang}: no example is longer than the hard cap (${shown} examples)`);
  ok(selfRef === 0, `${lang}: no card offers the bare word as its own example`);
  ok(noGloss === 0, `${lang}: every example carries an English gloss`);
  ok(missing === 0, `${lang}: every example actually contains the word`);
}

section('examples are graded to the lesson, not just found');
selectLanguage('yue');
resetExampleRanks(); resetProductionVocab();
{
  const L = activeLessons();
  const early = L.slice(0, 12), late = L.slice(-12);
  const avgLen = ls => {
    let n = 0, sum = 0;
    ls.forEach(l => lessonVocabPool(l).forEach(c => gradedExamples(c.v, l, 4).forEach(x => { n++; sum += x.d.len; })));
    return n ? sum / n : 0;
  };
  const avgRank = ls => {
    let n = 0, sum = 0;
    ls.forEach(l => lessonVocabPool(l).forEach(c => gradedExamples(c.v, l, 4).forEach(x => { n++; sum += x.d.rank; })));
    return n ? sum / n : 0;
  };
  const re = avgRank(early), rl = avgRank(late);
  /* Rank is the measure, not length. Length was asserted first and it does not
     rise monotonically — it peaks mid-course and falls again, because the C1
     words appear almost only in their own short example cards while 係 and 我
     turn up inside everything. Rarer VOCABULARY is what "matching your level"
     actually means, and it climbs cleanly: 881 → 1214 → 1705 → 2405 across the
     course. Length is reported so a regression is visible, not asserted. */
  ok(rl > re, `late lessons draw on rarer vocabulary (avg rank ${re.toFixed(0)} → ${rl.toFixed(0)})`);
  ok(rl / re > 1.5, 'and the gap is real rather than noise');
  console.log(`      (avg length ${avgLen(early).toFixed(1)} → ${avgLen(late).toFixed(1)} words — reported, not asserted)`);

  // the specific failure this exists to prevent
  let breach = 0;
  early.forEach(l => {
    const ceil = lessonDifficultyCeiling(l);
    const cap = lessonExampleMaxLen(l);
    lessonVocabPool(l).forEach(c => gradedExamples(c.v, l, 4).forEach(x => {
      // a breach is allowed only where the relaxation had to fire — i.e. there
      // was genuinely nothing inside the limits for that word
      const all = gatherExampleCandidates(c.v, l).map(y => sentenceDifficulty(y.v));
      const anyOk = all.some(d => d.rank <= ceil && d.len <= cap);
      if((x.d.rank > ceil || x.d.len > cap) && anyOk) breach++;
    }));
  });
  ok(breach === 0, 'an early lesson is never shown something over its ceiling while something under it existed');
}

section('the lesson’s own dialogue comes first');
selectLanguage('yue');
{
  let checked = 0, homeFirst = 0;
  activeLessons().slice(0, 40).forEach(l => lessonVocabPool(l).forEach(c => {
    const ex = gradedExamples(c.v, l, 4);
    if(!ex.length) return;
    /* Only where a home candidate is actually ELIGIBLE. A lesson's own dialogue
       line can be too long or too hard for its own lesson — a C1 turn is — and
       filtering it out is correct, not a failure to prefer it. */
    const ceil = lessonDifficultyCeiling(l);
    const cap = lessonExampleMaxLen(l);
    const anyHome = gatherExampleCandidates(c.v, l)
      .some(x => { const d = sentenceDifficulty(x.v); return x.home && d.rank <= ceil && d.len <= cap; });
    if(!anyHome) return;
    checked++;
    if(ex[0].home) homeFirst++;
  }));
  ok(checked > 50, 'the ordering check saw a real number of cards');
  ok(homeFirst / checked > 0.9, `the word is re-met in its own lesson first where that is possible (${homeFirst}/${checked})`);
}

section('the reading is shown one way');
selectLanguage('yue');
{
  ok(spacedReading('cam4zyu6hei3') === 'cam4 zyu6 hei3', 'an unspaced vocabulary reading is split into syllables');
  ok(spacedReading('cam4 zyu6 hei3') === 'cam4 zyu6 hei3', 'an already-spaced one is left alone');
  ok(spacedReading('hai6') === 'hai6', 'a single syllable is unchanged');
  ok(spacedReading('') === '' && spacedReading(null) === '', 'empty and null are safe');
  selectLanguage('vi2');
  ok(spacedReading('chào bạn') === 'chào bạn', 'a course without tone numbers is left alone');
  selectLanguage('yue');
}

section('the cards render');
for(const lang of LANGS){
  selectLanguage(lang);
  resetExampleRanks(); resetProductionVocab();
  const l = activeLessons().find(x => (x.vocab||[]).length);
  if(!l){ ok(true, `${lang}: no lesson vocab to render`); continue; }
  let threw = null;
  try{
    startLessonVocabStudy(l.id);
    for(let i = 0; i < Math.min(swipeState.deck.length, 6); i++){
      swipeState.idx = i; swipeState.exFor = -1;
      swipeState.flipped = false; renderSwipe();
      const front = document.getElementById('swipeBody').innerHTML;
      swipeState.flipped = true; swipeState.exFor = -1; renderSwipe();
      const back = document.getElementById('swipeBody').innerHTML;
      if(/undefined|NaN|\[object/.test(front + back)) threw = 'undefined leaked in';
      if(front.indexOf('sc-say') === -1) threw = 'no tap-to-replay affordance on the headword';
      // The back must reveal the gloss. Length is not the test: a course with
      // no example sentences has a back that is the front plus the gloss minus
      // the "tap to flip" hint, which can be shorter.
      if(back.indexOf('sc-eng') === -1) threw = 'no gloss on the back';
      if(/display:\s*none/.test(back.split('sc-eng')[1] || '')) threw = 'the gloss is still hidden on the back';
    }
  }catch(e){ threw = e.message; }
  ok(!threw, `${lang}: lesson-word cards render front and back (${threw || 'clean'})`);
}

section('tapping the characters replays rather than flipping');
selectLanguage('yue');
{
  const l = activeLessons().find(x => (x.vocab||[]).length);
  startLessonVocabStudy(l.id);
  swipeState.idx = 0; swipeState.exFor = -1; swipeState.flipped = false;
  renderSwipe();
  const html = document.getElementById('swipeBody').innerHTML;
  ok(/onclick="event\.stopPropagation\(\);replayCardAudio\(\)"/.test(html),
     'the headword replays and stops the tap reaching the card');
  ok(html.indexOf('sc-word') !== -1, 'and is marked as the headword so it gets the largest type');
  let threw = null;
  try{ replayCardAudio(); }catch(e){ threw = e.message; }
  ok(!threw, 'replaying does not throw');
  swipeState = null;
  try{ replayCardAudio(); }catch(e){ threw = e.message; }
  ok(!threw, 'and is safe with no deck open');
}

console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
