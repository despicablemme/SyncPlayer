// SyncPlay - 房间状态机 (v0.6 FR-3)
// 6 态: no_room / connecting / in_room_no_video / in_room_waiting_peer_video /
//       in_room_synced / in_room_mismatch
//
// 设计目标: 房间生命周期(创建/进入/退出) 跟视频加载解耦.
// 同步指令(sync engine) 只在 in_room_synced 时启动, 其他状态都关闭.
//
// 浏览器通过 window.SyncPlayRoomState 使用, Node 测试通过 require 使用.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SyncPlayRoomState = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============ 状态常量 ============
  const STATES = Object.freeze({
    NO_ROOM: 'no_room',
    CONNECTING: 'connecting',
    IN_ROOM_NO_VIDEO: 'in_room_no_video',
    IN_ROOM_WAITING_PEER_VIDEO: 'in_room_waiting_peer_video',
    IN_ROOM_SYNCED: 'in_room_synced',
    IN_ROOM_MISMATCH: 'in_room_mismatch',
  });

  // ============ 合法转移图 ============
  // 说明:
  //   - 任意 in_room_* 状态都能 → connecting (peer lost, 等待重连)
  //   - 任意状态都能 → no_room (用户点"退出房间")
  //   - video 子状态间转移: loaded/peer_loaded/match 三维
  const TRANSITIONS = Object.freeze({
    no_room:                       ['connecting'],
    connecting:                    ['in_room_no_video', 'in_room_waiting_peer_video', 'in_room_synced', 'in_room_mismatch', 'no_room'],
    in_room_no_video:              ['in_room_waiting_peer_video', 'in_room_synced', 'in_room_mismatch', 'connecting', 'no_room'],
    in_room_waiting_peer_video:    ['in_room_synced', 'in_room_mismatch', 'in_room_no_video', 'connecting', 'no_room'],
    in_room_synced:                ['in_room_mismatch', 'in_room_waiting_peer_video', 'in_room_no_video', 'connecting', 'no_room'],
    in_room_mismatch:              ['in_room_synced', 'in_room_waiting_peer_video', 'in_room_no_video', 'connecting', 'no_room'],
  });

  // ============ RoomStateMachine ============

  class RoomStateMachine {
    constructor() {
      this._state = STATES.NO_ROOM;
      this._listeners = [];
    }

    /** 当前状态 */
    get state() {
      return this._state;
    }

    /** 判断是否处于某状态 (单参数形式) */
    is(state) {
      return this._state === state;
    }

    /**
     * 状态转移
     * @param {string} next 目标状态 (STATES.*)
     * @returns {boolean} 是否真的发生了转移 (true = 成功, false = 非法或相同状态)
     */
    setState(next) {
      if (this._state === next) return false;
      const allowed = TRANSITIONS[this._state] || [];
      if (!allowed.includes(next)) {
        // 静默忽略非法转移; 调用方可以监听 state 自行检查
        if (typeof console !== 'undefined') {
          console.warn(`[room-state] illegal transition: ${this._state} -> ${next}`);
        }
        return false;
      }
      const prev = this._state;
      this._state = next;
      for (const fn of this._listeners) {
        try { fn(next, prev); } catch (e) {
          if (typeof console !== 'undefined') console.error('[room-state] listener error', e);
        }
      }
      return true;
    }

    /**
     * 强制设状态 (不走 TRANSITIONS 校验, 用于测试 / 错误恢复)
     * 不触发任何 listener.
     */
    _forceState(next) {
      this._state = next;
    }

    /**
     * 订阅状态变化
     * @param {(newState: string, oldState: string) => void} fn
     * @returns {() => void} 取消订阅的函数
     */
    onStateChange(fn) {
      this._listeners.push(fn);
      return () => {
        this._listeners = this._listeners.filter(f => f !== fn);
      };
    }

    /** 同步引擎是否应该运行 (只有 synced 才发送 play/pause/seek/heartbeat/drift) */
    canSync() {
      return this._state === STATES.IN_ROOM_SYNCED;
    }
  }

  return { STATES, TRANSITIONS, RoomStateMachine };
}));
