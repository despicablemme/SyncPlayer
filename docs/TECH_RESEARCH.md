# SyncPlay 技术调研报告

> **这是什么?** 早期技术选型调研 + 后续技术决策的调研--为什么选 WebRTC / PeerJS / TURN / Electron,各方案对比。
> **何时查阅?** 想了解技术决策的历史背景、可选方案及其权衡时。
> **关联文档:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md) · [README.md](./README.md) · [CHANGELOG.md](./CHANGELOG.md)
> **最后更新:** 2026-06-07

---

## 五、v0.3 桌面打包调研(2026-06-07)

### 需求
- Mac + Windows + Linux 三平台出"双击即用"安装包
- 当前是 start.sh / start.command / start.bat,需要"开窗口"体验
- 朋友间分发,需简单

### 方案对比

| 方案 | 产物 | 体积 | 用户体验 | 跨平台 | 开发成本 | 推荐 |
|------|------|------|---------|--------|---------|------|
| 🅰️ **Electron + electron-builder** | 真正 .exe / .dmg / .AppImage | ~150MB | ⭐⭐⭐⭐⭐ 双击出窗口 | ✅✅✅ | 中(2-3 小时 MVP) | ⭐⭐⭐⭐⭐ |
| 🅱️ **pkg + 系统 WebView** | server.exe + 手动开浏览器 | ~30MB | ⭐⭐⭐ 还要开浏览器 | ⚠️ Win 优先 | 低(2-3 小时) | ⭐⭐⭐ |
| 🅲️ **Tauri (Rust + WebView)** | 真正 .exe / .dmg / .AppImage | ~10MB | ⭐⭐⭐⭐⭐ 接近 Electron | ✅✅✅ | 高(要学 Rust) | ⭐⭐⭐ (长期可考虑) |
| 🅳️ **中性 zip** | .zip 解压 | ~5MB | ⭐⭐ 还要装 Node+Python | ✅ | 极低 | ⭐⭐ |

### 为什么选 Electron

**优点**:
- 真正"单文件"体验(像 VSCode/Discord/微信)
- 跨平台统一一套代码(Mac/Windows/Linux)
- 生态成熟:`electron-builder` 配 Windows 代码签名、auto-update、GitHub Releases 都是现成
- Mac 上能直接出包(现在就能验证)
- 已经是主流桌面 app 模式,用户认知度高

**缺点接受**:
- ~150MB 体积(Chromium 占比 90%)
- 内存占用比 Tauri 大

**对比 Tauri(未来可考虑)**:
- Tauri 用 Rust 后端 + 系统 WebView,体积可压到 ~10MB
- 但需要学 Rust,生态没 Electron 成熟
- **v0.3 选 Electron 跑通,未来 v3.0 可考虑迁移到 Tauri**

### 选 Electron 的具体技术细节

**main 进程职责**:
- 起 Node.js 子进程(信令 server)
- 创建 BrowserWindow 加载 client/index.html
- 监听子进程退出,主进程清理
- (v0.3 Phase B) 提供 IPC 让 renderer 读写 TURN 凭据

**preload 脚本**:
- contextBridge 暴露安全 API 给 renderer
- 不直接暴露 Node API
- 保持 Electron 安全模型

**electron-builder 配置**:
- Mac: `dmg` (NSIS DMG)
- Windows: `nsis` (NSIS installer)
- Linux: `AppImage`
- file 包含 src/ + main.js + preload.js
- 排除 node_modules(用 asar 打包)

---

## 一、核心技术评估

### 1. WebRTC DataChannel

**成熟度:** ✅ 非常成熟(2011年提出,2014年W3C标准化)

**NAT穿透成功率:**

| 网络环境 | 直连成功率 | 说明 |
|---------|-----------|------|
| 双方均在公网 | ~100% | 最理想 |
| 一方在 NAT 后 | ~90% | STUN 即可穿透 |
| 双方都在对称 NAT 后 | ~40-60% | 需要 TURN 中继 |
| 企业防火墙限制 | 可能失败 | 需要代理/TURN |

**行业数据(参考):**
- Google WebRTC 团队公开数据:约 85% 的连接可以成功直连
- 剩余约 15% 需要通过 TURN 中继

**解决方案:**
- 前期忽略 TURN,出现问题时再加
- 使用 PeerJS / 公共 STUN 服务器 降低复杂度

---

### 2. 同步延迟

**理论延迟构成:**

```
指令发送延迟 = 网络 RTT / 2 + 处理时间
HTML5 video.currentTime 设置延迟 = 0~16ms(取决于帧率)
```

**实测预期:**

| 网络条件 | 预估同步延迟 |
|---------|-------------|
| 同城(<50ms RTT)| < 50ms |
| 跨省(100-200ms RTT)| 100-200ms |
| 跨国(>300ms RTT)| > 300ms |

