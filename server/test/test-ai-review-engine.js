/**
 * 测试服务端 AI 预审引擎
 */
const { runAIReview } = require('../services/aiReviewEngine');

// 测试场景：必填字段缺失 + 评分超出范围
const result = runAIReview({
  template: {
    fields: [
      { fieldKey: 'name', label: '名称', type: 'input', required: true },
      { fieldKey: 'score', label: '评分', type: 'rating', maxScore: 5 },
      { fieldKey: 'comment', label: '评语', type: 'textarea' },
      { fieldKey: 'category', label: '分类', type: 'radio', options: [{ label: 'A', value: 'a' }, { label: '其他', value: 'other' }] },
    ],
  },
  rawData: {},
  annotationResult: { name: '', score: 6, comment: 'x', category: 'other' },
  dataItemId: 'test1',
  taskId: 't1',
  templateId: 'tpl1',
});

console.log('=== AI 预审引擎测试 ===');
console.log('预审状态:', result.reviewStatus);
console.log('质量评分:', result.score);
console.log('摘要:', result.summary);
console.log('命中规则数:', result.matchedRules.length);
console.log('字段警告数:', result.fieldWarnings.length);
console.log('建议数:', result.suggestions.length);
console.log('\n命中规则:');
result.matchedRules.forEach((r) => console.log(`  [${r.ruleId}] ${r.name} (${r.severity})`));
console.log('\n字段警告:');
result.fieldWarnings.forEach((w) => console.log(`  ${w.fieldLabel}: ${w.message} (${w.severity})`));
console.log('\n完整结果:');
console.log(JSON.stringify(result, null, 2));

// 验证预期
const expected = {
  R001_hit: result.matchedRules.some(r => r.ruleId === 'R001'),  // name 为空
  R002_hit: result.matchedRules.some(r => r.ruleId === 'R002'),  // score=6 > maxScore=5
  R003_hit: result.matchedRules.some(r => r.ruleId === 'R003'),  // comment='x' 长度 < 2
  R005_hit: result.matchedRules.some(r => r.ruleId === 'R005'),  // category='other'
  isFail: result.reviewStatus === 'fail',  // 有 error 级别规则命中 → FAIL
};

console.log('\n=== 验证 ===');
console.log('R001 命中:', expected.R001_hit, expected.R001_hit ? '✅' : '❌');
console.log('R002 命中:', expected.R002_hit, expected.R002_hit ? '✅' : '❌');
console.log('R003 命中:', expected.R003_hit, expected.R003_hit ? '✅' : '❌');
console.log('R005 命中:', expected.R005_hit, expected.R005_hit ? '✅' : '❌');
console.log('预审状态为 FAIL:', expected.isFail, expected.isFail ? '✅' : '❌');

// 测试场景2：完美标注
const perfectResult = runAIReview({
  template: {
    fields: [
      { fieldKey: 'name', label: '名称', type: 'input', required: true },
      { fieldKey: 'score', label: '评分', type: 'rating', maxScore: 5 },
    ],
  },
  rawData: {},
  annotationResult: { name: '测试名称', score: 4 },
  dataItemId: 'test2',
  taskId: 't1',
  templateId: 'tpl1',
});

console.log('\n=== 完美标注测试 ===');
console.log('预审状态:', perfectResult.reviewStatus);
console.log('质量评分:', perfectResult.score);
console.log('摘要:', perfectResult.summary);
console.log('应为 PASS:', perfectResult.reviewStatus === 'pass' ? '✅' : '❌');
