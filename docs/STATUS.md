# SyncPlay 当前状态

> **这是什么？** 回答"我们现在在哪个版本、完成了什么、下一步做什么"。  
> 每次回来接任务时，先看这个。  
> 最后更新：2026-06-06

---

## 🚦 一句话状态

**当前版本：v0.2.0**（已完成并发布）  
**下一个目标：v1.0 — 互联网可用版**（规划已定，未启动开发）

---

## 📍 快速导航

- 🎯 **目标与路线图** → [ROADMAP.md](./ROADMAP.md)
- 📜 **历史版本记录** → [CHANGELOG.md](./CHANGELOG.md)
- 📖 **需求文档** → [REQUIREMENTS.md](./REQUIREMENTS.md)
- 🏗️ **架构说明** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🔬 **技术调研** → [TECH_RESEARCH.md](./TECH_RESEARCH.md)
- 📝 **会议纪要** → [MEETINGS.md](./MEETINGS.md)

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

### 已知未解决（已记入 v1.0）
- ~15% 网络环境 P2P 直连失败（需 TURN）
- 移动端未适配
- 信令服务器未公网部署
- 自动化测试未跑通

---

## 🎯 v1.0 目标（规划中，未启动）

**目标**：网页版 UI + 互联网上非内网播放 MP4 + 进度同步

### P0 必做（不做不算 v1.0）
- [ ] TURN 中继服务器
- [ ] 信令服务器公网部署 + HTTPS
- [ ] 客户端配置远程信令
- [ ] 公网端到端测试

### P1 应做
- [ ] 房间号 → 分享链接
- [ ] 连接状态可视化（P2P / TURN / 失败）
- [ ] 错误友好提示

### P2 锦上添花
- [ ] 移动端响应式
- [ ] 视频两端文件校验
- [ ] 重连后状态恢复

### 待决策（启动前需要确定）
1. TURN 方案：自建 coturn / 第三方 SaaS
2. 公网部署：VPS / Cloudflare Workers+Tunnel
3. 多人房间是否进 v1.0

详细路线图见 [ROADMAP.md](./ROADMAP.md)

---

## 🛠️ 当前可做的事

回到 syncplay 后，可以从以下任一项继续：

1. **决策 TURN 方案** — 启动 v1.0 开发的第一个关卡
2. **搭建本地 TURN 测试环境** — 用 coturn 在本地 docker 跑
3. **公网部署信令服务器** — 选 VPS / Cloudflare 之一
4. **完善 v0.2 文档** — 截图、补 README、录 demo gif

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
| 2026-06-06 | v0.2.0 → v1.0 | 决定 v1.0 目标，编写 ROADMAP.md |
| TBD | v1.0 | 启动 v1.0 实际开发 |

---

*维护：Jarvis*
*协作：主人（Bruce）*
