// The email composer: the one page whose body is a live third-party editor.
//
// `SendEmail` posts `form#idForm` to `meth=sendOrSched`. Its body is a textarea
// CKEditor has taken over (`#body`, rendered as `#cke_body`) with the app's own
// plugins on top: templates from `csv.sd?page=LoadTemplates`, an image browser,
// preview, and a test-send that goes out through DWR. The editor is the email:
// what it produces is what a family receives.
//
// So this reader claims the *frame* and nothing else. The ordinary controls are
// read as fields — the CC box, the reply-to list, the subject, the schedule —
// while To and From are read as fixed text, because the page fixes them and a
// copy of them would only be a second thing to keep in step. The body is never
// read: `editor` names the app's own container, and the view moves that element
// into its slot and puts it back when it is done. Send, Schedule and Add
// Attachment stay the app's own anchors, so the app still builds the request.
//
// The defect this replaces: the `task` reader took this page and drew the body as
// a four-row textarea holding raw template HTML (2,047 characters on a live
// page), while the editor's data was neither in it nor written back from it.

import { qs, qsa, textOf, titleOf, breadcrumbOf } from './shell.js';
import { contentRoot } from '../model/root.js';
import { diffFields, applyFields } from '../model/diff.js';
import { clickActionInApp } from './actions.js';

// The page's own frame, and the one control that makes it this screen.
const FORM = '#idForm';
const BODY = '#body';
const SEND = '#sendemail';
// The editor container CKEditor inserts beside the textarea it hides.
const EDITOR = '#cke_body';

