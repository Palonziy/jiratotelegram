const db = require('../db/database');
const JiraClient = require('../jira/jiraClient');

async function inspectChangelogs() {
  await db.init();
  const allHistory = await db.getAllHistory();
  console.log(`[CHANGELOG DUMP] Total history items in DB: ${allHistory.length}`);

  if (allHistory.length === 0) {
    console.log('[CHANGELOG DUMP] DB has 0 history items. Fetching directly from Jira API...');
    const client = new JiraClient();
    const issues = await client.fetchAllBugs();
    console.log(`[CHANGELOG DUMP] Fetched ${issues.length} bugs.`);

    let count = 0;
    for (const b of issues) {
      if (b.history && b.history.length > 0) {
        count += b.history.length;
        console.log(`\nIssue ${b.key} history (${b.history.length} items):`);
        b.history.forEach(h => {
          console.log(`  From: "${h.fromStatus}" -> To: "${h.toStatus}" at ${h.transitionedAt} by ${h.author}`);
        });
      }
    }
    console.log(`\n[CHANGELOG DUMP] Total status transitions across fetched issues: ${count}`);
  } else {
    console.log('\nSample history items in DB:');
    allHistory.slice(0, 10).forEach(h => {
      console.log(`Issue: ${h.issue_key || h.issueKey} | From: "${h.from_status || h.fromStatus}" -> To: "${h.to_status || h.toStatus}" | Date: ${h.transitioned_at || h.transitionedAt}`);
    });
  }
}

inspectChangelogs().catch(e => console.error('[CHANGELOG DUMP] Error:', e.message));
