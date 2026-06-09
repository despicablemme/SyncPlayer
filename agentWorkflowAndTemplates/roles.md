# 角色分工 (Roles)

> **这是什么？** SyncPlay 项目"三角色"详细定义 + 在 OpenClaw + Claude Code 协作下的实际承担者映射。
> **何时查阅？** 主 agent 派活前**必须**知道每个角色"谁来做、做什么、不做什么"。
> **最后更新：** 2026-06-09

---

## 🚦 一句话

**三角色 = Builder (写代码) + Tester (独立测试) + Reviewer (验收决策)**。在 SyncPlay 项目，**前两个交给 Claude Code，最后一个交给我 (Jarvis)**。

---

## 🧑‍💻 Builder（构建者）

### 实际承担者
**Claude Code 实例 1**（由 OpenClaw subagent 1 跑 `claude -p` 启动）

### 职责
- 读任务书 + 必读 context 摘要
- 写/改/重构代码
- 配置环境、依赖、安装包（如需要）
- 跑 unit test
- git commit（**不** push）
- 输出 `BUILDER_DONE: <commit-sha>`

### 交付物
- 1 个 git commit（包含所有代码改动）
- unit test 跑通证据（commit message 或 stdout 摘要）
- `BUILDER_DONE: <commit-sha>` 标记

### 原则
- **只管构建，不管测试**（e2e / 兼容性 / 边界测试留给 Tester）
- **不写** `docs/CHANGELOG.md` / `docs/STATUS.md` / `AGENT_PRACTICES.md`（留给 Reviewer）
- **不** git push（留给 Reviewer）
- 跑完**主动**输出 `BUILDER_DONE`，不要等问
- 失败 → 报告错误日志，**不**自己重试 3 次（1 次就退出）

### 边界（什么不能做）
- ❌ 改 docs/ 下的文档（CHANGELOG / STATUS / ROADMAP / ARCHITECTURE / REQUIREMENTS）
- ❌ 改 AGENT_PRACTICES.md
- ❌ 改 agentWorkflowAndTemplates/ 下的工作流文档
- ❌ git push
- ❌ 自己跑 e2e / 兼容性测试（那是 Tester 的活）
- ❌ 改任务书范围外的文件（如果发现"必须改"先报告，不动手）

---

## 🧪 Tester（测试者）

### 实际承担者
**Claude Code 实例 2**（由 OpenClaw subagent 2 跑 `claude -p` 启动，**fresh context**）

### 职责
- 读任务书 + 验证清单
- 跑 e2e / 集成 / 兼容性 / 边界测试
- 记录 pass/fail + 错误日志
- 写报告到 `tasks/<task>-test-report.md`
- 输出 `TESTER_DONE: <report path>`

### 交付物
- 测试报告（环境 + 验证清单结果 + 错误日志 + 结论）
- `TESTER_DONE: <path>` 标记

### 原则
- **完全 fresh context**——不读 Builder 的 conversation、不读 Builder 的工作笔记
- **只测不修**——发现 bug 详细描述"建议 Builder 怎么修"，不自己动手
- **不** commit（不写 git commit 也不 push）
- 客观记录，**不美化**——Fail 就是 Fail
- 无日志的 FAIL 不算数——必须附 stderr / 截图 / 操作步骤

### 边界（什么不能做）
- ❌ 改任何源代码
- ❌ git commit / push
- ❌ 改 docs/ 下的文档
- ❌ 改任务书
- ❌ 跟 Builder "对话"（这是 Reviewer 的活：传话、决定）
- ❌ 跳过测试项目（即使"看起来不重要"）

### 怎么保证 fresh context

**物理进程隔离**（这是硬约束）：
1. subagent 1 跑完 `claude -p` → subagent 1 进程**退出**（context 物理销毁）
2. subagent 2 启动（**新进程**）
3. subagent 2 跑 `claude -p`——这个进程**没有任何**前一个 session 的痕迹

