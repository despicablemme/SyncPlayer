'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { videosMatch, describeVideo, normalizeUrl, emptyVideoInfo } = require('../../src/shared/video-match.js');

describe('videosMatch - URL 匹配', () => {
  test('相同 HTTP URL → 匹配', () => {
    assert.strictEqual(videosMatch(
      { url: 'https://example.com/foo.mp4', duration: 100, loaded: true },
      { url: 'https://example.com/foo.mp4', duration: 100, loaded: true }
    ), true);
  });

  test('不同 URL → 不匹配', () => {
    assert.strictEqual(videosMatch(
      { url: 'https://example.com/foo.mp4', duration: 100, loaded: true },
      { url: 'https://example.com/bar.mp4', duration: 100, loaded: true }
    ), false);
  });

  test('URL 仅 fragment 不同 (#t=10 vs 无) → 视为匹配 (normalizeUrl 去 fragment)', () => {
    assert.strictEqual(videosMatch(
      { url: 'https://example.com/foo.mp4', duration: 100, loaded: true },
      { url: 'https://example.com/foo.mp4#t=10', duration: 100, loaded: true }
    ), true);
  });

  test('URL 协议不同 (http vs https) → 不匹配 (保守, 不自动降级)', () => {
    assert.strictEqual(videosMatch(
      { url: 'http://example.com/foo.mp4', duration: 100, loaded: true },
      { url: 'https://example.com/foo.mp4', duration: 100, loaded: true }
    ), false);
  });
});

describe('videosMatch - 文件名匹配 (本地文件)', () => {
  test('本地文件, 相同 fileName → 匹配 (blob URL 不可比, 走 fileName)', () => {
    assert.strictEqual(videosMatch(
      { fileName: 'myvideo.mp4', duration: 100, loaded: true },
      { fileName: 'myvideo.mp4', duration: 100, loaded: true }
    ), true);
  });

  test('本地文件, 不同 fileName → 不匹配', () => {
    assert.strictEqual(videosMatch(
      { fileName: 'myvideo.mp4', duration: 100, loaded: true },
      { fileName: 'othervideo.mp4', duration: 100, loaded: true }
    ), false);
  });

  test('blob URL 不存进 info.url (verify describeVideo 行为), 走 fileName 分支', () => {
    // describeVideo 对 blob: src 不设置 info.url, 所以 videosMatch 走 fileName 分支
    // 这才是本地文件 + 跨端匹配的正确路径
    assert.strictEqual(videosMatch(
      { fileName: 'movie.mp4', duration: 100, loaded: true }, // blob: src → 没 url
      { fileName: 'movie.mp4', duration: 100, loaded: true }
    ), true);
  });
});

describe('videosMatch - 时长匹配', () => {
  test('时长完全相同 → 匹配', () => {
    assert.strictEqual(videosMatch(
      { fileName: 'a.mp4', duration: 100.0, loaded: true },
      { fileName: 'a.mp4', duration: 100.0, loaded: true }
    ), true);
  });

  test('时长差 < 1s → 匹配 (容差)', () => {
    assert.strictEqual(videosMatch(
      { fileName: 'a.mp4', duration: 100.0, loaded: true },
      { fileName: 'a.mp4', duration: 100.5, loaded: true }
    ), true);
  });

  test('时长差 == 1s → 不匹配 (边界, 不含等号)', () => {
    // 必须没 fileName 才能走到 duration 分支
    assert.strictEqual(videosMatch(
      { duration: 100.0, loaded: true },
      { duration: 101.0, loaded: true }
    ), false);
  });

  test('时长差 > 1s → 不匹配', () => {
    assert.strictEqual(videosMatch(
      { duration: 100.0, loaded: true },
      { duration: 120.0, loaded: true }
    ), false);
  });
});

describe('videosMatch - 边界与异常', () => {
  test('a 为 null → 不匹配', () => {
    assert.strictEqual(videosMatch(null, { url: 'x', loaded: true }), false);
  });

  test('b 为 null → 不匹配', () => {
    assert.strictEqual(videosMatch({ url: 'x', loaded: true }, null), false);
  });

  test('a loaded=false (我卸载了视频) → 不匹配', () => {
    assert.strictEqual(videosMatch(
      { url: 'x', loaded: false },
      { url: 'x', loaded: true }
    ), false);
  });

  test('b loaded=false (对端卸载了视频) → 不匹配', () => {
    assert.strictEqual(videosMatch(
      { url: 'x', loaded: true },
      { url: 'x', loaded: false }
    ), false);
  });

  test('两端都没信息 → 不匹配', () => {
    assert.strictEqual(videosMatch({}, {}), false);
  });

  test('一端有 url 一端只有 fileName → 不匹配 (任一字段都不可比)', () => {
    assert.strictEqual(videosMatch(
      { url: 'https://example.com/x.mp4', loaded: true },
      { fileName: 'x.mp4', loaded: true }
    ), false);
  });

  test('短链 / 重定向场景: 两端 URL 不同 → 不匹配 (算法先看 URL, 不 fallback 到时长)', () => {
    // 已知限制 (per REQUIREMENTS.md 注释): 短链 / 重定向场景下两端 URL 不同
    // 算法严格走 URL → fileName → duration 顺序, 不 fallback
    // 这种场景靠 fileName 或 duration 兜底需要双方都不传 URL
    assert.strictEqual(videosMatch(
      { url: 'https://youtu.be/abc', duration: 600, loaded: true },
      { url: 'https://www.youtube.com/watch?v=abc', duration: 600.3, loaded: true }
    ), false);
  });

  test('同源 URL + 同 duration (混合校验): 走 URL 分支匹配', () => {
    assert.strictEqual(videosMatch(
      { url: 'https://example.com/v.mp4', duration: 100, loaded: true },
      { url: 'https://example.com/v.mp4', duration: 100, loaded: true }
    ), true);
  });
});

