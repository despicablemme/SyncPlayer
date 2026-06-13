# SyncPlay 当前状态

> **这是什么?** 项目的"进度快照"--当前版本、已完成、下一步。
> **何时查阅?** 每次回来接任务时**先看这个**。
> **关联文档:** [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md) · [README.md](./README.md)
> **最后更新：** 2026-06-13

---

## 🚦 一句话状态

**当前版本：v0.6.1 (Shipped 2026-06-10, docs 补齐 2026-06-13)** — 视频添加历史记录 (FR-4): electron-store 持久化 + 主进程 IPC 5 个 handler + 客户端 UI + 失效检测 + 单删/清空
**下一目标：v0.6.2** — 修 UI bug: 重入房间后底部状态栏与真实连接脱钩 (BUG-2026-06-13-001); v0.6.1 + v0.6.2 合并出 release asset (远端先 debug, 主人实测通过后再 release)
**最终目标：v1.0** — Mac/Windows/Linux 全平台安装包 + 公网可用

---

## 📍 快速导航

- 🎯 **目标与路线图** → [ROADMAP.md](./ROADMAP.md)
- 📜 **历史版本记录** → [CHANGELOG.md](./CHANGELOG.md)
- 📖 **需求文档** → [REQUIREMENTS.md](./REQUIREMENTS.md)
- 🏗️ **架构说明** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🔬 **技术调研** → [TECH_RESEARCH.md](./TECH_RESEARCH.md)
- 📝 **会议纪要** → [MEETINGS.md](./MEETINGS.md)
- 🗂 **文档索引** → [README.md](./README.md)

---

## ✅ v0.5 / v0.5.1 已完成（历史）（已发布，2026-06-08）

**Commit**：`e050b39`
**Tag**：`v0.5.1`（已推 GitHub）

### 关键工作
- `desktop/package.json`: `asar: false` → `true`（重新启用 asar 打包模式）
- `desktop/package.json`: 加 `asarUnpack: ["node_modules/**/*", "src/server/**"]`（让信令 server 子进程能从真实文件系统访问 node_modules）
- `desktop/main.js`: 调整 `serverCwd`（用真实目录 `path.dirname(appPath)`）+ `serverPath`（用 `app.asar.unpacked/...`）路径解析
- 走 GitHub Actions 跨平台 build：windows-latest / macos-latest / ubuntu-latest
- 三个产物：
  - `SyncPlay Setup 0.5.1.exe`（Windows，~79MB）
  - `SyncPlay-0.5.1-arm64.dmg`（Mac，~95MB）
  - `SyncPlay-0.5.1.AppImage`（Linux，~104MB）

### ⚠️ 已知问题（不阻塞发版）
- **macOS Gatekeeper 拦截**：从 GitHub 下载的 dmg 双击会弹 "damaged"（v0.5.0 就有）
  - **根因**：Chrome 浏览器下载时自动加了 `com.apple.quarantine` xattr + ad-hoc 签名 + Gatekeeper 严格模式
  - **临时解法**：`xattr -dr com.apple.quarantine /Applications/SyncPlay.app`
  - **根本解法**（v1.0+）：Apple Developer ID 签名 + notarization
- spctl `--assess` 评估会失败（`code has no resources but signature indicates they must be present`）—— **这是 ad-hoc 签名的已知行为，不影响实际运行**，macOS 实际运行时只看 quarantine 状态

### 验证状态
- ✅ 本地 build 装上能开
- ✅ GitHub Actions 跨平台 build 绿
- ✅ 主人实测功能正常（创建/加入房间 + 视频同步）
- ⚠️ macOS 用户需要手动 `xattr -d` 清 quarantine（临时）

---

## ✅ v0.6.1 已完成 (2026-06-10 完工, 2026-06-13 补 docs) — 视频添加历史记录 (FR-4)

