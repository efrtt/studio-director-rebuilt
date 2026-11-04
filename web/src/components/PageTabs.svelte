<script>
  // The app's own tab strip, drawn once for every view that needs it.
  //
  // On a dashboard the tabs you are not on are anchors
  // (`admin.sd?page=HomePage&tab=tab-insights`) and the one you are on is a
  // plain `div.selectedTab` with no href. Reading only the anchors lost the
  // current tab; reading only the divs lost the rest.
  export let tabs = [];

  import { tabpill } from '../lib/tabpill.js';

  const keyOf = (href) => new URLSearchParams(String(href || '').split('?')[1] || '').get('tab') || '';
  let here = '';
  try { here = new URLSearchParams(window.location.search).get('tab') || ''; } catch (e) { here = ''; }

  function current(tab) {
    if (tab.selected) return true;
    const key = keyOf(tab.href);
    return !!key && key === here;
  }
</script>

{#if tabs.length > 1}
  <nav class="sd-tabs" aria-label="Page views" use:tabpill>
    {#each tabs as tab}
      {#if tab.href}
        <a class="sd-tab" class:sd-tab--on={current(tab)} href={tab.href}>{tab.label}</a>
      {:else}
        <span class="sd-tab sd-tab--on" aria-current="page">{tab.label}</span>
      {/if}
    {/each}
  </nav>
{/if}
