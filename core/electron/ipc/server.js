const { ipcMain } = require('electron');

let flaskPort = null;

function setFlaskPort(port) {
  flaskPort = port;
}

function registerServerIpc() {
  ipcMain.handle('server:health', async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${flaskPort}/api/health`);
      const json = await response.json();
      return { ok: true, data: json.data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerServerIpc, setFlaskPort };