**Commits** (7 个, 全部 PASS):
- `31ca692` plan(v0.6.1): 视频添加历史记录 计划 + 会议纪要
- `19bd524` feat(v0.6.1-A): 主进程 + preload + electron-store 持久化 + 5 个 IPC handler
- `0644ac8` test(v0.6.1-A): test report for main-process-preload-infra
- `88f27b2` feat(v0.6.1-B): renderer UI — 视频选择对话框 "📜 历史" 按钮 + 列表 + 失效标灰
- `e0fe399` fix(v0.6.1-B): 加"清空所有"按钮 + wire videoHistory.clear()
- `c020d16` test(v0.6.1-B): test test for video-history-ui
- `c349473` test(v0.6.1): add unit + e2e tests for video history

**Tag**：`v0.6.1`（2026-06-13 补推, 详见 `git log origin/main..main` 验证）

### 关键功能
- 🆕 **FR-4 视频添加历史记录**:
  - 持久化：`electron-store` 存 `app.getPath('userData')/video-history.json`
  - 记录时机：`video.loadedmetadata` 事件触发写入
  - 字段: 本地 `{type, path, name, size, mtime, addedAt}` / URL `{type, url, title, addedAt}`
  - 历史 UI: 视频选择对话框加 "📜 历史" 按钮, 展开显示最近 20 条
  - 一键重选: 本地 `loadVideo('file://'+path)` / URL `loadVideo(url, title)`
  - 失效检测: 本地 `fs.existsSync` + 灰显 + "⚠️ 文件已移动/删除" 提示
  - 单条删除 + "清空所有"（带确认）

### IPC 接口
- `desktopAPI.videoHistory.{get, add, remove, clear, checkExists}` — 跟现有 desktopAPI 命名一致

### 测试
- 单元测试：`npm test` 100+ pass (v0.6.0 是 88, 加 ~12 个新测试, per `c349473`)
- v0.6.1-A Test Report: PASS（IPC handler 5 个全验 + electron-store 集成）
- v0.6.1-B Test Report: PASS（UI 元素 + 集成 + 自定义 test-b-main.js + test-b-preload.js 跑过）
- Playwright e2e：add unit + e2e tests for video history (per `c349473`)

### 验收
- ✅ 7 个 v0.6.1 commit 全部 PASS
- ✅ 单元测试 + e2e 测试全绿
- ⏳ GitHub Actions 跨平台 build 跑过 v0.6.1-B 测试用 macos-latest, 但 **未触发 release workflow**（主人 2026-06-13 决策: v0.6.1 release 合并到 v0.6.2, 一起出 release asset, 一起实测）
- ⏳ Mac dmg 实测装上能开 — **推迟到 v0.6.2 一起实测**（同上）

---

## ✅ v0.6.1 已完成 (2026-06-10 完工, 2026-06-13 补 docs) — 视频添加历史记录 (FR-4)

**Commits** (7 个, 全部 PASS):
- `31ca692` plan(v0.6.1): 视频添加历史记录 计划 + 会议纪要
- `19bd524` feat(v0.6.1-A): 主进程 + preload + electron-store 持久化 + 5 个 IPC handler
- `0644ac8` test(v0.6.1-A): test report for main-process-preload-infra
- `88f27b2` feat(v0.6.1-B): renderer UI — 视频选择对话框 "📜 历史" 按钮 + 列表 + 失效标灰
- `e0fe399` fix(v0.6.1-B): 加"清空所有"按钮 + wire videoHistory.clear()
- `c020d16` test(v0.6.1-B): add test report for video-history-ui
- `c349473` test(v0.6.1): add unit + e2e tests for video history

**Tag**：`v0.6.1`（2026-06-13 补推, 详见 `git log origin/main..main` 验证）

### 关键功能
- 🆕 **FR-4 视频添加历史记录**:
  - 持久化：`electron-store` 存 `app.getPath('userData')/video-history.json`
  - 记录时机：`video.loadedmetadata` 事件触发写入
  - 字段: 本地 `{type, path, name, size, mtime, addedAt}` / URL `{type, url, title, addedAt}`
  - 历史 UI: 视频选择对话框加 "📜 历史" 按钮, 展开显示最近 20 条
  - 一键重选: 本地 `loadVideo('file://'+path)` / URL `loadVideo(url, title)`
  - 失效检测: 本地 `fs.existsSync` + 灰显 + "⚠️ 文件已移动/删除" 提示
  - 单条删除 + "清空所有"（带确认）

