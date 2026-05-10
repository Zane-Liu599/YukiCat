const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yukiCat', {
  quit: () => ipcRenderer.send('yuki-cat:quit'),
  moveBy: (deltaX, deltaY) => ipcRenderer.send('yuki-cat:move-by', deltaX, deltaY),
  setIgnoreMouseEvents: (shouldIgnore) => ipcRenderer.send('yuki-cat:set-ignore-mouse-events', shouldIgnore),
  setPassThroughMode: (enabled) => ipcRenderer.send('yuki-cat:set-pass-through-mode', enabled),
  onPassThroughModeChanged: (callback) => {
    ipcRenderer.on('yuki-cat:pass-through-mode', (_event, enabled) => callback(enabled));
  },
  listAnimationFrames: (frameDirectory) => ipcRenderer.invoke('yuki-cat:list-animation-frames', frameDirectory)
});
