<script>
  import CellAction from './CellAction.svelte';

  // The event page's Performance Info list.
  //
  // Arranging the rows is a local edit until it is saved: the row order lives in
  // the app's own hidden inputs, so "Save order" hands the arrangement back to
  // `applyOrder` and then presses the app's Save. The lock, the song link, the
  // delete link and the three controls are the app's own — pressed or followed,
  // never rebuilt.
  //
  // Nothing here moves the app's page until a button is pressed, which keeps the
  // project's one invariant intact: at most one same-origin GET per page view,
  // and no write that the app did not build itself.
  export let perf;
  export let onAct = null;
  export let onLock = null;
  export let onSave = null;

  let rows = perf.rows.slice();
  let drag = null;
  let over = null;
  let busy = false;
  let status = '';

  $: changed = rows.some((row, i) => row.order !== i + 1);
  $: lockedCount = rows.filter((row) => row.locked).length;
  $: actions = perf.actions || {};

  function move(from, to) {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = rows.slice();
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    rows = next;
    status = '';
  }

  function dragStart(e, i) {
    drag = i;
    over = null;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Firefox refuses a drag without payload.
      e.dataTransfer.setData('text/plain', String(i));
    }
  }

  function dragOver(e, i) {
    if (drag === null) return;
    e.preventDefault();
    over = i;
  }

  function dragEnd() {
    drag = null;
    over = null;
  }

  function drop(e, i) {
    if (e && e.preventDefault) e.preventDefault();
    if (drag !== null) move(drag, i);
    dragEnd();
  }

  function toggleLock(row, i) {
    const result = onLock ? onLock(row) : null;
    if (!result || !result.pressed) {
      status = 'The app’s lock control is not on this page — use Original.';
      return;
    }
    rows = rows.map((r, j) => (j === i ? { ...r, locked: result.locked } : r));
    status = '';
  }

  function save() {
    if (busy || !changed) return;
    if (!onSave) {
      status = 'No save handler was attached for this page.';
      return;
    }
    busy = true;
    const result = onSave(rows.map((row) => ({ ...row })));
    busy = false;

    if (!result || !result.submitted) {
      const why = {
        'order-missing': 'A performance’s order field is gone from the page — use Original.',
        'no-save-link': 'This page has no Save — use the app’s own page.',
        unchanged: 'This page already lists the performances in that order.'
      };
      status = !result ? 'Nothing to save.' : (why[result.reason] || 'The app did not take the new order.');
      return;
    }
    // The page carries the new numbers now, so the rows keep them: the dirty
    // marker clears and Save goes quiet until something moves again. Without
    // this the panel stayed dirty after its own save and a second press called
    // a save the app was right to skip a failure.
    rows = rows.map((row, i) => ({ ...row, order: i + 1 }));
    status = 'Sent the new order to the app’s Save…';
  }

  function act(action) {
    if (!action) return;
    if (changed && !confirm('The new order is not saved yet. Continue and lose it?')) return;
    const result = onAct ? onAct(action) : null;
    if (!result || !result.submitted) {
      status = result && result.reason === 'ambiguous'
        ? `“${action.label}” appears more than once on the page — use Original.`
        : `The app’s “${action.label}” control is not on this page — use Original.`;
      return;
    }
    status = `Asked the app to run “${action.label}”…`;
  }

  // Every way off this panel is a way to lose an unsaved arrangement, so each one
  // asks first.
  function beforeLeave(e) {
    if (!changed) return;
    if (!confirm('The new order is not saved yet. Leave and lose it?')) e.preventDefault();
  }

  function beforeDelete(e, row) {
    const name = row.song.label || 'this performance';
    const also = changed ? '\n\nThe new order is not saved yet.' : '';
    if (!confirm(`Delete ${name}?${also}\n\nThis runs the app’s own delete. It is not undone from here.`)) {
      e.preventDefault();
    }
  }
</script>

