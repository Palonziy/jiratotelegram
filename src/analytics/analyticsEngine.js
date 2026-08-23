const db = require('../db/database');

class AnalyticsEngine {
  /**
   * Helper to format a Date object into YYYY-MM-DD string in local/specified timezone
   */
  formatDateStr(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' });
    return formatter.format(d);
  }

  /**
   * Calculates metrics for a specific date (default: today)
   */
  async getAnalyticsForDate(targetDate = new Date(), filterByReporter = false) {
    await db.init();
    const config = require('../config');

    const dateStr = typeof targetDate === 'string' ? targetDate : this.formatDateStr(targetDate);

    let issues = await db.getAllIssues();
    if (issues.length === 0) {
      console.log('[ANALYTICS] Database is empty. Triggering automatic initial Jira sync...');
      const SyncEngine = require('../jira/syncEngine');
      const syncEngine = new SyncEngine();
      try {
        await syncEngine.runSync();
        issues = await db.getAllIssues();
      } catch (err) {
        console.error('[ANALYTICS] Initial auto-sync error:', err.message);
      }
    }

    if (filterByReporter && config.jira.reporterId) {
      issues = issues.filter(i => {
        if (i.reporterId) return i.reporterId === config.jira.reporterId;
        if (i.rawData && i.rawData.fields && i.rawData.fields.reporter) {
          return i.rawData.fields.reporter.accountId === config.jira.reporterId;
        }
        return true;
      });
    }

    const history = await db.getAllHistory();
    const snapshots = await db.getDailySnapshots();

    // 1. Current Snapshot (Active Right Now)
    const statusDistribution = {
      bug: 0,
      testing: 0,
      inProgress: 0,
      todo: 0,
      reportBugun: 0,
      done: 0
    };

    const priorityDistribution = {
      Urgent: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Unclassified: 0
    };

    const severityDistribution = {
      Urgent: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };

    const platformDistribution = {
      Frontend: 0,
      Backend: 0,
      Mobile: 0,
      Other: 0
    };

    const assigneeWorkload = {};
    const activeBugs = [];
    const testingQueueBugs = [];

    issues.forEach(issue => {
      const statusLower = (issue.status || '').toLowerCase().trim();
      const isDone = statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved');

      if (isDone) {
        statusDistribution.done++;
      } else {
        activeBugs.push(issue);

        if (statusLower.includes('testing')) {
          statusDistribution.testing++;
          testingQueueBugs.push(issue);
        } else if (statusLower.includes('in progress')) {
          statusDistribution.inProgress++;
        } else if (statusLower.includes('to do') || statusLower.includes('todo')) {
          statusDistribution.todo++;
        } else if (statusLower.includes('report') || statusLower.includes('bugun')) {
          statusDistribution.reportBugun++;
        } else {
          statusDistribution.bug++;
        }
      }

      // Priority breakdown across all bugs
      const prio = issue.priority || 'Medium';
      if (priorityDistribution[prio] !== undefined) {
        priorityDistribution[prio]++;
      } else {
        priorityDistribution.Unclassified++;
      }

      // Severity breakdown across all bugs
      const sev = issue.severity || issue.priority || 'Medium';
      if (severityDistribution[sev] !== undefined) {
        severityDistribution[sev]++;
      } else if (sev === 'Blocker' || sev === 'Critical') {
        severityDistribution.Urgent = (severityDistribution.Urgent || 0) + 1;
      } else if (sev === 'Major') {
        severityDistribution.High = (severityDistribution.High || 0) + 1;
      } else if (sev === 'Minor') {
        severityDistribution.Medium = (severityDistribution.Medium || 0) + 1;
      } else if (sev === 'Trivial') {
        severityDistribution.Low = (severityDistribution.Low || 0) + 1;
      } else {
        severityDistribution[sev] = (severityDistribution[sev] || 0) + 1;
      }

      // Platform breakdown across all bugs
      const plat = issue.platform || 'Other';
      if (platformDistribution[plat] !== undefined) {
        platformDistribution[plat]++;
      } else {
        platformDistribution.Other++;
      }

      // Assignee workload across all bugs
      const assignee = issue.assignee || 'Unassigned';
      if (!assigneeWorkload[assignee]) {
        assigneeWorkload[assignee] = {
          assignee,
          openBugs: 0,
          testingBugs: 0,
          doneBugs: 0,
          totalBugs: 0,
          doneToday: 0,
          createdToday: 0,
          returnedReopened: 0
        };
      }

      assigneeWorkload[assignee].totalBugs++;
      if (isDone) {
        assigneeWorkload[assignee].doneBugs++;
      } else {
        assigneeWorkload[assignee].openBugs++;
        if (statusLower.includes('testing')) {
          assigneeWorkload[assignee].testingBugs++;
        }
      }
    });

    const activeBacklog = activeBugs.length;

    // 2. Daily Activity for dateStr
    let createdToday = 0;
    let movedToTesting = 0;
    let movedToDone = 0;
    let movedToBug = 0;
    let returnedToBug = 0;
    let reopened = 0;

    issues.forEach(issue => {
      if (issue.created && this.formatDateStr(issue.created) === dateStr) {
        createdToday++;
        const assignee = issue.assignee || 'Unassigned';
        if (assigneeWorkload[assignee]) {
          assigneeWorkload[assignee].createdToday++;
        }
      }
    });

    history.forEach(h => {
      const transDateStr = this.formatDateStr(h.transitionedAt);
      if (transDateStr === dateStr) {
        const fromLow = (h.fromStatus || '').toLowerCase();
        const toLow = (h.toStatus || '').toLowerCase();

        if (toLow.includes('testing')) {
          movedToTesting++;
        }
        if (toLow.includes('done') || toLow.includes('closed')) {
          movedToDone++;
          // Find issue assignee
          const targetIssue = issues.find(i => i.key === h.issueKey);
          if (targetIssue) {
            const ass = targetIssue.assignee || 'Unassigned';
            if (assigneeWorkload[ass]) assigneeWorkload[ass].doneToday++;
          }
        }
        if (toLow.includes('bug')) {
          movedToBug++;
        }

        // Reopened / Returned detection
        // Returned: Testing -> Bug
        if (fromLow.includes('testing') && toLow.includes('bug')) {
          returnedToBug++;
          const targetIssue = issues.find(i => i.key === h.issueKey);
          if (targetIssue) {
            const ass = targetIssue.assignee || 'Unassigned';
            if (assigneeWorkload[ass]) assigneeWorkload[ass].returnedReopened++;
          }
        }

        // Reopened: Done -> Bug / Done -> In Progress / Done -> Testing
        if (fromLow.includes('done') && (toLow.includes('bug') || toLow.includes('in progress') || toLow.includes('testing'))) {
          reopened++;
          const targetIssue = issues.find(i => i.key === h.issueKey);
          if (targetIssue) {
            const ass = targetIssue.assignee || 'Unassigned';
            if (assigneeWorkload[ass]) assigneeWorkload[ass].returnedReopened++;
          }
        }
      }
    });

    // 3. Bug Aging Calculation (for active bugs)
    const now = new Date();
    const agingDistribution = {
      '0-1 days': 0,
      '2-3 days': 0,
      '4-7 days': 0,
      '8-14 days': 0,
      '15+ days': 0
    };

    let totalAgeDays = 0;
    const bugAgeList = activeBugs.map(issue => {
      const createdDate = issue.created ? new Date(issue.created) : now;
      const ageMs = Math.max(0, now - createdDate);
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      totalAgeDays += ageDays;

      if (ageDays <= 1) agingDistribution['0-1 days']++;
      else if (ageDays <= 3) agingDistribution['2-3 days']++;
      else if (ageDays <= 7) agingDistribution['4-7 days']++;
      else if (ageDays <= 14) agingDistribution['8-14 days']++;
      else agingDistribution['15+ days']++;

      return {
        key: issue.key,
        summary: issue.summary,
        priority: issue.priority,
        status: issue.status,
        assignee: issue.assignee,
        ageDays: ageDays
      };
    });

    bugAgeList.sort((a, b) => b.ageDays - a.ageDays);

    const averageBugAge = activeBugs.length > 0 ? (totalAgeDays / activeBugs.length).toFixed(1) : 0;
    let medianBugAge = 0;
    if (bugAgeList.length > 0) {
      const mid = Math.floor(bugAgeList.length / 2);
      medianBugAge = bugAgeList.length % 2 !== 0
        ? bugAgeList[mid].ageDays
        : ((bugAgeList[mid - 1].ageDays + bugAgeList[mid].ageDays) / 2).toFixed(1);
    }

    // 4. Testing Queue Analytics
    let testingOlderThan1d = 0;
    let testingOlderThan3d = 0;
    let testingOlderThan7d = 0;

    testingQueueBugs.forEach(issue => {
      const createdDate = issue.created ? new Date(issue.created) : now;
      const ageDays = Math.floor(Math.max(0, now - createdDate) / (1000 * 60 * 60 * 24));

      if (ageDays > 1) testingOlderThan1d++;
      if (ageDays > 3) testingOlderThan3d++;
      if (ageDays > 7) testingOlderThan7d++;
    });

    // 5. Backlog Trend
    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const trendList = sortedSnapshots.map(s => ({
      date: s.date,
      created: s.created_today || s.createdToday || 0,
      done: s.done_today || s.doneToday || 0,
      netChange: (s.created_today || s.createdToday || 0) - (s.done_today || s.doneToday || 0),
      activeBacklog: s.active_backlog || s.activeBacklog || 0
    }));

    // Find yesterday's snapshot or calculated backlog to compute change
    const yesterdayDateStr = this.formatDateStr(new Date(now.valueOf() - 86400000));
    const yesterdaySnapshot = snapshots.find(s => s.date === yesterdayDateStr);
    
    let yesterdayTotal = 0;
    if (yesterdaySnapshot) {
      yesterdayTotal = (yesterdaySnapshot.active_backlog || 0) + (yesterdaySnapshot.done_count || 0);
    }

    if (yesterdayTotal <= 0) {
      yesterdayTotal = Math.max(0, issues.length - createdToday);
    }

    const totalChange = issues.length - yesterdayTotal;

    const yesterdayBacklog = yesterdaySnapshot ? yesterdaySnapshot.active_backlog : (activeBacklog - (createdToday - movedToDone));
    const backlogChange = activeBacklog - yesterdayBacklog;

    return {
      date: dateStr,
      projectKey: config.jira.project,
      currentSnapshot: {
        totalIssues: issues.length,
        activeBacklog,
        statusDistribution,
        severityDistribution,
        priorityDistribution,
        platformDistribution
      },
      dailyActivity: {
        createdToday,
        movedToTesting,
        movedToDone,
        movedToBug,
        returnedToBug,
        reopened
      },
      bugAging: {
        averageBugAge: parseFloat(averageBugAge),
        medianBugAge: parseFloat(medianBugAge),
        agingDistribution,
        oldestOpenBugs: bugAgeList.slice(0, 5)
      },
      testingQueue: {
        count: statusDistribution.testing,
        olderThan1d: testingOlderThan1d,
        olderThan3d: testingOlderThan3d,
        olderThan7d: testingOlderThan7d
      },
      assignees: Object.values(assigneeWorkload),
      trend: {
        yesterdayTotal,
        todayTotal: issues.length,
        totalChange,
        yesterdayBacklog,
        todayBacklog: activeBacklog,
        backlogChange,
        history: trendList.slice(-7)
      }
    };
  }

