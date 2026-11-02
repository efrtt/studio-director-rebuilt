// The three URLs these pages use, and which of them a page is showing.
//
// Measured live on ManageVendors (2026-11-02): the list is
// `admin.sd?page=ManageVendors`, a record is the same URL plus
// `&meth=edit&vendor_ident=…`, and New is the same URL plus `&meth=neu`. Every
// row of "Existing Vendors" is a link of the first kind, which is how a table is
// told apart from the read-only tables the app prints elsewhere.
//
// The point of this file is that the rebuild does not fetch or POST for these
// pages: it recognises them, points each row and button at the app's own URL, and
// lets the app's Save do the writing.

import assert from 'node:assert/strict';
import { modeOf, isRecordHref, recordsOf, listHrefOf, newHrefOf, widthOf, headingOf, openIdOf, blankFormOf, backHrefOf } from '../src/lib/records.js';

const VENDORS = 'https://app.thestudiodirector.com/srvda/admin.sd?page=ManageVendors';
const EDIT = VENDORS + '&meth=edit&vendor_ident=1792596581894';
const NEW = VENDORS + '&meth=neu';

// ---- which page is this ----------------------------------------------------
assert.equal(modeOf(VENDORS), 'none', 'the list page is not an edit');
assert.equal(modeOf(EDIT), 'edit', 'meth=edit is an edit page');
assert.equal(modeOf(NEW), 'new', 'meth=neu is the new page');
assert.equal(
  modeOf('https://app.thestudiodirector.com/srvda/admin.sd?page=NewEditArchive&content=SeasonContent&season_ident=7'),
  'edit',
  'a record parameter without meth is still one record'
);
assert.equal(
  modeOf('https://app.thestudiodirector.com/srvda/admin.sd?page=CalendarPage&season=2026'),
  'none',
  'a season on the calendar is not a record'
);
assert.equal(
  modeOf('https://app.thestudiodirector.com/srvda/admin.sd?page=NewEditArchive&content=SeasonContent'),
  'none',
  'content picks the form; it does not name a record'
);

// ---- which links are records ----------------------------------------------
assert.ok(isRecordHref(EDIT, VENDORS), 'a row link back to the same page with an id is a record');
assert.ok(!isRecordHref(VENDORS, VENDORS), 'the list itself is not a record');
assert.ok(!isRecordHref('admin.sd?page=EditStudent&sident=1', VENDORS), 'a link to another page is not this list');
assert.ok(!isRecordHref('#', VENDORS), 'a hash is not a record');

// ---- the list --------------------------------------------------------------
const vendors = {
  tables: [{
    section: 'Existing Vendors',
    headings: ['Vendor'],
    rows: [
      [{ text: 'A Wish Come True', href: VENDORS + '&meth=edit&vendor_ident=1' }],
      [{ text: 'Amazon.com', href: VENDORS + '&meth=edit&vendor_ident=2' }],
      [{ text: 'Baltogs', href: null }]
    ]
  }]
};
const found = recordsOf(vendors, VENDORS);
assert.equal(found.rows.length, 2, 'rows without a link are not records');
assert.equal(found.rows[0].label, 'A Wish Come True');
assert.equal(found.rows[0].id, '1', 'the row carries the id it opens');
assert.equal(recordsOf({ tables: [] }, VENDORS), null, 'no tables means no record list');
assert.equal(
  recordsOf({ tables: [{ headings: ['x'], rows: [[{ text: 'y', href: null }]] }] }, VENDORS),
  null,
  'a table of plain text is not a record list'
);

// ---- where Cancel and New go ----------------------------------------------
assert.equal(listHrefOf(EDIT, NEW), '/srvda/admin.sd?page=ManageVendors', 'Cancel goes back to the list');
assert.equal(listHrefOf(EDIT, ''), '/srvda/admin.sd?page=ManageVendors', 'and does so without a New link');
assert.equal(
  listHrefOf('admin.sd?page=NewEditArchive&content=SeasonContent&season_ident=7', ''),
  '/admin.sd?page=NewEditArchive&content=SeasonContent',
  'content survives: it picks which form the page shows'
);
assert.equal(
  listHrefOf('admin.sd?page=NewEditArchive&content=SeasonContent', ''),
  '/admin.sd?page=NewEditArchive&content=SeasonContent',
  'and a list page is already its own list'
);

assert.equal(newHrefOf({ actions: [{ id: 'save', label: 'Save' }, { id: 'new', label: 'New', href: NEW }] }), NEW);
assert.equal(newHrefOf({ bar: { items: [{ id: '', label: 'Add season', href: 'x' }] } }), 'x', 'an Add link is the New link');
assert.equal(newHrefOf({ links: [{ label: 'New', href: NEW }] }), NEW, 'New is a page link on the list pages');
assert.equal(newHrefOf({ actions: [] }), '');

