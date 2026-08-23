const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnv();

module.exports = {
  appName: process.env.APP_NAME || 'Jira QA Analytics',
  jira: {
    url: (process.env.JIRA_URL || 'https://your-domain.atlassian.net').replace(/\/$/, ''),
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    project: process.env.JIRA_PROJECT || 'YOUR_PROJECT',
    reporterId: process.env.JIRA_REPORTER_ID || '',
    platformField: process.env.JIRA_PLATFORM_FIELD || 'components'
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  schedule: {
    hour: parseInt(process.env.DAILY_REPORT_HOUR || '19', 10),
    minute: parseInt(process.env.DAILY_REPORT_MINUTE || '00', 10),
    timezone: process.env.TIMEZONE || 'Asia/Tashkent'
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10)
  },
  dbPath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'jira_qa.sqlite')
};
