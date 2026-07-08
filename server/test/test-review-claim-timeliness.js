const assert = require('assert');
const { getItemStartTimestamp, isItemExpired } = require('../utils/itemTimeliness');

const now = Date.now();
const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

const task = {
  status: 'in_progress',
  reviewTimeoutHours: 24,
};

const unclaimedPoolItem = {
  status: 'pending_review',
  reviewer: null,
  auditHistory: [
    {
      actionType: 'assign_reviewer',
      timestamp: twoDaysAgo,
    },
  ],
};

assert.strictEqual(
  isItemExpired(task, unclaimedPoolItem, 'review', now),
  false,
  'unclaimed review-pool items must not expire before a reviewer claims them',
);

const assignedItem = {
  ...unclaimedPoolItem,
  reviewer: 'r',
  auditHistory: [
    ...unclaimedPoolItem.auditHistory,
    {
      actionType: 'assign_reviewer',
      timestamp: twoDaysAgo,
    },
  ],
};

assert.strictEqual(
  isItemExpired(task, assignedItem, 'review', now),
  true,
  'assigned review items should still expire from the assignment timestamp',
);

const claimedItem = {
  ...unclaimedPoolItem,
  reviewer: 'r',
  auditHistory: [
    ...unclaimedPoolItem.auditHistory,
    {
      actionType: 'claim_review',
      timestamp: oneHourAgo,
    },
  ],
};

assert.strictEqual(
  getItemStartTimestamp(claimedItem, 'review'),
  new Date(oneHourAgo).getTime(),
  'claim_review should be used as the review timeout start when present',
);
assert.strictEqual(
  isItemExpired(task, claimedItem, 'review', now),
  false,
  'freshly claimed review items should remain reviewable',
);

const rejectedItem = {
  status: 'rejected',
  annotator: 'a',
  auditHistory: [
    {
      actionType: 'claim_assignment',
      timestamp: twoDaysAgo,
    },
    {
      actionType: 'reject',
      timestamp: oneHourAgo,
    },
  ],
};

assert.strictEqual(
  getItemStartTimestamp(rejectedItem, 'annotation'),
  new Date(oneHourAgo).getTime(),
  'reject should restart the annotation timeout for rework',
);
assert.strictEqual(
  isItemExpired(task, rejectedItem, 'annotation', now),
  false,
  'freshly rejected items should stay visible to the original annotator for rework',
);

console.log('review claim timeliness tests passed');
