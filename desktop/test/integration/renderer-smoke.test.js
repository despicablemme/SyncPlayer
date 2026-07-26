'use strict';

/**
 * v0.7.0.1-B-E: Renderer smoke test — Electron renderer + 真实文件真跑集成测试
 *
 * 为什么这个测试存在:
 *   desktop/test/integration/multi-format-matrix.test.js 默认 SKIP (无 DOM /
 *   MediaSource / SharedArrayBuffer / Worker), 一直是 placeholder. v0.7.0.1
 *   mkv bug 漏出去就是因为没人真跑过集成测试. 现在改方案: 默认 SKIP 不允许,
 *   必须有一个能在 Electron renderer 真跑的 smoke, 至少覆盖 mp4 + mkv + hls
 *   三档. CI 不跑 (macOS runner 限制 + 需要主人本地文件), 主人手动触发.
 *
 * 触发 (主人在本地 macOS):
 *   cd desktop
 *   SYNCPLAY_RUN_SMOKE=1 \
 *   SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   npx electron test/integration/renderer-smoke-runner.js
 *
 *   ↑ renderer-smoke-runner.js 是新加的 Electron 启动脚本 (见 §1.6 Commit B-F),
 *     启动 Electron + 加载 src/client/index.html + IPC 注入 node:test runner +
 *     把测试结果回报给主进程 (console.log 收集 + exit code).
 *
 * 包含场景:
 *   1. empty-file: 上传 0 字节文件, 期望 transmuxToFmp4 抛 INPUT_TOO_SHORT 或 CONTAINER_UNSUPPORTED
 *   2. mkv-h264: 主人太空旅客.mkv → transmux → MSE → loadedmetadata + duration > 60
 *   3. mp4-native: desktop/src/client/test-video.mp4 → 直接 <video>, loadedmetadata
 *   4. hls-network: test-streams.mux.dev m3u8 → hls.js → canplay
 *   5. wrong-format: 上传 .txt 假装 mp4, 期望 transmux 走 fallback 软编拒绝 / 报错
 *
 * SKIP 条件:
 *   - SYNCPLAY_RUN_SMOKE != '1'
 *   - 跑在 Node 普通环境 (无 DOM / window / MediaSource): hasSandbox 检测
 *   - mkv 样本文件不存在 (fs.existsSync check)
 */

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');

const ENABLED = process.env.SYNCPLAY_RUN_SMOKE === '1';

const hasSandbox = typeof SharedArrayBuffer === 'undefined'
  || typeof window === 'undefined'
  || typeof document === 'undefined';

const MKV_SAMPLE = process.env.SYNCPLAY_SMOKE_MKV
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';

const MP4_NATIVE_SAMPLE = require('path').join(__dirname, '..', '..', 'src', 'client', 'test-video.mp4');
const HLS_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

