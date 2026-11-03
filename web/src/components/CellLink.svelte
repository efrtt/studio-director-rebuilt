<script>
  // A cell that goes somewhere — a student, a class, a charge.
  //
  // The link fills its cell, so the whole box is the target, and it stays quiet
  // until the pointer arrives: then the cell takes the accent wash and a hairline,
  // while the name turns accent and underlines. The chevron waits at the cell's
  // right edge and simply fades in - travelling across the row drew the eye to
  // the movement instead of to the name. Nothing else in the row moves: the
  // row's own hover was removed for exactly this reason.
  //
  // A cell that carries money — a family whose balance is due, printed by the app
  // inside the cell — keeps the amount out of the name and puts it behind the
  // dollar pill, so the row still reads as one name and the figure waits for the
  // pointer instead of competing with it.
  import { splitBalance } from '../lib/balance.js';

  export let href = '';
  export let text = '';
  export let title = 'Open in the app';

  $: read = splitBalance(text);

  // The amount follows the pointer, the way the week's class card does, so the
  // cell underneath stays readable.
  let tip = null;

  function placeAt(x, y) {
    const left = x + 16 + 200 > window.innerWidth ? Math.max(8, x - 216) : x + 16;
    const top = Math.max(8, Math.min(y + 18, window.innerHeight - 90));
    return 'left:' + left + 'px;top:' + top + 'px';
  }

  function showTip(event) {
    tip = { pos: placeAt(event.clientX, event.clientY) };
  }

  function moveTip(event) {
    if (tip) tip = { pos: placeAt(event.clientX, event.clientY) };
  }

  function hideTip() {
    tip = null;
  }
</script>

<a class="sd-celllink" {href} {title}>
  <span class="sd-celllink-name">{read.name}</span>
  {#if read.due}
    <span
      class="sd-due"
      role="img"
      aria-label={`Balance due ${read.due}`}
      on:pointerenter={showTip}
      on:pointermove={moveTip}
      on:pointerleave={hideTip}
    >$</span>
  {/if}
  <span class="sd-celllink-go" aria-hidden="true">›</span>
  {#if tip}
    <div class="sd-tip" role="tooltip" style={tip.pos}>
      <div class="sd-tip-line">Balance due</div>
      <div class="sd-tip-line sd-tip-money">{read.due}</div>
    </div>
  {/if}
</a>
