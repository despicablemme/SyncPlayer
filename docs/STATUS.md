# SyncPlay 当前状态

> **这是什么？** 项目的"进度快照"——当前版本、已完成、下一步。  
> **何时查阅？** 每次回来接任务时**先看这个**。  
> **关联文档：** [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-06 18:41

---

## 🚦 一句话状态

**当前版本：v0.2.0**（已完成并发布）  
**下一个目标：v1.0 — 互联网可用版**  
**当前阶段：Phase 1（SaaS TURN 跑通中）** — 规划已定，**等你提供 Metered 凭据**

---

## 📍 快速导航

- 🎯 **目标与路线图** → [ROADMAP.md](./ROADMAP.md)
- 📜 **历史版本记录** → [CHANGELOG.md](./CHANGELOG.md)
- 📖 **需求文档** → [REQUIREMENTS.md](./REQUIREMENTS.md)
- 🏗️ **架构说明** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🔬 **技术调研** → [TECH_RESEARCH.md](./TECH_RESEARCH.md)
- 📝 **会议纪要** → [MEETINGS.md](./MEETINGS.md)
- 🗂 **文档索引** → [README.md](./README.md)

---

## ✅ v0.2.0 已完成（已发布）

**日期**：2026-06-06  
**Commit**：`19e524f`  
**GitHub**：https://github.com/despicablemme/SyncPlayer

### 关键工作
- 客户端拆分（HTML/CSS/JS）
- 修复同步状态机 bug（guardUntil 时间戳）
- 新增漂移校准（10s 间隔 / 0.5s 阈值）
- 新增断线重连（5 次指数退避）
- server.js 改造为 PeerJS 私有服务器
- 视频格式支持扩展
- Toast 通知、密码学安全房间号
- 28 个单元测试覆盖核心同步逻辑
- 一键启动脚本（Mac/Linux/Windows）

---

## 🎯 v1.0 目标（规划中）

**目标**：网页版 UI + **公网环境**（任何网络）播放 MP4 + 进度同步 — **实现方式不限**

### 已确认决策（2026-06-06 18:41）
- ✅ **公网方案 = TURN**（方案 A）
- ✅ **Phase 1**：用 Metered SaaS（免费）跑通
- ✅ **Phase 2**：自建 VPS 跑 coturn + 信令
- ✅ 账号系统 v1.0 不做
- ✅ 多人房间放 v2.0

### Phase 1 必做（不做不算 v1.0 MVP）
- [ ] 注册 Metered 拿 TURN 凭据
- [ ] 改 `src/client/app.js` 加 ICE_SERVERS
- [ ] 跨网段实测两端同步

### Phase 2 应做（v1.0 正式版）
- [ ] 租 VPS
- [ ] 部署信令服务器（Docker compose）
- [ ] 部署 coturn（Docker compose）
- [ ] HTTPS 证书
- [ ] 改 `app.js` 指向 VPS
- [ ] 跨网段实测

详细路线图见 [ROADMAP.md](./ROADMAP.md)

---

## 🛠️ 当前可做的事（Phase 1）

回到 syncplay 后，可以从以下任一项继续：

1. ⭐ **主人去 https://www.metered.ca 注册** —— 拿 TURN 凭据
2. 我改 `src/client/app.js` —— 加 ICE_SERVERS 配置
3. **跨网段实测** —— 找朋友或用 4G 热点测两端同步
4. Phase 1 通过后——开始 Phase 2（租 VPS）

---

## 📊 代码与依赖状态

```
~/CodeProjects/syncplay/
├── 状态: git clean, main 分支与 origin/main 同步
├── 远程: https://github.com/despicablemme/SyncPlayer
├── 依赖: client 无构建（纯静态）, server 需 npm install
└── 启动: 
    - 客户端: cd client && python3 -m http.server 8080
    - 服务端: cd server && npm install && npm start
```

---

## 📝 进度记录

| 日期 | 版本 | 事件 |
|------|------|------|
| 2026-03-22 | v0.1.0 | MVP 首发（项目立项） |
| 2026-06-06 | v0.2.0 | 重构完成（同步 bug 修复、漂移校准、重连） |
| 2026-06-06 | 规划 | 决定 v1.0 目标，文档结构建立 |
| 2026-06-06 18:00 | 规划 | 加 v1.0 硬性要求 R1-R5 |
| 2026-06-06 18:30 | 规划 | 选定方案 A（TURN）|
| 2026-06-06 18:35 | 规划 | 7 个文档统一头部 + docs/README.md 索引 |
| 2026-06-06 18:41 | 规划 | **两阶段路径确定**（Phase 1 SaaS → Phase 2 自建）|
| TBD | v1.0 Phase 1 | SaaS TURN 跑通 |
| TBD | v1.0 Phase 2 | 自建 VPS 部署 |

---

*维护：Jarvis*
*协作：主人（Bruce）*
