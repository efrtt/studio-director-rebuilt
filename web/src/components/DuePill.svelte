<script>
  // The dollar pill: a family that owes money says so with a red $ and keeps the
  // figure for the pointer. The card follows the pointer the way the week's class
  // card does, so the row underneath stays readable and there is nothing to reach
  // for.
  export let due = '';

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

<span
  class="sd-due"
  role="img"
  aria-label={`Balance due ${due}`}
  on:pointerenter={showTip}
  on:pointermove={moveTip}
  on:pointerleave={hideTip}
>$</span>
{#if tip}
  <div class="sd-tip" role="tooltip" style={tip.pos}>
    <div class="sd-tip-line">Balance due</div>
    <div class="sd-tip-line sd-tip-money">{due}</div>
  </div>
{/if}
