const { ipcMain, shell, app } = require('electron');

function registerShellIpc(config) {
  ipcMain.handle('shell:openExternal', (_event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('shell:getAppPath', () => {
    return app.getAppPath();
  });

  ipcMain.handle('shell:getConfig', () => {
    // Expose only non-sensitive, renderer-readable config values
    return {
      FLASK_PORT: config.FLASK_PORT,
      NEXUS_PRODUCT: config.NEXUS_PRODUCT,
      APP_VERSION: app.getVersion(),
      modules: config.modules,
    };
  });
}

module.exports = { registerShellIpc };
