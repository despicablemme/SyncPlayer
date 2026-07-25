'use strict';

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');
const { transmuxToFmp4 } = require('../../src/shared/container-transmux.js');

const SAMPLE = process.env.SYNCPLAY_PASSENGERS_SAMPLE
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';
const ENABLED = process.env.SYNCPLAY_RUN_FFMPEG_INTEGRATION === '1';

test('integration: 太空旅客.mkv 1.64 GB transmux', {
  skip: !ENABLED
    ? '设置 SYNCPLAY_RUN_FFMPEG_INTEGRATION=1 后在 Electron renderer/SAB 环境运行'
    : (!fs.existsSync(SAMPLE) ? `测试样本不存在: ${SAMPLE}` : false),
  timeout: 120000,
}, async () => {
  const fileBytes = await fs.promises.readFile(SAMPLE);
  const start = Date.now();
  const fmp4Bytes = await transmuxToFmp4(fileBytes, {
    onProgress: ({ percent }) => process.stdout.write(`\r[transmux] ${percent.toFixed(1)}%`),
  });
  const elapsed = (Date.now() - start) / 1000;

  console.log(
    `\n[transmux] 太空旅客.mkv → ${(fmp4Bytes.byteLength / 1024 / 1024).toFixed(2)} MB in ${elapsed}s`,
  );
  assert.ok(fmp4Bytes.byteLength > 1024 * 1024);
  assert.strictEqual(String.fromCharCode(...fmp4Bytes.slice(4, 8)), 'ftyp');
});
