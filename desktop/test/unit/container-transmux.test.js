'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  buildCopyCommand,
  describeStreams,
  parseProbeLog,
  probeStreams,
  transmuxToFmp4,
} = require('../../src/shared/container-transmux.js');

function createFakeFfmpeg({ probeLog, output, execCodes = [1, 0] } = {}) {
  const listeners = new Map();
  const calls = { deleteFile: [], exec: [], off: [], terminate: 0 };
  let execIndex = 0;

  return {
    calls,
    on(event, callback) { listeners.set(event, callback); },
    off(event, callback) {
      calls.off.push([event, callback]);
      if (listeners.get(event) === callback) listeners.delete(event);
    },
    async writeFile() {},
    async deleteFile(name) { calls.deleteFile.push(name); },
    async readFile() { return output; },
    async exec(args) {
      calls.exec.push(args);
      if (args.length === 3 && args[1] === '-i') {
        listeners.get('log')?.({ message: probeLog });
      }
      return execCodes[execIndex++] ?? 0;
    },
    terminate() { calls.terminate++; },
    emitProgress(progress) { listeners.get('progress')?.({ progress }); },
  };
}

const H264_AAC_LOG = [
  'Stream #0:0: Video: h264 (High), yuv420p, 1280x720',
  'Stream #0:1: Audio: aac (LC), 48000 Hz, stereo',
].join('\n');

function validFmp4() {
  return new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
}

describe('container-transmux - 探针解析', () => {
  test('1. H.264 + AAC 可以直接转封装', () => {
    const result = describeStreams(parseProbeLog(H264_AAC_LOG));
    assert.deepStrictEqual(result.codecs, ['h264', 'aac']);
    assert.strictEqual(result.canCopy, true);
  });

  test('2. H.265 + AC3 可以直接转封装', () => {
    const result = describeStreams(parseProbeLog([
      'Stream #0:0: Video: hevc (Main 10), yuv420p10le, 1920x1080',
      'Stream #0:1: Audio: ac3, 48000 Hz, 5.1',
    ].join('\n')));
    assert.deepStrictEqual(result.codecs, ['hevc', 'ac3']);
    assert.strictEqual(result.canCopy, true);
  });

  test('3. H.264 + DTS 不兼容 MP4 copy 路径', () => {
    const result = describeStreams(parseProbeLog([
      'Stream #0:0: Video: h264 (High), yuv420p, 1920x1080',
      'Stream #0:1: Audio: dts (DTS), 48000 Hz, 5.1',
    ].join('\n')));
    assert.deepStrictEqual(result.codecs, ['h264', 'dts']);
    assert.strictEqual(result.canCopy, false);
  });
});

describe('container-transmux - 转封装行为', () => {
  test('4. 不兼容编码抛出软编 fallback 暂不支持错误', async () => {
    const ffmpeg = createFakeFfmpeg({
      probeLog: [
        'Stream #0:0: Video: h264 (High), yuv420p, 1920x1080',
        'Stream #0:1: Audio: dts (DTS), 48000 Hz, 5.1',
      ].join('\n'),
    });

    await assert.rejects(
      transmuxToFmp4(new Uint8Array([1]), { getFfmpeg: async () => ffmpeg }),
      /SOFT_ENCODE_FALLBACK_UNSUPPORTED/,
    );
    assert.strictEqual(ffmpeg.calls.exec.length, 1);
    assert.strictEqual(ffmpeg.calls.deleteFile.length, 2);
  });

  test('5. AbortController 取消时 terminate 只调用一次', async () => {
    const controller = new AbortController();
    const ffmpeg = createFakeFfmpeg({ probeLog: H264_AAC_LOG, output: validFmp4() });
    const originalExec = ffmpeg.exec.bind(ffmpeg);
    ffmpeg.exec = async (args) => {
      const code = await originalExec(args);
      if (args.includes('-c:v')) controller.abort();
      return code;
    };

    await assert.rejects(
      transmuxToFmp4(new Uint8Array([1]), {
        signal: controller.signal,
        getFfmpeg: async () => ffmpeg,
      }),
      /TRANSMUX_ABORTED/,
    );
    assert.strictEqual(ffmpeg.calls.terminate, 1);
    assert.strictEqual(ffmpeg.calls.off.filter(([event]) => event === 'progress').length, 1);
    assert.strictEqual(ffmpeg.calls.deleteFile.length, 0);
  });

  test('6. 返回带 ftyp 签名的 fMP4 bytes', async () => {
    const output = validFmp4();
    const progress = [];
    const ffmpeg = createFakeFfmpeg({ probeLog: H264_AAC_LOG, output });
    const originalExec = ffmpeg.exec.bind(ffmpeg);
    ffmpeg.exec = async (args) => {
      const code = await originalExec(args);
      if (args.includes('-c:v')) ffmpeg.emitProgress(0.5);
      return code;
    };

    const result = await transmuxToFmp4(new Uint8Array([1, 2, 3]), {
      getFfmpeg: async () => ffmpeg,
      onProgress: ({ percent }) => progress.push(percent),
    });

    assert.deepStrictEqual(result, output);
    assert.deepStrictEqual(progress, [50]);
    assert.deepStrictEqual(
      ffmpeg.calls.exec[1],
      buildCopyCommand(ffmpeg.calls.exec[1][4], ffmpeg.calls.exec[1].at(-1)),
    );
    assert.strictEqual(String.fromCharCode(...result.slice(4, 8)), 'ftyp');
    assert.strictEqual(ffmpeg.calls.deleteFile.length, 2);
  });
});
