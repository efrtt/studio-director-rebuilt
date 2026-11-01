<script>
  import { PX_PER_MIN } from '../lib/calendar.js';
  import { inkFor } from '../lib/color.js';

  export let week;

  $: hourHeight = 60 * PX_PER_MIN;

  function titleOf(block) {
    return block.details.length ? block.details.join('\n') : [block.name, block.meta].filter(Boolean).join('\n');
  }
</script>

<div class="sd-week">
  {#if week.week}
    <div class="sd-period">{week.week}</div>
  {/if}

  {#each week.days as day}
    <section class="sd-dayblock">
      <h3 class="sd-dayname">{day.label}</h3>

      {#if day.columns.length}
        <div class="sd-headrow" style={`--cols:${day.columns.length}`}>
          <div class="sd-headspacer"></div>
          {#each day.columns as column}
            <div class="sd-studiohead">{column.label}</div>
          {/each}
        </div>

        <div class="sd-timeline" style={`height:${day.height + 18}px;--hour:${hourHeight}px`}>
          <div class="sd-gutter">
            {#each day.hours as hour}
              <span class="sd-hourlabel" style={`top:${hour.top}px`}>{hour.label}</span>
            {/each}
          </div>

          <div class="sd-studiocols" style={`--cols:${day.columns.length}`}>
            {#each day.columns as column}
              <div class="sd-studiocol">
                {#each column.blocks as block}
                  <a
                    class="sd-block"
                    class:sd-block--full={block.status === 'full'}
                    class:sd-block--low={block.status === 'open' && block.spotsLeft <= 2}
                    class:sd-block--short={block.height < 46}
                    href={block.href}
                    title={titleOf(block)}
                    style={`top:${block.top}px;height:${block.height}px;` +
                      `background:${block.color || 'transparent'};` +
                      `color:${block.textColor || inkFor(block.color) || 'inherit'}`}
                  >
                    <span class="sd-block-name">{block.name}</span>
                    {#if block.meta}<span class="sd-block-meta">{block.meta}</span>{/if}
                  </a>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      {:else if !day.untimed.length}
        <p class="sd-none">No classes</p>
      {/if}

      {#if day.untimed.length}
        <div class="sd-untimed">
          <span class="sd-untimed-label">No time given</span>
          {#each day.untimed as block}
            <a class="sd-chip" href={block.href} title={titleOf(block)}>
              {block.code}{block.code ? ' ' : ''}{block.name}
            </a>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</div>
