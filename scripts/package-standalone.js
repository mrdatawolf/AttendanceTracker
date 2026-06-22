const fs = require('fs');
const path = require('path');

console.log('Packaging standalone server for distribution...');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = packageJson.version;

const distDir = path.join(__dirname, '..', 'dist-server');
// Next.js standalone output is at .next/standalone/ directly (not in a subdirectory)
const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
const publicDir = path.join(__dirname, '..', 'public');
const staticDir = path.join(__dirname, '..', '.next', 'static');

// Folders to exclude when copying (build artifacts that shouldn't be included)
// Note: Do NOT exclude .next - the standalone server needs its .next folder for BUILD_ID, manifests, etc.
const EXCLUDE_FOLDERS = [
  'dist-electron',
  'dist-server',
  '.node-portable',
  'temp-server-build',
  'distribute',        // Contains built client exe files - must not be copied into new builds
  'distribute_server', // Contains built server exe files - must not be copied into new builds
  'electron-app',
  '.git',
];

// Files to exclude when copying (Windows reserved names cause NSIS build failures)
const EXCLUDE_FILES = [
  'nul',   // Windows reserved device name
  'con',   // Windows reserved device name
  'prn',   // Windows reserved device name
  'aux',   // Windows reserved device name
];

// Create dist-server directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
} else {
  // Clean existing dist-server
  console.log('Cleaning existing dist-server...');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy standalone directory (excluding build artifacts)
console.log('Copying standalone server...');
copyDir(standaloneDir, distDir, EXCLUDE_FOLDERS);

// Copy static files
console.log('Copying static files...');
const distStaticDir = path.join(distDir, '.next', 'static');
if (!fs.existsSync(distStaticDir)) {
  fs.mkdirSync(distStaticDir, { recursive: true });
}
copyDir(staticDir, distStaticDir);

// Copy public folder
console.log('Copying public folder...');
if (fs.existsSync(publicDir)) {
  const distPublicDir = path.join(distDir, 'public');
  if (fs.existsSync(distPublicDir)) {
    fs.rmSync(distPublicDir, { recursive: true, force: true });
  }
  copyDir(publicDir, distPublicDir);
}

// Copy info folder (for roadmap and other docs)
console.log('Copying info folder...');
const infoDir = path.join(__dirname, '..', 'info');
if (fs.existsSync(infoDir)) {
  const distInfoDir = path.join(distDir, 'info');
  if (fs.existsSync(distInfoDir)) {
    fs.rmSync(distInfoDir, { recursive: true, force: true });
  }
  copyDir(infoDir, distInfoDir);
}

// Create databases directory
console.log('Creating databases directory...');
const distDatabasesDir = path.join(distDir, 'databases');
if (!fs.existsSync(distDatabasesDir)) {
  fs.mkdirSync(distDatabasesDir, { recursive: true });
}

// Create .env file with production settings
console.log('Creating .env file...');
const envContent = `# Server Configuration
PORT=6029
HOSTNAME=0.0.0.0

# JWT Secret - CHANGE THIS IN PRODUCTION!
JWT_SECRET=your-secret-key-change-in-production

# Node Environment
NODE_ENV=production
`;
fs.writeFileSync(path.join(distDir, '.env'), envContent);

// Create start script
console.log('Creating start script...');
const startScript = `@echo off
title Attendance Server
echo.
echo ========================================
echo   Attendance Management Server v${version}
echo ========================================
echo.
echo Starting server on port 6029...
echo Open your browser to: http://localhost:6029
echo.
echo Default login:
echo   Username: admin
echo   Password: admin123
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

set PORT=6029
set HOSTNAME=0.0.0.0

node server.js

pause
`;

fs.writeFileSync(path.join(distDir, 'start-server.bat'), startScript);

// Create README
console.log('Creating README...');
const readmeContent = `# Attendance Server - Standalone Distribution

## Prerequisites

This standalone server requires **Node.js 18 or later** to be installed on your system.

Download Node.js from: https://nodejs.org/

## Contents

This directory contains a standalone version of the Attendance application.

### Files and Folders:
- \`start-server.bat\` - Easy start script (recommended)
- \`server.js\` - Main server file
- \`.next/\` - Next.js build output
- \`public/\` - Static assets
- \`databases/\` - Database files (created automatically on first run)
- \`node_modules/\` - Required dependencies

## How to Run

### Quick Start
1. Double-click \`start-server.bat\`
2. The server will start and show connection information
3. Open your browser and navigate to http://localhost:6029

### Command Line
\`\`\`
node server.js
\`\`\`

## Default Login

- Username: admin
- Password: admin123

**IMPORTANT:** Change the default password after first login!

## Database

The database will be created automatically in the \`databases/\` folder on first run.

To reset the database:
1. Stop the server (Ctrl+C)
2. Delete the files in \`databases/\` folder
3. Restart the server

## Port Configuration

To change the port, set the PORT environment variable:

Windows:
\`\`\`
set PORT=8080
node server.js
\`\`\`

## Troubleshooting

### Server won't start
- Make sure Node.js is installed: \`node --version\`
- Make sure no other application is using port 6029
- Check that all files and folders are present

### Can't connect
- Make sure the server is running (check the console window)
- Try accessing http://localhost:6029 directly
- Check your firewall settings

## System Requirements

- **Node.js:** Version 18 or later
- **Operating System:** Windows 10/11, macOS, or Linux
- **RAM:** Minimum 2GB
- **Disk Space:** 500MB minimum

## Support

For issues and support, please contact your system administrator.
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), readmeContent);

console.log('');
console.log('✓ Server package created successfully in dist-server/');
console.log('');
console.log('IMPORTANT: This package requires Node.js to run.');
console.log('Users need to install Node.js 18+ from https://nodejs.org/');
console.log('');
console.log('To test: cd dist-server && start-server.bat');
console.log('');

// Helper function to recursively copy directory with optional exclusions
function copyDir(src, dest, excludeFolders = []) {
  if (!fs.existsSync(src)) {
    console.warn(`Warning: Source directory not found: ${src}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip symbolic links (junctions on Windows)
    // The real static files are copied separately, so we skip symlinks to avoid EPERM errors
    if (entry.isSymbolicLink()) {
      console.log(`  Skipping symlink: ${entry.name}`);
      continue;
    }

    // Skip excluded folders
    if (entry.isDirectory() && excludeFolders.includes(entry.name)) {
      console.log(`  Skipping excluded folder: ${entry.name}`);
      continue;
    }

    // Skip excluded files (Windows reserved names)
    if (!entry.isDirectory() && EXCLUDE_FILES.includes(entry.name.toLowerCase())) {
      console.log(`  Skipping excluded file: ${entry.name}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludeFolders);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
