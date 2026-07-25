# 测试样本 — 9 格式矩阵 (per Claude Round 2 §7)

> **用途**: v0.7 阶段 C 主人实测 (debug build → .dmg → 手动测)
> **Stage**: B-E 写文档, B-F release 后阶段 C 主人下载
> **CI / sandbox 跑不动**: 全部 Electron renderer 环境依赖 (MediaSource + Worker + SAB) 才能跑

---

## 主人本地样本 (已验证存在)

| 格式 | 路径 | 大小 | codec |
|------|------|------|-------|
| mkv H.264 (BD 720p) | `/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv` | 1.5 GB (B-D 验证: `ls -lh` 显示 1.5G, 文件头写 1.64G 是按 1GB=1024MB 算) | H.264 + AAC 5.1 |

验证命令:

```bash
ls -lh "/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv"
ffprobe "/Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv" -show_streams
```

---

## 公网测试样本 URL (主人实测前 wget 下载)

### 视频格式 (8 个公网 URL, 覆盖 mp4 H.264 / H.265 / webm VP9 / AV1 / m3u8 HLS / avi / flv)

| # | 格式 | URL | codec | 期望路径 |
|---|------|-----|-------|---------|
| 1 | mp4 H.264 | `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4` | avc1 | 原生 `<video>` |
| 2 | mp4 H.265 | `https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/720/Big_Buck_Bunny_720_10s_1MB.mp4` | hvc1 | 原生 `<video>` (硬解: VTDecoderXPCService CPU > 0) |
| 3 | webm VP9 | `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.webm` | VP9 | 原生 `<video>` |
| 4 | webm AV1 | `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides-AV1-8bit-51.webm` | AV1 | 原生 `<video>` (硬解: M1+ / RTX 30+ / RX 6000+) |
| 5 | m3u8 HLS | `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` | avc1 (HLS segments) | hls.js → MSE → `<video>` |
| 6 | avi | `https://test-videos.co.uk/vids/bigbuckbunny/avi/Big_Buck_Bunny_360_10s_1MB.avi` | Xvid/MJPEG | ffmpeg.wasm → fMP4 → MSE → `<video>` |
| 7 | flv | `https://test-videos.co.uk/vids/bigbuckbunny/flv/Big_Buck_Bunny_360_10s_1MB.flv` | H.263/H.264 | ffmpeg.wasm → fMP4 → MSE → `<video>` |
| 8 | **mkv H.264 (主人样本)** | `file:///Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv` | avc1 + AAC 5.1 | ffmpeg.wasm → fMP4 → MSE → `<video>` (硬解证据: VTDecoderXPCService CPU > 0) |

主人 wget 下载:

```bash
mkdir -p ~/Downloads/syncplay-test-samples
cd ~/Downloads/syncplay-test-samples

wget https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
wget https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/720/Big_Buck_Bunny_720_10s_1MB.mp4
wget https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.webm
wget https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides-AV1-8bit-51.webm
wget https://test-videos.co.uk/vids/bigbuckbunny/avi/Big_Buck_Bunny_360_10s_1MB.avi
wget https://test-videos.co.uk/vids/bigbuckbunny/flv/Big_Buck_Bunny_360_10s_1MB.flv

# mkv H.265 (4K HEVC) — 主人另外找 (公网没稳定 URL):
# wget https://test-videos.co.uk/vids/bigbuckbunny/mkv/Big_Buck_Bunny_4K_HEVC.mkv
```

### mkv H.265 (4K HEVC) — 公网无稳定源

主人实测前主人自己找一个 mkv H.265 样本 (4K HEVC, 100MB 即可), 推荐:

- <https://test-videos.co.uk/bigbuckbunny/mkv-h265> (待主人实测)
- 或任意本地 .mkv (HEVC/H.265 codec, ffprobe `codec_name=hevc`)

---

## 测试矩阵 → 期望路径表 (per Claude Round 2 §7)

```
                         ┌──────────────────────────────────────────────────┐
                         │ loadVideo(url) 决策树 (B-A/B/B/C/D 加的)        │
                         ├──────────────────────────────────────────────────┤
                         │ url *.m3u8                                       │
                         │   → hls.js → MSE → <video>                       │
                         │                                                  │
                         │ url *.mp4 / *.webm (H.264/H.265/VP9/AV1)         │
                         │   → 原生 <video> (Chrome 自带硬解)                │
                         │                                                  │
                         │ url *.mkv / *.avi / *.flv                        │
                         │   → ffmpeg.wasm transmux → fMP4 → MSE → <video>  │
                         └──────────────────────────────────────────────────┘
```

---

## 主人实测命令 (阶段 C, 阶段 B-F release 后)

```bash
# 1. 装 .dmg
open desktop/dist/SyncPlay-0.7.0.dmg

# 2. 启动 app (dev mode 打开 DevTools 看 console)
cd ~/CodeProjects/syncplay
cd desktop && npm run dev

# 3. 主人本地样本: 创建房间 + 第二个窗口
#    - 窗口 A: /Volumes/Claw/太空旅客.BD.720p.中英双字幕.mkv
#    - 窗口 B: 同文件 (URL 一致)

# 4. 公网样本: 逐个在窗口 A 加载, 看 chrome://gpu + Activity Monitor + 主进程 CPU
#    每格式填一格 v0.7-B-E-test-report.md §4

# 5. chrome://gpu 看 "Video Acceleration Information" 段
# 6. Activity Monitor 看 VTDecoderXPCService CPU
# 7. 主进程 CPU < 20%
```

---

## 已知限制 (per MEMORY #46 + sandbox 跑不动)

- ❌ sandbox 跑不动 Electron renderer + SAB
- ❌ sandbox 跑不动大文件 (太空旅客.mkv 1.5 GB)
- ❌ 公网 URL 不一定一直稳定 (公网链接会失效)
- ✅ Electron renderer + SAB + 主进程 + chrome://gpu 只能在主人本地

---

## 引用

- `tasks/v0.7.0/02-execution-plan.md` §7 测试矩阵 + §8 硬解证据链 + §9 DoD
- `tasks/v0.7.0/v0.7-B-E-test-report.md` (B-E 报告)
- `desktop/test/integration/multi-format-matrix.test.js` (B-E 集成测试)
- `desktop/test/integration/sync-dual-window.test.js` (B-E 双窗口同步回归)
- `desktop/test/integration/hw-decode-evidence.test.js` (B-E 硬解证据链)