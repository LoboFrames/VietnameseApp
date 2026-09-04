require('./dom_stub.js');
const fs=require('fs'), vm=require('vm');
process.on('unhandledRejection',e=>{console.log('UNHANDLED:',e&&e.message);process.exitCode=1;});
vm.runInThisContext(fs.readFileSync('app.js','utf8'));
let p=0,f=0; const ok=(n,c,e)=>{c?(p++,console.log('  ok  '+n)):(f++,console.log('FAIL  '+n+(e!==undefined?' :: '+e:'')));};
const g=id=>{const el=document.getElementById(id);return String(el?(el.innerHTML||el.textContent||''):'');};

ok('booted', typeof renderAll==='function');

// --- Cantonese ---
selectLanguage('yue');
renderAll();
ok('yue renderAll clean', true);
ok('every authored yue lesson is live', activeLessons().length===LESSONS_YUE.length && activeLessons().length>=60, activeLessons().length);
ok('lesson days run 1..N with no gap', activeLessons().every((l,i)=>l.day===i+1));
ok('every lesson has its full shape',
   activeLessons().every(l=>l.cards.length>=4 && l.vocab.length>=1 && l.dialogue.length>=4 && (l.grammar||[]).length>=1),
   activeLessons().filter(l=>!(l.cards.length>=4&&l.dialogue.length>=4)).map(l=>l.id));
ok('B1 section 2 is populated', activeLessons().some(l=>l.level==='B1'&&l.section===2));

const wl = buildWordFrequencyList();
/* The deck is now the corpus PLUS the words the course teaches from below its
   cutoff — every count-4, count-3 and C1 word, appended at rank 999999. Those
   794 were taught in lessons and had no card at all, which is also why the
   Lessons tab total and the Cards tab total disagreed. So the corpus
   assertions below apply to the RANKED head of the list, and the tail gets its
   own checks: it must be non-empty, entirely off-corpus, and entirely taught. */
const ranked = wl.filter(w=>w.rank!==999999);
const offList = wl.filter(w=>w.rank===999999);
/* Derived, so extending the corpus updates the expectation instead of breaking
   it. Minus the DISTINCT count, not the raw one: normalising 哩 to 呢 merged two
   corpus entries into one card (呢 ne1 rank 5 and the old 哩 ni1 rank 78 are the
   same written form), so the head is one shorter than the raw corpus. */
{
  const kept = FREQ_YUE.filter(([w])=>!YUE_NOISE.has(w)).map(([w])=>w);
  ok('the ranked head is the corpus minus the noise set, deduplicated',
     ranked.length === new Set(kept).size, ranked.length + ' vs ' + new Set(kept).size);
  ok('no word appears twice in the deck',
     new Set(wl.map(w=>w.word)).size === wl.length,
     wl.length - new Set(wl.map(w=>w.word)).size);
  const nei = wl.find(w=>w.word==='呢');
  ok('呢 keeps the better rank and shows both readings',
     nei && nei.rank === 5 && /ne1/.test(nei.p) && /ni1/.test(nei.p), nei && nei.rank + ' ' + nei.p);
  ok('哩 is gone from the course entirely', !wl.some(w=>w.word.includes('哩')));
}
ok('係 still rank 1', wl[0].rank===1 && wl[0].word==='係');
ok('noise words gone from the list', !wl.some(w=>['艾爾頓','富城','阿木','小豬','亞視','舋','噉樣樣'].includes(w.word)));
ok('ranks run to the full corpus length', ranked[ranked.length-1].rank===FREQ_YUE.length, ranked[ranked.length-1].rank);
ok('the off-list tail exists', offList.length > 500, offList.length);
{
  const corpus = new Set(FREQ_YUE.map(([w])=>w));
  ok('nothing in the tail is already in the corpus', !offList.some(w=>corpus.has(w.word)),
     offList.filter(w=>corpus.has(w.word)).slice(0,5).map(w=>w.word));
  const taught = new Set();
  activeLessons().forEach(l=>(l.vocab||[]).forEach(v=>taught.add(v.v)));
  ok('every word in the tail is taught in a lesson', offList.every(w=>taught.has(w.word)),
     offList.filter(w=>!taught.has(w.word)).slice(0,5).map(w=>w.word));
  ok('every word the course teaches now has a card', [...taught].every(w=>wl.some(x=>x.word===w)),
     [...taught].filter(w=>!wl.some(x=>x.word===w)).slice(0,5));
}
ok('rank 1 and rank 856 are unchanged by the extension', wordRank('係')===1 && wordRank('創作')===856);
ok('wordRank reads the yue corpus', wordRank('係')===1);
ok('the old last word still ranks 856', wordRank('創作')===856, wordRank('創作'));
ok('a filtered name is unranked', wordRank('艾爾頓')===999999);
ok('unranked label quotes the live list size', freqUnrankedLabel()==='Not in top '+wl.length.toLocaleString(), freqUnrankedLabel());

