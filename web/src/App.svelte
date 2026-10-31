<script>
  import Week from './components/Week.svelte';
  import List from './components/List.svelte';
  import Editor from './components/Editor.svelte';
  import Report from './components/Report.svelte';
  import Task from './components/Task.svelte';
  import Sheet from './components/Sheet.svelte';
  import Settings from './components/Settings.svelte';
  import Index from './components/Index.svelte';
  import Note from './components/Note.svelte';
  import Confirmed from './components/Confirmed.svelte';
  import State from './components/State.svelte';
  import { queryFromUrl } from './lib/search.js';

  export let model = { nav: [], week: null, list: null, form: null, view: null, title: '', url: '' };
  export let state = 'ready';
  export let message = '';
  export let onOriginal = null;
  export let onSave = null;
  // A record page's own buttons (New / Print / Email / Delete / More): pressed
  // on the live page, so the app builds every request.
  export let onAction = null;
  export let onRun = null;
  export let onAct = null;
  export let onPress = null;
  export let onSaveSettings = null;
  export let onLoadAll = null;
  export let canLoadAll = false;
  export let onSearch = null;

  // Prefilled from the results URL when there is one, so a search does not
  // vanish from the box the moment its page loads.
  let query = queryFromUrl(model.url || '');
  let searchNote = '';

  function submitSearch() {
    const text = query.trim();
    if (!text) { searchNote = 'Type something to search.'; return; }
    searchNote = '';
    const result = onSearch ? onSearch(text) : null;
    if (!result || !result.submitted) {
      searchNote = result && result.reason === 'no-box'
        ? 'This page has no search box \u2014 use Original.'
        : 'Search is not available on this page.';
    }
  }

  $: week = model.week || null;
  $: list = model.list || null;
  $: form = model.form || null;
  $: tabs = model.tabs || null;
  $: report = model.report || null;
  $: task = model.task || null;
  $: sheet = model.sheet || null;
  $: settings = model.settings || null;
  $: index = model.index || null;
  $: note = model.note || null;
  // A settings card can be a small flow step with its own buttons (Enroll,
  // Cancel): naming a Save it does not show would be a lie in the footer.
  $: settingsButtons = settings
    ? (settings.actions || []).filter((a) => a.id !== 'save' && !/^save$/i.test(a.label))
    : [];
  $: confirm = model.confirm || null;
  $: view = model.view || (confirm ? 'confirm' : week ? 'week' : list ? 'list' : form ? 'form' : report ? 'report' : task ? 'task' : sheet ? 'sheet' : index ? 'index' : settings ? 'settings' : note ? 'note' : null);
  // The form's own title wins: an editor can also carry a record list, and the
  // panel's heading ("Classes") is not the page's name.
  // The confirmation round names its own screen: the panel beside it may say
  // "Records", which is not what the page is about.
  $: title = confirm
    ? (confirm.title || (confirm.ok ? 'Saved' : 'Not saved'))
    : (form && form.title) || (report && report.title) || (task && task.title)
      || (sheet && sheet.title) || (index && index.title) || (settings && settings.title)
      || (note && note.title)
      || (week && week.title) || (list && list.label) || model.title || 'Studio Director';

  // Widening the list changes the model in place: the new list comes from the
  // same page, re-read after its own "Show All" ran.
  async function loadAll() {
    if (!onLoadAll) return null;
    const result = await onLoadAll();
    if (result && result.list) model = { ...model, list: result.list };
    return result;
  }


  function openOriginal() {
    if (onOriginal) { onOriginal(); return; }
    location.href = model.url || location.href;
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      openOriginal();
    }
  }
</script>

<svelte:window on:keydown={onKey} />

