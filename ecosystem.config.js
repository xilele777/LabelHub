/**
 * PM2 多进程配置
 *
 * 用法:
 *   pm2 start ecosystem.config.js              # 启动全部实例
 *   pm2 restart ecosystem.config.js            # 重启
 *   pm2 stop ecosystem.config.js               # 停止
 *   pm2 logs labelhub                          # 查看日志
 *   pm2 monit                                  # 实时监控面板
 *
 * 环境变量:
 *   DB_TYPE=postgres   → 使用 PostgreSQL
 *   DB_TYPE=sqlite     → 使用 SQLite（默认）
 *   REDIS_URL          → Redis 连接串（启用多进程 WebSocket）
 *   NODE_ENV           → production / development
 */

module.exports = {
  apps: [
    {
      name: 'labelhub',
      script: './server/index.js',
      cwd: __dirname,

      // ── 多进程 ──────────────────────────────────
      exec_mode: 'cluster',
      instances: 'max', // 自动匹配 CPU 核心数

      // ── 环境变量 ────────────────────────────────
      env: {
        NODE_ENV: 'production',
        DB_TYPE: 'postgres',
        // DATABASE_URL / REDIS_URL / HMAC_SECRET — 通过外部环境变量或 secret manager 注入
        PORT: 3001,
        CORS_ORIGIN: 'http://localhost:3000',
        TRUST_PROXY: 'true',
      },

      // ── 开发环境覆盖 ────────────────────────────
      env_development: {
        NODE_ENV: 'development',
        DB_TYPE: 'sqlite',
        PORT: 3001,
      },

      // ── 优雅关闭 ────────────────────────────────
      wait_ready: true,
      listen_timeout: 10_000, // 最多等 10 秒变成 ready
      kill_timeout: 5_000, // SIGKILL 前给 5 秒清理

      // ── 日志 ────────────────────────────────────
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ── 重启策略 ────────────────────────────────
      max_restarts: 10,
      max_memory_restart: '512M',
      restart_delay: 3_000,
      autorestart: true,

      // ── 其他 ────────────────────────────────────
      node_args: '--max-old-space-size=512',
    },
  ],
};
