// Which component renders which model, and the two strings every view shares.
//
// `App.svelte` used to hold a ten-branch `{#if}` chain, a second chain for the
// title and a third for the footer — three places that each had to know every
// view, and each of which could fall out of step with the other two. The map here
// is the only place a view is named; the title and footer are functions of the
// model, so a view added to the map is a view that can be titled.

import Week from '../components/Week.svelte';
import Month from '../components/Month.svelte';
import List from '../components/List.svelte';
import Editor from '../components/Editor.svelte';
import Report from '../components/Report.svelte';
import Task from '../components/Task.svelte';
import Sheet from '../components/Sheet.svelte';
import Insights from '../components/Insights.svelte';
import Trends from '../components/Trends.svelte';
import Attendance from '../components/Attendance.svelte';
import Settings from '../components/Settings.svelte';
import Index from '../components/Index.svelte';
import Note from '../components/Note.svelte';
import Confirmed from '../components/Confirmed.svelte';
import Payment from '../components/Payment.svelte';
import Charges from '../components/Charges.svelte';

export const VIEWS = {
  week: Week,
  month: Month,
  confirm: Confirmed,
  payment: Payment,
  index: Index,
  report: Report,
  task: Task,
  insights: Insights,
  trends: Trends,
  attendance: Attendance,
  charges: Charges,
  sheet: Sheet,
  settings: Settings,
  note: Note,
  list: List,
  form: Editor
};

// Views that show the record list beside them when the page carries one.
export const SPLIT = new Set(['confirm', 'form']);

// The model's view, or what its shape implies when the model did not say. The
// order matches the reader registry.
export function viewOf(model) {
  const m = model || {};
  if (m.view) return m.view;
  if (m.confirm) return 'confirm';
  if (m.payment) return 'payment';
  if (m.week) return 'week';
  if (m.month) return 'month';
  if (m.list) return 'list';
  if (m.form) return 'form';
  if (m.report) return 'report';
  if (m.task) return 'task';
  if (m.insights) return 'insights';
  if (m.trends) return 'trends';
  if (m.attendance) return 'attendance';
  if (m.charges) return 'charges';
  if (m.sheet) return 'sheet';
  if (m.index) return 'index';
  if (m.settings) return 'settings';
  if (m.note) return 'note';
  return null;
}

// The handlers every view may be given; a view takes the ones it needs.
export function propsFor(view, model, handlers) {
  const h = handlers || {};
  switch (view) {
    case 'week':
      return {
        week: model.week,
        period: h.period || null,
        onPeriod: h.onPeriod || null,
        nav: h.nav || null
      };
    case 'month':
      return { month: model.month, period: h.period || null, onPeriod: h.onPeriod || null };
    case 'confirm':
      // A confirmation the app has not performed yet carries a button; an
      // outcome does not.
      return {
        confirm: model.confirm,
        // An outcome lands with the list you carried on from under its sentence,
        // so that screen is drawn as the list with the sentence above it.
        records: model.records || null,
        bar: model.bar || null,
        url: model.url || '',
        onPress: h.onPress,
        back: h.back || null
      };
    case 'payment':
      // Fields on the left, what is owed on the right. The two controls are the
      // app's own anchors, pressed on the live page.
      return {
        payment: model.payment,
        onSubmit: h.onSubmitPayment || null,
        onAddSplit: h.onAddSplit || null
      };
    case 'index':
      return { index: model.index };
    case 'report':
      return { report: model.report, onRun: h.onRun };
    case 'task':
      // The bar is the page's own (New, Delete): drawn where the app drew it,
      // pressed on the live page so the app builds each request.
      return {
        task: model.task,
        bar: model.bar || null,
        onAct: h.onAct,
        onAction: h.onAction,
        url: model.url || ''
      };
    case 'insights':
      return { insights: model.insights };
    case 'trends':
      return { trends: model.trends };
    case 'attendance':
      // Every gesture in this view is a gesture on the app's own control, so it
      // is handed one object rather than six callbacks.
      return { attendance: model.attendance, onAttend: h.onAttend || null };
    case 'charges':
      // Fields in the app's own cells; Save is the page's Save.
      return {
        charges: model.charges,
        onSave: h.onSave || null,
        onPress: h.onPress || null
      };
    case 'sheet':
      return { sheet: model.sheet, onPress: h.onPress };
    case 'settings':
      return { settings: model.settings, onSave: h.onSaveSettings };
    case 'note':
      return { note: model.note, onPress: h.onPress };
    case 'list':
      return { list: model.list, onLoadAll: h.canLoadAll ? h.onLoadAll : null, onRefresh: h.onRefresh || null, auto: true };
    case 'form':
      return {
        form: model.form,
        tabs: model.tabs || null,
        bar: model.bar,
        onSave: h.onSave,
        onAction: h.onAction,
        // The event page's performance list: its own arrangement, the app's own
        // lock toggle, its own three controls, and its own save of the order.
        perf: model.perf || null,
        onPerfAct: h.onPerfAct || null,
        onPerfLock: h.onPerfLock || null,
        onPerfSave: h.onPerfSave || null,
        url: model.url || ''
      };
    default:
      return {};
  }
}

