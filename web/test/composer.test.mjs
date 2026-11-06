// The email composer: the frame around an editor we do not own.
//
// Two things are pinned here. The model reads the ordinary controls and the
// page's own Send / Schedule / Add Attachment, and it *does not* read the body —
// no field points at `#body`, because the body is the app's CKEditor and a copy
// of its HTML in a textarea is the defect this replaces. And the write still goes
// through the app's own controls: a changed subject is written into `#subject` and
// nothing else, before the app's own anchor is pressed.

import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readPage } from '../src/lib/page.js';
import { readComposer, runComposerInApp } from '../src/lib/composer.js';
import { diffFields } from '../src/model/diff.js';

const URL = 'https://app.thestudiodirector.com/srvda/admin.sd?page=SendEmail&totype=Student&sident=1';
const docOf = (html) => parseHTML(html).document;

function pageHtml({ send = true, schedule = true, addAttachment = true } = {}) {
  return `<!doctype html><html><head><title>Email Note</title></head><body>
  <form id="idForm" action="admin.sd?page=SendEmail&amp;meth=sendOrSched" method="post" onsubmit="return StudioDir.isOKToSubmit();">
    <div id="mainContent"><div class="contentContainer"><div class="Content">
      <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a><a href="admin.sd?page=EmailTextHome">Communications</a></div>
      <div class="formTitle">Email Note</div>
      <div class="contentInfo">
        <input type="hidden" name="sident" value="1">
        <textarea name="to" rows="2">a@example.test</textarea>
        <label for="shared@example.test"><input type="checkbox" id="shared@example.test" name="ccemail:shared@example.test"></label>
        <select id="reply-to" name="reply-to"><option>studio@example.test</option><option>front@example.test</option></select>
        <input type="text" name="from" value="Studio &lt;studio@example.test&gt;">
        <input type="text" id="subject" name="subject" value="">
        <textarea id="body" name="body" style="display:none"><p>Hello</p></textarea>
        <div id="cke_body" class="cke"><div class="cke_contents"><p>Hello</p></div></div>
        <input type="file" name="attachname" id="attach1">
        <input type="checkbox" id="schedulecheckbox" name="schedulecheckbox">
        <input type="date" id="scheduledate" name="scheduledate" value="2026-11-10">
        <select id="schedulehour" name="schedulehour"><option>8:00 AM</option><option>9:00 AM</option></select>
        <div id="sendbutton">
          ${send ? '<a class="Btn" id="sendemail" href="#" onclick="StudioDir.onSubmitThenSwitch(\'\', null)">Send Email</a>' : ''}
          ${schedule ? '<a class="Btn" id="scheduleemail" href="#" onclick="StudioDir.onSubmitThenSwitch(\'\', null)">Schedule Email</a>' : ''}
          ${addAttachment ? '<a id="addattachment" href="#" onclick="StudioDir.SendEmail.onAddAttachmentInput();return false;">Add Attachment</a>' : ''}
        </div>
      </div>
    </div></div></div>
  </form></body></html>`;
}

// ---- the model ---------------------------------------------------------------

{
  const model = readPage(docOf(pageHtml()), URL);
  assert.equal(model.view, 'composer', 'the composer is its own view');
  assert.equal(model.title, 'Email Note');
  // The form readers must not take it: it is not a task, and its body is not a
  // field of ours.
  assert.equal(model.task, null, 'the composer is not a task');

  const composer = model.composer;
  const keys = composer.fields.map((field) => field.key);
  assert.ok(keys.includes('subject'), 'the subject is a field');
  assert.ok(keys.includes('reply-to'), 'the reply-to list is a field');
  assert.ok(keys.includes('ccemail:shared@example.test'), 'the CC box is a field');
  assert.ok(keys.includes('schedulecheckbox'), 'the schedule tick is a field');
  assert.ok(keys.includes('scheduledate') && keys.includes('schedulehour'), 'the schedule is a field');

  // The body is the app's, and no field points at it.
  assert.equal(composer.editor.container, '#cke_body');
  assert.equal(composer.editor.field, '#body');
  assert.ok(!composer.fields.some((field) => field.selector === '#body'), 'the body is never a field');

  // To and From are the page's own values, shown and never written.
  assert.equal(composer.fixed.to, 'a@example.test');
  assert.equal(composer.fixed.from, 'Studio <studio@example.test>');
  assert.ok(!composer.fields.some((field) => field.selector === '[name="to"]'));
  assert.ok(!composer.fields.some((field) => field.selector === '[name="from"]'));

  const cc = composer.fields.find((field) => field.key === 'ccemail:shared@example.test');
  assert.equal(cc.type, 'checkbox');
  assert.equal(cc.value, false, 'unticked by default');
  assert.equal(cc.label, 'shared@example.test', 'the CC box reads its own label');

  assert.equal(composer.actions.send.id, 'sendemail');
  assert.equal(composer.actions.schedule.id, 'scheduleemail');
  assert.equal(composer.actions.addAttachment.id, 'addattachment');
  assert.equal(composer.attachments, 1);
}

// No Send control is not this screen: the view could not finish anything.
{
  assert.equal(readComposer(docOf(pageHtml({ send: false })), URL), null);
}

// The register and the charges table keep their own views.
{
  const charges = `<!doctype html><html><body><form id="idForm"><div id="mainContent">
    <table><tr><td><input id="_addcontrol_amount0" name="_addcontrol_amount0" value="1"></td>
    <td><input id="_addcontrol_notes0" name="_addcontrol_notes0" value="n"></td></tr></table>
    <a id="save">Save</a></div></form></body></html>`;
  assert.equal(readComposer(docOf(charges), URL), null, 'a table you type into is not a composer');
}

// ---- the write ---------------------------------------------------------------

{
  const live = docOf(pageHtml());
  const composer = readComposer(live, URL);
  const values = {};
  for (const field of composer.fields) {
    values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  values.subject = 'November update';
  values['reply-to'] = 'front@example.test';
  values['ccemail:shared@example.test'] = true;

  const changes = diffFields(composer.fields, values);
  assert.equal(changes.length, 3, 'only what changed is written');
  assert.deepEqual(changes.map((change) => change.selector).sort(),
    ['#reply-to', '#subject', '[name="ccemail:shared@example.test"]'].sort());

  // Pressing is observed, not performed: the page's own Send is replaced by a
  // stub that records the id it was asked for.
  let pressed = null;
  live.getElementById = (id) => {
    pressed = id;
    return { tagName: 'A', click() {} };
  };

  const result = runComposerInApp(live, composer, values, composer.actions.send);
  assert.equal(result.submitted, true);
  assert.equal(result.via, 'id');
  assert.equal(pressed, 'sendemail', 'the page’s own Send is what gets pressed');

  // The write landed in the app's own controls, not in a request of our own.
  assert.equal(live.querySelector('#subject').value, 'November update');
  assert.equal(live.querySelector('#reply-to option[selected]').textContent, 'front@example.test');
  assert.equal(live.querySelector('[name="ccemail:shared@example.test"]').hasAttribute('checked'), true);

  // Nothing changed still presses the page's own control: composing with the
  // defaults is the point of the screen.
  const fresh = readComposer(docOf(pageHtml()), URL);
  const same = {};
  for (const field of fresh.fields) same[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  assert.equal(diffFields(fresh.fields, same).length, 0);
}

console.log('composer: ok');
