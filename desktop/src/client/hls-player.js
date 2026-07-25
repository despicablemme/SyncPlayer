'use strict';

/**
 * HlsPlayer — attaches an HLS source to the existing <video> element.
 * Safari uses native HLS; Chromium/Firefox use the locally bundled hls.js.
 */
class HlsPlayer {
  constructor(videoEl, url) {
    if (!videoEl) throw new Error('HLS_NO_VIDEO_ELEMENT');
    this.video = videoEl;
    this.url = url;
    this.hls = null;
    this.state = 'idle'; // idle | loading | playing | error
    this._recoveredNetwork = false;
    this._recoveredMedia = false;
  }

  async attach() {
    // Safari 原生 HLS 优先
    if (this.video.canPlayType('application/vnd.apple.mpegurl') !== ''
        || this.video.canPlayType('application/x-mpegURL') !== '') {
      this.video.src = this.url;
      this.state = 'playing';
      return;
    }

    // hls.js fallback
    const HlsCtor = typeof Hls !== 'undefined' ? Hls : null;
    if (!HlsCtor || typeof HlsCtor.isSupported !== 'function' || !HlsCtor.isSupported()) {
      throw new Error('HLS_NOT_SUPPORTED');
    }

    this.hls = new HlsCtor({
      enableWorker: true,
      lowLatencyMode: false,
    });

    this.hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR && !this._recoveredNetwork) {
        this._recoveredNetwork = true;
        this.hls.startLoad();
        return;
      }

      if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && !this._recoveredMedia) {
        this._recoveredMedia = true;
        this.hls.recoverMediaError();
        return;
      }

      this.state = 'error';
      console.error('[hls-player] fatal error', data);
    });

    this.hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
      this.state = 'playing';
    });

    this.state = 'loading';
    this.hls.loadSource(this.url);
    this.hls.attachMedia(this.video);
  }

  destroy() {
    if (this.hls) {
      try { this.hls.destroy(); } catch (_) {}
      this.hls = null;
    }
    if (this.video.src) {
      this.video.removeAttribute('src');
      try { this.video.load(); } catch (_) {}
    }
    this.state = 'idle';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HlsPlayer };
}
if (typeof window !== 'undefined') {
  window.SyncPlayHlsPlayer = HlsPlayer;
}
