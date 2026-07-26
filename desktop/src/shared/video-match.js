// SyncPlay - 视频匹配检测 (v0.6 FR-3)
// 比较两端视频信息是否"同一视频" — 用于触发 in_room_synced / in_room_mismatch 状态.
//
// 匹配策略 (per REQUIREMENTS.md FR-3): URL + 文件名 + 时长 三重校验, 任一通过即匹配.
//   - URL 相同: https://example.com/foo.mp4 === https://example.com/foo.mp4
//   - 文件名相同: myvideo.mp4 === myvideo.mp4 (用于本地 blob: URL, blob URL 每次会话唯一)
//   - 时长差 < 1s: 浮点误差容忍
//
// 浏览器通过 window.SyncPlayVideoMatch 使用, Node 测试通过 require 使用.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    // v0.7.0.1 round 2: index.html 的 <script src="../../public/..."> 跨目录在
    //   file:// + Electron 38 加载失败, 改成在 video-match.js 顶部动态注入依赖链.
    //   Node 单测走 module.exports 分支不受影响. parser-inserted 脚本在 page load
    //   之前执行, smoke / 真实播放都能拿到 window.SyncPlayMedia.* + SyncPlayHlsPlayer.
    if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__syncPlayMediaBootstrapped) {
      window.__syncPlayMediaBootstrapped = true;
      var MEDIA_SCRIPTS = [
        '../../public/ffmpeg/ffmpeg.js',
        '../../public/ffmpeg/ffmpeg-util.js',
        '../shared/ffmpeg-loader.js',
        '../shared/mp4-ftyp-parser.js',
        '../shared/container-transmux.js',
        'mse-player.js',
        '../../public/hls.min.js',
        'hls-player.js',
      ];
      for (var i = 0; i < MEDIA_SCRIPTS.length; i++) {
        var s = document.createElement('script');
        s.src = MEDIA_SCRIPTS[i];
        s.async = false;
        document.head.appendChild(s);
      }
    }
    root.SyncPlayVideoMatch = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 比较两端视频信息是否匹配
   * @param {VideoInfo|null|undefined} a
   * @param {VideoInfo|null|undefined} b
   * @returns {boolean}
   */
  function videosMatch(a, b) {
    if (!a || !b) return false;
    if (a.loaded === false || b.loaded === false) return false;

    // 优先级 1: URL (去掉 query/fragment 后比较更稳)
    if (a.url && b.url) {
      return normalizeUrl(a.url) === normalizeUrl(b.url);
    }

    // 优先级 2: 文件名 (处理本地文件: blob: URL 每次不同, 比不了 URL)
    if (a.fileName && b.fileName) {
      return a.fileName === b.fileName;
    }

    // 优先级 3: 时长 (浮点容差 1s)
    if (a.duration && b.duration) {
      return Math.abs(a.duration - b.duration) < 1;
    }

    return false;
  }

  /**
   * 规范化 URL: 去掉 fragment, query 保留 (URL 中常有 token)
   * 注意: 短链 / 重定向场景下两端 URL 可能不同, 这种靠 fileName / duration 兜底
   */
  function normalizeUrl(u) {
    if (!u) return '';
    try {
      // 简单处理: 去 fragment (e.g. #t=10)
      const hashIdx = u.indexOf('#');
      return hashIdx === -1 ? u : u.substring(0, hashIdx);
    } catch (e) {
      return u;
    }
  }

  /**
   * 从 <video> 元素 + 加载 label 提取 VideoInfo
   * @param {HTMLVideoElement|Object} video
   * @param {string} [label] - 显示用 label (e.g. "本地: myvideo.mp4" 或 "加载中: foo.mp4")
   * @returns {VideoInfo|null}
   */
  function describeVideo(video, label) {
    if (!video || !video.src) return null;
    const info = { loaded: true };
    // URL load: src 是 http(s):// 或 data:
    if (/^(https?|data):/i.test(video.src)) {
      info.url = video.src;
    }
    // 本地 file load: src 是 blob: — 用 label 兜底出 fileName
    if (label) {
      const m = label.match(/(?:本地[:\s]|加载中[:\s]|已加载[:\s])(.+)$/);
      if (m) info.fileName = m[1].trim();
    }
    if (isFinite(video.duration) && video.duration > 0) {
      info.duration = video.duration;
    }
    return Object.keys(info).length > 1 ? info : null;
  }

  /**
   * 构造"无视频" info (用于清空)
   */
  function emptyVideoInfo() {
    return { loaded: false };
  }

  return { videosMatch, describeVideo, normalizeUrl, emptyVideoInfo };
}));
