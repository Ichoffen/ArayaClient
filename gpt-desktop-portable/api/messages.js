import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import { getDB, saveDB } from './db.js';

function nextId(arr) { return (arr.length ? Math.max(...arr.map(x => x.id)) : 0) + 1; }

export function ensureDefaultProject() {
  const db = getDB();
  if (!db.data.projects.length) {
    db.data.projects.push({ id: 1, name: 'Motorbuild', created_at: new Date().toISOString() });
    saveDB();
  }
}

export function listProjects() {
  const db = getDB();
  return [...db.data.projects].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createProject(name) {
  const db = getDB();
  const p = { id: nextId(db.data.projects), name, created_at: new Date().toISOString() };
  db.data.projects.push(p); saveDB(); return p;
}

export function listMessages(projectId, beforeId, limit=50) {
  const db = getDB();
  let rows = db.data.messages.filter(m => m.project_id === projectId);
  rows.sort((a, b) => a.id - b.id);
  if (beforeId) rows = rows.filter(m => m.id < beforeId);
  return rows.slice(-limit);
}

export function addMessage(projectId, role, content, attachmentPath) {
  const db = getDB();
  const m = { id: nextId(db.data.messages), project_id: projectId, role, content, attachment_path: attachmentPath || null, created_at: new Date().toISOString() };
  db.data.messages.push(m); saveDB(); return m;
}

export function saveAttachment(attachment) {
  const { dataUrl, filename } = attachment;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const attachmentsDir = path.join(__dirname, '..', 'attachments');
  if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });
  const [meta, base64] = dataUrl.split(',');
  const match = /data:(.*?);base64/.exec(meta);
  const mimeType = match ? match[1] : 'application/octet-stream';
  const ext = mime.extension(mimeType) || 'bin';
  const safeName = (filename || 'file').replace(/[^a-z0-9._-]/gi, '_');
  const finalName = safeName.includes('.') ? safeName : `${safeName}.${ext}`;
  const fullPath = path.join(attachmentsDir, Date.now() + '_' + finalName);
  fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
  return fullPath;
}

// Recent history per project
export function recent(limit = 30) {
  const db = getDB();
  const items = db.data.projects.map(p => {
    const msgs = db.data.messages.filter(m => m.project_id === p.id);
    if (!msgs.length) return null;
    const last = msgs[msgs.length - 1];
    return {
      project_id: p.id,
      project_name: p.name,
      last_id: last.id,
      last_text: (last.content || '').slice(0, 120),
      ts: last.created_at
    };
  }).filter(Boolean).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
  return items;
}
