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
        if (this.destroyed) return;
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
      if (this.destroyed) return;
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

  // 视频加载 (FR-2 修 URL 加载 bug)
  // 关键修复:
  //   1. 切换 src 前先 pause + removeAttribute('src') + load(), 避免浏览器保留旧 src 状态
  //   2. HLS/m3u8 URL 走 canPlayType 能力检测, 不支持时给清晰提示(不黑屏)
  //   3. 不在 src= 后立即再调 load() (会 abort + reload, 偶发 race)
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
      // 去掉 query string, 兜底"视频" 避免空名
      const rawName = (videoUrlInput.value || '').split('/').pop().split('?')[0];
      fileName.textContent = '已加载: ' + (rawName || '视频');
    }
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

  function enableRoomButtons() {
    createBtn.disabled = false;
    joinBtn.disabled = false;
  }

  function exitRoom() {
    if (!connMgr) return;
    connMgr.destroy();
    connMgr = null;
    enableRoomButtons();
    roomInfo.style.display = 'none';
    myRoomId.textContent = '';
    updateLocalStatus('就绪', '');
    updateRemoteStatus('未连接', '');
    toast('已退出房间', 'success');
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

  exitBtn.addEventListener('click', exitRoom);

  // 初始状态
  updateLocalStatus('就绪', '');
  updateRemoteStatus('未连接', '');

  // 暴露给调试
  window.__syncplay = { connMgr: () => connMgr };
})();
