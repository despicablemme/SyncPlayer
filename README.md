# SyncPlay

> 异地同步看片神器 — 两人异地同时播放同一视频，进度实时同步

**当前版本:** v0.4.0 (Electron 桌面打包 — Mac .dmg 双击即用)
**上一版本:** v0.3.0 (TURN 中继 + 测试基础设施)

---

## 👋 给新 session / 新 agent

如果你第一次接触这个项目，按顺序看：

1. **[docs/README.md](./docs/README.md)** — 文档索引（哪个文档看什么）
2. **[docs/STATUS.md](./docs/STATUS.md)** — 当前进度、下一步
3. **[docs/ROADMAP.md](./docs/ROADMAP.md)** — 目标 + 决策
4. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — 架构细节

---

## 📦 v0.4 安装包下载

**Mac 用户**：双击 `desktop/dist/SyncPlay-0.4.0-arm64.dmg` → 拖入 `/Applications`

```bash
# 开发模式（需要 Node.js）
cd ~/CodeProjects/syncplay
./start.sh

# 生产模式（不需要任何依赖！）
open desktop/dist/SyncPlay-0.4.0-arm64.dmg
```

**Windows / Linux**：运行 `npm run dist:win` 或 `npm run dist:linux` 生成安装包。

---

## 🚀 快速开始（30 秒上手）

### macOS / Linux 用户

```bash
cd ~/CodeProjects/syncplay
./start.sh
# 或双击 start.command
```

### Windows 用户

```cmd
cd path\to\syncplay
start.bat
# 或双击 start.bat
```

**它会：**
1. ✅ 自动检查 Node/Python 环境
2. ✅ 首次启动自动装依赖
3. ✅ 启动信令服务器（端口 9000）
4. ✅ 启动 Web 客户端（端口 8080）
5. ✅ 自动打开浏览器到 http://localhost:8080

**关闭：**
- macOS / Linux：`.stop.sh` 或 Ctrl+C
- Windows：双击 `stop.bat`

### 接下来

1. 浏览器中：点"选择本地视频" → 选 `src/client/test-video.mp4`
2. 点"创建房间" → 复制房间号
3. 开**隐身窗口**或让朋友的设备访问同一网址
4. 加载同一个视频 → 输入房间号 → 加入
5. 看到"已连接"就能用：play/pause/seek 都会同步

---

## ✨ 特性

- 🎬 视频本地播放（**不上传**任何视频文件）
- ⚡ WebRTC P2P 直连，低延迟
- 🔄 实时漂移校准，长时间播放不偏移
- 🔁 断线自动重连
- 🎯 简单的房间号机制
- 📊 实时显示延迟和漂移
- 🧪 28 个单元测试覆盖核心同步逻辑

---

## 🧪 运行测试

```bash
npm test              # 单元测试 (28 个,核心同步逻辑)
npm run test:e2e      # E2E 测试 (需要本地 server)
npm run test:ice      # TURN 凭据冒烟测试 (10s,验证 4 个 relay 候选)
npm run test:room     # 创建房间回归测试 (防 HTTP server 根目录 bug 复发)
```

需要诊断环境问题?`./diagnose.sh` (Mac/Linux) 或 `diagnose.bat` (Windows)

---

## 📁 项目结构

```
syncplay/
├── start.sh / start.command / stop.sh    # 🚀 一键启动（macOS/Linux）
├── start.bat / stop.bat                  # 🚀 一键启动（Windows）
├── diagnose.sh / diagnose.bat            # 🔍 一键环境诊断
├── README.md
├── LICENSE
├── package.json
│
├── docs/                                  # 📚 文档
│   ├── ARCHITECTURE.md                    # 架构 + 依赖清单(权威)
│   ├── CHANGELOG.md                       # 版本变更记录
│   ├── MEETINGS.md                        # 会议纪要
│   ├── REQUIREMENTS.md                    # 需求 R0-R5
│   ├── ROADMAP.md                         # 路线图(v0.3 → v1.0)
│   ├── STATUS.md                          # 当前进度
│   ├── TECH_RESEARCH.md                   # 技术选型
│   └── README.md                          # 文档索引
│
├── src/                                   # 💻 源代码
│   ├── shared/sync-engine.js              # 同步引擎(浏览器+Node 通用)
│   ├── client/                            # 客户端
│   │   ├── index.html                     # 主页 (http://localhost:8080/client/)
│   │   ├── app.js                         # UI 逻辑 + 连接管理 + ICE config
│   │   ├── config.template.js             # TURN 配置模板
│   │   ├── config.local.js                # TURN 真凭据(本地,gitignore)
│   │   ├── style.css
│   │   └── test-video.mp4
│   └── server/                            # PeerJS 信令服务器
│       ├── server.js
│       └── package.json
│
└── test/                                  # 🧪 测试
    ├── unit/sync-engine.test.js           # 28 个单元测试
    ├── e2e/test.js                        # Playwright E2E
    └── network/                           # 🌐 网络/ICE 测试
        ├── ice-smoke.js                   # TURN 凭据冒烟
        ├── regression-create-room.js      # 创建房间回归
        └── README.md
```

---

## ⚙️ 高级配置

### 用自己的信令服务器

修改 `src/client/app.js` 顶部 `CONFIG`：

```js
PEER_HOST: 'your-server.com',
PEER_PORT: 443,
PEER_SECURE: true,
```

### 部署到公网

详见 [docs/ROADMAP.md](./docs/ROADMAP.md) 的 v1.0 目标。

---

## 🔧 同步协议

| type | 含义 |
|------|------|
| `play` / `pause` / `seek` | 同步播放状态 |
| `heartbeat` / `heartbeat_pong` | 心跳测延迟 |
| `drift_check` / `drift_response` | 漂移校准 |
| `file_info` | 视频时长校验 |

详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 📚 文档

- 🎯 目标与路线图 → [docs/ROADMAP.md](./docs/ROADMAP.md)
- 🚦 当前状态与下一步 → [docs/STATUS.md](./docs/STATUS.md)
- 📜 历史版本记录 → [docs/CHANGELOG.md](./docs/CHANGELOG.md)
- 📖 需求文档 → [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- 🏗️ 架构说明 → [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 🔬 技术调研 → [docs/TECH_RESEARCH.md](./docs/TECH_RESEARCH.md)
- 📝 会议纪要 → [docs/MEETINGS.md](./docs/MEETINGS.md)

---

## ⚠️ 已知限制

- **NAT 穿透**：约 85% 网络可 P2P 直连，剩余需 TURN 中继(v0.3 已实现，凭据抽离到 config.local.js)
- **视频文件**：两端必须选**同一个**文件
- **测试**：E2E 测试在 headless Chrome 中 WebRTC 受限

## 📦 v0.4 桌面打包

**已发布** — 详见 [ROADMAP.md](./docs/ROADMAP.md)

产物:
- Mac: `desktop/dist/SyncPlay-0.4.0-arm64.dmg` ✅
- Windows: `desktop/dist/SyncPlay Setup 0.4.0.exe`（需在 Windows 环境构建）
- Linux: `desktop/dist/SyncPlay-0.4.0.AppImage`（需在 Linux 环境构建）

双击即用，不依赖 Python / Node / Homebrew。

---

*项目维护：Jarvis & 主人*
*最后更新：2026-06-07（v0.4.0）*
