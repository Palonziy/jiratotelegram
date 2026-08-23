const config = require('../config');
const https = require('https');

async function testExpandPayload() {
  const authHeader = 'Basic ' + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  const jql = `project = ${config.jira.project} AND type = Bug`;

  // Test 1: expand in URL query parameter
  console.log('\n--- Test 1: ?expand=changelog on URL ---');
  try {
    const res1 = await sendPost('/rest/api/3/search/jql?expand=changelog', { jql, maxResults: 5, fields: ['*all'] }, authHeader);
    console.log(`Status: ${res1.status}`);
    if (res1.status === 200) {
      const data = JSON.parse(res1.body);
      const issue1 = (data.issues || [])[0];
      console.log(`Issue ${issue1 ? issue1.key : 'none'} has changelog?`, !!(issue1 && issue1.changelog));
    } else {
      console.log(`Body: ${res1.body.substring(0, 300)}`);
    }
  } catch (e) {
    console.error(e.message);
  }

  // Test 2: expand in body
  console.log('\n--- Test 2: expand in JSON Body ---');
  try {
    const res2 = await sendPost('/rest/api/3/search/jql', { jql, maxResults: 5, fields: ['*all'], expand: ['changelog'] }, authHeader);
    console.log(`Status: ${res2.status}`);
    console.log(`Body: ${res2.body.substring(0, 300)}`);
  } catch (e) {
    console.error(e.message);
  }
}

function sendPost(path, body, authHeader) {
  const urlObj = new URL(`${config.jira.url}${path}`);
  const postData = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      family: 4
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Timeout')));
    req.write(postData);
    req.end();
  });
}

testExpandPayload();
