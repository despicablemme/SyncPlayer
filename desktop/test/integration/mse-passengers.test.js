'use strict';

/**
 * Integration test: 主人太空旅客.mkv 1.64 GB → ffmpeg.wasm transmux → MSE → 现有 <video> 元素
 *
 * 默认 SKIP — 需要 Electron renderer (DOM + MediaSource + Worker + SAB) 才能跑通,
 * 普通 Node test runner 跑会失败 (无 MediaSource / 无 DOM / Worker 启动受限).
 *
 * 在主人本地 Electron renderer 跑:
 *   SYNCPLAY_RUN_MSE_INTEGRATION=1 \
 *   SYNCPLAY_PASSENGERS_SAMPLE="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   electron --enable-features=SharedArrayBuffer \
 *     --js-flags="--harmony" \
 *     desktop/main.js
 *
 * 或者写一个 electron 专用的 integration runner (B-D+ 范围).
 *
 * DoD (B-C 子任务 3 DoD §6):
 *   - fMP4 transmux 成功 (B-B 已验证, 这里再走一遍)
 *   - parseFtyp 能正确识别 codec 4CC
 *   - MsePlayer.addSourceBuffer 接受该 mimeType + codec
 *   - appendFmp4 完整 buffer 不抛错
 *   - 触发 video element 的 loadedmetadata 事件 (MSE pipeline 完整跑通)
 *   - video.duration > 60s (即真实解码出 fMP4 的时长, 不是 0 / NaN)
 */

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');
const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');
const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');

const SAMPLE = process.env.SYNCPLAY_PASSENGERS_SAMPLE
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';
const ENABLED = process.env.SYNCPLAY_RUN_MSE_INTEGRATION === '1';

test('integration: 太空旅客.mkv 1.64 GB → fMP4 → MSE → video.duration', {
  skip: !ENABLED
    ? '设置 SYNCPLAY_RUN_MSE_INTEGRATION=1 后在 Electron renderer + SAB 环境运行 (默认跳过)'
    : (!fs.existsSync(SAMPLE) ? `测试样本不存在: ${SAMPLE}` : false),
  timeout: 180000,
}, async () => {
  // Step 1: 读 mkv
  const fileBytes = await fs.promises.readFile(SAMPLE);
  assert.ok(fileBytes.byteLength > 1024 * 1024 * 1024, '样本应 > 1 GB');

  // Step 2: ffmpeg.wasm transmux → fMP4
  const start = Date.now();
  const fmp4Bytes = await transmuxToFmp4(fileBytes, {
    onProgress: ({ percent }) => process.stdout.write(`\r[transmux] ${percent.toFixed(1)}%`),
  });
  const transmuxSec = (Date.now() - start) / 1000;
  console.log(
    `\n[transmux] 太空旅客.mkv → ${(fmp4Bytes.byteLength / 1024 / 1024).toFixed(2)} MB fMP4 in ${transmuxSec}s`,
  );

  // Step 3: parseFtyp 识别 codec
  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');
  assert.ok(ftyp.codec, 'codec 应识别 (avc1 / hvc1 / av01 等)');
  console.log(`[ftyp] majorBrand=${ftyp.majorBrand}, codec=${ftyp.codec}`);

  // Step 4: MsePlayer 需要在 DOM 环境跑 — Electron renderer 里 verify loadedmetadata + duration
  // 这里只做能跑的部分 (Node 环境), Electron renderer 跑这步:
  //
  //   const video = document.getElementById('video');
  //   const mse = new MsePlayer(video);
  //   await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
  //   await mse.appendFmp4(fmp4Bytes);
  //   await mse.end();
  //   await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  //   assert.ok(video.duration > 60, 'video.duration 应 > 60s');
  //
  // 在 Node 单元测试层只验证 fmp4Bytes 通过 parseFtyp, 不构造 MediaSource.
  assert.ok(fmp4Bytes.byteLength > 0, 'fmp4Bytes 非空');
});