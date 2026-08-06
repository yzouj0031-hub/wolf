// Premium Replay Generator

function exportReplayHTML() {
  if (!S || !S.players || S.players.length === 0) {
    alert(i18n('No game data to export.'));
    return;
  }

  // 1. Serialize the necessary game state
  let wpState = { image: '', opacity: 60, blur: 3, dim: 55 };
  try {
    const s = JSON.parse(localStorage.getItem('wg_wallpaper_v1') || 'null');
    if (s) {
      wpState.image = s.image || '';
      wpState.opacity = s.opacity ?? 60;
      wpState.blur = s.blur ?? 3;
      wpState.dim = s.dim ?? 55;
    }
  } catch(e) {}

  const replayData = {
    players: S.players.map(p => {
      // Determine model name from preset if pureAI
      let modelName = 'Human';
      if (S.pureAI && playerConfigs[p.id] && playerConfigs[p.id].preset) {
        // Extract model name from preset comment or just use the preset ID/Name
        const lines = playerConfigs[p.id].preset.split('\n');
        const modelLine = lines.find(l => l.startsWith('// Model:') || l.startsWith('// model:'));
        if (modelLine) {
          modelName = modelLine.split(':')[1].trim();
        } else {
          // fallback to parsing the ID if it has standard format
          const presetObj = window.getPresetById ? getPresetById(playerConfigs[p.id].presetId) : null;
          if (presetObj && presetObj.model) modelName = presetObj.model;
          else modelName = playerConfigs[p.id].presetId || 'AI';
        }
      }

      return {
        id: p.id,
        name: p.name,
        role: p.role ? p.role.name : 'Unknown',
        emoji: p.role ? p.role.emoji : '👤',
        team: p.role ? p.role.team : 'good', // 'good', 'wolf', 'third'
        mbti: playerConfigs[p.id] && playerConfigs[p.id].mbti ? playerConfigs[p.id].mbti : '',
        model: modelName,
        avatar: playerConfigs[p.id] && playerConfigs[p.id].avatar ? playerConfigs[p.id].avatar : '',
        deathRound: p.deathRound || null,
        deathCause: p.deathCause || null, // 'vote', 'kill', 'poison', 'hunter', 'martyr'
        alive: !p.dead
      };
    }),
    history: [],
    settings: {
      pureAI: S.pureAI,
      knightChainMode: S.knightChainMode,
      killEdgeMode: S.killEdgeMode,
      wallpaper: wpState
    }
  };

  // Extract history events cleanly
  let currentRound = 0;
  let currentPhase = 'night'; // 'night' or 'day'

  if (S.history && S.history.length > 0) {
    S.history.forEach(ev => {
      // Parse standard log format (e.g. "第1夜", "第1天")
      if (ev.includes('第') && (ev.includes('夜') || ev.includes('天')) && !ev.includes('：')) {
        const m = ev.match(/第(\d+)(夜|天)/);
        if (m) {
          currentRound = parseInt(m[1]);
          currentPhase = m[2] === '夜' ? 'night' : 'day';
        }
      }

      // Is it a speech/action event?
      let speakerId = null;
      let text = '';
      let isWolfPrivate = ev.includes('[🐺狼人密谈]');
      let type = 'system';
      
      const colonIndex = ev.indexOf('：');
      if (colonIndex !== -1 && !ev.startsWith('【')) {
        // Might be a speech
        const prefix = ev.substring(0, colonIndex);
        const pMatch = S.players.find(p => prefix.includes(p.name));
        if (pMatch) {
          speakerId = pMatch.id;
          text = ev.substring(colonIndex + 1).trim();
          type = 'speech';
        }
      }

      if (type === 'system') {
        text = ev;
      }

      // Check for death events
      let deathIds = [];
      if (ev.includes('出局') || ev.includes('死亡') || ev.includes('被放逐')) {
        S.players.forEach(p => {
          if (ev.includes(p.name) && (ev.includes('出局') || ev.includes('死亡') || ev.includes('被放逐') || ev.includes('倒牌'))) {
            deathIds.push(p.id);
          }
        });
      }

      replayData.history.push({
        round: currentRound,
        phase: currentPhase,
        type: type,
        speakerId: speakerId,
        text: text,
        isWolfPrivate: isWolfPrivate,
        deathIds: deathIds
      });
    });
  }

  // 2. Build the HTML template
  const template = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>🐺 狼人杀 · 沉浸式复盘 (Wolf Replay)</title>
<style>
:root {
  --bg-dark: #050508;
  --bg-night: #0a0b14;
  --bg-day: #1a1525;
  --panel-bg: rgba(20, 20, 30, 0.6);
  --panel-border: rgba(255, 255, 255, 0.08);
  --text-main: #e2e0e8;
  --text-dim: #8b8598;
  --accent-moon: #d4b581;
  --accent-sun: #e8c37d;
  --team-wolf: #d94b68;
  --team-good: #5da0c2;
  --team-third: #d4b581;
  --font-serif: "Noto Serif SC", "Source Han Serif SC", STSong, serif;
  --font-sans: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --radius: 12px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg-dark);
  color: var(--text-main);
  font-family: var(--font-sans);
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
}

