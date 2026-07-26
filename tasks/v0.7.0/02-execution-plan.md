# v0.7 阶段 A 双轮 2 最终执行方案

> **任务**: v0.7 多视频格式支持 + 播放硬件解码 (路线 B.1)
> **方案状态**: ✅ 最终执行方案 — 双轮 1 讨论稿升级版, 5 个 trade-off 已拍板, 6 个子任务已写死细节
> **日期**: 2026-07-25
> **拍板会议**: 主 agent 默认接受 Claude Round 1 全部建议 (2026-07-25 18:48)
> **路径**: Electron 38 + hls.js + ffmpeg.wasm → fMP4 → MSE → 现有 `<video>`

---

## 0. 已拍板的 5 个 trade-off

| # | 决定 | 落地方式 (一句话) |
|---|------|------------------|
| 1 | copy 失败后自动 H.264/AAC 软编 fallback | 默认开启: 子任务 2 `container-transmux.js` 内置 tryCopy → catch → softEncode 重试一次, 不暴露 opt-in 开关 |
| 2 | 大文件限制 + 分段 transmux 延后 v0.7.x | MVP 输入限制 2 GB (主人太空旅客.mkv 1.64 GB 在范围内), README "已知限制"段注明 v0.7 不支持分段输出 |
| 3 | PeerJS / hls.js / ffmpeg core 本地打包 | 子任务 1 加 `desktop/prebuild.js` copy 逻辑 + electron-builder `extraResources` (子任务 1 完成) |
| 4 | 硬解验收用"GPU 状态 + decoder 进程 + CPU 对照"证据链 | 三项并列 DoD (子任务 5 实测): `chrome://gpu` 输出 + Mac `VTDecoderXPCService` 进程 CPU + 主进程 CPU < 20% |
| 5 | 测试样本 = 主人提供的太空旅客.mkv | 子任务 5 集成 + 同步回归都跑这个 1.64 GB mkv, metadata 实地采集 (见下) |

**主人测试样本 ffprobe 实地 metadata** (2026-07-25 18:48):

```
路径:    /Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv
大小:    1.64 GB
容器:    Matroska (libebml v1.3.4 + libmatroska v1.4.5)
视频:    idx=0, H.264 High@4.1 (avc1.640029), 1280x720, 24fps (24000/1001), 1.53 GB bitstream, 167,134 帧
音频:    idx=1, AAC LC 5.1 (mp4a.40.2), 48 kHz, 109 MB bitstream
时长:    6970.97s (~1h 56min)
字幕:    ffprobe 未识别到字幕流 (mkvmerge 9.4.2 制作时字幕可能放 attachments/外挂 srt/ass)
```

---

## 0.5 字幕策略 (Round 2 新增, 必须拍板)

**默认选 A**: MVP 字幕丢弃, 已知限制写 README