  /**
   * Helper to get Monday 00:00:00 of the week for a given Date
   */
  getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    const diff = (day === 0 ? -6 : 1 - day); // Shift to Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Calculates Weekly QA Analytics from Start of Week (Monday) up to targetDate
   */
  async getWeeklyAnalytics(targetDate = new Date()) {
    await db.init();

    const endDate = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const startDate = this.getStartOfWeek(endDate);

    const startDateStr = this.formatDateStr(startDate);
    const endDateStr = this.formatDateStr(endDate);

    let issues = await db.getAllIssues();
    if (issues.length === 0) {
      const SyncEngine = require('../jira/syncEngine');
      const syncEngine = new SyncEngine();
      try {
        await syncEngine.runSync();
        issues = await db.getAllIssues();
      } catch (err) {
        console.error('[ANALYTICS] Sync error during weekly calculation:', err.message);
      }
    }

    const history = await db.getAllHistory();
    const snapshots = await db.getDailySnapshots();

    // Filter issues created during the week [startDateStr .. endDateStr]
    const createdWeeklyIssues = issues.filter(i => {
      if (!i.created) return false;
      const cStr = this.formatDateStr(i.created);
      return cStr >= startDateStr && cStr <= endDateStr;
    });

    // Filter transitions during the week
    const weeklyHistory = history.filter(h => {
      if (!h.transitionedAt) return false;
      const tStr = this.formatDateStr(h.transitionedAt);
      return tStr >= startDateStr && tStr <= endDateStr;
    });

    let movedToTestingWeekly = 0;
    let movedToDoneWeekly = 0;
    let movedToBugWeekly = 0;
    let returnedToBugWeekly = 0;
    let reopenedWeekly = 0;

    const assigneeWeekly = {};
    const resolutionTimesHours = [];
    const closedIssuesKeys = new Set();

    weeklyHistory.forEach(h => {
      const fromLow = (h.fromStatus || '').toLowerCase();
      const toLow = (h.toStatus || '').toLowerCase();
      const author = h.author || 'System';

      if (toLow.includes('testing')) {
        movedToTestingWeekly++;
      }
      if (toLow.includes('done') || toLow.includes('closed')) {
        movedToDoneWeekly++;
        closedIssuesKeys.add(h.issueKey);

        const targetIssue = issues.find(i => i.key === h.issueKey);
        if (targetIssue) {
          const ass = targetIssue.assignee || 'Unassigned';
          if (!assigneeWeekly[ass]) {
            assigneeWeekly[ass] = { assignee: ass, doneWeekly: 0, testingWeekly: 0, openWeekly: 0, returnedWeekly: 0 };
          }
          assigneeWeekly[ass].doneWeekly++;

          // Resolution time calculation (Created -> Done)
          if (targetIssue.created) {
            const createdMs = new Date(targetIssue.created).getTime();
            const doneMs = new Date(h.transitionedAt).getTime();
            if (doneMs > createdMs) {
              const diffHours = (doneMs - createdMs) / (1000 * 60 * 60);
              resolutionTimesHours.push(diffHours);
            }
          }
        }
      }
      if (toLow.includes('bug')) {
        movedToBugWeekly++;
      }

      if (fromLow.includes('testing') && toLow.includes('bug')) {
        returnedToBugWeekly++;
        const targetIssue = issues.find(i => i.key === h.issueKey);
        if (targetIssue) {
          const ass = targetIssue.assignee || 'Unassigned';
          if (!assigneeWeekly[ass]) {
            assigneeWeekly[ass] = { assignee: ass, doneWeekly: 0, testingWeekly: 0, openWeekly: 0, returnedWeekly: 0 };
          }
          assigneeWeekly[ass].returnedWeekly++;
        }
      }

      if (fromLow.includes('done') && (toLow.includes('bug') || toLow.includes('in progress') || toLow.includes('testing'))) {
        reopenedWeekly++;
      }
    });

    // Populate current open/testing bugs for assignees
    issues.forEach(i => {
      const ass = i.assignee || 'Unassigned';
      if (!assigneeWeekly[ass]) {
        assigneeWeekly[ass] = { assignee: ass, doneWeekly: 0, testingWeekly: 0, openWeekly: 0, returnedWeekly: 0 };
      }
      const stLow = (i.status || '').toLowerCase();
      if (stLow.includes('testing')) {
        assigneeWeekly[ass].testingWeekly++;
      } else if (!stLow.includes('done') && !stLow.includes('closed')) {
        assigneeWeekly[ass].openWeekly++;
      }
    });

    // Calculate QA Pass Rate: Done / (Done + Returned) * 100
    const evaluatedTotal = movedToDoneWeekly + returnedToBugWeekly;
    const qaPassRate = evaluatedTotal > 0 ? parseFloat(((movedToDoneWeekly / evaluatedTotal) * 100).toFixed(1)) : 100.0;

    // Calculate Average Resolution Time
    let avgResolutionHours = 0;
    let avgResolutionDays = 0;
    if (resolutionTimesHours.length > 0) {
      const totalH = resolutionTimesHours.reduce((acc, v) => acc + v, 0);
      avgResolutionHours = parseFloat((totalH / resolutionTimesHours.length).toFixed(1));
      avgResolutionDays = parseFloat((avgResolutionHours / 24).toFixed(1));
    }

    // Top Bug Closer (QA Champion of the week)
    let topCloser = null;
    let maxDone = 0;
    Object.values(assigneeWeekly).forEach(a => {
      if (a.doneWeekly > maxDone) {
        maxDone = a.doneWeekly;
        topCloser = a.assignee;
      }
    });

    // Backlog Net Change
    const startOfWeekSnapshot = snapshots.find(s => s.date === startDateStr);
    const startOfWeekTotal = startOfWeekSnapshot ?
      ((startOfWeekSnapshot.active_backlog || 0) + (startOfWeekSnapshot.done_count || 0))
      : Math.max(0, issues.length - createdWeeklyIssues.length);

    const netBacklogDelta = createdWeeklyIssues.length - movedToDoneWeekly;

    // Days elapsed in week (e.g. 1 to 7)
    const dayOfWeek = endDate.getDay() === 0 ? 7 : endDate.getDay();

    return {
      period: {
        startDate: startDateStr,
        endDate: endDateStr,
        daysElapsed: dayOfWeek
      },
      weeklyActivity: {
        createdWeekly: createdWeeklyIssues.length,
        movedToTestingWeekly,
        movedToDoneWeekly,
        returnedToBugWeekly,
        reopenedWeekly,
        qaPassRate
      },
      performance: {
        avgResolutionHours,
        avgResolutionDays,
        topCloser: topCloser || 'None',
        topCloserDoneCount: maxDone
      },
      assignees: Object.values(assigneeWeekly),
      backlogDynamics: {
        startOfWeekTotal,
        currentTotal: issues.length,
        netBacklogDelta
      }
    };
  }
}

const instance = new AnalyticsEngine();
module.exports = instance;
