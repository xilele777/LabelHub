/**
 * Zod 请求参数校验中间件工厂。
 *
 * 使用方式：
 *   const { body } = require('../middleware/validate');
 *   router.post('/login', body(loginSchema), (req, res) => { ... });
 *
 * 校验失败返回统一格式：
 *   { code: 400, message: "参数校验失败", data: { errors: [...] } }
 */
const { z } = require('zod');

/**
 * 创建校验中间件：按 source 提取数据并校验。
 * @param {z.ZodType} schema - Zod schema
 * @param {'body'|'query'|'params'} source - 数据来源
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      return res.status(400).json({
        code: 400,
        message: '参数校验失败',
        data: { errors },
      });
    }

    // Replace with parsed (coerced/defaulted) data
    req[source] = result.data;
    next();
  };
}

/** 校验 req.body */
function body(schema) {
  return validate(schema, 'body');
}

/** 校验 req.query */
function query(schema) {
  return validate(schema, 'query');
}

/** 校验 req.params */
function params(schema) {
  return validate(schema, 'params');
}

module.exports = { validate, body, query, params, z };
