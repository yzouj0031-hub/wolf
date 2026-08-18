import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20260818_match_feedback.sql', 'utf8');
const inboxSql = fs.readFileSync('supabase/migrations/20260818_feedback_inbox.sql', 'utf8');
const fail = [];
const expect = (ok, message) => { if (!ok) fail.push(message); };

for (const id of ['pg-feedback','pg-feedback-rating','pg-feedback-tags','pg-feedback-text','pg-feedback-submit','pg-feedback-status']) {
  expect(html.includes(`id="${id}"`), `missing feedback UI: ${id}`);
}
expect(html.includes("const MatchFeedback = (() =>"), 'missing feedback controller');
expect(html.includes("client.from('match_feedback').insert(payload)"), 'feedback is not uploaded to Supabase');
expect(html.includes("wolf_match_feedback_queue_v1"), 'missing offline feedback queue');
expect(html.includes('尚未上传'), 'offline queue falsely looks like a successful upload');
expect(html.includes('window.MatchFeedback?.open?.()'), 'post-game panel does not initialize feedback');
for (const id of ['feedback-my-open','feedback-admin-open','o-feedback-inbox','feedback-inbox-list','feedback-inbox-filter']) {
  expect(html.includes(`id="${id}"`), `missing mobile feedback inbox UI: ${id}`);
}
expect(html.includes('wolf_match_feedback_history_v1'), 'successful feedback is not retained for My Feedback');
expect(html.includes("client.rpc('is_feedback_admin')"), 'developer inbox does not verify admin membership server-side');
expect(html.includes("client.from('match_feedback').select("), 'developer inbox cannot read cloud feedback');
expect(html.includes(".update({status:select.value"), 'developer cannot update feedback workflow status');

const metaStart = html.indexOf('function matchMeta()');
const metaEnd = html.indexOf('\n  function selectedTags()', metaStart);
const metaSource = html.slice(metaStart, metaEnd);
expect(metaStart >= 0 && metaEnd > metaStart, 'missing match metadata builder');
for (const forbidden of ['apiKey','API_KEY','gameRecord','memory','history','prompt']) {
  expect(!metaSource.includes(forbidden), `feedback metadata leaks ${forbidden}`);
}
for (const allowed of ['match_id','rounds','winner','player_count','roles','device','viewport']) {
  expect(metaSource.includes(allowed), `feedback diagnostics omit ${allowed}`);
}

expect(sql.includes('alter table public.match_feedback enable row level security'), 'feedback table has no RLS');
expect(sql.includes('grant insert on public.match_feedback to anon, authenticated'), 'players cannot insert feedback');
expect(!/grant\s+select\s+on\s+public\.match_feedback\s+to\s+anon/i.test(sql + inboxSql), 'anonymous players can read private feedback');
expect(sql.includes('char_length(comment) <= 2000'), 'feedback comment has no server-side size limit');
expect(sql.includes("categories <@ array['ai_reasoning','rules','ui','performance','art','other']"), 'feedback categories are not server-validated');
expect(inboxSql.includes('create table if not exists public.feedback_admins'), 'missing feedback administrator allowlist');
expect(inboxSql.includes('security definer') && inboxSql.includes('where a.user_id = auth.uid()'), 'admin check is not server-enforced');
expect(inboxSql.includes('using (public.is_feedback_admin())'), 'feedback read/update RLS does not require admin membership');
expect(inboxSql.includes("status in ('new','reviewing','resolved')"), 'feedback workflow status is not constrained');
expect(!inboxSql.includes('yzouj0031@gmail.com'), 'administrator email leaked into public migration');

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('match feedback: private upload, diagnostics and offline queue passed');
