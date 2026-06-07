# SyncPlay 架构详解

> **这是什么？** 软件架构的"地面真相"——我们**正在实现**的系统长什么样。  
> **何时查阅？** 实现新功能、改架构、debug 架构问题时。  
> **关联文档：** [REQUIREMENTS.md](./REQUIREMENTS.md) · [ROADMAP.md](./ROADMAP.md) · [TECH_RESEARCH.md](./TECH_RESEARCH.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-06

---

## 🎯 系统目标

两人异地同时播放同一视频，进度实时同步。视频文件**永远不上传**，只同步播放状态。

**v1.0 关键能力**：
- 公网环境（任意网络）可同步
- 一键启动，双击即用
- 房间号即认证，无须注册

---

## 总体架构图

```
┌─────────────────┐                              ┌─────────────────┐
│   用户 A         │                              │   用户 B         │
│  (浏览器)        │                              │  (浏览器)        │
│                 │                              │                 │
│  本地视频文件    │                              │  本地视频文件    │
│       ↕         │                              │       ↕         │
│  HTML5 <video>  │                              │  HTML5 <video>  │
│       ↕         │                              │       ↕         │
│  SyncEngine     │◄────► WebRTC DataChannel ◄──►│  SyncEngine     │
│  ConnectionMgr  │  (play/pause/seek/...)        │  ConnectionMgr  │
│       ↕         │                              │       ↕         │
│  PeerJS Client  │                              │  PeerJS Client  │
└────────┬────────┘                              └────────┬────────┘
         │                                               │
         │  1. 信令交换（建立 P2P 连接）                 │
         │  2. 必要时走 TURN 中继转发                    │
         │                                               │
         └────────────────┬──────────────────────────────┘
                          ▼
                ┌──────────────────────┐
                │  公网信令服务器        │
                │  （自建 / Cloudflare） │
                └──────────────────────┘
                          │
                          │  P2P 失败时 ↓
                          ▼
                ┌──────────────────────┐
                │  TURN 中继服务器       │
                │  （Metered / coturn） │
                └──────────────────────┘
```

---

## 组件分工

| 组件 | 位置 | 职责 |
|------|------|------|
| **SyncEngine** | `src/shared/sync-engine.js` | 同步协议：play/pause/seek/heartbeat/drift |
| **ConnectionManager** | `src/client/app.js` | 房间管理 + WebRTC 连接生命周期 |
| **HTML5 Video** | `src/client/index.html` | 视频播放（本地文件，不上传）|
| **PeerJS Client** | `src/client/app.js` | WebRTC 封装，处理 ICE/STUN/TURN |
| **PeerJS Server** | `src/server/server.js` | 信令交换（仅建立连接）|
| **TURN Server** | 第三方 / 自建 | 15% NAT 穿透失败时的中继 |

---

## 关键流程

### 1. 启动（双击 start.sh / start.bat）
```
start.sh 启动：
  1. 启动信令服务器 (server/server.js, 端口 9000)
  2. 启动 Web 静态服务器 (python http.server, 端口 8080)
  3. 浏览器自动打开 http://localhost:8080
```

### 2. 创建/加入房间
```
A 点击"创建房间"：
  1. ConnectionManager.init(isInitiator=true)
  2. new Peer(randomRoomId)  // PeerJS 创建本地 Peer
  3. peer.on('connection', 接受 B 的入站连接)

B 输入房间号 + 点击"加入"：
  1. ConnectionManager.init(isInitiator=false, target=roomId)
  2. new Peer(randomMyId)  // PeerJS 创建本地 Peer
  3. peer.connect(targetRoomId)  // 向 A 发起连接
```

### 3. P2P 连接建立（通过信令）
```
A                            Server (信令)              B
│                                  │                    │
│◄──────── peer.on('connection')  │                    │
│  接受 conn                       │                    │
│                                  │◄─── conn 发起 ───│
│  conn.on('open')                 │                    │
│◄─────────────────────────────────►                    │
│                                  │                    │
│   DataChannel 已通，可双向发数据                       │
```

### 4. 同步播放（A 拖动进度条）
```
A 本地:
  video.seeked event 触发
  → SyncEngine.maybeSend('seek')
  → guardUntil 检查（屏蔽期外）
  → remoteConn.send({type:'seek', position: 45.0, t: ...})

B 远端:
  conn.on('data') 收到
  → SyncEngine.handle({type:'seek', ...})
  → 设置 guardUntil = now + 200ms
  → 偏差 > 0.3s 时设 video.currentTime = 45.0
```

### 5. TURN 中继（必要时）
```
P2P 直连失败（对称 NAT 等）：
  ICE 收集阶段找到 TURN 候选
  → DataChannel 走 TURN 中继
  → A ↔ TURN Server ↔ B
  → 增加 ~50-100ms 延迟，但能连上
```

---

## 同步协议消息

通过 WebRTC DataChannel 传 JSON：

| type | 方向 | 含义 |
|------|------|------|
| `play` | 双向 | 播放，含 position 和时间戳 |
| `pause` | 双向 | 暂停 |
| `seek` | 双向 | 跳转进度 |
| `heartbeat` | 双向 | 心跳（测量 RTT） |
| `heartbeat_pong` | 双向 | 心跳响应 |
| `drift_check` | 双向 | 漂移检查请求 |
| `drift_response` | 双向 | 漂移检查响应 |
| `file_info` | 双向 | 视频时长（用于校验） |

---

## 依赖清单 ⭐ 权威记录

> **这是什么**：项目所有依赖的单一来源（single source of truth）。
> **何时更新**：任何 `package.json` / 外部服务 / 运行环境的变更，**必须**同步更新此章节。
> **位置选择原因**：ARCHITECTURE.md 是项目的"实现规格书"，依赖是实现的一部分，不单独立文档可避免双处维护。

### 1. 运行环境（用户机器上必须装）

| 依赖 | 版本 | 必需性 | Windows | Mac | Linux | 用途 |
|------|------|--------|---------|-----|-------|------|
| **Node.js** | >=16 | 运行 server | ✅ | ✅ | ✅ | 信令服务器运行时 |
| **Python 3** | >=3.6 | 静态文件服务 | ✅ (叫 `python`) | ✅ (叫 `python3`) | ✅ (叫 `python3`) | 客户端静态服务 |
| **Web 浏览器** | 现代版 | 客户端 | Edge/Chrome/FF | Safari/Chrome/FF | Chrome/FF | 跑 WebRTC + PeerJS |
| **网络** | 任意 | TURN | ✅ | ✅ | ✅ | 连接 Metered 中继 |

**Windows 特别注意**：
- Python 命令名是 `python`（不是 `python3`）—— `start.bat` 已处理
- Windows Defender 首次可能拦 Node 联网 —— 需要"允许"
- 配置 TURN 凭据的 `config.local.js` **不入库**，Windows 上要重新创建

### 2. 服务端 npm 依赖

| 包 | 版本 | 必需 | 原生绑定 | 平台支持 | 用途 |
|----|------|------|---------|---------|------|
| `peer` | ^0.6.1 | ✅ | ❌ 纯 JS | 全平台 | PeerJS 信令服务器 |
| `ws` | ^7.2.3 | 间接 | ❌ 纯 JS 模式运行 | 全平台 | WebSocket（peer 依赖） |
| `express` | ^4.17.1 | 间接 | ❌ 纯 JS | 全平台 | HTTP 服务器（peer 依赖） |
| `cors` | ^2.8.5 | 间接 | ❌ 纯 JS | 全平台 | 跨域（peer 依赖） |
| `body-parser` | ^1.19.0 | 间接 | ❌ 纯 JS | 全平台 | 请求体解析（peer 依赖） |
| `uuid` | ^3.4.0 | 间接 | ❌ 纯 JS | 全平台 | ID 生成（peer 依赖） |
| `yargs` | ^15.3.1 | 间接 | ❌ 纯 JS | 全平台 | CLI 解析（peer 依赖） |

**关键特性**：**零原生绑定**。`peer` 及其所有依赖都是纯 JS，`ws` 运行在纯 JS 模式（无 `build/` 目录），所以理论上任何能跑 Node 的平台都能跑（含 Windows）。

### 3. 客户端运行时依赖

| 资源 | 来源 | 必需性 | 加载时机 |
|------|------|--------|---------|
| **peerjs** | `https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js` | ✅ 必需 | 浏览器首次加载 `index.html` |
| **Metered TURN** | `global.relay.metered.ca` | ✅ 必需 | WebRTC ICE 协商时 |
| **PeerJS 公共服务器** | `0.peerjs.com:443` | Phase 1 默认 | 信令通道（Phase 2 改自建） |

**客户端代码本身** = 纯 Web API（`RTCPeerConnection` / `window.crypto` / `document.*`），**零外部 JS 框架**，**零构建步骤**。

### 4. 开发与测试依赖（仅开发者机器）

| 包 | 版本 | 必需性 | 平台 | 用途 |
|----|------|--------|------|------|
| `playwright` | ^1.58.2 | devDep | 全平台 | e2e 测试 + ICE 冒烟测试 |

**playwright 自带 Chromium**（已缓存于 `~/Library/Caches/ms-playwright/`），无需系统装 Chrome。

### 5. 配置文件（不入库）

| 文件 | 状态 | 内容 |
|------|------|------|
| `src/client/config.local.js` | 🚫 `.gitignore` 排除 | Metered TURN 真凭据 |
| `src/client/config.template.js` | ✅ 入库 | 占位符示例 + 加载顺序说明 |
| `start.sh` / `start.command` | ✅ 入库 | Mac/Linux 一键启动 |
| `start.bat` / `stop.bat` | ✅ 入库 | Windows 一键启停 |
| `stop.sh` | ✅ 入库 | Mac/Linux 一键关闭 |

### 6. 跨平台支持矩阵

| 组件 | Mac | Windows | Linux | 状态 |
|------|-----|---------|-------|------|
| 信令 server (`src/server/`) | ✅ | ✅ | ✅ | 纯 JS,无障碍 |
| 客户端 (`src/client/`) | ✅ | ✅ | ✅ | 纯 Web,无障碍 |
| 静态服务 (`python -m http.server`) | ✅ | ✅ | ✅ | 标准工具 |
| TURN 凭据加载 | ✅ | ✅ | ✅ | config.local.js 模式 |
| 一键启动脚本 | `start.command` | `start.bat` | `start.sh` | 三平台齐 |
| 关闭脚本 | `stop.sh` | `stop.bat` | `stop.sh` | 三平台齐 |
| Playwright 测试 | ✅ | ✅ | ✅ | 跨平台 |

**结论：项目原生支持 Mac / Windows / Linux 三平台，无需任何代码修改。**

### 7. 如何更新依赖（维护流程）

**添加新依赖**：
1. 先确认是否真的需要（参考 R1 一键启动原则）
2. 评估是否引入原生绑定（避免）
3. `npm install <pkg>` (server 端) 或 `npm install --save-dev <pkg>` (根目录)
4. **同步更新本章节**（添加一行 + 更新"用途"说明）
5. 提交 commit,确保 package-lock.json 一起入库

**升级依赖**：
1. 跑 `npm outdated` 看现状
2. 评估 breaking change（看 changelog）
3. 升级后**必须重跑 `npm run test`** + `npm run test:ice` + `npm run test:e2e`
4. 同步更新本章节的版本号
5. 提交

**移除依赖**：
1. `npm uninstall <pkg>`
2. 检查 `package-lock.json` 是否清理
3. 同步更新本章节
4. 提交

### 8. 依赖变更历史

| 日期 | 变更 | commit | 更新人 |
|------|------|--------|--------|
| 2026-06-07 | 新增本章节，建立权威记录 | (本次) | Jarvis |
| 2026-03-22 | v0.1.0 首发 | - | 主人 |
| 2026-06-06 | v0.2.0 重构完成 | `19e524f` | 主人 |

---

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 视频传输 | **本地文件，不上传** | 隐私、带宽 |
| 同步通道 | **WebRTC DataChannel** | 低延迟、P2P |
| NAT 穿透 | **TURN 中继** | 解决 15% 失败场景 |
| 信令协议 | **PeerJS Server** | 简化开发、标准化 |
| 前端框架 | **纯 HTML + JS** | 轻量、零构建 |
| 同步引擎 | **独立模块** | 可测试、跨端复用 |

> 决策背景与备选方案讨论 → [ROADMAP.md](./ROADMAP.md)

---

## 性能目标

| 指标 | 目标 | 当前实现 |
|------|------|----------|
| 同步延迟 | < 500ms | 漂移校准每 10s 一次 |
| 心跳间隔 | 5s | RTT 测量 |
| 漂移阈值 | 0.5s | 超出自动校正 |
| 屏蔽窗口 | 200ms | 收到远端指令后忽略本地事件 |
| 重连退避 | 2s/4s/6s/8s/10s | 指数退避，最多 5 次 |

---

## 部署架构（v1.0 两阶段）

### Phase 1：SaaS TURN（v1.0 MVP，当前阶段）

```
┌─────────────────┐                              ┌─────────────────┐
│   浏览器 (A)    │                              │   浏览器 (B)    │
└────────┬────────┘                              └────────┬────────┘
         │ WSS                                            │ WSS
         ▼                                                ▼
┌────────────────────────────────────────────────────────────────┐
│  PeerJS 公共信令服务器（0.peerjs.com）                          │
└────────────────────────────────────────────────────────────────┘
         │                                                │
         │ P2P 直连失败时 ↓                                │
         ▼                                                ▼
┌────────────────────────────────────────────────────────────────┐
│  Metered TURN 中继（global.relay.metered.ca）                  │
└────────────────────────────────────────────────────────────────┘
```

**特点**：0 VPS 成本，~15 分钟搞定，但依赖第三方 SaaS。

---

### Phase 2：自建 VPS（v1.0 正式版）

```
┌─────────────────┐                              ┌─────────────────┐
│   浏览器 (A)    │                              │   浏览器 (B)    │
└────────┬────────┘                              └────────┬────────┘
         │ HTTPS/WSS                                       │ HTTPS/WSS
         ▼                                                ▼
┌────────────────────────────────────────────────────────────────┐
│                       你的 VPS                                │
│  ┌──────────────────────┐    ┌──────────────────────┐         │
│  │  信令服务器            │    │  TURN 中继            │         │
│  │  (Node.js + PeerJS)   │    │  (coturn)            │         │
│  │  端口 9000 (WSS)      │    │  端口 3478 (UDP/TCP) │         │
│  └──────────────────────┘    └──────────────────────┘         │
└────────────────────────────────────────────────────────────────┘
```

**特点**：商用可控，一台 $5 VPS 可撑几百对用户。

---

*作者：Jarvis*
*最后更新：2026-06-07（新增"依赖清单"章节，作为权威记录）*
