# SyncPlay 架构详解

> **这是什么？** 软件架构的"地面真相"（ground truth）—— 描述我们**正在实现**的系统。  
> 决策讨论/方案对比 → [ROADMAP.md](./ROADMAP.md)  
> 最后更新：2026-06-06（v0.2 + v1.0 架构）

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

## 部署架构（v1.0 目标态）

```
                  ┌─────────────────┐
                  │   浏览器 (A)    │
                  │   localhost:8080│
                  └────────┬────────┘
                           │ HTTPS
                           ▼
                  ┌─────────────────┐
                  │  Cloudflare CDN │
                  │  (静态资源托管)  │
                  └────────┬────────┘
                           │
                           ▼
┌─────────────────┐    ┌─────────────────┐
│   浏览器 (B)    │◄──►│  公网信令服务器   │
│                 │    │  (VPS/Cloudflare)│
└─────────────────┘    └────────┬────────┘
                                │ 必要时
                                ▼
                       ┌─────────────────┐
                       │  TURN 中继服务器  │
                       │  (Metered 自建)  │
                       └─────────────────┘
```

---

*作者：Jarvis*
*最后更新：2026-06-06（v0.2 重构 + v1.0 架构）*
