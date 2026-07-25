'use strict';

/**
 * HlsPlayer unit tests (Node built-in test runner).
 * Browser HLS and hls.js APIs are represented by minimal mocks.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const { HlsPlayer } = require('../../src/client/hls-player.js');

function makeVideo(canPlayNative = false) {
  return {
    src: '',
    loadCalls: 0,
    canPlayType(type) {
      return canPlayNative && type === 'application/vnd.apple.mpegurl' ? 'maybe' : '';
    },
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    },
    load() {
      this.loadCalls++;
    },
  };
}

function installMockHls() {
  class MockHls {
    static Events = {
      ERROR: 'error',
      MANIFEST_PARSED: 'manifestParsed',
    };

    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
      OTHER_ERROR: 'otherError',
    };

    static isSupported() {
      return true;
    }

    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.loadSourceCalls = [];
      this.attachMediaCalls = [];
      this.startLoadCalls = 0;
      this.recoverMediaErrorCalls = 0;
      this.destroyCalls = 0;
      MockHls.instances.push(this);
    }

    on(event, handler) {
      this.handlers[event] = handler;
    }

    emit(event, data = {}) {
      this.handlers[event]?.(event, data);
    }

    loadSource(url) {
      this.loadSourceCalls.push(url);
    }

    attachMedia(video) {
      this.attachMediaCalls.push(video);
    }

    startLoad() {
      this.startLoadCalls++;
    }

    recoverMediaError() {
      this.recoverMediaErrorCalls++;
    }

    destroy() {
      this.destroyCalls++;
    }
  }

  MockHls.instances = [];
  global.Hls = MockHls;
  return MockHls;
}

afterEach(() => {
  delete global.Hls;
});

describe('HlsPlayer', () => {
  test('1. 构造 HlsPlayer 不抛且初始状态为 idle', () => {
    const player = new HlsPlayer(makeVideo(), 'https://example.com/master.m3u8');
    assert.strictEqual(player.state, 'idle');
    assert.strictEqual(player.url, 'https://example.com/master.m3u8');
  });

  test('2. Safari 原生 HLS 路径不实例化 hls.js', async () => {
    const MockHls = installMockHls();
    const video = makeVideo(true);
    const player = new HlsPlayer(video, 'https://example.com/native.m3u8');

    await player.attach();

    assert.strictEqual(MockHls.instances.length, 0);
    assert.strictEqual(video.src, 'https://example.com/native.m3u8');
    assert.strictEqual(player.state, 'playing');
  });

  test('3. 非 Safari 路径实例化 Hls + loadSource + attachMedia', async () => {
    const MockHls = installMockHls();
    const video = makeVideo();
    const player = new HlsPlayer(video, 'https://example.com/fallback.m3u8');

    await player.attach();

    const hls = MockHls.instances[0];
    assert.ok(hls, '应实例化 hls.js');
    assert.deepStrictEqual(hls.options, { enableWorker: true, lowLatencyMode: false });
    assert.deepStrictEqual(hls.loadSourceCalls, ['https://example.com/fallback.m3u8']);
    assert.deepStrictEqual(hls.attachMediaCalls, [video]);
    assert.strictEqual(player.state, 'loading');
  });

  test('4. destroy 调用 hls.destroy 并清除 video.src', async () => {
    const MockHls = installMockHls();
    const video = makeVideo();
    const player = new HlsPlayer(video, 'https://example.com/destroy.m3u8');
    await player.attach();
    video.src = 'blob:mock-hls';
    const hls = MockHls.instances[0];

    player.destroy();

    assert.strictEqual(hls.destroyCalls, 1);
    assert.strictEqual(player.hls, null);
    assert.strictEqual(video.src, '');
    assert.strictEqual(video.loadCalls, 1);
    assert.strictEqual(player.state, 'idle');
  });

  test('5. fatal NETWORK_ERROR / MEDIA_ERROR 各只恢复一次', async () => {
    const MockHls = installMockHls();

    const networkPlayer = new HlsPlayer(makeVideo(), 'https://example.com/network.m3u8');
    await networkPlayer.attach();
    const networkHls = MockHls.instances[0];
    const networkError = { fatal: true, type: MockHls.ErrorTypes.NETWORK_ERROR };
    networkHls.emit(MockHls.Events.ERROR, networkError);
    networkHls.emit(MockHls.Events.ERROR, networkError);
    assert.strictEqual(networkHls.startLoadCalls, 1);
    assert.strictEqual(networkPlayer.state, 'error');

    const mediaPlayer = new HlsPlayer(makeVideo(), 'https://example.com/media.m3u8');
    await mediaPlayer.attach();
    const mediaHls = MockHls.instances[1];
    const mediaError = { fatal: true, type: MockHls.ErrorTypes.MEDIA_ERROR };
    mediaHls.emit(MockHls.Events.ERROR, mediaError);
    mediaHls.emit(MockHls.Events.ERROR, mediaError);
    assert.strictEqual(mediaHls.recoverMediaErrorCalls, 1);
    assert.strictEqual(mediaPlayer.state, 'error');
  });

  test('6. 状态从 idle → loading → MANIFEST_PARSED 后 playing', async () => {
    const MockHls = installMockHls();
    const player = new HlsPlayer(makeVideo(), 'https://example.com/state.m3u8');
    assert.strictEqual(player.state, 'idle');

    await player.attach();
    assert.strictEqual(player.state, 'loading');

    MockHls.instances[0].emit(MockHls.Events.MANIFEST_PARSED);
    assert.strictEqual(player.state, 'playing');
  });
});
