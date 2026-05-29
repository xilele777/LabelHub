/**
 * RBAC 权限中间件测试
 * 纯 HTTP 测试 —— 所有操作都通过 API 调用验证，不直接操作 DB
 * 测试自行创建所需数据，不依赖 seed 数据
 * 前置条件：服务器已启动
 */
const BASE = 'http://localhost:3001/api';

// ===== Helpers =====
async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return res.json();
  } catch (e) {
    return { code: -1, message: `Network error: ${e.message}` };
  }
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function login(username, password) {
  const data = await fetchJSON(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return data.data?.token;
}

// ===== Test runner =====
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

// Helper: success codes are 0, 200, 201
function isOk(code) { return code === 0 || (code >= 200 && code < 300); }
function isErr(code) { return code >= 400 || code === -1; }

async function runTests() {
  console.log('\n🔧 RBAC 权限测试 (纯 HTTP)\n');

  // 0. Check server is up
  const health = await fetchJSON(`${BASE}/health`);
  if (health.code !== 0 && health.code !== 200) {
    console.error('❌ 服务器未启动！请先运行: cd server && node index.js');
    process.exit(1);
  }
  console.log(`   服务器运行中\n`);

  // 1. Login as different roles
  console.log('--- 登录测试 ---');
  const ownerToken = await login('owner', 'owner123');
  assert(ownerToken, 'Owner 登录成功');

  const annotatorToken = await login('annotator', 'annotator123');
  assert(annotatorToken, 'Annotator 登录成功');

  const reviewerToken = await login('reviewer', 'reviewer123');
  assert(reviewerToken, 'Reviewer 登录成功');

  if (!ownerToken || !annotatorToken || !reviewerToken) {
    console.error('❌ 登录失败，无法继续测试');
    process.exit(1);
  }

  // =============================================
  // Prepare test data via Owner
  // =============================================
  console.log('\n--- 准备测试数据 ---');

  // Create a task
  const taskRes = await fetchJSON(`${BASE}/tasks`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ name: 'RBAC Test Task', type: 'text_ner', templateId: 'tpl007' }),
  });
  const taskId = taskRes.data?.id;
  assert(isOk(taskRes.code) && taskId, '创建测试任务');

  // Create annotation items in different states
  // 1) A pending item with no annotator (for save-draft / submit test)
  const item1Res = await fetchJSON(`${BASE}/annotation-items`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ taskId, rawData: { text: 'test1' }, status: 'pending' }),
  });
  const pendingItemId = item1Res.data?.id;
  assert(isOk(item1Res.code) && pendingItemId, '创建 pending 标注项');

  // 2) A pending_review item annotated by 'annotator' (for reviewer approve test)
  const item2Res = await fetchJSON(`${BASE}/annotation-items`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ taskId, rawData: { text: 'test2' }, status: 'pending_review', annotator: 'annotator' }),
  });
  const prItemId1 = item2Res.data?.id;
  assert(isOk(item2Res.code) && prItemId1, '创建 pending_review 标注项 (annotator=annotator)');

  // 3) A pending_review item annotated by 'reviewer' (for avoidance test)
  const item3Res = await fetchJSON(`${BASE}/annotation-items`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ taskId, rawData: { text: 'test3' }, status: 'pending_review', annotator: 'reviewer' }),
  });
  const prItemId2 = item3Res.data?.id;
  assert(isOk(item3Res.code) && prItemId2, '创建 pending_review 标注项 (annotator=reviewer, 用于回避测试)');

  // 4) A pending item for Owner full permission test
  const item4Res = await fetchJSON(`${BASE}/annotation-items`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ taskId, rawData: { text: 'test4' }, status: 'pending' }),
  });
  const ownerItemId = item4Res.data?.id;
  assert(isOk(item4Res.code) && ownerItemId, '创建 Owner 测试标注项');

  // 5) Another pending_review item for Owner approve test
  const item5Res = await fetchJSON(`${BASE}/annotation-items`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ taskId, rawData: { text: 'test5' }, status: 'pending_review', annotator: 'annotator' }),
  });
  const ownerApproveItemId = item5Res.data?.id;
  assert(isOk(item5Res.code) && ownerApproveItemId, '创建 Owner 审核测试标注项');

  // 6) A pending_review item for annotator reject test
  const item6Res = await fetchJSON(`${BASE}/annotation-items`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ taskId, rawData: { text: 'test6' }, status: 'pending_review', annotator: 'annotator' }),
  });
  const annotatorRejectItemId = item6Res.data?.id;
  assert(isOk(item6Res.code) && annotatorRejectItemId, '创建标注员驳回测试标注项');

  // =============================================
  // 2. Tasks RBAC
  // =============================================
  console.log('\n--- 任务 RBAC ---');

  // Owner can create task
  let res = await fetchJSON(`${BASE}/tasks`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ name: 'Owner Task', type: 'text_ner', templateId: 'tpl007' }),
  });
  assert(isOk(res.code), 'Owner 可以创建任务');

  // Annotator cannot create task
  res = await fetchJSON(`${BASE}/tasks`, {
    method: 'POST',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ name: 'Annotator Task', type: 'text_ner' }),
  });
  assert(isErr(res.code), 'Annotator 不能创建任务');

  // Reviewer cannot create task
  res = await fetchJSON(`${BASE}/tasks`, {
    method: 'POST',
    headers: authHeader(reviewerToken),
    body: JSON.stringify({ name: 'Reviewer Task', type: 'text_ner' }),
  });
  assert(isErr(res.code), 'Reviewer 不能创建任务');

  // All roles can read tasks
  res = await fetchJSON(`${BASE}/tasks`, { headers: authHeader(annotatorToken) });
  assert(isOk(res.code), 'Annotator 可以查看任务列表');

  res = await fetchJSON(`${BASE}/tasks`, { headers: authHeader(reviewerToken) });
  assert(isOk(res.code), 'Reviewer 可以查看任务列表');

  // =============================================
  // 3. Templates RBAC
  // =============================================
  console.log('\n--- 模板 RBAC ---');

  // Annotator cannot create template
  res = await fetchJSON(`${BASE}/templates`, {
    method: 'POST',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ name: 'Annotator Template', type: 'text_ner', fields: [] }),
  });
  assert(isErr(res.code), 'Annotator 不能创建模板');

  // Annotator can read templates
  res = await fetchJSON(`${BASE}/templates`, { headers: authHeader(annotatorToken) });
  assert(isOk(res.code), 'Annotator 可以查看模板列表');

  // Owner can create template
  res = await fetchJSON(`${BASE}/templates`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ name: 'Owner Template', type: 'text_ner', fields: [] }),
  });
  assert(isOk(res.code), 'Owner 可以创建模板');

  // =============================================
  // 4. Annotation Items RBAC — save-draft / submit (ownership)
  // =============================================
  console.log('\n--- 标注项 RBAC (保存草稿/提交) ---');

  // Annotator saves draft on unassigned pending item → auto-claims (pending→draft)
  res = await fetchJSON(`${BASE}/annotation-items/${pendingItemId}/save-draft`, {
    method: 'PUT',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ annotationData: { test: 'data' } }),
  });
  assert(isOk(res.code), 'Annotator 可以保存草稿（未分配的项自动认领）');

  // Annotator can submit own item (draft→submitted)
  res = await fetchJSON(`${BASE}/annotation-items/${pendingItemId}/submit`, {
    method: 'PUT',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ annotationData: { test: 'data' } }),
  });
  assert(isOk(res.code), 'Annotator 可以提交标注（自己名下的数据）');

  // =============================================
  // 5. Avoidance principle — reviewer cannot review own annotation
  // =============================================
  console.log('\n--- 回避原则测试 ---');

  // Reviewer (who IS the annotator) tries to approve → avoidance principle should block
  res = await fetchJSON(`${BASE}/annotation-items/${prItemId2}/approve`, {
    method: 'PUT',
    headers: authHeader(reviewerToken),
    body: JSON.stringify({}),
  });
  assert(isErr(res.code) && res.message.includes('回避'),
    '回避原则：审核员不能审核自己的标注 (code=' + res.code + ', msg=' + res.message + ')');

  // =============================================
  // 6. Annotator cannot approve/reject (role check)
  // =============================================
  console.log('\n--- 标注员不能审核 ---');

  // Annotator tries to approve a pending_review item
  res = await fetchJSON(`${BASE}/annotation-items/${prItemId1}/approve`, {
    method: 'PUT',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({}),
  });
  assert(isErr(res.code) && res.message.includes('标注员不能审核'),
    '标注员不能审核标注 (code=' + res.code + ', msg=' + res.message + ')');

  // Annotator tries to reject a pending_review item
  res = await fetchJSON(`${BASE}/annotation-items/${annotatorRejectItemId}/reject`, {
    method: 'PUT',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ reason: 'test' }),
  });
  assert(isErr(res.code) && res.message.includes('标注员不能审核'),
    '标注员不能驳回标注 (code=' + res.code + ', msg=' + res.message + ')');

  // =============================================
  // 7. Reviewer CAN approve others' annotation
  // =============================================
  console.log('\n--- 审核员可审核他人标注 ---');

  // pending_review item annotated by 'annotator' — reviewer should be able to approve
  res = await fetchJSON(`${BASE}/annotation-items/${prItemId1}/approve`, {
    method: 'PUT',
    headers: authHeader(reviewerToken),
    body: JSON.stringify({}),
  });
  assert(isOk(res.code), '审核员可以审核他人的标注 (code=' + res.code + ', msg=' + res.message + ')');

  // =============================================
  // 8. Owner cannot annotate or review (management only)
  // =============================================
  console.log('\n--- Owner 无标注/审核权限 ---');

  // Owner CANNOT save draft
  res = await fetchJSON(`${BASE}/annotation-items/${ownerItemId}/save-draft`, {
    method: 'PUT',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ annotationData: { test: 'owner' } }),
  });
  assert(isErr(res.code) && res.message.includes('标注员'),
    'Owner 不能保存草稿 (code=' + res.code + ', msg=' + res.message + ')');

  // Owner CANNOT submit annotation
  res = await fetchJSON(`${BASE}/annotation-items/${ownerItemId}/submit`, {
    method: 'PUT',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ annotationData: { test: 'owner' } }),
  });
  assert(isErr(res.code) && res.message.includes('标注员'),
    'Owner 不能提交标注 (code=' + res.code + ', msg=' + res.message + ')');

  // Owner CANNOT approve review
  res = await fetchJSON(`${BASE}/annotation-items/${ownerApproveItemId}/approve`, {
    method: 'PUT',
    headers: authHeader(ownerToken),
    body: JSON.stringify({}),
  });
  assert(isErr(res.code) && res.message.includes('负责人'),
    'Owner 不能审核通过 (code=' + res.code + ', msg=' + res.message + ')');

  // =============================================
  // 9. Reviews RBAC
  // =============================================
  console.log('\n--- 审核记录 RBAC ---');

  // Annotator cannot create review
  res = await fetchJSON(`${BASE}/reviews`, {
    method: 'POST',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ dataItemId: pendingItemId, taskId, score: 80 }),
  });
  assert(isErr(res.code), 'Annotator 不能创建审核记录');

  // All roles can read reviews
  res = await fetchJSON(`${BASE}/reviews`, { headers: authHeader(annotatorToken) });
  assert(isOk(res.code), 'Annotator 可以查看审核记录');

  // Owner can create review
  res = await fetchJSON(`${BASE}/reviews`, {
    method: 'POST',
    headers: authHeader(ownerToken),
    body: JSON.stringify({ dataItemId: pendingItemId, taskId, score: 90, reviewStatus: 'pass', summary: 'test' }),
  });
  assert(isOk(res.code), 'Owner 可以创建审核记录');

  // =============================================
  // 10. Users RBAC
  // =============================================
  console.log('\n--- 用户管理 RBAC ---');

  // Annotator cannot list users
  res = await fetchJSON(`${BASE}/users`, { headers: authHeader(annotatorToken) });
  assert(isErr(res.code), 'Annotator 不能查看用户列表');

  // Annotator cannot create users
  res = await fetchJSON(`${BASE}/users`, {
    method: 'POST',
    headers: authHeader(annotatorToken),
    body: JSON.stringify({ username: 'hack', password: 'hack1', role: 'owner' }),
  });
  assert(isErr(res.code), 'Annotator 不能创建用户');

  // Owner can list users
  res = await fetchJSON(`${BASE}/users`, { headers: authHeader(ownerToken) });
  assert(isOk(res.code), 'Owner 可以查看用户列表');

  // ===== Summary =====
  console.log(`\n${'='.repeat(40)}`);
  console.log(`测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log(`${'='.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('测试执行出错:', err);
  process.exit(1);
});
