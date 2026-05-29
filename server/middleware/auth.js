const crypto = require('crypto');
const db = require('../store/db');

/**
 * HMAC-signed token-based auth middleware.
 *
 * Token format: base64(userId:timestamp:hmacSignature)
 * The HMAC signature prevents token forgery — attackers cannot craft
 * valid tokens without the secret key, even if they know the format.
 *
 * This middleware checks the Authorization header:  Bearer <token>
 *
 * For production, consider replacing with proper JWT + RSA keys.
 */

// Token expiration: 24 hours (in milliseconds)
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function getTokenSecret() {
  const secret = process.env.HMAC_SECRET || process.env.LABELHUB_TOKEN_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('HMAC_SECRET is required when NODE_ENV=production');
  }

  return 'labelhub-dev-secret-change-in-prod';
}

const HMAC_SECRET = getTokenSecret();

function encodeToken(userId) {
  const ts = Date.now();
  const payload = `${userId}:${ts}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

function decodeToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    // token format: userId:timestamp:hmacSignature
    const parts = decoded.split(':');
    if (parts.length !== 3) return null; // Malformed token

    const [userId, tsStr, signature] = parts;
    const timestamp = Number(tsStr);
    if (isNaN(timestamp)) return null;

    // Verify HMAC signature to prevent forgery
    const payload = `${userId}:${timestamp}`;
    const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    if (signature !== expectedSig) {
      return null; // Invalid signature — token was tampered with
    }

    // Check token expiration
    if (Date.now() - timestamp > TOKEN_EXPIRY_MS) {
      return null; // Token expired
    }
    return { userId, timestamp };
  } catch {
    return null;
  }
}

/**
 * Auth middleware – attaches req.currentUser if valid token present.
 * Does NOT block unauthenticated requests (sets currentUser to null).
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/);

  if (!match) {
    req.currentUser = null;
    return next();
  }

  const decoded = decodeToken(match[1]);
  if (!decoded) {
    req.currentUser = null;
    return next();
  }

  const user = db.getById('users', decoded.userId);
  if (!user) {
    req.currentUser = null;
    return next();
  }

  // Attach user info (without password) to request
  const { password, ...userInfo } = user;
  req.currentUser = userInfo;
  next();
}

/**
 * Strict auth – requires a valid token, returns 401 otherwise.
 */
function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return res.unauthorized('请先登录');
  }
  next();
}

/**
 * Role-based access control.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.unauthorized('请先登录');
    }
    if (!roles.includes(req.currentUser.role)) {
      return res.fail('权限不足', 403);
    }
    next();
  };
}

module.exports = {
  encodeToken,
  decodeToken,
  authMiddleware,
  requireAuth,
  requireRole,
};