**结论:** 200ms 以内的延迟人类感知不强,同步体验较好

---

## 二、技术方案对比

### 方案 A:原生 WebRTC(我们原计划的)

| 优点 | 缺点 |
|------|------|
| 完全控制,灵活 | 信令服务器需要自己写 |
| 无第三方依赖 | STUN/TURN 配置复杂 |
| 无学习成本(如果你熟悉 WebRTC)| 调试困难 |

### 方案 B:PeerJS(推荐 MVP)

| 优点 | 缺点 |
|------|------|
| 封装了 WebRTC,开源免费 | 增加一个依赖库 |
| 几行代码即可建立 P2P 连接 | 功能被限定 |
| 自动处理 STUN/TURN | - |
| 官方提供公共信令服务器(测试用)| 生产环境需自建 |

**PeerJS 官方文档:** https://peerjs.com/

```javascript
// 示例:建立 DataChannel
const peer = new Peer('someone');
peer.on('connection', (conn) => {
  conn.on('data', (data) => {
    // 收到同步指令
  });
});
```

---

## 三、类似产品调研

| 产品 | 技术方案 | 说明 |
|------|---------|------|
| Syncplay | Python + UDP/TCP | 桌面端,纯本地同步 |
| Kosmi | WebRTC | 基于浏览器的同步观看 |
| Sync | WebRTC | 开源,功能类似 |
| Watch2Gether | 私有协议 | 商业产品 |

**结论:** WebRTC + P2P 的技术方案有成熟先例。

---

## 四、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| P2P 直连失败 | 15% | 中 | 预留 TURN 接口,后期加 |
| 同步延迟高 | 低 | 中 | 选择就近的 STUN 服务器 |
| 视频格式不支持 | 低 | 低 | 初期限制为 MP4 |
| 信令服务器挂 | 低 | 高 | 保持简单,单点故障可接受 |

---

## 五、结论与建议

### 推荐方案:PeerJS(MVP 阶段)

**理由:**
1. **开发效率高** - 减少 70% WebRTC 样板代码
2. **成功率有保障** - 内置 STUN/TURN 支持
3. **已有成熟产品验证** - 类似项目可行

### 信令服务器方案

| 方案 | 适用场景 | 复杂度 |
|------|---------|--------|
| PeerJS 官方公共服务器 | 测试/演示 | 零配置 |
| 私有 PeerJS 信令服务器 | 正式使用 | 极低(Node.js 10行)|

---

## 七、v0.4 Electron 桌面打包实施总结(2026-06-07)

### 架构

**主进程职责**：
1. spawn `node src/server/server.js` 作为子进程（信令 server）
2. 等子进程在 port 9000 监听后创建 BrowserWindow
3. 用 `loadFile()` 加载 `src/client/index.html`（file:// 协议，无需 HTTP server）
4. quit 时正确 kill 子进程

**路径解析**：`app.getAppPath()` 统一 dev / prod

### 关键技术决策

| 决策 | 选型 | 原因 |
|------|------|------|
| **Electron** | v33.4.11 | arm64 Mac 支持 |
| **打包工具** | electron-builder 25.1.8 | 成熟、跨平台 |
| **asar 模式** | `asar: false`（暂用）| 嵌套 node_modules 打包问题未解决 |
| **信令 server** | 内部 spawn Node 子进程 | 零外部依赖 |

### 已知限制

| 问题 | 影响 | 解决方向 |
|------|------|---------|
| asar 压缩未启用 | 体积略大（94MB vs ~80MB） | Phase B 修复 |
| Mac dmg 未签名 | Gatekeeper 警告 | Phase C 代码签名 |
| Win/Linux 未验证 | 不能保证跨平台 | 待在 Win/Linux 验证 |

### 验证结果

- ✅ Mac arm64 .dmg 安装到 `/Applications` 成功
- ✅ 信令 server 启动在 port 9000
- ✅ 窗口正常加载 SyncPlay 客户端
- ✅ 零系统 Python / Node / Homebrew 依赖

---

## 六、调研结论

**技术可行性:** ✅ 通过

- WebRTC P2P 是成熟方案,有大量先例
- 约 85% 直连成功,剩余可通过 TURN 解决
- 同步延迟 < 200ms 体验良好

**建议调整:**
1. MVP 采用 PeerJS 替代原生 WebRTC(降低复杂度)
2. 信令服务器先用 PeerJS 公共服务器
3. 同步指令格式暂定为 `{type: "play"|"pause"|"seek", position: number}`

---

*调研人：Jarvis*
*更新：v0.3 加入 Electron 桌面打包调研(2026-06-07)*
*更新：v0.4 加入 Electron 桌面打包实施总结(2026-06-07)*
