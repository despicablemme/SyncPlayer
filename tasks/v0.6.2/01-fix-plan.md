# v0.6.2 修复计划 — 重入房间后底部状态栏与真实连接脱钩

> **任务 ID**: v0.6.2-fix-state-decouple
> **目标版本**: v0.6.0 → v0.6.2
> **Bug 编号**: BUG-2026-06-13-001
> **报告人**: 主人实测
> **规划阶段**: 仅分析 + 出方案, **不动代码**

---

## 1. Bug 现象复述

进入房间 → 退出房间 → 重新进入同一个房间：
- 底部状态栏停留在 **"等待对方加入..." / "对方未连接"**（状态点黄色 `waiting`）
- 实际 WebRTC 连接成功, 双方进度同步正常

**期望**：重入后状态栏应进入 `已同步` / `已连接` (绿点), 与真实连接一致.

---

## 2. 根因分析

### 2.1 一句话根因

`recomputeRoomState()` 试图直接从 `connecting` 跳到 `in_room_waiting_peer_video` / `in_room_synced` / `in_room_mismatch`, 但 `TRANSITIONS` 转移图只允许 `connecting → in_room_no_video`(或 `no_room`)。非法转移被 `RoomStateMachine.setState()` **静默 reject**(return false, listener 不触发), 导致状态机卡死在 `CONNECTING`, UI / 同步引擎 gating 全部失同步.

### 2.2 关键代码定位

#### 📍 文件 1: `src/client/app.js`

**位置 A: `recomputeRoomState()` — L515-L548**

```js
function recomputeRoomState() {
  if (!connMgr) {
    roomState.setState(ROOM_STATES.NO_ROOM);
    return;
  }
  const isOpen = !!(connMgr.conn && connMgr.conn.open);
  if (!isOpen) {
    if (roomState.state === ROOM_STATES.NO_ROOM) return;
    roomState.setState(ROOM_STATES.CONNECTING);
    return;
  }

  // 连接已开, 计算视频子状态
  const myLoaded = !!(myVideoInfo && myVideoInfo.loaded);
  const peerLoaded = !!(peerVideoInfo && peerVideoInfo.loaded);

  if (!myLoaded) {
    roomState.setState(ROOM_STATES.IN_ROOM_NO_VIDEO);                   // ✓ 合法 (CONNECTING → IN_ROOM_NO_VIDEO)
  } else if (!peerLoaded) {
    roomState.setState(ROOM_STATES.IN_ROOM_WAITING_PEER_VIDEO);          // ✗ 非法! 静默 reject
  } else {
    if (videosMatch(myVideoInfo, peerVideoInfo)) {
      roomState.setState(ROOM_STATES.IN_ROOM_SYNCED);                   // ✗ 非法! 静默 reject
    } else {
      roomState.setState(ROOM_STATES.IN_ROOM_MISMATCH);                 // ✗ 非法! 静默 reject
    }
  }
}
```

**位置 B: 状态变化 listener — L554-L581**（依赖状态转移才会触发）

```js
roomState.onStateChange((newState, oldState) => {
  // 1. UI 显示 (text + dot class)
  ...
  // 2. SyncEngine gating — 只有进入 IN_ROOM_SYNCED 才 start()
  if (connMgr && connMgr.engine) {
    if (newState === ROOM_STATES.IN_ROOM_SYNCED) {
      connMgr.engine.start();
    } else if (oldState === ROOM_STATES.IN_ROOM_SYNCED) {
      connMgr.engine.stop();
    }
  }
  ...
});
```

#### 📍 文件 2: `src/shared/room-state.js`

**位置 C: 转移图定义 — L34-L41**

```js
const TRANSITIONS = Object.freeze({
  no_room:                    ['connecting'],
  connecting:                 ['in_room_no_video', 'no_room'],    // ← 只允许 2 个出口
  in_room_no_video:           ['in_room_waiting_peer_video', 'in_room_synced', 'in_room_mismatch', 'connecting', 'no_room'],
  in_room_waiting_peer_video: ['in_room_synced', 'in_room_mismatch', 'in_room_no_video', 'connecting', 'no_room'],
  in_room_synced:             ['in_room_mismatch', 'in_room_waiting_peer_video', 'in_room_no_video', 'connecting', 'no_room'],
  in_room_mismatch:           ['in_room_synced', 'in_room_waiting_peer_video', 'in_room_no_video', 'connecting', 'no_room'],
});
```

