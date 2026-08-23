const config = require('../config');
const JiraClient = require('../src/jira/jiraClient');

async function testChangelog() {
  const client = new JiraClient();
  console.log('[CHANGELOG TEST] Fetching issue WIP-864 raw data...');

  const data = await client._request('/rest/api/3/search/jql?expand=changelog', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${config.jira.project} AND type = Bug`,
      maxResults: 5,
      fields: ['*all'],
      expand: ['changelog']
    })
  });

  const issues = data.issues || [];
  if (issues.length > 0) {
    const issue1 = issues[0];
    console.log(`[CHANGELOG TEST] Issue ${issue1.key} changelog present?`, !!issue1.changelog);
    if (issue1.changelog) {
      console.log(`[CHANGELOG TEST] Histories count:`, (issue1.changelog.histories || []).length);
      if (issue1.changelog.histories && issue1.changelog.histories.length > 0) {
        console.log(`[CHANGELOG TEST] Sample history item:`, JSON.stringify(issue1.changelog.histories[0]));
      }
    }
  }

  // Also test direct issue changelog endpoint
  console.log('\n[CHANGELOG TEST] Testing GET /rest/api/3/issue/WIP-864/changelog...');
  try {
    const clData = await client._request('/rest/api/3/issue/' + issues[0].key + '/changelog');
    console.log('[CHANGELOG TEST] Direct endpoint values count:', (clData.values || []).length);
    if (clData.values && clData.values.length > 0) {
      console.log('[CHANGELOG TEST] Direct sample history:', JSON.stringify(clData.values[0]));
    }
  } catch (e) {
    console.error('[CHANGELOG TEST] Direct endpoint error:', e.message);
  }
}

testChangelog().catch(e => console.error('[CHANGELOG TEST] Error:', e.message));
