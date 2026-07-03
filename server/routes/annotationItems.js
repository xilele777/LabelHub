const express = require('express');
const createCrudRouter = require('./crudFactory');
const db = require('../store/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  DATA_ITEM_STATUS,
  DATA_ITEM_TRANSITIONS,
  validateTransition,
} = require('../constants/statusMachine');
const { runAIReview } = require('../services/aiReviewEngine');
const { isPlainObject, readArray, readString, readNumber } = require('../utils/requestValidation');
const {
  notifyReviewApproved,
  notifyReviewRejected,
  notifyAnnotationSubmitted,
  notifyAnnotationResubmitted,
  notifyAIReviewComplete,
} = require('../services/notificationService');
const itemTimeliness = require('../utils/itemTimeliness');
const {
  annotationSubmitLimiter,
  reviewActionLimiter,
  batchImportLimiter,
} = require('../middleware/apiRateLimit');

const router = express.Router();
router.use(requireAuth);

// ===== Lock timeout: 30 minutes =====
const LOCK_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_BATCH_IMPORT_ITEMS = Number(process.env.MAX_BATCH_IMPORT_ITEMS || 1000);

/**
 * Middleware: clean expired locks periodically (once per 60s at most).
 */
let lastCleanup = 0;
function cleanupExpiredLocks(req, res, next) {
  const now = Date.now();
  if (now - lastCleanup > 60000) {
    lastCleanup = now;
    db.cleanExpiredLocks(LOCK_TIMEOUT_MS);
  }
  next();
}
router.use(cleanupExpiredLocks);

router.post('/batch-import', requireRole('owner'), batchImportLimiter, (req, res) => {
  const taskIdResult = readString(req.body, 'taskId', {
    required: true,
    minLength: 1,
    maxLength: 80,
  });
  if (taskIdResult.error) {
    return res.fail(taskIdResult.error);
  }

  const itemsResult = readArray(req.body, 'items', {
    required: true,
    minLength: 1,
    maxLength: MAX_BATCH_IMPORT_ITEMS,
  });
  if (itemsResult.error) {
    return res.fail(itemsResult.error);
  }

  const taskId = taskIdResult.value;
  const items = itemsResult.value;
  const task = db.getById('tasks', taskId);
  if (!task) {
    return res.notFound('Task not found');
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isPlainObject(item)) {
      return res.fail(`items[${index}] must be an object`);
    }
    if (item.rawData !== undefined && !isPlainObject(item.rawData)) {
      return res.fail(`items[${index}].rawData must be an object`);
    }
  }

  const now = new Date().toISOString();
  const created = db.transaction(() => {
    const insertedItems = [];
    for (const item of items) {
      insertedItems.push(
        db.insert('annotation-items', {
          id: `ai${String(Date.now()).slice(-3)}${Math.random().toString(36).slice(2, 8)}`,
          taskId,
          rawData: item.rawData || {},
          status: 'pending',
          annotator: null,
          reviewer: null,
          annotationData: null,
          submittedAt: null,
          reviewedAt: null,
          rejectReason: null,
          auditHistory: [],
          createdAt: now,
          version: 1,
          lockedBy: null,
          lockedAt: null,
        }),
      );
    }
    return insertedItems;
  });

  return res.success(
    { imported: created.length, items: created },
    `Imported ${created.length} item(s)`,
    201,
  );
});

// ===== RBAC helpers =====

/**
 * Check if the current user owns this annotation item.
 * An annotator "owns" an item ONLY if they are the assigned annotator.
 * Unassigned items must be explicitly claimed via claim-assignment first.
 */
function isAnnotatorOwner(item, user) {
  if (user.role !== 'annotator') return false;
  // annotator owns it ONLY if they are the assigned annotator
  return item.annotator === user.username;
}

/**
 * Check if the current user can review this item (reviewer role).
 * Implements avoidance principle: reviewer cannot review their own annotation.
 */
function canReviewerApprove(item, user) {
  if (user.role !== 'reviewer') return false;
  // Avoidance: reviewer cannot review their own annotation
  if (item.annotator === user.username) return false;
  // Reviewer can review items assigned to them, or unassigned pending_review items
  return item.reviewer === null || item.reviewer === user.username;
}

function isTaskStarted(task) {
  return itemTimeliness.isTaskStarted(task);
}

function isReviewStarted(task) {
  return itemTimeliness.isTaskStarted(task) && !itemTimeliness.isTaskExpired(task);
}

function canTaskExposeWorkItems(task) {
  return itemTimeliness.canTaskExposeWorkItems(task);
}

function validateTaskSubmissionWindow(task, item) {
  if (!task) return 'Task not found';
  if (!canTaskExposeWorkItems(task)) {
    if (!itemTimeliness.isTaskStarted(task)) return 'Task has not started yet';
    if (itemTimeliness.isTaskExpired(task)) return 'Task has expired';
    return 'Task is not open for annotation';
  }
  if (item && itemTimeliness.isItemExpired(task, item, 'annotation')) {
    return 'Annotation item is overdue';
  }
  return null;
}

function validateReviewWindow(task, item) {
  if (!task) return 'Task not found';
  if (!canTaskExposeWorkItems(task)) {
    if (!itemTimeliness.isTaskStarted(task)) return 'Task has not started yet';
    if (itemTimeliness.isTaskExpired(task)) return 'Task has expired';
    return 'Task is not open for review';
  }
  if (item && itemTimeliness.isItemExpired(task, item, 'review')) {
    return 'Review item is overdue';
  }
  return null;
}

