const config = require('../config');
const JiraClient = require('../jira/jiraClient');

async function findSeverityField() {
  const client = new JiraClient();
  console.log('[FIELD INSPECTOR] Fetching 5 issues to inspect fields...');

  const rawIssues = [];
  // Direct raw request
  const data = await client._request('/rest/api/3/search/jql?expand=changelog', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${config.jira.project} AND type = Bug`,
      maxResults: 5
    })
  });

  const issues = data.issues || [];
  if (issues.length === 0) {
    console.log('[FIELD INSPECTOR] No issues found.');
    return;
  }

  const firstFields = issues[0].fields;
  console.log('\n[FIELD INSPECTOR] All customfields in issue ' + issues[0].key + ':');

  for (const [key, val] of Object.entries(firstFields)) {
    if (key.startsWith('customfield_') && val) {
      console.log(`Key: ${key} -> `, JSON.stringify(val));
    }
  }
}

findSeverityField().catch(e => console.error('[FIELD INSPECTOR] Error:', e.message));
