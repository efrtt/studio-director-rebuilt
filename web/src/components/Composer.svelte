<script>
  // The email composer, skinned around the app's own editor.
  //
  // The body is not ours and must not become ours: CKEditor owns that element,
  // its templates and the markup the email is made of.
  //
  // It must not be *moved* either. Moving a CKEditor container re-parents the
  // `<iframe>` it types into, and a moved iframe is a new document: the body went
  // blank on the live page while the instance still reported 2,154 characters
  // from its snapshot. So the editor stays exactly where the app put it, inside
  // the form, and this view only *places* it — `position: fixed` at the slot's
  // coordinates, above the overlay — and clears the inline style again on
  // teardown. CSS placement cannot destroy an iframe's document.
  //
  // Everything that submits is the app's own anchor: Send, Schedule and Add
  // Attachment are pressed on the live page, after our changed values have been
  // written into the app's own fields.
  import { onMount, onDestroy } from 'svelte';
  import { diffFields } from '../model/diff.js';

  export let composer;
  export let onAct = null;

  let fields = (composer.fields || []).map((field) => ({ ...field }));
  let values = {};
  for (const field of fields) {
    values[field.key] = field.type === 'checkbox' ? !!(field.checked !== undefined ? field.checked : field.value) : field.value;
  }

  let status = '';
  let busy = false;
  let slot = null;
  let attachSlot = null;
  let attachments = [];
  let editorMissing = false;

  // What was placed, and what its style looked like before: teardown has to leave
  // the app's element exactly as it was found.
  let placed = null;
  let observer = null;
  let lastFrame = '';
  // The app's attachment block, placed over its own slot rather than moved into
  // it: a file input that leaves `#idForm` is no longer part of the POST.
  let attachPlaced = null;
  let attachObserver = null;
  let attachFrame = '';
  // How tall the reader has made the frame with the editor's own grip.
  const MIN_FRAME = 240;
  let grip = null;

  $: changes = diffFields(fields, values);
  $: dirty = changes.length > 0;
  $: later = !!values.schedulecheckbox;
  $: actions = composer.actions || {};

  const why = {
    unchanged: () => 'Nothing has changed yet.',
    missing: (keys) => `The app’s own field for ${keys.join(', ')} is not on this page — use Original.`,
    'no-action': () => 'That control is not on this page — use Original.',
    ambiguous: () => 'More than one control on the page answers that name — use Original.'
  };

  // The attachments are the app's own file inputs. A file input cannot be filled
  // by script at all, so this reads their names and presses the app's own Add
  // Attachment rather than pretending to hold a file.
  function readAttachments() {
    try {
      attachments = Array.from(document.querySelectorAll('#idForm input[type="file"]'))
        .map((input) => (input.files && input.files.length ? input.files[0].name : ''))
        .filter(Boolean);
    } catch (e) {
      attachments = [];
    }
  }

  function frameOf() {
    if (!slot) return null;
    const rect = slot.getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  // Written only when the slot actually moved: a layout write on every animation
  // frame would be a layout read and a style write sixty times a second for a
  // page that is not scrolling.
  function place() {
    const frame = frameOf();
    if (!frame) return;
    const key = `${frame.left},${frame.top},${frame.width},${frame.height}`;
    if (key === lastFrame) return;
    lastFrame = key;
    const { style } = placed.el;
    style.position = 'fixed';
    style.left = `${frame.left}px`;
    style.top = `${frame.top}px`;
    style.width = `${frame.width}px`;
    style.height = `${frame.height}px`;
    style.margin = '0';
    style.zIndex = '2147483001';
  }

  // The app's attachments are file inputs inside the page's own form. The skin
  // hides that form, so they were invisible: pressing Add Attachment appended a
  // picker nobody could see or use. Place the block itself, which keeps the
  // inputs where the app submits them from.
  function placeAttachments() {
    if (!attachPlaced || !attachSlot) return;
    const rect = attachSlot.getBoundingClientRect();
    const key = `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}`;
    const { style } = attachPlaced.el;
    if (key !== attachFrame) {
      attachFrame = key;
      style.position = 'fixed';
      style.left = `${Math.round(rect.left)}px`;
      style.top = `${Math.round(rect.top)}px`;
      style.width = `${Math.round(rect.width)}px`;
      style.margin = '0';
      style.zIndex = '2147483001';
    }
    // The block is as tall as its rows, and adding a row grows it: the slot takes
    // that height, so the page makes room and the rows below move down.
    const want = `${Math.round(attachPlaced.el.getBoundingClientRect().height)}px`;
    if (attachSlot.style.height !== want) attachSlot.style.height = want;
  }

  function watchAttachments() {
    const block = document.querySelector('#attachmentoptions');
    if (!block || !attachSlot) {
      if (attachSlot) attachSlot.style.display = 'none';
      return;
    }
    attachPlaced = { el: block, style: block.getAttribute('style') };
    if (typeof ResizeObserver === 'function') {
      attachObserver = new ResizeObserver(sync);
      attachObserver.observe(block);
    }
    // A file chosen, or a row added by the app, changes what the frame reports.
    sync();
    readAttachments();
  }

  function onChange(event) {
    const target = event.target;
    if (target && target.matches && target.matches('input[type="file"]')) readAttachments();
  }

  // Placement is driven by what can actually move the slot, not by a frame loop:
  // a window resize, a scroll *anywhere* in the page (capture phase, because
  // scroll does not bubble and the shell's own pane is a scroll container), and
  // any change in the slot's own size. `lastFrame` keeps a scroll that changes
  // nothing from writing a style.
  function sync() {
    placeAttachments();
    place();
  }

  // CKEditor's grip writes a height onto its own `.cke_contents`, which the
  // composer sheet overrides — so left alone the grip is an affordance that
  // does nothing. The drag is taken over here instead: the *slot* is what gets
  // a height, and the editor is then placed at it like any other sync, which is
  // what keeps the frame, and everything below it, the right size.
  function onGripDown(event) {
    const target = event.target;
    if (!placed || !slot || !target || !target.closest) return;
    if (!target.closest('#cke_body .cke_resizer')) return;
    event.preventDefault();
    event.stopPropagation();
    grip = { y: event.clientY, height: slot.getBoundingClientRect().height };
    document.addEventListener('mousemove', onGripMove, true);
    document.addEventListener('mouseup', onGripUp, true);
  }

  function onGripMove(event) {
    if (!grip) return;
    event.preventDefault();
    const next = Math.max(MIN_FRAME, Math.round(grip.height + (event.clientY - grip.y)));
    slot.style.height = `${next}px`;
    place();
  }

  function onGripUp() {
    release();
    // The slot changed under the editor during the drag: settle once on release.
    sync();
  }

  function release() {
    document.removeEventListener('mousemove', onGripMove, true);
    document.removeEventListener('mouseup', onGripUp, true);
    grip = null;
  }

  function watch() {
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    document.addEventListener('mousedown', onGripDown, true);
    document.addEventListener('change', onChange, true);
    if (typeof ResizeObserver === 'function' && slot) {
      observer = new ResizeObserver(sync);
      observer.observe(slot);
      // The pane the slot scrolls inside, when it is not the window itself.
      const pane = slot.closest('.sd-body');
      if (pane) observer.observe(pane);
    }
    // A late reflow (the view's own rows appearing, a font landing) is neither a
    // scroll nor a resize.
    try {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
    } catch (e) { /* no font loading API: the events above still cover scrolling */ }
  }

  onMount(() => {
    const editor = document.querySelector(composer.editor.container);
    if (editor && slot) {
      placed = { el: editor, style: editor.getAttribute('style') };
      document.documentElement.classList.add('sd-composer-open');
      // A containing block made by an ancestor's transform would trap a fixed
      // element, so say so rather than placing it somewhere surprising.
      let node = editor.parentElement;
      let trapped = false;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || cs.contain.includes('paint')) {
          trapped = true;
          break;
        }
        node = node.parentElement;
      }
      if (trapped) {
        editorMissing = true;
        placed = null;
      } else {
        place();
        watch();
        // The editor's own sizing was computed for the page's column; it is now
        // the slot's size, which is what the inline style says.
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* not fatal */ }
        watchAttachments();
      }
    } else {
      editorMissing = true;
    }
    readAttachments();
  });

  onDestroy(() => {
    window.removeEventListener('resize', sync);
    window.removeEventListener('scroll', sync, true);
    document.removeEventListener('mousedown', onGripDown, true);
    document.removeEventListener('change', onChange, true);
    release();
    // The frame's height is ours, not the view's: give it back before leaving.
    if (slot) {
      slot.style.height = '';
      slot.style.minHeight = '';
    }
    if (observer) observer.disconnect();
    observer = null;
    if (attachObserver) attachObserver.disconnect();
    attachObserver = null;
    if (attachSlot) attachSlot.style.height = '';
    if (attachPlaced) {
      // Back to exactly what the app rendered: the attribute, or nothing.
      if (attachPlaced.style == null) attachPlaced.el.removeAttribute('style');
      else attachPlaced.el.setAttribute('style', attachPlaced.style);
      attachPlaced = null;
    }
    document.documentElement.classList.remove('sd-composer-open');
    if (!placed) return;
    // Back to exactly what the app rendered: the attribute, or nothing.
    if (placed.style == null) placed.el.removeAttribute('style');
    else placed.el.setAttribute('style', placed.style);
    placed = null;
  });

  function press(action) {
    if (busy || !action) return;
    if (!onAct) {
      status = 'No handler was attached for this page.';
      return;
    }
    busy = true;
    status = '';
    const result = onAct({ ...values }, action);
    busy = false;

    if (!result || !result.submitted) {
      const make = why[result && result.reason];
      status = make ? make(result && result.missing) : 'The app did not take that press.';
      return;
    }
    // The page holds these values now: the baseline moves with them.
    fields = fields.map((field) => ({ ...field, value: values[field.key], checked: values[field.key] }));
    status = `Pressed ${result.label || action.label} on the app’s own page…`;
    readAttachments();
  }

  function sendNow() {
    const to = String(composer.fixed.to || '').trim();
    const question = `Send this email now${to ? ` to ${to}` : ''}?\n\n`
      + 'This uses the app’s own Send, so it leaves the building. It is not undone from here.';
    if (!confirm(question)) return;
    press(actions.send);
  }
