/**
 * 端到端测试：验证 WebSocket 通知是否能正确送达
 * 
 * 流程：
 * 1. 登录获取 token
 * 2. 用 Socket.IO 连接后端
 * 3. 触发一个业务操作（提交标注）
 * 4. 验证是否收到通知
 */
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

// ─── Step 1: 登录获取 token ──────────────────────────────────
async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(`登录失败: ${json.message}`);
  }
  return json.data;
}

// ─── Step 2: 获取标注项 ──────────────────────────────────
async function getAnnotationItems(token) {
  const res = await fetch(`${API_URL}/annotation-items`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data?.items || [];
}

// ─── Step 3: 触发提交 ──────────────────────────────────
async function submitAnnotation(token, itemId, version) {
  const res = await fetch(`${API_URL}/annotation-items/${itemId}/submit`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      annotationData: { test: 'e2e notification test' },
      version,
    }),
  });
  const json = await res.json();
  return json;
}

async function main() {
  console.log('=== 通知端到端测试 ===\n');

  // 1. 先查看有哪些用户
  console.log('[Step 0] 查看可用用户...');
  const db = require('./store/db');
  const users = db.getAll('users');
  console.log('可用用户:', users.map(u => `${u.username} (${u.role})`).join(', '));

  // 2. 分别以标注员和审核员登录
  const annotator = users.find(u => u.role === 'annotator');
  const reviewer = users.find(u => u.role === 'reviewer');

  if (!annotator) {
    console.error('没有找到标注员用户，无法测试');
    process.exit(1);
  }

  console.log(`\n[Step 1] 登录标注员: ${annotator.username}`);
  const annotatorAuth = await login(annotator.username, `${annotator.username}123`);
  console.log(`  token: ${annotatorAuth.token.slice(0, 20)}...`);
  console.log(`  userId: ${annotatorAuth.user.id}`);

  // 3. 用审核员也连接 WebSocket（等待接收通知）
  let reviewerAuth = null;
  if (reviewer) {
    console.log(`\n[Step 1b] 登录审核员: ${reviewer.username}`);
    reviewerAuth = await login(reviewer.username, `${reviewer.username}123`);
    console.log(`  token: ${reviewerAuth.token.slice(0, 20)}...`);
  }

  // 4. 用审核员连接 WebSocket，等待接收 "标注已提交" 通知
  let reviewerReceivedNotification = false;
  let reviewerSocket = null;

  if (reviewerAuth) {
    console.log('\n[Step 2] 审核员连接 WebSocket...');
    reviewerSocket = io(BASE_URL, {
      path: '/socket.io/',
      auth: { token: reviewerAuth.token },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('审核员 WebSocket 连接超时'));
      }, 5000);

      reviewerSocket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`  审核员已连接: ${reviewerSocket.id}`);
        resolve();
      });

      reviewerSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        console.error(`  审核员连接失败: ${err.message}`);
        reject(err);
      });
    });

    reviewerSocket.on('notification', (notif) => {
      console.log('\n  🔔 审核员收到通知:', notif.type, notif.title);
      console.log('     message:', notif.message);
      console.log('     targetUsers:', notif.targetUsers);
      reviewerReceivedNotification = true;
    });
  }

  // 5. 标注员也连接 WebSocket
  console.log('\n[Step 3] 标注员连接 WebSocket...');
  const annotatorSocket = io(BASE_URL, {
    path: '/socket.io/',
    auth: { token: annotatorAuth.token },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('标注员 WebSocket 连接超时'));
    }, 5000);

    annotatorSocket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`  标注员已连接: ${annotatorSocket.id}`);
      resolve();
    });

    annotatorSocket.on('connect_error', (err) => {
      clearTimeout(timeout);
      console.error(`  标注员连接失败: ${err.message}`);
      reject(err);
    });
  });

  let annotatorReceivedNotification = false;
  annotatorSocket.on('notification', (notif) => {
    console.log('\n  🔔 标注员收到通知:', notif.type, notif.title);
    console.log('     message:', notif.message);
    annotatorReceivedNotification = true;
  });

  // 等待一秒让连接稳定
  await new Promise(r => setTimeout(r, 1000));

  // 6. 获取标注员可操作的标注项
  console.log('\n[Step 4] 获取标注项列表...');
  const items = await getAnnotationItems(annotatorAuth.token);
  console.log(`  找到 ${items.length} 个标注项`);

  // 找一个可以提交的项（draft 或 pending 状态）
  const submittableItem = items.find(item => 
    item.annotator === annotator.username && 
    (item.status === 'draft' || item.status === 'pending' || item.status === 'rejected')
  );

  if (!submittableItem) {
    console.log('  没有可提交的标注项，尝试创建一个测试场景...');
    // 找任何属于该标注员的项
    const myItem = items.find(item => item.annotator === annotator.username);
    if (myItem) {
      console.log(`  找到标注项 ${myItem.id}，当前状态: ${myItem.status}`);
      console.log('  该状态无法提交，跳过提交测试');
    } else {
      console.log('  该标注员没有分配任何标注项');
    }
    
    // 尝试用 approve/reject 触发通知
    console.log('\n[备用测试] 直接用 Socket.IO 发送测试通知...');
    
    // 检查服务端通知服务是否正常运行
    const ns = require('./services/notificationService');
    const ioInstance = ns.getIO();
    if (ioInstance) {
      console.log('  Socket.IO 实例存在，检查连接的 socket 数量...');
      const sockets = await ioInstance.fetchSockets();
      console.log(`  当前连接的 socket 数量: ${sockets.length}`);
      for (const s of sockets) {
        console.log(`    - ${s.id}: user=${s.data?.user?.username || 'anonymous'}`);
      }

      // 直接发送测试通知
      console.log('\n  发送测试通知给审核员...');
      ns.notifyUserByUsername(reviewer?.username || annotator.username, ns.createNotification({
        type: 'task_status_changed',
        title: '测试通知',
        message: '这是一条端到端测试通知',
        data: {},
        sender: 'test-script',
        targetUsers: [reviewer?.username || annotator.username],
      }));

      // 等待通知到达
      await new Promise(r => setTimeout(r, 2000));

      if (reviewerReceivedNotification || annotatorReceivedNotification) {
        console.log('\n✅ 测试通知送达成功！');
      } else {
        console.log('\n❌ 测试通知未送达！');
        console.log('  可能原因：');
        console.log('  1. 用户没有加入正确的房间');
        console.log('  2. Socket.IO 认证失败');
        console.log('  3. CORS 问题');
      }
    } else {
      console.log('  ❌ Socket.IO 实例不存在！');
    }

  } else {
    // 7. 提交标注
    console.log(`\n[Step 5] 提交标注项 ${submittableItem.id} (状态: ${submittableItem.status})...`);
    const result = await submitAnnotation(annotatorAuth.token, submittableItem.id, submittableItem.version);
    console.log(`  提交结果: code=${result.code}, message=${result.message}`);

    // 等待通知到达
    await new Promise(r => setTimeout(r, 3000));

    if (reviewerReceivedNotification) {
      console.log('\n✅ 审核员成功收到通知！');
    } else {
      console.log('\n❌ 审核员未收到通知！');
    }

    if (annotatorReceivedNotification) {
      console.log('✅ 标注员也收到了通知');
    }
  }

  // 清理
  console.log('\n[清理] 断开 WebSocket 连接...');
  annotatorSocket.disconnect();
  if (reviewerSocket) reviewerSocket.disconnect();

  console.log('\n=== 测试结束 ===');
  process.exit(0);
}

main().catch(err => {
  console.error('测试出错:', err);
  process.exit(1);
});