// popup on the #1 card — the bug the user reported
showWordInfo('係');
const badge=g('wordSheetBadge');
ok('popup says #1 most common', badge.includes('#1 most common'), badge.slice(0,120));
ok('popup no longer claims unranked', !badge.includes('Not in top 30,000'));

// every new lesson opens
let opened=0;
for(let i=25;i<=48;i++){ openLessonDetail('yue_l'+i); opened++; }
ok('all 24 new lessons open', opened===24);
ok('lesson 48 title rendered', g('ldTitle')==='A Change of Mind', g('ldTitle'));
ok('lesson 48 desc quotes its ranks', g('ldDesc').includes('#839-856'), g('ldDesc').slice(0,80));
openLessonDetail('yue_l25');
ok('lesson 25 title rendered', g('ldTitle')==='Booking a Table', g('ldTitle'));
openLessonDetail('yue_l48');

// vocab drill on a new lesson
startLessonVocabStudy('yue_l48');
ok('lesson-48 word drill opens', true);
closeSwipe && closeSwipe();

// --- Vietnamese unchanged ---
selectLanguage('vi2');
renderAll();
ok('vi renderAll clean', true);
ok('vi word list unchanged size', buildWordFrequencyList().length>2000, buildWordFrequencyList().length);
ok('vi tôi still rank 1', wordRank('tôi')===1);
ok('vi label unchanged', freqUnrankedLabel()==='Not in top 30,000');
showWordInfo('tôi');
ok('vi popup ranks it', g('wordSheetBadge').includes('#1 most common'));


/* 噉 gam2 (in this manner, "so then") against 咁 gam3 (to this degree). I have
   written the wrong one three times in this course, so it is a rule now rather
   than a thing to remember: whatever the jyutping says, the character follows.
   It caught nine pre-existing errors in lessons 29-48 the day it was added. */
selectLanguage('yue');
const gamLines = [];
activeLessons().forEach(l=>{
  (l.cards||[]).forEach((c,i)=>gamLines.push([l.id+' card'+i, c.v, c.p]));
  (l.dialogue||[]).forEach((d,i)=>gamLines.push([l.id+' dlg'+i, d.v, d.p]));
  (l.vocab||[]).forEach((v,i)=>gamLines.push([l.id+' vocab'+i, v.v, v.p]));
});
activePacks().forEach(pk=>pk.cards.forEach((c,i)=>gamLines.push([pk.id+'_'+i, c.v, c.p])));
slangVocab().forEach(w=>gamLines.push(['slang '+w.word, w.word, w.p]));
slangPhrases().forEach(c=>gamLines.push(['slangp', c.v, c.p]));
facilityVocab().forEach(w=>gamLines.push(['work '+w.word, w.word, w.p]));
const PUNCT = /[，,。.？?！!、；;：:\s]/;
const gamBad = [];
gamLines.filter(x=>x[2]).forEach(([id, v, p2])=>{
  const chars = [...v].filter(c=>!PUNCT.test(c));
  const syl = p2.replace(/[，,。.？?！!、；;：:]/g,' ').trim().split(/\s+/);
  if(syl.length !== chars.length) return;          // shape checked elsewhere
  chars.forEach((ch,i)=>{
    if(ch==='咁' && syl[i]==='gam2') gamBad.push(id+': 咁 where gam2 needs 噉 — '+v);
    if(ch==='噉' && syl[i]==='gam3') gamBad.push(id+': 噉 where gam3 needs 咁 — '+v);
  });
});
ok('噉 gam2 and 咁 gam3 match their jyutping everywhere', gamBad.length===0, gamBad.slice(0,4));
ok('the gam check actually looked at the course', gamLines.filter(x=>x[2]).length>2000,
   gamLines.filter(x=>x[2]).length);

