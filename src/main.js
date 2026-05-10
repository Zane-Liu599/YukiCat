const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

let catWindow;
const rendererRoot = path.join(__dirname, 'renderer');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function toRendererRelativePath(absolutePath) {
  return `./${path.relative(rendererRoot, absolutePath).split(path.sep).join('/')}`;
}

function resolveRendererPath(relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) {
    return null;
  }

  const sanitizedPath = relativePath.replace(/\\/g, '/').replace(/^\.?\//, '');
  const absolutePath = path.resolve(rendererRoot, sanitizedPath);
  const isInsideRenderer = absolutePath === rendererRoot || absolutePath.startsWith(`${rendererRoot}${path.sep}`);

  return isInsideRenderer ? absolutePath : null;
}

async function listAnimationFrames(frameDirectory) {
  const absoluteDirectory = resolveRendererPath(frameDirectory);

  if (!absoluteDirectory) {
    return [];
  }

  try {
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
      .map((fileName) => toRendererRelativePath(path.join(absoluteDirectory, fileName)));
  } catch {
    return [];
  }
}

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

ipcMain.handle('yuki-cat:list-animation-frames', (_event, frameDirectory) => listAnimationFrames(frameDirectory));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
