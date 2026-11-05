// The New Payment screen: the shape the live page has, and what the reader does
// with it. The fixture is the app's structure with invented filler — the amount,
// the card and the family are placeholders, not a record.

import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const { readPayment, runPayment, addSplitInApp } = await import('../src/lib/payment.js');
const { readPage } = await import('../src/readers/index.js');

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
}

function splitBlock(n, optional) {
  return `
    <div class="formTitle WithinSectionSpace">Payment Split #${n}${optional ? ' (Optional)' : ''}</div>
    <table class="FlexForm">
      <tr><td>Paid Toward</td><td>
        <select name="paid_toward${n}">
          <option value="">Adjustment</option>
          <option value="1">Tuition</option>
          <option value="2">Costume</option>
        </select>
      </td></tr>
      <tr><td>Amount</td><td><input name="split_amt${n}" value="0.00"></td></tr>
    </table>`;
}

function page({ method = true, splits = 3, charges = true, amount = true } = {}) {
  return new DOMParser().parseFromString(`
    <html><body>
      <div class="contentContainer">
        <div class="Breadcrumb"><a href="?page=Home">Home</a></div>
        <div class="formTitle">New Payment</div>
        <table class="Layout"><tr>
          <td class="Top">
            <table class="FlexForm">
              <tr><td>Family</td><td>Example Family</td></tr>
              ${amount ? '<tr><td>Amount</td><td><input name="amount" value="0.00"></td></tr>' : ''}
              <tr><td>Payment Date</td><td><input name="due_date" value="2026-11-05"></td></tr>
              <tr><td>Deposit Date</td><td><input name="deposit_date" value="2026-11-05"></td></tr>
              <tr><td>Notes</td><td><input name="notes" value=""></td></tr>
              ${method ? `
              <tr><td>Payment Method</td><td>
                VISA:XXXXXXXXXXXX9002 Expires: Nov 29
                <a href="?page=ManagePaymentMethods">Click here to change</a>
              </td></tr>
              <tr><td>Recurring Payment Plan</td><td>
                Yes Notes:
                <a href="?page=ManagePaymentPlan">Click here to change</a>
              </td></tr>` : ''}
            </table>
            ${Array.from({ length: splits }, (_, i) => splitBlock(i + 1, i > 0)).join('')}
            <div class="WithinSectionSpace">
              <a class="Btn" href="#">Add Another Split</a>
              <a class="Btn" href="#">Process Payment</a>
            </div>
          </td>
          <td class="Top">
            ${charges ? `
            <div class="MultiTable">
              <table class="ReportTable">
                <tr><td>Total unpaid charges</td><td>$1.00</td></tr>
                <tr><td>Current payments not applied to a charge</td><td>-$0.00</td></tr>
                <tr><td>Current Balance Due</td><td>$1.00</td></tr>
              </table>
            </div>` : ''}
          </td>
        </tr></table>
        <div class="ButtonArea"><a class="Btn" href="#">Process Payment</a></div>
      </div>
    </body></html>
  `, 'text/html');
}

// ---- what the page is ----
const model = readPayment(page());
check('claims the payment screen', !!model);
check('names itself', model && model.title === 'New Payment', model && model.title);
check('family is read as the subject', model && model.family === 'Example Family', model && model.family);

// Four fields, not ten: the three splits are a list, and the view hides them.
check('four base fields', model && model.base.length === 4, model && model.base.map((f) => f.name).join(','));
check('base order', model && model.base.map((f) => f.name).join(',') === 'amount,due_date,deposit_date,notes');
check('labels come from the page', model && model.base[1].label === 'Payment Date', model && model.base[1].label);

check('three splits read', model && model.splits.length === 3, model && String(model.splits.length));
check('split pairs its controls', model && model.splits[0].toward.name === 'paid_toward1' && model.splits[0].amount.name === 'split_amt1');
check('select options carry through', model && model.splits[0].toward.options.length === 3);
check('a plain payment is not filled', model && model.filled === false);

check('three totals', model && model.totals.length === 3, model && String(model.totals.length));
check('balance due is the strong row', model && model.totals[2].strong === true && model.totals[2].label === 'Current Balance Due');
check('unapplied payments are muted', model && model.totals[1].muted === true);
check('a total keeps the app figure', model && model.totals[0].value === '$1.00', model && model.totals[0].value);