### IPC 接口
- `desktopAPI.videoHistory.{get, add, remove, clear, checkExists}` — 跟现有 desktopAPI 命名一致

### 测试
- 单元测试：`npm test` 100+ pass (v0.6.0 是 88, 加 ~12 个新测试, per `c349473`)
- v0.6.1-A Test Report: PASS（IPC handler 5 个全验 + electron-store 集成）
- v0.6.1-B Test Report: PASS（UI 元素 + 集成 + 自定义 test-b-main.js + test-b-preload.js 跑过）
- Playwright e2e：add unit + e2e tests for video history (per `c349473`)

### 验收
- ✅ 7 个 v0.6.1 commit 全部 PASS
- ✅ 单元测试 + e2e 测试全绿
- ⏳ GitHub Actions 跨平台 build 跑过 v0.6.1-B 测试用 macos-latest, 但 **未触发 release workflow**（主人 2026-06-13 决策: v0.6.1 release 合并到 v0.6.2, 一起出 release asset, 一起实测）
- ⏳ Mac dmg 实测装上能开 — **推迟到 v0.6.2 一起实测**（同上）

---

## ✅ v0.4.0 已完成（已发布，2026-06-07）

**Commit**：`7a15107`

### 关键工作
- `desktop/` 目录：main.js + preload.js + package.json + .gitignore
- electron-builder 配置：Mac dmg / Windows nsis / Linux AppImage
- 主进程：spawn Node 信令服务器（port 9000）+ BrowserWindow
- 路径解析：`app.getAppPath()` 统一 dev/prod
- loadFile() 直接加载 client/index.html（不需要 Python HTTP server）
- peer@0.6.1 安装到 desktop/node_modules/
- prebuild 脚本：构建前自动复制 ../src/ → src/
- **完全零系统依赖**：不依赖 Python / Node / Homebrew
- 产物：`desktop/dist/SyncPlay-0.4.0-arm64.dmg`（94MB）
- 已在 `/Applications` 安装验证：server 启动正常，窗口正常加载

### 遗留问题
- asar 打包暂时禁用（asarUnpack 对嵌套 node_modules 不生效）
- Mac dmg 使用 `asar: false`，文件未压缩，体积略大
- Windows .exe / Linux .AppImage 尚未在对应平台验证

### Git tag
- `git tag v0.4.0` — 待主人推送

---

## 🎯 v0.5.0 目标（下一步）

**目标**：Windows `.exe` 安装包，双击即用，零依赖安装

### 核心任务
- [ ] 在 Windows 环境下运行 `npm run dist:win` 生成 `.exe`
- [ ] 验证 `.exe` 在**全新 Windows 系统**（无任何开发工具）上直接运行
- [ ] 验证信令服务器自动启动（port 9000）
- [ ] 验证客户端 WebView 正常加载视频同步功能

### 技术方案
- electron-builder 的 NSIS target 已经配置好（v0.4.0 成果）
- NSIS 是绿色解压型安装程序，不依赖系统库
- Windows 环境可通过 Parallels / VM / 远程机器

### 预计产物
```
desktop/dist/
├── SyncPlay-0.4.0-arm64.dmg    # Mac ✅ 已验证
├── SyncPlay Setup 0.5.0.exe    # Windows ⏳ 目标
└── SyncPlay-0.4.0.AppImage      # Linux
```

---

## ✅ v0.3.0 已完成（已发布）

**日期**:2026-06-07
**Commit**:`6db6733`

### MVP (首期必出)
- ✅ TURN 中继支持（Metered SaaS）
- ✅ TURN 凭据抽离到 config.local.js
- ✅ 跨网段实测通过
- ✅ 28 个单元测试

