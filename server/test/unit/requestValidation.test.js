/**
 * 请求参数校验工具单元测试
 *
 * 运行: npx vitest run test/unit/requestValidation.test.js
 */
// Vitest globals (describe, it, expect) are auto-injected via vitest.config.js globals:true
const {
  isPlainObject,
  readString,
  readNumber,
  readEnum,
  readArray,
  validateFields,
} = require('../../utils/requestValidation');

describe('isPlainObject', () => {
  it('should return true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('should return false for arrays', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
  });

  it('should return false for null and primitives', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject('string')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
  });
});

describe('readString', () => {
  it('should return value for valid string', () => {
    expect(readString({ name: 'test' }, 'name').value).toBe('test');
  });

  it('should trim by default', () => {
    expect(readString({ name: '  hello  ' }, 'name').value).toBe('hello');
  });

  it('should not trim when trim: false', () => {
    expect(readString({ name: '  hello  ' }, 'name', { trim: false }).value).toBe('  hello  ');
  });

  it('should reject non-string values', () => {
    expect(readString({ name: 123 }, 'name').error).toMatch(/must be a string/);
  });

  it('should enforce required', () => {
    expect(readString({}, 'name', { required: true }).error).toMatch(/is required/);
  });

  it('should enforce minLength', () => {
    expect(readString({ name: 'ab' }, 'name', { minLength: 3 }).error).toMatch(/at least 3/);
  });

  it('should enforce maxLength', () => {
    expect(readString({ name: 'abcdef' }, 'name', { maxLength: 5 }).error).toMatch(/at most 5/);
  });

  it('should enforce pattern', () => {
    expect(readString({ name: 'abc' }, 'name', { pattern: /^\d+$/ }).error).toMatch(
      /invalid format/,
    );
  });
});

describe('readNumber', () => {
  it('should return value for valid number', () => {
    expect(readNumber({ count: 42 }, 'count').value).toBe(42);
  });

  it('should convert string to number', () => {
    expect(readNumber({ count: '42' }, 'count').value).toBe(42);
  });

  it('should enforce min', () => {
    expect(readNumber({ count: 1 }, 'count', { min: 5 }).error).toMatch(/greater than/);
  });

  it('should enforce max', () => {
    expect(readNumber({ count: 10 }, 'count', { max: 5 }).error).toMatch(/less than/);
  });
});

describe('readEnum', () => {
  it('should accept valid enum value', () => {
    expect(readEnum({ role: 'owner' }, 'role', ['owner', 'annotator']).value).toBe('owner');
  });

  it('should reject invalid enum value', () => {
    expect(readEnum({ role: 'admin' }, 'role', ['owner', 'annotator']).error).toMatch(
      /must be one of/,
    );
  });
});

describe('readArray', () => {
  it('should return value for valid array', () => {
    const result = readArray({ items: [1, 2, 3] }, 'items');
    expect(result.value).toEqual([1, 2, 3]);
  });

  it('should reject non-array values', () => {
    expect(readArray({ items: 'not array' }, 'items').error).toMatch(/must be an array/);
  });

  it('should enforce minLength', () => {
    expect(readArray({ items: [1] }, 'items', { minLength: 2 }).error).toMatch(/at least 2/);
  });
});

describe('validateFields', () => {
  it('should validate multiple fields', () => {
    const result = validateFields({ username: 'john', password: 'secret123' }, [
      { name: 'username', required: true, minLength: 3 },
      { name: 'password', required: true, minLength: 6 },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.values.username).toBe('john');
    expect(result.values.password).toBe('secret123');
  });

  it('should return error on first failed field', () => {
    const result = validateFields({ username: 'ab' }, [
      { name: 'username', required: true, minLength: 3 },
      { name: 'password', required: true },
    ]);
    expect(result.error).toMatch(/at least 3/);
  });
});
