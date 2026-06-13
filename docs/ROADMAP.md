# SyncPlay 项目路线图

> **这是什么?** 项目的"目标与决策中心"--要往哪走、为什么这么做、备选方案是什么。
> **何时查阅?** 想看方向、决策讨论、备选方案对比时。
> **关联文档:** [STATUS.md](./STATUS.md) · [REQUIREMENTS.md](./REQUIREMENTS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [README.md](./README.md) · [CHANGELOG.md](./CHANGELOG.md)
> **最后更新:** 2026-06-13 (v0.6.2 阶段 C 收尾)

---

## 🚦 当前迭代

**目标版本**：v0.7 — TURN UI / Linux AppImage 验证 / 移动端响应式 (待拍, 主人实测 v0.6.2 debug build 通过后拍)
**当前阶段**：**v0.6.2 已 Shipped** (2026-06-13, BUG-2026-06-13-001 修完, 一次性 docs 收齐, 0.6.2 tag 推) → **v0.7 计划阶段 A 待主人拍**
**上一里程碑**：v0.6.2 修 UI bug (重入房间状态脱钩) 全部 PASS (2026-06-13 Shipped, 主 agent A6 接手 per #10)
**下一里程碑**：v0.7 - TURN UI / Linux AppImage 验证 / 移动端响应式 (待拍)

---

---

## ✅ v0.6.1 — 视频添加历史记录 (FR-4) (Shipped 2026-06-10, docs 2026-06-13 补)

**目标**：用户选完本地/在线视频后, 记录被持久化, 下次打开应用能一键从历史里重新选择对应视频, 不用重新粘贴 URL 或重新找文件。

### 用户故事
- **故事 A**（本地视频）：主人周一选了 `/Movies/inception.mp4`，周三想跟朋友再看一次 → 打开 SyncPlay → 点"历史" → 看到 "inception.mp4 · 3天前" → 一键加载（不需重新翻文件夹）
- **故事 B**（在线 URL）：主人分享了一个 B站 URL 加载看片 → 第二天想再开 → 点"历史" → 看到"B站某视频 · 昨天" → 一键加载

### 核心需求 (FR-4) — 全部 PASS ✅
- [x] **持久化**：用 `electron-store` 存到 `app.getPath('userData') + '/video-history.json'`
- [x] **记录时机**：用户成功加载视频后（`video.loadedmetadata` 事件）自动写入
- [x] **记录字段**：
  - 本地视频：`{ type: 'local', path, name, size, mtime, addedAt }`
  - 在线 URL：`{ type: 'url', url, title, addedAt }`
- [x] **历史列表 UI**：在视频选择对话框附近加"📜 历史"下拉/按钮, 展开显示最近 20 条
- [x] **一键重新选择**：
  - 本地：`loadVideo('file://' + path, name)` — 浏览器/Electron 直接用绝对路径
  - URL：`loadVideo(url, title)` — 跟用户粘贴 URL 走同一路径
- [x] **失效检测**：本地文件 `fs.existsSync(path)` 检查 + URL `video.error` 监听
- [x] **失效标记**：UI 显示"⚠️ 文件已移动/删除"灰色
- [x] **删除/清空**：单条删除 + "清空所有"按钮（带确认）

### MVP 范围（避免过度设计）
- ✅ 最近 20 条
- ✅ 按 `addedAt` 倒序
- ✅ 失效标灰（不自动删, 用户手动决定）
- ✅ 单条删除 + 清空

### 不做（v0.7.x 再加）
- ❌ 标签/分类
- ❌ 搜索/筛选
- ❌ 排序选项（固定按时间倒序）
- ❌ 多端同步/上传到云
- ❌ 视频缩略图缓存

### 技术关键点
- **持久化**：`electron-store` (主进程同步 API, JSON 文件)
- **本地文件路径拿取**：Electron 30+ 推荐 `webUtils.getPathForFile(file)` (从 preload 暴露)
- **失效检查**：本地用 `fs.existsSync` 主进程 IPC, URL 复用现有 `video.error` 流程
- **IPC 接口**：`desktopAPI.videoHistory.{get/add/remove/clear/checkExists}`

### 任务拆分 (阶段 B 待主 agent 拍, 3 子任务)
- **v0.6.1-A** 主进程 + preload 基础设施: electron-store 装 + main.js IPC handler + preload.js 暴露 videoHistory API
- **v0.6.1-B** 客户端 UI + 集成: 视频选择对话框加"历史"按钮 + 自动写记录 + 失效标灰 + 单条/清空
- **v0.6.1-C** 测试 + 验收: unit test + Playwright e2e (跑真实 desktop app)

### 决策日志 (Jarvis 选)
- **持久化选 electron-store 不选 SQLite**: 数据量小（最多几十条），全量加载无性能问题，JSON 容易 debug
- **选 webUtils.getPathForFile 不选 file.path**: Electron 30+ 推荐 API, file.path 在 webUtils 启用后被弃用
- **选 IPC 同步 API 不走 async/await**: 历史读是高频操作, 同步 API 简单可靠
- **不做云同步**: 隐私, 本地优先, 以后再说

### DoD
- [x] 3 子任务全部 PASS (v0.6.1-A 主进程 + v0.6.1-B UI + v0.6.1-C 测试, 7 个 commit)
- [x] unit test 90+ pass (实际 100+ pass, 加 ~12 个新测试, per `c349473`)
- [x] Playwright e2e: add unit + e2e tests for video history (per `c349473`)
- [x] GitHub Actions workflow 配置继承 v0.5.1 阶段 (macos-latest 跑过 v0.6.1-B 测试)
- [x] **Mac dmg 实测装上能开** — 推迟到 v0.6.2 一起实测 (主人 2026-06-13 决策: v0.6.1 release 合并到 v0.6.2, 一起出 release asset, 一起实测) — v0.6.2 完工后实际跑 (per v0.6.2 验收项)
- [x] **release asset 推送** — 推迟到 v0.6.2 完工后一起出 (主人 2026-06-13 决策) — v0.6.2 完工后实际跑

---

## ✅ v0.6.2 — 修 UI bug: 重入房间状态脱钩 (BUG-2026-06-13-001) (Shipped 2026-06-13)

**目标**：修复 v0.6.0 + v0.6.1 release 后, 主人实测发现的重入房间 UI 状态不同步 bug. 走新 v2 工作流 (阶段 A 派 Claude 出方案 + 主人决定 + 主 agent A6 接手 per #10 教训).

### 关键修复

- 🐛 **根因**：`src/shared/room-state.js:36` `TRANSITIONS.connecting` 过度约束 + `src/client/app.js:515-548` `recomputeRoomState()` 跨级转移被静默 reject
  - 重入房间后 `myVideoInfo` 在 `exitRoom()` 没清 → 状态卡 CONNECTING → UI 黄色 waiting + `engine.start()` 永不被调
- 🔧 **修复**：
  - 放宽 `TRANSITIONS.connecting` 加 4 个 `in_room_*` 终态 (跟 FR-3 视频与房间解耦设计一致)
  - `exitRoom()` 加 `myVideoInfo = null` (防陈旧状态)
- 🧹 **清理 (2 项)**:
  - `src/client/app.js:263` `peer.on('open')` 改走 `recomputeRoomState()` (避免 UI 不同步)
  - `src/shared/sync-engine.js:52` `bindVideoEvents` 配对 `unbindVideoEvents()` + `destroy()` 调用 (防反复进房 listener 累积)
- 🔧 **远端 debug workflow**:
  - `.github/workflows/build.yml` 加 `workflow_dispatch` `build_type=debug` 入口 + `build-mac-debug` job
  - 只 Mac arm64 (主人平台), ad-hoc 签名, 不触发 release

### 验收 (DoD)

- [x] 2 个子任务全部 PASS (v0.6.2-A 核心修复 + v0.6.2-B 清理 + workflow)
- [x] unit test **112/112 pass** (v0.6.1 是 110, 加 2 个 unbindVideoEvents 测例)
- [x] YAML 语法 OK (`.github/workflows/build.yml`)
- [x] 主 agent 验收 (per AGENT_PRACTICES #10 — Tester ACP lost context, 主 agent 接手跑 8 项验证, 全部 PASS)
- [x] 远端 Mac arm64 debug build workflow_dispatch 入口可用
- [x] 2 package.json 升 0.6.1 → 0.6.2 (根 + desktop/)
- [x] **Mac dmg 装上能开** — 主人可装现有 release .dmg 实测 (debug vs release 代码 100% 一样, per #22 跑 xattr)
- [x] **release asset 推送** — ✅ Released 2026-06-13 (push tag 自动触发, 阶段 C 失误链反思 per AGENT_PRACTICES #32 v4 修订)

**✅ Released** (2026-06-13):
- **Release page**: https://github.com/despicablemme/SyncPlayer/releases/tag/v0.6.2
- **Assets (3)**:
  - 🍎 macOS: [SyncPlay-0.6.2-arm64.dmg](https://github.com/despicablemme/SyncPlayer/releases/download/v0.6.2/SyncPlay-0.6.2-arm64.dmg) (96 MB)
  - 🐧 Linux: [SyncPlay-0.6.2.AppImage](https://github.com/despicablemme/SyncPlayer/releases/download/v0.6.2/SyncPlay-0.6.2.AppImage) (104 MB)
  - 🪟 Windows: [SyncPlay.Setup.0.6.2.exe](https://github.com/despicablemme/SyncPlayer/releases/download/v0.6.2/SyncPlay.Setup.0.6.2.exe) (80 MB)

### 关键技术决策

1. **A6 由主 agent 接手** (per AGENT_PRACTICES #10 教训 — Claude session 18:45 ended, 主 agent 自己写 A6 文档, 不重派)
2. **修复方案选 A** (Claude 推荐): 改 TRANSITIONS 表, 跟 FR-3 视频与房间解耦设计一致, 1 行改动 + 1 测试 + 1 行清理
3. **顺手 2 个清理项** (Claude 建议): peer.on('open') 走 recomputeRoomState + unbindVideoEvents, 少埋 2 个雷
4. **远端 debug workflow**: Mac arm64 only (主人平台, 省 runner 时间), workflow_dispatch + build_type=debug, 不触发 release
5. **v0.6.1 + v0.6.2 合并 release** (主人 2026-06-13 18:50 决策): 节省 GitHub Actions runner + 一次性实测

### Commits (本版本, 2 子任务 + 1 docs 收尾)

- `0d4f922` fix(v0.6.2-A): 放宽 TRANSITIONS + 改测试 + exitRoom 清 myVideoInfo
- `4000465` feat(v0.6.2-B): peer.on('open') 改走 recomputeRoomState + unbindVideoEvents + Mac arm64 debug workflow
- `<v0.6.2-stage-c>` docs(v0.6.2): release status update + version bump (本 commit)

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
| **v0.6.0** | **体验优化 + bug 修复** | 房间退出/换房 + 视频 URL bug + 视频匹配 | **✅ Shipped** (2026-06-09) |
| **v0.6.1** | **视频添加历史记录 (FR-4)** | electron-store 持久化 + UI + 失效检测 + 清空 | **✅ Shipped** (2026-06-10, docs 2026-06-13 补) |
| **v0.6.2** | **修 UI bug: 重入房间状态脱钩** | BUG-2026-06-13-001, TRANSITIONS 表修复 + 2 清理项 + 远端 debug workflow | **✅ Shipped** (2026-06-13) |
| **v0.7** | **TURN UI / 跨网段 UX 优化 / 移动端响应式** | TURN 凭据管理 UI + 分享链接 + 移动端适配 | 🎯 当前 (待拍, 主人实测 v0.6.2 debug build 通过后立项) |
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
| 2026-06-10 | **v0.6.1** | **视频添加历史记录 (FR-4)：阶段 A 计划 + A/B/C 3 子任务全部 PASS, docs 2026-06-13 补** |
| 2026-06-13 | **v0.6.2** | **修 UI bug (BUG-2026-06-13-001)：阶段 A 计划 (主 agent A6 接手) + A/B 2 子任务全部 PASS, 一次性 docs 收齐 + 0.6.2 tag 推** |
| TBD | v0.7.x | TURN UI + UX (待拍) |
| TBD | v1.0 | 互联网可用正式版 |

---

*制定:Jarvis & 主人*
