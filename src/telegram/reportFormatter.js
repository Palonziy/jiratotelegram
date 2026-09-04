const aiSummaryService = require('../analytics/aiSummary');
const config = require('../config');

class ReportFormatter {
  formatDateHeader(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  formatTodayReport(analytics, options = {}) {
    const hideTodo = typeof options === 'object' ? !!options.hideTodo : false;
    const dateFormatted = this.formatDateHeader(analytics.date);
    const act = analytics.dailyActivity;
    const stat = analytics.currentSnapshot.statusDistribution;
    const totalStatus = hideTodo
      ? (stat.bug + stat.testing + stat.inProgress + stat.reportBugun + stat.done)
      : (stat.bug + stat.testing + stat.inProgress + stat.todo + stat.reportBugun + stat.done);
    const sev = analytics.currentSnapshot.severityDistribution || {};
    const prio = analytics.currentSnapshot.priorityDistribution;
    const plat = analytics.currentSnapshot.platformDistribution;
    const tr = analytics.trend;
    const assignees = analytics.assignees || [];
    const oldest = (analytics.bugAging && analytics.bugAging.oldestOpenBugs) || [];

    const changeVal = tr.totalChange !== undefined ? tr.totalChange : tr.backlogChange;
    const changeEmoji = changeVal > 0 ? '📈' : changeVal < 0 ? '📉' : '➡️';
    const changeStr = changeVal > 0 ? `+${changeVal}` : `${changeVal}`;
    const yesterdayVal = tr.yesterdayTotal !== undefined ? tr.yesterdayTotal : tr.yesterdayBacklog;
    const todayVal = tr.todayTotal !== undefined ? tr.todayTotal : totalStatus;

    let assigneesText = '';
    if (assignees.length === 0) {
      assigneesText = '<i>No active assignees</i>\n';
    } else {
      assignees.forEach(a => {
        const totalB = a.totalBugs !== undefined ? a.totalBugs : (a.openBugs + (a.doneBugs || 0));
        assigneesText += `<b>${a.assignee}</b>\n• Open: ${a.openBugs} | Testing: ${a.testingBugs} | Done: ${a.doneBugs !== undefined ? a.doneBugs : 0} | Total: ${totalB}\n\n`;
      });
      assigneesText = assigneesText.trimEnd();
    }

    let oldestText = '';
    if (oldest.length === 0) {
      oldestText = '<i>No open bugs</i>';
    } else {
      oldest.forEach(b => {
        const shortSummary = b.summary ? (b.summary.length > 38 ? b.summary.substring(0, 38) + '...' : b.summary) : 'No summary';
        oldestText += `• <b>${b.key}</b> (${b.ageDays}d) — ${b.priority} | ${b.status}\n  <i>${shortSummary}</i>\n`;
      });
      oldestText = oldestText.trimEnd();
    }

    let statusText = `🐛 Bug: <b>${stat.bug}</b>\n` +
      `🧪 Testing: <b>${stat.testing}</b>\n` +
      `🔄 In Progress: <b>${stat.inProgress}</b>\n`;
    if (!hideTodo) {
      statusText += `📋 To Do: <b>${stat.todo}</b>\n`;
    }
    statusText += `🚫 Report(BUGUN): <b>${stat.reportBugun}</b>\n` +
      `✅ Done: <b>${stat.done}</b>\n\n`;

    let report = `📊 <b>${config.appName.toUpperCase()} DAILY REPORT</b>\n${dateFormatted}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🐞 <b>TODAY'S ACTIVITY</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🆕 Created: <b>${act.createdToday}</b>\n` +
      `🧪 → Testing: <b>${act.movedToTesting}</b>\n` +
      `✅ → Done: <b>${act.movedToDone}</b>\n` +
      `🔄 Returned: <b>${act.returnedToBug}</b>\n` +
      `♻️ Reopened: <b>${act.reopened}</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📌 <b>CURRENT STATUS</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      statusText +
      `📊 Total: <b>${totalStatus}</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💥 <b>SEVERITY</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🔥 Urgent: <b>${sev.Urgent || 0}</b>\n` +
      `🔴 High: <b>${sev.High || 0}</b>\n` +
      `🟡 Medium: <b>${sev.Medium || 0}</b>\n` +
      `🟢 Low: <b>${sev.Low || 0}</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔥 <b>PRIORITY</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🔥 Urgent: <b>${prio.Urgent || 0}</b>\n` +
      `🔴 High: <b>${prio.High || 0}</b>\n` +
      `🟡 Medium: <b>${prio.Medium || 0}</b>\n` +
      `🟢 Low: <b>${prio.Low || 0}</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👥 <b>ASSIGNEE WORKLOAD</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `${assigneesText}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💻 <b>PLATFORM</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🌐 Frontend: <b>${plat.Frontend || 0}</b>\n` +
      `⚙️ Backend: <b>${plat.Backend || 0}</b>\n` +
      `📱 Mobile: <b>${plat.Mobile || 0}</b>\n` +
      `❓ Other: <b>${plat.Other || 0}</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📈 <b>TREND</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `Yesterday: <b>${yesterdayVal}</b>\n` +
      `Today: <b>${todayVal}</b>\n` +
      `Change: <b>${changeStr}</b> ${changeEmoji}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⏳ <b>OLDEST OPEN BUGS</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `${oldestText}`;

    return report;
  }

  formatStatusReport(analytics) {
    const stat = analytics.currentSnapshot.statusDistribution;
    return `📌 <b>CURRENT STATUS BREAKDOWN</b>\n\n` +
      `🐛 Bug: <b>${stat.bug}</b>\n` +
      `🧪 Testing: <b>${stat.testing}</b>\n` +
      `🔄 In Progress: <b>${stat.inProgress}</b>\n` +
      `📋 To Do: <b>${stat.todo}</b>\n` +
      `🚫 Report(BUGUN): <b>${stat.reportBugun}</b>\n` +
      `✅ Done: <b>${stat.done}</b>\n\n` +
      `<b>Total Active Backlog:</b> ${analytics.currentSnapshot.activeBacklog}`;
  }

  formatPriorityReport(analytics) {
    const prio = analytics.currentSnapshot.priorityDistribution;
    return `🔥 <b>PRIORITY DISTRIBUTION</b>\n\n` +
      `🔥 Urgent: <b>${prio.Urgent || 0}</b>\n` +
      `🔴 High: <b>${prio.High || 0}</b>\n` +
      `🟡 Medium: <b>${prio.Medium || 0}</b>\n` +
      `🟢 Low: <b>${prio.Low || 0}</b>`;
  }

  formatPlatformReport(analytics) {
    const plat = analytics.currentSnapshot.platformDistribution;
    return `💻 <b>PLATFORM ANALYTICS</b>\n\n` +
      `🌐 Frontend: <b>${plat.Frontend || 0}</b>\n` +
      `⚙️ Backend: <b>${plat.Backend || 0}</b>\n` +
      `📱 Mobile: <b>${plat.Mobile || 0}</b>\n` +
      `❓ Other: <b>${plat.Other || 0}</b>`;
  }

  formatTestingReport(analytics) {
    const t = analytics.testingQueue;
    return `🧪 <b>TESTING QUEUE ANALYTICS</b>\n\n` +
      `Current Queue: <b>${t.count}</b>\n` +
      `• > 1 day: <b>${t.olderThan1d}</b>\n` +
      `• > 3 days: <b>${t.olderThan3d}</b>\n` +
      `• > 7 days: <b>${t.olderThan7d}</b>`;
  }

  formatAgingReport(analytics) {
    const age = analytics.bugAging;
    let text = `⏳ <b>BUG AGING ANALYTICS</b>\n\n` +
      `Average Age: <b>${age.averageBugAge} days</b>\n` +
      `Median Age: <b>${age.medianBugAge} days</b>\n\n` +
      `<b>Distribution:</b>\n` +
      `• 0–1 days: <b>${age.agingDistribution['0-1 days']}</b>\n` +
      `• 2–3 days: <b>${age.agingDistribution['2-3 days']}</b>\n` +
      `• 4–7 days: <b>${age.agingDistribution['4-7 days']}</b>\n` +
      `• 8–14 days: <b>${age.agingDistribution['8-14 days']}</b>\n` +
      `• 15+ days: <b>${age.agingDistribution['15+ days']}</b>\n\n` +
      `<b>Oldest Open Bugs:</b>\n`;

    if (age.oldestOpenBugs.length === 0) {
      text += `<i>No open bugs</i>`;
    } else {
      age.oldestOpenBugs.forEach(b => {
        text += `• <b>${b.key}</b> (${b.ageDays}d) — ${b.priority} | ${b.status}\n  <i>${b.summary.substring(0, 40)}</i>\n`;
      });
    }

    return text;
  }

  formatAssigneeReport(analytics) {
    let text = `👥 <b>ASSIGNEE WORKLOAD</b>\n\n`;
    if (analytics.assignees.length === 0) {
      text += `<i>No active assignees</i>`;
    } else {
      analytics.assignees.forEach(a => {
        text += `<b>${a.assignee}</b>\n` +
          `• Open: ${a.openBugs} | Testing: ${a.testingBugs} | Done today: ${a.doneToday}\n`;
      });
    }
    return text;
  }

  formatTrendReport(analytics) {
    const tr = analytics.trend;
    let text = `📈 <b>BACKLOG TREND</b>\n\n` +
      `Yesterday: <b>${tr.yesterdayBacklog}</b>\n` +
      `Today: <b>${tr.todayBacklog}</b>\n` +
      `Net Change: <b>${tr.backlogChange}</b>\n\n` +
      `<b>Recent History:</b>\n`;

    tr.history.forEach(h => {
      text += `• <code>${h.date}</code>: Backlog ${h.activeBacklog} (Created: +${h.created}, Done: -${h.done})\n`;
    });

    return text;
  }

  formatWeeklyReport(weekly) {
    const period = weekly.period;
    const act = weekly.weeklyActivity;
    const perf = weekly.performance;
    const dyn = weekly.backlogDynamics;
    const assignees = weekly.assignees || [];

    const netChangeEmoji = dyn.netBacklogDelta > 0 ? '📈' : dyn.netBacklogDelta < 0 ? '📉' : '➡️';
    const netChangeStr = dyn.netBacklogDelta > 0 ? `+${dyn.netBacklogDelta}` : `${dyn.netBacklogDelta}`;

    let assigneesText = '';
    if (assignees.length === 0) {
      assigneesText = '<i>No active assignees</i>\n';
    } else {
      assignees.forEach(a => {
        assigneesText += `<b>${a.assignee}</b>\n` +
          `• Done: <b>${a.doneWeekly}</b> | Testing: ${a.testingWeekly} | Open: ${a.openWeekly} | Returned: ${a.returnedWeekly}\n\n`;
      });
      assigneesText = assigneesText.trimEnd();
    }

    return `📊 <b>${config.appName.toUpperCase()} WEEKLY REPORT</b>\n` +
      `📅 <code>${period.startDate}</code> (Mon) — <code>${period.endDate}</code> (${period.daysElapsed} days)\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🐞 <b>WEEKLY ACTIVITY</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🆕 Created: <b>${act.createdWeekly}</b>\n` +
      `🧪 → Testing: <b>${act.movedToTestingWeekly}</b>\n` +
      `✅ → Done: <b>${act.movedToDoneWeekly}</b>\n` +
      `🔄 Returned: <b>${act.returnedToBugWeekly}</b>\n` +
      `♻️ Reopened: <b>${act.reopenedWeekly}</b>\n` +
      `🎯 QA Pass Rate: <b>${act.qaPassRate}%</b> ⭐️\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⏱️ <b>VELOCITY & PERFORMANCE</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `⏱ Avg Resolution Time: <b>${perf.avgResolutionDays > 0 ? perf.avgResolutionDays + ' days' : perf.avgResolutionHours + ' hours'}</b>\n` +
      `🏆 Top QA Closer: <b>${perf.topCloser}</b> (${perf.topCloserDoneCount} closed)\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👥 <b>WEEKLY ASSIGNEE WORKLOAD</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `${assigneesText}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📈 <b>WEEKLY BACKLOG DYNAMICS</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `Start of Week (Mon): <b>${dyn.startOfWeekTotal}</b>\n` +
      `Current Total: <b>${dyn.currentTotal}</b>\n` +
      `Net Delta: <b>${netChangeStr}</b> ${netChangeEmoji}`;
  }

  formatHelpReport() {
    return `🤖 <b>RENTMI QA ANALYTICS BOT COMMANDS</b>\n\n` +
      `/today — Today's QA daily report (Reporter Filtered)\n` +
      `/todayall — Today's QA daily report for ALL team members\n` +
      `/yesterday — Yesterday's QA report\n` +
      `/week — Cumulative Weekly QA report (Monday -> Today)\n` +
      `/status — Current status breakdown\n` +
      `/priority — Priority distribution\n` +
      `/platform — Platform analytics\n` +
      `/testing — Testing queue analytics\n` +
      `/aging — Bug aging analytics\n` +
      `/assignees — Assignee workload\n` +
      `/trend — Backlog trend & 7-day history\n` +
      `/sync — Manually trigger Jira sync\n` +
      `/help — View this help menu`;
  }
}

module.exports = new ReportFormatter();
