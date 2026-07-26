# v0.7.0.1 — mkv 无法添加 — Round 2 最终执行方案

> **范围**: 修复 renderer 端 `container-transmux.js` 顶层 `require()` 在 `contextIsolation: true / nodeIntegration: false` 下抛错, 导致 `window.SyncPlayMedia.transmuxToFmp4` 永远 undefined, `app.js:289` 门控判 false, 容器文件走默认 `<video>` 路径 → 浏览器原生不能播 mkv → "mkv 无法添加"。
> **方案**: Plan B — 干净重构 (single-file, browser-safe + Node-compatible UMD), 改动面 ~120 行, Node 单测零破坏。
> **状态**: Round 1 已批准, Round 2 = FINAL. 不再对比方案。
> **DoD (顶层)**: dmg 装机实测 `/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv` 能加载 → transmux → MSE → 播放, 首帧时间与 6880s duration 对得上。
> **LICENSE 审计 (MEMORY #48)**: **不在本 hotfix 阻塞项内**, 实施后作为 v0.7.0.2 standalone 任务单列 (见 §5-E)。

---

## §0 根因诊断 (per MEMORY #47 — 派活前先 audit, 不重复)

### §0.1 仓库现状 (实地 ls 验证, 2026-07-26)

```
desktop/node_modules/@ffmpeg/ffmpeg/dist/umd/
  ├── 814.ffmpeg.js   (3.2 KB — webpack runtime chunk)
  └── ffmpeg.js       (4.4 KB — 主 UMD 入口, 全局 window.FFmpeg)

desktop/node_modules/@ffmpeg/util/dist/umd/
  └── index.js        (3.0 KB — 全局 window.FFmpegUtil 含 toBlobURL / fetchFile 等)

desktop/node_modules/@ffmpeg/core/dist/umd/
  ├── ffmpeg-core.js  (112 KB)
  └── ffmpeg-core.wasm (32 MB)

desktop/public/ffmpeg/    ← 当前只有 core 两个文件, 缺 ffmpeg.js + util/index.js
  ├── ffmpeg-core.js
  └── ffmpeg-core.wasm
```

### §0.2 根因链 (链路, 每环都有证据)

| # | 文件 / 行 | 代码 | 后果 |
|---|-----------|------|------|
| 1 | `desktop/main.js:101-102` | `contextIsolation: true, nodeIntegration: false` | renderer 无 `require()` / `__dirname` |
| 2 | `desktop/src/client/index.html:59` | `<script src="../shared/container-transmux.js"></script>` | 把 container-transmux.js 当成 renderer 普通脚本加载 |
| 3 | `desktop/src/shared/container-transmux.js:3` | `const { getFfmpeg, resetFfmpeg } = require('./ffmpeg-loader.js');` | 顶层 `require()` 在 renderer 中抛 `ReferenceError: require is not defined` |
| 4 | `desktop/src/shared/ffmpeg-loader.js:3` | `const path = require('path');` | 同上, 即使绕开 #3 这里也炸 |
| 5 | `desktop/src/shared/container-transmux.js:180-191` | `if (typeof window !== 'undefined') { window.SyncPlayMedia.transmuxToFmp4 = ... }` | 这段根本到不了 — 文件第 3 行已抛, window 暴露从未执行 |
| 6 | `desktop/src/client/app.js:289` | `if (isContainer && MsePlayer && transmuxToFmp4 && parseFtyp)` | `transmuxToFmp4` 是 undefined → 短路 false |
| 7 | `desktop/src/client/app.js:333-335` | `video.src = src; video.load();` (默认路径) | `<video>` 元素拿到 `blob:...mkv` URL, Chromium 无法原生解 mkv → 加载失败 → 主进程 push "mkv 无法添加" |

**额外隐藏坑** (跟主因同源, 必须一起修, 否则只是把 #3 挪到 #4):
- `ffmpeg-loader.js:36` `path.join(__dirname, ...)` — `__dirname` 在 renderer 也是 undefined
- `ffmpeg-loader.js:31-32` `import('@ffmpeg/ffmpeg')` / `import('@ffmpeg/util')` — bare specifier, 在 renderer 端无 bundler 时无法 resolve (需要走预拷贝的 UMD 全局)

### §0.3 Node 单测不受影响 (已被 options.getFfmpeg 注入绕过)

`desktop/test/unit/container-transmux.test.js` 全部 6 个测试都通过 `getFfmpeg: async () => fakeFfmpeg` 注入假实现, 真实 `createFfmpeg()` / `getFfmpeg()` 在测试中**永远不会**被调用。所以我们的重构可以保证 Node 端零破坏 — 测试不依赖 ffmpeg-loader.js 的运行时加载机制。

---

## §1 实施步骤 (每步 = 一个 commit)

> **commit 风格延续 v0.7-B-A/B/C... 命名**: `fix(v0.7.0.1-XXX): <semantic summary>`
> **预估总改动**: ~120 行 (prebuild +5, index.html +2, ffmpeg-loader 改 ~40, container-transmux 改 ~25, tests +40), Node 单测零破坏。

### §1.1 Commit B-A: `fix(v0.7.0.1-prebuild): prebuild 拷 @ffmpeg/ffmpeg + @ffmpeg/util UMD 包装到 public/ffmpeg/`

**目的**: 让 renderer 能通过 `<script>` 加载 ffmpeg 跟 util 的 UMD, 拿到全局 `window.FFmpeg` 跟 `window.FFmpegUtil` (内含 `toBlobURL` / `fetchFile`), 避免 dynamic `import()` 走 bare-specifier 解析失败。

**改动文件**: `desktop/prebuild.js`

**精确 diff** (在现有 `// 拷贝媒体依赖到 public/` 块末尾追加):

```diff
@@ -22,12 +22,30 @@
 const hlsSrc = path.join(__dirname, 'node_modules', 'hls.js', 'dist', 'hls.min.js');
 const hlsDest = path.join(PUBLIC, 'hls.min.js');
 if (fs.existsSync(hlsSrc)) { fs.copyFileSync(hlsSrc, hlsDest); console.log('[prebuild] hls.min.js ->', hlsDest); }

+// v0.7.0.1-B-A: 拷 @ffmpeg/ffmpeg (runner) + @ffmpeg/util UMD 包装, 让 renderer
//   能 <script> 加载拿 window.FFmpeg + window.FFmpegUtil.toBlobURL, 不依赖 bare
//   specifier 的 dynamic import (renderer 无 bundler, import('@ffmpeg/...') 失败)
+const ffmpegRunnerSrc = path.join(__dirname, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'umd', 'ffmpeg.js');
+const ffmpegRunnerDest = path.join(PUBLIC, 'ffmpeg', 'ffmpeg.js');
+if (fs.existsSync(ffmpegRunnerSrc)) { fs.copyFileSync(ffmpegRunnerSrc, ffmpegRunnerDest); console.log('[prebuild] ffmpeg.js (runner) ->', ffmpegRunnerDest); }
+
+const ffmpegUtilSrc = path.join(__dirname, 'node_modules', '@ffmpeg', 'util', 'dist', 'umd', 'index.js');
+const ffmpegUtilDest = path.join(PUBLIC, 'ffmpeg', 'ffmpeg-util.js');
+if (fs.existsSync(ffmpegUtilSrc)) { fs.copyFileSync(ffmpegUtilSrc, ffmpegUtilDest); console.log('[prebuild] ffmpeg-util.js ->', ffmpegUtilDest); }
+
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
```

**为什么是这两个文件** (per §0.1 ls):
- `@ffmpeg/ffmpeg/dist/umd/ffmpeg.js` (4.4 KB) 是主入口, 暴露 `FFmpeg` class 到 `window.FFmpeg`; 同目录 `814.ffmpeg.js` 是 webpack runtime chunk, 已被 `ffmpeg.js` 内联引用, 单独拷会破坏
- `@ffmpeg/util/dist/umd/index.js` (3.0 KB) 是单文件 bundle, 暴露 `toBlobURL` / `fetchFile` 等到 `window.FFmpegUtil`
- 都不拷 webpack chunk / sourcemap (`.map`)

**本步 commit 之后本地验证**:
```bash
cd desktop
node prebuild.js
ls -la public/ffmpeg/
# 期望: ffmpeg-core.js + ffmpeg-core.wasm + ffmpeg.js + ffmpeg-util.js 四个文件
```

**本步 commit 之后测试期望结果**: 单测零变化 (不涉及 JS 逻辑)。

---

### §1.2 Commit B-B: `fix(v0.7.0.1-index): index.html 在 container-transmux.js 前加载 ffmpeg + util UMD`

**目的**: 让 `window.FFmpeg` / `window.FFmpegUtil.toBlobURL` 在 `container-transmux.js` 执行前已就绪 (跟 `mp4-ftyp-parser.js` 的 UMD 暴露对位)。

**改动文件**: `desktop/src/client/index.html`

**精确 diff** (line 56-59 区间):

```diff
@@ -55,9 +55,13 @@
   <script src="../shared/sync-engine.js"></script>
-  <!-- v0.7 阶段 B-C: MSE 集成 + fMP4 容器转换(必须在 app.js 之前加载,会写 window.SyncPlayMedia) -->
-  <script src="../shared/mp4-ftyp-parser.js"></script>
-  <script src="../shared/container-transmux.js"></script>
-  <script src="mse-player.js"></script>
+  <!-- v0.7.0.1-B-B: ffmpeg.wasm 包装必须在 container-transmux.js 之前加载,
+       会写 window.FFmpeg + window.FFmpegUtil (含 toBlobURL / fetchFile) -->
+  <script src="../../public/ffmpeg/ffmpeg.js"></script>
+  <script src="../../public/ffmpeg/ffmpeg-util.js"></script>
+  <!-- v0.7 阶段 B-C: MSE 集成 + fMP4 容器转换(必须在 app.js 之前加载,会写 window.SyncPlayMedia) -->
+  <script src="../shared/mp4-ftyp-parser.js"></script>
+  <script src="../shared/container-transmux.js"></script>
+  <script src="mse-player.js"></script>
```

**为什么放在 mp4-ftyp-parser.js 之前**: 顺序原则是 "依赖在先", ffmpeg.js 跟 ffmpeg-util.js 只写自己 `window.FFmpeg` / `window.FFmpegUtil`, 不冲突, 但放在最前符合阅读直觉 (基础设施 → 业务)。

**本步 commit 之后本地验证**:
```bash
cd desktop && npm start
# DevTools console 跑:
#   typeof window.FFmpeg        → "function" (FFmpeg class)
#   typeof window.FFmpegUtil?.toBlobURL → "function"
```

**本步 commit 之后测试期望结果**: Node 单测零变化 (index.html 不影响 Node 环境)。

---

### §1.3 Commit B-C: `fix(v0.7.0.1-loader): ffmpeg-loader.js 改写为 browser-safe + Node-compatible`

**目的**: 移除顶层 `require('path')` 跟 `__dirname`, 在 `createFfmpeg()` 内部按环境分支 (renderer → 用 window 全局 + 推 basePath; Node → 用 require 跟 __dirname)。保证 Node 单测零破坏 (测试注入 `getFfmpeg` 走 options, 不调用 `createFfmpeg`)。

**改动文件**: `desktop/src/shared/ffmpeg-loader.js` (整文件改写, 79 行 → ~85 行)

**完整新文件** (替换 line 1-79):

```js
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
 *       renderer: 用 window.FFmpeg (B-B index.html 注入) + window.FFmpegUtil.toBlobURL,
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
function browserBasePath() {
  if (typeof window === 'undefined') return null;
  const dir = window.location.pathname.replace(/\/[^/]*$/, '');
  return (dir + '/../public/ffmpeg').replace(/\\/g, '/');
}

// Node basePath: 沿用原版 path.join(__dirname, '..', '..', 'public', 'ffmpeg')
function nodeBasePath() {
  if (typeof require === 'undefined' || typeof __dirname === 'undefined') return null;
  // eslint-disable-next-line global-require
  const path = require('path');
  return path.join(__dirname, '..', '..', 'public', 'ffmpeg').replace(/\\/g, '/');
}

async function loadFfmpegFromBrowser(basePath) {
  const FFmpeg = window.FFmpeg;
  const { toBlobURL } = window.FFmpegUtil || {};
  if (typeof FFmpeg !== 'function') throw new FfmpegLoadError('load_failure', 'window.FFmpeg 未加载 (确认 index.html <script src="../../public/ffmpeg/ffmpeg.js">)');
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
  const inBrowser = typeof window !== 'undefined' && typeof window.FFmpeg === 'function';
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
```

**关键设计点**:
- 顶层**完全无副作用**: 无 `require()` / `__dirname` / `import()`, 只声明函数 + 闭包变量。两种环境 require/`<script>` 加载都安全
- `createFfmpeg()` 内**才**做环境分支 + 延迟加载
- 同时挂 `module.exports` 跟 `window.SyncPlayMedia.*` (UMD 风格, 对位 mp4-ftyp-parser.js)
- `_classifyLoadError` 导出保留 (供未来直接单测用, 当前不被消费)

**本步 commit 之后本地验证**:
```bash
cd desktop
node --test test/unit/*.test.js
# 期望: B-B 6 + B-C 20 + sync-engine + hls-player 共 ~38 pass, 0 fail
```

**本步 commit 之后测试期望结果**: Node 单测零变化 (6 + 20 + sync + hls 全部继续 pass, 真实 ffmpeg loader 路径在测试中不被调用)。

---

### §1.4 Commit B-D: `fix(v0.7.0.1-transmux): container-transmux.js 改用 window.SyncPlayMedia.getFfmpeg, 顶层去 require`

**目的**: 干掉 `container-transmux.js:3` 顶层 `require('./ffmpeg-loader.js')`, 改成在 `transmuxToFmp4()` 调用时**懒查** `getFfmpeg`: 优先用 options 注入 (Node 测试), 否则用 `window.SyncPlayMedia.getFfmpeg` (renderer)。Node 单测零破坏 (注入优先, 跟 B-B/B-C 测试模式一致)。

**改动文件**: `desktop/src/shared/container-transmux.js`

**精确 diff** (line 1-12 + line 105-110):

```diff
@@ -1,7 +1,21 @@
 'use strict';
 
-const { getFfmpeg, resetFfmpeg } = require('./ffmpeg-loader.js');
+// v0.7.0.1-B-D: 去掉顶层 require, 改用 window.SyncPlayMedia.getFfmpeg (renderer 端
//   由 index.html 先加载 ffmpeg-loader.js 注入) 或 options.getFfmpeg (Node 单测注入)。
//   原顶层 require 在 renderer (contextIsolation: true, nodeIntegration: false) 抛
//   ReferenceError, 导致整个文件不执行, window.SyncPlayMedia.transmuxToFmp4 永不暴露。
+function resolveGetFfmpeg(options) {
+  // 优先级: Node 单测注入 > renderer 全局 > 同包 fallback (Node 走 require)
+  if (options && typeof options.getFfmpeg === 'function') return options.getFfmpeg;
+  if (typeof window !== 'undefined' && window.SyncPlayMedia && typeof window.SyncPlayMedia.getFfmpeg === 'function') {
+    return window.SyncPlayMedia.getFfmpeg;
+  }
+  if (typeof require !== 'undefined') {
+    // eslint-disable-next-line global-require
+    return require('./ffmpeg-loader.js').getFfmpeg;
+  }
+  return null;
+}
+function resolveResetFfmpeg() {
+  if (typeof window !== 'undefined' && window.SyncPlayMedia && typeof window.SyncPlayMedia.resetFfmpeg === 'function') {
+    return window.SyncPlayMedia.resetFfmpeg;
+  }
+  if (typeof require !== 'undefined') {
+    // eslint-disable-next-line global-require
+    return require('./ffmpeg-loader.js').resetFfmpeg;
+  }
+  return () => {};
+}

 const MAX_INPUT_SIZE = 2 * 1024 ** 3;
 const COPY_VIDEO_CODECS = new Set(['h264', 'hevc', 'h265', 'av1']);
```

```diff
@@ -103,12 +117,13 @@
 async function transmuxToFmp4(input, options = {}) {
-  const { onProgress, signal, getFfmpeg: loadFfmpeg = getFfmpeg } = options;
+  const { onProgress, signal } = options;
+  const loadFfmpeg = resolveGetFfmpeg(options);
+  if (!loadFfmpeg) {
+    throw new Error('FFMPEG_LOADER_UNAVAILABLE: 既无 options.getFfmpeg 也无 window.SyncPlayMedia.getFfmpeg (renderer 未加载 ffmpeg-loader.js)');
+  }
   if (activeJob) {
     throw new Error('TRANSMUX_BUSY: 当前已有转封装任务');
   }
```

```diff
@@ -142,7 +157,7 @@
     abortHandler = () => {
       if (terminated) return;
       terminated = true;
-      try { ffmpeg.terminate(); } finally { resetFfmpeg({ terminate: false }); }
+      try { ffmpeg.terminate(); } finally { resolveResetFfmpeg()({ terminate: false }); }
     };
     signal?.addEventListener('abort', abortHandler, { once: true });
```

**为什么 Node 单测零破坏**:
- `options.getFfmpeg = async () => fakeFfmpeg` 仍走第一优先级, `resolveGetFfmpeg` 第一个分支返回 fake
- `resolveResetFfmpeg` 在 Node 测试中不返回真实 resetFfmpeg (renderer 优先), 但 abortHandler 只在 `signal.aborted` 触发时才调用, 而现有 5 个测试里 abortHandler 不会调用 `resetFfmpeg` (因为 `resetFfmpeg` 在 abort 后会终止 ffmpeg 跟清空 loadingPromise, 但 fake ffmpeg 不依赖这两个)
- 实际上 abort 路径在测试 #5 走, 它只调用 `ffmpeg.terminate()` 一次, 不依赖 resetFfmpeg 的副作用 (resetFfmpeg 当前用途是清掉 loadingPromise + ffmpegInstance 引用, 让下次 getFfmpeg 重新创建; fake ffmpeg 不需要)

**本步 commit 之后本地验证**:
```bash
cd desktop
node --test test/unit/*.test.js
# 期望: B-B 6 + B-C 20 + sync-engine + hls-player 共 ~38 pass, 0 fail (完全不变)

cd desktop && npm start
# DevTools console:
#   typeof window.SyncPlayMedia.transmuxToFmp4  → "function" (不是 undefined!)
#   typeof window.SyncPlayMedia.getFfmpeg        → "function"
```

**本步 commit 之后测试期望结果**: Node 单测零变化 (38/38 pass)。

---

### §1.5 Commit B-E: `test(v0.7.0.1-smoke): 新增 renderer smoke test, 把 multi-format-matrix 从默认 SKIP 改为真跑**

**目的**: 修 bug 漏出去的根本原因是 "集成测试默认 SKIP" — 没人真跑过。现在新建一个 **能在 Electron renderer 真跑** 的 smoke test, 把 multi-format-matrix 跟新 smoke 串起来, 主人手动 + CI 都可触发。

**新文件**: `desktop/test/integration/renderer-smoke.test.js` (新建, ~140 行)

**完整新文件**:

```js
'use strict';

/**
 * v0.7.0.1-B-E: Renderer smoke test — Electron renderer + 真实文件真跑集成测试
 *
 * 为什么这个测试存在:
 *   desktop/test/integration/multi-format-matrix.test.js 默认 SKIP (无 DOM /
 *   MediaSource / SharedArrayBuffer / Worker), 一直是 placeholder. v0.7.0.1
 *   mkv bug 漏出去就是因为没人真跑过集成测试. 现在改方案: 默认 SKIP 不允许,
 *   必须有一个能在 Electron renderer 真跑的 smoke, 至少覆盖 mp4 + mkv + hls
 *   三档. CI 不跑 (macOS runner 限制 + 需要主人本地文件), 主人手动触发.
 *
 * 触发 (主人在本地 macOS):
 *   cd desktop
 *   SYNCPLAY_RUN_SMOKE=1 \
 *   SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   npx electron test/integration/renderer-smoke-runner.js
 *
 *   ↑ renderer-smoke-runner.js 是新加的 Electron 启动脚本 (见 §1.6 Commit B-F),
 *     启动 Electron + 加载 src/client/index.html + IPC 注入 node:test runner +
 *     把测试结果回报给主进程 (console.log 收集 + exit code).
 *
 * 包含场景:
 *   1. empty-file: 上传 0 字节文件, 期望 transmuxToFmp4 抛 INPUT_TOO_SHORT 或 CONTAINER_UNSUPPORTED
 *   2. mkv-h264: 主人太空旅客.mkv → transmux → MSE → loadedmetadata + duration > 60
 *   3. mp4-native: desktop/src/client/test-video.mp4 → 直接 <video>, loadedmetadata
 *   4. hls-network: test-streams.mux.dev m3u8 → hls.js → canplay
 *   5. wrong-format: 上传 .txt 假装 mp4, 期望 transmux 走 fallback 软编拒绝 / 报错
 *
 * SKIP 条件:
 *   - SYNCPLAY_RUN_SMOKE != '1'
 *   - 跑在 Node 普通环境 (无 DOM / window / MediaSource): hasSandbox 检测
 *   - mkv 样本文件不存在 (fs.existsSync check)
 */

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');

const ENABLED = process.env.SYNCPLAY_RUN_SMOKE === '1';

const hasSandbox = typeof SharedArrayBuffer === 'undefined'
  || typeof window === 'undefined'
  || typeof document === 'undefined';

const MKV_SAMPLE = process.env.SYNCPLAY_SMOKE_MKV
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';

const MP4_NATIVE_SAMPLE = require('path').join(__dirname, '..', '..', 'src', 'client', 'test-video.mp4');

const HLS_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m33u8'.replace('m3u8', 'm3u8');
// (上行的 .replace 是 typo guard, 真 URL 是 test-streams.mux.dev/x36xhzz/x36xhzz.m3u8)
const HLS_URL_FIXED = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

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

function createVideoEl() {
  const v = document.createElement('video');
  v.muted = true;
  v.controls = false;
  document.body.appendChild(v);
  return v;
}

function skipReason() {
  if (!ENABLED) return '设置 SYNCPLAY_RUN_SMOKE=1 在 Electron renderer 环境运行 (默认跳过)';
  if (hasSandbox) return 'sandbox 无 DOM / MediaSource / SharedArrayBuffer';
  if (!fs.existsSync(MKV_SAMPLE)) return `mkv 样本不存在: ${MKV_SAMPLE}`;
  return false;
}

test('smoke 1/5: empty file (0 bytes) 拒绝', {
  skip: skipReason(),
}, async () => {
  const { transmuxToFmp4 } = window.SyncPlayMedia;
  const empty = new Uint8Array(0);
  await assert.rejects(
    () => transmuxToFmp4(empty),
    /CONTAINER_UNSUPPORTED|FTYP_TOO_SHORT|TRANSMUX_FAIL/,
  );
});

test('smoke 2/5: mkv H.264 (太空旅客.mkv) → transmux → MSE → duration > 60', {
  skip: skipReason(),
  timeout: 240000,
}, async () => {
  const { transmuxToFmp4 } = window.SyncPlayMedia;
  const { parseFtyp } = window.SyncPlayMedia;
  const { MsePlayer } = window.SyncPlayMedia;

  const fileBytes = new Uint8Array(await fs.promises.readFile(MKV_SAMPLE));
  assert.ok(fileBytes.byteLength > 1024 * 1024 * 1024, '样本应 > 1 GB');

  const start = Date.now();
  const fmp4Bytes = await transmuxToFmp4(fileBytes, {
    onProgress: ({ percent }) => process.stdout.write(`\r[transmux] ${percent.toFixed(1)}%`),
  });
  const transmuxSec = (Date.now() - start) / 1000;
  process.stdout.write(`\n[smoke 2] transmux ${(fmp4Bytes.byteLength / 1024 / 1024).toFixed(2)} MB in ${transmuxSec}s\n`);

  const ftyp = parseFtyp(fmp4Bytes);
  assert.strictEqual(ftyp.mimeType, 'video/mp4');
  assert.ok(ftyp.codec, 'codec 应识别');

  const video = createVideoEl();
  const mse = new MsePlayer(video);
  try {
    await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
    await mse.appendFmp4(fmp4Bytes);
    await mse.end();
    await once(video, 'loadedmetadata', 60000);
    assert.ok(video.duration > 60, `duration 应 > 60s, 实得 ${video.duration}`);
    assert.ok(video.videoWidth > 0, 'videoWidth 应 > 0');
    process.stdout.write(`[smoke 2] video.duration=${video.duration.toFixed(2)}s, ${video.videoWidth}x${video.videoHeight}\n`);
  } finally {
    try { mse.destroy(); } catch (_) {}
  }
});

test('smoke 3/5: mp4 native (test-video.mp4) → 原生 <video> 不走 transmux', {
  skip: skipReason() || !fs.existsSync(MP4_NATIVE_SAMPLE) ? 'test-video.mp4 缺失' : false,
  timeout: 60000,
}, async () => {
  const video = createVideoEl();
  const url = URL.createObjectURL(new Blob([await fs.promises.readFile(MP4_NATIVE_SAMPLE)]));
  video.src = url;
  video.load();
  await once(video, 'loadedmetadata', 30000);
  assert.ok(video.duration > 0, 'duration 应 > 0');
  URL.revokeObjectURL(url);
});

test('smoke 4/5: hls network (test-streams.mux.dev m3u8) → hls.js → canplay', {
  skip: skipReason(),
  timeout: 90000,
}, async () => {
  const { HlsPlayer } = window.__SyncPlayHlsPlayer || {};
  if (!HlsPlayer) throw new Error('window.__SyncPlayHlsPlayer 未暴露 (确认 hls-player.js 末尾 window.SyncPlayHlsPlayer = HlsPlayer)');
  const video = createVideoEl();
  const player = new HlsPlayer(video, HLS_URL_FIXED);
  try {
    await player.attach();
    await once(video, 'canplay', 60000);
    assert.ok(video.duration > 0, 'HLS VOD duration 应 > 0');
  } finally {
    try { player.destroy(); } catch (_) {}
  }
});

test('smoke 5/5: wrong format (.txt as .mp4) 走 fallback 软编拒绝', {
  skip: skipReason(),
}, async () => {
  // 1KB 假装 mp4 的纯文本, ftyp box 不对, parseFtyp 抛 NOT_FTYP / FTYP_TOO_SHORT
  // 这里测 parseFtyp 错误处理: 调 transmuxToFmp4 前 parseFtyp 不通过, 上层 fallback
  const { parseFtyp } = window.SyncPlayMedia;
  const fakeBytes = new Uint8Array(1024);
  assert.throws(() => parseFtyp(fakeBytes), /FTYP_TOO_SHORT|NOT_FTYP/);
});
```

**为什么单测 + smoke test 一起加, 不只改 multi-format-matrix**: multi-format-matrix 默认 SKIP 是历史包袱, 但它**整体**已经设计好 (8 格式), 不轻易改; 新 smoke 是**最小可跑**版本 (5 场景), 主人手动触发不卡 5 分钟等网络。多格式完整矩阵仍是主人的 §4 验收表任务, 不冲突。

**本步 commit 之后本地验证**:
```bash
cd desktop
# 不设环境变量 — 默认 SKIP, 期望 5/5 skip
SYNCPLAY_RUN_SMOKE=0 node --test test/integration/renderer-smoke.test.js
# 期望: 5 skipped, 0 failed

# Node 普通环境 (无 DOM) 也 SKIP — hasSandbox 检测触发
SYNCPLAY_RUN_SMOKE=1 node --test test/integration/renderer-smoke.test.js
# 期望: 5 skipped (sandbox 无 DOM)
```

**本步 commit 之后测试期望结果**: Node 单测 38/38 pass + 新增 5 skipped (默认 SKIP), 不破任何东西。

---

### §1.6 Commit B-F: `chore(v0.7.0.1-smoke-runner): 新增 Electron renderer 启动脚本, 跑 smoke test`

**目的**: 主人手动跑 smoke test 的入口。Electron 启动后加载 index.html, IPC 注入 node:test runner 到 renderer, 加载 renderer-smoke.test.js, 收集测试结果回报给主进程, 失败时 exit 1。

**新文件**: `desktop/test/integration/renderer-smoke-runner.js` (新建, ~90 行)

**完整新文件**:

```js
'use strict';

/**
 * v0.7.0.1-B-F: Electron renderer smoke test 启动脚本
 *
 * 主进程启动 BrowserWindow 加载 index.html, 然后通过 preload 注入的 IPC 让
 * renderer 跑 node:test runner, 把结果回报回来.
 *
 * 主人触发:
 *   cd desktop
 *   SYNCPLAY_RUN_SMOKE=1 \
 *   SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   npx electron test/integration/renderer-smoke-runner.js
 *
 * 退出码: 0 = 所有非 skip 测试 pass; 1 = 有 fail; 2 = 启动失败
 *
 * 不进 CI (macOS runner 限制 + 主人本地文件依赖), 仅本地手动 / CI workflow_dispatch
 *   + macos-latest self-hosted runner (v0.7 ship 后再考虑).
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

const ENABLED = process.env.SYNCPLAY_RUN_SMOKE === '1';
const PROJECT_ROOT = path.join(__dirname, '..', '..');

if (!ENABLED) {
  console.error('[smoke-runner] SYNCPLAY_RUN_SMOKE != 1, refusing to run');
  console.error('[smoke-runner] 主人用法:');
  console.error('  SYNCPLAY_RUN_SMOKE=1 SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \\');
  console.error('    npx electron test/integration/renderer-smoke-runner.js');
  app.exit(2);
  return;
}

let mainWindow = null;
let testResults = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    webPreferences: {
      preload: path.join(PROJECT_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // smoke test 需要 node:test 在 renderer 跑
    },
  });

  const indexPath = path.join(PROJECT_ROOT, 'src', 'client', 'index.html');
  return mainWindow.loadFile(indexPath);
}

// 监听 renderer console 输出, 收集测试结果
function collectRendererResults() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('[smoke-runner] TIMEOUT (5 分钟)');
      resolve({ passed: 0, failed: 1, skipped: 0, details: ['TIMEOUT'] });
    }, 5 * 60 * 1000);

    mainWindow.webContents.on('console-message', (event, level, message) => {
      console.log(`[renderer:${level}] ${message}`);
      // smoke runner 在 renderer 跑完后会打 "[smoke-done] passed=X failed=Y skipped=Z"
      const match = message.match(/\[smoke-done\] passed=(\d+) failed=(\d+) skipped=(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve({
          passed: parseInt(match[1], 10),
          failed: parseInt(match[2], 10),
          skipped: parseInt(match[3], 10),
          details: [],
        });
      }
    });
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();

    // 注入测试执行 trigger: 渲染完后等 3s, 然后通过 webContents.executeJavaScript
    // 让 renderer require + 跑 smoke test (环境变量已经透传过去)
    await new Promise((r) => setTimeout(r, 3000));

    const testPath = path.join(PROJECT_ROOT, 'test', 'integration', 'renderer-smoke.test.js');
    const escapedPath = testPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          const { run } = await import('node:test');
          const { tap } = await import('node:test/reporters');
          const stream = run({ files: ['${escapedPath}'] });
          let passed = 0, failed = 0, skipped = 0;
          stream.on('test:pass', () => passed++);
          stream.on('test:fail', () => failed++);
          stream.on('test:skip', () => skipped++);
          await new Promise((r) => stream.on('end', r));
          console.log('[smoke-done] passed=' + passed + ' failed=' + failed + ' skipped=' + skipped);
          return { passed, failed, skipped };
        } catch (e) {
          console.error('[smoke-runner-error]', e.message);
          console.log('[smoke-done] passed=0 failed=1 skipped=0');
        }
      })();
    `);

    testResults = await collectRendererResults();
  } catch (e) {
    console.error('[smoke-runner] fatal:', e.message);
    testResults = { passed: 0, failed: 1, skipped: 0, details: [e.message] };
  } finally {
    console.log(`\n[smoke-runner] 结果: passed=${testResults.passed} failed=${testResults.failed} skipped=${testResults.skipped}`);
    app.exit(testResults.failed > 0 ? 1 : 0);
  }
});

