const db = require('../db/database');
const JiraClient = require('./jiraClient');
const analyticsEngine = require('../analytics/analyticsEngine');

class SyncEngine {
  constructor(jiraClient = new JiraClient()) {
    this.jiraClient = jiraClient;
  }

  async runSync() {
    const startedAt = new Date().toISOString();
    console.log(`[SYNC ENGINE] Starting Jira sync at ${startedAt}...`);

    try {
      await db.init();

      // Fetch all bugs with changelogs using nextPageToken pagination
      const bugs = await this.jiraClient.fetchAllBugs();

      console.log('\n[SYNC ENGINE] Processing issues & changelogs...');
      let historyCount = 0;
      for (const bug of bugs) {
        await db.saveIssue(bug);
        if (bug.history && bug.history.length > 0) {
          await db.saveStatusHistory(bug.history);
          historyCount += bug.history.length;
        }
      }

      console.log(`[SYNC ENGINE] Persisted ${bugs.length} issues and ${historyCount} history transitions to DB.`);
      console.log('[SYNC ENGINE] Calculating analytics & saving snapshot...');

      // Compute and record snapshot for today
      const todayAnalytics = await analyticsEngine.getAnalyticsForDate(new Date());
      const snapshot = {
        date: todayAnalytics.date,
        createdToday: todayAnalytics.dailyActivity.createdToday,
        doneToday: todayAnalytics.dailyActivity.movedToDone,
        movedTestingToday: todayAnalytics.dailyActivity.movedToTesting,
        returnedToday: todayAnalytics.dailyActivity.returnedToBug,
        reopenedToday: todayAnalytics.dailyActivity.reopened,
        activeBacklog: todayAnalytics.currentSnapshot.activeBacklog,
        bugCount: todayAnalytics.currentSnapshot.statusDistribution.bug,
        testingCount: todayAnalytics.currentSnapshot.statusDistribution.testing,
        inProgressCount: todayAnalytics.currentSnapshot.statusDistribution.inProgress,
        todoCount: todayAnalytics.currentSnapshot.statusDistribution.todo,
        reportBugunCount: todayAnalytics.currentSnapshot.statusDistribution.reportBugun,
        doneCount: todayAnalytics.currentSnapshot.statusDistribution.done
      };

      await db.saveDailySnapshot(snapshot);

      const finishedAt = new Date().toISOString();
      await db.logSyncRun(startedAt, finishedAt, 'SUCCESS', bugs.length);

      console.log(`\n[SYNC ENGINE] Sync completed successfully at ${finishedAt}.`);
      return {
        success: true,
        issuesSynced: bugs.length,
        historySynced: historyCount,
        startedAt,
        finishedAt
      };
    } catch (err) {
      const finishedAt = new Date().toISOString();
      console.error(`[SYNC ENGINE] Sync failed: ${err.message}`);
      await db.logSyncRun(startedAt, finishedAt, 'FAILED', 0, err.message);
      throw err;
    }
  }
}

module.exports = SyncEngine;