function returnAnnotationItemToPool(item, operator, reason) {
  if (!item.annotator) return item;
  const now = new Date().toISOString();
  const historyRecord = {
    id: `h${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
    operator,
    actionType: 'release_annotation_due_overdue',
    fromStatus: item.status,
    toStatus: item.status,
    reason,
    timestamp: now,
  };
  return db.updateById('annotation-items', item.id, {
    annotator: null,
    lockedBy: null,
    lockedAt: null,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });
}

function returnReviewItemToPool(item, operator, reason) {
  if (!item.reviewer) return item;
  const now = new Date().toISOString();
  const historyRecord = {
    id: `h${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
    operator,
    actionType: 'release_review_due_overdue',
    fromStatus: item.status,
    toStatus: item.status,
    reason,
    timestamp: now,
  };
  return db.updateById('annotation-items', item.id, {
    reviewer: null,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });
}

const OVERDUE_POOL_ACTIONS = {
  annotation: 'release_annotation_due_overdue',
  review: 'release_review_due_overdue',
};

function hasAuditAction(item, actionType) {
  return (
    Array.isArray(item.auditHistory) &&
    item.auditHistory.some((record) => record?.actionType === actionType)
  );
}

function wasReturnedToPoolByOverdue(item, phase) {
  if (!hasAuditAction(item, OVERDUE_POOL_ACTIONS[phase])) return false;
  const task = db.getById('tasks', item.taskId);
  return itemTimeliness.isItemExpired(task, item, phase);
}

// ===== Custom routes that must be registered BEFORE CRUD router =====
// (CRUD router's GET /:id would otherwise match /available, etc.)

/**
 * GET /annotation-items/available
 * List unassigned annotation items that the current annotator can claim.
 * RBAC: annotator + owner
 * Query params: taskId (optional), status (optional, defaults to pending)
 */
router.get('/available', (req, res) => {
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can claim annotation items', 403);
  }

  const taskId = req.query.taskId;
  const statuses = req.query.status
    ? String(req.query.status).split(',')
    : ['pending', 'draft', 'rejected'];

  let items = db.getAll('annotation-items');

  // Only show unassigned, active items in the requested statuses.
  items = items.filter(
    (item) =>
      item.annotator === null &&
      !item.archived &&
      !wasReturnedToPoolByOverdue(item, 'annotation') &&
      statuses.includes(item.status),
  );

  // Only expose items from tasks that are open for work.
  items = items.filter((item) => {
    const task = db.getById('tasks', item.taskId);
    return canTaskExposeWorkItems(task);
  });

  // Filter by task when requested.
  if (taskId) {
    items = items.filter((item) => item.taskId === taskId);
  }

  // Return the fields needed by the claim list.
  items = items.map((item) => ({
    id: item.id,
    taskId: item.taskId,
    status: item.status,
    annotator: item.annotator,
    rawData: item.rawData,
    rawDataPreview: item.rawData
      ? item.rawData.text
        ? String(item.rawData.text).slice(0, 80)
        : item.rawData.imageUrl
          ? String(item.rawData.imageUrl).slice(0, 80)
          : JSON.stringify(item.rawData).slice(0, 80)
      : '',
  }));

  res.success({ items, total: items.length });
});

router.get('/review-available', (req, res) => {
  if (req.currentUser.role !== 'reviewer') {
    return res.fail('Only reviewers can claim review items', 403);
  }

  const taskId = req.query.taskId;
  const statuses = req.query.status
    ? String(req.query.status).split(',')
    : ['submitted', 'ai_reviewed', 'pending_review'];

  let items = db
    .getAll('annotation-items')
    .filter(
      (item) =>
        item.reviewer === null &&
        !item.archived &&
        !wasReturnedToPoolByOverdue(item, 'review') &&
        statuses.includes(item.status),
    );

  items = items.filter((item) => {
    const task = db.getById('tasks', item.taskId);
    return canTaskExposeWorkItems(task);
  });

  if (taskId) {
    items = items.filter((item) => item.taskId === taskId);
  }

  const simplified = items.map((item) => ({
    id: item.id,
    taskId: item.taskId,
    status: item.status,
    annotator: item.annotator,
    reviewer: item.reviewer,
    submittedAt: item.submittedAt,
    rawData: item.rawData,
    rawDataPreview: item.rawData
      ? item.rawData.text
        ? String(item.rawData.text).slice(0, 80)
        : item.rawData.imageUrl
          ? String(item.rawData.imageUrl).slice(0, 80)
          : JSON.stringify(item.rawData).slice(0, 80)
      : '',
  }));

  res.success({ items: simplified, total: simplified.length });
});

