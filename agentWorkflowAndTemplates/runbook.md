# Runbook — 主 agent 处理"任何目标"的标准流程

> **这是什么？** 主 agent (Jarvis) 接到主人任何目标（v0.6 / v0.7 / 新功能 / bug fix / 架构调整）后的**通用 3 阶段流程**。
> **何时使用？** 主人说"下一个目标 = X" 之后, 主 agent **第一件事**就是读本文件, 然后照着跑。
> **适用范围：** **所有目标** (不是某个版本专属)。
> **最后更新：** 2026-06-13 (v3 工作流修订: 阶段 A 完 → 全自动 B → C → D debug build 出, 主人 2026-06-13 22:20 决策)

---

## 🚦 一句话

**3 阶段: 计划 (先写文档) → 实现 (只做事不更新 docs) → 完工 (统一更新所有 docs)**。

**核心原则：docs 是"事实记录", 不是"进度中转站"**——做事过程中**不**更新 docs, 只在"计划时"和"全部完工时"更新。

---

## 📁 文件上库决策规则 (主 agent 必先想)

**任何目标开始前, 主 agent 必须先决定: 这个文件/文档/任务是"通用型"还是"任务实例"?**

### 决策树

```
这个文件是:
├─ 任何任务都用的工具/规范/模板?
│   ├─ 是 → 上库 (跟 runbook 一样放 agentWorkflowAndTemplates/)
│   │       例子: runbook.md / templates/builder-task.md / roles.md
│   └─ 否 → 看下一项
│
└─ 是为某次具体任务写的 (任务书 / context 摘要 / tester 报告)?
    ├─ 是 → **不上库**, 放 .agent-tasks/<version>/
    │       例子: v0.6.0-room-exit-builder.md / tester report
    └─ 否 → 看下一项

└─ 是项目代码/需求/架构/会议纪要 (syncplay 本身的)?
    ├─ 是 → 上库, 放 docs/ (per runbook 阶段 A/C 规则)
    │       例子: docs/MEETINGS.md / docs/ROADMAP.md / docs/REQUIREMENTS.md
    └─ 否 → 看下一项

└─ 是临时调试/日志/构建产物?
    └─ → .gitignore 排除, 不入仓库
            例子: node_modules/ / dist/ / .agent-tasks/ / .env
```

### 通用 vs 任务实例 边界 (主 agent 必记住)

| 类别 | 存放位置 | 是否上库 | 例子 |
|---|---|---|---|
| **通用工作流文档** | `agentWorkflowAndTemplates/` | ✅ 上库 | runbook.md / workflow.md / roles.md / control-claude.md / acceptance.md / reporting.md |
| **通用模板** | `agentWorkflowAndTemplates/templates/` | ✅ 上库 | builder-task.md / tester-task.md / context-summary.md / test-report.md / commit-message.md |
| **项目代码** | `src/` / `desktop/` / `test/` | ✅ 上库 | 实际产品代码 |
| **项目需求/架构/路线图** | `docs/` | ✅ 上库 (per runbook 阶段 A/C 规则) | REQUIREMENTS.md / ROADMAP.md / STATUS.md / ARCHITECTURE.md / CHANGELOG.md / MEETINGS.md / AGENT_PRACTICES.md |
| **任务实例 (任务书/context/tester报告)** | `syncplay/.agent-tasks/<version>/` | ❌ **不上库** | v0.6.0-room-exit-builder.md / v0.6.0-room-exit-context.md / v0.6.0-room-exit-tester.md |
| **临时构建产物/配置** | `node_modules/` / `dist/` / `.env` | ❌ 上 .gitignore | 任何"项目需要但 git 不跟踪" |

### 推论

1. **任务书不 commit** — 一次性的、给 Claude Code 跑的指令, 跟 git 无关
2. **任务书不放仓库根** — 仓库根的 `tasks/` 目录**不**应该存在, 避免混淆
3. **任务书放 `.agent-tasks/`** — 物理上在项目里 (subagent 容易读), 但 `.gitignore` 排除
4. **每个版本新建子目录** — `.agent-tasks/v0.6.0/` / `.agent-tasks/v0.7.0/` / etc.
5. **任务书过期不清理** — 让 git 历史自然, 不主动 rm (主 agent 一次任务, 任务书就走完流程)

### 反模式 (主 agent 必避)

| ❌ 反模式 | 为什么错 |
|---|---|
| 把任务书 commit 到仓库 | 任务书是临时文件, 混进 git 历史造成 reviewer 噪音 |
| 把任务书放 `docs/` | 跟项目文档混淆 (项目文档是"事实记录", 任务书是"工作流产物") |
| 把任务书放 `agentWorkflowAndTemplates/tasks/` | 跟通用模板混淆, 未来版本会堆很多废弃 |
| 任务书命名不带版本 (如 `tasks/builder-task.md`) | 看不出是哪个版本的, 容易混 |
| 每个任务书单独 .gitignore | 麻烦, 用 `.agent-tasks/` 整个目录 ignore 干净 |

### 配套 .gitignore 规则

```gitignore
# Agent 工作产物 (任务书 / context 摘要 / tester 报告 等)
# 通用工作流模板在 agentWorkflowAndTemplates/ (上库), 这个目录是**具体任务实例** (不上库)
.agent-tasks/
```

(per 主人 2026-06-09 确认方案 1)

