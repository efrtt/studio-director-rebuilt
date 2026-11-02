<script>
  // The list-first screen for the pages that pair a form with a list of records.
  //
  // The live app already answers every one of these with a full page: the list is
  // server-rendered beside the form, `meth=neu` fills an empty one, and
  // `meth=edit&<ident>=…` fills it with the record. So this component draws the
  // list as the page and puts the form in a dialog over it — no fetch, no rebuilt
  // POST — and the app's own Save, Delete and navigation keep working.
  //
  // The app's button bar (New, Delete) lives outside the form, so it arrives as
  // `bar` rather than through `source`: measured live, `ManageVendors` prints
  // `a#new`, `a#save`, `a#delete` in `.ButtonBar`, and only on the record pages —
  // the add page has no bar at all, because that page *is* the add form.
  import RecordDialog from './RecordDialog.svelte';
  import { cellKind } from '../lib/cellclass.js';
  import { rememberDeleted } from '../lib/deletedname.js';
  import {
    recordsOf, modeOf, listHrefOf, newHrefOf, widthOf, headingOf, openIdOf, labelOf, blankFormOf,
    backHrefOf
  } from '../lib/records.js';

  // The page's model: `task` or `form`, whichever claims it.
  export let source = null;
  export let url = '';
  export let title = '';
  export let recordLabel = '';
  export let saveLabel = 'Save';
  export let onSave = null;
  // The page's own bar, read from the live page where it can be clicked.
  export let bar = null;
  export let onAction = null;
  // A sentence to show above the list: the app's own answer after a save.
  export let notice = '';
  // The app's own question before it deletes: `{ label, name, href, cancelHref }`.
  // Drawn as a dialog over the list, because that is the screen it belongs to.
  export let question = null;

  // A form opened on this page rather than by its URL. The add page carries the
  // empty form and no New link, so New opens that form instead of navigating.
  let openedNew = false;
  // A dialog the URL opened. Closing it shows the list that came with the page
  // rather than fetching the list URL.
  let dismissed = false;

  $: found = recordsOf(source, url);
  $: fields = (source && source.fields) || [];
  $: rows = (source && source.rows) || [];
  $: newHref = newHrefOf({ bar, actions: (source && source.actions) || [], links: (source && source.links) || [] });
  $: localNew = !newHref && blankFormOf(source);
  $: urlMode = modeOf(url);
  $: mode = urlMode !== 'none' && !dismissed ? urlMode : (openedNew ? 'new' : 'none');
  $: listHref = listHrefOf(url, newHref);
  // Where closing goes. The page the click came from beats a URL this rebuild
  // derived: the archive pages (`NewEditArchive&content=…`) answer their own
  // stripped URL with an error screen, so a guess turned Cancel into a 404.
  $: cameFrom = backHrefOf(url, typeof document === 'undefined' ? '' : document.referrer, listHref);
  // The record's own name is the heading when one is open: "Manage Vendors" is
  // the page, "Amazon.com" is what you are editing.
  $: head = headingOf(mode, (open && open.label) || title || (source && source.title) || '');
  $: label = recordLabel || labelOf(title || (source && source.title) || '');
  $: width = widthOf(fields.length);
  $: count = found ? found.rows.length : 0;
  // The row the URL names, so the list still says which record is open.
  $: openId = openIdOf(url);
  $: open = found && mode === 'edit' ? found.rows.find((row) => row.id && row.id === openId) || null : null;
  // New is the bar's own control, not something to repeat inside the dialog.
  $: recordActions = bar && bar.items
    ? bar.items.filter((item) => !/^(new|add|create|save)$/i.test(String(item.label || '').trim()))
    : [];

  // The question is the last page that knows which record the answer is about:
  // once the app has deleted it, the name cannot be printed on the next screen.
  $: if (question) rememberDeleted(question.href || url, question.name);

  // Closing a dialog the page opened. The list is already drawn underneath, so
  // nothing is requested: the dialog goes away and the address bar is rewritten
  // to the list, which is what a reload should get. Only a page with no list to
  // return to has to navigate.
  function dismiss() {
    if (found) {
      dismissed = true;
      try {
        history.replaceState(null, '', cameFrom || url);
      } catch (err) { /* address bar only */ }
      return;
    }
    if (cameFrom) {
      location.href = cameFrom;
      return;
    }
    history.back();
  }
