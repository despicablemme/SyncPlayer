# 如何控制 Claude Code (Control Claude Code)

> **这是什么？** 在 SyncPlay 项目"如何让 Claude Code 干活"的具体技术细节——派活、抓结果、保证独立上下文、边界情况。
> **何时查阅？** 主 agent 写完任务书、准备派给 Claude Code 之前**必读**。
> **最后更新：** 2026-06-09

---

## 🚦 一句话

**Claude Code 是 CLI tool，不是 agent-orchestrable 服务**——它**没有**任务派发 API、进度 webhook、result callback。**主 agent 通过 OpenClaw subagent 跑 `claude -p` 来"编排"它**，实现"独立上下文"的硬约束。

---

## 🎯 三种调用方式对比

| 方式 | 适用场景 | 独立 context | 主人操作 |
|---|---|---|---|
| **🅰️ subagent 跑 `claude -p "<prompt>"`** | 大多数任务（推荐） | ✅ 真 fresh | 主人**不**开 terminal |
| **🅱️ 主人 terminal 跑 `claude` REPL** | 需要多轮交互的复杂任务 | ⚠️ 同一 session 累积 | 主人开 1-2 个 terminal |
| **🅲️ subagent 跑 `claude` REPL + pty** | 持续监听 Claude Code 状态 | ❌ 难保证 | 主人**不**开 terminal（不推荐） |

**SyncPlay 项目默认用 🅰️。🅱️ 用于 fallback（🅰️ 失败时）。🅲️ 几乎不用。**

---

## 🅰️ subagent 跑 `claude -p` (推荐模式)

### 流程

```
主 agent (Jarvis) 
    ↓ sessions_spawn
subagent-orchestrator
    ↓ exec: claude -p "<prompt>"
Claude Code (fresh session)
    ↓ 跑完一个任务就退出
subagent-orchestrator 抓 stdout
    ↓ 提取 BUILDER_DONE / TESTER_DONE
    ↓ 报告
主 agent (Jarvis)
```

### 主 agent 怎么派 Builder subagent

**subagent 任务书模板**（主 agent 给 subagent 派的，不是给 Claude Code 派的）：

```markdown### ⚠️ 必加 `--add-dir` flag (2026-06-09 新增红线)

**`claude -p` 默认只允许读当前 shell 所在目录**。如果不加 `--add-dir`, Claude Code **读不到** syncplay 文件, 任务书里的"必读 AGENT_PRACTICES.md" 等于空话.

**修法 (subagent 派活命令必须改成)**:

```bash
# ❌ 之前(读不到 syncplay 文件)
claude -p "$(cat tasks/v0.6.0-foo-builder.md tasks/v0.6.0-foo-context.md)"

# ✅ 现在(显式加 --add-dir)
claude --add-dir /Users/bruce/CodeProjects/syncplay \
       -p "$(cat tasks/v0.6.0-foo-builder.md tasks/v0.6.0-foo-context.md)"
```

**多目录**(如需要读其他项目):

```bash
claude --add-dir /Users/bruce/CodeProjects/syncplay \
       --add-dir /Users/bruce/Documents/KnowLedgeDatabase \
       -p "..."
```

**flag 顺序**:`--add-dir` 必须在 `-p` 之前, 否则报"Input must be provided either through stdin or as a prompt argument"。

**实证** (2026-06-09 主 agent 跑过): 加 `--add-dir` 后 Claude Code 能读 757 行 AGENT_PRACTICES.md, 不加报"路径不在 allowed dir"。

详见 `~/CodeProjects/syncplay/AGENT_PRACTICES.md #16`。


## 身份
你是 Builder orchestrator。Jarvis 派你跑 Claude Code 完成 Builder 任务。

## 任务
跑 Claude Code 完成以下 Builder 任务，监督输出，提取 commit-sha，回报 Jarvis。

## 步骤
1. **先验证环境**：
   - `claude --version` → 应返回 2.1.153+
   - `echo $ANTHROPIC_API_KEY` | head -c 10 → 应有 "sk-ant-..." 前缀
     （如果是空，说明 key 没配，停下来报告，不要瞎试）
   - `git -C ~/CodeProjects/syncplay status` → 应该 clean 或有预期改动
