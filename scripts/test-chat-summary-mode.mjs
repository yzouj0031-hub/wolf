import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const start = html.indexOf('function _chatSummaryPrivateLine(');
  const end = html.indexOf('\nfunction _buildChatSummary(', start);
  assert.ok(start >= 0 && end > start, `${file}: chat summary presentation helpers are missing`);

  const auditStub = type => record => `AUDIT:${type}:${record && record.type}`;
  const helpers = new Function(
    '_formatPublicDuelEvent', '_formatPublicShootEvent', '_formatPublicWhitewolfExplodeEvent',
    '_formatPublicBiteEvent', '_formatPublicSheriffTransfer', '_formatPublicRevealEvent',
    '_formatPublicTrialEvent', '_formatPublicVoteEvent',
    `${html.slice(start, end)}; return {_chatSummaryPrivateLine, _formatCleanChatSummaryEvent, _formatChatSummaryEvent};`
  )(
    auditStub('duel'), auditStub('shoot'), auditStub('explode'), auditStub('bite'),
    auditStub('sheriff'), auditStub('reveal'), auditStub('trial'), auditStub('vote')
  );

  assert.equal(helpers._chatSummaryPrivateLine('🔮 查验：P3→狼人', false), '查验：P3→狼人', `${file}: clean private line kept decorative role emoji`);
  assert.equal(helpers._chatSummaryPrivateLine('🔮 查验：P3→狼人', true), '🔮 查验：P3→狼人', `${file}: audit private line lost detail`);

  const cleanVote = helpers._formatChatSummaryEvent({
    type:'vote', subtype:'day', votes:{P3:['P1','P2']}, abstains:['P4'], result:'P3'
  }, false);
  assert.match(cleanVote, /^放逐投票：P1、P2→P3；弃票：P4；结果：P3被放逐。$/);
  assert.doesNotMatch(cleanVote, /🗳️|不验证其阵营/, `${file}: clean vote retained audit annotations`);

  const cleanDuel = helpers._formatChatSummaryEvent({type:'duel', result:'wolf', knight:'P1', target:'P6'}, false);
  assert.equal(cleanDuel, '决斗：P1指向P6；P6公开验证为狼人并死亡。');
  assert.equal(helpers._formatChatSummaryEvent({type:'duel'}, true), 'AUDIT:duel:duel', `${file}: audit mode did not preserve the detailed formatter`);

  assert.match(html, /name="_summary-mode" value="clean" checked/, `${file}: clean summary is not the default`);
  assert.match(html, /name="_summary-mode" value="audit"/, `${file}: audit summary option is missing`);
  assert.match(html, /detailMode: selectedSummaryMode\(\)/, `${file}: selected summary mode is not passed to the exporter`);
  assert.match(html, /function _buildChatSummary\(viewerP, roundFilter, opts\)[\s\S]{0,350}?const auditMode = opts\.detailMode === 'audit'/, `${file}: exporter does not switch render modes`);
  assert.doesNotMatch(html, /function mechSkillTextForExport[\s\S]{0,180}?const auditMode/, `${file}: summary mode leaked into an unrelated role formatter`);
  assert.match(html, /同回合同名的技能结算与死亡记录属于同一次出局/, `${file}: clean summary lost the concise duplicate-event warning`);
}

console.log('Chat summary modes: clean default, audit preservation and concise structured event rendering passed');
