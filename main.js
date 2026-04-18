const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path'); 

let currentUser = null;
let mainWindow = null;
  

// CREATE THE ELECTRON WINDOW 
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    
    icon: path.join(__dirname, 'assets', 'logo.png'),
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}


// IPC HANDLERS 
// IPC 01 — user:init

ipcMain.handle('01:user:init', (_event, userData) => {
  currentUser = {
    name: userData.name,
    photo: userData.photo 
  };
  console.log('[IPC 01] User initialized:', currentUser.name);
  return { ok: true };
});

// IPC 02 — user:get
ipcMain.handle('02:user:get', () => {
  return currentUser;
});


// APP LIFECYCLE 
app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

