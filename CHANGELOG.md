# Changelog

SyncPlay 项目的版本迭代记录。

> **关联文档**：
> - 🎯 目标与路线图 → [ROADMAP.md](./ROADMAP.md)
> - 🚦 当前状态与下一步 → [STATUS.md](./STATUS.md)

---

## [0.2.0] - 2026-06-06

### 🔄 重构

- **客户端拆分**：将原本 13K 的单文件 `index.html` 拆分为 `index.html` + `app.js` + `style.css`，可维护性大幅提升
- **架构统一**：`server/server.js` 从死代码改造为 PeerJS 私有信令服务器，客户端/服务器各司其职

### 🐛 关键修复

- **同步状态机 bug**：用 `guardUntil` 时间戳替代原来脆弱的 50ms 定时器，避免回环
- **drift 漂移**：新增每 10s 自动漂移校准（阈值 0.5s），长时间播放不再累积偏移
- **断线重连**：新增指数退避重连（2s/4s/6s/8s/10s，最多 5 次）
- **peer-unavailable 错误**：现在会明确提示"对方房间号不存在或未上线"

### ✨ 新增

- 漂移/延迟实时显示面板
- Toast 通知（替代 `alert()`，体验更好）
- `file_info` 协议消息：连接建立时校验两端视频时长
- 心跳机制：5s 一次心跳测量 RTT
- 房间号改用 `crypto.randomUUID()`（密码学安全）
- 视频格式支持扩展：mp4 / webm / ogg / quicktime / matroska / avi / 3gpp

### 📚 文档

- 新增 `ARCHITECTURE.md`：架构详解 + 状态机图
- 重写 `README.md`：完整使用文档
- 重写 `STATUS.md`：v1 问题清单 + 重构方案
- 新增 `CHANGELOG.md`：本文件

### ⚠️ 已知问题

- 约 15% 网络环境仍需 TURN 中继（未实现）
- 自动化测试未跑通
- 移动端未适配

---

## [0.1.0] - 2026-03-22

### 🎉 MVP 首发

- **项目立项**：完成需求讨论、技术调研、方案设计
- **架构选型**：WebRTC DataChannel + PeerJS 公共服务器
- **核心功能**：
  - 房间号创建/加入
  - 视频选择（本地文件 / URL）
  - 播放/暂停同步
  - 进度同步（seek）
  - 状态显示（区分创建方/加入方）
- **技术栈**：纯 HTML + JS + PeerJS 1.5.4
- **后端**：自定义 WebSocket 信令服务器（实际未使用，已在 0.2 重构）

### 📚 文档

- `REQUIREMENTS.md` 需求文档
- `TECH_RESEARCH.md` 技术调研
- `MEETINGS.md` 会议纪要

### ⚠️ 已知问题（v0.1）

- ~~server.js 是死代码~~ ✅ 已在 0.2 修复
- ~~同步状态机有 bug~~ ✅ 已在 0.2 修复
- ~~drift 漂移未处理~~ ✅ 已在 0.2 修复
- ~~断线重连缺失~~ ✅ 已在 0.2 修复
- 15% 网络环境 P2P 直连失败（待 TURN）
- 视频格式只支持 mp4
- Playwright 自动化测试未跑通

---

*维护：Jarvis & 主人*
