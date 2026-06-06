(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SyncPlay = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============ 配置（同步相关部分） ============
  // 注意：PEER_* 配置属于 ConnectionManager，不放在这里
  const DEFAULT_CONFIG = {
    // 同步参数
    DRIFT_CHECK_INTERVAL_MS: 10000, // 每 10 秒做一次漂移检查
    DRIFT_THRESHOLD_SEC: 0.5,       // 偏移超过 0.5 秒才校正
    HEARTBEAT_INTERVAL_MS: 5000,    // 心跳 5 秒一次
    GUARD_WINDOW_MS: 200,           // 屏蔽窗口 200ms
  };

  // ============ SyncEngine ============

  /**
   * 同步协议消息类型
   *  - play/pause/seek: 同步指令
   *  - heartbeat: 心跳（用于测量延迟）
   *  - drift_check: 漂移检查
   *  - file_info: 视频文件元信息（用于校验两端是否同一文件）
   */
  class SyncEngine {
    /**
     * @param {HTMLVideoElement|Object} video
     * @param {Function} send - 发送消息的函数
     * @param {Object} [config] - 可选配置，覆盖 DEFAULT_CONFIG
     */
    constructor(video, send, config) {
      this.video = video;
      this.send = send;
      this.guardUntil = 0;          // 接收方：在 guardUntil 之前忽略本地事件
      this.heartbeatTs = 0;         // 上次心跳的本地时间戳
      this.lastRtt = -1;            // 最近一次往返延迟
      this.driftOffset = 0;         // 漂移偏移（我与对方的 currentTime 之差）
      this.driftTimer = null;
      this.heartbeatTimer = null;
      this._config = Object.assign({}, DEFAULT_CONFIG, config || {});
      this.bindVideoEvents();
    }

    get CONFIG() {
      return this._config;
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
      const cfg = this._config;

      switch (msg.type) {
        case 'play':
        case 'pause': {
          // 屏蔽窗口：屏蔽 GUARD_WINDOW_MS 内的本地事件回环
          this.guardUntil = now + cfg.GUARD_WINDOW_MS;
          // 仅当偏差较大时强制跳转，避免抖动
          if (Math.abs(this.video.currentTime - msg.position) > 0.3) {
            this.video.currentTime = msg.position;
          }
          if (msg.type === 'play' && this.video.paused) this.video.play().catch(() => {});
          if (msg.type === 'pause' && !this.video.paused) this.video.pause();
          break;
        }

        case 'seek': {
          this.guardUntil = now + cfg.GUARD_WINDOW_MS;
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
          if (Math.abs(delta) > cfg.DRIFT_THRESHOLD_SEC) {
            console.log(`[drift] 校正 ${delta.toFixed(2)}s`);
            this.guardUntil = now + cfg.GUARD_WINDOW_MS;
            this.video.currentTime = remotePos;
          }
          this.updateStats();
          break;
        }

        case 'file_info': {
          // 用于校验两端是否加载同一文件
          if (msg.duration == null) break; // 缺少 duration 字段，忽略
          const myMeta = `${this.video.duration.toFixed(2)}`;
          const remoteMeta = `${msg.duration.toFixed(2)}`;
          if (myMeta !== remoteMeta) {
            this._toast('警告：两端视频时长不一致，可能不同步', 'error');
          } else {
            this._toast('文件校验通过', 'success');
          }
          break;
        }
      }
    }

    /** 在 Node 环境测试时覆盖此方法以捕获 toast 调用 */
    _toast(msg, type) {
      // 默认实现依赖浏览器 DOM；测试时可 mock
      if (typeof document !== 'undefined' && document.getElementById('toast')) {
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
    }

    start() {
      this.stop();
      const cfg = this._config;
      this.heartbeatTimer = setInterval(() => {
        this.heartbeatTs = Date.now();
        this.send({ type: 'heartbeat', t: this.heartbeatTs, serverT: this.heartbeatTs });
      }, cfg.HEARTBEAT_INTERVAL_MS);

      this.driftTimer = setInterval(() => {
        if (!this.video.paused) {
          const reqId = Math.random().toString(36).substring(2, 8);
          this.send({
            type: 'drift_check',
            requestId: reqId,
            remotePosition: this.video.currentTime,
          });
        }
      }, cfg.DRIFT_CHECK_INTERVAL_MS);
    }

    stop() {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.driftTimer) clearInterval(this.driftTimer);
      this.heartbeatTimer = null;
      this.driftTimer = null;
    }

    /** 在 Node 环境测试时覆盖此方法以避免 DOM 依赖 */
    updateStats() {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('stats');
        if (!el) return;
        el.textContent = `延迟: ${this.lastRtt >= 0 ? this.lastRtt + 'ms' : '—'}  |  漂移: ${this.driftOffset.toFixed(2)}s`;
      }
    }
  }

  return { SyncEngine, DEFAULT_CONFIG };
}));
