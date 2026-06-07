# Network Tests

网络连通性 / TURN 凭据 / ICE 候选相关测试。

**这些测试不需要第二个 peer、不需要跨网段、不需要启信令 server。**

## 测试列表

| 文件 | 作用 | 时长 |
|------|------|------|
| `ice-smoke.js` | 验证 TURN 凭据,产生 relay 候选 | ~10s |

## 跑法

```bash
# 跑 ice-smoke
npm run test:ice

# 或直接
node test/network/ice-smoke.js
```

## 与其他测试的关系

| | `npm test` (unit) | `npm run test:e2e` | `npm run test:ice` (network) |
|---|---|---|---|
| 测试对象 | SyncEngine 逻辑 | 完整应用流 | TURN 凭据 / ICE |
| 启 server | ❌ | ✅ | ❌ |
| 启浏览器 | ❌ | ✅ (2 个) | ✅ (1 个,headless) |
| 需要视频文件 | ❌ | ✅ | ❌ |
| 需要跨网 | ❌ | ❌ | ❌ |
| 离线能跑 | ✅ | ❌ | ❌ (要访问 TURN) |

## 为什么需要这个

Phase 1 DoD 要求"凭据有效 + 跨网同步"。其中:

- **"凭据有效"** → 这个脚本 10 秒验完
- **"跨网同步"** → 还是要 `./start.command` + 两端浏览器实测(R2-R5 流程,脚本无法替代)
