# 验收机制 (Acceptance)

> **这是什么？** Reviewer (主 agent Jarvis) 验收 Builder + Tester 交付物的标准流程。
> **何时查阅？** 主 agent 收到 Builder + Tester 完工报告后**必读**。
> **最后更新：** 2026-06-09

---

## 🚦 一句话

**主 agent 读 Builder commit + Tester 报告 → 按"验收清单"逐项核对 → 给出 PASS/NEED FIX/FAIL 决策 → 写 CHANGELOG/STATUS/AGENT_PRACTICES → push**。

---

## 📊 验收流程

```
Builder 完工 (commit-sha) + Tester 完工 (report-path)
    ↓
读 Builder commit
    ├─ git log -1 (commit message)
    ├─ git show --stat (改了哪些文件)
    ├─ git diff HEAD~1..HEAD (具体改动)
    └─ 检查 unit test 是否真跑通
    ↓
读 Tester 报告
    ├─ 测试环境
    ├─ 验证清单结果 (PASS/FAIL)
    ├─ 错误日志 (如有)
    └─ Tester 结论 (PASS/FAIL)
    ↓
逐项核对 "验收清单" (见下)
    ↓
决策: PASS / NEED FIX / FAIL
    ├─ PASS → 写 CHANGELOG + 更新 STATUS + 写 AGENT_PRACTICES (如有) + commit + push
    ├─ NEED FIX → 写新 Builder 任务书 (带 Tester 报告) + 派活
    └─ FAIL → 写 AGENT_PRACTICES 记录问题 + 任务暂停 + 跟主人汇报
```

---

## ✅ 验收清单 (Reviewer 必过)

### 1. Builder 交付物检查

- [ ] **commit 存在** — `git log -1` 能找到
- [ ] **commit message 规范** — 符合 `templates/commit-message.md` 格式
- [ ] **commit 不超大** — 一个任务一个 commit，< 500 行改动（除非明确说明）
- [ ] **改动文件在任务书范围内** — 改了的文件 = 任务书允许的范围（**不**改 docs/STATUS.md 等禁区）
- [ ] **unit test 跑通** — commit message 或 stdout 有"X tests passed"字样
- [ ] **没改禁区文件** — 重点检查 `docs/CHANGELOG.md` / `docs/STATUS.md` / `docs/ROADMAP.md` / `AGENT_PRACTICES.md` / `agentWorkflowAndTemplates/`
- [ ] **没意外 commit** — `.env` / `node_modules/` / `*.log` / `dist/` / `desktop/dist/` 等**不**应被 commit

### 2. Tester 交付物检查

- [ ] **报告存在** — `tasks/<task>-test-report.md` 存在
- [ ] **报告用了正确模板** — 符合 `templates/test-report.md` 格式
- [ ] **环境明确** — 测试在哪个环境跑（Mac / Win / Linux / 哪个版本）
- [ ] **验证清单完整** — 任务书的每个验证项都有 PASS/FAIL
- [ ] **FAIL 有日志** — 无日志的 FAIL 不算数
- [ ] **结论明确** — Tester 给出 PASS 或 FAIL 结论（不要"基本通过"这种模糊词）

### 3. Builder 任务书核对

- [ ] **每个验收标准都达成** — 任务书里写的每条都兑现
- [ ] **没超范围** — 改的东西 ≤ 任务书要求
- [ ] **代码质量** — (Reviewer 凭经验判断) 命名清晰、无 hardcode、有必要注释

### 4. Tester 任务书核对

- [ ] **每个验证项都跑了** — 没跳项
- [ ] **独立 context 验证** — 报告里没出现 Builder conversation 的内容（这是个 sanity check）
- [ ] **结论有依据** — PASS/FAIL 都有证据

### 5. 跨 session 一致性