// ===== Basic CRUD for annotation-items 鈥?with RBAC + status transition validation =====
router.put('/batch-claim-assignment', (req, res) => {
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can claim annotation items', 403);
  }

  const ids = Array.isArray(req.body?.ids)
    ? [
        ...new Set(
          req.body.ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()),
        ),
      ]
    : [];

  if (ids.length === 0) {
    return res.fail('Please select annotation items to claim');
  }

  const now = new Date().toISOString();
  const username = req.currentUser.username;
  const claimed = [];
  const failed = [];

  ids.forEach((id, index) => {
    const item = db.getById('annotation-items', id);
    if (!item) {
      failed.push({ id, reason: 'Annotation item not found' });
      return;
    }
    if (item.annotator !== null) {
      failed.push({ id, reason: 'Annotation item has already been assigned' });
      return;
    }
    if (wasReturnedToPoolByOverdue(item, 'annotation')) {
      failed.push({ id, reason: 'Annotation item is overdue and cannot be claimed' });
      return;
    }
    if (!['pending', 'draft', 'rejected'].includes(item.status)) {
      failed.push({ id, reason: 'Current status cannot be claimed for annotation' });
      return;
    }
    if (item.archived) {
      failed.push({ id, reason: 'Archived annotation items cannot be claimed' });
      return;
    }

    const task = db.getById('tasks', item.taskId);
    if (!canTaskExposeWorkItems(task)) {
      failed.push({ id, reason: 'Task is not open for annotation' });
      return;
    }

    const historyRecord = {
      id: `h${Date.now()}${index}`,
      operator: username,
      actionType: 'claim_assignment',
      fromStatus: item.status,
      toStatus: item.status,
      reason: `Annotator ${username} batch claimed`,
      timestamp: now,
    };

    const updated = db.updateById('annotation-items', item.id, {
      annotator: username,
      auditHistory: [...(item.auditHistory || []), historyRecord],
    });
    claimed.push(updated);
  });

  res.success(
    {
      claimed,
      failed,
      claimedCount: claimed.length,
      failedCount: failed.length,
    },
    claimed.length > 0
      ? `Claimed ${claimed.length} annotation item(s)`
      : 'No annotation items were claimed',
  );
});

router.put('/batch-claim-review', (req, res) => {
  if (req.currentUser.role !== 'reviewer') {
    return res.fail('Only reviewers can claim review items', 403);
  }

  const ids = Array.isArray(req.body?.ids)
    ? [
        ...new Set(
          req.body.ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()),
        ),
      ]
    : [];

  if (ids.length === 0) {
    return res.fail('Please select review items to claim');
  }

  const now = new Date().toISOString();
  const username = req.currentUser.username;
  const claimed = [];
  const failed = [];

  ids.forEach((id, index) => {
    const item = db.getById('annotation-items', id);
    if (!item) {
      failed.push({ id, reason: 'Review item not found' });
      return;
    }
    if (item.reviewer !== null) {
      failed.push({ id, reason: 'Review item has already been assigned' });
      return;
    }
    if (wasReturnedToPoolByOverdue(item, 'review')) {
      failed.push({ id, reason: 'Review item is overdue and cannot be claimed' });
      return;
    }
    if (!['submitted', 'ai_reviewed', 'pending_review'].includes(item.status)) {
      failed.push({ id, reason: 'Current status cannot be claimed for review' });
      return;
    }
    if (item.archived) {
      failed.push({ id, reason: 'Archived annotation items cannot be claimed for review' });
      return;
    }

    const task = db.getById('tasks', item.taskId);
    const timeWindowError = validateReviewWindow(task, item);
    if (timeWindowError) {
      failed.push({ id, reason: timeWindowError });
      return;
    }

    const historyRecord = {
      id: `h${Date.now()}${index}`,
      operator: username,
      actionType: 'claim_review',
      fromStatus: item.status,
      toStatus: item.status,
      reason: `Reviewer ${username} batch claimed`,
      timestamp: now,
    };

    const updated = db.updateById('annotation-items', item.id, {
      reviewer: username,
      auditHistory: [...(item.auditHistory || []), historyRecord],
    });
    claimed.push(updated);
  });

  res.success(
    {
      claimed,
      failed,
      claimedCount: claimed.length,
      failedCount: failed.length,
    },
    claimed.length > 0
      ? `Claimed ${claimed.length} review item(s)`
      : 'No review items were claimed',
  );
});

