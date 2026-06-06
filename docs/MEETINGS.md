# SyncPlay 项目会议纪要

> **这是什么？** 早期项目会议讨论记录——项目启动、需求、技术选型等历史讨论。  
> **何时查阅？** 想了解项目最初是怎么启动的、哪些决策是在什么会议上定的。  
> **关联文档：** [STATUS.md](./STATUS.md) · [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-06

---

## 会议 #002 — 2026-06-06 v1.0 规划与产品化讨论（大型会议）

**参会人员**：主人（Bruce）、Jarvis  
**主题**：从 v0.2 重构到 v1.0 互联网可用版的大型产品规划讨论  
**耗时**：约 8 小时，含多个子讨论

### 一、v0.2 重构完成后的状态盘点

- v0.2.0 已发布：同步 bug 修复、漂移校准、断线重连、客户端拆分、密码学安全房间号、Toast 通知、视频格式扩展
- 28 个单元测试覆盖核心同步逻辑
- GitHub 仓库：despicablemme/SyncPlayer

### 二、v1.0 需求讨论

**重新明确 v1.0 核心要求**：
1. 网页版 UI
2. **公网环境**（任意网络）可播放 MP4 视频 — **实现方式不限**
3. 进度实时同步

**主人提出"5 条硬性要求"**（R1-R5）：

| # | 要求 |
|---|------|
| R1 | 必须一键启动（双击即用） |
| R2 | 启动后在界面中配置房间 |
| R3 | 双方均能选择创建或加入房间 |
| R4 | 加入后自动构建同步链路 |
| R5 | 仅通过房间号认证（无注册无登录） |

**定了完整场景剧本**：异地两位好友，A 在 Mac 双击 start.command，B 在 Windows 双击 start.bat，浏览器自动开，通过房间号连接，看同一个视频。

### 三、产品化反馈

**主人提出关键产品反馈**：
> "你做出的成品需要是给用户使用的，需要做出一个一键启动的东西。"

得出结论：**给用户的应该是双击就用的东西，不是命令清单。**

**还提出**：
> "希望看目标时有计划文档可以查阅，看当前进度时有版本记录和计划进展记录可以查询。这样每次都可以接续任务。"

得出结论：**文档体系要支撑"接续任务"**。

### 四、公网方案决策（三选一）

**讨论了三个候选方案**：

| 方案 | 实现量 | 成本 | 隐私 | 推荐度 |
|------|--------|------|------|--------|
| A. TURN 中继 | 小 | $0-5/月 | 视频不经服务器 | ⭐⭐⭐ |
| B. LiveKit/Daily | 大 | $0-50/月 | 可能经过 | ⭐⭐ |
| C. 纯 WebSocket | 中 | 极低 | 指令经服务器 | ⭐ |

**决策**：选 A（TURN）—— 改动最小，保护 v0.2 重构成果，隐私最好。

### 五、为什么选 TURN（科普讨论）

**主人问**：TURN 原理是什么？商用可行吗？

**Jarvis 解释**：
- TURN 是在 P2P 直连失败时（~15% 网络场景）的中继
- 类似于"墙那边的朋友帮你传话"
- syncplay 只同步指令（几十字节 JSON），TURN 带宽压力极小
- 单台 $5 VPS 可撑几百对用户
- **商用可行**：自建 coturn 比 Metered SaaS 便宜得多

### 六、两阶段实施路径决策

**主人提出**：
> "先用 A 方案跑通，满足基本需求；这步骤实现后，我去租服务器，自建服务。"

**最终确定两阶段路径**：

| 阶段 | 目标 | 架构 | 成本 | 状态 |
|------|------|------|------|------|
| **Phase 1** | 跑通"公网两端同步" | Metered SaaS TURN + PeerJS 公共信令 | 0 | **当前** |
| **Phase 2** | 商用可控 | 自建 VPS（coturn + 信令）| ~$5/月 | Phase 1 通过后启动 |

**决策要点**：
- Phase 1 信令保持 PeerJS 公共（够用）
- Phase 2 信令 + TURN 都自建
- 账号系统 v1.0 不做
- 多人房间放 v2.0

### 七、代码与项目结构重构

**移动项目位置**：
- `~/Documents/KnowLedgeDatabase/projects/syncplay` → `~/CodeProjects/syncplay`
- 确立新约定：**所有代码项目统一放 `~/CodeProjects/`**

**Git 仓库建立**：
- 新建 GitHub 仓库：despicablemme/SyncPlayer
- v0.2 初始 commit + push 成功

**项目结构标准化**（`docs/`、`src/`、`test/`）：
- `docs/`：所有 .md 文档（7 个）
- `src/shared/`：跨端复用代码（sync-engine.js）
- `src/client/`：客户端
- `src/server/`：服务端
- `test/unit/`：单元测试
- `test/e2e/`：E2E 测试

### 八、自动化测试

**28 个 SyncEngine 单元测试**（用 Node 内置 `node:test`）：
- 覆盖 play/pause/seek/heartbeat/drift/file_info 等所有同步协议分支
- **意外发现并修复 1 个真实 bug**：`file_info` 缺 `duration` 字段时会抛 TypeError
- 跑通 Playwright E2E 测试失败（headless Chrome 对 WebRTC 支持有限），改为聚焦单元测试

### 九、一键启动器（三平台）

**产品化核心交付**：
- macOS：`start.command`（Finder 双击）
- macOS/Linux：`start.sh`（终端 ./start.sh）
- Windows：`start.bat`（双击）
- 对应 stop 脚本

**start.sh 流程**：环境检查 → 装依赖 → 启动信令 → 启动客户端 → 开浏览器 → Ctrl+C 干净关闭。

### 十、文档体系重构

**主人反复强调**：
> "我希望看目标时有计划文档可以查阅，看当前进度时有版本记录和计划进展记录可以查询。这样每次都可以接续任务。"

**最终文档分工**：

| 文档 | 用途 | 何时看 |
|------|------|--------|
| STATUS.md | 当前进度 | 回来接任务先看 |
| ROADMAP.md | 目标 + 决策 | 想看方向 |
| REQUIREMENTS.md | 要做什么 | 想看需求 |
| ARCHITECTURE.md | 怎么实现 | 实现功能前 |
| CHANGELOG.md | 历史变更 | 想看演进 |
| TECH_RESEARCH.md | 选型背景 | 想了解理由 |
| MEETINGS.md | 会议记录 | 想了解历史决策 |
| README.md（docs/） | 文档索引 | 不知道看哪个 |

**统一文档头部格式**：这是什么 / 何时查阅 / 关联文档 / 最后更新。

**主人教我的重要反馈**：
1. 架构文档应该是"正在实现什么"，不是"在选什么"——ARCHITECTURE.md 重构
2. docs/README.md 就是 BOOTSTRAP，不用再建 BOOTSTRAP.md——顶层 README 加 "给新 session" 区块

### 十一、本地双端测试方法

**主人问**：本地模拟双端怎么搞？

**Jarvis 答**：
1. 同机器双浏览器（最简单）：普通 + 隐身窗口
2. 不同浏览器：Chrome + Safari/Firefox
3. 两台真实设备（同局域网）：互访 IP

**测什么**：play/pause/seek 同步、断线重连、心跳延迟、漂移校准。

### 十二、Phase 1 启动行动项

| 步骤 | 谁做 | 状态 |
|------|------|------|
| 注册 [Metered](https://www.metered.ca) 拿 TURN 凭据 | 主人 | ⏳ |
| 改 `src/client/app.js` 加 ICE_SERVERS | Jarvis | 待凭据后 |
| 跨网段实测两端同步 | 主人 | 待配置完后 |

---

## 会议 #001 — 2026-03-22

### 项目启动会议

**参会人员：** 主人、Jarvis（AI 助手）

**议题：** 讨论多 Agent 开发模式与视频同步播放工具项目立项

---

### 会议内容

#### 一、多 Agent 开发模式确认

**背景：** 主人希望使用 AI 多 Agent 模式来开发软件，不同 Agent 担任不同角色（架构师、策略师、调度师、工程师等）

**确认事项：**
1. **子 Agent 执行模式**：所有任务由子 Agent 执行，主 Agent（Jarvis）保持空闲随时响应主人
2. **并行能力**：子 Agent 可并行运行，不阻塞主人与 Jarvis 的对话
3. **会话模式**：QQBot 维持连续会话，可上下文中继续
4. **Jarvis 定位**：作为调度师 + 中转站，拆分任务、派发子 Agent、汇总结果

**结论：** 采用 OpenClaw 原生 `sessions_spawn` 派子 Agent 方式实现

---

#### 二、项目需求讨论

**项目名称：** SyncPlay（同步播放工具）

**核心需求：**
1. 两人同时播放同一视频文件时，进度实时同步
2. 一方快进/暂停，另一方自动同步
3. 延迟尽可能低

**MVP 范围（已确认）：**
- ✅ Web 平台（浏览器版，最轻量）
- ✅ 两端都播放本地视频文件
- ✅ 只实现进度同步功能（播放/暂停/seek）
- ✅ 房间号连接

**排除（暂不做）：**
- ❌ 视频流媒体传输
- ❌ 聊天等社交功能
- ❌ 用户认证

**技术方向（已确认）：**
- 同步协议：WebRTC DataChannel（P2P，不需中转服务器）
- 信令服务：WebSocket（仅用于建立 WebRTC 连接）
- 前端：纯 HTML + JS（最轻量）
- 后端：Node.js（极简信令服务器）

---

#### 三、技术架构

```
用户 A                   用户 B
  ↓                         ↓
本地视频文件 ←→ 浏览器 ←→ WebRTC DataChannel ←→ 浏览器 ←→ 本地视频文件
  ↓                         ↓
      ←←←←←←←← 信令服务器（仅建立连接）←←←←←←←←
```

**同步原理：**
- A 点击播放 → 发送 `{"type": "play", "position": 12.5}` 到 B
- B 收到 → 立即将 video.currentTime 设为 12.5 并播放
- A 拖动进度条 → 发送 `{"type": "seek", "position": 45.0}` 到 B
- B 收到 → 立即将 video.currentTime 设为 45.0

---

#### 四、待确认事项

- [x] 确定目标平台 → Web（浏览器版）
- [x] 确定技术栈 → 纯 HTML + JS / WebRTC DataChannel / Node.js
- [x] 确定同步方案 → P2P 直连（WebRTC DataChannel）
- [x] 确定 MVP 范围 → 只做进度同步

---

## 后续讨论摘要

### 2026-03-22 补充

- 确认使用子 Agent 执行任务模式
- Jarvis 负责调度，不阻塞主人对话
- 项目正式立项，进入需求梳理阶段

---

### 2026-03-22 20:06 — 子 Agent 监控方式

**讨论内容：**
- 子 Agent 如何监控和管理
- Jarvis 演示了 subagents 管理命令

**结论：**
- `subagents list` — 查看所有子 Agent 状态
- `subagents steer` — 给子 Agent 发消息
- `subagents kill` — 终止子 Agent
- 子 Agent 完成后汇总结果给主人

**Agent 分工（已确认）：**
- 后端 Agent → 信令服务器（Node.js + ws）
- 前端 Agent → 播放器 UI + 同步逻辑

---

### 2026-03-22 20:07 — 技术方案质疑

**讨论内容：**
- 主人质疑技术方案是否成熟、是否有调研
- Jarvis 诚实承认未做深度调研

**确认状态：**
- ✅ 成熟技术：HTML5 Video、WebRTC DataChannel、WebSocket、Node.js ws
- ⚠️ 需验证：WebRTC 直连成功率、同步延迟精度
- 🔍 待做：技术调研（主人选择先调研再开工）

---

### 2026-03-22 20:25 — 技术调研完成

**调研结论：**
- WebRTC P2P 直连成功率约 85%，其余需 TURN 中继
- 同步延迟 < 200ms 体验良好
- 类似产品（Syncplay、Kosmi）已验证可行性

**方案调整：**
- 建议从原生 WebRTC 改为 **PeerJS**（封装了 WebRTC，降低复杂度）
- PeerJS 内置 STUN/TURN，成功率更高
- MVP 信令服务器可用 PeerJS 官方公共服务器

**产出文档：**
- 新增 `TECH_RESEARCH.md` — 技术调研报告

---

### 2026-03-22 20:28 — 开发启动，Agent 分工

**会议决议：**
- 派两个子 Agent 并行执行
- 前端 Agent → 写播放器 UI（client/index.html）
- 后端 Agent → 写信令服务器（server/server.js + package.json）

**技术确认：**
- 使用 PeerJS 替代原生 WebRTC
- MVP 用 PeerJS 公共服务器，无需自建后端

---

### 2026-03-22 20:30 — Agent 开发完成

**前端 Agent 产出：**
- `client/index.html` — 单文件，包含所有功能
  - 房间管理（创建/加入房间）
  - 视频播放（HTML5 video，mp4）
  - 同步逻辑（播放/暂停/seek）
  - UI 状态显示（深色主题）

**后端 Agent 产出：**
- `server/server.js` — WebSocket 信令服务器
- `server/package.json` — 项目配置
- 房间管理、信令转发、在线状态

---

### 2026-03-22 20:33 — 添加 URL 支持

**需求：** 本地没有视频文件，希望支持 URL 播放

**功能更新：**
- 新增视频 URL 输入框
- 支持加载远程视频 URL
- 默认测试 URL：`https://www.w3schools.com/html/mov_bbb.mp4`

**文件变更：**
- `client/index.html` — 新增 videoUrlInput、loadUrlBtn

---

### 2026-03-22 20:33 — UI 自动化测试

**讨论：** 是否可以用 Playwright 做 UI 自动化测试

**决定：** 是，派 UI 测试 Agent

**测试目标：**
- 两个浏览器实例模拟用户 A/B
- 验证连接建立功能

**测试结果：**
- Playwright UI 测试因 Chromium 下载问题未能完成（exec 工具限制）
- 改用手动测试

---

### 2026-03-22 22:10 — 手动测试与问题修复

**问题 1：视频加载失败**
- 原因：CORS 限制，远程视频无法在 localhost 加载
- 解决：下载测试视频到本地，使用"选择本地视频"功能

**问题 2：加入方显示房间号混乱**
- 原因：加入方也显示自己的房间号，不直观
- 修复：创建方显示"我的房间号"，加入方显示"已连接到: xxx"

**问题 3：视频无法播放**
- 原因：video 标签缺少 controls 属性
- 修复：添加 `controls` 属性

**手动测试状态：**
- ✅ 本地视频加载正常
- ✅ 房间创建/加入功能正常
- ✅ 连接建立成功
- ⚠️ 同步功能待验证（需要两人同时在线测试）

---

### 2026-03-22 22:15 — 项目暂停

**暂停原因：** 等待公网环境测试

**当前状态：**
- MVP 代码基本完成
- 本地测试通过
- 公网 P2P 连接待验证

**待解决问题：**
- [ ] 公网环境下 P2P 连接成功率验证
- [ ] 15% 失败场景需要 TURN 中继支持
- [ ] 同步延迟实测

**后续计划：**
- 择日进行公网测试
- 根据测试结果决定是否加 TURN 支持

---

*主持人：Jarvis*
*记录：Jarvis*
