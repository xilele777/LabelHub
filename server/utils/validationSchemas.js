/**
 * 关键路由的 Zod 校验 Schema。
 *
 * 覆盖：auth（登录）、annotation-items（提交/驳回）、tasks（创建/状态变更）。
 */
const { z } = require('zod');

// ── Auth ─────────────────────────────────────────────────

const loginSchema = z.object({
  username: z
    .string({ required_error: '用户名不能为空' })
    .min(1, '用户名不能为空')
    .max(50, '用户名过长'),
  password: z
    .string({ required_error: '密码不能为空' })
    .min(1, '密码不能为空')
    .max(100, '密码过长'),
});

// ── Annotation Items ────────────────────────────────────

/** 提交标注 */
const submitAnnotationSchema = z.object({
  annotationData: z.record(z.unknown(), { required_error: '标注数据不能为空' }),
  version: z.number({ required_error: '版本号缺失' }).int().min(1),
});

/** 保存草稿 */
const saveDraftSchema = z.object({
  annotationData: z.record(z.unknown(), { required_error: '草稿数据不能为空' }),
  version: z.number({ required_error: '版本号缺失' }).int().min(1),
});

/** 审核通过 */
const approveSchema = z.object({
  version: z.number({ required_error: '版本号缺失' }).int().min(1),
});

/** 审核驳回 */
const rejectSchema = z.object({
  reason: z
    .string({ required_error: '驳回原因不能为空' })
    .min(1, '驳回原因不能为空')
    .max(500, '驳回原因过长'),
  version: z.number({ required_error: '版本号缺失' }).int().min(1),
});

// ── Tasks ───────────────────────────────────────────────

const createTaskSchema = z.object({
  name: z.string({ required_error: '任务名称不能为空' }).min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['image_classification', 'object_detection', 'semantic_segmentation', 'text_ner']),
  templateId: z.string({ required_error: '模板ID不能为空' }).min(1),
});

const updateTaskStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'in_progress', 'completed', 'ended']),
});

// ── Users ───────────────────────────────────────────────

const createUserSchema = z.object({
  username: z.string({ required_error: '用户名不能为空' }).min(1).max(50),
  password: z.string({ required_error: '密码不能为空' }).min(6, '密码至少6位').max(100),
  role: z.enum(['admin', 'owner', 'annotator', 'reviewer']),
});

module.exports = {
  loginSchema,
  submitAnnotationSchema,
  saveDraftSchema,
  approveSchema,
  rejectSchema,
  createTaskSchema,
  updateTaskStatusSchema,
  createUserSchema,
};
