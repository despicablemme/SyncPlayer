#!/usr/bin/env node
/**
 * SyncPlay 视频历史记录 E2E 测试 (v0.6.1 FR-4)
 *
 * 场景: 启动 desktop app → 加视频到历史 → 关闭 app → 重启 app → 验证历史还在
 *
 * 用法:
 *   node test/e2e/video-history.js
 *   npm run test:e2e:history
 *
 * 关键:
 * - 用 _electron (Playwright Electron API) 跑真实 desktop app
 * - 用 --user-data-dir Chromium flag 隔离 userData 到 /tmp
 * - 不需要真实视频文件: 通过 IPC 直接 add url 类型的 history item
 * - 跑完 rmSync 临时 userData, 不留垃圾
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_JS = path.join(PROJECT_ROOT, 'desktop', 'main.js');
// electron 装在 desktop/node_modules/electron; 真实二进制在 dist/<path.txt> 下
const ELECTRON_PKG = path.join(PROJECT_ROOT, 'desktop', 'node_modules', 'electron');
const ELECTRON_BIN = path.join(
  ELECTRON_PKG, 'dist',
  fs.readFileSync(path.join(ELECTRON_PKG, 'path.txt'), 'utf8').trim()
);

// main.js 在 dev 模式下从 desktop/src/client/index.html 加载 (这是 prebuild 产物),
// 但 desktop/src/ 是 git-ignored 的预构建目录, 默认情况下可能过期/不存在.
// 在跑 e2e 之前, 先跑 prebuild 把最新 src/ 复制到 desktop/src/, 保证 renderer 用最新代码.
const { execSync } = require('child_process');
try {
  log('步骤 0: 跑 desktop prebuild (复制 src/ → desktop/src/, 让 main.js 加载最新 UI)...');
  execSync('npm run prebuild', { cwd: path.join(PROJECT_ROOT, 'desktop'), stdio: 'pipe' });
  log('  prebuild 完成 ✅');
} catch (e) {
  log(`  prebuild 失败 (继续跑, UI 元素可能不在): ${e.message}`, 'WARN');
}

const results = { passed: [], failed: [] };

function log(msg, level = 'INFO') {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${ts}] [${level}] ${msg}`);
}

function pass(name) {
  results.passed.push(name);
  console.log(`  ✅ PASS: ${name}`);
}

function fail(name, reason) {
  results.failed.push({ name, reason });
  console.log(`  ❌ FAIL: ${name} — ${reason}`);
}

/** 启动 Electron app, userData 隔离到给定目录 */
async function launchApp(userDataDir) {
  return await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [
      MAIN_JS,
      `--user-data-dir=${userDataDir}`,
      '--no-sandbox', // CI / 沙箱环境
    ],
    timeout: 30000, // 30s, 真实 Electron 启动较慢
  });
}

/** 等到 desktopAPI 在 renderer 注入完成 */
async function waitForDesktopAPI(window) {
  await window.waitForFunction(
    () => !!(window).desktopAPI && !!(window).desktopAPI.videoHistory,
    null,
    { timeout: 15000 }
  );
}