### 主 agent 检查清单 (写任何新文件前)

- [ ] 这是"任何任务都用得上"的吗?
  - 是 → 放 `agentWorkflowAndTemplates/` + commit
- [ ] 这是"为这次任务写的"吗?
  - 是 → 放 `.agent-tasks/<version>/` + .gitignore 排除
- [ ] 这是"项目代码/需求/会议纪要"吗?
  - 是 → 放 `src/` / `docs/` + per runbook 阶段 A/C 规则 + commit
- [ ] 这是"临时构建/日志"吗?
  - 是 → 放对应目录 + .gitignore 排除

---

## 🎯 模式选择: Native subagent vs ACP harness (v0.6+ 推荐 ACP)

**2026-06-09 主人决定**: 后续 v0.6+ 任务用 **ACP harness 模式** (`runtime: "acp"`) 跑 Claude Code, **不用** native subagent (`runtime: "subagent"`)。

**理由** (主人原话 "后续可以直接使用 ACP harness 模式控制 claude 吗"):
- ACP 模式让 OpenClaw **直接**控制外部 Claude Code 进程
- 主 agent 能通过 `streamTo: "parent"` 实时看 Claude Code 进度
- 中途可用 `/acp steer` 改方向 (native subagent 做不到)
- 直接用 Claude Code 自己的 model + filesystem + tools (no 中间层)

### 两种模式对比

| 维度 | Native subagent (`runtime: "subagent"`) | ACP harness (`runtime: "acp"`) |
|---|---|---|
| **跑什么** | OpenClaw sub-agent (我派的 worker) | **外部 Claude Code CLI 进程** |
| **session key 格式** | `agent:main:subagent:<uuid>` | `agent:claude:acp:<uuid>` (用 `agentId` 作 prefix) |
| **认证** | OpenClaw 自己的 `ANTHROPIC_AUTH_TOKEN` | Claude Code 自己的 auth (`~/.claude/settings.json` 9 项 env) |
| **model** | 继承主 agent (MiniMax-M3) | **Claude Code 自己的 model** (用 host Claude Code 配置) |
| **tools** | OpenClaw 工具 + 我传的 task | **Claude Code 自己的 tools** (Read/Edit/Bash) |
| **filesystem** | 间接 (subagent 跑 `claude -p`) | **直接** (Claude Code 原生 fs) |
| **Visibility (主会话)** | ❌ 主 agent 看不到内部 (主人原痛点) | ✅ `streamTo: "parent"` 实时回流 |
| **中途改方向** | ❌ 要 abort 重派 | ✅ `/acp steer <msg>` 直接 steer |
| **可中断** | ✅ (`/stop`) | ✅ (`/acp cancel` 当前 turn / `/acp close` 关 session) |
| **任务隔离 context** | ✅ 默认 isolated | ✅ 默认 isolated |
| **失败重试** | ✅ (主 agent 重派) | ✅ (主 agent 重派) |

### 何时用哪种

| 场景 | 推荐模式 | 理由 |
|---|---|---|
| **当前 v0.6 子任务 (FR-1 已完工, FR-2/3 待跑)** | **ACP** | visibility 优势 + 主人实时看 + 中途 steer |
| **简单原子任务** (< 1 分钟, 不需要多轮交互) | Native subagent | 简单, ACP 首次要下载 adapter, 慢 |
| **复杂长 session 任务** (多轮 edit + test + commit) | **ACP** | 中途可 steer, 不浪费已完成工作 |
| **非 Claude Code harness** (Gemini CLI / Cursor / Droid) | **ACP** (per harness id) | ACP 是外部 harness 的统一接口 |
| **需要 OpenClaw 工具** (memory / schedule / 通知) | Native subagent | ACP 默认不暴露 OpenClaw 工具 |

### ACP 启用步骤 (一次性配置)

```bash
# 1. 装 acpx plugin
openclaw plugins install @openclaw/acpx

# 2. 启用
openclaw config set plugins.entries.acpx.enabled true

# 3. 重启 gateway
openclaw gateway restart

# 4. 验证 (主人在 webchat 跑, 这是 chat slash command)
# /acp doctor
# 应输出: enabled, healthy backend, Claude Code auth present
```

**主 agent 验证** (用 API 不是 slash):
```bash
# 派 trivial smoke test
sessions_spawn({
  task: "echo hello from ACP",
  taskName: "acp-smoke-test",
  runtime: "acp",
  agentId: "claude"  # 必填, 不填报 "target_agent_required"
})
```

### 跑 ACP 任务的正确用法

**主 agent 派活** (`sessions_spawn` API):
```typescript
// 关键: runtime + agentId 都必填
await sessions_spawn({
  task: "<builder 任务书 + context 摘要>",  // 任务书在 .agent-tasks/<version>/
  taskName: "builder-v060-url-bug",  // taskName 不含点 (per #16 后修)
  label: "Builder: v0.6.0-url-bug (FR-2)",
  runtime: "acp",  // ← 关键
  agentId: "claude",  // ← 关键 (不填报 target_agent_required)
  streamTo: "parent",  // ← 必加 (主人 2026-06-09 决定, per #19 教训), 主 agent 收实时 stream
  mode: "run"
});
await sessions_yield();  // 等完工事件
```

**主人在 webchat 用 slash command**:
```
/acp spawn claude --bind here
# 持续在 bound conversation, /acp status, /acp model <id>, /acp steer <msg>
```

