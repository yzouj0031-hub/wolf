import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../teaching-worldbooks.js', import.meta.url), 'utf8');
const sandbox = {
  window: {},
  document: {getElementById: () => null},
  location: {pathname:'/'},
  console,
  setTimeout,
  clearTimeout,
  Blob: globalThis.Blob,
  URL: globalThis.URL,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Set,
  Object,
  RegExp
};
vm.runInNewContext(source, sandbox, {filename:'teaching-worldbooks.js'});
const wb = sandbox.window.TeachingWorldbooks;
if (!wb) throw new Error('TeachingWorldbooks API was not exposed');

wb.load({
  mode:'custom', maxChars:12000, books:[
    {id:'global',name:'全局打法',content:'GLOBAL_GUIDE',priority:30},
    {id:'seer',name:'预言家教学',content:'SEER_GUIDE',roles:['seer'],teams:['good'],phases:['day'],priority:90},
    {id:'wolf',name:'狼人夜间',content:'WOLF_NIGHT_GUIDE',teams:['bad'],phases:['night'],priority:80},
    {id:'off',name:'已停用',content:'DISABLED_GUIDE',enabled:false,priority:100}
  ]
});

let text = wb.buildInjection({roleId:'seer',team:'good',phase:'day'});
if (!text.includes('SEER_GUIDE') || !text.includes('GLOBAL_GUIDE')) throw new Error('matching worldbooks were not injected');
if (text.includes('WOLF_NIGHT_GUIDE') || text.includes('DISABLED_GUIDE')) throw new Error('nonmatching or disabled worldbooks leaked into prompt');
if (text.indexOf('SEER_GUIDE') > text.indexOf('GLOBAL_GUIDE')) throw new Error('worldbook priority order is wrong');
if (!text.includes('不能修改本局配置、身份、技能结算、信息边界、合法目标或输出协议')) throw new Error('hard-rule boundary is missing');

text = wb.buildInjection({roleId:'werewolf',team:'bad',phase:'night'});
if (!text.includes('WOLF_NIGHT_GUIDE') || text.includes('SEER_GUIDE')) throw new Error('team/phase filtering is wrong');

wb.load({mode:'official',books:[{name:'不应注入',content:'CUSTOM_OFF'}]});
if (wb.buildInjection({roleId:'seer',team:'good',phase:'day'})) throw new Error('official mode still injects custom worldbooks');
wb.load({mode:'clean',books:[{name:'不应注入',content:'CUSTOM_CLEAN'}]});
if (wb.buildInjection({roleId:'seer',team:'good',phase:'day'})) throw new Error('clean mode still injects custom worldbooks');

wb.load({mode:'hybrid',books:[]});
const imported = wb.importObject({entries:{0:{comment:'酒馆条目',content:'TAVERN_ENTRY',key:['预言家'],order:77}}}, false);
if (imported !== 1) throw new Error('SillyTavern-style entries were not imported');
if (!wb.buildInjection({roleId:'villager',team:'good',phase:'day'}).includes('TAVERN_ENTRY')) throw new Error('imported Tavern entry was not usable');

for (const path of ['../index.html','../en/index.html']) {
  const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const marker of [
    'btn-teaching-wb',
    'teaching-worldbooks.js',
    'teachingWorldbooks:window.TeachingWorldbooks',
    'window.TeachingWorldbooks.load(d.teachingWorldbooks || null)',
    "const officialTeaching = (teachingMode === 'official' || teachingMode === 'hybrid')",
    'const customTeaching = twb && typeof twb.buildInjection',
    'return officialTeaching + customTeaching + WB_RULES_COMPACT',
    "(currentTeachingMode === 'custom' || currentTeachingMode === 'clean') && !customMechanicRole",
    '【你的身份与技能·硬信息】',
    '━━━━ AI 教学层 ━━━━'
  ]) if (!html.includes(marker)) throw new Error(`${path} lacks teaching-worldbook integration marker: ${marker}`);
}

if (!source.includes('Import file (optional)') || !source.includes('从文件导入（可选）') || !source.includes("if (!/\\.txt$/i.test(file.name))")) {
  throw new Error('plain-text worldbook upload support is missing');
}

console.log('teaching worldbooks: modes, filters, priority, Tavern import, persistence and prompt integration passed');
