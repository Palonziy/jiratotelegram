const assert = require('assert');
const analyticsEngine = require('../src/analytics/analyticsEngine');
const reportFormatter = require('../src/telegram/reportFormatter');

async function testWeeklyAnalytics() {
  console.log('[TEST] Running Weekly QA Analytics unit tests...');

  // Test 1: getStartOfWeek helper
  const wednesday = new Date('2026-08-19T12:00:00Z');
  const monday = analyticsEngine.getStartOfWeek(wednesday);
  assert.strictEqual(monday.getDay(), 1, 'Start of week must be Monday');
  console.log('✅ Test 1 Passed: getStartOfWeek correctly calculates Monday');

  // Test 2: getWeeklyAnalytics calculation
  const weekly = await analyticsEngine.getWeeklyAnalytics(new Date());
  assert.ok(weekly.period, 'Weekly report must have period info');
  assert.ok(weekly.weeklyActivity, 'Weekly report must have weeklyActivity info');
  assert.ok(weekly.performance, 'Weekly report must have performance info');
  assert.ok(weekly.backlogDynamics, 'Weekly report must have backlogDynamics info');
  assert.ok(typeof weekly.weeklyActivity.qaPassRate === 'number', 'qaPassRate must be a number');
  console.log(`✅ Test 2 Passed: getWeeklyAnalytics calculated ${weekly.weeklyActivity.createdWeekly} created, ${weekly.weeklyActivity.movedToDoneWeekly} done, Pass Rate: ${weekly.weeklyActivity.qaPassRate}%`);

  // Test 3: formatWeeklyReport formatting
  const formattedHtml = reportFormatter.formatWeeklyReport(weekly);
  assert.ok(formattedHtml.includes('RENTMI QA WEEKLY REPORT'), 'Report must contain title header');
  assert.ok(formattedHtml.includes('WEEKLY ACTIVITY'), 'Report must contain WEEKLY ACTIVITY section');
  assert.ok(formattedHtml.includes('QA Pass Rate'), 'Report must contain QA Pass Rate metric');
  console.log('✅ Test 3 Passed: formatWeeklyReport produces clean HTML output');

  console.log('\n🎉 ALL WEEKLY ANALYTICS TESTS PASSED SUCCESSFULLY!');
}

testWeeklyAnalytics().catch(err => {
  console.error('❌ Weekly Analytics Test Failed:', err);
  process.exit(1);
});