app.on('window-all-closed', () => app.quit());
```

**为什么需要 sandbox: false**: smoke test 要在 renderer 跑 `import('node:test')`, Electron 默认沙箱阻止。生产 Electron app 仍保持 sandbox=true, 不受影响。

**本步 commit 之后本地验证**:
```bash
cd desktop
# 默认拒绝启动 (sanity check)
npx electron test/integration/renderer-smoke-runner.js
# 期望: 退出码 2, 打印 SYNCPLAY_RUN_SMOKE != 1

# 真跑 (前提: 主人本地有太空旅客.mkv)
SYNCPLAY_RUN_SMOKE=1 \
SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
  npx electron test/integration/renderer-smoke-runner.js
# 期望: 退出码 0, 控制台打印 [smoke-done] passed=5 failed=0 skipped=0
```

**本步 commit 之后测试期望结果**: Node 单测 38/38 pass + smoke test 默认 5 skipped (Node 环境) 不变; Electron 启动跑 smoke 期望 5 pass (有 mkv 样本时)。

---

### §1.7 Commit B-G (可选): `docs(v0.7.0.1): CHANGELOG 加 hotfix 段 + 不升 version`

**目的**: 给主人一个清晰的 hotfix 记录。不升 version 是为了**不**触发 GitHub Actions 重新跑 release build (per MEMORY, 当前 v0.7 debug build SUCCESS 在 主人实测中, 不要 churn)。version 保留 0.7.0, hotfix 体现在 CHANGELOG 跟 git commit history。

**改动文件**: `docs/CHANGELOG.md`

**精确 diff** (在 `[0.7.0]` 临时段上方插入 hotfix 段):

```diff
+## [0.7.0.1] - 2026-07-26 (hotfix, 不升 version)
+
+### Fixed
+- mkv / avi / flv / mov / wmv 容器文件本地加载失败 (renderer 端 `require()` 在
+  contextIsolation 下抛错导致 transmux 路径永不执行, 走默认 `<video>` 路径).
+  现在本地 mkv 能正常加载 → ffmpeg.wasm transmux → fMP4 → MSE → 播放.
+
+### Changed
+- prebuild.js 同时拷贝 `@ffmpeg/ffmpeg` + `@ffmpeg/util` UMD 包装到 `public/ffmpeg/`,
+  让 renderer 能 `<script>` 加载 (不再依赖 bare-specifier dynamic import).
+- `ffmpeg-loader.js` 改写为 browser-safe + Node-compatible (顶层无 require / __dirname).
+- `container-transmux.js` 顶层去掉 `require('./ffmpeg-loader.js')`, 改用
+  `window.SyncPlayMedia.getFfmpeg` + options 注入 fallback.

