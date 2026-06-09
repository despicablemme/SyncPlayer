# 汇报机制 (Reporting)

> **这是什么？** 主 agent (Jarvis) 跟主人汇报的频率、格式、触发条件。
> **何时查阅？** 主 agent 完成任务节点、卡住、收到 subagent 完工事件时**必读**。
> **最后更新：** 2026-06-09

---

## 🚦 一句话

**主人在 webchat/QQ 看我的汇报**——每完成一个验收节点汇报一次、卡住立刻汇报、subagent 完工立刻查交付并汇报（per MEMORY 铁律 #20）。

---

## 📊 汇报节点

| 节点 | 触发条件 | 汇报内容 | 频率 |
|---|---|---|---|
| **任务书写完** | 主 agent 写完 Builder/Tester/Context 任务书 | 任务书路径 + 一句话目标 + 任务书 commit-sha | 每次任务开始 |
| **Builder 完工** | subagent 1 推完工事件 | Builder commit-sha + commit message + 改了哪些文件 + unit test 结果 | 每次 Builder 完工 |
| **Tester 完工** | subagent 2 推完工事件 | Tester 报告路径 + 结论 (PASS/FAIL) + 关键发现 | 每次 Tester 完工 |
| **Reviewer 验收完** | 主 agent 给出 PASS/NEED FIX/FAIL 决策 | 验收决策 + 后续动作 | 每次验收完 |
| **Push 完成** | git push 成功 | 远端 commit-sha + 仓库链接 | 每次 push |
| **卡住 / 异常** | 任何 subagent 失败 / 网络问题 / key 过期 | 错误详情 + 我建议的解决方案 | 立刻（不等下个节点） |
| **新教训发现** | Reviewer 验收时发现新模式 | 教训摘要 + AGENT_PRACTICES 引用 | 立刻 |

---

## 📋 汇报格式

### 标准格式（3 段）

```
## <节点名称>

### ✅/⚠️/❌ <一句话结果>
<commit-sha / report path / 决策>

### 关键内容
- 改了 <file1>, <file2>, ... (N 个文件, +X/-Y 行)
- unit test: <N passed / M failed>
- Tester 结论: <PASS / FAIL> — <一句话原因>

### 下一步
<自动进行的下个阶段 / 等主人决策>
```

### 例子：Builder 完工汇报

```
## Builder 完工 (v0.6.0 任务 1)

### ✅ commit `f0f2138`
docs: add macOS install guide with quarantine instructions

### 关键内容
- 改了 `docs/INSTALL_macOS.md` (+98 行, 新文件)
- unit test: N/A (文档任务)
- 没改禁区文件 ✅

### 下一步
派 Tester 跑 (独立 context) — 等完工事件
```

### 例子：Reviewer 验收 PASS

```
## v0.6.0 任务 1 验收

### ✅ PASS
- Builder: `f0f2138`
- Tester: `tasks/v0.6.0-macos-install-test-report.md` (PASS)
- 任务书验收标准: 5/5 达成

### 关键内容
- 文档覆盖: dmg 下载 → 拖入 /Applications → 首次打开弹"damaged" → `xattr -dr com.apple.quarantine` → 验证
- 引用了 AGENT_PRACTICES.md #22 (quarantine 真实根因)
- 引用了 v0.5.1 dmg SHA256 让主人能核对

### 后续动作
- ✅ CHANGELOG.md 已加 v0.6.0 条目
- ✅ STATUS.md 推进 v0.6.0 macOS doc 完成
- ✅ git push 完成 (commit `921b3fc`)
- ⏭️ 下一任务: v0.6.0 任务 2 (Linux AppImage 实测) — 等主人拍

### 新教训
无 (这次没暴露新问题)
```

### 例子：Reviewer 验收 NEED FIX

