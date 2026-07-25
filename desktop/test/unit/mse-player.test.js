'use strict';

/**
 * MsePlayer unit tests + parseFtyp unit tests
 *
 * MsePlayer wraps browser APIs (MediaSource + SourceBuffer + URL.createObjectURL).
 * In Node we mock the minimum surface needed for state-machine testing.
 *
 * Per v0.7 Round 2 §3 spec — 6 unit tests:
 *   1. construct + sourceopen resolves
 *   2. addSourceBuffer state -> open, sourceBuffer exists
 *   3. appendBuffer queue: 2nd call queues when updating=true; drain after updateend
 *   4. destroy() cleanup: abort + endOfStream + URL.revokeObjectURL + video.src removed
 *   5. error handling: sourceBuffer error -> state=error
 *   6. parseFtyp: real bytes -> {mimeType, codec}
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MsePlayer } = require('../../src/client/mse-player.js');
const { parseFtyp } = require('../../src/shared/mp4-ftyp-parser.js');

// ============ Mock browser globals for MsePlayer tests ============

let createdObjectURLs = [];
let revokedObjectURLs = [];

function makeMockVideoEl() {
  const el = {
    src: '',
    listeners: {},
    addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); },
    removeEventListener(name, fn) {
      const arr = this.listeners[name] || [];
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    },
    removeAttribute(name) { delete this[name]; this[name === 'src' ? 'src' : name] = name === 'src' ? '' : undefined; },
    loadCalls: 0,
    load() { this.loadCalls++; },
    dispatch(name, evt = {}) {
      for (const fn of (this.listeners[name] || [])) fn(evt);
    },
  };
  return el;
}

function makeMockSourceBuffer(ms) {
  const sb = {
    listeners: {},
    updating: false,
    appendedChunks: [],
    mimeCodec: '',
    addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); },
    removeEventListener(name, fn) {
      const arr = this.listeners[name] || [];
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    },
    appendBuffer(bytes) {
      this.appendedChunks.push(bytes);
      this.updating = true;
      // Simulate async updateend on next microtask
      queueMicrotask(() => {
        this.updating = false;
        for (const fn of (this.listeners['updateend'] || [])) fn({});
      });
    },
    abort() {
      this.updating = false;
      this.aborted = true;
    },
    dispatch(name, evt = {}) {
      for (const fn of (this.listeners[name] || [])) fn(evt);
    },
  };
  return sb;
}

function makeMockMediaSource() {
  const ms = {
    readyState: 'closed',
    listeners: {},
    sourceBuffers: [],
    ended: false,
    aborted: false,
    addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); },
    removeEventListener(name, fn) {
      const arr = this.listeners[name] || [];
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    },
    addSourceBuffer(mime) {
      const sb = makeMockSourceBuffer(this);
      sb.mimeCodec = mime;
      this.sourceBuffers.push(sb);
      // The spec says after addSourceBuffer the media source is 'open'
      return sb;
    },
    endOfStream() {
      this.ended = true;
      this.readyState = 'ended';
      // Fire sourceclose asynchronously to mimic browser
      queueMicrotask(() => {
        for (const fn of (this.listeners['sourceclose'] || [])) fn({});
      });
    },
    dispatch(name, evt = {}) {
      for (const fn of (this.listeners[name] || [])) fn(evt);
    },
  };
  return ms;
}

function installMockBrowser() {
  createdObjectURLs = [];
  revokedObjectURLs = [];

  global.MediaSource = function MockMediaSource() {
    const ms = makeMockMediaSource();
    return ms;
  };
  global.URL = {
    createObjectURL(_blob) {
      const u = `blob:mock/${createdObjectURLs.length}`;
      createdObjectURLs.push(u);
      return u;
    },
    revokeObjectURL(url) {
      revokedObjectURLs.push(url);
    },
  };
}

beforeEach(() => {
  installMockBrowser();
});

// ============ Tests ============

describe('MsePlayer - 构造与 sourceopen', () => {
  test('1. 构造 + sourceopen 事件触发 resolve', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);

    // Trigger sourceopen on the MediaSource
    setTimeout(() => {
      const ms = mse.mediaSource;
      ms.readyState = 'open';
      ms.dispatch('sourceopen', {});
    }, 0);

    await mse._ensureMediaSource();
    assert.strictEqual(mse.state, 'idle'); // remains idle until addSourceBuffer
    assert.ok(mse.mediaSource, 'mediaSource 应被创建');
    assert.match(video.src, /^blob:mock\//, 'video.src 应设为 object URL');
  });

  test('构造无 video 元素抛 MSE_NO_VIDEO_ELEMENT', () => {
    assert.throws(() => new MsePlayer(null), /MSE_NO_VIDEO_ELEMENT/);
    assert.throws(() => new MsePlayer(undefined), /MSE_NO_VIDEO_ELEMENT/);
  });
});

describe('MsePlayer - addSourceBuffer', () => {
  test('2. addSourceBuffer 后 sourceBuffer 存在, state=open', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);

    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);

    await mse.addSourceBuffer('video/mp4', 'avc1');
    assert.strictEqual(mse.state, 'open');
    assert.ok(mse.sourceBuffer, 'sourceBuffer 应被创建');
    assert.strictEqual(mse.sourceBuffer.mimeCodec, 'video/mp4;codecs="avc1"');
  });

  test('addSourceBuffer 不带 codec 也可 (裸 mimeType)', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4');
    assert.strictEqual(mse.sourceBuffer.mimeCodec, 'video/mp4');
  });

  test('重复 addSourceBuffer 抛 MSE_SOURCEBUFFER_EXISTS', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');
    await assert.rejects(() => mse.addSourceBuffer('video/mp4', 'avc1'), /MSE_SOURCEBUFFER_EXISTS/);
  });
});

describe('MsePlayer - appendBuffer 队列与 drain', () => {
  test('3. 第二次 append 在 updating=true 时入队, updateend 后 drain', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');

    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);
    const chunk3 = new Uint8Array([7, 8, 9]);

    // Kick off append1 (will simulate updateend async)
    const p1 = mse.appendFmp4(chunk1);
    // Immediately try append2 + append3 — should queue
    const p2 = mse.appendFmp4(chunk2);
    const p3 = mse.appendFmp4(chunk3);

    assert.strictEqual(mse.queue.length, 2, 'append2 + append3 应入队');

    await Promise.all([p1, p2, p3]);

    assert.strictEqual(mse.sourceBuffer.appendedChunks.length, 3, '应 append 3 chunks');
    assert.strictEqual(mse.queue.length, 0, 'queue 应清空');
    assert.deepStrictEqual(
      [0, 1, 2].map((i) => mse.sourceBuffer.appendedChunks[i][0]),
      [1, 4, 7],
      '顺序应保持',
    );
  });

  test('appendFmp4 没 addSourceBuffer 抛 MSE_NO_SOURCEBUFFER', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    await assert.rejects(
      () => mse.appendFmp4(new Uint8Array([1])),
      /MSE_NO_SOURCEBUFFER/,
    );
  });
});

describe('MsePlayer - destroy cleanup', () => {
  test('4. destroy: sourceBuffer.abort + mediaSource.endOfStream + URL.revokeObjectURL + video.src remove', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');

    const objUrl = video.src;
    mse.destroy();

    assert.strictEqual(mse.sourceBuffer, null, 'sourceBuffer 应清空');
    assert.strictEqual(mse.state, 'idle', 'state 应回到 idle (非 error)');
    assert.strictEqual(mse._destroyed, true, '_destroyed 应置 true');
    assert.deepStrictEqual(revokedObjectURLs, [objUrl], 'URL.revokeObjectURL 应被调用');
    assert.strictEqual(video.src, '', 'video.src 应被清空');
    assert.strictEqual(video.loadCalls, 1, 'video.load() 应被调用一次 (decoder reset)');
    assert.strictEqual(mse.mediaSource.ended, true, 'mediaSource.endOfStream 应被调用');
  });

  test('destroy 幂等 (第二次调用不抛)', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');
    mse.destroy();
    mse.destroy(); // should not throw
    assert.strictEqual(mse._destroyed, true);
  });

  test('destroy 时 sourceBuffer.updating=true 应先 abort', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');

    // Snapshot the sourceBuffer reference BEFORE destroy (destroy nulls it)
    const sb = mse.sourceBuffer;
    // Force sourceBuffer into updating=true state
    sb.updating = true;
    mse.destroy();

    assert.strictEqual(sb.aborted, true, '应先 abort');
  });
});

describe('MsePlayer - 错误处理', () => {
  test('5. sourceBuffer error 事件 -> state=error', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');

    mse.sourceBuffer.dispatch('error', { message: 'mocked sourceBuffer error' });
    assert.strictEqual(mse.state, 'error');
  });

  test('destroy 后再 append 抛 MSE_DESTROYED', async () => {
    const video = makeMockVideoEl();
    const mse = new MsePlayer(video);
    setTimeout(() => {
      mse.mediaSource.readyState = 'open';
      mse.mediaSource.dispatch('sourceopen', {});
    }, 0);
    await mse.addSourceBuffer('video/mp4', 'avc1');
    mse.destroy();
    await assert.rejects(
      () => mse.appendFmp4(new Uint8Array([1])),
      /MSE_DESTROYED/,
    );
  });
});

// ============ parseFtyp tests ============

describe('parseFtyp', () => {
  // Helper to build a fake ftyp box
  function buildFtyp(majorBrand, minorVersion, compatibleBrands) {
    const totalLen = 16 + compatibleBrands.length * 4;
    const buf = new Uint8Array(totalLen);
    const view = new DataView(buf.buffer);
    view.setUint32(0, totalLen);
    // 'ftyp' tag
    buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70;
    // major brand (4 ASCII chars)
    for (let i = 0; i < 4; i++) buf[8 + i] = majorBrand.charCodeAt(i) || 0;
    view.setUint32(12, minorVersion);
    // compatible brands
    let off = 16;
    for (const b of compatibleBrands) {
      for (let i = 0; i < 4; i++) buf[off + i] = b.charCodeAt(i) || 0;
      off += 4;
    }
    return buf;
  }

  test('6a. major_brand=isom + compatible=avc1,hvc1 -> codec=avc1 (compatible 顺序优先)', () => {
    const bytes = buildFtyp('isom', 512, ['avc1', 'hvc1']);
    const info = parseFtyp(bytes);
    assert.strictEqual(info.majorBrand, 'isom');
    assert.strictEqual(info.codec, 'avc1'); // compatible_brands 第一个匹配的 codec 优先
    assert.strictEqual(info.mimeType, 'video/mp4');
    assert.strictEqual(info.isFragmented, true);
  });

  test('6b. major_brand=mp42 + compatible=mp42,isom -> codec=avc1 (fallback 默认)', () => {
    // No video codec brand — falls back to avc1 default (most common fMP4 codec)
    const bytes = buildFtyp('mp42', 0, ['mp42', 'isom']);
    const info = parseFtyp(bytes);
    assert.strictEqual(info.codec, 'avc1');
  });

  test('6c. major_brand=avc1 直接识别', () => {
    const bytes = buildFtyp('avc1', 0, ['isom']);
    const info = parseFtyp(bytes);
    assert.strictEqual(info.codec, 'avc1');
  });

  test('6d. major_brand=hvc1 识别 HEVC', () => {
    const bytes = buildFtyp('hvc1', 0, ['isom']);
    const info = parseFtyp(bytes);
    assert.strictEqual(info.codec, 'hvc1');
  });

  test('6e. 字节 < 16 抛 FTYP_TOO_SHORT', () => {
    assert.throws(() => parseFtyp(new Uint8Array(15)), /FTYP_TOO_SHORT/);
    assert.throws(() => parseFtyp(new Uint8Array(0)), /FTYP_TOO_SHORT/);
    assert.throws(() => parseFtyp(null), /FTYP_TOO_SHORT/);
  });

  test('6f. tag 不是 ftyp 抛 NOT_FTYP', () => {
    // 'mdat' tag instead
    const buf = new Uint8Array(20);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 20);
    buf[4] = 0x6d; buf[5] = 0x64; buf[6] = 0x61; buf[7] = 0x74; // 'mdat'
    assert.throws(() => parseFtyp(buf), /NOT_FTYP/);
  });

  test('6g. AV1 (av01) 识别', () => {
    const bytes = buildFtyp('isom', 0, ['av01', 'iso5']);
    const info = parseFtyp(bytes);
    assert.strictEqual(info.codec, 'av01');
  });

  test('6h. VP9 (vp09) 识别', () => {
    const bytes = buildFtyp('isom', 0, ['vp09']);
    const info = parseFtyp(bytes);
    assert.strictEqual(info.codec, 'vp09');
  });
});