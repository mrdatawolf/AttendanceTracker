# Deployment Guide

This guide explains how to build and deploy the Attendance Management application.

## Build Options

The application has two deployment options:

### 1. Electron Desktop Application (Recommended)
**Best for:** End users, non-technical users, desktop installation

- ✅ Self-contained Windows installer (.exe)
- ✅ Includes Node.js - no prerequisites needed
- ✅ Desktop application with system tray
- ✅ Simple double-click installation
- ✅ Automatic updates possible

### 2. Node.js Standalone Server
**Best for:** Server deployments, developers, multi-platform

- ⚠️ Requires Node.js 18+ to be installed separately
- ✅ Smaller package size
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Better for server/cloud deployments
- ✅ Can run as a system service

## Customizing Default Theme

You can customize the default theme and color mode for new users by editing `lib/app-config.ts`:

```typescript
export const appConfig: AppConfig = {
  // Options: 'standard' (balanced), 'compact' (dense), 'comfortable' (spacious)
  defaultTheme: 'standard',

  // Options: 'light', 'dark', 'system' (follows OS preference)
  defaultColorMode: 'system',
};
```

Changes take effect after rebuilding the application. Users can always change their preference in the Settings page.

## Customizing Application Icon

The Electron desktop application can use a custom icon. To add your own icon:

1. Create a 256x256 pixel icon (PNG format)
2. Convert to ICO format using an online tool like:
   - https://www.icoconverter.com/
   - https://convertico.com/
   - https://icon.kitchen/
3. Save as `build/icon.ico` in the project root
4. Rebuild the Electron application: `npm run electron:build`

**Icon Requirements:**
- Format: .ico file
- Size: 256x256 pixels (should include multiple sizes: 16, 24, 32, 48, 64, 128, 256)
- Full color supported

See [build/README.md](build/README.md) for detailed instructions and design suggestions.

## Building the Application

### Prerequisites

```bash
npm install
```

### Build All Distributions (Single Brand)

```bash
npm run build:all
```

This will:
1. Prompt you to select a brand (TRL, NFL, BT, Default, etc.)
2. Build the Next.js application with the selected brand's URI
3. Create standalone server distribution
4. Build Electron desktop application
5. Create server installer (NSIS)

**Output:**
- `dist-server/` - Standalone Node.js server
- `dist-electron/` - Electron desktop application and installers

### Build All Brands Automatically

```bash
npm run build:all:brands
```

This will automatically build distributions for **every brand** in the `public/` folder:
1. Discovers all available brands
2. For each brand:
   - Selects the brand
   - Runs the full build pipeline
   - Saves outputs to `dist-all-brands/{brandName}/`

**Output:**
- `dist-all-brands/TRL/dist-server/` - TRL standalone server
- `dist-all-brands/TRL/dist-electron/` - TRL Electron app
- `dist-all-brands/NFL/dist-server/` - NFL standalone server
- `dist-all-brands/NFL/dist-electron/` - NFL Electron app
- ... (and so on for each brand)

**Note:** This can take a while depending on the number of brands!

## Distribution

### Electron Application

**Location:** `dist-electron/Attendance Management Setup 0.9.0.exe`

**How to distribute:**
1. Share the installer exe file
2. User runs the installer
3. Application installs to Program Files
4. Desktop shortcut created automatically

**User instructions:**
1. Double-click the installer
2. Follow installation wizard
3. Launch from desktop shortcut or Start menu
4. Default login: admin / admin123

### Standalone Server

**Location:** `dist-server/` (entire folder)

**How to distribute:**
1. Zip the entire `dist-server` folder
2. Share the zip file
3. User extracts to any location

**User prerequisites:**
- Node.js 18 or later must be installed
- Download from: https://nodejs.org/

**User instructions:**
1. Extract the zip file
2. Navigate to extracted folder
3. Double-click `start-server.bat`
4. Open browser to http://localhost:6029
5. Default login: admin / admin123

## Deployment Scenarios

### Small Office (5-20 users)
**Recommended:** Electron Desktop Application

- Install on one computer
- Users access via network: http://[computer-ip]:6029
- Or install on each user's computer

### Server Deployment
**Recommended:** Standalone Server

- Deploy to Windows/Linux server
- Run as a service
- Users access via http://[server-ip]:6029

### Development/Testing
**Recommended:** Development server

```bash
npm run dev
```

Access at http://localhost:6029

## Port Configuration

**Default port:** 6029

**Change port:**

Electron app:
- Edit `electron-app/main.js`
- Change port number

Standalone server:
```bash
set PORT=8080
node server.js
```

## Database Location

All databases are stored in the `databases/` folder:

**Electron app:**
```
C:\Program Files\Attendance Management\resources\server\databases\
```

**Standalone server:**
```
[installation-folder]\databases\
```

**Development:**
```
[project-root]\databases\
```

## Backup and Restore

### Backup
1. Stop the server/application
2. Copy the entire `databases/` folder
3. Store safely

### Restore
1. Stop the server/application
2. Delete current `databases/` folder
3. Copy backed up `databases/` folder back
4. Restart server/application

## Updating

### Electron Application
1. Uninstall old version
2. Install new version
3. Database is preserved (unless you check "delete all data")

### Standalone Server
1. Stop the server
2. Backup `databases/` folder
3. Delete old installation
4. Extract new version
5. Copy `databases/` folder back
6. Start server

## Troubleshooting

### Electron app won't start
- Check Windows Event Viewer for errors
- Run installer as administrator
- Check antivirus hasn't blocked it

### Standalone server won't start
- Verify Node.js is installed: `node --version`
- Check port 6029 is not in use
- Run from command line to see errors

### Database errors
- Stop application
- Delete database files
- Restart (fresh database will be created)
- Re-enter data or restore from backup

### Can't access from other computers
- Check Windows Firewall
- Allow port 6029 through firewall
- Access via computer's IP address

## Security Notes

1. **Change default password** after first login
2. **Firewall:** Only allow access from trusted networks
3. **Backups:** Regular database backups recommended
4. **HTTPS:** Consider using a reverse proxy for HTTPS
5. **Updates:** Keep the application updated

## Support

For issues and questions:
- Check this guide first
- Review console/terminal output for errors
- Check `databases/` folder permissions
- Contact system administrator
