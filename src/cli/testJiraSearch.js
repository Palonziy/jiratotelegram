const config = require('../config');
const https = require('https');

async function testJiraSearch() {
  const authHeader = 'Basic ' + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  const jql = `project = ${config.jira.project} AND type = Bug AND reporter = "${config.jira.reporterId}" AND status IN (Bug, Done, "Report(BUGUN)", "In Progress", "To do", Testing) ORDER BY created DESC`;

  console.log('[TEST] Auth Email:', config.jira.email);
  console.log('[TEST] Jira URL:', config.jira.url);

  // STEP 1: Verify Auth
  console.log('\n--- STEP 1: Verify Auth ---');
  try {
    const resMyself = await makeReq('/rest/api/3/myself', 'GET', null, authHeader);
    console.log('[TEST] Myself Status:', resMyself.status);
    if (resMyself.status === 200) {
      console.log('[TEST] Myself User:', JSON.parse(resMyself.body).displayName || 'OK');
    } else {
      console.log('[TEST] Myself Error Body:', resMyself.body);
    }
  } catch (e) {
    console.error('[TEST] Myself Failed:', e.message);
  }

  // STEP 2: Test Minimal POST /rest/api/3/search/jql
  console.log('\n--- STEP 2: Minimal POST /rest/api/3/search/jql ---');
  const payload1 = {
    jql: jql,
    maxResults: 5
  };
  console.log('[TEST] Payload 1:', JSON.stringify(payload1));
  try {
    const res1 = await makeReq('/rest/api/3/search/jql', 'POST', payload1, authHeader);
    console.log('[TEST] Res1 Status:', res1.status);
    console.log('[TEST] Res1 Body:', res1.body.substring(0, 500));

    if (res1.status === 200) {
      const json1 = JSON.parse(res1.body);
      console.log('[TEST] Issues Received:', (json1.issues || []).length);
      console.log('[TEST] nextPageToken:', json1.nextPageToken || json1.nextPage || 'NONE');
    }
  } catch (e) {
    console.error('[TEST] Res1 Failed:', e.message);
  }
}

function makeReq(path, method, body, authHeader) {
  const urlObj = new URL(`${config.jira.url}${path}`);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timeout (5s)'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

testJiraSearch();
