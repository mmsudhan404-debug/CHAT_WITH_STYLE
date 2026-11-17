'use strict';

const path = require('node:path');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const MAX_MESSAGES = 20;
const MAX_CHARS = 6000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
const hits = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const old = hits.get(ip) || { start: now, count: 0 };
  if (now - old.start >= WINDOW_MS) { old.start = now; old.count = 0; }
  old.count += 1;
  hits.set(ip, old);
  if (old.count > MAX_REQUESTS) return res.status(429).json({ error: 'Rate limit reached. Try again shortly.' });
  next();
}

const SYSTEM_PROMPT = 'You are Emma, a friendly fictional AI chat buddy (not a real person). Reply in Tanglish (Tamil written in English letters), warm and casual, 1-2 short sentences, under 150 characters.';

app.get('/api/health', rateLimit, async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      headers: OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {},
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return res.status(502).json({ ok: false, error: `Ollama returned ${response.status}` });
    res.json({ ok: true, model: OLLAMA_MODEL });
  } catch (error) {
    res.status(503).json({ ok: false, error: 'Cannot reach Ollama. Check OLLAMA_BASE_URL and make sure Ollama is running.' });
  }
});

app.post('/api/chat', rateLimit, async (req, res) => {
  const input = req.body && req.body.messages;
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Send between 1 and ${MAX_MESSAGES} messages.` });
  }
  let total = 0;
  const messages = [];
  for (const item of input) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message format.' });
    }
    const content = item.content.trim();
    total += content.length;
    if (!content || content.length > 1500 || total > MAX_CHARS) {
      return res.status(400).json({ error: 'Message is empty or too long.' });
    }
    messages.push({ role: item.role, content });
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {})
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
      }),
      signal: AbortSignal.timeout(50_000)
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      console.error('Ollama error:', response.status, detail);
      return res.status(502).json({ error: `Ollama returned ${response.status}. Check the model and server configuration.` });
    }
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof reply !== 'string' || !reply.trim()) return res.status(502).json({ error: 'Ollama returned an empty response.' });
    res.json({ reply: reply.trim().slice(0, 1200) });
  } catch (error) {
    console.error('Chat request failed:', error.message);
    res.status(503).json({ error: 'AI is temporarily unavailable. Check the Ollama server.' });
  }
});

app.use(express.static(path.join(__dirname)));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lamplight is running on http://localhost:${PORT}`);
  console.log(`Ollama: ${OLLAMA_BASE_URL} | model: ${OLLAMA_MODEL}`);
});
