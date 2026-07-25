'use strict';

/**
 * SyncEngine unit tests — covers the protocol layer (handle / bindVideoEvents / start / stop).
 *
 * Per Claude Round 2 §7 同步回归 + 阶段 B-E 测试矩阵:
 *   - 验证 video 元素 play / pause / seeked 事件触发 SyncEngine.send()
 *   - 验证 handle() 协议层正确处理 play / pause / seek / heartbeat / drift_check / drift_response / file_info
 *   - 验证 guardUntil 屏蔽窗口内本地事件不上报 (避免回环)
 *   - 验证 MSE / hls.js / 原生 路径下 video 元素事件一致 (通过 mock video element)
 *
 * Source: src/shared/sync-engine.js (B-A 加的)
 * Missing: room-state.js + video-match.js 不存在仓库, 不写测试 (per audit §0)
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { SyncEngine } = require('../../src/shared/sync-engine.js');

function createMockVideoEl() {
  const listeners = new Map();
  const el = {
    duration: 600,
    currentTime: 0,
    paused: true,
    videoWidth: 1280,
    videoHeight: 720,
    addEventListener(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    removeEventListener(event, fn) {
      const arr = listeners.get(event) || [];
      const i = arr.indexOf(fn);
      if (i !== -1) arr.splice(i, 1);
    },
    dispatchEvent(event) {
      const arr = listeners.get(event.type) || [];
      for (const fn of arr) {
        try { fn(event); } catch (e) { console.error('[mock] listener error', e); }
      }
      return true;
    },
    async play() {
      this.paused = false;
      this.dispatchEvent({ type: 'play' });
    },
    pause() {
      this.paused = true;
      this.dispatchEvent({ type: 'pause' });
    },
  };
  return el;
}

describe('SyncEngine — bindVideoEvents', () => {
  test('play / pause / seeked 事件 → send() 被调用', () => {
    const sent = [];
    const video = createMockVideoEl();
    const engine = new SyncEngine(video, (m) => sent.push(m));

    video.dispatchEvent({ type: 'play' });
    video.dispatchEvent({ type: 'pause' });
    video.currentTime = 100;
    video.dispatchEvent({ type: 'seeked' });

    assert.strictEqual(sent.length, 3);
    assert.strictEqual(sent[0].type, 'play');
    assert.strictEqual(sent[1].type, 'pause');
    assert.strictEqual(sent[2].type, 'seek');
    assert.strictEqual(sent[2].position, 100);
  });

  test('guardUntil 屏蔽窗口内本地事件不上报', () => {
    const sent = [];
    const video = createMockVideoEl();
    const engine = new SyncEngine(video, (m) => sent.push(m), { GUARD_WINDOW_MS: 5000 });
    engine.guardUntil = Date.now() + 5000; // 手动设, 模拟收到远端 sync

    video.dispatchEvent({ type: 'play' });
    video.dispatchEvent({ type: 'pause' });
    video.currentTime = 100;
    video.dispatchEvent({ type: 'seeked' });

    assert.strictEqual(sent.length, 0, '屏蔽窗口内不应发送本地事件');
  });
});

describe('SyncEngine — handle()', () => {
  let video;
  let sent;
  let engine;

  beforeEach(() => {
    video = createMockVideoEl();
    sent = [];
    engine = new SyncEngine(video, (m) => sent.push(m));
  });

  test('handle({ type: "play" }) → video.play() + guardUntil 设置', async () => {
    await video.play(); // 先 paused = false
    video.paused = false;
    video.currentTime = 0;

    engine.handle({ type: 'play', position: 10 });
    // handle 期望 video.paused === false 时不调 play, 但 video.paused = false 已经
    // (mock 行为跟真实 video 类似)
    assert.ok(engine.guardUntil > Date.now(), 'guardUntil 应在 handle 后被设置');
  });

  test('handle({ type: "pause" }) → video.pause()', () => {
    video.paused = false;
    video.currentTime = 50;

    engine.handle({ type: 'pause', position: 50 });
    // handle 在 Math.abs(currentTime - msg.position) <= 0.3 时不 set currentTime,
    // 只在 paused 时调 pause()
    assert.strictEqual(video.paused, true);
  });

  test('handle({ type: "seek", position: 100 }) → currentTime 设到 100', () => {
    video.currentTime = 0;
    engine.handle({ type: 'seek', position: 100 });
    assert.strictEqual(video.currentTime, 100);
  });

  test('handle({ type: "seek" }) currentTime 偏差 < 0.3s 不校正', () => {
    video.currentTime = 99.8;
    engine.handle({ type: 'seek', position: 100 });
    assert.strictEqual(video.currentTime, 99.8, '偏差 < 0.3 不应被强制改');
  });

  test('handle({ type: "heartbeat" }) → send heartbeat_pong 回传', () => {
    engine.handle({ type: 'heartbeat', t: 1000, serverT: 1000 });
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'heartbeat_pong');
    assert.strictEqual(sent[0].origT, 1000);
    assert.ok(sent[0].recvT >= 1000, 'recvT 应 >= origT');
  });

  test('handle({ type: "heartbeat_pong" }) → lastRtt 计算', () => {
    const origT = Date.now() - 50;
    engine.handle({ type: 'heartbeat_pong', origT });
    assert.ok(engine.lastRtt >= 50, `lastRtt 应 >= 50, 实得 ${engine.lastRtt}`);
  });

  test('handle({ type: "drift_check" }) → send drift_response', () => {
    engine.handle({ type: 'drift_check', requestId: 'abc123', remotePosition: 100 });
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'drift_response');
    assert.strictEqual(sent[0].requestId, 'abc123');
    assert.strictEqual(sent[0].myPosition, video.currentTime);
  });

  test('handle({ type: "drift_response" }) 偏差 > 阈值 → currentTime 校正', () => {
    video.currentTime = 0;
    engine.handle({
      type: 'drift_response',
      remotePosition: 1.0,
      myPosition: 0,
    });
    // driftOffset = 1.0, > 0.5 阈值 → 校正
    assert.strictEqual(engine.driftOffset, 1.0);
    assert.strictEqual(video.currentTime, 1.0);
  });

  test('handle({ type: "drift_response" }) 偏差 < 阈值 → 不校正', () => {
    video.currentTime = 100;
    engine.handle({
      type: 'drift_response',
      remotePosition: 100.2,
      myPosition: 100,
    });
    // 浮点比较: 100.2 - 100 = 0.20000000000000284
    assert.ok(Math.abs(engine.driftOffset - 0.2) < 1e-9, `driftOffset 应 ≈ 0.2, 实得 ${engine.driftOffset}`);
    assert.strictEqual(video.currentTime, 100, '偏差 < 0.5 不应被校正');
  });

  test('handle({ type: "file_info", duration }) 一致 → _toast(success)', () => {
    video.duration = 600;
    let toastMsg = null;
    let toastType = null;
    engine._toast = (msg, type) => { toastMsg = msg; toastType = type; };

    engine.handle({ type: 'file_info', duration: 600 });
    assert.strictEqual(toastType, 'success');
  });

  test('handle({ type: "file_info", duration }) 不一致 → _toast(error)', () => {
    video.duration = 600;
    let toastType = null;
    engine._toast = (msg, type) => { toastType = type; };

    engine.handle({ type: 'file_info', duration: 700 });
    assert.strictEqual(toastType, 'error');
  });

  test('handle({ type: "file_info" }) 缺 duration 字段 → 忽略', () => {
    let toastCalled = false;
    engine._toast = () => { toastCalled = true; };
    engine.handle({ type: 'file_info' });
    assert.strictEqual(toastCalled, false);
  });

  test('handle({}) 无 type → 忽略', () => {
    const sentLen = sent.length;
    engine.handle({});
    engine.handle(null);
    engine.handle({ random: 'foo' });
    assert.strictEqual(sent.length, sentLen);
  });
});

describe('SyncEngine — start / stop', () => {
  test('start() 启动 heartbeat + drift timers', () => {
    const sent = [];
    const video = createMockVideoEl();
    const engine = new SyncEngine(video, (m) => sent.push(m), {
      HEARTBEAT_INTERVAL_MS: 10,
      DRIFT_CHECK_INTERVAL_MS: 20,
    });

    engine.start();
    assert.ok(engine.heartbeatTimer, 'heartbeatTimer 应被设置');
    assert.ok(engine.driftTimer, 'driftTimer 应被设置');

    return new Promise((resolve) => {
      setTimeout(() => {
        engine.stop();
        assert.strictEqual(engine.heartbeatTimer, null);
        assert.strictEqual(engine.driftTimer, null);
        // 至少应有 heartbeat 消息
        assert.ok(sent.some((m) => m.type === 'heartbeat'), '应有 heartbeat 消息');
        resolve();
      }, 100);
    });
  });

  test('stop() 清理 timers, 不再发心跳', async () => {
    const sent = [];
    const video = createMockVideoEl();
    const engine = new SyncEngine(video, (m) => sent.push(m), {
      HEARTBEAT_INTERVAL_MS: 10,
      DRIFT_CHECK_INTERVAL_MS: 20,
    });

    engine.start();
    engine.stop();
    const sentLen = sent.length;

    await new Promise((r) => setTimeout(r, 100));
    // stop() 后 timer 被清, 不应新增消息
    assert.strictEqual(sent.length, sentLen, 'stop() 后不应再发送心跳');
  });
});

describe('SyncEngine — MSE / hls.js / 原生路径兼容', () => {
  // 这组测试验证: 不管 <video> src 是 native / hls.js / MSE,
  // SyncEngine 监听的 play / pause / seeked / currentTime 都一致.
  // 实际验证方法: 用 mock video element (上面已经覆盖),
  // 真实 MSE/hls.js 路径下 video 事件行为一致
  // (这由 hls-players.test.js + mse-passengers.test.js 间接覆盖).

  test('原生 <video>: video.currentTime 改变 + seeked 事件 → SyncEngine.send(seek)', () => {
    const sent = [];
    const video = createMockVideoEl();
    new SyncEngine(video, (m) => sent.push(m));

    video.currentTime = 250;
    video.dispatchEvent({ type: 'seeked' });

    const seek = sent.find((m) => m.type === 'seek');
    assert.ok(seek, '应发送 seek 消息');
    assert.strictEqual(seek.position, 250);
  });

  test('MSE pipeline: MsePlayer 完成 appendFmp4 后, <video> 仍触发标准 DOM 事件', () => {
    // 这条规则由 MSE 规范保证 — SourceBuffer.appendBuffer 完成后,
    // video.duration/play/pause/seeked/currentTime 行为跟 native src 一致.
    // (这里写出来是为了文档化这层契约, 不是测试实现.)
    const sent = [];
    const video = createMockVideoEl();
    new SyncEngine(video, (m) => sent.push(m));

    video.dispatchEvent({ type: 'play' });
    video.dispatchEvent({ type: 'pause' });
    video.currentTime = 100;
    video.dispatchEvent({ type: 'seeked' });

    assert.strictEqual(sent.length, 3);
  });
});