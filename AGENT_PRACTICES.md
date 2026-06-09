# AGENT_PRACTICES.md — SyncPlay Agent 实战教训

> **这是什么？** SyncPlay 项目开发过程中 AI Agent（Jarvis + 子 agent）实际犯过的错、踩过的坑、总结出的可复用经验。
> **何时查阅？** 每次新 session 接 syncplay 任务、或者新 agent 接手这项目，**先看这个**——避免重蹈覆辙。
> **跟 `docs/AGENTS.md` 关系：** 那个是 v0.4 留的"三角色分工规范"（Builder/Tester/Reviewer 流程）。**这个是"犯过错"**——以负面案例 + 教训为主。
> **跟 `~/.openclaw/workspace/MEMORY.md` 关系：** 那个是跨项目通用规则（"subagent done 后查交付"等）。**这个是 syncplay 实战细节**——把通用规则**落到**这个项目具体场景。
> **最后更新：** 2026-06-08（v0.5.2 release 完工当天回顾）

---

## 📚 索引（按发生时间倒序）

| # | 教训 | 阶段 | 关联 MEMORY 规则 |
|---|---|---|---|
| 1 | [v04-commander 静默 21 小时没人查](#1-v04-commander-静默-21-小时没人查) | v0.4.0 | #20 |
| 2 | [说"立刻做"但同一回合没做](#2-说立刻做但同一回合没做) | v0.5.1 | #21 |
| 3 | [基于 spctl 评估推断"装上还是 damaged"](#3-基于-spctl-评估推断装上还是-damaged) | v0.5.1 | #22 |
| 4 | [基于单次 75s timeout 推断"OpenClaw 推不动"](#4-基于单次-75s-timeout-推断openclaw-推不动) | v0.5.2 | #13, #14 |
| 5 | [token 明文打印到 webchat transcript 多次](#5-token-明文打印到-webchat-transcript-多次) | v0.5.1 → v0.5.2 | — |
| 6 | [探 GitHub 凭证漏查 macOS Keychain](#6-探-github-凭证漏查-macos-keychain) | v0.5.1 release | — |
| 7 | [推 tag 没带 main commit](#7-推-tag-没带-main-commit) | v0.5.1 | — |
| 8 | [没预期 GitHub Actions artifact 在国内 Azure Blob 慢](#8-没预期-github-actions-artifact-在国内-azure-blob-慢) | v0.5.1 release | — |
| 9 | [诊断时不亲自跑命令拿证据](#9-诊断时不亲自跑命令拿证据) | v0.5.0 dmg 装不上 | #13, #14 |
| 10 | [派 subagent 失败后没立刻自己接手](#10-派-subagent-失败后没立刻自己接手) | v0.5.2 release 监控 | #20 |
| 11 | [收到主人 export 的 token 误以为已配好](#11-收到主人-export-的-token-误以为已配好) | v0.5.2 push | #1, #21 |

---

## 1. v04-commander 静默 21 小时没人查

### 情境
- **时间**：2026-06-07 22:43 启动 v04-commander subagent（v0.4 桌面打包 6 步走）
- **实际跑完**：2026-06-07 23:04（runtime 20m52s，**状态 done**）
- **交付**：v0.4.0 commit `7a15107` (Step 1-4) + `fa22cb1` (docs)

### 错在哪
- subagent 完工事件**没**触发主会话主动查 + 主动汇报
- 我**默认**"等主人问"才答，**没**"事件回流 = 主动汇报"
- 21 小时后**主人**问"进展怎么样"我才知道要查

### 教训
- subagent done 是**事件**，**不是**状态
- 收到 done 事件 = **立刻**查交付 + **立刻**主动汇报
- 同步任务完成 = 事件回流到主会话 + 主人看到汇报，**缺一不可**

### 避免
- subagent 跑完 → `subagents list` 查交付
- 查完 → 主动汇报主人（不写"等问才答"）
- 汇报内容：runtime / 交付 / 失败点 / 下一步

### 详细
见 `MEMORY.md` #20

---

## 2. 说"立刻做"但同一回合没做

### 情境
- **时间**：2026-06-08 晚上 v0.5.1 阶段
- **事件**：主人让我做 v0.5.1 dmg 修复，过程中我说"我立刻写进 MEMORY.md"
- **但**：**同一个回合**没真写，下一个回合还在准备 MEMORY 写入

### 错在哪
- 嘴上说"立刻" = 主人预期**本回合**做完
- 主人问"你写了吗" = 主人对口头承诺**失去信任**信号
- 主人在我心里"默认我可能没写"——意味着我**之前**就犯过这毛病

### 教训
- "立刻做" = **本回合**改文件，**不**等下一个工具调用
- 改完 → **明确告诉主人**："写到 X.md 行 N"（**不**说"已写"）
- 主人质问"你做没做"时 → **第一句回答事实**（已做/没做），**不**先解释

### 避免
- 说"立刻做"前**确认**这个工具调用能完成
- 写文件操作放在承诺**之前**（不是承诺 + 等工具）
- 改完**第一句**给"已写 + 写入位置 + 行号" 三件套

### 详细
见 `MEMORY.md` #21

---

## 3. 基于 spctl 评估推断"装上还是 damaged"

### 情境
- **时间**：2026-06-08 v0.5.1 asar 修复阶段
- **事件**：
  - v05-asar-fix subagent 改 asar=false → true
  - 但 spctl --assess **仍**报 `code has no resources but signature indicates they must be present`
  - 我**推断**："v0.5.1 dmg 装上还是弹 damaged，asar 修复没解决根本问题"
- **真因**：subagent 自己也说"fix requires Apple notarization (P2 — outside this PR scope)"
- **实际上**：主人后来跑 `xattr -dr com.apple.quarantine /Applications/SyncPlay.app` 后**能开**

### 错在哪
- **spctl 评估失败 ≠ 实际不能开**（macOS 实际运行时只看 quarantine + 签名状态）
- 我没区分"spctl 严格评估" vs "macOS 实际开 app" 两种不同路径
- 拿了 v0.5.0 dmg 装不上的现象 + spctl 评估失败，**线性推断**"v0.5.1 也装不上"

### 教训
- macOS Gatekeeper 拦截**优先看 quarantine**（xattr 标记），**不**严格看 spctl 评估
- 诊断 dmg 装不上时：`xattr -l <app> | grep quarantine` **先**看这个
- 区分**机制**（spctl 严格评估）和**实际**（macOS 运行时）

### 避免
- 看到 spctl 失败 → **不**立刻下结论
- 跑 `xattr -lr <app>` 看 quarantine 状态
- **先**问主人"你装上试了吗"再下结论

### 详细
见 `MEMORY.md` #22（最重要的 macOS dmg 实战教训）

---

## 4. 基于单次 75s timeout 推断"OpenClaw 推不动"

### 情境
- **时间**：2026-06-08 v0.5.2 推 tag 阶段
- **事件**：
  - 我 exec 跑 `git push origin main` → 75s timeout
  - **立刻**下结论："OpenClaw 推不动 / 你能推我不能推（sandbox 限制），主人在 Terminal 推"
  - 给主人 Terminal 命令让他推
- **主人质问**："如果你不行为什么我就行？"
- **真因**：4 host 都通（github.com HTTP 200, 2.2s），**就是网络抖动**，重试 3 秒推完

### 错在哪
- **单次**失败立刻下结论
- **没**做多 host 对比 / 重试验证
- 冤枉了 OpenClaw exec 工具（说它 sandbox 限速，实际**不**在 sandbox 里跑）

### 教训
- 网络问题 → **多 host 对比**（api.github.com / github.com / raw.githubusercontent.com 等）
- **单次** timeout **不**等于"系统级限制"
- 主人质疑时**立刻**做"为什么他能我不能"对比实验

### 避免
- exec 跑命令 30s+ 没出 → 立刻跑 `curl -sS -o /dev/null -w "HTTP %{http_code} time %{time_total}s" https://target` 看真实情况
- 跑 3-4 个**相关** host 对比
- 实在不行就 `time git push` 重试 1 次

---

## 5. token 明文打印到 webchat transcript 多次

### 情境
- **时间**：v0.5.1 → v0.5.2 全程
- **token 1**：`ghp_hO…X7Uw`（最初 Keychain 里的）
  - 我 `echo $TOKEN` 一次 → 进 transcript
  - subagent v05-release-creator prompt 里有 `T=*** find-internet-password ...)` → **OpenClaw shell snapshot 缓存** 拼出来
  - subagent v052-auto-release 准备 prompt 时**又**给了一字面量
- **token 2**：`ghp_FG…6otn`（主人"update 后给我的"）
  - 主人**直接发**到 webchat（13 字符截断显示）
  - 我**直接**用 `T='ghp_FG…6otn'` 进 transcript
- **结果**：两个 token **都**被迫 revoke，主人重新生成

### 错在哪
- token **一旦进 webchat transcript = 永久泄露**（OpenClaw transcript 是公开的/可查的）
- 主人**主动**发 token 到 webchat 时**没**强烈反对
- `echo $TOKEN` 一次看似无害，**实际**进 transcript
- subagent prompt 里写 `T='ghp_…'` 也会进 transcript

### 教训
- **绝对不要**让 token 走 webchat / 不安全渠道
- 即使 subagent 也要**用** `/tmp/.gh_token` (chmod 600) 文件**而**不是字面量
- 主人**主动**发 token 到 webchat → **立刻**反对 + 建议**用文件**方式

### 避免
- token **只**走 `/tmp/.gh_token`（权限 600）+ 用完 `rm`
- `cat /tmp/.gh_token` 拿值，**不** echo 出来
- subagent prompt 里 token 路径用**占位符**（`/tmp/.gh_token`），**不**写实际值
- 主人**主动**发 token → 先说"这会进 transcript，建议改成文件方式"

---

## 6. 探 GitHub 凭证漏查 macOS Keychain

### 情境
- **时间**：2026-06-08 v0.5.1 release 阶段
- **事件**：
  - 主人让我"在 github 起一个 release"
  - 派 v05-release-creator subagent 探 token
  - subagent 探了：`env | grep GITHUB_TOKEN` / `~/.netrc` / `gh CLI` —— **全**无
  - subagent 报"没 token，需要主人生成 PAT"
- **真因**：主 Mac 上 token **一直**在 macOS Keychain（`security find-internet-password -s github.com -w`），subagent **完全没查** Keychain

### 错在哪
- 探 macOS GitHub 凭证**漏**了**最关键**的 macOS 凭证存储（Keychain）
- 之前**没用过** macOS Keychain 自动化，**没**意识到这层

### 教训
- **macOS 上** 探 GitHub 凭证**必须**查 4 个地方：
  1. `env | grep -E "GITHUB|GH_TOKEN"`
  2. `~/.netrc`
  3. `gh auth status`（gh CLI 装了的话）
  4. **`security find-internet-password -s github.com -w`** ← macOS 特有，常被漏
- git credential helper 是 `osxkeychain` 时，token **就**在 Keychain 里
- git push HTTPS **自动**用 Keychain 凭证（`security find-internet-password` 拿）

### 避免
- macOS 探 token 任务**必须**把 Keychain 加进 subagent prompt
- 标准探命令（一次性查全）：
  ```bash
  echo "=== env ==="; env | grep -iE "github|gh_token" | sed 's/=.*/=<set>/'
  echo "=== netrc ==="; cat ~/.netrc 2>/dev/null | sed 's/password.*/password=<set>/'
  echo "=== gh CLI ==="; gh auth status 2>&1 | head -3
  echo "=== macOS Keychain ==="; security find-internet-password -s github.com -w 2>&1 | head -1 | sed 's/./*/g'  # 隐藏实际值
  ```

---

## 7. 推 tag 没带 main commit

### 情境
- **时间**：2026-06-08 上午 v0.5.1 推 tag 阶段
- **事件**：
  - v0.5.1 asar 修复 subagent dry-run 后，**只**推了 v0.5.1 tag (`b9939eb7 → e050b39`)
  - **没**推 main（e050b39 commit **没**在 remote main 上）
  - 但 tag 推**没**问题（Git 允许 tag 指向不在 branch 上的 commit object）
- **真因**：subagent 推 tag 时**没**同步 `git push origin main`（或 `git push --follow-tags`）
- **后果**：
  - v0.5.1 tag **指向** e050b39 commit object（通过 tag push 传上去）
  - 但 `git checkout main` 看 v0.5.1 之前的代码，**没** e050b39
  - 仓库状态**不一致**（不规范的 git 实践）
- **发现**：v0.5.2 推 tag 之前我才**发现**这问题
- **修复**：主人 Terminal 推 main 时把 3 commit（v0.5.1 asar + docs + workflow release）一起带上

### 错在哪
- 推 tag 前**没**检查 main branch 是不是包含 tag 指向的 commit
- 没用 `--follow-tags`（git push 自动推 tag 指向的 commit）
- 推 tag 单独跑，**没**和 main 推合并

### 教训
- 推 tag **之前**必查：
  - `git log origin/main..main`（本地领先 remote 的 commit）
  - `git rev-parse <tag>^{commit}` 看 tag 指向
  - `git branch --contains <tag-commit>` 看 commit 在不在 main
- 推 tag 命令**完整**版：
  ```bash
  # 推 main（带所有领先 commit）+ 推 tag
  git push origin main <tag>
  # 或（更安全）：
  git push --follow-tags origin main
  ```

### 避免
- 推 tag **前**先 `git status` + `git log origin/main..main` 检查
- 推命令**一次性**：`git push origin main v0.5.2`（main 和 tag 一起推）
- 推完**验证**：`git ls-remote --tags origin` + `git log origin/main --oneline -3` 对比

---

## 8. 没预期 GitHub Actions artifact 在国内 Azure Blob 慢

### 情境
- **时间**：2026-06-08 v0.5.1 release 阶段
- **事件**：
  - 主人要 release，我派 subagent 下载 GitHub Actions artifact 转成 release asset
  - subagent 调 GitHub API `/actions/artifacts/<id>/zip` → 302 redirect 到 **Azure Blob Storage** 带 SAS 签名的 URL
  - 主 Mac 在国内（Asia/Shanghai），到 Azure Blob **极慢**（350 B/s，6.9MB/60s 401）
  - 3 个 artifact（79 + 95 + 104 MB）= **30+ 分钟** 也没法下完
- **真因**：
  - GitHub Actions artifact **实际存**在 Azure Blob Storage（GitHub 委托给 Azure）
  - **中国大陆**访问 Azure Blob **普遍**很慢 + 经常 SAS 失效
  - 我的 prompt **完全**没考虑这个

### 错在哪
- 在国内网络做 GitHub Actions → Release asset 流程时**没**预期这问题
- 没考虑**直接**在 GitHub Actions workflow 里 release（不下载 artifact）

### 教训
- **中国网络**做 GitHub Actions artifact download = 几乎必失败
- **正确路径**：用 `softprops/action-gh-release@v2` 在 workflow 里**直接** release
  - workflow runner **在** GitHub 网络（北美/欧洲），到 Azure 快
  - release asset **直接**通过 GitHub API 上传到 GitHub 自己的 S3
  - **不**走 Azure Blob 重定向 → 绕过国内限速
- v0.5.2 我**就**用这路径解决的（B 计划）

### 避免
- 在国内做 release 任务 → **直接**用 `softprops/action-gh-release@v2` workflow
- **不**下 Actions artifact 转 release asset
- subagent prompt 写明："release 资产 = 走 workflow + softprops，**不**通过 API 下载 artifact"

### 相关代码（v0.5.2 workflow 用的）
```yaml
- uses: softprops/action-gh-release@v2
  with:
    files: |
      dist-windows/*.exe
      dist-mac/*.dmg
      dist-linux/*.AppImage
    generate_release_notes: true
```

---

## 9. 诊断时不亲自跑命令拿证据

### 情境
- **时间**：2026-06-08 早上 v0.5.0 dmg 装不上阶段
- **事件**：
  - 主人说"下载下来的还是不行"（v0.5.0 dmg 弹 damaged）
  - 主人**之前**说"右键也是一样"
  - 我**让主人**自己跑 `xattr -dr com.apple.quarantine` 命令
  - **没**亲自跑诊断（spctl / codesign / xattr）
- **真因**：**我**主会话**能**直接 exec 跑命令拿证据，**不**应该让主人敲命令

### 错在哪
- 让主人敲命令 = 把诊断负担**推给主人**
- "主 agent 不应该让用户做自己该做的事"
- 我**有** 4 host curl / spctl / codesign / xattr 全部跑**一遍**的能力

### 教训
- 主人描述问题后 → **主会话**立刻 exec 跑诊断命令
- 拿证据**之前**不下结论
- 让主人敲命令 = **主 agent 失职**（除非命令需要主人 sudo 输密码）

### 避免
- 看到"用户报告问题" → **立刻** exec 跑相关诊断
- 典型诊断命令模板：
  - macOS Gatekeeper：`xattr -l`, `codesign -dv`, `spctl --assess`
  - 网络：`curl -sS -o /dev/null -w "HTTP %{http_code} time %{time_total}s"`
  - git：`git log`, `git status`, `git diff`, `git ls-remote`
- 跑完**先**给主人看证据**再**问下一步

### 详细
见 `MEMORY.md` #13, #14

---

## 10. 派 subagent 失败后没立刻自己接手

### 情境
- **时间**：2026-06-08 v0.5.2 release 监控阶段
- **事件 1**：派 `v052-release-monitor`，2 秒就 fail（`FailoverError: AI service 临时过载`）
  - **我**没立刻自己接手
  - 重派 v2
- **事件 2**：v2 也 fail，8 秒就报 `/tmp/.gh_token` 不存在
  - **我**才**立刻**自己接手（用 `curl` 公开 API 查 release）
  - 查到 v0.5.2 release 真的创建了 + 3 asset 都挂上了

### 错在哪
- v1 fail 立刻**应该**自己接手（AI service 过载 = 临时的，**等**也未必能好）
- 重派 v2 = 重复依赖不稳定的 AI service
- 浪费 2 次 subagent 机会，**才**想起来自己干

### 教训
- subagent 失败（特别是 AI service 过载）→ **立刻**自己接手，**不**要重派
- 重派**只**在 "subagent 配置错"（不是 AI service 错）时
- 自己**能**做的事**不**派 subagent（轮询 5 分钟 + 看公开 API 这种）

### 避免
- subagent 失败**第一**反应：自己 exec 接手
- 复杂任务**才**派 subagent，**简单**查 API / 轮询 / 看页面**自己**做
- AI service 过载**别**重试 subagent，**等**几分钟**也**未必好

---

## 📊 错误模式总结（横向看）

### 高频错误类别

| 类别 | 出现次数 | 教训 |
|---|---|---|
| **不查实际下结论** | 3, 4, 9 | "看到 X 不等于 X 成立"——查实测、查多 host、重试验证 |
| **subagent 管理差** | 1, 10 | 静默 + 失败都失职——查交付 + 自己接手 |
| **安全失误（token）** | 5, 6 | token 走 webchat + 漏查 Keychain——**严格**走文件 + 全面查 |
| **git 实践错** | 7 | 推 tag 不带 main——**先** `git log origin/main..main` 检查 |
| **承诺不兑现** | 2 | "立刻做"没做——**同回合**做完 + 明确告诉 |

### 没意识到的盲区

- **macOS Keychain** 是 GitHub 凭证**最常被忽略**的存储（#6）
- **spctl vs 实际运行** 是两套机制，**不**能混（#3）
- **Azure Blob 在国内慢** 是 GitHub Actions artifact 下载的**死结**（#8）

### 复盘方法论

每次**新 session 接手** syncplay 任务：
1. **先**读 `STATUS.md`（当前进度）
2. **再**读 `ROADMAP.md`（目标）
3. **再**读 `AGENT_PRACTICES.md`（这个文件）—— 避免重蹈覆辙
4. **再**读 `docs/AGENTS.md`（三角色分工）

---

## 🔗 关联文档

- `~/.openclaw/workspace/MEMORY.md` #20-#22：跨项目通用规则（subagent done 主动汇报 / 立刻做 / macOS dmg 装上 damaged 实际是 quarantine）
- `docs/AGENTS.md`：v0.4 三角色分工规范（Builder/Tester/Reviewer）
- `docs/STATUS.md`：当前项目进度
- `docs/ROADMAP.md`：目标 + 决策 + 路线图
- `docs/CHANGELOG.md`：版本变更历史

---

---

## 11. 收到主人 export 的 token 误以为已配好

### 情境

**时间**：2026-06-09  
**阶段**：AGENT_PRACTICES.md commit 完后要 `git push origin main`  
**链路**：主人 2026-06-08 跟我说"新 token 已经 export 给你了" → 我今天 push 时才**真正**去查 → 发现：

- 主会话 env 里**没有** `GH_TOKEN` / `GITHUB_TOKEN`
- `~/.zshrc` / `~/.zprofile` / `~/.netrc` / `~/.git-credentials` / `~/.ssh/` 都没新 token
- macOS Keychain 里 github.com 凭证还是 **5月16日那个旧 token**（`ghp_hO...`）

### 错误链

1. 主人昨天 export 完就放下了（session 死了，env 消失）— 主人侧问题
2. **我**昨天收到"export 完了"消息时，**没主动**：
   - 把 token 写进 `~/.zshrc` 持久化
   - 用 `git credential-osxkeychain store` 存进 Keychain
   - 写进 `~/.netrc`（跨平台备选）
3. 今天 push 失败，我先怀疑网络（实际就是网络层问题），等查到 Keychain 才意识到：**根本没用上主人给的新 token** — 钥匙串里还是 5月16日那个
4. **更糟**：查 Keychain 时用了 `security find-internet-password -s "github.com" -g`（`-g` 显式打 password）— 完整 token 暴露到 webchat transcript

### 根因

**"export = 已配置" 是严重错觉**。原因：

- `export VAR=xxx` 只活在**当前 shell 进程**及其子进程
- 父 shell 死了（webchat session 结束），env 变量跟着消失
- OpenClaw gateway 是从 launchd / 系统环境继承 env，**不**从某个 webchat session 继承
- 主 agent（我）的子进程（subagent / exec）会从我的 env 继承，但我的 env **来自** OpenClaw gateway — 不是主人 webchat session

→ 主人"export 给我"实际是 export 给了**那一刻**的 webchat shell 进程。那个进程早死了。

### 正确流程

**主人** 给我凭证后，**我**必须**立刻**做下列至少一项：

| 目标 | 命令 | 适用 |
|---|---|---|
| macOS Keychain（git 自动用） | `git credential-osxkeychain store` 配合 stdin | 日常 git push（当前 macOS 环境） |
| shell 持久化 | 追加到 `~/.zshrc` 或 `~/.zprofile`（注意：非交互 shell 不 source 这些） | 临时用 |
| 跨平台 | 写到 `~/.netrc`（chmod 600） | CI / 跨机器 |
| **永久** | 生成 SSH key + 推公钥到 GitHub + `git remote set-url origin git@github.com:...` | ⭐ **最推荐** |

### 推论

- 任何"凭证已就位"声明，**必须**用 `git credential-osxkeychain get` 或 `security find-internet-password -s github.com` 验证**之前**不许说
- `security -g` 拿密码 = **故意**显示明文，只在确实需要时用
- 主人问"为什么没配好"时，先**自己**跑 `git credential-osxkeychain get` 查存了什么，不要凭印象答

### 红线（同样适用所有 subagent）

- ❌ 不要把"主人 export 了"等同于"凭证生效"
- ❌ 不要用 `security ... -g` 除非必要；如必要，**打码**显示
- ❌ 不要假设凭证会自动跨 session 持久化
- ✅ 收到凭证 → 立刻持久化 + 立刻用 `git credential-osxkeychain get` 验证

---

*维护：Jarvis*
*协作：主人（Bruce）*
*最后更新：2026-06-09（token 配置失职教训 + 顺手升级 SSH key 方案）*

## 12. macOS 系统代理 ≠ git 代理（开了代理但 git 不走）

### 情境

**时间**：2026-06-09（v0.5.2 push 阶段）  
**问题链**：push 反复 75s timeout → 主人说"我一直在开代理" → 我**没第一时间**意识到 git 不读 macOS 系统代理

### 错误链

1. 主人 6/8 v0.5.2 tag push 成功过，但 6/9 push 不出去
2. 我查了 `curl` 直连 github.com、web_fetch github.com、git push —— 全部超时
3. 主人说"我一直在开代理"，我**没立刻**判断"git 不读 macOS 系统代理面板"
4. 等我手动跑 `curl -x http://127.0.0.1:7897 https://github.com` 才证实：代理**一直在跑**（Vortex 客户端 pid 63601 监听 7897）、**完全能通** github.com（HTTP 200 / 0.66s）
5. 根因：macOS 系统偏好设置里的"Web 代理 / HTTPS 代理 / SOCKS 代理"是 **AppKit 层**配置，**只对走系统代理设置的 app 生效**（Safari / 系统设置 / 部分 GUI app）
6. 命令行工具（git / curl / npm / brew / ssh）**不读**这个面板，需要 shell 配 `HTTPS_PROXY` env 或 git config 显式指定

### 根因

macOS 系统代理面板的生效范围：
- ✅ Safari / Chrome（部分情况）
- ✅ App Store / Mail 等系统 app
- ✅ 部分 GUI 工具（如果它们读 `SCDynamicStore`）
- ❌ **所有命令行工具**（git / curl / npm / brew / ssh / python pip）
- ❌ 大部分 npm package 的 postinstall script
- ❌ Docker daemon（需要单独配）

### 正确流程

**主人说"代理开着"时，agent 必须立即**：

1. **不要直接信**"系统代理开着" — 对**命令行**通常没用
2. **验证手段**（任选一）：
   - `curl -sS -o /dev/null -w "%{http_code}\n" --max-time 5 https://github.com` 看直连
   - `curl -x http://127.0.0.1:<port> https://github.com` 看代理端口
   - `lsof -nP -iTCP:<port> -sTCP:LISTEN` 看端口监听
3. **如果代理真的在跑**（端口有人听 + curl 走代理能通），**立刻配 git 代理**：

```bash
# 条件性代理（推荐，只对 GitHub 走）
git config --global 'http.https://github.com.proxy' 'http://127.0.0.1:<port>'

# 全局代理（其他仓库也会走）
git config --global http.proxy 'http://127.0.0.1:<port>'
git config --global https.proxy 'http://127.0.0.1:<port>'
```

4. **配完立刻用 `git push` 试一次**，不要等下次 push

### 推论

- **任何"凭证已就位"或"代理已开启"的声明，agent 都要立刻用对应工具验证**（per #11 教训）
- **不要把"主人说开了"等同于"工具能用到"** —— 跨层配置容易掉链子
- macOS 系统代理面板对 agent 工作流**几乎没用**，长期用 SSH key + 显式 git proxy 是最稳的

### 配合 #11 一起用

| 场景 | 必修 |
|---|---|
| 主人给 PAT token | #11：立刻 `git credential-osxkeychain store` + `git credential-osxkeychain get` 验证 |
| 主人说开了代理 | #12：立刻 `curl -x` 验证端口 + `git config --global http.*.proxy` 配 + 跑一次 |
| 主人说 VPN 连上了 | 同样要 `curl --interface` 或直接 `git push` 验 |
