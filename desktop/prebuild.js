const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DEST = path.join(__dirname, 'src');
function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  fs.readdirSync(s).forEach(f => {
    const sp = path.join(s, f), dp = path.join(d, f);
    fs.statSync(sp).isDirectory() ? copyDir(sp, dp) : fs.copyFileSync(sp, dp);
  });
}
copyDir(SRC, DEST);

// 拷贝媒体依赖到 public/ (供应用运行时本地加载, 避免 CDN + COEP 跨域问题)
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(PUBLIC, { recursive: true });
fs.mkdirSync(path.join(PUBLIC, 'ffmpeg'), { recursive: true });

const hlsSrc = path.join(__dirname, 'node_modules', 'hls.js', 'dist', 'hls.min.js');
const hlsDest = path.join(PUBLIC, 'hls.min.js');
if (fs.existsSync(hlsSrc)) { fs.copyFileSync(hlsSrc, hlsDest); console.log('[prebuild] hls.min.js ->', hlsDest); }

// v0.7.0.1-B-A: 拷 @ffmpeg/ffmpeg (runner) + @ffmpeg/util UMD 包装, 让 renderer
//   能 <script> 加载拿 window.FFmpeg + window.FFmpegUtil.toBlobURL, 不依赖 bare
//   specifier 的 dynamic import (renderer 无 bundler, import('@ffmpeg/...') 失败)
const ffmpegRunnerSrc = path.join(__dirname, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'umd', 'ffmpeg.js');
const ffmpegRunnerDest = path.join(PUBLIC, 'ffmpeg', 'ffmpeg.js');
if (fs.existsSync(ffmpegRunnerSrc)) { fs.copyFileSync(ffmpegRunnerSrc, ffmpegRunnerDest); console.log('[prebuild] ffmpeg.js (runner) ->', ffmpegRunnerDest); }

const ffmpegUtilSrc = path.join(__dirname, 'node_modules', '@ffmpeg', 'util', 'dist', 'umd', 'index.js');
const ffmpegUtilDest = path.join(PUBLIC, 'ffmpeg', 'ffmpeg-util.js');
if (fs.existsSync(ffmpegUtilSrc)) {
  // v0.7.0.1 round 2 fix: 上游 UMD bundle 在 renderer 里炸 — 包装用的是
  //   `e.FFmpegUtil = t()` 但 t() 返回的 inner arrow 工厂体内部直接用
  //   `Object.defineProperty(exports, '__esModule', ...)` / `exports.toBlobURL = ...`,
  //   浏览器里 `exports` / `module` 都是 undefined, IIFE 抛 ReferenceError, 整个
  //   script load 失败 → window.FFmpegUtil 永远 undefined, ffmpeg-loader.js 抛
  //   `window.FFmpegUtil.toBlobURL 未加载` → mkv transmux 全失败.
  //   解法: 渲染端只需要 toBlobURL(url, mime), 写一个 ~50 行的 browser shim 替换
  //   这个 bundle. 行为和上游 toBlobURL 等价 (fetch → Blob → createObjectURL).
  //   fetchFile / importScript / downloadWithProgress 渲染端没人用, 给个 fallback.
  const browserUtilShim = `'use strict';
/* v0.7.0.1 round 2: 浏览器端 @ffmpeg/util shim (上游 umd bundle 在 renderer 抛 ReferenceError, 详见 prebuild.js) */
(function (global) {
  function fetchFile(target) {
    if (typeof target === 'string') {
      const dataMatch = target.match(new RegExp('^data:[^;,]*;base64,(.*)$'));
      if (dataMatch) {
        const binary = atob(dataMatch[2]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return Promise.resolve(bytes);
      }
      return fetch(target).then(function (res) { return res.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
    }
    if (target instanceof URL) {
      return fetch(target).then(function (res) { return res.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
    }
    if (target instanceof File || target instanceof Blob) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          const result = reader.result;
          resolve(result instanceof ArrayBuffer ? new Uint8Array(result) : new Uint8Array(result));
        };
        reader.onerror = function () { reject(new Error('File could not be read! Code=' + (reader.error && reader.error.code || -1))); };
        reader.readAsArrayBuffer(target);
      });
    }
    return Promise.resolve(new Uint8Array(0));
  }

  function importScript(url) {
    return new Promise(function (resolve) {
      const script = document.createElement('script');
      const onLoad = function () { script.removeEventListener('load', onLoad); resolve(); };
      script.src = url;
      script.type = 'text/javascript';
      script.addEventListener('load', onLoad);
      document.getElementsByTagName('head')[0].appendChild(script);
    });
  }

  function downloadWithProgress(url, onProgress) {
    return fetch(url).then(function (res) {
      const total = parseInt(res.headers.get('content-length') || '-1', 10);
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (!reader) {
        return res.arrayBuffer().then(function (buf) {
          if (onProgress) onProgress({ url: url, total: buf.byteLength, received: buf.byteLength, delta: 0, done: true });
          return buf;
        });
      }
      const chunks = [];
      let received = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) {
            if (total !== -1 && total !== received) throw new Error('Incompleted download');
            if (onProgress) onProgress({ url: url, total: total, received: received, delta: 0, done: true });
            const out = new Uint8Array(received);
            let offset = 0;
            for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
            return out.buffer;
          }
          received += step.value.length;
          chunks.push(step.value);
          if (onProgress) onProgress({ url: url, total: total, received: received, delta: step.value.length, done: false });
          return pump();
        });
      }
      return pump().catch(function () {
        return res.arrayBuffer().then(function (buf) {
          if (onProgress) onProgress({ url: url, total: buf.byteLength, received: buf.byteLength, delta: 0, done: true });
          return buf;
        });
      });
    });
  }

  function toBlobURL(url, mime, withProgress, onProgress) {
    const download = withProgress ? downloadWithProgress(url, onProgress) : fetch(url).then(function (r) { return r.arrayBuffer(); });
    return download.then(function (bytes) {
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    });
  }

  global.FFmpegUtil = {
    fetchFile: fetchFile,
    importScript: importScript,
    downloadWithProgress: downloadWithProgress,
    toBlobURL: toBlobURL,
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
  fs.writeFileSync(ffmpegUtilDest, browserUtilShim);
  console.log('[prebuild] ffmpeg-util.js (browser shim) ->', ffmpegUtilDest);
}

const ffmpegSrc = path.join(__dirname, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const ffmpegDest = path.join(PUBLIC, 'ffmpeg');
if (fs.existsSync(ffmpegSrc)) {
  let count = 0;
  for (const f of fs.readdirSync(ffmpegSrc)) {
    if (f.endsWith('.js') || f.endsWith('.wasm')) {
      fs.copyFileSync(path.join(ffmpegSrc, f), path.join(ffmpegDest, f));
      count++;
    }
  }
  console.log('[prebuild] ffmpeg-core.* ('+count+' files) ->', ffmpegDest);
}
