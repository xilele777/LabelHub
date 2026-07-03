/**
 * API 全局限流中间件
 *
 * 分层限流策略:
 *   全局默认 — 600 请求/分钟/IP（配合 Redis 支持多进程共享）
 *   敏感端点 — 更严格的限制（标注提交、审核操作、用户创建）
 *   健康检查 — 不限流
 *
 * 依赖:
 *   - express-rate-limit: 限流核心
 *   - rate-limit-redis: Redis store（可选，自动降级为内存 store）
 *   - server/utils/redis.js: Redis 连接
 *
 * 环境变量:
 *   API_RATE_LIMIT_WINDOW_MS  — 滑动窗口（默认: 60000）
 *   API_RATE_LIMIT_MAX         — 窗口内最大请求数（默认: 600）
 *   REDIS_URL                  — Redis 可用时启用分布式限流
 */

const rateLimit = require('express-rate-limit');
const { getRedis } = require('../utils/redis');

let RedisStore;
try {
  RedisStore = require('rate-limit-redis').default;
} catch {
  // rate-limit-redis not installed, fallback to memory
}

// ─── Store factory ──────────────────────────────────────────

function createStore() {
  if (RedisStore) {
    const redis = getRedis();
    if (redis) {
      try {
        // rate-limit-redis v4+ uses sendCommand
        return new RedisStore({
          sendCommand: (...args) => redis.call(...args),
        });
      } catch (err) {
        // Fall through to memory
      }
    }
  }
  // Default memory store (single process only)
  return undefined;
}

// ─── 全局限流 ───────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.API_RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  skip: (req) => req.path === '/api/health',
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
    data: null,
  },
});

// ─── 敏感端点限流 ───────────────────────────────────────────

const strictLimiter = (max = 30) =>
  rateLimit({
    windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60_000),
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    message: {
      code: 429,
      message: '操作过于频繁，请稍后再试',
      data: null,
    },
  });

// 标注提交/驳回后重提: 30/min
const annotationSubmitLimiter = strictLimiter(Number(process.env.API_RATE_LIMIT_ANNOTATION || 30));

// 审核操作: 30/min
const reviewActionLimiter = strictLimiter(Number(process.env.API_RATE_LIMIT_REVIEW || 30));

// 用户创建: 10/min
const userCreateLimiter = strictLimiter(Number(process.env.API_RATE_LIMIT_USER_CREATE || 10));

// 批量导入: 5/min
const batchImportLimiter = strictLimiter(Number(process.env.API_RATE_LIMIT_BATCH_IMPORT || 5));

module.exports = {
  globalLimiter,
  annotationSubmitLimiter,
  reviewActionLimiter,
  userCreateLimiter,
  batchImportLimiter,
};
