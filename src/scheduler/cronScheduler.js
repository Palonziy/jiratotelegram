const config = require('../config');

class CronScheduler {
  constructor(telegramBot) {
    this.telegramBot = telegramBot;
    this.timer = null;
  }

  start() {
    const targetHour = config.schedule.hour;
    const targetMinute = config.schedule.minute;

    console.log(`[SCHEDULER] Daily report scheduled for ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} (${config.schedule.timezone}).`);

    // Check interval every 60 seconds
    let lastDailyExecutedDate = '';
    let lastWeeklyExecutedDate = '';

    this.timer = setInterval(async () => {
      const now = new Date();
      const tz = config.schedule.timezone || 'Asia/Tashkent';

      // Format date/time components in specified timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false
      });

      const parts = {};
      formatter.formatToParts(now).forEach(p => { parts[p.type] = p.value; });

      const currentHour = parseInt(parts.hour === '24' ? '0' : parts.hour, 10);
      const currentMinute = parseInt(parts.minute, 10);
      const weekday = parts.weekday; // 'Mon', 'Tue', etc.
      const currentDateStr = `${parts.year}-${parts.month}-${parts.day}`;

      // Daily broadcast at targetHour:targetMinute
      if (currentHour === targetHour && currentMinute === targetMinute && lastDailyExecutedDate !== currentDateStr) {
        lastDailyExecutedDate = currentDateStr;
        console.log(`[SCHEDULER] Scheduled daily report time reached (${currentHour}:${String(currentMinute).padStart(2, '0')} ${tz}). Broadcasting report...`);
        try {
          if (this.telegramBot) {
            await this.telegramBot.broadcastDailyReport();
          }
        } catch (err) {
          console.error('[SCHEDULER] Error executing scheduled daily report broadcast:', err);
        }
      }

      // Monday Weekly broadcast at 09:00 AM
      if (weekday === 'Mon' && currentHour === 9 && currentMinute === 0 && lastWeeklyExecutedDate !== currentDateStr) {
        lastWeeklyExecutedDate = currentDateStr;
        console.log(`[SCHEDULER] Scheduled Monday weekly report time reached (09:00 ${tz}). Broadcasting weekly report...`);
        try {
          if (this.telegramBot) {
            await this.telegramBot.broadcastWeeklyReport();
          }
        } catch (err) {
          console.error('[SCHEDULER] Error executing scheduled weekly report broadcast:', err);
        }
      }
    }, 60000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = CronScheduler;