body.has-wp {
  background: transparent;
}
body.has-wp::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: var(--wp-image, none);
  background-size: cover;
  background-position: center;
  opacity: var(--wp-opacity, 0);
  filter: blur(var(--wp-blur, 0px));
}
body.has-wp::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background: rgba(0, 0, 0, var(--wp-dim, 0.55));
  pointer-events: none;
}

/* Background Atmosphere */
#atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  transition: all 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  background: radial-gradient(circle at 50% 0%, #15162a 0%, var(--bg-dark) 70%);
  pointer-events: none;
}
#atmosphere.day {
  background: radial-gradient(circle at 50% -10%, #3a2530 0%, #16121e 60%, var(--bg-dark) 100%);
}
body.has-wp #atmosphere {
  background: radial-gradient(circle at 50% 0%, rgba(21,22,42,0.6) 0%, rgba(5,5,8,0.8) 70%);
}
body.has-wp.day #atmosphere {
  background: radial-gradient(circle at 50% -10%, rgba(58,37,48,0.6) 0%, rgba(22,18,30,0.7) 60%, rgba(5,5,8,0.8) 100%);
}

/* Particles */
.particle {
  position: absolute;
  width: 2px;
  height: 2px;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  pointer-events: none;
  animation: float linear infinite;
}
@keyframes float {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  20% { opacity: 0.6; }
  80% { opacity: 0.6; }
  100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
}

/* Layout */
#app {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

/* Top Bar */
.top-bar {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px 8px;
}
.phase-info {
  display: flex;
  flex-direction: column;
}
.phase-title {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  transition: color 0.5s;
}
.phase-sub {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-top: 2px;
}
.orb {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transition: all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 20px rgba(212, 181, 129, 0.3), inset -6px -6px 12px rgba(0,0,0,0.4);
  background: radial-gradient(circle at 30% 30%, #fef4e8 0%, var(--accent-moon) 60%, #9e7343 100%);
}
.day .orb {
  background: radial-gradient(circle at 30% 30%, #fffbed 0%, var(--accent-sun) 50%, #c46231 100%);
  box-shadow: 0 0 30px rgba(232, 195, 125, 0.4), 0 0 60px rgba(196, 98, 49, 0.2);
}

/* Life Cards Grid */
.grid-container {
  flex: 0 0 auto;
  padding: 8px 16px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
@media (max-width: 500px) {
  .grid-container { grid-template-columns: repeat(3, 1fr); }
}

.card {
  position: relative;
  aspect-ratio: 3/4;
  border-radius: 10px;
  overflow: hidden;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.card::before {
  content: '';
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 20%;
  opacity: 0.4;
  transition: all 0.4s;
  filter: saturate(0.8) contrast(1.1);
}
.card.has-avatar::before {
  background-image: var(--bg-img);
}

.card-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(5,5,8,0.1) 0%, rgba(5,5,8,0.7) 60%, rgba(5,5,8,0.95) 100%);
}

.card-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 4px;
  z-index: 2;
}

.c-num {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255,255,255,0.5);
  background: rgba(0,0,0,0.4);
  padding: 1px 4px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.c-avatar {
  position: absolute;
  top: 10px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  background-size: cover;
  background-position: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.6);
  background-image: var(--bg-img);
  transition: all 0.3s;
}

.c-name {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 2px;
}

.c-role {
  font-size: 10px;
  color: #d1cbe0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 3px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.c-model {
  font-size: 8px;
  color: var(--text-dim);
  margin-top: 2px;
  transform: scale(0.9);
}

/* Card States */
.card.speaking {
  transform: translateY(-4px) scale(1.05);
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px var(--accent-moon);
}
.card.speaking::before { opacity: 0.7; }
.card.speaking .c-avatar { border-color: var(--accent-moon); box-shadow: 0 0 12px rgba(212, 181, 129, 0.5); }
.day .card.speaking { box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px var(--accent-sun); }
.day .card.speaking .c-avatar { border-color: var(--accent-sun); }