2. **读任务书**：
   - `cat ~/CodeProjects/syncplay/tasks/<task-name>-builder.md`
   - `cat ~/CodeProjects/syncplay/tasks/<task-name>-context.md`
3. **跑 Claude Code**：
   - 把任务书 + context 摘要**拼接**成 prompt
   - `claude -p "<merged prompt>"` （注意转义 + 注意 token 限制）
   - 如果任务书太长（> 8K tokens），用 `claude -p "$(cat tasks/<task>-builder.md tasks/<task>-context.md)"`
4. **监督输出**：
   - 抓 Claude Code 的 stdout
   - 找 `BUILDER_DONE: <commit-sha>` 标记
   - 抓最后 50 行（如果失败抓全部 stderr）
5. **验证 commit**：
   - `git -C ~/CodeProjects/syncplay log -1 --format="%H %s"` → 确认 commit 存在
   - `git -C ~/CodeProjects/syncplay show --stat HEAD` → 看改了什么文件
6. **回报 Jarvis**（必须包含）：
   - commit-sha
   - commit message
   - 改了哪些文件（行数）
   - unit test 跑通证据
   - 任何警告 / 异常

## 红线
- ❌ 不要让 Claude Code 改 docs/CHANGELOG.md / docs/STATUS.md / AGENT_PRACTICES.md
- ❌ 不要让 Claude Code git push
- ❌ 不要在 prompt 里贴 ANTHROPIC_API_KEY（subagent 不需要，claude 自己读 env）
- ❌ 不要重试超过 1 次（失败就报告 Jarvis）
- ✅ Claude Code 失败 → 抓 stderr 全文 + exit code 报告
- ✅ 跑完**立刻** push 完工事件回 Jarvis（per MEMORY 铁律 #20）
```

### 主 agent 怎么派 Tester subagent

跟 Builder subagent 几乎一样，**不同点**：
1. 任务书是 `tasks/<task-name>-tester.md`（不是 builder）
2. 跑完让 Claude Code 写报告到 `tasks/<task-name>-test-report.md`（**不** commit）
3. 抓 `TESTER_DONE: <report path>` 标记
4. **关键**：subagent 1 必须**先退出**（context 销毁），subagent 2 才能启动

**怎么强制 serial execution**：

```typescript
// 主 agent (Jarvis) 派活代码示意
const builderSession = await sessions_spawn({ 
  task: "...", 
  taskName: "builder-v0.6-foo", 
  mode: "run" 
});
await sessions_yield();  // 等 builder 完工事件

// 等到 builder 完工事件后, 再派 tester
const testerSession = await sessions_spawn({ 
  task: "...", 
  taskName: "tester-v0.6-foo", 
  mode: "run" 
});
await sessions_yield();  // 等 tester 完工事件
```

**绝对不能并行**派 Builder 和 Tester——会破坏独立上下文。

---

## 🅱️ 主人 terminal 跑 Claude Code (fallback)

### 什么时候用
- Builder 任务需要**多轮交互**（"先这样写 → 不行改一下 → 再不行…"）
- `claude -p` 模式**不支持交互**——单次跑完就退
- 这种任务需要 Claude Code REPL 持续 session

### 流程（主人操作）

```bash
# 主人开 terminal 窗口 1
cd ~/CodeProjects/syncplay
claude
# 进去后贴任务书:
> 读 tasks/<task-name>-builder.md
> 读 AGENT_PRACTICES.md
> 读 docs/STATUS.md
> 任务: {任务内容}
> ...
```

### 主人怎么把结果同步给 Jarvis

- 主人 terminal 看到 `BUILDER_DONE: <sha>` 后，**主动**在 webchat 告诉我
- 或者主人把 commit 链接 / sha 贴到 webchat
- 我（Jarvis）读到后走 Tester 派活流程

### 这种模式的"独立上下文"问题

- Builder REPL 跑完后，主人**必须**用 `:/exit` 或 Ctrl+C 退出
- 然后**重新开** `claude`（新 REPL，新 session）
- 这才能保证 Builder 和 Tester 物理隔离
- **如果主人忘了退出直接切换**，context 会累积——这不是 fresh

---

## 🛡️ 凭证管理（key 持久化）

### 主人必须**一次性**配 key（per AGENT_PRACTICES #11 教训）

**两种方式**：

#### 方式 A：Claude Pro 订阅（OAuth）
```bash
# 主人自己跑 (需要浏览器交互, 我帮不了)
claude /login
# → 浏览器打开 https://claude.ai/oauth/...
# → 主人登录授权
# → Claude Code 自动把凭证写到 ~/.claude/.credentials.json
```

**特点**：
- ✅ 不用管理 API key
- ✅ 自动续费（订阅制）
- ❌ 跨机器不通用
- ❌ 重装 Claude Code 后要重新 /login

#### 方式 B：Anthropic API key（推荐）
```bash
# 主人把 key 给我, 我立刻持久化到 ~/.zshrc (per #11 教训)
# 我会跑:
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc

