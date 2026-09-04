const assert = require('assert');
const test = require('node:test');
const db = require('../src/db/database');
const analyticsEngine = require('../src/analytics/analyticsEngine');

test('AnalyticsEngine - Metrics Calculation from Mock DB', async () => {
  await db.init();

  // Populate mock data into DB
  await db.saveIssue({
    key: 'WIP-1',
    id: '1',
    summary: 'Active bug in testing',
    status: 'Testing',
    priority: 'High',
    assignee: 'Lazizbek',
    platform: 'Frontend',
    created: new Date().toISOString()
  });

  await db.saveIssue({
    key: 'WIP-2',
    id: '2',
    summary: 'Completed bug',
    status: 'Done',
    priority: 'Medium',
    assignee: 'Nozimjon',
    platform: 'Backend',
    created: new Date().toISOString()
  });

  const todayStr = analyticsEngine.formatDateStr(new Date());

  await db.saveStatusHistory([
    {
      id: 'h1',
      issueKey: 'WIP-1',
      fromStatus: 'Bug',
      toStatus: 'Testing',
      transitionedAt: new Date().toISOString(),
      author: 'Lazizbek'
    },
    {
      id: 'h2',
      issueKey: 'WIP-2',
      fromStatus: 'Testing',
      toStatus: 'Done',
      transitionedAt: new Date().toISOString(),
      author: 'Nozimjon'
    }
  ]);

  const analytics = await analyticsEngine.getAnalyticsForDate(new Date());

  assert.ok(analytics.currentSnapshot.activeBacklog >= 1);
  assert.ok(analytics.currentSnapshot.statusDistribution.testing >= 1);
  assert.ok(analytics.currentSnapshot.statusDistribution.done >= 1);
  assert.ok(analytics.dailyActivity.movedToTesting >= 1);
  assert.ok(analytics.dailyActivity.movedToDone >= 1);
  assert.ok(analytics.currentSnapshot.priorityDistribution.High >= 1);
  assert.ok(analytics.currentSnapshot.platformDistribution.Frontend >= 1);
});