**位置 D: `setState` 静默 reject — L66-L84**

```js
setState(next) {
  if (this._state === next) return false;
  const allowed = TRANSITIONS[this._state] || [];
  if (!allowed.includes(next)) {
    console.warn(`[room-state] illegal transition: ${this._state} -> ${next}`);  // 仅 console.warn, 无错误抛出
    return false;                                                              // ← 调用方无法察觉
  }
  ...
}
```

### 2.3 触发链路（用户视角逐步走）

1. **首次进入房间**: `startSession()` → `setState(CONNECTING)` (合法 NO_ROOM → CONNECTING) → UI "连接中..."
2. **首次连接成功**: `conn.on('open')` → `onConnOpen()` → `recomputeRoomState()`
   - 若首次进入时 `myLoaded=false`: 走 `IN_ROOM_NO_VIDEO` 分支 → **合法** → 后续 `IN_ROOM_WAITING_PEER_VIDEO` → `IN_ROOM_SYNCED` 都合法 → 一切正常
   - 若首次进入时 `myLoaded=true` (用户先加载视频后进房): 走 `IN_ROOM_WAITING_PEER_VIDEO` 分支 → **非法** → 卡死 ❌（但 FR-3 解耦设计下, 这场景本应支持）
3. **退出房间**: `exitRoom()` → `setState(NO_ROOM)` (合法, 任意 → NO_ROOM) → UI "请创建或加入房间" / "未连接"
4. **重入房间**: `startSession()` → `setState(CONNECTING)` (合法 NO_ROOM → CONNECTING) → UI "连接中..."
5. **重入后连接成功**: `conn.on('open')` → `recomputeRoomState()`
   - **`myVideoInfo` 在 `exitRoom()` 中没清空 (L675-L686 只清 `peerVideoInfo`), 所以 `myLoaded=true`**
   - → 走 `IN_ROOM_WAITING_PEER_VIDEO` 分支 → **非法转移** → **状态机卡死 CONNECTING**
   - 即使 peer 发来 `video_info`, 后续 `IN_ROOM_SYNCED` 也是 `CONNECTING → IN_ROOM_SYNCED`, 同样非法 → 一直卡

**结果**:
- 状态点停在黄色 `waiting` (CONNECTING 的 `localClass` / `remoteClass`)
- UI 文案停在 "等待对方加入..." (来自 `peer.on('open')` 的直接 `updateLocalStatus` 调用, L265) / "对方未连接"
- `engine.start()` 永远不会被调用 (listener 不触发), 主动同步指令全部停摆
- 但**用户描述里说"同步播放功能正常可用"**——可能是指**手动进度对齐 + 双方都能 seek 到同一时间点**, 或**心跳/漂移校验**通过 `peer.on('connection')` 后某些路径绕过了 gating (需进一步验证). 即使 sync engine 没启动, 双方视频仍能各自播放, 主人从表象看不出差异.

---

## 3. 影响范围（所有触发同一 UI 脱钩的路径）

| # | 触发场景 | 当前表现 |
|---|---------|---------|
| 1 | **重入同一房间 + 视频仍加载** (主人报的 bug) | UI 卡 CONNECTING, 引擎永不启动 |
| 2 | **首次进房但视频已先加载** (创建房间前加载了视频) | UI 卡 CONNECTING, 引擎永不启动 |
| 3 | **重连场景**: 在 `IN_ROOM_*` 状态时 peer lost → `onConnClose()` 切 `CONNECTING` → peer 重新连接 → `conn.on('open')` → recompute 仍可能撞非法转移 (myLoaded=true 时) | UI 卡 CONNECTING |
| 4 | **任何 `recomputeRoomState()` 在 `CONNECTING` 状态被调用且 `myLoaded=true`** | UI 卡 CONNECTING |

所有路径的本质相同：`myLoaded=true` 时, `recomputeRoomState()` 试图跨过 `IN_ROOM_NO_VIDEO` 直接到 `IN_ROOM_WAITING_PEER_VIDEO/_SYNCED/_MISMATCH`.

---

## 4. 修复方案

### 4.1 推荐方案：**方案 A — 放宽 `TRANSITIONS`**, 让 `CONNECTING` 可以直接进入任意 `in_room_*` 态