# 验证:
echo $ANTHROPIC_API_KEY | head -c 10
# 应输出: sk-ant-...
```

**特点**：
- ✅ 跨机器通用
- ✅ 重装系统后只要 zshrc 还在就能用
- ❌ 按 token 用量计费
- ❌ key 泄露要立刻去 https://console.anthropic.com 撤销

### 主 agent 怎么验证 key 已配

每次派 Claude Code subagent 前，subagent 会跑：
```bash
claude --version  # 验证安装
echo "${ANTHROPIC_API_KEY:0:10}"  # 验证 env (只打前缀, 不打全文)
```

如果 key 不存在或无效，subagent **立刻** 报告失败（per #11 教训——"凭证已就位"必须用工具验证，不能凭印象）。

---
### 📌 实战案例：Claude Code + MiniMax Coding Plan (2026-06-09 已验证)

主 agent 配 Claude Code 走 MiniMax 订阅 API（不走 Anthropic 官方 API）的完整流程。

**主人环境**：
- macOS
- MiniMax Coding Plan 订阅（key 前缀 `sk-cp-`）
- 所在地：中国大陆

**完整 9 项 env**（写到 `~/.claude/settings.json` 的 `env` 段）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.minimaxi.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<sk-cp-... 订阅 key>",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "ANTHROPIC_MODEL": "MiniMax-M3",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "MiniMax-M3",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "MiniMax-M3",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "MiniMax-M3",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "512000"
  }
}
```

**配套改 `~/.claude.json`**（merge，不覆盖！）:
```python
import json
data = json.load(open('~/.claude.json'))
data['hasCompletedOnboarding'] = True
json.dump(data, open('~/.claude.json', 'w'), indent=2)
```

**关键注意事项**：
- ⚠️ Token 字段是 `ANTHROPIC_AUTH_TOKEN`（**不是** `ANTHROPIC_API_KEY`）
- ⚠️ Base URL 是 `minimaxi.com`（**不是** `minimax.com`，国际用户用 `minimax.io`）
- ⚠️ 用 Python 写文件，不破坏全角标点（per AGENT_PRACTICES #13）
- ⚠️ ~/.claude.json **必须 merge** —— 文件已有 userID 等数据，覆盖会丢
- ⚠️ 9 项 env 都要齐（**特别**：第 9 项 `CLAUDE_CODE_AUTO_COMPACT_WINDOW: 512000` 容易被漏）
- ✅ 用 `claude -p "say hello in Chinese"` 测连通 —— MiniMax-M3 中文输出是"你好"等

**完整 5 步流程**：

