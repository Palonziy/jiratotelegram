const db = require('../db/database');
const analyticsEngine = require('../analytics/analyticsEngine');

async function debugTrend() {
  await db.init();
  const issues = await db.getAllIssues();
  const snapshots = await db.getDailySnapshots();

  console.log(`[DEBUG TREND] Total issues in DB: ${issues.length}`);
  console.log(`[DEBUG TREND] Total snapshots in DB: ${snapshots.length}`);
  snapshots.forEach(s => {
    console.log(`Snapshot date: ${s.date} | active_backlog: ${s.active_backlog} | done_count: ${s.done_count} | total: ${(s.active_backlog || 0) + (s.done_count || 0)}`);
  });

  const createdPerDate = {};
  issues.forEach(i => {
    const d = analyticsEngine.formatDateStr(i.created);
    createdPerDate[d] = (createdPerDate[d] || 0) + 1;
  });

  console.log('\n[DEBUG TREND] Issues created per date:');
  console.log(JSON.stringify(createdPerDate, null, 2));

  const analyticsToday = await analyticsEngine.getAnalyticsForDate(new Date());
  console.log('\n[DEBUG TREND] Analytics trend object:');
  console.log(JSON.stringify(analyticsToday.trend, null, 2));
}

debugTrend().catch(e => console.error('[DEBUG TREND] Error:', e.message));
