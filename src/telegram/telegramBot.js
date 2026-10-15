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

  /**
   * Validates whether a Telegram message is from an authorized team member (@palonziy)
   */
  isAuthorized(message) {
    if (!message) return false;
    const from = message.from;
    if (!from) return false;

    const username = (from.username || '').toLowerCase().replace(/^@/, '').trim();
    const userId = String(from.id || '').trim();
    const chatId = String(message.chat ? message.chat.id : '').trim();

    const allowed = (config.telegram.allowedUsers || ['palonziy'])
      .map(u => String(u).toLowerCase().replace(/^@/, '').trim())
      .filter(Boolean);

    // 1. Match Telegram username (e.g. palonziy)
    if (username && allowed.includes(username)) {
      return true;
    }

    // 2. Match Telegram User ID
    if (userId && allowed.includes(userId)) {
      return true;
    }

    // 3. Match Telegram Chat ID
    if (chatId && allowed.includes(chatId)) {
      return true;
    }

    // 4. Match configured broadcast TELEGRAM_CHAT_ID if explicitly set
    if (config.telegram.chatId && (userId === String(config.telegram.chatId) || chatId === String(config.telegram.chatId))) {
      return true;
    }

    return false;
  }

  async handleUpdate(update) {
    const message = update.message || update.edited_message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const from = message.from || {};
    const sender = from.username ? `@${from.username}` : `ID:${from.id || chatId}`;

    console.log(`[TELEGRAM] Received command '${text}' from ${sender} (chat ${chatId})`);

    // Strict Access Control: Only @palonziy / authorized team members allowed
    if (!this.isAuthorized(message)) {
      console.warn(`[TELEGRAM] ⛔ Unauthorized access blocked from ${sender} (chat ${chatId}): '${text}'`);
      await this.sendMessage(chatId,
        `⛔ <b>Kirish taqiqlangan!</b>\n\n` +
        `Kechirasiz, siz Rentmi jamoasidan emassiz.\n` +
        `Ushbu bot faqat Rentmi QA va muhandislik jamoasining vakolatli a'zolari (@palonziy) uchun mo'ljallangan.\n\n` +
        `<i>Agar siz jamoa a'zosi bo'lsangiz, administrator (@palonziy) bilan bog'laning.</i>`
      );
      return;
    }

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
          const report = reportFormatter.formatTodayReport(analytics);
          await this.sendMessage(chatId, report);
          break;
        }

        case '/todayall':
        case '/alltoday': {
          const analytics = await analyticsEngine.getAnalyticsForDate(new Date(), false, true);
          const report = reportFormatter.formatTodayReport(analytics, { hideTodo: true });
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
