const assert = require('assert');
const db = require('../store/db');
const itemTimeliness = require('../utils/itemTimeliness');

function withTempData(fn) {
  const originalTasks = db.getAll('tasks');
  const originalItems = db.getAll('annotation-items');
  try {
    fn();
  } finally {
    db.seed('tasks', originalTasks);
    db.seed('annotation-items', originalItems);
  }
}

withTempData(() => {
  const now = Date.now();
  const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const oneDayAhead = new Date(now + 24 * 60 * 60 * 1000).toISOString();

  const endedTask = db.insert('tasks', {
    id: 'task_time_effective',
    name: 'Timeliness effective task',
    description: 'test',
    type: 'image_classification',
    owner: 'owner',
    templateId: null,
    templateName: null,
    instructions: '',
    status: 'ended',
    startsAt: twoDaysAgo,
    dueAt: twoDaysAgo,
    annotationTimeoutHours: 24,
    reviewTimeoutHours: 24,
    archived: false,
  });

  const reopenedTask = {
    ...endedTask,
    status: 'in_progress',
    dueAt: oneDayAhead,
    taskEndedNotifiedAt: null,
  };
  const endedButExtendedTask = {
    ...endedTask,
    dueAt: oneDayAhead,
  };
  const manuallyEndedFutureTask = {
    ...endedTask,
    status: 'ended',
    dueAt: oneDayAhead,
    taskEndedNotifiedAt: new Date(now).toISOString(),
  };

  assert.strictEqual(
    itemTimeliness.canTaskExposeWorkItems(manuallyEndedFutureTask),
    false,
    'manually ended tasks with a future deadline should stay closed',
  );
  assert.strictEqual(
    itemTimeliness.canTaskExposeWorkItems(endedButExtendedTask),
    true,
    'ended tasks with a future deadline should be exposed while the API repairs persisted status',
  );
  assert.strictEqual(
    itemTimeliness.canTaskExposeWorkItems(reopenedTask),
    true,
    'an ended task should become work-visible after its deadline is extended and status is restored',
  );

  const reviewPoolItem = {
    id: 'review_item_time_effective',
    taskId: endedTask.id,
    rawData: { text: 'review test' },
    status: 'pending_review',
    annotator: 'annotator',
    reviewer: null,
    annotationData: { value: 'done' },
    submittedAt: oneDayAhead,
    reviewedAt: null,
    rejectReason: null,
    archived: false,
    auditHistory: [
      {
        actionType: 'claim_assignment',
        timestamp: twoDaysAgo,
      },
      {
        actionType: 'submit',
        timestamp: oneDayAhead,
      },
      {
        actionType: 'assign_reviewer',
        timestamp: twoDaysAgo,
      },
    ],
  };

  assert.strictEqual(
    itemTimeliness.canTaskExposeWorkItems(endedButExtendedTask) &&
      !itemTimeliness.isItemExpired(endedButExtendedTask, reviewPoolItem, 'review', now),
    true,
    'unclaimed review pool items should become claimable again after an ended task deadline is extended',
  );

  const returnedItem = {
    id: 'item_time_effective',
    taskId: endedTask.id,
    rawData: { text: 'test' },
    status: 'pending',
    annotator: null,
    reviewer: null,
    annotationData: null,
    submittedAt: null,
    reviewedAt: null,
    rejectReason: null,
    archived: false,
    auditHistory: [
      {
        actionType: 'claim_assignment',
        timestamp: twoDaysAgo,
      },
      {
        actionType: 'release_annotation_due_overdue',
        timestamp: oneDayAhead,
      },
    ],
  };

  assert.strictEqual(
    itemTimeliness.isItemExpired(
      { ...reopenedTask, annotationTimeoutHours: 72 },
      returnedItem,
      'annotation',
      now,
    ),
    false,
    'returned annotation items should become claimable again when the item timeout is extended enough',
  );
});

console.log('timeliness update effective tests passed');
