/*
 * The Home dashboard's two other tabs.
 *
 * `Insights` is not a table of records at all: eight `.statBox` cells — a number
 * and a label, each wrapped in the link to the list it counts — and a donut whose
 * numbers sit in `.donut-chart-legend-series .series`, with the names beside them
 * in `.donut-chart-legend-labels .label a`. The sheet reader kept only the stat
 * table's two rows and dropped every label.
 *
 * `Trends` is eleven server-rendered chart PNGs laid out in a three-column table
 * whose header row is the column names, each chart cell holding a bold title, the
 * image, and a caption in a `<p>`. The sheet reader turned the column banners into
 * two rows of data and dropped every image and caption.
 *
 * The tab strip itself is read once, in `lib/pagetabs.js`: the two tabs you are
 * not on are anchors, the one you are on is a `div.selectedTab` with no href.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const { parseHtml } = await import('../src/lib/shell.js');
const { readInsights } = await import('../src/lib/insights.js');
const { readTrends } = await import('../src/lib/trends.js');
const { readPage } = await import('../src/lib/page.js');

// The tab you are on is a div with no href; the other two are anchors. The app
// prints them in this order whichever tab the URL asks for.
const tabs = (current) => `<div class="tabContainer">${['Schedule', 'Insights', 'Trends']
  .map((label) => (label === current
    ? `<div class="selectedTab">${label}</div>`
    : `<a href="admin.sd?page=HomePage&tab=tab-${label.toLowerCase()}">${label}</a>`))
  .join('')}</div>`;

const INSIGHTS = `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="formTitle">Home</div>
  ${tabs('Insights')}
  <div class="donut-chart">
    <div class="donut-chart-legend">
      <div class="donut-chart-legend-series">
        <div class="series"><span>429</span></div>
        <div class="series"><span>11</span></div>
        <div class="series is-last"><span>3831</span></div>
      </div>
      <div class="donut-chart-legend-bullets">
        <div class="bullet"><i class="fa-solid fa-circle"></i></div>
        <div class="bullet"><i class="fa-solid fa-circle"></i></div>
        <div class="bullet is-last"><i class="fa-solid fa-circle"></i></div>
      </div>
      <div class="donut-chart-legend-labels">
        <div class="label"><span></span><a href="admin.sd?page=Students&meth=enrolled">Enrolled</a></div>
        <div class="label"><span></span><a href="admin.sd?page=Students&meth=waitlisted">Waitlisted Only</a></div>
        <div class="label is-last"><span></span><a href="admin.sd?page=Students&meth=inactive">Inactive</a></div>
      </div>
    </div>
    <div class="donut-chart-total"><strong>4271</strong><span>Students</span></div>
  </div>
  <table class="statTable"><tbody>
    <tr>
      <td><a href="admin.sd?page=Alerts&meth=newStudents"><div class="statBox">
        <div class="Stat"><span>1 </span></div>
        <div class="Label">Students Starting<br> Today/Tomorrow</div></div></a></td>
      <td><a href="admin.sd?page=Alerts&meth=birthdays"><div class="statBox">
        <div class="Stat"><span>23 </span></div>
        <div class="Label">Students Celebrating<br> Birthdays</div></div></a></td>
    </tr>
    <tr>
      <td><a href="admin.sd?page=Alerts&meth=missed"><div class="statBox">
        <div class="Stat"><span>53 </span></div>
        <div class="Label">Students Missing<br> Consecutive Classes</div></div></a></td>
      <td><a href="admin.sd?page=Alerts&meth=instructors"><div class="statBox">
        <div class="Stat"><span>21 </span></div>
        <div class="Label">Instructors Assigned<br> to Classes</div></div></a></td>
    </tr>
  </tbody></table>
</div></div></form>`;

const TRENDS = `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="formTitle">Home</div>
  ${tabs('Trends')}
  <table class="trendLayout"><tbody>
    <tr><th>CLASS TRENDS</th><th>STUDENT TRENDS</th><th>FINANCIAL TRENDS</th></tr>
    <tr>
      <td><b>Class Hours per Week</b><br>
        <a href="admin.sd?page=LargeTrend&metric=1"><img src="images/temp/graphs/x_metric1_430_140_1.png"></a>
        <p>This week: 146.42 hours</p></td>
      <td><b>Students Enrolled</b><br>
        <a href="admin.sd?page=LargeTrend&metric=5"><img src="images/temp/graphs/x_metric5_430_140_2.png"></a>
        <p>Currently: 426</p></td>
      <td><b>A/R Balance Due</b><br>
        <a href="admin.sd?page=LargeTrend&metric=9"><img src="images/temp/graphs/x_metric9_430_140_3.png"></a>
        <p>Currently: 1000.00</p></td>
    </tr>
    <tr>
      <td><b>Top 10 Customers (last 60 days)</b><br>
        <table class="ReportTable"><tbody>
          <tr><th>Guardian</th><th>Last Name</th><th class="AR">Payments</th></tr>
          <tr><td><a href="admin.sd?page=EditFamily&fident=1">Alpha</a></td><td>One</td><td class="AR">1.00</td></tr>
          <tr><td><a href="admin.sd?page=EditFamily&fident=2">Beta</a></td><td>Two</td><td class="AR">2.00</td></tr>
        </tbody></table></td>
      <td></td><td></td>
    </tr>
  </tbody></table>
  <p><a href="admin.sd?page=SetRedYellowGreen">Set red/yellow/green thresholds for trends</a></p>
</div></div></form>`;

const insightsDoc = parseHtml(INSIGHTS);
const insights = readInsights(insightsDoc);

test('the Insights tab is a donut and eight stats, not a table', () => {
  assert.ok(insights, 'the dashboard has a view of its own');
  assert.equal(insights.kind, 'insights');
  assert.equal(insights.title, 'Home');

  assert.equal(insights.stats.length, 4, 'one card per stat box');
  assert.deepEqual(insights.stats.map((s) => s.label), [
    'Students Starting Today/Tomorrow',
    'Students Celebrating Birthdays',
    'Students Missing Consecutive Classes',
    'Instructors Assigned to Classes'
  ], 'the label is the app’s own words, on one line');
  assert.deepEqual(insights.stats.map((s) => s.value), ['1', '23', '53', '21']);
  assert.equal(insights.stats[0].href, 'admin.sd?page=Alerts&meth=newStudents',
    'a stat goes to the list it counts');
});

test('the donut keeps its three states, their names and its total', () => {
  const donut = insights.donut;
  assert.ok(donut, 'the legend is the donut');
  assert.equal(donut.total, 4271, 'the sum of the parts');
  assert.equal(donut.unit, 'Students');
  assert.deepEqual(donut.legend.map((p) => p.count), [429, 11, 3831]);
  assert.deepEqual(donut.legend.map((p) => p.label), ['Enrolled', 'Waitlisted Only', 'Inactive']);
  assert.equal(donut.legend[0].href, 'admin.sd?page=Students&meth=enrolled');
});

test('routing sends the Insights tab to the insights view', () => {
  const page = readPage(insightsDoc, 'https://x/admin.sd?page=HomePage&tab=tab-insights');
  assert.equal(page.view, 'insights');
  assert.equal(page.title, 'Home');
  assert.equal(page.insights.stats.length, 4);
});

const trendsDoc = parseHtml(TRENDS);
const trends = readTrends(trendsDoc);

test('the Trends tab keeps every chart, its column, its caption and its link', () => {
  assert.ok(trends, 'the chart page has a view of its own');
  assert.equal(trends.kind, 'trends');
  assert.equal(trends.charts.length, 3);

  assert.deepEqual(trends.charts.map((c) => c.section),
    ['CLASS TRENDS', 'STUDENT TRENDS', 'FINANCIAL TRENDS'],
    'a chart belongs to the column it is printed under');
  assert.deepEqual(trends.charts.map((c) => c.title),
    ['Class Hours per Week', 'Students Enrolled', 'A/R Balance Due']);
  assert.deepEqual(trends.charts.map((c) => c.caption),
    ['This week: 146.42 hours', 'Currently: 426', 'Currently: 1000.00']);
  assert.equal(trends.charts[0].href, 'admin.sd?page=LargeTrend&metric=1',
    'the image links to the larger chart');
  assert.match(trends.charts[0].src, /graphs\/x_metric1/);
});

test('the table beside the charts is still a table', () => {
  assert.equal(trends.tables.length, 1, 'the layout table is not data');
  const [top] = trends.tables;
  assert.equal(top.caption, 'Top 10 Customers (last 60 days)');
  assert.deepEqual(top.headings, ['Guardian', 'Last Name', 'Payments']);
  assert.equal(top.rows.length, 2);
  assert.equal(top.rows[0][0].href, 'admin.sd?page=EditFamily&fident=1');
});

test('the footer keeps the page’s own link and drops the app’s chrome', () => {
  // "Set red/yellow/green thresholds for trends" is part of this screen; the
  // app's footer also prints "Release Notes", which is not.
  assert.deepEqual(trends.links.map((l) => l.label),
    ['Set red/yellow/green thresholds for trends']);
  assert.equal(trends.links[0].href, 'admin.sd?page=SetRedYellowGreen');
});

test('the tab strip is three tabs, with the current one marked', () => {
  assert.deepEqual(trends.tabs.map((t) => t.label), ['Schedule', 'Insights', 'Trends']);
  assert.deepEqual(trends.tabs.map((t) => t.selected), [false, false, true]);
  assert.equal(trends.tabs[0].href, 'admin.sd?page=HomePage&tab=tab-schedule');
  assert.equal(trends.tabs[2].href, '', 'the tab you are on has no destination');
});

test('routing sends the Trends tab to the trends view', () => {
  const page = readPage(trendsDoc, 'https://x/admin.sd?page=HomePage&tab=tab-trends');
  assert.equal(page.view, 'trends');
  assert.equal(page.trends.charts.length, 3);
});

test('a page with rows is not a dashboard', () => {
  // Alerts carries a report table with rows and no stat boxes: it stays a sheet.
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <div class="ReportBreadcrumb"><span style="font-weight: bold">Business Insights</span></div>
      <table class="ReportTable"><tbody>
        <tr><th>First Name</th><th>Last Name</th></tr>
        <tr><td>One</td><td>Two</td></tr>
        <tr><td>Three</td><td>Four</td></tr>
      </tbody></table>
    </div></div></form>`);
  assert.equal(readInsights(doc), null);
  assert.equal(readTrends(doc), null);
  assert.equal(readPage(doc, 'https://x/admin.sd?page=Alerts').view, 'sheet');
});
