const { app, BrowserWindow } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const { registerServerIpc, setFlaskPort } = require('./ipc/server');
const { registerShellIpc } = require('./ipc/shell');

// ─── Config from environment ───────────────────────────────────────────────

const FLASK_PORT = parseInt(process.env.FLASK_PORT || '5199', 10);
const NEXUS_PRODUCT = process.env.NEXUS_PRODUCT || 'unknown';

const config = {
  FLASK_PORT,
  NEXUS_PRODUCT,
};

// ─── State ─────────────────────────────────────────────────────────────────

let flaskProcess = null;
let mainWindow = null;
let isQuitting = false;

// ─── Flask process management ───────────────────────────────────────────────

function killProcessOnPort(port) {
  try {
    // Windows: find and kill any process using the port
    const result = execSync(
      `netstat -ano | findstr :${port}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const lines = result.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[main] Killed zombie process PID=${pid} on port ${port}`);
        } catch (_) {
          // Process may have already exited
        }
      }
    }
  } catch (_) {
    // Port was not in use — no zombie to kill
  }
}

function spawnFlask() {
  // Kill any zombie from a previous crashed session
  killProcessOnPort(FLASK_PORT);

  const serverDir = path.join(__dirname, '..', '..', 'core', 'server');
  const projectRoot = path.join(__dirname, '..', '..');

  const env = {
    ...process.env,
    FLASK_PORT: String(FLASK_PORT),
    NEXUS_PRODUCT,
    PYTHONPATH: projectRoot,
  };

  flaskProcess = spawn('python', ['run.py'], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  flaskProcess.stdout.on('data', (data) => {
    console.log(`[flask] ${data.toString().trim()}`);
  });

  flaskProcess.stderr.on('data', (data) => {
    console.error(`[flask:err] ${data.toString().trim()}`);
  });

  flaskProcess.on('exit', (code, signal) => {
    if (!isQuitting) {
      console.error(`[main] Flask exited unexpectedly (code=${code}, signal=${signal})`);
    }
  });

  console.log(`[main] Flask spawned (PID=${flaskProcess.pid}) on port ${FLASK_PORT}`);
}

function killFlask() {
  if (!flaskProcess) return Promise.resolve();

  return new Promise((resolve) => {
    flaskProcess.on('exit', resolve);

    // Windows requires taskkill — process.kill() may not propagate to child trees
    try {
      execSync(`taskkill /PID ${flaskProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch (_) {
      try {
        flaskProcess.kill('SIGTERM');
      } catch (__) {
        // Already gone
      }
    }

    // Resolve after a short timeout regardless of exit event
    setTimeout(resolve, 2000);
  });
}

// ─── Health check polling ────────────────────────────────────────────────────

async function waitForFlask(maxAttempts = 10, intervalMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${FLASK_PORT}/api/health`);
      if (response.ok) {
        console.log(`[main] Flask healthy after ${attempt} attempt(s)`);
        return true;
      }
    } catch (_) {
      // Not ready yet
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createLoadingWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 280,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#1a1a2e',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  // Inline loading screen — no external file needed for this simple state
  win.loadURL(`data:text/html,
    <html>
    <head><style>
      body { margin:0; background:#1a1a2e; display:flex; flex-direction:column;
             align-items:center; justify-content:center; height:100vh;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#e0e0e0; }
      h2 { font-size:18px; font-weight:500; margin:0 0 8px; letter-spacing:0.05em; }
      p  { font-size:12px; color:#888; margin:0; }
    </style></head>
    <body>
      <h2>NEXUS</h2>
      <p>Starting services…</p>
    </body>
    </html>
  `);

  return win;
}

function createMainWindow() {
  const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile(rendererPath);

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  setFlaskPort(FLASK_PORT);
  registerServerIpc();
  registerShellIpc(config);

  const loadingWindow = createLoadingWindow();
  spawnFlask();

  const healthy = await waitForFlask();

  if (!healthy) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Nexus — Startup Error',
      `Flask API server did not respond on port ${FLASK_PORT}.\n\nCheck that Python is installed and the port is not blocked.`
    );
    app.quit();
    return;
  }

  mainWindow = createMainWindow();
  loadingWindow.close();
});

app.on('before-quit', async (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  await killFlask();
  app.exit(0);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});
