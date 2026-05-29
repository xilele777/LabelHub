/**
 * reset-db.js — 清空所有业务数据，仅保留用户账号
 * 用法: node test/reset-db.js
 */
const db = require('../store/db');

db._db.transaction(() => {
  // 清空业务数据（保留 users 表以便登录）
  db._db.exec('DELETE FROM reviews');
  db._db.exec('DELETE FROM annotation_items');
  db._db.exec('DELETE FROM tasks');
  db._db.exec('DELETE FROM templates');

  console.log('🧹 已清空以下数据表: templates, tasks, annotation_items, reviews');

  // 确保用户数据完整（如果 users 为空则重新写入）
  const userCount = db.count('users');
  if (userCount === 0) {
    db.seed('users', [
      { id: 'u001', username: 'owner', password: 'owner123', avatar: null, role: 'owner' },
      { id: 'u002', username: 'annotator', password: 'annotator123', avatar: null, role: 'annotator' },
      { id: 'u003', username: 'reviewer', password: 'reviewer123', avatar: null, role: 'reviewer' },
    ]);
    console.log('👥 已重新创建用户数据 (owner, annotator, reviewer)');
  } else {
    console.log(`👥 用户数据完整 (${userCount} 条)，跳过`);
  }
})();

console.log('');
console.log('✅ 数据库已重置，可开始测试');
console.log('   users:           ', db.count('users'));
console.log('   templates:       ', db.count('templates'));
console.log('   tasks:           ', db.count('tasks'));
console.log('   annotation-items:', db.count('annotation-items'));
console.log('   reviews:         ', db.count('reviews'));