<section class="sd-perf" aria-labelledby="sd-perf-title">
  <div class="sd-perfhead">
    <h3 class="sd-perf-title" id="sd-perf-title">{perf.title || 'Performance Info'}</h3>
    <span class="sd-perfcount">
      {rows.length} performance{rows.length === 1 ? '' : 's'}{lockedCount ? ` · ${lockedCount} locked` : ''}
    </span>
    {#if changed}<span class="sd-perfdirty">Order changed — save to apply</span>{/if}

    <div class="sd-perfactions">
      {#if actions.add}
        <a class="sd-btn" href={actions.add.href} title={actions.add.label} on:click={beforeLeave}>Add new</a>
      {/if}
      {#if actions.autoOrder}
        <button
          class="sd-btn"
          type="button"
          disabled={busy}
          title={actions.autoOrder.label}
          on:click={() => act(actions.autoOrder)}
        >Auto-order</button>
      {/if}
      {#if actions.checkConflicts}
        <button
          class="sd-btn"
          type="button"
          disabled={busy}
          title={actions.checkConflicts.label}
          on:click={() => act(actions.checkConflicts)}
        >Save &amp; check</button>
      {/if}
      <button class="sd-btn sd-primary" type="button" disabled={!changed || busy} on:click={save}>
        {busy ? 'Saving…' : 'Save order'}
      </button>
    </div>
  </div>

  {#if !rows.length}
    <p class="sd-perfempty">
      No performances yet{#if actions.add} — <a href={actions.add.href} on:click={beforeLeave}>add the first one</a>{/if}.
    </p>
  {:else}
    <div class="sd-tablewrap sd-perfwrap">
      <table class="sd-table sd-perftable">
        <thead>
          <tr>
            <th class="sd-perforder">Order</th>
            <th class="sd-perflockcol">Locked</th>
            <th>Song</th>
            <th>Class</th>
            <th>Instructor</th>
            <th>Day</th>
            <th class="sd-cell--right">Start</th>
            <th class="sd-cell--right">Length</th>
            <th>Notes</th>
            <th class="sd-cell--right"><span class="sd-perfhide">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i (row.key)}
            <tr
              class:sd-perfrow--dragging={drag === i}
              class:sd-perfrow--over={over === i && drag !== null && drag !== i}
              on:dragover={(e) => dragOver(e, i)}
              on:drop={(e) => drop(e, i)}
            >
              <td class="sd-perforder">
                <div class="sd-perfmove">
                  <!-- The handle is the only draggable thing, so a row can still
                       be selected and copied like text. -->
                  <span
                    class="sd-perfhandle"
                    draggable="true"
                    title="Drag to reorder"
                    aria-hidden="true"
                    on:dragstart={(e) => dragStart(e, i)}
                    on:dragend={dragEnd}
                  >⋮⋮</span>
                  <span class="sd-perfnum">{i + 1}</span>
                  <span class="sd-perfbtns">
                    <button
                      class="sd-perfmv"
                      type="button"
                      disabled={i === 0}
                      title="Move up"
                      aria-label={`Move ${row.song.label || 'this performance'} up`}
                      on:click={() => move(i, i - 1)}
                    >↑</button>
                    <button
                      class="sd-perfmv"
                      type="button"
                      disabled={i === rows.length - 1}
                      title="Move down"
                      aria-label={`Move ${row.song.label || 'this performance'} down`}
                      on:click={() => move(i, i + 1)}
                    >↓</button>
                  </span>
                </div>
              </td>

              <td class="sd-perflockcol">
                <button
                  class="sd-perflock"
                  class:sd-perflock--on={row.locked}
                  type="button"
                  aria-pressed={row.locked ? 'true' : 'false'}
                  title={row.locked
                    ? 'Locked — the app’s auto-order leaves this one where it is'
                    : 'Unlocked — auto-order may move it'}
                  on:click={() => toggleLock(row, i)}
                >{row.locked ? 'Locked' : 'Open'}</button>
              </td>

              <!-- The name is the row, the buttons are the way in: a linked
                   name beside an Edit button made two targets for one page. -->
              <td>{row.song.label || 'Untitled'}</td>

              <td>{row.className}</td>
              <td>{row.instructor}</td>
              <td>{row.day}</td>
              <td class="sd-cell--right">{row.start}</td>
              <td class="sd-cell--right">{row.length}</td>
              <td class="sd-perfnote" title={row.notes}>{row.notes}</td>
              <td class="sd-cell--right sd-cell--action">
                <span class="sd-cell-actions">
                  {#if row.song.href}
                    <CellAction
                      href={row.song.href}
                      label="Edit"
                      title="Edit this performance in the app"
                      onPress={beforeLeave}
                    />
                  {/if}
                  {#if row.deleteHref}
                    <CellAction
                      href={row.deleteHref}
                      label="Delete"
                      title="Delete this performance"
                      onPress={(e) => beforeDelete(e, row)}
                    />
                  {/if}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if status}<p class="sd-perfstatus" role="status">{status}</p>{/if}
</section>
