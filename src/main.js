const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');

let catWindow;
let tray;
let isPassThroughEnabled = true;
let debugReadline;
const rendererRoot = path.join(__dirname, 'renderer');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const debugActions = [
  'sit',
  'sit-left',
  'sit-right',
  'blink',
  'front',
  'back',
  'front-back',
  'walk',
  'crawl',
  'crawl-rest',
  'lie',
  'leave-crawl',
  'leave-lie',
  'random'
];

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

function sendPassThroughMode() {
  if (!catWindow || catWindow.isDestroyed()) {
    return;
  }

  catWindow.webContents.send('yuki-cat:pass-through-mode', isPassThroughEnabled);
  if (!isPassThroughEnabled) {
    catWindow.setIgnoreMouseEvents(false);
  }
}

function setPassThroughMode(enabled) {
  isPassThroughEnabled = enabled;
  sendPassThroughMode();
  updateTrayMenu();
}

function sendDebugAction(action) {
  if (!catWindow || catWindow.isDestroyed()) {
    console.log('[debug] cat window is not ready');
    return;
  }

  catWindow.webContents.send('yuki-cat:debug-action', action);
}

function printDebugHelp() {
  console.log(`[debug] type an action then Enter: ${debugActions.join(', ')}`);
  console.log('[debug] animation sequence names also work, e.g. crawlToLie, lieToCrawl, turnFrontToBack');
  console.log('[debug] type help/actions to show this list again');
}

function setupDebugInput() {
  if (debugReadline || !process.stdin.isTTY) {
    return;
  }

  debugReadline = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  printDebugHelp();

  debugReadline.on('line', (line) => {
    const action = line.trim();

    if (!action) {
      return;
    }

    if (action === 'help' || action === 'actions') {
      printDebugHelp();
      return;
    }

    sendDebugAction(action);
  });
}

function showCatWindow() {
  if (!catWindow || catWindow.isDestroyed()) {
    createCatWindow();
    return;
  }

  catWindow.showInactive();
}

function hideCatWindow() {
  if (!catWindow || catWindow.isDestroyed()) {
    return;
  }

  catWindow.hide();
}

function createTrayIcon() {
  const iconPath = path.join(rendererRoot, 'assets/yuki-sit-right.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  return icon;
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const isVisible = Boolean(catWindow && !catWindow.isDestroyed() && catWindow.isVisible());
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏小猫' : '显示小猫',
      click: () => {
        if (isVisible) {
          hideCatWindow();
        } else {
          showCatWindow();
        }
        updateTrayMenu();
      }
    },
    {
      label: '透明区域点穿',
      type: 'checkbox',
      checked: isPassThroughEnabled,
      click: (menuItem) => setPassThroughMode(menuItem.checked)
    },
    { type: 'separator' },
    {
      label: '退出 YukiCat',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip('YukiCat');
  tray.on('click', () => {
    showCatWindow();
    updateTrayMenu();
  });
  updateTrayMenu();
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
  catWindow.once('ready-to-show', () => {
    catWindow.showInactive();
    sendPassThroughMode();
    updateTrayMenu();
  });
  catWindow.on('show', updateTrayMenu);
  catWindow.on('hide', updateTrayMenu);
  catWindow.on('closed', () => {
    catWindow = null;
    updateTrayMenu();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createTray();
  createCatWindow();
  setupDebugInput();

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

ipcMain.on('yuki-cat:set-ignore-mouse-events', (_event, shouldIgnore) => {
  if (!catWindow || catWindow.isDestroyed()) {
    return;
  }

  if (!isPassThroughEnabled) {
    catWindow.setIgnoreMouseEvents(false);
    return;
  }

  catWindow.setIgnoreMouseEvents(Boolean(shouldIgnore), { forward: true });
});

ipcMain.on('yuki-cat:set-pass-through-mode', (_event, enabled) => {
  setPassThroughMode(Boolean(enabled));
});

ipcMain.on('yuki-cat:debug-action-result', (_event, result) => {
  if (!result || typeof result !== 'object') {
    return;
  }

  const prefix = result.ok ? '[debug]' : '[debug:error]';
  console.log(`${prefix} ${result.message}`);
});

ipcMain.handle('yuki-cat:list-animation-frames', (_event, frameDirectory) => listAnimationFrames(frameDirectory));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
