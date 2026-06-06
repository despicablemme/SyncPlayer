# SyncPlay 文档索引

> **这是什么？** 项目文档的**总入口**。  
> 想知道"哪个文档看什么"——先看这个。  
> 最后更新：2026-06-06

---

## 🗂 文档地图

### 🟢 日常查阅（经常看）

| 文档 | 回答什么问题 | 何时看 |
|------|------------|--------|
| **[STATUS.md](./STATUS.md)** | 我现在在哪个版本？下一步做什么？ | **回来接任务时**先看这个 |
| **[ROADMAP.md](./ROADMAP.md)** | 目标是什么？后续版本怎么走？ | 想看方向、决策讨论时 |
| **[REQUIREMENTS.md](./REQUIREMENTS.md)** | 系统要满足什么要求？ | 想看需求、规格时 |

### 🟡 设计参考（写代码时看）

| 文档 | 回答什么问题 | 何时看 |
|------|------------|--------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 软件架构长什么样？ | 实现新功能前 |
| **[CHANGELOG.md](./CHANGELOG.md)** | 历史上每个版本改了什么？ | 想看演进过程 |

### 🔵 历史档案（偶尔看）

| 文档 | 回答什么问题 | 何时看 |
|------|------------|--------|
| **[TECH_RESEARCH.md](./TECH_RESEARCH.md)** | 为什么选 WebRTC？ | 想了解技术选型理由 |
| **[MEETINGS.md](./MEETINGS.md)** | 早期会议讨论过什么？ | 想了解历史决策过程 |

---

## 🔀 文档关系图

```
                    STATUS.md （当前状态）
                    ┌────┴────┐
                    │         │
            ROADMAP.md      CHANGELOG.md
           （目标/决策）    （历史变更）
                    │         │
                    └────┬────┘
                         │
                  REQUIREMENTS.md
                    （要做什么）
                         │
                         │ 实现
                         ▼
                  ARCHITECTURE.md
                  （怎么实现）
```

**阅读路径建议：**
- **接任务** → STATUS → ROADMAP → (相关章节)
- **看历史** → CHANGELOG → MEETINGS（了解背景）
- **写新功能** → REQUIREMENTS → ARCHITECTURE → TECH_RESEARCH（了解约束）
- **理解选型** → TECH_RESEARCH → ARCHITECTURE

---

## 📝 文档维护约定

### 何时更新哪个文档

| 触发事件 | 更新哪个 |
|---------|---------|
| 完成一个版本 | CHANGELOG.md |
| 推进/完成某项任务 | STATUS.md |
| 决定 v1.0 范围 | REQUIREMENTS.md, ROADMAP.md |
| 架构有重大调整 | ARCHITECTURE.md |
| 选型/技术调研 | TECH_RESEARCH.md |
| 重大会议 | MEETINGS.md |

### 头部说明格式

每个文档顶部都有这个格式，方便快速理解：

```markdown
# [文档名]

> **这是什么？** 一句话说明文档用途  
> **何时查阅？** 什么场景下看这个  
> **关联文档：** → 相关链接  
> **最后更新：** YYYY-MM-DD

---
```

---

*维护：Jarvis*
