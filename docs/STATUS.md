# SyncPlay 当前状态

> **这是什么?** 项目的"进度快照"--当前版本、已完成、下一步。
> **何时查阅?** 每次回来接任务时**先看这个**。
> **关联文档:** [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md) · [README.md](./README.md)
> **最后更新：** 2026-06-07

---

## 🚦 一句话状态

**当前版本：v0.4.0**（已发布 — Electron 桌面打包）
**上一版本：v0.3.0**（TURN 中继 + 测试基础设施）
**下一个目标：v0.5 — TURN 凭据 UI + 跨网段 UX 优化**
**当前阶段：v0.4 Electron 桌面打包已发布** — Mac .dmg 双击即用

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
- Windows / Linux 打包尚未在对应平台验证

### Git tag
- `git tag v0.4.0` — 待主人推送

---

## ✅ v0.3.0 已完成（已发布）

### MVP (首期必出)
- [ ] `desktop/` 目录创建 + main.js + preload.js
- [ ] `electron-builder` 配置(Mac .dmg + Windows .exe + Linux .AppImage)
- [ ] 本地出 Mac .dmg 验证

### 二期 (体验优化)
- [ ] TURN 凭据管理 UI(避免手改 config.local.js)
- [ ] 跨网段 UX 优化(分享链接 + TURN 状态指示器)

### 三期 (发布)
- [ ] 代码签名(消除 SmartScreen 警告)
- [ ] 自动更新通道
- [ ] GitHub Releases 发 .exe

### 预计产物
- `desktop/dist/SyncPlay-0.3.0.dmg`(Mac)
- `desktop/dist/SyncPlay Setup 0.3.0.exe`(Windows)
- `desktop/dist/SyncPlay-0.3.0.AppImage`(Linux)
- 预计体积:~150MB(Chromium 占比 90%)

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

**目标**:网页版 UI + **公网环境**(任何网络)播放 MP4 + 进度同步 - **实现方式不限**

### 已确认决策(2026-06-06 18:41)
- ✅ **公网方案 = TURN**(方案 A)
- ✅ **Phase 1**:用 Metered SaaS(免费)跑通
- ✅ **Phase 2**:自建 VPS 跑 coturn + 信令
- ✅ 账号系统 v1.0 不做
- ✅ 多人房间放 v2.0

### Phase 1 必做(不做不算 v1.0 MVP)
- [ ] 注册 Metered 拿 TURN 凭据
- [ ] 改 `src/client/app.js` 加 ICE_SERVERS
- [ ] 跨网段实测两端同步

### Phase 2 应做(v1.0 正式版)
- [ ] 租 VPS
- [ ] 部署信令服务器(Docker compose)
- [ ] 部署 coturn(Docker compose)
- [ ] HTTPS 证书
- [ ] 改 `app.js` 指向 VPS
- [ ] 跨网段实测

详细路线图见 [ROADMAP.md](./ROADMAP.md)

---

## 🛠️ 当前可做的事(Phase 1)

回到 syncplay 后,可以从以下任一项继续:

1. ⭐ **主人去 https://www.metered.ca 注册** -- 拿 TURN 凭据
2. 我改 `src/client/app.js` -- 加 ICE_SERVERS 配置
3. **跨网段实测** -- 找朋友或用 4G 热点测两端同步
4. Phase 1 通过后--开始 Phase 2(租 VPS)

---

## 📊 代码与依赖状态

```
~/CodeProjects/syncplay/
├── 状态: git clean (除 v0.3.0 本地 commits)
├── 远程: https://github.com/despicablemme/SyncPlayer
├── 依赖: client 无构建(纯静态), server 需 npm install, 未来 desktop 需 electron
└── 启动:
    - 开发模式: ./start.command (Mac) / start.bat (Win)
    - 诊断模式: ./diagnose.sh (Mac) / diagnose.bat (Win)
    - v0.3 后: 打包好的 .dmg / .exe / .AppImage 双击即用
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
| 2026-06-07 | **v0.4.0** | Electron 桌面打包：Mac dmg 双击即用，零系统依赖 |
| 2026-06-07 | v0.3 测试 | 4 个 relay 候选生成成功;强制 relay 模式验证同步走 TURN |
| 2026-06-07 | v0.3 文档 | ARCHITECTURE.md 依赖清单权威记录;所有 URL 同步 |
| 2026-06-07 | **v0.3 MVP** | Electron 打包 desktop/ 目录搭建完成 |
| TBD | v0.3 二期 | TURN 凭据 UI + 跨网段 UX |
| TBD | v0.3 三期 | 代码签名 + 自动更新 + GitHub Releases |
| TBD | v1.0 | 云端自部署 + 正式版 |

---

*维护:Jarvis*
*协作:主人(Bruce)*
