'use strict';

/**
 * HLS integration test: network m3u8 → HlsPlayer → existing <video> element.
 *
 * 默认 SKIP — 需要 Electron renderer (DOM + HTMLMediaElement + locally loaded hls.js)
 * 和可访问的网络 HLS VOD。主人本地 Electron renderer 跑:
 *
 *   SYNCPLAY_RUN_HLS_INTEGRATION=1 \
 *   SYNCPLAY_HLS_TEST_URL="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" \
 *   npm start
 *
 * Electron integration runner should expose node:test in the renderer, then load this file.
 * The test verifies metadata/canplay, play, pause, seeked, and currentTime on the same video
 * events/properties consumed by SyncEngine.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { HlsPlayer } = require('../../src/client/hls-player.js');

const STREAM_URL = process.env.SYNCPLAY_HLS_TEST_URL
  || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const ENABLED = process.env.SYNCPLAY_RUN_HLS_INTEGRATION === '1';

function once(target, eventName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`HLS_${eventName.toUpperCase()}_TIMEOUT`)), timeoutMs);
    target.addEventListener(eventName, (event) => {
      clearTimeout(timer);
      resolve(event);
    }, { once: true });
  });
}

test('integration: m3u8 → HlsPlayer → video play/pause/seeked/currentTime', {
  skip: !ENABLED
    ? '设置 SYNCPLAY_RUN_HLS_INTEGRATION=1 后由主人在 Electron renderer + 网络环境运行 (默认跳过)'
    : false,
  timeout: 120000,
}, async () => {
  assert.ok(typeof document !== 'undefined', '需要 Electron renderer DOM');
  assert.ok(typeof Hls !== 'undefined', '需要 index.html 已加载本地 hls.min.js');

  const video = document.createElement('video');
  video.muted = true;
  document.body.appendChild(video);
  const player = new HlsPlayer(video, STREAM_URL);

  try {
    const canPlay = Promise.race([
      once(video, 'canplay'),
      once(video, 'error').then(() => { throw new Error('HLS_VIDEO_ERROR'); }),
    ]);
    await player.attach();
    await canPlay;

    assert.ok(Number.isFinite(video.duration) && video.duration > 0, 'HLS VOD duration 应有效');

    await video.play();
    assert.strictEqual(video.paused, false, 'video.play() 应进入播放态');

    video.pause();
    assert.strictEqual(video.paused, true, 'video.pause() 应进入暂停态');

    const targetTime = Math.min(5, Math.max(0.5, video.duration / 4));
    const seeked = once(video, 'seeked');
    video.currentTime = targetTime;
    await seeked;
    assert.ok(Math.abs(video.currentTime - targetTime) < 1, 'seeked 后 currentTime 应接近目标值');
  } finally {
    player.destroy();
    video.remove();
  }
});
