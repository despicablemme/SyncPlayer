# SyncPlay 项目状态报告

> 最后更新：2026-06-06（重构）

---

## 📊 当前状态

| 项目 | 状态 | 说明 |
|------|------|------|
| 需求文档 | ✅ 完成 | REQUIREMENTS.md |
| 技术调研 | ✅ 完成 | TECH_RESEARCH.md |
| 前端代码 | 🔄 重构中 | 修复同步状态机 + 漂移校准 + 断线重连 |
| 信令服务器 | 🔄 改造中 | 从 WebSocket 信令 → PeerJS 私有服务器 |
| 本地测试 | ⏳ 待做 | 重构后回归测试 |
| 公网测试 | ⏳ 待做 | 待 P2P 验证 |

---

## 🐛 v1 版本问题清单（已识别）

### 🔴 严重问题

1. **架构矛盾 — server.js 是死代码**
   - 客户端引用 PeerJS 公共服务器（`unpkg.com/peerjs`），从未连接 `ws://localhost:8080`
   - MEETINGS 决议"用 PeerJS 公共服务器"后又派 agent 写 server.js，导致两个信令方案并存
   - **重构方案**：将 server.js 改造为 PeerJS 私有服务器（`peer` npm 包），让两个组件各司其职

2. **同步状态机有 bug**
   ```js
   // 旧逻辑：50ms 内忽略本地事件
   isReceivingSync = true;
   video.currentTime = data.position;  // 触发 seeked
   video.play();                        // 触发 play
   setTimeout(() => isReceivingSync = false, 50);  // 50ms 内可能误发
   ```
   **重构方案**：用时间戳标记 + 标记待忽略事件（按 origin 区分，而不是按时间窗口）

3. **drift（时间漂移）未处理**
   两端独立计时，长时间播放累积漂移
   **重构方案**：每 N 秒发送心跳 + 偏移值，客户端按 offset 校正

4. **断线重连缺失**
   `conn.on('close')` 后无任何恢复逻辑
   **重构方案**：自动重连 + 状态恢复

### 🟡 设计问题

5. `isInitiator` 变量定义了从未读取
6. 房间号 `Math.random()` 非密码学安全
7. 视频格式只支持 mp4
8. Playwright 测试从未跑通

### 🟢 改进项

- 没有同步延迟显示
- 没有缓冲/卡顿状态
- 错误用 `alert()`，体验差
- 移动端未适配
- 视频两端必须选**同一个文件**（无强制校验）

---

## 📁 重构后项目结构

```
syncplay/
├── README.md            ← 项目简介（更新架构图）
├── REQUIREMENTS.md      ← 需求文档
├── TECH_RESEARCH.md     ← 技术调研
├── MEETINGS.md          ← 会议纪要
├── STATUS.md            ← 本文档
├── ARCHITECTURE.md      ← 新增：架构详解
├── client/
│   ├── index.html       ← 重构：同步逻辑 + 漂移校准 + 重连
│   ├── app.js           ← 抽出 JS 模块
│   ├── style.css        ← 抽出样式
│   └── test-video.mp4   ← 测试视频
├── server/
│   ├── server.js        ← 改造为 PeerJS 私有信令服务器
│   └── package.json     ← 依赖：peer / express
└── test/
    └── test.js          ← 重写：WebRTC mock 测试
```

---

## 🚀 后续计划

### 重构后立刻做
- [ ] 本地双窗口回归测试
- [ ] 公网双端测试

### 中期
- [ ] TURN 中继支持
- [ ] 同步延迟显示面板
- [ ] 断线重连状态显示

### 长期
- [ ] 流媒体支持
- [ ] 移动端适配
- [ ] 多房间支持

---

*记录人：Jarvis*
*最后更新：2026-06-06*
