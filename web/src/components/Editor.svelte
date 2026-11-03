<script>
  import { cellKind } from '../lib/cellclass.js';
  import CellHeading from './CellHeading.svelte';
  import CellAction from './CellAction.svelte';
  import CellLink from './CellLink.svelte';
  import { changesFrom } from '../lib/save.js';
  import RecordPage from './RecordPage.svelte';
  import { recordsOf } from '../lib/records.js';

  export let form;
  export let tabs = null;
  // The page's own URL: a record URL can also be a page that prints a list of
  // its records (seasons), and then the form belongs in a dialog over that list.
  export let url = '';
  // The page's own button bar (New, Print, Email, Delete, Edit Family, More).
  export let bar = null;
  export let onSave = null;
  // Presses a bar control on the live page: the app builds that request.
  export let onAction = null;

  // Which tab strip entry is showing. The record itself is always first, so an
  // editor without tabs looks exactly as it did before.
  let active = 0;
  $: list = tabs && tabs.tabs && tabs.tabs.length > 1 ? tabs.tabs : null;
  $: shown = list ? list[Math.min(active, list.length - 1)] : null;
  $: onForm = !shown || shown.kind === 'form';

  // Only when the page prints a list whose rows are records of this page. An
  // editor without such a table — EditFamily, EditStudent, EditClass — draws
  // exactly as it did before.
  $: recordList = !!recordsOf(form, url);

  // Rendered values, keyed by control id, seeded from the page's own values.
  const initial = {};
  for (const field of form.fields) {
    initial[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  let values = { ...initial };
  let status = '';
  let busy = false;
  let menuOpen = false;
  let menuWrap = null;

  $: changes = changesFrom(form, values);
  $: dirty = changes.length > 0;

  function reset() {
    values = { ...initial };
    status = '';
  }

  function submit() {
    if (!dirty || busy) return;
    if (!onSave) {
      status = 'No save handler was attached.';
      return;
    }
    busy = true;
    const result = onSave(values);

    if (!result || !result.submitted) {
      busy = false;
      status = result && result.reason === 'no-save-link'
        ? 'This page has no Save link — use the app’s own page.'
        : 'Nothing to save.';
      return;
    }

    // The app now owns the request: it may navigate, or it may report its own
    // validation error on the page underneath.
    status = 'Sent to the app’s Save…';
  }

  // ---- the record's own buttons -------------------------------------------
  //
  // Two behaviours, because the page has two kinds of control. A link is a page
  // the app renders, so it is followed; a control with no href is the app's own
  // script, so it is pressed where it stands. Nothing here builds a request.

  function guard() {
    if (!dirty) return true;
    const n = changes.length;
    return confirm(`${n} unsaved change${n === 1 ? '' : 's'} will be lost. Continue?`);
  }

  function follow(item, e) {
    // The browser would leave the page before we could ask.
    if (!guard()) e.preventDefault();
  }

  function press(item) {
    if (busy) return;
    if (item.danger) {
      if (!confirm(`${item.label}?\n\nThis runs the app’s own ${item.label.toLowerCase()} — anything it asks next is the app’s own step.`)) return;
    } else if (!guard()) {
      return;
    }

    if (!onAction) {
      status = 'No handler was attached for this page’s buttons.';
      return;
    }

    busy = true;
    status = '';
    const result = onAction(item);
    busy = false;

    if (!result || !result.submitted) {
      status = result && result.reason === 'ambiguous'
        ? `“${item.label}” appears ${result.matches} times on the page — use Original.`
        : `The app’s “${item.label}” control is not on this page — use Original.`;
      return;
    }
    status = `Asked the app to run “${item.label}”…`;
  }

  function pick(item, e) {
    menuOpen = false;
    if (!item.js) follow(item, e);
  }

  // A menu that stays open over the form it is covering is a bug, so it closes
  // on any click outside itself.
  function onWindowClick(e) {
    if (!menuOpen) return;
    if (menuWrap && !menuWrap.contains(e.target)) menuOpen = false;
  }

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      submit();
    }
  }
