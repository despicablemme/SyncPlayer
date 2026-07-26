'use strict';

/**
 * ffmpeg.wasm loader — works in BOTH Node (CJS) and Electron renderer (browser).
 *
 * v0.7.0.1-B-C 重构背景:
 *   原版本顶层 const path = require('path') + 顶层 __dirname 在 renderer
 *   (contextIsolation: true, nodeIntegration: false) 抛 ReferenceError, 导致
 *   container-transmux.js line 3 require('./ffmpeg-loader.js') 整文件炸, 进而
 *   window.SyncPlayMedia.transmuxToFmp4 永远不暴露。
 *
 *   新版本:
 *   - 顶层无 require / __dirname, 任何环境都安全 require/import
 *   - createFfmpeg() 内部按环境分支:
 *       renderer: 用 window.FFmpegWASM.FFmpeg (B-B index.html 注入, UMD 实际全局名
 *                 是 FFmpegWASM 而非 plan 假设的 FFmpeg) + window.FFmpegUtil.toBlobURL,
 *                 basePath 从 window.location 推 ../public/ffmpeg
 *       Node:     动态 import('@ffmpeg/ffmpeg') + import('@ffmpeg/util'),
 *                 basePath 用 require('path').join(__dirname, ...)
 *   - 同步暴露 window.SyncPlayMedia.getFfmpeg / resetFfmpeg (B-C 后续要在 container
 *     -transmux.js 用, 替代顶层 require)
 *
 * Node 单测零破坏:
 *   desktop/test/unit/container-transmux.test.js 6 个测试全部通过
 *   options.getFfmpeg 注入 fake 实现, 真实 createFfmpeg() 在测试中从不执行。
 */

let ffmpegInstance = null;
let loadingPromise = null;

class FfmpegLoadError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'FfmpegLoadError';
    this.code = code;
    this.cause = cause;
  }
}

function classifyLoadError(error) {
  if (error && error.name === 'AbortError') return error;

  const message = error && error.message ? error.message : String(error);
  if (/timeout|timed out/i.test(message)) {
    return new FfmpegLoadError('timeout', message, error);
  }
  if (/fetch|network|failed to fetch|ERR_/i.test(message)) {
    return new FfmpegLoadError('network_error', message, error);
  }
  return new FfmpegLoadError('load_failure', message, error);
}

// Renderer basePath: 从 window.location.href 推 ../public/ffmpeg (renderer 加载的
//   index.html 在 src/client/, 公共资源在 desktop/public/)
//   例: file:///Users/bruce/CodeProjects/syncplay/desktop/src/client/index.html
//     → dirname = .../desktop/src/client/
//     → ../public/ffmpeg → .../desktop/public/ffmpeg/
// v0.7.0.1 round 2 fix: 浏览器 fetch() 不解析 URL 里的 `..`, 必须先 normalize,
  //   否则 toBlobURL('file://.../src/client/../public/ffmpeg/ffmpeg-core.js')
  //   直接抛 "Failed to fetch".
function browserBasePath() {
  if (typeof window === 'undefined') return null;
  // v0.7.0.1 round 2 fix: 路径要 up 两层 (../ 才一层到 src/, 不是 desktop/),
  //   且浏览器 fetch() 不解析 URL 里的 `..`, 必须先 URL() normalize,
  //   否则 toBlobURL('file://.../src/client/../public/ffmpeg/...')
  //   直接抛 "Failed to fetch" (实际写到 src/public/ffmpeg, 文件不在).
  try {
    return new URL('../../public/ffmpeg', window.location.href).pathname;
  } catch (_) {
    const dir = window.location.pathname.replace(/\/[^/]*$/, '');
    return (dir + '/../../public/ffmpeg').replace(/\\/g, '/');
  }
}

// Node basePath: 沿用原版 path.join(__dirname, '..', '..', 'public', 'ffmpeg')
function nodeBasePath() {
  if (typeof require === 'undefined' || typeof __dirname === 'undefined') return null;
  // eslint-disable-next-line global-require
  const path = require('path');
  return path.join(__dirname, '..', '..', 'public', 'ffmpeg').replace(/\\/g, '/');
}

