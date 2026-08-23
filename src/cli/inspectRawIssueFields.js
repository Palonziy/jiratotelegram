const config = require('../config');
const JiraClient = require('../jira/jiraClient');

async function inspectAllFields() {
  const client = new JiraClient();
  console.log('[INSPECT] Fetching issues with fields: ["*all"]...');

  const data = await client._request('/rest/api/3/search/jql?expand=changelog', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${config.jira.project} AND type = Bug`,
      maxResults: 5,
      fields: ['*all']
    })
  });

  const issues = data.issues || [];
  if (issues.length === 0) return;

  console.log('[INSPECT] Issue 1 fields count:', Object.keys(issues[0].fields).length);
  for (const [key, val] of Object.entries(issues[0].fields)) {
    if (val && (JSON.stringify(val).toLowerCase().includes('low') || JSON.stringify(val).toLowerCase().includes('medium') || JSON.stringify(val).toLowerCase().includes('high') || JSON.stringify(val).toLowerCase().includes('urgent'))) {
      console.log(`[FOUND SEVERITY MATCH] Field "${key}":`, JSON.stringify(val));
    }
  }
}

inspectAllFields().catch(e => console.error('[INSPECT] Error:', e.message));
