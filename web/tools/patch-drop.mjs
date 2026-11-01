// One-off: keep names in an app sentence, drop only command links, recognise
// "has been dropped", and never mount a pressable page without a handler.
import { readFileSync, writeFileSync } from 'node:fs';

const edit = (path, pairs) => {
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of pairs) {
    if (!text.includes(from)) throw new Error('missing in ' + path + ': ' + from.slice(0, 70));
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
};

edit('src/lib/confirmation.js', [
  // "has been dropped" is an outcome too.
  [
    'const CONFIRMED = /\\bhas been\\s+(updated|saved|added|created|deleted|removed|changed|cloned|unenrolled|enrolled)\\b/i;',
    'const CONFIRMED = /\\bhas been\\s+(updated|saved|added|created|deleted|removed|changed|cloned|unenrolled|enrolled|dropped|withdrawn)\\b/i;'
  ],
  // The sentence keeps its names and loses its commands.
  [
    `// A paragraph can hold the sentence and the button that answers it - that is how
// \`Unenroll\` is drawn live, though the captured fixture had them apart. So take the
// node's own words and drop the controls, rather than dropping the node: otherwise
// the one sentence on the page disappears along with the button.
function textWithoutControls(node) {
  if (!node || !node.cloneNode) return textOf(node);
  const copy = node.cloneNode(true);
  if (copy.querySelectorAll) {
    copy.querySelectorAll('a[href], [onclick], .Btn').forEach((el) => el.remove());
  }
  return textOf(copy);
}`,
    `// A paragraph can hold the sentence and the button that answers it - that is how
// \`Unenroll\` is drawn live, though the captured fixture had them apart. So take the
// node's own words and drop the controls, rather than dropping the node: otherwise
// the one sentence on the page disappears along with the button.
//
// The names in the sentence are links too. "Are you sure you want to drop Lily from
// 520 Contemporary 1?" is three text nodes and two anchors, and "…has been dropped"
// ends in a link of its own ("Review the account for …"). Dropping every anchor lost
// the names ("drop from ?"); keeping every anchor kept the command. So: keep the
// words, drop the links that are commands, and put a space between them - the app's
// markup has none, which is how "1Review" happened.
const COMMAND = /^(review|open|view|print|email|edit|manage|see|show|go to|back to|return)\\b/i;

function isCommand(el) {
  const onclick = el.getAttribute && el.getAttribute('onclick');
  if (onclick) return true;
  if (el.classList && el.classList.contains('Btn')) return true;
  return COMMAND.test(String(el.textContent || '').trim());
}

function sentenceOf(node) {
  if (!node || !node.childNodes) return textOf(node);

  let out = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      out += child.textContent;
      continue;
    }
    if (child.nodeType !== 1) continue;
    if (String(child.tagName || '').toLowerCase() === 'br') {
      out += ' ';
      continue;
    }
    const text = String(child.textContent || '').trim();
    if (!text || isCommand(child)) continue;
    out += ' ' + text;
  }

  return out.replace(/\\s+/g, ' ').trim();
}`
  ],
  [
    '    .map((node) => textWithoutControls(node))',
    '    .map((node) => sentenceOf(node))'
  ],
  [
    '    .map((el) => ({ el, text: textWithoutControls(el) }))',
    '    .map((el) => ({ el, text: sentenceOf(el) }))'
  ]
]);

// Any page that renders pressable controls can press them: the handler was only
// wired for sheet/note/pending-confirm mounts, so a confirm reached another way
// said "no handler was attached".
edit('src/main.js', [
  [
    '      onPress: opts.onPress || null,',
    `      // Every screen with a control gets a way to press it. The narrower wiring
      // this replaces left a dropped student's dialog with a dead button
      // ("no handler was attached") because that page was mounted by a path that
      // never set the handler.
      onPress: opts.onPress || ((action) => clickActionInApp(document, action)),`
  ]
]);

writeFileSync('test/dropflow.test.mjs', `// Dropping a student: the question keeps its names, and the outcome is an outcome.
//
// Reported from the live app: the dialog read "Are you sure you want to drop from
// ?" (the student and class are links, and every anchor was being removed), the
// Drop button reported no handler, and the page after dropping rendered as a bare
// note - "has been dropped from" - because "dropped" was not in the list of
// outcomes the confirmation reader knows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { confirmationOf, pendingConfirmation } from '../src/lib/confirmation.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const question = doc(\`<body><div class="Content">
  <div class="formTitle">Drop Student</div>
  <div class="contentInfo">
    <p>Are you sure you want to drop <a href="admin.sd?page=EditStudent&sident=1">Lily</a> from
      <a href="admin.sd?page=EditClass&cident=520">520 Contemporary 1</a>?</p>
    <a class="Btn" id="dropstudent" onclick="StudioDir.onSubmit('drop')">Drop</a>
  </div>
</div></body>\`);

const outcome = doc(\`<body><div class="Content">
  <div class="formTitle">Drop Student</div>
  <div class="contentInfo">
    <div><a href="admin.sd?page=EditStudent&sident=1">Lily</a> has been dropped from
      <a href="admin.sd?page=EditClass&cident=520">520 Contemporary 1</a>
      <a href="admin.sd?page=EditStudent&sident=1">Review the account for Lily</a></div>
  </div>
</div></body>\`);

test('the question keeps the names it asks about', () => {
  const pending = pendingConfirmation(question);
  assert.ok(pending, 'the page is a question');
  assert.equal(pending.pending, true);
  assert.match(pending.message, /drop Lily from/);
  assert.match(pending.message, /520 Contemporary 1/);
  assert.doesNotMatch(pending.message, /drop from \\?/, 'the names are not removed');
});

test('a dropped student is an outcome, and the command link is not part of it', () => {
  // The sentence begins with a link, so it is only readable once names are kept.
  const model = confirmationOf(outcome, {});
  assert.ok(model, 'dropped is recognised as an outcome');
  assert.equal(model.pending, undefined);
  assert.equal(model.ok, true);
  assert.equal(model.message, 'Lily has been dropped from 520 Contemporary 1');
  assert.doesNotMatch(model.message, /Review the account/);
});
`);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.scripts.test.includes('dropflow')) pkg.scripts.test += ' && node test/dropflow.test.mjs';
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + String.fromCharCode(10));

console.log('drop flow patched');
