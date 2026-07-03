/**
 * 任务分配引擎
 *
 * 支持的分配策略：
 *   1. 按量均分（even_split）：每名标注员分配相同数量的数据条目
 *   2. 手动指定（manual）：Owner 手动选择标注员和数据条目的映射
 *
 * 分配结果直接写入 annotation_items.annotator 字段，
 * 并在 tasks.assignmentConfig 中记录分配规则与状态。
 */
const db = require('../store/db');
const { canTaskExposeWorkItems } = require('../utils/itemTimeliness');

/**
 * 分配策略枚举
 */
const ASSIGNMENT_STRATEGY = {
  EVEN_SPLIT: 'even_split', // 按量均分
  MANUAL: 'manual', // 手动指定
};

/**
 * 获取指定任务的待分配数据条目
 * @param {string} taskId - 任务ID
 * @param {object} options - 选项
 * @param {boolean} options.includeAssigned - 是否包含已分配的数据
 * @param {string[]} options.statuses - 要包含的状态列表
 * @returns {Array} 数据条目列表
 */
function getAssignableItems(taskId, options = {}) {
  const { includeAssigned = false, statuses = ['pending'] } = options;
  const allItems = db.find('annotation-items', { taskId });

  return allItems.filter((item) => {
    // 状态过滤
    if (statuses.length > 0 && !statuses.includes(item.status)) return false;
    // 已分配过滤
    if (!includeAssigned && item.annotator !== null) return false;
    return true;
  });
}

/**
 * 获取系统中所有标注员列表
 * @returns {Array} 标注员列表（不含密码）
 */
function getAnnotators() {
  const users = db.find('users', { role: 'annotator' });
  return users.map(({ password, ...rest }) => rest);
}

/**
 * 按量均分分配
 * 将待分配数据平均分配给指定标注员列表
 *
 * @param {string} taskId - 任务ID
 * @param {string[]} annotatorUsernames - 标注员用户名列表
 * @param {object} options - 选项
 * @param {number} options.perPerson - 每人分配数量（0 表示全部分配）
 * @returns {object} 分配结果 { assigned: number, details: Array<{annotator, count, items}> }
 */
