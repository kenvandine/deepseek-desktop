const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const { join } = require('path');
const fs = require('fs');
const https = require('https');

let tray = null;
let win = null;
let settingsWindow = null;
const appURL = 'https://chat.deepseek.com';
const settingsPath = join(app.getPath('userData'), 'api-settings.json');

// Armazenar configurações da API
let apiSettings = {
  provider: null,
  apiKey: null,
  model: null
};

// Carregar configurações salvas
function loadApiSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      apiSettings = JSON.parse(data);
      console.log('API Settings loaded:', { provider: apiSettings.provider, model: apiSettings.model });
    }
  } catch (error) {
    console.error('Error loading API settings:', error);
  }
}

// Salvar configurações
function saveApiSettings(settings) {
  try {
    apiSettings = settings;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('API Settings saved:', { provider: settings.provider, model: settings.model });
  } catch (error) {
    console.error('Error saving API settings:', error);
  }
}

// Fazer requisição HTTPS
function makeHttpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }

    req.end();
  });
}

// Buscar modelos do Groq
async function fetchGroqModels(apiKey) {
  const options = {
    hostname: 'api.groq.com',
    path: '/openai/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeHttpsRequest(options);
    return response.data.map(model => model.id);
  } catch (error) {
    throw new Error(`Erro ao buscar modelos do Groq: ${error.message}`);
  }
}

// Buscar modelos do DeepSeek
async function fetchDeepSeekModels(apiKey) {
  const options = {
    hostname: 'api.deepseek.com',
    path: '/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeHttpsRequest(options);
    return response.data.map(model => model.id);
  } catch (error) {
    // Se a API não suportar listagem de modelos, retornar modelos padrão
    console.log('Usando modelos padrão do DeepSeek');
    return ['deepseek-chat', 'deepseek-coder'];
  }
}

// Testar conexão com API e buscar modelos
async function testApiConnection(provider, apiKey) {
  try {
    let models = [];

    if (provider === 'groq') {
      models = await fetchGroqModels(apiKey);
    } else if (provider === 'deepseek') {
      models = await fetchDeepSeekModels(apiKey);
    }

    return { success: true, models };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Enviar mensagem para API
async function sendChatMessage(settings, messages) {
  try {
    let hostname, path;

    if (settings.provider === 'groq') {
      hostname = 'api.groq.com';
      path = '/openai/v1/chat/completions';
    } else if (settings.provider === 'deepseek') {
      hostname = 'api.deepseek.com';
      path = '/chat/completions';
    }

    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const postData = {
      model: settings.model,
      messages: messages,
      stream: false
    };

    const response = await makeHttpsRequest(options, postData);

    if (response.choices && response.choices.length > 0) {
      return {
        success: true,
        message: response.choices[0].message.content
      };
    } else {
      return {
        success: false,
        error: 'Resposta inválida da API'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Criar janela de configurações
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  settingsWindow = new BrowserWindow({
    width: 700,
    height: 700,
    x: x + ((width - 700) / 2),
    y: y + ((height - 700) / 2),
    title: 'Configurações',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.removeMenu();

  settingsWindow.on('closed', () => {
    settingsWindow = null;
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
    {
      label: 'Configurações da API',
      click: () => {
        console.log("Settings clicked");
        createSettingsWindow();
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
      // Não fazer nada, deixar o usuário escolher
    } else {
      win.loadFile('offline.html');
    }
  });

  // Carregar página inicial ao invés do chat web
  win.loadFile(join(__dirname, 'index.html'));

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

// IPC handlers para API
ipcMain.on('get-api-settings', (event) => {
  event.reply('api-settings', apiSettings);
});

ipcMain.on('save-api-settings', (event, settings) => {
  saveApiSettings(settings);
  event.reply('api-settings-saved', { success: true });
});

ipcMain.handle('test-api-connection', async (event, { provider, apiKey }) => {
  return await testApiConnection(provider, apiKey);
});

ipcMain.handle('send-chat-message', async (event, { settings, messages }) => {
  return await sendChatMessage(settings, messages);
});

ipcMain.on('start-chat', (event) => {
  if (win) {
    win.loadFile('chat.html');
    win.show();
  }
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.on('open-settings', (event) => {
  createSettingsWindow();
});

ipcMain.on('load-web-interface', (event) => {
  if (win) {
    win.loadURL(appURL);
    win.show();
  }
});

app.whenReady().then(() => {
  loadApiSettings();
  createWindow();
});

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
