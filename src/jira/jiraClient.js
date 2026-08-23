const config = require('../config');

class JiraClient {
  constructor(customConfig = {}) {
    this.url = customConfig.url || config.jira.url;
    this.email = customConfig.email || config.jira.email;
    this.apiToken = customConfig.apiToken || config.jira.apiToken;
    this.project = customConfig.project || config.jira.project;
    this.reporterId = customConfig.reporterId || config.jira.reporterId;
    this.platformField = customConfig.platformField || config.jira.platformField;

    this.authHeader = 'Basic ' + Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
  }

  /**
   * Helper to execute request to Jira Cloud REST API using native node:https
   * Fails fast on HTTP 400 without blind retries.
   */
  async _request(endpoint, options = {}, retries = 3) {
    const https = require('https');
    const urlObj = new URL(`${this.url}${endpoint}`);

    const reqHeaders = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Rentmi-QA-Bot',
      ...(options.headers || {})
    };

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: reqHeaders,
      family: 4
    };

    const bodyData = options.body || null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resData = await new Promise((resolve, reject) => {
          const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
          });

          req.on('error', err => reject(err));
          req.setTimeout(10000, () => {
            req.destroy(new Error('Jira API HTTP request timeout (10s)'));
          });

          if (bodyData) {
            req.write(bodyData);
          }
          req.end();
        });

        // 400 Bad Request: Fail fast with diagnostics without retrying
        if (resData.status === 400) {
          throw new Error(`Jira API HTTP 400: ${resData.body}`);
        }

        // 429 Rate Limit: Wait and retry
        if (resData.status === 429) {
          const retryAfter = parseInt(resData.headers['retry-after'] || '2', 10);
          console.warn(`[JIRA API] Rate limited (429). Retrying after ${retryAfter}s...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }

        if (resData.status < 200 || resData.status >= 300) {
          throw new Error(`Jira API HTTP ${resData.status}: ${resData.body}`);
        }

        return JSON.parse(resData.body);
      } catch (err) {
        // Fail fast on HTTP 400
        if (err.message.includes('HTTP 400')) {
          throw err;
        }
        if (attempt === retries) {
          throw err;
        }
        console.warn(`[JIRA API] Request attempt ${attempt} failed: ${err.message}. Retrying in ${attempt}s...`);
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  /**
   * Verifies Jira Authentication credentials
   */
  async checkAuth() {
    console.log('[JIRA API] Verifying authentication...');
    const data = await this._request('/rest/api/3/myself', { method: 'GET' });
    console.log(`[JIRA API] Authentication OK (User: ${data.displayName || data.emailAddress})`);
    
    if (!config.jira.reporterId && data.accountId) {
      config.jira.reporterId = data.accountId;
      console.log(`[JIRA API] Auto-detected logged-in reporter account ID: ${data.accountId} (${data.displayName})`);
    }

    return data;
  }

  /**
   * Constructs the exact bounded JQL query specified in section 11
   */
  getBoundedJql(customJql) {
    if (customJql) return customJql;
    return `project = ${this.project} AND type = Bug ORDER BY created DESC`;
  }

  /**
   * Fetches all matching issues using token-based pagination (nextPageToken) for enhanced search /rest/api/3/search/jql
   */
  async fetchAllBugs(jqlOverride = null, maxPageLimit = 50) {
    await this.checkAuth();

    const jql = this.getBoundedJql(jqlOverride);
    let nextPageToken = undefined;
    let allIssues = [];
    const seenTokens = new Set();
    const seenIssueKeys = new Set();
    let pageNum = 0;
    let duplicatesCount = 0;

    console.log(`[JIRA API] Enhanced JQL search: OK`);
    console.log(`[JIRA API] Bounded JQL: ${jql}`);

    while (pageNum < maxPageLimit) {
      pageNum++;
      const payload = {
        jql: jql,
        maxResults: 50,
        fields: ["*all"]
      };

      if (nextPageToken) {
        if (seenTokens.has(nextPageToken)) {
          throw new Error(`[JIRA API] Jira pagination loop detected on token: ${nextPageToken}`);
        }
        seenTokens.add(nextPageToken);
        payload.nextPageToken = nextPageToken;
      }

      console.log(`[JIRA API] Page ${pageNum}`);
      console.log(`[JIRA API] Requested token: ${nextPageToken ? 'present' : 'none'}`);

      let data;
      try {
        data = await this._request('/rest/api/3/search/jql?expand=changelog', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error(`[JIRA API] HTTP Error on POST /rest/api/3/search/jql: ${err.message}`);
        throw err;
      }

      const issues = data.issues || data.values || [];
      console.log(`[JIRA API] Issues received: ${issues.length}`);

      if (issues.length > 0) {
        console.log(`[JIRA API] First issue: ${issues[0].key}`);
        console.log(`[JIRA API] Last issue: ${issues[issues.length - 1].key}`);
      }

      for (const issue of issues) {
        if (seenIssueKeys.has(issue.key)) {
          console.warn(`[JIRA API] WARNING: Duplicate issue detected: ${issue.key}`);
          duplicatesCount++;
        } else {
          seenIssueKeys.add(issue.key);
          allIssues.push(issue);
        }
      }

      nextPageToken = data.nextPageToken || data.nextPage || null;
      console.log(`[JIRA API] nextPageToken: ${nextPageToken ? 'present' : 'absent'}`);

      if (!nextPageToken || issues.length === 0) {
        break;
      }
    }

    console.log(`\n[JIRA API] Search completed`);
    console.log(`[JIRA API] Raw issues received: ${allIssues.length + duplicatesCount}`);
    console.log(`[JIRA API] Unique issues: ${allIssues.length}`);
    console.log(`[JIRA API] Duplicates: ${duplicatesCount}`);

    const parsedIssues = allIssues.map(issue => this.parseIssue(issue));

    console.log(`[JIRA API] Fetching status changelogs for ${parsedIssues.length} issues in concurrent batches...`);
    let historyCount = 0;
    const batchSize = 10;
    for (let i = 0; i < parsedIssues.length; i += batchSize) {
      const batch = parsedIssues.slice(i, i + batchSize);
      await Promise.all(batch.map(async bug => {
        if (!bug.history || bug.history.length === 0) {
          bug.history = await this.fetchChangelogForIssue(bug.key);
        }
        historyCount += bug.history.length;
      }));
    }
    console.log(`[JIRA API] Total status transitions retrieved: ${historyCount}`);

    return parsedIssues;
  }

  /**
   * Fetches status changelog for a specific issue key via Jira REST API
   */
  async fetchChangelogForIssue(issueKey) {
    try {
      let allHistories = [];
      let startAt = 0;
      let isLast = false;

      while (!isLast && startAt < 500) {
        const data = await this._request(`/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=100`);
        const values = data.values || [];
        allHistories = allHistories.concat(values);

        if (data.isLast === true || values.length === 0) {
          isLast = true;
        } else {
          startAt += values.length;
        }
      }

      const history = [];
      allHistories.forEach(h => {
        const authorName = (h.author && (h.author.displayName || h.author.name)) || 'System';
        const createdTime = h.created;

        (h.items || []).forEach(item => {
          if (item.field === 'status') {
            history.push({
              id: `${issueKey}_${h.id}_${item.field}`,
              issueKey: issueKey,
              fromStatus: item.fromString || item.from || '',
              toStatus: item.toString || item.to || '',
              transitionedAt: createdTime,
              author: authorName
            });
          }
        });
      });

      return history;
    } catch (err) {
      return [];
    }
  }

  /**
   * Classifies issue platform based on components, labels, or custom fields
   */
  classifyPlatform(fields) {
    const components = (fields.components || []).map(c => (c.name || '').toLowerCase());
    const labels = (fields.labels || []).map(l => l.toLowerCase());
    const summary = (fields.summary || '').toLowerCase();

    const combined = [...components, ...labels, summary].join(' ');

    if (combined.includes('frontend') || combined.includes('fe') || combined.includes('web')) {
      return 'Frontend';
    }
    if (combined.includes('backend') || combined.includes('be') || combined.includes('api')) {
      return 'Backend';
    }
    if (combined.includes('mobile') || combined.includes('ios') || combined.includes('android') || combined.includes('app')) {
      return 'Mobile';
    }

    return 'Other';
  }

  /**
   * Robustly extracts severity value from standard fields or customfield Checkbox options (Low, Medium, High, Urgent)
   */
  extractSeverity(fields) {
    if (!fields) return 'Low';

    if (fields.severity) {
      if (typeof fields.severity === 'string') return fields.severity;
      if (fields.severity.value) return fields.severity.value;
      if (fields.severity.name) return fields.severity.name;
    }

    for (const [key, val] of Object.entries(fields)) {
      if (!val) continue;

      let extractedStr = null;
      if (Array.isArray(val) && val.length > 0) {
        const item = val[0];
        if (typeof item === 'string') extractedStr = item;
        else if (item && item.value) extractedStr = item.value;
      } else if (typeof val === 'object' && val.value) {
        extractedStr = val.value;
      } else if (typeof val === 'string') {
        extractedStr = val;
      }

      if (extractedStr) {
        const strLower = String(extractedStr).toLowerCase().trim();
        if (strLower === 'low' || strLower === 'medium' || strLower === 'high' || strLower === 'urgent') {
          return extractedStr.charAt(0).toUpperCase() + extractedStr.slice(1);
        }
      }
    }

    return (fields.priority && fields.priority.name) || 'Low';
  }

  /**
   * Normalizes Jira REST API issue structure into standardized QA issue model
   */
  parseIssue(raw) {
    const fields = raw.fields || {};
    const platform = this.classifyPlatform(fields);
    const severity = this.extractSeverity(fields);

    // Parse status history from raw.changelog
    const history = [];
    const histories = (raw.changelog && raw.changelog.histories) || [];

    histories.forEach(h => {
      const authorName = (h.author && (h.author.displayName || h.author.name)) || 'System';
      const createdTime = h.created;

      (h.items || []).forEach(item => {
        if (item.field === 'status') {
          history.push({
            id: `${raw.key}_${h.id}_${item.field}`,
            issueKey: raw.key,
            fromStatus: item.fromString || item.from || '',
            toStatus: item.toString || item.to || '',
            transitionedAt: createdTime,
            author: authorName
          });
        }
      });
    });

    return {
      key: raw.key,
      id: raw.id,
      summary: fields.summary || '',
      description: typeof fields.description === 'string' ? fields.description : JSON.stringify(fields.description || ''),
      issueType: (fields.issuetype && fields.issuetype.name) || 'Bug',
      status: (fields.status && fields.status.name) || 'Bug',
      statusId: (fields.status && fields.status.id) || '',
      resolution: (fields.resolution && fields.resolution.name) || null,
      priority: (fields.priority && fields.priority.name) || 'Medium',
      severity: severity,
      assignee: (fields.assignee && (fields.assignee.displayName || fields.assignee.name)) || 'Unassigned',
      reporter: (fields.reporter && (fields.reporter.displayName || fields.reporter.name)) || 'Unknown',
      reporterId: (fields.reporter && fields.reporter.accountId) || '',
      created: fields.created,
      updated: fields.updated,
      components: (fields.components || []).map(c => c.name),
      labels: fields.labels || [],
      platform: platform,
      history: history,
      rawData: raw
    };
  }
}

module.exports = JiraClient;
