'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { SyncEngine, DEFAULT_CONFIG } = require('../../src/shared/sync-engine.js');

// ============ Mock 辅助 ============

function createMockVideo(initialState = {}) {
  const v = {
    currentTime: initialState.currentTime ?? 0,
    duration: initialState.duration ?? 100,
    paused: initialState.paused ?? true,
    _listeners: {},
    addEventListener(event, fn) { this._listeners[event] = fn; },
    removeEventListener(event) { delete this._listeners[event]; },
    play() { v.paused = false; return Promise.resolve(); },
    pause() { v.paused = true; },
    _emit(event) {
      const fn = v._listeners[event];
      if (fn) fn();
    },
  };
  return v;
}

function createMockSend() {
  const calls = [];
  const fn = (msg) => calls.push(JSON.parse(JSON.stringify(msg))); // deep clone
  fn.calls = calls;
  fn.clear = () => { calls.length = 0; };
  return fn;
}

function makeEngine(video, send, extraConfig = {}) {
  return new SyncEngine(video, send, {
    ...DEFAULT_CONFIG,
    HEARTBEAT_INTERVAL_MS: 100000,
    DRIFT_CHECK_INTERVAL_MS: 100000,
    ...extraConfig,
  });
}

// ============ Tests ============

describe('SyncEngine.handle play', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo({ currentTime: 0, duration: 100 });
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('1. handle("play") 设置 guardUntil', () => {
    const before = Date.now();
    engine.handle({ type: 'play', position: 5 });
    assert.ok(engine.guardUntil > before, 'guardUntil 应大于调用前时间戳');
    assert.ok(engine.guardUntil >= before + DEFAULT_CONFIG.GUARD_WINDOW_MS - 1,
      `guardUntil=${engine.guardUntil} 应 >= before+${DEFAULT_CONFIG.GUARD_WINDOW_MS}`);
  });

  test('2. handle("play") 仅当 currentTime 偏差 > 0.3 时才校正', () => {
    // 偏差 0.5 > 0.3，应校正
    engine.handle({ type: 'play', position: 5.5 });
    assert.strictEqual(video.currentTime, 5.5, '偏差 0.5 > 0.3，应跳转');

    // 偏差 0.2 <= 0.3，不校正
    video.currentTime = 5;
    engine.handle({ type: 'play', position: 5.2 });
    assert.strictEqual(video.currentTime, 5, '偏差 0.2 <= 0.3，不应跳转');
  });

  test('3. handle("play") 仅当 video.paused 时才调用 play()', () => {
    video.paused = true;
    engine.handle({ type: 'play', position: 0 });
    assert.strictEqual(video.paused, false, '暂停时应调用 play()');

    video.paused = false;
    engine.handle({ type: 'play', position: 0 });
    assert.strictEqual(video.paused, false, '非暂停时不应再次调用 play()');
  });
});

describe('SyncEngine.handle pause', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo({ currentTime: 10, duration: 100, paused: false });
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('4. handle("pause") 设置 guardUntil', () => {
    const before = Date.now();
    engine.handle({ type: 'pause', position: 7 });
    assert.ok(engine.guardUntil > before, 'guardUntil 应大于当前时间');
  });

  test('5. handle("pause") 仅当 currentTime 偏差 > 0.3 时才校正', () => {
    engine.handle({ type: 'pause', position: 8 });
    assert.strictEqual(video.currentTime, 8, '偏差 2 > 0.3，应跳转');

    video.currentTime = 10;
    engine.handle({ type: 'pause', position: 10.1 });
    assert.strictEqual(video.currentTime, 10, '偏差 0.1 <= 0.3，不应跳转');
  });

  test('6. handle("pause") 仅当 !video.paused 时才调用 pause()', () => {
    video.paused = false;
    engine.handle({ type: 'pause', position: 5 });
    assert.strictEqual(video.paused, true, '非暂停时应调用 pause()');

    video.paused = true;
    engine.handle({ type: 'pause', position: 5 });
    assert.strictEqual(video.paused, true, '已暂停时不应再次调用 pause()');
  });
});

