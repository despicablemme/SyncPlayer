# 通用工作流 (Workflow)

> **这是什么？** SyncPlay 项目所有开发任务的"标准流程"——从主人发布任务到 Reviewer 验收的完整链路。
> **何时查阅？** 主 agent 接手任务时**第一份必读**。派活前必须熟。
> **适用范围：** 所有 SyncPlay 任务（v0.x 迭代、v1.0、v2.0+）
> **最后更新：** 2026-06-09

---

## 🚦 一句话流程

**主人发布任务 → 主 agent 拆任务 → 写任务书 → 派 Builder (Claude Code) → 派 Tester (Claude Code, fresh context) → 主 agent 验收 → 写 CHANGELOG/STATUS/AGENT_PRACTICES → commit + push**

---

## 📊 流程图

```
┌────────────────┐
│  主人发布任务   │
└───────┬────────┘
        │ (webchat / QQ / 其他渠道)
        ▼
┌─────────────────────────────────────────┐
│  主 agent (Jarvis)                       │
│  ─ 拆任务                                │
│  ─ 决定派给谁 (Claude Code / subagent)   │
│  ─ 写任务书 → commit 到 tasks/<task>.md │
└───────┬─────────────────────────────────┘
        │ 派 subagent 1 (Builder orchestrator)
        ▼
┌─────────────────────────────────────────┐
│  Builder (Claude Code 实例 1)            │
│  ─ 读任务书 + context 摘要              │
│  ─ 写代码 / 改文件                      │
│  ─ 跑 unit test                         │
│  ─ git commit (不 push)                 │
│  ─ 输出 BUILDER_DONE: <sha>             │
└───────┬─────────────────────────────────┘
        │ subagent 1 退出 (context 物理销毁)
        │ subagent 2 启动 (新进程)
        ▼
┌─────────────────────────────────────────┐
│  Tester (Claude Code 实例 2, fresh ctx)  │
│  ─ 读任务书 + git diff (不读 Builder 对话)│
│  ─ 跑 e2e / 兼容性 / 边界测试           │
│  ─ 写报告到 tasks/<task>-test-report.md │
│  ─ 输出 TESTER_DONE: <path>             │
└───────┬─────────────────────────────────┘
        │ subagent 2 退出
        ▼
┌─────────────────────────────────────────┐
│  Reviewer (主 agent Jarvis)              │
│  ─ 读 Builder commit                     │
│  ─ 读 Tester 报告                        │
│  ─ 验收: PASS / NEED FIX / FAIL         │
│  ─ 通过: 写 CHANGELOG/STATUS/AGENT_PRACTICES │
│  ─ NEED FIX: 派新 Builder (回到上面)     │
│  ─ FAIL: 记录问题, 任务暂停             │
└───────┬─────────────────────────────────┘
        │ 验收通过
        ▼
┌─────────────────────────────────────────┐
│  git push                                 │
│  主 agent 汇报主人                       │
└─────────────────────────────────────────┘
```

---

## 📋 每个阶段的输入/输出/负责人

| 阶段 | 输入 | 输出 | 负责人 |
|---|---|---|---|
| 1. 主人发布 | (无) | 任务描述 | 主人 |
| 2. 拆任务 | 任务描述 | 任务拆分 + 任务书 | 主 agent (Jarvis) |
| 3. 写任务书 | 拆分后任务 | `tasks/<task>-builder.md` + `tasks/<task>-tester.md` + `tasks/<task>-context.md` | 主 agent |
| 4. 派 Builder | 任务书 + context | git commit + commit-sha | subagent 1 (跑 `claude -p`) |
| 5. 派 Tester | git diff + 测试任务书 | 测试报告 (`tasks/<task>-test-report.md`) | subagent 2 (跑 `claude -p`, fresh context) |
| 6. 验收 | commit + 测试报告 | PASS/NEED FIX/FAIL 决策 | 主 agent (Reviewer) |
| 7. 后续动作 | 验收决策 | push / 派返工 / 任务暂停 | 主 agent |

---

## ⚙️ 关键约束

### 1. 独立上下文硬约束

**Builder 和 Tester 必须是物理隔离的进程**——subagent 1 退出后 subagent 2 才能启动，**绝对不能**让两个 Claude Code 共享 context。

实现：
- subagent 1 跑完 `claude -p` → subagent 1 进程退出 → subagent 2 进程启动 → 跑 `claude -p`
- 不要用同一个 Claude Code REPL "切换角色"——这不是 fresh context
- 不要用 `claude --continue` / `--resume`——会让 Builder 和 Tester 共享 history

### 2. Builder 不写 CHANGELOG / STATUS / AGENT_PRACTICES

这是 Reviewer (主 agent) 的活。Builder 任务书里必须**明确**写：
> ❌ 不要改 docs/CHANGELOG.md / docs/STATUS.md / AGENT_PRACTICES.md
> ❌ 不要 git push
> ✅ 只 commit 代码 + unit test 跑通

### 3. Tester 不修代码

Tester 任务书里必须**明确**写：
> ❌ 不要改任何源代码
> ❌ 不要 commit
> ✅ 只测 + 写报告
> 如果发现 bug，在报告里详细描述"建议 Builder 怎么修"——但**不**自己动手

### 4. 任务必须"足够原子"

- 一次 Builder 任务应该是 1-3 个文件 / 1 个明确功能 / 1 次 commit
- 太大 → 拆成多个 Builder 任务（每个单独测）
- 太小 → 多个小任务合并成一个 Builder 任务

### 5. 主 agent 绝不写代码

主 agent (Jarvis) 的活是**协调 + 验收**——不直接写代码、不直接跑测试。
例外：`docs/` / `agentWorkflowAndTemplates/` 维护、AGENT_PRACTICES 沉淀、CHANGELOG 更新（这些是"主 agent 专属"区域）。

---

## 🔄 异常处理

| 异常 | 处理 |
|---|---|
| Builder subagent 跑 `claude -p` 失败 | 重试 1 次；仍失败 → 主 agent 接手（用 exec 自己改），记录到 AGENT_PRACTICES |
| Tester 报告 FAIL | 主 agent 决定 FAIL 还是 NEED FIX；NEED FIX → 派新 Builder 任务（带 Tester 报告作为 context） |
| Builder 写超范围（改了 docs/STATUS.md） | Reviewer 验收时 `git checkout` 还原该文件，扣 commit，记录到 AGENT_PRACTICES |
| Claude Code 凭证过期 / 网络问题 | 主人 terminal 跑 `claude /login` 或更新 `ANTHROPIC_API_KEY`；主 agent 暂不派 Claude Code 任务 |
| 任务需要多轮交互（Builder 改 3 次才对） | 这种任务**不适合** `claude -p`；主 agent 提醒主人 terminal 跑（见 `control-claude.md` 边界） |

---

## 📚 关联文档

- `roles.md` — 三角色详细定义
- `control-claude.md` — 如何控制 Claude Code（具体技术细节）
- `acceptance.md` — Reviewer 验收清单
- `reporting.md` — 汇报机制
- `templates/builder-task.md` — Builder 任务书模板
- `templates/tester-task.md` — Tester 任务书模板

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
