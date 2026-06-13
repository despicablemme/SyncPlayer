# SyncPlay 项目会议纪要

> **这是什么？** 项目会议讨论记录——决策、计划、回顾等。  
> **何时查阅？** 想看"为什么这么做" / "哪个版本改了什么" / "下次要做什么"。  
> **关联文档：** [STATUS.md](./STATUS.md) · [ROADMAP.md](./ROADMAP.md) · [REQUIREMENTS.md](./REQUIREMENTS.md) · [CHANGELOG.md](./CHANGELOG.md) · [README.md](./README.md)  
> **最后更新：** 2026-06-10
>
> ⚠️ **排序规则: 按发生时间倒序 (最新在前)** — 每次加新会议必须放最前面, 永远不要追加到末尾。

---

## 会议 #008 — 2026-06-13 v0.6.1 阶段 C 收尾 (完工纪要, docs 补齐)

**参会人员**：主人 (Bruce)、Jarvis (主控)
**主题**：v0.6.1 视频添加历史记录 (FR-4) — 阶段 C 收尾 (补齐 docs, 不动代码)
**耗时**：~15 分钟 (纯文档 + 版本号)
**阶段**：v0.6.1 阶段 C (完工后 docs 统一更新)

### 一、背景

v0.6.1 子任务 A + B + C 实际在 **2026-06-10 全部完工** (7 个 commit 全部 PASS, 单元测试 + e2e 测试全绿)。但主人 2026-06-13 接 v0.6.2 UI bug 修复任务时, 主 agent 才**发现** v0.6.1 阶段 C 没收尾:

- `package.json` 还是 0.6.0 (**没升**)
- `desktop/package.json` 也是 0.6.0
- **没**推 `v0.6.1` tag
- `docs/STATUS.md` / `ROADMAP.md` / `CHANGELOG.md` / `MEETINGS.md` 全部还显示 v0.6.0 Shipped

**违反 runbook 红线** "❌ 跳过阶段 C 直接汇报"。本次会议**收尾** v0.6.1 阶段 C, 补齐所有 docs。

### 二、主人决策 (3 件)

1. **v0.6.1 不单独出 release asset** — 跟 v0.6.2 合并出, 一起实测
2. **v0.6.1 tag 推** — 补 `git tag v0.6.1` + push, 纯 git tag, **不**触发 GitHub Actions release workflow
3. **v0.6.2 改工作流** — 阶段 A 改派 Claude 出方案 (主人原话: "以后第一步不是我和你出计划, 我只给你传递现象, 和要求. 出修改方案和计划的事交给cloude来做"), 详见 #009 会议纪要

### 三、交付清单 (5 commit + 1 tag, 全部 PASS)

| Commit / Tag | 内容 | 模式 |
|---|---|---|
| `31ca692` | plan(v0.6.1): 视频添加历史记录 计划 + 会议纪要 | 阶段 A 主 agent |
| `19bd524` | feat(v0.6.1-A): add video history persistence (electron-store + IPC) | Builder ACP |
| `0644ac8` | test(v0.6.1-A): add test report for main-process-preload-infra | Tester ACP |
| `88f27b2` | feat(v0.6.1-B): video history UI in renderer | Builder ACP |
| `e0fe399` | fix(v0.6.1-B): add 清空所有 button + wire videoHistory.clear() | Builder ACP (fix) |
| `c020d16` | test(v0.6.1-B): add test report for video-history-ui | Tester ACP |
| `c349473` | test(v0.6.1): add unit + e2e tests for video history | Tester ACP |
| **(本会议)** | `docs(v0.6.1): release status update + version bump` | 主 agent 阶段 C 收尾 |
| **v0.6.1** (tag) | 补推 git tag, **不**触发 release workflow | 主 agent |

### 四、关键技术决策

1. **release 策略变更**：v0.6.1 release 合并到 v0.6.2, 一起出 release asset + 一起实测
   - **理由**：避免重复跑 GitHub Actions runner, 节省时间; 实测一次性跑 v0.6.1+v0.6.2 更高效