<nav class="sd-rail" class:sd-rail--empty={!model.nav.length}>
  <div class="sd-brand">Studio</div>
  {#each model.nav as link}
    <a class="sd-navlink" href={link.href} title={link.label}>{link.label}</a>
  {/each}
</nav>

<div class="sd-main">
  <header class="sd-top">
    <div class="sd-title">{title}</div>
    <div class="sd-topright">
      <form class="sd-search" on:submit|preventDefault={submitSearch} role="search">
        <input
          class="sd-searchinput"
          type="search"
          placeholder="Search everything"
          aria-label="Search families, students, classes and instructors"
          bind:value={query}
        />
      </form>
      {#if searchNote}<span class="sd-searchnote">{searchNote}</span>{/if}
      <button class="sd-btn" type="button" on:click={openOriginal}>Original</button>
    </div>
  </header>

  <div class="sd-body">
    {#if state === 'ready' && view === 'week'}
      <Week {week} />
    {:else if state === 'ready' && view === 'confirm'}
      {#if list}
        <div class="sd-split">
          <div class="sd-split-side"><List {list} current={model.url} onLoadAll={canLoadAll ? loadAll : null} /></div>
          <div class="sd-split-main"><Confirmed {confirm} /></div>
        </div>
      {:else}
        <Confirmed {confirm} />
      {/if}
    {:else if state === 'ready' && view === 'index'}
      <Index {index} />
    {:else if state === 'ready' && view === 'report'}
      <Report {report} {onRun} {onOriginal} />
    {:else if state === 'ready' && view === 'task'}
      <Task {task} onAct={onAct} {onOriginal} />
    {:else if state === 'ready' && view === 'sheet'}
      <Sheet {sheet} onPress={onPress} {onOriginal} />
    {:else if state === 'ready' && view === 'settings'}
      <Settings {settings} onSave={onSaveSettings} {onOriginal} />
    {:else if state === 'ready' && view === 'note'}
      <Note {note} onPress={onPress} {onOriginal} />
    {:else if state === 'ready' && view === 'list'}
      <List {list} onLoadAll={canLoadAll ? loadAll : null} auto={true} />
    {:else if state === 'ready' && view === 'form'}
      {#if list}
        <div class="sd-split">
          <div class="sd-split-side"><List {list} current={model.url} onLoadAll={canLoadAll ? loadAll : null} /></div>
          <div class="sd-split-main"><Editor {form} {tabs} bar={model.bar} {onSave} {onAction} {onOriginal} /></div>
        </div>
      {:else}
        <Editor {form} {tabs} bar={model.bar} {onSave} {onAction} {onOriginal} />
      {/if}
    {:else}
      <State kind={state} {message} onAction={openOriginal} />
    {/if}
  </div>

  <footer class="sd-foot">
    <span>
      {#if view === 'confirm' && confirm}
        Saved &middot; {confirm.breadcrumb.length ? confirm.breadcrumb.join(' / ') : 'the app confirmed it'}
      {:else if view === 'week' && week}
        {week.totals.classes} classes &middot; {week.totals.spots} spots open{#if week.totals.waitlisted}{' '}&middot; {week.totals.waitlisted} waitlisted{/if}{#if week.hidden}{' '}&middot; {week.hidden} faculty hidden{/if}
      {:else if view === 'report' && report}
        {report.title}{#if report.fields.length}{' '}&middot; {report.rows.length} filter{report.rows.length === 1 ? '' : 's'}{/if}{#if report.results.tables.length}{' '}&middot; {report.results.rows} row{report.results.rows === 1 ? '' : 's'}{/if}
      {:else if view === 'index' && index}
        {index.count} links &middot; {index.groups.length} group{index.groups.length === 1 ? '' : 's'}
      {:else if view === 'task' && task}
        {task.fields.length} field{task.fields.length === 1 ? '' : 's'} &middot; {task.actions.length} control{task.actions.length === 1 ? '' : 's'}{#if task.primary}{' '}&middot; {task.primary.label}{/if}
      {:else if view === 'sheet' && sheet}
        {sheet.rows} row{sheet.rows === 1 ? '' : 's'} &middot; {sheet.tables.length} table{sheet.tables.length === 1 ? '' : 's'}{#if sheet.truncated}{' '}&middot; showing {sheet.shown}{/if}
      {:else if view === 'settings' && settings}
        {settings.fields.length} setting{settings.fields.length === 1 ? '' : 's'}{#if settingsButtons.length}{' '}&middot; {settingsButtons.map((b) => b.label).join(' / ')}{:else if settings.save || settings.primary}{' '}&middot; {settings.save ? settings.save.label : settings.primary.label}{/if}
      {:else if view === 'note' && note}
        {note.lines.length} line{note.lines.length === 1 ? '' : 's'} &middot; {note.actions.length} control{note.actions.length === 1 ? '' : 's'}
      {:else if view === 'list' && list}
        {list.items.length} {list.items.length === 1 ? 'record' : 'records'}
      {:else if view === 'form' && form}
        {form.breadcrumb.length ? form.breadcrumb.join(' / ') : form.title} &middot; {form.fields.length} fields{#if tabs && tabs.tabs.length > 1}{' '}&middot; {tabs.tabs.length} tabs{/if}
      {:else}
        {state === 'expired' ? 'Session expired' : ''}
      {/if}
    </span>
    <span>{view === 'form' ? 'Edits are saved by the app itself' : view === 'report' ? 'The app builds the report' : view === 'task' ? 'The app runs the action' : view === 'sheet' ? 'Read-only view of the app’s own tables' : view === 'settings' ? (settingsButtons.length ? 'Each button presses the app’s own control' : 'The app saves the change') : 'Esc opens the original page'}</span>
  </footer>
</div>
