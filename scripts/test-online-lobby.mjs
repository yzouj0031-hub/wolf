import fs from 'node:fs';
import vm from 'node:vm';

const root = fs.readFileSync('index.html','utf8');
const english = fs.readFileSync('en/index.html','utf8');
const client = fs.readFileSync('multiplayer.js','utf8');
const css = fs.readFileSync('multiplayer.css','utf8');
const sql = fs.readFileSync('supabase/migrations/20260808_online_lobby.sql','utf8');
const hotfix = fs.readFileSync('supabase/hotfixes/20260809_online_room_ambiguity.sql','utf8');
const multiSeat = fs.readFileSync('supabase/migrations/20260809_multi_key_seats.sql','utf8');
const build = fs.readFileSync('scripts/build-www.mjs','utf8');
const packageJson = fs.readFileSync('package.json','utf8');

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
has(sql,"returns jsonb",'unambiguous room RPC response');
has(sql,"jsonb_build_object('room_id'",'stable room response keys');
has(hotfix,'drop function if exists public.online_create_room','deployed create-room replacement');
has(hotfix,'drop function if exists public.online_join_room','deployed join-room replacement');
has(hotfix,'from public.online_room_members as m','qualified hotfix columns');
for (const field of ['fill_mode','can_host_ai','max_ai_seats','request_mode']) has(multiSeat,field,`multi-seat field ${field}`);
has(multiSeat,'create table if not exists public.online_room_ai_seats','generated AI seats');
has(multiSeat,'online_update_provider','provider opt-in RPC');
has(multiSeat,'online_configure_ai_fill','host allocation RPC');
has(multiSeat,"p_fill_mode='host_fill'",'single-key host fill');
has(multiSeat,"p_fill_mode='wait'",'wait-for-players mode');
has(multiSeat,"m.max_ai_seats>coalesce(used.n,0)",'balanced capacity enforcement');
has(multiSeat,"v_total <> v_room.max_seats",'full-room start guard');
has(multiSeat,'alter publication supabase_realtime add table public.online_room_ai_seats','AI-seat realtime publication');

for (const feature of ['personal_ai','hosted_ai','last_seen_at','postgres_changes','localStorage','room_code','online_room_ai_seats','online_update_provider','online_configure_ai_fill','host_fill','balanced','beforeunload','popstate','visibilitychange','backButton','Return to room','返回进行中的房间']) has(client,feature,`client feature ${feature}`);
has(css,'overscroll-behavior:none','mobile overscroll protection');
has(css,'.wg-online-confirm','custom leave confirmation');
has(packageJson,'"@capacitor/app"','Android back-button plugin');
if (/service_role|sk-[A-Za-z0-9]/.test(client)) throw new Error('multiplayer client must not contain server or model secrets');
if (css.includes('url(')) throw new Error('online lobby CSS must not add a heavyweight image dependency');

console.log('online lobby: room RPCs, RLS, realtime client, bilingual UI and packaged assets passed');
