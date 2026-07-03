/**
 * 全流程集成测试
 * 测试所有核心业务流程，检查功能正确性和潜在 bug
 */
const http = require('http');

const baseUrl = new URL(process.env.BASE_URL || 'http://localhost:3001');
const BASE = {
  hostname: baseUrl.hostname,
  port: baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80),
};
let ownerToken = '';
let annotatorToken = '';
let reviewerToken = '';

// 辅助函数：发送 HTTP 请求
function request(method, path, body, auth) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;
    const data = body ? JSON.stringify(body) : '';
    if (data) headers['Content-Length'] = Buffer.byteLength(data, 'utf-8');
    const req = http.request({ ...BASE, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const GET = (path, auth) => request('GET', path, null, auth);
const POST = (path, body, auth) => request('POST', path, body, auth);
const PUT = (path, body, auth) => request('PUT', path, body, auth);
const DELETE = (path, auth) => request('DELETE', path, null, auth);

let bugs = [];
let passed = 0;
let failed = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}${details ? ' — ' + details : ''}`);
    bugs.push({ test: testName, details: details || '' });
    failed++;
  }
}

function logExtra(msg) {
  console.log(`    ℹ️  ${msg}`);
}

async function runTests() {
  console.log('\n🧪 ===== 全流程集成测试 =====\n');

  // ─── 1. 登录/认证流程 ─────────────────────────
  console.log('📌 1. 登录/认证流程');

  const ownerLogin = await POST('/api/auth/login', { username: 'owner', password: 'owner123' });
  assert(ownerLogin.status === 200 && ownerLogin.data.code === 200, 'Owner 登录成功');
  ownerToken = ownerLogin.data.data?.token;
  assert(!!ownerToken, 'Owner 获取 token');

  const annotatorLogin = await POST('/api/auth/login', {
    username: 'annotator',
    password: 'annotator123',
  });
  assert(annotatorLogin.status === 200 && annotatorLogin.data.code === 200, 'Annotator 登录成功');
  annotatorToken = annotatorLogin.data.data?.token;
  assert(!!annotatorToken, 'Annotator 获取 token');

  const reviewerLogin = await POST('/api/auth/login', {
    username: 'reviewer',
    password: 'reviewer123',
  });
  assert(reviewerLogin.status === 200 && reviewerLogin.data.code === 200, 'Reviewer 登录成功');
  reviewerToken = reviewerLogin.data.data?.token;
  assert(!!reviewerToken, 'Reviewer 获取 token');

  const badLogin = await POST('/api/auth/login', { username: 'owner', password: 'wrong' });
  assert(badLogin.status === 401 || badLogin.data.code === 401, '错误密码登录失败');

  const meRes = await GET('/api/auth/me', ownerToken);
  assert(
    meRes.status === 200 && meRes.data.data?.username === 'owner',
    '/api/auth/me 返回当前用户',
  );

  // ─── 2. 模板管理流程 ─────────────────────────
  console.log('\n📌 2. 模板管理流程');

  const tplList = await GET('/api/templates', ownerToken);
  assert(tplList.status === 200, '获取模板列表');
  // crudFactory list returns { items, total, page, limit }
  const tplItems = tplList.data.data?.items || tplList.data.data;
  assert(
    Array.isArray(tplItems) && tplItems.length > 0,
    '模板列表不为空',
    `data: ${JSON.stringify(tplList.data.data)?.slice(0, 200)}`,
  );

  const tplDetail = await GET('/api/templates/tpl001', ownerToken);
  assert(tplDetail.status === 200, '获取模板详情');
  assert(tplDetail.data.data?.fields?.length > 0, '模板包含 fields 字段');

  // 创建新模板
  const newTpl = await POST(
    '/api/templates',
    {
      id: 'tpl_test',
      name: 'Test Template',
      description: 'Integration test',
      type: 'image_classification',
      fieldCount: 1,
      creator: 'owner',
      fields: [
        { id: 'f1', type: 'input', fieldKey: 'test', label: 'Test Field', placeholder: 'Input' },
      ],
    },
    ownerToken,
  );
  assert(
    newTpl.status === 201 || newTpl.status === 200,
    '创建新模板',
    `status: ${newTpl.status}, data: ${JSON.stringify(newTpl.data)?.slice(0, 200)}`,
  );

  // 更新模板
  const tplId = newTpl.data.data?.id || 'tpl_test';
  const updTpl = await PUT(
    `/api/templates/${tplId}`,
    { name: 'Test Template Updated' },
    ownerToken,
  );
  assert(updTpl.status === 200, '更新模板');

  // 删除测试模板
  const delTpl = await DELETE(`/api/templates/${tplId}`, ownerToken);
  assert(delTpl.status === 200, '删除模板');

  // ─── 3. 任务管理流程 ─────────────────────────
  console.log('\n📌 3. 任务管理流程');

  const taskList = await GET('/api/tasks', ownerToken);
  assert(taskList.status === 200, '获取任务列表');
  const taskItems = taskList.data.data?.items || taskList.data.data;
  assert(
    Array.isArray(taskItems) && taskItems.length > 0,
    '任务列表不为空',
    `data type: ${typeof taskList.data.data}`,
  );

  const taskDetail = await GET('/api/tasks/t001', ownerToken);
  assert(taskDetail.status === 200, '获取任务详情');
  assert(taskDetail.data.data?.name === '猫狗图像分类-批次A', '任务详情数据正确');

  // 创建新任务
  const newTask = await POST(
    '/api/tasks',
    {
      id: 't_test',
      name: 'Test Task',
      description: 'Integration test task',
      type: 'image_classification',
      owner: 'owner',
      templateId: 'tpl001',
      templateName: 'Image Classification v1',
      instructions: 'Test instructions',
      status: 'draft',
    },
    ownerToken,
  );
  assert(
    newTask.status === 201 || newTask.status === 200,
    '创建新任务',
    `status: ${newTask.status}, data: ${JSON.stringify(newTask.data)?.slice(0, 200)}`,
  );

  // 更新任务状态
  const taskId = newTask.data.data?.id || 't_test';
  const updTask = await PUT(`/api/tasks/${taskId}`, { status: 'pending' }, ownerToken);
  assert(updTask.status === 200, '更新任务状态');

  // ─── 4. 任务分配流程 ─────────────────────────
  console.log('\n📌 4. 任务分配流程');

  const annotators = await GET('/api/annotators', ownerToken);
  assert(annotators.status === 200, '获取标注员列表');
  const annotatorsData = Array.isArray(annotators.data.data) ? annotators.data.data : [];
  assert(
    annotatorsData.length > 0,
    '标注员列表不为空',
    `data: ${JSON.stringify(annotators.data.data)?.slice(0, 200)}`,
  );

  // 分配任务 (even_split) - 测试任务可能没有数据项，使用 t001
  const assignRes = await POST(
    '/api/tasks/t001/assign',
    {
      strategy: 'even_split',
      annotators: ['annotator'],
    },
    ownerToken,
  );
  assert(
    assignRes.status === 200,
    '任务分配请求 (even_split)',
    `status: ${assignRes.status}, data: ${JSON.stringify(assignRes.data)?.slice(0, 200)}`,
  );

  // 获取分配统计
  const assignStats = await GET('/api/tasks/t001/assign/stats', ownerToken);
  assert(assignStats.status === 200, '获取任务分配统计', `status: ${assignStats.status}`);

  // 获取分配的数据项
  const assignItems = await GET('/api/tasks/t001/assign/items', ownerToken);
  assert(assignItems.status === 200, '获取任务数据项');

  // 清除分配
  const clearAssign = await POST('/api/tasks/t001/assign/clear', {}, ownerToken);
  assert(clearAssign.status === 200, '清除任务分配');

  // ─── 5. 标注工作台流程 ─────────────────────────
  console.log('\n📌 5. 标注工作台流程');

  // 先给 t001 分配标注员
  const assignT001 = await POST(
    '/api/tasks/t001/assign',
    {
      strategy: 'even_split',
      annotators: ['annotator'],
    },
    ownerToken,
  );
  logExtra(`t001 分配结果: ${assignT001.data.message || assignT001.data.code}`);

  // 获取标注项列表 (annotator)
  const annoItems = await GET('/api/annotation-items?taskId=t001', annotatorToken);
  assert(annoItems.status === 200, '标注员获取标注项列表');
  const annoList = annoItems.data.data?.items || annoItems.data.data;
  assert(
    Array.isArray(annoList),
    '标注项列表为数组',
    `type: ${typeof annoList}, keys: ${Object.keys(annoItems.data.data || {}).join(',')}`,
  );

  // 找一个 pending 的项来标注
  const pendingItem = Array.isArray(annoList) ? annoList.find((i) => i.status === 'pending') : null;
  if (pendingItem) {
    logExtra(`找到 pending 项: ${pendingItem.id}`);

    // 保存草稿 (PUT)
    const saveDraft = await PUT(
      `/api/annotation-items/${pendingItem.id}/save-draft`,
      {
        annotationData: {
          category: 'cat',
          tags: ['indoor'],
          quality: 'hd',
          difficulty: 3,
          isClear: true,
          note: 'test draft',
        },
        version: pendingItem.version,
      },
      annotatorToken,
    );
    assert(
      saveDraft.status === 200,
      '保存草稿',
      `status: ${saveDraft.status}, msg: ${saveDraft.data.message}`,
    );

    // 验证草稿状态
    const draftItem = await GET(`/api/annotation-items/${pendingItem.id}`, annotatorToken);
    assert(
      draftItem.data.data?.status === 'draft',
      '草稿状态为 draft',
      `实际状态: ${draftItem.data.data?.status}`,
    );

    // 提交标注 (PUT)
    const submitItem = await PUT(
      `/api/annotation-items/${pendingItem.id}/submit`,
      {
        annotationData: {
          category: 'cat',
          tags: ['indoor'],
          quality: 'hd',
          difficulty: 3,
          isClear: true,
          note: 'test submit',
        },
        version: draftItem.data.data?.version,
      },
      annotatorToken,
    );
    assert(
      submitItem.status === 200,
      '提交标注',
      `status: ${submitItem.status}, msg: ${submitItem.data.message}`,
    );

    // 验证提交后状态
    const submittedItem = await GET(`/api/annotation-items/${pendingItem.id}`, annotatorToken);
    logExtra(`提交后状态: ${submittedItem.data.data?.status}`);
  } else {
    console.log('  ⚠️ 没有找到 pending 状态的标注项，跳过标注测试');
  }

  // ─── 6. AI 预审流程 ─────────────────────────
  console.log('\n📌 6. AI 预审流程');

  // 找已提交的标注项
  const annoItems2 = await GET('/api/annotation-items?taskId=t001', ownerToken);
  const annoList2 = annoItems2.data.data?.items || annoItems2.data.data;
  const submittedItems = Array.isArray(annoList2)
    ? annoList2.filter((i) => i.status === 'submitted')
    : [];

  if (submittedItems.length > 0) {
    const aiItem = submittedItems[0];
    logExtra(`AI预审项: ${aiItem.id}, 状态: ${aiItem.status}`);

    // AI预审 (POST)
    const aiReview = await POST(`/api/annotation-items/${aiItem.id}/ai-review`, {}, ownerToken);
    assert(
      aiReview.status === 200,
      'AI 预审请求成功',
      `status: ${aiReview.status}, msg: ${aiReview.data.message}`,
    );
    if (aiReview.status === 200) {
      logExtra(
        `AI预审结果: reviewStatus=${aiReview.data.data?.review?.reviewStatus}, score=${aiReview.data.data?.review?.score}`,
      );
    }

    // 验证 AI 预审后状态
    const afterAi = await GET(`/api/annotation-items/${aiItem.id}`, ownerToken);
    logExtra(`AI预审后状态: ${afterAi.data.data?.status}`);
  } else {
    console.log('  ⚠️ 没有找到 submitted 状态的标注项，跳过 AI 预审测试');
  }

  // 检查审核结果
  const reviews = await GET('/api/reviews', ownerToken);
  assert(reviews.status === 200, '获取审核列表');
  const reviewList = reviews.data.data?.items || reviews.data.data;
  assert(Array.isArray(reviewList), '审核列表为数组');

  const reviewByItem = await GET('/api/reviews/by-item/d101', ownerToken);
  assert(reviewByItem.status === 200, '按数据项获取审核结果', `status: ${reviewByItem.status}`);

  const reviewByTask = await GET('/api/reviews/by-task/t001', ownerToken);
  assert(reviewByTask.status === 200, '按任务获取审核结果', `status: ${reviewByTask.status}`);

  // ─── 7. 审核工作台流程 ─────────────────────────
  console.log('\n📌 7. 审核工作台流程');

  // 获取待审核数据 (reviewer)
  const pendingReviewItems = await GET(
    '/api/annotation-items?status=pending_review',
    reviewerToken,
  );
  assert(pendingReviewItems.status === 200, '审核员获取待审核列表');
  const pendingReviewList = pendingReviewItems.data.data?.items || pendingReviewItems.data.data;

  if (Array.isArray(pendingReviewList) && pendingReviewList.length > 0) {
    const reviewItem = pendingReviewList[0];
    logExtra(`待审核项: ${reviewItem.id}, 状态: ${reviewItem.status}`);

    // 通过审核 (PUT)
    const approveRes = await PUT(
      `/api/annotation-items/${reviewItem.id}/approve`,
      {
        reason: 'Test approve',
      },
      reviewerToken,
    );
    assert(
      approveRes.status === 200,
      '审核通过操作',
      `status: ${approveRes.status}, msg: ${approveRes.data.message}`,
    );

    // 验证审核后状态
    const approvedItem = await GET(`/api/annotation-items/${reviewItem.id}`, reviewerToken);
    logExtra(`审核通过后状态: ${approvedItem.data.data?.status}`);
    assert(
      approvedItem.data.data?.status === 'reviewed',
      '审核通过后状态为 reviewed',
      `实际: ${approvedItem.data.data?.status}`,
    );
  } else {
    console.log('  ⚠️ 没有找到 pending_review 状态的标注项');
  }

  // 测试驳回流程
  const pendingReviewItems2 = await GET(
    '/api/annotation-items?status=pending_review',
    reviewerToken,
  );
  const pendingReviewList2 = pendingReviewItems2.data.data?.items || pendingReviewItems2.data.data;

  if (Array.isArray(pendingReviewList2) && pendingReviewList2.length > 0) {
    const rejectItem = pendingReviewList2[0];
    const rejectRes = await PUT(
      `/api/annotation-items/${rejectItem.id}/reject`,
      {
        reason: 'Test reject reason',
      },
      reviewerToken,
    );
    assert(
      rejectRes.status === 200,
      '审核驳回操作',
      `status: ${rejectRes.status}, msg: ${rejectRes.data.message}`,
    );

    // 验证驳回后状态
    const rejectedItem = await GET(`/api/annotation-items/${rejectItem.id}`, reviewerToken);
    assert(
      rejectedItem.data.data?.status === 'rejected',
      '驳回后状态为 rejected',
      `实际: ${rejectedItem.data.data?.status}`,
    );

    // 测试重新提交 (PUT)
    if (rejectedItem.data.data?.status === 'rejected') {
      // Debug: 检查 annotator 字段
      logExtra(`被驳回项 annotator: ${rejectedItem.data.data?.annotator}, id: ${rejectItem.id}`);
      const resubmitRes = await PUT(
        `/api/annotation-items/${rejectItem.id}/resubmit`,
        {
          annotationData: { ...rejectedItem.data.data.annotationData, note: 'Modified resubmit' },
          version: rejectedItem.data.data?.version,
        },
        annotatorToken,
      );
      assert(
        resubmitRes.status === 200,
        '重新提交标注',
        `status: ${resubmitRes.status}, msg: ${resubmitRes.data.message}`,
      );
    }
  } else {
    console.log('  ⚠️ 没有找到更多 pending_review 项用于驳回测试');
  }

  // ─── 8. 统计看板 ─────────────────────────
  console.log('\n📌 8. 统计看板');

  const statsItems = await GET('/api/annotation-items', ownerToken);
  assert(statsItems.status === 200, '获取所有标注项(统计用)');

  const statsTasks = await GET('/api/tasks', ownerToken);
  assert(statsTasks.status === 200, '获取所有任务(统计用)');

  const statsReviews = await GET('/api/reviews', ownerToken);
  assert(statsReviews.status === 200, '获取所有审核(统计用)');

  // 验证统计数据
  const allItems = statsItems.data.data?.items || statsItems.data.data;
  const allTasks = statsTasks.data.data?.items || statsTasks.data.data;
  logExtra(
    `标注项: ${Array.isArray(allItems) ? allItems.length : 'N/A'}, 任务: ${Array.isArray(allTasks) ? allTasks.length : 'N/A'}`,
  );

  // ─── 9. 数据导出 ─────────────────────────
  console.log('\n📌 9. 数据导出');

  const exportItems = await GET('/api/annotation-items?taskId=t001&status=reviewed', ownerToken);
  assert(exportItems.status === 200, '获取已审核数据(导出用)');
  const exportList = exportItems.data.data?.items || exportItems.data.data;
  logExtra(`已审核数据: ${Array.isArray(exportList) ? exportList.length : 'N/A'} 条`);

  // ─── 10. 用户管理流程 ─────────────────────────
  console.log('\n📌 10. 用户管理流程');

  const userList = await GET('/api/users', ownerToken);
  assert(userList.status === 200, '获取用户列表');
  const userListData = userList.data.data?.items || userList.data.data;
  assert(Array.isArray(userListData) && userListData.length >= 3, '用户列表至少3个用户');

  // 非 owner 不能访问用户管理
  const userListAnnotator = await GET('/api/users', annotatorToken);
  assert(userListAnnotator.status === 403, '标注员不能访问用户管理');

  // ─── 11. RBAC 权限检查 ─────────────────────────
  console.log('\n📌 11. RBAC 权限检查');

  // 标注员不能创建任务
  const annotatorCreateTask = await POST('/api/tasks', { name: 'Should fail' }, annotatorToken);
  assert(
    annotatorCreateTask.status === 403,
    '标注员不能创建任务',
    `status: ${annotatorCreateTask.status}`,
  );

  // 标注员不能审核
  const annotatorApprove = await PUT('/api/annotation-items/d101/approve', {}, annotatorToken);
  assert(
    annotatorApprove.status === 403,
    '标注员不能审核通过',
    `status: ${annotatorApprove.status}`,
  );

  // 审核员不能创建任务
  const reviewerCreateTask = await POST('/api/tasks', { name: 'Should fail' }, reviewerToken);
  assert(
    reviewerCreateTask.status === 403,
    '审核员不能创建任务',
    `status: ${reviewerCreateTask.status}`,
  );

  // ─── 12. 状态机验证 ─────────────────────────
  console.log('\n📌 12. 状态机验证');

  // 尝试非法状态转换：对已审核项提交
  const reviewedItemRes = await GET('/api/annotation-items/d201', ownerToken);
  if (reviewedItemRes.data.data?.status === 'reviewed') {
    const resubmitReviewed = await PUT(
      '/api/annotation-items/d201/submit',
      {
        annotationData: {},
      },
      annotatorToken,
    );
    assert(
      resubmitReviewed.status !== 200 || resubmitReviewed.data.code !== 200,
      '已审核项不能再次提交',
      `status: ${resubmitReviewed.status}, msg: ${resubmitReviewed.data.message}`,
    );
  }

  // 尝试对 pending 项直接审核
  const currentItemsForState = await GET('/api/annotation-items?taskId=t001', ownerToken);
  const currentItemList = currentItemsForState.data.data?.items || currentItemsForState.data.data;
  const anyPending = Array.isArray(currentItemList)
    ? currentItemList.find((i) => i.status === 'pending')
    : null;
  if (anyPending) {
    const approvePending = await PUT(
      `/api/annotation-items/${anyPending.id}/approve`,
      {
        reason: 'Should fail',
      },
      reviewerToken,
    );
    assert(
      approvePending.status !== 200 || approvePending.data.code !== 200,
      'pending 项不能直接审核',
      `status: ${approvePending.status}, msg: ${approvePending.data.message}`,
    );
  }

  // ─── 13. 乐观锁/并发测试 ─────────────────────────
  console.log('\n📌 13. 乐观锁/并发控制');

  // 找一个可以标注的项
  const lockableItems = await GET('/api/annotation-items?taskId=t001', annotatorToken);
  const lockableList = lockableItems.data.data?.items || lockableItems.data.data;
  if (Array.isArray(lockableList) && lockableList.length > 0) {
    const testItem = lockableList.find((i) => i.status === 'pending' || i.status === 'draft');
    if (testItem) {
      // Version conflict test
      const wrongVersionSubmit = await PUT(
        `/api/annotation-items/${testItem.id}/save-draft`,
        {
          annotationData: { test: 'version conflict' },
          version: 999, // wrong version
        },
        annotatorToken,
      );
      assert(
        wrongVersionSubmit.status === 409,
        '乐观锁：版本冲突返回409',
        `status: ${wrongVersionSubmit.status}, msg: ${wrongVersionSubmit.data.message}`,
      );
    }
  }

  // ─── 清理测试数据 ─────────────────────────
  console.log('\n📌 清理测试数据');

  const delTask = await DELETE(`/api/tasks/${taskId}`, ownerToken);
  console.log(`  删除测试任务: ${delTask.status === 200 ? '✅' : '❌'} (${delTask.data.message})`);

  // ─── 测试结果汇总 ─────────────────────────
  console.log('\n========================================');
  console.log(`📊 测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log('========================================');

  if (bugs.length > 0) {
    console.log('\n🐛 发现的 Bug:');
    bugs.forEach((b, i) =>
      console.log(`  ${i + 1}. ${b.test}${b.details ? ' — ' + b.details : ''}`),
    );
  } else {
    console.log('\n🎉 没有发现 Bug！');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('测试执行出错:', e);
  process.exit(1);
});
