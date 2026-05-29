const express = require('express');
const db = require('../store/db');
const { encodeToken } = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/loginRateLimit');
const { hashPassword, shouldUpgradePasswordHash, verifyPassword } = require('../utils/password');
const { validateFields } = require('../utils/requestValidation');

const router = express.Router();

router.post('/login', loginRateLimit, (req, res) => {
  const { error, values } = validateFields(req.body, [
    {
      name: 'username',
      required: true,
      minLength: 3,
      maxLength: 32,
      pattern: /^[A-Za-z0-9_.-]+$/,
      patternMessage: 'username can only contain letters, numbers, underscore, dot, and hyphen',
    },
    { name: 'password', required: true, minLength: 1, maxLength: 128, trim: false },
  ]);

  if (error) {
    req.loginRateLimit.markFailure();
    return res.fail(error);
  }

  const { username, password } = values;
  const user = db.findOne('users', { username });
  if (!user || !verifyPassword(password, user.password)) {
    req.loginRateLimit.markFailure();
    return res.fail('Invalid username or password', 401);
  }

  if (shouldUpgradePasswordHash(user.password)) {
    db.updateById('users', user.id, { password: hashPassword(password) });
  }

  req.loginRateLimit.markSuccess();

  const token = encodeToken(user.id);
  const { password: _pw, ...userInfo } = user;

  res.success({ token, user: userInfo }, 'Login successful');
});

router.get('/me', (req, res) => {
  if (!req.currentUser) {
    return res.unauthorized('Not logged in or token expired');
  }
  res.success(req.currentUser);
});

router.post('/logout', (req, res) => {
  res.success(null, 'Logged out');
});

module.exports = router;
