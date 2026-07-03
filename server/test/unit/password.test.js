/**
 * 密码哈希工具单元测试
 *
 * 运行: npx vitest run test/unit/password.test.js
 */
// Vitest globals (describe, it, expect) are auto-injected via vitest.config.js globals:true
const {
  hashPassword,
  verifyPassword,
  shouldUpgradePasswordHash,
  validatePasswordPolicy,
} = require('../../utils/password');

describe('hashPassword', () => {
  it('should produce a scrypt hash string', () => {
    const hash = hashPassword('test1234');
    expect(hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$\d+\$[a-f0-9]+\$[a-f0-9]+$/);
  });

  it('should produce different hashes for the same password', () => {
    const h1 = hashPassword('samepass1');
    const h2 = hashPassword('samepass1');
    expect(h1).not.toBe(h2);
  });

  it('should handle empty password', () => {
    const hash = hashPassword('');
    expect(hash).toMatch(/^scrypt\$/);
  });
});

describe('verifyPassword', () => {
  it('should verify a valid password', () => {
    const hash = hashPassword('correct1');
    expect(verifyPassword('correct1', hash)).toBe(true);
  });

  it('should reject an incorrect password', () => {
    const hash = hashPassword('correct1');
    expect(verifyPassword('wrong123', hash)).toBe(false);
  });

  it('should verify a legacy plaintext password (legacy fallback)', () => {
    expect(verifyPassword('legacy123', 'legacy123')).toBe(true);
  });

  it('should reject a wrong legacy password', () => {
    expect(verifyPassword('wrong', 'legacy123')).toBe(false);
  });
});

describe('shouldUpgradePasswordHash', () => {
  it('should return true for plaintext', () => {
    expect(shouldUpgradePasswordHash('plaintext123')).toBe(true);
  });

  it('should return false for scrypt hash', () => {
    const hash = hashPassword('secure1');
    expect(shouldUpgradePasswordHash(hash)).toBe(false);
  });

  it('should return false for empty', () => {
    expect(shouldUpgradePasswordHash('')).toBe(false);
  });
});

describe('validatePasswordPolicy', () => {
  it('should accept password >= 8 chars with letters and numbers', () => {
    expect(validatePasswordPolicy('abc12345')).toBeNull();
  });

  it('should reject password < 8 chars', () => {
    expect(validatePasswordPolicy('ab1')).toMatch(/at least 8/);
  });

  it('should reject password without numbers', () => {
    expect(validatePasswordPolicy('abcdefgh')).toMatch(/both letters and numbers/);
  });

  it('should reject password without letters', () => {
    expect(validatePasswordPolicy('12345678')).toMatch(/both letters and numbers/);
  });

  it('should accept password with special characters', () => {
    expect(validatePasswordPolicy('Abc@1234!')).toBeNull();
  });
});