// Selectors are the app's own addresses: an id where it is a plain word, else
// the element's name, quoted so `ccemail:info@…` still resolves.
function selectorOf(el) {
  const id = el.getAttribute('id') || '';
  if (id && /^[A-Za-z][\w-]*$/.test(id)) return '#' + id;
  const name = el.getAttribute('name') || '';
  if (name) return `[name="${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  return '';
}

function optionOf(option) {
  const value = option.getAttribute('value');
  return {
    value: value != null ? value : textOf(option),
    label: textOf(option)
  };
}

function valueOf(el) {
  if (!el) return '';
  if (el.tagName === 'SELECT') {
    const options = qsa(el, 'option');
    const chosen = options.find((option) => option.hasAttribute('selected')) || options[0];
    const live = typeof el.value === 'string' && el.value !== '' ? el.value : null;
    return String(live != null ? live : chosen ? optionOf(chosen).value : '');
  }
  if (typeof el.value === 'string' && el.value !== '') return el.value;
  const attr = el.getAttribute('value');
  return attr != null ? String(attr) : '';
}

function isChecked(el) {
  return el.hasAttribute('checked') || !!el.checked;
}

// One ordinary control, as a field the view renders and the save can write.
function fieldOf(el, fallbackLabel) {
  if (!el) return null;
  const selector = selectorOf(el);
  if (!selector) return null;

  if (el.getAttribute('type') === 'checkbox') {
    return {
      key: el.getAttribute('name') || el.getAttribute('id') || selector,
      selector,
      type: 'checkbox',
      label: fallbackLabel,
      value: isChecked(el),
      checked: isChecked(el)
    };
  }

  if (el.tagName === 'SELECT') {
    return {
      key: el.getAttribute('name') || el.getAttribute('id') || selector,
      selector,
      type: 'select',
      label: fallbackLabel,
      value: valueOf(el),
      options: qsa(el, 'option').map(optionOf)
    };
  }

  return {
    key: el.getAttribute('name') || el.getAttribute('id') || selector,
    selector,
    type: 'text',
    label: fallbackLabel,
    value: valueOf(el)
  };
}

// The CC box's own words: a `<label for>` where the page prints one, else the
// text beside the box.
function labelFor(el) {
  const id = el.getAttribute('id') || '';
  if (id) {
    const label = qsa(el.ownerDocument || (el.getRootNode && el.getRootNode()), 'label')
      .find((candidate) => candidate.getAttribute('for') === id);
    // The app's own CC label is often the address, rewritten by its mail
    // obfuscator into "[email protected]"; the name still holds the real one.
    if (label && textOf(label) && !/\[email\s*protected\]/i.test(textOf(label))) return textOf(label);
  }
  // A label that wraps the box and holds no text of its own names nothing, so
  // the address the app put in the name is the fallback: `ccemail:info@…`.
  const fromName = String(el.getAttribute('name') || '').replace(/^ccemail:/i, '');
  if (fromName && fromName.includes('@')) return fromName;
  const parent = el.parentElement;
  return (parent ? textOf(parent).slice(0, 80) : '') || 'CC the studio';
}

function actionOf(el, fallback) {
  if (!el) return null;
  return {
    id: el.getAttribute('id') || '',
    label: textOf(el) || fallback,
    href: el.getAttribute('href') || '',
    // The app's own script does the work: `href="#"` with an `onclick`.
    js: true,
    onclick: el.getAttribute('onclick') || ''
  };
}

export function readComposer(doc) {
  const root = contentRoot(doc) || (doc && doc.body) || doc;
  if (!root || typeof root.querySelector !== 'function') return null;

  const form = qs(root, FORM) || qs(doc, FORM);
  if (!form) return null;

  // The body textarea is the form's field; the editor is its renderer. Both must
  // be here, and so must the page's own Send: a composer without one is not a
  // screen this view could finish.
  const body = qs(form, BODY) || qs(doc, BODY);
  if (!body) return null;
  const send = qs(form, SEND) || qs(doc, SEND);
  if (!send) return null;

  const schedule = qs(form, '#scheduleemail') || qs(doc, '#scheduleemail');
  const addAttachment = qs(form, '#addattachment') || qs(doc, '#addattachment');

  const fields = [];
  const push = (field) => { if (field) fields.push(field); };

  for (const box of qsa(form, 'input[name^="ccemail"]')) {
    push(fieldOf(box, labelFor(box)));
  }
  push(fieldOf(qs(form, '#reply-to'), 'Reply to'));
  push(fieldOf(qs(form, '#subject'), 'Subject'));
  push(fieldOf(qs(form, '#schedulecheckbox'), 'Send later'));
  push(fieldOf(qs(form, '#scheduledate'), 'Date'));
  push(fieldOf(qs(form, '#schedulehour'), 'Time'));

  // Fixed by the page: shown as text, never written.
  const fixed = {
    to: valueOf(qs(form, '[name="to"]')).split(/[\s,;]+/).filter(Boolean).length
      ? valueOf(qs(form, '[name="to"]'))
      : '',
    from: valueOf(qs(form, '[name="from"]'))
  };

  return {
    kind: 'composer',
    title: titleOf(doc) || 'Email',
    breadcrumb: breadcrumbOf(doc),
    fields,
    fixed,
    editor: {
      // The app's own element, moved into the view's slot and put back again.
      container: EDITOR,
      field: BODY
    },
    actions: {
      send: actionOf(send, 'Send Email'),
      schedule: actionOf(schedule, 'Schedule Email'),
      addAttachment: actionOf(addAttachment, 'Add Attachment')
    },
    attachments: qsa(form, 'input[type="file"]').length
  };
}

// Press one of the page's own controls, after writing what changed into its own
// fields. Nothing is built here: the app serialises the form and its editor.
export function runComposerInApp(doc, composer, values, action) {
  if (!composer) return { applied: [], submitted: false, reason: 'no-fields' };

  const changes = diffFields(composer.fields || [], values);
  const { applied, missing } = applyFields(doc, changes);
  // A value this screen shows but cannot write refuses the press: the app would
  // send something other than what the person is looking at.
  if (missing.length) return { applied, missing, submitted: false, reason: 'missing' };

  const target = action || (composer.actions && composer.actions.send);
  if (!target) return { applied, submitted: false, reason: 'no-action' };

  const pressed = clickActionInApp(doc, target);
  if (!pressed.submitted) return { applied, ...pressed, label: target.label };
  return { applied, submitted: true, reason: 'ok', via: pressed.via, label: target.label };
}
