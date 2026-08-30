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
const snapshot = buildSnapshot({
  gameOver:true,mode:'customai',round:3,_winType:'good',gameId:'m1',sheriff:1,
  players:[{id:0,name:'A',alive:true,role:{id:'seer',name:'预言家',team:'good'}}]
},[
  {type:'system',text:'第1夜',prompt:'SECRET_PROMPT'},
  {type:'speech',name:'A',game:'公开发言',thinking:'PRIVATE_CHAIN',memory:'PRIVATE_MEMORY',apiKey:'SECRET_KEY'},
  {type:'night_action',name:'A',role:'seer',target:'B',text:'查验 B'}
],{0:{model:'gpt-test',key:'SECRET_KEY',url:'https://secret.example',persona:'PRIVATE_PERSONA'}},{customai:{name:'斗蛐蛐'}});

const serialized = JSON.stringify(snapshot);
assert.match(serialized,/公开发言/);
assert.match(serialized,/gpt-test/);
for(const secret of ['PRIVATE_CHAIN','PRIVATE_MEMORY','SECRET_KEY','SECRET_PROMPT','PRIVATE_PERSONA','secret.example']) assert.ok(!serialized.includes(secret),`snapshot leaked ${secret}`);
assert.deepEqual(Object.keys(snapshot.players[0]).sort(),['alive','deathCause','deathRound','id','model','name','role'].sort());
assert.ok(snapshot.events.every(event=>Object.keys(event).every(key=>['type','name','label','round','phase','text'].includes(key))),'event snapshot contains an unsafe field');
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

console.log('community match gallery: sanitized snapshots, moderated RLS and public UI passed');
