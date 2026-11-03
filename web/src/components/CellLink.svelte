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
  // A cell that carries money keeps the amount out of the name: the table reader
  // takes the app's red balance span out of the cell's words and hands the figure
  // here, so the row reads as one name and the money waits behind the pill.
  import { splitBalance } from '../lib/balance.js';
  import DuePill from './DuePill.svelte';

  export let href = '';
  export let text = '';
  export let title = 'Open in the app';
  // The balance the reader found in the app's own marker. A cell whose words
  // still carry one — a page the reader did not classify — is read here instead.
  export let due = '';

  $: read = due ? { name: text, due } : splitBalance(text);
</script>

<a class="sd-celllink" {href} {title}>
  <span class="sd-celllink-name">{read.name}</span>
  {#if read.due}<DuePill due={read.due} />{/if}
  <span class="sd-celllink-go" aria-hidden="true">›</span>
</a>
