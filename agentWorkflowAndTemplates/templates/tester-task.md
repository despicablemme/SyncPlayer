# Tester 任务书模板

> **这是什么？** 给 Tester Claude Code 实例（**fresh context**）的任务书模板。
> **何时使用？** 主 agent 派 Builder 之前**同时**写好 Tester 任务书（节省时间）；Builder 完工后立刻派 Tester。
> **最后更新：** 2026-06-09

---

## 关键约束（必读）

**Tester 必须 fresh context**——这意味着：
- Tester **不**读 Builder 的 conversation
- Tester **不**读 Builder 的"给 Tester 的笔记"（这种文件算 Builder 污染 Tester 输入）
- Tester **只**读：
  - 本任务书
  - `git log -p HEAD~1..HEAD`（Builder commit 的内容）
  - `~/CodeProjects/syncplay/AGENT_PRACTICES.md`（**只**贴摘要，不读全文）
  - `~/CodeProjects/syncplay/docs/STATUS.md`
- **物理隔离**：subagent 1 退出后 subagent 2 才能启动

---

## 使用方式

1. **复制本文件** → `tasks/<task-name>-tester.md`
2. **替换占位符**
3. **不**关联 context-summary.md（Tester 只读 git diff + 任务书，避免 Builder 污染）
4. **Builder 完工后**，主 agent 派 Tester subagent
5. **Tester 跑完**写报告到 `tasks/<task-name>-test-report.md`（用 `templates/test-report.md`）

---

## 任务书模板（占位符版）

```markdown
# Tester 任务书 - {{TASK_NAME}}

> **任务 ID**: {{TASK_ID}}
> **被测 commit**: {{BUILDER_COMMIT_SHA}} （主 agent 在 Builder 完工后填上）
> **最后更新**: {{YYYY-MM-DD}}

---

## ⚠️ Fresh context 约束

你是 Tester。**你的 context 是 fresh**——你**没有** Builder 的对话历史、笔记、"给 Tester 的便条"。

**你只能读**：
1. 本任务书
2. `git log -p HEAD~1..HEAD` —— 看 Builder 改了什么
3. `~/CodeProjects/syncplay/AGENT_PRACTICES.md`（主 agent 会在 prompt 里贴关键摘要，**不**让你自己读全文）
4. `~/CodeProjects/syncplay/docs/STATUS.md`（同上，主 agent 贴摘要）

**你不读**：
- ❌ Builder 的 conversation
- ❌ Builder 写的"给 Tester 的笔记"
- ❌ Builder 的临时草稿

**这保证**：你测的是**代码本身**，不是 Builder 的"自我感觉"。

---

## 必读 context（主 agent 会贴摘要）

> 主 agent 应该在 prompt 里贴这些，不要让你自己读全文

### AGENT_PRACTICES 关键摘要

{{主 agent 从 AGENT_PRACTICES.md 摘 2-5 条相关教训，每条 1-2 句话}}

**示例**：
> - #22: Mac "damaged" 真实根因是 quarantine xattr（不是 dmg 损坏）
> - #5: token 泄露风险（测的时候不要打 token 到任何输出）
> - #11: 凭证失效时立刻报告，不重试

### STATUS 关键摘要

{{项目当前状态，1-2 句话}}

**示例**：
> v0.5.1 已发布, v0.6.0 计划: macOS 安装文档 + Linux AppImage 实测

### ROADMAP 关键摘要

{{本任务相关的路线图决策，1-2 句话}}

---

## 测试目标

{{1-3 句话说清楚"测什么"。要具体。}}

**示例**：
> 验证 `docs/INSTALL_macOS.md` 文档准确无误：用户按文档步骤能成功安装并运行 SyncPlay，且文档没有误导性信息。

---

## 测试环境

- **运行平台**: {{macOS 14.5 / Ubuntu 24.04 / Windows 11 / ...}}
- **网络环境**: {{家庭宽带 / 移动 4G / VPN 关闭 / ...}}
- **目标用户视角**: {{完全没开发背景的家庭用户 / 有基本开发经验的开发者 / ...}}

---

## 验证清单（逐项 PASS/FAIL）

> **每项都必须跑，不能跳**。即使是"看起来不重要"的项。

### 1. 内容准确性
- [ ] **1.1**: {{验证项}} — 跑命令 / 查文件 / 测场景
- [ ] **1.2**: {{验证项}}
- [ ] **1.3**: {{验证项}}

### 2. 完整性
- [ ] **2.1**: 文档覆盖了 {{关键场景}}
- [ ] **2.2**: {{关键命令}} 真的能跑（用文档里的命令真跑一次）
- [ ] **2.3**: 引用了 AGENT_PRACTICES 教训（如果适用）

### 3. 易用性（用户视角）
- [ ] **3.1**: {{从用户视角验证}}
- [ ] **3.2**: {{...}}

### 4. 边界情况
- [ ] **4.1**: {{边界场景 1}}
- [ ] **4.2**: {{边界场景 2}}

**示例**（具体到能跑）：

```markdown
### 1. 内容准确性
- [ ] 1.1: dmg 下载链接是 `https://github.com/despicablemme/SyncPlayer/releases/latest` —— 实际打开看是不是
- [ ] 1.2: 文档说 `xattr -dr com.apple.quarantine /Applications/SyncPlay.app` 能开 —— 实际跑这个命令后真能开
- [ ] 1.3: 文档引用了 AGENT_PRACTICES #22 解释 quarantine 原因 —— grep 文档确认

