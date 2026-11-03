<script>
  // One table heading.
  //
  // A column of Drop and Enroll buttons does not need to be labelled "Actions":
  // the shapes say what they are, and the word was taking the widest column in
  // the sheet. The heading is still here for a screen reader — only its ink is
  // hidden — so the column is not nameless.
  import { isActionHeading } from '../lib/heading.js';

  export let text = '';

  $: blank = isActionHeading(text);
</script>

{#if blank}
  <th class="sd-headblank"><span class="sd-sr">{text}</span></th>
{:else}
  <th>{text}</th>
{/if}
