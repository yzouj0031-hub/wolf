// 音效与背景音乐
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 内置BGM资源（GitHub直链）
 * ================================================================ */
const MUSIC_L_THEME = "https://raw.githubusercontent.com/yzouj0031-hub/bgm/main/L's%20theme%20A.mp3";
const MUSIC_WAKE_UP = "https://raw.githubusercontent.com/yzouj0031-hub/bgm/main/WAKE%20UP!.mp3";

const BGM_BASE = "https://raw.githubusercontent.com/yzouj0031-hub/bgm/main/";
const BGM_POOL = [
  BGM_BASE + 'Detective%20Conan%20Main%20Theme%20(Captured%20In%20Her%20Eyes%20Version).mp3',
  BGM_BASE + 'lumisoun%20-%20urbanisation.mp3',
  BGM_BASE + 'Death%20Note%20-%20(Kira\'s%20Theme%20A)%20Music.mp3',
  BGM_BASE + 'NewJeans%20%20GODS%20%20Instrumental.mp3',
  BGM_BASE + 'Sawano%20Hiroyuki%20-%20This%20is%20a%20Fight%20to%20Change%20the%20World.mp3',
  BGM_BASE + 'vortex.mp3',
  BGM_BASE + 'WAKE%20UP!.mp3',
  BGM_BASE + 'Death%20Note-%20Misa\'s%20song%20in%20Japanese%20(Lyrics).mp3',
  BGM_BASE + 'Death%20Note-%20Mello\'s%20Theme%20B%20EXTENDED.mp3',
  BGM_BASE + 'L\'s%20theme%20A.mp3',
  BGM_BASE + 'Death%20Note%20-%20Yoshihisa%20Hirano%20And%20Hideki%20Taniuchi%20-%20L\'s%20Theme%20B.mp3',
  BGM_BASE + 'Magic%20Kaito%20Kaito%20Kid%20-%20OST%20(Magical%20Flight).mp3',
  BGM_BASE + 'BLESSED%20MANE%20-%20Death%20Is%20No%20More.mp3'
];
// 每局开始时随机分配，key=玩家名, value=BGM URL
let CHARACTER_BGM = {};

// ★ 方案A：从 GitHub 仓库自动拉取【全部】mp3 作为随机池（往仓库丢歌即可，无需改代码）。
//   这是一个全局、独立于"搜库"DOM 的版本，供 shuffleBgm 使用。
//   拉取成功 → 用仓库全量歌单；失败/限流/断网 → 回退到写死的 BGM_POOL（保证永远能玩）。
const BGM_REPO_GLOBAL = 'yzouj0031-hub/bgm';
let _bgmRepoCache = null;      // 缓存拉取结果，一次会话只请求一次
async function fetchBgmPool() {
  if (_bgmRepoCache) return _bgmRepoCache;
  try {
    const res = await fetch(`https://api.github.com/repos/${BGM_REPO_GLOBAL}/contents/`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const files = await res.json();
    const urls = files
      .filter(f => f.name && /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name))
      .map(f => `https://raw.githubusercontent.com/${BGM_REPO_GLOBAL}/main/${encodeURIComponent(f.name)}`);
    if (urls.length > 0) {
      _bgmRepoCache = urls;
      Render && Render.devLog && Render.devLog('info', `[BGM] 已从仓库自动拉取 ${urls.length} 首曲目`);
      return urls;
    }
    throw new Error('仓库里没有音频文件');
  } catch (e) {
    Render && Render.devLog && Render.devLog('warn', `[BGM] 仓库拉取失败(${e.message})，回退到内置清单 BGM_POOL`);
    return BGM_POOL; // 兜底：限流/断网/私有仓库时用写死清单
  }
}

// 把一批 URL 洗牌后分配给玩家
function _assignBgm(source, players) {
  const pool = [...source];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const map = {};
  players.forEach((p, i) => { if (pool[i]) map[p.name] = pool[i]; });
  return map;
}

