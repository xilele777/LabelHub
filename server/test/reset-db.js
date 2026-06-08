/**
 * Reset all mutable test data and restore deterministic E2E users.
 *
 * Usage: node test/reset-db.js
 */
const db = require('../store/db');
const { hashPassword } = require('../utils/password');

const TEST_USERS = [
  { id: 'u001', username: 'owner', password: 'owner123', avatar: null, role: 'owner' },
  { id: 'u002', username: 'annotator', password: 'annotator123', avatar: null, role: 'annotator' },
  { id: 'u003', username: 'reviewer', password: 'reviewer123', avatar: null, role: 'reviewer' },
];

db._db.transaction(() => {
  db._db.exec('DELETE FROM reviews');
  db._db.exec('DELETE FROM annotation_items');
  db._db.exec('DELETE FROM tasks');
  db._db.exec('DELETE FROM templates');
  db._db.exec('DELETE FROM notifications');

  db.seed(
    'users',
    TEST_USERS.map((user) => ({
      ...user,
      password: hashPassword(user.password),
    })),
  );
})();

console.log('Database reset complete.');
console.log('   users:           ', db.count('users'));
console.log('   templates:       ', db.count('templates'));
console.log('   tasks:           ', db.count('tasks'));
console.log('   annotation-items:', db.count('annotation-items'));
console.log('   reviews:         ', db.count('reviews'));
