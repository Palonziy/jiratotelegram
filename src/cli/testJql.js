const config = require('../config');
const https = require('https');

async function testJqlVariations() {
  const authHeader = 'Basic ' + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');

  const jqls = [
    { name: '1. Simple Project & Type', jql: 'project = WIP AND type = Bug ORDER BY created DESC' },
    { name: '2. Simple Project & Issuetype', jql: 'project = WIP AND issuetype = Bug ORDER BY created DESC' },
    { name: '3. Project & Statuses', jql: 'project = WIP AND type = Bug AND status IN (Bug, Done, "Report(BUGUN)", "In Progress", "To do", Testing)' },
    { name: '4. Full JQL with Reporter', jql: `project = ${config.jira.project} AND type = Bug AND reporter = "${config.jira.reporterId}" ORDER BY created DESC` },
    { name: '5. Reporter without quotes', jql: `project = ${config.jira.project} AND type = Bug AND reporter = ${config.jira.reporterId}` }
  ];

  for (const item of jqls) {
    console.log(`\n========================================`);
    console.log(`[TEST] ${item.name}`);
    console.log(`[JQL] ${item.jql}`);
    try {
      const res = await sendPost('/rest/api/3/search/jql', { jql: item.jql, maxResults: 5 }, authHeader);
      console.log(`[STATUS] ${res.status}`);
      console.log(`[RESPONSE] ${res.body.substring(0, 300)}`);
    } catch (e) {
      console.error(`[ERROR] ${e.message}`);
    }
  }
}

function sendPost(path, body, authHeader) {
  const urlObj = new URL(`${config.jira.url}${path}`);
  const postData = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('Timeout (8s)')));
    req.write(postData);
    req.end();
  });
}

testJqlVariations();