**理由**:
1. FR-3 核心设计："**视频加载完全独立于房间**" (app.js L590 注释). 当前 `TRANSITIONS` 强制"必须先经 `IN_ROOM_NO_VIDEO`"是过度约束, 与解耦设计矛盾.
2. `recomputeRoomState()` 的语义就是"**根据当前 (conn, my, peer) 三元组计算应有状态**", 应允许直接到达终态.
3. listener 处理各终态的 UI 切换已经完备 (`STATE_DISPLAY` 6 态全覆盖), 多走一步中间态反而会引起 UI 闪烁.
4. 改动量最小, 1 行 (`TRANSITIONS` 表) + 1 个测试更新.

**改动点**:

#### 📍 `src/shared/room-state.js` L34-L41

```diff
 const TRANSITIONS = Object.freeze({
   no_room:                       ['connecting'],
-  connecting:                    ['in_room_no_video', 'no_room'],
+  connecting:                    ['in_room_no_video', 'in_room_waiting_peer_video', 'in_room_synced', 'in_room_mismatch', 'no_room'],
   in_room_no_video:              ['in_room_waiting_peer_video', 'in_room_synced', 'in_room_mismatch', 'connecting', 'no_room'],
   in_room_waiting_peer_video:    ['in_room_synced', 'in_room_mismatch', 'in_room_no_video', 'connecting', 'no_room'],
   in_room_synced:                ['in_room_mismatch', 'in_room_waiting_peer_video', 'in_room_no_video', 'connecting', 'no_room'],
   in_room_mismatch:              ['in_room_synced', 'in_room_waiting_peer_video', 'in_room_no_video', 'connecting', 'no_room'],
 });
```

#### 📍 `test/unit/room-state.test.js` L137-L142

```diff
-  test('connecting 不能直接跳到 in_room_synced (必须先经过 in_room_no_video)', () => {
-    const sm = new RoomStateMachine();
-    sm.setState(STATES.CONNECTING);
-    assert.strictEqual(sm.setState(STATES.IN_ROOM_SYNCED), false);
-    assert.strictEqual(sm.state, STATES.CONNECTING);
-  });
+  test('connecting 可以直接跳到任意 in_room_* (FR-3 解耦, 视频与房间独立)', () => {
+    const sm = new RoomStateMachine();
+    sm.setState(STATES.CONNECTING);
+    for (const target of [
+      STATES.IN_ROOM_NO_VIDEO,
+      STATES.IN_ROOM_WAITING_PEER_VIDEO,
+      STATES.IN_ROOM_SYNCED,
+      STATES.IN_ROOM_MISMATCH,
+    ]) {
+      const s = new RoomStateMachine();
+      s.setState(STATES.CONNECTING);
+      assert.strictEqual(s.setState(target), true, `connecting → ${target} 应该允许`);
+      assert.strictEqual(s.state, target);
+    }
+  });
```

#### 📍 可选: `src/client/app.js` L675-L686 `exitRoom()`

虽然 `myVideoInfo` 保留能让重入更快, 但建议在 `exitRoom()` 中也清空, 避免**陈旧** `myVideoInfo` 误导后续判断 (例如用户退房后换了视频再进房, 陈旧的 `myVideoInfo` 会瞬间报 `IN_ROOM_WAITING_PEER_VIDEO` 但视频实际还没真加载完成). 

```diff
 function exitRoom() {
   if (!connMgr) return;
   connMgr.destroy();
   connMgr = null;
   peerVideoInfo = null;
+  myVideoInfo = null;   // v0.6.2 fix: 退出时清空, 避免陈旧状态干扰重入
   roomState.setState(ROOM_STATES.NO_ROOM);
   ...
 }
```

(注: 视频元素本身保留 src 不变, 重入后 `loadedmetadata` 会再次触发并重新填充 `myVideoInfo`.)

### 4.2 备选方案：**方案 B — `recomputeRoomState()` 内做多步转移**

如果主人**坚持**保留"必须经过 `IN_ROOM_NO_VIDEO`"的语义约束, 可改为:

```js
function recomputeRoomState() {
  if (!connMgr) {
    roomState.setState(ROOM_STATES.NO_ROOM);
    return;
  }
  const isOpen = !!(connMgr.conn && connMgr.conn.open);
  if (!isOpen) {
    if (roomState.state === ROOM_STATES.NO_ROOM) return;
    roomState.setState(ROOM_STATES.CONNECTING);
    return;
  }

  const myLoaded = !!(myVideoInfo && myVideoInfo.loaded);
  const peerLoaded = !!(peerVideoInfo && peerVideoInfo.loaded);

  // 计算目标态
  let target;
  if (!myLoaded) target = ROOM_STATES.IN_ROOM_NO_VIDEO;
  else if (!peerLoaded) target = ROOM_STATES.IN_ROOM_WAITING_PEER_VIDEO;
  else target = videosMatch(myVideoInfo, peerVideoInfo)
    ? ROOM_STATES.IN_ROOM_SYNCED
    : ROOM_STATES.IN_ROOM_MISMATCH;

  // 通过合法中间态链过渡 (避免非法转移)
  if (roomState.state === ROOM_STATES.CONNECTING
      && target !== ROOM_STATES.IN_ROOM_NO_VIDEO) {
    roomState.setState(ROOM_STATES.IN_ROOM_NO_VIDEO);
  }
  roomState.setState(target);
}
```

**缺点**: UI 会经过 `IN_ROOM_NO_VIDEO` 的"已连接, 请加载视频"文案一闪而过 (即使用户实际有视频). 主人可能感觉奇怪.

### 4.3 备选方案：**方案 C — 增强 `RoomStateMachine`** 提供 `goto(next)` 自动链式

扩展状态机 API, 在内部用 BFS 找最短合法路径逐跳转移. 改动最大, 但通用性最好.

**不推荐**: 当前项目用不到这么复杂的语义.

---

## 5. 推荐决策

**采用方案 A** (主) + 方案 A 的"可选: `exitRoom` 清空 `myVideoInfo`"(主).

理由:
- 最小改动, 最贴合 FR-3 解耦设计
- 修一个 bug, 连带把方案 B 的 UI 闪烁问题一起规避
- 测试改动量小 (1 个用例改写, 不是删)

---

## 6. 测试验证

### 6.1 单元测试 (`npm test`)

| # | 测例 | 期望 |
|---|------|------|
| 1 | `test/unit/room-state.test.js` 中替换的 `connecting 可以直接跳到任意 in_room_*` 测例 | 4 个目标态全部转移成功 |
| 2 | 现有 `任意状态 → no_room` 测例 | 仍然全过 (没改这部分) |
| 3 | 现有 `任意 in_room_* → connecting` 测例 | 仍然全过 |
| 4 | 现有 `listener` / `canSync` 测例 | 全过 |

### 6.2 集成/E2E 验证 (`npm run test:e2e` 或主人手动双窗口)

**核心 case — 重入房间**:

1. A 加载视频, B 加载视频
2. A 创建房间, B 加入 → 等待双方 `remoteStatus === '已连接'`
3. 双方进度同步, 确认 sync OK
4. **A 点退出房间** → 确认 A 的 `localStatus === '请创建或加入房间'`, `remoteStatus === '未连接'`
5. **B 点退出房间** → 同上
6. A 再创建房间 (新 ID), B 加入同一新 ID → 等待 → 确认双方 `remoteStatus === '已连接'`, **且 dot class 是 `connected` (绿色), 不是 `waiting` (黄色)**
7. 双方同步播放, 验证 sync 仍工作

**边界 case**:

| Case | 预期 |
|------|------|
| A 加载视频后, **先**创建房间, 再等 B 加入 | A 状态: CONNECTING → IN_ROOM_WAITING_PEER_VIDEO (修前会卡 CONNECTING) |
| A 在房间中, B 突然断网, A 看到 `peer lost` → CONNECTING → B 重连 → IN_ROOM_* | 状态正确恢复 |
| A 进房, 没加载视频就退出 → 再进房 | 状态正确 (这条修前也 OK, 因为 myLoaded=false 时走的是合法分支) |
| A 在房间中 reload 整个页面 → 重新进同一房间 | 同 case 1 |

### 6.3 主人手测脚本 (Playwright 或真双窗口)

```js
// 在 startSession 前后 + conn.open 后断言 UI 文案 + state
const states = await pageA.evaluate(() => ({
  localText: document.getElementById('localStatus').textContent,
  localDotClass: document.getElementById('localStatusDot').className,
  remoteText: document.getElementById('remoteStatus').textContent,
  remoteDotClass: document.getElementById('remoteStatusDot').className,
  state: window.__syncplay.roomState().state,    // 调试 API 已在 L733-L738 暴露
}));
```

修后断言 (重入 + 双方都加载视频后): `state === 'in_room_synced'`, `localDotClass` 含 `connected`, `remoteDotClass` 含 `connected`.