/* 嚟 was romanised lai4 in 32 places and lei4 in 8, at random — not two words
   the way 掂 dim3 (touch) and 掂 dim6 (sorted) are, just one word spelled two
   ways. Characters that genuinely carry two readings are listed here BY those
   readings, so a third one, or a new split on a character not listed, fails. */
selectLanguage('yue');
const TWO_WAY = {
  /* Every character below carries two (or three) readings ON PURPOSE — a real
     multi-reading character (行 haang4 walk / hang4 conduct), a colloquial
     changed tone (舖頭 pou3 tau2), or a written-vs-spoken pair (話 waa6 say /
     waa2 language). This list is a REVIEWED BASELINE: each was checked against
     HKCanCor when the check was written, after it found seven genuine errors
     (來 lai4 where speech wants 嚟 lei4, 硬係 ngaang2, 雀仔 zoek3, the
     classifier 架 gaa2, 一篤屎 duk6) and two lazy-tone spellings that had
     drifted in unannounced. A character NOT listed here that acquires a second
     reading, or a listed one that acquires a third, fails this test — which is
     the point: it should be a decision, not drift. */
  /* 好 hou3 in 嗜好 si3hou3; 聲 sing1 in 聲稱 sing1cing1 (the written reading,
     which is the one that survives in that word); 魚 jyu2 is the colloquial
     changed tone in compounds, jyu4 the citation form. */
  '好':['hou2','hou3'], '聲':['seng1','sing1'], '魚':['jyu2','jyu4'],
  /* 傳 cyun4 is to pass something on; zyun2 is the 'story, account' sense,
     which in speech survives almost only in 言歸正傳. */
  '傳':['cyun4','zyun2'],
  /* 假 gaa2 false vs gaa3 leave/holiday; 轉 zyun2 to turn (婉轉, 返轉頭) vs zyun3
     to change (轉工); 命 meng6 life, the colloquial one, vs ming6 in 命令;
     搪 tong2 in 推搪 vs tong4 in 搪塞 — rime lists both and they are different
     words, not a drift. */
  '假':['gaa2','gaa3'], '轉':['zyun2','zyun3'], '命':['meng6','ming6'], '搪':['tong2','tong4'],
  /* 絡 lok3 in 聯絡, lok6 in 熟絡 — rime lists both readings for the character
     and gives 熟絡 only as suk6lok6, so this is two words, not drift. */
  '絡':['lok3','lok6'],
  /* 夾 gaap3 is the "and" of 大聲夾惡; gep6 is pinching or trapping, which is
     what 夾親 (trap a finger) uses. rime lists 夾親 as gep6can1. */
  '夾':['gaap3','gep6'],
  '上':['soeng6','soeng5'], '下':['haa5','haa6','haa2'], '中':['zung1','zung3'],
  '人':['jan4','jan2'], '企':['kei2','kei5'], '位':['wai2','wai6'],
  '便':['bin2','bin6'], '冚':['ham6','kam2'], '分':['fan1','fan6'],
  '到':['dou3','dou2'], '友':['jau5','jau2'], '右':['jau2','jau6'],
  '名':['meng2','ming4'], '呢':['ni1','ne1'], '咪':['mai5','mai6','mi4','mai1'],
  '啦':['laa1','laa3'], '喇':['laa3','laa1'], '㗎':['gaa3','gaa4'],
  '園':['jyun2','jyun4'], '士':['si2','si6'], '太':['taai3','taai2'],
  '女':['neoi5','neoi2'], '妹':['mui2','mui6'], '尾':['mei5','mei1'],
  '平':['peng4','ping4'], '年':['nin4','nin2'], '幾':['gei2','gei1'],
  '律':['leot6','leot2'], '慢':['maan6','maan2'], '應':['jing1','jing3'],
  '成':['seng4','sing4'], '掂':['dim6','dim3'], '排':['paai4','paai2'],
  '文':['man2','man4'], '更':['gang3','gaang1'], '會':['wui5','wui2','wui6'],
  '校':['haau6','gaau3'], '樂':['ngok6','lok6'], '樣':['joeng6','joeng2'],
  '正':['zeng3','zing3'], '淨':['zing6','zeng6'], '為':['wai6','wai4'],
  '爭':['zaang1','zang1'], '生':['saang1','sang1'], '當':['dong1','dong3'],
  '相':['soeng2','soeng1'], '着':['zoek6','zoek3'], '碟':['dip6','dip2'],
  '競':['ging3','ging6'], '糖':['tong2','tong4'], '線':['sin3','sin2'],
  '聞':['man2','man4'], '聽':['ting1','teng1'], '興':['hing3','hing1'],
  '舖':['pou3','pou2'], '處':['cyu3','cyu2'],
  /* 行 hong2 is the shop/firm sense — 車行 ce1hong2, the garage, which rime
     lists exactly so. 哋 dei2 and 麻 maa2 are both the changed tone inside
     麻麻哋 "so-so" (rime: 麻麻地 maa4maa2dei2); everywhere else they are dei6
     and maa4. All three are single words, not drift. */
  '行':['haang4','hong4','hang4','hong2'], '哋':['dei6','dei2'], '麻':['maa4','maa2'],
  '要':['jiu3','jiu1'], '覺':['gok3','gaau3'], '計':['gai2','gai3'],
  '試':['si3','si5'], '話':['waa6','waa2'], '請':['ceng2','cing2'],
  '豆':['dau6','dau2'], '近':['gan6','kan5'], '道':['dou3','dou6'],
  '邊':['bin1','bin6'], '醒':['sing2','seng2'], /* 重 carries three: zung6 is still/yet and serious (重未, 嚴重, 重要),
     cung4 is again (重新), cung5 is weight — rime has 重量 cung5loeng6 and
     磅重 bong6cung5. */
  '重':['zung6','cung4','cung5'],
  '錢':['cin2','cin4'], '長':['coeng4','zoeng2'], '門':['mun4','mun2'],
  '間':['gaan1','gaan3'], '隊':['deoi2','deoi6'], '頂':['ding2','deng2'],
  '頭':['tau4','tau2'], '類':['leoi6','leoi2'],
  /* added with the family world: 喂 wai3 is calling out across a room, wai2 is
     answering the phone; 家姐 gaa1 ze1 against 表姐 biu2 ze2; and 阿姨 aa3 ji1
     against 姨媽 ji4 maa1, a distinction pack yp22 teaches on purpose. */
  '喂':['wai3','wai2'], '姐':['ze1','ze2'], '姨':['ji1','ji4'],
  /* added with the Hong Kong worlds, each confirmed against rime-cantonese:
     燒賣 siu1 maai2 against 賣 maai6 sell; 差館 caai1 gun2 against 差唔多 caa1;
     散紙 saan2 zi2 against 散 saan3 fall apart; 蛋 daan2 in 餐蛋麵 against
     daan6 in 蛋糕; and 咪錶 mai1 biu1, the loan reading, joining 咪住 mai5,
     係咪 mai6 and 媽咪 mi4 — four different words sharing one character. */
  '賣':['maai6','maai2'], '差':['caa1','caai1'], '散':['saan3','saan2'],
  '蛋':['daan6','daan2'],
  /* 數 is the noun sou3 (個數, 埋數, 磅數 — the figure) against the verb sou2
     (數清楚 — to count), the same written-vs-spoken split as 話 waa6/waa2. */
  '數':['sou3','sou2'],
  /* 面 min6 is the physical side or surface (前面, 上面, 寫喺面); min2 is face
     in the social sense, and only ever appears in 畀面 and 落面. */
  '面':['min6','min2'],
  /* 零 leng4 is the colloquial "-odd" taught in yue_c4 (十零日); ling4 is the
     citation reading, which is what 零件 ling4 gin6 uses. */
  '零':['leng4','ling4'],
  /* 度 dou6 is a degree or a place (廿八度, 喺邊度); dok6 is the verb, to
     measure — 度下水份 with the moisture pen. rime lists both. */
  '度':['dou6','dok6'],
  /* 儲 cou5 is saving up (儲錢); cyu5 is the storage sense the SOP uses
     (儲存間). rime lists 儲錢 cou5cin2 against 儲存 cyu5cyun4. */
  '儲':['cou5','cyu5'],
  /* 件 is gin6 as a classifier (一件衫, 兩件) and takes the changed tone gin2
     as the second syllable of a noun compound — 文件, 零件, both listed that
     way first in rime. 調 is diu6 to switch (調轉) and tiu4 in 空調. */
  '件':['gin6','gin2'], '調':['diu6','tiu4'],
  /* 惡 is ok3 for the fierce/awful sense (惡劣, 兇惡) and wu3 for the hating
     sense in 交惡, to fall out with someone. rime lists both readings for the
     character and gives 交惡 under both, so wu3 is a choice, not a slip. */
  '惡':['ok3','wu3'],
  /* 淡 is taam5 in speech for bland or watery (餸好淡, 茶太淡) and daam6 in
     the compounds that come off paper — 淡季, 冷淡. rime lists daam6, taam4
     and taam5 for the character and 淡季 only as daam6gwai3. */
  '淡':['taam5','daam6'],
  /* 願 is jyun6 as a noun (心願, 願望) and takes the changed tone jyun2 inside
     寧願, which rime lists both ways (ning4jyun2 / ning4jyun6) and the corpus
     records both. Lesson 35 was there first with jyun2. */
  '願':['jyun6','jyun2'],
  /* 卡 is kaat1 for a card (卡片, 嘟卡) and kaa1 in transliterations that came
     in through the syllable rather than the word — 卡路里, 卡通. rime lists
     卡片 kaat1pin2 against 卡路里 kaa1lou6lei5; the corpus records both. */
  '卡':['kaat1','kaa1'],
  /* 難 is naan4 for difficult (困難, 難食, 難得) and naan6 for a disaster
     (空難, 災難, 難民). rime lists both; the corpus records both. Two senses,
     two readings, and the tone is the only thing telling them apart. */
  '難':['naan4','naan6'],
  /* 樓 is lau4 for a building or a floor (樓下, 三樓) and takes the changed
     tone lau2 for a flat you would buy or view — 睇樓 tai2lau2, both listed
     that way in rime. */
  '樓':['lau4','lau2'],
  /* 爸 is baa4 in 阿爸 and as the first syllable of 爸爸, whose SECOND syllable
     is baa1 — rime gives 爸爸 baa4baa1 and 阿爸 aa3baa4. One word, two tones. */
  '爸':['baa4','baa1'],
  /* 斷 is tyun5 for the physical break (斷咗, 斷開) and dyun6 in the bound
     compounds that mean interrupt or cease — 不斷 bat1dyun6, 中斷. rime lists
     dyun3, dyun6 and tyun5; the corpus records all three. */
  '斷':['tyun5','dyun6','dyun3'],
  /* 哥 is go1 on its own (大哥) and 哥哥 is go4go1 — the FIRST syllable drops to
     the low tone in the doubling, which rime lists explicitly alongside
     go1go1. The same shape as 爸爸 baa4baa1. */
  '哥':['go1','go4'],
  /* 牌 is paai4 for a sign or a brand (招牌) and takes the changed tone paai2
     for the thing you read or hold — 菜牌 coi3paai2 (a menu), 打牌 daa2paai2.
     rime lists both compounds that way. */
  '牌':['paai4','paai2'],
  /* 檸 is ning4 written out (檸檬茶 ning4mung1caa4) and ning2 in the short form
     everyone actually orders — rime gives 檸茶 as ning2caa4. The changed tone
     IS the tell that you are saying it the local way. l- is the lazy initial
     for both, which is why the corpus records ling-. */
  '檸':['ning4','ning2'],
  /* 勝 is sing3 for winning (勝利) and sing1 in 勝任, to be equal to a job —
     rime lists 勝任 sing1jam6 against 勝利 sing3lei6. */
  '勝':['sing3','sing1'],
  /* 奶 is naai5 for the milk (牛奶 ngau4naai5, 奶茶 naai5caa4) and naai1 in
     師奶, the housewife — rime lists 師奶 si1naai1 against 牛奶 ngau4naai5, and
     gives naai4 as well for 奶奶 naai4naai2, a husband's mother. */
  '奶':['naai5','naai1','naai4'],
};
const readMap = {};
const notePair = (v,p)=>{
  if(!v||!p||!/\s/.test(p)) return;
  const PU=/[，,。.？?！!、；;：:\s“”‘’…—()（）]/;
  const chars=[...v].filter(c=>!PU.test(c));
  const syl=p.replace(/[，,。.？?！!、；;：:“”‘’…—()（）]/g,' ').trim().split(/\s+/);
  if(syl.length!==chars.length) return;
  chars.forEach((ch,i)=>{ if(/[㐀-鿿]/.test(ch)){ (readMap[ch]=readMap[ch]||{})[syl[i]]=(readMap[ch][syl[i]]||0)+1; } });
};
activeLessons().forEach(l=>{
  (l.cards||[]).forEach(c=>notePair(c.v,c.p));
  (l.dialogue||[]).forEach(d=>notePair(d.v,d.p));
  (l.vocab||[]).forEach(v=>notePair(v.v,v.p));
});
activePacks().forEach(pk=>pk.cards.forEach(c=>notePair(c.v,c.p)));
Object.entries(activeSosPhrases()).forEach(([,a])=>a.forEach(c=>notePair(c.v,c.p)));
slangVocab().forEach(w=>notePair(w.word,w.p));
slangPhrases().forEach(c=>notePair(c.v,c.p));
facilityVocab().forEach(w=>notePair(w.word,w.p));
const splits = [];
Object.entries(readMap).forEach(([ch,c])=>{
  const rs = Object.keys(c);
  if(rs.length<2) return;
  const allowed = TWO_WAY[ch];
  if(allowed && rs.every(r=>allowed.indexOf(r)!==-1)) return;
  splits.push(ch+': '+rs.map(r=>r+' x'+c[r]).join(', '));
});
ok('no character is romanised two ways by accident', splits.length===0, splits.slice(0,6));
ok('嚟 has settled on one reading',
   Object.keys(readMap['嚟']||{}).join()==='lei4', readMap['嚟']);