const method = model && model.method;
check('method is read', !!method);
check('card brand', method && method.brand === 'VISA', method && method.brand);
check('card last four', method && method.last4 === '9002', method && method.last4);
check('expiry is its own string', method && method.expires === 'Nov 29', method && method.expires);
check('change link', method && method.changeHref === '?page=ManagePaymentMethods', method && method.changeHref);
check('plan answer', method && method.plan === 'Yes', method && method.plan);
check('plan notes link', method && method.planHref === '?page=ManagePaymentPlan', method && method.planHref);

check('primary is the app anchor', model && model.primary && model.primary.label === 'Process Payment');
check('add split is its own action', model && model.addSplit && model.addSplit.label === 'Add Another Split');

// The registry takes the page, and the view it lands on is this one.
const routed = readPage(page(), 'https://example.test/admin.sd?page=NewPayment');
check('routed as payment', routed.view === 'payment', routed.view);
check('routed model carried', !!routed.payment);

// ---- what it refuses ----
check('no amount means not this screen', readPayment(page({ amount: false })) === null);

// A quarter of splits and no charges table is still the screen (the app's own
// right column is not what makes it a payment).
check('one split, no charges still reads', !!readPayment(page({ splits: 1, charges: false })));

// ---- what it writes ----
{
  const doc = page();
  const found = readPayment(doc);
  const values = {};
  for (const field of found.fields) values[field.key] = field.value;
  values['name:amount'] = '12.34';
  values['name:notes'] = 'paid in full';

  let pressed = 0;
  const anchor = Array.from(doc.querySelectorAll('a'))
    .find((a) => (a.textContent || '').trim() === 'Process Payment');
  anchor.addEventListener('click', () => { pressed += 1; });

  const result = runPayment(doc, found, values);
  check('payment writes only the changes', result.ok && result.applied.length === 2, JSON.stringify(result));
  check('amount landed in the app control', doc.querySelector('[name="amount"]').value === '12.34', doc.querySelector('[name="amount"]').value);
  check('notes landed', doc.querySelector('[name="notes"]').value === 'paid in full');
  check('the app anchor was pressed once', pressed === 1, String(pressed));

  // Nothing changed means nothing written, and the app's own control is what
  // carries the request: the button is still pressed.
  const same = {};
  for (const field of found.fields) same[field.key] = field.value;
  const noop = runPayment(doc, found, same);
  check('no edits, no writes', noop.ok && noop.applied.length === 0, JSON.stringify(noop));
}

// ---- adding a split is the app's gesture ----
{
  const doc = page({ splits: 1 });
  const found = readPayment(doc);
  check('starts with one split', found.splits.length === 1);

  let pressed = 0;
  const add = Array.from(doc.querySelectorAll('a'))
    .find((a) => (a.textContent || '').trim() === 'Add Another Split');
  add.addEventListener('click', () => {
    pressed += 1;
    // The app clones its split template and bumps the index.
    const tbody = doc.querySelector('.contentContainer');
    const extra = doc.createElement('table');
    extra.setAttribute('class', 'FlexForm');
    extra.innerHTML = '<tr><td>Paid Toward</td><td><select name="paid_toward2"><option value="1">Tuition</option></select></td></tr>'
      + '<tr><td>Amount</td><td><input name="split_amt2" value="0.00"></td></tr>';
    tbody.appendChild(extra);
  });

  const result = addSplitInApp(doc, found);
  check('the app control was pressed', result.ok && pressed === 1, JSON.stringify({ ok: result.ok, reason: result.reason }));
  check('the page is read again', result.ok && result.payment.splits.length === 2, result.ok ? String(result.payment.splits.length) : '');
}

