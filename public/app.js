let trendChartInstance = null;
let statusChartInstance = null;
let priorityChartInstance = null;
let platformChartInstance = null;
let agingChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // Theme Switcher Setup
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('rentmi_theme') || 'dark';
  setTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('rentmi_theme', newTheme);
      fetchDashboardData();
    });
  }

  fetchDashboardData();
  fetchWeeklyDashboardData();

  const tabDailyBtn = document.getElementById('tabDailyBtn');
  const tabWeeklyBtn = document.getElementById('tabWeeklyBtn');
  const dailyView = document.getElementById('dailyView');
  const weeklyView = document.getElementById('weeklyView');

  if (tabDailyBtn && tabWeeklyBtn) {
    tabDailyBtn.addEventListener('click', () => {
      tabDailyBtn.classList.add('active');
      tabWeeklyBtn.classList.remove('active');
      dailyView.style.display = 'grid';
      weeklyView.style.display = 'none';
    });

    tabWeeklyBtn.addEventListener('click', () => {
      tabWeeklyBtn.classList.add('active');
      tabDailyBtn.classList.remove('active');
      dailyView.style.display = 'none';
      weeklyView.style.display = 'grid';
      fetchWeeklyDashboardData();
    });
  }

  document.getElementById('syncBtn').addEventListener('click', async () => {
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Syncing...';
    try {
      await fetch('/api/sync', { method: 'POST' });
      await fetchDashboardData();
      await fetchWeeklyDashboardData();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">🔄</span> Sync Jira Data';
    }
  });
});

async function fetchDashboardData() {
  try {
    const res = await fetch('/api/analytics/today');
    const json = await res.json();
    if (json.success && json.data) {
      updateDashboard(json.data);
    }
  } catch (err) {
    console.error('Error fetching analytics data:', err);
  }
}

async function fetchWeeklyDashboardData() {
  try {
    const res = await fetch('/api/analytics/weekly');
    const json = await res.json();
    if (json.success && json.data) {
      updateWeeklyDashboard(json.data);
    }
  } catch (err) {
    console.error('Error fetching weekly analytics data:', err);
  }
}

function updateWeeklyDashboard(data) {
  const period = data.period;
  const act = data.weeklyActivity;
  const perf = data.performance;
  const assignees = data.assignees || [];

  document.getElementById('wkCreated').textContent = act.createdWeekly;
  document.getElementById('wkDone').textContent = act.movedToDoneWeekly;
  document.getElementById('wkPassRate').textContent = `${act.qaPassRate}%`;
  document.getElementById('wkPeriod').textContent = `${period.startDate} — ${period.endDate}`;
  document.getElementById('wkTopCloser').textContent = perf.topCloser;
  document.getElementById('wkTopCloserCount').textContent = `${perf.topCloserDoneCount} closed`;

  const tbody = document.getElementById('wkAssigneeTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    if (assignees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No active assignees</td></tr>';
    } else {
      assignees.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${a.assignee}</strong></td>
          <td><span class="badge badge-done">${a.doneWeekly}</span></td>
          <td><span class="badge badge-testing">${a.testingWeekly}</span></td>
          <td>${a.openWeekly}</td>
          <td><span class="badge badge-reopened">${a.returnedWeekly}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function updateDashboard(data) {
  document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  if (data.projectKey) {
    document.getElementById('projectBadge').textContent = data.projectKey;
  }

  // KPI updates
  const cur = data.currentSnapshot;
  const act = data.dailyActivity;
  const tr = data.trend;
  const test = data.testingQueue;

  document.getElementById('kpiActiveBacklog').textContent = cur.activeBacklog;
  const changeText = tr.backlogChange > 0 ? `+${tr.backlogChange} since yesterday` : `${tr.backlogChange} since yesterday`;
  document.getElementById('kpiBacklogChange').textContent = changeText;

  document.getElementById('kpiTestingQueue').textContent = test.count;
  document.getElementById('kpiTestingBottleneck').textContent = `>3d waiting: ${test.olderThan3d}`;

  document.getElementById('kpiCreatedToday').textContent = act.createdToday;
  document.getElementById('kpiDoneToday').textContent = act.movedToDone;
  document.getElementById('kpiReopenedToday').textContent = act.returnedToBug + act.reopened;

  // Render Charts
  renderTrendChart(data.trend.history);
  renderStatusChart(cur.statusDistribution);
  renderPriorityChart(cur.priorityDistribution);
  renderPlatformChart(cur.platformDistribution);
  renderAgingChart(data.bugAging.agingDistribution);

  // Render Tables
  renderAssigneeTable(data.assignees);
  renderOldestBugsTable(data.bugAging.oldestOpenBugs);
}

function renderTrendChart(history) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();

  const labels = history.map(h => h.date);
  const backlogs = history.map(h => h.activeBacklog);

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length > 0 ? labels : ['Today'],
      datasets: [{
        label: 'Active Backlog',
        data: backlogs.length > 0 ? backlogs : [0],
        borderColor: '#6366f1',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '600' } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '600' } } }
      }
    }
  });
}