### ACP 模式注意事项

1. **首次跑 ACP 要下载 Claude Code 适配器** —— `Other target harness adapters may still be fetched on demand with npx the first time you use them`
2. **request 不能 sandboxed** —— `OpenClaw hides runtime: "acp" until ... the current session must not be sandbox-blocked`
3. **ACP 默认不暴露 OpenClaw 工具** —— `OpenClaw plugin tools and built-in OpenClaw tools are not exposed to ACP harnesses by default` (要显式 enable MCP bridges)
4. **model 跟 Claude Code host 配置走** —— 不是 OpenClaw 的 model
5. **权限 profile 需配** —— `Non-interactive sessions cannot click native permission prompts, so write/exec-heavy coding runs usually need an ACPX permission profile`
6. **首次跑比较慢** —— 下载 adapter + 验证 + spawn, 后续快

### 跟 native subagent 模式**主 agent 任务书模板差异**

任务书 (`tasks/<version>-<task>-builder.md`) **可以共用** — builder 任务书里的:
- ✅ 必读 context (绝对路径)
- ✅ 自我验证段 (Claude Code 读完 stdout 输出)
- ✅ 禁区 (docs/STATUS.md 等)
- ✅ BUILDER_DONE 标记
- ✅ unit test 跑通

**完全一样**。唯一区别: subagent 任务书里**不**用 `--add-dir` flag (ACP 模式 Claude Code 用 host cwd)。

### v0.6+ 推荐策略

| 阶段 | 模式 |
|---|---|
| v0.6 子任务 B (FR-2 URL bug) | **ACP** (新策略, 验证) |
| v0.6 子任务 C (FR-3 视频解耦) | **ACP** (per B 体验决定) |
| **v0.6.1 / v0.7+ 必加 `streamTo: "parent"`** | **统一 ACP + streamTo** |
| 简单调试 / 实验 | Native subagent (更轻) |

> ⚠️ **2026-06-09 主人决定**: **以后所有 ACP spawn 必加 `streamTo: "parent"`** (主 agent 收实时 stream, 关键节点汇报主人). 见 `control-claude.md` ACP 段 + AGENT_PRACTICES #19.

### 沉淀

- **AGENT_PRACTICES.md 后续加 #18**: ACP 启用步骤 + agentId 必填 + session key 格式区别
- **control-claude.md 加 ACP 段**: 与 native subagent 对比, 怎么用 `runtime: "acp"`
- **runbook.md 已有本段** (就是当前看的)

---

## 📊 完整 3 阶段流程图

```
┌─────────────────────────────────────────────────┐
│  阶段 A: 落实目标 (plan/讨论) [v2, 2026-06-13]  │
│  ─────────────────────────────────────          │
│  [A1] 主人说"现象 + 要求" (不给方案)           │
│         ↓                                       │
│  [A2] 主 agent: 派 Claude 出"完整可行的         │
│         技术方案/修复方案" (ACP harness)         │
│         - runtime: "acp", agentId: "claude"     │
│         - streamTo: "parent"                    │
│         - --add-dir /Users/bruce/.../syncplay    │
│         ↓                                       │
│  [A3] Claude 方案给主人 + 主 agent (双轮 1)     │
│         ↓                                       │
│  [A4] 主人 + 主 agent 一起基于方案讨论 + 决定   │
│         ↓                                       │
│  [A5] 决定后: 回流我们的意见给 Claude            │
│         (含最终决定 + 偏好 + why)               │
│         ↓                                       │
│  [A6] Claude 根据意见制定"最终执行方案和步骤"   │
│         (具体任务清单 + 实施步骤) (双轮 2)       │
│         ↓                                       │
│  [A7] 主 agent: 写 MEETINGS 纪要 (记录决定)     │
│    - MEETINGS.md 会议纪要 (含 Claude 初稿 + 讨论 │
│      + 决定 + Claude 最终执行方案 + why)         │
│    - ROADMAP.md (路线图更新)                    │
│    - 其他相关 docs                               │
│         ↓                                       │
│  [A8] commit + push "plan: <目标> 计划 + 纪要"  │
│         ↓                                       │
│  ❌ 不写任务书  ❌ 不派 Builder/Tester          │
│  ❌ 不动 STATUS  ❌ 不让 Claude 直接做事        │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│  阶段 B: 实现 (做事) [v2, 2026-06-13]            │
│  ───────────────────────────────                │
│  [B0] 拆任务 — **根据阶段 A Claude 的最终执行   │
│         方案** 决定每个子步骤 (不是主 agent 自己 │
│         拆, 而是按 A6 Claude 给的任务清单)       │
│         ↓                                       │
│  [B-prep] 写 3 文件 × N:                         │
│    - tasks/<id>-builder.md                       │
│    - tasks/<id>-context.md                       │
│    - tasks/<id>-tester.md                        │
│         ↓                                       │
│  commit + push 任务书                            │
│         ↓                                       │
│  对每个子任务 serial 跑:                          │
│    [B1] 派 subagent 1 (Builder orchestrator)      │
│         ↓ 跑 claude --add-dir ... -p "<builder>"│
│    [B2] 立刻查交付 (per #20) + 汇报主人          │
│         ↓                                       │
│    [B3] 派 subagent 2 (Tester orchestrator)      │
│         ↓ 跑 claude --add-dir ... -p "<tester>" │
│    [B4] 验收 (Reviewer 角色)                     │
│         ↓                                       │
│    [B5] 决策: PASS / NEED FIX / FAIL             │
│         ↓ PASS: 子任务 commit (只代码 + 任务书)  │
│         ↓ NEED FIX: 派新 Builder, 回到 B1        │
│         ↓ FAIL: 记录到 AGENT_PRACTICES, 报告     │
│         ↓                                       │
│  重复 B1-B5 直到全部 N 个子任务 PASS             │
│         ↓                                       │
│  ❌ 做事过程中**不**更新 docs/STATUS/CHANGELOG   │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│  阶段 C: 完工 (更新 docs)                         │
│  ─────────────────────────                       │
│  全部子任务 PASS 后, 主 agent 一次性更新:        │
│    - STATUS.md (vX → ✅ Shipped)                 │
│    - ROADMAP.md (vX → ✅, vX+1 → 🎯 next)        │
│    - CHANGELOG.md (vX release 条目)              │
│    - ARCHITECTURE.md (如架构变)                  │
│    - AGENT_PRACTICES.md (如有新教训)             │
│    - MEETINGS.md (vX 完工纪要)                   │
│         ↓                                       │
│  commit + push                                  │
│         ↓                                       │
│  跟主人汇报完工 (per reporting.md)               │
│         ↓                                       │
│  主 agent 准备接下一个目标                        │
└─────────────────────────────────────────────────┘
```

