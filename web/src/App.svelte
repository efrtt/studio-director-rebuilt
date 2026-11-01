<script>
  import List from './components/List.svelte';
  import State from './components/State.svelte';
  import { queryFromUrl } from './lib/search.js';
  import { VIEWS, viewOf, propsFor, titleOf, footerOf, crumbsOf } from './views/registry.js';
  import { layoutFor } from './views/layout.js';
  import { isActiveHref } from './lib/activelink.js';
import { readRail, writeRail } from './lib/rail.js';
  import { THEME_LABEL, readTheme, writeTheme, nextTheme, applyTheme } from './lib/theme.js';

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
  export let onRefresh = null;
  export let period = null;
  // href -> the app's own icon classes ("fa-solid fa-house fa-lg").
  export let icons = null;
  export let onPeriod = null;

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

  // The colour scheme is one attribute on the document the stylesheet reads, so
  // changing it costs no re-render of a view. Dark is the default and `auto`
  // resolves to what the machine prefers.
  let theme = readTheme();
  function cycleTheme() {
    theme = nextTheme(theme);
    writeTheme(theme);
  }
  $: applyTheme(theme);

  // The rail folds to a strip of initials and remembers the choice; the current
  // section is marked, because navigation should say where you are.
  let railCollapsed = readRail();
  function toggleRail() {
    railCollapsed = !railCollapsed;
    writeRail(railCollapsed);
  }

  // One letter stands in for a section when the rail is folded.
  function initialOf(label) {
    return String(label || '').trim().charAt(0).toUpperCase();
  }

  // Which link is this page: lib/activelink.js. The app's nav carries the same
  // numeric `clicktab=1` on every link, so an index compared as a name made all
  // eleven "active" at once.
  function isActive(link) {
    return isActiveHref(model.url || location.href, link.href, location.origin);
  }

  // The whole view layer is these three lines: which kind, which component, which
  // props. The title, the footer and the layout are derived from the model.
  $: view = viewOf(model);
  $: entry = view ? VIEWS[view] || null : null;
  $: props = entry ? propsFor(view, model, {
    onRun, onAct, onPress, onSave, onSaveSettings, onAction, onOriginal, onLoadAll, canLoadAll, onRefresh, period, onPeriod, registerPrimary: providePrimary
  }) : {};
  $: layout = layoutFor(view, !!model.list);
  $: split = layout.split !== 'none' && !!model.list;
  // The page's main action sits in the header, so it is in the same place on
  // every screen. Views own their own state, so they hand the shell a button
  // description rather than the shell reaching into them.
  let primary = null;
  let lastView = null;
  function providePrimary(next) {
    primary = next || null;
  }
  $: if (view !== lastView) {
    lastView = view;
    primary = null;
  }

  $: title = titleOf(model);
  $: crumbs = crumbsOf(model);
  $: foot = footerOf(model);

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

<nav
  class="sd-rail"
  class:sd-rail--empty={!model.nav.length}
  class:sd-rail--collapsed={railCollapsed}
>
  <button
    class="sd-railtoggle"
    type="button"
    aria-expanded={!railCollapsed}
    aria-label={railCollapsed ? 'Show the menu' : 'Hide the menu'}
    title={railCollapsed ? 'Show the menu' : 'Hide the menu'}
    on:click={toggleRail}
  >
    <span class="sd-railtoggleicon" aria-hidden="true">{railCollapsed ? '»' : '«'}</span>
    {#if !railCollapsed}<span class="sd-brand">Studio</span>{/if}
  </button>
  {#each model.nav as link}
    <a
      class="sd-navlink"
      class:sd-navlink--active={isActive(link)}
      href={link.href}
      title={link.label}
      aria-current={isActive(link) ? 'page' : undefined}
    >
      {#if icons && icons[link.href]}
        <i class="sd-navicon {icons[link.href]}" aria-hidden="true"></i>
      {:else}
        <span class="sd-navinitial" aria-hidden="true">{initialOf(link.label)}</span>
      {/if}
      <span class="sd-navtext">{link.label}</span>
    </a>
  {/each}
</nav>

<div class="sd-main">
  <header class="sd-top">
    <div class="sd-heading">
      <div class="sd-title">{title}</div>
      {#if crumbs.length}
        <div class="sd-crumbs">
          {#each crumbs as crumb, i}
            <span class="sd-crumb">{crumb}</span>
            {#if i < crumbs.length - 1}<span class="sd-crumbsep" aria-hidden="true">›</span>{/if}
          {/each}
        </div>
      {/if}
    </div>
    <div class="sd-topright">
      {#if primary}
        <button
          class="sd-btn sd-primary sd-headeraction"
          type="button"
          disabled={primary.disabled}
          title={primary.title || primary.label}
          on:click={primary.run}
        >{primary.label}</button>
      {/if}
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
      <button
        class="sd-btn"
        type="button"
        title="Colour scheme: {THEME_LABEL[theme]}"
        aria-label="Colour scheme: {THEME_LABEL[theme]}"
        on:click={cycleTheme}
      >{THEME_LABEL[theme]}</button>
      <button class="sd-btn" type="button" on:click={openOriginal}>Original</button>
    </div>
  </header>

  <div class="sd-body" data-sd-width={layout.width} data-sd-density={layout.density}>
    {#if state === 'ready' && entry}
      {#if split}
        <div class="sd-split" data-sd-split={layout.split}>
          <div class="sd-split-side"><List list={model.list} current={model.url} onLoadAll={canLoadAll ? loadAll : null} /></div>
          <div class="sd-split-main"><svelte:component this={entry} {...props} /></div>
        </div>
      {:else}
        <svelte:component this={entry} {...props} />
      {/if}
    {:else}
      <State kind={state} {message} onAction={openOriginal} />
    {/if}
  </div>

  <footer class="sd-foot">
    <span>{foot.left}</span>
    <span>{foot.right}</span>
  </footer>
</div>
