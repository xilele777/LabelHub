/**
 * Backend State Machine Definitions & Validation
 *
 * Single source of truth for status transition rules.
 * Mirrors the frontend STATUS_TRANSITIONS (DataItemStatus) and
 * adds TaskStatus transitions that were previously only enforced on the client.
 *
 * ⚠️  Any change here should be reflected in the frontend as well.
 */

// ─── DataItemStatus (annotation-items) ────────────────────
const DATA_ITEM_STATUS = {
  PENDING: 'pending',
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  AI_REVIEWING: 'ai_reviewing',
  AI_REVIEWED: 'ai_reviewed',
  PENDING_REVIEW: 'pending_review',
  REVIEWED: 'reviewed',
  REJECTED: 'rejected',
};

/**
 * Legal status transitions for annotation data items.
 * Key = current status, Value = array of allowed next statuses.
 */
const DATA_ITEM_TRANSITIONS = {
  // 允许从 pending 直接提交（无需先保存草稿）；服务端提交后会原子完成 AI 预审并进入待人工审核
  [DATA_ITEM_STATUS.PENDING]: [
    DATA_ITEM_STATUS.DRAFT,
    DATA_ITEM_STATUS.SUBMITTED,
    DATA_ITEM_STATUS.PENDING_REVIEW,
  ],
  [DATA_ITEM_STATUS.DRAFT]: [DATA_ITEM_STATUS.SUBMITTED, DATA_ITEM_STATUS.PENDING],
  // 服务端原子 AI 预审：submitted 可直接到 pending_review（跳过中间态）；
  // 仍保留 → ai_reviewing 供手动重跑 AI 预审使用
  [DATA_ITEM_STATUS.SUBMITTED]: [
    DATA_ITEM_STATUS.PENDING_REVIEW,
    DATA_ITEM_STATUS.AI_REVIEWING,
    DATA_ITEM_STATUS.REVIEWED,
    DATA_ITEM_STATUS.REJECTED,
  ],
  [DATA_ITEM_STATUS.AI_REVIEWING]: [
    DATA_ITEM_STATUS.AI_REVIEWED,
    DATA_ITEM_STATUS.REVIEWED,
    DATA_ITEM_STATUS.REJECTED,
  ],
  [DATA_ITEM_STATUS.AI_REVIEWED]: [
    DATA_ITEM_STATUS.PENDING_REVIEW,
    DATA_ITEM_STATUS.REVIEWED,
    DATA_ITEM_STATUS.REJECTED,
  ],
  [DATA_ITEM_STATUS.PENDING_REVIEW]: [DATA_ITEM_STATUS.REVIEWED, DATA_ITEM_STATUS.REJECTED],
  [DATA_ITEM_STATUS.REVIEWED]: [],
  [DATA_ITEM_STATUS.REJECTED]: [DATA_ITEM_STATUS.SUBMITTED],
};

// ─── TaskStatus ────────────────────────────────────────────
const TASK_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ENDED: 'ended',
};

/**
 * Legal status transitions for tasks.
 * Key = current status, Value = array of allowed next statuses.
 */
const TASK_TRANSITIONS = {
  [TASK_STATUS.DRAFT]: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.PENDING]: [TASK_STATUS.DRAFT, TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED, TASK_STATUS.ENDED],
  [TASK_STATUS.COMPLETED]: [],
  [TASK_STATUS.ENDED]: [],
};

// ─── Validation helper ─────────────────────────────────────

/**
 * Validate a status transition against a transition map.
 *
 * @param {Object} transitions - The transition map to check against
 * @param {string} currentStatus - The item's current status
 * @param {string} targetStatus  - The desired next status
 * @returns {{ valid: boolean, reason: string }}
 */
function validateTransition(transitions, currentStatus, targetStatus) {
  // Unknown current status
  if (!Object.prototype.hasOwnProperty.call(transitions, currentStatus)) {
    return {
      valid: false,
      reason: `未知当前状态: "${currentStatus}"`,
    };
  }

  const allowed = transitions[currentStatus];

  // Target not in allowed list
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      reason: `非法状态转换: "${currentStatus}" → "${targetStatus}"，允许的目标状态: [${allowed.length ? allowed.join(', ') : '无（终态）'}]`,
    };
  }

  return { valid: true, reason: '' };
}

module.exports = {
  DATA_ITEM_STATUS,
  DATA_ITEM_TRANSITIONS,
  TASK_STATUS,
  TASK_TRANSITIONS,
  validateTransition,
};
