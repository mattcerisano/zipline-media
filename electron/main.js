const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Zipline Crew",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset', // Gives that sleek Mac look with traffic lights inline
  });

  // Check if we are running in dev mode
  const isDev = !app.isPackaged;
  const startUrl = isDev 
    ? 'http://localhost:3000/crew' 
    : 'https://www.zipline.media/crew';

  mainWindow.loadURL(startUrl);

  // Open external links in the user's default browser, not the Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  createMainWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
