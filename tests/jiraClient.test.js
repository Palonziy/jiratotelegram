const assert = require('assert');
const test = require('node:test');
const JiraClient = require('../src/jira/jiraClient');

test('JiraClient Bounded JQL Construction', () => {
  const client = new JiraClient({
    project: 'WIP',
    reporterId: '712020:test-reporter'
  });

  const jql = client.getBoundedJql();
  assert.strictEqual(jql.includes('project = WIP'), true);
  assert.strictEqual(jql.includes('type = Bug'), true);
  assert.strictEqual(jql.includes('ORDER BY created DESC'), true);
});

test('JiraClient Platform Classification', () => {
  const client = new JiraClient();

  assert.strictEqual(client.classifyPlatform({ components: [{ name: 'Frontend' }] }), 'Frontend');
  assert.strictEqual(client.classifyPlatform({ labels: ['api-backend'] }), 'Backend');
  assert.strictEqual(client.classifyPlatform({ summary: '[iOS] Fix login crash' }), 'Mobile');
  assert.strictEqual(client.classifyPlatform({ summary: 'General cleanup' }), 'Other');
});

test('JiraClient Raw Issue Parsing', () => {
  const client = new JiraClient();
  const rawIssue = {
    id: '10001',
    key: 'WIP-101',
    fields: {
      summary: 'Test bug summary',
      status: { name: 'Testing', id: '3' },
      priority: { name: 'High' },
      assignee: { displayName: 'Lazizbek' },
      reporter: { displayName: 'QA Lead' },
      created: '2026-08-18T10:00:00.000Z',
      components: [{ name: 'Frontend' }],
      labels: ['qa-bugs']
    },
    changelog: {
      histories: [
        {
          id: '501',
          author: { displayName: 'Lazizbek' },
          created: '2026-08-18T11:00:00.000Z',
          items: [{ field: 'status', fromString: 'Bug', toString: 'Testing' }]
        }
      ]
    }
  };

  const parsed = client.parseIssue(rawIssue);
  assert.strictEqual(parsed.key, 'WIP-101');
  assert.strictEqual(parsed.status, 'Testing');
  assert.strictEqual(parsed.priority, 'High');
  assert.strictEqual(parsed.platform, 'Frontend');
  assert.strictEqual(parsed.history.length, 1);
  assert.strictEqual(parsed.history[0].fromStatus, 'Bug');
  assert.strictEqual(parsed.history[0].toStatus, 'Testing');
});

test('JiraClient Token-Based Pagination and Duplicate Detection', async () => {
  class MockTokenJiraClient extends JiraClient {
    async checkAuth() { return { displayName: 'Mock User' }; }

    async _request(endpoint, options) {
      const body = JSON.parse(options.body);
      if (!body.nextPageToken) {
        return {
          issues: [{ key: 'WIP-1' }, { key: 'WIP-2' }],
          nextPageToken: 'token_page_2'
        };
      } else if (body.nextPageToken === 'token_page_2') {
        return {
          issues: [{ key: 'WIP-2' }, { key: 'WIP-3' }], // WIP-2 is duplicate across pages
          nextPageToken: null
        };
      }
    }
  }

  const client = new MockTokenJiraClient();
  const bugs = await client.fetchAllBugs();

  // WIP-1, WIP-2, WIP-3 unique => length 3
  assert.strictEqual(bugs.length, 3);
  assert.strictEqual(bugs[0].key, 'WIP-1');
  assert.strictEqual(bugs[1].key, 'WIP-2');
  assert.strictEqual(bugs[2].key, 'WIP-3');
});
