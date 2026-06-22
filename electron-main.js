const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
let serverProcess;

// Debug log file for troubleshooting
const logFile = path.join(__dirname, 'electron-debug.log');
function debugLog(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

// Brand configuration (loaded at startup)
let brandConfig = {
  brandURI: 'http://localhost:6029',
  demoMode: true, // Default to demo mode for safety
};

/**
 * Load brand configuration from brand-selection.json and brand-features.json
 */
function loadBrandConfig() {
  const isDev = !app.isPackaged;

  // Determine the base path for config files
  const basePath = isDev
    ? __dirname
    : path.join(process.resourcesPath, 'server');

  try {
    // Read brand selection
    const brandSelectionPath = path.join(basePath, 'lib', 'brand-selection.json');
    if (!fs.existsSync(brandSelectionPath)) {
      console.log('Brand selection file not found, using defaults');
      return;
    }

    const brandSelection = JSON.parse(fs.readFileSync(brandSelectionPath, 'utf8'));
    if (!brandSelection.brand) {
      console.log('No brand selected, using defaults');
      return;
    }

    console.log(`Selected brand: ${brandSelection.brand}`);

    // Read brand features
    const brandFeaturesPath = path.join(basePath, 'public', brandSelection.brand, 'brand-features.json');
    if (!fs.existsSync(brandFeaturesPath)) {
      console.log(`Brand features file not found for ${brandSelection.brand}, using defaults`);
      return;
    }

    const brandFeatures = JSON.parse(fs.readFileSync(brandFeaturesPath, 'utf8'));

    // Get brandURI (default to localhost if not set)
    if (brandFeatures.brandURI) {
      brandConfig.brandURI = brandFeatures.brandURI;
    }

    // Get DemoMode (default to true if not explicitly set to false)
    if (typeof brandFeatures.DemoMode === 'boolean') {
      brandConfig.demoMode = brandFeatures.DemoMode;
    }

    console.log(`Brand URI: ${brandConfig.brandURI}`);
    console.log(`Demo Mode: ${brandConfig.demoMode}`);

  } catch (error) {
    console.error('Error loading brand config:', error.message);
    console.log('Using default configuration');
  }
}

/**
 * Check if the brandURI points to a local server (localhost or 127.0.0.1)
 */
function isLocalServer() {
  const uri = brandConfig.brandURI.toLowerCase();
  return uri.includes('localhost') || uri.includes('127.0.0.1');
}

/**
 * Determine if we should start the internal server
 * Start server if: DemoMode is true OR brandURI points to localhost/127.0.0.1
 */
function shouldStartServer() {
  return brandConfig.demoMode || isLocalServer();
}

/**
 * Get the data directory for databases
 * Matches the logic in lib/data-paths.ts
 */
function getDataDirectory() {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: ./databases relative to project root
    return path.join(__dirname, 'databases');
  }

  // Production: Use platform-specific app data directory
  const platform = process.platform;

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    return path.join(appData, 'AttendanceServer');
  } else if (platform === 'darwin') {
    const home = process.env.HOME || '';
    return path.join(home, 'Library', 'Application Support', 'AttendanceServer');
  } else {
    const home = process.env.HOME || '';
    const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    return path.join(xdgData, 'AttendanceServer');
  }
}

/**
 * Write runtime config for the server
 * This ensures the server knows about demo mode and data path
 * since environment variables may not propagate correctly
 */
