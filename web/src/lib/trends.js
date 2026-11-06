// The Home dashboard's Trends tab.
//
// Eleven server-rendered charts, `images/temp/graphs/…_metric1_430_140_….png`,
// laid out in a three-column table whose header row is the column names:
//
//   <tr><th>CLASS TRENDS</th><th>STUDENT TRENDS</th><th>FINANCIAL TRENDS</th></tr>
//   <tr><td><b>Class Hours per Week</b><br>
//           <a href="admin.sd?page=LargeTrend&metric=1"><img src="…metric1…png"></a>
//           <p>This week: 146.42 hours</p></td> …
//
// One cell holds the Top 10 customers table instead of a chart.
//
// The sheet reader lost all of it: the three column banners became two rows of
// data, every chart image and every caption was dropped with the cell text, and
// what was left was a nearly empty table. The images are the screen, so they are
// carried as images — from the app's own URL, which is where they live.

import { qs, qsa, textOf, titleOf } from './shell.js';
import { contentRoot } from '../model/root.js';
import { readTable } from '../model/table.js';
import { hasHeadings, hasRows } from '../model/rows.js';
import { pageRegions } from '../model/regions.js';
import { readPageTabs } from './pagetabs.js';

const CHART = /graphs?\//i;

function headingsOf(table) {
  const row = qsa(table, 'tr').find((tr) => tr.querySelector('th'));
  return row ? Array.from(row.children).map((cell) => textOf(cell)) : [];
}

function indexOf(cell) {
  const row = cell && cell.closest('tr');
  return row ? Array.from(row.children).indexOf(cell) : -1;
}

export function readTrends(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  const images = qsa(root, 'img').filter((img) => CHART.test(img.getAttribute('src') || ''));
  if (images.length < 3) return null;

  // The chart grid is the layout table the images sit in; its first heading row
  // names the columns, and a chart belongs to the column it is printed under.
  const layout = images[0].closest('table');
  const sections = layout ? headingsOf(layout) : [];

  const charts = images
    .map((img) => {
      const cell = img.closest('td') || root;
      const anchor = img.closest('a[href]');
      return {
        section: (cell && cell.closest('td') ? sections[indexOf(cell)] : '') || '',
        title: textOf(qs(cell, 'b, strong')),
        caption: textOf(qs(cell, 'p')),
        src: img.getAttribute('src') || '',
        href: anchor ? anchor.getAttribute('href') : ''
      };
    })
    .filter((chart) => chart.src);

  // The table beside the charts (Top 10 customers) is an ordinary data table,
  // labelled by the bold line the app prints above it.
  const tables = [];
  // Which of these are records is the page-wide judgement's (`model/regions.js`),
  // not a scan of every table this reader does itself.
  for (const entry of pageRegions(doc).tables) {
    if (entry.kind !== 'data') continue;
    const table = entry.table;
    if (table === layout) continue;
    // A table nested in another table's cell belongs to that cell; only one
    // nested in the layout table is content this screen shows.
    const outer = table.closest('table');
    if (outer && outer !== table && outer !== layout) continue;

    const read = readTable(table);
    if (!hasHeadings(read) || !hasRows(read)) continue;

    const cell = table.closest('td');
    tables.push({
      ...read,
      section: cell ? sections[indexOf(cell)] || '' : '',
      caption: textOf(qs(cell || root, 'b, strong')) || read.caption || ''
    });
  }

  // The page's footer note ("Set red/yellow/green thresholds for trends"). The
  // app's own footer also prints links that are not about this screen (Release
  // Notes), so what is kept is the links that go to another admin page.
  const links = qsa(root, 'a[href]')
    .filter((anchor) => !anchor.closest('table') && !anchor.closest('.tabContainer'))
    .map((anchor) => ({ label: textOf(anchor), href: anchor.getAttribute('href') }))
    .filter((link) => link.label && /(^|[/?&])page=/i.test(link.href));

  return {
    kind: 'trends',
    title: titleOf(doc, 'heading') || 'Trends',
    charts,
    tables,
    links,
    tabs: readPageTabs(doc)
  };
}
