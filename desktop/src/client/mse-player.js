'use strict';

/**
 * MsePlayer — wraps HTMLMediaElement + MediaSource + SourceBuffer lifecycle.
 *
 * State machine: idle -> open -> ended (or error)
 *
 * Design notes (per v0.7 Round 2 §3):
 *  - One video/mp4 SourceBuffer per MsePlayer (sufficient for fMP4 from ffmpeg.wasm transmux,
 *    which mux audio + video into one track pair inside fMP4).
 *  - appendBuffer() returns Promise that resolves on updateend; if SourceBuffer.updating,
 *    subsequent appends queue and drain on the next updateend.
 *  - destroy() order matters: SourceBuffer.abort (if updating) -> MediaSource.endOfStream
 *    -> URL.revokeObjectURL + video.removeAttribute('src') + video.load().
 *
 * Usage:
 *   const mse = new MsePlayer(videoEl);
 *   await mse.addSourceBuffer('video/mp4', 'avc1.640028');
 *   await mse.appendFmp4(fmp4Bytes);
 *   await mse.end();
 *   // ... playback happens via videoEl events (loadedmetadata / canplay / timeupdate)
 *   // ... when done: mse.destroy()
 */

class MsePlayer {
  constructor(videoEl) {
    if (!videoEl) throw new Error('MSE_NO_VIDEO_ELEMENT');
    this.video = videoEl;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.state = 'idle'; // idle | open | ended | error
    this.queue = [];
    this._ready = null; // Promise<MediaSource>
    this._destroyed = false;
  }

  _createMediaSource() {
    return new Promise((resolve, reject) => {
      if (typeof MediaSource === 'undefined') {
        reject(new Error('MSE_NOT_SUPPORTED'));
        return;
      }
      const ms = new MediaSource();
      const url = URL.createObjectURL(ms);
      // Defensive: don't clobber user's src mid-load if a destroy raced
      if (this._destroyed) {
        try { URL.revokeObjectURL(url); } catch (_) {}
        reject(new Error('MSE_DESTROYED'));
        return;
      }
      this.video.src = url;
      ms.addEventListener('sourceopen', () => resolve(ms), { once: true });
      ms.addEventListener('sourceclose', () => {
        if (this.state !== 'ended' && this.state !== 'error') {
          this.state = 'ended';
        }
      });
      this.mediaSource = ms;
      this._ready = Promise.resolve(ms);
    });
  }

  /**
   * Wait for MediaSource.sourceopen; idempotent.
   */
  _ensureMediaSource() {
    if (this._ready) return this._ready;
    this._ready = this._createMediaSource();
    return this._ready;
  }

  /**
   * Add a SourceBuffer. mimeType is e.g. 'video/mp4'; codec is e.g. 'avc1.640028'
   * (the first video codec; MSE accepts one codec string per SourceBuffer).
   */
  async addSourceBuffer(mimeType, codec) {
    if (this._destroyed) throw new Error('MSE_DESTROYED');
    if (this.sourceBuffer) throw new Error('MSE_SOURCEBUFFER_EXISTS');
    await this._ensureMediaSource();
    if (!this.mediaSource || this.mediaSource.readyState === 'closed') {
      throw new Error('MSE_NOT_OPEN');
    }
    // Build the full MIME with codecs parameter if codec given
    const sbMimeType = codec ? `${mimeType};codecs="${codec}"` : mimeType;
    // MSE throws synchronously if codec is unsupported
    let sb;
    try {
      sb = this.mediaSource.addSourceBuffer(sbMimeType);
    } catch (e) {
      this.state = 'error';
      throw new Error(`MSE_UNSUPPORTED_CODEC: ${sbMimeType}`);
    }
    this.sourceBuffer = sb;
    sb.addEventListener('updateend', () => this._drain());
    sb.addEventListener('error', (e) => {
      this.state = 'error';
      console.error('[mse-player] sourceBuffer error', e);
    });
    this.state = 'open';
  }

