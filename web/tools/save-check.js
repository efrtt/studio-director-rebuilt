/*
 * save-check: does clicking the app's Save actually carry a value we wrote?
 *
 * The rebuilt editor never builds a POST. It writes the changed value into the
 * app's own control, fires `input` and `change`, then clicks `a#save` — see
 * src/lib/save.js. Everything after that click is the app's: its hidden ids, its
 * `#idMeth`, its serialisation. So the one question no dump or test can answer
 * is whether the app's handler reads the control we wrote to, or a copy of the
 * record it has been keeping in its own JavaScript.
 *
 * This script answers it with evidence instead of opinion: it patches XHR and
 * fetch, performs exactly the write save.js performs, clicks Save, and then
 * reports the request the app built. If our value is in that request body, the
 * app read the DOM and saving works. If the body is there without our value,
 * the app is serialising its own state and save.js needs more events. Neither
 * answer has to be guessed at, and neither can be seen from the server side.
 *
 * Paste it into the console on a *record* page (EditFamily / EditStudent /
 * EditClass), with the rebuilt overlay off — press Esc first, so the field and
 * the Save are the app's own.
 *
 *   sdSaveFields()                       list the fields that are safe to try
 *   sdSaveCheck('notes', 'sd-check-1')   write, save, and watch the request
 *   sdSaveResult()                       after the reload: what did the app send?
 *   sdSaveRevert()                       put the old value back and save again
 *
 * Read-only until you call sdSaveCheck, and it only ever writes the one value
 * you name. Use a notes/memo field: it is the least consequential thing on a
 * record, and sdSaveRevert() puts it back.
 */
