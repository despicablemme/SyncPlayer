# Builder 任务书模板

> **这是什么？** 给 Builder Claude Code 实例的任务书模板——主 agent 写完后 commit 到 `tasks/<task-name>-builder.md`，然后注入给 Claude Code。
> **何时使用？** 主 agent 决定派 Builder 任务时**第一件事**：复制本模板，填占位符，commit。
> **最后更新：** 2026-06-09

---

## 使用方式

1. **复制本文件** → `tasks/<task-name>-builder.md`（如 `tasks/v0.6.0-macos-install-builder.md`）
2. **替换占位符** —— 搜索 `{{ }}` 全部填上
3. **关联 context 摘要** → 写 `tasks/<task-name>-context.md`（用 `templates/context-summary.md`）
4. **写完后 commit**（**不** push，Reviewer 统一 push）
5. **派 Builder subagent** —— 用末尾的 OpenClaw 注入示例

---

## 任务书模板（占位符版）

```markdown
# Builder 任务书 - {{TASK_NAME}}

> **任务 ID**: {{TASK_ID}} （如 v0.6.0-macos-install）
> **版本**: {{VERSION}} （如 v0.6.0）
> **优先级**: {{P0/P1/P2}}
> **预计工作量**: {{<X 小时 / <X 文件 / <X 行}}
> **最后更新**: {{YYYY-MM-DD}}

---

## 必读 context（先读完再动手）

1. `/Users/bruce/CodeProjects/syncplay/AGENT_PRACTICES.md` —— **必读**，SyncPlay 项目的所有教训（特别是 #1-#12）
2. `/Users/bruce/CodeProjects/syncplay/docs/STATUS.md` —— 项目当前状态
3. `/Users/bruce/CodeProjects/syncplay/docs/ROADMAP.md` —— 项目目标
4. `/Users/bruce/CodeProjects/syncplay/tasks/{{TASK_ID}}-context.md` —— 本任务专属 context 摘要
5. （如相关）`/Users/bruce/CodeProjects/syncplay/docs/ARCHITECTURE.md` —— 架构说明
6. （如相关）`/Users/bruce/CodeProjects/syncplay/docs/CHANGELOG.md` —— 历史版本记录

---

## 自我验证 (必做, 不做不要动手)

**你必须**在读完必读 context 后, **stdout 输出**这段(证明你真的读了):

```
✓ 已读 AGENT_PRACTICES.md (<N> 行, 关键教训: #X #Y #Z)
✓ 已读 docs/STATUS.md (<N> 行, 当前阶段: <一句话>)
✓ 已读 docs/ROADMAP.md (<N> 行, 相关决策: <一句话>)
✓ 已读 tasks/<task-id>-context.md
✓ 任务目标复述: <用你自己的话复述本任务要做什么>
```

**如果任何文件读失败** (路径错 / 不在 allowed dir / 权限不够), **立刻报告失败并停止**:
```
✗ 读 <文件路径> 失败: <错误>
可能原因: 路径错 / working dir 不在 --add-dir 列表 / 权限不够
请主 agent 修
```

**为什么**:
- 主人问"Claude Code 知道读什么吗"是硬问题 (per AGENT_PRACTICES #16)
- 主 agent 验收时**必须**看你 stdout 里有这段, 不然 = 你没读 = 任务不合格
- working dir 默认是当前 shell 目录, 不会自动包含 syncplay — 主 agent 必须用 `--add-dir /Users/bruce/CodeProjects/syncplay` 派你

---

## 目标

{{用 1-3 句话说清楚"要做什么"。要具体，不要"优化一下"这种模糊词。}}

**示例**：
> 写 macOS 用户安装文档 `docs/INSTALL_macOS.md`，覆盖从 GitHub 下载 dmg → 拖入 /Applications → 处理 Gatekeeper quarantine 提示 → 验证能开。文档要给"完全没开发背景的家庭用户"看。

---

## 详细要求

### 必做项

1. {{要求 1，具体到文件路径/章节}}
2. {{要求 2}}
3. {{要求 3}}

### 不要做（禁区）

- ❌ **不要改** `docs/CHANGELOG.md` / `docs/STATUS.md` / `docs/ROADMAP.md` —— Reviewer 的活
- ❌ **不要改** `AGENT_PRACTICES.md` —— Reviewer 的活
- ❌ **不要改** `agentWorkflowAndTemplates/` 下的任何文件 —— 工作流文档
- ❌ **不要 git push** —— Reviewer 统一 push
- ❌ **不要跑 e2e / 兼容性测试** —— Tester 的活
- ❌ **不要改** 任务书范围外的文件

### 已知坑（必看）

{{列出这个任务**已知的坑**，引用 AGENT_PRACTICES 教训，避免重蹈覆辙}}

**示例**：
> - AGENT_PRACTICES.md #22: Mac "damaged" 真实根因是 `com.apple.quarantine` xattr，不是 dmg 损坏——文档要让用户知道
> - AGENT_PRACTICES.md #5: 不要把任何 token / 凭证打到 stdout 或文档里

---

## 验收标准（Reviewer 会逐项核对）

- [ ] {{标准 1，**可验证**}}
- [ ] {{标准 2}}
- [ ] {{标准 3}}
- [ ] {{标准 4}}
- [ ] {{标准 5}}

**示例**（"可验证"标准）：
- ✅ 文档覆盖从 GitHub 下载 dmg 到首次打开的全部步骤
- ✅ 引用了 `xattr -dr com.apple.quarantine` 命令（带具体路径示例）
- ✅ 引用 AGENT_PRACTICES.md #22 解释"damaged"真实原因
- ❌ ~~"文档清晰易读"~~（不可验证）

---

## 完成后动作

1. **跑 unit test**（如适用）：
   ```bash
   cd ~/CodeProjects/syncplay
   npm test
   ```
   把结果（pass/fail 数）记到 commit message 里。

2. **git commit**（**不** push）：
   ```bash
   git add <改动文件>
   git commit -m "<见 commit-message.md 模板>"
   ```

3. **stdout 输出** `BUILDER_DONE: <commit-sha>`（subagent 抓这个标记提取 commit）

4. **不要做**：
   - ❌ git push
   - ❌ 改 docs/STATUS.md 等禁区
   - ❌ 跑 e2e / 兼容性测试

---

## 红线

- 失败一次就退出（**不**自己重试 3 次）—— 报告 stderr 给 subagent
- 不要把 ANTHROPIC_API_KEY 或任何凭证打到 stdout / commit message
- 范围超任务书 → 停下来报告，不自己扩

---

## OpenClaw 注入示例

> 这段**不**放进任务书本身——给 OpenClaw subagent 看的，知道怎么用这个任务书派活。

### 怎么派 Builder subagent

```typescript
// 主 agent (Jarvis) 在 OpenClaw 派活代码示意
const builderTask = `
## 身份
你是 Builder orchestrator。Jarvis 派你跑 Claude Code 完成 Builder 任务。

## 任务
跑 Claude Code 完成以下 Builder 任务，监督输出，提取 commit-sha，回报 Jarvis。

## 步骤
1. 验证环境:
   \`\`\`bash
   claude --version  # 应返回 2.1.153+
   echo "\${ANTHROPIC_API_KEY:0:10}"  # 应有 "sk-ant-..." 前缀
   \`\`\`
   如果 key 不存在, 立刻报告失败 (per AGENT_PRACTICES #11)

2. 读任务书:
   \`\`\`bash
   cat ~/CodeProjects/syncplay/tasks/{{TASK_ID}}-builder.md
   cat ~/CodeProjects/syncplay/tasks/{{TASK_ID}}-context.md
   \`\`\`

3. 跑 Claude Code:
   \`\`\`bash
   cd ~/CodeProjects/syncplay
   claude -p "\$(cat tasks/{{TASK_ID}}-builder.md tasks/{{TASK_ID}}-context.md)"
   \`\`\`
   (注意: claude -p 不需要预先 cd, 这里只是示意)

4. 抓 Claude Code 输出:
   - 找 \`BUILDER_DONE: <commit-sha>\` 标记
   - 抓最后 50 行 stdout
   - 失败抓全部 stderr

5. 验证 commit:
   \`\`\`bash
   cd ~/CodeProjects/syncplay
   git log -1 --format="%H %s"
   git show --stat HEAD
   \`\`\`

6. 回报 Jarvis (用完工事件):
   - commit-sha
   - commit message
   - 改了哪些文件
   - unit test 结果
   - 任何警告

## 红线
- ❌ 不要让 Claude Code 改 docs/CHANGELOG.md / docs/STATUS.md / AGENT_PRACTICES.md
- ❌ 不要让 Claude Code git push
- ❌ 不要在 prompt 里贴 ANTHROPIC_API_KEY
- ❌ 不要重试超过 1 次
- ✅ 跑完立刻 push 完工事件给 Jarvis (per MEMORY #20)
`;

await sessions_spawn({
  task: builderTask,
  taskName: "builder-{{TASK_ID}}",
  runtime: "subagent",
  mode: "run"
});
```

---

## 模板维护

- **每次发现 Builder 任务需要新的约束**，更新本模板（如新增"必读 context"项）
- **不要**为单个任务定制任务书结构 —— 用占位符填，不要删模板段落
- **新教训沉淀到 AGENT_PRACTICES.md**，不在本模板累积

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
