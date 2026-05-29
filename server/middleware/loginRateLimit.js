const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX || 5);

const attempts = new Map();

function getAttemptKey(req) {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  return `${req.ip || 'unknown'}:${username || 'anonymous'}`;
}

function getRecord(key, now) {
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    return { count: 0, resetAt: now + WINDOW_MS };
  }
  return record;
}

function loginRateLimit(req, res, next) {
  const key = getAttemptKey(req);
  const now = Date.now();
  const record = getRecord(key, now);

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.fail('Too many login attempts. Please try again later.', 429, {
      retryAfterSeconds,
    });
  }

  req.loginRateLimit = {
    markSuccess() {
      attempts.delete(key);
    },
    markFailure() {
      const current = getRecord(key, Date.now());
      attempts.set(key, {
        count: current.count + 1,
        resetAt: current.resetAt,
      });
    },
  };

  next();
}

module.exports = {
  loginRateLimit,
};
