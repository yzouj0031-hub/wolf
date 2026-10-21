// 真的把学习语料的迁移链跑一遍：本机有 PostgreSQL（initdb）才跑，没有就跳过。
// 桩掉 Supabase 的 auth schema 和 anon / authenticated 角色，依次执行
// match_feedback → feedback_inbox → learning_corpus，再探一下约束。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';

const bins = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/17/bin', '/usr/local/pgsql/bin', '/opt/homebrew/opt/postgresql@16/bin'];
const bin = bins.find(d => fs.existsSync(path.join(d, 'initdb')));
if (!bin) { console.log('learning-corpus sql: 本机没有 PostgreSQL，跳过'); process.exit(0); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wolf-pg-'));
const asNobody = process.getuid && process.getuid() === 0;   // initdb 不肯以 root 跑
if (asNobody) { fs.chmodSync(dir, 0o777); try { fs.chmodSync(os.tmpdir(), 0o1777); } catch (_) {} }
const run = (cmd, args, opts = {}) => asNobody
  ? spawnSync('su', ['-s', '/bin/bash', 'nobody', '-c', [cmd, ...args].map(a => `'${String(a).replace(/'/g, `'\\''`)}'`).join(' ')], {encoding: 'utf8', ...opts})
  : spawnSync(cmd, args, {encoding: 'utf8', ...opts});
const port = 54000 + Math.floor(Math.random() * 1000);
const psql = (args, input) => spawnSync('psql', ['-h', dir, '-p', String(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', ...args], {encoding: 'utf8', input});

const init = run(path.join(bin, 'initdb'), ['-D', path.join(dir, 'data'), '-A', 'trust', '-U', 'postgres']);
if (init.status !== 0) { console.log('learning-corpus sql: initdb 跑不起来，跳过：' + (init.stderr || '').trim().split('\n').pop()); process.exit(0); }
const start = run(path.join(bin, 'pg_ctl'), ['-D', path.join(dir, 'data'), '-o', `-k ${dir} -p ${port} -c listen_addresses=`, '-l', path.join(dir, 'log'), '-w', 'start']);
try {
  assert.equal(start.status, 0, 'pg_ctl start 失败：' + start.stderr);
  const stub = `create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;`;
  assert.equal(psql(['-c', 'create database wolf']).status, 0);
  const ok = (label, r) => assert.equal(r.status, 0, `${label} 失败：\n${(r.stderr || '').split('\n').filter(l => !/NOTICE/.test(l)).join('\n')}`);
  ok('auth 桩', psql(['-d', 'wolf'], stub));
  for (const f of ['supabase/migrations/20260818_match_feedback.sql', 'supabase/migrations/20260818_feedback_inbox.sql', 'supabase/migrations/20261020_learning_corpus.sql']) ok(f, psql(['-d', 'wolf', '-f', f]));
  const sub = '11111111-1111-1111-1111-111111111111';
  const good = '这局 P1 首夜验出 P6 是狼，天亮直接报查杀，P6 没对跳只说自己是好人，白天票就把 P6 放逐了。';
  ok('插入对局', psql(['-d', 'wolf', '-c', `insert into public.learning_matches(client_submission_id, player_count, snapshot) values ('${sub}', 6, '{}'::jsonb)`]));
  ok('插入合法案例', psql(['-d', 'wolf', '-c', `insert into public.learning_cases(source_submission_id, text, needs) values ('${sub}', '${good}', '{seer,villager}')`]));
  const badNeeds = psql(['-d', 'wolf', '-c', `insert into public.learning_cases(source_submission_id, text, needs) values ('${sub}', '${good}', '{seer,hacker}')`]);
  assert.match(badNeeds.stderr, /violates check constraint/, '不在白名单里的角色应被拒');
  const jargon = psql(['-d', 'wolf', '-c', `insert into public.learning_cases(source_submission_id, text) values ('${sub}', '这局 P1 首夜验出 P6 是狼，名义刀口落在 P3，天亮直接报查杀，白天票就把 P6 放逐了，全程没有人对跳。')`]);
  assert.match(jargon.stderr, /violates check constraint/, '带规则书术语的案例应被拒');
  const dup = psql(['-d', 'wolf', '-c', `insert into public.learning_cases(source_submission_id, text) values ('${sub}', '${good}第二条。')`]);
  assert.match(dup.stderr, /learning_cases_one_auto_per_match/, '一局只能有一条自动案例');
  console.log('learning-corpus sql: 迁移链在本机 PostgreSQL 上跑通，约束按预期拒绝坏数据');
} finally {
  run(path.join(bin, 'pg_ctl'), ['-D', path.join(dir, 'data'), '-m', 'immediate', 'stop']);
  try { execFileSync('rm', ['-rf', dir]); } catch (_) {}
}
