// Wrapper: launch Electron without ELECTRON_RUN_AS_NODE
// This env var (set by some tools like Claude Code) would force Electron
// into plain Node.js mode, breaking require('electron').
const { spawn } = require('child_process');
const path = require('path');

const exe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const child = spawn(exe, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
});

child.on('exit', (code) => process.exit(code));