---

## 🎯 阶段 A: 落实目标 (plan/讨论) — 主 agent 详细动作

### 做什么 (v2 — 主人 2026-06-13 修订)

1. **[A1] 主人说"现象 + 要求"** — 主人只描述问题/需求, **不**给方案 (主 agent 也不要自己出方案)
2. **[A2] 主 agent: 派 Claude 出"完整可行的技术方案/修复方案"** (双轮的第 1 轮)
   - 用 ACP harness 模式: `runtime: "acp"`, `agentId: "claude"`, `streamTo: "parent"`
   - `claude --add-dir /Users/bruce/CodeProjects/syncplay -p "<任务描述>"`
   - 任务描述要明确: "请基于以下现象 + 要求, 给出**完整可行的技术方案/修复方案** (诊断 + 修复步骤 + 测试验证 + 风险评估 + trade-off 选项)"
3. **[A3] Claude 方案给主人 + 主 agent 两人** — 主 agent 整理 Claude 输出, 给主人完整摘要
4. **[A4] 主人 + 主 agent 一起基于方案讨论 + 决定** — 讨论 trade-off, 拍板方案 (派活的 trade-off 决策走主 agent 跟主人一轮对话)
5. **[A5] 决定后: 回流我们的意见给 Claude** — 主 agent 用 `sessions_send` 把"决定 + 偏好 + why" 发回给 Claude session
6. **[A6] Claude 根据意见制定"最终执行方案和步骤"** (双轮的第 2 轮) — 具体任务清单 + 实施步骤 (后续阶段 B 拆任务的依据)
7. **[A7] 主 agent: 写 MEETINGS 纪要** (plan 类)：
   - `docs/MEETINGS.md` — 会议纪要 (含 Claude 初稿摘要 + 我们讨论 + 决定 + Claude 最终执行方案 + why)
   - `docs/ROADMAP.md` — 路线图更新
   - `docs/REQUIREMENTS.md` — 需求变更（如果有）
   - 其他相关 docs（如 `docs/TECH_RESEARCH.md` 如有技术调研）
8. **[A8] commit + push**:
   ```bash
   cd ~/CodeProjects/syncplay
   git add docs/ROADMAP.md docs/REQUIREMENTS.md docs/MEETINGS.md
   git commit -m "plan(<目标-id>): <一句话目标> + 会议纪要 (含 Claude 双轮方案)"
   git push origin main
   # 验证 (per #15)
   git fetch origin main
   git rev-parse main origin/main  # 必须一致
   ```

### 不做什么

- ❌ **主 agent 自己出诊断/修复方案** — 这是 Claude 的活
- ❌ **主人给方案** — 主人只给现象 + 要求
- ❌ **跳过 Claude 派活, 直接做事** — 必须先走 A2-A6
- ❌ 写任务书 (阶段 B 才写)
- ❌ 派 Builder/Tester (阶段 B 才派)
- ❌ 更新 STATUS.md (阶段 C 才更新 — STATUS 反映"已完成", 不是"计划中")
- ❌ 写 CHANGELOG (阶段 C 才写)
- ❌ 让 Claude Code 写代码 (阶段 B 才让)

### 主人介入点

- **2 次** (升级自原 1 次):
  1. 阶段 A4 — 跟主 agent 一起基于 Claude 初稿讨论 trade-off, 拍板
  2. 阶段 A6 之后 — review Claude 最终执行方案 (可选, 信任则免)
- 总耗时增加: 5-15 → 15-40 分钟 (双轮 Claude)

### 耗时

15-40 分钟 (双轮 Claude 各 5-15 分钟 + 主人决策 + 写 MEETINGS)

### 关键决策: 何时跳过 Claude, 主 agent 直接做