| 选项 | 评估 | 决定 |
|------|------|------|
| **A** | MVP 字幕丢弃, README 注明, v0.7.x 加外挂 srt/ass 加载 | ✅ **采纳** |
| B | ffmpeg.wasm 烧录外挂字幕 (慢, 软编耗时 × N 倍) | ❌ 不推荐 (跟 trade-off #1 软编 fallback 冲突) |
| C | 客户端 WebVTT 轨道 (复杂, MSE + WebVTT parser + 渲染, v0.7.x 再做) | ❌ 复杂度过高 |

**落地**:
- 子任务 2: `container-transmux.js` 探测时跳过 subtitle/data/attachment 流 (`-map 0:v:0 -map 0:a:0?`)
- 子任务 5: 实测太空旅客.mkv 字幕缺失, 在 `tasks/v0.7.0/03-test-E-sync-regression.md` 报告 "字幕未嵌入 (已知限制, v0.7.x 加外挂 srt/ass 加载)"
- 阶段 E: README "已知限制" 段写 "v0.7 不支持外挂字幕, v0.7.x 路线: 客户端 WebVTT 轨道"

---

## 1. 6 子任务最终 commit plan

### 依赖图

```
A (基础设施)
 ├── B (ffmpeg.wasm)
 │    └── C (MSE)
 ├── D (hls.js) — 可与 B 并行
 └── E (测试矩阵) — 在 C + D 完成后
      └── F (release + docs) — 在 E 完成后
```

并行规则: B 与 D 都改 `src/client/app.js` 的 `loadVideo()`, 子任务 4 commit 前先 rebase 到 B 之上 (避免冲突), 子任务 4 在 B commit 之后再开始实际编码。

### 子任务 1: 基础设施 (v0.7-B-A)

- **Commit message**:
  ```
  chore(v0.7-B-A): bump electron ^38 + media deps

  electron 33 → 38.8.6 拿 Chromium 140 增强 VideoToolbox 硬解
  hls.js ^1.6.16 + @ffmpeg/ffmpeg ^0.12.15 + @ffmpeg/util ^0.12.2 加入

  Electron 二进制 GitHub CDN 不可达, 需走 npmmirror 或手动下载 zip

  Lesson: AGENT_PRACTICES.md (Mac arm64 electron-builder 自动下载已 OK)
  ```
- **主要文件**:
  - `desktop/package.json` — electron ^38, hls.js, @ffmpeg/ffmpeg, @ffmpeg/util (✅ 子任务 1 阶段 A 已完成)
  - `desktop/package-lock.json` — 锁文件
  - `desktop/main.js` — `webPreferences` 加 `crossOriginIsolated` 验证 (SAB 探针, 见 §5)
  - `desktop/prebuild.js` — 已有 src/ copy, **追加** 媒体资产 copy (见 §6)
- **DoD**:
  - [ ] `npm test` 100% pass (112/112, 已在阶段 A 完成)
  - [ ] `npm start` dev 模式 5+ 秒无崩溃 (阶段 A 完成)
  - [ ] `npm run dist:mac` 出 SyncPlay-0.7.0-arm64.dmg (阶段 A 验证 SyncPlay-0.6.2-arm64.dmg 112MB)
  - [ ] SAB 探针输出打印 `crossOriginIsolated: true` + `SharedArrayBuffer: function`
  - [ ] `prebuild.js` 拷 `node_modules/hls.js/dist/hls.min.js` → `desktop/public/hls.min.js`
  - [ ] `prebuild.js` 拷 `@ffmpeg/core/dist/umd/ffmpeg-core.js` + `ffmpeg-core.wasm` → `desktop/public/ffmpeg/`
  - [ ] electron-builder 配置加 `extraResources: [{from: 'public', to: 'public'}]`
- **测试点**: 单元测试不变 (无新代码), 打包验证 (npm run dist:mac), SAB 探针 console 输出断言

### 子任务 2: ffmpeg.wasm (v0.7-B-B)

- **Commit message**:
  ```
  feat(v0.7-B-B): add ffmpeg.wasm container transmux

  解容器 mkv/avi/flv/wmv/mov → fMP4 (H.264/AAC) → 喂 MSE
  探测 → copy → 失败 → 软编 fallback (默认开启, trade-off #1)
  支持 AbortController 取消, deleteFile 内存清理
  字幕/附件流主动跳过 (-map 0:v:0 -map 0:a:0?)

  Lesson: AGENT_PRACTICES.md (大文件全量 buffer 风险, MVP 限 2GB)
  ```
- **主要文件**:
  - `desktop/src/shared/ffmpeg-loader.js` (新) — 单例 ffmpeg 实例, lazy load, load() 等待 ready
  - `desktop/src/shared/container-transmux.js` (新) — probe() / transmux(file|url) / 取消信号 / 错误分类
  - `desktop/src/shared/transmux-errors.js` (新) — 错误码 → 用户友好提示映射表
  - `desktop/test/unit/ffmpeg-loader.test.js` (新) — mock FFmpeg, 测命令选择 / 取消 / 清理
  - `desktop/test/unit/container-transmux.test.js` (新) — mock 探针, 测 copy 失败 → 软编 fallback 路径
- **DoD**:
  - [ ] `transmux(file)` 接受 File / Blob / URL, 走探测 → copy → 软编 三段
  - [ ] copy 失败时自动软编一次 (不暴露 opt-in, trade-off #1)
  - [ ] AbortController 取消时 `ffmpeg.terminate()` + `deleteFile` 清理
  - [ ] 错误码 6 类: CONTAINER_UNSUPPORTED / CODEC_UNSUPPORTED / MEMORY_QUOTA / NETWORK_FAIL / COPY_FAIL / SOFTENCODE_FAIL
  - [ ] 内存清理 `deleteFile('input.ext')` + `deleteFile('output.mp4')` 路径覆盖
  - [ ] 输入限制 2 GB (`file.size > 2 * 1024 ** 3` 时拒绝并提示)
- **测试点**:
  - 单元: 命令字符串断言 (`-c:v copy -c:a copy -movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1`)
  - 单元: copy 失败 → 软编 fallback 命令包含 `-c:v libx264 -preset ultrafast -crf 23`
  - 单元: AbortController.abort() 后 ffmpeg.terminate() 调用次数 = 1
  - 集成 (手工, 不进 CI): 太空旅客.mkv 1.64 GB transmux 耗时记录

### 子任务 3: MSE 集成 (v0.7-B-C)

- **Commit message**:
  ```
  feat(v0.7-B-C): integrate fMP4 MediaSource playback

  src/client/mse-player.js 封装 SourceBuffer 状态机
  队列 appendBuffer + updateend pump
  cleanup 顺序: abort/remove → endOfStream → video.src=''
  错误码 → 用户提示 (decode/network/quota)

  接管 app.js loadVideo() 的 mkv/avi/flv 容器路由
  ```
- **主要文件**:
  - `desktop/src/client/mse-player.js` (新) — 状态机: WAITING → READY → APPENDING → ENDED/ERROR
  - `desktop/src/client/app.js` (改) — `loadVideo()` 加 container 路由: `.mkv/.avi/.flv/.wmv/.mov` → transmux → msePlayer.attach()
  - `desktop/test/unit/mse-player.test.js` (新) — mock MediaSource, 测队列 / updateend / cleanup 顺序
- **DoD**:
  - [ ] MSE 状态机 5 态覆盖 (idle / opening / ready / appending / ended-error / destroyed)
  - [ ] `mimeCodec` 来自探测结果 (`video/mp4; codecs="avc1.640029,mp4a.40.2"`) 或默认 `video/mp4; codecs="avc1.640028,mp4a.40.2"`
  - [ ] `appendBuffer()` 队列 FIFO, `sourceBuffer.updating === false` 才 pump
  - [ ] cleanup 顺序: pause → remove(0, duration) → endOfStream('open' 时) → video.removeAttribute('src') → video.load() → URL.revokeObjectURL
  - [ ] 错误码 4 类映射: QuotaExceededError / InvalidStateError / decode error / network error
  - [ ] `loadedmetadata` 事件正常触发 (现有 app.js:268 监听不动)
- **测试点**:
  - 单元: mock MediaSource, 测 append 队列 updateend 驱动
  - 单元: cleanup 顺序断言 (sourceBuffer.remove → mediaSource.endOfStream → video.src = '')
  - 单元: abort() 后 destroying=true 阻止新 append
  - 集成 (手工): 太空旅客.mkv transmux 后 MSE 播放, currentTime / seek / pause 同步正常

### 子任务 4: hls.js 集成 (v0.7-B-D)

- **Commit message**:
  ```
  feat(v0.7-B-D): integrate hls.js HLS playback

  Safari 原生 HLS 优先 (canPlayType 检测)
  hls.js fallback (Hls.isSupported())
  fatal recovery: NETWORK_ERROR → startLoad 一次, MEDIA_ERROR → recoverMediaError 一次
  destroy 顺序: hls.destroy() → video.src=''

  接管 app.js loadVideo() 的 .m3u8 路由
  ```
- **主要文件**:
  - `desktop/src/client/hls-player.js` (新) — Safari 原生优先 + hls.js fallback + error recovery
  - `desktop/src/client/index.html` (改) — `<script src="./hls.min.js">` 改本地路径 (子任务 1 拷的)
  - `desktop/src/client/app.js` (改) — `loadVideo()` 加 `.m3u8` 路由
  - `desktop/test/unit/hls-player.test.js` (新) — mock Hls, 测 destroy / recovery / canPlayType 分支
- **DoD**:
  - [ ] `canPlayType('application/vnd.apple.mpegurl')` 或 `'application/x-mpegURL'` 非空时走原生
  - [ ] 否则 `Hls.isSupported()` true 时 `new Hls()` + `loadSource(src)`
  - [ ] ERROR 事件: 非 fatal 记录继续; fatal NETWORK_ERROR 一次 startLoad; fatal MEDIA_ERROR 一次 recoverMediaError
  - [ ] destroy: `hls.destroy()` → `video.removeAttribute('src')` → `video.load()`
  - [ ] URL 历史只在成功 metadata 后写入 (现有 video-history store 不动)
- **测试点**:
  - 单元: canPlayType mock 返回 '' 时走 hls.js 路径
  - 单元: Hls.Events.ERROR 触发 fatal NETWORK_ERROR 时 startLoad() 调用 1 次
  - 单元: destroy() 后 video.src 被清空
  - 集成 (手工): B 站直播源或 HLS test stream 播放 OK

### 子任务 5: 测试矩阵 (v0.7-B-E)

- **Commit message**:
  ```
  test(v0.7-B-E): verify 9-format playback + sync regression

  7 格式单元测试 + 集成测试 + 太空旅客.mkv 同步回归 + 硬解证据链
  Mac VTDecoderXPCService + chrome://gpu + CPU 三项并列 DoD
  报告: tasks/v0.7.0/03-test-E-sync-regression.md
  ```
- **主要文件**:
  - `desktop/test/unit/loadVideo-router.test.js` (新) — mock 各 player, 测扩展名 → 路由分发
  - `desktop/test/integration/7-format.test.js` (新) — 7 格式 fixture 加载测试
  - `tasks/v0.7.0/03-test-E-sync-regression.md` (新) — 实测报告 (主 agent 写, 子任务 5 输出素材)
  - `tasks/v0.7.0/03-test-E-hw-decode-evidence.md` (新) — 硬解证据链截图 + 文本记录
- **DoD**:
  - [ ] 9 格式全部加载 (mp4 h264/h265 + webm vp9/av1 + m3u8 + mkv h264/h265 + avi + flv)
  - [ ] 太空旅客.mkv 双窗口同步 OK (play/pause/seek/drift < 500ms)
  - [ ] Mac 硬解证据链 3 项齐全 (VTDecoderXPCService CPU + chrome://gpu + 主进程 CPU < 20%)
  - [ ] 子任务 2-4 单元测试 100% pass
  - [ ] 子任务 2-4 集成测试 100% pass (手测有 fixture)
- **测试点**: 见 §7 测试矩阵最终版

### 子任务 6: release 准备 (v0.7-B-F, 阶段 A 只做 debug build 触发)

- **Commit message**:
  ```
  chore(v0.7-B-F): bump 0.6.2 → 0.7.0 + debug build trigger

  desktop/package.json version: 0.6.2 → 0.7.0
  .github/workflows/build.yml workflow_dispatch 触发 Mac arm64 debug
  不出 release tag (阶段 A 边界), 主人 debug 验收后才出 release

  文档更新 (阶段 E):
  - README: 支持矩阵 + 已知限制
  - STATUS: 一句话状态
  - ROADMAP: v0.7 段标注完成
  - CHANGELOG: v0.7.0 段
  - MEETINGS: #015 会议纪要
  ```
- **主要文件**:
  - `desktop/package.json` — version: 0.6.2 → 0.7.0
  - `.github/workflows/build.yml` — 加 workflow_dispatch 输入 (debug_only: bool)
  - **不** 改 `docs/STATUS.md` / `CHANGELOG.md` / `AGENT_PRACTICES.md` (阶段 E 才动)
- **DoD**:
  - [ ] GitHub Actions Mac arm64 debug build 跑通 (artifact 可下载)
  - [ ] 主人实测 debug .dmg 验收通过
  - [ ] 阶段 E 文档更新 4 文件齐 (阶段 A8 commit "plan(v0.7): ..." 不动 docs)
- **测试点**: workflow_dispatch 触发验证 (Mac runner 实际跑 build)

---

## 2. ffmpeg.wasm 最终 spec

### 2.1 单例加载 `ffmpeg-loader.js`

```js
// desktop/src/shared/ffmpeg-loader.js
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_BASE = './ffmpeg/'; // 子任务 1 拷到 desktop/public/ffmpeg/

let _instance = null;
let _loading = null;

export async function getFFmpeg() {
  if (_instance) return _instance;
  if (_loading) return _loading;

  const ffmpeg = new FFmpeg();
  const coreURL = await toBlobURL(`${CORE_BASE}ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`${CORE_BASE}ffmpeg-core.wasm`, 'application/wasm');

  _loading = ffmpeg.load({ coreURL, wasmURL }).then(() => {
    _instance = ffmpeg;
    _loading = null;
    return ffmpeg;
  });
  return _loading;
}

export function resetFFmpeg() {
  if (_instance) {
    try { _instance.terminate(); } catch {}
    _instance = null;
  }
  _loading = null;
}
```

### 2.2 ffprobe JSON 解析骨架 `container-transmux.js`

```js
// desktop/src/shared/container-transmux.js
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './ffmpeg-loader.js';

const MAX_INPUT_SIZE = 2 * 1024 ** 3; // 2 GB

export async function probe(input) {
  // 第一步: 写入文件 (用 .bin 扩展名, 探测纯 ffprobe)
  const ffmpeg = await getFFmpeg();
  const bytes = await fetchFile(input);
  const probeName = 'probe.bin';

  if (bytes.byteLength > MAX_INPUT_SIZE) {
    throw new TransmuxError('MEMORY_QUOTA',
      `文件 ${(bytes.byteLength / 1024 ** 3).toFixed(2)} GB 超过 2 GB 限制 (v0.7 已知限制, v0.7.x 加分段输出)`);
  }

  await ffmpeg.writeFile(probeName, new Uint8Array(bytes));

  // 第二步: ffprobe (在 @ffmpeg/core 0.12 中通过 ffmpeg -i hack 输出)
  // core 0.12 默认带 ffprobe 二进制 (multithread), 直接 exec
  let probeLog = '';
  ffmpeg.on('log', ({ message }) => { probeLog += message + '\n'; });
  await ffmpeg.exec(['-hide_banner', '-i', probeName]); // 故意不指定输出, ffmpeg 报错含 stream 信息
  ffmpeg.off('log', () => {});

  // 第三步: 解析 log 拿 codec 列表
  const streams = parseProbeLog(probeLog);
  await ffmpeg.deleteFile(probeName);

  return streams;
}

function parseProbeLog(log) {
  // 解析 ffmpeg "Stream #0:0" 行
  // 例: "Stream #0:0: Video: h264 (High), yuv420p(tv, bt709, progressive), 1280x720, 24 fps"
  const lines = log.split('\n');
  const streams = [];
  for (const line of lines) {
    const m = line.match(/Stream #\d+:\d+(\[\w+(\[\w+\])?\])?:\s*(Video|Audio|Subtitle|Data|Attachment):\s*(\S+)/);
    if (m) streams.push({ type: m[3], codec: m[4], raw: line });
  }
  return streams;
}
```

### 2.3 copy 命令 (首选, 无损转封装)

```js
const COPY_CMD = (input, output) => ([
  '-hide_banner', '-loglevel', 'warning',
  '-i', input,
  '-map', '0:v:0', '-map', '0:a:0?',  // 主视频 + 首个音频 (可选), 字幕/附件主动跳过
  '-c:v', 'copy', '-c:a', 'copy',
  '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
  '-f', 'mp4', output
]);
```

### 2.4 软编 fallback 命令

```js
const SOFTENCODE_CMD = (input, output) => ([
  '-hide_banner', '-loglevel', 'warning',
  '-i', input,
  '-map', '0:v:0', '-map', '0:a:0?',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high', '-level', '4.1',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
  '-f', 'mp4', output
]);
```

### 2.5 transmux 主体 + AbortController

```js
export async function transmux(input, { signal } = {}) {
  const ffmpeg = await getFFmpeg();
  const inName = 'input.bin';
  const outName = 'output.mp4';

  const bytes = await fetchFile(input);
  if (bytes.byteLength > MAX_INPUT_SIZE) {
    throw new TransmuxError('MEMORY_QUOTA',
      `文件过大, v0.7 限制 2 GB (v0.7.x 加分段输出)`);
  }

  await ffmpeg.writeFile(inName, new Uint8Array(bytes));

  // 进度回调 (UI 显示 "转换中, 请稍候...")
  let lastPct = 0;
  ffmpeg.on('progress', ({ progress }) => {
    const pct = Math.round(progress * 100);
    if (pct > lastPct) { lastPct = pct; signal?.onProgress?.(pct); }
  });

  // 取消信号
  const abortHandler = () => {
    ffmpeg.terminate();
  };
  signal?.addEventListener?.('abort', abortHandler);

  try {
    // 第一段: copy
    let ok = false;
    try {
      await ffmpeg.exec(COPY_CMD(inName, outName));
      const data = await ffmpeg.readFile(outName);
      if (data.byteLength > 0 && validateMp4(data)) ok = true;
    } catch (e) {
      console.warn('[transmux] copy failed, fallback to soft encode:', e.message);
    }

    // 第二段: 软编 fallback (trade-off #1 默认开启)
    if (!ok) {
      signal?.onProgress?.(0); lastPct = 0;
      await ffmpeg.exec(SOFTENCODE_CMD(inName, outName));
      const data = await ffmpeg.readFile(outName);
      if (data.byteLength === 0) {
        throw new TransmuxError('SOFTENCODE_FAIL', '软编输出为空');
      }
    }

    const output = await ffmpeg.readFile(outName);

    // 探测 codec 字符串给 MSE
    const mime = await probeMime(ffmpeg, outName);

    return { data: output, mimeCodec: mime };
  } finally {
    // 清理
    signal?.removeEventListener?.('abort', abortHandler);
    try { await ffmpeg.deleteFile(inName); } catch {}
    try { await ffmpeg.deleteFile(outName); } catch {}
  }
}

function validateMp4(bytes) {
  // 检查 ftyp box
  if (bytes.byteLength < 16) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const size = view.getUint32(0);
  return view.getUint32(4) === 0x66747970; // 'ftyp'
}
```

### 2.6 错误码 → 用户友好提示 `transmux-errors.js`

```js
export class TransmuxError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const ERROR_MAP = {
  CONTAINER_UNSUPPORTED: '容器格式不支持, 请尝试转换为 mp4 或 mkv 后重试',
  CODEC_UNSUPPORTED: '视频编码不支持 (v0.7 支持 H.264/H.265/VP9/AV1), 请重新编码',
  MEMORY_QUOTA: '文件过大 (v0.7 限制 2 GB), v0.7.x 将支持更大文件',
  NETWORK_FAIL: '下载失败, 请检查 URL 或网络',
  COPY_FAIL: '转封装失败, 已尝试软编, 但仍失败',
  SOFTENCODE_FAIL: '软编失败, 请尝试用 VLC 或 ffmpeg 本地转换'
};
```

---

## 3. MSE 最终 spec `mse-player.js`

### 3.1 状态机

```
WAITING (constructed)
  └─> OPENING (URL.createObjectURL + video.src = url + sourceopen wait)
        └─> READY (addSourceBuffer + mimeCodec validated)
              └─> APPENDING (appendBuffer queued, pump FIFO)
                    └─> ENDED (endOfStream called, all chunks appended)
                    └─> ERROR (decode error / quota / invalid state)
              └─> DESTROYED (cleanup invoked)
```

### 3.2 主体

```js
// desktop/src/client/mse-player.js
export class MsePlayer {
  constructor(videoEl) {
    this.video = videoEl;
    this.state = 'waiting';
    this.queue = [];
    this.waiters = [];
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.objectUrl = null;
  }

  async attach(data, mimeCodec) {
    const defaultCodec = 'video/mp4; codecs="avc1.640028,mp4a.40.2"';
    const mime = mimeCodec || defaultCodec;

    if (!MediaSource.isTypeSupported(mime)) {
      throw new Error(`MSE codec unsupported: ${mime}`);
    }

    this.mediaSource = new MediaSource();
    this.objectUrl = URL.createObjectURL(this.mediaSource);
    this.video.src = this.objectUrl;

    await new Promise((resolve, reject) => {
      const onOpen = () => { this.mediaSource.removeEventListener('sourceopen', onOpen); resolve(); };
      const onError = (e) => { this.mediaSource.removeEventListener('sourceopen', onOpen); reject(e); };
      this.mediaSource.addEventListener('sourceopen', onOpen);
      this.mediaSource.addEventListener('error', onError);
    });

    this.sourceBuffer = this.mediaSource.addSourceBuffer(mime);
    this.sourceBuffer.mode = 'segments';
    this.state = 'ready';

    // 监听错误
    this.sourceBuffer.addEventListener('error', (e) => {
      this._fail('decode', e);
    });
    this.sourceBuffer.addEventListener('abort', () => {
      this.state = 'destroyed';
    });

    // 喂入数据
    this._append(data);

    return new Promise((resolve, reject) => {
      this.sourceBuffer.addEventListener('updateend', () => {
        if (this.queue.length === 0 && !this.sourceBuffer.updating) {
          try {
            if (this.mediaSource.readyState === 'open') {
              this.mediaSource.endOfStream();
            }
            this.state = 'ended';
            resolve();
          } catch (e) {
            reject(e);
          }
        } else {
          this._pump();
        }
      }, { once: true });
    });
  }

  _append(bytes) {
    this.queue.push(bytes);
    this._pump();
  }

  _pump() {
    if (this.state === 'destroyed') return;
    if (this.sourceBuffer.updating) return;
    if (this.queue.length === 0) return;

    const chunk = this.queue.shift();
    try {
      this.sourceBuffer.appendBuffer(chunk);
    } catch (e) {
      this._fail(this._classifyError(e), e);
    }
  }

  _classifyError(e) {
    if (e.name === 'QuotaExceededError') return 'quota';
    if (e.name === 'InvalidStateError') return 'invalid_state';
    return 'decode';
  }

  _fail(code, e) {
    this.state = 'error';
    this.waiters.forEach(w => w.reject(new Error(`MSE ${code}: ${e.message}`)));
    this.waiters = [];
  }

  destroy() {
    this.state = 'destroyed';

    // 顺序: pause → remove → endOfStream → video.src=''
    try { this.video.pause(); } catch {}

    if (this.sourceBuffer && !this.sourceBuffer.updating) {
      try { this.sourceBuffer.remove(0, this.video.duration || Infinity); } catch {}
    }

    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try { this.mediaSource.endOfStream(); } catch {}
    }

    try {
      this.video.removeAttribute('src');
      this.video.load();
    } catch {}

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    this.sourceBuffer = null;
    this.mediaSource = null;
    this.queue = [];
  }
}
```

---

## 4. hls.js 最终 spec `hls-player.js`

```js
// desktop/src/client/hls-player.js
import Hls from 'hls.js';

let _activeHls = null;

export function loadHls(video, src) {
  // Safari 原生 HLS 优先
  const canNative = video.canPlayType('application/vnd.apple.mpegurl') !== ''
                 || video.canPlayType('application/x-mpegURL') !== '';

  if (canNative) {
    video.src = src;
    return { type: 'native' };
  }

  if (!Hls.isSupported()) {
    throw new Error('HLS not supported in this Chromium build');
  }

  // 清理旧实例
  if (_activeHls) { _activeHls.destroy(); _activeHls = null; }

  const hls = new Hls();
  _activeHls = hls;

  let recovered = { network: false, media: false };

  hls.on(Hls.Events.ERROR, (_, data) => {
    if (!data.fatal) {
      console.warn('[hls] non-fatal:', data.type, data.details);
      return;
    }

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !recovered.network) {
      recovered.network = true;
      console.warn('[hls] fatal network, retry startLoad');
      hls.startLoad();
      return;
    }

    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered.media) {
      recovered.media = true;
      console.warn('[hls] fatal media, retry recoverMediaError');
      hls.recoverMediaError();
      return;
    }

    // 重复失败 → 销毁
    console.error('[hls] unrecoverable:', data);
    hls.destroy();
    _activeHls = null;
    video.dispatchEvent(new Event('error'));
  });

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    // 不替换 loadedmetadata, 仅日志
    console.log('[hls] manifest parsed');
  });

  hls.attachMedia(video);
  hls.loadSource(src);

  return { type: 'hls.js', instance: hls };
}