function evenSplitAssign(taskId, annotatorUsernames, options = {}) {
  const { perPerson = 0 } = options;

  if (!annotatorUsernames || annotatorUsernames.length === 0) {
    return { error: '标注员列表不能为空' };
  }

  // 获取待分配的数据
  const assignableItems = getAssignableItems(taskId);
  if (assignableItems.length === 0) {
    return { error: '没有待分配的数据' };
  }

  // 计算每人分配数量
  const itemsPerPerson =
    perPerson > 0
      ? Math.min(perPerson, Math.ceil(assignableItems.length / annotatorUsernames.length))
      : Math.ceil(assignableItems.length / annotatorUsernames.length);

  const details = [];
  let itemIndex = 0;
  const now = new Date().toISOString();

  for (const username of annotatorUsernames) {
    const count = Math.min(itemsPerPerson, assignableItems.length - itemIndex);
    if (count <= 0) break;

    const assignedItems = [];
    for (let i = 0; i < count && itemIndex < assignableItems.length; i++, itemIndex++) {
      const item = assignableItems[itemIndex];
      const historyRecord = {
        id: `h${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        operator: 'system',
        actionType: 'assign_annotator',
        fromStatus: item.status,
        toStatus: item.status,
        reason: `按量均分分配给 ${username}`,
        timestamp: now,
      };
      db.updateById('annotation-items', item.id, {
        annotator: username,
        auditHistory: [...(item.auditHistory || []), historyRecord],
      });
      assignedItems.push(item.id);
    }

    details.push({
      annotator: username,
      count: assignedItems.length,
      items: assignedItems,
    });
  }

  return {
    assigned: itemIndex,
    details,
    remaining: assignableItems.length - itemIndex,
  };
}

/**
 * 手动指定分配
 * Owner 手动为特定数据条目指定标注员
 *
 * @param {string} taskId - 任务ID
 * @param {Array<{itemId: string, annotator: string}>} assignments - 分配映射列表
 * @returns {object} 分配结果 { assigned: number, details: Array }
 */
function manualAssign(taskId, assignments) {
  if (!assignments || assignments.length === 0) {
    return { error: '分配列表不能为空' };
  }

  const now = new Date().toISOString();
  const details = [];
  let assignedCount = 0;

  for (const { itemId, annotator } of assignments) {
    const item = db.getById('annotation-items', itemId);
    if (!item) {
      details.push({ itemId, annotator, success: false, reason: '数据项不存在' });
      continue;
    }
    if (item.taskId !== taskId) {
      details.push({ itemId, annotator, success: false, reason: '数据项不属于该任务' });
      continue;
    }

    const historyRecord = {
      id: `h${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
      operator: 'system',
      actionType: 'assign_annotator',
      fromStatus: item.status,
      toStatus: item.status,
      reason: `手动分配给 ${annotator}`,
      timestamp: now,
    };

    db.updateById('annotation-items', item.id, {
      annotator,
      auditHistory: [...(item.auditHistory || []), historyRecord],
    });

    details.push({ itemId, annotator, success: true });
    assignedCount++;
  }

  return { assigned: assignedCount, details };
}

/**
 * 清除分配
 * 将指定任务的所有数据条目的标注员字段清空
 *
 * @param {string} taskId - 任务ID
 * @param {object} options - 选项
 * @param {string[]} options.itemIds - 只清除指定条目（为空则清除全部）
 * @returns {object} { cleared: number }
 */
function clearAssignment(taskId, options = {}) {
  const { itemIds = [] } = options;
  const allItems = db.find('annotation-items', { taskId });
  const itemsToClear =
    itemIds.length > 0 ? allItems.filter((item) => itemIds.includes(item.id)) : allItems;

  const now = new Date().toISOString();
  let cleared = 0;

  for (const item of itemsToClear) {
    if (item.annotator === null) continue;
    // 只清除未开始标注的数据
    if (item.status !== 'pending' && item.status !== 'draft') continue;

    const historyRecord = {
      id: `h${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
      operator: 'system',
      actionType: 'unassign_annotator',
      fromStatus: item.status,
      toStatus: item.status,
      reason: `清除分配（原标注员：${item.annotator}）`,
      timestamp: now,
    };
    db.updateById('annotation-items', item.id, {
      annotator: null,
      auditHistory: [...(item.auditHistory || []), historyRecord],
    });
    cleared++;
  }

  return { cleared };
}

/**
 * 获取任务分配统计信息
 *
 * @param {string} taskId - 任务ID
 * @returns {object} 统计信息 { total, assigned, unassigned, byAnnotator, byStatus }
 */
function getAssignmentStats(taskId) {
  const allItems = db.find('annotation-items', { taskId });
  const annotators = getAnnotators();

  const total = allItems.length;
  const assigned = allItems.filter((i) => i.annotator !== null).length;
  const unassigned = total - assigned;

  // 按标注员统计
  const byAnnotator = {};
  for (const a of annotators) {
    byAnnotator[a.username] = allItems.filter((i) => i.annotator === a.username).length;
  }
  // 未分配
  byAnnotator['(未分配)'] = unassigned;

  // 按状态统计
  const byStatus = {};
  for (const item of allItems) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }

  return { total, assigned, unassigned, byAnnotator, byStatus };
}

/**
 * 执行分配
 * 根据 task.assignmentConfig 中的策略执行对应的分配算法
 *
 * @param {string} taskId - 任务ID
 * @param {object} config - 分配配置
 * @param {string} config.strategy - 分配策略
 * @param {string[]} config.annotators - 标注员列表
 * @param {object} config.options - 策略选项
 * @returns {object} 分配结果
 */
function executeAssignment(taskId, config) {
  const { strategy, annotators = [], options = {} } = config;

  // 验证任务存在
  const task = db.getById('tasks', taskId);
  if (!task) {
    return { error: '任务不存在' };
  }

  // 验证任务已发布：只有 in_progress 状态的任务才能分配
  if (!canTaskExposeWorkItems(task)) {
    return { error: '任务未发布，不能进行分配。请先发布任务后再分配标注员。' };
  }

  let result;
  switch (strategy) {
    case ASSIGNMENT_STRATEGY.EVEN_SPLIT:
      result = evenSplitAssign(taskId, annotators, options);
      break;
    case ASSIGNMENT_STRATEGY.MANUAL:
      result = manualAssign(taskId, options.assignments || []);
      break;
    default:
      return { error: `不支持的分配策略：${strategy}` };
  }

  // 如果分配成功（无 error），更新任务的 assignmentConfig
  if (!result.error) {
    const existingConfig = task.assignmentConfig || {};
    db.updateById('tasks', taskId, {
      assignmentConfig: {
        ...existingConfig,
        strategy,
        annotators,
        options,
        lastAssignedAt: new Date().toISOString(),
        lastResult: { assigned: result.assigned },
      },
    });
  }

  return result;
}

module.exports = {
  ASSIGNMENT_STRATEGY,
  getAssignableItems,
  getAnnotators,
  evenSplitAssign,
  manualAssign,
  clearAssignment,
  getAssignmentStats,
  executeAssignment,
};