ok('the reading check actually looked at the course',
   Object.keys(readMap).length>900, Object.keys(readMap).length);

/* Opening a level is three separate edits — unlock it, write its sections, and
   register those sections in the by-level map. Miss the third and the level
   renders with no sections at all, which looks like an empty course rather
   than a bug. So check the three agree with what the lessons actually claim. */
selectLanguage('yue');
const lv = CANTONESE_LEVELS;
const openLevels = lv.filter(x=>x.unlocked).map(x=>x.num);
ok('B2 is open', openLevels.indexOf('B2')!==-1, openLevels);
ok('every open level is named', lv.every(x=>!x.unlocked || (x.name && x.name.length>2)));
ok('every locked level stays unnamed', lv.every(x=>x.unlocked || !x.name));
const claimed = [...new Set(activeLessons().map(l=>l.level))];
ok('no lesson sits on a locked level',
   claimed.every(n=>openLevels.indexOf(n)!==-1), claimed);
ok('no open level is empty of lessons',
   openLevels.every(n=>activeLessons().some(l=>l.level===n)),
   openLevels.filter(n=>!activeLessons().some(l=>l.level===n)));
/* the by-level map is declared inside the render function, so reach it the
   way the screen does rather than by name */
const secLists = { A1:CANTONESE_A1_SECTIONS, A2:CANTONESE_A2_SECTIONS,
                   B1:CANTONESE_B1_SECTIONS, B2:CANTONESE_B2_SECTIONS,
                   C1:CANTONESE_C1_SECTIONS };
