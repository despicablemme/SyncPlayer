#!/usr/bin/env node
/**
 * 回归测：点击"创建房间"后必须显示房间号 + Peer 连上信令
 *
 * 这个测试是为防 v0.2.0 那个 bug 写的(原因:start.sh 把 HTTP server 启在 src/client/,
 * 但 index.html 里写了 <script src="../shared/sync-engine.js">,Python http.server
 * 出于安全会拦截 .. 路径,导致 sync-engine.js 404,SyncEngine 未定义,
 * 整个 init 崩溃,房间号不显示)。
 *
 * 现在 start.* 把 HTTP server 根目录改到 src/,该问题已修复。
 * 这个测试会启动一个 headless Chrome,走完:打开页面 → 选视频 → 点创建房间,
 * 验证房间号出现 + Peer 已 open。
 *
 * 跑法:需先 ./start.sh
 */

'use strict';

const { chromium } = require('playwright');

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const URL = 'http://localhost:8080/client/';

(async () => {
  console.log('\n' + c.bold('✅ 验证修复:点击"创建房间"是否显示房间号'));
  console.log('─'.repeat(50) + '\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('requestfailed', (req) => {
    if (req.url().includes('shared/')) {
      errors.push(`shared/ 资源加载失败: ${req.url()}`);
    }
  });

  console.log(c.cyan('1. 打开页面...'));
  await page.goto(URL, { waitUntil: 'networkidle' });
  console.log('  ✅\n');

  // 检查 sync-engine.js 是否加载
  const state = await page.evaluate(() => ({
    hasSyncEngine: !!(window.SyncPlay && window.SyncPlay.SyncEngine),
    hasIceConfig: window.SYNCPLAY_ICE_SERVERS?.length || 0,
  }));
  console.log(c.cyan('2. 关键全局对象:'));
  console.log(`  SyncEngine: ${state.hasSyncEngine ? '✅' : '❌'}`);
  console.log(`  ICE configs: ${state.hasIceConfig}`);
  console.log('');

  console.log(c.cyan('3. 选视频 + 点击"创建房间"...'));
  await page.evaluate(() => {
    const v = document.getElementById('video');
    v.src = 'test-video.mp4';
    v.style.display = 'block';
    document.getElementById('noVideo').style.display = 'none';
  });
  await page.waitForTimeout(300);
  await page.click('#createBtn');
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const rid = document.getElementById('myRoomId')?.textContent;
    const info = document.getElementById('roomInfo');
    const sm = window.__syncplay?.connMgr?.();
    return {
      roomId: rid,
      roomIdLooksValid: rid && rid.startsWith('room-'),
      roomInfoVisible: info?.style.display === 'flex',
      peerOpen: sm?.peer?._open,
      peerId: sm?.myPeerId,
    };
  });

  console.log(`  房间号显示: ${result.roomIdLooksValid ? '✅' : '❌'} "${result.roomId}"`);
  console.log(`  房间信息可见: ${result.roomInfoVisible ? '✅' : '❌'}`);
  console.log(`  Peer 已连: ${result.peerOpen ? '✅' : '❌'}`);
  console.log('');

  console.log(c.cyan('4. 页面错误数:'));
  if (errors.length === 0) {
    console.log('  ✅ 无错误\n');
  } else {
    errors.forEach((e) => console.log('  ❌', e));
    console.log('');
  }

  await browser.close();

  // 判决
  const passed = result.roomIdLooksValid && result.peerOpen && errors.length === 0;
  console.log(c.bold(passed ? '🎉 修复成功!' : '❌ 仍有问题'));
  process.exit(passed ? 0 : 1);
})().catch((e) => {
  console.error('脚本异常:', e);
  process.exit(1);
});
