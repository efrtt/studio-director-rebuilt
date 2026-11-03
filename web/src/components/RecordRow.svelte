<script>
  import { recordId } from '../lib/shell.js';
  import { classParts, displayLabel } from '../lib/names.js';
  import { splitBalance } from '../lib/balance.js';
  import DuePill from './DuePill.svelte';

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
    {#if parts.due}<DuePill due={parts.due} />{/if}
    <span class="sd-go" aria-hidden="true">&rsaquo;</span>
  </a>
</li>
