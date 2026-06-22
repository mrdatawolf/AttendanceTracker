# Configuring Server Connection

The Electron app can connect to different server locations.

## Option 1: Edit config.js (Simple)

Open `electron-app/config.js` and change the `host` value:

```javascript
server: {
  host: 'http://192.168.1.100:6029',  // Change this to your server IP
  startupDelay: 2000
}
```

**Examples:**
- Local server: `'http://localhost:6029'`
- LAN server: `'http://192.168.1.100:6029'`
- Remote server: `'http://server.example.com:6029'`

After changing, rebuild the Electron app:
```bash
npm run electron:build
```

## Option 2: Use Environment Variable (Advanced)

Set the `SERVER_HOST` environment variable before running:

**Windows:**
```cmd
set SERVER_HOST=http://192.168.1.100:6029
npm run electron:start
```

**Or build with custom server:**
```cmd
set SERVER_HOST=http://192.168.1.100:6029
npm run electron:build
```

## Running Server Separately

If you want to run the server on a different machine:

1. Copy the `.next/standalone/` folder to the server machine
2. On the server machine, edit `server-config.txt` to set the port (default: 6029)
3. Run `start-server.bat` (Windows) or `node server.js`
4. Note the server's IP address (e.g., 192.168.1.100)
5. On client machines, edit `electron-app/config.js` to point to that IP and port
6. Build and distribute the Electron app

## Port Configuration

### Server Port (Standalone)

**Option 1 - Edit server-config.txt (Easiest):**
1. Open `.next/standalone/server-config.txt`
2. Change: `PORT=6029` to your desired port
3. Save and run `start-server.bat`

**Option 2 - Environment Variable:**
```bash
set PORT=8080
node server.js
```

**Option 3 - Edit server.js directly:**
Edit `.next/standalone/server.js` and change:
```javascript
const currentPort = parseInt(process.env.PORT, 10) || 6029;  // Change 6029 to your port
```

### Client Port (Electron)

Edit `electron-app/config.js`:
```javascript
host: 'http://localhost:8080',  // Match your server port
```
