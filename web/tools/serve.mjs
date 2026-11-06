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

const server = http.createServer((req, res) => {
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
    res.writeHead(200, {
      'content-type': types[path.extname(file)] || 'application/octet-stream',
      'content-length': buf.length
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
});

// A port already in use is what leaves a second, stale server behind on this machine,
// so it is one line and a non-zero exit rather than a stack trace nobody reads.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('port ' + port + ' is already in use: stop whatever is serving it, or start on another port');
  } else {
    console.error((err.code || 'error') + ' on port ' + port + ': ' + err.message);
  }
  process.exit(1);
});

// Ready means the server answered, not that it bound: ask it for the artefact and say
// which build it will hand out, because "is the server up" and "is my build there" are
// the two questions this server is started to answer.
//
// The line is JSON after a fixed prefix so a script can wait on it instead of sleeping
// and hoping: `until grep -qm1 '^ready ' log; do sleep 0.1; done`, then parse the rest.
// `artefact` is null when the root has no build in it, which is not the same as the
// server being down and is the case a caller has to notice before it injects anything.
const ARTEFACT = 'studio-director-rebuilt.user.js';

server.listen(port, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + port + '/' + ARTEFACT;
  const ready = { root, url: 'http://127.0.0.1:' + port + '/', artefact: null, version: null };
  let answer;
  try {
    answer = await fetch(url, { method: 'HEAD' });
  } catch (e) {
    console.error('not ready: the server did not answer itself: ' + e.message);
    process.exit(1);
  }
  if (answer.ok) {
    ready.artefact = url;
    try {
      const head = fs.readFileSync(path.join(root, ARTEFACT), 'utf8').slice(0, 4000);
      ready.version = (/@version\s+(\S+)/.exec(head) || [])[1] || null;
    } catch (e) {
      ready.version = null;
    }
  }
  console.log('ready ' + JSON.stringify(ready));
});
