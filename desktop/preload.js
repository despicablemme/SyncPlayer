/**
 * SyncPlay Desktop - Preload Script
 * Phase A: minimal bridge (no-op for now)
 * Phase B will expose IPC channels for advanced features
 */

const { contextBridge } = require('electron');

// Expose a minimal API to the renderer
contextBridge.exposeInMainWorld('desktopAPI', {
  platform: process.platform,
  versions: { node: process.versions.node, electron: process.versions.electron },
});