ok('every open level has a section list',
   openLevels.every(n=>Array.isArray(secLists[n]) && secLists[n].length>0), openLevels);
ok('every lesson section exists on its level',
   activeLessons().every(l=>(secLists[l.level]||[]).some(s=>s.id===l.section)),
   activeLessons().filter(l=>!(secLists[l.level]||[]).some(s=>s.id===l.section))
     .map(l=>l.id+' '+l.level+'/'+l.section).slice(0,5));
ok('a lesson tag matches its section title',
   activeLessons().every(l=>{
     const s = (secLists[l.level]||[]).find(x=>x.id===l.section);
     return !l.tag || !s || s.title===l.tag;
   }),
   activeLessons().filter(l=>{
     const s = (secLists[l.level]||[]).find(x=>x.id===l.section);
     return l.tag && s && s.title!==l.tag;
   }).map(l=>l.id+': '+l.tag).slice(0,5));
ok('lesson days run 1..n with no gaps',
   activeLessons().every((l,i)=>l.day===i+1),
   activeLessons().map(l=>l.day).filter((d,i)=>d!==i+1).slice(0,5));
ok('no duplicate lesson id',
   new Set(activeLessons().map(l=>l.id)).size===activeLessons().length);

/* Concept-lesson vocab is written as one string — '三點三 saam1 dim2 saam1' —
   not as {v,p}, so neither check_batch.py nor check_world.py can see it. The
   count of characters and syllables still has to line up, or the entry is
   teaching a reading it does not have. */
