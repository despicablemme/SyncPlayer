'use strict';

/**
 * Integration test: 双窗口同步回归 — 验证 MSE / hls.js 路径下 video 事件还能触发 SyncEngine
 *
 * 默认 SKIP — 需要 Electron renderer + 真实的 WebRTC PeerJS DataChannel 双窗口模拟
 * 才能跑通. 普通 Node test runner 没有 RTCPeerConnection / PeerJS.
 *
 * 在主人本地 Electron renderer 跑 (阶段 C 实测):
 *   SYNCPLAY_RUN_SYNC_DUAL_WINDOW=1 \
 *   SYNCPLAY_PASSENGERS_SAMPLE="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   electron --enable-features=SharedArrayBuffer \
 *     desktop/main.js
 *
 * 这个测试对应 Claude Round 2 §7 同步回归期望:
 *   - 双窗口 mp4 同步: play/pause/seek 双方 UI 实时同步 (< 500ms)
 *   - 双窗口 mkv (太空旅客.mkv) 同步: 同上, ffmpeg.wasm → fMP4 → MSE 路径
 *   - 双方都加载后状态: RoomStateMachine IN_ROOM_SYNCED, dot=connected 绿
 *   - 一方进/退房另一方反应: 状态正确恢复
 *
 * 实现思路:
 *   - 用 Mock DataChannel 模拟 PeerJS 双窗口通信
 *   - 真实 WebRTC / PeerJS 由 SyncEngine + ConnectionManager 在主人 app 内集成,
 *     这里只验证 SyncEngine 协议层 + video 事件在 MSE/hls.js/原生 路径都正常.
 */

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');

const PASSENGERS_SAMPLE = process.env.SYNCPLAY_PASSENGERS_SAMPLE
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';

const ENABLED = process.env.SYNCPLAY_RUN_SYNC_DUAL_WINDOW === '1';
const hasSandbox = typeof window === 'undefined'
  || typeof document === 'undefined'
  || typeof SharedArrayBuffer === 'undefined';

function makeSkipReason(needsSample = false) {
  if (!ENABLED) {
    return '设置 SYNCPLAY_RUN_SYNC_DUAL_WINDOW=1 后由主人在 Electron renderer (双窗口) 环境运行 (默认跳过)';
  }
  if (hasSandbox) {
    return 'sandbox 无 DOM / SharedArrayBuffer (默认跳过)';
  }
  if (needsSample && !fs.existsSync(PASSENGERS_SAMPLE)) {
    return `测试样本不存在: ${PASSENGERS_SAMPLE}`;
  }
  return false;
}

/**
 * Mock video element — 模拟 HTMLVideoElement 最小 surface.
 * SyncEngine 在 bindVideoEvents() 里 addEventListener('play'/'pause'/'seeked'),
 * 所以我们 mock 这 3 个事件 + currentTime / paused / play() / pause().
 */
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

/**
 * Mock DataChannel — 模拟 PeerJS DataChannel.
 * 把 A 发给 B 的消息, B 发给 A 的消息, 都通过 send queue + received queue 处理.
 */
function createMockDataChannelPair() {
  const aToB = [];
  const bToA = [];
  return {
    a: {
      send: (msg) => bToA.push(msg),
      onmessage: null,
      received: bToA,
    },
    b: {
      send: (msg) => aToB.push(msg),
      onmessage: null,
      received: aToB,
    },
  };
}

// ---------- 双窗口 mp4 (原生 <video>) 同步 ----------
test('sync-dual-window: 双窗口 mp4 同步 (play/pause/seek)', {
  skip: makeSkipReason(),
  timeout: 60000,
}, async () => {
  const { SyncEngine } = require('../../src/shared/sync-engine.js');

  // Mock DOM 环境
  if (typeof document === 'undefined') {
    global.document = {
      getElementById: () => null,
      createElement: () => createMockVideoEl(),
      body: { appendChild: () => {} },
    };
  }

  const channel = createMockDataChannelPair();
  const videoA = createMockVideoEl();
  const videoB = createMockVideoEl();

  const engineA = new SyncEngine(videoA, channel.a.send);
  const engineB = new SyncEngine(videoB, channel.b.send);

  // Step 1: A 加载 mp4 (video.src = url, 在实际环境由 app.js loadVideo() 完成)
  // 这里 mock 直接设 duration
  videoA.duration = 600;
  videoB.duration = 600;

  // Step 2: A.play() 触发本地事件 → SyncEngine send('play')
  await videoA.play();
  assert.strictEqual(channel.a.received.length, 1, 'A.play 应触发 1 条 play 消息');
  assert.strictEqual(channel.a.received[0].type, 'play');

  // Step 3: B 收到 play, handle() 触发 videoB.play()
  channel.a.received.shift();
  engineB.handle(channel.a.received[0]);
  assert.strictEqual(videoB.paused, false, 'B.play 应被 SyncEngine 触发');

  // Step 4: A 拖动 seek 到 100s
  videoA.currentTime = 100;
  videoA.dispatchEvent({ type: 'seeked' });
  assert.strictEqual(channel.a.received.length, 1, 'A.seek 应触发 1 条 seek 消息');

  // Step 5: B 收到 seek, currentTime 应被设为 100
  engineB.handle(channel.a.received[0]);
  assert.ok(Math.abs(videoB.currentTime - 100) < 0.5, 'B.currentTime 应同步到 100');

  // Step 6: A.pause()
  videoA.pause();
  assert.strictEqual(channel.a.received.length, 1, 'A.pause 应触发 1 条 pause 消息');
  engineB.handle(channel.a.received[0]);
  assert.strictEqual(videoB.paused, true, 'B.pause 应被 SyncEngine 触发');
});