### 2. 完整性
- [ ] 2.1: 文档覆盖 dmg 下载 → 拖入 /Applications → 处理 damaged → 验证运行
- [ ] 2.2: dmg SHA256 在文档里有（让用户能验证下载完整性）—— grep 确认
- [ ] 2.3: 引用了主人测试用的 GitHub Actions artifact 链接

### 3. 易用性
- [ ] 3.1: 文档语言是给"完全没开发背景的家庭用户"看的 —— 试读一遍
- [ ] 3.2: 命令都给了具体路径示例（不是 `xattr -d` 这种抽象命令）

### 4. 边界
- [ ] 4.1: 如果用户装的是 Intel Mac（不是 arm64）—— 文档有处理吗
- [ ] 4.2: 如果用户之前装过旧版本 SyncPlay —— 文档有处理覆盖安装吗
```

---

## 完成后动作

1. **写测试报告**到 `~/CodeProjects/syncplay/tasks/{{TASK_ID}}-test-report.md`
   - 用 `templates/test-report.md` 格式
   - **每项验证清单都有 PASS/FAIL + 证据**（无日志的 FAIL 不算数）

2. **git commit**（**不** push）：
   ```bash
   cd ~/CodeProjects/syncplay
   git add tasks/{{TASK_ID}}-test-report.md
   git commit -m "test(v0.6.0): add test report for {{TASK_ID}}"
   ```

3. **stdout 输出** `TESTER_DONE: tasks/{{TASK_ID}}-test-report.md`

4. **不要做**：
   - ❌ 改任何源代码
   - ❌ 改 docs/ 下的文档
   - ❌ git push
   - ❌ 跳过验证清单任何一项
   - ❌ 美化 FAIL 结果

---

## 红线

- **不修代码** —— 发现 bug 详细描述"建议 Builder 怎么修"，不自己动手
- **不重试** —— 跑完一次就报告
- **不打 token** —— 不要把任何 token / 凭证打到报告
- **不跳项** —— 每项验证清单都必须跑

---

## OpenClaw 注入示例

> 这段**不**放进任务书本身 —— 给 OpenClaw subagent 看的。

### 怎么派 Tester subagent（**必须**等 Builder 完工后）

```typescript
// 主 agent (Jarvis) 在 OpenClaw 派活代码示意

// ⚠️ 关键: 必须在 builder subagent 完工事件后, 才能派 tester
// (参考 control-claude.md 怎么保证 serial execution)

const testerTask = `
## 身份
你是 Tester orchestrator。Jarvis 派你跑 Claude Code 完成 Tester 任务 (fresh context)。

## ⚠️ 关键: Fresh context
你跟 Builder subagent 是**两个不同进程**。**绝对不能**跟 Builder 共享 context。
- Builder subagent 1 已退出 (context 销毁)
- 你的 subagent 进程是新的
- claude -p 启动的 Claude Code 是新 session

## 任务
跑 Claude Code 完成以下 Tester 任务, 监督输出, 提取测试报告路径, 回报 Jarvis。

## 步骤
1. 验证环境 (跟 Builder 一样):
   \`\`\`bash
   claude --version
   echo "\${ANTHROPIC_API_KEY:0:10}"
   \`\`\`

2. 读任务书:
   \`\`\`bash
   cat ~/CodeProjects/syncplay/tasks/{{TASK_ID}}-tester.md
   \`\`\`

3. 跑 Claude Code:
   \`\`\`bash
   cd ~/CodeProjects/syncplay
   claude -p "\$(cat tasks/{{TASK_ID}}-tester.md)"
   \`\`\`
   注意: 这里**只**注入 tester 任务书, 不注入 builder 任务书 / builder context

4. 抓输出:
   - 找 \`TESTER_DONE: <path>\` 标记
   - 抓最后 50 行 stdout
   - 失败抓全部 stderr

5. 验证测试报告:
   \`\`\`bash
   cd ~/CodeProjects/syncplay
   cat tasks/{{TASK_ID}}-test-report.md
   git log -1 --format="%H %s" -- tasks/{{TASK_ID}}-test-report.md
   \`\`\`
   确认报告存在 + 被 commit

6. 回报 Jarvis (用完工事件):
   - 测试报告路径
   - 报告结论 (PASS / FAIL)
   - 关键发现 (3-5 条)
   - 任何警告

## 红线
- ❌ 不要让 Claude Code 改任何源代码
- ❌ 不要让 Claude Code 改 docs/ 下的文档
- ❌ 不要让 Claude Code git push
- ❌ 不要重试超过 1 次
- ❌ 不要注入 builder 任务书 / builder context
- ✅ 跑完立刻 push 完工事件给 Jarvis
`;

// ⚠️ 必须在 builder 完工事件后才派
await sessions_spawn({
  task: testerTask,
  taskName: "tester-{{TASK_ID}}",
  runtime: "subagent",
  mode: "run"
});
```

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