selectLanguage('yue');
const HANC = /[\u3400-\u9fff\uf900-\ufaff]/;
let cbad = [], centries = 0;
CONCEPT_LESSONS_YUE.forEach(c => (c.blocks||[]).filter(b=>b.type==='vocab').forEach(b =>
  b.words.forEach(w => {
    const m = /^([^\sA-Za-z]+)\s+([a-z0-9 ]+)$/.exec(w.v);
    if(!m) return;                       // prose entries like '我 ngo5 → o5' are fine
    centries++;
    const chars = [...m[1]].filter(ch => HANC.test(ch));
    const syl = m[2].split(/\s+/).filter(Boolean);
    if(chars.length !== syl.length) cbad.push(c.id+': '+w.v);
  })));
ok('concept vocab syllable counts line up', cbad.length===0, cbad.slice(0,4));
ok('the concept check actually looked at something', centries >= 25, centries);
ok('numbers are taught before the day counts need them',
   CONCEPT_LESSONS_YUE.find(c=>c.id==='yue_c4').afterDay < 15);

/* ---- every word taught has to be SAID somewhere ----
   A vocab entry with no sentence anywhere is a word you can read a gloss for
   and never hear: audio ids come from cards, dialogue, packs and personas, not
   from vocab lists, so an uncovered word gets no recording and no context.
   This is the bug the numbers audit found (個八 sat in FACILITY_VOCAB with no
   sentence using it) and it silently reappears whenever a lesson has 18 vocab
   and only four cards. Lessons 1-85 sit at ~9%, which is the inherited state;
   everything written since is held at zero. */