// Where the page sits in the app's own tree. Readers put it at the top level; an
// editor keeps it inside the form, so both are read here rather than in each view.
export function crumbsOf(model) {
  const m = model || {};
  const list = m.breadcrumb
    || (m.form && m.form.breadcrumb)
    || (m.report && m.report.breadcrumb)
    || [];
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

// The page's name. The form's own title wins: an editor can also carry a record
// list, and the panel's heading ("Classes") is not the page's name. A
// confirmation names its own screen for the same reason.
export function titleOf(model) {
  const m = model || {};
  const confirm = m.confirm;
  const payment = m.payment;
  const form = m.form;
  const report = m.report;
  const task = m.task;
  const sheet = m.sheet;
  const attendance = m.attendance;
  const charges = m.charges;
  const insights = m.insights;
  const trends = m.trends;
  const index = m.index;
  const settings = m.settings;
  const note = m.note;

  if (confirm) return confirm.title || (confirm.ok ? 'Saved' : 'Not saved');
  if (payment) return payment.title || 'New payment';
  return (form && form.title) || (report && report.title) || (task && task.title)
    || (insights && insights.title) || (trends && trends.title)
    || (attendance && attendance.title)
    || (charges && charges.title)
    || (sheet && sheet.title) || (index && index.title) || (settings && settings.title)
    || (note && note.title)
    || (m.month && m.month.title)
    || (m.week && m.week.title) || (m.list && m.list.label) || m.title || 'Studio Director';
}

// Counts for the footer, in the model's own terms. Two strings: what this screen
// holds, and who does the writing.
export function footerOf(model) {
  const m = model || {};
  const view = viewOf(m);
  const week = m.week;
  const list = m.list;
  const report = m.report;
  const index = m.index;
  const task = m.task;    const sheet = m.sheet;
    const insights = m.insights;
    const trends = m.trends;
    const attendance = m.attendance;
    const charges = m.charges;
    const settings = m.settings;
    const note = m.note;
    const confirm = m.confirm;
    const payment = m.payment;
  const month = m.month;

  // A settings card can be a small flow step with its own buttons (Enroll,
  // Cancel): naming a Save it does not show would be a lie in the footer.
  const settingsButtons = settings
    ? (settings.actions || []).filter((a) => a.id !== 'save' && !/^save$/i.test(a.label))
    : [];

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  let left = '';

  if (view === 'confirm' && confirm) {
    // A question has not been answered yet, so nothing has been saved: the
    // drop-in flow's "are you sure?" was reading "Saved" before Continue was
    // ever pressed.
    const where = confirm.breadcrumb.length ? confirm.breadcrumb.join(' / ') : 'the app confirmed it';
    left = confirm.pending ? `Nothing changed yet \u00b7 ${where}` : `Saved \u00b7 ${where}`;
  } else if (view === 'month' && month) {
    left = `${month.label || month.title} \u00b7 ${plural(month.events, 'event', 'events')}`;
    if (month.holidays) left += ` \u00b7 ${plural(month.holidays, 'holiday', 'holidays')}`;
  } else if (view === 'week' && week) {
    left = `${week.totals.classes} classes \u00b7 ${week.totals.spots} spots open`;
    if (week.totals.waitlisted) left += ` \u00b7 ${week.totals.waitlisted} waitlisted`;
    if (week.hidden) left += ` \u00b7 ${week.hidden} faculty hidden`;
  } else if (view === 'report' && report) {
    left = report.title;
    // Rows, not fields: seven weekday checkboxes are one filter row.
    if (report.rows.length) left += ` \u00b7 ${plural(report.rows.length, 'filter', 'filters')}`;
    if (report.results.tables.length) left += ` \u00b7 ${plural(report.results.rows, 'row', 'rows')}`;
  } else if (view === 'index' && index) {
    left = `${index.count} links \u00b7 ${plural(index.groups.length, 'group', 'groups')}`;
  } else if (view === 'task' && task) {
    left = `${plural(task.fields.length, 'field', 'fields')} \u00b7 ${plural(task.actions.length, 'control', 'controls')}`;
    if (task.primary) left += ` \u00b7 ${task.primary.label}`;
  } else if (view === 'insights' && insights) {
    left = plural(insights.stats.length, 'stat', 'stats');
    if (insights.donut) left += ` \u00b7 ${insights.donut.legend.length} student states`;
  } else if (view === 'trends' && trends) {
    left = plural(trends.charts.length, 'chart', 'charts');
    if (trends.tables.length) left += ` \u00b7 ${plural(trends.tables.length, 'table', 'tables')}`;
  } else if (view === 'charges' && charges) {
    left = `${plural(charges.rows.length, 'charge', 'charges')} \u00b7 ${plural(charges.fields.length, 'field', 'fields')}`;
  } else if (view === 'attendance' && attendance) {
    // Dates only. The present count belongs to the register's own bar, which
    // follows every tick; a second copy of it here would be the model's number,
    // frozen at read time, contradicting the bar two lines above it.
    left = plural(attendance.dates.length, 'date', 'dates');
  } else if (view === 'sheet' && sheet) {
    left = `${plural(sheet.rows, 'row', 'rows')} \u00b7 ${plural(sheet.tables.length, 'table', 'tables')}`;
    if (sheet.truncated) left += ` \u00b7 showing ${sheet.shown}`;
  } else if (view === 'settings' && settings) {
    left = plural(settings.fields.length, 'setting', 'settings');
    if (settingsButtons.length) left += ` \u00b7 ${settingsButtons.map((b) => b.label).join(' / ')}`;
    else if (settings.save || settings.primary) left += ` \u00b7 ${settings.save ? settings.save.label : settings.primary.label}`;
  } else if (view === 'note' && note) {
    left = `${plural(note.lines.length, 'line', 'lines')} \u00b7 ${plural(note.actions.length, 'control', 'controls')}`;
  } else if (view === 'payment' && payment) {
    // Fields only. The splits are named by the table's own heading when they are
    // open, and the count read here would be the page's, frozen at mount — the
    // app builds a new split row after that, and the footer would still say none.
    left = plural(payment.base.length, 'field', 'fields');
  } else if (view === 'list' && list) {
    left = `${list.items.length} ${list.items.length === 1 ? 'record' : 'records'}`;
  } else if (view === 'form' && m.form) {
    left = `${m.form.breadcrumb.length ? m.form.breadcrumb.join(' / ') : m.form.title} \u00b7 ${m.form.fields.length} fields`;
    if (m.tabs && m.tabs.tabs.length > 1) left += ` \u00b7 ${m.tabs.tabs.length} tabs`;
  }

  // The right-hand half of the footer held a sentence per view explaining how the
  // rebuild defers to the app. The version stamp is the only thing wanted there.
  return { left, right: '' };
}
