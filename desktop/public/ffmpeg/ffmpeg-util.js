'use strict';
/* v0.7.0.1 round 2: 浏览器端 @ffmpeg/util shim (上游 umd bundle 在 renderer 抛 ReferenceError, 详见 prebuild.js) */
(function (global) {
  function fetchFile(target) {
    if (typeof target === 'string') {
      const dataMatch = target.match(new RegExp('^data:[^;,]*;base64,(.*)$'));
      if (dataMatch) {
        const binary = atob(dataMatch[2]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return Promise.resolve(bytes);
      }
      return fetch(target).then(function (res) { return res.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
    }
    if (target instanceof URL) {
      return fetch(target).then(function (res) { return res.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
    }
    if (target instanceof File || target instanceof Blob) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          const result = reader.result;
          resolve(result instanceof ArrayBuffer ? new Uint8Array(result) : new Uint8Array(result));
        };
        reader.onerror = function () { reject(new Error('File could not be read! Code=' + (reader.error && reader.error.code || -1))); };
        reader.readAsArrayBuffer(target);
      });
    }
    return Promise.resolve(new Uint8Array(0));
  }

  function importScript(url) {
    return new Promise(function (resolve) {
      const script = document.createElement('script');
      const onLoad = function () { script.removeEventListener('load', onLoad); resolve(); };
      script.src = url;
      script.type = 'text/javascript';
      script.addEventListener('load', onLoad);
      document.getElementsByTagName('head')[0].appendChild(script);
    });
  }

  function downloadWithProgress(url, onProgress) {
    return fetch(url).then(function (res) {
      const total = parseInt(res.headers.get('content-length') || '-1', 10);
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (!reader) {
        return res.arrayBuffer().then(function (buf) {
          if (onProgress) onProgress({ url: url, total: buf.byteLength, received: buf.byteLength, delta: 0, done: true });
          return buf;
        });
      }
      const chunks = [];
      let received = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) {
            if (total !== -1 && total !== received) throw new Error('Incompleted download');
            if (onProgress) onProgress({ url: url, total: total, received: received, delta: 0, done: true });
            const out = new Uint8Array(received);
            let offset = 0;
            for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
            return out.buffer;
          }
          received += step.value.length;
          chunks.push(step.value);
          if (onProgress) onProgress({ url: url, total: total, received: received, delta: step.value.length, done: false });
          return pump();
        });
      }
      return pump().catch(function () {
        return res.arrayBuffer().then(function (buf) {
          if (onProgress) onProgress({ url: url, total: buf.byteLength, received: buf.byteLength, delta: 0, done: true });
          return buf;
        });
      });
    });
  }

  function toBlobURL(url, mime, withProgress, onProgress) {
    const download = withProgress ? downloadWithProgress(url, onProgress) : fetch(url).then(function (r) { return r.arrayBuffer(); });
    return download.then(function (bytes) {
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    });
  }

  global.FFmpegUtil = {
    fetchFile: fetchFile,
    importScript: importScript,
    downloadWithProgress: downloadWithProgress,
    toBlobURL: toBlobURL,
  };
})(typeof window !== 'undefined' ? window : globalThis);