export function destroyHls(video) {
  if (_activeHls) {
    _activeHls.destroy();
    _activeHls = null;
  }
  try {
    video.removeAttribute('src');
    video.load();
  } catch {}
}
```

---

## 5. Electron 38 + SAB 验证脚本

新建 `desktop/src/sab-probe.js`, 在 `main.js` 启动后通过 preload 注入到 renderer console:

```js
// desktop/src/sab-probe.js
// 在 renderer 启动时打印 SAB / COOP / COEP / WebCodecs 状态
(function() {
  const log = (msg) => console.log(`%c[syncplay-init] ${msg}`, 'color: #4a9eff; font-weight: bold');

  log(`crossOriginIsolated: ${self.crossOriginIsolated}`);
  log(`SharedArrayBuffer: ${typeof SharedArrayBuffer}`);
  log(`WebAssembly: ${typeof WebAssembly}`);
  log(`MediaSource: ${typeof MediaSource}`);
  log(`WebCodecs (VideoDecoder): ${typeof VideoDecoder}`);
  log(`Electron: ${window.navigator.userAgent.match(/Electron\/(\d+\.\d+\.\d+)/)?.[1] || 'unknown'}`);
  log(`Chrome: ${window.navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+)/)?.[1] || 'unknown'}`);

  // ffmpeg.wasm 阻塞检查
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    console.error('[syncplay-init] ❌ SAB unavailable — ffmpeg.wasm will FAIL. 检查 main.js COOP/COEP headers.');
  } else {
    console.log('[syncplay-init] ✅ SAB available — ffmpeg.wasm should work');
  }
})();
```

**`desktop/src/client/index.html` 引用**:

```html
<script src="./sab-probe.js"></script>
```

(放在 `app.js` 之前, 启动时打印)

**`desktop/main.js` 兜底** (如未自动设置 COOP/COEP):

```js
mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
  cb({
    responseHeaders: {
      ...details.responseHeaders,
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp']
    }
  });
});
```

(子任务 1 验证 Electron 38 默认行为后再决定是否需要此兜底)

---

## 6. 本地打包脚本 `desktop/prebuild.js`

扩展现有 prebuild, 加媒体资产 copy:

```js
// desktop/prebuild.js (扩展)
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(f => {
    const sp = path.join(src, f);
    const dp = path.join(dest, f);
    fs.statSync(sp).isDirectory() ? copyDir(sp, dp) : fs.copyFileSync(sp, dp);
  });
}

