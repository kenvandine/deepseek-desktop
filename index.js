const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell, safeStorage } = require('electron');
const { join } = require('path');
const fs = require('fs');
const https = require('https');

// Suppress common Linux Electron warnings
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--ignore-certificate-errors');
app.commandLine.appendSwitch('--disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('--disable-gpu');

let tray = null;
let win = null;
const appURL = 'https://chat.deepseek.com'
const API_KEY_FILE = join(app.getPath('userData'), 'api_key.enc');

// API Key Management Functions
function saveApiKeyToFile(apiKey) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      fs.writeFileSync(API_KEY_FILE, encrypted);
      return true;
    } else {
      // Fallback: save encoded (not secure, but better than nothing)
      const encoded = Buffer.from(apiKey).toString('base64');
      fs.writeFileSync(API_KEY_FILE, encoded);
      console.warn('Encryption not available, using base64 encoding');
      return true;
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    return false;
  }
}

function loadApiKeyFromFile() {
  try {
    if (!fs.existsSync(API_KEY_FILE)) {
      return null;
    }

    const data = fs.readFileSync(API_KEY_FILE);

    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(data);
    } else {
      // Fallback: decode base64
      return Buffer.from(data.toString(), 'base64').toString('utf-8');
    }
  } catch (error) {
    console.error('Error loading API key:', error);
    return null;
  }
}

function hasApiKey() {
  return fs.existsSync(API_KEY_FILE);
}

// DeepSeek API Functions
async function callDeepSeekAPI(messages, model = 'deepseek-chat') {
  const apiKey = loadApiKeyFromFile();

  if (!apiKey) {
    throw new Error('API key not found');
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model,
      messages: messages,
      stream: false
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(responseData);
            resolve({
              success: true,
              content: parsed.choices[0].message.content,
              usage: parsed.usage
            });
          } else {
            const error = JSON.parse(responseData);
            resolve({
              success: false,
              error: error.error?.message || `HTTP ${res.statusCode}: ${responseData}`
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: 'Failed to parse API response: ' + error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: 'Network error: ' + error.message
      });
    });

    req.write(data);
    req.end();
  });
}

