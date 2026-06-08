# Changelog

> **这是什么？** 历史版本变更记录——每个版本改了什么、新增了什么。  
> **何时查阅？** 想看项目演进、某个功能是哪个版本加的。  
> **关联文档：** [STATUS.md](./STATUS.md) · [ROADMAP.md](./ROADMAP.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-08

---

## [未发布]

### 下一版本 v0.5.0 计划（2026-06-08）

**目标**：Windows `.exe` 安装包，双击即用，零依赖安装

- [ ] Windows 环境下运行 `npm run dist:win` 生成 `.exe`
- [ ] 验证 `.exe` 在**全新 Windows 系统**（无任何开发工具）上直接运行
- [ ] 验证信令服务器自动启动
- [ ] 验证客户端 WebView 正常加载视频同步功能

### 后续版本计划

- **v0.6.x**：Linux `.AppImage` 验证
- **v0.7.x**：TURN 凭据管理 UI + 跨网段 UX 优化
- **v1.0**：互联网可用正式版（Mac/Windows/Linux 全平台安装包）

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
