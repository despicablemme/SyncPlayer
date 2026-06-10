// SyncPlay - 客户端核心逻辑
// 重构版本 v2: 修复同步状态机 + 漂移校准 + 断线重连
// v0.6 FR-3: 房间状态机重构 (6 态) + 解耦视频与房间 + 视频不匹配提示

(function () {
  'use strict';

  // 从独立模块加载 SyncEngine(浏览器通过 window.SyncPlay,Node 可直接 require)
  const { SyncEngine } = window.SyncPlay || {};
  // v0.6 FR-3: 房间状态机 + 视频匹配
  const { STATES: ROOM_STATES, RoomStateMachine } = window.SyncPlayRoomState || {};
  const { videosMatch, describeVideo, emptyVideoInfo } = window.SyncPlayVideoMatch || {};

  // ============ 配置 ============
  const CONFIG = {
    // PeerJS 服务器地址(默认走官方公共服务器,可改为自建)
    PEER_HOST: '0.peerjs.com',
    PEER_PORT: 443,
    PEER_PATH: '/',
    PEER_SECURE: true,

    // 重连参数
    RECONNECT_DELAY_MS: 2000,
    MAX_RECONNECT_ATTEMPTS: 5,
  };

  // ============ ICE 服务器配置 ============
  // 📌 加载顺序(config 文件必须在 app.js 之前):
  //    1. config.local.js   (git 忽略,放真凭据,可选)
  //    2. config.template.js (占位符,必备)
  //    3. app.js            (本文件,读 window.SYNCPLAY_ICE_SERVERS)
  // 📌 如果两个 config 文件都加载失败(理论不应发生),用最后的兜底占位符
  //    这种情况下 TURN 中继不会工作,只能 STUN 直连。
  const ICE_SERVERS = window.SYNCPLAY_ICE_SERVERS || [
    { urls: 'stun:global.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80',  username: '__TURN_USERNAME__', credential: '__TURN_CREDENTIAL__' },
    { urls: 'turn:global.relay.metered.ca:443', username: '__TURN_USERNAME__', credential: '__TURN_CREDENTIAL__' },
    { urls: 'turns:global.relay.metered.ca:443', username: '__TURN_USERNAME__', credential: '__TURN_CREDENTIAL__' },
  ];

  // ============ 工具函数 ============

  /** 用 crypto 生成房间号(密码学安全) */
  function generateRoomId() {
    if (window.crypto && window.crypto.randomUUID) {
      return 'room-' + window.crypto.randomUUID().split('-')[0];
    }
    return 'room-' + Math.random().toString(36).substring(2, 10);
  }

  /** Toast 通知(替代 alert) */
  function toast(msg, type = 'info') {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.className = 'toast';
    }, 3000);
  }

  function updateLocalStatus(text, state) {
    document.getElementById('localStatus').textContent = text;
    document.getElementById('localStatusDot').className = 'status-dot ' + state;
  }

  function updateRemoteStatus(text, state) {
    document.getElementById('remoteStatus').textContent = text;
    document.getElementById('remoteStatusDot').className = 'status-dot ' + state;
  }

  /** 把 HTMLMediaElement.error.code 翻成人话 (FR-2 错误提示)
   *  1=ABORTED  2=NETWORK (CORS/断网)  3=DECODE (格式/损坏)  4=SRC_NOT_SUPPORTED
   */
  function describeVideoError(err) {
    if (!err) return '未知错误';
    switch (err.code) {
      case 1: return '加载被中止';
      case 2: return '网络错误(URL 不通 / CORS 拦截 / Mixed Content)';
      case 3: return '视频解码失败(格式不支持或文件损坏)';
      case 4: return '视频源不支持(浏览器无法播放该格式, HLS 可能需要 Safari 或 hls.js)';
      default: return err.message || '未知错误(code=' + (err.code || '?') + ')';
    }
  }

  /** v0.6.1 FR-4: HTML 转义,防 XSS */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  /** v0.6.1 FR-4: 友好时间显示 */
  function formatTime(ts) {
    const d = new Date(ts);
    const now = Date.now();
    const diff = (now - ts) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff/60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff/3600)} 小时前`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)} 天前`;
    return d.toLocaleDateString('zh-CN');
  }

  // ============ v0.6.1 FR-4: 视频历史记录 ============
  // 守卫: web 浏览器 (无 electron) 时静默跳过所有调用
  const videoHistory = {
    list: [],

    async refresh() {
      if (!window.desktopAPI?.videoHistory) return;
      this.list = await window.desktopAPI.videoHistory.get();
      this.render();
    },

    async addLocal(file) {
      if (!window.desktopAPI?.videoHistory) return;
      const path = window.desktopAPI.getPathForFile(file);
      if (!path) return; // Electron < 30 不支持, 跳过
      await window.desktopAPI.videoHistory.add({
        type: 'local',
        path: path,
        name: file.name,
        size: file.size,
        mtime: file.lastModified,
        addedAt: Date.now(),
      });
      await this.refresh();
    },

    async addUrl(url) {
      if (!window.desktopAPI?.videoHistory) return;
      const title = (url.split('/').pop() || '').split('?')[0] || url;
      await window.desktopAPI.videoHistory.add({
        type: 'url',
        url: url,
        title: title,
        addedAt: Date.now(),
      });
      await this.refresh();
    },

    async remove(addedAt) {
      if (!window.desktopAPI?.videoHistory) return;
      await window.desktopAPI.videoHistory.remove(addedAt);
      await this.refresh();
    },

    async clear() {
      if (!confirm('确定清空所有视频历史? 此操作不可恢复。')) return;
      if (!window.desktopAPI?.videoHistory) return;
      await window.desktopAPI.videoHistory.clear();
      await this.refresh();
    },

    async checkExists(path) {
      if (!window.desktopAPI?.videoHistory) return false;
      return await window.desktopAPI.videoHistory.checkExists(path);
    },

    render() {
      const countEl = document.getElementById('videoHistoryCount');
      const listEl = document.getElementById('videoHistoryList');
      if (!countEl || !listEl) return;

      countEl.textContent = this.list.length;

      if (this.list.length === 0) {
        listEl.innerHTML = '<div class="video-history-empty">暂无历史</div>';
        return;
      }

      // 渲染列表
      listEl.innerHTML = this.list.map(item => {
        if (item.type === 'local') {
          return `
            <div class="video-history-item" data-added-at="${item.addedAt}">
              <div class="video-history-icon">📁</div>
              <div class="video-history-info">
                <div class="video-history-name">${escapeHtml(item.name)}</div>
                <div class="video-history-path">${escapeHtml(item.path)}</div>
                <div class="video-history-time">${formatTime(item.addedAt)}</div>
              </div>
              <button class="video-history-remove" data-action="remove" title="删除">×</button>
            </div>
          `;
        } else {
          return `
            <div class="video-history-item" data-added-at="${item.addedAt}">
              <div class="video-history-icon">🌐</div>
              <div class="video-history-info">
                <div class="video-history-name">${escapeHtml(item.title)}</div>
                <div class="video-history-path">${escapeHtml(item.url)}</div>
                <div class="video-history-time">${formatTime(item.addedAt)}</div>
              </div>
              <button class="video-history-remove" data-action="remove" title="删除">×</button>
            </div>
          `;
        }
      }).join('');

      // 启动时检测本地文件失效
      this.markMissing();
    },

    async markMissing() {
      // 遍历本地项, 调 checkExists, 失效标灰
      const items = document.querySelectorAll('.video-history-item');
      for (const item of items) {
        const addedAt = parseInt(item.dataset.addedAt);
        const data = this.list.find(x => x.addedAt === addedAt);
        if (!data || data.type !== 'local') continue;
        const exists = await this.checkExists(data.path);
        if (!exists) {
          item.classList.add('video-history-missing');
          item.title = '⚠️ 文件已移动或删除';
          item.style.pointerEvents = 'none';
          item.style.opacity = '0.5';
        }
      }
    },
  };

  // ============ 连接管理(带自动重连) ============

  class ConnectionManager {
    constructor() {
      this.peer = null;
      this.conn = null;
      this.myPeerId = null;
      this.targetPeerId = null;
      this.isInitiator = false;
      this.reconnectAttempts = 0;
      this.engine = null;
      this.onSync = null; // 回调:把消息交给 SyncEngine
      this.destroyed = false; // 用户主动退出后,屏蔽 PeerJS 触发的错误/重连噪音
    }

    init(isInitiator, targetPeerId, video) {
      this.isInitiator = isInitiator;
      this.targetPeerId = targetPeerId;
      this.myPeerId = generateRoomId();

      const peerOpts = {
        host: CONFIG.PEER_HOST,
        port: CONFIG.PEER_PORT,
        path: CONFIG.PEER_PATH,
        secure: CONFIG.PEER_SECURE,
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
          iceTransportPolicy: 'all',  // 'all' 允许 TURN 中继,'relay' 强制中继
        },
      };

      this.peer = new Peer(this.myPeerId, peerOpts);
      this.engine = new SyncEngine(video, (msg) => this.send(msg));

      this.peer.on('open', (id) => {
        console.log('[peer] open', id);
        updateLocalStatus('等待对方加入...', 'waiting');

        if (!this.isInitiator) {
          this.connectToPeer();
        }
      });

      this.peer.on('connection', (conn) => {
        console.log('[peer] 收到入站连接');
        this.acceptConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (this.destroyed) return;
        console.error('[peer] error', err);
        const msg = err.type === 'peer-unavailable'
          ? '对方房间号不存在或未上线'
          : 'PeerJS 错误: ' + err.message;
        toast(msg, 'error');
        updateLocalStatus('连接错误', 'disconnected');
        this.handleDisconnect();
      });

      this.peer.on('disconnected', () => {
        if (this.destroyed) return;
        console.warn('[peer] disconnected, attempting reconnect');
        toast('信令服务器断开,正在重连...', 'error');
        updateLocalStatus('信令重连中...', 'waiting');
        this.peer.reconnect();
      });
    }

    connectToPeer() {
      if (!this.peer || !this.targetPeerId) return;
      this.conn = this.peer.connect(this.targetPeerId, { reliable: true });
      this.bindConnection(this.conn);
    }

    acceptConnection(conn) {
      this.conn = conn;
      this.bindConnection(conn);
    }

    bindConnection(conn) {
      conn.on('open', () => {
        console.log('[conn] open');
        this.reconnectAttempts = 0;
        // v0.6 FR-3: 不再无条件 engine.start() — 改成"进入 in_room_synced 才启动"
        // 同步指令 gating 由 roomState 的 listener 控制 (见下面 attachRoomState)
        // 连接刚开时: 我有 video → 对方有没有还不知道; 我没 video → 等对方先 video_info
        onConnOpen();
      });

      conn.on('data', (data) => {
        // v0.6 FR-3: video_info 走自己的处理, 不进 SyncEngine (engine 不认识这个 type)
        if (data && data.type === 'video_info') {
          onPeerVideoInfo(data);
          return;
        }
        this.engine.handle(data);
      });

      conn.on('close', () => {
        if (this.destroyed) return;
        console.warn('[conn] close');
        // v0.6 FR-3: peer lost → 状态机切回 connecting (还在房间里, 等待重连)
        onConnClose();
        updateRemoteStatus('已断开', 'disconnected');
        this.engine.stop();
        this.attemptReconnect();
      });

      conn.on('error', (err) => {
        console.error('[conn] error', err);
        toast('连接错误: ' + err.message, 'error');
      });
    }

    send(msg) {
      if (this.conn && this.conn.open) {
        this.conn.send(msg);
      }
    }

    attemptReconnect() {
      if (this.destroyed) return;
      if (this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
        toast('重连失败,请重新加入房间', 'error');
        return;
      }
      this.reconnectAttempts++;
      const delay = CONFIG.RECONNECT_DELAY_MS * this.reconnectAttempts;
      toast(`将在 ${delay / 1000}s 后尝试重连 (${this.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS})`, 'error');
      setTimeout(() => {
        if (this.peer && !this.peer.destroyed) {
          if (this.isInitiator) {
            // 创建方只需要重新监听连接
            updateLocalStatus('等待对方重新连接...', 'waiting');
          } else {
            this.connectToPeer();
          }
        }
      }, delay);
    }

    handleDisconnect() {
      this.engine && this.engine.stop();
    }

    destroy() {
      this.destroyed = true;
      this.engine && this.engine.stop();
      this.conn && this.conn.close();
      this.peer && this.peer.destroy();
    }
  }

  // ============ UI 初始化 ============

  const video = document.getElementById('video');
  const videoInput = document.getElementById('videoInput');
  const videoUrlInput = document.getElementById('videoUrlInput');
  const loadUrlBtn = document.getElementById('loadUrlBtn');
  const fileName = document.getElementById('fileName');
  const noVideo = document.getElementById('noVideo');
  const roomIdInput = document.getElementById('roomIdInput');
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const roomInfo = document.getElementById('roomInfo');
  const roomLabel = document.getElementById('roomLabel');
  const myRoomId = document.getElementById('myRoomId');
  const copyBtn = document.getElementById('copyBtn');
  const exitBtn = document.getElementById('exitBtn');

  let connMgr = null;

  // ============ v0.6 FR-3: 房间状态机 + 视频信息同步 ============

  // 房间状态机 (6 态)
  const roomState = new RoomStateMachine();

  // 视频信息: 我端 + 对端
  let myVideoInfo = null;   // {url?, fileName?, duration?, loaded: true|false}
  let peerVideoInfo = null; // 对端发来的, 同结构

  /**
   * 状态 → UI 文案 + dot class + mismatch-warning class
   * 与 REQUIREMENTS.md FR-3 段 + 任务书"6 个状态"对应
   */
  const STATE_DISPLAY = {
    [ROOM_STATES.NO_ROOM]: {
      localText: '请创建或加入房间',
      localClass: '',
      remoteText: '未连接',
      remoteClass: '',
      mismatch: false,
    },
    [ROOM_STATES.CONNECTING]: {
      localText: '连接中...',
      localClass: 'waiting',
      remoteText: '对方未连接',
      remoteClass: '',
      mismatch: false,
    },
    [ROOM_STATES.IN_ROOM_NO_VIDEO]: {
      localText: '已连接, 请加载视频',
      localClass: 'connected',
      remoteText: '已连接',
      remoteClass: 'connected',
      mismatch: false,
    },
    [ROOM_STATES.IN_ROOM_WAITING_PEER_VIDEO]: {
      localText: '等待对方加载视频...',
      localClass: 'waiting',
      remoteText: '已连接',
      remoteClass: 'connected',
      mismatch: false,
    },
    [ROOM_STATES.IN_ROOM_SYNCED]: {
      localText: '已同步',
      localClass: 'connected',
      remoteText: '已连接',
      remoteClass: 'connected',
      mismatch: false,
    },
    [ROOM_STATES.IN_ROOM_MISMATCH]: {
      localText: '视频不匹配, 无法同步进度',
      localClass: 'disconnected',
      remoteText: '已连接',
      remoteClass: 'connected',
      mismatch: true, // 红色警告
    },
  };

  /** 设置我的视频信息 + 广播给对端 + 重新计算状态 */
  function setMyVideoInfo(info) {
    myVideoInfo = info;
    // 立即告诉对端 (如果连接还在)
    if (connMgr && connMgr.send) {
      connMgr.send({
        type: 'video_info',
        loaded: !!(info && info.loaded),
        url: info && info.url,
        fileName: info && info.fileName,
        duration: info && info.duration,
      });
    }
    recomputeRoomState();
  }

  /** 收到对端 video_info → 更新 + 重算 */
  function onPeerVideoInfo(data) {
    peerVideoInfo = {
      loaded: !!(data && data.loaded),
      url: data && data.url,
      fileName: data && data.fileName,
      duration: data && data.duration,
    };
    recomputeRoomState();
  }

  /** conn.on('open') 时: 重算状态 (从 connecting → in_room_no_video 或其他) */
  function onConnOpen() {
    recomputeRoomState();
    // 如果我已经加载视频, 主动把我的 video_info 发给对方
    if (myVideoInfo && myVideoInfo.loaded && connMgr) {
      connMgr.send({
        type: 'video_info',
        loaded: true,
        url: myVideoInfo.url,
        fileName: myVideoInfo.fileName,
        duration: myVideoInfo.duration,
      });
    }
  }

  /** conn.on('close') 时: peer lost, 清空 peer info + 切回 connecting */
  function onConnClose() {
    peerVideoInfo = null;
    if (roomState.state !== ROOM_STATES.NO_ROOM) {
      roomState.setState(ROOM_STATES.CONNECTING);
    }
  }

  /**
   * 核心: 根据"我端视频" + "对端视频" + "连接状态" 计算房间状态
   * - 没 connMgr / 没连接 → no_room 或 connecting
   * - 连接开了但都没/有一方视频 → in_room_no_video / waiting_peer
   * - 双方都有视频 → synced 或 mismatch
   */
  function recomputeRoomState() {
    if (!connMgr) {
      roomState.setState(ROOM_STATES.NO_ROOM);
      return;
    }
    // 连接是否真的开了? (conn.open 是 DataConnection 的属性)
    const isOpen = !!(connMgr.conn && connMgr.conn.open);
    if (!isOpen) {
      // 还在 connecting (首次连或重连中)
      if (roomState.state === ROOM_STATES.NO_ROOM) {
        // 还没开始 session, 保持 no_room
        return;
      }
      roomState.setState(ROOM_STATES.CONNECTING);
      return;
    }

    // 连接已开, 计算视频子状态
    const myLoaded = !!(myVideoInfo && myVideoInfo.loaded);
    const peerLoaded = !!(peerVideoInfo && peerVideoInfo.loaded);

    if (!myLoaded) {
      roomState.setState(ROOM_STATES.IN_ROOM_NO_VIDEO);
    } else if (!peerLoaded) {
      roomState.setState(ROOM_STATES.IN_ROOM_WAITING_PEER_VIDEO);
    } else {
      // 双方都加载了 — 校验匹配
      if (videosMatch(myVideoInfo, peerVideoInfo)) {
        roomState.setState(ROOM_STATES.IN_ROOM_SYNCED);
      } else {
        roomState.setState(ROOM_STATES.IN_ROOM_MISMATCH);
      }
    }
  }

  /**
   * 状态变化 listener: UI 更新 + sync engine gating
   * (per FR-3: 同步指令只在 in_room_synced 时发送)
   */
  roomState.onStateChange((newState, oldState) => {
    // 1. UI 显示
    const display = STATE_DISPLAY[newState];
    if (display) {
      updateLocalStatus(display.localText, display.localClass);
      if (display.remoteText) {
        updateRemoteStatus(display.remoteText, display.remoteClass);
      }
      const localStatusEl = document.getElementById('localStatus');
      if (localStatusEl) {
        localStatusEl.classList.toggle('mismatch-warning', !!display.mismatch);
      }
    }

    // 2. SyncEngine gating — 只有 in_room_synced 才启动, 离开就停
    if (connMgr && connMgr.engine) {
      if (newState === ROOM_STATES.IN_ROOM_SYNCED) {
        connMgr.engine.start();
      } else if (oldState === ROOM_STATES.IN_ROOM_SYNCED) {
        connMgr.engine.stop();
      }
    }

    // 3. mismatch toast (从非 mismatch → mismatch 切过来时提示一次)
    if (newState === ROOM_STATES.IN_ROOM_MISMATCH && oldState !== ROOM_STATES.IN_ROOM_MISMATCH) {
      toast('视频不匹配, 无法同步进度', 'error');
    }
  });

  // ============ 视频加载 (FR-2 修 URL 加载 bug + FR-3 解耦) ============

  // 关键修复 (FR-2):
  //   1. 切换 src 前先 pause + removeAttribute('src') + load(), 避免浏览器保留旧 src 状态
  //   2. HLS/m3u8 URL 走 canPlayType 能力检测, 不支持时给清晰提示(不黑屏)
  //   3. 不在 src= 后立即再调 load() (会 abort + reload, 偶发 race)
  // FR-3 扩展:
  //   4. 解耦: 视频加载完全独立于房间 (loadedmetadata 时更新 myVideoInfo 并广播)
  function loadVideo(src, label) {
    // 1. 完整 reset: pause + 移除旧 src + load() 触发空载
    try { video.pause(); } catch (e) { /* 元素可能没准备好, 忽略 */ }
    video.removeAttribute('src');
    video.load();

    // 2. HLS / m3u8 能力检测 (Safari 原生支持; Chrome/Firefox 需要 hls.js)
    //    不支持时 toast 警告, 用户知道为什么没画面(避免黑屏困惑)
    if (/\.m3u8(\?.*)?$/i.test(src)) {
      const canHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''
                  || video.canPlayType('application/x-mpegURL') !== '';
      if (!canHls) {
        toast('当前浏览器不支持 HLS 流(m3u8), 请用 Safari 或安装 hls.js', 'error');
      }
    }

    // 3. 设置新 src (浏览器自动 load, 无需再调 video.load())
    fileName.textContent = label;
    video.src = src;
    video.style.display = 'block';
    noVideo.style.display = 'none';
  }

  videoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      loadVideo(url, '本地: ' + file.name);
      await videoHistory.addLocal(file); // v0.6.1 FR-4: 自动写历史
    }
  });

  loadUrlBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      toast('请输入视频 URL', 'error');
      return;
    }
    loadVideo(url, '加载中: ' + url.split('/').pop());
  });

  videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadUrlBtn.click();
  });

  video.addEventListener('loadedmetadata', async () => {
    if (fileName.textContent.startsWith('加载中')) {
      // 去掉 query string, 兜底"视频" 避免空名
      const rawName = (videoUrlInput.value || '').split('/').pop().split('?')[0];
      fileName.textContent = '已加载: ' + (rawName || '视频');
      // v0.6.1 FR-4: URL 加载成功 → 自动写历史
      const url = videoUrlInput.value.trim();
      if (url) await videoHistory.addUrl(url);
    }
    // FR-3: 视频元数据就绪 → 写进 myVideoInfo, 触发状态重算
    const info = describeVideo(video, fileName.textContent);
    setMyVideoInfo(info || emptyVideoInfo());
    if (isFinite(video.duration)) {
      toast(`视频就绪, 时长 ${video.duration.toFixed(1)}s`, 'success');
    }
  });

  video.addEventListener('error', () => {
    // 区分网络 / 解码 / 格式不支持, 给出具体原因(不黑屏困惑)
    const reason = describeVideoError(video.error);
    fileName.textContent = '视频加载失败';
    toast('视频加载失败: ' + reason, 'error');
    console.error('[video] error', video.error);
    // FR-3: 加载失败 → 标记我端无视频
    setMyVideoInfo(emptyVideoInfo());
  });

  // ============ 房间操作 (FR-3: 完全解耦 — 不再强制要求视频先加载) ============

  function disableRoomButtons() {
    createBtn.disabled = true;
    joinBtn.disabled = true;
  }

  function enableRoomButtons() {
    createBtn.disabled = false;
    joinBtn.disabled = false;
  }

  function exitRoom() {
    if (!connMgr) return;
    connMgr.destroy();
    connMgr = null;
    // FR-3: 清空对端 video_info, 切回 no_room, 触发 listener 重置 UI + 停 engine
    peerVideoInfo = null;
    roomState.setState(ROOM_STATES.NO_ROOM);
    enableRoomButtons();
    roomInfo.style.display = 'none';
    myRoomId.textContent = '';
    toast('已退出房间', 'success');
  }

  // FR-3 关键改动: 删掉 ensureVideoReady() 调用 — 视频不再是房间前提
  function startSession(isInitiator, targetRoomId) {
    if (connMgr) connMgr.destroy();

    connMgr = new ConnectionManager();
    connMgr.init(isInitiator, targetRoomId, video);

    if (isInitiator) {
      myRoomId.textContent = connMgr.myPeerId;
      roomLabel.textContent = '我的房间号:';
    } else {
      myRoomId.textContent = targetRoomId;
      roomLabel.textContent = '已连接到:';
    }
    roomInfo.style.display = 'flex';
    disableRoomButtons();
    // FR-3: 显式切到 connecting, 让 UI 立刻进入"连接中..."状态
    roomState.setState(ROOM_STATES.CONNECTING);
  }

  createBtn.addEventListener('click', () => startSession(true, null));
  joinBtn.addEventListener('click', () => {
    const target = roomIdInput.value.trim();
    if (!target) {
      toast('请输入房间号', 'error');
      return;
    }
    startSession(false, target);
  });

  copyBtn.addEventListener('click', () => {
    const text = myRoomId.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast('已复制房间号', 'success'),
      () => toast('复制失败', 'error')
    );
  });

  exitBtn.addEventListener('click', exitRoom);

  // 初始状态
  roomState.setState(ROOM_STATES.NO_ROOM);

  // 暴露给调试
  window.__syncplay = {
    connMgr: () => connMgr,
    roomState: () => roomState,
    myVideoInfo: () => myVideoInfo,
    peerVideoInfo: () => peerVideoInfo,
    STATE_DISPLAY: STATE_DISPLAY,
  };

  // ============ v0.6.1 FR-4: 历史按钮 + 列表事件 ============
  function setupHistoryUI() {
    videoHistory.refresh();

    // 历史按钮 toggle
    const toggleBtn = document.getElementById('videoHistoryToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const list = document.getElementById('videoHistoryList');
        if (!list) return;
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
      });
    }

    // 历史列表点击 (重新加载 / 单条删除)
    const listEl = document.getElementById('videoHistoryList');
    if (listEl) {
      listEl.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('[data-action="remove"]');
        if (removeBtn) {
          e.stopPropagation();
          const item = removeBtn.closest('.video-history-item');
          if (!item) return;
          const addedAt = parseInt(item.dataset.addedAt);
          await videoHistory.remove(addedAt);
          return;
        }
        // 点击 item 本身 → 重新加载
        const item = e.target.closest('.video-history-item');
        if (!item || item.classList.contains('video-history-missing')) return;
        const addedAt = parseInt(item.dataset.addedAt);
        const data = videoHistory.list.find(x => x.addedAt === addedAt);
        if (!data) return;
        if (data.type === 'local') {
          loadVideo('file://' + data.path, '本地: ' + data.name);
        } else {
          loadVideo(data.url, '已加载: ' + data.title);
        }
      });
    }
  }

  // script 在 body 末尾, DOMContentLoaded 还没触发; 跑 readyState 兜底
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHistoryUI);
  } else {
    setupHistoryUI();
  }
})();
