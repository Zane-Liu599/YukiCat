const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yukiCat', {
  quit: () => ipcRenderer.send('yuki-cat:quit'),
  moveBy: (deltaX, deltaY) => ipcRenderer.send('yuki-cat:move-by', deltaX, deltaY)
});