const sentences = (()=>{
  let s = '';
  LESSONS_YUE.forEach(l=>{
    (l.cards||[]).forEach(c=>s += c.v + '|');
    (l.dialogue||[]).forEach(d=>s += d.v + '|');
  });
  PACKS_YUE.forEach(pk=>pk.cards.forEach(c=>s += c.v + '|'));
  Object.values(CHAT_PERSONAS_YUE).forEach(a=>a.forEach(per=>{
    s += per.opener.v + '|';
    (per.turns||[]).forEach(t=>{
      (t.youOptions||[]).forEach(o=>s += o.v + '|');
      if(t.them) s += t.them.v + '|';
    });
  }));
  return s;
})();
const uncovered = day0 => {
  const out = [];
  LESSONS_YUE.filter(l=>l.day >= day0).forEach(l=>
    (l.vocab||[]).forEach(v=>{ if(!sentences.includes(v.v)) out.push(l.day+' '+v.v); }));
  return out;
};
const NEW_FROM = 86;   // B2 section III onward — everything written since the spine ended
ok('every word taught since lesson '+NEW_FROM+' is used in a sentence',
   uncovered(NEW_FROM).length === 0, uncovered(NEW_FROM).slice(0,8));
const allWords = LESSONS_YUE.reduce((a,l)=>a + (l.vocab||[]).length, 0);
ok('the course-wide uncovered rate has not got worse',
   uncovered(1).length / allWords < 0.10,
   (100*uncovered(1).length/allWords).toFixed(1)+'% of '+allWords);