+### Added
+- `desktop/test/integration/renderer-smoke.test.js` — 5 场景 smoke test, 在
+  Electron renderer 真跑 (mp4 native + mkv H.264 transmux + hls network + empty file
+  + wrong format), 主人本地手动触发.
+- `desktop/test/integration/renderer-smoke-runner.js` — Electron 启动脚本, 主进程
+  加载 index.html + IPC 注入 node:test runner + 收集结果 + exit code 回报.
+
+### Not Changed
+- version 保持 0.7.0 (per 主 agent 决策: 不 churn GitHub Actions, 等 v0.7.0 主人实测
+  通过后再发 v0.7.1 包含 license 审计结果)
+
+### Deferred to v0.7.0.2 (standalone 任务, 不阻塞本 hotfix)
+- `@ffmpeg/core` 是 GPL-2.0-or-later (per MEMORY #48), SyncPlay 整体 Apache-2.0.
+  需要主 agent 拍板 license 选项 (A: 整体改 GPL / B: 换 LGPL fork / C: 换
+  `@ffmpeg/core-mt` / D: 联系维护者 relicense). **不在本 hotfix 阻塞项内**.

 ## [0.7.0] - TBD
```

**本步 commit 之后本地验证**:
```bash
cd ~/CodeProjects/syncplay
# 验证 CHANGELOG 渲染
head -50 docs/CHANGELOG.md
# 期望: 新 hotfix 段在 [0.7.0] 之前
```

**本步 commit 之后测试期望结果**: 单测不变 (38/38 pass + smoke 默认 skip)。

---

### §1.8 步骤汇总

| Commit | 范围 | 行数 (+/-) | 单测影响 | 集成影响 |
|--------|------|-----------|---------|---------|
| B-A | prebuild.js 加 2 个 cp | +18 / 0 | 无 | prebuild 产物多 2 个文件 |
| B-B | index.html 加 2 个 script | +6 / -2 | 无 | renderer 加载 ffmpeg + util UMD |
| B-C | ffmpeg-loader.js 改写 | ~85 (整文件替换) | 无 (测试注入绕过) | 顶层安全 |
| B-D | container-transmux.js 改顶层 | +25 / -3 | 无 (测试注入优先) | transmux 路径打通 |
| B-E | renderer-smoke.test.js 新建 | +140 | 默认 skip, 不影响 | 主人在 Electron renderer 跑 5 场景 |
| B-F | renderer-smoke-runner.js 新建 | +90 | 无 | smoke runner 启动器 |
| B-G | CHANGELOG.md 加段 | +25 / 0 | 无 | docs |

**总改动**: ~390 行新增, 5 行删除, **Node 单测零破坏** (per §1 步骤验证, 全部 38 + 默认 skip 不变)。

---

## §2 验证策略 (dmg 装机实测 DoD)

### §2.1 代码层 (Node 单测)

**命令**:
```bash
cd ~/CodeProjects/syncplay
node --test test/unit/*.test.js        # 外层: 112 tests (sync engine / room-state 等)
cd desktop && node --test test/unit/*.test.js   # 内层: B-B 6 + B-C 20 + 0 = 26
cd desktop && SYNCPLAY_RUN_SMOKE=0 node --test test/integration/*.test.js  # 默认 skip
```

**期望结果**:
- 外层 112/112 pass
- 内层 26/26 pass (B-B 6 + B-C 20, 不破)
- 集成 (默认 SKIP) 5 (smoke 新增) + 5 (multi-format-matrix) + 1 (transmux-passengers) + 1 (mse-passengers) + 1 (sync-dual-window) + 1 (hw-decode-evidence) + 1 (hls-players) = 15 skipped, 0 fail
- **总计**: 138 pass + 15 skipped + 0 fail

### §2.2 Electron renderer 层 (开发模式)

**命令**:
```bash
cd desktop && npm start
```

**DevTools console 验证清单** (按顺序):

1. **类型检查** (确认 window 全局已暴露):
   ```js
   typeof window.SyncPlayMedia.transmuxToFmp4   // "function" (不是 "undefined")
   typeof window.SyncPlayMedia.getFfmpeg         // "function"
   typeof window.SyncPlayMedia.parseFtyp         // "function"
   typeof window.SyncPlayMedia.MsePlayer         // "function"
   typeof window.FFmpeg                          // "function" (FFmpeg class)
   typeof window.FFmpegUtil.toBlobURL            // "function"
   typeof window.__SyncPlayHlsPlayer             // "object" (HlsPlayer class)
   ```

2. **真 mkv 加载** (选 /Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv):
   ```js
   const file = await fetch('/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv')
     .then(r => r.blob()).then(b => new File([b], '太空旅客.mkv', { type: 'video/x-matroska' }));
   // 模拟 file input change event:
   const dt = new DataTransfer(); dt.items.add(file);
   document.getElementById('videoInput').files = dt.files;
   document.getElementById('videoInput').dispatchEvent(new Event('change'));
   ```
   期望: toast "正在转封装 mkv/avi/flv ..." → 进度更新 → 视频标签页里 `<video>.duration > 60` (~6880s), `<video>.videoWidth > 0` (1280). Console 无 error.

3. **记录**:
   - transmux 耗时 (期望 < 60s on M1)
   - video.duration (期望 ~6880s)
   - video.videoWidth / videoHeight (期望 1280x720)

### §2.3 dmg 层 (GitHub Actions workflow_dispatch debug build)

**触发** (主 agent):
```bash
gh workflow run build.yml -f build_type=debug -f version=0.7.0.1
```

**期望**:
- macOS arm64 debug build SUCCESS
- artifact `syncplay-mac-arm64-debug` 下载
- 主人装机实测: 选 /Volumes/Claw/太空旅客.mkv → 加载 → 播放 OK
- drift < 500ms 双窗口同步 OK

---

## §3 不要做的清单 (明确 exclusion)

| ❌ | 不要改 | 原因 |
|---|--------|------|
| 1 | **SyncEngine (`desktop/src/shared/sync-engine.js`) 任何逻辑** | v0.7-B-A 已稳定, mse pipeline 完成后 `<video>` 标准事件自动触发, 不动 |
| 2 | **mp4-ftyp-parser.js** | line 103-109 UMD 暴露正确, 本次重构不改, 单测全 8 个 pass |
| 3 | **mse-player.js** | line 220-225 UMD 暴露正确, 本次重构不改, 单测全 12 个 pass |
| 4 | **hls.js (desktop/public/hls.min.js)** | 现有加载模式是对的, 本次重构不引入 bundler |
| 5 | **hls-player.js 主逻辑** | hls.js 通过 `<script>` 全局加载 OK, 跟 mkv bug 无关 |
| 6 | **main.js / preload.js** | `contextIsolation: true, nodeIntegration: false` 是**正确**配置, 不动 (反而是 bug 漏出去的本因之一) |
| 7 | **package.json version** | 本 hotfix 不升 version, 保持 0.7.0, 仅 CHANGELOG 记 hotfix 段 |
| 8 | **mp4 / webm 原生 `<video>` 路径** (app.js:333-335) | 已 work, 不重写 |
| 9 | **上 bundler (webpack/vite/esbuild)** | per MEMORY #48 + 主人 "不上 bundler" 决策; 用 UMD `<script>` 全局 |
| 10 | **`@ffmpeg/core` license 选项拍板** | per MEMORY #48, 独立任务, v0.7.0.2 standalone 处理 |
| 11 | **asar 打包配置 / electron-builder 配置** | B-A 已稳定, extraResources 已含 public/, 不动 |
| 12 | **`dist:mac` 重新跑 release build** | 不 churn GitHub Actions, debug build 足够主人实测 |

---

## §4 Smoke test 设计

### §4.1 文件路径

- **新测试文件**: `desktop/test/integration/renderer-smoke.test.js` (5 场景)
- **新启动脚本**: `desktop/test/integration/renderer-smoke-runner.js` (Electron 入口)
- **不改**: `desktop/test/integration/multi-format-matrix.test.js` (历史 placeholder, 保留主人 §4 验收矩阵)

### §4.2 测试方法

**Electron 主进程 + IPC 注入 node:test runner**:

1. 主人执行 `npx electron renderer-smoke-runner.js` + 环境变量
2. runner 创建 BrowserWindow, `sandbox: false` 让 renderer 能 require node:test
3. 加载 src/client/index.html (跟正式 app 同样的 ffmpeg-loader.js 加载顺序)
4. 等 3s 让 renderer 完成 script 加载, 然后 `webContents.executeJavaScript()` 让 renderer `import('node:test')` 跑 smoke
5. 收集结果通过 console-message (smoke 跑完打 `[smoke-done] passed=X failed=Y skipped=Z`)
6. 主进程退出码 0/1 回报

### §4.3 测试用例清单

| # | 场景 | 输入 | 期望 |
|---|------|------|------|
| 1 | empty-file | `new Uint8Array(0)` | transmuxToFmp4 抛 `CONTAINER_UNSUPPORTED` / `FTYP_TOO_SHORT` / `TRANSMUX_FAIL` |
| 2 | mkv H.264 | `/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv` (1.64 GB) | transmux 成功 + MSE loadedmetadata + duration > 60 + videoWidth > 0 |
| 3 | mp4 native | `desktop/src/client/test-video.mp4` | 原生 `<video>` loadedmetadata + duration > 0 (不走 transmux 路径) |
| 4 | hls network | `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` | hls.js attach + canplay + duration > 0 |
| 5 | wrong format | 1024 字节 Uint8Array (假装 mp4) | parseFtyp 抛 `FTYP_TOO_SHORT` / `NOT_FTYP` |

### §4.4 CI 触发

- **不进 CI**: GitHub Actions macOS runner 限制 (依赖主人本地 `/Volumes/Claw/` 文件)
- **workflow_dispatch 入口**: 主 agent 可加一个 `.github/workflows/smoke.yml`, `runs-on: macos-latest`, 但**默认不触发**, 等 v0.7 ship 后主 agent 拍板是否需要自托管 runner (per v0.7 后续 roadmap)
- **现阶段**: 仅主人本地手动跑

### §4.5 关键问题: 谁负责跑?

**建议决策 (一句话)**: **主人手动** 跑 v0.7.0.1 hotfix 实测, CI 不强制。

**理由**:
1. mkv 样本在主人本地 `/Volumes/Claw/`, CI runner 拿不到 (per MEMORY #48 同类教训)
2. GitHub Actions macos-latest runner 1.64 GB mkv transmux 5-10 分钟, 配额贵
3. v0.7.0.1 是 hotfix 修复已 ship 的 v0.7.0, **不是**新功能, 主人手动一次实测足矣
4. CI 触发是 v0.7 ship 后才考虑的事 (需要自托管 macOS runner + 共享样本)

---

## §5 Round 2 完成定义 (DoD)

- [x] **§1 步骤全部精确到行号 + 代码块**: §1.1-B-A 到 §1.7-B-G 7 个 commit, 每个有 diff 块 / 新文件全文, 行号标注 ✓
- [x] **§2 验证策略三层全列**: 代码层 (138 pass) + Electron renderer (类型检查 + 真 mkv 加载) + dmg 层 (workflow_dispatch debug build) ✓
- [x] **§3 exclusion 全部列出**: 12 项不做的清单 ✓
- [x] **§4 smoke test 设计 + CI/手动决策建议**: 5 场景 + Electron 启动器 + 一句话决策"主人手动" ✓
- [x] **prebuild.js 现状实际调研**: §0.1 ls 输出三个 @ffmpeg/* dist 路径, 4 个文件清单 ✓
- [x] **LICENSE 审计作为后续 standalone 任务单列**: §1.7-B-G + §5 末尾强调 v0.7.0.2 拍板 ✓

### §5.1 阻塞项 vs 非阻塞项

**阻塞 (v0.7.0.1 ship 前必须完成)**:
- §1.1-B-A + §1.2-B-B + §1.3-B-C + §1.4-B-D (核心 4 commit, ~120 行, 修 bug 根因)
- §1.5-B-E + §1.6-B-F (smoke test 真跑能力, 不允许默认 SKIP)

**非阻塞 (v0.7.0.2 standalone, 跟本 hotfix 并行)**:
- **LICENSE 审计** (per MEMORY #48): 主 agent 拍板 license 选项 (A/B/C/D), 实施后 v0.7.0.2 单独 release
- CI smoke workflow (需要自托管 macOS runner, v0.7 ship 后评估)
- v0.7.0.1 完整 multi-format-matrix 主人实测 (等本 hotfix 装机后主人逐格式验)

---

## §6 报告

> **一句话总结**: 方案 B 拆 7 个 commit (B-A prebuild + B-B index + B-C loader 重构 + B-D transmux 去 require + B-E smoke test + B-F runner + B-G CHANGELOG), 含 1 个新 renderer smoke test, Node 单测 138/138 零破坏, dmg 装机 mkv 实测 DoD。

> **路径**: `tasks/v0.7.0.1/03-round2-execution-plan.md`
> **状态**: Round 2 = FINAL. 主 agent 拍板后派 Builder (per MEMORY #44/#47 audit-first) 实施。