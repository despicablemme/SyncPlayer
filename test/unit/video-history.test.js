'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// electron-store 必须从 desktop/node_modules 取 (主进程依赖)
const Store = require(path.join(__dirname, '..', '..', 'desktop', 'node_modules', 'electron-store'));

const MAX_HISTORY = 20;

// 用临时目录避免污染真实 userData
function createTempStore() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncplay-vh-test-'));
  const store = new Store({
    name: 'video-history',
    cwd: tmpDir,
    defaults: { items: [] },
  });
  return { store, tmpDir };
}

// 复制 main.js L160-177 的 IPC handler 纯逻辑 (用于单元测试, 不需要启动 electron)
function addItemLogic(store, item, max = MAX_HISTORY) {
  if (!item || !item.type) {
    throw new Error('video-history:add: item.type is required');
  }
  if (item.type !== 'local' && item.type !== 'url') {
    throw new Error(`video-history:add: unknown type ${item.type}`);
  }
  const items = store.get('items', []);
  const dedupeKey = item.type === 'local' ? `local:${item.path}` : `url:${item.url}`;
  const filtered = items.filter(existing => {
    const existingKey = existing.type === 'local' ? `local:${existing.path}` : `url:${existing.url}`;
    return existingKey !== dedupeKey;
  });
  filtered.unshift(item);
  const truncated = filtered.slice(0, max);
  store.set('items', truncated);
  return truncated;
}

// 复制 main.js L194-203 的 check-exists 纯逻辑
function checkExistsLogic(filePath) {
  if (typeof filePath !== 'string') {
    return false;
  }
  try {
    return fs.existsSync(filePath);
  } catch (e) {
    return false;
  }
}

