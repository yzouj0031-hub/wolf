import fs from 'node:fs';

const root = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const english = fs.readFileSync(new URL('../en/index.html', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../en/i18n.js', import.meta.url), 'utf8');

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

console.log('English UI regression checks passed');
