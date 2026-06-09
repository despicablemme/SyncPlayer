# SyncPlay Agent 角色分工

> **这是什么？** 项目"人类可读"的角色分工入口——给新加入的开发者 / 接手项目的人看的。
> **何时查阅？** 第一次接触 SyncPlay 项目 / 想了解项目级设计原则时**先看这个**。
> **适用范围：** SyncPlay 项目所有开发任务（v0.x 迭代、v1.0、v2.0 等）
> **最后更新：** 2026-06-09

---

## ⚠️ Agent 必读：完整工作流 + Claude Code 协作 + 模板已迁移

**所有 agent（OpenClaw 主 agent / subagent / Claude Code 实例）干活时，请看新目录**：

📁 **`agentWorkflowAndTemplates/`** —— agent 唯一权威工作流来源

包含：
- `workflow.md` — 通用工作流（OpenClaw + Claude Code 协作）
- `roles.md` — 三角色详细定义 + Claude Code 实例对应关系
- `control-claude.md` — 如何控制 Claude Code（派活 / 抓结果 / 独立上下文）
- `acceptance.md` — Reviewer 验收清单
- `reporting.md` — 汇报机制
- `templates/` — 给 Claude Code 用的所有任务书 + 报告 + commit 模板

**本文档（`docs/AGENTS.md`）是项目级入口**——保留 v0.4 立的"三角色铁律"作为设计原则参考。**实际工作流以新目录为准**。

---

## 🏛️ 项目级规范（v0.4 立，保留作为设计原则）

> 这一节是 v0.4 立的"三角色分工"原始规范——**原则**仍然适用，但**具体实现**（OpenClaw subagent 怎么派、Claude Code 怎么调、模板怎么用）请看 `agentWorkflowAndTemplates/`。


## ⚠️ 铁律

**每个任务必须按 Builder → Tester → Reviewer 的顺序执行，不得跳过或合并步骤。**

- Builder 交付产物后，等待 Tester 验证
- Tester 验证后，等待 Reviewer 审核
- Reviewer 通过后，任务才算完成
- **主 Agent（Jarvis）只负责调度，不自己执行具体任务**

---

## 三角色定义

### 🤖 Builder（构建者）

**职责：** 执行具体开发任务，交付可验证的产物。

**工作内容：**
- 按任务要求编写/修改代码
- 配置环境、依赖、安装包
- 生成可测试的产物（.exe、.dmg、代码文件等）

**交付物：**
- 完整的构建产物（能在目标环境运行）
- Builder 自己的自测报告（可选）

**原则：**
- 只管构建，不管测试
- 产出后**主动报告**，不要等问
- 如果构建失败，报告错误日志，由 Reviewer 决定是否返工

---

### 🧪 Tester（测试者）

**职责：** 在目标环境验证 Builder 的产物，输出客观测试结果。

**工作内容：**
- 在目标平台运行产物（Windows/Mac/Linux）
- 执行验证清单（见下方）
- 记录 pass/fail 和错误日志

**验证清单（通用）：**
1. 产物能否正常启动（无崩溃）
2. 信令服务端口是否监听（9000）
3. WebView/客户端是否正常加载
4. 核心功能是否工作（播放/暂停/同步）
5. 无异常错误日志

**交付物：**
```
测试报告：
- 环境：Windows 11 / Mac OS 14 / ...
- 产物：SyncPlay Setup 0.5.0.exe
- 结果：PASS / FAIL
- 错误日志：（如有）
- 截图：（如有）
```

**原则：**
- 只管测试，不管修复
- 客观记录，不美化结果
- Fail 就是 Fail，必须如实报告

---

### 🔍 Reviewer（审核者）

**职责：** 综合 Builder 和 Tester 的报告，做出"通过/需修复/终止"决策。

**决策类型：**

| 决策 | 条件 | 动作 |
|------|------|------|
| **✅ PASS** | Tester 全部验证项通过 | 任务完成，提交 git |
| **⚠️ NEED FIX** | Tester 发现问题，但可修复 | 指定 Builder 修复具体问题 |
| **❌ FAIL** | 严重问题，无法简单修复 | 记录问题，任务暂停或重新评估 |

