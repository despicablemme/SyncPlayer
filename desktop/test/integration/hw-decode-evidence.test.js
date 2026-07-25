'use strict';

/**
 * Integration test: 硬解证据链 3 项 (per Claude Round 2 §0 决定 #4 + §8)
 *
 * 三项并列证据 (per Claude Round 2 §0 决定 #4 硬解验收用"证据链"):
 *   1. chrome://gpu: "Video Acceleration Information" 段有 "Decode hevc main" / "Decode av1 main" / etc.
 *   2. macOS Activity Monitor: VTDecoderXPCService 进程 CPU > 0 当 HEVC 视频播放
 *   3. SyncPlay 主进程 CPU < 20% 当 HEVC 视频播放 (硬解 = GPU 工作, 不吃 CPU)
 *
 * 默认 SKIP — 只能在主人本地 Electron renderer + macOS 实测:
 *   - chrome://gpu 是 Chromium 内部页面, 需 renderer 内 window.open('chrome://gpu')
 *   - VTDecoderXPCService 是 macOS 进程, 需 Activity Monitor / ps 命令读
 *   - 主进程 CPU 需 os.cpus() + process.cpuUsage() (Electron main process)
 *
 * 主人实测命令 (阶段 C):
 *   1. 启动 SyncPlay dev build
 *   2. 加载 mp4 H.265 样本 (Big_Buck_Bunny_720_10s_1MB.mp4)
 *   3. 在 DevTools console 跑:
 *      window.open('chrome://gpu')
 *      → 看 "Video Acceleration Information" 段 → 应有 "Decode hevc main"
 *   4. macOS Activity Monitor 搜 "VTDecoderXPCService", 看 CPU%
 *   5. Activity Monitor 搜 "SyncPlay" 主进程, 看 CPU% < 20%
 *   6. 把 3 项填进 v0.7-B-E-test-report.md §6 表
 */

const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert');

const ENABLED = process.env.SYNCPLAY_RUN_HW_DECODE_EVIDENCE === '1';
const hasSandbox = typeof window === 'undefined'
  || typeof document === 'undefined'
  || typeof SharedArrayBuffer === 'undefined';

function makeSkipReason() {
  if (!ENABLED) {
    return '设置 SYNCPLAY_RUN_HW_DECODE_EVIDENCE=1 后由主人在 Electron renderer + macOS 环境运行 (默认跳过)';
  }
  if (hasSandbox) {
    return 'sandbox 无 DOM / SharedArrayBuffer (默认跳过)';
  }
  return false;
}

const HEVC_URL = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/720/Big_Buck_Bunny_720_10s_1MB.mp4';
const AV1_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides-AV1-8bit-51.webm';
const PASSENGERS_MKV = 'file:///Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';

// ---------- 硬解证据 #1: chrome://gpu dump ----------
test('hw-decode-evidence: chrome://gpu 报告有 "Decode hevc main" / "Decode av1 main"', {
  skip: makeSkipReason(),
  timeout: 30000,
}, async () => {
  // 主人实测时在 Electron renderer DevTools console 跑:
  //
  //   const gpuWin = window.open('chrome://gpu');
  //   // 等 gpu page 渲染完成 (fetch system info + driver info), 等几秒
  //   await new Promise(r => setTimeout(r, 5000));
  //   // dump gpu page 内容
  //   const dump = gpuWin.document.body.innerText;
  //   console.log(dump);
  //   // 期望:
  //   //   "Video Acceleration Information"
  //   //   "Decode hevc main" — macOS VideoToolbox / Intel VAAPI / NVIDIA NVDEC
  //   //   "Decode av1 main" — M1+ / RTX 30+ / RX 6000+
  //
  // 这个集成测试在 sandbox 跑不了 (chrome://gpu 是 internal page),
  // 主人阶段 C 实测后填 §6 表.
  assert.ok(typeof window !== 'undefined', '需要 Electron renderer');
  assert.fail('硬解证据 #1 需主人在 chrome://gpu 手动验证 (阶段 C)');
});

