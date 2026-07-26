'use strict';

/**
 * Integration test: 9 格式 (8 URL + 1 主人本地) 测试矩阵
 *
 * Electron smoke runner 真跑 — 需要 DOM + HTMLMediaElement + MediaSource + Worker + SAB.
 * 普通 Node test runner 仍会跳过:
 *   - 没有 document / window / MediaSource / SharedArrayBuffer
 *   - 大文件 (太空旅客.mkv 1.5 GB) 内存读不进来
 *   - 公网 URL 网络依赖
 *
 * 在主人本地 Electron renderer 跑 (阶段 C):
 *   SYNCPLAY_RUN_FORMAT_MATRIX=1 \
 *   SYNCPLAY_PASSENGERS_SAMPLE="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   electron --enable-features=SharedArrayBuffer \
 *     desktop/main.js
 *
 * 这个测试套件对应 Claude Round 2 §7 测试矩阵, 每个格式 1 个测试.
 * 默认全部 SKIP, 主人阶段 C 实测后填 v0.7-B-E-test-report.md §4 表.
 */

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');

const SAMPLE_URLS = {
  mp4_h264: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  mp4_h265: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  webm_vp9: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.webm',
  webm_av1: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides-AV1-8bit-51.webm',
  m3u8_hls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  avi: 'https://test-videos.co.uk/vids/bigbuckbunny/avi/Big_Buck_Bunny_360_10s_1MB.avi',
  flv: 'https://test-videos.co.uk/vids/bigbuckbunny/flv/Big_Buck_Bunny_360_10s_1MB.flv',
  // 主人本地样本 (绝对路径, 跨平台要 file:// 规范化)
  mkv_passengers: 'file:///Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv',
  // mkv_h265 主人自己找, 公网没稳定源, 见 sample-urls.md
  mkv_h265: null,
};

const PASSENGERS_SAMPLE = process.env.SYNCPLAY_PASSENGERS_SAMPLE
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';

const ENABLED = process.env.SYNCPLAY_RUN_FORMAT_MATRIX === '1'
  || process.env.SYNCPLAY_RUN_SMOKE === '1';
const HEVC_SAMPLE = process.env.SYNCPLAY_PASSENGERS_HEVC;

const hasSandbox = typeof SharedArrayBuffer === 'undefined'
  || typeof window === 'undefined'
  || typeof document === 'undefined';

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

function createMockVideoElement() {
  // 真实测试在 Electron renderer, 这里 mock 防止 Node 环境报错
  if (typeof document !== 'undefined') {
    const v = document.createElement('video');
    v.muted = true;
    document.body.appendChild(v);
    return v;
  }
  return null;
}

// 跳过条件: 未启用 OR sandbox 环境 OR 主人样本不存在 (mkv_passengers / mkv_h265)
function makeSkipReason(formatName) {
  if (!ENABLED) {
    return '设置 SYNCPLAY_RUN_SMOKE=1 或 SYNCPLAY_RUN_FORMAT_MATRIX=1 后在 Electron renderer + SAB 环境运行';
  }
  if (hasSandbox) {
    return 'sandbox 无 DOM / MediaSource / SharedArrayBuffer';
  }
  if (formatName === 'mkv_passengers' && !fs.existsSync(PASSENGERS_SAMPLE)) {
    return `测试样本不存在: ${PASSENGERS_SAMPLE}`;
  }
  if (formatName === 'mkv_h265' && (!HEVC_SAMPLE || !fs.existsSync(HEVC_SAMPLE))) {
    return '未设置有效的 SYNCPLAY_PASSENGERS_HEVC 样本, 跳过 mkv H.265';
  }
  return false;
}

// ---------- mp4 H.264 ----------
test('format-matrix: mp4 H.264 (BigBuckBunny.mp4) → 原生 <video>', {
  skip: makeSkipReason('mp4_h264'),
  timeout: 60000,
}, async () => {
  const video = createMockVideoElement();
  const { HlsPlayer } = require('../../src/client/hls-player.js');
  assert.ok(typeof HlsPlayer === 'function', 'HlsPlayer 应可加载 (用于 iframes)');

  // mp4 不进 m3u8 也不进 container, 直接 video.src
  video.src = SAMPLE_URLS.mp4_h264;
  video.load();

  await once(video, 'loadedmetadata', 30000);
  assert.ok(Number.isFinite(video.duration) && video.duration > 0, 'duration 应 > 0');
  assert.ok(video.videoWidth > 0, 'videoWidth 应 > 0');
});