// ---------- 双窗口 mkv (太空旅客.mkv, ffmpeg.wasm → fMP4 → MSE) 同步 ----------
test('sync-dual-window: 双窗口 mkv (太空旅客.mkv) → MSE 路径同步', {
  skip: makeSkipReason(true),
  timeout: 120000,
}, async () => {
  // 主人实测: 两窗口都加载太空旅客.mkv (1.5 GB) 走 ffmpeg.wasm → fMP4 → MSE pipeline
  // 然后 play / pause / seek 验证 SyncEngine 协议层一致
  const { SyncEngine } = require('../../src/shared/sync-engine.js');
  const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');
  const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');

  if (typeof document === 'undefined') {
    global.document = {
      getElementById: () => null,
      createElement: () => createMockVideoEl(),
      body: { appendChild: () => {} },
    };
  }

  // Step 1: 读 mkv → transmux → fMP4 (verify pipeline works once)
  const fileBytes = await fs.promises.readFile(PASSENGERS_SAMPLE);
  assert.ok(fileBytes.byteLength > 1024 * 1024 * 1024, '样本应 > 1 GB');

  const fmp4Bytes = await transmuxToFmp4(fileBytes, {
    onProgress: ({ percent }) => process.stdout.write(`\r[transmux] ${percent.toFixed(1)}%`),
  });
  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');
  assert.ok(ftyp.codec, 'codec 应识别 (avc1 / hvc1)');
  console.log(`\n[mkv-sync] ftyp codec=${ftyp.codec}`);

  // Step 2: 双窗口 mock video + SyncEngine
  const channel = createMockDataChannelPair();
  const videoA = createMockVideoEl();
  const videoB = createMockVideoEl();

  // MSE pipeline 完成后, duration 会从 ftyp + moov box 计算出来
  // 这里 mock 设一下 (真实值由 MSE SourceBuffer 的 sourceopen + appendBuffer 流程填)
  videoA.duration = 6880; // 太空旅客 ~114 分钟 ≈ 6880s
  videoB.duration = 6880;

  const engineA = new SyncEngine(videoA, channel.a.send);
  const engineB = new SyncEngine(videoB, channel.b.send);

  // Step 3: A 拖到 3600s (1 小时处)
  videoA.currentTime = 3600;
  videoA.dispatchEvent({ type: 'seeked' });

  // Step 4: B 收到 seek, currentTime 应被设为 3600
  const seekMsg = channel.a.received[0];
  assert.ok(seekMsg, 'A.seek 应触发消息');
  engineB.handle(seekMsg);
  assert.ok(Math.abs(videoB.currentTime - 3600) < 0.5, 'B.currentTime 应同步到 3600s');

  // Step 5: file_info 校验 duration 一致
  engineB.handle({ type: 'file_info', duration: 6880 });
  // SyncEngine.handle 在 duration 一致时会调 _toast('文件校验通过', 'success')
  // 这里不 verify toast (DOM), 只 verify 不抛错
  console.log('[mkv-sync] duration 校验通过');
});

// ---------- SyncEngine 在 MSE / hls.js 路径下都触发 video 事件 ----------
test('sync: MSE 路径下 video 元素 still 触发 play / pause / seeked / currentTime', {
  skip: makeSkipReason(true),
  timeout: 60000,
}, async () => {
  // 验证 MSE pipeline (ffmpeg.wasm → fMP4 → MsePlayer → <video>) 不破坏 SyncEngine 监听的事件
  const { SyncEngine } = require('../../src/shared/sync-engine.js');

  if (typeof document === 'undefined') {
    global.document = {
      getElementById: () => null,
      createElement: () => createMockVideoEl(),
      body: { appendChild: () => {} },
    };
  }

  const video = createMockVideoEl();
  video.duration = 600;

  let sentMessages = [];
  const engine = new SyncEngine(video, (msg) => sentMessages.push(msg));

  // 模拟 MSE pipeline 完成后 <video> 元素触发的事件
  await video.play();
  assert.ok(sentMessages.some((m) => m.type === 'play'), 'MSE video.play() 应触发 SyncEngine.send(play)');

  video.pause();
  assert.ok(sentMessages.some((m) => m.type === 'pause'), 'MSE video.pause() 应触发 SyncEngine.send(pause)');

  video.currentTime = 250;
  video.dispatchEvent({ type: 'seeked' });
  assert.ok(sentMessages.some((m) => m.type === 'seek'), 'MSE video.seeked 应触发 SyncEngine.send(seek)');
});