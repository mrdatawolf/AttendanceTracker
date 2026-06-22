const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [path.join(__dirname, '..', 'electron-app')], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