// ---------- 硬解证据 #2: VTDecoderXPCService CPU > 0 ----------
test('hw-decode-evidence: macOS Activity Monitor VTDecoderXPCService CPU > 0', {
  skip: makeSkipReason(),
  timeout: 30000,
}, async () => {
  // 主人实测:
  //   1. macOS 终端: ps aux | grep VTDecoder | grep -v grep
  //   2. 或 Activity Monitor 搜 "VTDecoderXPCService"
  //   3. 加载 mp4 H.265 + play, 观察 CPU% > 0
  //
  // 测试在 Electron renderer 里通过 child_process spawn `ps`:
  //
  //   const { execSync } = require('child_process');
  //   const psOut = execSync('ps -A -o %cpu,comm | grep VTDecoder').toString();
  //   // 期望有 VTDecoderXPCService 行 + CPU% > 0
  //
  // 沙箱跑不了 (macOS 进程 + Activity Monitor GUI), 主人阶段 C 实测后填 §6 表.
  assert.fail('硬解证据 #2 需主人在 macOS Activity Monitor 手动验证 (阶段 C)');
});

// ---------- 硬解证据 #3: SyncPlay 主进程 CPU < 20% ----------
test('hw-decode-evidence: SyncPlay 主进程 CPU < 20% 当 HEVC 播放', {
  skip: makeSkipReason(),
  timeout: 60000,
}, async () => {
  // 主人实测:
  //   1. macOS Activity Monitor 搜 "Electron" / "SyncPlay" 主进程 (PID 高的是主进程)
  //   2. 加载 mp4 H.265 + play, 持续 30s
  //   3. 主进程 CPU% 应 < 20% (硬解: GPU 工作, 不吃 CPU)
  //   4. 若主进程 CPU > 50%, 说明 ffmpeg.wasm 在主进程跑软解 (反例)
  //
  // 测试在 Electron main process 跑:
  //
  //   const startCpu = process.cpuUsage();
  //   await new Promise(r => setTimeout(r, 30000)); // 观察 30s
  //   const endCpu = process.cpuUsage(startCpu);
  //   const cpuPercent = ((endCpu.user + endCpu.system) / 1e6) / 30 * 100;
  //   console.log(`[hw-evidence] 主进程 CPU = ${cpuPercent.toFixed(2)}%`);
  //   assert.ok(cpuPercent < 20, '主进程 CPU 应 < 20%');
  //
  // 沙箱跑不了, 主人阶段 C 实测后填 §6 表.
  assert.fail('硬解证据 #3 需主人在 Activity Monitor 手动验证 (阶段 C)');
});

// ---------- 端到端 3 项汇总: HEVC mp4 → 触发硬解 → 三项证据都齐 ----------
test('hw-decode-evidence: 端到端 HEVC mp4 → 触发 macOS VideoToolbox 硬解', {
  skip: makeSkipReason(),
  timeout: 120000,
}, async () => {
  // 主人实测:
  //   1. Electron renderer 加载 HEVC mp4:
  //      const v = document.createElement('video');
  //      v.src = HEVC_URL;
  //      document.body.appendChild(v);
  //      await new Promise(r => v.addEventListener('loadedmetadata', r));
  //      await v.play();
  //   2. 等 5s 让解码器跑起来
  //   3. chrome://gpu: "Decode hevc main" ✓
  //   4. macOS Activity Monitor: VTDecoderXPCService CPU > 0 ✓
  //   5. 主进程 CPU < 20% ✓
  //   6. 填 v0.7-B-E-test-report.md §6 表
  const v = document.createElement('video');
  v.muted = true;
  v.src = HEVC_URL;
  document.body.appendChild(v);
  await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
  await v.play();
  console.log('[hw-evidence] HEVC 视频开始播放, 等 5s 让硬解稳定');
  await new Promise((r) => setTimeout(r, 5000));

  // 这里只能验证 video 在播放, 不能读 chrome://gpu / Activity Monitor
  assert.strictEqual(v.paused, false, 'HEVC 视频应在播放');
  v.remove();
});