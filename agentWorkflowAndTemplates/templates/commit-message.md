# Commit Message 模板

> **这是什么？** 所有 SyncPlay 项目的 git commit message 必用格式——Claude Code Builder + 主 agent 都要遵守。
> **何时使用？** 任何 `git commit` 之前**必读**。
> **最后更新：** 2026-06-09

---

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type（必填）

| Type | 用途 | 例子 |
|---|---|---|
| `feat` | 新功能 | `feat(desktop): add Windows NSIS installer config` |
| `fix` | 修 bug | `fix(peer): guard against null peer connection` |
| `docs` | 文档 | `docs: add macOS install guide with quarantine instructions` |
| `refactor` | 重构（不修 bug 也不加功能） | `refactor(client): split index.html into components` |
| `test` | 加测试 / 改测试 | `test(v0.6.0): add test report for macos-install-doc` |
| `chore` | 杂事（依赖 / 工具 / 配置文件） | `chore: update electron-builder to 25.1.8` |
| `ci` | CI/CD | `ci: add auto-release job to GitHub Actions workflow` |
| `perf` | 性能优化 | `perf(sync): reduce drift correction interval to 5s` |
| `style` | 代码风格（不影响功能） | `style: format with prettier` |
| `revert` | 回滚 | `revert: feat(desktop): add Windows NSIS installer config` |

### Scope（可选, 但推荐）

- 影响的范围 / 模块 / 文件
- 例: `desktop`, `client`, `server`, `peer`, `sync`, `v0.6.0`, `agent-practices`

### Subject（必填）

- **50 字符以内**
- **首字母小写**（除非是专有名词）
- **不用句号结尾**
- 用动词开头: "add", "fix", "update", "refactor", "remove", "move", "rename", "bump"
- 用祈使句: "add X" 不是 "added X" 也不是 "adds X"

### Body（可选, 但推荐）

- **72 字符换行**
- 解释**为什么**改（不是**改了什么**——git diff 已经有）
- 关联 AGENT_PRACTICES 教训（如果涉及）
- 列关键改动（如果 subject 说不清）

### Footer（可选）

- 关联 issue: `Closes #123`, `Refs #456`
- 关联 AGENT_PRACTICES: `Lesson: AGENT_PRACTICES.md #11`
- BREAKING CHANGE: `BREAKING CHANGE: <description>`

---

## 完整例子

### 例 1: 新功能

```
feat(v0.6.0): add macOS install guide with quarantine instructions

Document the dmg download → /Applications → "damaged" → xattr fix
flow for non-technical users.

Key sections:
- dmg download (GitHub Releases latest)
- SHA256 verification (so users can validate download)
- xattr -dr com.apple.quarantine /Applications/SyncPlay.app
- Verify the app launches

Lesson: AGENT_PRACTICES.md #22 (Mac "damaged" 真实根因)
```

### 例 2: 修 bug

```
fix(peer): handle null peer connection in sync guard

Previously, if peer.destroy() was called during sync, guardUntil
calculation crashed with "Cannot read property 'now' of null".

Add null check at peer/sync.js:45 and skip sync if peer is gone.

Fixes: occasional crash reported 2026-06-08
Lesson: AGENT_PRACTICES.md #7 (边界 case 必加 null check)
```

### 例 3: 文档

```
docs: update STATUS.md to reflect v0.5.1 release

- Mark v0.5.1 as shipped (commit e050b39)
- Update quick nav to point at v0.6.x next milestone
- Refresh progress log

(由 Reviewer 主 agent 写, 不是 Builder)
```

### 例 4: 测试报告

```
test(v0.6.0): add test report for macos-install-doc

Tester Claude Code verified 6/6 items in tasks/v0.6.0-macos-install-test-report.md:
- dmg download link 正确
- xattr 命令实测可跑
- AGENT_PRACTICES #22 引用到位
- SHA256 文档化
- Intel/Apple Silicon 都有覆盖
- 边界: 旧版本覆盖安装
```

### 例 5: CI

```
ci: add auto-release job to GitHub Actions workflow

Trigger: push v* tag → build 3 platforms → publish GitHub release

Workflow: .github/workflows/build.yml
- build-windows (windows-latest) → SyncPlay Setup X.Y.Z.exe
- build-mac (macos-latest) → SyncPlay-X.Y.Z-arm64.dmg
- build-linux (ubuntu-latest) → SyncPlay-X.Y.Z.AppImage
- artifact retention: 30 days
```

---

## 反模式（不要这样写）

### ❌ 反模式 1: 模糊 subject

```
❌ update code
❌ fix bug
❌ WIP
❌ misc changes
```

✅ 用具体的动词 + scope + 描述：
```
✅ fix(peer): handle null peer connection in sync guard
```

### ❌ 反模式 2: subject 太长

```
❌ feat(v0.6.0): add macOS install guide with quarantine instructions for users who download from GitHub and see damaged error
```

✅ 拆 subject 留 body：
```
✅ feat(v0.6.0): add macOS install guide

Body 详细说明
```

### ❌ 反模式 3: body 写"改了什么"

```
❌ - Changed foo.js line 45
   - Added bar.js
   - Modified baz.js
```

✅ body 写"为什么改":
```
✅ The previous implementation assumed peer connection is always alive,
   but in practice it can be destroyed mid-sync. Add null check.
```

### ❌ 反模式 4: 多个无关改动塞一个 commit

```
❌ feat: add macOS install guide + fix peer bug + update electron
```

✅ 拆 3 个 commit:
```
✅ feat(v0.6.0): add macOS install guide
✅ fix(peer): handle null peer connection
✅ chore: bump electron to 33.4.0
```

### ❌ 反模式 5: emoji 开头

```
❌ 🎉 feat: add macOS install guide
❌ ✨ feat: add macOS install guide
```

✅ 保持专业，emoji 留给 release notes / PR 标题

---

## OpenClaw subagent 怎么用

Builder subagent 任务书**明确**写：
> 用本模板格式, 不要自由发挥. 推荐用 `git commit` 时直接传 `-m` 多行字符串, 避免编辑器交互.

**示例 shell 命令**：
```bash
cd ~/CodeProjects/syncplay
git add <files>
git commit -m "feat(v0.6.0): add macOS install guide

Document the dmg download → /Applications → 'damaged' → xattr fix
flow for non-technical users.

Lesson: AGENT_PRACTICES.md #22 (Mac 'damaged' 真实根因)"
```

**注意**：
- Builder subagent 不应该用 `git commit` + 编辑器交互（容易卡）
- 应该一次性传 `-m "..."` 完事
- 如果 commit message 太长（> 100 字符），考虑用 `git commit -F <file>` 传文件

---

## CHANGELOG 关联

**CHANGELOG.md 由 Reviewer (主 agent) 写**——不是 Builder。

但 commit message 的 type 决定 CHANGELOG 哪个 section：
- `feat` → "新增" section
- `fix` → "修复" section
- `docs` / `refactor` / `chore` → 通常不进 CHANGELOG（除非用户可见）
- `BREAKING CHANGE` → "破坏性变更" section

---

*制定：Jarvis & 主人*
*最后更新：2026-06-09*
