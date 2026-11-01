/*
 * Tests for src/lib/probe.js — the in-page measurement that classifies the
 * screens a plain GET cannot.
 *
 * The numbers here are the ones that decide which reader owns a page: controls
 * make it a form, rows make it a table, links make it a menu, and what is left
 * is a notice. The same thresholds are in `readNote` and in the crawl map.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import {
  measure, record, dump, clear, probeEnabled, shapeOf, probeTick, recordView
} from '../src/lib/probe.js';

const fakeStore = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
};

const docOf = (html) => new DOMParser().parseFromString(html, 'text/html');

const formHtml = `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="formTitle">Edit Class</div>
  <input id="a"><input id="b"><select id="c"><option>1</option></select>
  <table class="Form"><tr><th>H</th></tr>
    <tr><td>1</td></tr><tr><td>2</td></tr><tr><td>3</td></tr></table>
  <a class="Btn" href="x">One</a><a href="y">Two</a>
  <p>Some instruction text.</p>
</div></div></form>`;

test('measure counts what decides the reader', () => {
  const m = measure(docOf(formHtml));
  assert.equal(m.controls, 3);
  assert.equal(m.rows, 3);
  assert.equal(m.links, 2);
  assert.equal(m.buttons, 1);
  assert.equal(m.title, 'Edit Class');
  assert.ok(m.text > 0);
});

test('a shape keeps the crawl notation, and ignores navigation parameters', () => {
  assert.equal(shapeOf('https://app.thestudiodirector.com/studio1/admin.sd?page=EmailClass&cident=123'), 'EmailClass(cident)');
  assert.equal(shapeOf('https://app.thestudiodirector.com/studio1/admin.sd?page=AddStudentMakeup&meth=add&tid=9'), 'AddStudentMakeup(meth,tid)');
  assert.equal(shapeOf('https://app.thestudiodirector.com/studio1/admin.sd?page=HomePage&clicktab=1'), 'HomePage');
  assert.equal(shapeOf('not a url at all'), '');
});

test('the probe is off until it is asked for, and can be switched off again', () => {
  const store = fakeStore();
  assert.equal(probeEnabled('admin.sd?page=HomePage', store), false);

  assert.equal(probeEnabled('admin.sd?page=HomePage&sdprobe=1', store), true);
  // The flag survives navigation, so one visit arms the rest of the session.
  assert.equal(probeEnabled('admin.sd?page=ManageWidgets', store), true);
  assert.equal(probeEnabled('admin.sd?page=ManageWidgets&sdprobe=0', store), false);
  assert.equal(probeEnabled('admin.sd?page=ManageWidgets', store), false);
});

test('record keeps one row per shape and only ever raises the numbers', () => {
  const store = fakeStore();
  record({ shape: 'AddMultiplePayments', url: 'u1', controls: 0, buttons: 0, rows: 0, links: 1, text: 915, title: 'Add Multiple Payments' }, store);
  const second = record({ shape: 'AddMultiplePayments', url: 'u1', controls: 2, buttons: 1, rows: 0, links: 1, text: 90 }, store);

  assert.equal(second.samples, 2);
  assert.equal(second.controls, 2, 'the later look raised it');
  assert.equal(second.text, 915, 'and did not lower the text');
  assert.equal(second.title, 'Add Multiple Payments');

  record({ shape: 'ManageWidgets', url: 'u2', controls: 0, links: 3, text: 734 }, store);
  const log = JSON.parse(dump(store));
  assert.deepEqual(Object.keys(log).sort(), ['AddMultiplePayments', 'ManageWidgets']);
});

test('a damaged log is treated as empty rather than thrown', () => {
  const store = fakeStore();
  store.setItem('sd.probe.log', '{not json');
  assert.deepEqual(JSON.parse(dump(store)), {});
  const written = record({ shape: 'HomePage', controls: 1 }, store);
  assert.equal(written.shape, 'HomePage');
  clear(store);
  assert.deepEqual(JSON.parse(dump(store)), {});
});

/*
 * The second half of the measurement: what the rebuild did about the page. A
 * walk over the unverified screens leaves a verdict per shape in the log rather
 * than nine impressions, and the verdict has to sit beside the numbers rather
 * than replace them.
 */