- **纯 docs 收尾** (如 v0.6.1 阶段 C 收尾, 升 package.json + 改 4 docs) — **不**走新流程, 主 agent 直接做
- **流程修订** (如改 runbook.md) — **不**走新流程, 主 agent 直接做
- **bug 修复 / 新需求** — **必须**走新流程 (A1-A8 完整)

---

## 🎯 阶段 B: 实现 (做事) — 主 agent 详细动作

### 做什么 [v3, 2026-06-13 22:20 修订]

> **v3 核心**: A 阶段**完**后 (主人 + Jarvis 经 Claude 确认最终方案 + 落实 MEETINGS 纪要), 阶段 B/C/D **全自动向下执行**, 遇到 bug 自动修, 测试不通过自动修, 除非**无法解决的错误**才通知主人. **debug 版本出**才停, 通知主人验收. release 仍需主人确认.

#### B0: 拆任务 [v2, 2026-06-13 修订]

- **拆任务的依据 = 阶段 A Claude 的"最终执行方案和步骤" (A6 产出)**
  - 不是主 agent 自己拆
  - Claude 在 A6 已经定好了"具体任务清单 + 实施步骤", 主 agent 把它**转成** N 个原子子任务
- 每个子任务 = 1 个 git commit, 1-3 个文件, 1 个明确功能
- 给每个 ID: `<目标-id>-<sub-id>`（如 `v0.6.0-macos-install-doc-1`）
- **不**太大不**太小**（太大拆小, 太小合并）
- N 的数量 = Claude A6 给的子任务数
- 每个子任务的**实现内容** = Claude A6 给的具体步骤

### B 阶段自动执行规则 (v3)

