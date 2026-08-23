const config = require('../config');

async function testJiraApi() {
  const authHeader = 'Basic ' + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  const jql = `project = ${config.jira.project} AND type = Bug`;

  const endpoints = [
    { name: 'POST /rest/api/3/search/jql', url: `${config.jira.url}/rest/api/3/search/jql`, method: 'POST', body: JSON.stringify({ jql, maxResults: 1 }) },
    { name: 'GET /rest/api/3/search/jql', url: `${config.jira.url}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1`, method: 'GET' },
    { name: 'POST /rest/api/3/search', url: `${config.jira.url}/rest/api/3/search`, method: 'POST', body: JSON.stringify({ jql, maxResults: 1 }) }
  ];

  for (const ep of endpoints) {
    console.log(`[TEST] Trying ${ep.name}...`);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: ep.body,
        signal: controller.signal
      });
      clearTimeout(t);
      const text = await res.text();
      console.log(`[TEST] Response ${res.status}: ${text.substring(0, 200)}`);
      if (res.ok) {
        console.log(`>>> WORKING ENDPOINT FOUND: ${ep.name}`);
        break;
      }
    } catch (e) {
      console.log(`[TEST] ${ep.name} failed: ${e.message}`);
    }
  }
}

testJiraApi();