async function loadFfmpegFromBrowser(basePath) {
  // v0.7.0.1-B-C deviation (fix plan §1.3 bug): @ffmpeg/ffmpeg UMD 实际暴露到
  //   window.FFmpegWASM (UMD wrapper 末尾 `e.FFmpegWASM = t()`, t() 返回
  //   {FFmpeg, FFFSType} 命名导出), 不是 plan 假设的 window.FFmpeg。保留
  //   window.FFmpeg fallback 兼容未来可能直暴露 FFmpeg class 的版本。
  const FFmpeg = typeof window.FFmpeg === 'function'
    ? window.FFmpeg
    : window.FFmpegWASM && window.FFmpegWASM.FFmpeg;
  const { toBlobURL } = window.FFmpegUtil && window.FFmpegUtil.toBlobURL
    ? window.FFmpegUtil
    : window.FFmpegUtil && window.FFmpegUtil.default;
  if (typeof FFmpeg !== 'function') throw new FfmpegLoadError('load_failure', 'window.FFmpegWASM.FFmpeg 未加载 (确认 index.html <script src="../../public/ffmpeg/ffmpeg.js">)');
  if (typeof toBlobURL !== 'function') throw new FfmpegLoadError('load_failure', 'window.FFmpegUtil.toBlobURL 未加载 (确认 index.html <script src="../../public/ffmpeg/ffmpeg-util.js">)');

  const ffmpeg = new FFmpeg();
  const coreURL = await toBlobURL(`file://${basePath}/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`file://${basePath}/ffmpeg-core.wasm`, 'application/wasm');
  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

async function loadFfmpegFromNode(basePath) {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  const ffmpeg = new FFmpeg();
  const coreURL = await toBlobURL(`file://${basePath}/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`file://${basePath}/ffmpeg-core.wasm`, 'application/wasm');
  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

async function createFfmpeg() {
  // v0.7.0.1 round 2 fix: 上游 UMD 实际暴露 window.FFmpegWASM.FFmpeg, 不一定
  //   window.FFmpeg. 光检查 window.FFmpeg 会漏掉 B-B 注入的全局, 误判成
  //   "非浏览器" → 走 nodeBasePath → 在 renderer 抛 "无法解析 basePath".
  const inBrowser = typeof window !== 'undefined'
    && (typeof window.FFmpeg === 'function'
        || (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function'));
  const basePath = inBrowser ? browserBasePath() : nodeBasePath();
  if (!basePath) {
    throw new FfmpegLoadError('load_failure', '无法解析 ffmpeg-core basePath (既不在 browser 也不在 Node 环境)');
  }
  return inBrowser
    ? loadFfmpegFromBrowser(basePath)
    : loadFfmpegFromNode(basePath);
}

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = createFfmpeg()
    .then((ffmpeg) => {
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })
    .catch((error) => {
      throw classifyLoadError(error);
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

function resetFfmpeg({ terminate = true } = {}) {
  const ffmpeg = ffmpegInstance;
  ffmpegInstance = null;
  loadingPromise = null;

  if (terminate && ffmpeg) {
    try { ffmpeg.terminate(); } catch {}
  }
}

const exported = {
  FfmpegLoadError,
  getFfmpeg,
  resetFfmpeg,
  _classifyLoadError: classifyLoadError,
};

// CJS 出口 (Node 单测 / CommonJS 消费方)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

// Browser 出口 (Electron renderer 端, container-transmux.js 通过 window.SyncPlayMedia.getFfmpeg 取)
//   必须在 container-transmux.js 之前加载 (index.html 已经保证顺序: ffmpeg.js →
//   ffmpeg-util.js → mp4-ftyp-parser.js → container-transmux.js)
if (typeof window !== 'undefined') {
  window.SyncPlayMedia = window.SyncPlayMedia || {};
  Object.assign(window.SyncPlayMedia, exported);
}
