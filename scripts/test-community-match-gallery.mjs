import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js = fs.readFileSync('community-matches.js','utf8');
const sql = fs.readFileSync('supabase/migrations/20260831_community_match_gallery.sql','utf8');
const root = fs.readFileSync('index.html','utf8');
const english = fs.readFileSync('en/index.html','utf8');
const build = fs.readFileSync('scripts/build-www.mjs','utf8');
const sw = fs.readFileSync('sw.js','utf8');

const sandbox = {console,TextEncoder,location:{pathname:'/wolf/'}};
sandbox.globalThis = sandbox;
vm.runInNewContext(js,sandbox,{filename:'community-matches.js'});
const buildSnapshot = sandbox.CommunityMatches._test.buildSnapshot;
const buildChapters = sandbox.CommunityMatches._test.buildChapters;
const deriveBoardState = sandbox.CommunityMatches._test.deriveBoardState;
const snapshot = buildSnapshot({
  gameOver:true,mode:'customai',round:3,_winType:'good',gameId:'m1',sheriff:1,
  players:[
    {id:0,name:'A',alive:true,role:{id:'seer',name:'预言家',team:'good'}},
    {id:1,name:'B',alive:false,deathRound:1,role:{id:'werewolf',name:'狼人',team:'wolf'}}
  ]
},[
  {type:'system',text:'第1夜',prompt:'SECRET_PROMPT'},
  {type:'speech',name:'A',game:'公开发言',thinking:'PRIVATE_CHAIN',memory:'PRIVATE_MEMORY',apiKey:'SECRET_KEY'},
  {type:'night_action',name:'A',role:'seer',target:'B',actualTarget:'B',text:'查验 B',thinking:'PRIVATE_CHAIN'},
  {type:'death',name:'B',round:1,phase:'day',cause:'exile',team:'wolf',text:'B 出局'},
  {type:'vote',subtype:'day',round:1,phase:'vote',votes:{B:['A']},abstains:[],result:'B',text:'B 被放逐'}
],{0:{model:'gpt-test',key:'SECRET_KEY',url:'https://secret.example',persona:'PRIVATE_PERSONA'}},{customai:{name:'斗蛐蛐'}});

const serialized = JSON.stringify(snapshot);
assert.match(serialized,/公开发言/);
assert.match(serialized,/gpt-test/);
for(const secret of ['PRIVATE_CHAIN','PRIVATE_MEMORY','SECRET_KEY','SECRET_PROMPT','PRIVATE_PERSONA','secret.example']) assert.ok(!serialized.includes(secret),`snapshot leaked ${secret}`);
assert.deepEqual(Object.keys(snapshot.players[0]).sort(),['alive','deathCause','deathRound','id','model','name','role'].sort());
assert.equal(snapshot.version,2);
assert.ok(snapshot.events.every(event=>Object.keys(event).every(key=>['type','name','label','round','phase','text','data'].includes(key))),'event snapshot contains an unsafe field');
assert.equal(snapshot.events.find(event=>event.type==='night_action').data.actualTarget,'B');
assert.equal(JSON.stringify(snapshot.events.find(event=>event.type==='vote').data.votes),JSON.stringify({B:['A']}));
const chapters=buildChapters(snapshot.events);
const board=deriveBoardState(snapshot,chapters,chapters.length-1);
assert.equal(board.alive.get('b'),false);
assert.equal(board.counts.alive,1);
assert.equal(board.counts.wolf,0);
assert.match(sandbox.CommunityMatches._test.randomUuid(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

for(const html of [root,english]){
  assert.match(html,/id="community-gallery-open"/);
  assert.match(html,/id="pg-community-submit"/);
  assert.match(html,/community-matches\.js/);
}
assert.match(build,/'community-matches\.js'/);
assert.match(sw,/'\.\/community-matches\.js'/);
assert.match(sql,/alter table public\.community_matches enable row level security/i);
assert.match(sql,/using \(status = 'published'\)/i);
assert.match(sql,/status = 'pending' and published_at is null/i);
assert.match(sql,/using \(public\.is_feedback_admin\(\)\)/i);
assert.match(sql,/octet_length\(replay_data::text\) <= 1000000/i);
assert.match(sql,/octet_length\(array_to_string\(roles,''\)\) <= 3000/i);
assert.doesNotMatch(sql,/grant\s+(?:all|update|delete).*to\s+anon/i);
assert.match(js,/\.from\(TABLE\)\.select\([^\n]+\)\.eq\('status','published'\)/);
assert.match(js,/\.from\(TABLE\)\.insert\(payload\)/);
assert.match(js,/status:'pending'/);
assert.doesNotMatch(js,/innerHTML\s*=\s*row\./);
assert.match(js,/cm-observer-grid/,'观战详情不是上帝视角复盘布局');
assert.match(js,/cm-state-stats/,'观战详情缺少常驻存活局势');
assert.match(js,/cm-resolution-pane/,'观战详情缺少阶段结算区');
assert.match(js,/function buildChapters/,'观战详情没有按完整阶段整理事件');
assert.match(js,/function deriveBoardState/,'观战详情不能重建历史场上状态');
assert.match(js,/cm-phase-tab/,'观战详情缺少阶段导航');
assert.match(js,/cm-vote-bar/,'观战详情缺少结构化票型');
assert.match(js,/assets\/action-cg\//,'观战复盘没有复用行动 CG');
assert.match(js,/icons\/roles\//,'观战复盘没有复用角色立绘');
assert.match(js,/classList\.remove\('theater-mode'\)/,'离开观战后没有恢复普通殿堂宽度');

console.log('community match gallery: sanitized snapshots, moderated RLS and public UI passed');