// 1. 拷 src/ → desktop/src/ (原有)
copyDir('../src', 'src');
console.log('src/ copied into desktop/');

// 2. 拷 hls.js → desktop/public/hls.min.js (新)
const hlsSrc = path.join('node_modules/hls.js/dist/hls.min.js');
const hlsDst = path.join('public/hls.min.js');
if (fs.existsSync(hlsSrc)) {
  fs.mkdirSync('public', { recursive: true });
  fs.copyFileSync(hlsSrc, hlsDst);
  console.log(`hls.min.js (${fs.statSync(hlsDst).size} bytes) copied`);
}

// 3. 拷 ffmpeg core → desktop/public/ffmpeg/ (新)
const ffmpegSrc = path.join('node_modules/@ffmpeg/core/dist/umd');
const ffmpegDst = path.join('public/ffmpeg');
if (fs.existsSync(ffmpegSrc)) {
  copyDir(ffmpegSrc, ffmpegDst);
  console.log(`ffmpeg core copied to ${ffmpegDst}`);
}
```

**`desktop/package.json` electron-builder 配置加**:

```json
"extraResources": [
  { "from": "public", "to": "public" }
]
```

**`desktop/src/client/index.html` 改本地路径**:

```html
<!-- 原来 (CDN): <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script> -->
<script src="./hls.min.js"></script>
```

---

## 7. 测试矩阵最终版

| # | 格式 | 测试文件 | 路径 | 硬解验证 | 状态 |
|---|------|---------|------|---------|------|
| 1 | mp4 H.264 | Big Buck Bunny 720p | 原生 `<video>` | Mac VideoToolbox | 子任务 5 |
| 2 | mp4 H.265 | 公网 HEVC 测试源 | 原生 `<video>` | VTDecoderXPCService | 子任务 5 |
| 3 | webm VP9 | Big Buck Bunny webm | 原生 `<video>` | 软/硬解 | 子任务 5 |
| 4 | webm AV1 | AV1 测试源 | 原生 `<video>` | AV1 硬解 | 子任务 5 |
| 5 | m3u8 HLS | B 站直播 / HLS test stream | hls.js → MSE | hls.js 内置硬解 | 子任务 4 |
| 6 | **mkv H.264** | **太空旅客.mkv 1.64 GB** | ffmpeg.wasm → fMP4 → MSE | VTDecoderXPCService | **子任务 2 + 5** |
| 7 | mkv H.265 | 公网 HEVC mkv | ffmpeg.wasm → fMP4 → MSE | VTDecoderXPCService | 子任务 5 |
| 8 | avi | 公网测试源 | ffmpeg.wasm → fMP4 → MSE | — | 子任务 2 + 5 |
| 9 | flv | 公网测试源 | ffmpeg.wasm → fMP4 → MSE | — | 子任务 2 + 5 |

**同步回归**: 双窗口 mp4 + 双窗口 mkv (太空旅客) 都跑通 play/pause/seek/drift < 500ms

**硬解证据链 (3 项并列, trade-off #4)**:
1. Mac Activity Monitor: `VTDecoderXPCService` 进程在播放期间 CPU > 0%
2. DevTools `chrome://gpu`: Video Acceleration Information 段有 "Hardware accelerated"
3. 主进程 + renderer 进程 CPU 都 < 20%

