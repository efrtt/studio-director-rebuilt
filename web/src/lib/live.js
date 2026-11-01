// The live page's model, once the app has drawn whatever it was going to draw.
//
// `SearchResults` and the Enroll step proved the pattern: for a JS-built screen
// the fetched HTML is an empty shell, and only the live DOM has the controls.
// Reading it immediately would catch the page mid-render, hence the wait.
//
// This lived in `main.js`, where the loop could only be checked by hand in a
// browser: a timer and a re-read are exactly the kind of thing a fixture cannot
// reach. The decisions stay in `choose.js` (`hasReadyView` says which views end
// the wait); what moves here is the waiting, with the clock injectable so a test
// can drive it without sleeping for real.

import { readPage } from './page.js';
import { hasReadyView } from './choose.js';

const STEP_MS = 120;
const WAIT_MS = 1500;

export async function readLiveView(doc, href, opts = {}) {
  const maxWait = opts.maxWait === undefined ? WAIT_MS : opts.maxWait;
  const step = opts.step === undefined ? STEP_MS : opts.step;
  const now = opts.now || (() => Date.now());
  const sleep = opts.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  // The common case costs nothing: a page a reader already claims is returned
  // before the first tick, so no screen pays a wait it did not need.
  const first = readPage(doc, href);
  if (hasReadyView(first)) return first;

  const started = now();
  while (now() - started < maxWait) {
    await sleep(step);
    const next = readPage(doc, href);
    if (hasReadyView(next)) return next;
  }
  return null;
}
