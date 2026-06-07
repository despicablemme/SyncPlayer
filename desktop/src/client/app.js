// SyncPlay - 客户端核心逻辑
// 重构版本 v2：修复同步状态机 + 漂移校准 + 断线重连

(function () {
  'use strict';

  // 从独立模块加载 SyncEngine（浏览器通过 window.SyncPlay，Node 可直接 require）
  const { SyncEngine } = window.SyncPlay || {};

  // ============ 配置 ============
  const CONFIG = {
    // PeerJS 服务器地址（默认走官方公共服务器，可改为自建）
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
        config: {
          iceServers: ICE_SERVERS,
          iceTransportPolicy: 'all',  // 'all' 允许 TURN 中继，'relay' 强制中继
        },
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
