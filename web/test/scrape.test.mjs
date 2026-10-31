/*
 * Tests for tools/scrape-all.js, the console crawler.
 *
 * The crawler is a paste-in browser script, so it is exercised the way it runs:
 * shoved into a vm context that has the browser globals it reads, with linkedom
 * standing in for the DOM and a stub fetch standing in for the app.
 *
 * What these tests are really protecting:
 *   - no cell text escapes (the crawl must never contain a name or a balance)
 *   - one request per *page shape*, not per record
 *   - anything that looks like it deletes/charges/emails is never fetched
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';

const here = path.dirname(fileURLToPath(import.meta.url));
const toolPath = path.join(here, '..', 'tools', 'scrape-all.js');
const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', name), 'utf8');

const ORIGIN = 'https://app.thestudiodirector.com';
const ADMIN = ORIGIN + '/studio1/admin.sd';

function makeContext({ html, url, fetchImpl } = {}) {
  const startUrl = url || ADMIN + '?page=EditClass&cident=101&clicktab=Classes';
  const document = new DOMParser().parseFromString(
    html || fixture('edit-class.html'), 'text/html'
  );
  const location = new URL(startUrl);

  const sandbox = {
    document,
    location,
    URL,
    DOMParser,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Blob: class Blob {
      constructor(parts) { this.parts = parts; }
    },
    fetch: fetchImpl || (async () => { throw new Error('fetch not expected'); })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(toolPath, 'utf8'), sandbox, { filename: 'scrape-all.js' });
  return sandbox;
}

const api = (sandbox) => sandbox.sdScrape;

/* ------------------------------- describing ------------------------------- */

test('an editor page is described by its tabs, panels and controls', () => {
  const ctx = makeContext();
  const desc = api(ctx).describeDoc(ctx.document, ctx.location.href);

  assert.equal(desc.kind, 'record+list');
  assert.equal(desc.page, 'EditClass');
  // Arrays built inside the script's realm are copied before comparing.
  assert.deepEqual(Array.from(desc.params), ['cident', 'clicktab', 'page']);

  assert.deepEqual(Array.from(desc.tabs, (t) => t.label), ['Overview', 'Enrollment', 'Skills', 'Calendar']);
  assert.equal(desc.tabs[0].selected, true);
  assert.equal(desc.tabs[1].selected, false);

  // Subpages ship hidden in the page, so one fetch sees all four.
  assert.equal(desc.panels.length, 4);
  assert.equal(desc.panels[0].visible, true);
  assert.equal(desc.panels[1].visible, false);
  assert.ok(desc.panels[1].rows > 0, 'the Enrollment panel carries its own table');

  // The page's action buttons are named, including the JS-driven ones.
  const labels = desc.actions.map((a) => a.label);
  assert.ok(labels.includes('Save'));
  assert.ok(labels.includes('Enrollment') === false);
  const save = desc.actions.find((a) => a.id === 'save');
  assert.equal(save.js, true, 'a save link with no href is flagged as app-driven');
});

test('the crawl carries no cell text, only the app\'s own labels', () => {
  const ctx = makeContext();
  const desc = api(ctx).describeDoc(ctx.document, ctx.location.href);
  const blob = JSON.stringify(desc);

  assert.ok(desc.tables.some((t) => t.headings.length > 0), 'column labels are kept');
  // Record labels live in the panel and inside table cells; neither is read.
  assert.equal(blob.includes('Ballet III - Mon 4:00p'), false);
  assert.equal(blob.includes('Jazz I - Tue 5:30p'), false);
  assert.equal(desc.counts.rows > 0, true);
});

test('the week calendar is recognised, and a plain page is not', () => {
  const weekUrl = ADMIN + '?page=CalendarPage&clicktab=Class+Calendar';
  const week = makeContext({ html: fixture('calendar-page.html'), url: weekUrl });
  assert.equal(api(week).describeDoc(week.document, weekUrl).kind, 'week');

  const plainUrl = ADMIN + '?page=AdminHome';
  const plain = makeContext({
    html: '<form id="idForm"><div class="contentContainer"><div class="Content"><div class="formTitle">Settings</div></div></div></form>',
    url: plainUrl
  });
  assert.equal(api(plain).describeDoc(plain.document, plainUrl).kind, 'page');
});

/* --------------------------------- shapes --------------------------------- */

