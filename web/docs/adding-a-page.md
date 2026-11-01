# Adding a page the rebuild does not style

You are on a screen in the app, the addon has mounted, and it says **"No view for
this page yet"** (`State.svelte`, `kind: 'none'`). This is the route from there to a
styled page, in the order that keeps the goldens honest.

Nothing here is per-URL. A page is claimed because of what its markup contains, so
"adding a page" almost always means one of:

- the page has a shape a reader already handles, and a gate is slightly too strict;
- the page has a shape no reader handles, so one reader gains a narrow rule;
- the page genuinely cannot be read safely, and it stays with the app (a real
  answer — see *When to stop*).

---

## 1. Confirm it is a miss, not a failure

"No view for this page yet" means the readers ran and none claimed it. A different
card means something else: **Session expired** and **Could not load that page** are
not styling problems, and opening the original page and reloading usually clears
them.

## 2. Measure the page before reading it

Arm the probe once for the session by adding `?sdprobe=1` to the URL. Then, in the
browser console:

```js
sdProbe.log()          // every screen measured this session, by shape
```

Find your shape (`EmailClass(cident)`, `SendEmail(iident,totype)` — page name plus
its non-navigation parameters) and read:

- `view: null`, `source: "app"` — the rebuild declined the page;
- `controls`, `buttons`, `rows`, `links`, `text` — the counts the readers gate on.

Those five numbers are usually enough to name the reader in step 5.

For structure — tables, cell tags, form field names, the page's own buttons — paste
all of `web/tools/diagnose-page.js` into the console on that page. It prints tags,
ids, classes and column headings **only**: no names, balances, notes or emails. Call
`sdDumpSave()` to download the dump.

## 3. Capture the page as a fixture

The fixture is what the tests read, so it has to come from the live DOM, not from a
reconstruction of what you think the page looks like. Run this on the page:

**Fastest path:** paste `web/tools/capture-page.js` into the console and run
`sdCaptureDownload()`. It applies the trimming and scrubbing below, names the file
`live-<page>.html`, and `npm run demo` then turns it into `demo/<page>.html` with no
edit to any list. The snippet below is the same thing by hand, if you want to change
what is kept.

```js
(() => {
  const root = document.querySelector('.contentContainer') || document.querySelector('#mainContent');
  if (!root) return 'no content root on this page';
  const clone = root.cloneNode(true);
  // Keep <th>: those are the app's own column labels and the readers map them.
  // Everything else becomes same-length filler, so no record text leaves the page.
  clone.querySelectorAll('*').forEach((el) => {
    if (el.tagName === 'TH') return;
    [...el.childNodes].forEach((n) => {
      if (n.nodeType === 3 && n.textContent.trim()) n.textContent = 'x'.repeat(n.textContent.trim().length);
    });
  });
  const page = (new URLSearchParams(location.search).get('page') || 'page');
  const html = [
    '<!doctype html>',
    '<!-- captured from the live content root; text is same-length filler -->',
    '<html lang="en"><body>',
    '<form id="idForm">',
    '  <div id="sideNavBar">',
    '    <a class="sideNavLink" href="admin.sd?page=HomePage">Home</a>',
    '  </div>',
    '  <div class="topBarContainer"><div class="topBar"></div></div>',
    '  <div id="mainContent">' + clone.outerHTML + '</div>',
    '</form>',
    '</body></html>'
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = 'fetched-' + page.toLowerCase().replace(/[^A-Za-z0-9]/g, '-') + '.html';
  document.body.appendChild(a); a.click(); a.remove();
  return a.download;
})();
```

Move the downloaded file to `web/test/fixtures/`. Two things to know:

- **Filler can hide a label the reader needs.** If the reader you pick keys on a
  heading or a link's text, restore that one line by hand and say so in the
  fixture's comment.
- **Record ids may stay.** They are the app's own opaque identifiers and the
  existing fixtures keep them; replace them only if a capture came from real
  student or family data.

Write a comment at the top of the fixture saying where it came from and what was
changed. `web/test/fixtures/fetched-emailclass.html` is the shape to copy.

