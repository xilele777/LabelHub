/**
 * Notification reliability tests.
 *
 * Verifies that public notification fan-out helpers persist per-recipient
 * records even when no Socket.IO server is running.
 *
 * Run: node test/run-isolated.js test/test-notification-reliability.js
 */
const db = require('../store/db');
const { hashPassword } = require('../utils/password');
const notificationService = require('../services/notificationService');

let passed = 0;
let failed = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`  PASS ${testName}`);
    passed++;
  } else {
    console.log(`  FAIL ${testName}${details ? ` - ${details}` : ''}`);
    failed++;
  }
}

function ownerMessage(id, title) {
  return notificationService.createNotification({
    type: notificationService.NOTIFICATION_TYPE.OWNER_MESSAGE,
    title,
    message: title,
    data: { testId: id },
    sender: 'owner',
  });
}

function getUserNotifications(username) {
  return db.getNotificationsForUser(username, { limit: 20 });
}

function hasNotification(username, testId) {
  return getUserNotifications(username).some((item) => item.data?.testId === testId);
}

function runTests() {
  console.log('\n===== Notification reliability tests =====\n');

  db.seed('users', [
    { id: 'u_owner', username: 'owner', password: hashPassword('owner123'), avatar: null, role: 'owner' },
    { id: 'u_annotator', username: 'annotator', password: hashPassword('annotator123'), avatar: null, role: 'annotator' },
    { id: 'u_reviewer', username: 'reviewer', password: hashPassword('reviewer123'), avatar: null, role: 'reviewer' },
  ]);

  db.seed('tasks', [
    {
      id: 'task_reliability',
      name: 'Reliability task',
      description: '',
      type: 'text',
      owner: 'owner',
      templateId: null,
      templateName: null,
      instructions: '',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    },
  ]);

  db.seed('annotation-items', [
    {
      id: 'item_reliability',
      taskId: 'task_reliability',
      rawData: {},
      status: 'pending_review',
      annotationData: {},
      annotator: 'annotator',
      submittedAt: null,
      reviewer: 'reviewer',
      reviewedAt: null,
      rejectReason: null,
      auditHistory: [],
      createdAt: new Date().toISOString(),
    },
  ]);

  const roleDelivered = notificationService.notifyRole('annotator', ownerMessage('role_fanout', 'Role fan-out'));
  assert(roleDelivered.length === 1, 'notifyRole returns persisted recipient rows');
  assert(hasNotification('annotator', 'role_fanout'), 'notifyRole persists for role recipient');
  assert(!hasNotification('reviewer', 'role_fanout'), 'notifyRole does not persist outside the role');

  const taskDelivered = notificationService.notifyTask(
    'task_reliability',
    ownerMessage('task_fanout', 'Task fan-out'),
  );
  assert(taskDelivered.length === 3, 'notifyTask returns persisted task audience rows');
  assert(hasNotification('owner', 'task_fanout'), 'notifyTask persists for task owner');
  assert(hasNotification('annotator', 'task_fanout'), 'notifyTask persists for assigned annotator');
  assert(hasNotification('reviewer', 'task_fanout'), 'notifyTask persists for assigned reviewer');

  const broadcastDelivered = notificationService.broadcastNotification(ownerMessage('broadcast_fanout', 'Broadcast'));
  assert(broadcastDelivered.length === 3, 'broadcastNotification returns persisted user rows');
  assert(hasNotification('owner', 'broadcast_fanout'), 'broadcastNotification persists for owner');
  assert(hasNotification('annotator', 'broadcast_fanout'), 'broadcastNotification persists for annotator');
  assert(hasNotification('reviewer', 'broadcast_fanout'), 'broadcastNotification persists for reviewer');

  console.log('\n========================================');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
