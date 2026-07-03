/**
 * HTTP 请求日志中间件
 *
 * 自动记录每个请求的:
 *   - 方法、URL、状态码、响应耗时
 *   - requestId（用于链路追踪）
 *
 * 依赖: requestId 中间件必须先执行（设置 req.requestId）
 */

const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  // 在响应结束时记录
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      requestId: req.requestId,
      ip: req.ip,
    };

    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(logData, msg);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, msg);
    } else {
      logger.info(logData, msg);
    }
  });

  next();
}

module.exports = requestLogger;
