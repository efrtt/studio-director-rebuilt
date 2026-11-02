// Communications, grouped by what a person is trying to get out the door.
//
// The app files this page under its own headings, and they are things — notes,
// letters, templates — rather than jobs: "Email Note", "Letters", "Reports".
// Cards only work when a card answers "what can I do here", so the same links
// are regrouped into the five things this page does: email a set of people,
// send a statement, send a class letter, look at what already went out, and
// shape the templates. Nothing is added and nothing is dropped: a destination
// whose code is not in the table keeps the heading the page gave it.

import { pageCode } from './charges.js';

export const COMM_GROUPS = [
  {
    name: 'Email a group',
    codes: ['EmailToGroupForm', 'EmailClasses', 'SendEmail', 'EmailTextHome']
  },
  {
    name: 'Statements & receipts',
    codes: ['SummaryInvoiceForm', 'StatementForm', 'TransactionDetailForm', 'StudentSummaryForm']
  },
  {
    name: 'Class letters & cards',
    codes: ['ClassConfirmationForm', 'EventConfirmationForm', 'BirthdayCardForm',
      'ReportCard', 'PreapprovedLetters']
  },
  {
    name: 'What went out',
    codes: ['EmailsSent', 'ViewBouncedEmails']
  },
  {
    name: 'Templates & schedules',
    codes: ['EditEmailSignature', 'ManageEmailTemplates', 'ManageDripCampaigns',
      'ManageScheduledEmails']
  }
];

// The page's groups, rearranged. Order is the table's order, then any heading
// the page printed that this table does not know about, in the order it printed
// it — which is what keeps a new destination visible instead of dropping it.
export function groupComms(groups) {
  const buckets = new Map();
  const leftovers = new Map();

  for (const group of groups) {
    for (const item of group.items) {
      const code = pageCode(item.href);
      const rule = COMM_GROUPS.find((entry) => entry.codes.includes(code));
      if (rule) {
        if (!buckets.has(rule.name)) buckets.set(rule.name, []);
        buckets.get(rule.name).push(item);
      } else {
        if (!leftovers.has(group.label)) leftovers.set(group.label, []);
        leftovers.get(group.label).push(item);
      }
    }
  }

  const out = COMM_GROUPS
    .filter((rule) => buckets.has(rule.name))
    .map((rule) => ({ label: rule.name, items: buckets.get(rule.name) }));

  for (const [label, items] of leftovers) out.push({ label, items });
  return out;
}
