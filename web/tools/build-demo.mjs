// Self-contained demo pages: each fixture inlined as inert text, plus the built
// bundle. No network, no fixture fetch, works from disk.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');
const bundle = fs.readFileSync(path.join(root, 'dist/sd.js'), 'utf8');

const PAGES = [
  { fixture: 'calendar-page.html', out: 'demo/week.html', title: 'week calendar' },
  { fixture: 'editor-class.html', out: 'demo/classes.html', title: 'classes list' },
  { fixture: 'editor-family.html', out: 'demo/families.html', title: 'families list' },
  { fixture: 'editor-student.html', out: 'demo/students.html', title: 'students list' },
  { fixture: 'confirmation.html', out: 'demo/confirmation.html', title: 'saved' },
  { fixture: 'search-results.html', out: 'demo/search.html', title: 'search results' },
  { fixture: 'index-charges.html', out: 'demo/index.html', title: 'landing page' },
  { fixture: 'task-email-group.html', out: 'demo/task.html', title: 'mail form' },
  { fixture: 'sheet-roster.html', out: 'demo/sheet.html', title: 'print sheet' },
  { fixture: 'settings-search.html', out: 'demo/settings.html', title: 'settings' },
  { fixture: 'report-roster.html', out: 'demo/report.html', title: 'report filters' },
  { fixture: 'report-results.html', out: 'demo/report-results.html', title: 'report results' },
  // Record page: no standalone demo (the rebuilt app defers to the app here),
  // but it does get a live page to prove that deferral end to end.
  { fixture: 'edit-class.html', out: null, title: 'edit class' },
  { fixture: 'edit-family.html', out: null, title: 'edit family' },
  { fixture: 'edit-student.html', out: null, title: 'edit student' }
];

const read = (name) => fs.readFileSync(path.join(root, 'test/fixtures', name), 'utf8')
  .replace(/<\/script/gi, '<\\/script');

for (const page of PAGES) {
  if (!page.out) continue;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Studio Director ${page.title} — rebuilt UI (demo)</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.45 system-ui, sans-serif; }
</style>
</head>
<body>
<!-- The page the adapters parse. Inert: never executed, never rendered. -->
<script type="text/plain" id="source-page">${read(page.fixture)}</script>
<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>
<script>
  var model = SD.modelFromHtml(document.getElementById('source-page').textContent, location.href);
  SD.mount({
    model: model,
    state: model.view ? 'ready' : 'none',
    // The demo's inert fixture has no app search to drive, but the box exists.
    onSearch: SD.searchEverything
  });
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, page.out), html);
  console.log(page.out, html.length, 'bytes');
}

// The demo server's root is this folder, so the userscript the pages reference
// has to exist here too. It is the same built file, copied rather than written
// twice: the real artifact stays next to README.md at the repo root.
const userscript = path.resolve(root, '..', 'studio-director-rebuilt.user.js');
if (fs.existsSync(userscript)) {
  fs.copyFileSync(userscript, path.join(root, 'studio-director-rebuilt.user.js'));
  console.log('studio-director-rebuilt.user.js (copied for the demo server)');
}

// The same fixtures as real pages, with the built userscript attached: this is
// the actual deployment path (GET the page, parse it, cover it), not a stub.
for (const page of PAGES) {
  const body = fs.readFileSync(path.join(root, 'test/fixtures', page.fixture), 'utf8');
  const html = body.replace('</body>', '  <script src="/studio-director-rebuilt.user.js"></script>\n</body>');
  const out = 'demo/live-' + page.fixture.replace('calendar-page', 'week').replace('editor-', '') + '';
  fs.writeFileSync(path.join(root, out), html);
  console.log(out, html.length, 'bytes');
}
