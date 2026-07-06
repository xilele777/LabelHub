/**
 * Bundle Size 预算检查 — CI 门禁。
 *
 * 阈值（gzip 后大小）：
 * - 入口总 gzip < 125 kB（framework chunks）
 * - 单 chunk gzip < 200 kB
 */
const { readdirSync, statSync, readFileSync } = require('fs');
const { join, resolve } = require('path');
const { gzipSync } = require('zlib');

const DIST_DIR = resolve(process.cwd(), 'dist');
const JS_DIR = join(DIST_DIR, 'assets');

const BUDGET = {
  entryChunkPatterns: ['vue-', 'request-', 'realtime-', 'MainLayout-'],
  entryTotalGzipMax: 125 * 1024,
  singleChunkGzipMax: 200 * 1024,
};

const files = readdirSync(JS_DIR).filter(function (f) {
  return f.endsWith('.js');
});

const chunks = files.map(function (file) {
  var filePath = join(JS_DIR, file);
  var raw = statSync(filePath).size;
  var gzip = gzipSync(readFileSync(filePath)).length;
  return { file: file, raw: raw, gzip: gzip };
});

chunks.sort(function (a, b) {
  return b.gzip - a.gzip;
});

var entryChunks = chunks.filter(function (c) {
  return BUDGET.entryChunkPatterns.some(function (p) {
    return c.file.startsWith(p);
  });
});
var entryGzip = entryChunks.reduce(function (sum, c) {
  return sum + c.gzip;
}, 0);
var maxChunk = chunks[0];

console.log('Bundle Size Report');
console.log('─'.repeat(60));
console.log('Entry framework chunks (' + entryChunks.length + ' files):');
entryChunks.forEach(function (c) {
  console.log('  ' + c.file + ': ' + (c.gzip / 1024).toFixed(1) + ' kB (gzip)');
});
console.log(
  '  -> Total entry gzip: ' +
    (entryGzip / 1024).toFixed(1) +
    ' kB (budget: ' +
    (BUDGET.entryTotalGzipMax / 1024).toFixed(0) +
    ' kB)',
);
console.log('');
console.log(
  'Largest chunk: ' +
    maxChunk.file +
    ' — ' +
    (maxChunk.gzip / 1024).toFixed(1) +
    ' kB (gzip) (budget: ' +
    (BUDGET.singleChunkGzipMax / 1024).toFixed(0) +
    ' kB)',
);

var failed = false;
if (entryGzip > BUDGET.entryTotalGzipMax) {
  console.error(
    '\nENTRY BUDGET EXCEEDED: ' +
      (entryGzip / 1024).toFixed(1) +
      ' kB > ' +
      (BUDGET.entryTotalGzipMax / 1024).toFixed(0) +
      ' kB',
  );
  failed = true;
}
if (maxChunk.gzip > BUDGET.singleChunkGzipMax) {
  console.error(
    '\nSINGLE CHUNK BUDGET EXCEEDED: ' +
      maxChunk.file +
      ' ' +
      (maxChunk.gzip / 1024).toFixed(1) +
      ' kB > ' +
      (BUDGET.singleChunkGzipMax / 1024).toFixed(0) +
      ' kB',
  );
  failed = true;
}

if (!failed) {
  console.log('\nBundle size within budget');
} else {
  process.exit(1);
}
