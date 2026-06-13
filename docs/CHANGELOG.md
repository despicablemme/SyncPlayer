# Changelog

> **这是什么？** 历史版本变更记录——每个版本改了什么、新增了什么。  
> **何时查阅？** 想看项目演进、某个功能是哪个版本加的。  
> **关联文档：** [STATUS.md](./STATUS.md) · [ROADMAP.md](./ROADMAP.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-13

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
- ✅ **记录时机**：`videoloadedmetadata` 事件自动写入
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

## [未发布]

### 下一版本 v0.6.2 计划（2026-06-13）

**目标**：修 UI bug — 重入房间后底部状态栏与真实连接脱钩 (BUG-2026-06-13-001); 同时 v0.6.1 + v0.6.2 合并出 release asset (远端先 debug, 主人实测通过后再 release)

- [ ] **根因修复**：`src/shared/room-state.js:34` `TRANSITIONS.connecting` 加上 4 个 `in_room_*` 终态（跟 FR-3 哲学一致 — 视频与房间解耦）
- [ ] **次要清理**：`src/client/app.js:exitRoom()` 加 `myVideoInfo = null`
- [ ] **测试更新**：`test/unit/room-state.test.js` 1 个反向断言改正向
- [ ] **附加清理（可选）**：`peer.on('open')` 改走 `recomputeRoomState()` + `SyncEngine.unbindVideoEvents()` 防 listener 累积
- [ ] **远端 debug release**：GitHub Actions `workflow_dispatch` 跑 debug build (Mac arm64, 主人平台), **不**触发 release workflow
- [ ] **主人实测**：Mac arm64 debug build 装上跑, 验证重入房间后底部状态栏跟真实连接一致
- [ ] **release asset**：实测通过后, 跑 v0.6.1 + v0.6.2 合并 release (Mac .dmg + Windows .exe + Linux AppImage)

### 后续版本计划

- **v0.7.x**：TURN 凭据管理 UI + 跨网段 UX 优化
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
