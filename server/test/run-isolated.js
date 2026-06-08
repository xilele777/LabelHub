/**
 * Run a test file with an isolated SQLite database.
 *
 * Usage: node test/run-isolated.js test/test-concurrency.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testFile = process.argv[2];
if (!testFile) {
  console.error('Usage: node test/run-isolated.js <test-file>');
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labelhub-test-'));
const dbPath = path.join(tempDir, 'labelhub.db');

try {
  const result = spawnSync(process.execPath, [testFile], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      LABELHUB_DB_PATH: dbPath,
    },
    stdio: 'inherit',
  });

  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
