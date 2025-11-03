import { JSONFileSync } from 'lowdb/node';
import { LowSync } from 'lowdb';
import path from 'path';
import { fileURLToPath } from 'url';

let db;
export function getDB() {
  if (db) return db;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = path.join(__dirname, '..', 'gpt_desktop.json');
  const defaultData = { projects: [], messages: [], settings: {} };
  const adapter = new JSONFileSync(dbPath);
  db = new LowSync(adapter, defaultData);
  db.read();
  if (!db.data) db.data = defaultData;
  return db;
}
export function saveDB() { getDB().write(); }
