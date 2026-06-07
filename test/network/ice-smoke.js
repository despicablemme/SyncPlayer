#!/usr/bin/env node
/**
 * SyncPlay - TURN 凭据 + ICE 候选 冒烟测试
 *
 * 用途:
 *   验证 config.local.js 里的 TURN 凭据能通过 Metered 认证,
 *   且能成功产生 relay 候选 — 这是 Phase 1 凭据侧的验收点。
 *
 * 不需要:
 *   - 第二个 peer
 *   - 跨网段环境
 *   - 启信令 server
 *
 * Phase 1 真正"两端跨网同步"还是要 ./start.command 走 R2-R5 流程实测,
 * 这个脚本只能验"凭据 + 候选",不能替代跨网体验。
 *
 * 用法:
 *   npm run test:ice
 *   或: node test/network/ice-smoke.js
 */

'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CONFIG_LOCAL = path.join(PROJECT_ROOT, 'src/client/config.local.js');

const GATHER_TIMEOUT_MS = 15000;

// ============ 颜色 + 日志 ============
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function log(msg, color = c.gray) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${ts}] ${color(msg)}`);
}

// ============ 加载 config.local.js ============
function loadIceServers() {
  if (!fs.existsSync(CONFIG_LOCAL)) {
    log(`❌ config.local.js 不存在: ${CONFIG_LOCAL}`, c.red);
    log(`   修复: cp src/client/config.template.js src/client/config.local.js`, c.yellow);
    log(`   然后把 __TURN_USERNAME__ / __TURN_CREDENTIAL__ 替换为 Metered 真凭据`, c.yellow);
    return null;
  }

  const code = fs.readFileSync(CONFIG_LOCAL, 'utf-8');

  // 在隔离 window 上下文里执行,提取 SYNCPLAY_ICE_SERVERS
  const win = {};
  try {
    new Function('window', code).call(null, win);
  } catch (e) {
    log(`❌ config.local.js 语法错误: ${e.message}`, c.red);
    return null;
  }

  const servers = win.SYNCPLAY_ICE_SERVERS;
  if (!servers || !Array.isArray(servers) || servers.length === 0) {
    log(`❌ config.local.js 未设置 window.SYNCPLAY_ICE_SERVERS`, c.red);
    return null;
  }

  // 警告占位符未替换
  const hasPlaceholder = servers.some(s =>
    (s.username && s.username.includes('__TURN_')) ||
    (s.credential && s.credential.includes('__TURN_'))
  );
  if (hasPlaceholder) {
    log(`⚠️  config.local.js 含未替换的占位符(__TURN_USERNAME__ / __TURN_CREDENTIAL__)`, c.yellow);
    log(`   这个测试必然失败:占位符无法通过 TURN 认证`, c.yellow);
    return null;
  }

  return servers;
}

// ============ 浏览器内 ICE 收集 ============
async function gatherCandidates(page, { servers, timeoutMs }) {
  return await page.evaluate(async (data) => {
    const { servers, timeoutMs } = data;
    return new Promise((resolve) => {
      const candidates = [];
      const startedAt = Date.now();
      let done = false;

      const finish = (reason) => {
        if (done) return;
        done = true;
        resolve({ candidates, reason, elapsedMs: Date.now() - startedAt });
      };

      const pc = new RTCPeerConnection({
        iceServers: servers,
        iceTransportPolicy: 'all',  // 允许所有路径(host/srflx/relay)
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          candidates.push({
            type: e.candidate.type,
            protocol: e.candidate.protocol,
            address: e.candidate.address,
            port: e.candidate.port,
          });
        } else {
          // null candidate = ICE gathering 结束
          finish('null-candidate');
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') finish('gathering-complete');
      };

      pc.onicecandidateerror = (e) => {
        // 单个候选失败不致命,继续收集
        // console.log('[ice-error]', e.errorText, e.url);
      };

      // 加 data channel 强制浏览器走完整 ICE 流程
      pc.createDataChannel('syncplay-ice-smoke');

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch((err) => finish('offer-error: ' + err.message));

      // 兜底超时
      setTimeout(() => finish('timeout'), timeoutMs);
    });
  }, { servers, timeoutMs });
}

// ============ 主流程 ============
async function main() {
  console.log('');
  log(c.bold('🧪 SyncPlay TURN 凭据冒烟测试'), c.blue);
  log(c.bold('─'.repeat(40)), c.blue);
  console.log('');

  // 1. 加载配置
  log('📋 加载 config.local.js...', c.cyan);
  const iceServers = loadIceServers();
  if (!iceServers) process.exit(1);

  const stunCount = iceServers.filter(s => s.urls && s.urls.startsWith('stun')).length;
  const turnCount = iceServers.filter(s => s.urls && s.urls.startsWith('turn')).length;
  log(`  ✅ 加载到 ${iceServers.length} 个 ICE server (${stunCount} STUN, ${turnCount} TURN)`, c.green);
  console.log('');

  // 2. 启动浏览器
  log('📦 启动 headless Chromium...', c.cyan);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  log('  ✅ 浏览器已启动', c.green);
  console.log('');

  // 3. ICE 收集
  log('🔍 收集 ICE 候选(等待 TURN 中继分配)...', c.cyan);
  log(`   超时: ${GATHER_TIMEOUT_MS / 1000}s`, c.gray);
  const result = await gatherCandidates(page, {
    servers: iceServers,
    timeoutMs: GATHER_TIMEOUT_MS,
  });
  console.log('');

  // 4. 统计
  const byType = { host: [], srflx: [], relay: [], prflx: [] };
  for (const cand of result.candidates) {
    if (byType[cand.type]) byType[cand.type].push(cand);
  }

  log('📊 ICE 候选统计:', c.bold);
  log(`  host  (内网直连):  ${byType.host.length}`, c.gray);
  log(`  srflx (STUN 反射):  ${byType.srflx.length}`, c.gray);
  log(`  prflx (对端反射):  ${byType.prflx.length}`, c.gray);
  log(
    `  relay (TURN 中继):  ${byType.relay.length}  ${byType.relay.length > 0 ? '✅' : '❌'}`,
    byType.relay.length > 0 ? c.green : c.red
  );
  log(`  完成: ${result.reason}  耗时: ${result.elapsedMs}ms`, c.gray);
  console.log('');

  // 5. 详细列出 relay
  if (byType.relay.length > 0) {
    log('🌐 TURN 中继地址(从 Metered 申请到):', c.bold);
    for (const r of byType.relay) {
      log(`  • ${r.protocol} ${r.address}:${r.port}`, c.gray);
    }
    console.log('');
  }

  // 6. 判决
  if (byType.relay.length > 0) {
    log('✅ TURN 中继可用 — 凭据有效,网络可达', c.bold);
    log('   Phase 1 凭据侧验收通过 ✓', c.green);
    log('   下一步: ./start.command 启服务,浏览器实测两端同步', c.gray);
    await browser.close();
    process.exit(0);
  } else {
    log('❌ 没有产生 relay 候选 — TURN 凭据可能无效或网络不通', c.bold);
    log('', c.gray);
    log('排查建议:', c.yellow);
    log('  1. 打开 config.local.js,确认 username/credential 是 Metered 真凭据(不是占位符)', c.yellow);
    log('  2. 浏览器访问 https://www.metered.ca → Dashboard → 看是否欠费/超额', c.yellow);
    log('  3. 本机测试: nc -zvu global.relay.metered.ca 3478', c.yellow);
    log('  4. 如果在中国大陆,试试其他 TURN(见 docs/TECH_RESEARCH.md)', c.yellow);
    await browser.close();
    process.exit(1);
  }
}

main().catch(async (err) => {
  log(`❌ 测试运行异常: ${err.message}`, c.red);
  console.error(err);
  process.exit(1);
});