describe('video-history store - schema', () => {
  test('local item 完整字段: type/path/name/size/mtime/addedAt 全部保留', () => {
    const { store, tmpDir } = createTempStore();
    try {
      const item = {
        type: 'local',
        path: '/Users/bruce/Movies/test.mp4',
        name: 'test.mp4',
        size: 1234567,
        mtime: 1717987200000,
        addedAt: Date.now(),
      };
      store.set('items', [item]);
      const got = store.get('items', []);
      assert.strictEqual(got.length, 1);
      assert.strictEqual(got[0].type, 'local');
      assert.strictEqual(got[0].path, '/Users/bruce/Movies/test.mp4');
      assert.strictEqual(got[0].name, 'test.mp4');
      assert.strictEqual(got[0].size, 1234567);
      assert.strictEqual(got[0].mtime, 1717987200000);
      assert.strictEqual(typeof got[0].addedAt, 'number');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('url item 完整字段: type/url/title/addedAt 全部保留', () => {
    const { store, tmpDir } = createTempStore();
    try {
      const item = {
        type: 'url',
        url: 'https://example.com/video.mp4',
        title: 'video.mp4',
        addedAt: Date.now(),
      };
      store.set('items', [item]);
      const got = store.get('items', []);
      assert.strictEqual(got.length, 1);
      assert.strictEqual(got[0].type, 'url');
      assert.strictEqual(got[0].url, 'https://example.com/video.mp4');
      assert.strictEqual(got[0].title, 'video.mp4');
      assert.strictEqual(typeof got[0].addedAt, 'number');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('addItem 缺 type 字段应抛错 (per main.js L162 校验)', () => {
    const { store, tmpDir } = createTempStore();
    try {
      assert.throws(
        () => addItemLogic(store, { path: '/x.mp4', name: 'x.mp4', addedAt: 1 }),
        /item\.type is required/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('addItem 未知 type 应抛错 (per main.js L165 校验)', () => {
    const { store, tmpDir } = createTempStore();
    try {
      assert.throws(
        () => addItemLogic(store, { type: 'unknown', url: 'x', addedAt: 1 }),
        /unknown type unknown/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('video-history store - dedupe', () => {
  test('同 path 不重复 (local): 后加的覆盖前面的 (addedAt 更新)', () => {
    const { store, tmpDir } = createTempStore();
    try {
      const item1 = { type: 'local', path: '/a/b.mp4', name: 'b.mp4', size: 1, mtime: 1, addedAt: 1000 };
      const item2 = { type: 'local', path: '/a/b.mp4', name: 'b.mp4', size: 2, mtime: 2, addedAt: 2000 };
      addItemLogic(store, item1);
      addItemLogic(store, item2);
      const got = store.get('items', []);
      assert.strictEqual(got.length, 1, '同 path 应被 dedupe 掉');
      assert.strictEqual(got[0].addedAt, 2000, '后加的应保留 (updated)');
      assert.strictEqual(got[0].size, 2, '后加的 size 字段覆盖前面的');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('同 url 不重复 (url): 后加的覆盖前面的', () => {
    const { store, tmpDir } = createTempStore();
    try {
      const item1 = { type: 'url', url: 'https://x.com/v.mp4', title: 'v1', addedAt: 1000 };
      const item2 = { type: 'url', url: 'https://x.com/v.mp4', title: 'v2', addedAt: 2000 };
      addItemLogic(store, item1);
      addItemLogic(store, item2);
      const got = store.get('items', []);
      assert.strictEqual(got.length, 1);
      assert.strictEqual(got[0].addedAt, 2000);
      assert.strictEqual(got[0].title, 'v2', '后加的 title 覆盖前面的');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('local + url 用不同 dedupe key, 互不影响', () => {
    const { store, tmpDir } = createTempStore();
    try {
      // 即便 path 和 url 字符串相同, 因 type 不同, 不 dedupe
      addItemLogic(store, { type: 'local', path: '/x.mp4', name: 'x', addedAt: 1 });
      addItemLogic(store, { type: 'url', url: '/x.mp4', title: 'x', addedAt: 2 });
      const got = store.get('items', []);
      assert.strictEqual(got.length, 2, 'type 不同 → key 不同 → 不 dedupe');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('不同 path / url 不 dedupe (正常累加)', () => {
    const { store, tmpDir } = createTempStore();
    try {
      addItemLogic(store, { type: 'local', path: '/a.mp4', name: 'a', addedAt: 1 });
      addItemLogic(store, { type: 'local', path: '/b.mp4', name: 'b', addedAt: 2 });
      addItemLogic(store, { type: 'url', url: 'https://x.com/c', title: 'c', addedAt: 3 });
      addItemLogic(store, { type: 'url', url: 'https://x.com/d', title: 'd', addedAt: 4 });
      assert.strictEqual(store.get('items').length, 4);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('video-history store - 20 条上限 + 时间排序', () => {
  test('add 25 个不同 url, get 出来正好 20 条', () => {
    const { store, tmpDir } = createTempStore();
    try {
      for (let i = 0; i < 25; i++) {
        addItemLogic(store, {
          type: 'url',
          url: `https://example.com/${i}.mp4`,
          title: `${i}.mp4`,
          addedAt: i,
        });
      }
      const got = store.get('items', []);
      assert.strictEqual(got.length, 20, '应被截到 20 条');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('最新加的 (addedAt 最大) 排在最前 (LIFO + unshift)', () => {
    const { store, tmpDir } = createTempStore();
    try {
      for (let i = 0; i < 25; i++) {
        addItemLogic(store, {
          type: 'url',
          url: `https://example.com/${i}.mp4`,
          title: `${i}.mp4`,
          addedAt: i,
        });
      }
      const got = store.get('items', []);
      // 最后加的是 i=24, 应在 got[0]
      assert.strictEqual(got[0].url, 'https://example.com/24.mp4');
      // 最末尾应该是 i=5 (i=0~4 被截断)
      assert.strictEqual(got[19].url, 'https://example.com/5.mp4');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('恰好 20 条不被截, 21 条截到 20', () => {
    const { store, tmpDir } = createTempStore();
    try {
      for (let i = 0; i < 20; i++) {
        addItemLogic(store, { type: 'url', url: `https://x.com/${i}`, title: `${i}`, addedAt: i });
      }
      assert.strictEqual(store.get('items').length, 20);
      addItemLogic(store, { type: 'url', url: 'https://x.com/20', title: '20', addedAt: 20 });
      assert.strictEqual(store.get('items').length, 20);
      assert.strictEqual(store.get('items')[0].url, 'https://x.com/20');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('dedupe 命中后不增加 count, 不占用 20 槽位', () => {
    const { store, tmpDir } = createTempStore();
    try {
      // 加 19 条不同 url
      for (let i = 0; i < 19; i++) {
        addItemLogic(store, { type: 'url', url: `https://x.com/${i}`, title: `${i}`, addedAt: i });
      }
      // dedupe 一次 (同 url) → 仍 19 条
      addItemLogic(store, { type: 'url', url: 'https://x.com/0', title: '0-v2', addedAt: 100 });
      assert.strictEqual(store.get('items').length, 19);
      // 再加 1 条新的 → 应能加到 20
      addItemLogic(store, { type: 'url', url: 'https://x.com/new', title: 'new', addedAt: 101 });
      assert.strictEqual(store.get('items').length, 20);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('checkExists 边界 (per main.js L194-203)', () => {
  test('null 返回 false (不抛错)', () => {
    assert.strictEqual(checkExistsLogic(null), false);
  });

  test('undefined 返回 false (不抛错)', () => {
    assert.strictEqual(checkExistsLogic(undefined), false);
  });

  test('非字符串类型 (number/boolean/object) 返回 false', () => {
    assert.strictEqual(checkExistsLogic(123), false);
    assert.strictEqual(checkExistsLogic(true), false);
    assert.strictEqual(checkExistsLogic({}), false);
    assert.strictEqual(checkExistsLogic([]), false);
  });

  test('不存在的路径返回 false', () => {
    assert.strictEqual(checkExistsLogic('/nonexistent/path/12345.mp4'), false);
    assert.strictEqual(checkExistsLogic('/tmp/syncplay-no-such-file-98765.xyz'), false);
  });

  test('存在文件返回 true (用当前 test 文件本身验证)', () => {
    assert.strictEqual(checkExistsLogic(__filename), true);
  });

  test('空字符串返回 false (typeof === string 但不存在)', () => {
    assert.strictEqual(checkExistsLogic(''), false);
  });
});

describe('video-history store - 持久化 (electron-store 落盘行为)', () => {
  test('新 Store 实例 (同 cwd) 能读到之前 set 的数据', () => {
    const { store, tmpDir } = createTempStore();
    try {
      store.set('items', [
        { type: 'url', url: 'https://x.com/a', title: 'a', addedAt: 1 },
        { type: 'local', path: '/b.mp4', name: 'b', addedAt: 2 },
      ]);

      // 模拟 "关闭 app, 重启" 场景: 创建新 Store 实例
      const store2 = new Store({
        name: 'video-history',
        cwd: tmpDir,
        defaults: { items: [] },
      });
      const got = store2.get('items', []);
      assert.strictEqual(got.length, 2);
      assert.strictEqual(got[0].url, 'https://x.com/a');
      assert.strictEqual(got[1].path, '/b.mp4');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('JSON 文件结构 = { items: [...] }', () => {
    const { store, tmpDir } = createTempStore();
    try {
      store.set('items', [{ type: 'url', url: 'https://x.com/a', title: 'a', addedAt: 1 }]);
      // electron-store 8.x 路径: <cwd>/<name>.json
      const jsonPath = path.join(tmpDir, 'video-history.json');
      assert.ok(fs.existsSync(jsonPath), `JSON 文件应存在: ${jsonPath}`);
      const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      assert.ok(Array.isArray(content.items));
      assert.strictEqual(content.items.length, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('video-history store - remove + clear', () => {
  test('remove(addedAt) 按 addedAt 删单条, 其他保留', () => {
    const { store, tmpDir } = createTempStore();
    try {
      addItemLogic(store, { type: 'url', url: 'https://x.com/a', title: 'a', addedAt: 1 });
      addItemLogic(store, { type: 'url', url: 'https://x.com/b', title: 'b', addedAt: 2 });
      addItemLogic(store, { type: 'url', url: 'https://x.com/c', title: 'c', addedAt: 3 });

      // 复制 main.js L179-187 remove 逻辑
      const items = store.get('items', []);
      const filtered = items.filter(x => x.addedAt !== 2);
      store.set('items', filtered);

      const got = store.get('items');
      assert.strictEqual(got.length, 2);
      assert.ok(!got.find(x => x.addedAt === 2), 'addedAt=2 应被删');
      assert.ok(got.find(x => x.addedAt === 1), 'addedAt=1 应保留');
      assert.ok(got.find(x => x.addedAt === 3), 'addedAt=3 应保留');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('clear() 清空所有 items', () => {
    const { store, tmpDir } = createTempStore();
    try {
      addItemLogic(store, { type: 'url', url: 'https://x.com/a', title: 'a', addedAt: 1 });
      addItemLogic(store, { type: 'url', url: 'https://x.com/b', title: 'b', addedAt: 2 });
      assert.strictEqual(store.get('items').length, 2);
      // 复制 main.js L189-192 clear 逻辑
      store.set('items', []);
      assert.deepStrictEqual(store.get('items', []), []);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