```
## v0.6.0 任务 1 验收

### ⚠️ NEED FIX
- Builder: `f0f2138`
- Tester: FAIL (4/6 项)
- 失败项: dmg SHA256 校验没文档化 / 没截图

### 关键问题
- Tester 测了 dmg 完整性, 但 Builder 没在文档里写 SHA256
- 用户无法验证下载的 dmg 是否被篡改

### 修复指令 (给下一轮 Builder)
1. 改 `docs/INSTALL_macOS.md` 第 X 段, 加 SHA256 校验步骤
2. 加截图: docs/INSTALL_macOS_screenshots/quarantine_terminal.png

### 新教训
- 加到 AGENT_PRACTICES.md #13: 文档任务也要带可验证的产物 (SHA256/截图)
```

---

## 🚨 异常汇报（立即触发）

主 agent 收到这些信号**立刻**汇报，**不等**下个节点：

| 异常 | 汇报内容 |
|---|---|
| subagent 失败 | 错误详情 + 建议解决方案 |
| 网络问题（github.com 推不上） | 错类型 + 建议（代理/镜像/重试） |
| Claude Code key 过期 / 无效 | 验证结果 + 建议（重新 /login 或换 key） |
| Builder 改了禁区文件 | 哪些文件 + 我已 `git checkout` 还原 + AGENT_PRACTICES 教训 |
| Tester 报 FAIL 我无法判断 NEED FIX 还是 FAIL | 报告原文 + 我建议 + 等主人拍 |
| 任务书任务范围超出主人意图 | 我建议的范围 + 等主人确认 |
| 主人给的 token / key 暴露了 | **立刻** 警告 + 建议撤销 + 跟主人确认 |

---

## 🔕 不汇报的场景

主 agent **不**主动汇报（避免噪音）：

- subagent 还在跑（中间过程）—— 除非卡住
- 任务书正在写、还没 commit —— 除非卡住
- git fetch / git log 之类的内部操作
- 我自己读 docs/ 文档
- 改 `AGENT_PRACTICES.md` 的过程（commit 后**一次性**汇报）

---

## 📊 主人看哪里

主人在 webchat/QQ 看主 agent 汇报。如果想看更细的：

| 想看什么 | 看哪里 |
|---|---|
| 当前在做什么 | webchat 最新一条汇报 |
| Builder 改了哪些代码 | 我汇报里贴的 `git show` 输出 / GitHub commit 链接 |
| Tester 测了什么 | `tasks/<task>-test-report.md`（git 里能搜到） |
| 完整进度 | `docs/STATUS.md` |
| 决策历史 | `docs/CHANGELOG.md` |
| 历史教训 | `AGENT_PRACTICES.md` |
| 仓库 commit log | `git log --oneline -20` 或 GitHub 网页 |

---

## ⏱️ 汇报频率（实际经验值）

| 任务规模 | 节点 | 总汇报次数 |
|---|---|---|
| 小（1 个 Builder + 1 个 Tester） | 任务书 + Builder 完 + Tester 完 + 验收 = 4 次 | 4 次 |
| 中（2-3 个 Builder + 2-3 个 Tester） | 同上 × 3 | 12 次左右 |
| 大（5+ 个 Builder） | 同上 × 5+ | 20+ 次 |

**原则**：每完成一个验收节点汇报一次，不在中间频繁打扰。

---

## 🛠️ 实战注意事项

### 汇报要"事实 + 决策"分离
- ✅ "Builder commit `f0f2138`，改 3 个文件，unit test 3 passed"
- ❌ "我觉得 Builder 做得不错"（无事实）

### 汇报要"含证据"（per MEMORY #14 教训）
- ✅ "commit sha `f0f2138`，git show 已贴"
- ❌ "应该 commit 成功了"（无证据）

### 汇报要"明确下一步"
- ✅ "派 Tester 跑（独立 context）—— 等完工事件"
- ❌ "现在等下一步"（无明确）

### 异常汇报要"立即 + 简短"
- ✅ "subagent 1 失败: claude -p exit 1, stderr: 'invalid API key'. 建议主人重跑 `claude /login`"
- ❌ 长篇大论分析原因（主人先看到结果就行）

---

## 📚 关联文档

- `workflow.md` — 整体流程
- `acceptance.md` — 验收流程
- `roles.md` — Reviewer 职责
- `~/openclaw/workspace/MEMORY.md` — #20 (subagent done 立刻查 + 汇报) / #21 (嘴上说立刻做必须真做)

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
