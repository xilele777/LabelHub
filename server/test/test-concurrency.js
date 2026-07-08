/**
 * Tests optimistic versioning and pessimistic item locks.
 */
const assert = require('assert');
const db = require('../store/db');

function withTempData(fn) {
  const originalTasks = db.getAll('tasks');
  const originalItems = db.getAll('annotation-items');

  try {
    db.seed('annotation-items', []);
    db.seed('tasks', [
      {
        id: 'concurrency_task',
        name: 'Concurrency task',
        description: 'test',
        type: 'image_classification',
        owner: 'o',
        templateId: null,
        templateName: null,
        instructions: '',
        status: 'in_progress',
        archived: false,
      },
    ]);
    db.seed('annotation-items', [
      {
        id: 'concurrency_item_1',
        taskId: 'concurrency_task',
        rawData: { text: 'one' },
        status: 'pending',
        annotationData: null,
        annotator: null,
        submittedAt: null,
        reviewer: null,
        reviewedAt: null,
        rejectReason: null,
        auditHistory: [],
        version: 1,
        lockedBy: null,
        lockedAt: null,
        archived: false,
        archivedAt: null,
      },
      {
        id: 'concurrency_item_2',
        taskId: 'concurrency_task',
        rawData: { text: 'two' },
        status: 'pending',
        annotationData: null,
        annotator: null,
        submittedAt: null,
        reviewer: null,
        reviewedAt: null,
        rejectReason: null,
        auditHistory: [],
        version: 1,
        lockedBy: null,
        lockedAt: null,
        archived: false,
        archivedAt: null,
      },
    ]);

    fn();
  } finally {
    db.seed('annotation-items', []);
    db.seed('tasks', originalTasks);
    db.seed('annotation-items', originalItems);
  }
}

withTempData(() => {
  const item = db.getById('annotation-items', 'concurrency_item_1');
  assert.strictEqual(item.version, 1, 'seeded item should start at version 1');
  assert.strictEqual(item.lockedBy, null, 'seeded item should start unlocked');

  const updated = db.updateById('annotation-items', 'concurrency_item_1', { status: 'draft' });
  assert.strictEqual(updated.version, 2, 'content update should increment version');

  const conflict = db.updateWithVersionCheck('concurrency_item_1', { status: 'pending' }, 1);
  assert.strictEqual(conflict.conflict, true, 'stale version should conflict');
  assert.strictEqual(conflict.currentVersion, 2, 'conflict should report current version');

  const ok = db.updateWithVersionCheck('concurrency_item_1', { status: 'pending' }, 2);
  assert.strictEqual(ok.conflict, false, 'matching version should update');
  assert.strictEqual(ok.updatedItem.version, 3, 'version-checked update should increment version');

  const claim = db.claimItem('concurrency_item_1', 'annotator1', 30 * 60 * 1000);
  assert.strictEqual(claim.claimed, true, 'first claim should succeed');
  assert.strictEqual(claim.item.lockedBy, 'annotator1', 'claim should record lock owner');
  assert.strictEqual(claim.item.version, 3, 'claim should not increment content version');

  const blockedClaim = db.claimItem('concurrency_item_1', 'annotator2', 30 * 60 * 1000);
  assert.strictEqual(blockedClaim.claimed, false, 'second claim by another user should be blocked');
  assert.strictEqual(blockedClaim.lockedBy, 'annotator1', 'blocked claim should report owner');

  const release = db.releaseItem('concurrency_item_1', 'annotator1');
  assert.strictEqual(release.released, true, 'lock owner should release lock');
  assert.strictEqual(release.item.lockedBy, null, 'release should clear lock owner');

  db.claimItem('concurrency_item_1', 'annotator1', 30 * 60 * 1000);
  db.claimItem('concurrency_item_2', 'annotator1', 30 * 60 * 1000);
  assert.strictEqual(
    db.releaseAllByUser('annotator1'),
    2,
    'releaseAllByUser should clear all user locks',
  );
  assert.strictEqual(db.getById('annotation-items', 'concurrency_item_1').lockedBy, null);
  assert.strictEqual(db.getById('annotation-items', 'concurrency_item_2').lockedBy, null);

  db.claimItem('concurrency_item_1', 'annotator1', 1);
  const expiredLock = db.updateById('annotation-items', 'concurrency_item_1', {
    lockedAt: new Date(Date.now() - 1000).toISOString(),
    _skipVersionIncrement: true,
  });
  assert.strictEqual(expiredLock.lockedBy, 'annotator1');
  assert.strictEqual(db.cleanExpiredLocks(1), 1, 'expired lock cleanup should clear stale lock');
  assert.strictEqual(db.getById('annotation-items', 'concurrency_item_1').lockedBy, null);
});

console.log('concurrency control tests passed');