describe('SyncEngine.handle seek', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo({ currentTime: 0, duration: 100 });
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('7. handle("seek") 设置 guardUntil', () => {
    const before = Date.now();
    engine.handle({ type: 'seek', position: 12 });
    assert.ok(engine.guardUntil > before, 'guardUntil 应大于当前时间');
  });

  test('8. handle("seek") 仅当 currentTime 偏差 > 0.3 时才校正', () => {
    engine.handle({ type: 'seek', position: 15 });
    assert.strictEqual(video.currentTime, 15, '偏差 15 > 0.3，应跳转');

    video.currentTime = 15;
    engine.handle({ type: 'seek', position: 15.1 });
    assert.strictEqual(video.currentTime, 15, '偏差 0.1 <= 0.3，不跳转');
  });
});

describe('SyncEngine.handle heartbeat', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo();
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('9. handle("heartbeat") 发送 heartbeat_pong 包含 origT', () => {
    const now = Date.now();
    engine.handle({ type: 'heartbeat', t: now, serverT: now });
    assert.strictEqual(send.calls.length, 1, '应发送一条消息');
    assert.strictEqual(send.calls[0].type, 'heartbeat_pong', '类型应为 heartbeat_pong');
    assert.strictEqual(send.calls[0].origT, now, 'origT 应与请求一致');
    assert.ok('serverT' in send.calls[0], '应包含 serverT');
    assert.ok('recvT' in send.calls[0], '应包含 recvT');
  });

  test('10. handle("heartbeat_pong") 计算并保存 lastRtt', () => {
    const before = Date.now();
    engine.handle({ type: 'heartbeat_pong', origT: before });
    const after = Date.now();
    assert.ok(engine.lastRtt >= 0, 'lastRtt 应 >= 0');
    assert.ok(engine.lastRtt <= after - before + 10, 'lastRtt 应在合理范围');
  });
});

describe('SyncEngine.handle drift', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo({ currentTime: 50, duration: 100 });
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('11. handle("drift_check") 发送 drift_response 包含 requestId', () => {
    engine.handle({ type: 'drift_check', requestId: 'abc123', remotePosition: 50 });
    assert.strictEqual(send.calls.length, 1);
    assert.strictEqual(send.calls[0].type, 'drift_response');
    assert.strictEqual(send.calls[0].requestId, 'abc123');
    assert.ok('myPosition' in send.calls[0]);
    assert.ok('myT' in send.calls[0]);
  });

  test('12. handle("drift_response") 更新 driftOffset', () => {
    engine.handle({ type: 'drift_response', remotePosition: 55, myPosition: 50 });
    assert.strictEqual(engine.driftOffset, 5, 'driftOffset = remote - my');
  });

  test('13. handle("drift_response") 偏差 > DRIFT_THRESHOLD_SEC 时校正 currentTime', () => {
    const before = Date.now();
    engine.handle({ type: 'drift_response', remotePosition: 55.6, myPosition: 50 });
    assert.strictEqual(video.currentTime, 55.6, '应校正到 remotePosition');
    assert.ok(engine.guardUntil > before, '校正时应设置 guardUntil');
  });

  test('14. handle("drift_response") 偏差 <= 阈值时不校正', () => {
    video.currentTime = 50;
    engine.handle({ type: 'drift_response', remotePosition: 50.3, myPosition: 50 });
    assert.strictEqual(video.currentTime, 50, '偏差 0.3 <= 0.5，不应校正');
  });
});

describe('SyncEngine.handle file_info', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo({ duration: 100 });
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('15. handle("file_info") duration 不一致发警告（mock toast）', () => {
    let toastCalled = false;
    let toastMsg = '';
    engine._toast = (msg) => { toastCalled = true; toastMsg = msg; };

    engine.handle({ type: 'file_info', duration: 200 });
    assert.ok(toastCalled, '应调用 _toast');
    assert.ok(toastMsg.includes('不一致'), '消息应包含"不一致"');
  });

  test('16. handle("file_info") duration 一致时调用 toast（文件校验通过）', () => {
    let toastMsg = '';
    engine._toast = (msg) => { toastMsg = msg; };

    engine.handle({ type: 'file_info', duration: 100 });
    assert.ok(toastMsg.includes('校验通过'), '时长一致时应提示"校验通过"');
  });
});

