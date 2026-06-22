const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, session } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const config = require('./config');
const Store = require('electron-store');
const zlib = require('zlib');
const fs = require('fs');

const store = new Store({
  defaults: {
    serverUrl: config.server.host,
    breakRemindersEnabled: true
  }
});

// Prevent multiple instances (e.g. double-click on taskbar shortcut)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow;
let settingsWindow;
let serverProcess;
let tray;
let lunchTray;
let breakTray;
let reminderTimer;
let currentLunchTimer;
let currentBreakTimer;
let activeBreak = null;
let isQuitting = false;
let reminderState = {
  date: null,
  reminded: new Set()
};

const BREAK_LABELS = {
  break_1: 'first break',
  lunch: 'lunch',
  break_2: 'second break'
};

const LUNCH_DURATION_MINUTES = 60;
const DEFAULT_BREAK_DURATION_MINUTES = 10;
const logFile = path.join(app.getPath('userData'), 'electron-debug.log');
function debugLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logFile, line);
  console.log(message);
}

function getSelectedBrand() {
  const isDev = !app.isPackaged;
  const brandSelectionPath = isDev
    ? path.join(__dirname, '..', 'lib', 'brand-selection.json')
    : path.join(process.resourcesPath, 'server', 'lib', 'brand-selection.json');

  try {
    const brandSelection = JSON.parse(fs.readFileSync(brandSelectionPath, 'utf8'));
    return brandSelection.brand || null;
  } catch {
    return null;
  }
}

function shouldShowBreakTrays() {
  const brand = getSelectedBrand();
  if (!brand) return false;
  const isDev = !app.isPackaged;
  const featuresPath = isDev
    ? path.join(__dirname, '..', 'public', brand, 'brand-features.json')
    : path.join(process.resourcesPath, 'server', 'public', brand, 'brand-features.json');
  try {
    const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
    return features.features?.breakTracking?.enabled === true;
  } catch {
    return false;
  }
}

function shouldLogoutOnClose() {
  const brand = getSelectedBrand();
  if (!brand) return false;
  const isDev = !app.isPackaged;
  const featuresPath = isDev
    ? path.join(__dirname, '..', 'public', brand, 'brand-features.json')
    : path.join(process.resourcesPath, 'server', 'public', brand, 'brand-features.json');
  try {
    const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
    return features.features?.leaveManagement?.logoutOnClose === true;
  } catch {
    return false;
  }
}

