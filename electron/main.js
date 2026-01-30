const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

console.log('Electron main process started');

let mainWindow;

const createMainWindow = () => {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Zipline Crew",
    icon: path.join(__dirname, '../public/Zipline Logo 10x10_Black Text Blue.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
  });

  const isDev = !app.isPackaged;
  const startUrl = isDev 
    ? 'http://localhost:3000/crew' 
    : 'https://www.zipline.media/crew';

  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl, {
    extraHeaders: 'x-zipline-client: desktop-app'
  });

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
  
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
  });
};

app.on('ready', () => {
  console.log('App ready event fired');
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
