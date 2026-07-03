/**
 * Pino 结构化日志单例
 *
 * 用法:
 *   const { logger, childLogger } = require('../utils/logger');
 *   logger.info({ action: 'login', userId: 'xxx' }, '用户登录成功');
 *   const log = childLogger(req);
 *   log.info('请求处理完成');
 *
 * 环境变量:
 *   LOG_LEVEL    — 日志级别（默认: 'info'，开发模式: 'debug'）
 *   NODE_ENV     — 生产环境输出 JSON，开发环境输出彩色文本
 */

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

const logger = pino({
  level,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * 为单个请求创建子日志器（自动注入 requestId）
 * @param {import('express').Request} req
 * @returns {import('pino').Logger}
 */
function childLogger(req) {
  return logger.child({
    requestId: req.requestId || '-',
    method: req.method,
    url: req.originalUrl,
  });
}

module.exports = { logger, childLogger };
