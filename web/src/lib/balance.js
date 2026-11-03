// A due balance printed beside a family's name.
//
// The panel gives one label per row and nothing else: no separate balance field,
// so a family that owes money arrives as part of its name —
//
//   "Lovelace Family $120.00"
//   "Hopper Family - $45.50"
//   "Rivera Family ($20.00)"
//   "Lovelace Family Balance: $1,204.00"
//   "Lovelace, Ada Due 60.00"
//
// A row can say the name, and the money is better off in the pill that says a
// family owes something than in the name it is filed under. This reads the
// amount off the end, but only when the end announces itself: a dollar sign, or
// the word due/balance. A bare trailing number stays part of the label, because
// "Ballet 100 12.50" is a name and a number with no promise that it is money.

// The amount, and the word that may introduce it. The separator in front (a
// dash, a bullet, a comma) is not part of either: it belongs to the label.
const TRAILING = /(?:\s*[-\u2013\u2014\u00b7|,]\s*)?(?:(due|balance|balance due|amount due)\s*:?\s*)?(\$?\s?\(?-?\$?\s?\d[\d,]*\.\d{2}\)?)\s*$/i;

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

// "$1,204.00", "($20.00)", "60.00" — shown the way a balance is read.
export function moneyText(amount) {
  const raw = clean(amount).replace(/[()]/g, '').replace(/\s+/g, '');
  if (!raw) return '';
  if (/\$/.test(raw)) return raw.replace(/^-\$/, '-$');
  return raw.charAt(0) === '-' ? '-$' + raw.slice(1) : '$' + raw;
}

// { name, due } — due is '' when the label states no balance.
export function splitBalance(label) {
  const raw = clean(label);
  const unchanged = { name: raw, due: '' };
  if (!raw) return unchanged;

  const match = raw.match(TRAILING);
  if (!match) return unchanged;

  const amount = match[2] || '';
  // A bare number is not a balance unless the label called it one.
  if (!/\$/.test(amount) && !match[1]) return unchanged;

  const name = raw.slice(0, match.index).replace(/[\s\-\u2013\u2014\u00b7|,]+$/, '').trim();
  // "($20.00)" alone is not a family; leave the label as it came.
  if (!name) return unchanged;

  return { name, due: moneyText(amount) };
}
