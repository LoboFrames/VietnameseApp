#!/usr/bin/env node
/* Maps HyperTTS output onto LaiLingo's audio ids.

   HyperTTS names what it generates hypertts-<hash>.mp3, where the hash comes
   from the text and the voice settings. The app looks its audio up by id —
   audio/male/lesson_vi2_l73_d0.mp3 — so the generated files have to be copied
   into place under the right names. That is all this does.

   Run it after HyperTTS has filled the Audio field and you have exported the
   deck again (Notes in Plain Text, include the ID and Audio columns):

     node rename_hypertts.js <export.txt> <collection.media> <audio/male>

   On a Mac collection.media is usually:
     ~/Library/Application Support/Anki2/<Profile>/collection.media

   Files are COPIED, never moved, so the Anki collection is left intact — and
   because identical sentences share one generated file, one source can be
   copied to several destination ids. Nothing is overwritten unless --force. */
const fs = require('fs'), path = require('path');

const [exportPath, mediaDir, outDir] = process.argv.slice(2);
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');

if (!exportPath || !mediaDir || !outDir) {
  console.error('usage: node rename_hypertts.js <export.txt> <collection.media> <audio/male> [--dry-run] [--force]');
  process.exit(1);
}

const lines = fs.readFileSync(exportPath, 'utf8').split(/\r?\n/);
/* Anki's own export writes #-prefixed header lines; a file that came straight
   back out of a spreadsheet may not have them. Either way, skip them. */
const rows = lines.filter(l => l.trim() && !l.startsWith('#')).map(l => l.split('\t'));

const SOUND = /\[sound:([^\]]+)\]/;
const ID = /^(lesson|word|wordex|pack|chat|sos|core|cphrase|nvocab|nphrase|concept|slang|slangp|text|textp)_/;

let copied = 0, already = 0, noSound = 0, missingSrc = 0, noId = 0;
const missing = [];

rows.forEach(cols => {
  const id = cols.find(c => ID.test(String(c).trim()));
  const soundCell = cols.find(c => SOUND.test(String(c)));
  if (!id) { noId++; return; }
  if (!soundCell) { noSound++; missing.push(id.trim() + '  (no audio in the export)'); return; }

  const file = soundCell.match(SOUND)[1].trim();
  const src = path.join(mediaDir, file);
  const dst = path.join(outDir, id.trim() + '.mp3');

  if (!fs.existsSync(src)) { missingSrc++; missing.push(id.trim() + '  (' + file + ' not in collection.media)'); return; }
  if (fs.existsSync(dst) && !FORCE) { already++; return; }
  if (!DRY) fs.copyFileSync(src, dst);
  copied++;
});

console.log((DRY ? 'DRY RUN — nothing written' : 'done'));
console.log('  copied into place        :', copied);
console.log('  already there (skipped)  :', already, FORCE ? '' : '(pass --force to overwrite)');
console.log('  rows with no audio yet   :', noSound);
console.log('  audio named but not found:', missingSrc);
console.log('  rows with no LaiLingo id :', noId);
if (missing.length) {
  console.log('\nnot copied:');
  missing.slice(0, 40).forEach(m => console.log('   ' + m));
  if (missing.length > 40) console.log('   … and ' + (missing.length - 40) + ' more');
}