.card.dead {
  filter: grayscale(0.8) opacity(0.5);
  transform: scale(0.95);
}
.card.dead::after {
  content: '☠';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: rgba(255,255,255,0.6);
  z-index: 5;
  text-shadow: 0 2px 10px rgba(0,0,0,0.8);
}
.card.dead .c-name { text-decoration: line-through; color: #a09aab; }

/* Faction borders (only visible slightly or when speaking) */
.card[data-team="wolf"].speaking { box-shadow: 0 8px 24px rgba(217, 75, 104, 0.3), 0 0 0 1.5px var(--team-wolf); }
.card[data-team="wolf"].speaking .c-avatar { border-color: var(--team-wolf); }
.card[data-team="good"].speaking { box-shadow: 0 8px 24px rgba(93, 160, 194, 0.3), 0 0 0 1.5px var(--team-good); }
.card[data-team="good"].speaking .c-avatar { border-color: var(--team-good); }

/* Stage Area (Dialogue) */
.stage {
  flex: 1;
  min-height: 0;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
}

.dialogue-box {
  flex: 1;
  background: rgba(15, 15, 20, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: inset 0 0 40px rgba(0,0,0,0.4);
}

.d-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.d-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 2px solid var(--panel-border);
}

.d-info {
  display: flex;
  flex-direction: column;
}

.d-name {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
}

.d-role-badge {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge {
  background: rgba(255,255,255,0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge.wolf { color: #ffa3b5; background: rgba(217, 75, 104, 0.15); border: 1px solid rgba(217, 75, 104, 0.3); }
.badge.good { color: #a3d9ff; background: rgba(93, 160, 194, 0.15); border: 1px solid rgba(93, 160, 194, 0.3); }

.d-text {
  font-size: 15px;
  line-height: 1.7;
  color: #e0dce8;
  white-space: pre-wrap;
  flex: 1;
}

.d-text.wolf-private {
  color: #ffb8c6;
  font-style: italic;
}

.d-system {
  font-size: 14px;
  color: var(--text-dim);
  text-align: center;
  margin: auto 0;
  line-height: 1.6;
}

/* Control Bar */
.controls {
  flex: 0 0 auto;
  padding: 16px 20px 24px;
  background: linear-gradient(180deg, transparent 0%, rgba(5,5,8,0.9) 30%, #050508 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 10;
}

.timeline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  -webkit-appearance: none;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-moon);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(212, 181, 129, 0.6);
  transition: transform 0.1s;
}
.slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
.day .slider::-webkit-slider-thumb { background: var(--accent-sun); box-shadow: 0 0 10px rgba(232, 195, 125, 0.6); }

.counter {
  font-size: 12px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: right;
}

.buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-main);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
}
.btn:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
}
.btn.primary {
  background: var(--accent-moon);
  color: #111;
  border-color: var(--accent-moon);
  font-weight: 600;
  padding: 8px 24px;
}
.day .btn.primary { background: var(--accent-sun); border-color: var(--accent-sun); }
.btn.primary:hover { filter: brightness(1.1); }
.btn.active { border-color: var(--accent-moon); color: var(--accent-moon); background: rgba(212, 181, 129, 0.1); }
.day .btn.active { border-color: var(--accent-sun); color: var(--accent-sun); background: rgba(232, 195, 125, 0.1); }

/* Screen Flash Effects */
.flash-screen {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.flash-text {
  font-family: var(--font-serif);
  font-size: 60px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: white;
  text-shadow: 0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,0,0,0.6);
  transform: scale(0.8);
}
@keyframes deathFlash {
  0% { opacity: 0; background: rgba(200, 0, 0, 0); transform: scale(0.9); }
  10% { opacity: 1; background: rgba(150, 0, 0, 0.4); transform: scale(1.05); }
  30% { opacity: 1; background: rgba(100, 0, 0, 0.2); transform: scale(1); }
  100% { opacity: 0; background: rgba(0, 0, 0, 0); transform: scale(1); }
}

/* Animations */
.fade-in { animation: fadeIn 0.4s ease forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
</style>
</head>
<body class="night">
<div id="atmosphere"></div>

<div id="app">
  <div class="top-bar">
    <div class="phase-info">
      <div class="phase-title" id="ui-phase-title">第1夜</div>
      <div class="phase-sub">WEREWOLF REPLAY</div>
    </div>
    <div class="orb"></div>
  </div>

  <div class="grid-container" id="ui-grid"></div>

  <div class="stage">
    <div class="dialogue-box fade-in" id="ui-dialogue">
      <!-- Content injected by JS -->
    </div>
  </div>

  <div class="controls">
    <div class="timeline">
      <input type="range" id="ui-slider" class="slider" min="0" value="0" step="1">
      <div class="counter" id="ui-counter">0 / 0</div>
    </div>
    <div class="buttons">
      <button class="btn" id="btn-prev">⏮ 上一步</button>
      <button class="btn primary" id="btn-play">▶ 播放</button>
      <button class="btn" id="btn-next">⏭ 下一步</button>
      <button class="btn" id="btn-speed">1x 速</button>
      <!-- <button class="btn active" id="btn-audio">🔊 音效</button> -->
    </div>
  </div>
</div>

<div class="flash-screen" id="ui-flash"><div class="flash-text" id="ui-flash-text"></div></div>

<script>
// --- INJECTED DATA ---
const DATA = ${JSON.stringify(replayData)};

// --- PLAYER LOGIC ---
const STATE = {
  currentIndex: 0,
  isPlaying: false,
  speed: 1,
  speeds: [1, 1.5, 2, 0.5],
  audioEnabled: true,
  playTimer: null,
  deadPlayers: new Set()
};

const UI = {
  body: document.body,
  atmo: document.getElementById('atmosphere'),
  phaseTitle: document.getElementById('ui-phase-title'),
  grid: document.getElementById('ui-grid'),
  dialogue: document.getElementById('ui-dialogue'),
  slider: document.getElementById('ui-slider'),
  counter: document.getElementById('ui-counter'),
  btnPlay: document.getElementById('btn-play'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  btnSpeed: document.getElementById('btn-speed'),
  flash: document.getElementById('ui-flash'),
  flashText: document.getElementById('ui-flash-text')
};

// Generate Particles
function createParticles() {
  for(let i=0; i<30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDuration = (Math.random() * 10 + 10) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    UI.atmo.appendChild(p);
  }
}

// Initialize Grid
function initGrid() {
  UI.grid.innerHTML = '';
  DATA.players.forEach(p => {
    const isWolf = p.team === 'wolf';
    const isGood = p.team === 'good';
    
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'card-' + p.id;
    if (p.avatar) {
      card.classList.add('has-avatar');
      card.style.setProperty('--bg-img', \`url(\${p.avatar})\`);
    }
    card.dataset.team = p.team;
    
    card.innerHTML = \`
      <div class="card-veil"></div>
      <div class="c-num">P\${p.id + 1}</div>
      <div class="c-avatar" style="\${p.avatar ? '--bg-img:url('+p.avatar+')' : ''}"></div>
      <div class="card-content">
        <div class="c-name">\${p.name}</div>
        <div class="c-role">\${p.emoji} \${p.role}</div>
        <div class="c-model">\${p.model}</div>
      </div>
    \`;
    UI.grid.appendChild(card);
  });
}

function updateState(index) {
  if (index < 0) index = 0;
  if (index >= DATA.history.length) index = DATA.history.length - 1;
  STATE.currentIndex = index;
  
  const event = DATA.history[index];
  
  // Update Phase
  UI.phaseTitle.textContent = \`第\${event.round}\${event.phase==='night'?'夜':'天'}\`;
  if (event.phase === 'day') {
    UI.body.classList.remove('night');
    UI.body.classList.add('day');
  } else {
    UI.body.classList.remove('day');
    UI.body.classList.add('night');
  }

  // Update Slider
  UI.slider.value = index;
  UI.counter.textContent = \`\${index + 1} / \${DATA.history.length}\`;

  // Calculate deaths up to this point
  STATE.deadPlayers.clear();
  for (let i = 0; i <= index; i++) {
    if (DATA.history[i].deathIds) {
      DATA.history[i].deathIds.forEach(id => STATE.deadPlayers.add(id));
    }
  }

  // Update Cards
  document.querySelectorAll('.card').forEach(c => {
    c.classList.remove('speaking');
    const id = parseInt(c.id.split('-')[1]);
    if (STATE.deadPlayers.has(id)) {
      c.classList.add('dead');
    } else {
      c.classList.remove('dead');
    }
  });

  // Render Event
  UI.dialogue.classList.remove('fade-in');
  void UI.dialogue.offsetWidth; // trigger reflow
  UI.dialogue.classList.add('fade-in');

  if (event.type === 'speech' && event.speakerId !== null) {
    const speaker = DATA.players.find(p => p.id === event.speakerId);
    const card = document.getElementById('card-' + speaker.id);
    if (card && !STATE.deadPlayers.has(speaker.id)) {
      card.classList.add('speaking');
    }
    
    UI.dialogue.innerHTML = \`
      <div class="d-header">
        <div class="d-avatar" style="\${speaker.avatar ? 'background-image:url('+speaker.avatar+')' : ''}"></div>
        <div class="d-info">
          <div class="d-name">\${speaker.name} <span style="font-size:12px;color:#888;font-weight:normal">(P\${speaker.id+1})</span></div>
          <div class="d-role-badge">
            <span class="badge \${speaker.team}">\${speaker.team === 'wolf' ? '狼人阵营' : (speaker.team === 'good' ? '好人阵营' : '第三方')}</span>
            \${speaker.emoji} \${speaker.role} \${speaker.mbti ? '· '+speaker.mbti : ''}
          </div>
        </div>
      </div>
      <div class="d-text \${event.isWolfPrivate ? 'wolf-private' : ''}">\${
        event.isWolfPrivate ? '<strong>[🐺狼人密谈]</strong> ' : ''
      }\${event.text.replace(/\\n/g, '<br>')}</div>
    \`;
  } else {
    UI.dialogue.innerHTML = \`<div class="d-system">\${event.text.replace(/\\n/g, '<br>')}</div>\`;
  }

  // Handle Death Flash
  if (event.deathIds && event.deathIds.length > 0) {
    triggerFlash('玩家倒牌');
  }
}

function triggerFlash(text) {
  UI.flashText.textContent = text;
  UI.flash.style.animation = 'none';
  void UI.flash.offsetWidth;
  UI.flash.style.animation = 'deathFlash 1.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards';
}

function togglePlay() {
  STATE.isPlaying = !STATE.isPlaying;
  UI.btnPlay.innerHTML = STATE.isPlaying ? '⏸ 暂停' : '▶ 播放';
  if (STATE.isPlaying) {
    playNext();
  } else {
    clearTimeout(STATE.playTimer);
  }
}

function playNext() {
  if (STATE.currentIndex < DATA.history.length - 1) {
    updateState(STATE.currentIndex + 1);
    
    // Calculate reading time based on text length and speed
    const textLen = DATA.history[STATE.currentIndex].text.length;
    const baseTime = Math.max(2000, textLen * 80); // 80ms per char, min 2s
    const delay = baseTime / STATE.speed;
    
    STATE.playTimer = setTimeout(playNext, delay);
  } else {
    STATE.isPlaying = false;
    UI.btnPlay.innerHTML = '▶ 播放';
  }
}

// Events
UI.btnPrev.addEventListener('click', () => {
  STATE.isPlaying = false; UI.btnPlay.innerHTML = '▶ 播放'; clearTimeout(STATE.playTimer);
  updateState(STATE.currentIndex - 1);
});
UI.btnNext.addEventListener('click', () => {
  STATE.isPlaying = false; UI.btnPlay.innerHTML = '▶ 播放'; clearTimeout(STATE.playTimer);
  updateState(STATE.currentIndex + 1);
});
UI.btnPlay.addEventListener('click', togglePlay);
UI.slider.addEventListener('input', (e) => {
  STATE.isPlaying = false; UI.btnPlay.innerHTML = '▶ 播放'; clearTimeout(STATE.playTimer);
  updateState(parseInt(e.target.value));
});
UI.btnSpeed.addEventListener('click', () => {
  let idx = STATE.speeds.indexOf(STATE.speed);
  idx = (idx + 1) % STATE.speeds.length;
  STATE.speed = STATE.speeds[idx];
  UI.btnSpeed.textContent = STATE.speed + 'x 速';
});

// Boot
if (DATA.settings.wallpaper && DATA.settings.wallpaper.image) {
  const wp = DATA.settings.wallpaper;
  const root = document.documentElement;
  root.style.setProperty('--wp-image', \`url("\${wp.image}")\`);
  root.style.setProperty('--wp-opacity', (wp.opacity / 100).toFixed(2));
  root.style.setProperty('--wp-blur', wp.blur + 'px');
  root.style.setProperty('--wp-dim', (wp.dim / 100).toFixed(2));
  document.body.classList.add('has-wp');
}

UI.slider.max = DATA.history.length - 1;
createParticles();
initGrid();
if (DATA.history.length > 0) {
  updateState(0);
} else {
  UI.dialogue.innerHTML = '<div class="d-system">没有复盘数据。</div>';
}
</script>
</body>
</html>`;

  // 3. Download the file
  const blob = new Blob([template], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
  a.download = \`Wolf_Replay_\${dateStr}.html\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
