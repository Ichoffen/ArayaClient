// api/db.js
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JSONFileSync } from 'lowdb/node';
import { LowSync } from 'lowdb';

const APP_DIR_NAME = 'GPT Desktop Portable';

export function getDataDir() {
  // 1) Portable-режим: рядом с exe (переменная задаётся electron-builder portable)
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'gpt-desktop-data');
  }
  // 2) Обычный режим: %APPDATA%/GPT Desktop Portable  (кроссплатформенно)
  const appData =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), 'AppData', 'Roaming'));
  return path.join(appData, APP_DIR_NAME);
}

let db;
export function getDB() {
  if (db) return db;
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });

  const dbPath = path.join(dir, 'gpt_desktop.json');
  const adapter = new JSONFileSync(dbPath);
  const defaults = { projects: [], messages: [], settings: {} };

  db = new LowSync(adapter, defaults);
  db.read();
  if (!db.data) db.data = defaults;
  return db;
}

export function saveDB() {
  getDB().write();
}
