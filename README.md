# 🚀 Jira QA Analytics Engine & Telegram Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Jira REST API v3](https://img.shields.io/badge/Jira%20API-v3-0052CC.svg)](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4.svg)](https://core.telegram.org/bots/api)

An end-to-end, high-speed **Jira QA Analytics & Telegram Bot Service** built for Agile software development and QA engineering teams. 

It automatically ingests Jira issues and status changelogs, computes real-time daily/weekly metrics (QA Pass Rate, Assignee Throughput, Bug Aging, Resolution Speed), broadcasts automated reports via Telegram, and serves an **ultra-premium dual-theme (Dark Glassmorphism & Apple Light Mode) Web Dashboard**.

---

## 🌟 Key Features

- ⚡ **High-Speed Concurrent Sync**: Fetches Jira Cloud status changelogs in 10-item parallel batches, syncing 300+ issues in under 15 seconds.
- 📊 **Real-Time Web Analytics Dashboard**:
  - **Dual Theme Support**: Modern Dark Glassmorphism and Apple-style Light Mode with instant toggle & `localStorage` persistence.
  - **Daily & Weekly Views**: Interactive tab bar switching between daily activity and cumulative weekly analytics.
  - **Chart.js Visualizations**: Area backlog trends, status doughnut charts, priority bar charts, and platform distribution.
  - **Aging & Workload Tables**: Detailed team assignee workload breakdown and oldest active bug alerts.
- 🤖 **Interactive Telegram Bot**:
  - Full suite of commands: `/today`, `/yesterday`, `/week`, `/weekly`, `/status`, `/priority`, `/platform`, `/testing`, `/aging`, `/assignees`, `/trend`, `/sync`, `/help`.
  - **Automated Broadcasts**: Daily report at 19:00 and Monday morning Weekly Summary at 09:00 (Asia/Tashkent).
- 🔒 **Security & Production Ready**: 100% environment-driven configuration with zero hardcoded API keys or private credentials.

---

## 🏗️ Tech Stack & Architecture

- **Backend Runtime**: Node.js (Express HTTP Server)
- **Database**: SQLite3 (Local file-based persistent database)
- **APIs Integrated**: Jira Cloud REST API v3 & Telegram Bot API
- **Frontend UI**: Vanilla JavaScript, CSS3 Glassmorphic Styling & Chart.js

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js `v18.0.0` or higher
- Jira Cloud Account with an API Token ([Generate Jira Token](https://id.atlassian.com/manage-profile/security/api-tokens))
- Telegram Bot Token ([Create Bot via @BotFather](https://t.me/BotFather))

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/jira-qa-analytics-bot.git
cd jira-qa-analytics-bot

# Install npm dependencies
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
# App Branding
APP_NAME="Jira QA Analytics"

# Jira Cloud API Credentials
JIRA_URL="https://your-domain.atlassian.net"
JIRA_EMAIL="your-email@example.com"
JIRA_API_TOKEN="your_jira_api_token"
JIRA_PROJECT="YOUR_PROJECT_KEY"

# Optional: Leave empty to automatically detect your logged-in Jira user
JIRA_REPORTER_ID=""

# Telegram Bot Credentials
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_CHAT_ID="-100123456789"

PORT=3000
TIMEZONE="Asia/Tashkent"
```

---

## 🔒 Security & Privacy Best Practices

- 🛡️ **Zero Token Exposure**: Never commit `.env` or API credentials to version control. The included `.gitignore` automatically blocks `.env`, SQLite files, and local logs.
- 🔑 **Minimal Jira Token Permissions**: Generate a Jira API token specifically for this analytics service with scope restricted to your Jira project.
- 👤 **Smart Account Auto-Detection**: Leaving `JIRA_REPORTER_ID` empty automatically resolves your Atlassian `accountId` via Jira's `/rest/api/3/myself` endpoint securely upon authentication.

### 4. Run Server

```bash
# Start in production mode
npm start

# Or run in dev mode with auto-reload
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)** to view the Web Dashboard!

---

## 📱 Telegram Bot Commands

| Command | Description | Scope |
| :--- | :--- | :--- |
| `/today` | Today's QA daily report | Configured Reporter |
| `/yesterday` | Yesterday's QA report summary | Configured Reporter |
| `/week` or `/weekly` | Cumulative Weekly report (Mon -> Today) | Entire Project / Team |
| `/status` | Current status breakdown | Configured Reporter |
| `/priority` | Bug priority distribution | Configured Reporter |
| `/platform` | Frontend / Backend / Mobile breakdown | Configured Reporter |
| `/testing` | Testing queue analytics | Configured Reporter |
| `/aging` | Active bug aging breakdown | Configured Reporter |
| `/assignees` | Assignee workload breakdown | Configured Reporter |
| `/trend` | Backlog trend & 7-day history | Configured Reporter |
| `/sync` | Trigger manual Jira sync | Entire Project |
| `/help` | Display command menu | - |

---

## 🧪 Running Unit Tests

```bash
npm test
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