- **全自动链**: B1 (派 Builder) → B2 (查交付 + 汇报) → B3 (派 Tester) → B4 (验收) → B5 (commit + push) → 串行跑完 N 个子任务
- **除非遇到无法解决的错误** (e.g. 网络/磁盘/CI 永久失败, 权限阻塞, 3 次重试都 FAIL), **不**通知主人
- **bug 自动修**: 子任务实施时发现非预期 bug → 主 agent 评估, 如果是当前子任务范围内 → 主 agent 修; 如果超出范围 → 开新子任务 (per B0 拆任务)
- **测试不通过自动修**: Tester 报 FAIL → 主 agent 看测试报告 → 如果是实施方案错 (代码 bug) → 派 NEED FIX Builder 重做 (per B5); 如果是任务书错 (预期错) → 改任务书 + 重派; 如果是测试错 (Tester 自己写错) → 派新 Tester
- **通知主人的条件** (per MEMORY #28/#29 + v3): 异常 (FAIL / 方向缺失 / 关键 trade-off) 或 **debug 版本出** 才通知

### 主 agent 责任 (v3)

- ✅ 派 subagent 跑代码改动前, **必**先 verify environment (per #30):
  - `brew list gh` 验证 gh CLI
  - `security find-internet-password -s github.com -w` 探 Keychain token
  - `openclaw config get plugins.entries.github` 检查 OpenClaw GitHub 集成
  - 缺啥装啥 (主 agent 自己做, 不问主人)
- ✅ 派 Builder/Tester 前必 verify environment, 避免 v0.6.2 release 误触发的失误
- ✅ 中间任何问题, 主 agent 评估 + 自己修 (per #10 subagent 失败主 agent 接手 模式)
- ✅ **不**卡住问主人 "debug 怎么 trigger" 之类的"环境限制"问题 (per v3 主人原话)

#### B-prep: 写任务书 (3 文件 × N)

- 用 `templates/builder-task.md` 写 `tasks/<id>-builder.md`
- 用 `templates/context-summary.md` 写 `tasks/<id>-context.md`
- 用 `templates/tester-task.md` 写 `tasks/<id>-tester.md`
- **任务书内容依据 = 阶段 A Claude 的"最终执行方案和步骤" (A6 产出)**
  - 每个 builder 任务书的"实现内容"段 = Claude A6 给该子任务的具体步骤
  - 每个 tester 任务书的"验证清单"段 = Claude A6 给该子任务的测试验证方案
- 关键约束:
  - 必读 context 用**绝对路径** (`/Users/bruce/...`) 不依赖 `~` (per #16)
  - 任务书**必含**"自我验证"段 (per #16)
  - 任务书**明确**列禁区 (Builder 改了 = NEED FIX)
- **先** commit + push 任务书 (subagent 拿不到不开始)

#### B1-B5: 对每个子任务 serial 跑

**B1: 派 Builder subagent**

```typescript
// ⚠️ --add-dir 必加 (per AGENT_PRACTICES #16)
await sessions_spawn({
  task: `
    你是 Builder orchestrator.
    1. claude --add-dir /Users/bruce/CodeProjects/syncplay -p "$(cat tasks/<id>-builder.md tasks/<id>-context.md)"
    2. 抓 BUILDER_DONE: <sha> 标记
    3. 验证 commit: git log -1, git show --stat
    4. 报告 commit-sha / 改了哪些文件 / unit test 结果
    ❌ 不让 Claude Code 改 docs/STATUS.md / CHANGELOG / AGENT_PRACTICES.md
    ❌ 不让 Claude Code git push
    ✅ 跑完立刻 push 完工事件给 Jarvis (per #20)
  `,
  taskName: "builder-<id>",
  runtime: "subagent",
  mode: "run"
});
await sessions_yield();  // 等完工事件
```

**B2: 立刻查交付 + 汇报主人**

- 收到 subagent 1 完工事件
- 立刻读 subagent 1 报告 (commit-sha + 改了哪些文件)
- 跟主人汇报 (per reporting.md):
  ```
  ## Builder 完工 (<id>)
  ### ✅ commit `<sha>`
  <commit message>
  ### 关键内容
  - 改了 <file1>, <file2>
  - unit test: N passed
  ### 下一步
  派 Tester 跑 (独立 context) — 等完工事件
  ```

**B3: 派 Tester subagent (SERIAL, 不并行)**

```typescript
// ⚠️ 必须在 subagent 1 完工事件后
await sessions_spawn({
  task: `
    你是 Tester orchestrator (fresh context).
    ⚠️ 不要让 Claude Code 读 builder conversation / builder context
    1. claude --add-dir /Users/bruce/CodeProjects/syncplay -p "$(cat tasks/<id>-tester.md)"
    2. 让 Claude Code 写报告到 tasks/<id>-test-report.md
    3. 抓 TESTER_DONE: <path> 标记
    4. 报告: 报告路径 / PASS/FAIL / 关键发现
    ❌ 不让 Claude Code 改源代码 / docs/ / git push
  `,
  taskName: "tester-<id>",
  runtime: "subagent",
  mode: "run"
});
await sessions_yield();  // 等完工事件
```

**B4: 验收 (Reviewer 角色)**

- 读 Builder commit: `git -C ~/CodeProjects/syncplay show HEAD`
- 读 Tester 报告
- 按 `acceptance.md` 清单逐项核对:
  - [ ] Builder commit 存在, message 规范 (per commit-message.md)
  - [ ] Builder **没改禁区** (docs/STATUS.md / CHANGELOG.md / AGENT_PRACTICES.md)
  - [ ] unit test 跑通
  - [ ] Tester 报告每项验证有 PASS/FAIL + 证据
  - [ ] 任务书每个验收标准都达成
  - [ ] 没超范围改动
  - [ ] commit 不超 500 行（除非明确）

**B5: 决策 + 后续**

- ✅ **PASS**: 子任务 commit (只代码 + 任务书), **不**碰 docs/, 进入下一个子任务或进入阶段 C
- ⚠️ **NEED FIX**: 写新 Builder 任务书 (带 Tester 报告) → 回到 B1
- ❌ **FAIL**: 写 AGENT_PRACTICES 教训 + 跟主人汇报 → 等主人拍

### 不做什么 (做事过程中)

- ❌ **不更新** `docs/STATUS.md` (阶段 C 才更新)
- ❌ **不写** `docs/CHANGELOG.md` (阶段 C 才写)
- ❌ **不更新** `docs/ROADMAP.md` (阶段 A 已经更新过, 阶段 C 再更新最终状态)
- ❌ **不更新** `AGENT_PRACTICES.md` (阶段 C 一次性更新, 除非有"主 agent 必加"的硬教训)

### 主人介入点

- **不**介入 (每个子任务独立完成)
- **除非**: NEED FIX/FAIL 时 (主人拍修复方向或重新拆)

### 耗时

单子任务 30-80 分钟, 整个目标 (3-5 子任务) 1.5-6.5 小时

---

## 🎯 阶段 D: Debug Build Trigger — 主 agent 详细动作 [v3, 2026-06-13 22:20 新增]

> **v3 核心**: 阶段 C 完**直接**进 D, debug build 出来才停. 跟 v0.6.2 之前"卡住问主人 trigger 方案"失误 (per AGENT_PRACTICES #31) 决裂.

### 触发条件

- 阶段 C 全部完 (4 docs 更新 + 2 package.json 升版 + git tag 推)
- **不**等主人确认, **不**问主人 "debug 怎么 trigger" (v3 主 agent **必须**自己 trigger)

### 主 agent 责任 (v3 必修)

1. **派 subagent 跑代码改动前必 verify environment** (per MEMORY #30):
   ```bash
   # 在派 Builder/Tester 跑代码改动前, 必跑
   which gh || brew install gh  # 没装就装
   security find-internet-password -s github.com -w  # 探 Keychain token, 10s 内必须出
   openclaw config get plugins.entries.github  # 检查 OpenClaw github 集成
   ```
   - 缺啥**主 agent 自己装** (brew install gh / enable OpenClaw github 插件), **不**问主人
   - sandbox 限制 (security 超时) → **告诉**主人在 Terminal 解锁 Keychain, 主 agent 仍**自动**继续尝试

2. **trigger workflow_dispatch debug build** (Mac arm64 debug, per v0.6.2 决定):
   ```bash
   # 方案 1: 用 gh CLI (推荐, 主人 token 在 macOS Keychain, per #6)
   gh workflow run build.yml \
     --repo despicablemme/SyncPlayer \
     --ref main \
     -f version=<版本号> \
     -f build_type=debug

   # 方案 2: 用 curl + macOS Keychain token (gh 装不了时 fallback)
   python3 -c "
   import json, subprocess, urllib.request
   token = subprocess.run(['security', 'find-internet-password', '-s', 'github.com', '-w'],
                          capture_output=True, text=True, timeout=30).stdout.strip()
   req = urllib.request.Request(
     'https://api.github.com/repos/despicablemme/SyncPlayer/actions/workflows/build.yml/dispatches',
     data=json.dumps({'ref':'main', 'inputs':{'version':'<版本号>', 'build_type':'debug'}}).encode(),
     headers={'Accept':'application/vnd.github+json', 'Authorization':f'Bearer {token}',
              'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'syncplay-auto-dispatch',
              'Content-Type':'application/json'}, method='POST')
   urllib.request.urlopen(req, timeout=30).read()
   "

   # 方案 3: OpenClaw github 插件 (如果 enabled + 有 token)
   openclaw github workflow dispatch build.yml --ref main -f version=<版本号> -f build_type=debug
   ```

3. **验证 build trigger 成功**:
   ```bash
   # 查 GitHub Actions 最近 runs (public API, 不需 token)
   curl -sS "https://api.github.com/repos/despicablemme/SyncPlayer/actions/runs?per_page=3" \
     -H "Accept: application/vnd.github+json" | python3 -c "
   import json, sys
   d = json.load(sys.stdin)
   for r in d['workflow_runs'][:3]:
     print(f'  [{r["status"]}] {r["conclusion"] or "-"} | {r["name"]} | {r["event"]} | inputs={r.get("inputs",{})}')"
   ```
   - 看到 `event=workflow_dispatch` + `inputs.build_type=debug` + `status=in_progress/queued` 就算成功

4. **等 build 跑通** (5-10 分钟 macos-latest 装 + electron-builder):
   - cron 5 分钟轮询 build 状态 (跟 v0.6.2 一样, 但用 public API, **不**需 token)
   - build 成功 (`conclusion=success` + artifact `syncplay-mac-arm64-debug` 存在) → 通知主人

5. **build 失败** → 主 agent 评估:
   - 如果是 build 本身错 (e.g. asar / sign / notarize) → 主 agent 修 build.yml + 重 trigger (per v3 全自动)
   - 如果是代码错 → 走 NEED FIX 流程, 派新 Builder 修, 然后重 trigger debug build
   - **不**问主人 (除非 3 次都失败)

### 通知主人 (v3 唯一通知点)

**debug build 跑通** → 通知主人 (per #20 主动汇报):
```
✅ <version> debug build 跑通
- 触发: workflow_dispatch (build_type=debug)
- run_id: <id>
- artifact: syncplay-mac-arm64-debug (<size> MB)
- 下载: https://github.com/despicablemme/SyncPlayer/actions/runs/<id>

主人从 URL 下载 .dmg, 装上跑实测. 实测通过 → 主人通知主 agent 出 release 版本.
```

**实测 FAIL** → 主 agent 自动走 NEED FIX (派新 Builder 修, 重 trigger debug build), **不**问主人 (除非 3 次都 FAIL).

### 不做什么 (v3)

- ❌ **不**在阶段 B 完工**卡住**问主人 "debug 怎么 trigger" (per v0.6.2 失误)
- ❌ **不**在阶段 C 完等主人确认, **直接**进 D
- ❌ **不**trigger release workflow (v0.6.1 + v0.6.2 合并 release 仍需主人确认, per v0.6.2 决定)
- ❌ **不**在中间 bug 修复时问主人 (主 agent 自己评估 + 修)

### 主人介入点 (v3)

- **debug build 跑通** → 主人实测
- **实测通过** → 主人通知主 agent 出 release
- **3 次 debug build 都 FAIL** (无法解决) → 主 agent 通知主人, 主人拍方向
- **阶段 D 走不通** (e.g. workflow_dispatch 接口被禁, gh 装不上, Keychain 一直锁) → 主 agent 通知主人 (无法解决, 走 fallback)

### 耗时

- trigger 本身: 1-2 分钟
- build 跑通: 5-10 分钟 (macos-latest runner)
- 总: 7-15 分钟

### 跟之前差异 (v0.6.2 之前 → v3)

| 维度 | v0.6.2 之前 (v2) | v3 (主人 2026-06-13 22:20) |
|---|---|---|
| 阶段 B 完通知 | 通知主人 | **不**通知, 继续阶段 C |
| 阶段 C 完通知 | 通知主人 | **不**通知, 继续阶段 D (debug build) |
| Debug build trigger | 卡住问主人 (sandbox 限制) | **主 agent 自己 trigger** (verify env + 用 gh/curl/OpenClaw) |
| Debug build 出 | (没跑到) | **通知**主人验收 |
| Release | 主人决定 | **仍**主人决定 (通知主 agent 才出) |

---

## 🎯 阶段 C: 完工 (更新 docs) — 主 agent 详细动作 [v3, 2026-06-13 22:20 修订]

### 什么时候进

- **全部 N 个子任务 PASS 后** (per B 阶段自动链)
- **不**在某个子任务 PASS 时就更新 docs (那是"进度中转", 不是"完工")
- **v3**: 阶段 C 完**不**通知主人, **直接**进阶段 D (debug build trigger), debug 出才通知

### 做什么

主 agent **一次性**更新所有相关 docs:

| 文档 | 改什么 |
|---|---|
| `docs/STATUS.md` | vX → ✅ Shipped (一行版本, 加 commit-sha 引用) |
| `docs/ROADMAP.md` | vX → ✅, vX+1 → 🎯 next (或保持原路线) |
| `docs/CHANGELOG.md` | 加 vX release 条目 (新功能 / 修复 / 文档), per CHANGELOG.md 现有格式 |
| `docs/ARCHITECTURE.md` | 如架构变了 (新模块/新依赖/新数据流) |
| `AGENT_PRACTICES.md` | 做事过程中发现的新教训 (一次性加 #N) |
| `docs/MEETINGS.md` | 加 vX 完工纪要 (回顾: 完成什么 / 怎么完成 / 遇到什么 / 下一步) |

### commit + push

```bash
cd ~/CodeProjects/syncplay
git add docs/STATUS.md docs/ROADMAP.md docs/CHANGELOG.md docs/ARCHITECTURE.md AGENT_PRACTICES.md docs/MEETINGS.md
git commit -m "docs(vX): release notes + status update + retrospective"
git push origin main
# 验证 (per #15)
git fetch origin main
git rev-parse main origin/main
```

### 跟主人汇报 (per reporting.md)

```
## vX 完工

### ✅ 全部子任务 PASS
- 子任务 1: <sha> - <一句话>
- 子任务 2: <sha> - <一句话>
- 子任务 3: <sha> - <一句话>
- 总耗时: X 小时
- 新教训: #N <一句话> (如有)

### Docs 已更新
- STATUS.md → vX ✅ Shipped
- ROADMAP.md → vX+1 🎯 next
- CHANGELOG.md → vX release 条目
- MEETINGS.md → vX 完工纪要

### 下一目标
主人定 → 主 agent 按 阶段 A 重新跑
```

### 不做什么

- ❌ 不在某个子任务 PASS 时就更新 docs
- ❌ 不写长篇大论的 CHANGELOG (保持简洁, 给读者看的)
- ❌ 不在 MEETINGS.md 里写琐事 (只写"决定/反思/why")

### 主人介入点

- 1 次 (看完工汇报, 决定下一目标)

### 耗时

10-15 分钟

---

## 📊 总耗时估算

| 阶段 | 耗时 | 主人介入次数 |
|---|---|---|
| 阶段 A 计划 | 5-15 分钟 | 1 次 |
| 阶段 B 实现 (3-5 子任务) | 1.5-6.5 小时 | 0 次 (除非 NEED FIX) |
| 阶段 C 完工 | 10-15 分钟 | 1 次 |
| **总** | **1.7-7 小时** | **2 次** |

---

## 🚨 主 agent 红线 (3 阶段全程必避)

| 红线 | 说明 |
|---|---|
| ❌ 写代码 | Builder (Claude Code) 的活 |
| ❌ 跑 e2e / 兼容性测试 | Tester (Claude Code) 的活 |
| ❌ 阶段 B 过程中更新 docs/STATUS/CHANGELOG | 违反 "docs 是事后记录" 原则 |
| ❌ 跳过阶段 A 直接做事 | 没 plan 文档 = 目标没"落实", 容易跑偏 |
| ❌ 跳过阶段 C 直接汇报 | 没更新 docs = 状态对不上, 主人看到的还是旧信息 |
| ❌ Builder/Tester 并行 | 破 fresh context 硬约束 |
| ❌ 跳过 fetch 验证 push | per AGENT_PRACTICES #15 |
| ❌ subagent done 静默 | per MEMORY #20 铁律 |
| ❌ 让主人开 terminal 跑 Claude Code | 🅰️ subagent 编排模式全自动 (除非失败) |
| ❌ 改禁区 (docs/STATUS.md / CHANGELOG.md / AGENT_PRACTICES.md) | 阶段 B 期间这些是"冻结"的, 阶段 C 才动 |

---

## ❓ 常见问题

### Q: 阶段 A 之前能不能先 "探索"？

**A**: 可以, 但探索结果**必须**进 plan 文档 (`docs/TECH_RESEARCH.md` 或会议纪要), 不在 IM/口头讲.

### Q: 阶段 B 某子任务 FAIL 了怎么办？

**A**: 写 AGENT_PRACTICES 教训 + 跟主人汇报 + 等主人拍:
- 重新拆任务 (回到阶段 A 重写 plan?)
- 换方向 (放弃这个子任务?)
- 取消整个目标?

### Q: 阶段 B 某子任务需要"额外" plan 文档怎么办？

**A**: 这种是"计划没想全" — 应该**回到阶段 A** 补 plan 文档, 而不是做事过程中加 plan. 做事过程中加 plan = 流程混乱.

### Q: 主人临时加新需求怎么办？

**A**: 停下当前子任务 → 回到阶段 A, 把新需求加进 plan 文档 → 重新拆任务 → 继续阶段 B.

---

## 📚 关联文档

- `workflow.md` — 整体流程
- `roles.md` — 三角色详细定义
- `control-claude.md` — 如何控制 Claude Code (**必读**, 含 --add-dir 用法)
- `acceptance.md` — 验收清单
- `reporting.md` — 汇报机制
- `templates/builder-task.md` — Builder 任务书模板
- `templates/tester-task.md` — Tester 任务书模板
- `templates/context-summary.md` — Context 摘要模板
- `templates/commit-message.md` — Commit 格式
- `~/CodeProjects/syncplay/AGENT_PRACTICES.md` #11/#12/#13/#15/#16 — 必读教训
- `~/openclaw/workspace/MEMORY.md` #20 — subagent done 主动查 + 汇报

---

*制定：Jarvis & 主人*
*最后更新：2026-06-13 (v3 工作流修订: A 完 → 全自动 B/C/D debug build 出, 主人 2026-06-13 22:20 决策)*