const crud = createCrudRouter('annotation-items', {
  // Annotators only see their own items; reviewers see items assigned to them or pending review;
  // owners see everything
  filterList(items, req) {
    // Exclude archived annotation items unless archived=true is requested.
    const showArchived = req.query.archived === 'true';
    let filtered = items;
    if (!showArchived) {
      filtered = items.filter((item) => !item.archived);
    } else {
      // In archive mode, only show archived items.
      filtered = items.filter((item) => item.archived);
    }

    // Outside archive mode, only show items from tasks that are open for work.
    // Archive mode keeps historical reviewed data visible.
    if (!showArchived) {
      filtered = filtered.filter((item) => {
        const task = db.getById('tasks', item.taskId);
        return canTaskExposeWorkItems(task);
      });
    }

    const role = req.currentUser?.role;
    if (role === 'owner') return filtered;
    if (role === 'annotator') {
      if (showArchived) {
        return filtered.filter((item) => item.annotator === req.currentUser.username);
      }
      // Annotators only see items explicitly assigned to them.
      // Unassigned items must be claimed through claim-assignment first.
      return filtered.filter((item) => {
        const task = db.getById('tasks', item.taskId);
        return (
          item.annotator === req.currentUser.username &&
          !itemTimeliness.isItemExpired(task, item, 'annotation')
        );
      });
    }
    if (role === 'reviewer') {
      if (showArchived) {
        return filtered.filter((item) => item.reviewer === req.currentUser.username);
      }
      // Reviewer only sees review items explicitly assigned/claimed by them.
      return filtered.filter((item) => {
        const task = db.getById('tasks', item.taskId);
        return (
          item.reviewer === req.currentUser.username &&
          !itemTimeliness.isItemExpired(task, item, 'review')
        );
      });
    }
    return filtered;
  },
  // afterRead keeps legacy seed data compatible with the frontend contract.
  afterRead(item, _req) {
    if (item.lockedBy === undefined) item.lockedBy = null;
    if (item.lockedAt === undefined) item.lockedAt = null;
    if (item.version === undefined) item.version = 1;
    return item;
  },
  beforeCreate(item, req) {
    // Only owner can create annotation items directly
    if (req.currentUser.role !== 'owner') {
      return 'Only owners can create annotation items';
    }
    // Ensure newly created items include lock metadata.
    if (item.lockedBy === undefined) item.lockedBy = null;
    if (item.lockedAt === undefined) item.lockedAt = null;
    if (item.version === undefined) item.version = 1;
    return item;
  },
  beforeUpdate(existing, updates, req) {
    // RBAC: annotator can update own items, reviewer/owner cannot update annotation data via generic PUT
    const role = req.currentUser.role;
    if (role === 'annotator') {
      if (!isAnnotatorOwner(existing, req.currentUser)) {
        return 'Annotators can only update their own annotation items';
      }
    } else {
      return 'Only annotators can update annotation data';
    }

    // If the request is trying to change status, validate the transition
    if (updates.status && updates.status !== existing.status) {
      const { valid, reason } = validateTransition(
        DATA_ITEM_TRANSITIONS,
        existing.status,
        updates.status,
      );
      if (!valid) {
        return reason;
      }
    }

    // Optimistic lock: check version for annotation-items PUT
    if (
      updates.version !== undefined &&
      updates.version !== null &&
      existing.version !== updates.version
    ) {
      return `Version conflict: current version is ${existing.version}, submitted version is ${updates.version}`;
    }

    return undefined;
  },
  beforeDelete(existing, req) {
    // Only owner can delete annotation items
    if (req.currentUser.role !== 'owner') {
      return 'Only owners can delete annotation items';
    }
    return undefined;
  },
});
router.use(crud);

/**
 * PUT /annotation-items/:id/save-draft
 * Body: { annotationData }
 * Save draft annotation and set status to 'draft'.
 * RBAC: annotator (own items only, or auto-claim unassigned items) + owner
 */
router.put('/:id/save-draft', annotationSubmitLimiter, (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // RBAC: only annotator
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can save drafts', 403);
  }
  // Annotator can save-draft if they own the item OR if the item is unassigned (auto-claim)
  if (item.annotator !== null && !isAnnotatorOwner(item, req.currentUser)) {
    return res.fail('Annotators can only operate on their own data', 403);
  }

  // Validate status transition: current -> draft
  const { valid, reason } = validateTransition(
    DATA_ITEM_TRANSITIONS,
    item.status,
    DATA_ITEM_STATUS.DRAFT,
  );
  if (!valid) {
    return res.fail(reason);
  }

  const task = db.getById('tasks', item.taskId);
  const timeWindowError = validateTaskSubmissionWindow(task, item);
  if (timeWindowError) {
    const returnedItem = returnAnnotationItemToPool(
      item,
      req.currentUser?.username || 'system',
      timeWindowError,
    );
    return res.fail(timeWindowError, 403, {
      returnedToPool: Boolean(item.annotator),
      item: returnedItem,
    });
  }

  const now = new Date().toISOString();
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: req.currentUser?.username || 'unknown',
    actionType: 'save_draft',
    fromStatus: item.status,
    toStatus: 'draft',
    reason: null,
    timestamp: now,
  };

  // Optimistic lock: check version
  const clientVersion = req.body.version;
  if (clientVersion !== undefined && clientVersion !== null && item.version !== clientVersion) {
    return res.fail(
      `Version conflict: current version is ${item.version}, submitted version is ${clientVersion}`,
      409,
      { currentVersion: item.version, serverItem: item },
    );
  }

  const updated = db.updateById('annotation-items', item.id, {
    status: 'draft',
    annotationData: req.body.annotationData || item.annotationData,
    annotator: req.currentUser?.username || item.annotator,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  res.success(updated, 'Draft saved');
});

/**
 * Run server-side AI review, persist its result, and advance item status.
 * Reused by submit, resubmit, and POST ai-review.
 *
 * @param {Object} item - Submitted annotation item.
 * @returns {{ reviewRecord: Object, updatedItem: Object } | null} AI result, or null when template data is missing.
 */
