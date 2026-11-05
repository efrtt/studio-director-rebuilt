<script>
  // The New Payment screen, drawn as option A of the three mockups: the fields
  // you fill in on the left, what is owed and how it is paid on the right.
  //
  // Three things were asked for after the mockups, and they shape this file:
  //   - no allocation bar: the screen does not draw a total the app would not
  //     agree with, so it does not draw one at all;
  //   - the splits are hidden until "Split payment" is pressed — three printed
  //     blocks on a plain payment is six controls that do nothing;
  //   - adding a split lives inside the split table, where the rows are, not
  //     beside Process payment.
  //
  // Every value here is a mirror of the app's own control. Nothing is submitted:
  // `onSubmit` writes the changed fields into the live page and presses the app's
  // own Process Payment, so the request, the validation and the receipt are the
  // app's. Same for a new split: the app builds the row, and the model is read
  // again afterwards.
  export let payment;
  export let onSubmit = null;
  export let onAddSplit = null;

  let model = payment;
  let values = seed(payment);
  // A page that arrives mid-split (an amount already typed in a row) shows its
  // splits; a plain payment does not.
  let splitOpen = !!payment.filled;
  let busy = false;
  let message = '';

  function seed(p) {
    const out = {};
    for (const field of (p && p.fields) || []) out[field.key] = field.value;
    return out;
  }

  // The app re-read after Add Split has a new row; keep whatever was already
  // typed here and take the app's value for anything new.
  function reseed(next) {
    const fresh = seed(next);
    for (const key of Object.keys(fresh)) {
      if (key in values) fresh[key] = values[key];
    }
    return fresh;
  }

  $: base = (model && model.base) || [];
  $: amountField = base.find((f) => f.name === 'amount') || null;
  $: dateFields = base.filter((f) => /_date$/.test(f.name));
  $: noteField = base.find((f) => f.name === 'notes') || null;
  $: splits = (model && model.splits) || [];
  $: totals = (model && model.totals) || [];
  $: method = (model && model.method) || null;
  $: family = (model && model.family) || '';

  function dateCaption(field) {
    return /deposit/i.test(field.name) ? 'Deposit' : 'Payment';
  }

  function pressSplit(giveUp) {
    if (!onAddSplit) {
      message = 'No handler was attached for this page’s split control.';
      return false;
    }
    busy = true;
    message = '';
    const result = onAddSplit();
    busy = false;

    if (!result || !result.ok) {
      message = giveUp;
      return false;
    }
    if (result.payment) {
      values = reseed(result.payment);
      model = result.payment;
    }
    return true;
  }

  // The app draws no split rows until its own "Split Payment" is pressed, so the
  // button opens the table and causes the rows in one step.
  function openSplits() {
    splitOpen = true;
    pressSplit('The app’s “Split Payment” control is not on this page — use Original.');
  }

  function addSplit() {
    pressSplit('The app’s “Add Another Split” control is not on this page — use Original.');
  }

  function submit() {
    if (!onSubmit) {
      message = 'No handler was attached for this page’s payment.';
      return;
    }
    busy = true;
    message = '';
    const result = onSubmit(values);
    busy = false;

    if (!result || !result.ok) {
      message = result && result.reason === 'missing'
        ? `The app no longer has the control for: ${(result.missing || []).join(', ')}.`
        : 'The app’s “Process Payment” control is not on this page — use Original.';
      return;
    }
    message = 'Asked the app to process the payment…';
  }
</script>