function writeRuntimeConfig() {
  const isDev = !app.isPackaged;

  // Write to the server's working directory so it can find it
  const serverDir = isDev
    ? path.join(__dirname, '.next', 'standalone', 'AttendanceTracker')
    : path.join(process.resourcesPath, 'server');

  const configPath = path.join(serverDir, 'runtime-config.json');
  const dataDir = getDataDirectory();

  const config = {
    demoMode: brandConfig.demoMode,
    dataPath: dataDir,
    writtenAt: new Date().toISOString(),
  };

  try {
    // Ensure directory exists
    if (!fs.existsSync(serverDir)) {
      console.log('Server directory does not exist yet:', serverDir);
      console.log('Runtime config will not be written - run npm run build first');
      return;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Runtime config written to:', configPath);
    console.log('Config:', JSON.stringify(config));
  } catch (err) {
    console.error('Failed to write runtime config:', err.message);
  }
}

/**
 * Clear database files for demo mode
 * This ensures a fresh database on every startup
 */
function clearDatabasesForDemo() {
  if (!brandConfig.demoMode) {
    return;
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               DEMO MODE - RESETTING DATABASE               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const dataDir = getDataDirectory();
  console.log(`Data directory: ${dataDir}`);

  // Database files to delete (including WAL and SHM files)
  const dbFiles = [
    'attendance.db',
    'attendance.db-shm',
    'attendance.db-wal',
    'auth.db',
    'auth.db-shm',
    'auth.db-wal',
  ];

  for (const dbFile of dbFiles) {
    const filePath = path.join(dataDir, dbFile);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`  ✓ Deleted: ${dbFile}`);
      } catch (err) {
        console.log(`  ⚠ Could not delete ${dbFile}: ${err.message}`);
      }
    }
  }

  console.log('');
  console.log('Database reset complete - fresh data will be created on startup');
  console.log('');
}

function startServer() {
  console.log('=== Server Startup ===');
  console.log('brandConfig:', JSON.stringify(brandConfig, null, 2));
  console.log('shouldStartServer():', shouldStartServer());
  console.log('isLocalServer():', isLocalServer());

  if (!shouldStartServer()) {
    console.log('Skipping internal server - connecting to remote:', brandConfig.brandURI);
    return;
  }

  const isDev = !app.isPackaged;
  // Note: Next.js standalone creates a nested folder with the project name
  const serverPath = isDev
    ? path.join(__dirname, '.next', 'standalone', 'AttendanceTracker', 'server.js')
    : path.join(process.resourcesPath, 'server', 'server.js');
  const serverDir = path.dirname(serverPath);

  console.log('isDev:', isDev);
  console.log('Server path:', serverPath);
  console.log('Server dir:', serverDir);
  console.log('Server file exists:', fs.existsSync(serverPath));

  if (!fs.existsSync(serverPath)) {
    console.error('ERROR: Server file not found at:', serverPath);
    console.error('Please run "npm run build" first to create the standalone server.');
    return;
  }

  console.log('Starting server...');
  console.log('Demo mode:', brandConfig.demoMode ? 'ENABLED' : 'disabled');

  // Get the data directory (same path used by clearDatabasesForDemo)
  const dataDir = getDataDirectory();
  console.log('Data directory:', dataDir);

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
  }

  // Pass environment variables to the server process
  // DATA_PATH ensures the server uses the same database location as Electron
  const serverEnv = {
    ...process.env,
    DEMO_MODE: brandConfig.demoMode ? 'true' : 'false',
    DATA_PATH: dataDir,
    PORT: '6029',
  };

  serverProcess = spawn('node', [serverPath], {
    cwd: serverDir,
    stdio: 'inherit',
    env: serverEnv,
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Attendance Management',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Determine URL to load
  const appURL = brandConfig.brandURI || 'http://localhost:6029';

  // Wait for server to start if we started one, otherwise load immediately
  const delay = shouldStartServer() ? 2000 : 500;

  setTimeout(() => {
    console.log(`Loading URL: ${appURL}`);
    mainWindow.loadURL(appURL);
  }, delay);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Load brand configuration first
  loadBrandConfig();

  // Write runtime config for the server (since env vars may not propagate)
  writeRuntimeConfig();

  // Clear databases if in demo mode (ensures fresh data on each startup)
  clearDatabasesForDemo();

  // Start server if needed
  startServer();

  // Create the window
  createWindow();
});

app.on('window-all-closed', function () {
  // Kill the server process
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
