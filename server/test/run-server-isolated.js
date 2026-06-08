/**
 * Start an isolated backend and run an HTTP-based test script against it.
 *
 * Usage: node test/run-server-isolated.js test/test-rbac.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const testFile = process.argv[2];
if (!testFile) {
  console.error('Usage: node test/run-server-isolated.js <test-file>');
  process.exit(1);
}

const serverRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labelhub-http-test-'));
const dbPath = path.join(tempDir, 'labelhub.db');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate a free port'));
      });
    });
  });
}

function waitForHealth(baseUrl, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    function probe() {
      const req = http.get(`${baseUrl}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });

      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() >= deadline) {
        reject(new Error(`Backend did not become healthy at ${baseUrl}`));
        return;
      }
      setTimeout(probe, 200);
    }

    probe();
  });
}

function runNode(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: serverRoot,
      env,
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

async function main() {
  const PORT = Number(process.env.TEST_PORT || await getFreePort());
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const env = {
    ...process.env,
    LABELHUB_DB_PATH: dbPath,
    PORT: String(PORT),
    BASE_URL,
  };

  const server = spawn(process.execPath, ['index.js'], {
    cwd: serverRoot,
    env,
    stdio: 'inherit',
  });

  try {
    await waitForHealth(BASE_URL);
    process.exitCode = await runNode([testFile], env);
  } finally {
    await stopProcess(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
