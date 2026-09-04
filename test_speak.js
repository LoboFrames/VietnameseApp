/* test_speak.js — the production ("Speak") mode.

   Written with the Listen & Guess lesson in mind. That engine was tuned three
   times against the wrong screen: the measurements were taken on the lesson
   practice path while the user was studying on the Cards tab, which never
   called the engine at all. Everything measured looked fine and the thing he
   used was untouched.

   So this suite walks EVERY entry point that can open a production card —
   the Cards-tab deck, the difficult deck, and the per-lesson deck — in EVERY
   course, and asserts against the cards those paths actually produce, not
   against a convenient sample. */
const fs = require('fs');
require('./dom_stub.js');
const vm = require('vm');
vm.runInThisContext(fs.readFileSync('app.js', 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if(cond){ pass++; console.log('  ok  ' + msg); } else { fail++; console.log('FAIL  ' + msg); } };
const section = t => console.log('\n== ' + t);

const LANGS = ['vi2','zh','yue','ja','ko','th','tl','en','es'];

/* ---------------------------------------------------------------- segmenter */
section('the segmenter');
selectLanguage('yue');
resetProductionVocab();

ok(segmentTarget('唔好臨急抱佛腳。').join('|') === '唔好|臨急抱佛腳',
   'longest match beats per-character: 唔好 / 臨急抱佛腳');
ok(segmentTarget('').length === 0 && segmentTarget(null).length === 0,
   'empty and null segment to nothing rather than throwing');
ok(segmentTarget('係。').every(t => !/[，。？！、]/.test(t)),
   'punctuation never becomes a tile');

// A global regex used with .test() alternates on identical input because
// lastIndex persists. If PROD_PUNCT were global this would fail every 2nd call.
{
  let stable = true;
  for(let i = 0; i < 6; i++) if(segmentTarget('好。').join('|') !== segmentTarget('好。').join('|')) stable = false;
  ok(stable, 'segmenting the same string repeatedly gives the same answer (no lastIndex bug)');
}

selectLanguage('vi2');
resetProductionVocab();
ok(isSpaceDelimitedCourse(), 'Vietnamese is treated as space-delimited');
ok(segmentTarget('Chào bạn, khỏe không?').join('|') === 'Chào|bạn|khỏe|không',
   'a space-delimited course splits on spaces and drops punctuation');
selectLanguage('yue');
resetProductionVocab();
ok(!isSpaceDelimitedCourse(), 'Cantonese is not treated as space-delimited');

/* the cache must not survive a language change, or Cantonese words would
   segment Japanese sentences */
{
  selectLanguage('yue'); resetProductionVocab(); segmentTarget('唔好');
  selectLanguage('ja');
  const before = productionVocab();
  selectLanguage('yue');
  const after = productionVocab();
  ok(before !== after, 'the segmenter dictionary is rebuilt when the course changes');
}

/* ------------------------------------------------------------------ the bank */
section('the word bank, in every course');
for(const lang of LANGS){
  selectLanguage(lang);
  resetProductionVocab();
  const pool = phraseStudyPool();
  if(!pool.length){ ok(true, `${lang}: no phrase deck, nothing to check`); continue; }

  const sample = pool.filter(p => p && p.v && p.e).slice(0, 400);
  let missingAnswer = 0, dupDistractor = 0, unbuildable = 0, emptyBank = 0, tooFewTiles = 0;

  for(const card of sample){
    const answer = segmentTarget(card.v);
    if(!answer.length){ unbuildable++; continue; }
    if(productionRung(card) !== 'build') continue;

    const bank = buildProductionBank(card, pool);
    if(!bank.tiles.length) emptyBank++;

    // 1. every tile of the answer must be present in the bank, counted with
    //    multiplicity — a sentence that repeats a word needs two tiles.
    const avail = bank.tiles.slice();
    let buildable = true;
    for(const t of bank.answer){
      const at = avail.indexOf(t);
      if(at === -1){ buildable = false; break; }
      avail.splice(at, 1);
    }
    if(!buildable) missingAnswer++;

    // 2. no distractor may equal an answer tile. If one did, the learner could
    //    assemble a sentence that reads exactly right and be marked wrong,
    //    with nothing on screen to explain it.
    const answerSet = new Set(bank.answer);
    if(bank.distractors.some(d => answerSet.has(d))) dupDistractor++;

    // 3. a bank with no distractors at all is a giveaway
    if(bank.tiles.length <= bank.answer.length) tooFewTiles++;
  }
  ok(missingAnswer === 0, `${lang}: every card can be assembled from its own bank (${sample.length} cards)`);
  ok(dupDistractor === 0, `${lang}: no distractor duplicates an answer tile`);
  ok(emptyBank === 0, `${lang}: no build card gets an empty bank`);
  ok(unbuildable === 0, `${lang}: every phrase segments to at least one tile`);
  ok(tooFewTiles === 0, `${lang}: every build card gets at least one distractor`);
}

/* ------------------------------------------------------------------ the rungs */
section('rung selection');
selectLanguage('yue');
resetProductionVocab();
{
  const pool = phraseStudyPool();
  const rungs = pool.slice(0, 500).map(p => productionRung(p));
  const build = rungs.filter(r => r === 'build').length;
  const say = rungs.filter(r => r === 'say').length;
  ok(build + say === rungs.length, 'every card gets exactly one of the two rungs');
  ok(build > 0 && say >= 0, 'the build rung is actually reached');
  const shortOnes = pool.slice(0, 500).filter(p => segmentTarget(p.v).length < 3);
  ok(shortOnes.every(p => productionRung(p) === 'say'),
     'anything under three chunks goes to Say It, where a bank would give it away');
  const buildable = pool.slice(0, 500).filter(p => {
    const seg = segmentTarget(p.v);
    return seg.length >= 3 && seg.length <= PROD_MAX_TILES && seg.filter(t => t.length > 1).length > 0;
  });
  ok(buildable.length > 0 && buildable.every(p => productionRung(p) === 'build'),
     'a sentence of three to nine tiles with real words in it goes to Build It');

  // The two ways a bank stops being a language test, both caught before it renders.
  const huge = pool.filter(p => segmentTarget(p.v).length > PROD_MAX_TILES);
  ok(huge.every(p => productionRung(p) === 'say'),
     `nothing over ${PROD_MAX_TILES} tiles gets a bank — that is a jigsaw, not Cantonese (${huge.length} cards)`);
  const shattered = pool.filter(p => {
    const seg = segmentTarget(p.v);
    return seg.length > 5 && seg.every(t => t.length === 1);
  });
  ok(shattered.every(p => productionRung(p) === 'say'),
     `a sentence the dictionary found no words in gets Say It, not a character scramble (${shattered.length} cards)`);

  // And every card still lands somewhere — no card may fall through the rungs.
  ok(pool.every(p => ['build','say'].indexOf(productionRung(p)) !== -1),
     'every card in the whole deck gets a rung');

  // The long C1 turns are exactly what the tile cap is for, so check that is
  // where they went rather than assuming it.
  const c1 = [];
  activeLessons().filter(l => l.level === 'C1').forEach(l => (l.dialogue||[]).forEach(d => c1.push({ v:d.v })));
  const c1say = c1.filter(d => productionRung(d) === 'say').length;
  ok(c1.length > 100 && c1say / c1.length > 0.5,
     `most C1 turns go to recall rather than tiles (${c1say}/${c1.length})`);
}

/* ------------------------------------------------------------- the check step */
section('checking an attempt');
{
  const card = { v:'唔好臨急抱佛腳。', e:'Don’t leave it to the last minute.', p:'m4 hou2 lam4 gap1 pou5 fat6 goek3', srsId:'t_check' };
  const bank = buildProductionBank(card, phraseStudyPool());

  const idxOf = t => bank.tiles.indexOf(t);
  // right answer
  swipeState = { deck:[card], idx:0, mode:'speak', flipped:false,
                 prodTiles:bank.tiles, prodAnswer:bank.answer, prodPicked:bank.answer.map(idxOf),
                 prodResult:null, prodFirstBad:-1, prodCardIdx:0, again:0,hard:0,good:0,easy:0 };
  checkProduction();
  ok(swipeState.prodResult === 'right', 'the exact target sequence is marked right');
  ok(swipeState.flipped === true, 'checking unlocks the grading row');

  // wrong order
  const rev = bank.answer.slice().reverse().map(idxOf);
  swipeState = { deck:[card], idx:0, mode:'speak', flipped:false,
                 prodTiles:bank.tiles, prodAnswer:bank.answer, prodPicked:rev,
                 prodResult:null, prodFirstBad:-1, prodCardIdx:0, again:0,hard:0,good:0,easy:0 };
  checkProduction();
  ok(swipeState.prodResult === 'wrong', 'the reversed sequence is marked wrong');
  ok(swipeState.prodFirstBad === 0, 'and it names the first position that diverged');

  // too short — all present tiles right, but it stops early
  swipeState = { deck:[card], idx:0, mode:'speak', flipped:false,
                 prodTiles:bank.tiles, prodAnswer:bank.answer, prodPicked:[idxOf(bank.answer[0])],
                 prodResult:null, prodFirstBad:-1, prodCardIdx:0, again:0,hard:0,good:0,easy:0 };
  checkProduction();
  ok(swipeState.prodResult === 'wrong', 'a correct prefix that stops early is still wrong');
  ok(swipeState.prodFirstBad === 1, 'and the divergence is reported at the missing position, not -1');

  // reveal
  swipeState = { deck:[card], idx:0, mode:'speak', flipped:false,
                 prodTiles:bank.tiles, prodAnswer:bank.answer, prodPicked:[],
                 prodResult:null, prodFirstBad:-1, prodCardIdx:0, again:0,hard:0,good:0,easy:0 };
  revealProduction();
  ok(swipeState.prodResult === 'shown', 'the give-up path marks the attempt shown, not right');
  ok(swipeState.flipped === true, 'and still lets you grade — Again being the obvious one');

  // a checked card must not be re-checkable or re-editable
  const before = JSON.stringify(swipeState.prodPicked);
  pickProductionTile(0); clearProduction(); unpickProductionTile(0);
  ok(JSON.stringify(swipeState.prodPicked) === before, 'tiles are frozen once the answer is shown');
}

/* --------------------------------------------------------------- mic scoring */
section('mic scoring');
{
  const s1 = scoreProductionSpeech('唔好臨急抱佛腳', '唔好臨急抱佛腳。');
  ok(s1.hits === s1.total && s1.total > 0, 'an exact match scores every character');
  ok(s1.marks.every(m => m.ok), 'and marks none of them wrong');

  const s2 = scoreProductionSpeech('唔好', '唔好臨急抱佛腳');
  ok(s2.hits === 2 && s2.total === 7, 'a partial attempt scores only what it said');
  ok(s2.marks.filter(m => !m.ok).length === 5, 'and marks the rest as missed');

  const s3 = scoreProductionSpeech('', '唔好');
  ok(s3.hits === 0 && s3.total === 2, 'saying nothing scores zero rather than throwing');

  const s4 = scoreProductionSpeech('唔好、、。', '唔好');
  ok(s4.hits === 2, 'punctuation in the transcript is ignored');

  // A character the target uses twice must not be satisfied by saying it once.
  const s5 = scoreProductionSpeech('好', '好好');
  ok(s5.hits === 1 && s5.total === 2, 'a doubled character needs to be said twice');

  ok(scoreProductionSpeech('anything', '').total === 0, 'an empty target scores nothing rather than dividing by zero');
}

/* -------------------------------------------------------------- the mic gate */
section('the mic gate');
{
  const realUA = navigator;
  const setNav = v => Object.defineProperty(globalThis, 'navigator', { value:v, writable:true, configurable:true });
  // iOS reports support and then never fires the callback — the gate must be
  // three-way (supported / iOS / absent), not a bare feature check.
  setNav({ userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform:'iPhone', maxTouchPoints:5 });
  global.window.SpeechRecognition = function(){};
  ok(productionMicSupported() === false, 'iOS is excluded even though it reports support');

  setNav({ userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120', platform:'MacIntel', maxTouchPoints:0 });
  ok(productionMicSupported() === true, 'desktop Chrome with the API is allowed');

  delete global.window.SpeechRecognition;
  delete global.window.webkitSpeechRecognition;
  ok(productionMicSupported() === false, 'a browser without the API is excluded');
  setNav(realUA);
}

/* ------------------------------------------------------ entry points actually run */
section('every entry point opens a real deck');
for(const lang of LANGS){
  selectLanguage(lang);
  resetProductionVocab();
  let threw = null;
  try{
    startSpeakStudy(null);
    const deck = swipeState.deck;
    if(deck.length){
      swipeState.prodCardIdx = -1;
      prepareProductionCard();
      const html = renderProductionCard(swipeState.deck[0]);
      if(!html || html.indexOf('swipe-card') === -1) threw = 'no card html';
      if(html.indexOf('undefined') !== -1) threw = 'undefined leaked into the card';
    }
  }catch(e){ threw = e.message; }
  ok(!threw, `${lang}: the Cards-tab Speak deck opens and renders (${threw || 'clean'})`);

  threw = null;
  try{ startDifficultSpeakStudy(); }catch(e){ threw = e.message; }
  ok(!threw, `${lang}: the difficult Speak deck opens (${threw || 'clean'})`);
}

section('the per-lesson deck');
selectLanguage('yue');
resetProductionVocab();
{
  const l = activeLessons().find(x => (x.dialogue||[]).length);
  const opened = startLessonSpeakStudy(l.id);
  ok(opened === true, 'a lesson with dialogue opens a production deck');
  ok(swipeState.deck.length === l.dialogue.length, 'with one card per dialogue line');
  ok(swipeState.deck.every(c => c.srsId && c.v && c.e), 'every card carries an srsId, the target and the English');
  ok(swipeState.deck.every(c => /^lesson_/.test(c.srsId)),
     'on the SAME srsIds the lesson quiz uses, so producing a line feeds one set of intervals');
  ok(startLessonSpeakStudy('no_such_lesson') === false, 'an unknown lesson id returns false rather than opening an empty deck');

  // render every card of a real lesson
  let bad = 0;
  for(let i = 0; i < swipeState.deck.length; i++){
    swipeState.idx = i; swipeState.prodCardIdx = -1;
    prepareProductionCard();
    const html = renderProductionCard(swipeState.deck[i]);
    if(!html || html.indexOf('undefined') !== -1) bad++;
  }
  ok(bad === 0, 'every line of the lesson renders a clean production card');
}

section('grading reaches the SRS and the study log');
selectLanguage('yue');
{
  const l = activeLessons().find(x => (x.dialogue||[]).length);
  startLessonSpeakStudy(l.id);
  const id = swipeState.deck[0].srsId;
  const before = state.srs[id] ? JSON.parse(JSON.stringify(state.srs[id])) : null;
  swipeState.prodCardIdx = -1; prepareProductionCard();
  revealProduction();
  gradeCard(2);
  ok(!!state.srs[id], 'grading a produced card writes an SRS entry');
  ok(JSON.stringify(state.srs[id]) !== JSON.stringify(before), 'and it actually changes the card');
  const logged = studiedOn(todayStr());
  ok(logged && logged[id], 'and the produced card lands in the day’s study log');
}

section('the reading gate applies here too');
selectLanguage('yue');
{
  state.showJyutping = true;
  const l = activeLessons().find(x => (x.dialogue||[]).length);
  startLessonSpeakStudy(l.id);
  swipeState.idx = 0; swipeState.prodCardIdx = -1; prepareProductionCard();
  const target = swipeState.deck[0];

  exerciseRomVisible = false;
  const hidden = renderProductionCard(target);
  ok(hidden.indexOf('sc-pron') === -1 || hidden.indexOf(target.p) === -1,
     'the reading is not on the card before the toggle is turned on');

  exerciseRomVisible = true;
  revealProduction();
  const shown = renderProductionCard(swipeState.deck[0]);
  ok(shown.indexOf(target.p) !== -1, 'and it appears once revealed with the toggle on');

  state.showJyutping = false;
  const off = renderProductionCard(swipeState.deck[0]);
  ok(off.indexOf(target.p) === -1, 'the global switch turns it off here as well');
  state.showJyutping = true;
  exerciseRomVisible = false;
}

section('the prompt never leaks the answer');
selectLanguage('yue');
resetProductionVocab();
{
  const pool = phraseStudyPool();
  let leaked = 0, checked = 0;
  for(const card of pool.slice(0, 300)){
    if(!card.v || !card.e) continue;
    checked++;
    // the English side must not contain the target script, or the card answers
    // itself before the bank is even read
    if(/[㐀-鿿]/.test(card.e)) leaked++;
  }
  ok(checked > 100, 'the leak check looked at a real number of cards');
  ok(leaked === 0, 'no English prompt contains the characters it is asking for');
}

console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