function executeAndPersistAIReview(item) {
  // 1. Load the related template.
  const task = db.getById('tasks', item.taskId);
  const templateId = task?.templateId;
  const template = templateId ? db.getById('templates', templateId) : null;

  if (!template || !template.fields || template.fields.length === 0) {
    // Skip AI review when the template is missing or has no fields.
    return null;
  }

  // 2. Run the AI review engine on the server.
  const aiResult = runAIReview({
    template,
    rawData: item.rawData || {},
    annotationResult: item.annotationData || {},
    dataItemId: item.id,
    taskId: item.taskId,
    templateId: templateId,
  });

  // 3. Persist the AI review result.
  const now = new Date().toISOString();
  const reviewRecord = {
    id: aiResult.id,
    dataItemId: item.id,
    taskId: item.taskId,
    templateId: templateId,
    reviewStatus: aiResult.reviewStatus,
    score: aiResult.score,
    summary: aiResult.summary,
    matchedRules: aiResult.matchedRules,
    fieldWarnings: aiResult.fieldWarnings,
    suggestions: aiResult.suggestions,
    reviewedAt: now,
    modelVersion: aiResult.modelVersion,
  };
  db.insert('reviews', reviewRecord);

  // 4. Advance item status: submitted -> ai_reviewing -> ai_reviewed -> pending_review.
  const historyRecords = [
    {
      id: `h${Date.now()}a`,
      operator: 'AI System',
      actionType: 'ai_review_start',
      fromStatus: item.status,
      toStatus: 'ai_reviewing',
      reason: null,
      timestamp: now,
    },
    {
      id: `h${Date.now()}b`,
      operator: 'AI System',
      actionType: 'ai_review_complete',
      fromStatus: 'ai_reviewing',
      toStatus: 'ai_reviewed',
      reason: null,
      timestamp: now,
    },
    {
      id: `h${Date.now()}c`,
      operator: 'System',
      actionType: 'assign_reviewer',
      fromStatus: 'ai_reviewed',
      toStatus: 'pending_review',
      reason: null,
      timestamp: now,
    },
  ];

  const updatedItem = db.updateById('annotation-items', item.id, {
    status: 'pending_review',
    auditHistory: [...(item.auditHistory || []), ...historyRecords],
  });

  return { reviewRecord, updatedItem };
}

/**
 * PUT /annotation-items/:id/submit
 * Body: { annotationData }
 * Submit annotation, trigger server-side AI review, and advance to pending_review.
 * RBAC: annotator (own items only) + owner
 *
 * Flow:
 * 1. Save annotation data and set status to submitted.
 * 2. Run AI review on the server.
 * 3. Persist the review and advance status to pending_review.
 * 4. Return the updated item and AI review result.
 */
router.put('/:id/submit', annotationSubmitLimiter, (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // Validate input: annotationData
  if (
    req.body.annotationData !== undefined &&
    req.body.annotationData !== null &&
    !isPlainObject(req.body.annotationData)
  ) {
    return res.fail('annotationData must be an object');
  }

  // RBAC: only annotator
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can submit annotations', 403);
  }
  // Annotator can submit if they own the item OR if the item is unassigned (auto-claim)
  if (item.annotator !== null && !isAnnotatorOwner(item, req.currentUser)) {
    return res.fail('Annotators can only operate on their own data', 403);
  }

  // Validate status transition: current -> submitted
  const { valid, reason } = validateTransition(
    DATA_ITEM_TRANSITIONS,
    item.status,
    DATA_ITEM_STATUS.SUBMITTED,
  );
  if (!valid) {
    return res.fail(reason);
  }

  const task = db.getById('tasks', item.taskId);
  const timeWindowError = validateTaskSubmissionWindow(task, item);
  if (timeWindowError) {
    const returnedItem = returnAnnotationItemToPool(
      item,
      req.currentUser?.username || 'system',
      timeWindowError,
    );
    return res.fail(timeWindowError, 403, {
      returnedToPool: Boolean(item.annotator),
      item: returnedItem,
    });
  }

  const now = new Date().toISOString();
  const annotationData = req.body.annotationData || item.annotationData;
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: req.currentUser?.username || 'unknown',
    actionType: 'submit',
    fromStatus: item.status,
    toStatus: 'submitted',
    reason: null,
    timestamp: now,
  };

  // Optimistic lock: check version
  const clientVersion = req.body.version;
  if (clientVersion !== undefined && clientVersion !== null && item.version !== clientVersion) {
    return res.fail(
      `Version conflict: current version is ${item.version}, submitted version is ${clientVersion}`,
      409,
      { currentVersion: item.version, serverItem: item },
    );
  }

  // Step 1: submit annotation and set status to submitted.
  const submittedItem = db.updateById('annotation-items', item.id, {
    status: 'submitted',
    annotationData,
    annotator: req.currentUser?.username || item.annotator,
    submittedAt: now,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  // Step 2: trigger server-side AI review.
  const aiResult = executeAndPersistAIReview(submittedItem);

  // Notify reviewers that an annotation was submitted.
  notifyAnnotationSubmitted(submittedItem, req.currentUser);

  if (aiResult) {
    // Notify reviewers that AI review completed.
    notifyAIReviewComplete(aiResult.updatedItem, aiResult.reviewRecord);

    res.success(
      {
        item: aiResult.updatedItem,
        review: aiResult.reviewRecord,
      },
      'Annotation submitted and AI review completed',
    );
  } else {
    // Keep submitted status when AI review is skipped because the template is missing.
    res.success(
      submittedItem,
      'Annotation submitted; AI review skipped because template was not found',
    );
  }
});

/**
 * PUT /annotation-items/:id/approve
 * Body: { reason? }
 * Approve annotation and set status to 'reviewed'.
 * RBAC: reviewer (not own annotation) + owner
 */
