// Which component renders which model, and the two strings every view shares.
//
// `App.svelte` used to hold a ten-branch `{#if}` chain, a second chain for the
// title and a third for the footer — three places that each had to know every
// view, and each of which could fall out of step with the other two. The map here
// is the only place a view is named; the title and footer are functions of the
// model, so a view added to the map is a view that can be titled.

import Week from '../components/Week.svelte';
import List from '../components/List.svelte';
import Editor from '../components/Editor.svelte';
import Report from '../components/Report.svelte';
import Task from '../components/Task.svelte';
import Sheet from '../components/Sheet.svelte';
import Settings from '../components/Settings.svelte';
import Index from '../components/Index.svelte';
import Note from '../components/Note.svelte';
import Confirmed from '../components/Confirmed.svelte';

export const VIEWS = {
  week: Week,
  confirm: Confirmed,
  index: Index,
  report: Report,
  task: Task,
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
  if (m.week) return 'week';
  if (m.list) return 'list';
  if (m.form) return 'form';
  if (m.report) return 'report';
  if (m.task) return 'task';
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
      return { week: model.week, period: h.period || null, onPeriod: h.onPeriod || null };
    case 'confirm':
      // A confirmation the app has not performed yet carries a button; an
      // outcome does not.
      return { confirm: model.confirm, onPress: h.onPress };
    case 'index':
      return { index: model.index };
    case 'report':
      return { report: model.report, onRun: h.onRun, registerPrimary: h.registerPrimary };
    case 'task':
      return { task: model.task, onAct: h.onAct, registerPrimary: h.registerPrimary };
    case 'sheet':
      return { sheet: model.sheet, onPress: h.onPress };
    case 'settings':
      return { settings: model.settings, onSave: h.onSaveSettings, registerPrimary: h.registerPrimary };
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
        registerPrimary: h.registerPrimary
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
  const form = m.form;
  const report = m.report;
  const task = m.task;
  const sheet = m.sheet;
  const index = m.index;
  const settings = m.settings;
  const note = m.note;

  if (confirm) return confirm.title || (confirm.ok ? 'Saved' : 'Not saved');
  return (form && form.title) || (report && report.title) || (task && task.title)
    || (sheet && sheet.title) || (index && index.title) || (settings && settings.title)
    || (note && note.title)
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
  const task = m.task;
  const sheet = m.sheet;
  const settings = m.settings;
  const note = m.note;
  const confirm = m.confirm;

  // A settings card can be a small flow step with its own buttons (Enroll,
  // Cancel): naming a Save it does not show would be a lie in the footer.
  const settingsButtons = settings
    ? (settings.actions || []).filter((a) => a.id !== 'save' && !/^save$/i.test(a.label))
    : [];

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  let left = '';

  if (view === 'confirm' && confirm) {
    left = `Saved \u00b7 ${confirm.breadcrumb.length ? confirm.breadcrumb.join(' / ') : 'the app confirmed it'}`;
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
  } else if (view === 'sheet' && sheet) {
    left = `${plural(sheet.rows, 'row', 'rows')} \u00b7 ${plural(sheet.tables.length, 'table', 'tables')}`;
    if (sheet.truncated) left += ` \u00b7 showing ${sheet.shown}`;
  } else if (view === 'settings' && settings) {
    left = plural(settings.fields.length, 'setting', 'settings');
    if (settingsButtons.length) left += ` \u00b7 ${settingsButtons.map((b) => b.label).join(' / ')}`;
    else if (settings.save || settings.primary) left += ` \u00b7 ${settings.save ? settings.save.label : settings.primary.label}`;
  } else if (view === 'note' && note) {
    left = `${plural(note.lines.length, 'line', 'lines')} \u00b7 ${plural(note.actions.length, 'control', 'controls')}`;
  } else if (view === 'list' && list) {
    left = `${list.items.length} ${list.items.length === 1 ? 'record' : 'records'}`;
  } else if (view === 'form' && m.form) {
    left = `${m.form.breadcrumb.length ? m.form.breadcrumb.join(' / ') : m.form.title} \u00b7 ${m.form.fields.length} fields`;
    if (m.tabs && m.tabs.tabs.length > 1) left += ` \u00b7 ${m.tabs.tabs.length} tabs`;
  }

  const right = view === 'form' ? 'Edits are saved by the app itself'
    : view === 'report' ? 'The app builds the report'
      : view === 'task' ? 'The app runs the action'
        : view === 'sheet' ? 'Read-only view of the app\u2019s own tables'
          : view === 'settings' ? (settingsButtons.length ? 'Each button presses the app\u2019s own control' : 'The app saves the change')
            : 'Esc opens the original page';

  return { left, right };
}
