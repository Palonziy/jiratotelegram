class AISummaryService {
  /**
   * Generates a deterministic, data-backed summary from analytics metrics
   */
  generateSummary(analytics) {
    const { currentSnapshot, dailyActivity, testingQueue, trend, bugAging } = analytics;

    const bullets = [];

    // Backlog trend statement
    if (trend.backlogChange < 0) {
      bullets.push(`Backlog decreased from ${trend.yesterdayBacklog} to ${trend.todayBacklog} issues.`);
    } else if (trend.backlogChange > 0) {
      bullets.push(`Backlog increased from ${trend.yesterdayBacklog} to ${trend.todayBacklog} issues.`);
    } else {
      bullets.push(`Backlog remained steady at ${trend.todayBacklog} issues.`);
    }

    // Activity summary
    bullets.push(`${dailyActivity.movedToDone} bug(s) moved to Done while ${dailyActivity.createdToday} new bug(s) were reported today.`);

    // Bottleneck checks
    if (testingQueue.olderThan3d > 0) {
      bullets.push(`⚠️ Testing remains a bottleneck: ${testingQueue.olderThan3d} issue(s) waiting for >3 days.`);
    } else if (testingQueue.count > 0) {
      bullets.push(`🧪 Testing queue currently holds ${testingQueue.count} issue(s).`);
    }

    // High priority check
    const urgentHighCount = (currentSnapshot.priorityDistribution.Urgent || 0) + (currentSnapshot.priorityDistribution.High || 0);
    if (urgentHighCount > 0) {
      bullets.push(`🔴 ${urgentHighCount} Urgent/High priority bug(s) remain unresolved.`);
    }

    // Reopened warning
    if (dailyActivity.reopened > 0 || dailyActivity.returnedToBug > 0) {
      bullets.push(`🔄 ${dailyActivity.reopened + dailyActivity.returnedToBug} bug(s) were returned/reopened today.`);
    }

    // Aging check
    if (bugAging.averageBugAge > 5) {
      bullets.push(`⏳ Average bug age is elevated at ${bugAging.averageBugAge} days.`);
    }

    return `🤖 **AI QA SUMMARY**\n\n` + bullets.map(b => `• ${b}`).join('\n');
  }
}

module.exports = new AISummaryService();
