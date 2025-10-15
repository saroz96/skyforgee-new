const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Start backend server from the backend/ directory
  backendProcess = spawn('npm', ['run', 'start'], {
    cwd: path.join(__dirname, '../backend'), // Correct path
    shell: true,
    stdio: 'inherit',
  });

  backendProcess.on('error', (err) => {
    console.error('Backend failed to start:', err);
    mainWindow.loadFile(path.join(__dirname, '../frontend/build/error.html')); // Fallback
  });

  const startUrl = 'https://skyforgee.com';
  const checkServer = setInterval(() => {
    fetch(startUrl)
      .then(() => {
        clearInterval(checkServer);
        mainWindow.loadURL(startUrl);
      })
      .catch(() => {
        console.log('Waiting for backend...');
      });
  }, 1000);

  // Optional: Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});