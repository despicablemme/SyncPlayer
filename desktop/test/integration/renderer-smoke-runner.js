'use strict';

/**
 * v0.7.0.1-B-F: Electron renderer smoke test 启动脚本
 *
 * 使用与生产一致的 contextIsolation=true / nodeIntegration=false 加载 index.html,
 * 在 renderer 主世界验证 UMD 全局并真跑 5 个 smoke 场景。主进程只提供两个本地
 * 样本的只读自定义协议，renderer 不获得 require / fs 权限。
 *
 * 主人触发:
 *   cd desktop
 *   SYNCPLAY_RUN_SMOKE=1 \
 *   SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \
 *   npm run test:renderer-smoke
 *
 * 退出码: 0 = 5 个测试全部 pass; 1 = 有 fail; 2 = 未启用或启动失败
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const {
  app,
  BrowserWindow,
  protocol,
} = require('electron');

const ENABLED = process.env.SYNCPLAY_RUN_SMOKE === '1';
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MKV_SAMPLE = process.env.SYNCPLAY_SMOKE_MKV
  || '/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv';
const MP4_SAMPLE = path.join(PROJECT_ROOT, 'src', 'client', 'test-video.mp4');
const SMOKE_TIMEOUT_MS = 10 * 60 * 1000;

if (!ENABLED) {
  console.error('[smoke-runner] SYNCPLAY_RUN_SMOKE != 1, refusing to run');
  console.error('[smoke-runner] 主人用法:');
  console.error('  SYNCPLAY_RUN_SMOKE=1 SYNCPLAY_SMOKE_MKV="/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" \\');
  console.error('    npm run test:renderer-smoke');
  app.whenReady().then(() => app.exit(2));
} else {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'syncplay-smoke',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  }]);

  app.commandLine.appendSwitch('disable-renderer-backgrounding');

  app.whenReady().then(runSmoke).catch((error) => {
    console.error('[smoke-runner] fatal:', error.stack || error.message);
    app.exit(2);
  });
}

function localFileResponse(filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    return new Response('not found', { status: 404 });
  }

  const size = fs.statSync(filePath).size;
  const stream = Readable.toWeb(fs.createReadStream(filePath));
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(size),
      'cache-control': 'no-store',
    },
  });
}

function registerSampleProtocol() {
  protocol.handle('syncplay-smoke', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'sample') return new Response('not found', { status: 404 });
    if (url.pathname === '/mkv') return localFileResponse(MKV_SAMPLE, 'video/x-matroska');
    if (url.pathname === '/mp4') return localFileResponse(MP4_SAMPLE, 'video/mp4');
    return new Response('not found', { status: 404 });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    webPreferences: {
      preload: path.join(PROJECT_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.on('console-message', (_event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[smoke-runner] renderer gone:', details.reason, details.exitCode);
  });
  return win;
}

async function runSmoke() {
  if (!fs.existsSync(MKV_SAMPLE)) {
    console.error(`[smoke-runner] mkv 样本不存在: ${MKV_SAMPLE}`);
    app.exit(2);
    return;
  }
  if (!fs.existsSync(MP4_SAMPLE)) {
    console.error(`[smoke-runner] mp4 样本不存在: ${MP4_SAMPLE}`);
    app.exit(2);
    return;
  }

  registerSampleProtocol();
  const win = createWindow();
  let results = { passed: 0, failed: 1, skipped: 0 };

  try {
    await win.loadFile(path.join(PROJECT_ROOT, 'src', 'client', 'index.html'));
    results = await Promise.race([
      win.webContents.executeJavaScript(rendererSmokeScript()),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`SMOKE_TIMEOUT_${SMOKE_TIMEOUT_MS}ms`)), SMOKE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('[smoke-runner] fatal:', error.stack || error.message);
    results = {
      passed: 0,
      failed: 1,
      skipped: 0,
      details: [error.message],
    };
  } finally {
    if (!win.isDestroyed()) win.destroy();
    console.log(`\n[smoke-runner] 结果: passed=${results.passed} failed=${results.failed} skipped=${results.skipped}`);
    if (results.details && results.details.length) {
      for (const detail of results.details) console.error(`[smoke-runner] ${detail}`);
    }
    app.exit(results.failed > 0 ? 1 : 0);
  }
}

function rendererSmokeScript() {
  return `
    (async () => {
      const details = [];
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      function assert(condition, message) {
        if (!condition) throw new Error(message);
      }

      function once(target, eventName, timeoutMs) {
        return new Promise((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timer);
            target.removeEventListener(eventName, onEvent);
            target.removeEventListener('error', onError);
          };
          const onEvent = (event) => { cleanup(); resolve(event); };
          const onError = () => { cleanup(); reject(new Error(eventName.toUpperCase() + '_MEDIA_ERROR')); };
          const timer = setTimeout(() => {
            cleanup();
            reject(new Error(eventName.toUpperCase() + '_TIMEOUT_' + timeoutMs + 'ms'));
          }, timeoutMs);
          target.addEventListener(eventName, onEvent, { once: true });
          target.addEventListener('error', onError, { once: true });
        });
      }

      function videoElement() {
        const video = document.createElement('video');
        video.muted = true;
        video.controls = false;
        document.body.appendChild(video);
        return video;
      }

      async function withTimeout(name, timeoutMs, fn) {
        console.log('[smoke-start] ' + name);
        let timer;
        try {
          await Promise.race([
            Promise.resolve().then(fn),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('TEST_TIMEOUT_' + timeoutMs + 'ms')), timeoutMs);
            }),
          ]);
          passed += 1;
          console.log('[smoke-pass] ' + name);
        } catch (error) {
          failed += 1;
          const detail = name + ': ' + (error && error.message ? error.message : String(error));
          details.push(detail);
          console.error('[smoke-fail] ' + detail);
        } finally {
          clearTimeout(timer);
        }
      }

      const media = window.SyncPlayMedia || {};
      const globals = {
        require: typeof window.require,
        ffmpeg: typeof (window.FFmpegWASM && window.FFmpegWASM.FFmpeg),
        ffmpegUtil: typeof (window.FFmpegUtil && window.FFmpegUtil.toBlobURL),
        getFfmpeg: typeof media.getFfmpeg,
        transmuxToFmp4: typeof media.transmuxToFmp4,
        parseFtyp: typeof media.parseFtyp,
        MsePlayer: typeof media.MsePlayer,
        HlsPlayer: typeof window.SyncPlayHlsPlayer,
      };
      console.log('[smoke-globals] ' + JSON.stringify(globals));
      assert(globals.require === 'undefined', 'production renderer 不应暴露 require');
      for (const [name, type] of Object.entries(globals)) {
        if (name !== 'require') assert(type === 'function', name + ' 应为 function, 实得 ' + type);
      }

      await withTimeout('smoke 1/5: empty file (0 bytes) 拒绝', 60000, async () => {
        let rejected = false;
        try {
          await media.transmuxToFmp4(new Uint8Array(0));
        } catch (error) {
          rejected = true;
          console.log('[smoke 1] rejected: ' + error.message);
        }
        assert(rejected, '0 字节输入应被拒绝');
      });

      await withTimeout('smoke 2/5: mkv H.264 → transmux → MSE', 300000, async () => {
        const response = await fetch('syncplay-smoke://sample/mkv');
        assert(response.ok, 'mkv 样本读取失败: HTTP ' + response.status);
        const fileBytes = new Uint8Array(await response.arrayBuffer());
        assert(fileBytes.byteLength > 1024 * 1024 * 1024, 'mkv 样本应 > 1 GB');

        const start = performance.now();
        const fmp4Bytes = await media.transmuxToFmp4(fileBytes, {
          onProgress: ({ percent }) => console.log('[transmux] ' + percent.toFixed(1) + '%'),
        });
        console.log('[smoke 2] transmux ' + (fmp4Bytes.byteLength / 1024 / 1024).toFixed(2)
          + ' MB in ' + ((performance.now() - start) / 1000).toFixed(2) + 's');

        const ftyp = media.parseFtyp(fmp4Bytes);
        assert(ftyp.mimeType === 'video/mp4', 'mimeType 应为 video/mp4');
        assert(Boolean(ftyp.codec), 'codec 应识别');

        const video = videoElement();
        const metadata = once(video, 'loadedmetadata', 60000);
        const mse = new media.MsePlayer(video);
        try {
          await mse.addSourceBuffer(ftyp.mimeType, ftyp.codec);
          await mse.appendFmp4(fmp4Bytes);
          await mse.end();
          await metadata;
          assert(video.duration > 60, 'duration 应 > 60s, 实得 ' + video.duration);
          assert(video.videoWidth > 0, 'videoWidth 应 > 0');
          console.log('[smoke 2] duration=' + video.duration.toFixed(2)
            + 's, ' + video.videoWidth + 'x' + video.videoHeight);
        } finally {
          try { mse.destroy(); } catch (_) {}
          video.remove();
        }
      });

      await withTimeout('smoke 3/5: mp4 native → loadedmetadata', 60000, async () => {
        const response = await fetch('syncplay-smoke://sample/mp4');
        assert(response.ok, 'mp4 样本读取失败: HTTP ' + response.status);
        const url = URL.createObjectURL(await response.blob());
        const video = videoElement();
        try {
          const metadata = once(video, 'loadedmetadata', 30000);
          video.src = url;
          video.load();
          await metadata;
          assert(video.duration > 0, 'mp4 duration 应 > 0');
        } finally {
          URL.revokeObjectURL(url);
          video.remove();
        }
      });

      await withTimeout('smoke 4/5: hls network → canplay', 90000, async () => {
        const video = videoElement();
        const player = new window.SyncPlayHlsPlayer(
          video,
          'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        );
        try {
          const canplay = once(video, 'canplay', 60000);
          await player.attach();
          await canplay;
          assert(video.duration > 0, 'HLS duration 应 > 0');
        } finally {
          try { player.destroy(); } catch (_) {}
          video.remove();
        }
      });

      await withTimeout('smoke 5/5: wrong format → parseFtyp 拒绝', 30000, async () => {
        let rejected = false;
        try {
          media.parseFtyp(new Uint8Array(1024));
        } catch (error) {
          rejected = /FTYP_TOO_SHORT|NOT_FTYP/.test(error.message);
        }
        assert(rejected, '错误格式应抛 FTYP_TOO_SHORT 或 NOT_FTYP');
      });

      console.log('[smoke-done] passed=' + passed + ' failed=' + failed + ' skipped=' + skipped);
      return { passed, failed, skipped, details };
    })();
  `;
}

app.on('window-all-closed', () => app.quit());
