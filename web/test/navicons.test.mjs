// The rail's icons come from the app's own sidebar, not from a set we invent.
//
// Confirmed live: each nav link carries <i class="fa-solid fa-house fa-lg">, and
// the app loads Font Awesome on every page. The rail reuses those classes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readNavIcons } from '../src/lib/navicons.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const link = (href, icon, label) => `<a class="sideNavLink" href="${href}">
  <div class="sideNavItem">${icon ? `<i class="${icon}"></i>` : ''}<span class="sideItemText">${label}</span></div>
</a>`;

const sidebar = (links) => doc(`<body><div id="sideNavBar">${links.join('')}</div></body>`);

test('every nav link keeps the icon the app gave it', () => {
  const icons = readNavIcons(sidebar([
    link('admin.sd?page=HomePage&clicktab=1', 'fa-solid fa-house fa-lg', 'Home'),
    link('admin.sd?page=CalendarPage&clicktab=1', 'fa-solid fa-calendar fa-lg', 'Class Calendar'),
    link('admin.sd?page=NewFamily&clicktab=1', 'fa-solid fa-people-roof fa-lg', 'Families')
  ]));

  assert.deepEqual(icons, {
    'admin.sd?page=HomePage&clicktab=1': 'fa-solid fa-house fa-lg',
    'admin.sd?page=CalendarPage&clicktab=1': 'fa-solid fa-calendar fa-lg',
    'admin.sd?page=NewFamily&clicktab=1': 'fa-solid fa-people-roof fa-lg'
  });
});

test('a link with no icon is simply absent, so the letter stands in', () => {
  const icons = readNavIcons(sidebar([
    link('admin.sd?page=HomePage&clicktab=1', null, 'Home'),
    link('admin.sd?page=NewClass&clicktab=1', 'fa-solid fa-book-open fa-lg', 'Classes')
  ]));

  assert.equal(icons['admin.sd?page=HomePage&clicktab=1'], undefined);
  assert.equal(icons['admin.sd?page=NewClass&clicktab=1'], 'fa-solid fa-book-open fa-lg');
});

test('a page with no sidebar has no icons, and nothing throws', () => {
  assert.deepEqual(readNavIcons(doc('<body><p>print window</p></body>')), {});
  assert.deepEqual(readNavIcons(null), {});
});
