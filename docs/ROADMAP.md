# SyncPlay 项目路线图

> **这是什么？** 项目的"目标与决策中心"——要往哪走、为什么这么做、备选方案是什么。  
> **何时查阅？** 想看方向、决策讨论、备选方案对比时。  
> **关联文档：** [STATUS.md](./STATUS.md) · [REQUIREMENTS.md](./REQUIREMENTS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [README.md](./README.md) · [CHANGELOG.md](./CHANGELOG.md)  
> **最后更新：** 2026-06-07

---

## 🚦 当前迭代

**目标版本**：v1.0 — 互联网可用版  
**当前阶段**：**v0.3 Electron 打包**（2026-06-07 启动）  
**上一里程碑**：v0.3.0 TURN 中继 + 测试基础设施（已发布）  
**下一里程碑**：v0.3 Electron MVP（出 Mac .dmg / Windows .exe）

### v1.0 核心要求（2026-06-06 明确）
1. ✅ 网页版 UI
2. ✅ **公网环境**（任何网络）可播放 MP4 视频 — **实现方式不限**
3. ✅ 进度实时同步

> **"实现方式不限"** 含义：可以用 TURN 中继、第三方 WebRTC 平台（LiveKit/Daily/Agora）、纯 WebSocket 转发、或任何能打通公网的技术手段。优先选**最快跑通**的方案。

---

## 🎯 v0.3 路线（当前迭代）

**目标**:出 Mac .dmg + Windows .exe + Linux .AppImage 一键安装包,代替 `./start.command` / `start.bat`,朋友间分享更简单

### Phase A — MVP (2-3 小时)
- [ ] `desktop/` 目录 + `main.js` + `preload.js`
- [ ] `electron-builder` 配置(Mac .dmg + Windows .exe + Linux .AppImage)
- [ ] 本地出 Mac .dmg 验证流程

### Phase B — 体验优化 (半天)
- [ ] TURN 凭据管理 UI(避免手改 `config.local.js`)
- [ ] 跨网段 UX 优化(分享链接 + TURN 状态指示器)

### Phase C — 发布就绪 (1-2 天)
- [ ] 代码签名(消除 SmartScreen 警告)
- [ ] 自动更新通道
- [ ] GitHub Releases 发 .exe

### 预计产物
```
desktop/
├── package.json
├── main.js
├── preload.js
└── dist/
    ├── SyncPlay-0.3.0.dmg           # Mac
    ├── SyncPlay Setup 0.3.0.exe    # Windows
    └── SyncPlay-0.3.0.AppImage     # Linux
```

**预计体积**:~150MB(Chromium 占比 90%)  
**体验**:双击 .exe / .dmg → 出窗口 → 自动起信令 + 客户端 → 开 WebView 显示

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

## 🔑 v1.0 工作清单

### P0 — 必做（v0.3 已完成,只剩 v1.0 主体）

- [x] **打通公网连接**(TURN 已选定 + 实现 + 验证)
- [x] **客户端配远程 TURN**(`config.local.js` 抽离完成)
- [x] **跨网段实测两端同步**(v0.3 主人声明通过)
- [ ] **Electron 打包**(v0.3 当前在做)
- [ ] 租 VPS + 部署信令(Phase 2,v0.3 完成后启动)

### P1 — 应做

- [ ] 房间号 → 分享链接
- [ ] 连接状态可视化(直连 / TURN / 失败)
- [ ] 错误友好提示

### P2 — 锦上添花

- [ ] 移动端响应式
- [ ] 视频两端文件校验
- [ ] 重连后状态恢复

---

## ✅ 已确认决策

### v0.3.0 新增决策(2026-06-07)
- **打包方案**:Electron + electron-builder(跨平台统一)
- **产物格式**:`.dmg` / `NSIS .exe` / `.AppImage`
- **TURN 凭据管理**:先 `config.local.js`(gitignore),未来 Phase B 加 UI

### v0.2.0 决策(2026-06-06)

| 决策项 | 决策 | 备注 |
|--------|------|------|
| **公网方案** | ✅ **方案 A（TURN）** | 见下方对比 |
| **TURN 来源（Phase 1）** | ✅ **Metered SaaS** | 免费 500GB/月，0 成本跑通 |
| **TURN 来源（Phase 2）** | ✅ **自建 VPS 跑 coturn** | 商用可控 |
| **信令（Phase 1）** | ✅ **PeerJS 公共服务器** | 保持现状，够用 |
| **信令（Phase 2）** | ✅ **自建 VPS 部署** | 与 TURN 同机 |
| **账号系统** | ❌ v1.0 不做 |  |
| **多人房间** | ❌ 放 v2.0 |  |
| **v0.3 打包** | ✅ **Electron** | 见上方 v0.3 路线 |

### 公网方案对比（已定 A）

| 维度 | 方案 A：TURN | 方案 B：LiveKit/Daily | 方案 C：纯 WebSocket |
|------|------------|---------------------|-------------------|
| 实现量 | 🟢 小（加 ICE servers）| 🔴 大（替换 SDK）| 🟡 中（改用 WS）|
| 服务器成本 | 💰 $0-5/月 | 💰💰 $0-50/月 | 💰 极低 |
| 客户端改动 | 🟢 小 | 🔴 大 | 🟡 中 |
| 数据隐私 | 🟢 视频不经服务器 | 🟡 看配置 | 🟡 指令经服务器 |
| 维护成本 | 🟢 低 | 🟢 外包 | 🟢 低 |
| **结论** | ⭐ **已选** | 备选 | 备选 |

**为什么选 TURN**：
- 改动最小（保护 v0.2 重构成果）
- 隐私最好（视频永远不上服务器）
- syncplay 只同步指令（几十字节 JSON），TURN 带宽压力极小

---

## 🛣️ 两阶段实施路径

### Phase 1：SaaS 跑通（v1.0 MVP）—— **当前阶段**

**目标**：验证"公网两端能同步"的完整流程，0 VPS 成本

**架构**：
```
A 浏览器 ──WSS──► PeerJS 公共信令 ──► B 浏览器
       │                                    │
       └────► Metered TURN（穿透失败时）◄────┘
```

**任务清单**：
- [ ] 注册 Metered 拿 TURN 凭据（用户名/密码/URL）
- [ ] 改 `src/client/app.js` 加 ICE_SERVERS 配置
- [ ] 跨网段实测两端同步

**预计耗时**：30 分钟  
**商用就绪**：❌ 依赖第三方 SaaS

---

### Phase 2：自建 VPS（v1.0 正式版）—— Phase 1 通过后启动

**目标**：把信令和 TURN 都收到自己手里，商用可控

**架构**：
```
A 浏览器 ──HTTPS─► 你的 VPS
                    ├── 信令服务器（Node.js + PeerJS Server）
                    └── TURN 中继（coturn）
                          │
B 浏览器 ───────────────┘
```

**任务清单**：
- [ ] 租 VPS（Vultr / DigitalOcean / 阿里云 / 腾讯云）
- [ ] 部署信令服务器（Docker compose）
- [ ] 部署 coturn（Docker compose）
- [ ] 配 HTTPS 证书（Let's Encrypt）
- [ ] 改 `app.js` 的 PEER_HOST/PEER_PORT 指到 VPS
- [ ] 跨网段实测

**预计耗时**：半天  
**商用就绪**：✅ 一台 $5 VPS 可撑几百对用户

---

## 📅 后续版本预览

| 版本 | 主题 | 关键特性 | 状态 |
|------|------|---------|------|
| **v0.3.x** | **Electron 打包** | **Mac .dmg + Win .exe + Linux .AppImage,双击即用** | **🚧 当前** |
| v0.4.x | 移动端 | 响应式适配、手机浏览器可用 | 计划中 |
| v0.5.x | 多人房间 | 3 人以上同步 | 计划中 |
| **v1.0** | **互联网可用** | **Phase 1 (SaaS TURN) + Phase 2 (自建 VPS)** | 目标 |
| v2.0 | 流媒体 | 一端本地、一端远程拉流 | 长期 |
| v3.0 | 原生 App | Tauri / React Native 替换 Electron | 长期 |

---

## 🛣️ v1.0 完成判定（Definition of Done）

v1.0 视为完成当且仅当：

- [ ] 两位测试者分别在**不同网络**（如家庭宽带 + 移动 4G）能成功建立连接
- [ ] 视频播放/暂停/seek 同步延迟 < 500ms
- [ ] 对称 NAT / 严格网络环境下也能连上
- [ ] 断线后 30 秒内能自动重连
- [ ] **Phase 2 完成后**：公网地址 + HTTPS 部署完毕
- [ ] README 有清晰的部署说明
- [ ] **主人实际跨网测试通过** ⭐

---

## 📝 进度记录

| 日期 | 版本 | 事件 |
|------|------|------|
| 2026-03-22 | v0.1.0 | MVP 首发 |
| 2026-06-06 | v0.2.0 | 重构完成(同步 bug 修复、漂移校准、重连) |
| 2026-06-06 | 规划 | 决定 v1.0 目标 |
| 2026-06-06 18:00 | 规划 | 加 v1.0 硬性要求 R1-R5 |
| 2026-06-06 18:30 | 规划 | 选定方案 A(TURN) |
| 2026-06-06 18:35 | 规划 | 文档统一头部 + 新增 docs/README.md |
| 2026-06-06 18:41 | 规划 | **两阶段路径确定:Phase 1 SaaS → Phase 2 自建** |
| 2026-06-07 | **v0.3.0** | **TURN 中继 + 测试基础设施 + 启动脚本加固 + Electron 启动** |
| 2026-06-07 | v0.3 验证 | 4 个 relay 候选成功;强制 relay 模式验证同步走 TURN |
| 2026-06-07 | v0.3 声明 | 跨网段实测主人声明通过(Phase 1 DoD 满足) |
| TBD | v0.3 Electron | 出 .dmg + .exe + .AppImage |
| TBD | v1.0 Phase 2 | 自建 VPS 部署 |
| TBD | v1.0 | 商用就绪正式版 |

---

*制定：Jarvis & 主人*
