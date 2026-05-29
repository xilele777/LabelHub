/**
 * Quick test for concurrency control: optimistic lock + pessimistic lock
 */
const db = require('../store/db');

console.log('=== Testing Concurrency Control ===\n');

// Test 1: Version field exists on seed data
console.log('--- Test 1: Version field ---');
const item = db.getById('annotation-items', 'd001');
console.log('d001 version:', item?.version, '(expected: 1)');
console.log('d001 lockedBy:', item?.lockedBy, '(expected: null)');
console.log('PASS:', item?.version === 1 && item?.lockedBy === null);

// Test 2: Update increments version
console.log('\n--- Test 2: Update increments version ---');
const updated = db.updateById('annotation-items', 'd001', { status: 'draft' });
console.log('After update, version:', updated?.version, '(expected: 2)');
console.log('PASS:', updated?.version === 2);

// Reset
db.updateById('annotation-items', 'd001', { status: 'pending' });
// Version is now 3

// Test 3: Claim (pessimistic lock)
console.log('\n--- Test 3: Claim (pessimistic lock) ---');
const claimResult = db.claimItem('d001', 'annotator1', 1800000);
console.log('Claim result:', claimResult.claimed ? 'CLAIMED' : 'FAILED');
console.log('lockedBy:', claimResult.item?.lockedBy, '(expected: annotator1)');
console.log('Version after claim:', claimResult.item?.version, '(should NOT have incremented)');
// Version should stay at 3 (claim doesn't increment version)
console.log('PASS:', claimResult.claimed && claimResult.item?.lockedBy === 'annotator1');

// Test 4: Second claim attempt should fail
console.log('\n--- Test 4: Second claim fails ---');
const claimResult2 = db.claimItem('d001', 'annotator2', 1800000);
console.log('Second claim result:', claimResult2.claimed ? 'CLAIMED (WRONG!)' : 'BLOCKED');
console.log('lockedBy:', claimResult2.lockedBy, '(expected: annotator1)');
console.log('PASS:', !claimResult2.claimed && claimResult2.lockedBy === 'annotator1');

// Test 5: Release
console.log('\n--- Test 5: Release ---');
const releaseResult = db.releaseItem('d001', 'annotator1');
console.log('Release result:', releaseResult.released ? 'RELEASED' : 'FAILED');
console.log('lockedBy after release:', releaseResult.item?.lockedBy, '(expected: null)');
console.log('PASS:', releaseResult.released && releaseResult.item?.lockedBy === null);

// Test 6: Release all by user
console.log('\n--- Test 6: Release all by user ---');
db.claimItem('d001', 'annotator1', 1800000);
db.claimItem('d002', 'annotator1', 1800000);
const count = db.releaseAllByUser('annotator1');
console.log('Released count:', count, '(expected: 2)');
const d001 = db.getById('annotation-items', 'd001');
const d002 = db.getById('annotation-items', 'd002');
console.log('d001 lockedBy:', d001?.lockedBy, '(expected: null)');
console.log('d002 lockedBy:', d002?.lockedBy, '(expected: null)');
console.log('PASS:', count === 2 && d001?.lockedBy === null && d002?.lockedBy === null);

// Test 7: Expired lock cleanup
console.log('\n--- Test 7: Expired lock cleanup ---');
db.claimItem('d001', 'annotator1', 1); // 1ms timeout = already expired
setTimeout(() => {
  db.cleanExpiredLocks(1);
  const afterCleanup = db.getById('annotation-items', 'd001');
  console.log('After cleanup, lockedBy:', afterCleanup?.lockedBy, '(expected: null)');
  console.log('PASS:', afterCleanup?.lockedBy === null);

  console.log('\n=== All Concurrency Tests Complete ===');
}, 10);