describe('SyncEngine.maybeSend', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo({ currentTime: 42, duration: 100 });
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('17. maybeSend("play") guardUntil 期内不发', () => {
    engine.guardUntil = Date.now() + 10000; // 未来 10 秒
    engine.maybeSend('play');
    assert.strictEqual(send.calls.length, 0, 'guardUntil 期内不应发送');
  });

  test('18. maybeSend("play") 过期后正常发送', () => {
    engine.guardUntil = Date.now() - 1; // 已过期
    engine.maybeSend('play');
    assert.strictEqual(send.calls.length, 1);
    assert.strictEqual(send.calls[0].type, 'play');
  });

  test('19. maybeSend("play") 发送的消息包含 currentTime 和时间戳', () => {
    engine.guardUntil = Date.now() - 1;
    engine.maybeSend('play');
    assert.strictEqual(send.calls[0].position, 42);
    assert.ok('t' in send.calls[0], '应包含时间戳 t');
  });
});

describe('SyncEngine.start / stop', () => {
  test('20. start() 启动 heartbeat 和 drift 定时器', () => {
    const video = createMockVideo({ paused: false });
    const send = createMockSend();
    const engine = makeEngine(video, send, {
      HEARTBEAT_INTERVAL_MS: 50,
      DRIFT_CHECK_INTERVAL_MS: 50,
    });

    engine.start();
    assert.ok(engine.heartbeatTimer !== null, 'heartbeatTimer 应已设置');
    assert.ok(engine.driftTimer !== null, 'driftTimer 应已设置');

    engine.stop();
  });

  test('21. stop() 清除定时器', () => {
    const video = createMockVideo({ paused: false });
    const send = createMockSend();
    const engine = makeEngine(video, send, {
      HEARTBEAT_INTERVAL_MS: 50,
      DRIFT_CHECK_INTERVAL_MS: 50,
    });

    engine.start();
    engine.stop();
    assert.strictEqual(engine.heartbeatTimer, null);
    assert.strictEqual(engine.driftTimer, null);
  });

  test('22. start() 后 stop() 定时器已清理', () => {
    const video = createMockVideo({ paused: false });
    const send = createMockSend();
    const engine = makeEngine(video, send, {
      HEARTBEAT_INTERVAL_MS: 20,
      DRIFT_CHECK_INTERVAL_MS: 20,
    });

    engine.start();
    // 等待一小段时间确保 interval 已触发
    return new Promise(resolve => setTimeout(() => {
      engine.stop();
      assert.strictEqual(engine.heartbeatTimer, null);
      assert.strictEqual(engine.driftTimer, null);
      resolve();
    }, 30));
  });
});

describe('SyncEngine.handle edge cases', () => {
  let video, send, engine;
  beforeEach(() => {
    video = createMockVideo();
    send = createMockSend();
    engine = makeEngine(video, send);
  });

  test('23. handle(null) 不崩溃', () => {
    assert.doesNotThrow(() => engine.handle(null), 'handle(null) 不应抛出异常');
  });

  test('24. handle({ type: "unknown" }) 不崩溃', () => {
    assert.doesNotThrow(() => engine.handle({ type: 'unknown' }), '未知类型不应抛出异常');
    assert.strictEqual(send.calls.length, 0, '未知类型不应触发发送');
  });

  test('25. 异常消息类型防御（type 不是字符串、缺字段等）', () => {
    // type 为 undefined
    assert.doesNotThrow(() => engine.handle({}), '空对象不应崩溃');
    // type 为数字
    assert.doesNotThrow(() => engine.handle({ type: 123 }), '数字 type 不应崩溃');
    // 缺少 type
    assert.doesNotThrow(() => engine.handle({ position: 5 }), '无 type 不应崩溃');
    // heartbeat_pong 缺 origT
    assert.doesNotThrow(() => engine.handle({ type: 'heartbeat_pong' }), '缺字段不崩溃');
    // drift_response 缺字段
    assert.doesNotThrow(() => engine.handle({ type: 'drift_response' }), 'drift_response 缺字段不崩溃');
    // file_info 缺 duration
    assert.doesNotThrow(() => engine.handle({ type: 'file_info' }), 'file_info 缺 duration 不崩溃');
  });
});

