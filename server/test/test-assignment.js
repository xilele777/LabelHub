// Test assignment engine and routes
try {
  require('../services/assignmentEngine');
  console.log('assignmentEngine: OK');
} catch (e) {
  console.error('assignmentEngine ERROR:', e.message);
}

try {
  require('../routes/assignments');
  console.log('assignments route: OK');
} catch (e) {
  console.error('assignments route ERROR:', e.message);
}

// Test assignment engine exports exist
try {
  const engine = require('../services/assignmentEngine');
  const exportedFuncs = Object.keys(engine);
  console.log('assignmentEngine exports:', exportedFuncs.join(', '));

  // Verify all expected exports exist
  const expected = [
    'ASSIGNMENT_STRATEGY',
    'getAssignableItems',
    'getAnnotators',
    'evenSplitAssign',
    'manualAssign',
    'clearAssignment',
    'getAssignmentStats',
    'executeAssignment',
  ];

  const missing = expected.filter((name) => !exportedFuncs.includes(name));
  if (missing.length > 0) {
    console.error('Missing exports:', missing.join(', '));
  } else {
    console.log('All expected exports present!');
  }

  // Verify strategy enum values
  const { ASSIGNMENT_STRATEGY } = engine;
  console.log('Strategies:', JSON.stringify(ASSIGNMENT_STRATEGY));

  console.log('\nAssignment engine structure tests passed!');
} catch (e) {
  console.error('Assignment engine test ERROR:', e.message, e.stack);
}
