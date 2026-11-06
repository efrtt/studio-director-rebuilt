// Minimal loopback static server. Usage: node tools/serve.mjs <root> <port>
//
// The one non-GET route is the parity probe's receipt: `POST /__parity/<label>`
// writes `<root>/web/parity/<label>.json`. The live page is https and this server
// is loopback, so the probe sends a `no-cors` POST and cannot read the answer —
// the file on disk is what `tools/parity.mjs compare` then reads. Only that path
// is writable, only on the loopback interface, only below `web/parity/`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4800);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const POST_LIMIT = 2 * 1024 * 1024;

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (req.method === 'POST' && rel.startsWith('/__parity/')) {
    const label = rel.slice('/__parity/'.length).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!label) { res.writeHead(400).end('bad label'); return; }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > POST_LIMIT) req.destroy();
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > POST_LIMIT) { res.writeHead(413).end('too big'); return; }
      const dir = path.join(root, 'web', 'parity');
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, label + '.json'), Buffer.concat(chunks));
      } catch (e) {
        res.writeHead(500).end('write failed');
        return;
      }
      res.writeHead(204).end();
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('no'); return; }
  const file = path.join(root, rel === '/' ? '/demo/week.html' : rel);
  if (!file.startsWith(root)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log('serving ' + root + ' on http://127.0.0.1:' + port));