router.put('/:id/approve', reviewActionLimiter, (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // Validate input: reason (optional)
  if (req.body.reason !== undefined && req.body.reason !== null) {
    const reasonResult = readString(req.body, 'reason', { maxLength: 1000 });
    if (reasonResult.error) {
      return res.fail(reasonResult.error);
    }
  }

  // RBAC: only reviewer, with avoidance principle
  if (!canReviewerApprove(item, req.currentUser)) {
    if (req.currentUser.role === 'annotator') {
      return res.fail('Annotators cannot review annotations', 403);
    }
    if (req.currentUser.role === 'owner') {
      return res.fail('Owners cannot review annotations', 403);
    }
    // Reviewer trying to review their own annotation
    return res.fail('Reviewers cannot review their own annotations', 403);
  }

  // Validate status transition: current -> reviewed
  const { valid, reason } = validateTransition(
    DATA_ITEM_TRANSITIONS,
    item.status,
    DATA_ITEM_STATUS.REVIEWED,
  );
  if (!valid) {
    return res.fail(reason);
  }

  const task = db.getById('tasks', item.taskId);
  const timeWindowError = validateReviewWindow(task, item);
  if (timeWindowError) {
    const returnedItem = returnReviewItemToPool(
      item,
      req.currentUser?.username || 'system',
      timeWindowError,
    );
    return res.fail(timeWindowError, 403, {
      returnedToPool: Boolean(item.reviewer),
      item: returnedItem,
    });
  }

  const now = new Date().toISOString();
  const historyRecords = [
    {
      id: `h${Date.now()}a`,
      operator: req.currentUser?.username || 'unknown',
      actionType: 'approve',
      fromStatus: item.status,
      toStatus: 'reviewed',
      reason: req.body.reason || null,
      timestamp: now,
    },
    {
      id: `h${Date.now()}b`,
      operator: req.currentUser?.username || 'unknown',
      actionType: 'archive',
      fromStatus: 'reviewed',
      toStatus: 'reviewed',
      reason: 'Review approved; automatically archived',
      timestamp: now,
    },
  ];

  const updated = db.updateById('annotation-items', item.id, {
    status: 'reviewed',
    reviewer: req.currentUser?.username || item.reviewer,
    reviewedAt: now,
    archived: true,
    archivedAt: now,
    auditHistory: [...(item.auditHistory || []), ...historyRecords],
  });

  // Notify the annotator that review was approved.
  notifyReviewApproved(updated, req.currentUser);

  res.success(updated, 'Review approved and archived');
});

/**
 * PUT /annotation-items/:id/reject
 * Body: { reason }
 * Reject annotation and set status to 'rejected'.
 * RBAC: reviewer (not own annotation) + owner
 */
