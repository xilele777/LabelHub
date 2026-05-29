/**
 * Unified API response wrapper.
 *
 * All endpoints should use res.success() / res.fail() so the
 * frontend always receives a consistent structure:
 *
 *   { code: number, message: string, data: any }
 */

function success(data = null, message = 'ok', code = 200) {
  return this.status(code).json({ code, message, data });
}

function fail(message = 'error', code = 400, data = null) {
  return this.status(code).json({ code, message, data });
}

/**
 * Not-found helper (404).
 */
function notFound(message = 'Resource not found') {
  return this.status(404).json({ code: 404, message, data: null });
}

/**
 * Unauthorized helper (401).
 */
function unauthorized(message = 'Unauthorized') {
  return this.status(401).json({ code: 401, message, data: null });
}

/**
 * Install helpers on res object.
 */
function responseMiddleware(req, res, next) {
  res.success = success;
  res.fail = fail;
  res.notFound = notFound;
  res.unauthorized = unauthorized;
  next();
}

module.exports = responseMiddleware;
