# SyncPlay

> 异地同步看片神器 — 两人异地同时播放同一视频，进度实时同步

---

## ✨ 特性

- 🎬 视频本地播放（**不上传**任何视频文件）
- ⚡ WebRTC P2P 直连，低延迟
- 🔄 实时漂移校准，长时间播放不偏移
- 🔁 断线自动重连
- 🎯 简单的房间号机制
- 📊 实时显示延迟和漂移

---

## 🚀 快速开始

### 客户端（必选）

```bash
cd client
python3 -m http.server 8080
```

浏览器打开：http://localhost:8080

> **重要**：两端用户都需要打开这个页面，各自选择**同一个视频文件**或**同一个 URL**。

### 信令服务器（可选）

默认配置走 PeerJS 公共服务器。如果想用**自建服务器**：

```bash
cd server
npm install
npm start
```

然后修改 `client/app.js` 顶部 CONFIG：

```js
PEER_HOST: 'localhost',
PEER_PORT: 9000,
PEER_SECURE: false,
```

---

## 🎯 使用流程

1. **A 创建房间** → 获得一个房间号（如 `room-abc123`）
2. **B 输入房间号加入** → 建立 P2P 连接
3. 双方**加载同一个视频文件**（本地或 URL）
4. 任一方点击播放/暂停/拖动进度条，另一方自动同步

---

## 📁 项目结构（v0.2 重构后）

```
syncplay/
├── README.md
├── REQUIREMENTS.md
├── TECH_RESEARCH.md
├── MEETINGS.md
├── STATUS.md          ← 项目状态 + v1 问题清单
├── client/
│   ├── index.html     ← 主页面
│   ├── app.js         ← 同步引擎 + 连接管理（核心）
│   ├── style.css      ← 样式
│   └── test-video.mp4
├── server/
│   ├── server.js      ← PeerJS 私有信令服务器
│   └── package.json
└── test/
    └── test.js
```

---

## 🔧 同步协议

通过 WebRTC DataChannel 传递 JSON 消息：

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

**屏蔽窗口**：收到远端指令后 200ms 内忽略本地视频事件，避免回环。

**漂移校准**：每 10 秒检查一次，偏移 > 0.5s 自动校正。

**断线重连**：最多 5 次，间隔 2s/4s/6s/8s/10s。

---

## ⚠️ 已知限制

- **NAT 穿透**：约 85% 网络可 P2P 直连，剩余需 TURN 中继（未实现）
- **视频文件**：两端必须选**同一个**文件（时长需一致）
- **延迟目标**：同城 < 50ms，跨省 < 200ms
- **测试**：仅本地手动测试，自动化测试待补

---

## 🛣️ 路线图

- [ ] TURN 中继支持
- [ ] 移动端适配
- [ ] 流媒体模式（一端本地，一端远程）
- [ ] 多房间支持
- [ ] 同步精度显示面板

---

*项目维护：Jarvis & 主人*
*最后更新：2026-06-06（v0.2.0）*
*详细变更：[CHANGELOG.md](./CHANGELOG.md)*