process.on('uncaughtException', (error) => {
  debugLog(`Uncaught exception: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (error) => {
  debugLog(`Unhandled rejection: ${error?.stack || error}`);
});

let crcTable;

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPngBuffer(width, height, pixels) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0;
    pixels.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function getLunchMeterTheme(nowTime, lunchTaken = false) {
  if (lunchTaken) {
    return {
      name: 'taken',
      top: [78, 92, 112, 255],
      bottom: [31, 41, 55, 255]
    };
  }

  const nowMinutes = nowTime ? parseTimeToMinutes(nowTime) : new Date().getHours() * 60 + new Date().getMinutes();

  if (nowMinutes < 12 * 60) {
    return {
      name: 'before noon',
      top: [255, 224, 102, 255],
      bottom: [202, 138, 4, 255]
    };
  }

  if (nowMinutes < 13 * 60) {
    return {
      name: 'lunch window',
      top: [134, 239, 172, 255],
      bottom: [22, 163, 74, 255]
    };
  }

  return {
    name: 'lunch due',
    top: [252, 165, 165, 255],
    bottom: [220, 38, 38, 255]
  };
}

function createLunchMeterImage(percent, theme = getLunchMeterTheme()) {
  const size = 32;
  const pixels = Buffer.alloc(size * size * 4);

  const colors = {
    transparent: [0, 0, 0, 0],
    border: [7, 10, 16, 255],
    bg: [21, 28, 42, 255],
    fillTop: theme.top,
    fillBottom: theme.bottom,
    fork: [250, 250, 244, 255],
    forkHighlight: [255, 255, 255, 255],
    forkShadow: [7, 10, 16, 150]
  };

  function setPixel(x, y, color) {
    if (x < 0 || x >= size || y < 0 || y >= size) {
      return;
    }
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }

  function fillRect(x, y, width, height, color) {
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        setPixel(px, py, color);
      }
    }
  }

  function drawThickLine(x1, y1, x2, y2, thickness, color) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    const radius = Math.floor(thickness / 2);
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      fillRect(x - radius, y - radius, thickness, thickness, color);
    }
  }

  function pointAlongAxis(origin, axis, offsetAlong, offsetAcross) {
    return {
      x: Math.round(origin.x + axis.x * offsetAlong + axis.px * offsetAcross),
      y: Math.round(origin.y + axis.y * offsetAlong + axis.py * offsetAcross)
    };
  }

  function drawFork(offsetX, offsetY, color) {
    const axis = {
      x: 0.72,
      y: -0.69,
      px: 0.69,
      py: 0.72
    };
    const base = { x: 19 + offsetX, y: 15 + offsetY };
    const handleEnd = { x: 7 + offsetX, y: 27 + offsetY };

    drawThickLine(handleEnd.x, handleEnd.y, base.x, base.y, 4, color);

    const crossA = pointAlongAxis(base, axis, 0, -5);
    const crossB = pointAlongAxis(base, axis, 0, 5);
    drawThickLine(crossA.x, crossA.y, crossB.x, crossB.y, 3, color);

    [-4.5, -1.5, 1.5, 4.5].forEach((offset) => {
      const tineStart = pointAlongAxis(base, axis, 0, offset);
      const tineEnd = pointAlongAxis(base, axis, 10, offset);
      drawThickLine(tineStart.x, tineStart.y, tineEnd.x, tineEnd.y, 2, color);
    });
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const roundedCorner =
        (x < 3 && y < 3 && (x - 3) ** 2 + (y - 3) ** 2 > 9) ||
        (x > 28 && y < 3 && (x - 28) ** 2 + (y - 3) ** 2 > 9) ||
        (x < 3 && y > 28 && (x - 3) ** 2 + (y - 28) ** 2 > 9) ||
        (x > 28 && y > 28 && (x - 28) ** 2 + (y - 28) ** 2 > 9);
      setPixel(x, y, roundedCorner ? colors.transparent : colors.bg);
    }
  }

  for (let y = 0; y < size; y++) {
    const progress = y / Math.max(1, size - 1);
    const gradient = colors.fillTop.map((channel, index) => {
      if (index === 3) {
        return 255;
      }
      return Math.round(channel + (colors.fillBottom[index] - channel) * progress);
    });
    fillRect(0, y, size, 1, gradient);
  }

  drawFork(1, 1, colors.forkShadow);
  drawFork(0, 0, colors.fork);

  fillRect(1, 1, 30, 1, colors.border);
  fillRect(1, 30, 30, 1, colors.border);
  fillRect(1, 1, 1, 30, colors.border);
  fillRect(30, 1, 1, 30, colors.border);

  return nativeImage.createFromBuffer(createPngBuffer(size, size, pixels));
}

function getBreakTrayTheme(status, targetBreak) {
  if (activeBreak) {
    return {
      name: 'break active',
      top: [252, 165, 165, 255],
      bottom: [220, 38, 38, 255]
    };
  }

  if (!status?.ok || !targetBreak?.config) {
    return {
      name: 'break',
      top: [148, 163, 184, 255],
      bottom: [71, 85, 105, 255]
    };
  }

  const nowMinutes = parseTimeToMinutes(status.now);
  const endMinutes = parseTimeToMinutes(targetBreak.config.end);

  if (nowMinutes >= endMinutes - 10) {
    return {
      name: 'break due',
      top: [252, 165, 165, 255],
      bottom: [220, 38, 38, 255]
    };
  }

  return {
    name: 'working',
    top: [134, 239, 172, 255],
    bottom: [22, 163, 74, 255]
  };
}

function createBreakTrayImage(mode = 'play', theme = getBreakTrayTheme()) {
  const size = 32;
  const pixels = Buffer.alloc(size * size * 4);
  const colors = {
    transparent: [0, 0, 0, 0],
    border: [7, 10, 16, 255],
    fillTop: theme.top,
    fillBottom: theme.bottom,
    icon: [250, 250, 244, 255],
    shadow: [7, 10, 16, 150]
  };

  function setPixel(x, y, color) {
    if (x < 0 || x >= size || y < 0 || y >= size) {
      return;
    }
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }

  function fillRect(x, y, width, height, color) {
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        setPixel(px, py, color);
      }
    }
  }

  function drawPlay(offsetX, offsetY, color) {
    for (let y = 8; y <= 24; y++) {
      const relativeY = Math.abs(y - 16);
      const width = 12 - relativeY;
      for (let x = 0; x <= width; x++) {
        setPixel(11 + x + offsetX, y + offsetY, color);
      }
    }
  }

  for (let y = 0; y < size; y++) {
    const progress = y / Math.max(1, size - 1);
    const gradient = colors.fillTop.map((channel, index) => {
      if (index === 3) {
        return 255;
      }
      return Math.round(channel + (colors.fillBottom[index] - channel) * progress);
    });

    for (let x = 0; x < size; x++) {
      const roundedCorner =
        (x < 3 && y < 3 && (x - 3) ** 2 + (y - 3) ** 2 > 9) ||
        (x > 28 && y < 3 && (x - 28) ** 2 + (y - 3) ** 2 > 9) ||
        (x < 3 && y > 28 && (x - 3) ** 2 + (y - 28) ** 2 > 9) ||
        (x > 28 && y > 28 && (x - 28) ** 2 + (y - 28) ** 2 > 9);
      setPixel(x, y, roundedCorner ? colors.transparent : gradient);
    }
  }

  if (mode === 'stop') {
    fillRect(10, 10, 14, 14, colors.shadow);
    fillRect(9, 9, 14, 14, colors.icon);
  } else {
    drawPlay(1, 1, colors.shadow);
    drawPlay(0, 0, colors.icon);
  }

  fillRect(1, 1, 30, 1, colors.border);
  fillRect(1, 30, 30, 1, colors.border);
  fillRect(1, 1, 1, 30, colors.border);
  fillRect(30, 1, 1, 30, colors.border);

  return nativeImage.createFromBuffer(createPngBuffer(size, size, pixels));
}

function getLunchFillPercent(status) {
  const lunchConfig = status.config?.breaks?.lunch;
  const lunchTaken = status.entries.some((entry) => entry.break_type === 'lunch');

  if (!lunchConfig || lunchTaken) {
    return 0;
  }

  const start = parseTimeToMinutes(lunchConfig.start);
  const end = parseTimeToMinutes(lunchConfig.end);
  const now = parseTimeToMinutes(status.now);

  if (now <= start) {
    return 0;
  }

  if (now >= end) {
    return 100;
  }

  return ((now - start) / (end - start)) * 100;
}

function getNextBreakTarget(status) {
  if (!status?.ok || !status.config?.breaks) {
    return null;
  }

  const nowMinutes = parseTimeToMinutes(status.now);
  const breakOrder = ['break_1', 'break_2'];
  for (const breakType of breakOrder) {
    const breakConfig = status.config.breaks[breakType];
    const alreadyLogged = status.entries.some((entry) => entry.break_type === breakType);

    if (breakConfig && !alreadyLogged) {
      const startMinutes = parseTimeToMinutes(breakConfig.start);
      const endMinutes = parseTimeToMinutes(breakConfig.end);
      const isInWindow = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

      if (!isInWindow) {
        continue;
      }

      return {
        breakType,
        config: breakConfig,
        durationMinutes: Number(breakConfig.duration || DEFAULT_BREAK_DURATION_MINUTES)
      };
    }
  }

  return null;
}

function getNextUnloggedBreak(status) {
  if (!status?.ok || !status.config?.breaks) {
    return null;
  }

  const breakOrder = ['break_1', 'break_2'];
  for (const breakType of breakOrder) {
    const breakConfig = status.config.breaks[breakType];
    const alreadyLogged = status.entries.some((entry) => entry.break_type === breakType);

    if (breakConfig && !alreadyLogged) {
      return {
        breakType,
        config: breakConfig,
        durationMinutes: Number(breakConfig.duration || DEFAULT_BREAK_DURATION_MINUTES)
      };
    }
  }

  return null;
}

function focusMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

async function runInApp(script) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('The attendance window is not available yet.');
  }

  await mainWindow.webContents.executeJavaScript('document.readyState', true);
  return mainWindow.webContents.executeJavaScript(script, true);
}

function buildRendererBreakScript(action) {
  return `
    (async () => {
      const token = localStorage.getItem('auth_token');
      const rawUser = localStorage.getItem('auth_user');
      if (!token || !rawUser) {
        return { ok: false, error: 'Please sign in before logging a break from the tray.' };
      }

      let user;
      try {
        user = JSON.parse(rawUser);
      } catch {
        return { ok: false, error: 'Your saved sign-in data could not be read. Please sign in again.' };
      }

      if (!user.employee_id) {
        return { ok: false, error: 'Please link your user account to an employee profile first.' };
      }

      const pad = (value) => String(value).padStart(2, '0');
      const formatDate = (date) => [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
      ].join('-');
      const formatTime = (date) => [pad(date.getHours()), pad(date.getMinutes())].join(':');
      const now = new Date();

      if (${JSON.stringify(action.type)} === 'status') {
        const response = await fetch('/api/break-entries?employeeId=' + user.employee_id, {
          headers: { Authorization: 'Bearer ' + token }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return { ok: false, status: response.status, error: data.error || 'Unable to load break status.' };
        }
        return { ok: true, user, config: data.config, entries: data.entries || [], now: formatTime(now), date: formatDate(now) };
      }

      const durationMinutes = ${Number(action.durationMinutes || 0)};
      const end = new Date(now.getTime() + durationMinutes * 60000);
      const response = await fetch('/api/break-entries', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: user.employee_id,
          breakType: ${JSON.stringify(action.breakType || 'lunch')},
          startTime: formatTime(now),
          endTime: formatTime(end),
          durationMinutes,
          notes: 'Logged from desktop tray'
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, status: response.status, error: data.error || 'Unable to log break.' };
      }

      return { ok: true, user, startTime: formatTime(now), endTime: formatTime(end), durationMinutes, entries: data.entries || [] };
    })();
  `;
}

async function getBreakStatusFromRenderer() {
  return runInApp(buildRendererBreakScript({ type: 'status' }));
}

async function logBreakFromTray(breakType, durationMinutes) {
  try {
    const result = await runInApp(buildRendererBreakScript({
      type: 'log',
      breakType,
      durationMinutes
    }));

    if (!result.ok) {
      showNotification('Attendance', result.error);
      focusMainWindow();
      return;
    }

    const label = breakType === 'lunch' ? 'Lunch' : 'Break';
    showNotification(
      `${label} started`,
      `${durationMinutes} minutes logged, ending at ${result.endTime}.`
    );

    if (breakType === 'lunch') {
      if (currentLunchTimer) {
        clearTimeout(currentLunchTimer);
      }

      if (lunchTray) {
        lunchTray.setImage(createLunchMeterImage(0, getLunchMeterTheme(null, true)));
        lunchTray.setToolTip('Lunch taken today');
      }

      currentLunchTimer = setTimeout(() => {
        showNotification('Lunch is over', 'Time to resume work.');
        currentLunchTimer = null;
      }, durationMinutes * 60 * 1000);
    }
  } catch (error) {
    showNotification('Attendance', error.message || 'Unable to log break from the tray.');
    focusMainWindow();
  }
}

async function startBreakFromTray() {
  if (activeBreak) {
    showNotification('Break in progress', 'Your break will end automatically when the timer is done.');
    updateBreakTray({ ok: true, config: { breaks: {} }, entries: [], now: getCurrentTimeString() });
    return;
  }

  try {
    const status = await getBreakStatusFromRenderer();
    const targetBreak = getNextBreakTarget(status);

    if (!targetBreak) {
      const nextBreak = getNextUnloggedBreak(status);
      if (nextBreak) {
        showNotification(
          'Break not available',
          `${BREAK_LABELS[nextBreak.breakType]} can be taken from ${nextBreak.config.start} to ${nextBreak.config.end}.`
        );
      } else {
        showNotification('Breaks complete', 'All configured breaks are logged for today.');
      }
      updateBreakTray(status);
      return;
    }

    const result = await runInApp(buildRendererBreakScript({
      type: 'log',
      breakType: targetBreak.breakType,
      durationMinutes: targetBreak.durationMinutes
    }));

    if (!result.ok) {
      showNotification('Attendance', result.error);
      focusMainWindow();
      return;
    }

    activeBreak = {
      breakType: targetBreak.breakType,
      durationMinutes: targetBreak.durationMinutes,
      endsAt: Date.now() + targetBreak.durationMinutes * 60 * 1000
    };

    showNotification('Break started', `${targetBreak.durationMinutes} minutes. Resume at ${result.endTime}.`);
    updateBreakTray(status);

    if (currentBreakTimer) {
      clearTimeout(currentBreakTimer);
    }

    currentBreakTimer = setTimeout(() => {
      stopActiveBreak(false);
    }, targetBreak.durationMinutes * 60 * 1000);
  } catch (error) {
    showNotification('Attendance', error.message || 'Unable to start break from the tray.');
    focusMainWindow();
  }
}

function stopActiveBreak(manual) {
  if (currentBreakTimer) {
    clearTimeout(currentBreakTimer);
    currentBreakTimer = null;
  }

  activeBreak = null;
  showNotification('Break is over', 'Time to resume work.');
  checkBreakReminders();
}

function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function shouldSendReminder(date, breakType, entries, breakConfig, nowTime) {
  if (!breakConfig || entries.some((entry) => entry.break_type === breakType)) {
    return false;
  }

  if (reminderState.date !== date) {
    reminderState = { date, reminded: new Set() };
  }

  if (reminderState.reminded.has(breakType)) {
    return false;
  }

  const nowMinutes = parseTimeToMinutes(nowTime);
  return nowMinutes >= parseTimeToMinutes(breakConfig.start) &&
    nowMinutes <= parseTimeToMinutes(breakConfig.end);
}

function updateLunchTray(status) {
  if (!lunchTray || !status.ok || !status.config) {
    return;
  }

  const lunchTaken = status.entries.some((entry) => entry.break_type === 'lunch');
  const percent = getLunchFillPercent(status);
  const theme = getLunchMeterTheme(status.now, lunchTaken);
  const label = lunchTaken
    ? 'Lunch taken today'
    : theme.name === 'lunch due'
      ? 'TAKE LUNCH ASAP'
    : `Lunch meter: ${Math.round(percent)}% (${theme.name})`;

  lunchTray.setImage(createLunchMeterImage(percent, theme));
  lunchTray.setToolTip(label);
}

function updateBreakTray(status) {
  if (!breakTray) {
    return;
  }

  const targetBreak = getNextBreakTarget(status);
  const nextBreak = targetBreak || getNextUnloggedBreak(status);
  const theme = getBreakTrayTheme(status, targetBreak);
  const mode = activeBreak ? 'stop' : 'play';

  let label;
  if (activeBreak) {
    const minutesLeft = Math.max(1, Math.ceil((activeBreak.endsAt - Date.now()) / 60000));
    label = `Break active: ${minutesLeft} min left`;
  } else if (!nextBreak) {
    label = 'Breaks complete today';
  } else if (theme.name === 'break due') {
    label = 'TAKE BREAK ASAP';
  } else if (!targetBreak) {
    label = `${BREAK_LABELS[nextBreak.breakType]} available ${nextBreak.config.start}-${nextBreak.config.end}`;
  } else {
    label = `Start ${BREAK_LABELS[targetBreak.breakType]} (${targetBreak.durationMinutes} min)`;
  }

  breakTray.setImage(createBreakTrayImage(mode, theme));
  breakTray.setToolTip(label);
}

async function checkBreakReminders() {
  try {
    const status = await getBreakStatusFromRenderer();
    if (!status.ok || !status.config) {
      return;
    }

    updateLunchTray(status);
    updateBreakTray(status);

    if (!store.get('breakRemindersEnabled')) {
      return;
    }

    for (const breakType of ['break_1', 'lunch', 'break_2']) {
      const breakConfig = status.config.breaks?.[breakType];
      if (!shouldSendReminder(status.date, breakType, status.entries, breakConfig, status.now)) {
        continue;
      }

      reminderState.reminded.add(breakType);
      const label = BREAK_LABELS[breakType] || 'break';
      const action = breakType === 'lunch'
        ? 'Right-click the tray icon to start lunch.'
        : 'Open Attendance to log it when you are ready.';
      showNotification('Break reminder', `It is time for your ${label}. ${action}`);
    }
  } catch {
    // The app may still be loading or signed out; reminders will retry on the next tick.
  }
}

function startBreakReminderTimer() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
  }

  reminderTimer = setInterval(checkBreakReminders, 60 * 1000);
  setTimeout(checkBreakReminders, 5000);
}

function createTray() {
  if (tray) {
    return;
  }

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'public', 'default.png')
    : path.join(__dirname, '..', 'public', 'default.png');
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip('Attendance Management');

  const breakEnabled = shouldShowBreakTrays();
  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Open Attendance',
      click: focusMainWindow
    },
    { type: 'separator' },
    ...(breakEnabled ? [{
      label: 'Break Reminders',
      type: 'checkbox',
      checked: store.get('breakRemindersEnabled'),
      click: (menuItem) => {
        store.set('breakRemindersEnabled', menuItem.checked);
      }
    }] : []),
    {
      label: 'Settings',
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('click', focusMainWindow);
}

function createBreakTray() {
  if (breakTray) {
    return;
  }

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: activeBreak ? 'Break in Progress' : 'Start 10 Minute Break',
      enabled: !activeBreak,
      click: startBreakFromTray
    },
    {
      label: 'Open Attendance',
      click: focusMainWindow
    },
    { type: 'separator' },
    {
      label: 'Break Reminders',
      type: 'checkbox',
      checked: store.get('breakRemindersEnabled'),
      click: (menuItem) => {
        store.set('breakRemindersEnabled', menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => app.quit()
    }
  ]);

  breakTray = new Tray(createBreakTrayImage('play', getBreakTrayTheme()));
  breakTray.setToolTip('Start break');
  breakTray.setContextMenu(buildMenu());
  breakTray.on('click', startBreakFromTray);
  breakTray.on('right-click', () => {
    breakTray.setContextMenu(buildMenu());
    breakTray.popUpContextMenu();
  });
}

function createLunchTray() {
  if (lunchTray) {
    return;
  }

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Take 60 Minute Lunch',
      click: () => logBreakFromTray('lunch', LUNCH_DURATION_MINUTES)
    },
    {
      label: 'Open Attendance',
      click: focusMainWindow
    },
    { type: 'separator' },
    {
      label: 'Break Reminders',
      type: 'checkbox',
      checked: store.get('breakRemindersEnabled'),
      click: (menuItem) => {
        store.set('breakRemindersEnabled', menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => app.quit()
    }
  ]);

  lunchTray = new Tray(createLunchMeterImage(0, getLunchMeterTheme()));
  lunchTray.setToolTip('Lunch meter');
  lunchTray.setContextMenu(buildMenu());
  lunchTray.on('click', () => {
    lunchTray.popUpContextMenu();
  });
}

function startServer(serverUrl) {
  const isDev = !app.isPackaged;
  const serverPath = isDev
    ? path.join(__dirname, '..', '.next', 'standalone', 'server.js')
    : path.join(process.resourcesPath, 'server', 'server.js');
  const serverDir = path.dirname(serverPath);

  // Extract port from serverUrl
  const url = new URL(serverUrl);
  const port = url.port || '3000';
  const hostname = url.hostname || '0.0.0.0';

  console.log('Starting server from:', serverPath);
  console.log('Server will listen on:', `${hostname}:${port}`);

  serverProcess = spawn('node', [serverPath], {
    cwd: serverDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: hostname
    }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 700,
    height: 650,
    title: 'Settings - Attendance Management',
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.setMenu(null);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    title: config.window.title,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Create application menu with Settings option
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => createSettingsWindow()
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Get server URL from store
  const serverUrl = store.get('serverUrl');

  // Wait a moment for server to start, then load the app
  setTimeout(() => {
    console.log('Connecting to:', serverUrl);
    mainWindow.loadURL(serverUrl);
  }, config.server.startupDelay);

  mainWindow.on('close', function (event) {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-server-url', () => {
  return store.get('serverUrl');
});

ipcMain.handle('set-server-url', (event, url) => {
  store.set('serverUrl', url);
  return true;
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.on('restart-app', () => {
  console.log('Restart requested - relaunching application...');

  // Kill the server process first
  if (serverProcess) {
    console.log('Killing server process...');
    serverProcess.kill();
  }

  // Close all windows
  BrowserWindow.getAllWindows().forEach(window => {
    window.close();
  });

  // Relaunch with current arguments
  app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });

  // Force quit
  setTimeout(() => {
    app.exit(0);
  }, 100);
});

app.on('second-instance', () => {
  // Someone tried to launch a second instance — focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Get server URL from store
  const serverUrl = store.get('serverUrl');

  // Determine if we should start the bundled server
  let shouldStartServer = config.server.startBundledServer;

  // Auto-detect if not explicitly set
  if (shouldStartServer === null || shouldStartServer === undefined) {
    const url = new URL(serverUrl);
    shouldStartServer = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  }

  if (shouldStartServer) {
    console.log('Starting bundled server...');
    startServer(serverUrl);
  } else {
    console.log('Connecting to remote server at:', serverUrl);
  }

  createWindow();
  if (shouldShowBreakTrays()) {
    createTray();
    createBreakTray();
    createLunchTray();
    startBreakReminderTimer();
  }
});

app.on('window-all-closed', function () {
  // Kill the server process
  if (serverProcess) {
    serverProcess.kill();
  }

  if (reminderTimer) {
    clearInterval(reminderTimer);
  }

  if (currentLunchTimer) {
    clearTimeout(currentLunchTimer);
  }

  if (currentBreakTimer) {
    clearTimeout(currentBreakTimer);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', function () {
  isQuitting = true;

  // logoutOnClose: remove the persisted auth cookie so Electron's session
  // store doesn't carry it into the next launch.
  // localStorage is cleared by the pagehide listener in the renderer.
  if (shouldLogoutOnClose()) {
    const serverUrl = store.get('serverUrl');
    if (serverUrl) {
      session.defaultSession.cookies.remove(serverUrl, 'auth_token').catch(() => {});
    }
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  } else {
    focusMainWindow();
  }
});
