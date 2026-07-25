# SyncPlay

> 异地同步看片神器 — 两人异地同时播放同一视频，进度实时同步

**当前版本:** v0.7.0 (多视频格式支持 + 视频播放硬件解码 — 9 格式: mp4/webm/m3u8/mkv/avi/flv/mov/wmv)
**下一版本:** v0.7.x (TURN 凭据管理 UI + 跨网段 UX + 移动端响应式 — 详见 ROADMAP)
**最终目标:** v1.0 (Mac/Windows/Linux 全平台安装包 + 公网可用)

---

## 👋 给新 session / 新 agent

如果你第一次接触这个项目，按顺序看：

1. **[docs/README.md](./docs/README.md)** — 文档索引（哪个文档看什么）
2. **[docs/STATUS.md](./docs/STATUS.md)** — 当前进度、下一步
3. **[docs/ROADMAP.md](./docs/ROADMAP.md)** — 目标 + 决策
4. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — 架构细节

---

## 📦 安装包下载

**Mac 用户**：双击 `desktop/dist/SyncPlay-0.7.0-arm64.dmg` → 拖入 `/Applications`

**Windows 用户**（v0.6 起）：双击 `desktop/dist/SyncPlay Setup 0.7.0.exe` → 完成安装

**Linux 用户**（v0.7 起）：从 [GitHub Releases](https://github.com/despicablemme/SyncPlayer/releases) 下 `SyncPlay-0.7.0.AppImage` → `chmod +x` 后双击

```bash
# 开发模式（需要 Node.js）
cd ~/CodeProjects/syncplay
./start.sh
```

---

## 🎬 支持的视频格式 (v0.7 新增)

v0.7 起, SyncPlay 支持 9 种主流视频容器, 按 URL 后缀分发到 3 条播放路径 (原生 `<video>` / hls.js / ffmpeg.wasm → MSE):

| 容器 | codec 示例 | 播放路径 | 硬解 |
|------|-----------|---------|------|
| **mp4** | H.264 (avc1) / H.265 (hvc1) / AV1 | 原生 `<video>` (`video.src = src`) | ✅ macOS VideoToolbox / Win DXVA / Linux VAAPI (HEVC 8K/120fps on M-series) |
| **webm** | VP8 / VP9 / AV1 | 原生 `<video>` | ✅ macOS / Win / Linux GPU 硬解 (AV1: M1+ / RTX 30+ / RX 6000+) |
| **m3u8** (HLS 直播/点播) | H.264 / H.265 / AAC | **hls.js → MSE → `<video>`** | ✅ hls.js 内置硬解 (走 MSE pipeline) |
| **mkv** (Matroska) | H.264 / H.265 / VP9 | **ffmpeg.wasm → fMP4 → `MsePlayer` → MSE** | ✅ macOS VideoToolbox (avc1+hvc1 通过 MSE pipeline 走硬解) |
| **avi** | Xvid / DivX / H.264 | ffmpeg.wasm → fMP4 → MSE | 软解 (codec 简单, 主进程 CPU < 20%) |
| **flv** | H.264 / AAC | ffmpeg.wasm → fMP4 → MSE | 软解 |
| **mov** (QuickTime) | H.264 / ProRes | ffmpeg.wasm → fMP4 → MSE | ✅ macOS 原生硬解 (走 MSE) |
| **wmv** (Windows Media) | WMV2 / WMA | ffmpeg.wasm → fMP4 → MSE | 软解 |

**决策树** (per `desktop/src/client/app.js` `loadVideo()`):

```
url *.m3u8           → HlsPlayer    → hls.js   → MSE → <video>
url *.mkv/avi/flv
    /mov/wmv         → transmuxToFmp4 (ffmpeg.wasm) → fMP4 → MsePlayer → MSE → <video>
url *.mp4 / *.webm
    / blob           → video.src = src (Chrome 原生 + 硬解)
```

**已知限制 (v0.7 MVP)**:

- 🎬 **字幕**: v0.7 MVP **暂不支持** (v0.7.x 加 WebVTT 客户端轨道)
- 📦 **大文件**: 限 **2 GB** (主人 sample 太空旅客.mkv 1.64 GB 在内, v0.7.x 加分段 / chunked)
- 🪟 **软编 fallback**: v0.7 MVP **暂不支持** (Xvid / DivX 等老 codec, 提示用 VLC)
- 🔄 **格式分发**: 按 URL 后缀判断 (服务器上 URL 必须带正确后缀, 否则走默认 mp4 路径)

**快速验证命令**:

```bash
# 1. 启动 dev build
cd desktop && npm run dev

# 2. 在浏览器打开 http://localhost:8080/client
# 3. 选本地 mp4 / webm  → 原生 <video>
#    粘贴 https://...m3u8 URL → hls.js
#    粘贴 https://...mkv URL  → ffmpeg.wasm (10-30s 转封装) → fMP4
# 4. DevTools console: window.open('chrome://gpu')
#    → 看 "Video Acceleration Information" 段 → 应该有 "Decode hevc main" / "Decode av1 main"
```

详见 [docs/CHANGELOG.md](./docs/CHANGELOG.md) v0.7.0 段 + `desktop/test/fixtures/sample-urls.md` (7 个公网测试样本)

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
- **Windows / Linux 打包**：需在对应平台运行构建命令

## 📦 桌面打包状态

| 平台 | 产物 | 状态 |
|------|------|------|
| Mac | `desktop/dist/SyncPlay-0.7.0-arm64.dmg` | ⏳ v0.7.0 阶段 C debug build 后实测 |
| Windows | `desktop/dist/SyncPlay Setup 0.7.0.exe` | ⏳ v0.7.0 阶段 D release 后产物 |
| Linux | `desktop/dist/SyncPlay-0.7.0.AppImage` | ⏳ v0.7.0 阶段 D release 后产物 |

双击即用，不依赖 Python / Node / Homebrew。

---

*项目维护：Jarvis & 主人*
*最后更新：2026-07-25（v0.7.0 release 准备 — 升 version + 临时 docs）*