describe('SyncEngine video event binding', () => {
  test('bindVideoEvents 注册了 play/pause/seek 监听', () => {
    const video = createMockVideo({ currentTime: 10, duration: 100 });
    const send = createMockSend();
    const engine = makeEngine(video, send);
    send.clear();

    // 触发 video play 事件
    video._emit('play');
    assert.strictEqual(send.calls.length, 1);
    assert.strictEqual(send.calls[0].type, 'play');

    send.clear();
    video._emit('pause');
    assert.strictEqual(send.calls.length, 1);
    assert.strictEqual(send.calls[0].type, 'pause');

    send.clear();
    video._emit('seeked');
    assert.strictEqual(send.calls.length, 1);
    assert.strictEqual(send.calls[0].type, 'seek');
  });

  test('guardUntil 屏蔽期内视频事件不上报', () => {
    const video = createMockVideo({ currentTime: 10, duration: 100 });
    const send = createMockSend();
    const engine = makeEngine(video, send);
    engine.guardUntil = Date.now() + 10000;
    send.clear();

    video._emit('play');
    assert.strictEqual(send.calls.length, 0, 'guardUntil 期内 play 事件不上报');
  });

  test('unbindVideoEvents 解绑后视频事件不上报 (幂等)', () => {
    const video = createMockVideo({ currentTime: 10, duration: 100 });
    const send = createMockSend();
    const engine = makeEngine(video, send);

    // 解绑前: 触发 play 应该 send
    send.clear();
    video._emit('play');
    assert.strictEqual(send.calls.length, 1, '解绑前 play 事件应 send');

    // 解绑
    engine.unbindVideoEvents();
    send.clear();

    // 解绑后: 触发 play/pause/seeked 都不应 send
    video._emit('play');
    video._emit('pause');
    video._emit('seeked');
    assert.strictEqual(send.calls.length, 0, '解绑后 play/pause/seeked 都不应 send');

    // 幂等: 重复调用不报错
    assert.doesNotThrow(() => engine.unbindVideoEvents(), 'unbindVideoEvents 重复调用不报错');
  });

  test('bind/unbind 反复调用不会累积 listener (v0.6.2 fix 防 listener 累积)', () => {
    const video = createMockVideo({ currentTime: 10, duration: 100 });
    const send = createMockSend();
    const engine = makeEngine(video, send);

    // 模拟反复进房: bind → unbind → bind → unbind 多次
    for (let i = 0; i < 5; i++) {
      engine.unbindVideoEvents();
      engine.bindVideoEvents();
    }

    send.clear();
    video._emit('play');
    // 应该有且仅有 1 次 send (而不是 6 次累积)
    assert.strictEqual(send.calls.length, 1, 'bind/unbind 反复后 play 事件应只 send 1 次 (不累积)');
  });
});

describe('DEFAULT_CONFIG', () => {
  test('DEFAULT_CONFIG 包含所有同步相关参数', () => {
    assert.strictEqual(DEFAULT_CONFIG.DRIFT_CHECK_INTERVAL_MS, 10000);
    assert.strictEqual(DEFAULT_CONFIG.DRIFT_THRESHOLD_SEC, 0.5);
    assert.strictEqual(DEFAULT_CONFIG.HEARTBEAT_INTERVAL_MS, 5000);
    assert.strictEqual(DEFAULT_CONFIG.GUARD_WINDOW_MS, 200);
  });
});
