// The theme preference and the per-view layout table.
//
// Both are small, and both are the kind of thing that is easy to get subtly wrong
// in a way no screenshot catches: an unknown stored value silently becoming
// `undefined`, `auto` resolving to the wrong side, or a layout knob leaking into a
// page that carries no list to split.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THEMES, THEME_LABEL, readTheme, writeTheme, nextTheme, themeName, applyTheme
} from '../src/lib/theme.js';
import { LAYOUT, DEFAULT_LAYOUT, layoutFor } from '../src/views/layout.js';

const fakeStore = () => ({
  map: new Map(),
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; },
  setItem(k, v) { this.map.set(k, String(v)); }
});

test('a fresh install gets the Wii skin on this branch', () => {
  assert.equal(readTheme(fakeStore()), 'wii');
  // A stored value from some future or broken version is not trusted.
  const bad = fakeStore();
  bad.setItem('sd.theme', 'solarized');
  assert.equal(readTheme(bad), 'wii');
  // No storage at all (private mode) is still a usable answer.
  assert.equal(readTheme(null), 'wii');
  // A real choice from before the skin existed is still honoured.
  const dark = fakeStore();
  dark.setItem('sd.theme', 'dark');
  assert.equal(readTheme(dark), 'dark');
  // Including the newest theme: a stored `acnh` is a theme, so it is read back.
  const island = fakeStore();
  island.setItem('sd.theme', 'acnh');
  assert.equal(readTheme(island), 'acnh');
});

test('the choice is remembered, and only a real choice is stored', () => {
  const store = fakeStore();
  assert.equal(writeTheme('light', store), true);
  assert.equal(readTheme(store), 'light');
  assert.equal(writeTheme('purple', store), false, 'not a theme');
  assert.equal(readTheme(store), 'light', 'and the old one survives');
});

test('one button cycles all five, and wraps', () => {
  let theme = 'wii';
  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    theme = nextTheme(theme);
    seen.push(theme);
  }
  assert.deepEqual(seen, ['dark', 'light', 'auto', 'acnh', 'wii']);
  assert.deepEqual(THEMES, ['wii', 'dark', 'light', 'auto', 'acnh']);
  assert.equal(THEME_LABEL.auto, 'Auto');
  assert.equal(THEME_LABEL.wii, 'Wii');
  assert.equal(THEME_LABEL.acnh, 'Island');
});

test('auto follows the machine, and the other two do not', () => {
  assert.equal(themeName('auto', false), 'light');
  assert.equal(themeName('auto', true), 'dark');
  // An explicit choice ignores the OS entirely.
  assert.equal(themeName('dark', false), 'dark');
  assert.equal(themeName('light', true), 'light');
  // The skin is never resolved through the OS: it is the skin.
  assert.equal(themeName('wii', true), 'wii');
  assert.equal(themeName('wii', false), 'wii');
  // Neither is the Island theme: a cream sheet is not a dark-mode answer.
  assert.equal(themeName('acnh', true), 'acnh');
  assert.equal(themeName('acnh', false), 'acnh');
});

test('applying a theme writes the resolved name, not the choice', () => {
  const root = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  assert.equal(applyTheme('auto', root, true), 'dark');
  assert.equal(root.attrs['data-sd-theme'], 'dark');
  // The same choice on a machine set to light.
  assert.equal(applyTheme('auto', root, false), 'light');
  assert.equal(root.attrs['data-sd-theme'], 'light');
  assert.equal(applyTheme('light', root), 'light');
  assert.equal(root.attrs['data-sd-theme'], 'light');
  // Nothing to write to is not an error.
  assert.equal(applyTheme('dark', null), null);
});

test('most views sit in the content column, tables and reports go wide', () => {
  for (const view of ['week', 'index', 'list', 'note', 'task', 'settings']) {
    const layout = layoutFor(view, true);
    assert.equal(layout.split, 'none', view + ' has no split');
    assert.equal(layout.width, DEFAULT_LAYOUT.width, view + ' keeps the column');
    assert.equal(layout.density, DEFAULT_LAYOUT.density);
  }
  // Data needs the width a roster or a report result takes.
  assert.equal(layoutFor('sheet', true).width, 'wide');
  assert.equal(layoutFor('report', false).width, 'wide');
});

test('only the views that ask for a split get one, and only with a list', () => {
  assert.equal(LAYOUT.form.split, 'beside');
  assert.equal(layoutFor('form', true).split, 'beside');
  // A record page with no panel beside it is not a split page.
  assert.equal(layoutFor('form', false).split, 'none');
  assert.equal(layoutFor('unknown-view', true).split, 'none');
});

test('a knob can be changed for one page without touching the renderer', () => {
  // The point of the table: this is what changing a page's layout looks like.
  const had = Object.prototype.hasOwnProperty.call(LAYOUT, 'week');
  const before = LAYOUT.week;
  const start = layoutFor('week', false);
  assert.equal(start.width, DEFAULT_LAYOUT.width);

  LAYOUT.week = { width: 'wide', density: 'compact' };
  try {
    const after = layoutFor('week', false);
    assert.equal(after.width, 'wide');
    assert.equal(after.density, 'compact');
    assert.equal(after.split, 'none', 'an unset knob still falls back');
  } finally {
    if (had) LAYOUT.week = before;
    else delete LAYOUT.week;
  }
});
