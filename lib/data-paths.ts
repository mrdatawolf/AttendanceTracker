import path from 'path';
import fs from 'fs';
import { getRuntimeDataPath } from './demo-mode';

/**
 * Data Paths Configuration
 *
 * Priority for data directory:
 * 1. Runtime config from Electron (highest priority when running under Electron)
 * 2. Custom path from data-path.json config file (set by super admin)
 * 3. DATA_PATH environment variable
 * 4. Development: ./databases/ relative to project root
 * 5. Production (Windows): %APPDATA%/AttendanceServer/
 * 6. Production (macOS): ~/Library/Application Support/AttendanceServer/
 * 7. Production (Linux): ~/.local/share/AttendanceServer/
 *
 * This ensures the database is always in a writable location,
 * even when the server is installed in a protected directory.
 */

const APP_NAME = 'AttendanceServer';
const CONFIG_FILENAME = 'data-path.json';

interface DataPathConfig {
  customPath?: string;
  setAt?: string;
  setBy?: string;
}

/**
 * Get the config file path (stored in app installation directory)
 */
function getConfigFilePath(): string {
  return path.join(process.cwd(), CONFIG_FILENAME);
}

/**
 * Read the data path config file
 */
function readConfig(): DataPathConfig {
  try {
    const configPath = getConfigFilePath();
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Failed to read data path config:', error);
  }
  return {};
}

/**
 * Save the data path config file
 */
export function saveDataPathConfig(customPath: string | null, setBy?: string): void {
  const configPath = getConfigFilePath();
  const config: DataPathConfig = customPath
    ? {
        customPath,
        setAt: new Date().toISOString(),
        setBy: setBy || 'unknown',
      }
    : {};

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Data path config saved: ${customPath || 'reset to default'}`);
}

/**
 * Get the default data directory (without custom override)
 */
export function getDefaultDataDirectory(): string {
  // In development, use ./databases relative to cwd
  if (process.env.NODE_ENV !== 'production') {
    return path.join(process.cwd(), 'databases');
  }

  // In production, use platform-specific app data directory
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: Use %APPDATA% (typically C:\Users\<user>\AppData\Roaming)
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    return path.join(appData, APP_NAME);
  } else if (platform === 'darwin') {
    // macOS: Use ~/Library/Application Support
    const home = process.env.HOME || '';
    return path.join(home, 'Library', 'Application Support', APP_NAME);
  } else {
    // Linux and others: Use ~/.local/share
    const home = process.env.HOME || '';
    const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    return path.join(xdgData, APP_NAME);
  }
}

/**
 * Get the current custom data path (if set)
 */
export function getCustomDataPath(): string | null {
  const config = readConfig();
  return config.customPath || null;
}

/**
 * Get the application data directory
 * Creates the directory if it doesn't exist
 */
export function getDataDirectory(): string {
  let dataDir: string;

  // Priority 1: Runtime config from Electron (written by Electron on startup)
  const runtimePath = getRuntimeDataPath();
  if (runtimePath) {
    console.log(`[DATA-PATHS] Using runtime data path: ${runtimePath}`);
    dataDir = runtimePath;
  }
  // Priority 2: Custom path from config file
  else {
    const config = readConfig();
    if (config.customPath && fs.existsSync(config.customPath)) {
      dataDir = config.customPath;
    }
    // Priority 3: Environment variable
    else if (process.env.DATA_PATH) {
      dataDir = process.env.DATA_PATH;
    }
    // Priority 4+: Default based on environment
    else {
      dataDir = getDefaultDataDirectory();
    }
  }

  // Ensure directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  }

  return dataDir;
}

/**
 * Get the path to a database file
 */
export function getDatabasePath(dbName: string): string {
  return path.join(getDataDirectory(), dbName);
}

/**
 * Get the backups directory
 */
export function getBackupsDirectory(): string {
  const backupsDir = path.join(getDataDirectory(), 'backups');

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  return backupsDir;
}

/**
 * Log the current data directory (useful for debugging)
 */
export function logDataPaths(): void {
  const dataDir = getDataDirectory();
  console.log(`📁 Data directory: ${dataDir}`);
  console.log(`   - Auth database: ${getDatabasePath('auth.db')}`);
  console.log(`   - Attendance database: ${getDatabasePath('attendance.db')}`);
  console.log(`   - Backups: ${getBackupsDirectory()}`);
}