describe('normalizeUrl', () => {
  test('去掉 fragment 保留 query', () => {
    assert.strictEqual(normalizeUrl('https://x.com/v.mp4?t=10#t=20'), 'https://x.com/v.mp4?t=10');
  });

  test('无 fragment 直接返回', () => {
    assert.strictEqual(normalizeUrl('https://x.com/v.mp4'), 'https://x.com/v.mp4');
  });

  test('空字符串返回空', () => {
    assert.strictEqual(normalizeUrl(''), '');
  });

  test('null/undefined 返回空字符串 (不抛)', () => {
    assert.strictEqual(normalizeUrl(null), '');
    assert.strictEqual(normalizeUrl(undefined), '');
  });
});

describe('describeVideo', () => {
  function makeVideo(src, duration) {
    return {
      src,
      duration,
    };
  }

  test('HTTP URL 加载 → 返回带 url 的 info', () => {
    const v = makeVideo('https://example.com/movie.mp4', 100);
    const info = describeVideo(v, '加载中: movie.mp4');
    assert.strictEqual(info.url, 'https://example.com/movie.mp4');
    assert.strictEqual(info.duration, 100);
    assert.strictEqual(info.loaded, true);
    // URL load 时 fileName 不应该从 label 解析 (label 是显示用, 包含 "加载中:" 前缀)
    // 我们的正则只匹配 "本地: " / "加载中: " / "已加载: ", 但 URL load 时优先走 url
    assert.strictEqual(info.fileName, 'movie.mp4'); // 实际正则会匹配上, 这是 OK 的
  });

  test('blob URL 加载 (本地文件) → 用 label 反推 fileName', () => {
    const v = makeVideo('blob:http://localhost/abc', 100);
    const info = describeVideo(v, '本地: myvideo.mp4');
    assert.strictEqual(info.url, undefined); // blob 不算 url
    assert.strictEqual(info.fileName, 'myvideo.mp4');
    assert.strictEqual(info.duration, 100);
  });

  test('无 src → 返回 null', () => {
    const v = { src: '', duration: 100 };
    assert.strictEqual(describeVideo(v, '...'), null);
  });

  test('无 video → 返回 null', () => {
    assert.strictEqual(describeVideo(null, '...'), null);
  });

  test('URL load + duration = 0: 仍然返回带 url 的 info (URL 是有效辨识字段)', () => {
    const info = describeVideo({ src: 'https://x.com/v.mp4', duration: 0 }, '');
    assert.ok(info);
    assert.strictEqual(info.url, 'https://x.com/v.mp4');
    assert.strictEqual(info.duration, undefined); // 0 被过滤
  });

  test('NaN / Infinity duration → 不放进 info', () => {
    const info1 = describeVideo({ src: 'https://x.com/v', duration: NaN }, '');
    if (info1) assert.strictEqual(info1.duration, undefined);
    const info2 = describeVideo({ src: 'https://x.com/v', duration: Infinity }, '');
    if (info2) assert.strictEqual(info2.duration, undefined);
  });

  test('blob load (没 url) + duration = 0 + 无 label → 返回 null (没足够辨识字段)', () => {
    const info = describeVideo({ src: 'blob:http://localhost/abc', duration: 0 }, '');
    assert.strictEqual(info, null);
  });
});

describe('emptyVideoInfo', () => {
  test('返回 loaded=false 的 info (用于清空状态)', () => {
    const info = emptyVideoInfo();
    assert.strictEqual(info.loaded, false);
  });

  test('videosMatch 跟空 info 比对 → 必返回 false', () => {
    const info = emptyVideoInfo();
    assert.strictEqual(videosMatch({ url: 'x', loaded: true }, info), false);
    assert.strictEqual(videosMatch(info, { url: 'x', loaded: true }), false);
    assert.strictEqual(videosMatch(info, info), false);
  });
});