// ★ 同步入口：先用内置 BGM_POOL 立即铺一份（保证游戏一开始就有 BGM），
//   再异步去仓库拉全量歌单，拉到后无缝覆盖升级（往仓库丢歌即可生效，无需改代码）。
//   这样既不用把 startGame 改成 async，又能用上仓库全量。
function shuffleBgm(players) {
  CHARACTER_BGM = _assignBgm(BGM_POOL, players);        // 先铺内置，立即可用
  fetchBgmPool().then(pool => {
    if (pool && pool.length && pool !== BGM_POOL) {
      CHARACTER_BGM = _assignBgm(pool, players);         // 仓库拉到了 → 升级为全量
      Render && Render.devLog && Render.devLog('info', `[BGM] 角色曲目已升级为仓库全量（${pool.length}首）`);
    }
  }).catch(()=>{ /* 拉取失败：保持已铺的内置清单，不影响 */ });
}

/* ================================================================
 *  § AUDIO 音效模块（Web Audio API，无需外部文件）
 * ================================================================ */
const Audio = (() => {
  let ctx = null;
  let bgNodes = [], bgGain = null;
  let bgAudio = null; // 真实音乐 Audio 元素
  let enabled = true;

  // 避免和全局 Audio 冲突，用别名
  const Audio2 = window.Audio;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function stopBg() {
    // 停止真实音乐
    if (bgAudio) {
      try {
        const a = bgAudio; bgAudio = null;
        let v = a.volume;
        const fade = setInterval(() => {
          v = Math.max(0, v - 0.04);
          a.volume = v;
          if (v <= 0) { clearInterval(fade); a.pause(); a.src = ''; }
        }, 60);
      } catch(e) {}
    }
    if (bgGain) {
      try { bgGain.gain.linearRampToValueAtTime(0, getCtx().currentTime + 1.5); }
      catch(e){}
    }
    setTimeout(() => {
      bgNodes.forEach(n => { try { n.stop(); } catch(e){} });
      bgNodes = []; bgGain = null;
    }, 1600);
  }

  // 播放真实 mp3（淡入循环）
  function playMusic(src, volume) {
    if (!enabled) return;
    stopBg();
    setTimeout(() => {
      if (!enabled) return;
      const audio = new Audio2();
      audio.src = src;
      audio.loop = true;
      audio.volume = 0;
      bgAudio = audio;
      audio.play().catch(() => {});
      let v = 0;
      const target = volume || 0.35;
      const fade = setInterval(() => {
        if (audio !== bgAudio) { clearInterval(fade); return; }
        v = Math.min(target, v + 0.015);
        audio.volume = v;
        if (v >= target) clearInterval(fade);
      }, 80);
    }, 300);
  }

  // 白噪声生成器（风声/雨声基底）
  function makeNoise(ac, duration) {
    const len = ac.sampleRate * duration;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  // 正弦振荡器
  function makeOsc(ac, type, freq) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  function startBg(type) {
    if (!enabled) return;
    // 根据用户选择决定播哪个
    const srcSel = type === 'night' ? ($('bgm-night-src') && $('bgm-night-src').value) : ($('bgm-day-src') && $('bgm-day-src').value);
    if (srcSel === 'none') { stopBg(); return; }
    if (srcSel === 'custom') {
      const customSrc = type === 'night' ? window._customNightBgm : window._customDayBgm;
      if (customSrc) { playMusic(customSrc, 0.35); return; }
      // 没有上传文件就fallback到内置
    }
    if (srcSel === 'url') {
      const urlInput = type === 'night' ? $('bgm-night-url') : $('bgm-day-url');
      const urlSrc = urlInput && urlInput.value.trim();
      if (urlSrc) { playMusic(urlSrc, 0.35); return; }
      // 没填链接就fallback到内置
    }
    // 内置音乐
    if (type === 'night' && typeof MUSIC_L_THEME !== 'undefined') {
      playMusic(MUSIC_L_THEME, 0.4);
      return;
    }
    if (type === 'day' && typeof MUSIC_WAKE_UP !== 'undefined') {
      playMusic(MUSIC_WAKE_UP, 0.35);
      return;
    }
    // 无音乐文件时 fallback 到 Web Audio 生成音
    stopBg();
    setTimeout(() => {
      if (!enabled) return;
      const ac = getCtx();
      const master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
      bgGain = master;

      if (type === 'night') {
        // === 夜间：虫鸣 + 低频风声 + 偶尔夜枭 ===
        const targetVol = 0.22;
        master.gain.linearRampToValueAtTime(targetVol, ac.currentTime + 2.5);

        // 低频风声（滤波白噪声）
        const wind = makeNoise(ac, 4);
        const windFilter = ac.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 180;
        windFilter.Q.value = 0.4;
        const windGain = ac.createGain();
        windGain.gain.value = 0.35;
        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(master);
        wind.start();
        bgNodes.push(wind);

        // 虫鸣（高频调幅振荡）
        const cricket = makeOsc(ac, 'sine', 3200);
        const cricketAM = ac.createOscillator();
        cricketAM.frequency.value = 18; // 调幅频率，模拟虫鸣节奏
        const cricketAMGain = ac.createGain();
        cricketAMGain.gain.value = 0.5;
        const cricketGain = ac.createGain();
        cricketGain.gain.value = 0.055;
        cricketAM.connect(cricketAMGain);
        cricketAMGain.connect(cricketGain.gain);
        cricket.connect(cricketGain);
        cricketGain.connect(master);
        cricket.start();
        cricketAM.start();
        bgNodes.push(cricket, cricketAM);

        // 第二组虫鸣（稍低频，相位错开）
        const cricket2 = makeOsc(ac, 'sine', 2800);
        const cricketAM2 = ac.createOscillator();
        cricketAM2.frequency.value = 14;
        const cricketAMGain2 = ac.createGain();
        cricketAMGain2.gain.value = 0.5;
        const cricketGain2 = ac.createGain();
        cricketGain2.gain.value = 0.04;
        cricketAM2.connect(cricketAMGain2);
        cricketAMGain2.connect(cricketGain2.gain);
        cricket2.connect(cricketGain2);
        cricketGain2.connect(master);
        cricket2.start();
        cricketAM2.start();
        bgNodes.push(cricket2, cricketAM2);

        // 低沉嗡鸣（月夜氛围）
        const drone = makeOsc(ac, 'sine', 55);
        const droneGain = ac.createGain();
        droneGain.gain.value = 0.08;
        drone.connect(droneGain);
        droneGain.connect(master);
        drone.start();
        bgNodes.push(drone);

      } else {
        // === 白天：鸟鸣 + 轻风 + 明亮氛围 ===
        master.gain.linearRampToValueAtTime(0.15, ac.currentTime + 2);

        // 轻风（高通滤波白噪声）
        const breeze = makeNoise(ac, 3);
        const breezeFilter = ac.createBiquadFilter();
        breezeFilter.type = 'bandpass';
        breezeFilter.frequency.value = 800;
        breezeFilter.Q.value = 0.3;
        const breezeGain = ac.createGain();
        breezeGain.gain.value = 0.12;
        breeze.connect(breezeFilter);
        breezeFilter.connect(breezeGain);
        breezeGain.connect(master);
        breeze.start();
        bgNodes.push(breeze);

        // 明亮的泛音叠加（阳光感）
        [440, 550, 660, 880].forEach((freq, i) => {
          const o = makeOsc(ac, 'sine', freq);
          const g = ac.createGain();
          g.gain.value = [0.06, 0.04, 0.03, 0.02][i];
          // 轻微颤音
          const vib = makeOsc(ac, 'sine', 5 + i);
          const vibGain = ac.createGain();
          vibGain.gain.value = freq * 0.008;
          vib.connect(vibGain);
          vibGain.connect(o.frequency);
          o.connect(g);
          g.connect(master);
          o.start(); vib.start();
          bgNodes.push(o, vib);
        });

        // 鸟鸣感（间歇性高频扫频）
        function chirp() {
          if (!bgGain || !enabled) return;
          const ac2 = getCtx();
          const g = ac2.createGain();
          g.gain.setValueAtTime(0.08, ac2.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac2.currentTime + 0.3);
          g.connect(ac2.destination);
          const o = ac2.createOscillator();
          o.type = 'sine';
          const baseFreq = 1800 + Math.random() * 800;
          o.frequency.setValueAtTime(baseFreq, ac2.currentTime);
          o.frequency.linearRampToValueAtTime(baseFreq * 1.3, ac2.currentTime + 0.15);
          o.frequency.linearRampToValueAtTime(baseFreq * 0.9, ac2.currentTime + 0.3);
          o.connect(g);
          o.start();
          o.stop(ac2.currentTime + 0.3);
          const next = 1500 + Math.random() * 3000;
          setTimeout(chirp, next);
        }
        setTimeout(chirp, 800);
      }
    }, 200);
  }

  // === 死亡音效：钟声衰减 + 低鸣 ===
  function playDeath() {
    if (!enabled) return;
    const ac = getCtx();
    // 钟声泛音
    [[200, 0.5], [400, 0.3], [600, 0.15], [840, 0.1]].forEach(([freq, vol]) => {
      const o = makeOsc(ac, 'sine', freq);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol * 0.6, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 3.5);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 3.5);
    });
    // 低频冲击
    const imp = makeOsc(ac, 'sine', 60);
    const impG = ac.createGain();
    impG.gain.setValueAtTime(0.7, ac.currentTime);
    impG.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    imp.connect(impG); impG.connect(ac.destination);
    imp.start(); imp.stop(ac.currentTime + 0.5);
  }

  // === 投票音效：紧张鼓点递进 ===
  function playVote() {
    if (!enabled) return;
    const ac = getCtx();
    // 鼓点序列，渐强
    [0, 0.22, 0.42, 0.60, 0.76].forEach((t, i) => {
      const isLast = i === 4;
      // 鼓皮（噪声冲击）
      const noise = makeNoise(ac, 0.1);
      const filt = ac.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = isLast ? 180 : 220;
      filt.Q.value = 1.5;
      const g = ac.createGain();
      g.gain.setValueAtTime(isLast ? 0.7 : 0.35 + i * 0.06, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + (isLast ? 0.35 : 0.18));
      noise.connect(filt); filt.connect(g); g.connect(ac.destination);
      noise.start(ac.currentTime + t);
      noise.stop(ac.currentTime + t + 0.35);
      // 鼓音（低频正弦）
      const drum = makeOsc(ac, 'sine', isLast ? 80 : 100);
      const dg = ac.createGain();
      dg.gain.setValueAtTime(isLast ? 0.5 : 0.25, ac.currentTime + t);
      dg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
      drum.connect(dg); dg.connect(ac.destination);
      drum.start(ac.currentTime + t);
      drum.stop(ac.currentTime + t + 0.3);
    });
  }

  // === 决斗音效：弦乐上行 + 最终冲击 ===
  function playDuel() {
    if (!enabled) return;
    const ac = getCtx();
    // 弦乐上行（快速琶音）
    const notes = [294, 330, 370, 415, 466, 523];
    notes.forEach((freq, i) => {
      const t = ac.currentTime + i * 0.08;
      const o = makeOsc(ac, 'sawtooth', freq);
      const lpf = ac.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 2000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(lpf); lpf.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.4);
    });
    // 最终冲击和弦
    const chordT = ac.currentTime + notes.length * 0.08 + 0.05;
    [196, 247, 294, 370].forEach(freq => {
      const o = makeOsc(ac, 'sawtooth', freq);
      const lpf = ac.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 1800;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.22, chordT);
      g.gain.exponentialRampToValueAtTime(0.001, chordT + 1.2);
      o.connect(lpf); lpf.connect(g); g.connect(ac.destination);
      o.start(chordT); o.stop(chordT + 1.2);
    });
  }

  function setEnabled(v) { enabled = v; if (!v) stopBg(); }
  function isEnabled() { return enabled; }

  // 出场曲：发言结束后淡出，恢复背景音
  let themeAudio = null;
  let themeTimer = null;
  function playTheme(src) {
    if (!enabled || !src) return;
    // 先淡出背景音
    if (bgAudio) { try { bgAudio.volume = Math.max(0, bgAudio.volume * 0.3); } catch(e){} }
    if (themeAudio) { try { themeAudio.pause(); } catch(e){} }
    if (themeTimer) { clearTimeout(themeTimer); themeTimer = null; }
    const audio = new Audio2();
    audio.src = src;
    audio.volume = 0;
    themeAudio = audio;
    audio.play().catch(() => {});
    // 淡入
    let v = 0;
    const fadeIn = setInterval(() => {
      if (audio !== themeAudio) { clearInterval(fadeIn); return; }
      v = Math.min(0.7, v + 0.03);
      audio.volume = v;
      if (v >= 0.7) clearInterval(fadeIn);
    }, 60);
  }
  // 停止出场曲（发言结束时调用）
  function stopTheme() {
    if (!themeAudio) return;
    const audio = themeAudio;
    themeAudio = null;
    let fv = audio.volume;
    const fadeOut = setInterval(() => {
      fv = Math.max(0, fv - 0.025);
      try { audio.volume = fv; } catch(e){}
      if (fv <= 0) {
        clearInterval(fadeOut);
        try { audio.pause(); } catch(e){}
        // 恢复背景音量
        if (bgAudio) {
          let bv = bgAudio.volume;
          const rv = setInterval(() => { bv=Math.min(0.35,bv+0.02); try{bgAudio.volume=bv;}catch(e){} if(bv>=0.35) clearInterval(rv); }, 60);
        }
      }
    }, 60);
  }
  // 角色专属BGM：发言时播放，发言结束后恢复阶段BGM
  let charBgmAudio = null;
  function playCharBgm(playerName) {
    if (!enabled) return;
    if ($('m-playerbgm') && !$('m-playerbgm').checked) return;
    const p = S.players.find(x => x.name === playerName);
    if (p && playerConfigs[p.id] && playerConfigs[p.id].muteBgm) return;
    // 优先用用户自定义的角色BGM，其次用内置的
    let src = null;
    if (p) {
      const cfg = playerConfigs[p.id];
      if (cfg && cfg.charBgm) src = cfg.charBgm;
    }
    if (!src) src = CHARACTER_BGM[playerName];
    if (!src) return;
    // 把阶段BGM音量压低
    if (bgAudio) { try { bgAudio.volume = 0.08; } catch(e){} }
    // 停掉上一个角色BGM
    if (charBgmAudio) { try { charBgmAudio.pause(); charBgmAudio.src=''; } catch(e){} charBgmAudio=null; }
    const a = new Audio2();
    a.src = src;
    a.loop = true;
    a.volume = 0;
    charBgmAudio = a;
    a.play().catch(()=>{});
    let v = 0;
    const fade = setInterval(() => {
      if (a !== charBgmAudio) { clearInterval(fade); return; }
      v = Math.min(0.45, v + 0.03);
      a.volume = v;
      if (v >= 0.45) clearInterval(fade);
    }, 50);
  }
  function stopCharBgm() {
    if (charBgmAudio) {
      const a = charBgmAudio; charBgmAudio = null;
      let v = a.volume;
      const fade = setInterval(() => { v = Math.max(0, v - 0.03); try{a.volume=v;}catch(e){} if(v<=0){clearInterval(fade);a.pause();a.src='';} }, 40);
    }
    // 恢复阶段BGM音量
    if (bgAudio) {
      let bv = bgAudio.volume;
      const rv = setInterval(() => { bv=Math.min(0.35,bv+0.02); try{bgAudio.volume=bv;}catch(e){} if(bv>=0.35) clearInterval(rv); }, 60);
    }
  }
  return { startBg, stopBg, playDeath, playVote, playDuel, setEnabled, isEnabled, playTheme, stopTheme, playCharBgm, stopCharBgm };
})();
