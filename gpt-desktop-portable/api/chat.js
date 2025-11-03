import fetch from 'node-fetch';
import { getDB } from './db.js';
import { addMessage } from './messages.js';

export async function chatProxy(req, res) {
  try {
    const db = getDB();
    const apiKey = db.data.settings?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(400).json({ error: 'API key is not set. Open Settings and paste your key.' });
      return;
    }
    const { projectId, messages = [], model = 'gpt-5' } = req.body || {};
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: messages, stream: true })
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      res.status(500).send(text);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let acc = '';
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const block of chunk.split('\n\n')) {
        if (!block.startsWith('data:')) continue;
        const data = block.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          const txt = obj.output_text ?? '';
          if (txt) { acc += txt; res.write(`data: ${JSON.stringify({ delta: txt })}\n\n`); }
        } catch {}
      }
    }
    if (acc.trim()) addMessage(projectId, 'assistant', acc, null);
    res.write('data: [DONE]\n\n'); res.end();
  } catch (e) {
    console.error(e); res.write('event: error\n'); res.write(`data: ${JSON.stringify({ message: e.message })}\n\n`); res.end();
  }
}
