#!/usr/bin/env node
/**
 * SyncPlay 集成测试
 *
 * 测试场景：
 * 1. 启动 HTTP 静态文件服务器（client/ -> :8080）
 * 2. 启动 Playwright 浏览器实例（user A / user B）
 * 3. 加载视频 -> 创建房间 -> 加入房间
 * 4. 尝试建立 PeerJS WebRTC 连接
 * 5. 如果连接成功，测试播放/暂停/跳转同步
 *
 * 注意：WebRTC 在同一机器的两个 Playwright 实例之间可能因 NAT/防火墙
 * 或 Chrome 安全策略而无法建立连接。这是环境限制，不是代码 bug。
 */

const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(PROJECT_ROOT, 'client');
const SERVER_DIR = path.join(PROJECT_ROOT, 'server');
// WEB_ROOT: HTTP 服务根目录设到 src/ 顶层,这样 ../shared/ 能服务
const WEB_ROOT = path.join(PROJECT_ROOT, 'src');
const TEST_VIDEO = path.join(CLIENT_DIR, 'test-video.mp4');

const HTTP_PORT = 8080;

let httpServer = null;
let browser = null;

const results = {
  passed: [],
  failed: [],
};

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

/** 启动 HTTP 静态文件服务器(根目录为 src/ 顶层) */
function startHttpServer() {
  return new Promise((resolve, reject) => {
    httpServer = spawn('python3', ['-m', 'http.server', String(HTTP_PORT)], {
      cwd: WEB_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    httpServer.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s) console.log(`  [httpd] ${s}`);
    });

    setTimeout(() => {
      log(`HTTP 服务器已启动 (port ${HTTP_PORT}, root: ${WEB_ROOT})`);
      resolve();
    }, 1000);

    httpServer.on('error', reject);
  });
}

/** 关闭所有子进程 */
function cleanup() {
  log('清理子进程...');
  if (httpServer) { httpServer.kill(); httpServer = null; }
  if (browser) { browser.close().catch(() => {}); browser = null; }
}

