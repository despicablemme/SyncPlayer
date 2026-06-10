/**
 * SyncPlay Desktop - Preload Script
 * Exposes desktopAPI to renderer via contextBridge
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  platform: process.platform,
  versions: { node: process.versions.node, electron: process.versions.electron },

  // v0.6.1 FR-4: 视频添加历史记录
  videoHistory: {
    get: () => ipcRenderer.invoke('video-history:get'),
    add: (item) => ipcRenderer.invoke('video-history:add', item),
    remove: (addedAt) => ipcRenderer.invoke('video-history:remove', addedAt),
    clear: () => ipcRenderer.invoke('video-history:clear'),
    checkExists: (path) => ipcRenderer.invoke('video-history:check-exists', path),
  },

  // v0.6.1 FR-4: 从 File 对象拿绝对路径 (Electron 30+ 推荐 webUtils API)
  getPathForFile: (file) => {
    if (file && webUtils && typeof webUtils.getPathForFile === 'function') {
      return webUtils.getPathForFile(file);
    }
    return null;
  },
});
