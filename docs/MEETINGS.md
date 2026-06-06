# SyncPlay 项目会议纪要

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