function renderStatusChart(statusDist) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  if (statusChartInstance) statusChartInstance.destroy();

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Bug', 'Testing', 'In Progress', 'To Do', 'Report(BUGUN)', 'Done'],
      datasets: [{
        data: [
          statusDist.bug,
          statusDist.testing,
          statusDist.inProgress,
          statusDist.todo,
          statusDist.reportBugun,
          statusDist.done
        ],
        backgroundColor: ['#f43f5e', '#f59e0b', '#06b6d4', '#6366f1', '#a855f7', '#10b981'],
        borderWidth: 2,
        borderColor: '#121826'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { color: '#f8fafc', boxWidth: 14, font: { family: 'Plus Jakarta Sans', weight: '600' } } }
      }
    }
  });
}

function renderPriorityChart(prioDist) {
  const ctx = document.getElementById('priorityChart').getContext('2d');
  if (priorityChartInstance) priorityChartInstance.destroy();

  priorityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Urgent', 'High', 'Medium', 'Low'],
      datasets: [{
        data: [prioDist.Urgent || 0, prioDist.High || 0, prioDist.Medium || 0, prioDist.Low || 0],
        backgroundColor: ['#f43f5e', '#f59e0b', '#6366f1', '#10b981'],
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '600' } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '600' } } }
      }
    }
  });
}

function renderPlatformChart(platDist) {
  const ctx = document.getElementById('platformChart').getContext('2d');
  if (platformChartInstance) platformChartInstance.destroy();

  platformChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Frontend', 'Backend', 'Mobile', 'Other'],
      datasets: [{
        data: [platDist.Frontend || 0, platDist.Backend || 0, platDist.Mobile || 0, platDist.Other || 0],
        backgroundColor: ['#06b6d4', '#10b981', '#8b5cf6', '#64748b'],
        borderWidth: 2,
        borderColor: '#121826'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: { legend: { position: 'right', labels: { color: '#f8fafc', boxWidth: 14, font: { family: 'Plus Jakarta Sans', weight: '600' } } } }
    }
  });
}

function renderAgingChart(agingDist) {
  const ctx = document.getElementById('agingChart').getContext('2d');
  if (agingChartInstance) agingChartInstance.destroy();

  agingChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(agingDist),
      datasets: [{
        data: Object.values(agingDist),
        backgroundColor: '#06b6d4',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
      }
    }
  });
}

function renderAssigneeTable(assignees) {
  const tbody = document.getElementById('assigneeTableBody');
  tbody.innerHTML = '';

  if (!assignees || assignees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No active assignees</td></tr>';
    return;
  }

  assignees.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${a.assignee}</strong></td>
      <td>${a.openBugs}</td>
      <td>${a.testingBugs}</td>
      <td>${a.doneToday}</td>
      <td>${a.createdToday}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderOldestBugsTable(oldestBugs) {
  const tbody = document.getElementById('oldestBugsBody');
  tbody.innerHTML = '';

  if (!oldestBugs || oldestBugs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No open bugs</td></tr>';
    return;
  }

  oldestBugs.forEach(b => {
    const tr = document.createElement('tr');
    const badgeClass = b.priority === 'Urgent' ? 'badge-urgent' : b.priority === 'High' ? 'badge-high' : b.priority === 'Low' ? 'badge-low' : 'badge-medium';
    tr.innerHTML = `
      <td><strong>${b.key}</strong></td>
      <td><span class="badge ${badgeClass}">${b.priority}</span></td>
      <td>${b.status}</td>
      <td>${b.assignee}</td>
      <td><strong>${b.ageDays} days</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function setTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    if (themeIcon) themeIcon.textContent = '🌙';
    if (themeText) themeText.textContent = 'Dark Mode';
  } else {
    document.documentElement.removeAttribute('data-theme');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    if (themeIcon) themeIcon.textContent = '☀️';
    if (themeText) themeText.textContent = 'Light Mode';
  }
}