(function () {
  'use strict';

  var LOG = 'sd.savecheck.log';
  var PENDING = 'sd.savecheck.pending';
  var MAX_REQUESTS = 40;

  function read(key, fallback) {
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage full or blocked: the check still runs, it just cannot be read
         back after a reload */
    }
  }

  // A request body can be a string (jQuery's serialised form), a FormData or
  // URLSearchParams. Flatten it to text so one substring test answers the
  // question for all three.
  function bodyText(body) {
    if (body == null) return '';
    if (typeof body === 'string') return body;
    try {
      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var parts = [];
        body.forEach(function (value, key) {
          parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(typeof value === 'string' ? value : '[file]'));
        });
        return parts.join('&');
      }
    } catch (e) {
      /* fall through */
    }
    try {
      return JSON.stringify(body);
    } catch (e) {
      return String(body);
    }
  }

  function capture(method, url, body) {
    var log = read(LOG, []);
    log.push({ at: Date.now(), method: method || '?', url: String(url || ''), body: bodyText(body).slice(0, 4000) });
    while (log.length > MAX_REQUESTS) log.shift();
    write(LOG, log);
  }

  // Patched before anything else so a request the app makes during the click is
  // still caught. jQuery goes through XMLHttpRequest, so the XHR hooks cover it.
  function install() {
    if (window.__sdSaveCheckHooked) return;
    window.__sdSaveCheckHooked = true;

    var open = XMLHttpRequest.prototype.open;
    var send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__sdSaveCheck = { method: String(method || '').toUpperCase(), url: String(url || '') };
      return open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      try {
        var meta = this.__sdSaveCheck || { method: '?', url: '' };
        capture(meta.method, meta.url, body);
      } catch (e) {
        /* never break the app's own request for the sake of a log line */
      }
      return send.apply(this, arguments);
    };

    if (typeof window.fetch === 'function') {
      var fetchImpl = window.fetch;
      window.fetch = function (input, init) {
        try {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          capture((init && init.method) || 'GET', url, init && init.body);
        } catch (e) {
          /* as above */
        }
        return fetchImpl.apply(this, arguments);
      };
    }

    // A save can also be a full-page POST, which never touches XHR or fetch: the
    // browser serialises the form and navigates to "… has been updated". That is
    // the strongest evidence available, because the body recorded here is the one
    // the browser built from the live DOM — so it needs its own capture.
    document.addEventListener('submit', function (event) {
      captureForm(event.target, 'POST(form, submit event)');
    }, true);

    // A scripted `form.submit()` fires no submit event, so the method is patched
    // too: the app's own Save link may well go through it.
    var nativeSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      captureForm(this, 'POST(form, scripted submit)');
      return nativeSubmit.apply(this, arguments);
    };
  }

  // What the browser would send: every live control in the form, which is the
  // thing this whole check is asking about.
  function captureForm(form, via) {
    if (!form || form.tagName !== 'FORM') return;
    try {
      var parts = [];
      if (typeof FormData !== 'undefined') {
        new FormData(form).forEach(function (value, key) {
          parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(typeof value === 'string' ? value : ''));
        });
      }
      capture(via, form.getAttribute('action') || location.href, parts.join('&'));
    } catch (e) {
      /* a form that cannot be serialised tells us nothing, but must not throw */
    }
  }

  function labelOf(el) {
    var row = el.closest && el.closest('tr');
    var first = row && row.querySelector('td');
    var text = first ? String(first.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return text.slice(0, 40);
  }

  // A field worth risking: visible free text, not one of ours, and not
  // something whose edit would have a consequence (password, email, a number
  // with a meaning, a date, a checkbox).
  var SKIP_ID = /^(filter|searchidx|idPage|idMeth|idMethArgs|ResetPwdFlag)$/;
  function isSafeText(el) {
    if (!el || !el.tagName) return false;
    if (el.closest && el.closest('#sd-root')) return false;
    if (el.closest && el.closest('#sideNavBar, .topBarContainer')) return false;
    if (SKIP_ID.test(el.getAttribute('id') || '')) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    return type === 'text';
  }

  // The same write save.js performs, so the test measures the real path and not
  // a friendlier one.
  function writeValue(el, value) {
    el.value = value;
    if (el.tagName === 'INPUT') el.setAttribute('value', value);
    var view = el.ownerDocument && el.ownerDocument.defaultView;
    var Ctor = (view && view.Event) || Event;
    ['input', 'change'].forEach(function (name) {
      el.dispatchEvent(new Ctor(name, { bubbles: true }));
    });
  }

  function sdSaveFields() {
    var form = document.querySelector('table.Form, table.FormEx') || document;
    var out = [];
    Array.prototype.forEach.call(form.querySelectorAll('input, textarea'), function (el) {
      if (!isSafeText(el)) return;
      var id = el.getAttribute('id') || '';
      out.push({
        id: id || '(no id)',
        label: labelOf(el) || '(no label)',
        value: String(el.value || '').slice(0, 40)
      });
    });
    if (!out.length) {
      console.warn('[sd] no safe text field on this page — open a record page with the overlay off (Esc)');
      return [];
    }
    console.log('[sd] ' + out.length + ' field' + (out.length === 1 ? '' : 's') + ' safe to try:');
    out.forEach(function (f) {
      console.log('   #' + f.id + '  "' + f.label + '"  now: "' + f.value + '"');
    });
    return out;
  }

  function sdSaveCheck(fieldId, value) {
    install();

    var selector = String(fieldId || '').trim();
    if (!selector) {
      console.warn('[sd] usage: sdSaveCheck("<field id>", "<test value>") — run sdSaveFields() first');
      return null;
    }
    var el = document.querySelector(selector.charAt(0) === '#' ? selector : '#' + selector);
    if (!el) {
      console.warn('[sd] no element for ' + selector);
      return null;
    }
    if (!isSafeText(el)) {
      console.warn('[sd] ' + selector + ' is not a free-text field this check will write to');
      return null;
    }
    if (document.getElementById('sd-root')) {
      console.warn('[sd] the rebuilt overlay is up — press Esc first so the field and Save are the app\u2019s own');
    }

    // The undo target is the *first* value seen for this field, not the one the
    // last run left there: running the check twice would otherwise "revert" to
    // the previous test value instead of the record's own text.
    var current = String(el.value || '');
    var prior = read(PENDING, null);
    var old = prior && prior.selector === selector ? prior.old : current;
    var next = String(value == null ? 'sd-check' : value);
    if (current === next) {
      console.warn('[sd] the field already holds that value; pick another');
      return null;
    }

    var save = document.getElementById('save');
    if (!save) {
      console.warn('[sd] this page has no #save — it is not an editor, so there is nothing to test');
      return null;
    }

    write(PENDING, { selector: selector, old: old, value: next, url: location.href, at: Date.now() });
    write(LOG, []);

    writeValue(el, next);
    console.log('[sd] wrote "' + next + '" into ' + selector + ' (field held "' + current
      + '", original was "' + old + '"), clicking Save\u2026');
    save.click();
    console.log('[sd] after the page settles, run sdSaveResult()');
    return { wrote: next, was: old };
  }

  function sdSaveResult() {
    install();
    var pending = read(PENDING, null);
    if (!pending) {
      console.warn('[sd] no pending check — run sdSaveCheck("<field id>", "<value>") first');
      return null;
    }

    var log = read(LOG, []).filter(function (entry) {
      return entry.at >= pending.at;
    });

    // jQuery encodes values, so look for both the literal and the encoded form.
    var wanted = [pending.value, encodeURIComponent(pending.value), pending.value.replace(/ /g, '+')];
    var carried = log.filter(function (entry) {
      return wanted.some(function (needle) {
        return needle && entry.body.indexOf(needle) !== -1;
      });
    });
    var current = document.querySelector(pending.selector);
    var onPage = current ? String(current.value || '') : null;

    var viaForm = carried.some(function (entry) {
      return /^POST\(form/.test(entry.method);
    });

    var verdict;
    if (carried.length) {
      verdict = 'PASS — the app read the control: ' + (viaForm
        ? 'the browser serialised the form itself, and the body it built carried '
        : 'its own request carried ') + '"' + pending.value + '". '
        + 'Saving through save.js works. Run sdSaveRevert() to put "' + pending.old + '" back.';
    } else if (!log.length) {
      verdict = 'INCONCLUSIVE — nothing was captured, so this page cannot answer it. A save that ends '
        + 'in "… has been updated" is a full-page POST; if the tool was armed before the navigation it '
        + 'would have recorded POST(form, …) here. The decisive check for that run is the field itself: '
        + 'if it now reads "' + pending.value + '", the value was saved.';
    } else {
      verdict = 'FAIL — the app posted ' + log.length + ' request' + (log.length === 1 ? '' : 's')
        + ' but none carried "' + pending.value + '", so its handler serialises its own copy of the record '
        + 'rather than the DOM. save.js needs more events (keyup, blur, jQuery .trigger) — see the press '
        + 'ladder in expand.js for the pattern.';
    }

    if (location.href !== pending.url) {
      console.log('[sd] note: taken from ' + pending.url + ', and this is a different page — that is expected after a save');
    }
    console.log('[sd] captured ' + log.length + ' request' + (log.length === 1 ? '' : 's') + ' after the click:');
    log.forEach(function (entry) {
      console.log('   ' + entry.method + ' ' + entry.url + '  (' + entry.body.length + ' bytes)');
      console.log('      ' + entry.body.slice(0, 300));
    });
    console.log('[sd] field on this page now: ' + (onPage === null ? '(not found)' : '"' + onPage + '"'));
    console.log('[sd] ' + verdict);
    return { carried: carried.length, requests: log.length, onPage: onPage, verdict: verdict };
  }

  function sdSaveRevert() {
    install();
    var pending = read(PENDING, null);
    if (!pending) {
      console.warn('[sd] nothing to revert');
      return null;
    }
    // The same normalisation sdSaveCheck applies, and its absence was a bug: a
    // bare id is stored without the '#', so `querySelector('howheard_details')`
    // was a tag selector that matched nothing and the revert could not run on
    // the page it was told to revert.
    var el = document.querySelector(pending.selector.charAt(0) === '#' ? pending.selector : '#' + pending.selector);
    var save = document.getElementById('save');
    if (!el || !save) {
      console.warn('[sd] cannot revert on this page — open ' + pending.url + ' and run sdSaveRevert() there');
      return null;
    }
    writeValue(el, pending.old);
    console.log('[sd] restored "' + pending.old + '" into ' + pending.selector + ', clicking Save\u2026');
    save.click();
    write(PENDING, null);
    return { restored: pending.old };
  }

  function sdSaveLog() {
    var log = read(LOG, []);
    console.log(JSON.stringify(log, null, 2));
    return log;
  }

  window.sdSaveFields = sdSaveFields;
  window.sdSaveCheck = sdSaveCheck;
  window.sdSaveResult = sdSaveResult;
  window.sdSaveRevert = sdSaveRevert;
  window.sdSaveLog = sdSaveLog;

  console.log('[sd] save-check ready. sdSaveFields() lists safe fields; sdSaveCheck("<id>", "value") tests a save; sdSaveResult() reads the request the app built.');
})();