### 二期 (体验优化)
- [ ] TURN 凭据管理 UI（避免手改 config.local.js）
- [ ] 跨网段 UX 优化（分享链接 + TURN 状态指示器）

### 三期 (发布)
- [ ] 代码签名（消除 SmartScreen 警告）
- [ ] 自动更新通道
- [ ] GitHub Releases 发 .exe

---

## ✅ v0.2.0 已完成(已发布)

**日期**:2026-06-06
**Commit**:`19e524f`
**GitHub**:https://github.com/despicablemme/SyncPlayer

### 关键工作
- 客户端拆分(HTML/CSS/JS)
- 修复同步状态机 bug(guardUntil 时间戳)
- 新增漂移校准(10s 间隔 / 0.5s 阈值)
- 新增断线重连(5 次指数退避)
- server.js 改造为 PeerJS 私有服务器
- 视频格式支持扩展
- Toast 通知、密码学安全房间号
- 28 个单元测试覆盖核心同步逻辑
- 一键启动脚本(Mac/Linux/Windows)

---

## 🎯 v1.0 目标(规划中)

**目标**:Mac/Windows/Linux 全平台安装包 + 公网环境播放 MP4 + 进度同步

### 已确认决策(2026-06-06 确认，2026-06-08 更新)
- ✅ **公网方案 = TURN**（方案 A）
- ✅ **TURN 来源 = Metered SaaS**（免费 500GB/月）
- ❌ **VPS 部署已移除**（2026-06-08 决策）
- ✅ 账号系统 v1.0 不做
- ✅ 多人房间放 v2.0

### v1.0 必做清单
- [x] TURN 中继打通公网 ✅ (v0.3)
- [x] 跨网段实测通过 ✅ (v0.3)
- [x] Mac .dmg 打包 ✅ (v0.4)
- [ ] Windows .exe 打包 ⏳ (v0.5)
- [ ] Linux .AppImage 打包 ⏳ (v0.6)
- [ ] TURN 凭据 UI ⏳ (v0.7)

---

## 📊 代码与依赖状态

```
~/CodeProjects/syncplay/
├── 状态: git clean (除 v0.4.0 本地 commits)
├── 远程: https://github.com/despicablemme/SyncPlayer
├── 依赖: desktop/ 已自包含
└── 启动:
    - Mac: 双击 desktop/dist/SyncPlay-0.4.0-arm64.dmg
    - Windows: 双击 desktop/dist/SyncPlay Setup 0.5.0.exe (v0.5 目标)
    - 开发模式: ./start.command (Mac) / start.bat (Win)
```

---

## 📝 进度记录

| 日期 | 版本 | 事件 |
|------|------|------|
| 2026-03-22 | v0.1.0 | MVP 首发(项目立项) |
| 2026-06-06 | v0.2.0 | 重构完成(同步 bug 修复、漂移校准、重连) |
| 2026-06-06 | 规划 | 决定 v1.0 目标,文档结构建立 |
| 2026-06-06 18:00 | 规划 | 加 v1.0 硬性要求 R1-R5 |
| 2026-06-06 18:30 | 规划 | 选定方案 A(TURN) |
| 2026-06-06 18:41 | 规划 | **两阶段路径确定**(Phase 1 SaaS → Phase 2 自建) |
| 2026-06-07 | **v0.4.0** | **Electron 桌面打包：Mac dmg 双击即用，零系统依赖** |
| 2026-06-07 | v0.3 验证 | 4 个 relay 候选成功;强制 relay 模式验证同步走 TURN |
| 2026-06-07 | v0.3 声明 | 跨网段实测主人声明通过(Phase 1 DoD 满足) |
| 2026-06-08 | 规划 | **去除 VPS 计划，v0.5 聚焦 Windows exe 打包** |
| TBD | **v0.5.0** | **Windows .exe 双击即用，零依赖安装** |
| TBD | v0.6.x | Linux .AppImage 验证 |
| TBD | v0.7.x | TURN UI + UX |
| TBD | v1.0 | 互联网可用正式版 |

---

*维护:Jarvis*
*协作:主人(Bruce)*
