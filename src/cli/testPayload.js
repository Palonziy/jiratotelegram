const config = require('../config');
const https = require('https');

async function runTest() {
  const authHeader = 'Basic ' + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  const jql = `project = ${config.jira.project} AND type = Bug AND reporter = "${config.jira.reporterId}" AND status IN (Bug, Done, "Report(BUGUN)", "In Progress", "To do", Testing) ORDER BY created DESC`;

  const payloads = [
    { name: '1. Minimal (jql, maxResults)', data: { jql, maxResults: 5 } },
    { name: '2. With fields string array', data: { jql, maxResults: 5, fields: ['summary', 'status'] } },
    { name: '3. With expand array', data: { jql, maxResults: 5, expand: ['changelog'] } },
    { name: '4. With expand string', data: { jql, maxResults: 5, expand: 'changelog' } }
  ];

  for (const p of payloads) {
    console.log(`\n--- Testing ${p.name} ---`);
    try {
      const res = await sendPost('/rest/api/3/search/jql', p.data, authHeader);
      console.log(`Status: ${res.status}`);
      console.log(`Body: ${res.body.substring(0, 300)}`);
    } catch (e) {
      console.error(`Error: ${e.message}`);
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

runTest();
