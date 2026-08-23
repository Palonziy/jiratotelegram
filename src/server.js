const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const analyticsEngine = require('./analytics/analyticsEngine');
const SyncEngine = require('./jira/syncEngine');
const TelegramBotService = require('./telegram/telegramBot');
const CronScheduler = require('./scheduler/cronScheduler');

const port = config.server.port;
const syncEngine = new SyncEngine();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API Routes
  if (req.method === 'GET' && pathname === '/api/analytics/today') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/weekly') {
    try {
      const data = await analyticsEngine.getWeeklyAnalytics(new Date());
      return sendJson(res, 200, { success: true, data });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/status') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.currentSnapshot.statusDistribution });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/priority') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.currentSnapshot.priorityDistribution });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/platform') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.currentSnapshot.platformDistribution });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/testing') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.testingQueue });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/aging') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.bugAging });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/assignees') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.assignees });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/analytics/trend') {
    try {
      const data = await analyticsEngine.getAnalyticsForDate(new Date());
      return sendJson(res, 200, { success: true, data: data.trend });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/sync') {
    try {
      const result = await syncEngine.runSync();
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // Serve static files from public directory
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, '..', 'public', safePath);

  serveStatic(res, filePath);
});

// Initialize Telegram Bot & Cron Scheduler
const telegramBot = new TelegramBotService();
const cronScheduler = new CronScheduler(telegramBot);

if (require.main === module) {
  server.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Rentmi QA Analytics Server listening at http://localhost:${port}`);
    console.log(`=======================================================`);
    telegramBot.startPolling();
    cronScheduler.start();

    console.log('[SERVER] Triggering initial background sync from Jira Cloud...');
    syncEngine.runSync().catch(err => console.error('[SERVER] Initial sync error:', err.message));
  });
}

module.exports = server;
