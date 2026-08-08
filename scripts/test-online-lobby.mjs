import fs from 'node:fs';
import vm from 'node:vm';

const root = fs.readFileSync('index.html','utf8');
const english = fs.readFileSync('en/index.html','utf8');
const client = fs.readFileSync('multiplayer.js','utf8');
const css = fs.readFileSync('multiplayer.css','utf8');
const sql = fs.readFileSync('supabase/migrations/20260808_online_lobby.sql','utf8');
const build = fs.readFileSync('scripts/build-www.mjs','utf8');

function has(source,needle,label) {
  if (!source.includes(needle)) throw new Error(`missing ${label}: ${needle}`);
}

new vm.Script(client,{filename:'multiplayer.js'});
has(root,'./multiplayer.js','Chinese multiplayer client');
has(root,'./multiplayer.css','Chinese multiplayer styles');
has(english,'../multiplayer.js','English multiplayer client');
has(english,'../multiplayer.css','English multiplayer styles');
for (const source of [root,english]) {
  has(source,'getClient: () => client','safe Supabase client accessor');
  has(source,'getUser: () => user','current-user accessor');
}
for (const asset of ["'multiplayer.js'","'multiplayer.css'"]) has(build,asset,`packaged asset ${asset}`);

for (const table of ['online_rooms','online_room_members','online_room_messages']) {
  has(sql,`public.${table}`,`table ${table}`);
  has(sql,`alter table public.${table} enable row level security`,`RLS ${table}`);
}
for (const rpc of ['online_create_room','online_join_room','online_update_member','online_touch_room','online_start_room','online_leave_room']) {
  has(sql,`function public.${rpc}`,`RPC ${rpc}`);
  has(sql,`grant execute on function public.${rpc}`,`authenticated grant ${rpc}`);
}
has(sql,"and kind = 'chat'",'clients cannot spoof system messages');
has(sql,'sender_id = auth.uid()','message sender ownership');
has(sql,'security definer','server-side command validation');
has(sql,'alter publication supabase_realtime add table','Realtime publication');

for (const feature of ['personal_ai','hosted_ai','last_seen_at','postgres_changes','sessionStorage','room_code']) has(client,feature,`client feature ${feature}`);
if (/service_role|sk-[A-Za-z0-9]/.test(client)) throw new Error('multiplayer client must not contain server or model secrets');
if (css.includes('url(')) throw new Error('online lobby CSS must not add a heavyweight image dependency');

console.log('online lobby: room RPCs, RLS, realtime client, bilingual UI and packaged assets passed');