</script>

<div class="sd-recordpage">
  {#if notice}
    <p class="sd-recordnotice" role="status">
      <span class="sd-recordnotice-mark" aria-hidden="true">✓</span>{notice}
    </p>
  {/if}

  <div class="sd-recordbar">
    <div class="sd-recordcount">
      <strong>{count}</strong> {count === 1 ? label : `${label}s`}
    </div>
    {#if newHref}
      <a class="sd-btn sd-primary" href={newHref} title={newHref}>New {label}</a>
    {:else if localNew}
      <button class="sd-btn sd-primary" type="button" on:click={() => (openedNew = true)}>
        New {label}
      </button>
    {/if}
  </div>

  {#if found}
    <div class="sd-recordcard">
      <div class="sd-tablewrap">
        <table class="sd-table">
          {#if found.block.headings.length}
            <thead>
              <tr>
                {#each found.block.headings as heading}<th>{heading}</th>{/each}
                <th class="sd-recordedit">Edit</th>
              </tr>
            </thead>
          {/if}
          <tbody>
            {#each found.rows as row}
              <tr class:sd-recordrow--open={open === row}>
                {#each row.cells as cell}
                  <td
                    class:sd-cell--right={cell.right}
                    class:sd-cell--link={cellKind(cell) === 'link'}
                    class:sd-cell--action={cellKind(cell) === 'action'}
                  >
                    {#if cell.actions && cell.actions.length > 1}
                      <span class="sd-cell-actions">
                        {#each cell.actions as action}
                          <a class="sd-pill" href={action.href} title={action.label}>{action.label}</a>
                        {/each}
                      </span>
                    {:else}{cell.text}{/if}
                  </td>
                {/each}
                <td class="sd-recordedit">
                  <a class="sd-pill" href={row.href} title="Edit {row.label || 'this record'}">Edit</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if source && source.tables && source.tables.length}
    {#each source.tables as block}
      {#if block.section}<h4 class="sd-section">{block.section}</h4>{/if}
      <div class="sd-recordcard">
        <div class="sd-tablewrap">
          <table class="sd-table">
            {#if block.headings.length}
              <thead><tr>{#each block.headings as heading}<th>{heading}</th>{/each}</tr></thead>
            {/if}
            <tbody>
              {#each block.rows as row}
                <tr>
                  {#each row as cell}
                    <td class:sd-cell--right={cell.right}>{cell.text}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
  {/if}
</div>

{#if mode !== 'none' && fields.length}
  <RecordDialog
    eyebrow={head.eyebrow}
    title={head.title}
    rows={rows}
    {fields}
    {width}
    {saveLabel}
    actions={recordActions}
    {onAction}
    cancelHref={urlMode === 'none' ? '' : cameFrom}
    onCancel={urlMode === 'none' ? () => (openedNew = false) : dismiss}
    {onSave}
  />
{/if}

{#if question}
  <!-- The app's delete question, over the list it will change. Both answers are
       the app's own links: Delete is its `meth=delconfirmed` GET, Cancel is the
       record's edit page, so neither request is built here. -->
  <div class="sd-overlay" role="presentation">
    <div
      class="sd-dialog sd-dialog--narrow"
      role="dialog"
      aria-modal="true"
      aria-label="{question.label} {question.name}"
    >
      <div class="sd-dialog-head">
        <div>
          <div class="sd-eyebrow">{question.label}</div>
          <h2 class="sd-dialog-title">{question.label} {question.name}?</h2>
        </div>
        {#if question.cancelHref}
          <a class="sd-dialog-x" href={question.cancelHref} aria-label="Cancel" title="Cancel">✕</a>
        {/if}
      </div>
      <div class="sd-dialog-body">
        <p class="sd-asktext">
          The app asks before it removes anything, so nothing has been deleted yet.
        </p>
      </div>
      <div class="sd-dialog-foot">
        <span class="sd-dialog-left"><span class="sd-dirty">This cannot be undone.</span></span>
        <span class="sd-dialog-actions">
          {#if question.cancelHref}
            <a class="sd-btn" href={question.cancelHref}>Cancel</a>
          {/if}
          <a class="sd-btn sd-btn--danger" href={question.href} title={question.href}>{question.label}</a>
        </span>
      </div>
    </div>
  </div>
{/if}
