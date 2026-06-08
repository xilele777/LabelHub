/**
 * Notification permission isolation tests.
 *
 * Verifies:
 * 1. Rejected review notifications are delivered only to the target annotator.
 * 2. Fresh annotation submissions are not delivered to reviewers.
 * 3. Re-submitted rejected items are delivered only to the original reviewer.
 * 4. Clients cannot subscribe to unrelated task rooms.
 *
 * Run: node server/test/test-notification-permissions.js
 */
const http = require('http');
const { io: createClient } = require('socket.io-client');
const db = require('../store/db');
const { hashPassword } = require('../utils/password');
const { encodeToken } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

let passed = 0;
let failed = 0;
const bugs = [];

function assert(condition, testName, details) {
  if (condition) {
    console.log(`  PASS ${testName}`);
    passed++;
  } else {
    console.log(`  FAIL ${testName}${details ? ` - ${details}` : ''}`);
    bugs.push({ test: testName, details: details || '' });
    failed++;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectSocket(port, userId) {
  return new Promise((resolve, reject) => {
    const socket = createClient(`http://localhost:${port}`, {
      path: '/socket.io/',
      auth: { token: encodeToken(userId) },
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
    });

    const notifications = [];
    socket.on('notification', (notification) => {
      notifications.push(notification);
    });

    socket.on('connect', () => resolve({ socket, notifications }));
    socket.on('connect_error', reject);
  });
}

async function runTests() {
  console.log('\n===== Notification permission isolation tests =====\n');

  db.seed('users', [
    { id: 'u001', username: 'owner', password: hashPassword('owner123'), avatar: null, role: 'owner' },
    { id: 'u002', username: 'annotator', password: hashPassword('annotator123'), avatar: null, role: 'annotator' },
    { id: 'u003', username: 'reviewer', password: hashPassword('reviewer123'), avatar: null, role: 'reviewer' },
  ]);

  const server = http.createServer();
  notificationService.initNotificationService(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const annotator = await connectSocket(port, 'u002');
  const reviewer = await connectSocket(port, 'u003');
  const owner = await connectSocket(port, 'u001');

  await wait(100);

  console.log('1. Review rejection is delivered only to the assigned annotator');
  notificationService.notifyReviewRejected(
    {
      id: 'notif_perm_reject_item',
      taskId: 't001',
      annotator: 'annotator',
      rejectReason: 'permission isolation test',
      reviewedAt: new Date().toISOString(),
    },
    { username: 'reviewer' },
  );

  await wait(150);

  assert(
    annotator.notifications.some((n) => n.type === 'review_rejected' && n.data?.dataItemId === 'notif_perm_reject_item'),
    'annotator receives own review_rejected notification',
  );
  assert(
    !reviewer.notifications.some((n) => n.type === 'review_rejected' && n.data?.dataItemId === 'notif_perm_reject_item'),
    'reviewer does not receive annotator rejection notification',
  );
  assert(
    !owner.notifications.some((n) => n.type === 'review_rejected' && n.data?.dataItemId === 'notif_perm_reject_item'),
    'owner does not receive personal rejection notification via task rooms',
  );
  assert(
    annotator.notifications
      .find((n) => n.type === 'review_rejected' && n.data?.dataItemId === 'notif_perm_reject_item')
      ?.targetUsers?.includes('annotator'),
    'review_rejected notification carries targetUsers=annotator',
  );

  console.log('\n2. Fresh annotation submission is not delivered to reviewers');
  notificationService.notifyAnnotationSubmitted(
    {
      id: 'notif_perm_submit_item',
      taskId: 't001',
      annotator: 'annotator',
      reviewer: 'reviewer',
      submittedAt: new Date().toISOString(),
    },
    { username: 'annotator' },
  );

  await wait(150);

  assert(
    !reviewer.notifications.some((n) => n.type === 'task_submitted' && n.data?.dataItemId === 'notif_perm_submit_item'),
    'reviewer does not receive task_submitted notification',
  );
  assert(
    !annotator.notifications.some((n) => n.type === 'task_submitted' && n.data?.dataItemId === 'notif_perm_submit_item'),
    'annotator does not receive reviewer-facing task_submitted notification',
  );
  assert(
    !owner.notifications.some((n) => n.type === 'task_submitted' && n.data?.dataItemId === 'notif_perm_submit_item'),
    'owner does not receive reviewer-facing task_submitted notification',
  );

  console.log('\n3. Re-submitted rejected item is delivered only to the original reviewer');
  notificationService.notifyAnnotationResubmitted(
    {
      id: 'notif_perm_resubmit_item',
      taskId: 't001',
      annotator: 'annotator',
      reviewer: 'reviewer',
      submittedAt: new Date().toISOString(),
    },
    { username: 'annotator' },
  );

  await wait(150);

  assert(
    reviewer.notifications.some((n) => n.type === 'task_resubmitted' && n.data?.dataItemId === 'notif_perm_resubmit_item'),
    'reviewer receives task_resubmitted notification for item they rejected',
  );
  assert(
    !annotator.notifications.some((n) => n.type === 'task_resubmitted' && n.data?.dataItemId === 'notif_perm_resubmit_item'),
    'annotator does not receive reviewer-facing task_resubmitted notification',
  );
  assert(
    !owner.notifications.some((n) => n.type === 'task_resubmitted' && n.data?.dataItemId === 'notif_perm_resubmit_item'),
    'owner does not receive personal task_resubmitted notification via task rooms',
  );
  assert(
    reviewer.notifications
      .find((n) => n.type === 'task_resubmitted' && n.data?.dataItemId === 'notif_perm_resubmit_item')
      ?.targetUsers?.includes('reviewer'),
    'task_resubmitted notification carries targetUsers=reviewer',
  );

  console.log('\n4. Joining unrelated task rooms is denied');
  const deniedAck = new Promise((resolve) => {
    annotator.socket.once('join:task_denied', resolve);
  });
  annotator.socket.emit('join:task', 't003');
  const denied = await Promise.race([deniedAck, wait(500).then(() => null)]);

  assert(
    denied?.taskId === 't003',
    'annotator cannot subscribe to an unassigned task room',
    denied ? '' : 'join:task_denied was not received',
  );

  annotator.socket.close();
  reviewer.socket.close();
  owner.socket.close();

  await new Promise((resolve) => notificationService.getIO().close(resolve));
  await new Promise((resolve) => server.close(resolve));

  console.log('\n========================================');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (bugs.length > 0) {
    console.log('\nBugs found:');
    bugs.forEach((b, i) => console.log(`  ${i + 1}. ${b.test}${b.details ? ` - ${b.details}` : ''}`));
  } else {
    console.log('\nNotification permission isolation passed.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
