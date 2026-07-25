'use strict';

const { getFfmpeg, resetFfmpeg } = require('./ffmpeg-loader.js');

const MAX_INPUT_SIZE = 2 * 1024 ** 3;
const COPY_VIDEO_CODECS = new Set(['h264', 'hevc', 'h265', 'av1']);
const COPY_AUDIO_CODECS = new Set(['aac', 'ac3', 'opus', 'vorbis']);

let jobSequence = 0;
let activeJob = null;

function parseProbeLog(log) {
  const streams = [];
  const pattern = /Stream #\d+:\d+(?:\([^)]*\))?(?:\[[^\]]+\])?:\s*(Video|Audio|Subtitle|Data|Attachment):\s*([^,\s(]+)/;

  for (const line of String(log).split('\n')) {
    const match = line.match(pattern);
    if (match) {
      streams.push({
        type: match[1].toLowerCase(),
        codec: match[2].toLowerCase(),
        raw: line.trim(),
      });
    }
  }

  return streams;
}

function describeStreams(streams) {
  const selected = streams.filter((stream) => stream.type === 'video' || stream.type === 'audio');
  const video = selected.find((stream) => stream.type === 'video');
  const audio = selected.find((stream) => stream.type === 'audio');
  const codecs = selected.map((stream) => stream.codec);
  const canCopy = Boolean(video)
    && COPY_VIDEO_CODECS.has(video.codec)
    && (!audio || COPY_AUDIO_CODECS.has(audio.codec));

  return { streams, video, audio, codecs, canCopy };
}

async function probeStreams(ffmpeg, inputName) {
  let probeLog = '';
  const logHandler = ({ message }) => {
    probeLog += `${message}\n`;
  };

  ffmpeg.on('log', logHandler);
  try {
    await ffmpeg.exec(['-hide_banner', '-i', inputName]);
  } finally {
    ffmpeg.off('log', logHandler);
  }

  return describeStreams(parseProbeLog(probeLog));
}

function buildCopyCommand(inputName, outputName) {
  return [
    '-hide_banner', '-loglevel', 'warning',
    '-i', inputName,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'copy', '-c:a', 'copy',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4', outputName,
  ];
}

function validateFmp4(bytes) {
  return bytes.byteLength >= 8
    && bytes[4] === 0x66
    && bytes[5] === 0x74
    && bytes[6] === 0x79
    && bytes[7] === 0x70;
}

function inputExtension(input) {
  const name = input && typeof input.name === 'string' ? input.name : '';
  const match = name.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : 'bin';
}

async function inputBytes(input) {
  if (input && typeof input.size === 'number' && input.size > MAX_INPUT_SIZE) {
    throw new Error('MEMORY_QUOTA: 文件超过 2 GB 限制');
  }

  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input && typeof input.arrayBuffer === 'function') {
    bytes = new Uint8Array(await input.arrayBuffer());
  } else {
    throw new TypeError('CONTAINER_UNSUPPORTED: 输入必须是 File、Blob、ArrayBuffer 或 Uint8Array');
  }

  if (bytes.byteLength > MAX_INPUT_SIZE) {
    throw new Error('MEMORY_QUOTA: 文件超过 2 GB 限制');
  }
  return bytes;
}

async function transmuxToFmp4(input, options = {}) {
  const { onProgress, signal, getFfmpeg: loadFfmpeg = getFfmpeg } = options;
  if (activeJob) {
    throw new Error('TRANSMUX_BUSY: 当前已有转封装任务');
  }

  const jobId = `${Date.now()}_${++jobSequence}`;
  const inputName = `input_${jobId}.${inputExtension(input)}`;
  const outputName = `output_${jobId}.mp4`;
  let ffmpeg;
  let terminated = false;
  let progressHandler;
  let abortHandler;

  activeJob = jobId;
  try {
    if (signal?.aborted) throw new Error('TRANSMUX_ABORTED');

    const bytes = await inputBytes(input);
    ffmpeg = await loadFfmpeg();
    await ffmpeg.writeFile(inputName, bytes);

    const probed = await probeStreams(ffmpeg, inputName);
    if (!probed.canCopy) {
      const codecs = probed.codecs.length ? probed.codecs.join('+') : 'unknown';
      throw new Error(
        `SOFT_ENCODE_FALLBACK_UNSUPPORTED: 编解码器 ${codecs} 暂不支持, `
        + '请用 VLC 打开或转码为 MP4 (H.264+AAC)',
      );
    }

    progressHandler = ({ progress }) => {
      const percent = Math.max(0, Math.min(100, progress * 100));
      onProgress?.({ percent });
    };
    ffmpeg.on('progress', progressHandler);

    abortHandler = () => {
      if (terminated) return;
      terminated = true;
      try { ffmpeg.terminate(); } finally { resetFfmpeg({ terminate: false }); }
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    const exitCode = await ffmpeg.exec(buildCopyCommand(inputName, outputName));
    if (signal?.aborted || terminated) throw new Error('TRANSMUX_ABORTED');
    if (exitCode !== 0) throw new Error('COPY_FAIL: TRANSMUX_FAILED');

    const output = await ffmpeg.readFile(outputName);
    const result = output instanceof Uint8Array ? output : new Uint8Array(output);
    if (!validateFmp4(result)) throw new Error('SOFTENCODE_FAIL: INVALID_FMP4_OUTPUT');
    return result;
  } finally {
    signal?.removeEventListener?.('abort', abortHandler);
    if (ffmpeg && progressHandler) ffmpeg.off('progress', progressHandler);
    if (ffmpeg && !terminated) {
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}
    }
    activeJob = null;
  }
}

module.exports = {
  MAX_INPUT_SIZE,
  buildCopyCommand,
  describeStreams,
  parseProbeLog,
  probeStreams,
  transmuxToFmp4,
  validateFmp4,
};

// Browser-side exposure (Electron renderer has contextIsolation: true, nodeIntegration: false,
// so renderer cannot use require()). Exposed onto shared window.SyncPlayMedia namespace.
if (typeof window !== 'undefined') {
  window.SyncPlayMedia = window.SyncPlayMedia || {};
  Object.assign(window.SyncPlayMedia, {
    MAX_INPUT_SIZE,
    buildCopyCommand,
    describeStreams,
    parseProbeLog,
    probeStreams,
    transmuxToFmp4,
    validateFmp4,
  });
}
