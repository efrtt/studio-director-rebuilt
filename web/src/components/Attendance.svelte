<script>
  // One column per date, the students inside it: the shape a register has on
  // paper, and the one the Schedule screen already uses for the week.
  //
  // A tick means present. Unticking a student marks them out, which puts their
  // reason on the same line and a pencil beside it; the pencil opens the reason
  // and the studio notes in the skin's own dialog. Each date keeps the page's
  // own Cancel Class control, and attendance notes stay one field for the class.
  //
  // Every one of those gestures is a gesture on the app's own control (see
  // lib/attendance.js), so the page - not this component - is the record. Save
  // is the page's Save, and it submits.
  export let attendance;
  export let onAttend = null;

  // A local mirror of the cells so a tick or a reason shows at once. The app's
  // fields are written at the same moment; this is the view of them.
  let cells = attendance.students.map((student) => {
    const copy = {};
    for (const date of attendance.dates) {
      const cell = student.cells[date.key];
      copy[date.key] = cell ? { ...cell } : null;
    }
    return copy;
  });

  let notesValue = attendance.notes ? attendance.notes.value : '';
  let status = '';
  // The absence editor: which student and which date it was opened on.
  let editing = null;
  let dialogReason = '';
  let dialogNotes = '';

  $: totals = (() => {
    let expected = 0;
    let present = 0;
    for (const row of cells) {
      for (const date of attendance.dates) {
        const cell = row[date.key];
        if (!cell) continue;
        expected += 1;
        if (cell.present) present += 1;
      }
    }
    return { expected, present };
  })();

  $: editingDate = editing ? attendance.dates.find((date) => date.key === editing.dateKey) : null;
  $: editingStudent = editing ? attendance.students[editing.index] : null;

  // A card's count, computed here rather than in the markup: Svelte tracks the
  // variables an expression names, and `countFor(date.key)` names none of them,
  // so a count written that way never followed a tick. This `$:` does name
  // `cells`, so it is recomputed whenever the register changes.
  $: perDate = (() => {
    const counts = {};
    for (const date of attendance.dates) {
      let expected = 0;
      let present = 0;
      for (const row of cells) {
        const cell = row[date.key];
        if (!cell) continue;
        expected += 1;
        if (cell.present) present += 1;
      }
      counts[date.key] = { expected, present };
    }
    return counts;
  })();

  function labelOf(options, value) {
    const found = (options || []).find((option) => String(option.value) === String(value));
    return found && found.label ? found.label : 'No reason given';
  }

  function toggle(index, date, event) {
    const cell = cells[index][date.key];
    if (!cell) return;
    const wanted = !!event.target.checked;
    const result = onAttend ? onAttend.mark(cell.boxId, wanted) : null;
    if (!result || !result.ok) {
      event.target.checked = cell.present;
      status = 'That tick box is not on the page — use Original.';
      return;
    }
    cell.present = wanted;
    // A new array, not the same one: the mirror is what everything above reads.
    cells = [...cells];
    status = wanted
      ? ''
      : `${attendance.students[index].name} marked absent. Save when the class is done.`;
  }

  function openEditor(index, dateKey) {
    const cell = cells[index][dateKey];
    if (!cell) return;
    editing = { index, dateKey };
    dialogReason = String(cell.reason.value);
    dialogNotes = String(cell.notes.value || '');
  }

  function closeEditor() {
    editing = null;
  }

  function saveEditor() {
    if (!editing) return;
    const { index, dateKey } = editing;
    const cell = cells[index][dateKey];
    const result = onAttend ? onAttend.absence(cell, dialogReason, dialogNotes) : null;
    if (!result || !result.ok) {
      status = 'The app’s own reason and notes fields are not on this page — use Original.';
      return;
    }
    cell.reason.value = String(dialogReason);
    cell.reason.label = labelOf(cell.options, dialogReason);
    cell.notes.value = dialogNotes;
    cells = [...cells];
    editing = null;
    status = '';
  }

  function press(action) {
    if (!onAttend) return;
    const result = onAttend.press(action);
    if (!result || !result.submitted) {
      status = `“${action.label}” could not be pressed — use Original.`;
      return;
    }
    status = `Asked the app to run “${action.label}”…`;
  }

  function save() {
    if (!onAttend) return;
    const result = onAttend.save();
    if (!result || !result.submitted) {
      status = 'This page has no Save control — use Original.';
      return;
    }
    status = 'Asked the app to save this attendance…';
  }

  function writeNotes(event) {
    notesValue = event.target.value;
    if (!onAttend) return;
    const result = onAttend.notes(attendance.notes, notesValue);
    if (!result || !result.ok) status = 'The class notes field is not on this page — use Original.';
  }

  function onBackdrop(event) {
    if (event.target === event.currentTarget) closeEditor();
  }

  // The dialog is the screen while it is open: Escape closes it and nothing
  // else. App.svelte holds the same rule for its own Escape.
  function onKey(event) {
    if (!editing || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closeEditor();
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="sd-att">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {totals.present} of {totals.expected} present · {attendance.dates.length}
      date{attendance.dates.length === 1 ? '' : 's'}
    </span>
    <div class="sd-editor-actions">
      {#each attendance.nav as action}
        <button class="sd-btn" type="button" title={action.onclick} on:click={() => press(action)}>
          {action.label}
        </button>
      {/each}
      {#if attendance.nav.length && attendance.save}<span class="sd-barsep" aria-hidden="true"></span>{/if}
      {#if attendance.save}
        <button
          class="sd-btn sd-primary"
          type="button"
          title={attendance.save.onclick || 'Save this attendance with the app’s own Save'}
          on:click={save}
        >{attendance.save.label}</button>
      {/if}
    </div>
  </div>

  <!-- The line is always in the flow, at one line's height: a message must not
       push the register down from under a pointer already on its way to the
       pencil the untick just revealed. -->
  <p class="sd-editorstatus" class:sd-editorstatus--blank={!status} role="status">{status}</p>

  <div class="sd-attbody">
    <!-- The page's own ways of adding someone to this class, in one row above
         the register: they act on the class as a whole, not on the notes. -->
    {#if attendance.actions.length}
      <p class="sd-attlinks">
        {#each attendance.actions as action}
          <button class="sd-action" type="button" title={action.onclick} on:click={() => press(action)}>
            {action.label}
          </button>
        {/each}
      </p>
    {/if}

    <div class="sd-attgrid">
      {#each attendance.dates as date (date.key)}
        <section class="sd-attcol" aria-label={date.label}>
          <header class="sd-attcolhead">
            <div>
              <b class="sd-attdate">{date.label}</b>
              <span class="sd-attcount">{perDate[date.key].present} of {perDate[date.key].expected} present</span>
            </div>
            {#if date.cancel}
              <button
                class="sd-iconbtn"
                type="button"
                title="Cancel class on {date.label}"
                aria-label="Cancel class on {date.label}"
                on:click={() => press(date.cancel)}
              >
                <span class="sd-icon sd-icon--drop" aria-hidden="true"></span>
              </button>
            {/if}
          </header>
          <ul class="sd-attrows">
            {#each attendance.students as student, index}
              {#if cells[index][date.key]}
                <li class="sd-attrow" class:sd-attrow--out={!cells[index][date.key].present}>
                  <input
                    type="checkbox"
                    checked={cells[index][date.key].present}
                    aria-label="{student.name} present on {date.label}"
                    on:change={(event) => toggle(index, date, event)}
                  />
                  {#if student.href}
                    <a class="sd-attname" href={student.href} title="Open {student.name}">{student.name}</a>
                  {:else}
                    <span class="sd-attname">{student.name}</span>
                  {/if}
                  {#if cells[index][date.key].mark}
                    <span
                      class="sd-attmark"
                      title={cells[index][date.key].mark.title || 'Marked on the page'}
                    >{cells[index][date.key].mark.label || cells[index][date.key].mark.n}</span>
                  {/if}
                  {#if !cells[index][date.key].present}
                    <span class="sd-attreason" title={cells[index][date.key].reason.label}>
                      {cells[index][date.key].reason.label || 'No reason given'}
                    </span>
                    <button
                      class="sd-action sd-attedit"
                      type="button"
                      title="Reason and notes for {student.name}"
                      aria-label="Reason and notes for {student.name} on {date.label}"
                      on:click={() => openEditor(index, date.key)}
                    >
                      <span class="sd-icon sd-icon--edit" aria-hidden="true"></span>
                    </button>
                  {/if}
                </li>
              {/if}
            {/each}
          </ul>
        </section>
      {/each}
    </div>

    {#if attendance.notes}
      <div class="sd-attnotes">
        <h3 class="sd-section">Attendance notes</h3>
        <textarea
          class="sd-input sd-textarea"
          rows="3"
          value={notesValue}
          placeholder="Notes for this class…"
          on:change={writeNotes}
        ></textarea>
      </div>
    {/if}
  </div>

  {#if editing && editingDate && editingStudent}
    <div class="sd-overlay" role="presentation" on:click={onBackdrop}>
      <div class="sd-dialog sd-dialog--narrow" role="dialog" aria-modal="true" aria-labelledby="sd-absence-title">
        <div class="sd-dialog-head">
          <div>
            <div class="sd-eyebrow">
              Absence · {editingDate.label}{attendance.className ? ` · ${attendance.className}` : ''}
            </div>
            <h2 class="sd-dialog-title" id="sd-absence-title">{editingStudent.name}</h2>
          </div>
          <button class="sd-dialog-x" type="button" aria-label="Close" title="Close" on:click={closeEditor}>✕</button>
        </div>
        <div class="sd-dialog-body">
          <table class="sd-fields">
            <tbody>
              <tr>
                <th scope="row">Reason</th>
                <td>
                  <select class="sd-input" bind:value={dialogReason}>
                    {#each cells[editing.index][editing.dateKey].options as option}
                      <option value={option.value}>{option.label || 'No reason given'}</option>
                    {/each}
                  </select>
                </td>
              </tr>
              <tr>
                <th scope="row">Studio notes</th>
                <td>
                  <textarea
                    class="sd-input sd-textarea"
                    rows="3"
                    placeholder="Why they were out, who called…"
                    bind:value={dialogNotes}
                  ></textarea>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="sd-dialog-foot">
          <span class="sd-dialog-left">
            <span class="sd-dirty">Written into the app’s own fields; the class Save submits it</span>
          </span>
          <span class="sd-dialog-actions">
            <button class="sd-btn" type="button" on:click={closeEditor}>Cancel</button>
            <button class="sd-btn sd-primary" type="button" on:click={saveEditor}>Save</button>
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>
