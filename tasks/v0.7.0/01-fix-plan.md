# v0.7 阶段 A 计划 — 多视频格式支持 + 视频播放硬件解码

> **任务 ID**: v0.7-multi-format-hw-decode
> **目标版本**: v0.6.2 → v0.7
> **立项日期**: 2026-07-25
> **立项人**: 主人 (Bruce)
> **决策记录**: [MEETINGS.md #012](../../docs/MEETINGS.md) · [MEETINGS.md #013](../../docs/MEETINGS.md) (方案 B 拍板)
> **规划阶段**: 调研 + 出方案 + 主人拍方案 B + 阶段 B 任务书
> **状态**: 🚧 **方案 B 已锁定 (2026-07-25 18:21)，阶段 B 任务书见 [02-execution-plan.md](./02-execution-plan.md)**

---

## 1. 目标（主人原话）

> "0.7的候选主题全都取消。0.7的目标重新定为多视频格式支持。最好能支持视频播放硬件解码。"

**期望**：
- 朋友发来的 mp4 (H.264 / H.265) 能播
- B 站/YouTube 类片源 (AV1 / VP9 / H.265) 能硬解不爆 CPU
- 直播 m3u8 能播（hls.js 接管）
- 4K HEVC 视频 Mac M-series 上不卡（VideoToolbox 硬解）

---

## 2. 现状摸底

### 2.1 当前能播什么（Electron 33.4 / Chromium 130）

| 格式 | 支持 | 硬解 |
|------|------|------|
| mp4 H.264 (avc1) | ✅ | ✅ M-series VideoToolbox / Intel Quick Sync / AMD VCE |
| mp4 H.265/HEVC (hvc1) | ✅ | ✅ M-series VideoToolbox (8K/120fps) / Win DXVA / Linux VAAPI |
| webm VP8 | ✅ | 软解（codec 简单，无需硬解） |
| webm VP9 | ✅ | ✅ Intel / AMD / Apple 硬解 |
| webm AV1 | ✅ | ✅ M1+ / RTX 30+ / RX 6000+ 硬解 |
| m3u8 (HLS) | ❌ Chromium 不支持 | ⚠️ 必须挂 hls.js |
| mkv / avi / flv | ❌ Chromium 不支持容器 | ❌ 要支持必须 ffmpeg.wasm |
| data: / blob: / file:// | ✅ | — |

### 2.2 当前代码定位

- 视频加载入口: `src/client/app.js:597` `loadVideo(src, label)`
- HLS 检测已存在 (line 605-610):
  ```js
  const canHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''
              || video.canPlayType('application/x-mpegURL') !== '';
  ```
  ⚠️ 检测存在但**没接管**——只是 toast 报错。需要加 hls.js 实际接管 m3u8 播放。
- 错误处理: `video.error` 监听 (`app.js:659`), `describeVideoError()` (`app.js:87`) — 错误信息可以更友好
- 视频匹配: `src/shared/video-match.js` — URL + 文件名 + 时长三重，**与 v0.7 无关**保留
- Electron 版本: `desktop/package.json` `"electron": "^33.4.0"` — 主 agent 推荐升到 ^38.x 拿最新 Chromium 140+

### 2.3 硬件解码现状

Chromium 默认开硬件解码（macOS VideoToolbox / Windows DXVA / Linux VAAPI），**只要不写 `disable-gpu` 就行**。

验证方式：
- 主人在 Electron app 里按 Cmd+Opt+I (DevTools) → 输入 `chrome://gpu` → 看 "Video Acceleration Information" 段
- Mac M-series 跑 HEVC 视频 → Activity Monitor 看 `VTDecoderXPCService` 进程 CPU 占用
  - 硬解: VTDecoderXPCService CPU 升高，主进程 CPU < 20%
  - 软解: 主进程 CPU 飙高

---

## 3. 方案对比（trade-off）

### 方案 A：Electron 升级 + hls.js（主 agent 推荐 ⭐⭐⭐⭐⭐）

**核心思路**：靠 Chromium 原生支持 + hls.js 解决 90% 场景。

**改动**：
1. `desktop/package.json`: `"electron": "^33.4.0"` → `"electron": "^38.x"` (拿 Chromium 140+ 增强硬解)
2. `desktop/package.json`: 加 `"hls.js": "^1.5.x"` 依赖
3. `src/client/app.js:loadVideo()`:
   - 检测 `.m3u8` URL → `new Hls()` + `attachMedia(video)` + `loadSource(url)`
   - hls.js 事件 (`MANIFEST_PARSED` / `ERROR`) 处理 lifecycle + 清理
   - 切换视频时先 `hls.destroy()` 再 `loadVideo` 新 src
4. **不写 `disable-gpu`**,让 Chromium 自动用 VideoToolbox/DXVA/VAAPI
5. `describeVideoError()` 增强：识别不支持的 codec/容器 → 提示 "建议转 mp4 (H.264/H.265) / webm (VP9/AV1) / 或用 VLC 打开"
6. README + 视频选择对话框加支持格式 tooltip

**支持矩阵**：
- ✅ mp4 H.264 / H.265
- ✅ webm VP8 / VP9 / AV1
- ✅ m3u8 (HLS)
- ❌ mkv / avi / flv（提示用户用 VLC）

**优点**：
- 包体 +1MB（hls.js minified）
- 改动量小，~150 行代码，3-4 个文件
- Chromium 默认开硬解，主人零成本享受
- 风险低

**缺点**：
- mkv 用户要装 VLC

**预计耗时**：阶段 B 实施 2-3 小时（含 Electron 升级验证 + hls.js 集成 + 单元测试）

---

### 方案 B：方案 A + WebCodecs + ffmpeg.wasm（重量级，覆盖全 ⭐⭐⭐）

**核心思路**：方案 A 基础上加 ffmpeg.wasm 解容器。

**改动（方案 A + 以下）**：
7. 装 `@ffmpeg/ffmpeg` (~30MB wasm) + `@ffmpeg/util`
8. WebCodecs API (`VideoDecoder`) + 自定义渲染循环（不能用 `<video>` 元素，需要 `<canvas>`）
9. ffmpeg.wasm 解容器 → 拿 VideoFrame → WebCodecs VideoDecoder → 渲染
10. 同步层 (SyncEngine) 需要重写（不能靠 video element 的 currentTime）

**支持**：ffmpeg 支持的一切容器（mkv / avi / flv / wmv / ts / mp4 / ...）+ ffmpeg 支持的一切 codec

**优点**：覆盖 99% 视频

**缺点**：
- 包体 +30MB（80MB → 110MB）
- 架构重写，~800 行代码
- 调试地狱（容器解析+帧同步+渲染）
- 同步引擎要重新适配（不能用 HTMLMediaElement.currentTime）

**预计耗时**：阶段 B 实施 1-2 周（包含架构重写）

---

### 方案 C：仅文档化（保守 ⭐⭐）

**核心思路**：不改代码，只在 README + 错误提示中清楚说明当前支持什么 / 不支持什么。

**改动**：
1. README 加"支持的视频格式"段
2. `describeVideoError()` 增强（跟方案 A 第 5 条一样）
3. 视频选择对话框加"💡 支持格式" tooltip

**优点**：零风险，~50 行代码

**缺点**：**主人的"多视频格式"需求没有真正解决**——m3u8 仍然播不了（除非 Safari）

---

## 4. 推荐方案（按 #28 #29 #37）

**主 agent 强烈推荐方案 A**：
- 实用性 90% 覆盖
- 改动小、风险低、耗时少
- "硬件解码" 主人想要的，Chromium 默认就有，零代码成本
- mkv/avi/flv 留给 v0.7.x 阶段，主人用 VLC 兜底

---

## 5. 阶段 A 收尾产物（已完成）

- ✅ ROADMAP.md 顶部"当前迭代"段更新
- ✅ ROADMAP.md 新增 "🚧 v0.7" 段
- ✅ STATUS.md "一句话状态" + "代码与依赖状态" 段更新
- ✅ MEETINGS.md #012 立项决策纪要
- ✅ tasks/v0.7.0/01-fix-plan.md（本文件）
- ⏳ 等主人拍方案 A/B/C → 立 v0.7-B 任务书 → 派 Builder

---

## 6. 阶段 B 拆分预案（待方案拍板后细化）

### v0.7-A：基础设施（~2 小时）
- `desktop/package.json`: electron ^38 + hls.js ^1.5
- `npm install` 验证 + 测试启动
- 跑 `npm test` 验证现有测试不挂

### v0.7-B：hls.js 集成 + 错误 UX（~3 小时）
- `src/client/app.js:loadVideo()` 加 m3u8 检测 → hls.js 接管
- hls.js 生命周期（destroy / attachMedia / detachMedia）
- `describeVideoError()` 增强：识别 codec/容器不支持
- `src/client/index.html` 加 "💡 支持格式" tooltip

### v0.7-C：硬解验证（~1 小时）
- 主人手动跑：Mac Activity Monitor + DevTools chrome://gpu
- 验证 HEVC 视频走 VideoToolbox（VTDecoderXPCService CPU 升高，主进程 < 20%）
- 截图 + 写实测报告 `tasks/v0.7.0/03-hw-decode-test.md`

### v0.7-D：测试 + 验收（~2 小时）
- 单元测试：hls.js 检测 + 错误描述
- Playwright e2e：5 种格式都能加载（mp4 h264/h265 + webm vp9/av1 + m3u8）
- 主人手动双窗口实测 + 同步层验证

### v0.7-E：release + docs（~1 小时）
- GitHub Actions workflow 验证（已有 v0.6.2 模板）
- `npm run dist:mac` 出 macOS arm64 debug build
- 主人实测装上能播 5 种格式
- README + CHANGELOG + STATUS + ROADMAP 全部更新

---

## 7. DoD（v0.7 验收清单）

- [ ] `desktop/package.json` electron ^38.x + hls.js ^1.5.x
- [ ] `npm test` 100%+ pass
- [ ] m3u8 加载播放 OK（实测一个 B 站直播源或 HLS 测试流）
- [ ] mp4 H.265 加载 + Mac VideoToolbox 硬解 (VTDecoderXPCService 占 CPU)
- [ ] mp4 H.264 / webm VP9 / webm AV1 全部加载 OK
- [ ] 不支持格式 (mkv/avi/flv) 加载时给清晰提示
- [ ] GitHub Actions Mac arm64 debug build 跑过
- [ ] 主人手动装 debug build 实测 5 种格式都通
- [ ] README + STATUS + ROADMAP + CHANGELOG 全部更新

---

## 8. 风险评估

| 风险 | 等级 | 缓解 |
|------|------|------|
| Electron 33 → 38 升级破坏现有功能 | 🟡 中 | 升级前跑 `npm test` 全过；升级后先跑 dev 模式冒烟 |
| hls.js 跟 `<video>` 元素冲突 | 🟢 低 | hls.js 官方文档明确支持的 MSE 模式 |
| macOS 14+ / Win 11 HEVC 硬解差异 | 🟢 低 | 文档化平台支持矩阵；不可用时回退软解 |
| 主人 macOS 是 Intel（非 M-series） | 🟡 中 | Intel Mac HEVC 硬解依赖 Intel Gen10+ iGPU，老 i5/i7 可能软解 |

---

## 9. 文档结束 / 主人拍板 ✅

**主人决策 (2026-07-25 18:21)**: 方案 B
> "使用方案B实施"

**关键追问 (2026-07-25 18:19)**: "如果用VLC替代，还能在我们的播放器里同步进度吗？"
- 答案: **不能**。VLC 是独立 App, 跟 SyncPlay 无通信。
- 含义: 方案 A 的 "VLC 兜底" 等于 mkv/avi/flv 场景下 SyncPlay 同步功能失效 → 主人场景 (朋友间发视频) 不可接受
- 结论: 方案 A 之前的"覆盖 90% 推荐"描述不准确, 真实需求是"任何格式朋友都能同步看" = 方案 B

**阶段 B 任务书**: [tasks/v0.7.0/02-execution-plan.md](./02-execution-plan.md)
**会议纪要**: [MEETINGS.md #013](../../docs/MEETINGS.md) (方案 B 拍板)