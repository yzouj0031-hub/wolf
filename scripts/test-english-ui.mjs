import fs from 'node:fs';

const root = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const english = fs.readFileSync(new URL('../en/index.html', import.meta.url), 'utf8');
const uiIcons = fs.readFileSync(new URL('../ui-icons.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../en/i18n.js', import.meta.url), 'utf8');
const sigils = fs.readFileSync(new URL('../role-sigils.js', import.meta.url), 'utf8');

const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
};

for (const [source, label] of [[root, 'root client'], [english, 'English client']]) {
  requireText(source, 'const uiEnglish = () =>', `${label} language helper`);
  requireText(source, 'The game has not started. Finish the role setup', `${label} empty active-rules message`);
  requireText(source, "uiEnglish() ? '⚡ Autosave'", `${label} autosave label`);
  requireText(source, "uiEnglish() ? '💾 Save'", `${label} save button`);
  requireText(source, "uiEnglish() ? '🏆 Start voting'", `${label} MVP reset state`);
  requireText(source, '[WEREWOLF · COMPLETE OMNISCIENT RECORD]', `${label} English record export`);
  requireText(source, '[EVENT READING NOTE]', `${label} English event note`);
  requireText(source, '[Night ${r.round} · ${roleEmoji}]', `${label} English night-action export`);
  requireText(source, "uiEnglish() ? '⏪ Return here'", `${label} timeline button`);
  requireText(source, '— Full role and rules encyclopedia —', `${label} dynamic rulebook title`);
  requireText(source, 'window.RoleSigils.render(id)', `${label} role-card sigil renderer`);
  requireText(source, "window.RoleSigils.render(o.id, 'cr-role-sigil')", `${label} role-picker sigil renderer`);
  requireText(source, "window.RoleSigils.render(p.role.id, 'pov-role-sigil')", `${label} export-view role sigil renderer`);
  requireText(source, "function showRoleCinematic(roleId, actorName, title, subtitle", `${label} cinematic role overlay`);
  requireText(source, "showRoleCinematic('werewolf'", `${label} wolf-action cinematic`);
  requireText(source, "showRoleCinematic('knight'", `${label} knight-duel cinematic`);
  requireText(source, "showRoleCinematic(_isMechShooter ? 'mechwolf' : 'hunter'", `${label} hunter-shot cinematic`);
  requireText(source, 'Number.isFinite(parsed)', `${label} UI zoom validation`);
  requireText(source, 'localStorage.removeItem(\'uiZoom\')', `${label} invalid UI zoom cleanup`);
  requireText(source, 'Math.min(1,Math.max(0.62,z))', `${label} UI zoom safety clamp`);
  requireText(source, '━━ 信息边界·必须遵守 ━━', `${label} exported hard information boundary`);
  requireText(source, '━━ 推理建议·非强制 ━━', `${label} exported advisory reasoning section`);
  requireText(source, '自主采用、调整或拒绝这些建议', `${label} reasoning autonomy guidance`);
  requireText(source, '不得要求其他玩家遵循这些建议', `${label} non-enforcement guidance`);
  requireText(source, '(?:🌙|🐺|💀|💔|🌹|🏹|👹|👑|🔪|🔮|⚖️?|⚠️?|📊|📢|😅|🎤|🔄|👋)', `${label} allowlisted log-prefix cleanup`);
  requireText(source, "['night','death','sheriff','trial'].includes(type)", `${label} structural-only log cleanup guard`);
  requireText(source, "RoleSigils.render(pl.role.id,'log-role-sigil')", `${label} role sigil in setup log`);
  requireText(source, 'data-ui-icon="dice"', `${label} dice setup-log icon`);
  requireText(source, 'data-ui-icon="brain"', `${label} personality setup-log icon`);
  requireText(source, 'data-ui-icon="mask"', `${label} cosplay setup-log icon`);
  requireText(source, "{night:'moon',death:'skull',sheriff:'crown',trial:'gavel'}", `${label} semantic log icon map`);
  requireText(source, "mark.setAttribute('aria-hidden','true')", `${label} decorative log icons hidden from assistive technology`);
  requireText(source, '</span>性情：\'+S.players.map', `${label} text-only personality setup log`);
  requireText(source, "withPersona.map(p => p.name).join(' · ')", `${label} text-only cosplay setup log`);
  if (source.includes("Render.log('system','🧠 '") || source.includes("withPersona.map(p => '🎭'+p.name)")) {
    throw new Error(`${label} still emits decorative emoji in setup summaries`);
  }
  if (source.includes('━━ 阅读与推理 ━━')) {
    throw new Error(`${label} still exports reasoning guidance as an undifferentiated rules section`);
  }
  if (source.includes('role-card-fallback">${r.emoji}') || source.includes('<strong>${r.emoji} ${escapeHtml(')) {
    throw new Error(`${label} still renders role emoji in the encyclopedia`);
  }
  if (source.includes('<span style="font-size:.85em">${o.r.emoji}</span>')) {
    throw new Error(`${label} still renders role emoji in the role picker`);
  }
  if (source.includes("p.role ? p.role.emoji + p.role.name : '未知'")) {
    throw new Error(`${label} still renders role emoji in the export-view picker`);
  }
}

requireText(uiIcons, "moon:'<path", 'moon SVG icon definition');

const logPrefixEmojiRe = /^(?:(?:🌙|🐺|💀|💔|🌹|🏹|👹|👑|🔪|🔮|⚖️?|⚠️?|📊|📢|😅|🎤|🔄|👋)\s*)+/u;
if ('👑📊 警长投票'.replace(logPrefixEmojiRe, '') !== '警长投票') {
  throw new Error('Repeated allowlisted structural emoji are not fully removed');
}
if ('<div>💬 玩家原话</div>'.replace(logPrefixEmojiRe, '') !== '<div>💬 玩家原话</div>') {
  throw new Error('Player-authored HTML content must not be rewritten by prefix cleanup');
}
const cleanLogForType = (type, value) => ['night','death','sheriff','trial'].includes(type)
  ? value.replace(logPrefixEmojiRe, '')
  : value;
if (cleanLogForType('system', '🎭 玩家原话') !== '🎭 玩家原话') {
  throw new Error('System/player content must bypass structural emoji cleanup');
}
if (cleanLogForType('night', '🧿 未登记的新符号') !== '🧿 未登记的新符号') {
  throw new Error('Unknown leading emoji must be preserved unless explicitly allowlisted');
}

for (const [needle, label] of [
  ['— Export record —', 'export modal title'],
  ['Include inner thoughts', 'export option'],
  ['— Active game rules (for external AI) —', 'active-rules modal title'],
  ['— Save manager —', 'save manager title'],
  ['⏪ Game rewind (automatic timeline)', 'rewind button'],
  ['🏆 All-player review · MVP', 'MVP title'],
  ['After voting starts, every AI judge scores each player', 'MVP description']
]) requireText(english, needle, `English static ${label}`);

requireText(i18n, 'characterData:true', 'dynamic text mutation translation');
requireText(i18n, 'After voting starts, every AI judge scores each player', 'dynamic MVP translation fallback');
requireText(i18n, 'The game has not started. Finish the role setup', 'empty-rule translation fallback');
for (const roleId of ['werewolf','wolfking','wolfbeauty','seer','witch','guard','hunter','knight','magician','villager','fool','jester','merchant','fox','whitecat','cupid','serialkiller','mechwolf']) {
  requireText(sigils, `${roleId}:`, `role sigil for ${roleId}`);
}
requireText(sigils, 'window.RoleSigils = Object.freeze({ render })', 'role sigil public renderer');

console.log('English UI regression checks passed');
