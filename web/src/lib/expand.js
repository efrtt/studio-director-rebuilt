// Expand the app's record panel to every record, using its own control.
//
// The panel has no pager links: the probe on the live page found 0 anchors, a
// heading of "4291 Items" and a "Show All" element at the end of the panel.
// Whatever that element does is the app's business, so we press it and watch
// the row count rather than invent a URL.
//
// A bare `.click()` was not enough on the live page, so pressing is a short
// ladder: jQuery's trigger (the app ships jQuery), a native click, then a full
// mouse sequence — on the label itself and on the link around or inside it.
// Each rung gets a moment to show growth before the next is tried. While that
// happens every XHR/fetch URL is recorded, so a control that quietly does
// nothing leaves evidence behind instead of a shrug.

import { RESULT_ITEM, SEARCH_SPAN } from '../model/appdom.js';

export const SHOW_ALL = /^show\s*all$/i;

export function showAllTrigger(root) {
  const panel = root.querySelector(SEARCH_SPAN);
  if (!panel) return null;

  const candidates = panel.querySelectorAll('a, span, button, div, p, label, li, td, input[type="button"]');
  for (const el of candidates) {
    // A container that merely holds the label is not the label.
    if (typeof el.querySelector === 'function' && el.querySelector(RESULT_ITEM)) continue;
    const text = (el.textContent || '').trim();
    if (!SHOW_ALL.test(text)) continue;
    return el;
  }
  return null;
}

export function countItems(root) {
  return root.querySelectorAll(SEARCH_SPAN + ' ' + RESULT_ITEM).length;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Record what the page asks for while a control is pressed. Restored on exit;
// if the page has already patched these, we leave its wrappers alone.
export function captureRequests(win) {
  const requests = [];
  const undo = [];
  if (!win) return { requests, restore() {} };

  const XHR = win.XMLHttpRequest;
  if (XHR && XHR.prototype && typeof XHR.prototype.open === 'function') {
    const open = XHR.prototype.open;
    const patched = function (method, url, ...rest) {
      try { requests.push({ kind: 'xhr', method: String(method).toUpperCase(), url: String(url) }); } catch (e) { /* ignore */ }
      return open.call(this, method, url, ...rest);
    };
    XHR.prototype.open = patched;
    undo.push(() => { XHR.prototype.open = open; });
  }

  const fetch = win.fetch;
  if (typeof fetch === 'function') {
    const patched = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        requests.push({ kind: 'fetch', method: String((init && init.method) || 'GET').toUpperCase(), url: String(url) });
      } catch (e) { /* ignore */ }
      return fetch.apply(this, arguments);
    };
    win.fetch = patched;
    undo.push(() => { win.fetch = fetch; });
  }

  return {
    requests,
    restore() {
      while (undo.length) {
        try { undo.pop()(); } catch (e) { /* ignore */ }
      }
    }
  };
}

// Everything a person might have pressed: the label, the link wrapping it and
// the link inside it.
function targetsFor(el) {
  const out = [el];
  try {
    const around = el.closest && el.closest('a, button');
    if (around && around !== el) out.push(around);
    const inside = el.querySelector && el.querySelector('a, button, span');
    if (inside && inside !== el) out.push(inside);
  } catch (e) { /* ignore */ }
  return out;
}

function press(el, win, how) {
  try {
    if (how === 'jquery') {
      const $ = win && win.jQuery;
      if (!$) return false;
      $(el).trigger('click');
      return true;
    }
    if (how === 'click') {
      el.click();
      return true;
    }
    // A full sequence: some handlers listen on mousedown, others need a
    // bubbling MouseEvent rather than whatever .click() produces.
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      const Ctor = type === 'pointerdown' && win.PointerEvent ? win.PointerEvent : win.MouseEvent;
      el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: win }));
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Wait until the row count stops moving (or the expected total arrives).
// Returns the last count seen.
async function settle(root, opts, baseline) {
  const { expect = null, wait = 20000, step = 150, stableTicks = 3 } = opts;
  let last = baseline;
  let stable = 0;
  const started = Date.now();
  while (Date.now() - started < wait) {
    await sleep(step);
    const now = countItems(root);
    if (now === last) {
      stable += 1;
      if (stable >= stableTicks) return last;
    } else {
      stable = 0;
      last = now;
    }
    if (expect && last >= expect) return last;
  }
  return last;
}

// Click, then wait until the row count stops moving. Resolves with what
// happened, never throws: a control that does nothing is a result too.
export async function expandInApp(root, opts = {}) {
  const win = opts.window || (typeof window !== 'undefined' ? window : null);
  const trigger = showAllTrigger(root);
  const before = countItems(root);
  if (!trigger) return { clicked: false, before, count: before, changed: false, tried: [], requests: [] };

  const capture = captureRequests(win);
  const tried = [];

  const done = (count) => ({
    clicked: true,
    before,
    count,
    changed: count > before,
    tried,
    requests: capture.requests
  });

  try {
    for (const el of targetsFor(trigger)) {
      for (const how of ['jquery', 'click', 'mouse']) {
        if (!press(el, win, how)) continue;

        const tag = String(el.tagName || 'el').toLowerCase();
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        tried.push(how + ':' + (el.id ? '#' + el.id : tag + cls));

        const sentBefore = capture.requests.length;
        let count = await settle(root, { ...opts, wait: opts.probeWait || 1500, stableTicks: 2 }, before);
        if (count > before) return done(await settle(root, opts, count));

        // This rung made the app ask for something: it is loading, just slower
        // than the probe. Give it the full window instead of pressing again and
        // firing a second request for the same data.
        if (capture.requests.length > sentBefore) {
          count = await settle(root, opts, before);
          return done(count);
        }
      }
    }
  } finally {
    capture.restore();
  }

  return { clicked: true, before, count: countItems(root), changed: false, tried, requests: capture.requests };
}
