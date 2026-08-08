import fs from 'node:fs';
import vm from 'node:vm';

const guard = fs.readFileSync('exit-guard.js','utf8');
const css = fs.readFileSync('exit-guard.css','utf8');
const root = fs.readFileSync('index.html','utf8');
const english = fs.readFileSync('en/index.html','utf8');
const mystery = fs.readFileSync('mystery.js','utf8');
const multiplayer = fs.readFileSync('multiplayer.js','utf8');
const build = fs.readFileSync('scripts/build-www.mjs','utf8');

function has(source,needle,label) {
  if (!source.includes(needle)) throw new Error(`missing ${label}: ${needle}`);
}

new vm.Script(guard,{filename:'exit-guard.js'});
for (const feature of ['beforeunload','popstate','visibilitychange','backButton','pushState','Save and exit','保存并退出']) {
  has(guard,feature,`guard feature ${feature}`);
}
for (const source of [root,english]) {
  has(source,'exit-guard.js','guard script include');
  has(source,'exit-guard.css','guard style include');
  has(source,"register('werewolf-game'",'live match registration');
  has(source,"register('group-chat'",'group chat registration');
  has(source,"register('match-replay'",'replay registration');
}
has(mystery,"register('murder-mystery'",'murder mystery registration');
has(multiplayer,"register('online-room'",'online room registration');
has(css,'.wg-exit-guard.show','custom confirmation visibility');
has(css,'touch-action:none','gesture blocking while confirmation is open');
for (const asset of ["'exit-guard.js'","'exit-guard.css'"]) has(build,asset,`packaged asset ${asset}`);

console.log('exit guard: live matches, replay, group chat, mystery and online room are protected');
