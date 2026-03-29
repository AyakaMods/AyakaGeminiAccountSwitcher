/**
 * AyakaGeminiAccountSwitcher — MCP Server
 * By AyakaMods (https://github.com/AyakaMods)
 *
 * Handles saving, switching, listing, and deleting Google accounts
 * for Gemini CLI by managing credential files in ~/.gemini/
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── Paths ───────────────────────────────────────────────────────────────────
const GEMINI_DIR   = path.join(os.homedir(), '.gemini');
const ACCOUNTS_DIR = path.join(os.homedir(), '.gemini-accounts');
const CRED_FILES   = ['oauth_creds.json', 'google_accounts.json'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureAccountsDir() {
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  }
}

function getAccountEmail(accountDir) {
  try {
    const credsPath = path.join(accountDir, 'oauth_creds.json');
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      return data.user_email || data.email || null;
    }
  } catch {}
  return null;
}

function getCurrentEmail() {
  try {
    const credsPath = path.join(GEMINI_DIR, 'oauth_creds.json');
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      return data.user_email || data.email || '(logged in, email unknown)';
    }
  } catch {}
  return null;
}

function isLoggedIn() {
  return CRED_FILES.some(f => fs.existsSync(path.join(GEMINI_DIR, f)));
}

function getSavedAccounts() {
  ensureAccountsDir();
  return fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_previous_session')
    .map(d => {
      const dir = path.join(ACCOUNTS_DIR, d.name);
      return {
        name: d.name,
        email: getAccountEmail(dir),
        savedAt: path.join(ACCOUNTS_DIR, d.name),
      };
    });
}

function copyCredentials(srcDir, destDir) {
  CRED_FILES.forEach(f => {
    const src = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    } else if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
  });
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'AyakaGeminiAccountSwitcher',
  version: '1.0.0',
});

// ── Tool: list_accounts ──────────────────────────────────────────────────────
server.registerTool(
  'list_accounts',
  {
    description: 'List all saved Gemini CLI accounts and the currently active one.',
    inputSchema: z.object({}).shape,
  },
  async () => {
    ensureAccountsDir();
    const accounts = getSavedAccounts();
    const currentEmail = getCurrentEmail();
    const saveLocation = ACCOUNTS_DIR;

    let output = '';
    output += `📁 Accounts saved at: ${saveLocation}\n\n`;
    output += `🔵 Current active account: ${currentEmail || 'Not logged in'}\n\n`;

    if (accounts.length === 0) {
      output += '📭 No saved accounts yet.\n';
      output += 'Use /accounts:save to save your current session.';
    } else {
      output += `📋 Saved accounts (${accounts.length}):\n`;
      accounts.forEach((acc, i) => {
        const email = acc.email ? ` — ${acc.email}` : '';
        output += `  [${i + 1}] ${acc.name}${email}\n`;
        output += `       📁 ${acc.savedAt}\n`;
      });
    }

    return { content: [{ type: 'text', text: output }] };
  }
);

// ── Tool: save_account ───────────────────────────────────────────────────────
server.registerTool(
  'save_account',
  {
    description: 'Save the current Gemini CLI logged-in session under a name.',
    inputSchema: z.object({
      name: z.string().describe('A short name for this account, e.g. gmail1 or work'),
    }).shape,
  },
  async ({ name }) => {
    if (!name || name.trim() === '') {
      return { content: [{ type: 'text', text: '❌ Name cannot be empty.' }] };
    }

    if (!isLoggedIn()) {
      return {
        content: [{
          type: 'text',
          text: '❌ No active session found.\nPlease log in to Gemini CLI first (/auth login), then try again.',
        }],
      };
    }

    ensureAccountsDir();
    const dest = path.join(ACCOUNTS_DIR, name.trim());
    const existed = fs.existsSync(dest);

    if (existed) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.mkdirSync(dest, { recursive: true });
    copyCredentials(GEMINI_DIR, dest);

    const email = getAccountEmail(dest);
    const emailInfo = email ? ` (${email})` : '';

    return {
      content: [{
        type: 'text',
        text: [
          existed ? `♻️  Overwritten existing account '${name}'.` : `✅ Saved account '${name}'${emailInfo}`,
          `📁 Saved at: ${dest}`,
          '',
          'Use /accounts:list to see all saved accounts.',
          'Use /accounts:switch to switch between them.',
        ].join('\n'),
      }],
    };
  }
);

// ── Tool: switch_account ─────────────────────────────────────────────────────
server.registerTool(
  'switch_account',
  {
    description: 'Switch to a saved Gemini CLI account by name.',
    inputSchema: z.object({
      name: z.string().describe('The name of the saved account to switch to'),
    }).shape,
  },
  async ({ name }) => {
    ensureAccountsDir();
    const accounts = getSavedAccounts();

    if (accounts.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ No saved accounts found.\nUse /accounts:save to save your current session first.',
        }],
      };
    }

    const account = accounts.find(a => a.name === name.trim());
    if (!account) {
      const names = accounts.map(a => a.name).join(', ');
      return {
        content: [{
          type: 'text',
          text: `❌ Account '${name}' not found.\nAvailable accounts: ${names}`,
        }],
      };
    }

    // Backup current session
    const backupDir = path.join(ACCOUNTS_DIR, '_previous_session');
    if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
    fs.mkdirSync(backupDir, { recursive: true });
    copyCredentials(GEMINI_DIR, backupDir);

    // Swap credentials
    copyCredentials(path.join(ACCOUNTS_DIR, name.trim()), GEMINI_DIR);

    const email = account.email ? ` (${account.email})` : '';

    return {
      content: [{
        type: 'text',
        text: [
          `✅ Switched to account '${name}'${email}`,
          '',
          '⚠️  IMPORTANT: You must restart Gemini CLI for the account switch to take effect.',
          'Close this session and run "gemini" again.',
        ].join('\n'),
      }],
    };
  }
);

// ── Tool: delete_account ─────────────────────────────────────────────────────
server.registerTool(
  'delete_account',
  {
    description: 'Delete a saved Gemini CLI account by name.',
    inputSchema: z.object({
      name: z.string().describe('The name of the saved account to delete'),
    }).shape,
  },
  async ({ name }) => {
    ensureAccountsDir();
    const target = path.join(ACCOUNTS_DIR, name.trim());

    if (!fs.existsSync(target)) {
      return {
        content: [{
          type: 'text',
          text: `❌ Account '${name}' not found.`,
        }],
      };
    }

    const email = getAccountEmail(target);
    fs.rmSync(target, { recursive: true, force: true });
    const emailInfo = email ? ` (${email})` : '';

    return {
      content: [{
        type: 'text',
        text: `🗑️  Deleted account '${name}'${emailInfo}`,
      }],
    };
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
