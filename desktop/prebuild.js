const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DEST = path.join(__dirname, 'src');
function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  fs.readdirSync(s).forEach(f => {
    const sp = path.join(s, f), dp = path.join(d, f);
    fs.statSync(sp).isDirectory() ? copyDir(sp, dp) : fs.copyFileSync(sp, dp);
  });
}
copyDir(SRC, DEST);

// 拷贝媒体依赖到 public/ (供应用运行时本地加载, 避免 CDN + COEP 跨域问题)
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(PUBLIC, { recursive: true });
fs.mkdirSync(path.join(PUBLIC, 'ffmpeg'), { recursive: true });

const hlsSrc = path.join(__dirname, 'node_modules', 'hls.js', 'dist', 'hls.min.js');
const hlsDest = path.join(PUBLIC, 'hls.min.js');
if (fs.existsSync(hlsSrc)) { fs.copyFileSync(hlsSrc, hlsDest); console.log('[prebuild] hls.min.js ->', hlsDest); }

const ffmpegSrc = path.join(__dirname, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const ffmpegDest = path.join(PUBLIC, 'ffmpeg');
if (fs.existsSync(ffmpegSrc)) {
  let count = 0;
  for (const f of fs.readdirSync(ffmpegSrc)) {
    if (f.endsWith('.js') || f.endsWith('.wasm')) {
      fs.copyFileSync(path.join(ffmpegSrc, f), path.join(ffmpegDest, f));
      count++;
    }
  }
  console.log('[prebuild] ffmpeg-core.* ('+count+' files) ->', ffmpegDest);
}
