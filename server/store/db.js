/**
 * 数据库适配层工厂
 *
 * 根据 DB_TYPE 环境变量选择后端：
 *   - "sqlite"（默认）→ db_sqlite.js（同步 API，零改动兼容）
 *   - "postgres"    → db_pg.js（异步优先 API，生产推荐）
 *
 * 所有已有代码 require('../store/db') 无需修改。
 * PostgreSQL 模式下，同步方法使用内存缓存层桥接。
 */

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

let backend;
try {
  if (DB_TYPE === 'postgres') {
    backend = require('./db_pg');
    console.log('[DB] 使用 PostgreSQL 后端');
  } else {
    backend = require('./db_sqlite');
  }
} catch (err) {
  // Fallback to SQLite if PG module fails to load
  if (DB_TYPE === 'postgres') {
    console.error(`[DB] PostgreSQL 后端加载失败: ${err.message}`);
    console.error('[DB] 回退到 SQLite');
  }
  backend = require('./db_sqlite');
}

// Re-export everything from the chosen backend
module.exports = backend;