async function runTest() {
  console.log('\n========================================');
  console.log('  SyncPlay 视频历史 E2E (v0.6.1)');
  console.log('========================================\n');

  // ---- 0. 前置检查 ----
  if (!fs.existsSync(MAIN_JS)) {
    throw new Error(`main.js 不存在: ${MAIN_JS}`);
  }
  log(`主进程: ${MAIN_JS}`);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncplay-vh-e2e-'));
  log(`userData 隔离目录: ${userDataDir}`);

  let app1 = null, app2 = null;
  let finalItems = null;

  try {
    // ---- 1. 第一次启动 ----
    log('步骤 1: 启动 SyncPlay desktop app (第 1 次)...');
    app1 = await launchApp(userDataDir);
    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    log('  窗口已创建, 等 desktopAPI 就绪...');
    await waitForDesktopAPI(window1);
    log('  desktopAPI.videoHistory 就绪 ✅');

    // ---- 2. 加 2 条历史 (1 local + 1 url) ----
    log('步骤 2: 加 2 条历史 (1 local + 1 url)...');

    // local item: 用一个真实存在的文件路径 (test-video.mp4), 让 checkExists 通过
    const realFile = path.join(PROJECT_ROOT, 'src', 'client', 'test-video.mp4');
    assertExistence(realFile, 'test-video.mp4');

    const localItem = {
      type: 'local',
      path: realFile,
      name: 'test-video.mp4',
      size: fs.statSync(realFile).size,
      mtime: fs.statSync(realFile).mtimeMs,
      addedAt: 1000,
    };

    const urlItem = {
      type: 'url',
      url: 'https://example.com/persist-test.mp4',
      title: 'persist-test.mp4',
      addedAt: 2000,
    };

    const addResults = await window1.evaluate(async ({ local, url }) => {
      const r1 = await window.desktopAPI.videoHistory.add(local);
      const r2 = await window.desktopAPI.videoHistory.add(url);
      return { afterLocal: r1.length, afterUrl: r2.length, items: r2 };
    }, { local: localItem, url: urlItem });

    log(`  加后 store.length: local=${addResults.afterLocal}, url=${addResults.afterUrl}`);
    if (addResults.afterLocal !== 1 || addResults.afterUrl !== 2) {
      fail('添加历史', `期望 1 → 2, 实际 ${addResults.afterLocal} → ${addResults.afterUrl}`);
    } else {
      pass('添加历史 (1 local + 1 url, store 累加到 2)');
    }

    // 验证 add 后立即 get 能看到
    const getAfterAdd = await window1.evaluate(async () => {
      return await window.desktopAPI.videoHistory.get();
    });
    if (getAfterAdd.length === 2 &&
        getAfterAdd[0].url === urlItem.url &&
        getAfterAdd[1].path === localItem.path) {
      pass('添加后立即 get() 能读到 2 条 (倒序)');
    } else {
      fail('添加后立即 get()', `get 出来 ${JSON.stringify(getAfterAdd)}`);
    }

    // 验证 checkExists 对真实文件返 true
    const checkExistsReal = await window1.evaluate(async (p) => {
      return await window.desktopAPI.videoHistory.checkExists(p);
    }, realFile);
    if (checkExistsReal === true) {
      pass('checkExists(真实文件) 返 true');
    } else {
      fail('checkExists(真实文件)', `期望 true, 实际 ${checkExistsReal}`);
    }

    // 验证 checkExists 对不存在文件返 false
    const checkExistsGhost = await window1.evaluate(async () => {
      return await window.desktopAPI.videoHistory.checkExists('/nonexistent/ghost-12345.mp4');
    });
    if (checkExistsGhost === false) {
      pass('checkExists(不存在文件) 返 false');
    } else {
      fail('checkExists(不存在文件)', `期望 false, 实际 ${checkExistsGhost}`);
    }

    // ---- 3. 关闭 app ----
    log('步骤 3: 关闭 app (第 1 次)...');
    await app1.close();
    app1 = null;
    log('  app 已关闭');

    // 验证 JSON 文件已落盘
    const jsonPath = path.join(userDataDir, 'video-history.json');
    if (fs.existsSync(jsonPath)) {
      const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (content.items && content.items.length === 2) {
        pass('关闭后 JSON 文件落盘 + 2 条数据');
      } else {
        fail('关闭后 JSON 文件', `items 长度 ${content.items?.length}, 期望 2`);
      }
    } else {
      fail('关闭后 JSON 文件', `${jsonPath} 不存在`);
    }

    // ---- 4. 重启 app (用同一 userDataDir) ----
    log('步骤 4: 重新启动 SyncPlay desktop app (第 2 次, 同一 userData)...');
    app2 = await launchApp(userDataDir);
    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await waitForDesktopAPI(window2);
    log('  窗口已创建, desktopAPI 就绪');

    // ---- 5. 验证历史还在 ----
    log('步骤 5: 验证历史持久化 (重启后 get 应返回 2 条)...');
    const itemsAfterRestart = await window2.evaluate(async () => {
      return await window.desktopAPI.videoHistory.get();
    });
    finalItems = itemsAfterRestart;

    if (!Array.isArray(itemsAfterRestart)) {
      fail('重启后 get()', '返回值不是数组');
    } else if (itemsAfterRestart.length !== 2) {
      fail('重启后 get() 长度', `期望 2, 实际 ${itemsAfterRestart.length}`);
    } else {
      pass('重启后 get() 长度 = 2');
    }

    // 验证内容 (倒序: url 在前, local 在后)
    if (itemsAfterRestart[0]?.type === 'url' &&
        itemsAfterRestart[0]?.url === urlItem.url &&
        itemsAfterRestart[0]?.title === urlItem.title) {
      pass('重启后 url item 字段完整 + 顺序正确 (在第 0 位)');
    } else {
      fail('重启后 url item', JSON.stringify(itemsAfterRestart[0]));
    }

    if (itemsAfterRestart[1]?.type === 'local' &&
        itemsAfterRestart[1]?.path === localItem.path &&
        itemsAfterRestart[1]?.name === localItem.name) {
      pass('重启后 local item 字段完整 + 顺序正确 (在第 1 位)');
    } else {
      fail('重启后 local item', JSON.stringify(itemsAfterRestart[1]));
    }

    // 验证 renderer UI 加载历史 (📜 历史 按钮显示 count=2, 列表展开后看到 2 条)
    // 渲染端 setupHistoryUI() 在 DOMContentLoaded 时调 videoHistory.refresh() (async),
    // 需要等 IPC get() roundtrip + render() 把 countEl.textContent 设上
    try {
      await window2.waitForFunction(
        () => {
          const el = document.getElementById('videoHistoryCount');
          return el && el.textContent === '2';
        },
        null,
        { timeout: 10000 }
      );
      pass('重启后 UI 历史按钮 count = 2 (renderer 渲染完毕)');
    } catch (e) {
      const got = await window2.evaluate(() => document.getElementById('videoHistoryCount')?.textContent || '');
      fail('重启后 UI 历史按钮 count', `期望 "2" (10s 内), 实际 "${got}"`);
    }

    // ---- 6. 测试持久化的历史能正常删除 (功能性 spot check) ----
    log('步骤 6: 在第 2 次启动里, 测试 remove / clear 仍能工作...');

    // 6.1 remove url item
    const afterRemove = await window2.evaluate(async (addedAt) => {
      const r = await window.desktopAPI.videoHistory.remove(addedAt);
      return r;
    }, urlItem.addedAt);
    if (afterRemove.length === 1 && afterRemove[0].type === 'local') {
      pass('重启后 remove(url.addedAt) 删 1 条, 剩 1 条 local');
    } else {
      fail('重启后 remove()', JSON.stringify(afterRemove));
    }

    // 6.2 重新加 url, 然后 clear
    await window2.evaluate(async (url) => {
      await window.desktopAPI.videoHistory.add(url);
    }, urlItem);
    const afterClear = await window2.evaluate(async () => {
      return await window.desktopAPI.videoHistory.clear();
    });
    if (afterClear.length === 0) {
      pass('重启后 clear() 清空所有');
    } else {
      fail('重启后 clear()', `期望 [], 实际长度 ${afterClear.length}`);
    }

    // ---- 7. 关闭 ----
    log('步骤 7: 关闭 app (第 2 次)...');
    await app2.close();
    app2 = null;
  } catch (e) {
    log(`测试异常: ${e.message}`, 'ERROR');
    console.error(e);
    if (app1) try { await app1.close(); } catch {}
    if (app2) try { await app2.close(); } catch {}
    fail('测试执行', e.message);
  } finally {
    // ---- 8. 清理 ----
    log('步骤 8: 清理临时 userData 目录...');
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      log(`  已删除: ${userDataDir}`);
    } catch (e) {
      log(`  清理失败: ${e.message}`, 'WARN');
    }
  }

  // ---- 报告 ----
  console.log('\n========================================');
  console.log('  E2E 测试报告');
  console.log('========================================');
  console.log(`  ✅ 通过: ${results.passed.length}`);
  console.log(`  ❌ 失败: ${results.failed.length}`);

  if (results.passed.length > 0) {
    console.log('\n  通过场景:');
    results.passed.forEach(n => console.log(`    ✅ ${n}`));
  }
  if (results.failed.length > 0) {
    console.log('\n  失败场景:');
    results.failed.forEach(f => console.log(`    ❌ ${f.name}: ${f.reason}`));
  }
  console.log('\n========================================\n');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

function assertExistence(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`${label} 不存在: ${p}`);
  }
}

process.on('SIGINT', () => { process.exit(1); });

runTest().catch((err) => {
  log(`未捕获异常: ${err.message}`, 'ERROR');
  console.error(err);
  process.exit(1);
});
