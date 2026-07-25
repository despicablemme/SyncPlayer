/**
 * SyncPlay Desktop - Main Process
 *
 * Architecture:
 * 1. Spawn Node child process for PeerJS signaling server (port 9000)
 * 2. Wait for server to be ready, then create BrowserWindow
 * 3. Load src/client/index.html via file:// (no Python HTTP server needed)
 * 4. On quit, kill the child server process
 */

const { app, BrowserWindow, ipcMain, webUtils, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

// ─── Globals ────────────────────────────────────────────────────────────────
let serverProcess = null;
let mainWindow = null;

// ─── Video History Store (v0.6.1 FR-4) ─────────────────────────────────────
const videoHistoryStore = new Store({
  name: 'video-history',
  defaults: { items: [] },
});
const MAX_HISTORY = 20;

// ─── Path Resolution ─────────────────────────────────────────────────────────
// app.getAppPath() returns:
//   dev:   /path/to/syncplay/desktop
//   prod:  /path/to/SyncPlay.app/Contents/Resources/app.asar  (FILE)
//
// In prod, server.js and node_modules/peer are unpacked (asarUnpack) to:
//   Resources/app.asar.unpacked/src/server/server.js
//   Resources/app.asar.unpacked/node_modules/peer
//
// We must spawn with cwd=Resources/ (a real dir) and point serverPath at
// the unpacked copy so the child Node process can access both the script
// and the peer package on the real filesystem.

function getAppPaths() {
  const appPath = app.getAppPath(); // works in both dev and prod
  const appDir  = path.dirname(appPath); // prod → Resources/  dev → desktop/
  const isPacked = appPath.endsWith('.asar');

  return {
    // In prod use the unpacked copy; in dev use the normal path
    serverPath: isPacked
      ? path.join(appDir, 'app.asar.unpacked', 'src', 'server', 'server.js')
      : path.join(appPath, 'src', 'server', 'server.js'),
    indexPath:  path.join(appPath, 'src', 'client', 'index.html'),
    serverCwd:  appDir,
  };
}

// ─── Server ─────────────────────────────────────────────────────────────────

function startServer() {
  const { serverPath, serverCwd } = getAppPaths();

  console.log(`[SyncPlay] Starting signaling server:`);
  console.log(`  serverPath: ${serverPath}`);
  console.log(`  serverCwd:  ${serverCwd}`);

  serverProcess = spawn('node', [serverPath], {
    cwd: serverCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PEER_PORT: '9000' },
  });

  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(`[server] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(`[server:err] ${data}`);
  });

  serverProcess.on('error', (err) => {
    console.error('[SyncPlay] Failed to start server:', err.message);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[SyncPlay] Server exited with code=${code} signal=${signal}`);
  });
}

// ─── Window ─────────────────────────────────────────────────────────────────

function createWindow() {
  const { indexPath } = getAppPaths();

  console.log(`[SyncPlay] Loading: file://${indexPath}`);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'SyncPlay',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(indexPath).catch((err) => {
    console.error('[SyncPlay] Failed to load index.html:', err.message);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log console errors from renderer (error level only)
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) {
      console.error(`[renderer:error] ${message}`);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[SyncPlay] Renderer process gone:', details.reason);
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

function waitForServer(port = 9000, timeout = 15000) {
  return new Promise((resolve) => {
    const net = require('net');
    const client = new net.Socket();
    const timer = setTimeout(() => {
      client.destroy();
      console.warn('[SyncPlay] Server port not open after timeout, proceeding anyway...');
      resolve();
    }, timeout);

    client.connect(port, 'localhost', () => {
      clearTimeout(timer);
      client.destroy();
      console.log(`[SyncPlay] Server ready on port ${port}`);
      resolve();
    });

    client.on('error', () => {
      clearTimeout(timer);
      client.destroy();
      console.warn('[SyncPlay] Server port not open yet, proceeding anyway...');
      resolve();
    });
  });
}

app.whenReady().then(async () => {
  console.log('[syncplay-init]', JSON.stringify({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    sab: typeof SharedArrayBuffer !== 'undefined',
    webcodecs: typeof VideoDecoder !== 'undefined',
  }, null, 2));

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    });
  });

  // ─── Video History IPC Handlers (v0.6.1 FR-4) ────────────────────────────
  ipcMain.handle('video-history:get', () => {
    return videoHistoryStore.get('items', []);
  });

  ipcMain.handle('video-history:add', (event, item) => {
    if (!item || !item.type) {
      throw new Error('video-history:add: item.type is required');
    }
    if (item.type !== 'local' && item.type !== 'url') {
      throw new Error(`video-history:add: unknown type ${item.type}`);
    }
    const items = videoHistoryStore.get('items', []);
    const dedupeKey = item.type === 'local' ? `local:${item.path}` : `url:${item.url}`;
    const filtered = items.filter(existing => {
      const existingKey = existing.type === 'local' ? `local:${existing.path}` : `url:${existing.url}`;
      return existingKey !== dedupeKey;
    });
    filtered.unshift(item);
    const truncated = filtered.slice(0, MAX_HISTORY);
    videoHistoryStore.set('items', truncated);
    return truncated;
  });

  ipcMain.handle('video-history:remove', (event, addedAt) => {
    if (typeof addedAt !== 'number') {
      throw new Error('video-history:remove: addedAt must be a number');
    }
    const items = videoHistoryStore.get('items', []);
    const filtered = items.filter(item => item.addedAt !== addedAt);
    videoHistoryStore.set('items', filtered);
    return filtered;
  });

  ipcMain.handle('video-history:clear', () => {
    videoHistoryStore.set('items', []);
    return [];
  });

  ipcMain.handle('video-history:check-exists', (event, filePath) => {
    if (typeof filePath !== 'string') {
      return false;
    }
    try {
      return fs.existsSync(filePath);
    } catch (e) {
      return false;
    }
  });

  startServer();
  await waitForServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function cleanup() {
  if (serverProcess) {
    console.log('[SyncPlay] Killing server process...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
    }, 3000).unref();
  }
}

app.on('before-quit', () => {
  cleanup();
});
