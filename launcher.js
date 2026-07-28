const { spawn, execSync } = require('child_process');
const path = require('path');

// Kill previous Electron instances (they hold port 3001) and free port 5173
try {
  execSync('cmd /c "taskkill /F /IM electron.exe 2>nul & exit 0"', { timeout: 3000 });
} catch {}

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
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
}

killPort(5173);
killPort(3001);

// Step 1: Compile Electron TypeScript to dist-electron/
console.log('[Launcher] Compiling Electron TypeScript...');
try {
  execSync('npx tsc -p tsconfig.electron.json', {
    cwd: __dirname,
    shell: true,
    stdio: 'inherit',
    timeout: 30000,
  });
  console.log('[Launcher] Electron TS compiled successfully.');
} catch (e) {
  console.error('[Launcher] Electron TS compilation failed!');
  process.exit(1);
}

// Step 2: Start Vite dev server on port 5173
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
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
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
