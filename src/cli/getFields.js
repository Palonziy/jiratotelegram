const config = require('../config');
const JiraClient = require('../src/jira/jiraClient');

async function getFields() {
  const client = new JiraClient();
  const fields = await client._request('/rest/api/3/field');

  const severityField = fields.find(f => f.name && f.name.toLowerCase() === 'severity');
  if (severityField) {
    console.log(`[FIELDS] FOUND SEVERITY FIELD: id="${severityField.id}", name="${severityField.name}"`);
  } else {
    console.log('[FIELDS] Severity field name search:');
    fields.filter(f => f.name && (f.name.toLowerCase().includes('sev') || f.custom)).slice(0, 10).forEach(f => {
      console.log(`id="${f.id}", name="${f.name}"`);
    });
  }
}

getFields().catch(e => console.error(e.message));