</script>

<svelte:window on:keydown={onKey} on:click={onWindowClick} />

{#if recordList}
  <RecordPage
    source={form}
    {url}
    title={form.title}
    saveLabel="Save"
    {bar}
    {onAction}
    onSave={onSave}
  />
{:else}
<div class="sd-editor" class:sd-editor--wide={form.tables && form.tables.length > 0}>
  <div class="sd-editorbar">
    <span class="sd-dirty">{dirty ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}` : 'No changes'}</span>
    <div class="sd-editor-actions">
      <!-- The page's own action leads the bar beside Reset, where the page's
           controls are; it used to sit in the header next to the search box,
           which made it the hardest thing on the screen to find. -->
      <button
        class="sd-btn sd-primary"
        type="button"
        disabled={!dirty || busy}
        title="Save these changes"
        on:click={submit}
      >{busy ? 'Saving…' : 'Save'}</button>
      <button class="sd-btn" type="button" disabled={!dirty || busy} on:click={reset}>Reset</button>

      {#if bar && (bar.items.length || bar.menu.length)}
        <span class="sd-barsep" aria-hidden="true"></span>

        {#each bar.items as item (item.id + item.label)}
          {#if item.js}
            <button
              class="sd-btn"
              class:sd-btn--danger={item.danger}
              type="button"
              disabled={busy || !!item.hint}
              title={item.hint || item.onclick || `${item.label} (the app’s own control)`}
              on:click={() => press(item)}
            >{item.label}</button>
          {:else}
            <a
              class="sd-btn"
              class:sd-btn--danger={item.danger}
              href={item.href}
              title={item.onclick || item.href}
              on:click={(e) => follow(item, e)}
            >{item.label}</a>
          {/if}
        {/each}

        {#if bar.menu.length}
          <div class="sd-menuwrap" bind:this={menuWrap}>
            <button
              class="sd-btn"
              type="button"
              aria-haspopup="true"
              aria-expanded={menuOpen ? 'true' : 'false'}
              on:click={() => (menuOpen = !menuOpen)}
            >{bar.moreLabel || 'More'} ▾</button>

            {#if menuOpen}
              <div class="sd-menu" role="menu">
                {#each bar.menu as item (item.id + item.label + item.href)}
                  {#if item.js}
                    <button
                      class="sd-menuitem"
                      class:sd-menuitem--danger={item.danger}
                      type="button"
                      role="menuitem"
                      disabled={!!item.hint}
                      title={item.hint || item.onclick || item.label}
                      on:click={() => { menuOpen = false; press(item); }}
                    >{item.label}</button>
                  {:else}
                    <a
                      class="sd-menuitem"
                      class:sd-menuitem--danger={item.danger}
                      role="menuitem"
                      href={item.href}
                      title={item.onclick || item.href}
                      on:click={(e) => pick(item, e)}
                    >{item.label}</a>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>

  {#if status}
    <p class="sd-editorstatus">{status}</p>
  {/if}

  {#if list}
    <div class="sd-tabs" role="tablist">
      {#each list as tab, i}
        <button
          class="sd-tab"
          class:sd-tab--on={shown === tab}
          type="button"
          role="tab"
          aria-selected={shown === tab ? 'true' : 'false'}
          on:click={() => (active = i)}
        >{tab.label}</button>
      {/each}
    </div>
  {/if}

  {#if shown && !onForm}
    <div class="sd-tabbody">
      {#if shown.actions.length}
        <div class="sd-panelactions">
          {#each shown.actions as action}
            {#if action.js}
              <span class="sd-action sd-action--js" title="Runs the app's own script — use Original">{action.label}</span>
            {:else}
              <a class="sd-action" href={action.href}>{action.label}</a>
            {/if}
          {/each}
        </div>
      {/if}

      {#each shown.blocks as block}
        {#if block.section}<h4 class="sd-section">{block.section}</h4>{/if}
        <div class="sd-tablewrap">
          <table class="sd-table">
            {#if block.headings.length}
              <thead>
                <tr>
                  {#each block.headings as heading}<CellHeading text={heading} />{/each}
                </tr>
              </thead>
            {/if}
            <tbody>
              {#each block.rows as row}
                <tr>
                  {#each row as cell}
                    <td
                      class:sd-cell--right={cell.right}
                      class:sd-cell--link={cellKind(cell) === 'link'}
                      class:sd-cell--action={cellKind(cell) === 'action'}
                    >
                      {#if cell.actions && cell.actions.length}
                        <span class="sd-cell-actions">
                          {#each cell.actions as action}
                            <CellAction href={action.href} label={action.label} />
                          {/each}
                        </span>
                      {:else if cellKind(cell) === 'action' && cell.text}<CellAction href={cell.href || '#'} label={cell.text} />{:else if cell.href}<CellLink href={cell.href} text={cell.text} />{:else}{cell.text}{/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}

      {#if !shown.blocks.length && !shown.actions.length}
        <p class="sd-panelnote">
          Nothing on this tab yet{shown.controls ? ` — it carries ${shown.controls} control${shown.controls === 1 ? '' : 's'}` : ''}.
        </p>
      {/if}

      {#if shown.note}<p class="sd-panelnote">{shown.note}</p>{/if}

      <p class="sd-panelnote">
        Read-only: this tab is the app's own output. Changes go through the
        app's own page — use Original.
      </p>
    </div>
  {:else}
  <div class="sd-editorbody">
    <table class="sd-fields">
      <tbody>
        {#each form.rows as row}
          <tr>
            <th scope="row">{row.label}</th>
            <td>
              {#each row.fields as field}
                {#if field.type === 'checkbox'}
                  <label class="sd-check">
                    <input type="checkbox" bind:checked={values[field.key]} />
                    <span>{field.label || field.name || field.key}</span>
                  </label>
                {:else if field.options}
                  <select bind:value={values[field.key]} class="sd-input">
                    {#each field.options as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else if field.type === 'textarea'}
                  <textarea class="sd-input sd-textarea" bind:value={values[field.key]} rows="3"></textarea>
                {:else if field.type === 'password'}
                  <input class="sd-input" type="password" bind:value={values[field.key]} />
                {:else}
                  <input class="sd-input" type="text" bind:value={values[field.key]} />
                {/if}
              {/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <!-- A page can print a table beside its form — the seasons page lists every
         season next to the one being edited. It is the app's own table, so it is
         read-only here and its rows are links into the editor. -->
    {#if form.tables && form.tables.length}
      {#each form.tables as block}
        {#if block.section}<h4 class="sd-section">{block.section}</h4>{/if}
        <div class="sd-tablewrap">
          <table class="sd-table">
            {#if block.headings.length}
              <thead>
                <tr>
                  {#each block.headings as heading}<CellHeading text={heading} />{/each}
                </tr>
              </thead>
            {/if}
            <tbody>
              {#each block.rows as row}
                <tr>
                  {#each row as cell}
                    <td
                      class:sd-cell--right={cell.right}
                      class:sd-cell--link={cellKind(cell) === 'link'}
                      class:sd-cell--action={cellKind(cell) === 'action'}
                    >
                      {#if cell.actions && cell.actions.length > 1}
                        <span class="sd-cell-actions">
                          {#each cell.actions as action}
                            <CellAction href={action.href} label={action.label} />
                          {/each}
                        </span>
                      {:else if cell.href}
                        <a href={cell.href} title="Open in the app's editor">{cell.text}</a>
                      {:else}{cell.text}{/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    {/if}
  </div>
  {/if}
</div>
{/if}
