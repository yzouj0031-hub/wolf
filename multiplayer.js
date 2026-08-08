(function () {
  'use strict';

  const EN = document.documentElement.lang === 'en' || /\/en(?:\/|$)/.test(location.pathname);
  const T = EN ? {
    entryTitle:'Online Lobby', entrySub:'Create a room, invite friends, and bring your own model', title:'Online Lobby',
    intro:'This first release provides rooms, seats, ready state, presence and lobby chat. API keys always stay on each player’s device.',
    login:'Sign in before joining an online room.', loginBtn:'Open sign in', create:'Create room', join:'Join room',
    roomName:'Room name', yourName:'Display name', seats:'Seats', roomCode:'Room code', createBtn:'Create', joinBtn:'Join',
    close:'Close', copy:'Copy invite code', copied:'Invite code copied', ready:'Ready', cancelReady:'Cancel ready', leave:'Leave room',
    lock:'Lock lineup', locked:'Lineup locked', human:'Human', personalAI:'My model', hostedAI:'Host AI', controller:'Controller',
    modelLabel:'Public model name', saveSeat:'Save seat', chat:'Lobby chat', send:'Send', emptyChat:'No messages yet.',
    waiting:'Waiting for players', deploy:'Online database is not installed yet. Apply the Supabase migration in docs/ONLINE_MODE_SETUP.md first.',
    minPlayers:'At least two players are required and everyone must be ready.', confirmLeave:'Leave this room?',
    migration:'The lobby UI is ready, but this Supabase project still needs the online migration.', reconnect:'Reconnecting…',
    open:'Open', statusLobby:'Lobby', statusPlaying:'Lineup locked', statusClosed:'Closed', seat:'Seat', empty:'Open seat',
    online:'online', offline:'away', host:'Host', me:'You', noCloud:'Online mode is only available on the official site and APK.',
    invalidCode:'Enter a six-character room code.', genericError:'Online operation failed',
    resumeTitle:'Return to room', resumeSub:'Your active room is saved on this device',
    exitTitle:'Leave the active room?', exitBody:'You are still occupying a seat. Stay to continue, or leave the room explicitly.',
    stay:'Stay in room', leaveAndExit:'Leave and exit'
  } : {
    entryTitle:'联机大厅', entrySub:'创建房间，邀请朋友，让各自的模型同台对局', title:'联机大厅',
    intro:'第一期提供房间、选座、准备、在线状态与大厅聊天。每位玩家的 API 密钥始终只保存在自己的设备。',
    login:'进入联机大厅前需要先登录。', loginBtn:'打开登录', create:'创建房间', join:'加入房间',
    roomName:'房间名称', yourName:'你的显示名', seats:'座位数量', roomCode:'房间码', createBtn:'创建', joinBtn:'加入',
    close:'关闭', copy:'复制邀请码', copied:'邀请码已复制', ready:'准备', cancelReady:'取消准备', leave:'离开房间',
    lock:'锁定阵容', locked:'阵容已锁定', human:'真人操作', personalAI:'我的模型', hostedAI:'房主托管 AI', controller:'席位控制',
    modelLabel:'公开显示的模型名称', saveSeat:'保存席位', chat:'大厅聊天', send:'发送', emptyChat:'还没有消息。',
    waiting:'等待玩家加入', deploy:'联机数据库尚未安装，请先按照 docs/ONLINE_MODE_SETUP.md 应用 Supabase 迁移。',
    minPlayers:'至少需要两名玩家，而且所有人都必须准备。', confirmLeave:'确定离开这个房间吗？',
    migration:'大厅界面已经就绪，但当前 Supabase 项目还需要安装联机数据表。', reconnect:'正在重新连接…',
    open:'打开', statusLobby:'等待中', statusPlaying:'阵容已锁定', statusClosed:'已关闭', seat:'座位', empty:'空位',
    online:'在线', offline:'暂离', host:'房主', me:'你', noCloud:'联机模式只在官方网页与 APK 中启用。',
    invalidCode:'请输入六位房间码。', genericError:'联机操作失败',
    resumeTitle:'返回进行中的房间', resumeSub:'房间状态已保存在这台设备上',
    exitTitle:'要离开正在进行的房间吗？', exitBody:'你仍占用一个席位。可以留在房间继续，也可以明确退出并释放席位。',
    stay:'留在房间', leaveAndExit:'退出并离开'
  };

  const MT = EN ? {
    provider:'Multi-seat model provider', contribute:'Let this device provide AI seats', capacity:'Maximum AI seats',
    requestMode:'Request scheduling', queue:'Queue requests', parallel:'Parallel requests', saveProvider:'Save provider settings',
    fillTitle:'Empty-seat strategy', fillMode:'How to fill empty seats', wait:'Wait for players', hostFill:'Host model fills all',
    balanced:'Distribute across opted-in players', applyFill:'Apply seat allocation', aiSeat:'AI seat', providedBy:'Provided by',
    providerHint:'The API key stays on this device. Only the provider assignment and public model name are synced.',
    fillHint:'Host fill uses the host key for every empty seat. Balanced mode shares seats among players who opted in.',
    fullRequired:'Fill every configured seat and wait for every human member to be ready before locking the lineup.',
    serial:'queued', concurrent:'parallel', capacityLabel:'AI capacity'
  } : {
    provider:'多席位模型托管', contribute:'允许这台设备提供 AI 席位', capacity:'最多托管 AI 数量',
    requestMode:'请求调度方式', queue:'依次排队调用', parallel:'并发调用', saveProvider:'保存托管设置',
    fillTitle:'空位处理策略', fillMode:'空位如何补齐', wait:'等待真人或自带模型', hostFill:'房主模型全部补齐',
    balanced:'在自愿玩家之间平均分配', applyFill:'应用席位分配', aiSeat:'AI 席位', providedBy:'提供者',
    providerHint:'API Key 始终留在这台设备，只同步席位负责者和公开模型名称。',
    fillHint:'房主补齐会让房主的 Key 承担所有空位；平均分配只使用主动开启托管的玩家。',
    fullRequired:'必须补满房间配置的全部席位，且所有真人成员准备后才能锁定阵容。',
    serial:'排队', concurrent:'并发', capacityLabel:'AI 容量'
  };

  const state = {
    client:null, user:null, room:null, members:[], aiSeats:[], messages:[], channel:null,
    heartbeat:null, refreshTimer:null, nativeBackHandle:null, busy:false, error:'', initialized:false
  };
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cleanName = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const roomKey = 'wg_online_room';
  const isNative = !!(window.Capacitor?.isNativePlatform?.());
  let pendingExitAction = null;
  let allowHistoryExit = false;

  function installUI() {
    if ($('wg-online-entry')) return;
    const entry = document.createElement('button');
    entry.id = 'wg-online-entry'; entry.type = 'button'; entry.className = 'wg-online-entry';
    entry.innerHTML = '<span class="wg-online-mark" aria-hidden="true"></span>'
      + '<span class="wg-online-entry-copy"><strong>' + T.entryTitle + '</strong><small>' + T.entrySub + '</small></span>'
      + '<span class="wg-online-entry-arrow" aria-hidden="true">›</span>';
    const anchor = $('btn-demo') || document.querySelector('.lobby-demo');
    if (anchor) anchor.insertAdjacentElement('afterend', entry);
    else document.body.prepend(entry);

    const overlay = document.createElement('div');
    overlay.id = 'wg-online-overlay'; overlay.className = 'wg-online-overlay';
    overlay.innerHTML = '<section class="wg-online-panel" role="dialog" aria-modal="true" aria-labelledby="wg-online-title">'
      + '<header class="wg-online-head"><h3 class="wg-online-title" id="wg-online-title">' + T.title + '</h3>'
      + '<button class="wg-online-close" id="wg-online-close" type="button" aria-label="' + T.close + '">×</button></header>'
      + '<div class="wg-online-body" id="wg-online-body"></div></section>';
    document.body.appendChild(overlay);
    const exitConfirm = document.createElement('div');
    exitConfirm.id = 'wg-online-exit-confirm'; exitConfirm.className = 'wg-online-confirm';
    exitConfirm.innerHTML = '<section class="wg-online-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="wg-online-exit-title">'
      + '<span class="wg-online-confirm-mark" aria-hidden="true"></span><h4 id="wg-online-exit-title">' + T.exitTitle + '</h4>'
      + '<p>' + T.exitBody + '</p><div class="wg-online-actions">'
      + '<button class="wg-online-btn primary" id="wg-online-stay" type="button">' + T.stay + '</button>'
      + '<button class="wg-online-btn danger" id="wg-online-leave-exit" type="button">' + T.leaveAndExit + '</button></div></section>';
    document.body.appendChild(exitConfirm);
    entry.addEventListener('click', openLobby);
    $('wg-online-close').addEventListener('click', closeLobby);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeLobby(); });
    $('wg-online-stay').addEventListener('click', hideExitConfirm);
    $('wg-online-leave-exit').addEventListener('click', async () => {
      const action = pendingExitAction;
      hideExitConfirm();
      if (action) await action();
    });
  }

  function hasActiveRoom() {
    return !!(state.room && state.room.status !== 'closed' && state.user
      && state.members.some(member => member.user_id === state.user.id));
  }

  function updateEntryState() {
    const entry = $('wg-online-entry');
    if (!entry) return;
    const saved = readSavedRoom();
    const active = hasActiveRoom() || !!saved?.id;
    entry.classList.toggle('has-room', active);
    const strong = entry.querySelector('strong');
    const small = entry.querySelector('small');
    if (strong) strong.textContent = active ? T.resumeTitle : T.entryTitle;
    if (small) small.textContent = active ? T.resumeSub : T.entrySub;
  }

  function showExitConfirm(action) {
    if (!hasActiveRoom()) return action?.();
    pendingExitAction = action || null;
    $('wg-online-exit-confirm')?.classList.add('show');
    $('wg-online-stay')?.focus();
  }

  function hideExitConfirm() {
    pendingExitAction = null;
    $('wg-online-exit-confirm')?.classList.remove('show');
  }

  function openCloudLogin() {
    $('cloud-account-open')?.click();
    closeLobby();
  }

  async function waitForCloud() {
    if (!window.CloudSave || CloudSave.isAllowed?.() === false) return false;
    for (let i = 0; i < 48; i++) {
      const client = CloudSave.getClient?.();
      if (client) { state.client = client; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!state.client) return false;
    const {data} = await state.client.auth.getSession();
    state.user = data.session?.user || null;
    return true;
  }

  async function openLobby() {
    $('wg-online-overlay')?.classList.add('show');
    document.body.style.overflow = 'hidden';
    state.error = '';
    renderLoading();
    const ok = await waitForCloud();
    if (!ok) return renderUnavailable();
    if (!state.user) return renderHome();
    if (state.room) { renderRoom(); return; }
    const saved = readSavedRoom();
    if (saved?.id && !state.room) {
      try { await enterRoom(saved.id, saved.code); return; }
      catch (_) { clearSavedRoom(); }
    }
    renderHome();
  }

  function closeLobby() {
    $('wg-online-overlay')?.classList.remove('show');
    document.body.style.overflow = '';
  }

  function renderLoading() {
    const body = $('wg-online-body');
    if (body) body.innerHTML = '<p class="wg-online-lead">' + T.reconnect + '</p>';
  }

  function renderUnavailable() {
    const body = $('wg-online-body');
    if (!body) return;
    body.innerHTML = '<div class="wg-online-error">' + (window.CloudSave?.isAllowed?.() === false ? T.noCloud : T.genericError) + '</div>';
  }

  function renderHome() {
    const body = $('wg-online-body');
    if (!body) return;
    if (!state.user) {
      body.innerHTML = '<p class="wg-online-lead">' + T.login + '</p><div class="wg-online-actions">'
        + '<button class="wg-online-btn primary" id="wg-online-login" type="button">' + T.loginBtn + '</button></div>';
      $('wg-online-login').onclick = openCloudLogin;
      return;
    }
    const savedName = cleanName(localStorage.getItem('wg_online_name'));
    const queryCode = cleanCode(new URLSearchParams(location.search).get('room') || '');
    body.innerHTML = '<p class="wg-online-lead">' + T.intro + '</p>' + errorHTML()
      + '<div class="wg-online-grid">'
      + '<section class="wg-online-card"><h4>' + T.create + '</h4>'
      + field(T.roomName, '<input id="wg-create-title" maxlength="36" value="' + esc(EN ? 'Moonlit Table' : '月下对局') + '">')
      + field(T.yourName, '<input id="wg-create-name" maxlength="24" value="' + esc(savedName) + '">')
      + field(T.seats, '<select id="wg-create-seats">' + [4,6,8,10,12,14,16].map(n => '<option value="'+n+'"'+(n===12?' selected':'')+'>'+n+'</option>').join('') + '</select>')
      + '<div class="wg-online-actions"><button class="wg-online-btn primary" id="wg-create" type="button">' + T.createBtn + '</button></div></section>'
      + '<section class="wg-online-card"><h4>' + T.join + '</h4>'
      + field(T.roomCode, '<input id="wg-join-code" maxlength="6" autocomplete="off" value="' + esc(queryCode) + '" style="text-transform:uppercase;letter-spacing:.18em">')
      + field(T.yourName, '<input id="wg-join-name" maxlength="24" value="' + esc(savedName) + '">')
      + '<div class="wg-online-actions"><button class="wg-online-btn primary" id="wg-join" type="button">' + T.joinBtn + '</button></div></section></div>'
      + '<div class="wg-online-note">' + (EN ? 'Private role information and model credentials are not part of this lobby payload.' : '房间大厅不会上传模型 API 密钥，也不会广播游戏中的私密身份信息。') + '</div>';
    $('wg-create').onclick = createRoom;
    $('wg-join').onclick = joinRoom;
    $('wg-join-code').addEventListener('input', event => { event.target.value = cleanCode(event.target.value); });
  }

  function field(label, control) { return '<div class="wg-online-field"><label>' + label + '</label>' + control + '</div>'; }
  function errorHTML() { return state.error ? '<div class="wg-online-error">' + esc(state.error) + '</div>' : ''; }
  function cleanCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6); }
  function rememberName(name) { if (name) localStorage.setItem('wg_online_name', name); }
  function setBusy(busy) { state.busy = busy; document.querySelectorAll('#wg-online-body button,#wg-online-body input,#wg-online-body select').forEach(node => node.disabled = busy); }

  async function rpc(name, args) {
    const {data, error} = await state.client.rpc(name, args || {});
    if (error) {
      const missing = error.code === '42883' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '');
      throw new Error(missing ? T.deploy : error.message);
    }
    return data;
  }

  async function createRoom() {
    const title = cleanName($('wg-create-title').value) || (EN ? 'Moonlit Table' : '月下对局');
    const displayName = cleanName($('wg-create-name').value);
    const maxSeats = Number($('wg-create-seats').value) || 12;
    if (!displayName) { state.error = EN ? 'Enter your display name.' : '请填写你的显示名。'; return renderHome(); }
    setBusy(true);
    try {
      rememberName(displayName);
      const result = await rpc('online_create_room', {p_title:title,p_display_name:displayName,p_max_seats:maxSeats});
      const row = Array.isArray(result) ? result[0] : result;
      await enterRoom(row.room_id, row.room_code);
    } catch (error) { clearSavedRoom(); state.error = error.message || T.genericError; renderHome(); }
    finally { setBusy(false); }
  }

  async function joinRoom() {
    const code = cleanCode($('wg-join-code').value);
    const displayName = cleanName($('wg-join-name').value);
    if (code.length !== 6) { state.error = T.invalidCode; return renderHome(); }
    if (!displayName) { state.error = EN ? 'Enter your display name.' : '请填写你的显示名。'; return renderHome(); }
    setBusy(true);
    try {
      rememberName(displayName);
      const result = await rpc('online_join_room', {p_code:code,p_display_name:displayName});
      const row = Array.isArray(result) ? result[0] : result;
      await enterRoom(row.room_id, row.room_code);
    } catch (error) { clearSavedRoom(); state.error = error.message || T.genericError; renderHome(); }
    finally { setBusy(false); }
  }

  async function enterRoom(id, code) {
    saveRoom(id, code);
    await refreshRoom(id);
    if (!state.room) throw new Error(EN ? 'Room is no longer available.' : '房间已经不存在。');
    subscribeRoom(id);
    startHeartbeat(id);
    installExitProtection();
    updateEntryState();
    renderRoom();
  }

  async function refreshRoom(id) {
    if (!state.client || !state.user) return;
    const [roomRes, membersRes, aiSeatsRes, messagesRes] = await Promise.all([
      state.client.from('online_rooms').select('*').eq('id', id).maybeSingle(),
      state.client.from('online_room_members').select('*').eq('room_id', id).order('seat_no'),
      state.client.from('online_room_ai_seats').select('*').eq('room_id', id).order('seat_no'),
      state.client.from('online_room_messages').select('*').eq('room_id', id).order('id',{ascending:false}).limit(80)
    ]);
    const error = roomRes.error || membersRes.error || aiSeatsRes.error || messagesRes.error;
    if (error) {
      const missing = error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '');
      throw new Error(missing ? T.deploy : error.message);
    }
    state.room = roomRes.data || null;
    state.members = membersRes.data || [];
    state.aiSeats = aiSeatsRes.data || [];
    state.messages = (messagesRes.data || []).reverse();
  }

  function scheduleRefresh() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(async () => {
      if (!state.room) return;
      try { await refreshRoom(state.room.id); renderRoom(); }
      catch (error) { state.error = error.message; renderRoom(); }
    }, 120);
  }

  function subscribeRoom(roomId) {
    if (state.channel) state.client.removeChannel(state.channel);
    state.channel = state.client.channel('online-room-' + roomId)
      .on('postgres_changes',{event:'*',schema:'public',table:'online_rooms',filter:'id=eq.'+roomId},scheduleRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'online_room_members',filter:'room_id=eq.'+roomId},scheduleRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'online_room_ai_seats',filter:'room_id=eq.'+roomId},scheduleRefresh)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'online_room_messages',filter:'room_id=eq.'+roomId},scheduleRefresh)
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { state.error = T.reconnect; renderRoom(); }
      });
  }

  function startHeartbeat(roomId) {
    clearInterval(state.heartbeat);
    const touch = () => rpc('online_touch_room',{p_room_id:roomId}).catch(() => {});
    touch(); state.heartbeat = setInterval(touch, 20000);
  }

  function renderRoom() {
    const body = $('wg-online-body');
    if (!body || !state.room || !state.user) return;
    const mine = state.members.find(member => member.user_id === state.user.id);
    if (!mine) { clearRoomState(); state.error = ''; return renderHome(); }
    const host = state.room.host_id === state.user.id;
    const totalSeats = state.members.length + state.aiSeats.length;
    const roomFull = totalSeats === state.room.max_seats;
    const allReady = state.members.length >= 1 && state.members.every(member => member.ready);
    const statusText = state.room.status === 'playing' ? T.statusPlaying : state.room.status === 'closed' ? T.statusClosed : T.statusLobby;
    const seats = [];
    for (let seat = 1; seat <= state.room.max_seats; seat++) {
      const member = state.members.find(item => item.seat_no === seat);
      const aiSeat = state.aiSeats.find(item => item.seat_no === seat);
      seats.push(member ? memberHTML(member, seat) : aiSeat ? aiSeatHTML(aiSeat, seat) : '<div class="wg-seat empty">' + T.seat + ' ' + seat + ' · ' + T.empty + '</div>');
    }
    body.innerHTML = errorHTML()
      + '<div class="wg-room-top"><div><div class="wg-room-code">' + esc(state.room.code) + '</div><div class="wg-room-meta">'
      + esc(state.room.title) + ' · ' + statusText + ' · ' + totalSeats + '/' + state.room.max_seats + '</div></div>'
      + '<button class="wg-online-btn" id="wg-copy-code" type="button">' + T.copy + '</button></div>'
      + (state.room.status === 'playing' ? '<div class="wg-online-note">' + (EN ? 'The lineup is locked. Server-authoritative game settlement will connect to this room protocol in the next milestone.' : '阵容已经锁定。下一阶段会把服务器权威发牌与游戏结算接入这个房间协议。') + '</div>' : '')
      + '<div class="wg-seat-grid">' + seats.join('') + '</div>'
      + '<section class="wg-online-card wg-room-settings"><h4>' + T.controller + '</h4>'
      + '<div class="wg-online-grid">'
      + field(T.yourName,'<input id="wg-seat-name" maxlength="24" value="'+esc(mine.display_name)+'">')
      + field(T.controller,'<select id="wg-seat-controller">'+controllerOptions(mine.controller_type)+'</select>')
      + '</div>' + field(T.modelLabel,'<input id="wg-model-label" maxlength="40" value="'+esc(mine.model_label || '')+'" placeholder="'+esc(EN?'e.g. Wolf-Llama-8B':'例如：狼人专用 Llama 8B')+'">')
      + '<div class="wg-online-actions"><button class="wg-online-btn" id="wg-save-seat" type="button">'+T.saveSeat+'</button>'
      + '<button class="wg-online-btn primary" id="wg-ready" type="button">'+(mine.ready?T.cancelReady:T.ready)+'</button>'
      + (host ? '<button class="wg-online-btn primary" id="wg-lock" type="button"'+(!allReady || !roomFull || state.room.status!=='lobby'?' disabled':'')+'>'+T.lock+'</button>' : '')
      + '<button class="wg-online-btn danger" id="wg-leave" type="button">'+T.leave+'</button></div>'
      + ((!allReady || !roomFull) && host && state.room.status === 'lobby' ? '<div class="wg-online-note">'+MT.fullRequired+'</div>' : '') + '</section>'
      + providerHTML(mine)
      + (host ? fillStrategyHTML() : '')
      + chatHTML();
    $('wg-copy-code').onclick = copyCode;
    $('wg-save-seat').onclick = () => updateSeat(mine.ready);
    $('wg-ready').onclick = () => updateSeat(!mine.ready);
    $('wg-save-provider').onclick = updateProvider;
    $('wg-can-host-ai').addEventListener('change', syncProviderControls);
    syncProviderControls();
    $('wg-apply-fill') && ($('wg-apply-fill').onclick = applyFillStrategy);
    $('wg-lock') && ($('wg-lock').onclick = lockRoom);
    $('wg-leave').onclick = leaveRoom;
    $('wg-chat-send').onclick = sendChat;
    $('wg-chat-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat(); } });
    const log = $('wg-chat-log'); if (log) log.scrollTop = log.scrollHeight;
  }

  function memberHTML(member, seat) {
    const active = Date.now() - new Date(member.last_seen_at).getTime() < 50000;
    const labels = [];
    if (member.user_id === state.room.host_id) labels.push(T.host);
    if (member.user_id === state.user.id) labels.push(T.me);
    const controller = member.controller_type === 'personal_ai' ? T.personalAI : member.controller_type === 'hosted_ai' ? T.hostedAI : T.human;
    return '<div class="wg-seat'+(member.user_id===state.user.id?' mine':'')+'"><div class="wg-seat-name"><i class="wg-online-dot '+(active?'on':'')+'"></i>'
      + '<span>'+esc(member.display_name)+'</span>'+(member.ready?'<span class="wg-ready">'+T.ready+'</span>':'')+'</div>'
      + '<div class="wg-seat-sub">'+T.seat+' '+seat+' · '+esc(controller)+(member.model_label?' · '+esc(member.model_label):'')
      +(labels.length?' · '+labels.join(' / '):'')+'</div></div>';
  }

  function aiSeatHTML(aiSeat, seat) {
    const provider = state.members.find(member => member.user_id === aiSeat.provider_user_id);
    const scheduling = provider?.request_mode === 'parallel' ? MT.concurrent : MT.serial;
    return '<div class="wg-seat ai"><div class="wg-seat-name"><i class="wg-online-dot on"></i>'
      + '<span>'+esc(aiSeat.display_name)+'</span><span class="wg-ready">'+MT.aiSeat+'</span></div>'
      + '<div class="wg-seat-sub">'+T.seat+' '+seat+' · '+MT.providedBy+' '+esc(provider?.display_name || '—')
      +(aiSeat.model_label?' · '+esc(aiSeat.model_label):'')+' · '+scheduling+'</div></div>';
  }

  function providerHTML(mine) {
    const capacityOptions = Array.from({length:15},(_,i) => i+1)
      .map(n => '<option value="'+n+'"'+(Number(mine.max_ai_seats||0)===n?' selected':'')+'>'+n+'</option>').join('');
    return '<section class="wg-online-card wg-room-settings"><h4>'+MT.provider+'</h4>'
      + '<label class="wg-provider-toggle"><input type="checkbox" id="wg-can-host-ai"'+(mine.can_host_ai?' checked':'')+'><span>'+MT.contribute+'</span></label>'
      + '<div class="wg-online-grid">'
      + field(MT.capacity,'<select id="wg-ai-capacity">'+capacityOptions+'</select>')
      + field(MT.requestMode,'<select id="wg-request-mode"><option value="queue"'+(mine.request_mode!=='parallel'?' selected':'')+'>'+MT.queue+'</option><option value="parallel"'+(mine.request_mode==='parallel'?' selected':'')+'>'+MT.parallel+'</option></select>')
      + '</div><div class="wg-online-note">'+MT.providerHint+'</div>'
      + '<div class="wg-online-actions"><button class="wg-online-btn" id="wg-save-provider" type="button">'+MT.saveProvider+'</button></div></section>';
  }

  function fillStrategyHTML() {
    const mode = state.room.fill_mode || 'wait';
    const capacity = state.members.filter(member => member.can_host_ai).reduce((sum,member) => sum+Number(member.max_ai_seats||0),0);
    return '<section class="wg-online-card wg-room-settings"><h4>'+MT.fillTitle+'</h4>'
      + field(MT.fillMode,'<select id="wg-fill-mode"><option value="wait"'+(mode==='wait'?' selected':'')+'>'+MT.wait+'</option><option value="host_fill"'+(mode==='host_fill'?' selected':'')+'>'+MT.hostFill+'</option><option value="balanced"'+(mode==='balanced'?' selected':'')+'>'+MT.balanced+'</option></select>')
      + '<div class="wg-online-note">'+MT.fillHint+'<br>'+MT.capacityLabel+': '+capacity+'</div>'
      + '<div class="wg-online-actions"><button class="wg-online-btn primary" id="wg-apply-fill" type="button">'+MT.applyFill+'</button></div></section>';
  }

  function controllerOptions(selected) {
    return [['human',T.human],['personal_ai',T.personalAI],['hosted_ai',T.hostedAI]].map(([value,label]) => '<option value="'+value+'"'+(value===selected?' selected':'')+'>'+label+'</option>').join('');
  }

  function syncProviderControls() {
    const enabled = !!$('wg-can-host-ai')?.checked;
    if ($('wg-ai-capacity')) $('wg-ai-capacity').disabled = !enabled;
    if ($('wg-request-mode')) $('wg-request-mode').disabled = !enabled;
  }

  function chatHTML() {
    const lines = state.messages.length ? state.messages.map(message => {
      const text = typeof message.body === 'object' ? message.body?.text : message.body;
      if (message.kind === 'system') return '<div class="wg-chat-line system">'+esc(text)+'</div>';
      const sender = state.members.find(member => member.user_id === message.sender_id);
      return '<div class="wg-chat-line"><b>'+esc(sender?.display_name || '—')+'</b>'+esc(text)+'</div>';
    }).join('') : '<div class="wg-chat-line system">'+T.emptyChat+'</div>';
    return '<section class="wg-online-chat"><h4>'+T.chat+'</h4><div class="wg-chat-log" id="wg-chat-log">'+lines+'</div>'
      + '<div class="wg-chat-compose"><input id="wg-chat-input" maxlength="500" autocomplete="off"><button class="wg-online-btn" id="wg-chat-send" type="button">'+T.send+'</button></div></section>';
  }

  async function updateSeat(ready) {
    const displayName = cleanName($('wg-seat-name').value);
    const controller = $('wg-seat-controller').value;
    const modelLabel = cleanName($('wg-model-label').value).slice(0, 40);
    if (!displayName) return;
    setBusy(true);
    try {
      rememberName(displayName);
      await rpc('online_update_member',{p_room_id:state.room.id,p_display_name:displayName,p_controller:controller,p_model_label:modelLabel,p_ready:ready});
      await refreshRoom(state.room.id); renderRoom();
    } catch (error) { state.error = error.message; renderRoom(); }
    finally { setBusy(false); }
  }

  async function updateProvider() {
    const enabled = !!$('wg-can-host-ai')?.checked;
    const capacity = enabled ? Number($('wg-ai-capacity')?.value || 1) : 0;
    const requestMode = $('wg-request-mode')?.value || 'queue';
    setBusy(true);
    try {
      await rpc('online_update_provider',{
        p_room_id:state.room.id,p_can_host_ai:enabled,p_max_ai_seats:capacity,p_request_mode:requestMode
      });
      await refreshRoom(state.room.id); renderRoom();
    } catch (error) { state.error = error.message; renderRoom(); }
    finally { setBusy(false); }
  }

  async function applyFillStrategy() {
    const fillMode = $('wg-fill-mode')?.value || 'wait';
    setBusy(true);
    try {
      await rpc('online_configure_ai_fill',{p_room_id:state.room.id,p_fill_mode:fillMode});
      await refreshRoom(state.room.id); renderRoom();
    } catch (error) { state.error = error.message; renderRoom(); }
    finally { setBusy(false); }
  }

  async function lockRoom() {
    setBusy(true);
    try { await rpc('online_start_room',{p_room_id:state.room.id}); await refreshRoom(state.room.id); renderRoom(); }
    catch (error) { state.error = error.message; renderRoom(); }
    finally { setBusy(false); }
  }

  async function leaveRoom() {
    if (!confirm(T.confirmLeave)) return;
    await leaveRoomNow();
  }

  async function leaveRoomNow() {
    if (!state.room) return;
    const roomId = state.room.id;
    setBusy(true);
    try { await rpc('online_leave_room',{p_room_id:roomId}); }
    catch (error) { state.error = error.message; }
    finally { clearRoomState(); renderHome(); setBusy(false); }
  }

  async function sendChat() {
    const input = $('wg-chat-input');
    const text = String(input.value || '').trim().slice(0, 500);
    if (!text) return;
    input.value = '';
    const {error} = await state.client.from('online_room_messages').insert({room_id:state.room.id,sender_id:state.user.id,kind:'chat',body:{text}});
    if (error) { state.error = error.message; renderRoom(); }
  }

  async function copyCode() {
    const text = state.room?.code || '';
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    }
    const btn = $('wg-copy-code'); if (btn) { btn.textContent = T.copied; setTimeout(() => { if (btn) btn.textContent = T.copy; }, 1200); }
  }

  function saveRoom(id, code) {
    try { localStorage.setItem(roomKey, JSON.stringify({id,code,userId:state.user?.id || '',savedAt:Date.now()})); } catch (_) {}
    try { sessionStorage.removeItem(roomKey); } catch (_) {}
    updateEntryState();
  }
  function readSavedRoom() {
    try {
      const saved = JSON.parse(localStorage.getItem(roomKey) || sessionStorage.getItem(roomKey) || 'null');
      if (saved?.userId && state.user?.id && saved.userId !== state.user.id) return null;
      if (saved?.id && !localStorage.getItem(roomKey)) localStorage.setItem(roomKey, JSON.stringify({...saved,userId:state.user?.id || ''}));
      return saved;
    } catch (_) { return null; }
  }
  function clearSavedRoom() {
    try { localStorage.removeItem(roomKey); } catch (_) {}
    try { sessionStorage.removeItem(roomKey); } catch (_) {}
    updateEntryState();
  }
  function clearRoomState() {
    if (state.channel && state.client) state.client.removeChannel(state.channel);
    clearInterval(state.heartbeat); clearTimeout(state.refreshTimer);
    removeNativeBackGuard();
    state.channel = null; state.heartbeat = null; state.room = null; state.members = []; state.aiSeats = []; state.messages = [];
    clearSavedRoom();
  }

  function installHistoryGuard() {
    if (isNative || !hasActiveRoom()) return;
    if (!history.state?.wgOnlineRoomGuard) {
      history.pushState({...history.state,wgOnlineRoomGuard:true},'',location.href);
    }
  }

  async function installNativeBackGuard() {
    const app = window.Capacitor?.Plugins?.App;
    if (!isNative || !app?.addListener || state.nativeBackHandle) return;
    try {
      state.nativeBackHandle = await app.addListener('backButton', event => {
        if (!hasActiveRoom()) {
          if ($('wg-online-overlay')?.classList.contains('show')) closeLobby();
          else if (event?.canGoBack) history.back();
          else app.exitApp?.();
          return;
        }
        showExitConfirm(async () => {
          await leaveRoomNow();
          app.exitApp?.();
        });
      });
    } catch (_) {}
  }

  function removeNativeBackGuard() {
    try { state.nativeBackHandle?.remove?.(); } catch (_) {}
    state.nativeBackHandle = null;
  }

  function installExitProtection() {
    installHistoryGuard();
    installNativeBackGuard();
  }

  function onBeforeUnload(event) {
    if (!hasActiveRoom()) return;
    saveRoom(state.room.id,state.room.code);
    event.preventDefault();
    event.returnValue = '';
  }

  function onHistoryBack() {
    if (allowHistoryExit) {
      allowHistoryExit = false;
      history.back();
      return;
    }
    if (!hasActiveRoom() || isNative) return;
    history.pushState({...history.state,wgOnlineRoomGuard:true},'',location.href);
    showExitConfirm(async () => {
      await leaveRoomNow();
      allowHistoryExit = true;
      history.back();
    });
  }

  async function onVisibilityChange() {
    if (!hasActiveRoom()) return;
    if (document.visibilityState === 'hidden') {
      saveRoom(state.room.id,state.room.code);
      rpc('online_touch_room',{p_room_id:state.room.id}).catch(() => {});
      return;
    }
    try {
      await refreshRoom(state.room.id);
      if (!state.room) return clearRoomState();
      subscribeRoom(state.room.id);
      startHeartbeat(state.room.id);
      renderRoom();
    } catch (error) {
      state.error = error.message || T.reconnect;
      renderRoom();
    }
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    installUI();
    updateEntryState();
    window.addEventListener('beforeunload',onBeforeUnload);
    window.addEventListener('popstate',onHistoryBack);
    document.addEventListener('visibilitychange',onVisibilityChange);
    const ok = await waitForCloud();
    if (ok) {
      state.client.auth.onAuthStateChange((_event, session) => {
        state.user = session?.user || null;
        if (!state.user) clearRoomState();
        updateEntryState();
        if ($('wg-online-overlay')?.classList.contains('show')) state.room ? renderRoom() : renderHome();
      });
      updateEntryState();
      const saved = readSavedRoom();
      if (state.user && saved?.id) {
        try { await enterRoom(saved.id,saved.code); }
        catch (_) { clearRoomState(); }
      }
    }
    if (new URLSearchParams(location.search).has('room')) openLobby();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.WolfOnline = {open:openLobby, close:closeLobby, getState:() => ({room:state.room,members:state.members.slice()})};
})();