- [ ] **CHANGELOG.md 没被 Builder 改** — 这条由 Reviewer 写
- [ ] **STATUS.md 没被 Builder 改** — 这条由 Reviewer 写
- [ ] **AGENT_PRACTICES.md** — 如果这次任务暴露新教训，Reviewer **必须**加
- [ ] **commit 链干净** — `git log` 没有意外 commit

---

## 📋 决策矩阵

### ✅ PASS 条件（**全部**满足）

- [x] Builder 验收清单 100% 通过
- [x] Tester 报告结论 = PASS
- [x] 任务书每个验收标准达成
- [x] 没超范围改动

### ⚠️ NEED FIX 条件（**任一**满足）

- [ ] Builder 改了禁区文件（CHANGELOG / STATUS 等）— **自动 NEED FIX**
- [ ] Builder commit 漏了某些验收标准 — **NEED FIX**
- [ ] Tester 报告 FAIL，但失败可修复 — **NEED FIX**
- [ ] 代码质量问题（命名 / hardcode / 性能）— **NEED FIX**
- [ ] 任务书里有遗漏的 edge case — **NEED FIX**

### ❌ FAIL 条件（**任一**满足）

- [ ] Builder 改动破坏了其他功能（regression）
- [ ] Tester 报告 FAIL，且根本原因不明
- [ ] 任务方向错了（不该做这个）
- [ ] 任务范围太大，需要重新拆
- [ ] Builder 报告"任务完成"但 git status 没有任何改动（撒谎）

---

## 🔄 决策后的动作

### ✅ PASS

```bash
# 1. 写 CHANGELOG.md
# 2. 更新 STATUS.md (推进进度)
# 3. 如有新教训, 写 AGENT_PRACTICES.md
# 4. git add + commit
# 5. git push origin main
# 6. 跟主人汇报 (见 reporting.md)
```

### ⚠️ NEED FIX

```bash
# 1. 写新 Builder 任务书: tasks/<task>-builder-fix1.md
#    - 必须包含 Tester 报告作为 context
#    - 明确"修复指令": 改 X 文件 Y 函数, 从 A 改成 B
# 2. 派新 Builder subagent (走 control-claude.md 流程)
# 3. 跑完再派新 Tester
# 4. 重新走验收流程
```

### ❌ FAIL

```bash
# 1. 写 AGENT_PRACTICES.md (如果是新教训)
# 2. 跟主人汇报: 任务失败 + 原因 + 我的建议
# 3. 等主人决策: 重新拆任务 / 换方向 / 取消
```

---

## 🚨 反模式（Reviewer 必避）

### ❌ 反模式 1: 凭印象验收
"看着 commit message 像对的就 PASS 了"  
**正确**: 必读 git diff，逐项核对验收清单

### ❌ 反模式 2: 跳过 Tester 报告
"Builder 看起来做完了，让主人看看就行"  
**正确**: Tester 报告是硬约束——没 Tester 报告 = 任务不算完成

### ❌ 反模式 3: NEED FIX 写模糊
"再改改，看哪里有问题"  
**正确**: "改 src/peer.js 第 45 行的 foo 函数，从 return null 改成 return error.message"

### ❌ 反模式 4: 一次验收多个任务
"v0.6 第一阶段 3 个子任务一起验"  
**正确**: 每个子任务单独走完整流程

### ❌ 反模式 5: 不写 AGENT_PRACTICES
"这次 Builder 犯的错下次再说"  
**正确**: 每次暴露新教训**立刻**写 AGENT_PRACTICES，下个任务书里加约束

---

## 📚 关联文档

- `workflow.md` — 整体流程
- `roles.md` — Reviewer 职责
- `control-claude.md` — 怎么派活
- `reporting.md` — PASS 后的汇报
- `templates/test-report.md` — Tester 报告模板
- `templates/commit-message.md` — Commit 格式
- `~/CodeProjects/syncplay/AGENT_PRACTICES.md` — 历史教训（Reviewer 加新教训时参考）

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