**工作内容：**
- 读取 Tester 的测试报告
- 核对验证清单
- 给出决策并说明理由
- 如需修复，给出具体的修复指令

**交付物：**
```
审核报告：
- 决策：PASS / NEED FIX / FAIL
- 理由：...
- 修复指令（如需）：...
```

**原则：**
- 决策必须有依据（基于 Tester 报告）
- 不主观臆测，只看实际结果
- NEED FIX 时要给出具体、明确的修复要求

---

## 工作流程

```
主人发布任务
    │
    ▼
┌─────────────────┐
│   主 Agent       │  ← Jarvis（调度员）
│  拆分任务        │
└────────┬────────┘
         │ 派发任务
         ▼
┌─────────────────┐
│    Builder      │  执行构建，交付产物
└────────┬────────┘
         │ 报告交付
         ▼
┌─────────────────┐
│    Tester       │  目标环境验证，输出测试报告
└────────┬────────┘
         │ 报告结果
         ▼
┌─────────────────┐
│   Reviewer      │  审核决策：PASS / NEED FIX / FAIL
└────────┬────────┘
         │ 决策
         ▼
    ┌────┴────┐
    │ PASS?   │
    └────┬────┘
      YES │ NO → 返回 Builder，重新走流程
           │
           ▼
       任务完成
```

---

## 子 Agent 召唤方式

```javascript
// Builder
sessions_spawn({
  task: "任务描述",
  taskName: "builder-v0.5-windows",
  runtime: "subagent",
  context: "isolated",  // 独立上下文，不继承主 transcript
  // ...
})

// Tester
sessions_spawn({
  task: "任务描述 + 验证清单",
  taskName: "tester-v0.5-windows",
  runtime: "subagent",
  context: "isolated",
  // ...
})

// Reviewer
sessions_spawn({
  task: "任务描述 + Tester 报告 + 决策任务",
  taskName: "reviewer-v0.5-windows",
  runtime: "subagent",
  context: "isolated",
  // ...
})
```

---

## 角色与原有五角色对照

| 原五角色 | 合并到 | 理由 |
|---------|--------|------|
| 架构师 | 合并到 Reviewer | 架构决策是审核行为，不是执行行为 |
| 策略师 | 合并到 Reviewer | 任务拆解是调度行为，由主 Agent 承担 |
| 前端 Agent | 归入 Builder | 执行者角色 |
| 后端 Agent | 归入 Builder | 执行者角色 |
| 测试 Agent | 升级为独立 Tester | 独立验证，职责明确 |

---

## 示例：v0.5 Windows 打包任务

**任务：** 生成 Windows .exe 安装包，双击即用，零依赖

### Step 1 — Builder

```
任务：在 Windows 环境下运行 npm run dist:win，生成 .exe
交付物：desktop/dist/SyncPlay Setup 0.5.0.exe
```

### Step 2 — Tester

```
任务：验证 .exe 在 Windows 上：
1. 双击运行，无崩溃
2. 信令服务在 port 9000 启动
3. 窗口正常显示 SyncPlay UI
4. 无错误日志

交付物：测试报告（PASS/FAIL + 日志）
```

### Step 3 — Reviewer

```
任务：审核 Tester 报告
决策：
- PASS → 提交 git，v0.5 完成
- NEED FIX → 指定 Builder 修复具体问题
- FAIL → 记录严重问题，暂停任务
```

---

## 强制执行约定

1. **每次任务必须三角色齐全**——不允许 Builder 兼 Tester，不允许跳过 Reviewer
2. **Tester 必须有独立上下文**——不在 Builder 的 context 里测
3. **Reviewer 必须看实际报告**——不做猜测性审核
4. **FAIL 必须有日志**——无日志的 FAIL 不算数
5. **任务完成必须 git commit**——由 Reviewer 决策通过后执行

---

*制定：Jarvis & 主人*
*维护：Jarvis*
