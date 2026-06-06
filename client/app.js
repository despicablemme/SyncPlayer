// SyncPlay - 客户端核心逻辑
// 重构版本 v2：修复同步状态机 + 漂移校准 + 断线重连

(function () {
  'use strict';

  // ============ 配置 ============
  const CONFIG = {
    // PeerJS 服务器地址（默认走官方公共服务器，可改为自建）
    PEER_HOST: '0.peerjs.com',
    PEER_PORT: 443,
    PEER_PATH: '/',
    PEER_SECURE: true,

    // 同步参数
    DRIFT_CHECK_INTERVAL_MS: 10000, // 每 10 秒做一次漂移检查
    DRIFT_THRESHOLD_SEC: 0.5,       // 偏移超过 0.5 秒才校正
    HEARTBEAT_INTERVAL_MS: 5000,    // 心跳 5 秒一次

    // 重连参数
    RECONNECT_DELAY_MS: 2000,
    MAX_RECONNECT_ATTEMPTS: 5,
  };

  // ============ 工具函数 ============

  /** 用 crypto 生成房间号（密码学安全） */
  function generateRoomId() {
    if (window.crypto && window.crypto.randomUUID) {
      return 'room-' + window.crypto.randomUUID().split('-')[0];
    }
    return 'room-' + Math.random().toString(36).substring(2, 10);
  }

  /** Toast 通知（替代 alert） */
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

  // ============ 同步引擎 ============

  /**
   * 同步协议消息类型
   *  - play/pause/seek: 同步指令
   *  - heartbeat: 心跳（用于测量延迟）
   *  - drift_check: 漂移检查
   *  - file_info: 视频文件元信息（用于校验两端是否同一文件）
   */
  class SyncEngine {
    constructor(video, send) {
      this.video = video;
      this.send = send;
      this.guardUntil = 0;          // 接收方：在 guardUntil 之前忽略本地事件
      this.heartbeatTs = 0;         // 上次心跳的本地时间戳
      this.lastRtt = -1;            // 最近一次往返延迟
      this.driftOffset = 0;         // 漂移偏移（我与对方的 currentTime 之差）
      this.driftTimer = null;
      this.heartbeatTimer = null;
      this.bindVideoEvents();
    }

    bindVideoEvents() {
      // 收到远程同步指令时设置一个"屏蔽窗口"，期间本地事件不上报
      this.video.addEventListener('play', () => this.maybeSend('play'));
      this.video.addEventListener('pause', () => this.maybeSend('pause'));
      this.video.addEventListener('seeked', () => this.maybeSend('seek'));
    }

    /** 判断是否需要发送本地事件（屏蔽窗口内不发） */
    maybeSend(type) {
      if (Date.now() < this.guardUntil) return;
      this.send({
        type,
        position: this.video.currentTime,
        t: Date.now(),
      });
    }

    /** 处理远端同步指令 */
    handle(msg) {
      if (!msg || !msg.type) return;
      const now = Date.now();

      switch (msg.type) {
        case 'play':
        case 'pause': {
          // 屏蔽窗口：屏蔽 200ms 内的本地事件回环
          this.guardUntil = now + 200;
          // 仅当偏差较大时强制跳转，避免抖动
          if (Math.abs(this.video.currentTime - msg.position) > 0.3) {
            this.video.currentTime = msg.position;
          }
          if (msg.type === 'play' && this.video.paused) this.video.play().catch(() => {});
          if (msg.type === 'pause' && !this.video.paused) this.video.pause();
          break;
        }

        case 'seek': {
          this.guardUntil = now + 200;
          if (Math.abs(this.video.currentTime - msg.position) > 0.3) {
            this.video.currentTime = msg.position;
          }
          break;
        }

        case 'heartbeat': {
          // 收到心跳：计算 RTT，回传 pong
          this.send({
            type: 'heartbeat_pong',
            origT: msg.t,
            serverT: msg.serverT || now,
            recvT: now,
          });
          break;
        }

        case 'heartbeat_pong': {
          // 收到 pong：rtt = now - origT
          this.lastRtt = now - msg.origT;
          this.updateStats();
          break;
        }

        case 'drift_check': {
          // 对方发来自己的 currentTime + 我回传我的
          this.send({
            type: 'drift_response',
            requestId: msg.requestId,
            myPosition: this.video.currentTime,
            myT: now,
          });
          break;
        }

        case 'drift_response': {
          // 计算漂移
          const remotePos = msg.remotePosition;
          const myPos = msg.myPosition;
          const delta = remotePos - myPos;
          this.driftOffset = delta;
          if (Math.abs(delta) > CONFIG.DRIFT_THRESHOLD_SEC) {
            console.log(`[drift] 校正 ${delta.toFixed(2)}s`);
            this.guardUntil = now + 200;
            this.video.currentTime = remotePos;
          }
          this.updateStats();
          break;
        }

        case 'file_info': {
          // 用于校验两端是否加载同一文件
          const myMeta = `${this.video.duration.toFixed(2)}`;
          const remoteMeta = `${msg.duration.toFixed(2)}`;
          if (myMeta !== remoteMeta) {
            toast('警告：两端视频时长不一致，可能不同步', 'error');
          } else {
            toast('文件校验通过', 'success');
          }
          break;
        }
      }
    }

    start() {
      this.stop();
      this.heartbeatTimer = setInterval(() => {
        this.heartbeatTs = Date.now();
        this.send({ type: 'heartbeat', t: this.heartbeatTs, serverT: this.heartbeatTs });
      }, CONFIG.HEARTBEAT_INTERVAL_MS);

      this.driftTimer = setInterval(() => {
        if (!this.video.paused) {
          const reqId = Math.random().toString(36).substring(2, 8);
          this.send({
            type: 'drift_check',
            requestId: reqId,
            remotePosition: this.video.currentTime,
          });
        }
      }, CONFIG.DRIFT_CHECK_INTERVAL_MS);
    }

    stop() {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.driftTimer) clearInterval(this.driftTimer);
      this.heartbeatTimer = null;
      this.driftTimer = null;
    }

    updateStats() {
      const el = document.getElementById('stats');
      if (!el) return;
      el.textContent = `延迟: ${this.lastRtt >= 0 ? this.lastRtt + 'ms' : '—'}  |  漂移: ${this.driftOffset.toFixed(2)}s`;
    }
  }

  // ============ 连接管理（带自动重连） ============

  class ConnectionManager {
    constructor() {
      this.peer = null;
      this.conn = null;
      this.myPeerId = null;
      this.targetPeerId = null;
      this.isInitiator = false;
      this.reconnectAttempts = 0;
      this.engine = null;
      this.onSync = null; // 回调：把消息交给 SyncEngine
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
      };

      this.peer = new Peer(this.myPeerId, peerOpts);
      this.engine = new SyncEngine(video, (msg) => this.send(msg));

      this.peer.on('open', (id) => {
        console.log('[peer] open', id);
        updateLocalStatus(this.isInitiator ? '等待对方加入...' : '正在连接...', 'waiting');

        if (!this.isInitiator) {
          this.connectToPeer();
        }
      });

      this.peer.on('connection', (conn) => {
        console.log('[peer] 收到入站连接');
        this.acceptConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[peer] error', err);
        const msg = err.type === 'peer-unavailable'
          ? '对方房间号不存在或未上线'
          : 'PeerJS 错误: ' + err.message;
        toast(msg, 'error');
        updateLocalStatus('连接错误', 'disconnected');
        this.handleDisconnect();
      });

      this.peer.on('disconnected', () => {
        console.warn('[peer] disconnected, attempting reconnect');
        toast('信令服务器断开，正在重连...', 'error');
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
        updateLocalStatus('已连接', 'connected');
        updateRemoteStatus('已连接', 'connected');
        this.reconnectAttempts = 0;
        this.engine.start();

        // 连接建立后告知对方我的文件元信息
        const video = this.engine.video;
        if (video.duration && !isNaN(video.duration)) {
          this.send({ type: 'file_info', duration: video.duration });
        }
      });

      conn.on('data', (data) => {
        this.engine.handle(data);
      });

      conn.on('close', () => {
        console.warn('[conn] close');
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
      if (this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
        toast('重连失败，请重新加入房间', 'error');
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

  let connMgr = null;

  // 视频加载
  function loadVideo(src, label) {
    fileName.textContent = label;
    video.src = src;
    video.style.display = 'block';
    noVideo.style.display = 'none';
    video.load();
  }

  videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      loadVideo(url, '本地: ' + file.name);
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

  video.addEventListener('loadedmetadata', () => {
    if (fileName.textContent.startsWith('加载中')) {
      fileName.textContent = '已加载: ' + videoUrlInput.value.split('/').pop();
    }
    toast(`视频就绪，时长 ${video.duration.toFixed(1)}s`, 'success');
  });

  video.addEventListener('error', () => {
    fileName.textContent = '视频加载失败';
    toast('视频加载失败，请检查文件或 URL', 'error');
  });

  // 房间操作
  function ensureVideoReady() {
    if (!video.src) {
      toast('请先选择视频或输入 URL', 'error');
      return false;
    }
    return true;
  }

  function disableRoomButtons() {
    createBtn.disabled = true;
    joinBtn.disabled = true;
  }

  function startSession(isInitiator, targetRoomId) {
    if (!ensureVideoReady()) return;
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

  // 初始状态
  updateLocalStatus('就绪', '');
  updateRemoteStatus('未连接', '');

  // 暴露给调试
  window.__syncplay = { connMgr: () => connMgr };
})();
