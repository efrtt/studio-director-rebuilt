// Charges & Payments, grouped by the job rather than by the app's headings.
//
// The app splits this page into three piles — "Charges", "Payments", "Settings" —
// which is a filing cabinet, not a menu: ten destinations in three boxes, and
// one of them is a leftover. Cards only work when a card answers "what can I do
// here", so this groups the same links into the six jobs the page actually does.
//
// Nothing is invented and nothing is dropped: a destination whose code is not in
// the table below keeps the heading the page gave it, and a group with no links
// never appears. That is also what keeps this honest across a re-crawl — a new
// page lands in its old heading instead of vanishing.

export const CHARGE_GROUPS = [
  {
    name: 'Enter a charge',
    codes: ['NewFamilyCharge', 'NewClassCharge', 'NewClassTypeCharge',
      'NewFamilySessionCharge', 'AddChargeByTag', 'AddMultipleCharges']
  },
  {
    name: 'Take a payment',
    codes: ['AddMultiplePayments', 'AddMultiplePaymentsForFamily', 'DepositListForm']
  },
  {
    name: 'Payments due & plans',
    codes: ['ListPaymentsDue', 'ChargesDetail', 'AddPayPlanDiscounts']
  },
  {
    name: 'Costumes & events',
    codes: ['PerformanceCharge', 'EventCharge', 'CostumeDepositCharge', 'CostumeBalanceCharge']
  },
  {
    name: 'Fix or remove a charge',
    codes: ['DeleteMultipleCharges']
  },
  {
    name: 'Charge settings',
    codes: ['NewEditDel', 'SetOnlineRegOK']
  }
];

// The app's own page name for a destination (`admin.sd?page=NewEditDel&content=…`
// is `NewEditDel`). Casing is not normalised: the table above is written the way
// the app writes it.
export function pageCode(href) {
  const match = /[?&]page=([^&]+)/.exec(String(href || ''));
  if (!match) return '';
  const code = decodeURIComponent(match[1]).replace(/\(.*$/, '');
  return code;
}

// The page's groups, rearranged. Order is the table's order, then any heading the
// page printed that this table does not know about, in the order it printed it.
export function groupCharges(groups) {
  const buckets = new Map();
  const leftovers = new Map();

  for (const group of groups) {
    for (const item of group.items) {
      const code = pageCode(item.href);
      const rule = CHARGE_GROUPS.find((entry) => entry.codes.includes(code));
      if (rule) {
        if (!buckets.has(rule.name)) buckets.set(rule.name, []);
        buckets.get(rule.name).push(item);
      } else {
        if (!leftovers.has(group.label)) leftovers.set(group.label, []);
        leftovers.get(group.label).push(item);
      }
    }
  }

  const out = CHARGE_GROUPS
    .filter((rule) => buckets.has(rule.name))
    .map((rule) => ({ label: rule.name, items: buckets.get(rule.name) }));

  for (const [label, items] of leftovers) out.push({ label, items });
  return out;
}