test('one shape per screen, not per record', () => {
  const ctx = makeContext();
  const shape = api(ctx).shapeOf;

  assert.equal(shape(ADMIN + '?page=EditClass&cident=101'), shape(ADMIN + '?page=EditClass&cident=999'));
  assert.equal(shape(ADMIN + '?page=EditClass&cident=101&searchidx=0'), shape(ADMIN + '?page=EditClass&cident=101'));
  assert.notEqual(shape(ADMIN + '?page=EditClass&cident=101'), shape(ADMIN + '?page=EditFamily&fident=101'));
  assert.equal(shape(ADMIN + '?page=EditClass&cident=101'), 'EditClass(cident)');
  assert.equal(shape(ADMIN + '?page=NewStudent'), 'NewStudent');
});

test('nothing that deletes, charges or emails is ever a crawl target', () => {
  const ctx = makeContext();
  const safe = api(ctx).safeTarget;

  assert.equal(safe(ADMIN + '?page=EditClass&cident=5', ctx.location.href).unsafe, false);
  assert.equal(safe(ADMIN + '?page=DeleteFamily&fident=5', ctx.location.href).unsafe, true);
  assert.equal(safe(ADMIN + '?page=SendEmail&cident=5', ctx.location.href).unsafe, true);
  assert.equal(safe(ADMIN + '?page=ProcessPayment&fident=5', ctx.location.href).unsafe, true);

  // A compose screen is a GET, and the crawl should map it rather than skip it.
  // The billing landing page is navigation, not a charge.
  assert.equal(safe(ADMIN + '?page=EmailClass&cident=5', ctx.location.href).unsafe, false);
  assert.equal(safe(ADMIN + '?page=ChargesHome&clicktab=Charges', ctx.location.href).unsafe, false);

  assert.equal(safe('javascript:void(0)', ctx.location.href), null);
  assert.equal(safe('#', ctx.location.href), null);
  assert.equal(safe('https://evil.example/admin.sd?page=HomePage', ctx.location.href), null);
  assert.equal(safe('/studio1/reports.html', ctx.location.href), null);
});

/* --------------------------------- crawling -------------------------------- */