// ---- where Cancel goes on the archive pages --------------------------------
// Live: Settings > Seasons lands on `NewEditArchive&content=SeasonContent&state=new`,
// and stripping `state` from it is not a page the server draws. The list you
// clicked from is.
const BASE = 'https://app.thestudiodirector.com/srvda/admin.sd';
const SEASONS = BASE + '?page=NewEditArchive&content=SeasonContent';
const SEASON_NEW = SEASONS + '&state=new';
assert.equal(
  backHrefOf(SEASON_NEW, SEASONS, listHrefOf(SEASON_NEW, '')),
  '/srvda/admin.sd?page=NewEditArchive&content=SeasonContent',
  'the page the click came from is where Cancel goes'
);
assert.equal(
  backHrefOf(SEASON_NEW, SEASON_NEW, '/srvda/fallback'),
  '/srvda/fallback',
  'a reload is not somewhere to go back to'
);
assert.equal(
  backHrefOf(EDIT, BASE + '?page=AdminHome', '/srvda/fallback'),
  '/srvda/admin.sd?page=AdminHome',
  'and any admin.sd page counts as where you came from'
);
assert.equal(
  backHrefOf(EDIT, 'https://elsewhere.test/thing', '/srvda/fallback'),
  '/srvda/fallback',
  'another site is not'
);
assert.equal(backHrefOf(EDIT, '', '/srvda/fallback'), '/srvda/fallback', 'no referrer falls back to the list URL');

// Measured live: the bar is where the record pages print New, and the add page
// prints no bar at all — it is already the empty form.
assert.equal(
  newHrefOf({ bar: { items: [{ id: 'new', label: 'New', href: NEW }, { id: 'delete', label: 'Delete' }] } }),
  NEW,
  'New is the bar\u2019s own control'
);

// ---- is the form on this page the add form? --------------------------------
assert.equal(blankFormOf({ fields: [{ value: '' }, { value: '' }] }), true, 'an empty form is the add form');
assert.equal(blankFormOf({ fields: [{ value: 'Amazon.com' }] }), false, 'a filled one is a record');
// Live, the holiday add form arrives with "Charge Tuition" already set to No and
// the date pickers empty: a default is not an answer, so it is still the add form.
assert.equal(blankFormOf({ fields: [{ options: [{ value: 'N', label: 'No' }], value: 'N' }] }), true);
assert.equal(blankFormOf({ fields: [{ type: 'checkbox', checked: true }] }), true);
assert.equal(blankFormOf({ fields: [] }), false, 'no form means nothing to open');

// The app's list opens with an unlabelled placeholder row; it is not a record.
const placeholder = {
  tables: [{
    headings: ['Vendor'],
    rows: [
      [{ text: '', href: VENDORS + '&meth=edit&vendor_ident=0' }],
      [{ text: 'Amazon.com', href: VENDORS + '&meth=edit&vendor_ident=2' }]
    ]
  }]
};
assert.equal(recordsOf(placeholder, VENDORS).rows.length, 1, 'the blank slot row is dropped');
assert.equal(recordsOf(placeholder, VENDORS).rows[0].label, 'Amazon.com');

// ---- which record is open --------------------------------------------------
assert.equal(openIdOf('https://app.thestudiodirector.com/srvda/admin.sd?page=ManageVendors&meth=edit&vendor_ident=2'), '2');
assert.equal(openIdOf(VENDORS), '', 'the list names no record');

// ---- how big the form is ---------------------------------------------------
assert.equal(widthOf(4), 'narrow', 'a holiday is a small dialog');
assert.equal(widthOf(9), 'mid', 'a season is a medium one');
assert.equal(widthOf(14), 'wide', 'a vendor record gets the wide one');
assert.equal(widthOf(0), 'narrow');

// ---- what it says it is doing ---------------------------------------------
assert.deepEqual(headingOf('new', 'Manage Vendors'), { eyebrow: 'New', title: 'New vendor' }, 'the page name is not the record');
assert.deepEqual(headingOf('new', 'Manage Holidays'), { eyebrow: 'New', title: 'New holiday' });
assert.deepEqual(headingOf('edit', 'Photo Shoots 2026-2027'), { eyebrow: 'Editing', title: 'Photo Shoots 2026-2027' });
assert.deepEqual(headingOf('edit', ''), { eyebrow: 'Editing', title: 'Edit record' });

console.log('records: ok');
