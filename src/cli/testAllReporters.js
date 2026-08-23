const config = require('../config');
const JiraClient = require('../jira/jiraClient');

async function testAllReporters() {
  const client = new JiraClient();
  await client.checkAuth();

  // Test 1: Query WITH reporter filter
  const jqlWithReporter = `project = ${config.jira.project} AND type = Bug AND reporter = "${config.jira.reporterId}"`;
  console.log(`\n--- Test 1: WITH reporter filter ---`);
  console.log(`JQL: ${jqlWithReporter}`);
  const issuesWith = await client._request('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({ jql: jqlWithReporter, maxResults: 1, fields: ['key'] })
  });
  console.log(`Total bugs reported by ${config.jira.reporterId}:`, issuesWith.total || 'unknown');

  // Test 2: Query WITHOUT reporter filter (ALL bugs in WIP project)
  const jqlAllBugs = `project = ${config.jira.project} AND type = Bug`;
  console.log(`\n--- Test 2: WITHOUT reporter filter (All bugs in project WIP) ---`);
  console.log(`JQL: ${jqlAllBugs}`);
  const issuesAll = await client._request('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({ jql: jqlAllBugs, maxResults: 1, fields: ['key'] })
  });
  console.log(`Total bugs in WIP project (ALL reporters):`, issuesAll.total || 'unknown');

  // Test 3: Query ALL issue types in WIP project
  const jqlAllTypes = `project = ${config.jira.project}`;
  console.log(`\n--- Test 3: ALL issue types in project WIP ---`);
  console.log(`JQL: ${jqlAllTypes}`);
  const issuesAllTypes = await client._request('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({ jql: jqlAllTypes, maxResults: 1, fields: ['key'] })
  });
  console.log(`Total issues in WIP project (ALL types):`, issuesAllTypes.total || 'unknown');
}

testAllReporters().catch(e => console.error('Error:', e.message));
