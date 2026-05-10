const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

let catWindow;

function createCatWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = 320;
  const height = 320;

  catWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(workAreaSize.width - width - 72),
    y: Math.round(workAreaSize.height - height - 72),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  catWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  });
  catWindow.setAlwaysOnTop(true, 'floating');

  catWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  catWindow.once('ready-to-show', () => catWindow.showInactive());
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createCatWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createCatWindow();
    }
  });
});

ipcMain.on('yuki-cat:quit', () => {
  app.quit();
});

ipcMain.on('yuki-cat:move-by', (_event, deltaX, deltaY) => {
  if (!catWindow || catWindow.isDestroyed()) {
    return;
  }

  const [x, y] = catWindow.getPosition();
  catWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY), false);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