// ---------- mp4 H.265 (硬解证据) ----------
test('format-matrix: mp4 H.265 (Big_Buck_Bunny_720_10s_1MB.mp4) → 原生 + 硬解证据', {
  skip: makeSkipReason('mp4_h265'),
  timeout: 60000,
}, async () => {
  const video = createMockVideoElement();
  video.src = SAMPLE_URLS.mp4_h265;
  video.load();

  await once(video, 'loadedmetadata', 30000);
  assert.ok(Number.isFinite(video.duration) && video.duration > 0, 'duration 应 > 0');

  // 主人实测时检查 chrome://gpu "Decode hevc main" 段存在
  // + macOS Activity Monitor: VTDecoderXPCService CPU > 0
  // + SyncPlay 主进程 CPU < 20%
  // 三项证据见 hw-decode-evidence.test.js
});

// ---------- webm VP9 ----------
test('format-matrix: webm VP9 (ForBiggerBlazes.webm) → 原生 <video>', {
  skip: makeSkipReason('webm_vp9'),
  timeout: 60000,
}, async () => {
  const video = createMockVideoElement();
  video.src = SAMPLE_URLS.webm_vp9;
  video.load();

  await once(video, 'loadedmetadata', 30000);
  assert.ok(video.duration > 0, 'duration 应 > 0');
});

// ---------- webm AV1 (硬解证据) ----------
test('format-matrix: webm AV1 (ForBiggerJoyrides-AV1-8bit-51.webm) → 原生 + 硬解证据', {
  skip: makeSkipReason('webm_av1'),
  timeout: 60000,
}, async () => {
  const video = createMockVideoElement();
  video.src = SAMPLE_URLS.webm_av1;
  video.load();

  await once(video, 'loadedmetadata', 30000);
  assert.ok(video.duration > 0, 'duration 应 > 0');

  // 主人实测: chrome://gpu "Decode av1 main" 段 + VTDecoderXPCService (M1+ mac)
  //    或 GPU vendor-specific decoder (RTX 30+ / RX 6000+ windows/linux)
});

// ---------- m3u8 HLS (hls.js → MSE) ----------
test('format-matrix: m3u8 HLS (x36xhzz.m3u8) → hls.js → MSE → <video>', {
  skip: makeSkipReason('m3u8_hls'),
  timeout: 90000,
}, async () => {
  const video = createMockVideoElement();
  const { HlsPlayer } = require('../../src/client/hls-player.js');

  const player = new HlsPlayer(video, SAMPLE_URLS.m3u8_hls);
  try {
    await player.attach();
    await once(video, 'canplay', 60000);
    assert.ok(Number.isFinite(video.duration) && video.duration > 0, 'HLS VOD duration 应 > 0');
  } finally {
    try { player.destroy(); } catch (_) { /* noop */ }
  }
});

// ---------- mkv (主人太空旅客.mkv 1.5 GB, ffmpeg.wasm → fMP4 → MSE) ----------
test('format-matrix: mkv H.264 (太空旅客.mkv 1.5 GB) → ffmpeg.wasm → fMP4 → MSE', {
  skip: makeSkipReason('mkv_passengers'),
  timeout: 240000,
}, async () => {
  // 这个测试走完整 ffmpeg.wasm transmux + MSE pipeline, 大文件 + Worker + SAB
  // 主人实测时记录:
  //   - transmux 耗时 (期望 < 60s on M1)
  //   - video.duration > 0 (期望 ~6880s, 太空旅客总长)
  //   - 硬解证据: VTDecoderXPCService CPU > 0 (avc1 + MSE pipeline)
  const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');
  const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');
  const { MsePlayer } = require('../../src/client/mse-player.js');

  const fileBytes = await fs.promises.readFile(PASSENGERS_SAMPLE);
  assert.ok(fileBytes.byteLength > 1024 * 1024 * 1024, '样本应 > 1 GB');

  const start = Date.now();
  const fmp4Bytes = await transmuxToFmp4(fileBytes, {
    onProgress: ({ percent }) => process.stdout.write(`\r[transmux] ${percent.toFixed(1)}%`),
  });
  const transmuxSec = (Date.now() - start) / 1000;
  console.log(`\n[transmux] ${(fmp4Bytes.byteLength / 1024 / 1024).toFixed(2)} MB in ${transmuxSec}s`);

  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');
  assert.ok(ftyp.codec, 'codec 应识别 (avc1 / hvc1 / av01 等)');

  const video = createMockVideoElement();
  const mse = new MsePlayer(video);
  await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
  await mse.appendFmp4(fmp4Bytes);
  await mse.end();

  await once(video, 'loadedmetadata', 60000);
  assert.ok(video.duration > 60, 'video.duration 应 > 60s (太空旅客 ~6880s)');
  mse.destroy();
});

