import fs from 'node:fs';

function nightBlock(path) {
  const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const start = html.indexOf('  async night() {');
  const end = html.indexOf('  async sheriff()', start);
  if (start < 0 || end < 0) throw new Error(`Night handler missing in ${path}`);
  return html.slice(start, end);
}

for (const path of ['../index.html', '../en/index.html']) {
  const block = nightBlock(path);
  for (const required of [
    'const nightKey =',
    'const resuming =',
    'S._nightRun = {key:nightKey, done:[], complete:false}',
    'const nightStep = async',
    "nightStep('guard'",
    "nightStep('wolf-kill'",
    "nightStep('witch'",
    "nightStep('seer'",
    "nightStep('resolve'"
  ]) {
    if (!block.includes(required)) throw new Error(`${path} lacks checkpoint marker: ${required}`);
  }

  const bypasses = block.split(/\r?\n/).filter(line =>
    /await\s+NightActions\./.test(line) && !/nightStep\(/.test(line)
  );
  if (bypasses.length) throw new Error(`${path} bypasses checkpoint:\n${bypasses.join('\n')}`);

  const keys = [...block.matchAll(/nightStep\('([^']+)'/g)].map(match => match[1]);
  if (keys.length < 20) throw new Error(`${path} unexpectedly has only ${keys.length} checkpointed calls`);

  const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const marker of ['discussionFailed: true', '发言调用失败，已跳过本轮']) {
    if (!html.includes(marker)) throw new Error(`${path} lacks wolf-discussion recovery marker: ${marker}`);
  }
}

for (const path of ['../index.html', '../en/index.html']) {
  const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const marker of [
    '_wolfKillRun',
    'wolfRun.openingDone.includes',
    'wolfRun.echoDone.includes',
    'wolfRun.phase2Required',
    'Object.prototype.hasOwnProperty.call(wolfLastActions, w.id)',
    'wolfRun.complete = true'
  ]) {
    if (!html.includes(marker)) throw new Error(`${path} lacks wolf-discussion checkpoint marker: ${marker}`);
  }

  for (const marker of [
    "value:'__NO_PROPOSAL__'",
    "isOpening ? '狼队·本轮提议' : '狼队·回响立场'",
    "target = validWolfTargets.find(x => String(x.id) === String(proposal)) || null",
    '系统会继续讨论'
  ]) {
    if (!html.includes(marker)) throw new Error(`${path} lacks structured human wolf-proposal marker: ${marker}`);
  }

  if (/从失败步骤恢复|resume at the failed step/.test(html)) {
    throw new Error(`${path} still labels a resumable interruption as a failed step`);
  }
}

console.log('night resume: both clients checkpoint night actions and wolf discussion substeps');
