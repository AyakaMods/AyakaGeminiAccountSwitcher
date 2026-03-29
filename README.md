# AyakaGeminiAccountSwitcher

> A Gemini CLI extension by [AyakaMods](https://github.com/AyakaMods) that adds multi-account switching support directly inside Gemini CLI.

![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.0-green?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20+-brightgreen?style=flat-square)
![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Extension-orange?style=flat-square)

---

## Why?

Gemini CLI only allows one Google account at a time, with a free quota of **1,000 requests/day**. For heavy workloads (like large codebase migrations), you hit that limit fast. This extension lets you save multiple Google accounts and switch between them instantly — all from inside Gemini CLI without ever leaving the terminal.

---

## Features

- `/accounts:list` — List all saved accounts with emails and save location
- `/accounts:save <name>` — Save your current login session under a name
- `/accounts:switch <name>` — Switch to a saved account
- `/accounts:delete <name>` — Delete a saved account
- Shows save path both in the main list and after every save action
- Auto-backs up your previous session before every switch

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

### Save your current logged-in account
```
/accounts:save gmail1
```
Output:
```
✅ Saved account 'gmail1' (yourname@gmail.com)
📁 Saved at: C:\Users\YourName\.gemini-accounts\gmail1
```

---

### List all saved accounts
```
/accounts:list
```
Output:
```
📁 Accounts saved at: C:\Users\YourName\.gemini-accounts

🔵 Current active account: yourname@gmail.com

📋 Saved accounts (2):
  [1] gmail1 — yourname@gmail.com
       📁 C:\Users\YourName\.gemini-accounts\gmail1
  [2] gmail2 — otherwork@gmail.com
       📁 C:\Users\YourName\.gemini-accounts\gmail2
```

---

### Switch to another account
```
/accounts:switch gmail2
```
Output:
```
✅ Switched to account 'gmail2' (otherwork@gmail.com)

⚠️ IMPORTANT: You must restart Gemini CLI for the account switch to take effect.
Close this session and run "gemini" again.
```

---

### Delete a saved account
```
/accounts:delete gmail1
```
Output:
```
🗑️ Deleted account 'gmail1' (yourname@gmail.com)
```

---

## How It Works

Gemini CLI stores OAuth credentials in two files inside `~/.gemini/`:

- `oauth_creds.json` — active login token
- `google_accounts.json` — account info

This extension copies those files to `~/.gemini-accounts/<name>/` when saving, and swaps them back when switching. Your previous session is always backed up automatically to `_previous_session` before any switch occurs.

---

## Accounts Storage Location

| OS | Path |
|---|---|
| Windows | `C:\Users\<YourName>\.gemini-accounts\` |
| macOS / Linux | `~/.gemini-accounts/` |

---

## Project Structure

```
AyakaGeminiAccountSwitcher/
├── index.js                     # MCP server — core account switching logic
├── gemini-extension.json        # Extension manifest
├── package.json                 # Node.js dependencies
├── commands/
│   └── accounts/
│       ├── save.toml            # /accounts:save command
│       ├── switch.toml          # /accounts:switch command
│       ├── list.toml            # /accounts:list command
│       └── delete.toml          # /accounts:delete command
└── README.md
```

---

## License

Apache License 2.0 — Free to use, modify, and distribute with attribution.
See [LICENSE](LICENSE) for full details.

---

Made with ❤️ by [AyakaMods](https://github.com/AyakaMods)
