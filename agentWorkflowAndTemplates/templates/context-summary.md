# Context 摘要模板

> **这是什么？** 给 Builder Claude Code 用的"必读 context 摘要"模板——主 agent 写完任务书**同时**写 context 摘要，让 Builder 不用读完整文档就能拿到关键信息。
> **何时使用？** 主 agent 写 Builder 任务书**同时**写 context 摘要（**不**给 Tester 用——Tester 只读 git diff，避免污染）。
> **最后更新：** 2026-06-09

---

## 使用方式

1. **复制本文件** → `tasks/<task-name>-context.md`
2. **替换占位符**
3. **关联 Builder 任务书**（任务书里"必读 context"会引用本文件）
4. **主 agent 派 Builder subagent 时**，subagent 把本文件 + Builder 任务书**拼接**成 prompt 注入给 Claude Code

---

## 模板（占位符版）

```markdown
# Context 摘要 - {{TASK_NAME}}

> **任务 ID**: {{TASK_ID}}
> **关联任务书**: `tasks/{{TASK_ID}}-builder.md`
> **给谁看**: Builder Claude Code
> **最后更新**: {{YYYY-MM-DD}}

---

## 项目当前状态（1-3 句话）

{{从 docs/STATUS.md 摘关键状态}}

**示例**：
> SyncPlay v0.5.1 已发布 (2026-06-08). v0.5 阶段 GitHub Actions 跨平台 build 完成.
> 当前 v0.6.x 阶段: macOS 用户安装文档 + Linux AppImage 验证.

---

## 路线图关键决策（1-3 句话）

{{从 docs/ROADMAP.md 摘本任务相关的决策}}

**示例**：
> v0.6 目标: macOS 安装说明文档化 (quarantine 处理), 让 GitHub 下载 dmg 的非技术用户能顺利安装.
> 决策: 文档放在 `docs/INSTALL_macOS.md`, 不用 README.md (避免污染主入口).

---

## AGENT_PRACTICES 关键教训（2-5 条, 每条 1-2 句话）

{{从 AGENT_PRACTICES.md 摘本任务相关的教训, 只列**最相关**的, 不要全文贴}}

**格式**: `#{{编号}}: {{一句话教训}} - {{相关背景}}`

**示例**（任务 = 写 macOS 安装文档）：

```
#5: token 明文打印到 webchat transcript 多次 - 写文档时绝对不能把任何 token / 凭证打到正文
#11: 收到主人 export 的 token 误以为已配好 - 跟写文档无关, 跳过
#12: macOS 系统代理 ≠ git 代理 - 跟写文档无关, 跳过
#22: Mac "damaged" 真实根因是 quarantine xattr - 文档要让用户知道这点, 不是 dmg 损坏
```

**注意**：
- 只列**与本任务直接相关**的 2-5 条
- 不要全文贴 AGENT_PRACTICES.md（浪费 Claude Code token）
- 每条 1-2 句话，给 Builder 足够 context 但不啰嗦

---

## 当前 commit 状态

```
最近 5 个 commit:
{{SHA}} {{commit message}}
{{SHA}} {{commit message}}
...
```

**示例**：
```
最近 5 个 commit:
961b6dc ci: add auto-release job to GitHub Actions workflow
d088891 docs: v0.5.1 release - mark asar fix + cross-platform CI as shipped
e050b39 desktop: re-enable asar mode (v0.5.1)
1994c5e fix: merge duplicate 'push' trigger blocks in workflow YAML
9329f60 fix: ci workflow yaml syntax, add .github/workflows to paths filter
```

---

## 相关文件路径速查

| 文件 | 用途 |
|---|---|
| `{{path}}` | {{用途}} |
| `{{path}}` | {{用途}} |
| `{{path}}` | {{用途}} |

**示例**：
| 文件 | 用途 |
|---|---|
| `docs/INSTALL_macOS.md` | **本任务要写的文件**（不存在） |
| `docs/STATUS.md` | 项目状态（**不要改**） |
| `docs/ROADMAP.md` | 路线图（**不要改**） |
| `AGENT_PRACTICES.md` | 教训沉淀（**不要改**） |
| `README.md` | 项目入口（**不要改**，除非任务明确要求） |

---

## 任务特定的 context（任务书没说的细节）

{{如果有任务书没说的"隐藏要求", 写这里}}

**示例**：
> - 文档要写在 GitHub Pages 站点能直接显示（`docs/` 目录的 markdown）
> - 主人 6/8 macOS dmg 用的是 ad-hoc 签名, 不是 Developer ID, 所以 quarantine 不会自动消失
> - 文档不要给"花钱的解决方案"（per USER.md 重要规则: 禁止金钱交易相关动作）
> - 主人常用 GitHub Actions artifact, 文档要引用 https://github.com/despicablemme/SyncPlayer/actions

---

## 已知坑 + 不要犯的错

{{列出这个任务**最容易犯的错**, 引用 AGENT_PRACTICES + 本任务专属的}}

**示例**：
> - 不要给"用 Apple Developer ID 签名"作推荐方案 —— 主人没开发者账号, 花钱, 违反 USER.md 规则
> - 不要写 `sudo spctl --master-disable` 关 Gatekeeper —— 危险, 降低用户安全
> - 不要假设用户装了 Xcode Command Line Tools —— 大部分家庭用户没装

---

## OpenClaw 注入示例

> 这段**不**放进 context 摘要本身 —— 给 OpenClaw subagent 看的。

### 怎么把 context 摘要注入给 Builder

Builder subagent 任务书**已包含**这部分内容（参考 `templates/builder-task.md`），简要：

```bash
# Builder subagent 跑的脚本片段
cd ~/CodeProjects/syncplay
claude -p "$(cat tasks/{{TASK_ID}}-builder.md tasks/{{TASK_ID}}-context.md)"
```

**注意**：
- context 摘要**只给 Builder**, **不**给 Tester
- Tester 任务书**不**引用本文件（避免 Builder 污染 Tester）
- Builder 任务书里**明确**列出本文件作为"必读 context 第 4 项"

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
