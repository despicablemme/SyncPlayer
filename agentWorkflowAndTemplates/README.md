# Agent Workflow & Templates

> **这是什么？** SyncPlay 项目"agent 通用工作流"主目录。**所有 agent**（OpenClaw 主 agent / subagent / Claude Code 实例）从这里拿工作流规范 + 任务模板。
> **何时查阅？** 任何 agent 接手 SyncPlay 任务前**必读**。每个新 session 第一件事。
> **范围：** 适用于 SyncPlay 所有 v0.x / v1.0 / v2.0+ 迭代。
> **最后更新：** 2026-06-09

---

## 🎯 一句话定位

**本目录是 agent 的"唯一权威工作流"**——文档说怎么分工、怎么控制 Claude Code、怎么验收、怎么汇报；模板说怎么派活、怎么写任务书、怎么给结果。

人类开发者读 `docs/AGENTS.md` 了解项目级规范；agent 读**本目录**干活。

---

## 📂 目录索引

```
agentWorkflowAndTemplates/
├── README.md                ← 你正在看 (总览)
├── runbook.md               ← ⭐ 主 agent 处理"任何目标"的 3 阶段标准流程 (plan→实现→完工)
├── workflow.md              ← 整体流程图
├── roles.md                 ← 三角色分工 (Builder / Tester / Reviewer) + Claude Code 怎么对应
├── control-claude.md        ← 如何控制 Claude Code (派活/抓结果/独立上下文/边界)
├── acceptance.md            ← 验收机制 (Reviewer 流程/通过条件/打回标准)
├── reporting.md             ← 汇报机制 (频率/格式/主人看哪里/异常)
└── templates/               ← 给 Claude Code 用的所有模板
    ├── builder-task.md      ← Builder 任务书模板 (写代码用)
    ├── tester-task.md       ← Tester 任务书模板 (独立上下文测试用)
    ├── context-summary.md   ← 必读 context 摘要模板 (跨 session 同步)
    ├── test-report.md       ← Tester 报告模板
    └── commit-message.md    ← Commit message 模板
```

---

## 🚦 快速使用流程

### 给主 agent (Jarvis) 用的

1. **接手任务** → 读 `workflow.md` 了解整体流程
2. **拆分任务** → 按 `roles.md` 决定派给谁
3. **写任务书** → 用 `templates/builder-task.md` 或 `templates/tester-task.md`
4. **派 subagent** → 参考 `control-claude.md` 知道怎么调 Claude Code
5. **验收** → 读 `acceptance.md` 走流程
6. **汇报** → 按 `reporting.md` 格式给主人

### 给 Claude Code (Builder 实例) 用的

1. 接到任务书（prompt 注入）
2. 读 `templates/builder-task.md` 知道任务书格式
3. 读 `templates/context-summary.md` 拿项目 context
4. **必须**先读 `~/CodeProjects/syncplay/AGENT_PRACTICES.md`（已沉淀的教训）
5. 写代码 → 跑 unit test → commit
6. 输出 `BUILDER_DONE: <commit-sha>` 给 orchestrator

### 给 Claude Code (Tester 实例) 用的

1. 接到任务书（fresh context，不读 Builder conversation）
2. 读 `templates/tester-task.md` 知道任务书格式
3. 读 `git log -p HEAD~1..HEAD` 看 Builder 改了什么
4. 跑 e2e / 兼容性 / 边界测试
5. 写报告到 `tasks/<task>-test-report.md`（**用** `templates/tester-report.md`）
6. 输出 `TESTER_DONE: <report path>` 给 orchestrator

---

## 🔗 关联文档

- `~/CodeProjects/syncplay/AGENT_PRACTICES.md` — SyncPlay 项目实战教训（**必读**）
- `~/CodeProjects/syncplay/docs/STATUS.md` — 项目当前进度
- `~/CodeProjects/syncplay/docs/ROADMAP.md` — 项目目标 + 决策
- `~/CodeProjects/syncplay/docs/AGENTS.md` — 人类开发者看的项目入口
- `~/CodeProjects/syncplay/docs/CHANGELOG.md` — 版本变更历史
- `~/CodeProjects/syncplay/docs/ARCHITECTURE.md` — 架构说明

---

## 📝 维护规则

- **本目录的所有文档是"活文档"**——每次新教训都同步进 `AGENT_PRACTICES.md`（不是这里）
- **本目录的所有模板是"填空式"**——`{{TASK_NAME}}` 这种占位符是给 OpenClaw subagent 替换用的
- **修改本目录的文档**——必须 commit message 带 `[workflow]` 前缀，方便追溯
- **新增/删除模板**——必须更新本 README.md 的目录索引

---

*制定：Jarvis & 主人 (Bruce)*
*维护：Jarvis*
*最后更新：2026-06-09*