**绝对不能：**
- 用同一个 Claude Code REPL "切换身份"——这是假 fresh
- 用 `claude --continue` / `--resume`——会共享 history
- 让 Builder 写完"给 Tester 的 context"文件后，Tester 读——这等于让 Builder 污染 Tester 的输入

**可以：**
- Builder 写**代码**到 git commit
- Tester 读 `git log -p HEAD~1..HEAD`（commit 信息，**不是** Builder 的对话）

---

## 🔍 Reviewer（审核者）

### 实际承担者
**主 agent (Jarvis, 我)**

### 职责
- 读 Builder commit diff
- 读 Tester 报告
- 核对验证清单
- 给出决策：PASS / NEED FIX / FAIL
- 通过 → 写 CHANGELOG / 更新 STATUS / 写 AGENT_PRACTICES（如有）/ git push
- NEED FIX → 写新 Builder 任务书（带 Tester 报告作为 context），重新派活
- FAIL → 记录问题，任务暂停或重新评估

### 交付物
- 验收决策
- CHANGELOG.md 更新
- STATUS.md 更新
- AGENT_PRACTICES.md 新教训（如有）
- git commit + git push

### 原则
- **决策必须有依据**——只读 Tester 报告，不臆测
- **NEED FIX 要具体**——不能"再改改"，要"改 X 文件的 Y 函数，从 A 改成 B"
- **不重复犯错**——发现 Builder 犯过的错 → 写到 AGENT_PRACTICES，下次任务书里加约束
- **CHANGELOG 写人话**——给读者看的，不只是 commit log 复制

### 边界（什么不能做）
- ❌ 自己写代码改 Bug（那是 Builder 的活；Reviewer 写"修复指令"派给 Builder）
- ❌ 跳过 Tester 报告直接验收
- ❌ 接受"无日志的 FAIL"（强制 Builder/Tester 补日志）
- ❌ 一次验收 3 个以上 Builder 任务（容易漏看，拆开验）

---

## 🎯 角色对照表

| 角色 | 旧 v0.4 设计 | 新 OpenClaw+Claude Code 协作 |
|---|---|---|
| **Builder** | OpenClaw subagent | **Claude Code 实例 1**（subagent 1 跑 `claude -p`） |
| **Tester** | OpenClaw subagent（独立 context） | **Claude Code 实例 2**（subagent 2 跑 `claude -p`，**fresh context**） |
| **Reviewer** | 主 agent (Jarvis) | **主 agent (Jarvis)**（不变） |
| ~~架构师~~ | ~~（旧五角色）~~ | 合并到 Reviewer |
| ~~策略师~~ | ~~（旧五角色）~~ | 合并到主 agent（拆任务） |
| ~~前端/后端 agent~~ | ~~（旧五角色）~~ | 合并到 Builder |

---

## 📝 任务拆分原则（主 agent 怎么用这三角色）

主 agent 接手一个 v0.6 / v0.7 任务时，拆成：

| 步骤 | 角色 | 模板 |
|---|---|---|
| 1. 写 Builder 任务书 | 主 agent 自己写 | `templates/builder-task.md` |
| 2. 写 Tester 任务书 | 主 agent 自己写 | `templates/tester-task.md` |
| 3. 写 context 摘要 | 主 agent 自己写 | `templates/context-summary.md` |
| 4. 派 Builder | subagent 1 | `templates/builder-task.md` 末尾的 OpenClaw 注入示例 |
| 5. 派 Tester | subagent 2（等 subagent 1 退出） | `templates/tester-task.md` 末尾的 OpenClaw 注入示例 |
| 6. 验收 | 主 agent 自己（读 commit + 报告） | `acceptance.md` |
| 7. 后续动作 | 主 agent 自己 | `reporting.md` |

---

## 📚 关联文档

- `workflow.md` — 整体流程图
- `control-claude.md` — Claude Code 派活技术细节
- `acceptance.md` — 验收清单
- `templates/builder-task.md` / `templates/tester-task.md`

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
