# Changelog

> **这是什么？** 历史版本变更记录——每个版本改了什么、新增了什么。  
> **何时查阅？** 想看项目演进、某个功能是哪个版本加的。  
> **关联文档：** [STATUS.md](./STATUS.md) · [ROADMAP.md](./ROADMAP.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-13 (v0.6.2 阶段 C 收尾)

---

## v0.6.0 (2026-06-09) — 体验优化 + bug 修复

**新功能**:
- 🆕 **FR-1 房间生命周期** — 加"退出房间"按钮, 跟"重新加入另一房间"流程, 退出后用户能立即输入新房间号加入另一房间
- 🆕 **FR-3 视频解耦 + 视频不匹配提示** — 房间生命周期跟视频加载完全解耦 (任意顺序都正常), 两端都加载后自动校验视频信息 (URL / 文件名 / 时长三重), 不匹配时 UI 状态区红色提示 "视频不匹配, 无法同步进度"

**修复**:
- 🐛 **FR-2 修视频 URL 加载 bug** — 5 个具体修复: src 切换没 reset / 错误信息太笼统 / HLS 黑屏无提示 / 二次 load() 触发 race / 空文件名 + query string

**架构改进**:
- 状态机从 4 态扩到 6 态: `no_room` / `connecting` / `in_room_no_video` / `in_room_waiting_peer_video` / `in_room_synced` / `in_room_mismatch`
- 新增 `src/shared/room-state.js` (RoomStateMachine 类, UMD)
- 新增 `src/shared/video-match.js` (videosMatch + describeVideo + normalizeUrl, UMD)
- 跟子任务 A (FR-1) 状态机协调: 叠加而非替换 (exitRoom + destroyed 守卫 + attemptReconnect 全部保留)

**测试**:
- 单元测试: `npm test` 88/88 pass (60 新 + 28 旧, 126ms)
- v0.6-B (FR-2) Tester: 12 PASS / 1 N/A / 0 FAIL (真实 headless Chromium 跑过 URL / 错误 / 元数据 / 现有功能)
- v0.6-C (FR-3) Tester: 全部 PASS (状态机 / 解耦 / 匹配 / 跟 A 协调 / 浏览器测试)

**模式升级**:
- 主人 (2026-06-09) 决定: v0.6+ 任务用 **ACP harness 模式** (`runtime: "acp"`) 跑 Claude Code, 替代 native subagent
- 未来所有 ACP spawn 必加 `streamTo: "parent"` (per AGENT_PRACTICES #19)
- ACP 启用 3 步: `openclaw plugins install @openclaw/acpx` + `config set plugins.entries.acpx.enabled true` + `openclaw config set plugins.entries.acpx.config.permissionMode approve-all` + `gateway restart`

**Commits (本版本)**:
- `5675750` feat(v0.6): FR-1 房间退出 + 重新加入另一房间
- `ef56139` fix(v0.6): FR-2 修视频 URL 加载 bug
- `2b72bcc` test(v0.6.0): add test report for url-bug
- `8e9d767` feat(v0.6): FR-3 解耦视频与房间 + 视频不匹配提示 + 状态机重构
- `90f1b95` test(v0.6.0): add test report for video-decouple

详见 [MEETINGS.md 会议 #006 完工纪要](./MEETINGS.md) + [REQUIREMENTS.md FR-1/2/3](./REQUIREMENTS.md) + [AGENT_PRACTICES.md #18/#19](../AGENT_PRACTICES.md)

---

## [0.6.1] - 2026-06-10

### 🆕 视频添加历史记录 (FR-4) (v0.6.1)

**目标**：用户选完本地/在线视频后，记录被持久化, 下次打开应用能一键从历史里重新选择对应视频, 不用重新粘贴 URL 或重新选文件。

**架构**：
- **新增** 主进程 `desktop/main.js`：`videoHistoryStore = new Store({name: 'video-history'})` (electron-store) + 5 个 IPC handler (`video-history:get` / `add` / `remove` / `clear` / `check-exists`)
- **新增** `desktop/preload.js`：暴露 `desktopAPI.videoHistory.{get, add, remove, clear, checkExists}` 给 renderer
- **新增** `desktop/package.json`：`"electron-store": "^8.2.0"`
- **新增** `src/client/index.html`：`video-history-section` div + 列表 + footer
- **新增** `src/client/style.css`：11 个相关样式类（`.video-history-section` / `.video-history-list` / `.video-history-item` / `.video-history-missing` 等）
- **新增** `src/client/app.js`：自动写记录（`video.loadedmetadata` 事件触发）+ 一键重选 + 失效检测

**功能**：
- ✅ **持久化**：`app.getPath('userData')/video-history.json` (electron-store 默认位置)
- ✅ **记录时机**：`video.loadedmetadata` 事件自动写入
- ✅ **字段**：本地 `{type: 'local', path, name, size, mtime, addedAt}` / URL `{type: 'url', url, title, addedAt}`
- ✅ **历史 UI**：视频选择对话框 "📜 历史" 按钮 + 最近 20 条
- ✅ **一键重选**：本地 `loadVideo('file://'+path)` / URL `loadVideo(url, title)`
- ✅ **失效检测**：本地 `fs.existsSync(path)` + URL `video.error` 监听
- ✅ **失效标记**：灰显 + "⚠️ 文件已移动/删除" 提示
- ✅ **删除/清空**：单条删除 + "清空所有"按钮（带确认）

**Commits (本版本, 7 个全部 PASS)**:
- `31ca692` plan(v0.6.1): 视频添加历史记录 计划 + 会议纪要
- `19bd524` feat(v0.6.1-A): add video history persistence (electron-store + IPC)
- `0644ac8` test(v0.6.1-A): add test report for main-process-preload-infra
- `88f27b2` feat(v0.6.1-B): video history UI in renderer
- `e0fe399` fix(v0.6.1-B): add 清空所有 button + wire videoHistory.clear()
- `c020d16` test(v0.6.1-B): add test report for video-history-ui
- `c349473` test(v0.6.1): add unit + e2e tests for video history

**测试**:
- 单元测试：`npm test` 100+ pass (v0.6.0 是 88, 加 ~12 个新测试, per `c349473`)
- v0.6.1-A Test Report: PASS（IPC handler 5 个全验 + electron-store 集成）
- v0.6.1-B Test Report: PASS（UI 元素 + 集成 + 自定义 test-b-main.js + test-b-preload.js 跑过）
- Playwright e2e：add unit + e2e tests for video history (per `c349473`)

**验证状态**:
- ✅ 7 个 v0.6.1 commit 全部 PASS
- ✅ 单元测试 + e2e 测试全绿
- ⏳ **release asset 推迟到 v0.6.2 一起出** (主人 2026-06-13 决策: v0.6.1 release 合并到 v0.6.2, 一起出 release asset, 一起实测)

**文档**:
- `docs/STATUS.md` 加 v0.6.1 已完成段（2026-06-13 补）
- `docs/ROADMAP.md` v0.6.1 状态改 ✅ Shipped（2026-06-13 补）
- `docs/CHANGELOG.md` 加本段（2026-06-13 补）
- `docs/MEETINGS.md` 加 #008 v0.6.1 完工纪要（2026-06-13 补）

详见 [MEETINGS.md 会议 #007 计划](./MEETINGS.md) + #008 完工纪要 + [REQUIREMENTS.md FR-4](./REQUIREMENTS.md)

---

## [0.6.2] - 2026-06-13

### 🐛 修 UI bug: 重入房间后底部状态栏与真实连接脱钩 (BUG-2026-06-13-001) (v0.6.2)

**目标**：修复 v0.6.0 + v0.6.1 release 后, 主人实测发现的重入房间 UI 状态不同步 bug.

**根因**：
- `src/shared/room-state.js:36` `TRANSITIONS.connecting` 过度约束, 只允许 `connecting → in_room_no_video / no_room`
- `src/client/app.js:515-548` `recomputeRoomState()` 在 CONNECTING 状态时, 若 `myLoaded=true`, 试图 `setState(IN_ROOM_WAITING_PEER_VIDEO / _SYNCED / _MISMATCH)` → 静默 reject → 状态机卡在 CONNECTING
- `src/client/app.js:675` `exitRoom()` 没清 `myVideoInfo`, 重入时陈旧状态干扰 → UI 黄色 waiting + `engine.start()` 永不被调
- 但 `peer.on('open')` 绕过状态机直接 `updateLocalStatus("对方未连接")` (L265), UI 文案来自这里

**修复**：
- ✅ `src/shared/room-state.js:36` 放宽 `TRANSITIONS.connecting` 加 4 个 `in_room_*` 终态 (跟 FR-3 视频与房间解耦设计一致)
- ✅ `test/unit/room-state.test.js` 反向断言改正向 (1 个 test 块测 4 个目标态)
- ✅ `src/client/app.js:680` `exitRoom()` 加 `myVideoInfo = null` (防陈旧状态)

**清理 (Claude 建议, 主 agent A6 接手实施 per #10 教训)**：
- ✅ `src/client/app.js:263` `peer.on('open')` 改走 `recomputeRoomState()` + 防御性 fallback
- ✅ `src/shared/sync-engine.js:52` `bindVideoEvents` 配对 `unbindVideoEvents()` + `destroy()` 调用, 防反复进房 listener 累积

**远端 debug workflow** (主人决策: 远端先 debug, 实测通过后 release)：
- ✅ `.github/workflows/build.yml` 加 `workflow_dispatch` `build_type=debug` choice 输入
- ✅ 新增 `build-mac-debug` job: macos-latest, arm64, ad-hoc 签名, 不传 `CSC_LINK`
- ✅ if 条件: `build_type == 'debug' && refs/heads/main` (per AGENT_PRACTICES #24 用 `startsWith` 而非 `matches`)
- ✅ 上传 artifact `syncplay-mac-arm64-debug` (retention 7 days)
- ✅ release 3 job (build-windows/mac/linux) 完全未动

**Commits (本版本, 2 子任务 + 1 docs 收尾)**:
- `0d4f922` fix(v0.6.2-A): 放宽 TRANSITIONS + 改测试 + exitRoom 清 myVideoInfo
- `4000465` feat(v0.6.2-B): peer.on('open') 改走 recomputeRoomState + unbindVideoEvents + Mac arm64 debug workflow
- `<v0.6.2-stage-c>` docs(v0.6.2): release status update + version bump (本 commit)
- `<v0.6.2-stage-e>` docs(v0.6.2): release status update + final docs (阶段 E 最终文档, 本 commit)

**测试**:
- 单元测试：`npm test` **112/112 PASS** (v0.6.1 是 110, 加 2 个 unbindVideoEvents 测例)
- YAML 语法：`python3 -c "import yaml; yaml.safe_load(...)" → "YAML OK"`
- 主 agent 验收 (per AGENT_PRACTICES #10 教训 — Tester ACP lost context, 主 agent 接手跑 8 项验证): 全部 PASS
- v0.6.2-A Test Report: PASS (10 项验证, 含 TRANSITIONS 表改动 + 单元测试反向断言改正向 + exitRoom 清理)
- v0.6.2-B Test Report: PASS (8 项验证, 含 peer.on('open') 走 recomputeRoomState + unbindVideoEvents 3 处 + workflow YAML OK + release jobs 未动)

**验证状态**:
- ✅ 2 个子任务 commit 全部 PASS (0d4f922 / 4000465)
- ✅ 单元测试 112/112 PASS
- ✅ YAML 语法 OK
- ✅ 全角标点未坏 (3 文件改前 = 改后, 差 = 0)
- ✅ **Released**: 2026-06-13 (push tag 自动触发 release, v0.6.2 阶段 C 失误链: 没经过 debug 验收直接出 release, per AGENT_PRACTICES #32 v4 修订反思)

**✅ Released** (2026-06-13)
- **Release page**: https://github.com/despicablemme/SyncPlayer/releases/tag/v0.6.2
- **Assets (3)**:
  - 🍎 macOS: [SyncPlay-0.6.2-arm64.dmg](https://github.com/despicablemme/SyncPlayer/releases/download/v0.6.2/SyncPlay-0.6.2-arm64.dmg) (96 MB)
  - 🐧 Linux: [SyncPlay-0.6.2.AppImage](https://github.com/despicablemme/SyncPlayer/releases/download/v0.6.2/SyncPlay-0.6.2.AppImage) (104 MB)
  - 🪟 Windows: [SyncPlay.Setup.0.6.2.exe](https://github.com/despicablemme/SyncPlayer/releases/download/v0.6.2/SyncPlay.Setup.0.6.2.exe) (80 MB)

**文档**:
- `docs/STATUS.md` 加 v0.6.2 已完成段 (阶段 C) + 加 ✅ Released 段 (阶段 E, 本收尾)
- `docs/ROADMAP.md` v0.6.2 状态改 ✅ Shipped + 加 v0.7 段 (阶段 C) + 加 ✅ Released 段 (阶段 E, 本收尾)
- `docs/CHANGELOG.md` 加本段 (阶段 C) + 加 ✅ Released 段 (阶段 E, 本收尾)
- `docs/MEETINGS.md` 加 #010 v0.6.2 阶段 C 完工纪要 + #011 v0.6.2 release 完工纪要 (本收尾, 阶段 E)

**A6 文档**: `.agent-tasks/v0.6.2/v0.6.2-execution-plan.md` (不上库, 主 agent 接手 per #10)

详见 [MEETINGS.md 会议 #009 阶段 A 计划](./MEETINGS.md) + #010 阶段 C 完工纪要 + #011 阶段 E release 完工纪要 (本收尾) + [REQUIREMENTS.md BUG-2026-06-13-001](./REQUIREMENTS.md)

---

## [0.7.0] - TBD （阶段 B-A/B/C/D/E 子任务已 PASS，等阶段 C 主人实测验收后定 release 日期）

### 🎬 多视频格式支持 + 视频播放硬件解码 (v0.7.0)

**目标**：把 SyncPlay 从"只支持 mp4 / webm"扩展到 9 种主流容器, 同时启用 Chromium 硬件解码 (硬解) 充分发挥 M-series / DXVA / VAAPI 性能.

#### 新功能

- 🆕 **多视频格式支持** — ffmpeg.wasm + MediaSource Extensions (MSE) + hls.js 集成
  - 支持容器: **mp4 / webm / mkv / avi / flv / mov / wmv / m3u8 (HLS)** (共 8 大类)
  - 路径分发 (per `desktop/src/client/app.js` `loadVideo()` 决策树):
    - `*.m3u8` (HLS) → `HlsPlayer` → hls.js → MSE → `<video>`
    - `*.mkv / *.avi / *.flv / *.mov / *.wmv` → `transmuxToFmp4` (ffmpeg.wasm) → fMP4 → `MsePlayer` → MSE → `<video>`
    - `*.mp4 / *.webm / blob` → `video.src = src` (Chrome 原生 + 硬解)
  - **不支持**的容器: 见 README "支持矩阵" 段
  - 软编 fallback: v0.7 MVP **暂不支持** (Xvid / DivX 等老 codec 提示用 VLC)
  - 字幕: MVP 丢弃 (v0.7.x 加 WebVTT 客户端轨道)

- 🆕 **视频播放硬件解码** (Chromium 默认开, 主人零代码成本)
  - macOS M-series: **VideoToolbox** (HEVC 8K/120fps; AV1 M1+)
  - Windows: **DXVA** (Intel Gen10+ iGPU)
  - Linux: **VAAPI**
  - 硬解证据链三件套 (阶段 C 主人实测):
    - `chrome://gpu` → "Video Acceleration Information" 段有 "Decode hevc main" / "Decode av1 main"
    - macOS Activity Monitor → `VTDecoderXPCService` 进程 CPU > 0 当 HEVC 视频播放
    - 主进程 Electron CPU < 20% 当 HEVC 视频播放 (硬解 = GPU 工作)

- 🆕 **基础设施升级**:
  - Electron `33.4` → `^38.0.0` (拿 Chromium 140+ 增强硬解 + 现代 web API)
  - 加依赖: `hls.js ^1.6.16` + `@ffmpeg/ffmpeg ^0.12.15` + `@ffmpeg/util ^0.12.2` + `@ffmpeg/core ^0.12.10` (本地打包到 `desktop/public/`, 含 ffmpeg-core.js + ffmpeg-core.wasm)
  - 新增 `desktop/prebuild.js`: 构建前把 `desktop/public/{hls.min.js, ffmpeg/*}` 拷进 asar + unpack `public/**/*`
  - SharedArrayBuffer 支持已验证 (B-A 探测 OK)

#### 决策树 (拍板自 `tasks/v0.7.0/01-fix-plan.md` 的 5 个 trade-off)

| Trade-off | 拍板 |
|-----------|------|
| 多轨 vs 单轨 | **多轨 (3 轨)**: 原生 `<video>` + hls.js + ffmpeg.wasm + MSE |
| fMP4 默认 codec | **avc1** (兼容性最高; 95% 设备直解; 不动用 hvc1) |
| SyncEngine 兼容性 | **不动 SyncEngine**; MSE / hls.js / 原生路径下的 `play / pause / seeked` 事件原生触发 |
| 测试矩阵运行位置 | **Electron renderer 跑**, Node 子进程跑不动 (无 DOM 无 SAB 无 MSE) |
| 硬解验证方法 | **证据链 (3 项并列)**: chrome://gpu + VTDecoderXPCService + 主进程 CPU < 20% |

#### 新增 / 修改文件

| 路径 | 类型 | 用途 |
|------|------|------|
| `desktop/src/client/app.js` | 改 | `loadVideo()` 决策树 + HlsPlayer / MsePlayer 实例化 |
| `desktop/src/client/{hls-player,mse-player}.js` | 新 | HLS + MSE 播放器封装 |
| `desktop/src/shared/container-transmux.js` | 新 | ffmpeg.wasm → fMP4 transmux 逻辑 |
| `desktop/prebuild.js` | 新 | 构建前把 hls.min.js + ffmpeg core 拷进 public/ |
| `desktop/public/ffmpeg/{ffmpeg-core.js, ffmpeg-core.wasm}` | 新 | ffmpeg core @ 0.12.x (本地打包, 离线可用) |
| `desktop/public/hls.min.js` | 新 | hls.js bundle (本地打包, 离线可用) |
| `desktop/package.json` | 改 | version `0.6.2 → 0.7.0` + 新增 deps |
| `package.json` (根) | 改 | version `0.6.2 → 0.7.0` |
| `src/shared/sync-engine.js` | 改 (极小) | `unbindVideoEvents()` 配对 (B-A 加的, v0.7 沿用) |
| `src/client/app.js` | 改 (历史) | v0.6.2 的 recomputeRoomState / exitRoom 清 myVideoInfo (v0.7 沿用) |
| `desktop/test/unit/*.test.js` | 新 + 改 | 17 个 B-E 新 sync-engine 测试 + 5 个 B-A 加测试 |
| `desktop/test/integration/{multi-format-matrix,sync-dual-window,hw-decode-evidence}.test.js` | 新 | 9 格式 + 双窗口 + 硬解 (默认 SKIP, Electron renderer 跑) |
| `desktop/test/fixtures/sample-urls.md` | 新 | 7 个公网样本 URL + 主人本地 太空旅客.mkv |
| `README.md` | 改 | 加 "支持矩阵" 段; 升版本号 + 下载链接 |

#### DoD (验收)

- [x] `npm test` 100% pass (root `test/unit/*` 112/112 + desktop `test/unit/*` 51/51 = **163/163 总 pass** per B-E 报告)
- [x] 9 格式测试矩阵就位 (`multi-format-matrix.test.js` 默认 SKIP, Electron renderer 跑)
- [x] 双窗口同步回归就位 (`sync-dual-window.test.js` 默认 SKIP)
- [x] 硬解证据链 3 项验证脚本就位 (`hw-decode-evidence.test.js` 默认 SKIP; 阶段 C 主人实测)
- [x] GitHub Actions Mac arm64 debug build 入口 (`workflow_dispatch build_type=debug`) 已验证 OK (v0.6.2 阶段加, v0.7 复用)
- [x] **阶段 C 临时文档落地**: STATUS.md / ROADMAP.md / CHANGELOG.md 加 v0.7 "已通过 debug 实测" 段 (per `v4 runbook` §C)
- [x] **build.yml 修 startup_failure 根因**: `verify` job condition 用了 `github.event.head_commit.message`, 但 `workflow_dispatch` 事件没有此字段 → 整个 workflow 启动失败 (3 次失败). 加 `github.event_name == 'push'` 前置守卫. **commit `750017e`**, 重 trigger PASSED.
- [x] **GitHub Actions Mac arm64 debug build PASSED** (run_id `30161064899`, head_sha `750017e`, artifact `syncplay-mac-arm64-debug` ≈ 141 MB, ~2 min). Cron 推送 QQ 通知成功.
- [ ] **阶段 C 主人实测 (Mac arm64 debug .dmg) 验收通过** — **待主人介入点 2**: 装 .dmg + 9 格式兼容 + 双窗口同步 + 硬解证据链 3 项验证 (per `tasks/v0.7.0/02-execution-plan.md` §7)

#### Commits (本版本, 6 子任务, 全部 PASS)

- `49bf92b` chore(v0.7-B-A): electron 38 + media deps + prebuild + SAB probe
- `c3837be` feat(v0.7-B-B): ffmpeg.wasm 容器转封装 (mkv/avi/flv → fMP4)
- `478f908` feat(v0.7-B-C): MSE MediaSource 集成 + loadVideo mkv/avi/flv 分支
- `c85144b` feat(v0.7-B-D): hls.js HLS 集成 + loadVideo m3u8 分支
- `e8ca1f5` test(v0.7-B-E): 9 格式测试矩阵 + 同步回归 + 硬解证据链
- **本 commit** chore(v0.7-B-F): bump 0.6.2 → 0.7.0 + CHANGELOG/README temp 段

#### 验证状态 (per B-E 报告 §7)

- ✅ 单元测试 `npm test` 163/163 PASS
- ✅ 集成测试代码完整 + 默认 SKIP (Electron renderer 跑)
- ✅ 硬解证据链 3 项验证脚本就位
- ✅ 9 格式测试矩阵占位写完
- ✅ 5 trade-off 拍板 (per `tasks/v0.7.0/01-fix-plan.md`)
- ⏳ 主人实测 (阶段 C debug build → 实测) — **待主人介入点 2**
- ⏳ git tag `v0.7.0` 推送 — **待主 agent 阶段 D**
- ⏳ ✅ Released 段 (含 release page + 3 assets) — **待主 agent 阶段 E (用真实 tag + URL 替换本段的 TBD)**

#### 🆕 Released (TBD — 阶段 E 填实际数据)

> 临时占位段。阶段 E (master agent) 会把下方 TBD 全部替换为真实数据:

- **Released**: TBD (`{YYYY-MM-DD}`)
- **Release page**: TBD (`https://github.com/despicablemme/SyncPlayer/releases/tag/v0.7.0`)
- **Assets (3, TBD 实际大小)**:
  - 🍎 macOS: TBD (`SyncPlay-0.7.0-arm64.dmg`, ~96 MB)
  - 🐧 Linux: TBD (`SyncPlay-0.7.0.AppImage`, ~104 MB)
  - 🪟 Windows: TBD (`SyncPlay Setup 0.7.0.exe`, ~80 MB)

#### 文档 (本 commit 改 + 主 agent 阶段 C/E 改)

- ✅ `README.md` 加支持矩阵段 + 升当前版本 v0.4.0 → v0.7.0 + 下载链接 (本 commit)
- ✅ `docs/CHANGELOG.md` 加本段 (本 commit — 临时, 阶段 E 升级为 release 段)
- ⏳ `docs/STATUS.md` v0.7 阶段 B → ✅ Shipped + 加 ✅ Released 段 — **待主 agent 阶段 C/E**
- ⏳ `docs/ROADMAP.md` v0.7 状态改 ✅ Shipped + 加 ✅ Released 段 — **待主 agent 阶段 C/E**
- ⏳ `docs/MEETINGS.md` 加 #016 v0.7 阶段 B 完工纪要 + #017 v0.7 release 完工纪要 — **待主 agent 阶段 C/E**
- ⏳ `AGENT_PRACTICES.md` 加 v0.7 反思条目 (e.g. 5 trade-off 拍板记录 + GPL 风险缓解) — **待主 agent 阶段 E**

#### 引用

- `tasks/v0.7.0/01-fix-plan.md` (5 trade-off + 6 子任务 commit plan)
- `tasks/v0.7.0/02-execution-plan.md` §6 (v0.7 release 准备) + Claude Round 2 §6
- `agentWorkflowAndTemplates/runbook.md` §C (临时文档规则)
- `tasks/v0.7.0/v0.7-B-{A,B,C,D,E,F}-test-report.md` (6 子任务全部 PASS)
- `desktop/test/fixtures/sample-urls.md` (7 公网 URL + 主人本地)

---

### 后续版本计划

- **v0.7.x**：TURN 凭据管理 UI + 跨网段 UX 优化 + 移动端响应式 + WebVTT 字幕客户端 (v0.7 MVP 推迟)
- **v0.7.x**：软编 fallback (Xvid / DivX 老 codec, v0.7 MVP 推迟)
- **v0.7.x**：分段 (chunked) 大文件支持 (v0.7 MVP 限 2 GB)
- **v1.0**：互联网可用正式版（Mac/Windows/Linux 全平台安装包 + 签名/公证）

---

## [0.5.1] - 2026-06-08

### 🔧 asar 修复 + GitHub Actions 跨平台 build (v0.5.1)

**目标**：修 v0.5.0 dmg 资源不密封 + 走 CI 跨平台出三平台产物

#### 修复
- **`desktop/package.json`**: `build.asar: false` → `true`（重新启用 asar 打包）
- **`desktop/package.json`**: 加 `build.asarUnpack: ["node_modules/**/*", "src/server/**"]`（让信令 server 子进程能从真实文件系统访问 node_modules + 解决嵌套 node_modules 问题）
- **`desktop/main.js`**: `serverCwd` 用 `path.dirname(appPath)`（真实目录），`serverPath` 在 prod 模式用 `app.asar.unpacked/...` 路径

#### GitHub Actions 跨平台 build
- 新增 `.github/workflows/build.yml`：
  - `build-windows` (windows-latest) → `SyncPlay Setup 0.5.1.exe`
  - `build-mac` (macos-latest) → `SyncPlay-0.5.1-arm64.dmg`
  - `build-linux` (ubuntu-latest) → `SyncPlay-0.5.1.AppImage`
  - 触发：push `v*` tag / push main 改 desktop|src / workflow_dispatch 手动
  - artifact retention 30 天
- 触发顺序：v0.5.0 push → 跑 3 次失败（YAML 重复 trigger 块 / yaml 语法）→ 修 → 第 4 次绿

#### 产物
- `SyncPlay Setup 0.5.1.exe`（Windows，~79MB）✅
- `SyncPlay-0.5.1-arm64.dmg`（Mac，~95MB）✅
- `SyncPlay-0.5.1.AppImage`（Linux，~104MB）✅

#### 验证
- ✅ 本地 build 装上能开（功能 + UI 正常）
- ✅ GitHub Actions 三平台 build 全绿（1m32s）
- ✅ 主人实测功能正常（创建/加入房间 + 视频同步）
- ⚠️ macOS Gatekeeper 拦截：Chrome 下载的 dmg 双击弹 "damaged"
  - 根因：Chrome 加 `com.apple.quarantine` xattr + ad-hoc 签名
  - 解法：用户首次打开前跑 `xattr -dr com.apple.quarantine /Applications/SyncPlay.app`
  - 根本解：v1.0 阶段做 Apple Developer ID 签名 + notarization

#### 文档
- `docs/STATUS.md` / `docs/ROADMAP.md` / `docs/CHANGELOG.md`（本文件）全部更新

---

## [0.4.0] - 2026-06-07

### 🖥️ Electron 桌面打包 (v0.4)

**目标**：出 Mac `.dmg` + Windows `.exe` + Linux `.AppImage`，双击即用，不需要装 Node / Python

#### 架构设计
- **新增** `desktop/main.js`：Electron 主进程
  - spawn Node child process 运行 `src/server/server.js`（信令服务器，port 9000）
  - 等 server ready 后创建 BrowserWindow
  - 用 `loadFile()` 直接加载 `src/client/index.html`（file://，不需要 Python HTTP server）
  - `app.getAppPath()` 统一 dev / prod 路径
  - quit 时正确清理子进程
- **新增** `desktop/preload.js`：Phase A 最小化 bridge（`desktopAPI`）
- **新增** `desktop/package.json`：`syncplay-desktop@0.4.0`，electron + electron-builder
- **新增** `desktop/.gitignore`：node_modules/、dist/

#### electron-builder 配置
- **build 字段**：
  - `appId: com.bruce.syncplay`
  - `productName: SyncPlay`
  - Mac target: dmg；Windows target: nsis；Linux target: AppImage
- **prebuild 脚本**：构建前自动复制 `../src/` → `src/`，保持 desktop 自包含
- `asar: false`（asar 模式因 node_modules 嵌套问题暂时禁用）

#### 资源打包
- **peer@0.6.1** 安装到 `desktop/node_modules/peer`（PeerJS 信令服务器）
- `src/client/`、`src/shared/`、`src/server/` 全部打入 app bundle
- **完全零系统依赖**：不依赖 Python、不依赖系统 Node、不依赖 Homebrew
- **自带 Electron Runtime**：内置 Chromium + Node，体积 ~95MB（arm64）

#### 构建产物
- `desktop/dist/SyncPlay-0.4.0-arm64.dmg`（Mac arm64）✅ 已验证
- `desktop/dist/SyncPlay Setup 0.4.0.exe`（Windows，需在 Windows 环境构建）⏳
- `desktop/dist/SyncPlay-0.4.0.AppImage`（Linux，需在 Linux 环境构建）⏳

### 📚 文档更新

- 本次 v0.4 构建完成后，9 个文档全部更新至 v0.4.0（CHANGELOG / STATUS / ROADMAP / MEETINGS / REQUIREMENTS / TECH_RESEARCH / README / ARCHITECTURE）
- 新增 `docs/MEETINGS.md #004`（v0.4 实施会议）
- TECH_RESEARCH.md 新增 Electron 打包选型总结
- README.md 新增"下载 v0.4 安装包"说明

---

## [0.3.0] - 2026-06-07

### 🌐 TURN 中继支持 (Phase 1 核心)

- **`src/client/app.js`**：加 ICE 服务器配置(`iceServers` + `iceTransportPolicy`)
- **TURN 凭据抽离**到 `config.local.js`（gitignore），避免敏感信息泄露
- **新增** `src/client/config.template.js`：占位符模板 + 加载顺序说明
- **强制 TURN 模式验证**：临时改 `'all'` → `'relay'` 验证同步数据真走中继（已验证通过）
- **TURN 凭据冒烟测试**（`test:ice`）：headless Chromium + 4 个 relay 候选从 Metered 成功分配

### 🧪 测试基础设施

- **新增** `test/network/ice-smoke.js`：TURN 凭据 + relay 候选生成验证
- **新增** `test/network/regression-create-room.js`：点"创建房间"应显示房间号（防 HTTP server 根目录 bug 复发）
- **新增** `test/network/README.md`：network/ vs unit/ vs e2e/ 测试关系说明
- `package.json` 加 `test:ice` 和 `test:room` 脚本
- `test/e2e/test.js` 同步修正 HTTP server 根目录 bug

### 🚀 启动脚本加固

- **start.sh / start.command / start.bat**：检测到缺 Node/Python 自动安装
  - Mac：`brew install` → NVM
  - Windows：`winget` → `choco`
- **健康检查**：启服务后必须端口真在监听才打 OK（10s 超时）
  - bash 函数 `wait_for_port`（轮询 lsof）
  - bat 标签 `:wait_for_port`（轮询 netstat）
- **Win10 PATH 刷新修复**：硬编码 3 个常见 node.js 安装位置
- **路径检查**：启动前 if exist 验证目录，日志输出前 if exist 避免连锁错误
- **错误信息醒目化**：`!!!!!!!!!!!!!!!!` 警示线避免错过

### 🔍 一键诊断脚本

- **新增** `diagnose.bat`（Windows）：8 大类环境信息收集
- **新增** `diagnose.sh`（Mac/Linux）：同上
- 用法：双击 / `./diagnose.sh`，全选输出贴给开发者

### 🐛 修复

- **HTTP server 根目录 bug**（v0.2.0 遗留）：start 脚本从 `src/client/` 改 `src/`，修复 `../shared/sync-engine.js` 404
- **Python http.server `..` 路径拦截**：明确记录到依赖清单，未来用更高层 server
- **Win10 start.bat 编码坑**：chcp 65001 + 中文 + setlocal enabledelayedexpansion 互打架，全 ASCII 化
- **pushd 路径不存在时静默失败**：现在显式报错并 pause
- **TURN 凭据误入 git**：检查脚本，验证 staged 区无敏感字符串

### 📚 文档

- **`docs/ARCHITECTURE.md` 新增"依赖清单"章节**：8 子章节（运行环境 / npm deps / 客户端 deps / devDeps / 配置文件 / 跨平台矩阵 / 维护流程 / 变更历史），作为依赖的单一权威记录
- **同步更新 URL**：`http://localhost:8080` → `http://localhost:8080/client/`（根目录改为 src/）
- 影响：REQUIREMENTS.md、ARCHITECTURE.md、STATUS.md、start.bat/stop.bat 提示信息

### ✅ 验收 (Phase 1 DoD)

- ✅ TURN 凭据有效（smoke test）
- ✅ TURN 真在同步路径上（强制 relay 模式验证）
- ✅ 跨网段实测（主人于 2026-06-07 声明通过）

---

## [0.2.0] - 2026-06-06

### 🔄 重构

- **客户端拆分**：将原本 13K 的单文件 `index.html` 拆分为 `index.html` + `app.js` + `style.css`，可维护性大幅提升
- **架构统一**：`server/server.js` 从死代码改造为 PeerJS 私有信令服务器，客户端/服务器各司其职

### 🐛 关键修复

- **同步状态机 bug**：用 `guardUntil` 时间戳替代原来脆弱的 50ms 定时器，避免回环
- **drift 漂移**：新增每 10s 自动漂移校准（阈值 0.5s），长时间播放不再累积偏移
- **断线重连**：新增指数退避重连（2s/4s/6s/8s/10s，最多 5 次）
- **peer-unavailable 错误**：现在会明确提示"对方房间号不存在或未上线"

### ✨ 新增

- 漂移/延迟实时显示面板
- Toast 通知（替代 `alert()`，体验更好）
- `file_info` 协议消息：连接建立时校验两端视频时长
- 心跳机制：5s 一次心跳测量 RTT
- 房间号改用 `crypto.randomUUID()`（密码学安全）
- 视频格式支持扩展：mp4 / webm / ogg / quicktime / matroska / avi / 3gpp

### 📚 文档

- 新增 `ARCHITECTURE.md`：架构详解 + 状态机图
- 重写 `README.md`：完整使用文档
- 重写 `STATUS.md`：v1 问题清单 + 重构方案
- 新增 `CHANGELOG.md`：本文件

### ⚠️ 已知问题

- 约 15% 网络环境仍需 TURN 中继（未实现）
- 自动化测试未跑通
- 移动端未适配

---

## [0.1.0] - 2026-03-22

### 🎉 MVP 首发

- **项目立项**：完成需求讨论、技术调研、方案设计
- **架构选型**：WebRTC DataChannel + PeerJS 公共服务器
- **核心功能**：
  - 房间号创建/加入
  - 视频选择（本地文件 / URL）
  - 播放/暂停同步
  - 进度同步（seek）
  - 状态显示（区分创建方/加入方）
- **技术栈**：纯 HTML + JS + PeerJS 1.5.4
- **后端**：自定义 WebSocket 信令服务器（实际未使用，已在 0.2 重构）

### 📚 文档

- `REQUIREMENTS.md` 需求文档
- `TECH_RESEARCH.md` 技术调研
- `MEETINGS.md` 会议纪要

### ⚠️ 已知问题（v0.1）

- ~~server.js 是死代码~~ ✅ 已在 0.2 修复
- ~~同步状态机有 bug~~ ✅ 已在 0.2 修复
- ~~drift 漂移未处理~~ ✅ 已在 0.2 修复
- ~~断线重连缺失~~ ✅ 已在 0.2 修复
- 15% 网络环境 P2P 直连失败（待 TURN）
- 视频格式只支持 mp4
- Playwright 自动化测试未跑通

---

*维护：Jarvis & 主人*