ok('the sentence check actually looked at the course', sentences.length > 15000, sentences.length);


/* ---- C1 is a change of content type, not a longer word list ----
   The whole argument for C1 (see the comment above yue_l115) is that the
   frequency spine ran out and what replaces it is LONGER TURNS, not rarer
   words. If a later batch quietly goes back to trading four short lines,
   C1 has become B2 with a different label and nobody would notice. So the
   defining property is asserted, not just intended. */
{
  selectLanguage('yue');
  const L = activeLessons();
  const syl = d => d.p.split(/\s+/).filter(Boolean).length;
  const c1 = L.filter(l=>l.level==='C1');
  const b2 = L.filter(l=>l.level==='B2');
  const turns = ls => [].concat(...ls.map(l=>l.dialogue.map(syl)));
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;

  ok('C1 has lessons', c1.length>0, c1.length);
  ok('every C1 lesson carries at least one long turn',
     c1.every(l=>l.dialogue.some(d=>syl(d)>=40)),
     c1.filter(l=>!l.dialogue.some(d=>syl(d)>=40)).map(l=>l.id));
  ok('C1 turns are at least twice as long as B2 on average',
     avg(turns(c1)) >= 2*avg(turns(b2)),
     Math.round(avg(turns(c1)))+' vs '+Math.round(avg(turns(b2))));
  ok('C1 dialogues run longer than four lines',
     c1.every(l=>l.dialogue.length>4), c1.filter(l=>l.dialogue.length<=4).map(l=>l.id));
  ok('at least one C1 lesson puts three people in the room',
     c1.some(l=>new Set(l.dialogue.map(d=>d.speaker)).size>=3),
     c1.map(l=>l.id+':'+new Set(l.dialogue.map(d=>d.speaker)).size));
  // The reason vocab drops to 12 is that it is discourse machinery, which
  // does not come in eighteens. Guard the floor, not the exact number.
  ok('C1 vocab sets are deliberate, not padded and not thin',
     c1.every(l=>l.vocab.length>=10 && l.vocab.length<=14),
     c1.map(l=>l.id+':'+l.vocab.length));
}

console.log(`\n${p} passed, ${f} failed`);
process.exit(f?1:0);