/** 等待元素可见 */
async function waitForVisible(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/** 加载视频文件（用 setInputFiles） */
async function loadVideo(page, videoPath) {
  const input = await page.$('#videoInput');
  if (!input) throw new Error('找不到 #videoInput');

  await input.setInputFiles(videoPath);
  await waitForVisible(page, '#video', 10000);

  await page.evaluate(() => {
    return new Promise((res) => {
      const v = document.getElementById('video');
      if (v.readyState >= 1) { res(); return; }
      v.addEventListener('loadedmetadata', res, { once: true });
    });
  });

  log(`视频已加载: ${path.basename(videoPath)}`);
}

/** 截图 */
async function screenshot(page, label) {
  const filename = `/tmp/syncplay-test-${label}-${Date.now()}.png`;
  try {
    await page.screenshot({ path: filename, fullPage: true });
    log(`截图已保存: ${filename}`);
  } catch (e) {
    log(`截图失败: ${e.message}`, 'WARN');
  }
  return filename;
}

/** 获取视频状态 */
async function getVideoState(page) {
  return page.evaluate(() => {
    const v = document.getElementById('video');
    return { paused: v.paused, currentTime: v.currentTime, readyState: v.readyState };
  });
}

// =====================================================================
// 主测试流程
// =====================================================================

async function runTest() {
  console.log('\n========================================');
  console.log('  SyncPlay 集成测试');
  console.log('========================================\n');

  // ---- 0. 前置检查 ----
  try {
    execSync('lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true');
  } catch (e) {}

  if (!fs.existsSync(TEST_VIDEO)) {
    throw new Error(`测试视频不存在: ${TEST_VIDEO}`);
  }
  log(`测试视频: ${TEST_VIDEO}`);

  // ---- 1. 启动 HTTP 服务器 ----
  log('启动服务...');
  await startHttpServer();

  // ---- 2. 启动 Playwright ----
  log('启动 Playwright...');

  const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const consoleLogsA = [], consoleLogsB = [];
  pageA.on('console', m => {
    if (m.type() === 'error') consoleLogsA.push(m.text());
  });
  pageB.on('console', m => {
    if (m.type() === 'error') consoleLogsB.push(m.text());
  });

  // ---- 3. 加载页面 ----
  log('用户A 加载页面...');
  await pageA.goto(`http://localhost:${HTTP_PORT}/client/index.html`, { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2000); // 等待 PeerJS CDN 加载

  log('用户B 加载页面...');
  await pageB.goto(`http://localhost:${HTTP_PORT}/client/index.html`, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(2000);

  // ---- 4. 加载视频（在创建/加入房间之前） ----
  log('用户A 加载视频...');
  await loadVideo(pageA, TEST_VIDEO);

  log('用户B 加载视频...');
  await loadVideo(pageB, TEST_VIDEO);

  // ---- 5. 用户A 创建房间 ----
  log('用户A 创建房间...');
  await pageA.click('#createBtn');

  let roomId = null;
  for (let i = 0; i < 8; i++) {
    await pageA.waitForTimeout(2000);
    const currentRoomId = await pageA.$eval('#myRoomId', el => el.textContent.trim()).catch(() => '');
    if (currentRoomId.startsWith('room-')) {
      roomId = currentRoomId;
      break;
    }
  }

  if (!roomId) {
    await screenshot(pageA, 'A-create-room-fail');
    const localStatus = await pageA.$eval('#localStatus', el => el.textContent).catch(() => 'N/A');
    fail('创建房间并获取房间号', `超时，localStatus=${localStatus}`);
  } else {
    pass('创建房间并获取房间号');
  }

  // ---- 6. 用户B 加入房间 ----
  log(`用户B 加入房间 ${roomId}...`);
  await pageB.fill('#roomIdInput', roomId);
  await pageB.click('#joinBtn');

  // ---- 7. 等待双方连接 ----
  log('等待双方连接（最多 20s）...');

  let connectedA = false, connectedB = false;
  const startTime = Date.now();

  for (let i = 0; i < 20; i++) {
    await pageA.waitForTimeout(1000);

    if (!connectedA) {
      const statusA = await pageA.evaluate(() => document.getElementById('remoteStatus')?.textContent || '');
      if (statusA.includes('已连接')) {
        connectedA = true;
        log(`  用户A: remoteStatus=已连接 ✅`);
      }
    }

    if (!connectedB) {
      const statusB = await pageB.evaluate(() => document.getElementById('remoteStatus')?.textContent || '');
      if (statusB.includes('已连接')) {
        connectedB = true;
        log(`  用户B: remoteStatus=已连接 ✅`);
      }
    }

    if (connectedA && connectedB) break;

    if (i % 5 === 4) {
      const sA = await pageA.evaluate(() => ({
        local: document.getElementById('localStatus')?.textContent,
        remote: document.getElementById('remoteStatus')?.textContent,
      })).catch(() => ({}));
      const sB = await pageB.evaluate(() => ({
        local: document.getElementById('localStatus')?.textContent,
        remote: document.getElementById('remoteStatus')?.textContent,
      })).catch(() => ({}));
      log(`  [${i+1}s] A: ${JSON.stringify(sA)} B: ${JSON.stringify(sB)}`);
    }
  }

  if (connectedA && connectedB) {
    pass('双方建立连接');
  } else {
    const sA = await pageA.evaluate(() => ({
      local: document.getElementById('localStatus')?.textContent,
      remote: document.getElementById('remoteStatus')?.textContent,
    })).catch(() => ({}));
    const sB = await pageB.evaluate(() => ({
      local: document.getElementById('localStatus')?.textContent,
      remote: document.getElementById('remoteStatus')?.textContent,
    })).catch(() => ({}));
    await screenshot(pageA, 'A-connection-fail');
    await screenshot(pageB, 'B-connection-fail');

    const reason = `WebRTC P2P 连接未建立（A: ${JSON.stringify(sA)}, B: ${JSON.stringify(sB)}）。` +
      `这在某些 CI/网络环境下是已知限制。`;
    fail('双方建立连接', reason);

    // 即便连接失败，仍尝试测试（可能连接了但状态未更新）
    log('仍尝试测试同步功能（连接可能已建立但状态未更新）...', 'WARN');
  }

  // ---- 8. 测试播放同步 ----
  log('\n--- 测试 1: 播放同步 ---');

  const stateBBeforePlay = await getVideoState(pageB);
  log(`B 播放前状态: paused=${stateBBeforePlay.paused}`);

  log('A 执行 video.play()...');
  await pageA.evaluate(() => document.getElementById('video').play().catch(e => console.error(e)));
  await pageA.waitForTimeout(2000);

  const stateBAfterPlay = await getVideoState(pageB);
  log(`B 播放后状态: paused=${stateBAfterPlay.paused}, currentTime=${stateBAfterPlay.currentTime.toFixed(2)}`);

  if (!stateBAfterPlay.paused && stateBAfterPlay.currentTime > 0) {
    pass('播放同步 (A.play() → B 播放)');
  } else {
    fail('播放同步 (A.play() → B 播放)', `B 的 paused=${stateBAfterPlay.paused}, currentTime=${stateBAfterPlay.currentTime}`);
  }

  // ---- 9. 测试跳转同步 ----
  log('\n--- 测试 2: 跳转同步 ---');

  const seekTarget = 5.0;
  log(`A 设置 video.currentTime = ${seekTarget}...`);
  await pageA.evaluate((t) => {
    document.getElementById('video').currentTime = t;
  }, seekTarget);

  await pageA.waitForTimeout(1500);

  const stateBAfterSeek = await getVideoState(pageB);
  const seekError = Math.abs(stateBAfterSeek.currentTime - seekTarget);
  log(`B 跳转后 currentTime=${stateBAfterSeek.currentTime.toFixed(2)}, 误差=${seekError.toFixed(2)}s`);

  if (seekError < 1.0) {
    pass(`跳转同步 (A.seek(${seekTarget}) → B.currentTime≈${seekTarget}, 误差${seekError.toFixed(2)}s < 1s)`);
  } else {
    fail(`跳转同步 (A.seek(${seekTarget}) → B.currentTime≈${seekTarget})`, `误差 ${seekError.toFixed(2)}s 超过 1s`);
  }

  // ---- 10. 测试暂停同步 ----
  log('\n--- 测试 3: 暂停同步 ---');

  log('A 执行 video.pause()...');
  await pageA.evaluate(() => document.getElementById('video').pause());
  await pageA.waitForTimeout(1500);

  const stateBAfterPause = await getVideoState(pageB);
  log(`B 暂停后状态: paused=${stateBAfterPause.paused}`);

  if (stateBAfterPause.paused) {
    pass('暂停同步 (A.pause() → B 暂停)');
  } else {
    fail('暂停同步 (A.pause() → B 暂停)', `B 的 paused=${stateBAfterPause.paused}`);
  }

  // ---- 11. 清理 + 报告 ----
  await browser.close();
  cleanup();

  console.log('\n========================================');
  console.log('  测试报告');
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

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

// =====================================================================

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('exit', () => cleanup());

runTest().then(() => {
  log('测试完成');
  process.exit(0);
}).catch((err) => {
  log(`测试异常: ${err.message}`, 'ERROR');
  console.error(err);
  cleanup();
  process.exit(1);
});
