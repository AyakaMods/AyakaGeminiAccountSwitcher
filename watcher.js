/**
 * AyakaGeminiAccountSwitcher — Background Watcher
 * By AyakaMods (https://github.com/AyakaMods)
 *
 * Monitors Gemini CLI logs for quota exhaustion,
 * notifies you, and switches to the best available account.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import readline from 'readline';

// ─── Config ──────────────────────────────────────────────────────────────────

const GEMINI_DIR      = path.join(os.homedir(), '.gemini');
const ACCOUNTS_DIR    = path.join(os.homedir(), '.gemini-accounts');
const TRACKER_FILE    = path.join(ACCOUNTS_DIR, '_usage_tracker.json');
const LOG_DIR         = path.join(GEMINI_DIR, 'tmp');
const CRED_FILES      = ['oauth_creds.json', 'google_accounts.json'];
const CHECK_INTERVAL  = 5000; // check logs every 5 seconds

const QUOTA_PATTERNS = [
  'exhausted your capacity',
  'TerminalQuotaError',
  'quota will reset after',
  'You have exhausted',
  'RESOURCE_EXHAUSTED',
];

// ─── Colors for console ───────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  bold:   '\x1b[1m',
  gray:   '\x1b[90m',
};

function log(msg, color = C.reset) {
  const time = new Date().toLocaleTimeString();
  console.log(`${C.gray}[${time}]${C.reset} ${color}${msg}${C.reset}`);
}

function banner() {
  console.clear();
  console.log(`${C.cyan}${C.bold}`);
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     AyakaGeminiAccountSwitcher — Watcher         ║');
  console.log('║     by AyakaMods                                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(C.reset);
}

// ─── Usage Tracker ───────────────────────────────────────────────────────────

function loadTracker() {
  if (!fs.existsSync(TRACKER_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveTracker(data) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
}

function todayKey() {
  return new Date().toISOString().split('T')[0]; // e.g. 2026-03-29
}

function getAccountUsage(tracker, accountName) {
  const today = todayKey();
  if (!tracker[accountName]) tracker[accountName] = {};
  if (!tracker[accountName][today]) {
    tracker[accountName][today] = {
      requests: 0,
      isExhausted: false,
      exhaustedUntil: null,
    };
  }
  return tracker[accountName][today];
}

function markExhausted(accountName, resetMinutes) {
  const tracker = loadTracker();
  const usage = getAccountUsage(tracker, accountName);
  usage.isExhausted = true;
  usage.exhaustedAt = new Date().toISOString();
  if (resetMinutes) {
    const resetTime = new Date(Date.now() + resetMinutes * 60 * 1000);
    usage.exhaustedUntil = resetTime.toISOString();
  }
  saveTracker(tracker);
}

function incrementRequests(accountName) {
  const tracker = loadTracker();
  const usage = getAccountUsage(tracker, accountName);
  usage.requests = (usage.requests || 0) + 1;
  saveTracker(tracker);
}

// ─── Account Management ───────────────────────────────────────────────────────

function getSavedAccounts() {
  if (!fs.existsSync(ACCOUNTS_DIR)) return [];
  return fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name);
}

function getAccountEmail(accountName) {
  try {
    const credsPath = path.join(ACCOUNTS_DIR, accountName, 'oauth_creds.json');
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      return data.user_email || data.email || null;
    }
  } catch {}
  return null;
}

function getCurrentAccountName() {
  // Match current creds against saved accounts
  const currentCredsPath = path.join(GEMINI_DIR, 'oauth_creds.json');
  if (!fs.existsSync(currentCredsPath)) return null;
  const currentCreds = fs.readFileSync(currentCredsPath, 'utf8');

  for (const acc of getSavedAccounts()) {
    const savedPath = path.join(ACCOUNTS_DIR, acc, 'oauth_creds.json');
    if (fs.existsSync(savedPath)) {
      const savedCreds = fs.readFileSync(savedPath, 'utf8');
      if (currentCreds === savedCreds) return acc;
    }
  }
  return null;
}

function getBestAccount(currentAccount) {
  const tracker = loadTracker();
  const today = todayKey();
  const accounts = getSavedAccounts().filter(a => a !== currentAccount);

  if (accounts.length === 0) return null;

  // Score each account — lower requests + not exhausted = best
  const scored = accounts.map(name => {
    const usage = tracker[name]?.[today] || { requests: 0, isExhausted: false, exhaustedUntil: null };

    // Skip if exhausted and reset time hasn't passed
    if (usage.isExhausted && usage.exhaustedUntil) {
      if (new Date() < new Date(usage.exhaustedUntil)) {
        return { name, score: -1, requests: usage.requests, exhausted: true };
      }
    }

    const score = 1000 - (usage.requests || 0);
    return { name, score, requests: usage.requests || 0, exhausted: false };
  });

  // Filter out exhausted, sort by score descending
  const available = scored
    .filter(a => !a.exhausted)
    .sort((a, b) => b.score - a.score);

  return available.length > 0 ? available[0] : null;
}

function switchToAccount(accountName) {
  const src = path.join(ACCOUNTS_DIR, accountName);

  // Backup current
  const backupDir = path.join(ACCOUNTS_DIR, '_previous_session');
  if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
  fs.mkdirSync(backupDir, { recursive: true });
  CRED_FILES.forEach(f => {
    const cur = path.join(GEMINI_DIR, f);
    if (fs.existsSync(cur)) fs.copyFileSync(cur, path.join(backupDir, f));
  });

  // Swap
  CRED_FILES.forEach(f => {
    const srcFile = path.join(src, f);
    const destFile = path.join(GEMINI_DIR, f);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    } else if (fs.existsSync(destFile)) {
      fs.unlinkSync(destFile);
    }
  });
}

// ─── Windows Notification ────────────────────────────────────────────────────

function showWindowsNotification(title, message) {
  try {
    const ps = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
      $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)
      $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${title.replace(/'/g, "''")}')) | Out-Null
      $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('${message.replace(/'/g, "''")}')) | Out-Null
      $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('AyakaGeminiAccountSwitcher').Show($toast)
    `;
    execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { stdio: 'ignore' });
  } catch {
    // Notification failed silently — console output is enough
  }
}

// ─── Log Watcher ─────────────────────────────────────────────────────────────

const seenLines = new Set();
let switchInProgress = false;

function findLogFiles() {
  const files = [];
  if (!fs.existsSync(LOG_DIR)) return files;
  for (const dir of fs.readdirSync(LOG_DIR)) {
    const logFile = path.join(LOG_DIR, dir, 'logs.json');
    if (fs.existsSync(logFile)) files.push(logFile);
  }
  return files;
}

function parseResetMinutes(logLine) {
  const match = logLine.match(/reset after (\d+)h(\d+)m/);
  if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
  const matchM = logLine.match(/reset after (\d+)m/);
  if (matchM) return parseInt(matchM[1]);
  return null;
}

function checkLogs() {
  if (switchInProgress) return;

  const logFiles = findLogFiles();
  for (const logFile of logFiles) {
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        if (seenLines.has(line)) continue;
        seenLines.add(line);

        const isQuotaError = QUOTA_PATTERNS.some(p => line.includes(p));
        if (isQuotaError) {
          const resetMinutes = parseResetMinutes(line);
          handleQuotaExhausted(resetMinutes);
          return;
        }
      }
    } catch {}
  }
}

// ─── Main Switch Flow ─────────────────────────────────────────────────────────

async function handleQuotaExhausted(resetMinutes) {
  if (switchInProgress) return;
  switchInProgress = true;

  const currentAccount = getCurrentAccountName();
  const currentEmail = currentAccount ? getAccountEmail(currentAccount) : 'current account';
  const resetInfo = resetMinutes ? ` (resets in ${Math.floor(resetMinutes / 60)}h${resetMinutes % 60}m)` : '';

  log(`⚠️  Quota exhausted for ${currentEmail}${resetInfo}`, C.yellow);

  // Mark current account as exhausted
  if (currentAccount) markExhausted(currentAccount, resetMinutes);

  // Find best next account
  const best = getBestAccount(currentAccount);

  if (!best) {
    log('❌ No available accounts to switch to. All accounts exhausted.', C.red);
    log(`⏳ Please wait for quota reset or add more accounts.`, C.yellow);
    showWindowsNotification(
      'AyakaGeminiAccountSwitcher',
      'All accounts exhausted! No accounts available to switch to.'
    );
    switchInProgress = false;
    return;
  }

  const bestEmail = getAccountEmail(best.name);
  const usedToday = best.requests;

  // Show notification
  showWindowsNotification(
    'Gemini CLI — Quota Exhausted',
    `Switching to ${best.name}${bestEmail ? ` (${bestEmail})` : ''} — used ${usedToday} requests today`
  );

  // Show console prompt
  console.log('');
  console.log(`${C.yellow}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log(`${C.yellow}  ⚠️  QUOTA EXHAUSTED${C.reset}`);
  console.log(`${C.gray}  Current : ${currentEmail}${resetInfo}${C.reset}`);
  console.log(`${C.green}  Switch to: ${best.name}${bestEmail ? ` (${bestEmail})` : ''}${C.reset}`);
  console.log(`${C.gray}  Used today: ${usedToday} requests${C.reset}`);
  console.log(`${C.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);

  const confirmed = await askConfirmation(`  Switch now? (y/n): `);

  if (!confirmed) {
    log('Switch cancelled by user.', C.gray);
    switchInProgress = false;
    return;
  }

  // Do the switch
  log(`🔄 Switching to '${best.name}'...`, C.cyan);
  switchToAccount(best.name);
  log(`✅ Switched to '${best.name}' ${bestEmail ? `(${bestEmail})` : ''}`, C.green);
  log(`🔁 Please restart Gemini CLI to use the new account.`, C.cyan);

  showWindowsNotification(
    'AyakaGeminiAccountSwitcher',
    `Switched to ${best.name}! Please restart Gemini CLI.`
  );

  switchInProgress = false;
}

function askConfirmation(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

banner();

// Check accounts exist
const accounts = getSavedAccounts();
if (accounts.length === 0) {
  log('❌ No saved accounts found.', C.red);
  log(`Please save accounts first using /accounts:save inside Gemini CLI.`, C.yellow);
  log(`Or use the PowerShell switcher: gemini-switch.ps1`, C.gray);
  process.exit(1);
}

// Show current status
const currentAccount = getCurrentAccountName();
const tracker = loadTracker();
const today = todayKey();

log(`👤 Current account: ${currentAccount || 'unknown'}`, C.cyan);
log(`📋 Saved accounts: ${accounts.join(', ')}`, C.cyan);
log('');
log('📊 Today\'s usage:', C.bold);
accounts.forEach(acc => {
  const usage = tracker[acc]?.[today] || { requests: 0, isExhausted: false };
  const status = usage.isExhausted ? `${C.red}EXHAUSTED` : `${C.green}OK`;
  log(`   ${acc}: ${usage.requests || 0} requests — ${status}${C.reset}`, C.reset);
});

log('');
log(`👁️  Watching Gemini CLI logs for quota errors...`, C.cyan);
log(`${C.gray}   Press Ctrl+C to stop${C.reset}`);
log('');

// Start watching
setInterval(checkLogs, CHECK_INTERVAL);
