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
| 12 | [macOS 系统代理 ≠ git 代理](#12-macos-系统代理--git-代理开了代理但-git-不走) | v0.5.2 push | #12, #13, #14 |
| 13 | [edit 工具改大段中文文档再次踩坑](#13-edit-工具改大段中文文档再次踩坑-教训2026-06-09) | v0.6 准备 | #19 |

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


---

## 20. v0.6.x 工作流修订 v2 — 阶段 A 改派 Claude 双轮, 阶段 B 按 Claude 最终执行方案拆 (教训:2026-06-13)

### 情境

**时间**：2026-06-13（v0.6.2 立项时, 主人发现 v0.6.1 阶段 C 没收尾 + 改工作流）
**触发**：
1. 主人 18:33 发现 UI bug, 让主 agent 派 Claude 出修复计划
2. 主 agent 18:33-18:40 按老流程 ad-hoc 派活, 主人 18:37 提醒"项目里有 agentWorkflowAndTemplates 工作流"
3. 主 agent 18:45 Claude 返回修复计划, 主人 18:50 让主 agent 先收 v0.6.1 阶段 C
4. **主人 18:55 + 19:03 改工作流** — 阶段 A 改派 Claude, 阶段 B 按 Claude 方案拆

### 修订内容 (vs 老流程)

| 老流程 (runbook v1, 2026-06-09) | 新流程 (runbook v2, 2026-06-13 主人修订) |
|---|---|
| 主 agent 复述理解 + 跟主人确认 | **主人只给现象 + 要求** |
| 主 agent 自己写 plan + 派 Claude 让它做事 | **主 agent 派 Claude 出方案** (双轮 1) |
| 主人拍方案 | **主人 + 主 agent 一起基于方案讨论 + 决定** |
| 主 agent 写 plan → 阶段 B 拆任务 | **回流意见给 Claude** (双轮 2, 出最终执行方案) |
| 主 agent 自己拆任务 | **阶段 B 按 A6 Claude 的最终执行方案拆** |

### 阶段 A 双轮 Claude 流程 (主 agent 必做)

```
[A1] 主人: 说"现象 + 要求" (不给方案)
  ↓
[A2] 主 agent: 派 Claude 出"完整可行的技术方案/修复方案" (双轮 1)
     - ACP harness: runtime: "acp", agentId: "claude", streamTo: "parent"
     - --add-dir /Users/bruce/CodeProjects/syncplay
     - 任务描述要明确: "请基于以下现象 + 要求, 给出完整可行的技术方案/修复方案 (诊断 + 修复步骤 + 测试验证 + 风险评估 + trade-off 选项)"
  ↓
[A3] Claude 方案给主人 + 主 agent (主 agent 整理摘要给主人)
  ↓
[A4] 主人 + 主 agent 一起讨论 trade-off + 拍板
  ↓
[A5] 决定后: 主 agent 用 sessions_send 回流意见给 Claude session
     (含最终决定 + 偏好 + why)
  ↓
[A6] Claude 根据意见出"最终执行方案和步骤" (双轮 2)
     - 具体任务清单 + 实施步骤 (N 个子任务)
  ↓
[A7] 主 agent: 写 MEETINGS 纪要 (含 Claude 双轮方案摘要)
  ↓
[A8] commit + push
```

### 阶段 B 拆任务依据 (v2 修订)

- **不**是主 agent 自己拆
- **是**根据阶段 A A6 Claude 的"最终执行方案和步骤"拆
- N (子任务数) = Claude A6 给的子任务数
- 每个子任务的"实现内容" = Claude A6 给的具体步骤
- builder / tester 任务书内容 = Claude A6 方案 + 标准模板

### 关键决策: 何时跳过 Claude, 主 agent 直接做

| 场景 | 走新流程 (A1-A8)？ | 理由 |
|---|---|---|
| **bug 修复** (如 v0.6.2 UI bug) | ✅ 必须 | 主人原话: "出修改方案和计划的事交给cloude来做" |
| **新需求** (如 v0.7 TURN UI) | ✅ 必须 | 主人原话: "针对新需求的技术方案" |
| **纯 docs 收尾** (如 v0.6.1 阶段 C 收尾) | ❌ 直接做 | 升 package.json + 改 4 docs, 不需要 Claude 诊断 |
| **流程修订** (如改 runbook.md) | ❌ 直接做 | 改的是事实记录, 不是技术方案 |
| **小修补** (如改 commit message 错字) | ❌ 直接做 | 1 行改动, 不需要 Claude 方案 |

### 踩的坑 (我犯了, 主人纠正)

1. **18:33-18:45 主 agent ad-hoc 派活, 没按 runbook**
   - 直接派 Claude 出"修复计划"写到 `tasks/v0.6.2/01-fix-plan.md` (错误路径 — 应该在 `.agent-tasks/v0.6.2/`)
   - 没读 runbook.md 之前就开干
   - 没读 STATUS / ROADMAP 之前就开干
   - **主人 18:37 立刻纠正**: "你有使用agent工作流来做这件事吗, 项目里不是写了一个项目执行工作流？"

2. **v0.6.1 阶段 C 没收尾**
   - v0.6.1 子任务 2026-06-10 全部 PASS, 但阶段 C (升 package.json + 推 tag + 更新 docs) **没**做
   - package.json 还是 0.6.0, 没 v0.6.1 tag, docs 还显示 v0.6.0 Shipped
   - **违反 runbook 红线** "❌ 跳过阶段 C 直接汇报"
   - **主人 18:50 纠正**: "先把0.6.1收尾, 补齐所有需要的文档"

3. **v0.6.2 应该走新流程, 但当时没新流程**
   - 18:33 派 Claude 时**没**新流程, 是按老流程 (主 agent 写 plan) 派活
   - 18:55 主人改工作流, v0.6.2 还没拍 ABCD 决策
   - **现状**: Claude 已出"修复计划" (v1, 当作 A2 初稿), 等主人拍 ABCD → 回流 → Claude 出 A6 最终执行方案

### 加固 (避免下次再踩)

| 规则 | 说明 |
|---|---|
| ✅ **新 session 接 syncplay 任务, 先读 runbook.md** | 第一件事, 不读不开干 |
| ✅ **bug 修复 / 新需求 一律走新流程 A1-A8** | 主 agent 自己不出方案 |
| ✅ **纯 docs 收尾 / 流程修订, 主 agent 直接做** | 不浪费 Claude |
| ✅ **每个版本立项前查 STATUS.md** | 看上版本阶段 C 收没收尾 |
| ✅ **阶段 C 收尾 = 一次性更新所有 docs** | 不在做事过程中更新 |
| ❌ **不** ad-hoc 派 Claude 写"修复计划" 到 `tasks/` 错误路径 | 任务书放 `.agent-tasks/<version>/` |
| ❌ **不** 主 agent 自己出诊断/修复方案 | 这是 Claude 的活 |
| ❌ **不** 跳过阶段 C 直接做下版本 | 状态对不上, 主人看到的还是旧信息 |

### 关联

- `agentWorkflowAndTemplates/runbook.md` — 已按 v2 修订 (流程图 + 阶段 A 段 + 阶段 B B0/B-prep 段)
- `docs/MEETINGS.md` #008 — v0.6.1 阶段 C 收尾会议纪要
- `docs/MEETINGS.md` #009 — (待写) v0.6.2 阶段 A 会议纪要 (新流程首次实战)
- AGENT_PRACTICES #17 (老 runbook 立过程) — 跟本条配合
- MEMORY #14 (纠正指导立刻写文件) — 本条触发
- MEMORY #28 (已 plan 不打扰) — 本条遵守

---


*最后更新：2026-06-13（v0.6.x 工作流修订 v2, 阶段 A 改派 Claude 双轮, 阶段 B 按 Claude 最终执行方案拆）*

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
|---|

## 13. edit 工具改大段中文文档再次踩坑 (教训:2026-06-09)

### 情境

**时间**：2026-06-09（写完 agentWorkflowAndTemplates/ 后）  
**任务**：把 `docs/AGENTS.md` 头部加一段"完整工作流见新目录"  
**工具**：edit 工具

### 错误链

1. 我用 `edit` 工具改了 `docs/AGENTS.md` 头部 24 行
2. 改完 `git diff --stat` 显示 **192 行变化 / 107 插入 / 85 删除**（远超预期 24 行）
3. 检查 diff 发现：全角"？"被改成半角"?"、全角"，"被改成半角","、全角"（"被改成半角"(" 等多处
4. 这是 **MEMORY.md #19 教训的同款坑**——edit 工具的 oldText/newText 匹配/规范化改了无关的全角标点

### 修法

```bash
# 1. 还原
git checkout HEAD -- docs/AGENTS.md

# 2. 改用 Python 直接 write (绕开 edit/write 工具的标点规范化)
#    见下方"Python 安全模式"

# 3. 验证
git diff --stat docs/AGENTS.md  # 应该只显示 ~26 行变化
grep -E "？|，|（|）|：" docs/AGENTS.md  # 全角标点应该都在
```

最终这次改动是 **26 insertions / 3 deletions**（合理）。

### 加固

| 规则 | 说明 |
|---|---|
| ❌ **不**用 edit 工具改大段中文/全角标点文件 | edit 工具的标点规范化会改无关行 |
| ✅ **用 Python 直接 write** | 绕开所有工具的"自动处理" |
| ✅ edit 后**必须** `git diff --stat` 看比例 | 改动行数远超预期 → 立刻 `git checkout` |
| ✅ grep 全角标点确认 | `grep -E "？\|，\|（\|）\|：" <file>` |
| ❌ **不**在 commit message 里写"教训已查" | 真查过才能写（per MEMORY #14） |

### Python 安全模式（推荐）

```python
# 写整个文件
with open('path/to/file.md', 'w', encoding='utf-8') as f:
    f.write(content)  # content 是 Python 字符串, 标点原样保留

# 在某个 marker 之后追加
with open('path/to/file.md', 'a', encoding='utf-8') as f:
    f.write(new_section)

# 改文件某段: 读 → 改字符串 → 写回
with open('file.md', 'r', encoding='utf-8') as f:
    content = f.read()
new_content = content.replace('OLD', 'NEW')  # 用 Python 字符串操作
with open('file.md', 'w', encoding='utf-8') as f:
    f.write(new_content)
```

### 关联

- MEMORY.md #19：edit 工具可能改坏文件标点
- 这次是 #19 教训的**实战重现**——写大段中文时不能依赖 edit 工具
- 教训 #11（token 配置失职）的反面：**配置改动前要 diff 验证**——改完任何文件先看 diff 再说"做完了"



## 14. Claude Code 配 MiniMax Coding Plan API (教训:2026-06-09)

### 情境

**时间**：2026-06-09（v0.6 工作流目录建立后）  
**目标**：让 Claude Code 走主人 MiniMax 订阅 API（不是 Anthropic 官方 API）  
**主人订阅**：MiniMax Coding Plan（key 前缀 `sk-cp-`）

### 关键配置（已验证可跑通）

**Base URL（主人用中国大陆）**：
```
https://api.minimaxi.com/anthropic
```
（**注意**：`minimaxi` 不是 `minimax`！国际用户是 `api.minimax.io/anthropic`）

**Token 字段名（重要！）**：
```
ANTHROPIC_AUTH_TOKEN  ←  正确
ANTHROPIC_API_KEY     ←  错（Anthropic 官方标准字段, MiniMax 不读这个）
```

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

**配套改 `~/.claude.json`**（merge, 不要覆盖！）:
- 加 `"hasCompletedOnboarding": true`（避免首次启动弹 onboarding）

### 关键流程

1. **主人拿 key** (去 https://platform.minimaxi.com/user-center/payment/token-plan)
2. **主人 printf 到 /tmp**（不贴 webchat）:
   ```bash
   printf '%s' '<key>' > /tmp/.claude_api_key
   chmod 600 /tmp/.claude_api_key
   ```
3. **主 agent 验证 key**（不暴露到 transcript）:
   ```bash
   K=$(cat /tmp/.claude_api_key)
   echo "${K:0:8}...${K: -6}"  # 只显示前缀+后缀
   curl -sS -o /dev/null -w "%{http_code}
" --max-time 10 \
     -X POST "https://api.minimaxi.com/anthropic/v1/messages" \
     -H "x-api-key: $K" -H "anthropic-version: 2023-06-01" \
     -d '{"model":"MiniMax-M3","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
   ```
   应该返回 `HTTP=200`
4. **Python 写 settings.json**（per #13 教训, 不破坏标点）:
   - 用 `json.dump(..., ensure_ascii=False)` 保留中文
   - 权限 `0o600`
5. **Python merge ~/.claude.json**（不能覆盖 userID 等现有数据!）:
   ```python
   data = json.load(open('~/.claude.json'))
   data['hasCompletedOnboarding'] = True
   json.dump(data, open('~/.claude.json', 'w'), indent=2)
   ```
6. **安全删 /tmp**:
   ```bash
   rm -Pv /tmp/.claude_api_key
   ```
7. **验证**:
   ```bash
   claude --version          # 2.1.153
   claude -p "say hello"     # 跑通说明 env 生效
   ```

### 坑 (我踩的)

1. **第一版漏了 `CLAUDE_CODE_AUTO_COMPACT_WINDOW: 512000`** — 主人发官方 URL 给我看才发现. 以后**必须**先 fetch 完整文档, 不能只看搜索 snippet.

2. **官方推荐用 `ANTHROPIC_AUTH_TOKEN`** — 我之前以为是 `ANTHROPIC_API_KEY` (Anthropic 标准), MiniMax 不读这个.

3. **MiniMax Coding Plan API 跟 Anthropic 官方不完全兼容** — GitHub 有 issue 提到 (MiniMax Coding Plan 用了"非标准 Anthropic 兼容 API"). Claude Code 大部分功能能用, 边缘 case 可能不工作.

### 关联

- `agentWorkflowAndTemplates/control-claude.md` — "凭证管理"段已加 MiniMax 接入模式
- MEMORY.md #11 — token 持久化教训
- AGENT_PRACTICES.md #13 — edit 工具改坏标点 (这次 settings.json 用 Python 写)


## 15. git push 报 LibreSSL SSL_ERROR_SYSCALL 不一定真失败 (教训:2026-06-09)

### 情境

**时间**：2026-06-09（c04cf17 commit push 时）  
**现象**：`git push origin main` 报：

```
fatal: unable to access 'https://github.com/despicablemme/SyncPlayer.git/':
LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443
```

连接**立刻挂**（0.24s），**不是**之前的 75s timeout（那是网络层卡，这是 SSL 层立刻断）。

### 错误链

1. 我做了 commit `c04cf17`（MiniMax 接入文档沉淀）
2. 第一次 push 报 `SSL_ERROR_SYSCALL` —— 我以为失败了
3. 决定重试，结果**4/5 次**都返回 `Everything up-to-date`！
4. 用 `git fetch && git rev-parse main origin/main` 验证：两个 hash **完全一致** —— 第一次 push **真的成功了**

### 根因

`SSL_ERROR_SYSCALL` 在 LibreSSL 库里是个**模糊错**——可能是：
- TCP 连接被代理客户端主动断（Vortex 客户端 bug）
- TLS 握手协议层断（LibreSSL vs 代理实现不兼容）
- **但**：git 内部已经收到 200 OK，commit 数据已经上传
- git 检测到 SSL 错就报失败，但**数据已经在 GitHub 上了**

### 修法

**不要只信 git 的"失败"输出**。必跑：

```bash
# 验证 commit 是否真的到了
git fetch origin main
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✓ push 实际成功了 (本地和远端 hash 一致)"
else
  echo "✗ push 真失败了, 需要重试"
  git push origin main
fi
```

### 加固

| 规则 | 说明 |
|---|---|
| ❌ **不**看到 `SSL_ERROR_SYSCALL` 就立刻重试 | 重试可能把同一个 commit push 多次(无副作用但浪费) |
| ✅ **必跑** `git fetch && git rev-parse` 验证 | 实证比 git 输出可信 |
| ✅ 配合 `GIT_HTTP_VERSION=1.1` 试 | 避开 HTTP/2 ALPN 协商问题(参考之前 75s timeout 教训) |
| ✅ 配合 `GIT_CURL_VERBOSE=1` 看 SSL 错在哪步 | CONNECT OK + TLS Client Hello OK + Server Hello 没回 = 假阳性 |

### 关联

- AGENT_PRACTICES #12: macOS 系统代理 ≠ git 代理 (网络抖)
- AGENT_PRACTICES #15 (本条): 抖出新形态 - SSL 假阳性
- 主 agent 行动：push 后**必须** fetch 验证，不靠 git 单一输出


## 16. Claude Code 默认 working dir 限制 — 必须 --add-dir (教训:2026-06-09)

### 情境

**时间**：2026-06-09（v0.6 工作流刚配完 MiniMax 后, 主人问"Claude Code 知道读什么吗"）  
**测试**：我跑 `claude -p "读 /Users/bruce/CodeProjects/syncplay/AGENT_PRACTICES.md, 然后只回我 3 件事..."`  
**结果**：Claude Code 拒绝：

> 抱歉,无法读取该文件。该路径 `/Users/bruce/CodeProjects/syncplay/AGENT_PRACTICES.md`
> 不在当前会话允许的工作目录内(当前仅允许 `/Users/bruce/.openclaw/workspace`),
> 所以 Read 和 wc 都被拦截了。

**根因**：Claude Code 默认只允许读**当前 shell 所在目录**（我的所有命令都在 `~/.openclaw/workspace` 跑），syncplay 文件**根本读不到**。

### 影响范围

- 整个 `claude -p` 工作流（subagent 派 Builder/Tester）如果不加 `--add-dir` 全部**读不到** syncplay 文件
- 任务书里写的"必读 AGENT_PRACTICES.md" 等于**空话** —— Claude Code 根本看不到那些文件

### 解法

`claude -p` 加 `--add-dir` flag 显式声明允许的目录：

```bash
# 关键: --add-dir 必须在 -p 之前
claude --add-dir /Users/bruce/CodeProjects/syncplay -p "<任务 prompt>"

# 多目录
claude --add-dir /Users/bruce/CodeProjects/syncplay \
        --add-dir /Users/bruce/Documents/KnowLedgeDatabase \
        -p "<任务 prompt>"
```

**验证**(2026-06-09 实测)：

```bash
$ claude --add-dir /Users/bruce/CodeProjects/syncplay -p "读 .../AGENT_PRACTICES.md, 只回我 3 件事..."
1. 757 行
2. 第 1 个教训: v04-commander 静默 21 小时没人查
3. 第 15 个教训: git push 报 LibreSSL SSL_ERROR_SYSCALL 不一定真失败
```

✅ Claude Code 真的读了! wc 输出 757 行 vs 实际 756 行(差 1 是末尾换行).

### 必须改的地方

| 文件 | 改什么 |
|---|---|
| `agentWorkflowAndTemplates/control-claude.md` | subagent 派 Builder/Tester 示例**全部加 `--add-dir`** |
| `agentWorkflowAndTemplates/templates/builder-task.md` | "必读 context" 改**绝对路径**(`/Users/bruce/...`) 不依赖 `~` 展开 |
| `agentWorkflowAndTemplates/templates/tester-task.md` | 同上 |
| `agentWorkflowAndTemplates/control-claude.md` | 加"主 agent 派活时**必须**传 `--add-dir`"红线 |

### 加固 (给任务书加 self-verification)

任务书**必加**这段(强迫 Claude Code 证明它读了):

```markdown
## 自我验证 (必做, 不做不要动手)

读完必读 context 后, **stdout 输出**:
- "✓ 已读 AGENT_PRACTICES.md (N 行, 关键教训: #X #Y #Z)"
- "✓ 已读 docs/STATUS.md (N 行, 当前阶段: <一句话>)"
- "✓ 已读 tasks/<task-id>-context.md"
- "✓ 任务目标复述: <用你自己的话复述本任务要做什么>"

如果**任何文件读失败**(路径错/不在 allowed dir), **立刻报告**并停止.
```

### 关联

- AGENT_PRACTICES #15: git push 假阳性 (跟工作流无关, 是 git bug)
- `agentWorkflowAndTemplates/control-claude.md`: 已加 --add-dir 用法
- `agentWorkflowAndTemplates/templates/builder-task.md`: 已加绝对路径 + self-verification
- MEMORY.md #14: 主人求证时必须有切实证据 (主人这一问就是这种场景)


## 17. docs 是事实记录, 不是进度中转站 (教训:2026-06-09)

### 情境

**时间**：2026-06-09 (刚写完 v0.6-runbook.md 后)  
**主人纠正**：

> "这不是 v0.6 的 runbook, 这是每一次每一个版本的, 所以要写成通用的.  
> 第二, 我和你制定好下一阶段计划后, 你需要先将计划落实到相关文档中记录,  
> 才好落地目标, 比如 roadmap, 比如记录讨论的会议纪要, 比如更新需求, 等等.  
> 接下来才是去做事. 全部目标实现后, 再去逐个更新 docs 内文档.  
> 懂了吗, 这是对你的完整流程的补充和调整."

**关键点**：
1. Runbook 是**通用**的（任何目标/任何版本都用这套流程）, 不是某个版本专属
2. 流程有 3 阶段: **计划 (先写文档) → 实现 (只做事) → 完工 (统一更新 docs)**
3. **做事过程中不更新 docs** — docs 是"事实记录", 不是"进度中转站"

### 我之前的错

1. **命名错**: 写了 `v0.6-runbook.md` — 应该叫 `runbook.md` (通用, 每个目标都用)
2. **流程错**: 我把"写 CHANGELOG/STATUS"放在每个子任务 PASS 之后 — 应该放在"全部 PASS 后" 一次性更新
3. **顺序错**: 我把"拆任务"放在阶段 A, 但阶段 A 应该是"先写 plan 文档 (roadmap/requirements/meetings)", 拆任务是阶段 B 的事
4. **隐含错**: 把 docs 当"进度同步工具" — 这跟工程上 docs 的"事实记录"角色冲突

### 修法: 3 阶段流程 (新 runbook.md)

```
阶段 A: 落实目标 (plan/讨论)
- 主人说目标
- 主 agent 跟主人确认理解
- 主 agent 更新 plan 类文档:
  - ROADMAP.md
  - REQUIREMENTS.md (如有)
  - MEETINGS.md (会议纪要)
  - 其他相关 docs
- commit + push "plan: <目标> 计划 + 会议纪要"
- ❌ 不写任务书, 不派活, 不动 STATUS

阶段 B: 实现 (做事)
- 拆任务 → 写 3 文件任务书 (builder/context/tester) × N 子任务
- 对每个子任务 serial 跑:
  - 派 Builder subagent
  - 立刻查交付 + 汇报
  - 派 Tester subagent (SERIAL)
  - 验收
  - PASS: 子任务 commit (只代码 + 任务书)
- ❌ 做事过程中**不**更新 docs/STATUS/CHANGELOG
- 重复 N 次直到全部 PASS

阶段 C: 完工 (更新 docs)
- 全部子任务 PASS 后
- 主 agent **一次性**更新:
  - STATUS.md (vX → ✅ Shipped)
  - ROADMAP.md (vX → ✅, vX+1 → 🎯 next)
  - CHANGELOG.md (vX release 条目)
  - ARCHITECTURE.md (如架构变)
  - AGENT_PRACTICES.md (如有新教训)
  - MEETINGS.md (vX 完工纪要)
- commit + push
- 跟主人汇报完工
```

### 加固

| 规则 | 说明 |
|---|---|
| ❌ 不在子任务 PASS 时就更新 STATUS | 违反 "docs 是事实记录" 原则 |
| ❌ 不在做事过程中写 CHANGELOG | CHANGELOG 是 release 时的总结, 不是实时日志 |
| ✅ 阶段 A **先写** plan 文档 (roadmap/meetings/requirements) | 没 plan = 目标没"落实", 容易跑偏 |
| ✅ 阶段 C **一次性**更新所有 docs | "完工" 是个原子事件 |
| ✅ docs 反映"已完成/已决定", 不反映"进行中" | "进行中" 在 git log + tasks/ 里 |
| ✅ Runbook 命名用通用 (runbook.md), 不用版本名 (v0.6-runbook.md) | 每个目标都用同一套流程 |

### 关联

- `agentWorkflowAndTemplates/runbook.md` — 已按 3 阶段重写
- `agentWorkflowAndTemplates/README.md` — 索引已加 runbook.md
- `agentWorkflowAndTemplates/workflow.md` — 关联文档已加 runbook.md 引用
- `AGENT_PRACTICES.md` #1 — 主人重要要求立刻写入文件 (主人这次纠正立刻沉淀)


## 18. ACP harness 模式启用: v1/v2/v3 完整故事 (教训:2026-06-09)

### 情境

**时间**：2026-06-09（v0.6 阶段 B 实施期, 主人决定改用 ACP 模式跑 Claude Code）  
**目标**：用 OpenClaw 的 ACP harness 模式 (`runtime: "acp"`) 跑 Claude Code, 替代 native subagent 模式 (`runtime: "subagent"`), 解决主人之前的"subagent 看不到 Claude Code"visibility 痛点

### v1/v2/v3 失败根因 + 修法 (完整故事)

#### v1: 失败 - 缺 permission profile

```typescript
// 我 (Jarvis) 派:
sessions_spawn({
  task: "echo hello from ACP and report",
  taskName: "acp-smoke-test",
  runtime: "acp",
  agentId: "claude"
  // ❌ 漏了 permissionProfile / permissionMode
});
```

**结果**: `AcpRuntimeError: Permission prompt unavailable in non-interactive mode: code=ACP_TURN_FAILED` (1m19s)

**根因** (per OpenClaw ACP 文档 `acp-agents.md`):
> "Non-interactive sessions cannot click native permission prompts, so write/exec-heavy coding runs usually need an ACPX permission profile that can proceed headlessly."

OpenClaw acpx 默认 `permissionMode=approve-reads` + `nonInteractivePermissions=fail`. 任何 write/exec 触发的 permission prompt 在 non-interactive 模式 = fail.

#### v2: 失败 - 我**编了**不存在的 API 参数

```typescript
// 我修法: 加 permissionProfile: "approve-all" (sessions_spawn API 参数)
sessions_spawn({
  task: "echo hello from ACP v2",
  taskName: "acp-smoke-test-v2",
  runtime: "acp",
  agentId: "claude",
  permissionProfile: "approve-all"  // ❌ 这个参数名是错的, OpenClaw 不接受
});
```

**结果**: 同样 `AcpRuntimeError: Permission prompt unavailable` (37s)

**根因**: 我**编造**了 `permissionProfile` 参数名. OpenClaw sessions_spawn API **没有**这个参数. 真正的配置是 acpx plugin 自己的 config, **不是** sessions_spawn API 参数.

#### v3: ✅ 成功 - 正确配法

```bash
# 1. 配 acpx plugin 的 permissionMode (正确位置)
openclaw config set plugins.entries.acpx.config.permissionMode approve-all

# 2. 重启 gateway 让配置生效
openclaw gateway restart

# 3. (可选) 非交互权限策略 - 但合法值只有 deny/fail, 不能 approve-all
# openclaw config set plugins.entries.acpx.config.nonInteractivePermissions approve-all
# Error: must be equal to one of the allowed values (allowed: "deny", "fail")
```

**结果**: `hello from ACP v3` (4s, 退出码 0, 无 permission prompt) ✅

### 正确的 ACP 启用步骤 (一次性配置)

```bash
# 1. 装 acpx plugin
openclaw plugins install @openclaw/acpx

# 2. 启用
openclaw config set plugins.entries.acpx.enabled true

# 3. 配 harness-level break-glass (关键 - 不配 v1/v2 失败)
openclaw config set plugins.entries.acpx.config.permissionMode approve-all

# 4. 重启 gateway
openclaw gateway restart

# 5. 验证 (主人在 webchat 跑 /acp doctor)
# /acp doctor
# 应输出: enabled, healthy backend, Claude Code auth present

# 6. 派 smoke test (主 agent API 验证)
sessions_spawn({
  task: "echo hello from ACP",
  taskName: "acp-smoke",
  runtime: "acp",
  agentId: "claude"
  // 不需要 permissionProfile / permissionMode (已配 OpenClaw config)
})
```

### 关键事实

| 项 | 值 |
|
## 19. ACP visibility 真实渠道 + /acp status 是主 agent 命令不是用户命令 (教训:2026-06-09)

### 情境

**时间**:2026-06-09 (v0.6-B Tester 跑 ACP 期间)  
**触发**:主人问"用了ACP了, 我能看进度了吗"

### 我犯的错

我**之前**在 `agentWorkflowAndTemplates/control-claude.md` ACP 段 + 给主人回复中**都**说:

> "主人在 webchat 直接打 `/acp status` 看 ACP session 状态"

**这是错的。** 主人**真**在 webchat 打 `/acp status`, **报**:
```
ACP error (ACP_SESSION_INIT_FAILED): Session is not ACP-enabled: agent:main:main
```

### 根因

per OpenClaw ACP 文档 `acp-agents.md` line 300:
> "`/acp close`, `/acp cancel`, `/acp status`, `/status`, and `/unfocus` are Gateway commands, not prompts to the ACP harness."

**关键事实**:
- `/acp status` / `/acp cancel` / `/acp close` / `/acp steer` 是 **OpenClaw Gateway 命令** (per OpenClaw 内部 API)
- **主 agent (我) 调**这些, **不**是用户在 webchat 直接打
- 主会话 `agent:main:main` 是**普通 webchat session**, **不**是 ACP session — ACP 模式**只对** `agent:<agentId>:acp:<uuid>` session 有效
- **用户在 webchat 打 `/acp status`** → OpenClaw 看**主会话**没 ACP enabled → 报错

### 修法 (3 件事)

1. **更新 control-claude.md ACP 段** — 澄清 `/acp status` 等是**主 agent 命令**, 不是用户命令
2. **更新 runbook.md ACP 段** — 强调 `streamTo: "parent"` **必加**, 列**真** visibility 渠道
3. **未来所有 ACP spawn 任务书加 `streamTo: "parent"`** — templates/builder-task.md + tester-task.md 的 OpenClaw 注入示例加这个参数

### 主人**真**能用的 visibility 渠道

| 渠道 | 主人能直接用? | 看什么? |
|---|---|---|
| **🅰️ 主 agent (我) 主动汇报** | ✅ 主人**等**我说话 | 完工事件: commit-sha + diff + test 结果 (per reporting.md) |
| **🅱️ 主人问 + 我 `subagents` 工具查** | ✅ 主人**问** → 我**查** → 汇报 | metadata: status / runtime / taskName / sessionKey |
| **🅲️ `streamTo: "parent"` (主 agent 收实时 stream)** | ⚠️ **我**传, 主人看**我**汇报 | 实时 stdout, **但**主 agent 收 stream 后**不**自动全转主人, 只在**关键节点**汇报 |
| **🅳️ `/acp spawn claude --bind here`** | ✅ 主人在 webchat 打 | **真**实时看 Claude Code 输出 |
| **❌ `/acp status` 等 slash commands** | ❌ **主 agent 调**, **不**是给用户 | —— |

**最实用组合** (未来默认):
- `sessions_spawn({runtime: "acp", agentId: "claude", streamTo: "parent", ...})` 派活
- 主 agent 收实时 stream → **关键节点** (读完文件 / 跑 test / commit) 汇报
- 主人想看完整进度 → 问"现在跑得怎样" → 我 `subagents list` 查
- 主人想直接介入 → 我 `sessions_send` 改方向, 或主人 `/acp steer`

### 加固 (避免下次再犯)

| 规则 | 说明 |
|---|---|
| ✅ **未来所有 ACP spawn 必加 `streamTo: "parent"`** | 主人 (2026-06-09) 拍: "以后的, 都用 streamTo: 'parent'" |
| ✅ **`/acp status` 等是**主 agent 命令**, **不**是用户命令 | 写进 control-claude.md 段 |
| ✅ **用户真能用的 visibility = 主 agent 主动汇报 + `subagents` 工具查询** | 列在 control-claude.md / runbook.md |
| ❌ **不**在文档里说"用户在 webchat 打 `/acp status`" | 我之前犯的错, 修 |
| ✅ 文档写"主 agent 调 `/acp status` 查 ACP session 状态" | 正确描述 |

### 关联

- `agentWorkflowAndTemplates/control-claude.md` ACP 段 (本 commit 修)
- `agentWorkflowAndTemplates/runbook.md` ACP 段 (本 commit 修)
- `agentWorkflowAndTemplates/templates/builder-task.md` + `tester-task.md` OpenClaw 注入示例 (本 commit 加 streamTo: "parent")
- `AGENT_PRACTICES.md #18` (ACP 启用步骤 + 权限坑)

---

---|---|
| **ACP spawn session key 格式** | `agent:claude:acp:<uuid>` (用 `agentId` 作 prefix, 跟 native subagent 的 `agent:main:subagent:<uuid>` 不同) |
| **`agentId` 必填** | 不填报 `target_agent_required` 错 |
| **真 permission 配置位置** | `plugins.entries.acpx.config.permissionMode` (OpenClaw config), **不**是 `sessions_spawn` API |
| **`permissionMode` 合法值** | `approve-reads` (默认) / `approve-all` (break-glass) / 还有其他 |
| **`nonInteractivePermissions` 合法值** | 只有 `deny` / `fail` (我误以为有 `approve-all`, **错**) |
| **首次跑 ACP 慢** | 第一次下 Claude Code adapter + spawn, 后续快 (v3 echo 4s 包含全部) |
| **MUST**: `runtime: "acp"` + `agentId: "<id>"` 同时传 | 不然 spawn 拒绝 |

### 跟 native subagent 模式关键差异

| 维度 | Native subagent | ACP harness |
|---|---|---|
| session key 格式 | `agent:main:subagent:<uuid>` | `agent:<agentId>:acp:<uuid>` (e.g. `agent:claude:acp:...`) |
| 跑什么 | OpenClaw sub-agent (我派) | 外部 Claude Code CLI 进程 (acpx spawn) |
| permission 配置 | `tools.subagents.tools.allow/deny` | `plugins.entries.acpx.config.permissionMode` |
| visibility (主 agent) | ❌ 看不到 subagent 内部 stdout | ✅ `streamTo: "parent"` 实时回流 |
| 适用任务 | 短原子任务 (< 1min) | 复杂长 session (中途可 `/acp steer`) |
| 装插件 | 不需要 | 需要 `@openclaw/acpx` |

### 加固 (避免下次再踩)

| 规则 | 说明 |
|---|---|
| ✅ **真权限配置在 OpenClaw config, 不在 API** | `plugins.entries.acpx.config.permissionMode=approve-all`, 不是 sessions_spawn 参数 |
| ✅ **派 ACP 前必查文档** | OpenClaw ACP 文档 line 322 表 + line 340 配法 |
| ✅ **不编造 API 参数名** | 不确定时先 `sessions_spawn --help` 或查 `subagents.md` + `acp-agents.md` |
| ✅ **`nonInteractivePermissions` 合法值只有 `deny`/`fail`** | 文档没说, 实测才能确认 (我误以为有 `approve-all` 是错的) |
| ✅ **配 config 后必重启 gateway** | 不重启不生效, 还会误以为配错 |
| ✅ **smoke test 是必需** | v1/v2 失败立刻发现, v3 通过才确认链路通 |
| ❌ **不**用 native subagent 跑 Claude Code | v0.6+ 推荐 ACP (主人原话 "直接用起来") |

### 关联

- `agentWorkflowAndTemplates/runbook.md` § "🎯 模式选择: Native subagent vs ACP harness" 段 (已加, commit `3f2c4d6`)
- OpenClaw 官方文档 `/opt/homebrew/lib/node_modules/openclaw/docs/tools/acp-agents.md` + `acp-agents-setup.md`
- AGENT_PRACTICES #16 (--add-dir 必加) - 配套的"必加参数"教训
- MEMORY #16 (--add-dir 必加) - native subagent 模式配套

---

---

---

---

---

---
---|
| 主人给 PAT token | #11：立刻 `git credential-osxkeychain store` + `git credential-osxkeychain get` 验证 |
| 主人说开了代理 | #12：立刻 `curl -x` 验证端口 + `git config --global http.*.proxy` 配 + 跑一次 |
| 主人说 VPN 连上了 | 同样要 `curl --interface` 或直接 `git push` 验 |