## 4. Freeze the decision

```bash
cd web
npm run golden:write     # records test/golden/<fixture>.json
npm run golden           # must print: golden: N models match
git diff test/golden     # this diff is the whole change, in model form
```

If the fixture needs a real URL (a record id in a breadcrumb, a parameter the model
keeps), add it to the `URLS` map in `web/tools/golden.mjs`; otherwise the golden
labels it `?page=<fixture name>`.

**Never edit a golden to make code pass.** The golden is the behaviour; a changed
model is a behaviour change, and the commit message has to say so.

## 5. Decide which reader owns it

Try them in this order — it is the order in `web/src/readers/index.js`, first claim
wins:

| The page has | Reader | Gate |
|---|---|---|
| a sentence and the app's own save/continue | `note` | no form controls, < 2 rows, < 6 links |
| two or more tables with data rows | `sheet` | `TABLE_ROWS` rows outside a form |
| a filter form and a Run control | `report` | `readReport` |
| a form with a control and no save | `task` | `readTask` |
| a control and a save | `settings` | `MAX_FIELDS = 30` |
| six or more links, nothing to fill in | `index` | `MENU_LINKS` |
| a scripted Continue/Confirm | `confirm` | `confirmationOf` |

`TABLE_ROWS` and `MENU_LINKS` live in `web/src/lib/thresholds.js` because more than
one reader shares them. Change a number there only if it is wrong for *every* page
that uses it — otherwise add a narrow condition in the one reader.

## 6. Change the code, in the smallest place that explains the page

- **The reader is right and too strict:** add the narrow allowance next to the gate
  that refused it, with a comment naming your page. `note.js` shows the pattern
  (`onlyHiddenInputs` + `hasScriptedAction`: `EmailClass` offers one link and one
  `StudioDir` action, and both had to survive the refusal).
- **The reader is right but the shape is new:** extend that reader, not a new one.
  `sheet.js` and `report.js` both carry several shapes already.
- **No reader fits:** add `web/src/lib/<name>.js` returning a model, register it in
  `web/src/readers/index.js` with its `after` gates, add the component to
  `web/src/views/registry.js`, and add the test suite to the explicit list in
  `web/package.json` — the test script names every suite, so a new file that is not
  listed never runs.

Add a test in `web/test/<reader>.test.mjs` that reads the fixture and asserts the
view and the one thing that made the page special. `menu.test.mjs` has the pattern
for the two directions: a page that must be claimed, and a page that must not.

## 7. Ship it

```bash
cd web
npm test                 # every suite
npm run golden           # goldens still match
npm run map              # regenerates docs/crawl-map.md from the crawl
npm run userscript       # rebuilds the artifact — commit it with the source
```

Bump `version` in `web/package.json` (patch for a claim fix, minor for a new
reader). CI runs the suites, the goldens, the build and a `git diff --exit-code` on
the artifact, so source and artifact go in the same commit.

---

## When to stop

Some pages should stay with the app, and that is a decision worth recording:

- a **picker of navigation** and nothing else (`SendEmail`: four links to itself,
  no action) — a card would be a menu pretending to be a screen;
- a control with **nothing that saves it** (`GetOnlineRegUrl`, `ManageFamilyNotes`)
  — writing it would mean inventing a save;
- a form whose controls the app draws **after** load in a way the live read cannot
  reach.

Capture the page, let it fall to no view, and say why in the commit. A refusal that
is pinned by a golden is a decision; one that is merely untested is a bug waiting.

## Reference

- `web/src/readers/index.js` — the ladder and its gates.
- `web/src/lib/thresholds.js` — counts more than one reader shares.
- `web/test/fixtures/` and `web/test/golden/` — captures and their models.
- `web/tools/golden.mjs` — `write` / `check`, and the fixture-to-URL map.
- `web/tools/diagnose-page.js` — text-free structure dump for any admin page.
- `web/tools/capture-page.js` — console snippet that captures a page as a fixture;
  `live-*.html` fixtures become demo pages automatically on `npm run demo`.
- `web/docs/contract.md` — the invariants a change must not break.
