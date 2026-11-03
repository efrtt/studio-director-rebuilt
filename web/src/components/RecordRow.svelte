<script>
  import { recordId } from '../lib/shell.js';
  import { classParts, displayLabel } from '../lib/names.js';
  import { splitBalance } from '../lib/balance.js';

  export let item;
  export let mixed = false;
  export let here = '';
  // A class label ends in its meeting time, and a shelf has room for it. A name
  // has nothing beside it, because the panel gave nothing beside it — except a
  // balance, which is the family's business and not a second name.
  export let when = false;

  $: parts = when
    ? classParts(item.label)
    : (() => {
      const read = splitBalance(item.label);
      return { name: displayLabel(read.name), when: '', due: read.due };
    })();
  $: current = !!here && recordId(item.href) === here;

  // The app's own hover card, rebuilt: the balance follows the pointer, so the
  // row underneath stays readable and the pill never has to be reached for.
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

<li>
  <a
    href={item.href || '#'}
    title="Open in the app's editor"
    class:sd-record--current={current}
    aria-current={current ? 'true' : undefined}
  >
    {#if mixed && item.type}<span class="sd-type">{item.type}</span>{/if}
    <span class="sd-record-label">{parts.name}</span>
    {#if parts.when}<span class="sd-when">{parts.when}</span>{/if}
    {#if parts.due}
      <span
        class="sd-due"
        role="img"
        aria-label={`Balance due ${parts.due}`}
        on:pointerenter={showTip}
        on:pointermove={moveTip}
        on:pointerleave={hideTip}
      >$</span>
    {/if}
    <span class="sd-go" aria-hidden="true">&rsaquo;</span>
  </a>
  {#if tip}
    <div class="sd-tip" role="tooltip" style={tip.pos}>
      <div class="sd-tip-line">Balance due</div>
      <div class="sd-tip-line sd-tip-money">{parts.due}</div>
    </div>
  {/if}
</li>
