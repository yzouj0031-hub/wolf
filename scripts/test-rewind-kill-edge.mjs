import fs from 'node:fs';

const clients = ['index.html', 'en/index.html'];
const failures = [];
const expect = (ok, message) => { if (!ok) failures.push(message); };

for (const file of clients) {
  const src = fs.readFileSync(file, 'utf8');
  const saveStart = src.indexOf('function saveGame(options = {})');
  const saveEnd = src.indexOf('function loadGame(slotArg, opts)', saveStart);
  const loadEnd = src.indexOf('/* ================================================================', saveEnd + 1);
  expect(saveStart >= 0 && saveEnd > saveStart && loadEnd > saveEnd, `${file}: 无法定位存档/读档实现`);
  if (saveStart < 0 || saveEnd <= saveStart || loadEnd <= saveEnd) continue;

  const saveBlock = src.slice(saveStart, saveEnd);
  const loadBlock = src.slice(saveEnd, loadEnd);
  expect(saveBlock.includes('_initGodCount: S._initGodCount'), `${file}: 存档没有保存开局神职数`);
  expect(saveBlock.includes('_initVillagerCount: S._initVillagerCount'), `${file}: 存档没有保存开局村民数`);
  expect(loadBlock.includes('Number.isInteger(ss._initGodCount)'), `${file}: 读档没有校验并恢复开局神职数`);
  expect(loadBlock.includes('Number.isInteger(ss._initVillagerCount)'), `${file}: 读档没有校验并恢复开局村民数`);
  expect(loadBlock.includes("S.players.filter(p => p.role.team==='good' && p.role.id!=='villager').length"), `${file}: 旧存档没有按全体玩家重建神职数`);
  expect(loadBlock.includes("S.players.filter(p => p.role.team==='good' && p.role.id==='villager').length"), `${file}: 旧存档没有按全体玩家重建村民数`);
  expect(loadBlock.includes('const restoredWinner = !S.gameOver ? evalWinNow() : null'), `${file}: 读档后没有即时重新判断胜负`);
  expect(loadBlock.includes('checkEnd().catch'), `${file}: 读档达到终局时没有执行正式结算`);
}

if (failures.length) {
  console.error('回档屠边回归检查未通过：');
  failures.forEach(x => console.error('  ✗ ' + x));
  process.exit(1);
}

console.log(`回档屠边回归检查通过（${clients.length} 份客户端均保存、兼容恢复并即时补判）`);
