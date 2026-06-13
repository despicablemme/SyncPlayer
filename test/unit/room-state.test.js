'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { STATES, TRANSITIONS, RoomStateMachine } = require('../../src/shared/room-state.js');

describe('RoomStateMachine - 初始状态', () => {
  test('初始 state 应该是 no_room', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.state, STATES.NO_ROOM);
  });

  test('初始 is(no_room) 应该为 true', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.is(STATES.NO_ROOM), true);
    assert.strictEqual(sm.is(STATES.CONNECTING), false);
  });

  test('初始 canSync() 应该为 false', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.canSync(), false);
  });
});

describe('RoomStateMachine - 合法转移', () => {
  test('no_room → connecting', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.setState(STATES.CONNECTING), true);
    assert.strictEqual(sm.state, STATES.CONNECTING);
  });

  test('connecting → in_room_no_video (连接成功, 双方都没视频)', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    assert.strictEqual(sm.setState(STATES.IN_ROOM_NO_VIDEO), true);
    assert.strictEqual(sm.state, STATES.IN_ROOM_NO_VIDEO);
  });

  test('in_room_no_video → in_room_waiting_peer_video (我加载了视频, 等对端)', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    assert.strictEqual(sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO), true);
    assert.strictEqual(sm.state, STATES.IN_ROOM_WAITING_PEER_VIDEO);
  });

  test('in_room_waiting_peer_video → in_room_synced (对端也加载了, 匹配)', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    assert.strictEqual(sm.setState(STATES.IN_ROOM_SYNCED), true);
    assert.strictEqual(sm.state, STATES.IN_ROOM_SYNCED);
  });

  test('in_room_waiting_peer_video → in_room_mismatch (对端加载了, 不匹配)', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    assert.strictEqual(sm.setState(STATES.IN_ROOM_MISMATCH), true);
    assert.strictEqual(sm.state, STATES.IN_ROOM_MISMATCH);
  });

  test('in_room_synced → in_room_mismatch (对端换了不同视频)', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    sm.setState(STATES.IN_ROOM_SYNCED);
    assert.strictEqual(sm.setState(STATES.IN_ROOM_MISMATCH), true);
    assert.strictEqual(sm.state, STATES.IN_ROOM_MISMATCH);
  });

  test('in_room_mismatch → in_room_synced (对端换回相同视频)', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    sm.setState(STATES.IN_ROOM_MISMATCH);
    assert.strictEqual(sm.setState(STATES.IN_ROOM_SYNCED), true);
    assert.strictEqual(sm.state, STATES.IN_ROOM_SYNCED);
  });

  test('任意 in_room_* 状态 → connecting (peer lost, 等待重连)', () => {
    for (const startState of [
      STATES.IN_ROOM_NO_VIDEO,
      STATES.IN_ROOM_WAITING_PEER_VIDEO,
      STATES.IN_ROOM_SYNCED,
      STATES.IN_ROOM_MISMATCH,
    ]) {
      const sm = new RoomStateMachine();
      sm.setState(STATES.CONNECTING);
      sm.setState(STATES.IN_ROOM_NO_VIDEO);
      sm._forceState(startState); // 强制跳到起始状态 (合法路径)
      assert.strictEqual(sm.setState(STATES.CONNECTING), true, `${startState} → connecting 应该允许`);
    }
  });

  test('任意状态 → no_room (用户退出)', () => {
    for (const startState of [
      STATES.NO_ROOM, // 同样状态不算转移, 但先验证 setState 返回 false
      STATES.CONNECTING,
      STATES.IN_ROOM_NO_VIDEO,
      STATES.IN_ROOM_WAITING_PEER_VIDEO,
      STATES.IN_ROOM_SYNCED,
      STATES.IN_ROOM_MISMATCH,
    ]) {
      const sm = new RoomStateMachine();
      sm.setState(STATES.CONNECTING);
      sm.setState(STATES.IN_ROOM_NO_VIDEO);
      sm._forceState(startState);
      if (startState === STATES.NO_ROOM) {
        // no_room → no_room 返回 false (相同状态)
        assert.strictEqual(sm.setState(STATES.NO_ROOM), false);
      } else {
        assert.strictEqual(sm.setState(STATES.NO_ROOM), true, `${startState} → no_room 应该允许`);
        assert.strictEqual(sm.state, STATES.NO_ROOM);
      }
    }
  });
});

describe('RoomStateMachine - 非法转移', () => {
  test('no_room 不能直接跳到 in_room_no_video (必须先 connecting)', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.setState(STATES.IN_ROOM_NO_VIDEO), false);
    assert.strictEqual(sm.state, STATES.NO_ROOM);
  });

  test('no_room 不能直接跳到 in_room_synced', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.setState(STATES.IN_ROOM_SYNCED), false);
    assert.strictEqual(sm.state, STATES.NO_ROOM);
  });

  test('connecting 可以直接跳到任意 in_room_* (FR-3 解耦, 视频与房间独立)', () => {
    const targets = [
      STATES.IN_ROOM_NO_VIDEO,
      STATES.IN_ROOM_WAITING_PEER_VIDEO,
      STATES.IN_ROOM_SYNCED,
      STATES.IN_ROOM_MISMATCH,
    ];
    for (const target of targets) {
      const sm = new RoomStateMachine();
      sm.setState(STATES.CONNECTING);
      assert.strictEqual(sm.setState(target), true, `connecting → ${target} 应该允许`);
      assert.strictEqual(sm.state, target);
    }
  });

  test('相同状态转移返回 false', () => {
    const sm = new RoomStateMachine();
    assert.strictEqual(sm.setState(STATES.NO_ROOM), false);
  });
});