| 步骤 | 主人做 | 主 agent 做 |
|---|---|---|
| 1 | 拿订阅 key (https://platform.minimaxi.com/user-center/payment/token-plan) | (无) |
| 2 | `printf '%s' '<key>' > /tmp/.claude_api_key && chmod 600 /tmp/.claude_api_key` | (无) |
| 3 | (无) | **安全验证 key** (curl 测 MiniMax API, 拿 HTTP 200) |
| 4 | (无) | **Python 写 settings.json** (9 项 env, 权限 600) + **merge ~/.claude.json** (加 hasCompletedOnboarding) |
| 5 | (无) | **安全删 /tmp/.claude_api_key** + **claude -p 测试** + 报告主人 |

**详细教训**：见 `~/CodeProjects/syncplay/AGENT_PRACTICES.md #14`


## 🎯 ACP harness 模式 (v0.6+ 推荐替代 subagent 模式)

**2026-06-09 主人决定**: v0.6+ 用 ACP harness 模式 (`runtime: "acp"`) 跑 Claude Code, 替代 native subagent 模式.

> ⚠️ **2026-06-09 主人补充**: **所有 ACP spawn 必加 `streamTo: "parent"`** (主 agent 收实时 stream, 关键节点汇报主人). 见 #19 教训.

**核心区别**: native subagent 模式 = subagent 跑 `claude -p "<prompt>"`; ACP harness 模式 = OpenClaw acpx **直接 spawn Claude Code 进程**.

### 启用 ACP (一次性)

```bash
# 1. 装 acpx plugin
openclaw plugins install @openclaw/acpx

# 2. 启用
openclaw config set plugins.entries.acpx.enabled true

# 3. 配 harness-level permission (关键, 不配会 Permission prompt unavailable)
openclaw config set plugins.entries.acpx.config.permissionMode approve-all

# 4. 重启 gateway
openclaw gateway restart

# 5. 验证 (主人在 webchat 跑 /acp doctor, 这是 chat slash command)
# /acp doctor
# 应输出: enabled, healthy backend, Claude Code auth present
```

### 主 agent 派 ACP Builder / Tester (sessions_spawn API)

```typescript
// ✅ 必填: runtime + agentId 同时传
await sessions_spawn({
  task: "<builder 任务书 + context 摘要 + ACP 模式说明>",  // 任务书在 .agent-tasks/<version>/
  taskName: "builder-v060-url-bug",  // taskName 不含点 (per OpenClaw 限制)
  label: "Builder ACP: v0.6.0-url-bug (FR-2)",
  runtime: "acp",        // ← 关键
  agentId: "claude",     // ← 关键 (不填报 target_agent_required 错)
  cwd: "/Users/bruce/CodeProjects/syncplay",  // 可选, 让 Claude Code 默认在 syncplay 目录
  streamTo: "parent",   // ← 必加 (主人 2026-06-09 决定, per #19), 主 agent 收实时 stream
  mode: "run"
});
await sessions_yield();  // 等完工事件 (push-based, 不 poll)
```

### 主人在 webchat 跑 (slash command)

```
/acp spawn claude --bind here    # bind 当前对话, 主人 webchat 直接看 Claude Code 输出
/acp spawn claude --mode persistent --thread auto
/acp model claude-sonnet-4-6      # 切 model 实时生效
/acp permissions <profile>         # 切权限 profile
/acp steer <msg>                   # 中途改方向 (native subagent 做不到!)
/acp cancel                        # 中断当前 turn
/acp close                         # 关 session + bindings
```

> ⚠️ **关键澄清 (per AGENT_PRACTICES #19)**: `/acp status` / `/acp cancel` / `/acp close` 是 **OpenClaw Gateway 命令**, **不**是用户在 webchat 直接打的 (我之前 control-claude.md 段**写错**了, 主人实测报错 `Session is not ACP-enabled: agent:main:main`).
>
> **正确渠道**:
> - `/acp spawn` / `/acp steer` / `/acp model` / `/acp permissions` — 用户 (主人在 webchat) **可**打, 因为**这些**是 ACP harness 控制命令
> - `/acp status` / `/acp cancel` / `/acp close` — **主 agent (Jarvis) 调**, 用 `subagents` 工具查 / `sessions_send` 介入
>
> **主人真能用的 visibility** = 主 agent 主动汇报 (完工事件) + 主人问"现在跑得怎样" + 我调 `subagents list` 查. **不**是 `/acp status` slash command.

### 跟 native subagent 模式关键差异

| 维度 | Native subagent (`runtime: "subagent"`) | ACP harness (`runtime: "acp"`) |
|---|---|---|
| **跑什么** | OpenClaw sub-agent (我派) | **外部 Claude Code CLI 进程** (acpx spawn) |
| **session key 格式** | `agent:main:subagent:<uuid>` | `agent:claude:acp:<uuid>` (用 `agentId` 作 prefix) |
| **认证** | OpenClaw 自己的 `ANTHROPIC_AUTH_TOKEN` | Claude Code 自己的 auth (`~/.claude/settings.json` 9 项 env, per AGENT_PRACTICES #14) |
| **model** | 继承主 agent (MiniMax-M3) | **Claude Code 自己的 model** (用 host 配置) |
| **tools** | OpenClaw 工具 + 我传的 task | **Claude Code 自己的 tools** (Read/Edit/Bash) |
| **filesystem** | 间接 (subagent 跑 `claude -p`) | **直接** (Claude Code 原生 fs) |
| **Visibility (主 agent)** | ❌ 看不到 subagent 内部 stdout | ✅ `streamTo: "parent"` 实时回流 |
| **中途改方向** | ❌ abort + 重派 | ✅ `/acp steer <msg>` 直接 steer |
| **cwd 怎么传** | subagent 任务书里写 `cd <path>` | `sessions_spawn({cwd: "/path"})` 参数 |
| **permission 配在哪** | `tools.subagents.tools.allow/deny` | `plugins.entries.acpx.config.permissionMode` |

### ⚠️ ACP 模式注意事项 (v1/v2/v3 教训, per AGENT_PRACTICES #18)

1. **首次跑 ACP 要下载 Claude Code 适配器** —— `Other target harness adapters may still be fetched on demand with npx the first time you use them`. 后续跑就快.
2. **必传 `agentId`** —— `runtime: "acp"` + 缺 `agentId` 报 `target_agent_required` 错.
3. **真 permission 配置在 acpx config, 不在 sessions_spawn API** —— 我之前 v2 试过 `permissionProfile: "approve-all"` (sessions_spawn 参数), **是错的**, OpenClaw 不接受. 正确的是 `plugins.entries.acpx.config.permissionMode=approve-all`.
4. **`permissionMode` 合法值** = `approve-reads` (默认) / `approve-all` (break-glass) / 还有其他. `approve-all` 适合 v0.6 任务 (有写文件需求).
5. **`nonInteractivePermissions` 合法值** = 只有 `deny` / `fail`. **没有** `approve-all` (我误以为有, v2 配错).
6. **配 config 后必重启 gateway** —— 不重启不生效.
7. **request 不能 sandboxed** —— `OpenClaw hides runtime: "acp" until ... the current session must not be sandbox-blocked`.
8. **OpenClaw 工具默认不暴露给 ACP** —— `OpenClaw plugin tools and built-in OpenClaw tools are not exposed to ACP harnesses by default`. ACP harness 用 Claude Code 自己的工具.
9. **不需要 `--add-dir` flag** —— ACP 模式 Claude Code 用 host cwd, `cwd` 参数设了就行.
10. **smoke test 是必需** —— 任何 v0.6+ 任务跑 ACP 前, 先 echo test 验证链路 (per v3 教训).

### 任务书模板差异 (跟 native subagent 模式)

✅ **builder 任务书可共用** —— 必读 context / 自我验证段 / 禁区 / BUILDER_DONE marker / 验收标准 / 完成后动作 全部一样.

❌ **唯一区别**: 任务书里**不**写 `--add-dir /Users/bruce/CodeProjects/syncplay` (那是 native subagent 模式需要). ACP 模式 Claude Code 用 `cwd` 参数 + host 默认目录.

### 何时用哪种 (v0.6+ 推荐)

| 场景 | 推荐 | 理由 |
|---|---|---|
| **v0.6 后续子任务 (B/C)** | **ACP** | visibility 优势 + 实测比 native 快 2.3 倍 (v0.6-B: 6m15s vs v0.6-A: 14m30s) |
| 短原子任务 (< 1 分钟) | Native subagent | ACP 首次要下 adapter 慢 |
| 复杂长 session (多轮 edit + test + commit) | **ACP** | 中途可 `/acp steer`, 不浪费已完成工作 |
| 非 Claude Code harness (Gemini CLI / Cursor / Droid) | **ACP** (per harness id) | ACP 是外部 harness 统一接口 |
| 需要 OpenClaw 工具 (memory / schedule / 通知) | Native subagent | ACP 默认不暴露 OpenClaw 工具 |

### 完整 ACP 失败案例 (沉淀给未来)

| 版本 | 错 | 根因 |
|---|---|---|
| v1 | 缺 permission profile | OpenClaw 默认 `permissionMode=approve-reads` + `nonInteractivePermissions=fail` |
| v2 | `sessions_spawn({permissionProfile: "approve-all"})` 失败 | 这个 API 参数**不存在**, OpenClaw 不接受 |
| v3 | ✅ | 真配法 = `openclaw config set plugins.entries.acpx.config.permissionMode approve-all` + `gateway restart` |

详见 `~/CodeProjects/syncplay/AGENT_PRACTICES.md #18` (完整 v1/v2/v3 故事 + 修法 + 加固规则).

### 沉淀

- ✅ `agentWorkflowAndTemplates/runbook.md` § "🎯 模式选择: Native subagent vs ACP harness" (commit `3f2c4d6`)
- ✅ `AGENT_PRACTICES.md #18` (v1/v2/v3 完整故事, commit `a3c0dca`)
- ✅ `agentWorkflowAndTemplates/control-claude.md` § "🎯 ACP harness 模式" (本段, 即将 commit)

---

## ⚠️ 边界（什么情况下不推荐用 Claude Code）

| 场景 | 推荐替代 |
|---|---|
| 任务需要**实时**多轮交互 | 主人 terminal 跑 Claude Code |
| 任务超长（prompt > 8K tokens） | 拆成多个小任务 / 写到 tasks/ 让 Claude Code 读文件 |
| 任务涉及**网络/网络敏感操作** | 主人手动操作（per AGENT_PRACTICES #12 教训——代理可能不工作） |
| 任务涉及**金钱交易** | ❌ 绝不（per USER.md 重要规则） |
| 任务需要 **GUI 交互** | 主人手动（Claude Code 是 CLI） |
| 任务需要**安装系统软件** | 主人手动 + 主人确认（per MEMORY #2 教训） |

---

## 🐛 常见错误

### 错误 1：subagent 跑完 `claude -p` 没抓 commit-sha
**症状**：subagent 报告"Claude Code 跑完了"，但没 commit-sha  
**修复**：subagent 任务书里**必须**明确"抓 `BUILDER_DONE: <sha>` 标记"——不要让 subagent 自己去 git log 找

### 错误 2：Builder 和 Tester 并行派
**症状**：两个 subagent 同时跑，context 串了  
**修复**：主 agent 用 `sessions_yield` 串行等完工事件，**绝不**并行

### 错误 3：subagent 任务书里贴了 ANTHROPIC_API_KEY
**症状**：key 泄露到 subagent transcript  
**修复**：subagent 不需要 key，claude 自己读 env，subagent 任务书里**只**说"验证 env 存在"（不读全文）

### 错误 4：Claude Code 改 docs/ 文档
**症状**：CHANGELOG.md / STATUS.md 被 Builder 改坏  
**修复**：Builder 任务书**明确**列"不要改 X / Y / Z"——见 `templates/builder-task.md`

### 错误 5：测试报告没 commit
**症状**：Tester 写了报告到 `tasks/<task>-test-report.md`，但 subagent 抓不到 `TESTER_DONE` 标记  
**修复**：Tester 任务书**明确**说"用 `git add tasks/<task>-test-report.md && git commit` 然后输出 `TESTER_DONE: <path>`"——但**不** push

---

## 📚 关联文档

- `workflow.md` — 整体流程
- `roles.md` — 三角色定义
- `acceptance.md` — 验收
- `templates/builder-task.md` / `templates/tester-task.md` — 任务书模板（含 OpenClaw 注入示例）
- `~/CodeProjects/syncplay/AGENT_PRACTICES.md` — #11 (token 配置) / #12 (代理配置) 必读

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