  /**
   * Append fMP4 bytes. Returns a Promise that resolves when the buffer is fully
   * appended (after updateend). If SourceBuffer is currently updating, the call
   * is queued and runs when the previous append finishes.
   */
  appendFmp4(bytes) {
    if (this._destroyed) return Promise.reject(new Error('MSE_DESTROYED'));
    if (!this.sourceBuffer) return Promise.reject(new Error('MSE_NO_SOURCEBUFFER'));
    if (this.sourceBuffer.updating) {
      return new Promise((resolve, reject) => {
        this.queue.push(() => this._doAppend(bytes).then(resolve, reject));
      });
    }
    return this._doAppend(bytes);
  }

  _doAppend(bytes) {
    return new Promise((resolve, reject) => {
      const sb = this.sourceBuffer;
      if (!sb) {
        reject(new Error('MSE_NO_SOURCEBUFFER'));
        return;
      }
      const onUpdate = () => {
        sb.removeEventListener('updateend', onUpdate);
        sb.removeEventListener('error', onError);
        this._drain();
        resolve();
      };
      const onError = (_e) => {
        sb.removeEventListener('updateend', onUpdate);
        sb.removeEventListener('error', onError);
        this.state = 'error';
        reject(new Error('MSE_APPEND_FAIL'));
      };
      sb.addEventListener('updateend', onUpdate);
      sb.addEventListener('error', onError);
      try {
        sb.appendBuffer(bytes);
      } catch (e) {
        sb.removeEventListener('updateend', onUpdate);
        sb.removeEventListener('error', onError);
        // QuotaExceededError or InvalidStateError — surface to caller
        this.state = 'error';
        reject(e instanceof Error ? e : new Error(`MSE_APPEND_FAIL: ${String(e)}`));
      }
    });
  }

  _drain() {
    if (this.queue.length > 0 && this.sourceBuffer && !this.sourceBuffer.updating) {
      const next = this.queue.shift();
      // Run async; errors already handled inside _doAppend
      next();
    }
  }

  /**
   * Signal end of stream. Waits for any pending update to finish first.
   */
  async end() {
    if (!this.sourceBuffer) return;
    if (this.sourceBuffer.updating) {
      await new Promise((resolve) => {
        const sb = this.sourceBuffer;
        const onUpdate = () => {
          sb.removeEventListener('updateend', onUpdate);
          resolve();
        };
        sb.addEventListener('updateend', onUpdate);
      });
    }
    try {
      this.mediaSource.endOfStream();
      this.state = 'ended';
    } catch (e) {
      this.state = 'error';
      throw e;
    }
  }

  /**
   * Cleanup order (important):
   *   1. SourceBuffer.abort() if currently updating
   *   2. MediaSource.endOfStream() if still open (no-op if closed)
   *   3. URL.revokeObjectURL(video.src)
   *   4. video.removeAttribute('src') + video.load() (forces decoder reset)
   *
   * Idempotent — safe to call multiple times.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.sourceBuffer) {
      try {
        if (this.sourceBuffer.updating) this.sourceBuffer.abort();
      } catch (_e) { /* swallow — best-effort cleanup */ }
      this.sourceBuffer = null;
    }
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try { this.mediaSource.endOfStream(); } catch (_e) { /* swallow */ }
    }
    if (this.video && this.video.src) {
      const src = this.video.src;
      try { URL.revokeObjectURL(src); } catch (_e) { /* swallow */ }
      try { this.video.removeAttribute('src'); } catch (_e) { /* swallow */ }
      try { this.video.load(); } catch (_e) { /* swallow */ }
    }
    this.queue = [];
    if (this.state !== 'error') this.state = 'idle';
  }

  _handleError(e) {
    this.state = 'error';
    console.error('[mse-player] error', e);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MsePlayer };
}
if (typeof window !== 'undefined') {
  window.SyncPlayMedia = window.SyncPlayMedia || {};
  window.SyncPlayMedia.MsePlayer = MsePlayer;
}