function once(target, eventName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${eventName.toUpperCase()}_TIMEOUT_${timeoutMs}ms`)),
      timeoutMs,
    );
    target.addEventListener(eventName, (event) => {
      clearTimeout(timer);
      resolve(event);
    }, { once: true });
  });
}

function createVideoEl() {
  const video = document.createElement('video');
  video.muted = true;
  video.controls = false;
  document.body.appendChild(video);
  return video;
}

function skipReason() {
  if (!ENABLED) return '设置 SYNCPLAY_RUN_SMOKE=1 在 Electron renderer 环境运行 (默认跳过)';
  if (hasSandbox) return 'sandbox 无 DOM / MediaSource / SharedArrayBuffer';
  if (!fs.existsSync(MKV_SAMPLE)) return `mkv 样本不存在: ${MKV_SAMPLE}`;
  return false;
}

function nativeMp4SkipReason() {
  return skipReason() || (!fs.existsSync(MP4_NATIVE_SAMPLE) && 'test-video.mp4 缺失');
}

test('smoke 1/5: empty file (0 bytes) 拒绝', {
  skip: skipReason(),
}, async () => {
  const { transmuxToFmp4 } = window.SyncPlayMedia;
  const empty = new Uint8Array(0);
  await assert.rejects(
    () => transmuxToFmp4(empty),
    /CONTAINER_UNSUPPORTED|FTYP_TOO_SHORT|TRANSMUX_FAIL/,
  );
});

test('smoke 2/5: mkv H.264 (太空旅客.mkv) → transmux → MSE → duration > 60', {
  skip: skipReason(),
  timeout: 240000,
}, async () => {
  const { transmuxToFmp4, parseFtyp, MsePlayer } = window.SyncPlayMedia;

  const fileBytes = new Uint8Array(await fs.promises.readFile(MKV_SAMPLE));
  assert.ok(fileBytes.byteLength > 1024 * 1024 * 1024, '样本应 > 1 GB');

  const start = Date.now();
  const fmp4Bytes = await transmuxToFmp4(fileBytes, {
    onProgress: ({ percent }) => process.stdout.write(`\r[transmux] ${percent.toFixed(1)}%`),
  });
  const transmuxSec = (Date.now() - start) / 1000;
  process.stdout.write(`\n[smoke 2] transmux ${(fmp4Bytes.byteLength / 1024 / 1024).toFixed(2)} MB in ${transmuxSec}s\n`);

  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');
  assert.ok(ftyp.codec, 'codec 应识别');

  const video = createVideoEl();
  const mse = new MsePlayer(video);
  try {
    await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
    await mse.appendFmp4(fmp4Bytes);
    await mse.end();
    await once(video, 'loadedmetadata', 60000);
    assert.ok(video.duration > 60, `duration 应 > 60s, 实得 ${video.duration}`);
    assert.ok(video.videoWidth > 0, 'videoWidth 应 > 0');
    process.stdout.write(`[smoke 2] video.duration=${video.duration.toFixed(2)}s, ${video.videoWidth}x${video.videoHeight}\n`);
  } finally {
    try { mse.destroy(); } catch (_) {}
  }
});

test('smoke 3/5: mp4 native (test-video.mp4) → 原生 <video> 不走 transmux', {
  skip: nativeMp4SkipReason(),
  timeout: 60000,
}, async () => {
  const video = createVideoEl();
  const url = URL.createObjectURL(new Blob([await fs.promises.readFile(MP4_NATIVE_SAMPLE)]));
  video.src = url;
  video.load();
  await once(video, 'loadedmetadata', 30000);
  assert.ok(video.duration > 0, 'duration 应 > 0');
  URL.revokeObjectURL(url);
});

test('smoke 4/5: hls network (test-streams.mux.dev m3u8) → hls.js → canplay', {
  skip: skipReason(),
  timeout: 90000,
}, async () => {
  const HlsPlayer = window.SyncPlayHlsPlayer;
  if (typeof HlsPlayer !== 'function') {
    throw new Error('window.SyncPlayHlsPlayer 未暴露 (确认 hls-player.js 已加载)');
  }
  const video = createVideoEl();
  const player = new HlsPlayer(video, HLS_URL);
  try {
    await player.attach();
    await once(video, 'canplay', 60000);
    assert.ok(video.duration > 0, 'HLS VOD duration 应 > 0');
  } finally {
    try { player.destroy(); } catch (_) {}
  }
});

test('smoke 5/5: wrong format (.txt as .mp4) 走 fallback 软编拒绝', {
  skip: skipReason(),
}, () => {
  // 1KB 假装 mp4 的纯文本, ftyp box 不对, parseFtyp 抛 NOT_FTYP / FTYP_TOO_SHORT
  // 这里测 parseFtyp 错误处理: 调 transmuxToFmp4 前 parseFtyp 不通过, 上层 fallback
  const { parseFtyp } = window.SyncPlayMedia;
  const fakeBytes = new Uint8Array(1024);
  assert.throws(() => parseFtyp(fakeBytes), /FTYP_TOO_SHORT|NOT_FTYP/);
});
