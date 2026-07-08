/**
 * RBAC integration tests.
 *
 * The test uses only HTTP APIs and creates all data it needs.
 * Run directly against a running server, or through run-server-isolated.js.
 */
const BASE = `${process.env.BASE_URL || 'http://localhost:3001'}/api`;

let passed = 0;
let failed = 0;

async function fetchJSON(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return {
      status: res.status,
      body: await res.json(),
    };
  } catch (error) {
    return {
      status: 0,
      body: { code: -1, message: error.message, data: null },
    };
  }
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function ok(result) {
  const code = result.body?.code;
  return result.status >= 200 && result.status < 300 && code >= 200 && code < 300;
}

function forbidden(result) {
  return result.status === 403 || result.body?.code === 403;
}

function assert(condition, name, result) {
  if (condition) {
    console.log(`  PASS ${name}`);
    passed += 1;
    return;
  }

  const detail = result
    ? ` status=${result.status}, code=${result.body?.code}, msg=${result.body?.message}`
    : '';
  console.log(`  FAIL ${name}${detail}`);
  failed += 1;
}

async function login(username, password) {
  const result = await fetchJSON('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert(ok(result), `${username} login`, result);
  return result.body.data?.token;
}

async function main() {
  console.log('\nRBAC integration tests\n');

  const health = await fetchJSON('/health');
  assert(ok(health), 'server health', health);

  const ownerToken = await login('o', '123');
  const annotatorToken = await login('a', '123');
  const reviewerToken = await login('r', '123');

  if (!ownerToken || !annotatorToken || !reviewerToken) {
    process.exit(1);
  }

  console.log('\nPrepare data');
  const template = await fetchJSON('/templates', {
    method: 'POST',
    headers: auth(ownerToken),
    body: JSON.stringify({
      name: 'RBAC Test Template',
      description: 'RBAC test template',
      type: 'text_ner',
      fieldCount: 1,
      creator: 'o',
      fields: [{ id: 'rbac_field', type: 'input', fieldKey: 'text', label: 'Text' }],
    }),
  });
  assert(ok(template), 'owner creates template', template);
  const templateId = template.body.data?.id;

  const task = await fetchJSON('/tasks', {
    method: 'POST',
    headers: auth(ownerToken),
    body: JSON.stringify({
      name: 'RBAC Test Task',
      description: 'RBAC test task',
      type: 'text_ner',
      owner: 'o',
      templateId,
      status: 'in_progress',
    }),
  });
  assert(ok(task), 'owner creates task', task);
  const taskId = task.body.data?.id;

  async function createItem(name, item) {
    const result = await fetchJSON('/annotation-items', {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ taskId, rawData: { text: name }, ...item }),
    });
    assert(ok(result), `owner creates ${name}`, result);
    return result.body.data?.id;
  }

  const pendingItemId = await createItem('pending item', { status: 'pending' });
  const pendingReviewItemId = await createItem('pending review item', {
    status: 'pending_review',
    annotator: 'a',
    annotationData: { text: 'done' },
    submittedAt: new Date().toISOString(),
  });
  const reviewerOwnItemId = await createItem('reviewer own item', {
    status: 'pending_review',
    annotator: 'r',
    annotationData: { text: 'own' },
    submittedAt: new Date().toISOString(),
  });
  const ownerPendingItemId = await createItem('owner pending item', { status: 'pending' });
  const ownerReviewItemId = await createItem('owner review item', {
    status: 'pending_review',
    annotator: 'a',
    annotationData: { text: 'review' },
    submittedAt: new Date().toISOString(),
  });
  const annotatorRejectItemId = await createItem('annotator reject item', {
    status: 'pending_review',
    annotator: 'a',
    annotationData: { text: 'reject' },
    submittedAt: new Date().toISOString(),
  });

  console.log('\nTasks and templates');
  let result = await fetchJSON('/tasks', {
    method: 'POST',
    headers: auth(ownerToken),
    body: JSON.stringify({ name: 'Owner Task', type: 'text_ner', owner: 'o', templateId }),
  });
  assert(ok(result), 'owner can create task', result);

  result = await fetchJSON('/tasks', {
    method: 'POST',
    headers: auth(annotatorToken),
    body: JSON.stringify({ name: 'Annotator Task', type: 'text_ner', templateId }),
  });
  assert(forbidden(result), 'annotator cannot create task', result);

  result = await fetchJSON('/tasks', {
    method: 'POST',
    headers: auth(reviewerToken),
    body: JSON.stringify({ name: 'Reviewer Task', type: 'text_ner', templateId }),
  });
  assert(forbidden(result), 'reviewer cannot create task', result);

  assert(
    ok(await fetchJSON('/tasks', { headers: auth(annotatorToken) })),
    'annotator can list tasks',
  );
  assert(
    ok(await fetchJSON('/tasks', { headers: auth(reviewerToken) })),
    'reviewer can list tasks',
  );

  result = await fetchJSON('/templates', {
    method: 'POST',
    headers: auth(annotatorToken),
    body: JSON.stringify({ name: 'Bad Template', type: 'text_ner', fields: [] }),
  });
  assert(forbidden(result), 'annotator cannot create template', result);
  assert(
    ok(await fetchJSON('/templates', { headers: auth(annotatorToken) })),
    'annotator can list templates',
  );

  console.log('\nAnnotation and review operations');
  result = await fetchJSON(`/annotation-items/${pendingItemId}/save-draft`, {
    method: 'PUT',
    headers: auth(annotatorToken),
    body: JSON.stringify({ annotationData: { text: 'draft' } }),
  });
  assert(ok(result), 'annotator can save draft on unassigned item', result);

  result = await fetchJSON(`/annotation-items/${pendingItemId}/submit`, {
    method: 'PUT',
    headers: auth(annotatorToken),
    body: JSON.stringify({ annotationData: { text: 'submit' } }),
  });
  assert(ok(result), 'annotator can submit own item', result);

  result = await fetchJSON(`/annotation-items/${reviewerOwnItemId}/approve`, {
    method: 'PUT',
    headers: auth(reviewerToken),
    body: JSON.stringify({ reason: 'self review should fail' }),
  });
  assert(forbidden(result), 'reviewer cannot approve own annotation', result);

  result = await fetchJSON(`/annotation-items/${pendingReviewItemId}/approve`, {
    method: 'PUT',
    headers: auth(annotatorToken),
    body: JSON.stringify({ reason: 'annotator should fail' }),
  });
  assert(forbidden(result), 'annotator cannot approve annotation', result);

  result = await fetchJSON(`/annotation-items/${annotatorRejectItemId}/reject`, {
    method: 'PUT',
    headers: auth(annotatorToken),
    body: JSON.stringify({ reason: 'annotator should fail' }),
  });
  assert(forbidden(result), 'annotator cannot reject annotation', result);

  result = await fetchJSON(`/annotation-items/${pendingReviewItemId}/approve`, {
    method: 'PUT',
    headers: auth(reviewerToken),
    body: JSON.stringify({ reason: 'looks good' }),
  });
  assert(ok(result), 'reviewer can approve another annotator item', result);

  result = await fetchJSON(`/annotation-items/${ownerPendingItemId}/save-draft`, {
    method: 'PUT',
    headers: auth(ownerToken),
    body: JSON.stringify({ annotationData: { text: 'owner' } }),
  });
  assert(forbidden(result), 'owner cannot save draft', result);

  result = await fetchJSON(`/annotation-items/${ownerPendingItemId}/submit`, {
    method: 'PUT',
    headers: auth(ownerToken),
    body: JSON.stringify({ annotationData: { text: 'owner' } }),
  });
  assert(forbidden(result), 'owner cannot submit annotation', result);

  result = await fetchJSON(`/annotation-items/${ownerReviewItemId}/approve`, {
    method: 'PUT',
    headers: auth(ownerToken),
    body: JSON.stringify({ reason: 'owner should fail' }),
  });
  assert(forbidden(result), 'owner cannot approve annotation workflow item', result);

  console.log('\nReview records and users');
  result = await fetchJSON('/reviews', {
    method: 'POST',
    headers: auth(annotatorToken),
    body: JSON.stringify({ dataItemId: pendingItemId, taskId, score: 80 }),
  });
  assert(forbidden(result), 'annotator cannot create review record', result);

  assert(
    ok(await fetchJSON('/reviews', { headers: auth(annotatorToken) })),
    'annotator can list review records',
  );

  result = await fetchJSON('/reviews', {
    method: 'POST',
    headers: auth(ownerToken),
    body: JSON.stringify({
      dataItemId: ownerPendingItemId,
      taskId,
      reviewStatus: 'pass',
      score: 90,
      summary: 'owner-created review record',
    }),
  });
  assert(ok(result), 'owner can create review record', result);

  assert(
    forbidden(await fetchJSON('/users', { headers: auth(annotatorToken) })),
    'annotator cannot list users',
  );
  result = await fetchJSON('/users', {
    method: 'POST',
    headers: auth(annotatorToken),
    body: JSON.stringify({ username: 'hack', password: 'hack1234', role: 'owner' }),
  });
  assert(forbidden(result), 'annotator cannot create user', result);
  assert(ok(await fetchJSON('/users', { headers: auth(ownerToken) })), 'owner can list users');

  console.log('\n========================================');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('RBAC test failed:', error);
  process.exit(1);
});
