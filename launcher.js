const { spawn } = require('child_process');
const path = require('path');

// Start Vite dev server
const vite = spawn('npx', ['vite'], {
  cwd: __dirname,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let started = false;

function startElectron() {
  if (started) return;
  started = true;
  const electron = spawn('npx', ['electron', '.'], {
    cwd: __dirname,
    shell: true,
    stdio: 'ignore',
    detached: true,
  });
  electron.unref();
}

// Watch Vite output for "Local:" URL indicating it's ready
vite.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  if (text.includes('Local:') || text.includes('localhost')) {
    setTimeout(startElectron, 1000);
  }
});

vite.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Fallback: if Vite hasn't started after 15s, try anyway
setTimeout(() => {
  if (!started) startElectron();
}, 15000);

vite.on('exit', (code) => {
  if (code !== 0) console.error('Vite exited with code', code);
});
