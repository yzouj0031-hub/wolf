// 赛后：复盘页面与 MVP 评选
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 复盘HTML生成
 * ================================================================ */
function generateReplay() {
  if (humanViewLocked()) return humanViewDenied();
  if (blindReviewOn()) {
    alert('终局盲复盘已开启：复盘HTML含头像、真实身份和私密事件，已阻止导出以免泄底。请使用“聊天摘要”导出公开战报盲推版；关闭盲复盘后可正常导出完整复盘HTML。');
    openChatSummary();
    return;
  }
  _backfillGiftChoiceRecords();
  const modeName = (MODE_CONFIGS[S.mode]||{}).name||'自定义';
  const hd = $('m-hdeath').checked;

  // 按轮次分组 gameRecord
  const rounds = [];
  let cur = {round:0, phase:'', events:[]};
  gameRecord.forEach(r => {
    if (r.type === 'system' && r.text && r.text.match(/^第\d+[夜天]/)) {
      if (cur.events.length) rounds.push(cur);
      const isNight = r.text.includes('夜');
      cur = {round: parseInt(r.text.match(/\d+/)[0]), phase: isNight?'night':'day', label: r.text, events:[]};
    } else {
      cur.events.push(r);
    }
  });
  if (cur.events.length) rounds.push(cur);

  // 角色颜色
  const teamColor = {good:'#68b8e8', bad:'#c83040', third:'#e8c848'};
  const roleColor = {werewolf:'#c83040',wolfking:'#e05040',wolfbeauty:'#e080a0',seer:'#a0d8f0',witch:'#c0a0e0',hunter:'#f0c060',guard:'#80c8a0',knight:'#f0a060',cupid:'#f5a0b8',jester:'#e8c848',serialkiller:'#d8b040',villager:'#a0a8b8'};

  // 玩家头像HTML
  const getAv = (name) => {
    const p = S.players.find(x=>x.name===name);
    if (!p) return `<span class="av-emoji">👤</span>`;
    const cfg = playerConfigs[p.id];
    if (cfg && cfg.avatar) return `<img src="${cfg.avatar}" class="av-img" onerror="this.style.display='none'">`;
    return `<span class="av-emoji">${p.role.emoji}</span>`;
  };

  // 生成玩家列表
  const playerList = S.players.map(p => {
    const cfg = playerConfigs[p.id];
    const av = cfg && cfg.avatar ? `<img src="${cfg.avatar}" class="pl-av" onerror="this.style.display='none'">` : `<span class="pl-av-emoji">${p.role.emoji}</span>`;
    const dead = !p.alive ? ' dead' : '';
    const rc = roleColor[p.role.id] || '#a0a8b8';
    const deathInfo = !p.alive ? `<span class="pl-death">${escapeHtml(_formatPublicDeathCause(p,{compact:true,hiddenNight:hd,canSeePrivateNight:!hd}))} R${p.deathRound}</span>` : '';
    return `<div class="pl-card${dead}">
      <div class="pl-av-wrap">${av}</div>
      <div class="pl-name">${publicPlayerLabel(p)}</div>
      <div class="pl-role" style="color:${rc}">${p.role.name}</div>
      <div class="pl-pos">P${p.id+1}</div>
      ${deathInfo}
    </div>`;
  }).join('');

  // 生成每轮内容
  const roundsHtml = rounds.map(r => {
    const isNight = r.phase === 'night';
    const phaseIcon = isNight ? '🌙' : '☀️';
    const phaseColor = isNight ? '#7060b0' : '#c8a040';

    const eventsHtml = r.events.map(ev => {
      if (ev.type === 'death') {
        const p = S.players.find(x=>x.name===ev.name);
        const rc = p ? (roleColor[p.role.id]||'#a0a8b8') : '#c83040';
        const desc = _formatPublicDeathCause(ev,{hiddenNight:hd,canSeePrivateNight:!hd});
        return `<div class="ev death-ev">
          <span class="ev-icon">💀</span>
          <span class="ev-name" style="color:${rc}">${ev.name}</span>
          <span class="ev-role">${hd?'':ev.role}</span>
          <span class="ev-tag">${escapeHtml(desc)}</span>
        </div>`;
      }
      if (ev.type === 'foolImmune' || ev.type === 'reprieve' || ev.type === 'skillConsumed') {
        return `<div class="ev death-ev"><span class="ev-icon">${ev.type==='reprieve'?'🐈‍⬛':ev.type==='skillConsumed'?'🛡️':'🃏'}</span><span class="ev-tag">${escapeHtml(_formatPublicRevealEvent(ev))}</span></div>`;
      }
      if (ev.type === 'speech') {
        const p = S.players.find(x=>x.name===ev.name);
        const rc = p ? (roleColor[p.role.id]||'#a0a8b8') : '#c0b8d0';
        const teamC = p ? (teamColor[p.role.team]||'#888') : '#888';
        const thinkingHtml = ev.thinking ? `<div class="sp-thinking">💭 ${ev.thinking}</div>` : '';
        return `<div class="ev speech-ev">
          <div class="sp-header">
            <div class="sp-av">${getAv(ev.name)}</div>
            <span class="sp-name" style="color:${rc}">${ev.name}</span>
            <span class="sp-label" style="border-color:${teamC};color:${teamC}">${ev.label||'发言'}</span>
            <span class="sp-round">R${ev.round} ${ev.phase==='night'?'🌙':'☀️'}</span>
          </div>
          ${thinkingHtml}
          <div class="sp-game">${(ev.game||'').replace(/</g,'&lt;')}</div>
        </div>`;
      }
      if (ev.type === 'vote') {
        return `<div class="ev vote-ev">${escapeHtml(_formatPublicVoteEvent(ev))}</div>`;
      }
      if (ev.type === 'duel') {
        return `<div class="ev duel-ev">${escapeHtml(_formatPublicDuelEvent(ev))}</div>`;
      }
      if (ev.type === 'shoot') return `<div class="ev duel-ev">${escapeHtml(_formatPublicShootEvent(ev))}</div>`;
      if (ev.type === 'bite') return `<div class="ev duel-ev">${escapeHtml(_formatPublicBiteEvent(ev))}</div>`;
      if (ev.type === 'whitewolf_explode') return `<div class="ev duel-ev">${escapeHtml(_formatPublicWhitewolfExplodeEvent(ev))}</div>`;
      if (ev.type === 'trial') return `<div class="ev vote-ev">${escapeHtml(_formatPublicTrialEvent(ev))}</div>`;
      if (ev.type === 'sheriff_transfer') return `<div class="ev vote-ev">${escapeHtml(_formatPublicSheriffTransfer(ev))}</div>`;
      if (ev.type === 'night_action') {
        const _cl = _formatCustomNightAction(ev);
        if (_cl) return `<div class="ev action-ev">${escapeHtml(_cl)}</div>`;
        const icons = {wolf:'🐺',seer:'🔮',witch:'🧙‍♀️',guard:'🛡️',wolfbeauty:'🌹',wolfking:'👹'};
        return `<div class="ev action-ev"><span class="ev-icon">${icons[ev.role]||'🎯'}</span><span class="ev-role-name">${ev.role}</span> → ${ev.target||'无'}</div>`;
      }
      return '';
    }).filter(Boolean).join('');

    return `<div class="round-block ${isNight?'night-block':'day-block'}">
      <div class="round-header" onclick="this.parentNode.classList.toggle('collapsed')">
        <span class="round-icon">${phaseIcon}</span>
        <span class="round-label" style="color:${phaseColor}">${r.label||('第'+r.round+(isNight?'夜':'日'))}</span>
        <span class="round-toggle">▼</span>
      </div>
      <div class="round-body">${eventsHtml}</div>
    </div>`;
  }).join('');

  // 下载
  const replayScript = [
    '<scr'+'ipt>',
    "document.querySelectorAll('.night-block').forEach(b=>{",
    "  const hasSpeech = b.querySelector('.speech-ev');",
    "  if(!hasSpeech) b.classList.add('collapsed');",
    '});',
    '<\/scr'+'ipt>'
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🐺 狼人杀复盘 · ${modeName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a14;color:#d0c8e8;font-family:'Microsoft YaHei',sans-serif;padding:16px;line-height:1.6}
h1{text-align:center;font-size:1.3em;color:#f5a0b8;margin-bottom:4px;padding:16px 0 8px}
.subtitle{text-align:center;font-size:.8em;color:#6a6080;margin-bottom:20px}
.players{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;justify-content:center}
.pl-card{background:rgba(20,18,35,.9);border:1px solid rgba(245,160,184,.15);border-radius:8px;padding:10px;text-align:center;width:90px;transition:.2s}
.pl-card.dead{opacity:.5;filter:grayscale(.6)}
.pl-av-wrap{width:48px;height:48px;border-radius:50%;overflow:hidden;margin:0 auto 6px;border:2px solid rgba(245,160,184,.2);display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3)}
.pl-av{width:100%;height:100%;object-fit:cover}
.pl-av-emoji{font-size:1.6em}
.pl-name{font-size:.8em;font-weight:bold;color:#e8d8f0;margin-bottom:2px}
.pl-role{font-size:.72em;margin-bottom:2px}
.pl-pos{font-size:.65em;color:#6a6080}
.pl-death{font-size:.65em;color:#c83040;display:block;margin-top:2px}
.round-block{margin-bottom:12px;border-radius:10px;overflow:hidden;border:1px solid rgba(245,160,184,.1)}
.night-block{border-color:rgba(112,96,176,.3)}
.day-block{border-color:rgba(200,160,64,.2)}
.round-header{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;user-select:none;background:rgba(255,255,255,.03)}
.night-block .round-header{background:rgba(112,96,176,.1)}
.day-block .round-header{background:rgba(200,160,64,.06)}
.round-icon{font-size:1.1em}
.round-label{font-weight:bold;font-size:.95em;flex:1}
.round-toggle{font-size:.75em;color:#6a6080;transition:.2s}
.round-block.collapsed .round-toggle{transform:rotate(-90deg)}
.round-block.collapsed .round-body{display:none}
.round-body{padding:8px 12px;display:flex;flex-direction:column;gap:6px}
.ev{font-size:.82em;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.03)}
.death-ev{background:rgba(200,48,64,.08);border-left:3px solid #c83040;display:flex;align-items:center;gap:8px}
.ev-icon{font-size:1.1em}
.ev-name{font-weight:bold}
.ev-role{color:#8a8090;font-size:.9em}
.ev-tag{color:#6a6080;font-size:.85em}
.speech-ev{background:rgba(245,160,184,.04);border-left:3px solid rgba(245,160,184,.2)}
.sp-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.sp-av{width:24px;height:24px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);flex-shrink:0}
.av-img{width:100%;height:100%;object-fit:cover}
.av-emoji{font-size:.9em}
.sp-name{font-weight:bold;font-size:.9em}
.sp-label{font-size:.7em;border:1px solid;border-radius:3px;padding:1px 5px}
.sp-round{font-size:.7em;color:#6a6080;margin-left:auto}
.sp-thinking{font-size:.78em;color:#7068a0;font-style:italic;background:rgba(0,0,0,.2);border-radius:4px;padding:4px 8px;margin-bottom:4px;border-left:2px solid #505080}
.sp-game{font-size:.85em;color:#d0c8e0;white-space:pre-wrap;word-break:break-all}
.vote-ev{background:rgba(74,96,116,.1);border-left:3px solid #4a6074;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.vt-item{font-size:.8em;background:rgba(255,255,255,.05);border-radius:4px;padding:2px 6px}
.duel-ev{background:rgba(224,160,96,.08);border-left:3px solid #e0a060}
.action-ev{background:rgba(255,255,255,.02);border-left:3px solid rgba(255,255,255,.1);color:#8a8090}
.ev-role-name{color:#a0a0b8;font-size:.9em}
</style>
</head>
<body>
<h1>🐺 AI狼人杀复盘</h1>
<div class="subtitle">${modeName} · ${S.players.length}人局 · ${new Date().toLocaleDateString('zh-CN')}</div>
<div class="players">${playerList}</div>
${roundsHtml}
${replayScript}



<\script>
/* ================================================================
 *  群聊模块
 * ================================================================ */<\/script>

</body>
</html>`;

  // 下载
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `狼人杀复盘_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
 *  § 22b. MVP评选
 * ================================================================ */
function openMVP() {
  // 重置弹窗状态
  $('mvp-status').textContent = uiEnglish()
    ? 'After voting starts, every AI judge scores each player on deduction, roleplay, impact, and speech quality using the omniscient report. The highest overall score wins MVP and is added to the leaderboard.'
    : '点击开始后，全体AI将基于上帝视角战报，为每位玩家四维打分（推理/演技/影响/发言），综合最高者当选MVP并计入排行榜';
  $('mvp-status').style.display = '';
  $('mvp-progress').style.display = 'none';
  $('mvp-results').style.display = 'none';
  $('mvp-results').innerHTML = '';
  $('mvp-start').disabled = false;
  $('mvp-start').textContent = uiEnglish() ? '🏆 Start voting' : '🏆 开始评选';
  $('mvpOverlay').classList.add('show');
}

// ★ 上帝视角战报：给 MVP 评委看的"完整录像回放"——所有身份、所有夜间行动、死亡、关键发言全公开，
//   不隐藏任何阵营视角。目的：让狼评委和好人评委看到【同一份事实】，消除"我方视角"偏差，分数才可比。
function _buildGodViewReport() {
  if (humanViewLocked()) { humanViewDenied(); return ''; }
  const recs = (typeof gameRecord !== 'undefined' && Array.isArray(gameRecord)) ? gameRecord : [];
  const lines = [];
  const roleName = nm => { const pl = S.players.find(x => x.name === nm); return pl ? pl.role.emoji + pl.role.name : ''; };
  // 按 round 分组
  const byRound = {};
  recs.forEach(r => {
    const rd = r.round || 0;
    (byRound[rd] = byRound[rd] || []).push(r);
  });
  Object.keys(byRound).map(Number).sort((a,b)=>a-b).forEach(rd => {
    if (rd === 0) return;
    lines.push(`\n【第${rd}天/夜】`);
    byRound[rd].forEach(r => {
      if (r.type === 'night_action') {
        const who = S.players.find(x => x.role && (r.role===x.role.id || r.role.startsWith(x.role.id)))?.name;
        if (r.role === 'seer') lines.push(`  🔮 预言家查验 ${r.target}→${r.result==='rebounded'?'被反弹，原目标未验证':r.result==='wolf'?'狼':'好人'}`);
        else if (r.role === 'cupid') lines.push(`  💘 丘比特连恋人：${r.target}${r.crossTeam?'（跨阵营）':''}`);
        else if (r.role === 'magician' && r.target) lines.push(`  🎩 魔术师交换 ${r.target}`);
        else if (r.role === 'guard' && r.target) lines.push(`  🛡️ 守卫守护 ${r.target}`);
        else if (r.role === 'serialkiller' && r.target) lines.push(`  🔪 连环杀手袭击 ${r.target}`);
        else if (r.role && r.role.startsWith('mechwolf') && r.target) lines.push(`  🤖 机械狼：${r.target}`);
        else if (r.role === 'witch') lines.push(`  🧙‍♀️ 女巫：${r.saved?'救'+r.saved:'未救'}${r.poisoned?'·毒'+r.poisoned:''}`);
        else if (r.role === 'wolf' && r.target) lines.push(`  🐺 狼队刀 ${r.target}`);
        else if (r.role === 'wolfbeauty') lines.push(`  🌹 狼美人魅惑 ${r.target||'无'}`);
        else { const _cl = _formatCustomNightAction(r); if (_cl) lines.push('  ' + _cl); }
      } else if (r.type === 'death') {
        lines.push(`  💀 ${r.name}(${roleName(r.name)}) 死亡（${r.cause||'?'}）`);
      } else if (r.type === 'skillConsumed') {
        lines.push(`  🛡️ ${r.name}(${r.roleName||'愚者'}) 技能生效并消耗：${r.detail||'保命触发'}`);
      } else if (r.type === 'foolImmune') {
        lines.push(`  🃏 ${r.name}(${r.roleName||'愚者'}) 被投票放逐→触发首放逐免疫：翻牌公开、本次不死`);
      } else if (r.type === 'reprieve') {
        lines.push(`  🐈‍⬛ ${r.name}(${r.role||'白猫'}) 被判出局→触发缓死：翻牌公开、延迟到${r.phase==='night'?'下一夜':'下一投票阶段'}才真死`);
      } else if (r.type === 'vote' && r.subtype === 'day') {
        const outName = r.out || r.result || '';
        if (outName) lines.push(`  🗳️ 白天投票放逐：${outName}`);
      } else if (r.type === 'duel') {
        lines.push(`  ⚔️ 骑士决斗`);
      } else if (r.type === 'whitewolf_explode') {
        lines.push(`  💥 白狼王自爆`);
      }
    });
    // 该轮关键发言（每人最多1条，截断）
    const speeches = byRound[rd].filter(r => r.type === 'speech' && r.game && !r.wolfChat);
    const seen = new Set();
    speeches.forEach(sp => {
      if (seen.has(sp.name)) return; seen.add(sp.name);
      const t = sp.game.slice(0, 70).replace(/\n/g,' ');
      if (t.trim()) lines.push(`  💬 ${sp.name}：${t}`);
    });
  });
  return lines.join('\n').trim() || '（无完整战报记录）';
}

// ★ 把本局评分结果写入排行榜：累计 MVP 次数 + 四维平均分
function recordScores(scoreAgg) {
  try {
    const lb = JSON.parse(localStorage.getItem('wg_leaderboard') || '{}');
    if (!lb._mvpMatches || typeof lb._mvpMatches !== 'object') lb._mvpMatches = {};
    const matchId = S._matchUid || ('legacy_live_'+S.gameId);

    // 同一局重新评选：先撤销上一版评分，再写入新版，避免MVP次数和均分无限叠加。
    const previous = lb._mvpMatches[matchId];
    if (previous && previous.scores) {
      Object.entries(previous.scores).forEach(([name, a]) => {
        const s = lb[name] && lb[name].scores;
        if (!s) return;
        s.reason = Math.max(0, (s.reason||0) - (a.reason||0));
        s.acting = Math.max(0, (s.acting||0) - (a.acting||0));
        s.influence = Math.max(0, (s.influence||0) - (a.influence||0));
        s.complete = Math.max(0, (s.complete||0) - (a.complete||0));
        s.count = Math.max(0, (s.count||0) - (a.count||0));
        s.scoreGames = Math.max(0, (s.scoreGames||0) - 1);
        if (a.isMVP) s.mvpCount = Math.max(0, (s.mvpCount||0) - 1);
      });
    }

    const snapshot = {};
    for (const name in scoreAgg) {
      if (!lb[name]) lb[name] = {wins:0, losses:0, games:0, roles:{}, lastPlayed:0};
      const S0 = lb[name].scores || {reason:0, acting:0, influence:0, complete:0, count:0, scoreGames:0, mvpCount:0};
      const a = scoreAgg[name];
      // 累计各维度总分与被评次数（用于算历史平均）
      S0.reason    = (S0.reason||0) + a.reason;
      S0.acting    = (S0.acting||0) + a.acting;
      S0.influence = (S0.influence||0) + a.influence;
      S0.complete  = (S0.complete||0) + a.complete;
      S0.count     = (S0.count||0) + a.count;   // 收到的评分份数
      S0.scoreGames = (S0.scoreGames||0) + 1;  // 参与过评分的对局数
      if (a.isMVP) S0.mvpCount = (S0.mvpCount || 0) + 1;
      lb[name].scores = S0;
      lb[name].lastPlayed = Date.now();
      snapshot[name] = {
        reason:a.reason, acting:a.acting, influence:a.influence, complete:a.complete,
        count:a.count, isMVP:!!a.isMVP,
        role:(S.players.find(p=>p.name===name)?.role?.name || '')
      };
    }
    lb._mvpMatches[matchId] = {recordedAt:Date.now(), scores:snapshot};
    localStorage.setItem('wg_leaderboard', JSON.stringify(lb));
    return !!previous;
  } catch(e) { console.error('评分入榜失败', e); }
  return false;
}

async function runMVP() {
  const mvpEnglish = uiEnglish();
  if (!S.players || S.players.length === 0) {
    $('mvp-status').textContent = mvpEnglish ? '⚠️ The game has not started' : '⚠️ 游戏尚未开始';
    return;
  }
  $('mvp-start').disabled = true;
  $('mvp-start').textContent = mvpEnglish ? '⏳ Voting…' : '⏳ 评选中…';
  $('mvp-status').style.display = 'none';
  $('mvp-progress').style.display = '';
  $('mvp-results').style.display = 'none';
  $('mvp-results').innerHTML = '';

  // 获取所有AI玩家（不管存活/死亡都参与投票）
  const aiPlayers = S.players.filter(p => !p.isPlayer);
  if (aiPlayers.length === 0) {
    $('mvp-progress').textContent = mvpEnglish ? '⚠️ This game has no AI players' : '⚠️ 本局没有AI玩家';
    $('mvp-start').disabled = false;
    $('mvp-start').textContent = mvpEnglish ? '🏆 Vote again' : '🏆 重新评选';
    return;
  }

  // 构建全局信息：所有玩家的身份、存活情况
  const allInfo = S.players.map(p =>
    `${p.name}(P${p.id+1})【${p.role.emoji}${p.role.name}|${p.role.team==='bad'?'狼人阵营':p.role.team==='good'?'好人阵营':'第三方'}|${p.alive?'存活':'已死亡'}】`
  ).join('，');

  const winInfo = S._winType
    ? ({good:'好人阵营获胜',bad:'狼人阵营获胜',jester:'小丑单独获胜',sk:'连环杀手单独获胜',lovers:'跨阵营情侣共同获胜'}[S._winType] || '游戏已结束')
    : '游戏进行中';

  // ★ 上帝视角完整战报（取代只给最近30条）——让每个评委看到同一份完整事实
  const godReport = _buildGodViewReport();

  const votes = {}; // playerName -> [{voter, reason}]
  const results = []; // 按发言顺序收集

  let done = 0;
  $('mvp-progress').textContent = mvpEnglish ? `0 / ${aiPlayers.length} judges finished` : `0 / ${aiPlayers.length} 人已投票`;

  // 并发调用所有AI（复用全局并发设置）
  const conc = getC('c-vote');
  let idx = 0;
  while (idx < aiPlayers.length) {
    const batch = aiPlayers.slice(idx, idx + Math.min(conc, aiPlayers.length - idx));
    await Promise.allSettled(batch.map(async p => {
      try {
        const api = getAPI(p.id);
        if (!api.key) return;

        const others = S.players.filter(x => x.id !== p.id);
        const nameList = others.map(x => x.name).join('、');
        const mvpPrompt = `【本局复盘·全员互评打分】游戏已结束。请你作为亲历者，站在【上帝视角】给其他每一位玩家打分。

⚠️ 重要：下面这份战报是【完整的上帝视角回放】——所有人的真实身份、夜间行动、查验、刀口、投票、死亡都已公开。请【基于这份完整事实】客观评分，而不是只凭你自己那局能看到的部分。一个把全场骗过的狼、和一个精准抓狼的好人，都可能是高分——评的是"打得好不好"，不是"他站哪一边""他有没有帮到我"。

本局全员身份：
${allInfo}

游戏结果：${winInfo}

━━ 完整战报（上帝视角）━━
${godReport}

━━ 评分维度（每项 1-5 分，5 为最佳）━━
🧠 推理力：逻辑是否清晰、抓狼/隐身的判断是否精准
🎭 演技：伪装、带节奏、心理博弈是否高明（好人悍跳、狼装好人都算）
⭐ 影响力：对整局走向的实际作用（带票、关键决策、扭转局势）
📝 发言完整度：发言是否充分表达、有效传递信息、不含糊不划水

请给以下每个人打分：${nameList}

⚠️ 输出严格用 JSON，放在 <action> 里，格式为对象数组，每人一项：
<thinking>逐个回顾他们的表现</thinking>
<game>一句话点评本局最亮眼的那个人</game>
<action>[{"name":"玩家名","reason":4,"acting":5,"influence":3,"complete":4},{"name":"玩家名","reason":3,"acting":2,"influence":3,"complete":5}]</action>

只打分名单里的人，不要给自己打分，name 必须精确匹配。`;

        const r = await callAI(p, mvpPrompt, { noMemory: true, skillConfirm: true, requireGame:true });
        if (!r) return;

        // 解析 action 里的 JSON 评分数组
        let scoreArr = null;
        try {
          let raw = (r.action || '').trim().replace(/^```[a-z]*\s*|\s*```$/gi, '');
          const mArr = raw.match(/\[[\s\S]*\]/);
          if (mArr) scoreArr = JSON.parse(mArr[0]);
        } catch(e) { scoreArr = null; }

        if (Array.isArray(scoreArr)) {
          scoreArr.forEach(item => {
            if (!item || !item.name) return;
            const tgt = S.players.find(x => x.id !== p.id &&
              (x.name === item.name || item.name.includes(x.name) || x.name.includes(item.name)));
            if (!tgt) return;
            const clamp = v => Math.max(1, Math.min(5, Number(v) || 3));
            const sc = { reason:clamp(item.reason), acting:clamp(item.acting), influence:clamp(item.influence), complete:clamp(item.complete) };
            if (!votes[tgt.name]) votes[tgt.name] = [];
            votes[tgt.name].push({ voter: p.name, ...sc });
          });
        }
        results.push({ voter: p, comment: r.game || '' });

        done++;
        $('mvp-progress').textContent = mvpEnglish ? `${done} / ${aiPlayers.length} judges finished` : `${done} / ${aiPlayers.length} 人已评分`;
      } catch(e) {
        done++;
        $('mvp-progress').textContent = mvpEnglish ? `${done} / ${aiPlayers.length} judges finished` : `${done} / ${aiPlayers.length} 人已投票`;
      }
    }));
    idx += batch.length;
  }

  // ── 汇总四维平均分 ──
  const scoreAgg = {}; // name -> {reason,acting,influence,complete,count,total,avg}
  Object.entries(votes).forEach(([name, arr]) => {
    const sum = arr.reduce((s,v)=>({reason:s.reason+v.reason, acting:s.acting+v.acting, influence:s.influence+v.influence, complete:s.complete+v.complete}), {reason:0,acting:0,influence:0,complete:0});
    const n = arr.length;
    scoreAgg[name] = {
      reason:sum.reason, acting:sum.acting, influence:sum.influence, complete:sum.complete, count:n,
      avgR:(sum.reason/n), avgA:(sum.acting/n), avgI:(sum.influence/n), avgC:(sum.complete/n),
      avg:((sum.reason+sum.acting+sum.influence+sum.complete)/(4*n))
    };
  });
  // 按综合均分排序 → MVP
  const ranked = Object.entries(scoreAgg).sort((a,b)=>b[1].avg - a[1].avg);

  // 渲染
  $('mvp-progress').style.display = 'none';
  const res = $('mvp-results');
  res.style.display = '';
  let html = '';
  let replacedPreviousScore = false;

  if (ranked.length === 0) {
    html = mvpEnglish
      ? '<div style="text-align:center;color:#8880a8;padding:16px">No valid scores were returned. The AI may not have followed the required format; please try again.</div>'
      : '<div style="text-align:center;color:#8880a8;padding:16px">没有有效评分结果（可能AI未按格式输出，可重试）</div>';
  } else {
    const [mvpName, mvpSc] = ranked[0];
    const mvpPlayer = S.players.find(p => p.name === mvpName);
    const mvpEmoji = mvpPlayer ? mvpPlayer.role.emoji : '🌟';
    const mvpRole = mvpPlayer && mvpEnglish && window.WolfI18n ? WolfI18n.role(mvpPlayer.role.id, mvpPlayer.role) : (mvpPlayer ? mvpPlayer.role : null);
    // 标记 MVP 并入榜
    scoreAgg[mvpName].isMVP = true;
    replacedPreviousScore = recordScores(scoreAgg);

    html += `<div style="text-align:center;padding:12px 8px 8px;background:linear-gradient(135deg,rgba(245,160,184,0.1),rgba(192,104,136,0.06));border:1px solid rgba(245,160,184,0.3);border-radius:var(--r-lg);margin-bottom:12px">
      <div style="font-size:1.6em;margin-bottom:4px">🏆</div>
      <div style="font-family:var(--font-title);font-size:1.15em;color:var(--gold-light);font-weight:900;letter-spacing:.1em">${mvpName}</div>
      <div style="font-size:.78em;color:#a090b0;margin-top:2px">${mvpEmoji}${mvpRole?mvpRole.name:''} · ${mvpEnglish?'Overall':'综合'} ${mvpSc.avg.toFixed(2)} / 5</div>
    </div>`;

    // 四维评分总表（按综合分降序）
    html += `<div style="font-size:.78em;color:#a090b0;margin-bottom:6px;padding-left:2px">${mvpEnglish?'— Four-category scores (this game) —':'── 四维评分榜（本局）──'}</div>`;
    const bar = v => { const pct = (v/5*100).toFixed(0); return `<span style="display:inline-block;width:26px;color:#c8a0e8;font-weight:600">${v.toFixed(1)}</span>`; };
    ranked.forEach(([name, sc], i) => {
      const pl = S.players.find(p => p.name === name);
      const em = pl ? pl.role.emoji : '•';
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`<span style="color:#5a5478">${i+1}</span>`;
      html += `<div style="margin-bottom:5px;padding:6px 9px;background:rgba(255,255,255,0.02);border-radius:var(--r);border-left:2px solid ${i===0?'var(--gold)':'rgba(245,160,184,0.15)'}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="width:20px;text-align:center">${medal}</span>
          <span style="font-size:.9em">${em}</span>
          <span style="font-weight:600;color:${i===0?'var(--gold-light)':'#c8c0d8'};flex:1">${name}</span>
          <span style="font-size:.85em;color:var(--gold);font-weight:bold">${sc.avg.toFixed(2)}</span>
        </div>
        <div style="display:flex;gap:10px;font-size:.68em;color:#8880a8;padding-left:26px">
          <span>🧠${bar(sc.avgR)}</span><span>🎭${bar(sc.avgA)}</span><span>⭐${bar(sc.avgI)}</span><span>📝${bar(sc.avgC)}</span>
        </div>
      </div>`;
    });

    // 各评委的一句话点评
    if (results.some(r => r.comment)) {
      html += `<div style="font-size:.78em;color:#a090b0;margin:10px 0 6px;padding-left:2px">${mvpEnglish?'— Judge comments —':'── 评委点评 ──'}</div>`;
      results.forEach(entry => {
        if (!entry.comment) return;
        html += `<div style="margin-bottom:6px;padding:6px 9px;background:rgba(255,255,255,0.02);border-radius:var(--r);border-left:2px solid rgba(200,160,232,0.15)">
          <span style="font-size:.8em;font-weight:600;color:#c8a0e8">${entry.voter.name}</span>
          <span style="font-size:.78em;color:#b0a0c8;margin-left:6px">${entry.comment}</span>
        </div>`;
      });
    }
  }

  res.innerHTML = html;
  $('mvp-start').disabled = false;
  $('mvp-start').textContent = mvpEnglish ? '🔄 Vote again' : '🔄 重新评选';

  if (ranked.length > 0) {
    Render.log('system', mvpEnglish
      ? `🏆 All-player review: <b style="color:var(--gold)">${ranked[0][0]}</b> wins MVP with an overall score of ${ranked[0][1].avg.toFixed(2)}/5! (${replacedPreviousScore?'This game’s previous score was replaced.':'Added to the historical leaderboard.'})`
      : `🏆 全员互评结果：<b style="color:var(--gold)">${ranked[0][0]}</b> 综合 ${ranked[0][1].avg.toFixed(2)}/5 当选 MVP！（${replacedPreviousScore?'已替换本局旧评分，不重复累计':'已计入历史排行榜'}）`);
  }
}
