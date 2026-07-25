'use strict';

const path = require('path');

let ffmpegInstance = null;
let loadingPromise = null;

class FfmpegLoadError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'FfmpegLoadError';
    this.code = code;
    this.cause = cause;
  }
}

function classifyLoadError(error) {
  if (error && error.name === 'AbortError') return error;

  const message = error && error.message ? error.message : String(error);
  if (/timeout|timed out/i.test(message)) {
    return new FfmpegLoadError('timeout', message, error);
  }
  if (/fetch|network|failed to fetch|ERR_/i.test(message)) {
    return new FfmpegLoadError('network_error', message, error);
  }
  return new FfmpegLoadError('load_failure', message, error);
}

async function createFfmpeg() {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  const ffmpeg = new FFmpeg();
  const basePath = path.join(__dirname, '..', '..', 'public', 'ffmpeg').replace(/\\/g, '/');
  const coreURL = await toBlobURL(`file://${basePath}/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`file://${basePath}/ffmpeg-core.wasm`, 'application/wasm');

  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = createFfmpeg()
    .then((ffmpeg) => {
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })
    .catch((error) => {
      throw classifyLoadError(error);
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

function resetFfmpeg({ terminate = true } = {}) {
  const ffmpeg = ffmpegInstance;
  ffmpegInstance = null;
  loadingPromise = null;

  if (terminate && ffmpeg) {
    try { ffmpeg.terminate(); } catch {}
  }
}

module.exports = {
  FfmpegLoadError,
  getFfmpeg,
  resetFfmpeg,
  _classifyLoadError: classifyLoadError,
};
