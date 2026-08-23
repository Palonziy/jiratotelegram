const config = require('../config');
const analyticsEngine = require('../analytics/analyticsEngine');
const reportFormatter = require('./reportFormatter');
const SyncEngine = require('../jira/syncEngine');

class TelegramBotService {
  constructor(botToken = config.telegram.botToken) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.isPolling = false;
    this.lastOffset = 0;
    this.syncEngine = new SyncEngine();
  }

  async sendMessage(chatId, text, parseMode = 'HTML') {
    if (!this.botToken) {
      console.warn('[TELEGRAM] Bot token missing, skipping sendMessage');
      return null;
    }

    try {
      const res = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: parseMode,
          disable_web_page_preview: true
        })
      });

      const data = await res.json();
      if (!data.ok) {
        console.error('[TELEGRAM] sendMessage error response:', data);
      }
      return data;
    } catch (err) {
      console.error('[TELEGRAM] sendMessage failed:', err.message);
      return null;
    }
  }

  async broadcastDailyReport(chatId = config.telegram.chatId) {
    if (!chatId) {
      console.warn('[TELEGRAM] No TELEGRAM_CHAT_ID set for scheduled daily report broadcast');
      return;
    }

    try {
      console.log('[TELEGRAM] Triggering sync before daily report broadcast...');
      await this.syncEngine.runSync();
      const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
      const reportHtml = reportFormatter.formatTodayReport(analytics, true);
      await this.sendMessage(chatId, reportHtml);
      console.log(`[TELEGRAM] Daily report successfully broadcasted to ${chatId}`);
    } catch (err) {
      console.error('[TELEGRAM] Daily report broadcast failed:', err.message);
    }
  }

  async broadcastWeeklyReport(chatId = config.telegram.chatId) {
    if (!chatId) {
      console.warn('[TELEGRAM] No TELEGRAM_CHAT_ID set for scheduled weekly report broadcast');
      return;
    }

    try {
      console.log('[TELEGRAM] Triggering sync before weekly report broadcast...');
      await this.syncEngine.runSync();
      const weeklyAnalytics = await analyticsEngine.getWeeklyAnalytics(new Date());
      const reportHtml = reportFormatter.formatWeeklyReport(weeklyAnalytics);
      await this.sendMessage(chatId, reportHtml);
      console.log(`[TELEGRAM] Weekly report successfully broadcasted to ${chatId}`);
    } catch (err) {
      console.error('[TELEGRAM] Weekly report broadcast failed:', err.message);
    }
  }

  async startPolling() {
    if (!this.botToken) {
      console.warn('[TELEGRAM] TELEGRAM_BOT_TOKEN is not configured. Telegram bot disabled.');
      return;
    }

    this.isPolling = true;
    console.log('[TELEGRAM] Telegram Bot polling started...');

    while (this.isPolling) {
      try {
        const url = `${this.apiUrl}/getUpdates?offset=${this.lastOffset + 1}&timeout=30`;
        const res = await fetch(url);
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastOffset = update.update_id;
            await this.handleUpdate(update);
          }
        }
      } catch (err) {
        console.error('[TELEGRAM] Polling error:', err.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  stopPolling() {
    this.isPolling = false;
  }

  async handleUpdate(update) {
    if (!update.message || !update.message.text) return;

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text.trim();

    console.log(`[TELEGRAM] Received command '${text}' from chat ${chatId}`);

    const command = text.split(' ')[0].toLowerCase().replace(/@.+$/, '');

    try {
      switch (command) {
        case '/start':
          await this.sendMessage(chatId,
            `👋 <b>Welcome to Rentmi Jira QA Analytics Bot!</b>\n\n` +
            `Use /today to view today's QA daily report or /help to see all commands.`
          );
          break;

        case '/today': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          const report = reportFormatter.formatTodayReport(analytics, true);
          await this.sendMessage(chatId, report);
          break;
        }

        case '/yesterday': {
          const yesterday = new Date(Date.now() - 86400000);
          const analytics = await analyticsEngine.getAnalyticsForDate(yesterday, true);
          const report = reportFormatter.formatTodayReport(analytics, false);
          await this.sendMessage(chatId, report);
          break;
        }

        case '/week':
        case '/weekly': {
          const weeklyAnalytics = await analyticsEngine.getWeeklyAnalytics(new Date());
          const report = reportFormatter.formatWeeklyReport(weeklyAnalytics);
          await this.sendMessage(chatId, report);
          break;
        }

        case '/status': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatStatusReport(analytics));
          break;
        }

        case '/priority': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatPriorityReport(analytics));
          break;
        }

        case '/platform': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatPlatformReport(analytics));
          break;
        }

        case '/testing': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatTestingReport(analytics));
          break;
        }

        case '/aging': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatAgingReport(analytics));
          break;
        }

        case '/assignees': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatAssigneeReport(analytics));
          break;
        }

        case '/trend': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), true);
          await this.sendMessage(chatId, reportFormatter.formatTrendReport(analytics));
          break;
        }

        case '/sync': {
          await this.sendMessage(chatId, '🔄 Starting Jira sync, please wait...');
          const result = await this.syncEngine.runSync();
          await this.sendMessage(chatId, `✅ Sync complete! Synced ${result.issuesSynced} issue(s).`);
          break;
        }

        case '/help':
          await this.sendMessage(chatId, reportFormatter.formatHelpReport());
          break;

        default:
          if (text.startsWith('/')) {
            await this.sendMessage(chatId, `⚠️ Unknown command. Type /help to view available commands.`);
          }
          break;
      }
    } catch (err) {
      console.error(`[TELEGRAM] Command handling error for ${command}:`, err);
      await this.sendMessage(chatId, `❌ Error processing command: ${err.message}`);
    }
  }
}

module.exports = TelegramBotService;