**单元测试覆盖** (子任务 5):
- `loadVideo-router.test.js` — 扩展名 → 路由分发 (mock 各 player)
- 7 格式 fixture 加载测试 (integration, 手测有 fixture)
- 同步层不变 (现有 sync-engine.test.js 112/112 通过)

---

## 8. 风险评估最终版

| # | 风险 | 等级 | 缓解 |
|---|------|------|------|
| 1 | COOP/COEP 失败 → SAB 不可用, ffmpeg.wasm 跑不了 | 🔴 高 | Electron 38 默认验证 + SAB 启动探针 (§5) + main.js 兜底 headers + 失败时回退到 file:// 协议 (无 SAB 也能跑, 但 mkv 失败) |
| 2 | ffmpeg 软编慢 (libx264 软编 1.64 GB mkv 可能 5-10 分钟) | 🔴 高 | 默认 copy, 软编时 UI 弹 "转换中, 请稍候..." + 进度回调 + AbortController 可取消 |
| 3 | 字幕策略 = MVP 丢弃 | 🟡 中 | README 注明已知限制, v0.7.x 路线 = 外挂 srt/ass 加载 (WebVTT 客户端轨道) |
| 4 | Electron 38 跟 electron-store ^8.2 / peer ^0.6.1 兼容性 | 🟡 中 | npm install 后 `npm ls` 看 warnings, 必要时升 electron-store ^10 / peer ^0.7 (阶段 A 已验证 112/112 + dev 启动 OK) |
| 5 | WebRTC sync 跟 MSE 路径兼容性 | 🟡 中 | 子任务 5 单元测试覆盖 `<video>` 事件 + currentTime (MSE 路径下 video.play/pause/seeked/currentTime 应跟原生一致) |
| 6 | 全量 ffmpeg 输出 buffer 大文件 OOM | 🟡 中 | 输入限制 2 GB (trade-off #2), 分段 transmux 延后 v0.7.x |
| 7 | 包体 +30MB | 🟢 低 | 一次性安装可接受, README 标注 (phase A 实测: 95 → 112 MB = +17 MB, 比预期小) |
| 8 | GPU 平台差异 (Intel Mac HEVC 软解) | 🟢 低 | 文档化 "默认启用, 能力相关, 软解可用", 不承诺所有机器硬解 |

---

## 9. DoD 最终清单

- [ ] `desktop/package.json` electron ^38 + hls.js ^1.6.16 + @ffmpeg/ffmpeg ^0.12.15 + @ffmpeg/util ^0.12.2
- [ ] `desktop/prebuild.js` 拷 hls.min.js + ffmpeg core → `desktop/public/`
- [ ] electron-builder `extraResources: [{from: 'public', to: 'public'}]`
- [ ] SAB 探针输出 `crossOriginIsolated: true` + `SharedArrayBuffer: function`
- [ ] `npm test` 100% pass (含子任务 2-4 新单元测试)
- [ ] 9 格式 (含 mkv h264/h265 + avi + flv + 太空旅客.mkv) 全部加载
- [ ] Mac 硬解证据链 3 项齐全 (VTDecoderXPCService + chrome://gpu + 主进程 CPU < 20%)
- [ ] 双窗口同步回归 OK (mp4 + mkv, drift < 500ms)
- [ ] GitHub Actions Mac arm64 debug build 跑通 (子任务 6 workflow_dispatch 触发)
- [ ] 主人实测 debug .dmg 验收通过
- [ ] 阶段 E 文档更新 4 文件齐: README + STATUS + ROADMAP + CHANGELOG + MEETINGS #015 (阶段 A 不改 docs, 阶段 E 才动)

---

## 10. 边界 (按 v4 runbook.md)

- ❌ **不**写代码 (此文件是规划, 不实施)
- ❌ **不**实施 / **不**改 src/ 代码
- ❌ **不**碰 docs/STATUS.md / CHANGELOG.md / AGENT_PRACTICES.md (阶段 E 才改)
- ❌ **不** git commit (阶段 A8 由主 agent 做)
- ✅ 路径: 覆盖 `~/CodeProjects/syncplay/tasks/v0.7.0/02-execution-plan.md` (双轮 1 升级为最终方案)

---

## 11. 下一步 (主 agent 接手)

1. **阶段 A7**: 主 agent 写 `MEETINGS.md #015` 记录双轮 2 拍板 + 本方案
2. **阶段 A8**: 主 agent commit `plan(v0.7): 阶段 A 双轮 2 最终执行方案落地` (本文件作为参考)
3. **阶段 B**: 主 agent 按 §1 派 6 个子任务给 Builder subagent, 每个子任务单独 commit + 单独测试报告
4. **阶段 E**: debug 验收通过后更新 docs/4 文件

---

**方案定稿**: 2026-07-25 18:48
**下一棒**: 主 agent (阶段 A7 / A8)
**预计耗时**: 阶段 B 实施 1-2 周 (6 子任务), 阶段 E docs 1-2 小时