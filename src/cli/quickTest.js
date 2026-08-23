const config = require('../config');
const https = require('https');

async function quickTest() {
  const authHeader = 'Basic ' + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  const jql = `project = ${config.jira.project} AND type = Bug`;

  console.log('[QUICK TEST] Target URL:', `${config.jira.url}/rest/api/3/search/jql`);
  console.log('[QUICK TEST] JQL:', jql);

  const payload = {
    jql: jql,
    maxResults: 5
  };

  const urlObj = new URL(`${config.jira.url}/rest/api/3/search/jql`);
  const postData = JSON.stringify(payload);

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
    res.on('end', () => {
      console.log(`[QUICK TEST] Status: ${res.statusCode}`);
      console.log(`[QUICK TEST] Body: ${data.substring(0, 400)}`);
    });
  });

  req.on('error', e => console.error('[QUICK TEST] Req Error:', e.message));
  req.setTimeout(5000, () => {
    console.error('[QUICK TEST] Timeout 5s reached!');
    req.destroy();
  });

  req.write(postData);
  req.end();
}

quickTest();
