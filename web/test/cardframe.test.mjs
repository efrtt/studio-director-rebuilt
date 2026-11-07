// A card owns the only frame around its table.
//
// The Wii skin frames a `.sd-tablewrap` as a sheet, and the record card and the
// performance panel are cards too. Where the two meet, the wrapper's border and
// its rounded top corners used to land one pixel inside the card's own: the
// column headings read as a second, smaller card tucked under the panel header,
// and the two rims showed together at the corners. The fix is a rule, and a rule
// is easy to lose again in a stylesheet this long, so this pins it twice: no
// selector may frame a wrapper that sits in a card, and each card must flatten
// the sheet it contains in the stylesheet that outranks the generic frame.
//
// It reads the CSS as text rather than rendering it: the answer being guarded is
// "which declarations apply", and that is a question about the source.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (name) => fs.readFileSync(path.join(here, '..', 'src', name), 'utf8');

const SHEETS = { 'styles.css': src('styles.css'), 'wii.css': src('wii.css'), 'acnh.css': src('acnh.css') };

// A container that draws a frame of its own: the record list, the event page's
// performance panel, and every other card in the skin.
const CARD = /\.sd-(recordcard|perf|paycard|dayblock|monthgrid|card|insightcard|chart|attcol)(?![\w-])/;
// The two wrappers a table is scrolled by. `.sd-perfwrap` is the panel's own
// name for the same element, so it has to be caught as well.
const WRAPPER = /\.sd-(tablewrap|perfwrap)(?![\w-])/;

const FRAME_PROPS = [
  /^border(-(top|right|bottom|left))?(-(width|style|color))?$/,
  /^border-(start|end)-(start|end)-radius$/,
  /^border-radius$/,
  /^border-(top|bottom)-(left|right)-radius$/,
  /^box-shadow$/,
  /^outline$/,
  /^outline-width$/,
  /^background$/,
  /^background-color$/,
  /^background-image$/
];

/** Every `selector { declarations }` pair in a stylesheet. Rules inside @media
 *  blocks are found on their own, which is what this needs: a conditional frame
 *  is still a frame. */
function rules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let hit;
  while ((hit = re.exec(text))) {
    const selector = hit[1].replace(/\s+/g, ' ').trim();
    if (!selector || selector.startsWith('@')) continue;
    const decls = [];
    for (const chunk of hit[2].split(';')) {
      const at = chunk.indexOf(':');
      if (at < 0) continue;
      const prop = chunk.slice(0, at).trim().toLowerCase();
      const raw = chunk.slice(at + 1).trim();
      if (!prop) continue;
      decls.push([prop, raw.replace(/\s*!important\s*$/i, '').trim()]);
    }
    out.push({ selector, decls });
  }
  return out;
}

const value = (rule, prop) => rule.decls.find(([p]) => p === prop)?.[1]?.toLowerCase() ?? '';

/** A frame is anything that would draw an edge or a corner. Only an explicit
 *  nothing counts: `border: 0`, `border-radius: 0`, `box-shadow: none`,
 *  `background: transparent`. Anything else is a frame the wrapper should not
 *  be drawing inside a card. */
const drawsNothing = (v) => {
  const t = v.trim();
  if (t === '') return true;
  if (t === 'none' || t === 'transparent') return true;
  if (/^0(px|em|rem|%)?$/.test(t)) return true;
  return false;
};

/** Selectors that both put a wrapper in a card and dress that wrapper. */
function framedInCards(css) {
  return rules(css).filter((rule) => CARD.test(rule.selector) && WRAPPER.test(rule.selector)).filter((rule) => {
    return rule.decls.some(([prop, v]) => FRAME_PROPS.some((re) => re.test(prop)) && !drawsNothing(v));
  });
}

test('no rule frames a table wrapper that sits inside a card', () => {
  for (const [name, css] of Object.entries(SHEETS)) {
    const bad = framedInCards(css);
    assert.deepEqual(
      bad.map((r) => `${name}: ${r.selector} { ${r.decls.map(([p, v]) => `${p}: ${v}`).join('; ')} }`),
      [],
      'a card inside a card is the bug this suite exists for'
    );
  }
});

