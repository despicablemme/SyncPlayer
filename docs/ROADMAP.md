# SyncPlay 项目路线图

> **这是什么?** 项目的"目标与决策中心"--要往哪走、为什么这么做、备选方案是什么。
> **何时查阅?** 想看方向、决策讨论、备选方案对比时。
> **关联文档:** [STATUS.md](./STATUS.md) · [REQUIREMENTS.md](./REQUIREMENTS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [README.md](./README.md) · [CHANGELOG.md](./CHANGELOG.md)
> **最后更新:** 2026-06-08

---

## 🚦 当前迭代

**目标版本**：v0.6 - 体验优化 + bug 修复 (房间生命周期 / 视频 URL bug / 视频匹配) ⚠️ 改方向
**当前阶段**：v0.6 计划制定完成 (2026-06-09)
**上一里程碑**：v0.5.1 GitHub Actions 跨平台 build (2026-06-08 完成)
**下一里程碑**：v0.6 实现 (阶段 B: 拆任务 + 派 subagent)

---

## ✅ v0.5 / v0.5.1 已完成

**目标**：出 Windows `.exe` 安装包，**双击即用，不需要安装任何依赖**（Node/Python/VS Runtime 等）

### 核心任务
- [x] Windows 环境下运行 `npm run dist:win` 生成 `.exe` → 改成 `[x]` 通过 GitHub Actions 在 `windows-latest` runner 出 `.exe`
- [ ] 验证 `.exe` 在**全新 Windows 系统**（无任何开发工具）上直接运行
- [x] 验证信令服务器自动启动
- [x] 验证客户端 WebView 正常加载视频同步功能

### v0.5.1 增量（asar 修复）
- ✅ `asar: true` 重新启用（解决 spctl 严格评估的"无 sealed resources"问题）
- ✅ `asarUnpack` 配置（node_modules + server 路径正确解包）
- ✅ GitHub Actions 跨平台 build 流程跑通（windows-latest / macos-latest / ubuntu-latest）
- ⚠️ macOS Gatekeeper 拦截问题：Chrome 下载的 dmg 会带 quarantine → 用户首次打开需 `xattr -d`（已知，文档化待办）

### v0.5 DoD 状态
- ✅ Windows .exe 产物有（GitHub Actions 出）
- ⏳ 全新 Windows 实测（**待办**，主人没 Windows 机器，v0.6 阶段找朋友测）
- ✅ Mac .dmg 产物有（GitHub Actions 出 + 本地 build 实测能开）
- ⚠️ Mac 公开分发有碑（quarantine，待 v1.0 签名/公证解）
- ✅ Linux AppImage 产物有（GitHub Actions 出，未在裸 Linux 实测）

### 技术要点
- Electron + electron-builder 已经配置好（v0.4.0 成果）
- Windows target: `nsis`（.exe 安装包）
- **关键**：electron-builder 的 nsis target 是绿色解压型，不依赖系统库

### 预计产物
```
desktop/dist/
├── SyncPlay-0.4.0-arm64.dmg    # Mac ✅ 已验证
├── SyncPlay Setup 0.5.0.exe    # Windows ⏳ 目标
└── SyncPlay-0.4.0.AppImage     # Linux
```

---

## 🎯 v0.6 路线 (2026-06-09 立项, 体验优化 + bug 修复)

**目标**: 3 个核心体验问题解决

### 核心任务
- [ ] **FR-1 房间生命周期扩展**: 退出房间 + 重新加入另一房间
- [ ] **FR-2 视频 URL 加载 bug 修复**: HTTP/HTTPS/跨域 URL 都能正常加载
- [ ] **FR-3 解耦视频与房间 + 视频不匹配提示**: 任意顺序, 不匹配时 UI 提示

### 技术要点
- **状态机重构**: 房间状态机 (`no_room`/`connecting`/`in_room`/`disconnected`) + 视频子状态 (`no_video`/`waiting_peer`/`synced`/`mismatch`)
- **FR-1 + FR-3 合并改状态机**: 避免重复修改
- **视频匹配算法**: URL / 文件名 / 时长 (任一即可, Builder 决定策略)
- **UI 状态区扩展**: 加"视频不匹配"红色提示

### 决策记录
- ⚠️ **改方向**: 原计划"v0.6 = Linux AppImage 验证 + macOS 安装文档化" 改为 "v0.6 = 体验优化"
- ❌ 推迟: v0.5 (TURN UI) / v0.7 (移动端) 延后
- ✅ 优先: 主人 3 个体验问题

### 详细需求
见 [REQUIREMENTS.md](./REQUIREMENTS.md) "## 八、v0.6 新增需求" + [MEETINGS.md](./MEETINGS.md) 会议 #005

### 进度
- [x] 计划制定 (阶段 A) — 2026-06-09
- [ ] 实现 (阶段 B: 拆任务 + 派 subagent)
- [ ] 验收 (阶段 C: 完工)

---

## 🎯 v0.4 路线(已完成)

**目标**:出 Mac .dmg + Windows .exe + Linux .AppImage 一键安装包

### Phase A — MVP ✅
- [x] `desktop/` 目录 + `main.js` + `preload.js`
- [x] `electron-builder` 配置(Mac .dmg + Windows .exe + Linux .AppImage)
- [x] 本地出 Mac .dmg 验证流程

### Phase B — 体验优化
- [ ] TURN 凭据管理 UI(避免手改 `config.local.js`)
- [ ] 跨网段 UX 优化(分享链接 + TURN 状态指示器)

### Phase C - 发布就绪
- [ ] 代码签名(消除 SmartScreen 警告)
- [ ] 自动更新通道
- [ ] GitHub Releases 发 .exe

### 选型:Electron vs 替代方案

| 方案 | 输出 | 体积 | 跨平台 | 推荐 |
|------|------|------|--------|------|
| 🅰️ **Electron** | 真正 .exe | ~150MB | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| 🅱️ pkg + WebView2 | 类似 | ~50MB | ⚠️ Win 优先 | ⭐⭐⭐ |
| 🅲️ 中性 zip | 需装 Node+Python | ~5MB | ✅ | ⭐⭐ |

**为什么选 Electron**:
- 真正单文件体验(像 VSCode/Discord)
- 跨平台统一一套代码
- 生态成熟(electron-builder 配 Windows 签名、自动更新都是现成)
- Mac 上能直接出包(可立刻验证)

---

## 🔑 v1.0 工作清单（规划中）

### P0 - 必做

- [x] **打通公网连接**(TURN 已选定 + 实现 + 验证)
- [x] **客户端配远程 TURN**(`config.local.js` 抽离完成)
- [x] **跨网段实测两端同步**(v0.3 主人声明通过)
- [x] **Electron 打包 Mac**(v0.4 完成)
- [x] **Electron 打包 Windows** ✅ (v0.5/v0.5.1 产物有，全平台实测待 v0.6)
- [ ] **Electron 打包 Linux**(v0.6 目标)

### P1 - 应做

- [ ] 房间号 → 分享链接
- [ ] 连接状态可视化(直连 / TURN / 失败)
- [ ] TURN 凭据管理 UI
- [ ] 错误友好提示

### P2 - 锦上添花

- [ ] 移动端响应式
- [ ] 视频两端文件校验
- [ ] 重连后状态恢复
- [ ] 代码签名

---

## ✅ 已确认决策

### v0.4.0 新增决策(2026-06-07)
- **打包方案**:Electron + electron-builder(跨平台统一)
- **产物格式**:`.dmg` / `NSIS .exe` / `.AppImage`
- **TURN 凭据管理**:先 `config.local.js`(gitignore),未来 Phase B 加 UI

### v0.2.0 决策(2026-06-06)

| 决策项 | 决策 | 备注 |
|--------|------|------|
| **公网方案** | ✅ **方案 A(TURN)** | 见下方对比 |
| **TURN 来源** | ✅ **Metered SaaS** | 免费 500GB/月,0 成本跑通 |
| **信令** | ✅ **PeerJS 公共服务器** | 保持现状,够用 |
| **账号系统** | ❌ v1.0 不做 |  |
| **多人房间** | ❌ 放 v2.0 |  |
| **v0.3 打包** | ✅ **Electron** | 见上方 v0.4 路线 |

### 公网方案对比(已定 A)

| 维度 | 方案 A:TURN | 方案 B:LiveKit/Daily | 方案 C:纯 WebSocket |
|------|------------|---------------------|-------------------|
| 实现量 | 🟢 小(加 ICE servers)| 🔴 大(替换 SDK)| 🟡 中(改用 WS)|
| 服务器成本 | 💰 $0-5/月 | 💰💰 $0-50/月 | 💰 极低 |
| 客户端改动 | 🟢 小 | 🔴 大 | 🟡 中 |
| 数据隐私 | 🟢 视频不经服务器 | 🟡 看配置 | 🟡 指令经服务器 |
| 维护成本 | 🟢 低 | 🟢 外包 | 🟢 低 |
| **结论** | ⭐ **已选** | 备选 | 备选 |

**为什么选 TURN**:
- 改动最小(保护 v0.2 重构成果)
- 隐私最好(视频永远不上服务器)
- syncplay 只同步指令(几十字节 JSON),TURN 带宽压力极小

---

## 🛣️ v1.0 实施路径（简化版）

### Phase 1: SaaS 跑通(v1.0 MVP) — **已验证通过**

**目标**:验证"公网两端能同步"的完整流程,0 VPS 成本

**架构**:
```
A 浏览器 ──WSS──► PeerJS 公共信令 ──► B 浏览器
       │                                    │
       └────► Metered TURN(穿透失败时)◄────┘
```

**任务清单**:
- [x] 注册 Metered 拿 TURN 凭据(用户名/密码/URL)
- [x] 改 `src/client/app.js` 加 ICE_SERVERS 配置
- [x] 跨网段实测两端同步 ✅ **2026-06-07 主人声明通过**

---

## 📅 后续版本预览

| 版本 | 主题 | 关键特性 | 状态 |
|------|------|---------|------|
| **v0.4.0** | **Electron Mac 打包** | **Mac .dmg 双击即用，零系统依赖** | **✅ 已发布** |
| **v0.5.0** | **Electron Windows 打包** | Windows .exe 双击即用，零依赖 | ✅ 已发布（实测待补） |
| **v0.5.1** | **asar 修复 + 跨平台 CI** | asar=true + GitHub Actions 出 Win/Mac/Linux 三平台 | ✅ 已发布 |
| **v0.6.x** | **体验优化 + bug 修复** | **房间退出/换房 + 视频 URL bug + 视频匹配** | **🎯 当前** (2026-06-09 立项) |
| v0.7.x | TURN UI + UX | TURN 凭据管理 UI + 分享链接 + TURN 状态指示器 | 计划中 |
| **v1.0** | **互联网可用** | **Metered SaaS TURN 已验证通过** | **目标** |
| v2.0 | 多人房间 | 3 人以上同步 | 长期 |
| v3.0 | 流媒体 | 一端本地、一端远程拉流 | 长期 |

---

## 🛣️ v1.0 完成判定(Definition of Done)

v1.0 视为完成当且仅当:

- [x] 两位测试者分别在**不同网络**(如家庭宽带 + 移动 4G)能成功建立连接
- [x] 视频播放/暂停/seek 同步延迟 < 500ms
- [x] 对称 NAT / 严格网络环境下也能连上
- [x] 断线后 30 秒内能自动重连
- [x] Mac .dmg 双击即用，零系统依赖 ✅
- [ ] Windows .exe 双击即用，零系统依赖 ⏳ (v0.5)
- [ ] Linux .AppImage 双击即用，零系统依赖 ⏳ (v0.6)
- [ ] README 有清晰的安装说明

---

## 📝 进度记录

| 日期 | 版本 | 事件 |
|------|------|------|
| 2026-03-22 | v0.1.0 | MVP 首发 |
| 2026-06-06 | v0.2.0 | 重构完成(同步 bug 修复、漂移校准、重连) |
| 2026-06-07 | **v0.4.0** | **Electron 桌面打包完成:Mac dmg 双击即用,零系统依赖** |
| 2026-06-07 | v0.3 验证 | 4 个 relay 候选成功;强制 relay 模式验证同步走 TURN |
| 2026-06-07 | v0.3 声明 | 跨网段实测主人声明通过(Phase 1 DoD 满足) |
| 2026-06-08 | 规划 | **去除 VPS 计划，v0.5 聚焦 Windows exe 打包** |
| 2026-06-08 | **v0.5.1** | **asar 修复 + GitHub Actions 跨平台 build：Windows .exe / Mac .dmg / Linux AppImage** |
| 2026-06-09 | **v0.6** | **计划制定完成 (阶段 A) — 改方向为体验优化** |
| TBD | v0.7.x | TURN UI + UX |
| TBD | v1.0 | 互联网可用正式版 |

---

*制定:Jarvis & 主人*
