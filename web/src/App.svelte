<script>
  import List from './components/List.svelte';
  import State from './components/State.svelte';
  import { queryFromUrl } from './lib/search.js';
  import { VIEWS, SPLIT, viewOf, propsFor, titleOf, footerOf } from './views/registry.js';

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

  // The whole view layer is these three lines: which kind, which component, which
  // props. The title, the footer and the split layout are derived from the model.
  $: view = viewOf(model);
  $: entry = view ? VIEWS[view] || null : null;
  $: props = entry ? propsFor(view, model, {
    onRun, onAct, onPress, onSave, onSaveSettings, onAction, onOriginal, onLoadAll, canLoadAll
  }) : {};
  $: split = !!(entry && SPLIT.has(view) && model.list);
  $: title = titleOf(model);
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
    {#if state === 'ready' && entry}
      {#if split}
        <div class="sd-split">
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