---

## 7. 风险评估

| 风险 | 等级 | 说明 | 缓解 |
|------|------|------|------|
| 放宽 `TRANSITIONS` 破坏其他依赖中间态的代码 | 🟢 低 | 唯一调用方是 `recomputeRoomState()`, 注释和 listener 都按"终态独立"设计 | 跑单元测试 + e2e |
| 单元测试要改一处, 可能遗漏其他相关 case | 🟢 低 | 只改一处, 现有 listener / canSync 测例都不依赖 `connecting → X` 的具体路径 | 提交前 `npm test` 全过 |
| `exitRoom` 清 `myVideoInfo` 可能影响别的逻辑 | 🟡 中 | 当前没有任何代码读 `myVideoInfo` 假设它非空, 但保险起见需要 grep 确认 | grep `myVideoInfo` 全文 + 单元测试覆盖 |
| `peer.on('open')` 的直接 `updateLocalStatus` 调用 (L265) 仍然是 UI 直接写入, 绕过 state | 🟡 中 | 当前文案"等待对方加入..." 跟 CONNECTING 一致, 凑巧 OK; 后续如果 STATE_DISPLAY 改了文案, 这里会脱钩 | **建议在 fix 里一并重构**: 把 L265 改为 `recomputeRoomState()`, 让所有 UI 更新都走 state. 这一改动可作为本 fix 的"附加项"或下个版本清理. |
| `engine.bindVideoEvents()` 没解绑, 多次进房后事件监听器累积 | 🟡 中 | 每次新建 `ConnectionManager` 就多绑 3 个 (play/pause/seeked). 老的 listener 持有老 engine 闭包, 老 engine 持有 `send → this.send`, 但老 `this.conn.open` 是 false, 所以消息不发. 纯内存泄漏, 不影响功能 | **建议**: 给 `SyncEngine` 加 `unbindVideoEvents()`, 在 `connMgr.destroy()` 调用. 列为本 fix 附加项. |
| `peer.js` CDN 加载失败 / `new Peer` 报错时 `startSession` 没错误兜底 | 🟢 低 | 已存在的健壮性问题, 不在本 fix 范围 | 下版本 |

**总体**: 推荐方案 A + 清 `myVideoInfo` 是低风险高收益. 附加项 (peer.on('open') 重构 / engine.unbind) 可一并做, 但严格说不阻塞主修复.

---

## 8. 执行计划（待主人确认方案后开干）

> **本阶段不动代码**, 等主人确认后再开 Builder 实例执行.

预计改动:

| 文件 | 改动 | 行数估算 |
|------|------|---------|
| `src/shared/room-state.js` | 放宽 `TRANSITIONS` | 1 行 |
| `test/unit/room-state.test.js` | 重写"connecting 不能直接跳 in_room_synced"测例 | ~10 行 |
| `src/client/app.js` `exitRoom()` | 清 `myVideoInfo` | 1 行 |
| **附加 (可选)** `src/client/app.js` `peer.on('open')` | 改为 `recomputeRoomState()` | 2 行 |
| **附加 (可选)** `src/shared/sync-engine.js` + `src/client/app.js` | 加 `unbindVideoEvents()` 并在 destroy 调用 | ~10 行 |

外加新增 1-2 个 E2E 测例覆盖"重入 + 已有视频"场景.

**版本号**: 0.6.0 → **0.6.2** (修 bug 跳过 0.6.1, 因 0.6.1 已是 v0.6.1-FR-4 历史记录功能, 跳过避免误解; 或直接 v0.6.1-fix 见仁见智, 由主人定).

---

## 9. 附录：其他次要观察（不在本 fix 范围, 仅记录）

1. `startSession()` L689-L706 入口处的 `if (connMgr) connMgr.destroy();` 是防御性写法, 配合 `exitRoom()` 总是 `connMgr = null`, 实际不会触发. OK.
2. `roomState._listeners` 是模块级单例 listener, 应用整个生命周期只 1 个. 如果有"销毁整个 app 重建"的需求, 会泄漏; 当前不构成问题.
3. `app.js:733` 暴露的 `window.__syncplay` 调试 API 很有用, 验证时可读 `roomState.state` / `connMgr` / `myVideoInfo` / `peerVideoInfo`.

---

**文档结束**. 等主人拍板方案 A / B / C 后开 Builder 实例执行.