test('the routing outcome is recorded beside the measurement', () => {
  const store = fakeStore();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'location');
  globalThis.location = {
    href: 'https://app.thestudiodirector.com/studio1/admin.sd?page=EmailClass&cident=1&sdprobe=1'
  };
  try {
    assert.equal(probeEnabled(globalThis.location.href, store), true, 'the visit armed it');
    record({ shape: 'EmailClass(cident)', controls: 2, links: 5, text: 86, title: 'Email Class' }, store);

    const first = recordView(null, 'app', store);
    assert.equal(first.view, null, 'no view mounted');
    assert.equal(first.source, 'app', 'the app kept the page');
    assert.equal(first.controls, 2, 'the measurement survives');
    assert.equal(first.title, 'Email Class');

    // A later visit to the same shape replaces the verdict, not the numbers.
    recordView('index', 'live', store);
    const log = JSON.parse(dump(store));
    assert.equal(log['EmailClass(cident)'].view, 'index');
    assert.equal(log['EmailClass(cident)'].source, 'live');
    assert.equal(log['EmailClass(cident)'].links, 5);
  } finally {
    if (had) delete globalThis.location;
  }
});

test('the delayed second look does not erase the routing verdict', () => {
  // Found by walking eleven screens live: every entry read `view: null`, including
  // pages the rebuild had mounted, because `record` rebuilt the entry from scratch
  // 2.5 s after `recordView` had written the verdict into it.
  const store = fakeStore();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'location');
  globalThis.location = {
    href: 'https://app.thestudiodirector.com/studio1/admin.sd?page=ChargesHome&clicktab=1&sdprobe=1'
  };
  try {
    record({ shape: 'ChargesHome', controls: 0, links: 18, text: 779 }, store);
    recordView('index', 'live', store);

    const again = record({ shape: 'ChargesHome', controls: 1, links: 18, text: 900 }, store);
    assert.equal(again.view, 'index', 'the verdict survives the second look');
    assert.equal(again.source, 'live');
    assert.equal(again.text, 900, 'and the numbers still take the later look');
    assert.equal(again.controls, 1);

    const log = JSON.parse(dump(store));
    assert.equal(log.ChargesHome.view, 'index');
    assert.equal(log.ChargesHome.source, 'live');
  } finally {
    if (had) delete globalThis.location;
  }
});

test('nothing is recorded when the probe is not armed', () => {
  const store = fakeStore();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'location');
  globalThis.location = {
    href: 'https://app.thestudiodirector.com/studio1/admin.sd?page=EmailClass&cident=1'
  };
  try {
    assert.equal(recordView('index', 'fetched', store), null);
    assert.deepEqual(JSON.parse(dump(store)), {});
  } finally {
    if (had) delete globalThis.location;
  }
});

test('one tick per page load, and it records what is on the page', () => {
  const store = fakeStore();
  const hadStorage = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  globalThis.localStorage = store;
  globalThis.__sdProbeTick = undefined;
  try {
    const doc = docOf(formHtml);
    assert.equal(probeTick(doc, 'admin.sd?page=EditClass&cident=1&sdprobe=1'), 'EditClass(cident)');
    assert.equal(probeTick(doc, 'admin.sd?page=EditClass&cident=1&sdprobe=1'), null, 'already measured this load');

    const log = JSON.parse(dump(store));
    assert.equal(log['EditClass(cident)'].controls, 3);
    assert.equal(log['EditClass(cident)'].rows, 3);

    // The handle a console can actually reach: `SD` is not global inside the
    // userscript's wrapper, so the probe publishes its own.
    assert.equal(typeof globalThis.sdProbe.dump, 'function');
    assert.equal(globalThis.sdProbe.log()['EditClass(cident)'].controls, 3);
  } finally {
    globalThis.__sdProbeTick = undefined;
    delete globalThis.sdProbe;
    if (hadStorage) delete globalThis.localStorage;
  }
});