test('{ all: true } follows the dangerous names but never the sign-out page', async () => {
  const entry = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Home</div>
    <a href="admin.sd?page=DeleteFamily&fident=7">Delete this family</a>
    <a href="admin.sd?page=SendEmail&cident=5">Email the class</a>
    <a href="admin.sd?page=Logout">Log out</a>
  </div></div></form>`;

  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(url);
    return {
      ok: true,
      url,
      text: async () => '<form id="idForm"><div class="contentContainer"><div class="Content">'
        + '<div class="formTitle">Page</div></div></div></form>'
    };
  };

  const ctx = makeContext({ html: entry, url: ADMIN + '?page=HomePage', fetchImpl });
  const result = await api(ctx).crawl({ max: 20, delay: 0, all: true });

  // The opt-in covers the destructive names...
  assert.equal(fetched.some((u) => /page=DeleteFamily/.test(u)), true);
  assert.equal(fetched.some((u) => /page=SendEmail/.test(u)), true);
  assert.equal(result.pages.some((p) => p.shape.startsWith('DeleteFamily') && p.risky), true);
  assert.ok(result.followedRisky.length >= 2, 'each risky link is written down');

  // ...but never the sign-out page: following it would end the crawl's session.
  assert.equal(fetched.some((u) => /page=Logout/.test(u)), false);
  assert.equal(api(ctx).safeTarget(ADMIN + '?page=Logout', ctx.location.href).never, true);
});

test('a crawl visits each page shape once and records what it refused', async () => {
  const entry = `<!DOCTYPE html><html><body><form id="idForm">
    <div id="sideNavBar">
      <a class="sideNavLink" href="admin.sd?page=NewClass&clicktab=Classes">ClassesClasses</a>
      <a class="sideNavLink" href="admin.sd?page=ChargesHome&clicktab=Charges">ChargesCharges</a>
    </div>
    <div class="contentContainer"><div class="Content">
      <div class="formTitle">Home</div>
      <a href="admin.sd?page=NewClass&clicktab=Classes">Classes</a>
      <a href="admin.sd?page=EditClass&amp;cident=101">Ballet III</a>
      <a href="admin.sd?page=EditClass&amp;cident=102">Jazz I</a>
      <a href="admin.sd?page=EditFamily&amp;fident=7">Abedini</a>
      <a href="admin.sd?page=DeleteFamily&fident=7">Delete this family</a>
    </div></div>
  </form></body></html>`;

  const pages = {
    NewClass: fixture('editor-class.html'),
    EditClass: fixture('edit-class.html'),
    EditFamily: fixture('edit-family.html')
  };
  const fetched = [];

  // Every other page the rail links to answers with an empty shell, the way a
  // genuine but uninteresting page would: the crawl records it and moves on.
  const emptyPage = '<form id="idForm"><div class="contentContainer"><div class="Content">'
    + '<div class="formTitle">Page</div></div></div></form>';

  const fetchImpl = async (url) => {
    fetched.push(url);
    const page = new URL(url).searchParams.get('page');
    const html = pages[page] || emptyPage;
    return { ok: true, url, text: async () => html };
  };

  const ctx = makeContext({ html: entry, url: ADMIN + '?page=HomePage', fetchImpl });
  const result = await api(ctx).crawl({ max: 20, delay: 0 });

  // Every shape in the map was fetched once; the entry page was described, not fetched.
  const shapes = result.pages.map((p) => p.shape);
  assert.equal(new Set(shapes).size, shapes.length, 'no shape is described twice');
  assert.equal(fetched.length, shapes.length - 1, 'one request per shape, entry included free');
  assert.equal(result.errors.length, 0);

  // Two class links, one class shape: the second record is not re-fetched.
  assert.ok(shapes.includes('NewClass'));
  assert.ok(shapes.some((s) => s.startsWith('EditClass(')), 'the class editor is a shape');
  assert.ok(shapes.some((s) => s.startsWith('EditFamily(')), 'the family editor is a shape');
  assert.equal(fetched.filter((u) => /page=EditClass/.test(u)).length, 1);

  // A destructive link is named and never requested.
  assert.ok(result.skipped.some((s) => s.page === 'DeleteFamily'));
  assert.equal(fetched.some((u) => /Delete/.test(u)), false);
  // The billing landing page is navigation, so it is crawled like any other.
  assert.ok(shapes.includes('ChargesHome'));

  assert.equal(result.counts.byKind.list >= 1, true);
  // The rail is followed too: an empty shell page is a shape worth recording.
  assert.ok(shapes.includes('AdminHome'));
  assert.ok(result.pages.some((p) => p.title === 'Page'));
});

test('a capped crawl leaves a queue, and the next call continues it', async () => {
  const entry = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Home</div>
    <a href="admin.sd?page=NewClass">Classes</a>
    <a href="admin.sd?page=NewFamily">Families</a>
    <a href="admin.sd?page=NewStudent">Students</a>
    <a href="admin.sd?page=NewInstructor">Instructors</a>
  </div></div></form>`;

  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(url);
    return {
      ok: true,
      url,
      text: async () => '<form id="idForm"><div class="contentContainer"><div class="Content">'
        + '<div class="formTitle">Page</div></div></div></form>'
    };
  };

  const ctx = makeContext({ html: entry, url: ADMIN + '?page=HomePage', fetchImpl });

  const first = await api(ctx).crawl({ max: 1, delay: 0 });
  assert.equal(first.pages.length, 2, 'the entry page plus one fetch');
  assert.equal(first.stoppedEarly, true);
  assert.equal(first.remaining, 3);
  assert.equal(first.pending.length, 3, 'the leftover shapes are written down');

  const second = await api(ctx).crawl({ max: 10, delay: 0 });
  assert.equal(second.pages.length, 5, 'the three queued shapes were visited, not re-collected');
  assert.equal(second.stoppedEarly, false);
  assert.equal(second.pending.length, 0);
  assert.equal(fetched.length, 4, 'each shape fetched once across both runs');
  assert.equal(new Set(second.pages.map((p) => p.shape)).size, second.pages.length);

  // Starting over is explicit, never the default.
  const fresh = await api(ctx).crawl({ max: 1, delay: 0, fresh: true });
  assert.equal(fresh.pages.length, 2, 'a fresh crawl forgets the previous map');
});

test('a failed fetch is recorded, not thrown', async () => {
  const entry = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <a href="admin.sd?page=ReportsHome">Reports</a></div></div></form>`;
  const ctx = makeContext({
    html: entry,
    url: ADMIN + '?page=HomePage',
    fetchImpl: async () => ({ ok: false, status: 500, url: ADMIN, text: async () => '' })
  });

  const result = await api(ctx).crawl({ max: 5, delay: 0 });
  assert.equal(result.pages.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].error, /HTTP 500/);
});