router.put('/:id/reject', reviewActionLimiter, (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // Validate input: reason (required)
  const reasonResult = readString(req.body, 'reason', {
    required: true,
    minLength: 1,
    maxLength: 1000,
  });
  if (reasonResult.error) {
    return res.fail(reasonResult.error);
  }

  // RBAC: only reviewer, with avoidance principle
  if (!canReviewerApprove(item, req.currentUser)) {
    if (req.currentUser.role === 'annotator') {
      return res.fail('Annotators cannot review annotations', 403);
    }
    if (req.currentUser.role === 'owner') {
      return res.fail('Owners cannot review annotations', 403);
    }
    // Reviewer trying to review their own annotation
    return res.fail('Reviewers cannot review their own annotations', 403);
  }

  // Validate status transition: current -> rejected
  const { valid, reason } = validateTransition(
    DATA_ITEM_TRANSITIONS,
    item.status,
    DATA_ITEM_STATUS.REJECTED,
  );
  if (!valid) {
    return res.fail(reason);
  }

  const rejectReason = reasonResult.value;

  const task = db.getById('tasks', item.taskId);
  const timeWindowError = validateReviewWindow(task, item);
  if (timeWindowError) {
    const returnedItem = returnReviewItemToPool(
      item,
      req.currentUser?.username || 'system',
      timeWindowError,
    );
    return res.fail(timeWindowError, 403, {
      returnedToPool: Boolean(item.reviewer),
      item: returnedItem,
    });
  }

  const now = new Date().toISOString();
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: req.currentUser?.username || 'unknown',
    actionType: 'reject',
    fromStatus: item.status,
    toStatus: 'rejected',
    reason: rejectReason,
    timestamp: now,
  };

  const updated = db.updateById('annotation-items', item.id, {
    status: 'rejected',
    reviewer: req.currentUser?.username || item.reviewer,
    reviewedAt: now,
    rejectReason: rejectReason,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  // Notify the annotator that review was rejected.
  notifyReviewRejected(updated, req.currentUser);

  res.success(updated, 'Annotation rejected');
});

/**
 * PUT /annotation-items/:id/resubmit
 * Body: { annotationData }
 * Resubmit after rejection, trigger AI review, and advance to pending_review.
 * RBAC: annotator (own items only) + owner
 *
 * Same flow as submit: AI review runs automatically on the server.
 */
router.put('/:id/resubmit', annotationSubmitLimiter, (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // Validate input: annotationData
  if (
    req.body.annotationData !== undefined &&
    req.body.annotationData !== null &&
    !isPlainObject(req.body.annotationData)
  ) {
    return res.fail('annotationData must be an object');
  }

  // RBAC: only annotator, and must own the item
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can resubmit annotations', 403);
  }
  if (!isAnnotatorOwner(item, req.currentUser)) {
    return res.fail('Annotators can only operate on their own data', 403);
  }

  // Validate status transition: current -> submitted (resubmission)
  const { valid, reason } = validateTransition(
    DATA_ITEM_TRANSITIONS,
    item.status,
    DATA_ITEM_STATUS.SUBMITTED,
  );
  if (!valid) {
    return res.fail(reason);
  }

  const task = db.getById('tasks', item.taskId);
  const timeWindowError = validateTaskSubmissionWindow(task, item);
  if (timeWindowError) {
    const returnedItem = returnAnnotationItemToPool(
      item,
      req.currentUser?.username || 'system',
      timeWindowError,
    );
    return res.fail(timeWindowError, 403, {
      returnedToPool: Boolean(item.annotator),
      item: returnedItem,
    });
  }

  const now = new Date().toISOString();
  const annotationData = req.body.annotationData || item.annotationData;
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: req.currentUser?.username || 'unknown',
    actionType: 'resubmit',
    fromStatus: item.status,
    toStatus: 'submitted',
    reason: null,
    timestamp: now,
  };

  // Optimistic lock: check version
  const clientVersion = req.body.version;
  if (clientVersion !== undefined && clientVersion !== null && item.version !== clientVersion) {
    return res.fail(
      `Version conflict: current version is ${item.version}, submitted version is ${clientVersion}`,
      409,
      { currentVersion: item.version, serverItem: item },
    );
  }

  // Step 1: resubmit and set status to submitted.
  const submittedItem = db.updateById('annotation-items', item.id, {
    status: 'submitted',
    annotationData,
    submittedAt: now,
    rejectReason: null,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  // Step 2: trigger server-side AI review.
  const aiResult = executeAndPersistAIReview(submittedItem);

  // Notify reviewers that an annotation was resubmitted.
  notifyAnnotationResubmitted(submittedItem, req.currentUser);

  if (aiResult) {
    // Notify reviewers that AI review completed.
    notifyAIReviewComplete(aiResult.updatedItem, aiResult.reviewRecord);

    res.success(
      {
        item: aiResult.updatedItem,
        review: aiResult.reviewRecord,
      },
      'Annotation resubmitted and AI review completed',
    );
  } else {
    res.success(
      submittedItem,
      'Annotation resubmitted; AI review skipped because template was not found',
    );
  }
});

/**
 * PUT /annotation-items/:id/claim-assignment
 * Annotator claims one unassigned annotation item.
 * Sets item.annotator to the current user while preserving item status.
 * RBAC: annotator + owner
 */
router.put('/:id/claim-assignment', (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // RBAC: only annotator can claim assignment
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can claim annotation items', 403);
  }

  // Already assigned items cannot be claimed again.
  if (item.annotator !== null) {
    return res.fail('Annotation item has already been assigned', 403);
  }

  if (wasReturnedToPoolByOverdue(item, 'annotation')) {
    return res.fail('Annotation item is overdue and cannot be claimed', 403);
  }

  if (!['pending', 'draft', 'rejected'].includes(item.status)) {
    return res.fail('Current status cannot be claimed for annotation', 403);
  }

  // Archived items cannot be claimed.
  if (item.archived) {
    return res.fail('Archived annotation items cannot be claimed', 403);
  }

  // Items from tasks that are not open cannot be claimed.
  const task = db.getById('tasks', item.taskId);
  if (!canTaskExposeWorkItems(task)) {
    return res.fail('Task is not open for annotation', 403);
  }

  const now = new Date().toISOString();
  const username = req.currentUser.username;

  const historyRecord = {
    id: `h${Date.now()}`,
    operator: username,
    actionType: 'claim_assignment',
    fromStatus: item.status,
    toStatus: item.status,
    reason: `Annotator ${username} claimed`,
    timestamp: now,
  };

  const updated = db.updateById('annotation-items', item.id, {
    annotator: username,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  res.success(updated, 'Annotation item claimed successfully');
});

router.put('/:id/claim-review', (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Review item not found');
  }

  if (req.currentUser.role !== 'reviewer') {
    return res.fail('Only reviewers can claim review items', 403);
  }

  if (item.reviewer !== null) {
    return res.fail('Review item has already been assigned', 403);
  }

  if (wasReturnedToPoolByOverdue(item, 'review')) {
    return res.fail('Review item is overdue and cannot be claimed', 403);
  }

  if (!['submitted', 'ai_reviewed', 'pending_review'].includes(item.status)) {
    return res.fail('Current status cannot be claimed for review', 403);
  }

  if (item.archived) {
    return res.fail('Archived annotation items cannot be claimed for review', 403);
  }

  const task = db.getById('tasks', item.taskId);
  const timeWindowError = validateReviewWindow(task, item);
  if (timeWindowError) {
    return res.fail(timeWindowError, 403);
  }

  const now = new Date().toISOString();
  const username = req.currentUser.username;
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: username,
    actionType: 'claim_review',
    fromStatus: item.status,
    toStatus: item.status,
    reason: `Reviewer ${username} claimed review item`,
    timestamp: now,
  };

  const updated = db.updateById('annotation-items', item.id, {
    reviewer: username,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  res.success(updated, 'Review item claimed successfully');
});

/**
 * PUT /annotation-items/:id/claim
 * Claim (pessimistic lock) an annotation item for editing.
 * Only one user can hold the lock at a time; locks auto-expire after 30 minutes.
 * RBAC: annotator (own items) + owner
 */
router.put('/:id/claim', (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // RBAC: only annotator can claim (owner cannot annotate)
  if (req.currentUser.role !== 'annotator') {
    return res.fail('Only annotators can lock annotation items', 403);
  }
  if (!isAnnotatorOwner(item, req.currentUser)) {
    return res.fail('Annotators can only lock their own annotation items', 403);
  }

  const username = req.currentUser.username;
  const result = db.claimItem(item.id, username, LOCK_TIMEOUT_MS);

  if (result.claimed) {
    res.success(result.item, 'Lock acquired');
  } else if (result.notFound) {
    res.notFound('Annotation item not found');
  } else {
    res.fail(
      `This item is locked by ${result.lockedBy} since ${result.lockedAt}`,
      423, // HTTP 423 Locked
      { lockedBy: result.lockedBy, lockedAt: result.lockedAt },
    );
  }
});

/**
 * PUT /annotation-items/:id/release
 * Release (unlock) an annotation item.
 * RBAC: the lock holder + owner can release
 */
router.put('/:id/release', (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  const username = req.currentUser.username;
  // Owner can force-release any lock (admin operation), annotator can only release own locks
  if (req.currentUser.role === 'annotator' && item.lockedBy && item.lockedBy !== username) {
    return res.fail('Annotators can only release their own annotation locks', 403);
  }
  if (req.currentUser.role === 'reviewer') {
    return res.fail('Reviewers cannot release annotation locks', 403);
  }

  const result = db.releaseItem(item.id, username);
  if (result.released) {
    res.success(result.item, 'Released');
  } else if (result.notFound) {
    res.notFound('Annotation item not found');
  } else {
    res.fail(`Only the lock holder ${result.lockedBy} can release this item`, 403);
  }
});

/**
 * POST /annotation-items/release-all
 * Release all locks held by the current user (useful on logout).
 * RBAC: any authenticated user (can only release their own locks)
 */
router.post('/release-all', (req, res) => {
  const username = req.currentUser.username;
  const count = db.releaseAllByUser(username);
  res.success({ releasedCount: count }, `Released ${count} lock(s)`);
});

/**
 * POST /annotation-items/:id/ai-review
 * Manually trigger AI review for an annotation item that is in 'submitted' status.
 * RBAC: owner only (manual trigger is an admin operation)
 */
router.post('/:id/ai-review', requireRole('owner'), (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // Only submitted items can be AI-reviewed
  if (item.status !== 'submitted') {
    return res.fail(
      `Only submitted annotation items can be AI-reviewed; current status: ${item.status}`,
    );
  }

  const aiResult = executeAndPersistAIReview(item);

  if (aiResult) {
    // Notify reviewers that AI review completed.
    notifyAIReviewComplete(aiResult.updatedItem, aiResult.reviewRecord);

    res.success(
      {
        item: aiResult.updatedItem,
        review: aiResult.reviewRecord,
      },
      'AI review completed',
    );
  } else {
    res.fail('AI review skipped: related template was not found or has no fields');
  }
});

/**
 * PUT /annotation-items/:id/archive
 * Archive an annotation item (mark as archived).
 * Only reviewed (approved) items can be archived.
 * RBAC: owner + reviewer can archive
 */
router.put('/:id/archive', (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  // RBAC: only owner or reviewer can archive
  if (req.currentUser.role !== 'owner' && req.currentUser.role !== 'reviewer') {
    return res.fail('Annotators cannot archive annotation items', 403);
  }

  // Only reviewed items can be archived
  if (item.status !== 'reviewed') {
    return res.fail('Only approved annotation items can be archived');
  }

  if (item.archived) {
    return res.fail('Annotation item is already archived');
  }

  const now = new Date().toISOString();
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: req.currentUser?.username || 'unknown',
    actionType: 'archive',
    fromStatus: item.status,
    toStatus: item.status,
    reason: 'Review approved; archived',
    timestamp: now,
  };

  const updated = db.updateById('annotation-items', item.id, {
    archived: true,
    archivedAt: now,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  res.success(updated, 'Annotation item archived');
});

/**
 * PUT /annotation-items/:id/unarchive
 * Unarchive an annotation item (remove from archive).
 * RBAC: owner only
 */
router.put('/:id/unarchive', requireRole('owner'), (req, res) => {
  const item = db.getById('annotation-items', req.params.id);
  if (!item) {
    return res.notFound('Annotation item not found');
  }

  if (!item.archived) {
    return res.fail('Annotation item is not archived');
  }

  const now = new Date().toISOString();
  const historyRecord = {
    id: `h${Date.now()}`,
    operator: req.currentUser?.username || 'unknown',
    actionType: 'unarchive',
    fromStatus: item.status,
    toStatus: item.status,
    reason: 'Unarchived',
    timestamp: now,
  };

  const updated = db.updateById('annotation-items', item.id, {
    archived: false,
    archivedAt: null,
    auditHistory: [...(item.auditHistory || []), historyRecord],
  });

  res.success(updated, 'Annotation item unarchived');
});

module.exports = router;
