const { spawn, execSync } = require('child_process');
const path = require('path');

// Kill any process holding port 5173 from a previous run
try {
  const out = execSync('netstat -ano | findstr :5173', {
    encoding: 'utf8', shell: 'cmd.exe', timeout: 3000,
  });
  const pids = new Set();
  for (const line of out.trim().split('\n')) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  if (pids.size > 0) {
    try {
      execSync(`taskkill /F /PID ${[...pids].join(' /PID ')}`, {
        shell: 'cmd.exe', timeout: 3000,
      });
    } catch {}
  }
} catch {}

// Start Vite dev server on port 5173
const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
  cwd: __dirname,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let started = false;

function startElectron() {
  if (started) return;
  started = true;
  const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
  const electron = spawn(electronExe, ['.'], {
    cwd: __dirname,
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
