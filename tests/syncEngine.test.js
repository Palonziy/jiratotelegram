const assert = require('assert');
const test = require('node:test');
const SyncEngine = require('../src/jira/syncEngine');

class MockJiraClient {
  async fetchAllBugs() {
    return [
      {
        key: 'WIP-10',
        id: '10',
        summary: 'Mock sync bug 1',
        status: 'Bug',
        priority: 'Urgent',
        assignee: 'Tester',
        platform: 'Mobile',
        created: new Date().toISOString(),
        history: [
          {
            id: 'h10',
            issueKey: 'WIP-10',
            fromStatus: 'To Do',
            toStatus: 'Bug',
            transitionedAt: new Date().toISOString(),
            author: 'Tester'
          }
        ]
      }
    ];
  }
}

test('SyncEngine - Run Sync Execution', async () => {
  const mockClient = new MockJiraClient();
  const syncEngine = new SyncEngine(mockClient);

  const result = await syncEngine.runSync();
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.issuesSynced, 1);
  assert.strictEqual(result.historySynced, 1);
});