test('the guard would notice a second frame', () => {
  // The suite is a text check, so it has to be shown to fail on the thing it
  // guards. This is the rule the record card used to inherit from the skin.
  const bad = framedInCards(`
    .sd-recordcard .sd-tablewrap { border: 1px solid #ccc; border-radius: 18px; }
    html[data-sd-theme="wii"] #sd-root .sd-perf > .sd-tablewrap { box-shadow: inset 0 1px 0 #fff; }
    .sd-recordcard .sd-tablewrap { margin: 0; }
  `);
  assert.equal(bad.length, 2);
  // And it stays quiet about a wrapper that is merely moved or made scrollable.
  assert.deepEqual(framedInCards('.sd-recordcard .sd-tablewrap { margin: 0; overflow: auto; }'), []);
});

test('every card flattens the sheet it contains', () => {
  // Base: the record list's sheet, and the performance panel's, both named for
  // their own card so nothing else that scrolls a table becomes borderless.
  const base = rules(SHEETS['styles.css']);
  const flat = (selectors) => selectors.every((selector) => {
    const rule = base.find((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));
    if (!rule) return false;
    return drawsNothing(value(rule, 'border')) && drawsNothing(value(rule, 'border-radius'));
  });
  assert.equal(flat(['.sd-recordcard .sd-tablewrap']), true, 'the record card flattens its sheet');
  assert.equal(
    base.some((r) => r.selector.includes('.sd-perfwrap') && drawsNothing(value(r, 'border')) && drawsNothing(value(r, 'border-radius'))),
    true,
    'the performance panel flattens its sheet'
  );

  // Under the skin the generic `.sd-tablewrap` rule is id-scoped, so it outranks
  // the base rules above. The skin therefore has to flatten each pair itself.
  const wii = rules(SHEETS['wii.css']);
  const skin = (selector) => wii.find((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));
  for (const selector of [
    'html[data-sd-theme="wii"] #sd-root .sd-perf > .sd-tablewrap',
    'html[data-sd-theme="wii"] #sd-root .sd-recordcard > .sd-tablewrap'
  ]) {
    const rule = skin(selector);
    assert.ok(rule, selector + ' exists');
    for (const prop of ['border', 'border-radius', 'box-shadow', 'background']) {
      assert.equal(drawsNothing(value(rule, prop)), true, `${selector} flattens ${prop}`);
    }
  }

  // The Island theme's wrapper rule carries an id too, so it has to flatten the
  // same two pairs in its own sheet, or the cream sheet gets a cream rim inside
  // the cream card.
  const acnh = rules(SHEETS['acnh.css']);
  const island = (selector) => acnh.find((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));
  for (const selector of [
    'html[data-sd-theme="acnh"] #sd-root .sd-perf > .sd-tablewrap',
    'html[data-sd-theme="acnh"] #sd-root .sd-recordcard > .sd-tablewrap'
  ]) {
    const rule = island(selector);
    assert.ok(rule, selector + ' exists');
    for (const prop of ['border', 'border-radius', 'box-shadow', 'background']) {
      assert.equal(drawsNothing(value(rule, prop)), true, `${selector} flattens ${prop}`);
    }
  }
});

test('the cards clip, so the sheet header takes the card corners', () => {
  // Flattening the wrapper leaves the header band square. The card has to clip it
  // or the corners poke out as notches.
  for (const [name, css] of Object.entries(SHEETS)) {
    for (const card of ['.sd-perf', '.sd-recordcard']) {
      const clips = rules(css).some((rule) => {
        const selectors = rule.selector.split(',').map((s) => s.trim());
        return selectors.some((s) => s === card || s.endsWith(' ' + card)) && value(rule, 'overflow') === 'hidden';
      });
      assert.equal(clips, true, `${name}: ${card} clips what it frames`);
    }
  }
});

test('the markup still puts a sheet inside each of those cards', () => {
  // The rules above are keyed to these two shapes. If a card stops wrapping a
  // sheet (or a sheet gains a card), the stylesheets need looking at again.
  const perf = fs.readFileSync(path.join(here, '..', 'src', 'components', 'PerfTable.svelte'), 'utf8');
  assert.match(perf, /class="sd-tablewrap sd-perfwrap"/, 'the panel scrolls its table in its own wrapper');
  assert.match(perf, /class="sd-perf"/);

  const record = fs.readFileSync(path.join(here, '..', 'src', 'components', 'RecordPage.svelte'), 'utf8');
  const cards = record.match(/class="sd-recordcard"[\s\S]{0,120}?class="sd-tablewrap"/g) || [];
  assert.equal(cards.length, (record.match(/class="sd-recordcard"/g) || []).length, 'every record card wraps a sheet directly');
});
