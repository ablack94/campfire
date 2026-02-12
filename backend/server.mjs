import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

const channels = [
  { id: 'general', name: '# general' },
  { id: 'random', name: '# random' },
  { id: 'showcase', name: '# showcase' }
];

const messages = new Map(channels.map((channel) => [channel.id, []]));
const users = new Set();
const sseClients = new Set();

function sendSse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function broadcast(event) {
  for (const client of sseClients) {
    sendSse(client, event);
  }
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

async function serveStatic(res, path) {
  try {
    const filePath = path === '/' ? join(root, 'frontend', 'index.html') : join(root, 'frontend', path);
    const file = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeByExt[ext] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    notFound(res);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost:3000');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/channels') {
    json(res, 200, channels);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/messages/')) {
    const channelId = url.pathname.split('/').pop();
    json(res, 200, messages.get(channelId) ?? []);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    sseClients.add(res);
    sendSse(res, { type: 'presence', users: [...users] });
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/join') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const username = String(parsed.username || 'anonymous').slice(0, 32);
      users.add(username);
      broadcast({ type: 'presence', users: [...users] });
      json(res, 200, { ok: true, username });
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/message') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const channelId = String(parsed.channelId || 'general');
      const message = {
        id: crypto.randomUUID(),
        channelId,
        author: String(parsed.author || 'anonymous').slice(0, 32),
        content: String(parsed.content || '').slice(0, 400),
        timestamp: Date.now()
      };
      const bucket = messages.get(channelId);
      if (bucket) bucket.push(message);
      broadcast({ type: 'message', payload: message });
      json(res, 200, { ok: true });
    });
    return;
  }

  await serveStatic(res, url.pathname);
});

server.listen(3000, () => {
  console.log('Campfire clone running at http://localhost:3000');
});