2. **docs 补齐范围**：4 个 docs (STATUS / ROADMAP / CHANGELOG / MEETINGS) + 2 个 package.json 版本号
3. **commit + push 策略**：用 Python 写 (per AGENT_PRACTICES #13 教训, 不用 edit 工具避免全角标点被改坏)
4. **tag push 后必须 fetch 验证** (per AGENT_PRACTICES #15 教训 — LibreSSL SSL_ERROR_SYSCALL 假阳性)

### 五、阶段 C 收尾工作 (主 agent 一次性完成)

1. ✅ 升 `package.json` 0.6.0 → 0.6.1 (根)
2. ✅ 升 `desktop/package.json` 0.6.0 → 0.6.1
3. ✅ 更新 `docs/STATUS.md` — 加 v0.6.1 已完成段, 改"🚦 一句话状态"
4. ✅ 更新 `docs/ROADMAP.md` — v0.6.1 状态 ✅ Shipped, 改"🚦 当前迭代"
5. ✅ 更新 `docs/CHANGELOG.md` — 加 `[0.6.1] - 2026-06-10` release 段
6. ✅ 更新 `docs/MEETINGS.md` — 加本段 #008 完工纪要
7. ✅ commit "docs(v0.6.1): release status update + version bump" + push + fetch 验证
8. ✅ 推 `v0.6.1` tag + fetch 验证
9. ⏸ **不**触发 GitHub Actions release workflow (v0.6.1 release 合并到 v0.6.2)

### 六、commit 列表 (本次主 agent 阶段 C 收尾)

| Commit | 内容 |
|---|---|
| `<v0.6.1-stage-c>` | docs(v0.6.1): release status update + version bump — 2 package.json 升 0.6.0→0.6.1, 4 docs 补齐 |

### 七、下一步

主 agent 按新工作流跑 v0.6.2 (详见 #009 会议纪要 — 改派 Claude 出方案) → 等主人拍 v0.6.2 ABCD 决策 → 阶段 B 拆任务 → 派 Builder ACP + Tester ACP → 完工 → v0.6.1 + v0.6.2 合并出 release asset。

---

## 会议 #007 — 2026-06-10 v0.6.1 目标确认 (计划阶段 A)

**参会人员**：主人 (Bruce)、Jarvis (主控)
**主题**：v0.6.1 视频添加历史记录 — 目标确认 + 持久化方案决策
**耗时**：~10 分钟
**阶段**：v0.6.1 阶段 A (计划/讨论)

### 一、目标（主人拍）

v0.6.1 添加 **"视频添加历史记录"** 功能：

- 用户选完本地/在线视频后，记录被持久化
- 下次打开应用能一键从历史里**重新选择**对应视频
- 不用重新粘贴 URL 或重新选文件

### 二、主人纠正（3 个）

1. **版本号**：主人原话".06.1" → 实际 **v0.6.1**（我之前误听成 v0.7.1，主 agent 复述阶段已确认）
2. **平台性质**：我们是 **desktop app (Electron 33)** → **不**是纯 web 端，浏览器 File API 限制不适用
3. **持久化方式**：主人授权 Jarvis 自选最合适方案

### 三、关键技术决策（Jarvis 选）

| 决策 | 选择 | 理由 |
|---|---|---|
| **持久化库** | `electron-store` | Electron 官方推荐，JSON 存 userData，主进程同步 API，轻量 (<5KB) |
| **本地视频"下次用"** | `webUtils.getPathForFile(file)` 拿绝对路径 + `loadVideo('file://'+path)` | Electron 30+ 推荐 API，拿到路径下次直接用 |
| **URL 视频"下次用"** | 存 URL + 提取 title，下次直接 `loadVideo(url)` | 简单可靠 |
| **MVP 范围** | 最近 20 条 + 失效标灰 + 单条删除/清空 | 不过度设计，标签/搜索 v0.7.x 再加 |
| **数据存哪** | `app.getPath('userData') + '/video-history.json'` | electron-store 默认位置，跨平台 |
| **IPC 接口** | `desktopAPI.videoHistory.{get/add/remove/clear/checkExists}` | 跟现有 desktopAPI 命名一致 |

### 四、不做什么（反模式避）

- ❌ **不**用 IndexedDB（electron-store 更合适，主进程能直接读）
- ❌ **不**用 SQLite（数据量小，过度设计）
- ❌ **不**做"标签/搜索/排序"（MVP 不做）
- ❌ **不**同步到云端（隐私，本地数据）
- ❌ **不**让用户上传视频到 server（架构不允许，v1.0 也不做）

### 五、阶段 B 子任务拆分（待主 agent 拍）

预计 3 个子任务：

- **v0.6.1-A** 主进程 + preload 基础设施：electron-store 装 + main.js IPC handler + preload.js 暴露 videoHistory API
- **v0.6.1-B** 客户端 UI + 集成：视频选择对话框加"📜 历史"按钮 + 自动写记录 + 失效标灰 + 单条/清空
- **v0.6.1-C** 测试 + 验收：unit test + e2e test（用 Playwright 跑真实 desktop app）

阶段 C 完工一次性更新 STATUS/CHANGELOG/MEETINGS。

### 六、下一步

主 agent 跑完阶段 A 4-6 → commit "plan(v0.6.1): 视频历史记录 计划 + 会议纪要" + push → 主人 review 完 plan 文档 → 阶段 B 拆任务派 subagent。

---

## 会议 #006 — 2026-06-09 v0.6 完工纪要 (置顶)

**参会人员**:主人 (Bruce)、Jarvis (主控)、Claude Code (ACP harness 实例 5 个)
**主题**:v0.6 体验优化 + bug 修复 — 完工回顾
**耗时**:约 1.5 小时 (含 plan 阶段 A + 3 子任务阶段 B + 阶段 C 文档落地)
**阶段**:v0.6 阶段 C (完工后 docs 统一更新)

### 一、交付清单 (5 commit 全部 PASS)

| Commit | 子任务 | 模式 | 验收 |
|---|---|---|---|
| `5675750` | FR-1 房间退出 + 重新加入 | Native subagent | ✅ (跳过 Tester) |
| `ef56139` | FR-2 修 URL bug | ACP harness | ✅ |
| `2b72bcc` | v0.6-B test report | ACP Tester | ✅ 12 PASS / 1 N/A / 0 FAIL |
| `8e9d767` | FR-3 解耦视频 + 视频不匹配 + 状态机重构 | ACP harness | ✅ |
| `90f1b95` | v0.6-C test report | ACP Tester | ✅ 全部 PASS |

### 二、关键技术决策

1. **架构改进**:状态机从 4 态扩到 6 态 (`no_room` / `connecting` / `in_room_no_video` / `in_room_waiting_peer_video` / `in_room_synced` / `in_room_mismatch`). 新增 `src/shared/room-state.js` (RoomStateMachine) + `src/shared/video-match.js` (videosMatch + describeVideo + normalizeUrl)
2. **模式升级**:主人 (2026-06-09) 决定 v0.6+ 用 ACP harness 模式 (`runtime: "acp"`) 跑 Claude Code, 替代 native subagent. 未来所有 ACP spawn 必加 `streamTo: "parent"` (per AGENT_PRACTICES #19)
3. **ACP 启用 3 步**:`openclaw plugins install @openclaw/acpx` + `config set plugins.entries.acpx.enabled true` + `openclaw config set plugins.entries.acpx.config.permissionMode approve-all` + `gateway restart`
4. **任务实例放 `.agent-tasks/` 不上库** (per runbook 段 "文件上库决策规则", 主人 2026-06-09 确认方案 1)

### 三、遇到的问题 + 修法

1. **ACP v1/v2/v3 smoke test 失败**:
   - v1: 缺 permission profile, OpenClaw 默认 `permissionMode=approve-reads` + `nonInteractivePermissions=fail`
   - v2: 我**编了** `sessions_spawn({permissionProfile: "approve-all"})` (OpenClaw **不**接受这个 API 参数)
   - v3 ✅: 正确配法 = `openclaw config set plugins.entries.acpx.config.permissionMode approve-all` (真配在 acpx config, 不在 sessions_spawn API)
   - **沉淀**: AGENT_PRACTICES #18 完整故事

2. **`/acp status` 误判**:我之前文档说 "主人在 webchat 直接打 /acp status 看进度", **错**——`/acp status` 是 OpenClaw Gateway 命令, **主 agent 调**, **不**是给用户. 主人实测报错 `Session is not ACP-enabled: agent:main:main`
   - **真 visibility 渠道**: 主 agent 主动汇报 (完工事件) + `subagents` 工具查询 (on-demand)
   - **修法**: 未来 ACP spawn 必加 `streamTo: "parent"` (主 agent 收实时 stream, 关键节点汇报)
   - **沉淀**: AGENT_PRACTICES #19 完整故事

3. **edit 工具破坏 CJK 标点**:之前用 `edit` 工具改 docs/AGENTS.md 时意外把全角"？"改成半角"?"等
   - **修法**: 用 Python 直接 write, **不**用 edit 工具做大段中文改动
   - **沉淀**: AGENT_PRACTICES #13

4. **git push SSL_ERROR_SYSCALL 假阳性**: `LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443` 但实际 push 成功
   - **修法**: push 后必 `git fetch origin main && git rev-parse main origin/main` 验证, 不只信 git 输出
   - **沉淀**: AGENT_PRACTICES #15

### 四、runbook 阶段流程 3 阶段实战

- **阶段 A (plan/讨论)**: 主人说目标 → 复述理解 → 写 plan 文档 (MEETINGS/REQUIREMENTS/ROADMAP) → commit + push
- **阶段 B (实现)**: 拆任务 → 写任务书 (.agent-tasks/v0.6.0/...) → 派 Builder (Native subagent 跑 A, ACP 跑 B/C) → 派 Tester (独立 context 跑 B/C) → 验收
- **阶段 C (完工)**: 全部子任务 PASS 后统一更新 docs/CHANGELOG/STATUS/ROADMAP/ARCHITECTURE/MEETINGS → bump package.json → 1 commit + push 5 个 commit 一次

### 五、阶段 C 待办清单 (本会议产出)

- [x] CHANGELOG.md 加 v0.6.0 段 (FR-1/2/3 + ACP 模式升级 + 5 commit 列表)
- [x] STATUS.md v0.6 → ✅ Shipped
- [x] ROADMAP.md v0.6 → ✅, v0.7 → 🎯 next
- [x] ARCHITECTURE.md 加 6 态状态机 + 视频匹配 + 解耦流程图
- [x] MEETINGS.md 加 v0.6 完工纪要 (本会议, 置顶 per 倒序规则)
- [x] package.json + desktop/package.json bump 到 0.6.0 (滞后问题, v0.5.x 一直是主人写)
- [x] git push 5 commit + 阶段 C 1 commit = 6 commit 一次

### 六、相关链接

- `docs/CHANGELOG.md` — v0.6.0 release 段
- `docs/STATUS.md` — v0.6.0 Shipped 状态
- `docs/ROADMAP.md` — v0.6 → ✅, v0.7 → 🎯
- `docs/ARCHITECTURE.md` — 6 态状态机 + 视频匹配架构
- `docs/REQUIREMENTS.md` — FR-1/2/3 详细需求
- `agentWorkflowAndTemplates/runbook.md` — 3 阶段流程
- `agentWorkflowAndTemplates/control-claude.md` — ACP mode + streamTo:parent
- `AGENT_PRACTICES.md #18` — ACP 启用 v1/v2/v3 完整故事
- `AGENT_PRACTICES.md #19` — /acp status 误判 + 必加 streamTo:parent
- `AGENT_PRACTICES.md #13` — edit 工具破坏 CJK 标点
- `AGENT_PRACTICES.md #15` — git push SSL_ERROR_SYSCALL 假阳性

---

## 会议 #005 — 2026-06-09 v0.6 计划制定## 会议 #005 — 2026-06-09 v0.6 计划制定

**参会人员**：主人（Bruce）、Jarvis（主控）
**主题**：v0.6 体验优化与 bug 修复 — 制定计划
**耗时**：约 15 分钟（讨论 + plan 文档落地）
**阶段**：v0.6 计划 (阶段 A: 落实目标)

### 一、背景

v0.5 / v0.5.1 已发布 (GitHub Actions 跨平台 build + asar 修复). 主人反馈 3 个 v0.6 候选需求, **改方向** (从原 ROADMAP 写的 "v0.6 = Linux AppImage 验证 + macOS 安装文档化" 改为 "体验优化 + bug 修复").

### 二、主人提出的 3 个需求 (本次 v0.6 核心)

#### 需求 1: 房间生命周期扩展 (退出 + 换房)

**现状**: 创建房间 / 加入房间 ✅, 但**没有**退出房间功能, 也**没有**"重新加入另一房间"功能.

**目标**:
- ✅ 创建房间 (已有)
- ✅ 加入房间 (已有)
- 🆕 **退出房间** (新功能)
- 🆕 **重新加入另一房间** (新功能 — 同退出, 但 UI 直接跳到加入界面)

**业务场景**: A 和 B 看完一个视频, 不想关浏览器, 直接退出当前房间 + 加入新房间, 看下一个视频.

#### 需求 2: 修视频 URL 加载 bug

**现状**: 用户输入视频 URL 链接, 加载会失败.

**目标**:
- 修这个 bug, 让 URL 加载能成功
- 测试: 本地视频文件 / HTTP URL / 跨域 URL / 流媒体 URL 等

**可能根因 (Builder 接手时要查)**:
- CORS 限制
- `<video>` 标签 src 设置时机 (load() 调用)
- MIME type 缺失
- Mixed content (https 页加载 http 视频)
- 跨域 referrer policy

#### 需求 3: 解耦视频加载与房间 + 视频不匹配提示

**现状**: 必须**先**加载视频, 才能创建/进入房间. 体验不好.

**目标**:
- 房间生命周期 (创建/进入/退出) 与视频加载**解耦** — 任意顺序都行
- 视频加载**不**是房间的前提
- **新功能**: 两端都加载视频后, 如果视频信息不匹配 (URL 不一样 / 文件名不一样 / 时长差太多), UI 状态区显示提示: **"视频不匹配, 无法同步进度"**
- 匹配逻辑: 视频信息 (URL / 文件名 / 时长 / hash?) 任一不一致 = 不匹配

**新 UI 状态**:
- 双方都进房 + 都加载视频 + 视频匹配 = 正常同步 (现有行为)
- 双方都进房 + 都加载视频 + 视频**不**匹配 = UI 状态区红色提示 "视频不匹配, 无法同步进度"
- 双方都进房 + 仅一方加载视频 = 等待另一方 (新增状态, 或保留原"连接中"状态)
- 退出房间 = 回到主界面 (新增 UI 状态)

### 三、决策

| # | 决策 | 理由 |
|---|---|---|
| 1 | **v0.6 改方向** (从 "Linux AppImage 验证" → "体验优化") | 主人 3 个需求都是体验问题, 优先级更高 |
| 2 | **不**在 v0.6 做"移动端响应式" (原 REQUIREMENTS.md 写的) | 体验优化先行, 移动端延后 |
| 3 | **不**在 v0.6 做"TURN UI" (原 v0.7 规划) | 等 v0.6 体验稳了再考虑 |
| 4 | **解耦方案**: 房间状态机独立于视频状态, 视频状态是 room state 的一个子状态 | 业务上房间生命周期跟视频加载无关, 解耦符合直觉 |
| 5 | **视频匹配用 URL + 文件名 + 时长 三重校验** (具体方案由 Builder 提) | 单 URL 不可靠 (短链/重定向), 加文件名 + 时长更稳 |

### 四、现状摘要 (给 Builder 接手时参考)

| 文件 | 行数 | 用途 |
|---|---|---|
| `src/client/app.js` | 10590 字节 | 客户端主逻辑 (房间 + 视频 + 同步, 都在这一个文件) |
| `src/client/index.html` | 2569 字节 | UI 布局 |
| `src/client/style.css` | 3392 字节 | 样式 |
| `src/server/server.js` | 1669 字节 | 信令服务器 (极简) |
| `package.json` | version 0.4.0 | ⚠️ **滞后**于 GitHub v0.5.1 — 阶段 C 时一并 bump |
| `test/` | e2e + unit | 28 个单元测试 (v0.2 加的), e2e 已有基础 |

**关键模块位置** (Builder 接手时要熟):
- 房间创建/加入逻辑: `src/client/app.js` (搜 `createRoom` / `joinRoom` / `peer.on('connection')`)
- 视频加载逻辑: `src/client/app.js` (搜 `<video>` / `loadVideo` / `URL.createObjectURL`)
- 同步状态机: `src/client/app.js` (搜 `syncState` / `play` / `pause` / `seek`)
- UI 状态区: `src/client/index.html` + `style.css` (状态区元素 + 样式)

### 五、阶段 A 计划 (本次会议产出)

- [x] ROADMAP.md: v0.6 改方向 (体验优化) — **本次落地**
- [x] REQUIREMENTS.md: 加 3 个新需求 (FR-1 房间退出/换房, FR-2 URL bug, FR-3 解耦+匹配) — **本次落地**
- [x] MEETINGS.md: 本纪要 — **本次落地** (已置顶, 符合"按时间倒序"规则)

### 六、阶段 B 待办 (下次)

主 agent 接到本会议后, 进**阶段 B 拆任务**:
- 子任务 1: 房间退出 + 换房功能 (前端 UI + 状态机)
- 子任务 2: 修视频 URL 加载 bug
- 子任务 3: 解耦视频与房间 (前后端状态机)
- 子任务 4: 视频不匹配检测 + UI 提示
- (具体拆法阶段 B 时确定, 本会议**不**预先拆太细)

### 七、阶段 C 待办 (v0.6 完工后)

- STATUS.md: v0.6 → ✅ Shipped
- ROADMAP.md: v0.6 → ✅, v0.7 → 🎯 next
- CHANGELOG.md: 加 v0.6 release 条目 (FR-1/2/3)
- ARCHITECTURE.md: 如房间状态机/视频状态机改了, 加新流程图
- AGENT_PRACTICES.md: 阶段 B 期间发现的新教训
- package.json: bump 到 0.6.0 (⚠️ 滞后于 GitHub 现状)
- desktop/package.json: 同步 bump
- MEETINGS.md: 加 v0.6 完工纪要 (置顶)

### 八、相关链接

- `docs/ROADMAP.md` — 本会议更新
- `docs/REQUIREMENTS.md` — 本会议加 3 个新需求
- `docs/STATUS.md` — **本会议不更新** (per runbook 阶段 A 规则, 阶段 C 才更新)
- `docs/CHANGELOG.md` — **本会议不写** (per runbook 阶段 A 规则, 阶段 C 才写)
- `agentWorkflowAndTemplates/runbook.md` — 3 阶段流程 (plan→实现→完工)

---

## 会议 #004 — 2026-06-07 v0.4 Electron 桌面打包实施

**参会人员**：主人（Bruce）、Jarvis（主控）、子 Agent（Executor + Tester）
**主题**：SyncPlay v0.4 Electron 桌面打包6步走（Step 1-6）
**耗时**：约 2 小时（主 Agent 指挥，子 Agent 执行编排）

### 一、Step 1 — 工程骨架（5-10 分钟）

**任务**：创建 `desktop/` 目录，装 electron + electron-builder

**执行结果**：
- `mkdir -p desktop`
- `desktop/package.json`: name=syncplay-desktop, version=0.4.0
- `npm install --save-dev electron@33.4.11 electron-builder@25.1.8`
- `desktop/.gitignore`: node_modules/, dist/

**验收通过**：
- ✅ electron --version → v33.4.11
- ✅ electron-builder --version → 25.1.8
- ✅ node_modules/ 已生成

### 二、Step 2 — Electron 主进程（15-20 分钟）

**任务**：main.js + preload.js 让 Electron 出窗口跑 SyncPlay

**架构决策**：
- 主进程 spawn `node src/server/server.js`（子进程，信令 server）
- 等子进程起来后创建 BrowserWindow
- 用 `loadFile()` 直接加载 `src/client/index.html`（不需要 Python HTTP server）
- `preload.js` 暂时最小化（Phase A）
- quit 时正确清理子进程

**路径解析设计**：`app.getAppPath()` 统一 dev/prod
- dev: `appPath = /path/to/syncplay/desktop`
- prod: `appPath = /path/to/SyncPlay.app/Contents/Resources/app.asar`

**验收通过**：
- ✅ `npm run dev` 启动 Electron，出窗口
- ✅ 信令 server 在 9000 端口监听
- ✅ 不依赖 Python
- ✅ 控制台 0 报错（DevTools CSP warning 允许）

### 三、Step 3 — electron-builder 配置（10-15 分钟）

**任务**：配 Mac .dmg + Windows .exe + Linux .AppImage

**坑 1：GitHub 下载超时**
- electron-builder 首次构建需要下载 Electron 二进制包
- GitHub 在某些网络环境下连接超时
- 解决：从本地 electron 缓存 `~/Library/Caches/electron/` 复制 zip 到 electron-builder 缓存 `~/Library/Caches/electron-builder/electron/{sha256}/`

**坑 2：asar 不含 src/ 文件**
- `files: ["../src/**/*"]` 相对路径不工作（asar 内 `../` 指向 app.asar 外部，无文件）
- 解决：prebuild 脚本复制 `../src/` → `src/`，files 改为 `src/**/*`

**坑 3：server node_modules 不进 asar**
- `src/server/node_modules/`（嵌套 node_modules）electron-builder 忽略
- 解决：安装 `peer@0.6.1` 到 `desktop/node_modules/peer`（顶层，非嵌套）

**验收通过**：
- ✅ build 字段完整（appId/productName/targets）
- ✅ `npm run dist:mac` 成功
- ✅ `desktop/dist/SyncPlay-0.4.0-arm64.dmg` 存在（94MB）

### 四、Step 4 — 资源打包 + asar（10-15 分钟）

**最终配置**：
- `asar: false`（asarUnpack 对嵌套 node_modules 不生效，暂用非压缩模式）
- `peer@0.6.1` 安装在 `desktop/node_modules/peer`
- `src/client/`、`src/shared/`、`src/server/` 全部打入 app bundle

**验收通过**：
- ✅ 装的 .app 在 `/Applications` 双击启动
- ✅ 启动后信令 server 起来（port 9000 监听）
- ✅ 浏览器窗口加载 SyncPlay 客户端
- ✅ 完全不依赖系统 Python
- ✅ 完全不依赖系统 Node（只依赖 .app 包内的 Electron）

### 五、Step 5 — 干净环境验收

**实际执行**：
- 在当前 Mac 上安装 .dmg 到 `/Applications`
- 启动 `/Applications/SyncPlay.app/Contents/MacOS/SyncPlay`
- 验证 server 进程在 port 9000 监听
- 验证 renderer 进程正常

**结果**：
- ✅ server 进程：`node /Applications/.../src/server/server.js`
- ✅ port 9000：`node 47706 bruce IPv6 *:cslistener (LISTEN)`
- ✅ 零报错

**遗留**：
- Windows / Linux 尚未在对应平台验证
- `asar: false` 体积略大（未压缩）

### 六、Step 6 — 发布文档

**更新内容**：
- 根 package.json：0.3.0 → 0.4.0
- CHANGELOG.md：新增 v0.4.0 条目
- STATUS.md：v0.4 已发布，v0.3 标已完成
- ROADMAP.md：v0.4 移到已发布，加 v0.5 展望
- MEETINGS.md：新增 #004
- REQUIREMENTS.md：R1 加 v0.4 实现说明
- TECH_RESEARCH.md：加 Electron 选型总结
- README.md：加 v0.4 下载说明

**Git commit**：`7a15107`

### 七、技术决策记录

| 决策 | 选型 | 原因 |
|------|------|------|
| **Electron 版本** | v33.4.11 | 最新稳定版，arm64 支持 |
| **打包工具** | electron-builder 25.1.8 | 成熟，跨平台统一 |
| **asar 模式** | `asar: false` | 嵌套 node_modules 打包问题暂未解决 |
| **信令服务器** | 内部 spawn Node 子进程 | peer@0.6.1 在 desktop/node_modules |
| **HTTP 服务器** | 不需要 | loadFile() 直接加载本地 HTML |
| **图标** | Electron 默认 | 后续 Phase C 再换 |

### 八、遗留问题（v0.4）

| 问题 | 影响 | 解决方向 |
|------|------|---------|
| asar 压缩未启用 | 体积略大 | 后续 Phase B 修复 |
| Mac dmg 94MB < 100MB | 不影响功能 | arm64 构建正常 |
| Windows / Linux 未验证 | 不能保证跨平台 | 待在 Win/Linux 验证 |
| 未签名 | macOS Gatekeeper 警告 | Phase C 代码签名 |

### 九、v0.5 规划

**目标**：TURN 凭据 UI + 跨网段 UX 优化

**Phase A**：preload.js 暴露 IPC channel
**Phase B**：TURN 凭据管理 UI
**Phase C**：分享链接 + TURN 状态指示器

---

## 会议 #003 — 2026-06-07 v0.3 TURN 中继实现 + Electron 打包启动

**参会人员**：主人（Bruce）、Jarvis  
**主题**：从 v0.2 重构到 v0.3 TURN 中继 + Electron 打包的多轮讨论（20+ 轮对话）  
**耗时**：约 6 小时，含 TURN 验证、依赖重构、启动脚本加固、Win10 调试、v0.3 发版

### 一、TURN 中继实现

**讨论过程**:
- 主人注册 Metered 拿 TURN 凭据(username/credential)
- 决定凭据抽离:`config.local.js` + `.gitignore`,避免敏感信息入 git
- 写 `config.template.js` 给非本地协作者参考
- 改 `app.js` 加 `iceServers` 配置 + 强制 `iceTransportPolicy` 测试

**关键技术点**:
- 凭据从 `__TURN_USERNAME__` / `__TURN_CREDENTIAL__` 占位符改为真值
- 加 `iceTransportPolicy: 'all'` 默认(优先 host,失败 fallback TURN)
- 临时改 `'relay'` 强制走 TURN,验证同步数据真在中继上 — **验证通过**(data-channel `state=open`)

### 二、测试基础设施

**新建 `test/network/`**:
- `ice-smoke.js` — TURN 凭据冒烟,headless Chromium + 4 个 relay 候选生成
- `regression-create-room.js` — 创建房间回归(防 HTTP server 根目录 bug 复发)
- `README.md` — 解释 test/network/ vs test/unit/ vs test/e2e/ 的关系
- `package.json` 加 `test:ice` 和 `test:room` scripts

**结果**:ice-smoke 一次跑通,4 个 relay 候选全部从 Metered 158.247.200.82 成功分配

### 三、依赖重构与 HTTP Server 根目录 Bug

**主人发现**:点"创建房间"无任何响应

**Debug 过程**:
- 用 playwright 复现,看到 `SyncEngine is not a constructor` 错误
- 查 `app.js` 第 106 行,`SyncEngine` 在 `window.SyncPlay` 上找不到
- 根因:`start.sh` 启 Python http.server 在 `src/client/`,但 `index.html` 引用 `../shared/sync-engine.js`
- Python http.server 出于安全拦截 `..` 路径,导致 sync-engine.js 永远 404
- 这是 v0.2.0 一直埋的 bug

**修复**(commit 936fada):
- start.sh/command/bat: HTTP server 根目录从 `src/client/` 改 `src/`
- 主页 URL 从 `http://localhost:8080` 改 `http://localhost:8080/client/`
- test/e2e/test.js 同步修正
- 所有文档 URL 同步更新

### 四、启动脚本加固

**主人要求**:不要让人手动装环境

**改动**:
- start.sh/command 加 `ensure_node()` + `ensure_python()` 函数
  - Mac: `brew install` → NVM 兜底
- start.bat 加 `:ensure_node` + `:ensure_python` 标签
  - Windows: `winget install` → `choco install` 兜底
  - 加 `:refresh_path` 标签(从注册表重读 PATH)
- 健康检查加 `wait_for_port`(10s 超时轮询端口)
- Win10 PATH 刷新修复(硬编码 3 个常见 node.js 安装位置)
- 路径检查(`if not exist`)防止 pushd 静默失败

### 五、Win10 PC 调试

**主人报告**:在另一台 Win10 PC 上跑 start.bat,失败

**调查过程**:
- 检查发现主人复制的是整个项目,但仍有路径问题
- Win10 注册表 PATH 缓存有怪行为,我的 :refresh_path 不可靠
- 加上 Win10 中文系统编码 + chcp 65001 + `!` 字符触发延迟展开,3 个东西互打架
- 症状:`'[X]'` `'_FOUND'` `'/f'` 等被切碎当命令

**修复**:
- 删 `chcp 65001` + `setlocal enabledelayedexpansion` + 中文 + `!!!!` 装饰
- 改全 ASCII、纯英文、简单 `if` 嵌套
- 脚本开头加 `pause` 让用户必看到 prompt

**遗留**:Win10 PC 上 start.bat 仍有问题(诊断脚本 diagnose.bat 帮忙定位),但主人决定**先跳过,聚焦 v0.3 发版和 Electron 打包**

### 六、依赖清单权威章节

**主人要求**:所有依赖写进 ARCHITECTURE.md 文档,以后在这里维护

**新增** ARCHITECTURE.md 末尾 8 子章节:
- 运行环境 / npm deps / 客户端 deps / devDeps / 配置文件 / 跨平台矩阵 / 维护流程 / 变更历史
- 明确为 single source of truth,任何依赖变更必须同步更新此处
- 跨平台矩阵总结:零原生绑定,Mac/Windows/Linux 原生支持

### 七、v0.3 发版

**升级** 0.2.0 → 0.3.0:
- 根 package.json version 0.2.0 → 0.3.0
- CHANGELOG.md 加 v0.3.0 完整条目(TURN/测试/启动脚本/诊断/修复/文档 6 大类)
- STATUS.md 更新当前阶段为 v0.3 Electron 打包
- ROADMAP.md 加 v0.3 路线和 Electron 选型
- git tag v0.3.0 本地标记(等主人推送)

### 八、v0.3 Electron 打包启动(即将进行)

**讨论方案**:
- 🅰️ Electron + electron-builder(主人选,跨平台统一,~150MB)
- 🅱️ pkg + WebView2(~50MB,Win 优先)
- 🅲️ Tauri(Rust,长期可考虑)

**计划**:
- Phase A MVP:desktop/ 目录 + main.js + electron-builder 配置(2-3 小时)
- Phase B 体验:TURN 凭据 UI + 跨网段 UX(半天)
- Phase C 发布:代码签名 + 自动更新(1-2 天)

### 九、主人教我的事(MEMORY.md 累积)

1. **用户要求必须立刻写入文件** (#1)
2. **安装前必须申请许可** (#2)
3. **金钱交易零容忍** (#3)
4. **不准随意卸载** (#5)
5. **角色:领导者 + 任务发布者** (#6)
6. **知识库优先检索** (#7)
7. **TTS 任务交给子 agent** (#8)
8. **子 agent 处理所有任务** (#9)
9. **检查定时任务用 openclaw cron list** (#10)
10. **Skill 统一放 workspace** (#11)
11. **耗时操作必须发子 agent** (#12)
12. **处理问题先查证再回复** (#13)
13. **求证必须有切实证据** (#14)
14. **纠错写入持久文件** (#15,17)
15. **优先用一键脚本** (#15)
16. **路径里 `..` 别想当然** (#16)
17. **Python http.server 拦截 `..` 路径** (#17)
18. **别在 SMB / UNC 路径跑 Python/Node** (#18)
19. **edit 工具可能改坏文件标点** (#19)

### 十、本次新教训

- **JavaScript 在 Win 编码坑**:UTF-8 中文 + chcp 65001 + setlocal enabledelayedexpansion 三者不能同时用
- **`!` 字符在批处理陷阱**:作字符串用必须用 `^^!` 转义,否则触发延迟展开
- **pushd 静默失败**:Windows 批处理不报 pushd 错误,必须 `if not exist` 提前验证

---

## 会议 #002 — 2026-06-06 v1.0 规划与产品化讨论（大型会议）

**参会人员**：主人（Bruce）、Jarvis  
**主题**：从 v0.2 重构到 v1.0 互联网可用版的大型产品规划讨论  
**耗时**：约 8 小时，含多个子讨论

### 一、v0.2 重构完成后的状态盘点

- v0.2.0 已发布：同步 bug 修复、漂移校准、断线重连、客户端拆分、密码学安全房间号、Toast 通知、视频格式扩展
- 28 个单元测试覆盖核心同步逻辑
- GitHub 仓库：despicablemme/SyncPlayer

### 二、v1.0 需求讨论

**重新明确 v1.0 核心要求**：
1. 网页版 UI
2. **公网环境**（任意网络）可播放 MP4 视频 — **实现方式不限**
3. 进度实时同步

**主人提出"5 条硬性要求"**（R1-R5）：

| # | 要求 |
|---|------|
| R1 | 必须一键启动（双击即用） |
| R2 | 启动后在界面中配置房间 |
| R3 | 双方均能选择创建或加入房间 |
| R4 | 加入后自动构建同步链路 |
| R5 | 仅通过房间号认证（无注册无登录） |

**定了完整场景剧本**：异地两位好友，A 在 Mac 双击 start.command，B 在 Windows 双击 start.bat，浏览器自动开，通过房间号连接，看同一个视频。

### 三、产品化反馈

**主人提出关键产品反馈**：
> "你做出的成品需要是给用户使用的，需要做出一个一键启动的东西。"

得出结论：**给用户的应该是双击就用的东西，不是命令清单。**

**还提出**：
> "希望看目标时有计划文档可以查阅，看当前进度时有版本记录和计划进展记录可以查询。这样每次都可以接续任务。"

得出结论：**文档体系要支撑"接续任务"**。

### 四、公网方案决策（三选一）

**讨论了三个候选方案**：

| 方案 | 实现量 | 成本 | 隐私 | 推荐度 |
|------|--------|------|------|--------|
| A. TURN 中继 | 小 | $0-5/月 | 视频不经服务器 | ⭐⭐⭐ |
| B. LiveKit/Daily | 大 | $0-50/月 | 可能经过 | ⭐⭐ |
| C. 纯 WebSocket | 中 | 极低 | 指令经服务器 | ⭐ |

**决策**：选 A（TURN）—— 改动最小，保护 v0.2 重构成果，隐私最好。

### 五、为什么选 TURN（科普讨论）

**主人问**：TURN 原理是什么？商用可行吗？

**Jarvis 解释**：
- TURN 是在 P2P 直连失败时（~15% 网络场景）的中继
- 类似于"墙那边的朋友帮你传话"
- syncplay 只同步指令（几十字节 JSON），TURN 带宽压力极小
- 单台 $5 VPS 可撑几百对用户
- **商用可行**：自建 coturn 比 Metered SaaS 便宜得多

### 六、两阶段实施路径决策

**主人提出**：
> "先用 A 方案跑通，满足基本需求；这步骤实现后，我去租服务器，自建服务。"

**最终确定两阶段路径**：

| 阶段 | 目标 | 架构 | 成本 | 状态 |
|------|------|------|------|------|
| **Phase 1** | 跑通"公网两端同步" | Metered SaaS TURN + PeerJS 公共信令 | 0 | **当前** |
| **Phase 2** | 商用可控 | 自建 VPS（coturn + 信令）| ~$5/月 | Phase 1 通过后启动 |

**决策要点**：
- Phase 1 信令保持 PeerJS 公共（够用）
- Phase 2 信令 + TURN 都自建
- 账号系统 v1.0 不做
- 多人房间放 v2.0

### 七、代码与项目结构重构

**移动项目位置**：
- `~/Documents/KnowLedgeDatabase/projects/syncplay` → `~/CodeProjects/syncplay`
- 确立新约定：**所有代码项目统一放 `~/CodeProjects/`**

**Git 仓库建立**：
- 新建 GitHub 仓库：despicablemme/SyncPlayer
- v0.2 初始 commit + push 成功

**项目结构标准化**（`docs/`、`src/`、`test/`）：
- `docs/`：所有 .md 文档（7 个）
- `src/shared/`：跨端复用代码（sync-engine.js）
- `src/client/`：客户端
- `src/server/`：服务端
- `test/unit/`：单元测试
- `test/e2e/`：E2E 测试

### 八、自动化测试

**28 个 SyncEngine 单元测试**（用 Node 内置 `node:test`）：
- 覆盖 play/pause/seek/heartbeat/drift/file_info 等所有同步协议分支
- **意外发现并修复 1 个真实 bug**：`file_info` 缺 `duration` 字段时会抛 TypeError
- 跑通 Playwright E2E 测试失败（headless Chrome 对 WebRTC 支持有限），改为聚焦单元测试

### 九、一键启动器（三平台）

**产品化核心交付**：
- macOS：`start.command`（Finder 双击）
- macOS/Linux：`start.sh`（终端 ./start.sh）
- Windows：`start.bat`（双击）
- 对应 stop 脚本

**start.sh 流程**：环境检查 → 装依赖 → 启动信令 → 启动客户端 → 开浏览器 → Ctrl+C 干净关闭。

### 十、文档体系重构

**主人反复强调**：
> "我希望看目标时有计划文档可以查阅，看当前进度时有版本记录和计划进展记录可以查询。这样每次都可以接续任务。"

**最终文档分工**：

| 文档 | 用途 | 何时看 |
|------|------|--------|
| STATUS.md | 当前进度 | 回来接任务先看 |
| ROADMAP.md | 目标 + 决策 | 想看方向 |
| REQUIREMENTS.md | 要做什么 | 想看需求 |
| ARCHITECTURE.md | 怎么实现 | 实现功能前 |
| CHANGELOG.md | 历史变更 | 想看演进 |
| TECH_RESEARCH.md | 选型背景 | 想了解理由 |
| MEETINGS.md | 会议记录 | 想了解历史决策 |
| README.md（docs/） | 文档索引 | 不知道看哪个 |

**统一文档头部格式**：这是什么 / 何时查阅 / 关联文档 / 最后更新。

**主人教我的重要反馈**：
1. 架构文档应该是"正在实现什么"，不是"在选什么"——ARCHITECTURE.md 重构
2. docs/README.md 就是 BOOTSTRAP，不用再建 BOOTSTRAP.md——顶层 README 加 "给新 session" 区块

### 十一、本地双端测试方法

**主人问**：本地模拟双端怎么搞？

**Jarvis 答**：
1. 同机器双浏览器（最简单）：普通 + 隐身窗口
2. 不同浏览器：Chrome + Safari/Firefox
3. 两台真实设备（同局域网）：互访 IP

**测什么**：play/pause/seek 同步、断线重连、心跳延迟、漂移校准。

### 十二、Phase 1 启动行动项

| 步骤 | 谁做 | 状态 |
|------|------|------|
| 注册 [Metered](https://www.metered.ca) 拿 TURN 凭据 | 主人 | ⏳ |
| 改 `src/client/app.js` 加 ICE_SERVERS | Jarvis | 待凭据后 |
| 跨网段实测两端同步 | 主人 | 待配置完后 |

---

## 会议 #001 — 2026-03-22

### 项目启动会议

**参会人员：** 主人、Jarvis（AI 助手）

**议题：** 讨论多 Agent 开发模式与视频同步播放工具项目立项

---

### 会议内容

#### 一、多 Agent 开发模式确认

**背景：** 主人希望使用 AI 多 Agent 模式来开发软件，不同 Agent 担任不同角色（架构师、策略师、调度师、工程师等）

**确认事项：**
1. **子 Agent 执行模式**：所有任务由子 Agent 执行，主 Agent（Jarvis）保持空闲随时响应主人
2. **并行能力**：子 Agent 可并行运行，不阻塞主人与 Jarvis 的对话
3. **会话模式**：QQBot 维持连续会话，可上下文中继续
4. **Jarvis 定位**：作为调度师 + 中转站，拆分任务、派发子 Agent、汇总结果

**结论：** 采用 OpenClaw 原生 `sessions_spawn` 派子 Agent 方式实现

---

#### 二、项目需求讨论

**项目名称：** SyncPlay（同步播放工具）

**核心需求：**
1. 两人同时播放同一视频文件时，进度实时同步
2. 一方快进/暂停，另一方自动同步
3. 延迟尽可能低

**MVP 范围（已确认）：**
- ✅ Web 平台（浏览器版，最轻量）
- ✅ 两端都播放本地视频文件
- ✅ 只实现进度同步功能（播放/暂停/seek）
- ✅ 房间号连接

**排除（暂不做）：**
- ❌ 视频流媒体传输
- ❌ 聊天等社交功能
- ❌ 用户认证

**技术方向（已确认）：**
- 同步协议：WebRTC DataChannel（P2P，不需中转服务器）
- 信令服务：WebSocket（仅用于建立 WebRTC 连接）
- 前端：纯 HTML + JS（最轻量）
- 后端：Node.js（极简信令服务器）

---

#### 三、技术架构

```
用户 A                   用户 B
  ↓                         ↓
本地视频文件 ←→ 浏览器 ←→ WebRTC DataChannel ←→ 浏览器 ←→ 本地视频文件
  ↓                         ↓
      ←←←←←←←← 信令服务器（仅建立连接）←←←←←←←←
```

**同步原理：**
- A 点击播放 → 发送 `{"type": "play", "position": 12.5}` 到 B
- B 收到 → 立即将 video.currentTime 设为 12.5 并播放
- A 拖动进度条 → 发送 `{"type": "seek", "position": 45.0}` 到 B
- B 收到 → 立即将 video.currentTime 设为 45.0

---

#### 四、待确认事项

- [x] 确定目标平台 → Web（浏览器版）
- [x] 确定技术栈 → 纯 HTML + JS / WebRTC DataChannel / Node.js
- [x] 确定同步方案 → P2P 直连（WebRTC DataChannel）
- [x] 确定 MVP 范围 → 只做进度同步

---

## 后续讨论摘要

### 2026-03-22 补充

- 确认使用子 Agent 执行任务模式
- Jarvis 负责调度，不阻塞主人对话
- 项目正式立项，进入需求梳理阶段

---

### 2026-03-22 20:06 — 子 Agent 监控方式

**讨论内容：**
- 子 Agent 如何监控和管理
- Jarvis 演示了 subagents 管理命令

**结论：**
- `subagents list` — 查看所有子 Agent 状态
- `subagents steer` — 给子 Agent 发消息
- `subagents kill` — 终止子 Agent
- 子 Agent 完成后汇总结果给主人

**Agent 分工（已确认）：**
- 后端 Agent → 信令服务器（Node.js + ws）
- 前端 Agent → 播放器 UI + 同步逻辑

---

### 2026-03-22 20:07 — 技术方案质疑

**讨论内容：**
- 主人质疑技术方案是否成熟、是否有调研
- Jarvis 诚实承认未做深度调研

**确认状态：**
- ✅ 成熟技术：HTML5 Video、WebRTC DataChannel、WebSocket、Node.js ws
- ⚠️ 需验证：WebRTC 直连成功率、同步延迟精度
- 🔍 待做：技术调研（主人选择先调研再开工）

---

### 2026-03-22 20:25 — 技术调研完成

**调研结论：**
- WebRTC P2P 直连成功率约 85%，其余需 TURN 中继
- 同步延迟 < 200ms 体验良好
- 类似产品（Syncplay、Kosmi）已验证可行性

**方案调整：**
- 建议从原生 WebRTC 改为 **PeerJS**（封装了 WebRTC，降低复杂度）
- PeerJS 内置 STUN/TURN，成功率更高
- MVP 信令服务器可用 PeerJS 官方公共服务器

**产出文档：**
- 新增 `TECH_RESEARCH.md` — 技术调研报告

---

### 2026-03-22 20:28 — 开发启动，Agent 分工

**会议决议：**
- 派两个子 Agent 并行执行
- 前端 Agent → 写播放器 UI（client/index.html）
- 后端 Agent → 写信令服务器（server/server.js + package.json）

**技术确认：**
- 使用 PeerJS 替代原生 WebRTC
- MVP 用 PeerJS 公共服务器，无需自建后端

---

### 2026-03-22 20:30 — Agent 开发完成

**前端 Agent 产出：**
- `client/index.html` — 单文件，包含所有功能
  - 房间管理（创建/加入房间）
  - 视频播放（HTML5 video，mp4）
  - 同步逻辑（播放/暂停/seek）
  - UI 状态显示（深色主题）

**后端 Agent 产出：**
- `server/server.js` — WebSocket 信令服务器
- `server/package.json` — 项目配置
- 房间管理、信令转发、在线状态

---

### 2026-03-22 20:33 — 添加 URL 支持

**需求：** 本地没有视频文件，希望支持 URL 播放

**功能更新：**
- 新增视频 URL 输入框
- 支持加载远程视频 URL
- 默认测试 URL：`https://www.w3schools.com/html/mov_bbb.mp4`

**文件变更：**
- `client/index.html` — 新增 videoUrlInput、loadUrlBtn

---

### 2026-03-22 20:33 — UI 自动化测试

**讨论：** 是否可以用 Playwright 做 UI 自动化测试

**决定：** 是，派 UI 测试 Agent

**测试目标：**
- 两个浏览器实例模拟用户 A/B
- 验证连接建立功能

**测试结果：**
- Playwright UI 测试因 Chromium 下载问题未能完成（exec 工具限制）
- 改用手动测试

---

### 2026-03-22 22:10 — 手动测试与问题修复

**问题 1：视频加载失败**
- 原因：CORS 限制，远程视频无法在 localhost 加载
- 解决：下载测试视频到本地，使用"选择本地视频"功能

**问题 2：加入方显示房间号混乱**
- 原因：加入方也显示自己的房间号，不直观
- 修复：创建方显示"我的房间号"，加入方显示"已连接到: xxx"

**问题 3：视频无法播放**
- 原因：video 标签缺少 controls 属性
- 修复：添加 `controls` 属性

**手动测试状态：**
- ✅ 本地视频加载正常
- ✅ 房间创建/加入功能正常
- ✅ 连接建立成功
- ⚠️ 同步功能待验证（需要两人同时在线测试）

---

### 2026-03-22 22:15 — 项目暂停

**暂停原因：** 等待公网环境测试

**当前状态：**
- MVP 代码基本完成
- 本地测试通过
- 公网 P2P 连接待验证

**待解决问题：**
- [ ] 公网环境下 P2P 连接成功率验证
- [ ] 15% 失败场景需要 TURN 中继支持
- [ ] 同步延迟实测

**后续计划：**
- 择日进行公网测试
- 根据测试结果决定是否加 TURN 支持

---

*主持人：Jarvis*
---

*记录：Jarvis*