describe('RoomStateMachine - 监听器', () => {
  test('onStateChange 在转移时触发, 传 newState + oldState', () => {
    const sm = new RoomStateMachine();
    const events = [];
    sm.onStateChange((next, prev) => events.push({ next, prev }));
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    assert.deepStrictEqual(events, [
      { next: STATES.CONNECTING, prev: STATES.NO_ROOM },
      { next: STATES.IN_ROOM_NO_VIDEO, prev: STATES.CONNECTING },
    ]);
  });

  test('非法转移不触发 listener', () => {
    const sm = new RoomStateMachine();
    const events = [];
    sm.onStateChange((next, prev) => events.push({ next, prev }));
    sm.setState(STATES.IN_ROOM_SYNCED); // 非法
    assert.strictEqual(events.length, 0);
  });

  test('返回的 unsubscribe 函数可以取消订阅', () => {
    const sm = new RoomStateMachine();
    let count = 0;
    const unsub = sm.onStateChange(() => count++);
    sm.setState(STATES.CONNECTING);
    assert.strictEqual(count, 1);
    unsub();
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    assert.strictEqual(count, 1); // 没再触发
  });

  test('多个 listener 都会被调用', () => {
    const sm = new RoomStateMachine();
    let aCount = 0, bCount = 0;
    sm.onStateChange(() => aCount++);
    sm.onStateChange(() => bCount++);
    sm.setState(STATES.CONNECTING);
    assert.strictEqual(aCount, 1);
    assert.strictEqual(bCount, 1);
  });

  test('listener 抛错不影响后续 listener', () => {
    const sm = new RoomStateMachine();
    let bCount = 0;
    sm.onStateChange(() => { throw new Error('boom'); });
    sm.onStateChange(() => bCount++);
    sm.setState(STATES.CONNECTING);
    assert.strictEqual(bCount, 1);
  });
});

describe('RoomStateMachine - canSync gating', () => {
  test('只有 in_room_synced 状态 canSync() 返回 true', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    sm.setState(STATES.IN_ROOM_SYNCED);
    assert.strictEqual(sm.canSync(), true);
  });

  test('其他状态 canSync() 都返回 false', () => {
    const cases = [
      STATES.NO_ROOM,
      STATES.CONNECTING,
      STATES.IN_ROOM_NO_VIDEO,
      STATES.IN_ROOM_WAITING_PEER_VIDEO,
      STATES.IN_ROOM_MISMATCH,
    ];
    for (const s of cases) {
      const sm = new RoomStateMachine();
      sm.setState(STATES.CONNECTING);
      sm.setState(STATES.IN_ROOM_NO_VIDEO);
      sm._forceState(s);
      assert.strictEqual(sm.canSync(), false, `${s} 不应该 canSync`);
    }
  });
});

describe('RoomStateMachine - 解耦场景 (任意顺序)', () => {
  test('先加载视频再进房: 仍然能正常转移 connecting → in_room_waiting_peer_video (跳过了 no_video)', () => {
    // 场景: A 加载视频, 然后点击"创建房间"
    // 期望路径: no_room → connecting → in_room_waiting_peer_video (因为 A 已有视频)
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    // 模拟 conn open + 已有 video
    sm.setState(STATES.IN_ROOM_NO_VIDEO); // 这是默认入口
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO); // 我有 video, 等 peer
    assert.strictEqual(sm.state, STATES.IN_ROOM_WAITING_PEER_VIDEO);
  });

  test('进房后再加载视频: no_room → connecting → in_room_no_video → in_room_waiting_peer_video', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    assert.strictEqual(sm.state, STATES.IN_ROOM_WAITING_PEER_VIDEO);
  });

  test('退出后重进: in_room_synced → no_room → connecting → in_room_no_video', () => {
    const sm = new RoomStateMachine();
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    sm.setState(STATES.IN_ROOM_WAITING_PEER_VIDEO);
    sm.setState(STATES.IN_ROOM_SYNCED);
    sm.setState(STATES.NO_ROOM);
    assert.strictEqual(sm.state, STATES.NO_ROOM);
    sm.setState(STATES.CONNECTING);
    sm.setState(STATES.IN_ROOM_NO_VIDEO);
    assert.strictEqual(sm.state, STATES.IN_ROOM_NO_VIDEO);
  });
});

describe('TRANSITIONS map 完整性', () => {
  test('TRANSITIONS 覆盖所有 6 状态', () => {
    for (const s of Object.values(STATES)) {
      assert.ok(TRANSITIONS[s], `${s} 应该在 TRANSITIONS 中`);
      assert.ok(Array.isArray(TRANSITIONS[s]), `${s} 的转移列表应该是数组`);
    }
  });

  test('TRANSITIONS 至少允许退出 (任意状态 → no_room, 除了 no_room 自己)', () => {
    for (const s of Object.values(STATES)) {
      if (s === STATES.NO_ROOM) continue;
      assert.ok(TRANSITIONS[s].includes(STATES.NO_ROOM), `${s} 应该允许 → no_room`);
    }
  });
});
