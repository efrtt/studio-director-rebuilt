<script>
  import List from './components/List.svelte';
  import State from './components/State.svelte';
  import { queryFromUrl } from './lib/search.js';
  import { VIEWS, viewOf, propsFor, titleOf, footerOf, crumbsOf } from './views/registry.js';
  import { layoutFor } from './views/layout.js';
  import { isActiveHref } from './lib/activelink.js';
import { readRail, writeRail } from './lib/rail.js';
  import { THEME_LABEL, readTheme, writeTheme, nextTheme, applyTheme } from './lib/theme.js';
  import Palette from './components/Palette.svelte';
  import AccentPicker from './components/AccentPicker.svelte';
  import { readAccent, writeAccent, applyAccent } from './lib/accent.js';
  import { menuFor } from './lib/menu.js';
import Menu from './components/Menu.svelte';
  import { runMesh } from './lib/mesh.js';

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
  // Attendance's own gestures (a tick, a reason, Save): every one of them is
  // written into the app's live controls, which is why they arrive as one object.
  export let onAttend = null;
  export let onSaveSettings = null;
  // The payment screen's own two gestures: process the payment, add a split.
  // Both press the app's anchors on the live page.
  export let onSubmitPayment = null;
  export let onAddSplit = null;
  export let onLoadAll = null;
  export let canLoadAll = false;
  export let onSearch = null;
  export let onRefresh = null;
  export let period = null;
  // href -> the app's own icon classes ("fa-solid fa-house fa-lg").
  export let icons = null;
  // The build this page is running, from package.json.
  export let version = '';
  // Where the action started, offered on a confirmation (lib/backlink.js).
  export let back = null;
  export let onPeriod = null;
  // The app's own calendar toolbar: previous/next week and the other views
  // (lib/calnav.js). Read at mount time, so the model keeps no chrome.
  export let nav = null;

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
  // The Wii's navigation is a screen, not a sidebar: Home opens it. The rail is
  // hidden by the skin, so this button is the way in while that theme is on.
  let menuOpen = false;
  function cycleTheme() {
    theme = nextTheme(theme);
    writeTheme(theme);
  }
  // The resolved name, because the channel menu is a Wii-only affordance and the
  // shell has to know which look is actually on.
  let resolvedTheme = 'dark';
  $: resolvedTheme = applyTheme(theme);
  // Leaving the menu open across a theme change would be a screen with no way
  // back to it in the next theme.
  $: if (resolvedTheme !== 'wii' && menuOpen) menuOpen = false;
  $: applyTheme(theme);
  // The accent is a value inside whichever theme is on, so it is written to the
  // same element and never needs to know which scheme it landed in.
  let accent = readAccent();
  function pickAccent(name) {
    accent = name;
    writeAccent(name);
  }
  $: applyAccent(accent);

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
    onRun, onAct, onPress, onAttend, onSave, onSaveSettings, onAction, onOriginal, onLoadAll, canLoadAll, onRefresh, period, onPeriod, nav, back,
    onSubmitPayment, onAddSplit
  }) : {};
  $: layout = layoutFor(view, !!model.list);
  $: split = layout.split !== 'none' && !!model.list;
  $: title = titleOf(model);
  $: crumbs = crumbsOf(model);
  $: foot = footerOf(model);
  // Which menu this page is, so the jump palette opens on the destinations
  // nearest it. Empty on every other screen, which is most of them.
  $: here = menuFor(title);

  // Widening the list changes the model in place: the new list comes from the
  // same page, re-read after its own "Show All" ran.
  async function loadAll() {
    if (!onLoadAll) return null;
    const result = await onLoadAll();
    if (result && result.list) model = { ...model, list: result.list };
    return result;
  }

  // The header band's field starts when the node exists, so switching into the Wii
  // theme later still gets one. It runs a quarter faster than a channel's: the bar
  // is the app's own colour and never stops moving.
  function meshField(node) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    runMesh(node, 9, 0.75);
  }

  function openOriginal() {
    if (onOriginal) { onOriginal(); return; }
    location.href = model.url || location.href;
  }

  function onKey(e) {
    // While the menu is open it owns Escape: closing the menu must not also open
    // the app's own page underneath it. A view's own dialog owns it too — Esc in
    // the absence editor closes the editor, never the page it sits on.
    if (menuOpen) return;
    if (typeof document !== 'undefined' && document.querySelector('.sd-overlay')) return;
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
    {#if resolvedTheme === 'wii'}
      <span class="sd-top-field" aria-hidden="true">
        <span class="sd-mesh" use:meshField>
          {#each [0, 1, 2, 3, 4, 5] as k (k)}<i></i>{/each}
        </span>
      </span>
      <button
        class="sd-home"
        type="button"
        aria-label="Open the channel menu"
        title="Channel menu"
        on:click={() => (menuOpen = true)}
      >
        <span class="sd-home-dot" aria-hidden="true"></span>
        <span class="sd-home-text">Home</span>
      </button>
    {/if}
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
      <AccentPicker accent={accent} onPick={pickAccent} />
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
    <span>{[foot.right, version ? 'v' + version : ''].filter(Boolean).join(' \u00b7 ')}</span>
  </footer>
</div>

{#if menuOpen}
  <Menu nav={model.nav} icons={icons} current={model.url} onClose={() => (menuOpen = false)} />
{/if}

<Palette nav={model.nav} here={here} />
