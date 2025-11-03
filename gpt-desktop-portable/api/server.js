import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatProxy } from './chat.js';
import { getDB } from './db.js';
import { listMessages, addMessage, saveAttachment, ensureDefaultProject, listProjects, createProject, recent } from './messages.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/attachments', express.static(path.join(__dirname, '..', 'attachments')));

// Settings
app.get('/api/settings', (req, res) => {
  const db = getDB();
  res.json({ apiKey: db.data.settings?.apiKey || '' });
});
app.post('/api/settings', (req, res) => {
  const { apiKey } = req.body || {};
  const db = getDB();
  db.data.settings = db.data.settings || {};
  db.data.settings.apiKey = apiKey || '';
  db.write();
  res.json({ ok: true });
});

// Projects
app.get('/api/projects', (_req, res) => res.json(listProjects()));
app.post('/api/projects', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  res.json(createProject(name));
});

// History
app.get('/api/history', (_req, res) => res.json(recent(30)));

// Messages
app.get('/api/messages', (req, res) => {
  const projectId = Number(req.query.projectId);
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  res.json(listMessages(projectId, beforeId, limit));
});

app.post('/api/messages', (req, res) => {
  const { projectId, role, content, attachment } = req.body || {};
  if (!projectId || !role) return res.status(400).json({ error: 'projectId and role required' });
  let attachmentPath = null;
  if (attachment && attachment.dataUrl) {
    try { attachmentPath = saveAttachment(attachment); } catch {}
  }
  res.json(addMessage(projectId, role, content || '', attachmentPath));
});

// Chat proxy
app.post('/api/chat', chatProxy);

const PORT = 3131;
app.listen(PORT, () => {
  ensureDefaultProject();
  console.log('Internal API on http://localhost:' + PORT);
});
