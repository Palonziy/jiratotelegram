const fs = require('fs');
const path = require('path');
const config = require('../config');

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  sqlite3 = null;
}

class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath || config.dbPath;
    this.isNativeSqlite = !!sqlite3;
    this.db = null;
    this.fallbackData = {
      issues: {},
      history: [],
      snapshots: {},
      syncRuns: []
    };
  }

  async init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.warn('[DB] Native SQLite connection failed, switching to file JSON store:', err.message);
            this.isNativeSqlite = false;
            this._initFallback();
            return resolve();
          }
          this._createTablesSqlite()
            .then(resolve)
            .catch(reject);
        });
      });
    } else {
      this._initFallback();
    }
  }

  _initFallback() {
    const jsonPath = this.dbPath.replace(/\.sqlite$/, '.json');
    this.jsonPath = jsonPath;
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        this.fallbackData = JSON.parse(raw);
      } catch (e) {
        console.error('[DB] Failed parsing JSON DB, starting fresh:', e.message);
      }
    }
  }

  _saveFallback() {
    if (this.jsonPath) {
      fs.writeFileSync(this.jsonPath, JSON.stringify(this.fallbackData, null, 2), 'utf8');
    }
  }

  _createTablesSqlite() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS issues (
            key TEXT PRIMARY KEY,
            id TEXT,
            summary TEXT,
            description TEXT,
            issue_type TEXT,
            status TEXT,
            status_id TEXT,
            resolution TEXT,
            priority TEXT,
            assignee TEXT,
            reporter TEXT,
            created TEXT,
            updated TEXT,
            components TEXT,
            labels TEXT,
            platform TEXT,
            raw_data TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS issue_status_history (
            id TEXT PRIMARY KEY,
            issue_key TEXT,
            from_status TEXT,
            to_status TEXT,
            transitioned_at TEXT,
            author TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS daily_snapshots (
            date TEXT PRIMARY KEY,
            created_today INTEGER,
            done_today INTEGER,
            moved_testing_today INTEGER,
            returned_today INTEGER,
            reopened_today INTEGER,
            active_backlog INTEGER,
            bug_count INTEGER,
            testing_count INTEGER,
            in_progress_count INTEGER,
            todo_count INTEGER,
            report_bugun_count INTEGER,
            done_count INTEGER,
            timestamp TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS sync_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT,
            finished_at TEXT,
            status TEXT,
            issues_synced INTEGER,
            error_message TEXT
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async saveIssue(issue) {
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        const stmt = this.db.prepare(`
          INSERT INTO issues (
            key, id, summary, description, issue_type, status, status_id,
            resolution, priority, assignee, reporter, created, updated,
            components, labels, platform, raw_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            summary=excluded.summary,
            description=excluded.description,
            issue_type=excluded.issue_type,
            status=excluded.status,
            status_id=excluded.status_id,
            resolution=excluded.resolution,
            priority=excluded.priority,
            assignee=excluded.assignee,
            reporter=excluded.reporter,
            created=excluded.created,
            updated=excluded.updated,
            components=excluded.components,
            labels=excluded.labels,
            platform=excluded.platform,
            raw_data=excluded.raw_data
        `);
        stmt.run([
          issue.key,
          issue.id,
          issue.summary || '',
          issue.description || '',
          issue.issueType || '',
          issue.status || '',
          issue.statusId || '',
          issue.resolution || '',
          issue.priority || 'Medium',
          issue.assignee || 'Unassigned',
          issue.reporter || 'Unknown',
          issue.created || '',
          issue.updated || '',
          JSON.stringify(issue.components || []),
          JSON.stringify(issue.labels || []),
          issue.platform || 'Other',
          JSON.stringify(issue)
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      this.fallbackData.issues[issue.key] = issue;
      this._saveFallback();
    }
  }

  async saveStatusHistory(historyItems) {
    if (!historyItems || historyItems.length === 0) return;
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        const stmt = this.db.prepare(`
          INSERT INTO issue_status_history (id, issue_key, from_status, to_status, transitioned_at, author)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            from_status=excluded.from_status,
            to_status=excluded.to_status,
            transitioned_at=excluded.transitioned_at,
            author=excluded.author
        `);
        this.db.serialize(() => {
          historyItems.forEach(item => {
            stmt.run([
              item.id,
              item.issueKey,
              item.fromStatus,
              item.toStatus,
              item.transitionedAt,
              item.author || 'System'
            ]);
          });
          stmt.finalize((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    } else {
      historyItems.forEach(item => {
        const existingIdx = this.fallbackData.history.findIndex(h => h.id === item.id);
        if (existingIdx >= 0) {
          this.fallbackData.history[existingIdx] = item;
        } else {
          this.fallbackData.history.push(item);
        }
      });
      this._saveFallback();
    }
  }

  async saveDailySnapshot(snapshot) {
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        const stmt = this.db.prepare(`
          INSERT INTO daily_snapshots (
            date, created_today, done_today, moved_testing_today, returned_today,
            reopened_today, active_backlog, bug_count, testing_count,
            in_progress_count, todo_count, report_bugun_count, done_count, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET
            created_today=excluded.created_today,
            done_today=excluded.done_today,
            moved_testing_today=excluded.moved_testing_today,
            returned_today=excluded.returned_today,
            reopened_today=excluded.reopened_today,
            active_backlog=excluded.active_backlog,
            bug_count=excluded.bug_count,
            testing_count=excluded.testing_count,
            in_progress_count=excluded.in_progress_count,
            todo_count=excluded.todo_count,
            report_bugun_count=excluded.report_bugun_count,
            done_count=excluded.done_count,
            timestamp=excluded.timestamp
        `);
        stmt.run([
          snapshot.date,
          snapshot.createdToday || 0,
          snapshot.doneToday || 0,
          snapshot.movedTestingToday || 0,
          snapshot.returnedToday || 0,
          snapshot.reopenedToday || 0,
          snapshot.activeBacklog || 0,
          snapshot.bugCount || 0,
          snapshot.testingCount || 0,
          snapshot.inProgressCount || 0,
          snapshot.todoCount || 0,
          snapshot.reportBugunCount || 0,
          snapshot.doneCount || 0,
          new Date().toISOString()
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      this.fallbackData.snapshots[snapshot.date] = {
        ...snapshot,
        timestamp: new Date().toISOString()
      };
      this._saveFallback();
    }
  }

  async getAllIssues() {
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        this.db.all(`SELECT * FROM issues`, [], (err, rows) => {
          if (err) return reject(err);
          const parsed = rows.map(r => ({
            ...r,
            components: JSON.parse(r.components || '[]'),
            labels: JSON.parse(r.labels || '[]'),
            rawData: r.raw_data ? JSON.parse(r.raw_data) : null
          }));
          resolve(parsed);
        });
      });
    } else {
      return Object.values(this.fallbackData.issues);
    }
  }

  async getAllHistory() {
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        this.db.all(`SELECT * FROM issue_status_history ORDER BY transitioned_at ASC`, [], (err, rows) => {
          if (err) return reject(err);
          const mapped = rows.map(r => ({
            id: r.id,
            issueKey: r.issue_key,
            fromStatus: r.from_status,
            toStatus: r.to_status,
            transitionedAt: r.transitioned_at,
            author: r.author
          }));
          resolve(mapped);
        });
      });
    } else {
      return this.fallbackData.history;
    }
  }

  async getDailySnapshots() {
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        this.db.all(`SELECT * FROM daily_snapshots ORDER BY date ASC`, [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    } else {
      return Object.values(this.fallbackData.snapshots);
    }
  }

  async logSyncRun(startedAt, finishedAt, status, issuesSynced, errorMessage = null) {
    if (this.isNativeSqlite) {
      return new Promise((resolve, reject) => {
        this.db.run(`
          INSERT INTO sync_runs (started_at, finished_at, status, issues_synced, error_message)
          VALUES (?, ?, ?, ?, ?)
        `, [startedAt, finishedAt, status, issuesSynced, errorMessage], function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    } else {
      const run = {
        id: this.fallbackData.syncRuns.length + 1,
        startedAt,
        finishedAt,
        status,
        issuesSynced,
        errorMessage
      };
      this.fallbackData.syncRuns.push(run);
      this._saveFallback();
      return run.id;
    }
  }
}

const dbInstance = new DatabaseService();
module.exports = dbInstance;