async function testApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true });
        } else {
          try {
            const error = JSON.parse(responseData);
            resolve({
              success: false,
              error: error.error?.message || `HTTP ${res.statusCode}`
            });
          } catch {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}: ${responseData.substring(0, 100)}`
            });
          }
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.write(data);
    req.end();
  });
}

function createWindow () {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  // Log geometry information for easier debugging
  console.log(`Primary Screen Geometry - Width: ${width} Height: ${height} X: ${x} Y: ${y}`);

  const icon = nativeImage.createFromPath(join(__dirname, 'icon.png'));

  win = new BrowserWindow({
    width: width * 0.6,
    height: height * 0.8,
    x: x + ((width - (width * 0.6)) / 2),
    y: y + ((height - (height * 0.8)) / 2),
    icon: icon,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false
    }
  });

  win.removeMenu();

  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide DeepSeek',
      icon: icon,
      click: () => {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
        }
      }
    },
    { type: 'separator' },
    { label: 'About',
      click: () => {
	console.log("About clicked");
	createAboutWindow();
      }
    },
    { label: 'Quit',
      click: () => {
	console.log("Quit clicked, Exiting");
	app.exit();
      }
    },
  ]);

  tray.setToolTip('DeepSeek');
  tray.setContextMenu(contextMenu);

  ipcMain.on('zoom-in', () => {
    console.log('zoom-in');
    const currentZoom = win.webContents.getZoomLevel();
    win.webContents.setZoomLevel(currentZoom + 1);
  });

  ipcMain.on('zoom-out', () => {
    console.log('zoom-out');
    const currentZoom = win.webContents.getZoomLevel();
    win.webContents.setZoomLevel(currentZoom - 1);
  });

  ipcMain.on('zoom-reset', () => {
    console.log('zoom-reset');
    win.webContents.setZoomLevel(0);
  });

  ipcMain.on('log-message', (event, message) => {
    console.log('Log from preload: ', message);
  });

  // Open links with default browser
  ipcMain.on('open-external-link', (event, url) => {
    console.log('open-external-link: ', url);
    shell.openExternal(url);
  });

  // Listen for network status updates from the renderer process
  ipcMain.on('network-status', (event, isOnline) => {
    console.log(`Network status: ${isOnline ? 'online' : 'offline'}`);
    console.log("network-status changed: " + isOnline);
    if (isOnline) {
      win.loadURL(appURL);
    } else {
      win.loadFile('offline.html');
    }
  });

  // Load appropriate page based on API key existence
  if (hasApiKey()) {
    console.log('API key found, loading chat interface');
    win.loadFile(join(__dirname, 'chat.html'));
  } else {
    console.log('No API key found, loading configuration page');
    win.loadFile(join(__dirname, 'apikey-config.html'));
  }

  // Link clicks open new windows, let's force them to open links in
  // the default browser
  win.webContents.setWindowOpenHandler(({url}) => {
    console.log('windowOpenHandler: ', url);
    shell.openExternal(url);
    return { action: 'deny' }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'r') {
      console.log('Pressed Control+R')
      event.preventDefault()
      win.loadURL(appURL);
    }
  })
}

// Ensure we're a single instance app
const firstInstance = app.requestSingleInstanceLock();

if (!firstInstance) {
  app.quit();
} else {
  app.on("second-instance", (event) => {
    console.log("second-instance");
    win.show();
  });
}

function createAboutWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  const aboutWindow = new BrowserWindow({
    width: 500,
    height: 300,
    x: x + ((width - 500) / 2),
    y: y + ((height - 500) / 2),
    title: 'About',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    modal: true,  // Make the About window modal
    parent: win  // Set the main window as parent
  });

  aboutWindow.loadFile('about.html');
  aboutWindow.removeMenu();

  // Read version from package.json
  const packageJson = JSON.parse(fs.readFileSync(join(__dirname, 'package.json')));
  const appVersion = packageJson.version;
  const appDescription = packageJson.description;
  const appTitle = packageJson.title;
  const appBugsUrl = packageJson.bugs.url;
  const appHomePage = packageJson.homepage;
  const appAuthor = packageJson.author;

  // Send version to the About window
  aboutWindow.webContents.on('did-finish-load', () => {
    console.log("did-finish-load", appTitle);
    aboutWindow.webContents.send('app-version', appVersion);
    aboutWindow.webContents.send('app-description', appDescription);
    aboutWindow.webContents.send('app-title', appTitle);
    aboutWindow.webContents.send('app-bugs-url', appBugsUrl);
    aboutWindow.webContents.send('app-homepage', appHomePage);
    aboutWindow.webContents.send('app-author', appAuthor);
  });
  // Link clicks open new windows, let's force them to open links in
  // the default browser
  aboutWindow.webContents.setWindowOpenHandler(({url}) => {
    console.log('windowOpenHandler: ', url);
    shell.openExternal(url);
    return { action: 'deny' }
  });
}

ipcMain.on('get-app-metadata', (event) => {
    const packageJson = JSON.parse(fs.readFileSync(join(__dirname, 'package.json')));
    const appVersion = packageJson.version;
    const appDescription = packageJson.description;
    const appTitle = packageJson.title;
    const appBugsUrl = packageJson.bugs.url;
    const appHomePage = packageJson.homepage;
    const appAuthor = packageJson.author;
    event.sender.send('app-version', appVersion);
    event.sender.send('app-description', appDescription);
    event.sender.send('app-title', appTitle);
    event.sender.send('app-bugs-url', appBugsUrl);
    event.sender.send('app-homepage', appHomePage);
    event.sender.send('app-author', appAuthor);
});

// API Key IPC Handlers
ipcMain.handle('test-api-key', async (event, apiKey) => {
  console.log('Testing API key...');
  return await testApiKey(apiKey);
});

ipcMain.handle('check-api-key', async (event) => {
  return hasApiKey();
});

ipcMain.on('save-api-key', (event, apiKey) => {
  console.log('Saving API key...');
  const saved = saveApiKeyToFile(apiKey);

  if (saved) {
    console.log('API key saved successfully');
    event.sender.send('api-key-saved');

    // Load chat interface
    setTimeout(() => {
      win.loadFile(join(__dirname, 'chat.html'));
    }, 1000);
  } else {
    console.error('Failed to save API key');
  }
});

ipcMain.on('load-chat', (event) => {
  console.log('Loading chat interface...');
  win.loadFile(join(__dirname, 'chat.html'));
});

ipcMain.on('open-api-key-config', (event) => {
  console.log('Opening API key configuration...');
  win.loadFile(join(__dirname, 'apikey-config.html'));
});

ipcMain.handle('send-chat-message', async (event, data) => {
  console.log('Sending chat message to DeepSeek API...');
  const { messages, model } = data;

  try {
    const response = await callDeepSeekAPI(messages, model);
    console.log('API response received');
    return response;
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  console.log("window-all-closed");
});

app.on('activate', () => {
  console.log("ACTIVATE");
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('ready', () => {
  console.log(`Electron Version: ${process.versions.electron}`);
  console.log(`App Version: ${app.getVersion()}`);
});
