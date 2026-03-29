# AyakaGeminiAccountSwitcher

> A Gemini CLI extension by [AyakaMods](https://github.com/AyakaMods) that adds multi-account switching support directly inside Gemini CLI — with an auto-watcher that detects quota exhaustion and switches accounts automatically.

![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.0-green?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20+-brightgreen?style=flat-square)
![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Extension-orange?style=flat-square)

---

## Why?

Gemini CLI only allows one Google account at a time, with a free quota of **1,000 requests/day**. For heavy workloads (like large codebase migrations), you hit that limit fast. This extension lets you:

- Save multiple Google accounts
- Switch between them instantly using slash commands inside Gemini CLI
- Run a **background watcher** that auto-detects quota exhaustion and notifies you before switching to the best available account

---

## Features

### Gemini CLI Extension (slash commands)
- `/accounts:list` — List all saved accounts with emails and save location
- `/accounts:save <n>` — Save your current login session
- `/accounts:switch <n>` — Switch to a saved account
- `/accounts:delete <n>` — Delete a saved account

### Background Watcher
- Monitors Gemini CLI logs in real-time for quota exhaustion
- Tracks daily request count per account
- Picks the account with the **most quota remaining**
- Shows a **Windows notification** + console prompt before switching
- Waits for your confirmation before swapping accounts
- Auto-backs up previous session before every switch

---

## Requirements

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) v0.35.0+
- Node.js 20+
- Windows / macOS / Linux

---

## Installation

**1. Clone the repository**
```bash
git clone https://github.com/AyakaMods/AyakaGeminiAccountSwitcher.git
cd AyakaGeminiAccountSwitcher
```

**2. Install dependencies**
```bash
npm install
```

**3. Link the extension to Gemini CLI**
```bash
gemini extensions link .
```

**4. Restart Gemini CLI**
```bash
gemini
```

---

## Usage

### Step 1 — Save your accounts first

Inside Gemini CLI, save each Google account you want to rotate:
```
/accounts:save gmail1
/accounts:save gmail2
/accounts:save gmail3
```

### Step 2 — Start the background watcher

Open a **separate terminal window** and run:

**Windows (batch):**
```cmd
start-watcher.bat
```

**Windows (PowerShell):**
```powershell
.\start-watcher.ps1
```

**Any OS:**
```bash
npm run watcher
```

Keep this window open while using Gemini CLI.

---

### Watcher output example

```
╔══════════════════════════════════════════════════╗
║     AyakaGeminiAccountSwitcher — Watcher         ║
║     by AyakaMods                                 ║
╚══════════════════════════════════════════════════╝

[10:32:01] 👤 Current account: gmail1
[10:32:01] 📋 Saved accounts: gmail1, gmail2, gmail3

[10:32:01] 📊 Today's usage:
   gmail1: 847 requests — OK
   gmail2: 120 requests — OK
   gmail3: 0 requests   — OK

[10:32:01] 👁️  Watching Gemini CLI logs for quota errors...
```

When quota exhausts:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  QUOTA EXHAUSTED
  Current  : gmail1@example.com (resets in 7h33m)
  Switch to: gmail3 (other@example.com)
  Used today: 0 requests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Switch now? (y/n):
```

Type `y` → credentials swap → restart Gemini CLI → continue working.

---

### Extension slash commands

#### List all saved accounts
```
/accounts:list
```
Output:
```
📁 Accounts saved at: C:\Users\YourName\.gemini-accounts

🔵 Current active account: gmail1@example.com

📋 Saved accounts (3):
  [1] gmail1 — gmail1@example.com
       📁 C:\Users\YourName\.gemini-accounts\gmail1
  [2] gmail2 — gmail2@example.com
       📁 C:\Users\YourName\.gemini-accounts\gmail2
  [3] gmail3 — gmail3@example.com
       📁 C:\Users\YourName\.gemini-accounts\gmail3
```

#### Manual switch
```
/accounts:switch gmail2
```

#### Delete an account
```
/accounts:delete gmail1
```

---

## How It Works

### Account Storage
Gemini CLI stores OAuth credentials in `~/.gemini/`:
- `oauth_creds.json` — active login token
- `google_accounts.json` — account info

This extension copies those files to `~/.gemini-accounts/<n>/` when saving, and swaps them back when switching.

### Quota Detection
The watcher reads Gemini CLI log files from `~/.gemini/tmp/*/logs.json` every 5 seconds and scans for quota exhaustion messages. When detected, it marks that account as exhausted with a reset timer, then picks the account with the fewest requests used today as the best candidate.

### Account Selection Logic
```
Available accounts (not exhausted today)
       ↓
Sort by requests used today (ascending)
       ↓
Pick the one with fewest requests = most quota remaining
```

---

## File & Folder Locations

| Item | Location |
|---|---|
| Saved accounts | `~/.gemini-accounts/` |
| Usage tracker | `~/.gemini-accounts/_usage_tracker.json` |
| Previous session backup | `~/.gemini-accounts/_previous_session/` |
| Gemini CLI logs | `~/.gemini/tmp/*/logs.json` |

---

## Project Structure

```
AyakaGeminiAccountSwitcher/
├── index.js                     # MCP server — slash command logic
├── watcher.js                   # Background watcher — auto quota detection
├── start-watcher.bat            # Windows launcher (double-click)
├── start-watcher.ps1            # PowerShell launcher
├── gemini-extension.json        # Extension manifest
├── package.json
├── commands/
│   └── accounts/
│       ├── save.toml            # /accounts:save
│       ├── switch.toml          # /accounts:switch
│       ├── list.toml            # /accounts:list
│       └── delete.toml          # /accounts:delete
└── README.md
```

---

## License

Apache License 2.0 — Free to use, modify, and distribute with attribution.
See [LICENSE](LICENSE) for full details.

---

Made with ❤️ by [AyakaMods](https://github.com/AyakaMods)
