/**
 * Redis 缓存工具
 *
 * 用法:
 *   const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require('../utils/cache');
 *   const data = await cacheGet('user:owner');
 *   await cacheSet('user:owner', { name: 'Bob' }, 600);
 *
 * Redis 不可用时所有操作静默跳过（不报错），
 * 即应用在无 Redis 环境下正常运行，只是没有缓存加速。
 */

const { getRedis } = require('./redis');

const PREFIX = 'cache:';

function _fullKey(key) {
  return `${PREFIX}${key}`;
}

/**
 * 读取缓存
 * @param {string} key
 * @returns {Promise<object|null>} 缓存值或 null（未命中）
 */
async function cacheGet(key) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(_fullKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

/**
 * 写入缓存
 * @param {string} key
 * @param {*} value - 会被 JSON.stringify
 * @param {number} ttlSeconds - 过期时间（秒），默认 300
 */
async function cacheSet(key, value, ttlSeconds = 300) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const fullKey = _fullKey(key);
    if (ttlSeconds > 0) {
      await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
    } else {
      await redis.set(fullKey, JSON.stringify(value));
    }
  } catch (err) {
    // Silently ignore
  }
}

/**
 * 删除缓存
 * @param {string} key
 */
async function cacheDel(key) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(_fullKey(key));
  } catch (err) {
    // Silently ignore
  }
}

/**
 * 批量删除匹配 pattern 的缓存
 * 用法: await cacheDelPattern('template:*')
 * @param {string} pattern - 支持 * 通配符
 * @returns {Promise<number>} 删除的 key 数量
 */
async function cacheDelPattern(pattern) {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const fullPattern = _fullKey(pattern);
    const keys = await redis.keys(fullPattern);
    if (keys.length > 0) {
      return await redis.del(...keys);
    }
    return 0;
  } catch (err) {
    return 0;
  }
}

/**
 * 缓存策略辅助：wrap 模式
 * 先查缓存，未命中则调用 fn 获取数据并写入缓存
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<*>} fn
 * @returns {Promise<*>}
 */
async function cacheWrap(key, ttlSeconds, fn) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  const result = await fn();
  if (result !== null && result !== undefined) {
    await cacheSet(key, result, ttlSeconds);
  }
  return result;
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPattern, cacheWrap };
