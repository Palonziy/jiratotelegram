const SyncEngine = require('../jira/syncEngine');

async function main() {
  console.log('=== Rentmi Jira QA Analytics Sync CLI ===');
  const engine = new SyncEngine();
  try {
    const res = await engine.runSync();
    console.log('Sync Result:', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Sync CLI Error:', err.message);
    process.exit(1);
  }
}

main();