// ---- the same view, on the screen the app calls Edit Payment ----
// Analysed on the live page (`?page=EditPayment&xident=…`) on 2026-11-05. The form
// and the totals are the same shape as a new payment's, but: the dates are printed
// text beside hidden inputs, the split row is there from the start and already
// carries the payment's amount, the totals table has a header row, the control at
// the end says Save, and the page carries the receipt it already has and the
// applied details. Nothing on it says "Process Payment" or "Split Payment".
function editPage() {
  return new DOMParser().parseFromString(`
    <html><body>
      <div class="contentContainer">
        <div class="Breadcrumb"><a href="?page=Home">Home</a></div>
        <div class="formTitle">Edit Payment</div>
        <table class="Layout"><tr>
          <td class="Top">
            <table class="FlexForm">
              <tr><td>Family</td><td>Example Family</td></tr>
              <tr><td>Amount</td><td><input name="amount" value="40.00"></td></tr>
              <tr><td>Payment Date</td><td>Sep 01, 2026</td><td><input type="hidden" name="due_date" value="2026-09-01"></td></tr>
              <tr><td>Deposit Date</td><td>Sep 01, 2026</td><td><input type="hidden" name="deposit_date" value="2026-09-01"></td></tr>
              <tr><td>Notes</td><td><input name="notes" value=""></td></tr>
              <tr><td>Payment Method</td><td>VISA</td></tr>
            </table>
            <table class="FlexForm">
              <tr><td>Paid Toward</td><td>
                <select name="paid_toward1">
                  <option value="">Adjustment</option>
                  <option value="1">Tuition</option>
                </select>
              </td></tr>
              <tr><td>Amount</td><td><input name="split_amt1" value="40.00"></td></tr>
            </table>
            <div class="WithinSectionSpace">
              <a class="Btn" href="#" id="addanothersplit">Add Another Split</a>
              <a class="Btn" href="#" onclick="StudioDir.onCallMethodSubmit('EditPayment','onSave')">Save</a>
            </div>
          </td>
          <td class="Top">
            <table class="ReportTable">
              <tr><th>Category</th><th>Amount Unpaid</th></tr>
              <tr><td>Total unpaid charges</td><td>$0.00</td></tr>
              <tr><td>Current payments not applied to a charge</td><td>-$0.00</td></tr>
              <tr><td>Current Balance Due</td><td>$0.00</td></tr>
            </table>
            <a href="?page=EditPayment&amp;meth=onAppliedDetails">see details</a>
            <a href="?page=LedgerPaymentReceiptPage&amp;xident=1">Print Receipt</a>
            <a href="?page=LedgerPaymentReceiptPage&amp;meth=sendEmail">Email Receipt</a>
          </td>
        </tr></table>
      </div>
    </body></html>
  `, 'text/html');
}

{
  const edit = readPayment(editPage());
  check('an edit is claimed', !!edit);
  check('an edit names itself', edit && edit.title === 'Edit Payment', edit && edit.title);
  check('the mode is read', edit && edit.mode === 'edit', edit && edit.mode);
  check('an edit ends with the app Save', edit && edit.primary && edit.primary.label === 'Save', edit && edit.primary && edit.primary.label);
  check('an edit has no split anchor', edit && edit.splitPayment === null);
  check('the allocation row is read', edit && edit.splits.length === 1, edit && String(edit.splits.length));
  check('its amount opens the splits', edit && edit.filled === true);
  check('a printed date still reads as a date field',
    edit && edit.base.map((f) => f.name).join(',') === 'amount,due_date,deposit_date,notes',
    edit && edit.base.map((f) => f.name).join(','));
  check('the totals header is not a total', edit && edit.totals.length === 3, edit && edit.totals.map((t) => t.label).join('|'));
  check('the receipt links are read',
    edit && edit.extras.map((x) => x.label).join(',') === 'see details,Print Receipt,Email Receipt',
    edit && edit.extras.map((x) => x.label).join(','));
  check('the routed title is the edit screen',
    readPage(editPage(), 'https://example.test/admin.sd?page=EditPayment').payment.title === 'Edit Payment');

  const doc = editPage();
  const found = readPayment(doc);
  let pressed = 0;
  const save = Array.from(doc.querySelectorAll('a'))
    .find((a) => (a.textContent || '').trim() === 'Save');
  save.addEventListener('click', () => { pressed += 1; });
  const values = {};
  for (const field of found.fields) values[field.key] = field.value;
  values['name:amount'] = '41.00';
  const result = runPayment(doc, found, values);
  check('an edit saves through the app control',
    result.ok && pressed === 1 && doc.querySelector('[name="amount"]').value === '41.00',
    JSON.stringify({ ok: result.ok, pressed }));
}

{
  const fresh = readPayment(page());
  check('a new payment is not an edit', fresh.mode === 'new' && fresh.extras.length === 0,
    JSON.stringify({ mode: fresh.mode, extras: fresh.extras.length }));
}

// ---- a page that is not there ----
check('an empty document is refused', readPayment(new DOMParser().parseFromString('<html><body></body></html>', 'text/html')) === null);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