<div class="sd-editor">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {family ? `New payment · ${family}` : 'New payment'}
    </span>
    <div class="sd-editor-actions">
      {#if !splitOpen && (splits.length || (model && (model.splitPayment || model.addSplit)))}
        <button class="sd-btn" type="button" disabled={busy} on:click={openSplits}>
          Split payment
        </button>
      {/if}
      <button class="sd-btn sd-primary" type="button" disabled={busy} on:click={submit}>
        {busy ? 'Working…' : 'Process payment'}
      </button>
    </div>
  </div>

  {#if message}
    <p class="sd-editorstatus">{message}</p>
  {/if}

  <div class="sd-paybody">
    <div class="sd-paygrid">
      <div class="sd-paymain">
        <div class="sd-paycard sd-paycard--pad">
          <table class="sd-fields sd-fields--pay">
            <tbody>
              <tr>
                <th scope="row">Family</th>
                <td class="sd-paytopic">{family || '—'}</td>
              </tr>

              {#if amountField}
                <tr>
                  <th scope="row">{amountField.label || 'Amount'}</th>
                  <td>
                    <input
                      class="sd-input sd-paymoney"
                      type="text"
                      inputmode="decimal"
                      autocomplete="off"
                      bind:value={values[amountField.key]}
                    />
                  </td>
                </tr>
              {/if}

              {#if dateFields.length}
                <tr>
                  <th scope="row">Dates</th>
                  <td>
                    <div class="sd-paydates">
                      {#each dateFields as field (field.key)}
                        <label class="sd-paydate">
                          <span>{dateCaption(field)}</span>
                          <input class="sd-input" type="date" bind:value={values[field.key]} />
                        </label>
                      {/each}
                    </div>
                  </td>
                </tr>
              {/if}

              {#if noteField}
                <tr>
                  <th scope="row">{noteField.label || 'Notes'}</th>
                  <td>
                    <input
                      class="sd-input"
                      type="text"
                      autocomplete="off"
                      placeholder="Optional — printed on the receipt"
                      bind:value={values[noteField.key]}
                    />
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        {#if splitOpen && (splits.length || (model && model.addSplit))}
          <div class="sd-paycard sd-paysplits">
            <div class="sd-payhead">
              <span>Payment splits</span>
              <span class="sd-paycount">{splits.length}</span>
            </div>
            <div class="sd-paycard--pad">
              <table class="sd-paylist">
                <thead>
                  <tr>
                    <th scope="col">Paid toward</th>
                    <th scope="col" class="sd-cell--right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {#each splits as split (split.idx)}
                    <tr>
                      <td>
                        <select class="sd-input" bind:value={values[split.toward.key]}>
                          <!-- The app's own first option is blank and selected, which
                               is how it says "nothing picked yet"; drawn blank it
                               reads as a broken select, so it is named here. The
                               value stays whatever the app sent. -->
                          {#each split.toward.options || [] as option (option.value)}
                            <option value={option.value}>{option.label || 'Choose…'}</option>
                          {/each}
                        </select>
                      </td>
                      <td class="sd-cell--right">
                        <input
                          class="sd-input sd-paymoney"
                          type="text"
                          inputmode="decimal"
                          autocomplete="off"
                          bind:value={values[split.amount.key]}
                        />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>

              {#if model && model.addSplit}
                <div class="sd-payadd">
                  <button class="sd-btn" type="button" disabled={busy} on:click={addSplit}>
                    + Add another split
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <aside class="sd-payrail">
        {#if totals.length}
          <div class="sd-paycard">
            <div class="sd-payhead"><span>Current unpaid charges</span></div>
            <div class="sd-paycard--pad">
              <table class="sd-paylist sd-paytotals">
                <tbody>
                  {#each totals as total (total.label)}
                    <tr class:sd-paytotal={total.strong} class:sd-paymuted={total.muted}>
                      <th scope="row">{total.label}</th>
                      <td class="sd-cell--right">{total.value}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        {#if method}
          <div class="sd-paycard">
            <div class="sd-payhead"><span>Payment method</span></div>
            <div class="sd-paycard--pad sd-paymethod">
              <div class="sd-paycardline">
                {#if method.brand}
                  <span class="sd-paybrand">{method.brand}</span>
                {/if}
                {#if method.last4}
                  <span class="sd-paydigits">•••• {method.last4}</span>
                {:else if method.card}
                  <span class="sd-paydigits">{method.card}</span>
                {/if}
                {#if method.changeHref}
                  <a class="sd-paychange" href={method.changeHref}>Change</a>
                {/if}
              </div>

              {#if method.expires}
                <div class="sd-payexp">Expires {method.expires}</div>
              {/if}

              {#if method.plan}
                <div class="sd-payplan">
                  <span>Recurring plan</span>
                  <b>{method.plan}</b>
                  {#if method.planHref}
                    <a class="sd-paychange" href={method.planHref}>Notes</a>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </aside>
    </div>
  </div>
</div>
