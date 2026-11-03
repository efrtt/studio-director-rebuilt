// The Home dashboard's Insights tab.
//
// This page is not a table of records. It is eight `.statBox` cells — a number
// and a label, each wrapped in the link to the alert list it counts — and a
// donut whose numbers sit in `.donut-chart-legend-series .series`, with the
// names beside them in `.donut-chart-legend-labels .label a`:
//
//   div.donut-chart-legend
//     div.donut-chart-legend-series > div.series > span      429  11  3831
//     div.donut-chart-legend-bullets                          one dot each
//     div.donut-chart-legend-labels > div.label > a           Enrolled, ...
//
// The sheet reader kept almost none of it: only the stat table's two rows of
// cells survived, with the labels and the numbers' own links lost, and the donut
// had no representation at all. There is nothing to write back — every figure is
// a count with a link to the list behind it.

import { qs, qsa, textOf } from './shell.js';
import { contentRoot } from '../model/root.js';
import { readPageTabs } from './pagetabs.js';

const countOf = (text) => {
  const n = Number(String(text).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// A stat's link is the anchor *around* the box; a legend name's link is the
// anchor *inside* its label. Both are the destination of the same figure.
function hrefOf(el) {
  if (!el) return '';
  const inside = el.querySelector && el.querySelector('a[href]');
  const around = el.closest && el.closest('a[href]');
  const anchor = inside || around;
  return anchor ? anchor.getAttribute('href') : '';
}

export function readInsights(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  const boxes = qsa(root, '.statBox');
  const legend = qs(root, '.donut-chart-legend');
  if (boxes.length < 2 && !legend) return null;

  // A page of records is a sheet, not a dashboard: the Alerts list carries a
  // report table with rows, and it has to keep its own view.
  const reportRows = qsa(root, 'table.ReportTable').reduce(
    (n, table) => n + Array.from(table.querySelectorAll('tr')).filter((tr) => tr.querySelector('td')).length,
    0
  );
  if (reportRows) return null;

  // The page's own order: the app prints four stats across, then four below.
  const stats = boxes
    .map((box) => ({
      value: textOf(qs(box, '.Stat')),
      label: textOf(qs(box, '.Label')),
      href: hrefOf(box)
    }))
    .filter((stat) => stat.value && stat.label);

  let donut = null;
  if (legend) {
    const values = qsa(legend, '.series').map((series) => textOf(series));
    const labels = qsa(root, '.donut-chart-legend-labels .label').map((label) => ({
      label: textOf(qs(label, 'a')) || textOf(label),
      href: hrefOf(label)
    }));
    const rows = values
      .map((value, index) => ({
        value,
        count: countOf(value),
        label: (labels[index] || {}).label || '',
        href: (labels[index] || {}).href || ''
      }))
      .filter((row) => row.value);

    // The middle of the donut prints the total and its unit, and it is not
    // always markup of its own; the total is the sum of the parts either way.
    // The legend's *own* class is "donut-chart-legend", so a closest() on
    // "donut" stops at the legend and never reaches the middle of the chart.
    const unitOf = (el) => (/(Students|Families|Classes|Instructors)\b/.exec(textOf(el)) || [])[1] || '';
    const parent = legend.parentElement || null;
    const unit = unitOf(parent) || unitOf(parent && parent.parentElement);
    if (rows.length) {
      donut = { total: rows.reduce((n, row) => n + row.count, 0), unit, legend: rows };
    }
  }

  if (!stats.length && !donut) return null;

  return {
    kind: 'insights',
    title: textOf(qs(doc, '.formTitle, h1')) || 'Insights',
    donut,
    stats,
    tabs: readPageTabs(doc)
  };
}
