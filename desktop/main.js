/**
 * SyncPlay Desktop - Main Process
 *
 * Architecture:
 * 1. Spawn Node child process for PeerJS signaling server (port 9000)
 * 2. Wait for server to be ready, then create BrowserWindow
 * 3. Load src/client/index.html via file:// (no Python HTTP server needed)
 * 4. On quit, kill the child server process
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// ─── Globals ────────────────────────────────────────────────────────────────
let serverProcess = null;
let mainWindow = null;

// ─── Path Resolution ─────────────────────────────────────────────────────────
// app.getAppPath() returns:
//   dev:   /path/to/syncplay/desktop
//   prod:  /path/to/SyncPlay.app/Contents/Resources/app.asar
//
// The server requires 'peer' package which is installed at desktop/node_modules/peer.
// We spawn with cwd=appPath so Node can find desktop/node_modules/peer.

function getAppPaths() {
  const appPath = app.getAppPath(); // works in both dev and prod
  return {
    serverPath: path.join(appPath, 'src', 'server', 'server.js'),
    indexPath:  path.join(appPath, 'src', 'client', 'index.html'),
    serverCwd:  appPath,  // cwd where desktop/node_modules/peer is resolveable
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