// ---------- mkv H.265 (主人自己找) ----------
test('format-matrix: mkv H.265 (4K HEVC) → ffmpeg.wasm → fMP4 → MSE + 硬解证据', {
  skip: makeSkipReason('mkv_h265'),
  timeout: 240000,
}, async () => {
  // 主人实测时: SYNCPLAY_PASSENGERS_HEVC=path/to/your.mkv
  if (!HEVC_SAMPLE || !fs.existsSync(HEVC_SAMPLE)) {
    throw new Error('主人需要设置 SYNCPLAY_PASSENGERS_HEVC=<path-to-hevc-mkv>');
  }
  // 走 ffmpeg.wasm transmux, parseFtyp codec 应该是 hvc1
  // 主人实测时检查 VTDecoderXPCService CPU > 0 (hevc 硬解)
  const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');
  const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');
  const { MsePlayer } = require('../../src/client/mse-player.js');

  const fileBytes = await fs.promises.readFile(HEVC_SAMPLE);
  const fmp4Bytes = await transmuxToFmp4(fileBytes);
  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');
  assert.ok(/hvc1|hev1/i.test(ftyp.codec), `codec 应为 hvc1/hev1, 实得 ${ftyp.codec}`);

  const video = createMockVideoElement();
  const mse = new MsePlayer(video);
  await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
  await mse.appendFmp4(fmp4Bytes);
  await mse.end();
  await once(video, 'loadedmetadata', 60000);
  assert.ok(video.duration > 60, 'duration 应 > 60s');
  mse.destroy();
});

// ---------- avi (ffmpeg.wasm → fMP4 → MSE) ----------
test('format-matrix: avi (Big_Buck_Bunny_360_10s_1MB.avi) → ffmpeg.wasm → fMP4 → MSE', {
  skip: makeSkipReason('avi'),
  timeout: 90000,
}, async () => {
  const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');
  const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');
  const { MsePlayer } = require('../../src/client/mse-player.js');

  const blob = await fetch(SAMPLE_URLS.avi).then((r) => r.arrayBuffer());
  const fmp4Bytes = await transmuxToFmp4(new Uint8Array(blob));
  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');

  const video = createMockVideoElement();
  const mse = new MsePlayer(video);
  await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
  await mse.appendFmp4(fmp4Bytes);
  await mse.end();
  await once(video, 'loadedmetadata', 60000);
  assert.ok(video.duration > 5, 'duration 应 > 5s');
  mse.destroy();
});

// ---------- flv (ffmpeg.wasm → fMP4 → MSE) ----------
test('format-matrix: flv (Big_Buck_Bunny_360_10s_1MB.flv) → ffmpeg.wasm → fMP4 → MSE', {
  skip: makeSkipReason('flv'),
  timeout: 90000,
}, async () => {
  const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');
  const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');
  const { MsePlayer } = require('../../src/client/mse-player.js');

  const blob = await fetch(SAMPLE_URLS.flv).then((r) => r.arrayBuffer());
  const fmp4Bytes = await transmuxToFmp4(new Uint8Array(blob));
  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');

  const video = createMockVideoElement();
  const mse = new MsePlayer(video);
  await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
  await mse.appendFmp4(fmp4Bytes);
  await mse.end();
  await once(video, 'loadedmetadata', 60000);
  assert.ok(video.duration > 5, 'duration 应 > 5s');
  mse.destroy();
});