</script>

<div class="sd-composer">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {dirty ? `${changes.length} edited` : 'Ready'}
      {#if attachments.length} · {attachments.length} attached{/if}
    </span>
    <div class="sd-editor-actions">
      {#if actions.addAttachment}
        <button class="sd-btn" type="button" on:click={() => press(actions.addAttachment)}>Add attachment</button>
      {/if}
      {#if actions.schedule}
        <button class="sd-btn" type="button" disabled={busy} on:click={() => press(actions.schedule)}>Schedule</button>
      {/if}
      {#if actions.send}
        <button class="sd-btn sd-primary" type="button" disabled={busy} on:click={sendNow}>Send email</button>
      {/if}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus" role="status">{status}</p>{/if}

  <div class="sd-composer-fields">
    <div class="sd-composer-field">
      <span class="sd-composer-label">To</span>
      <p class="sd-composer-lock">{composer.fixed.to || '—'}</p>
    </div>
    <div class="sd-composer-field">
      <span class="sd-composer-label">From</span>
      <p class="sd-composer-lock">{composer.fixed.from || '—'}</p>
    </div>

    {#each fields as field (field.key)}
      {#if field.key === 'schedulecheckbox'}
        <div class="sd-composer-field">
          <span class="sd-composer-label">Delivery</span>
          <label class="sd-check">
            <input type="checkbox" bind:checked={values[field.key]} />
            <span>Schedule instead of sending</span>
          </label>
        </div>
      {:else if field.key === 'scheduledate' || field.key === 'schedulehour'}
        <!-- Drawn as one line under the fields, once the tick says it matters. -->
      {:else if field.type === 'checkbox'}
        <div class="sd-composer-field">
          <span class="sd-composer-label">Copy</span>
          <label class="sd-check">
            <input type="checkbox" bind:checked={values[field.key]} />
            <span>{field.label}</span>
          </label>
        </div>
      {:else if field.type === 'select'}
        <div class="sd-composer-field">
          <span class="sd-composer-label">{field.label}</span>
          <select class="sd-input" bind:value={values[field.key]}>
            {#each field.options as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      {:else}
        <div class="sd-composer-field">
          <span class="sd-composer-label">{field.label}</span>
          <input class="sd-input" type="text" bind:value={values[field.key]} />
        </div>
      {/if}
    {/each}
  </div>

  {#if later && fields.some((field) => field.key === 'scheduledate')}
    <div class="sd-composer-when">
      {#each fields.filter((field) => field.key === 'scheduledate' || field.key === 'schedulehour') as field (field.key)}
        {#if field.type === 'select'}
          <select class="sd-input" aria-label={field.label} bind:value={values[field.key]}>
            {#each field.options as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        {:else}
          <input class="sd-input" type="text" aria-label={field.label} bind:value={values[field.key]} />
        {/if}
      {/each}
      <span class="sd-composer-hint">Goes out at this date and time.</span>
    </div>
  {/if}

  <!-- An empty box the app's own editor is placed over. Nothing is moved into
       it: see the note at the top for why. -->
  <div class="sd-composer-editor" bind:this={slot}></div>

  <!-- The app's own attachment block, placed over this box rather than moved
       into it: a file input has to stay inside `#idForm` to be in the POST. -->
  <div class="sd-composer-attach" bind:this={attachSlot}></div>

  {#if editorMissing}
    <p class="sd-composer-note">
      The app’s editor could not be placed here, so this screen is not usable — use Original.
    </p>
  {/if}
  {#if attachments.length}
    <p class="sd-composer-note">Attached: {attachments.join(', ')}</p>
  {/if}

  <p class="sd-composer-note">
    The body is the app’s own editor, placed here untouched — its templates, images and formatting are the app’s. The
    fields around it are ours; Send, Schedule and Add Attachment are the page’s own controls.
  </p>
</div>
