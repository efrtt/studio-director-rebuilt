# Rebuild specification

The plan for reimplementing the rebuilt UI. `docs/contract.md` describes what exists today and why;
this file says what the replacement must keep, what it must design out, and how it will be judged.

Nothing here is a wish list. Every requirement is either a behaviour a live page proved, a bug this
build has today, or a duplication that has already caused a divergence.

## 1. Invariants — not open for redesign

These are the reasons the project is safe to run against a paid product, and the reasons it can be
tested at all. A rewrite that trades any of them for convenience is not a better version.

1. **The app builds every request.** No `POST`, no form submission, no `#idPage`/`#idMeth` body, no
   token handling. Saves, report runs, task buttons, settings and bar actions are all "write the
   changed value into the app's live control, fire `input`/`change`, press the app's own element".
2. **Readers are pure.** A reader takes a `Document` plus context and returns a model. No network,
   no globals, no storage, no timers.
3. **One same-origin `GET` per page view at most**, `credentials: 'same-origin'`. No cookie or
   credential is read, stored, logged or sent anywhere else.
4. **The sign-in page is never replaced.**
5. **Esc / Original / `#original` restores the app's own page**, form intact.
6. **Unknown means the app.** When no reader claims a page, nothing is mounted and nothing is
   styled. Covering a working form with "no view for this page" is the worst available answer.
7. **Reference behaviour is data, not prose.** `test/golden/*.json` (20 models) is authoritative.

## 2. Reader contract

The chain stays **ordered, most specific first, notice last**. The order is the contract; the
thresholds are the contract.

| # | Reader | Claims when | Refuses when |
|---|---|---|---|
| 1 | `confirmationOf` | content holds a sentence ≤240 chars matching *has been updated / saved / added / deleted / enrolled …* | no such sentence; refusal sentences only on the bare `admin.sd` URL (`allowRefused`) |
| 2 | `readWeek` | `table.TimeBlock` present and **not inside `.tabContent`** | no blocks |
| 3 | `readList` | `#idSearchSpan .searchResultList` exists | no panel (empty panel allowed only with `allowEmpty`) |
| 4 | `readReport` | a filter form **and** a run control (`#runreport`, or a label matching `run/generate/create/show/view/update/apply (the) report`) | no run control |
| 5 | `readTask` | `readForm` yields fields **and** the content has pressable actions | no form, or no actions |
| 6 | `readSheet` | data tables with ≥2 rows, excluding `WeekdayCheckboxes`, `Layout`, `TimeBlock`, `Form`, `FormEx`; heading-less tables of ≤2 columns skipped (those are label/control forms) | fewer than two rows anywhere |
| 7 | `readIndex` | ≥6 content links and <2 table rows; draws at most 300 tiles | fewer than six links, or a table of rows |
| 8 | `readSettings` | a control plus `#save` or the page's own control; ≤30 fields | nothing to press; a **headed** table with ≥2 rows (that is a sheet) |
| 9 | `readNote` | no controls, <2 data rows, <6 links, ≥1 action, ≥1 line, ≤8 lines | any of those thresholds crossed |

`contradictsNote(doc)` — the three refusals of reader 9 — stays exported, because the mount path
asks the same question of the live page.

**Requirement.** Replace the `confirm || week || list || …` expression ladder with an explicit
registry:

```js
// readers/index.js
export const READERS = [confirmation, week, list, report, task, sheet, index, settings, note];

export function readPage(doc, ctx) {
  for (const reader of READERS) {
    if (!reader.claims(doc, ctx)) continue;
    const model = reader.read(doc, ctx);
    if (model) return { ...model, kind: reader.id };
  }
  return null;
}
```

Each reader exports `{ id, claims(doc, ctx), read(doc, ctx) }`. `claims` is the threshold check and
is testable on its own; `read` may assume `claims` passed. This removes the "did I add a new reader
to every `||` term?" failure mode, which the current ladder has nine chances to get wrong.

`ctx` is a plain object: `{ url, page, isRecord, isShellLess, allowEmpty, allowRefused }`.

## 3. Paths outside the chain become first-class

Today `main.js` hand-rolls five entry points. They must survive, but as **cases of one dispatcher**,
not as parallel copies of the routing rules:

| Case | Rule (unchanged) | Why it exists |
|---|---|---|
| Record page | `recordParams(url).length > 0` (excluding `page`, `clicktab`, `filter`, `searchtext`, case-insensitive) **or** page name `/^Edit/i`; requires `readForm` + (`#save` or >1 tab) | The class editor's hidden Calendar tab has seven `TimeBlock` tables; routing it through `readPage` would turn the editor into the week view |
| Bare `admin.sd` | no `page=`: read the **live** document, never fetched, `allowRefused: true` | It is the app's POST response; a GET of that URL returns something else |
| `SearchResults` | poll live `.searchResultItem` up to 4 s, then read live | Rows are drawn by the app after load |
| Shell-less print window | no `#mainContent`/`.standardMainContent`: `readSheet` **and** a title (`.formTitle`, `.ReportName`) → sheet, else the app | A print popup is a screen; "no view" is the worst answer there |
| Note tiebreaker | fetched view is `note` and `contradictsNote(document)` → re-read live; contradicted and still unclaimed → leave the app, log it | The app fills these pages in after the HTML arrives |

Record pages are read with `readForm` directly and never through the chain — that rule is
load-bearing and must be preserved even after the registry exists.

## 4. The write path, rebuilt

Current state, shared by four call sites (`save.js`, `report.js`, `task.js`, `settings.js`):

```
diff values against model -> changes[]
apply to live document    -> applied[]
press the app's control   -> { submitted: true } whenever that control exists
```

**The defect to design out:** `saveInApp` reports `submitted: true` even when
`applied.length < changes.length`, i.e. when a selector did not match the live DOM. The user sees
"saved", the app posts, and some edits were never written. The same shape exists in
`runReportInApp`, `runTaskInApp` and `saveSettingsInApp`.

**Requirement — one module, one contract:**

```js
// model/fields.js   control reading: label, selector, type, value, options, source
//                   covers text/checkbox/radio-group/select/textarea, weekday bitmask
// model/diff.js     diffFields(fields, values) -> { changes, skipped }
//                   applyFields(doc, changes) -> { applied, missing }
// model/press.js    readActions / clickActionInApp / actionHint (moved from actions.js)
```

- `applyFields` returns `missing`, and **every** caller must treat `missing.length > 0` as a partial
  failure: do not press the app's control, and surface which fields could not be written. Guessing
  that a field was written is the one failure this project cannot afford on client records.
- Radios are a group value, written to the set, never to whichever input matched first — as
  `settings.js` already does. `form.js` currently ignores radios entirely; the unified reader must
  not, so a record form with radios stops silently dropping them.
- The weekday bitmask label (`#day__<bit>`, Sunday = 1) and the `day__`-prefixed report variant stay
  one shared function, not a regex copied per reader.
- "Press" stays: by id first, then only by a label that appears exactly once, never a link inside a
  data table, never `#sd-root` (our own twin button), never shell chrome.

## 5. Live DOM first, fetch as fallback

**Why this is the single biggest win.** Today every page view pays a full same-origin `GET` of HTML
the browser already rendered, parses it a second time with `DOMParser`, then resolves every
interaction against the *live* document. The model and the tree being written to are therefore two
different documents, and section 4's silent-partial-write bug is a direct consequence.

`mountLive` already proves the live path works for the post-save page. The proposal:

1. Read the **live** document first (`readPage(document, ctx)`).
2. Fall back to a fetch only when the live read yields nothing **or** the live page is a shell
   (no shell, no rows, no controls, no links) while the URL says it should have content.
3. Keep the current polling behaviour for `SearchResults` and any JS-built screen, but as the
   fallback path rather than the special case.
4. Keep `decideShellLess`, the note tiebreaker and `hasReadyView` — the decisions are already pure
   and tested; only their inputs change.

The decision itself must be pure and tested: `chooseSource({ liveView, liveHasShell, liveIsEmpty })
→ 'live' | 'fetch' | 'app'`. Do not scatter `if (!model)` checks through `main.js` again.

**Constraint:** this changes when the GET happens, not whether it is allowed. One GET maximum,
same-origin, still skipped entirely when the live read answers.

## 6. Target module layout

```
src/
  main.js              bootstrap only: probe tick, choose source, mount, teardown
  model/
    root.js            content root, chrome exclusions, one definition of each
    fields.js          control reading (replaces the overlap of form.js + settings.js)
    diff.js            diffFields / applyFields with `missing` reporting
    press.js           actions.js, unchanged in behaviour
    table.js           readTable (moved out of tabs.js — a view module must not own the parser)
  readers/
    index.js           READERS registry + dispatcher
    confirmation.js week.js list.js report.js task.js sheet.js settings.js note.js
    record.js          form + bar + tabs as one record model
  views/               Svelte components keyed by kind, not an {#if} chain
  styles.js
```

Rules this layout enforces:

- One `contentRoot`/chrome definition (`root.js`). Today it is duplicated in `note`, `task`, `sheet`
  and `settings`, each with slightly different fallbacks.
- One diff, one applier, one action reader. `note`, `task` and `sheet` currently each assemble their
  own action/link union.
- `App.svelte` gets a `kind → component` map with `title`/footer derived from the model in one
  function, instead of the ten-branch `{#if}` and the inline title expression.

## 7. Method — one increment at a time

The repository is `efrtt/studio-director-rebuilt` (`7ce29c9`, tag `pre-rebuild`), so each increment is
a diff that can be read and reverted; the work happened on the `rebuild` branch.

Then, per increment, exactly this loop:

1. Read `docs/contract.md` for the reader, not the existing file.
2. Reimplement it behind the same exported name.
3. `npm test` — 12 suites green, no test edited to fit.
4. `npm run golden` — 20 models byte-identical.
5. Commit, with the byte deltas if the bundle moved.

Suggested order (safe to hard): `note` is already rewritten → `actions/:press` → `list` → `sheet` →
`settings` → `report` → `task` → `calendar` → `form` → `tabs` → `bar` → `confirmation` → `page`
dispatcher → `main.js` and the live-first change → `App.svelte` view map.

The live-first change comes **after** the dispatcher, never before: it changes which document the
model comes from, and doing it against the current five entry points would mean rewriting them
twice.

## 8. Definition of done

All of these, not the screens you happened to open:

1. `npm test` — **142 tests** across 12 suites, unchanged, passing. A changed test is a behaviour
   change and must be stated as one.
2. `npm run golden` — **20 models** byte-identical against `test/golden/`.
3. New tests, because they cover today's blind spots:
   - `applyFields` reports `missing` and no caller submits with a missing field;
   - `readPage` dispatcher order (a document claiming two shapes resolves to the earlier reader);
   - `chooseSource` (live / fetch / app);
   - a record form with radios keeps them.
4. Live checks that no fixture can cover, run by hand in a browser: a record save persists
   (`tools/save-check.js`); `ChargesHome` routes to its live index rather than its fetched notice;
   `Unenroll` leaves the app untouched.
5. `npm run userscript` regenerates the artifact, and the userscript template's `@version` is kept
   in step with `package.json` (currently `0.2.0` vs `0.13.0` — a stale value breaks update checks).

## 9. Reference build (frozen comparison point)

| | |
|---|---|
| `@version` | 0.13.0 |
| `studio-director-rebuilt.user.js` | 180,758 bytes |
| `dist/sd.js` | 177,416 bytes (49,440 gzipped) |
| Tests | 12 suites / 142 tests |
| Goldens | 20 models |
| Recorded | 2026-10-31, after the `choose.js` extraction |

A rebuild is expected to move the byte counts. The diff should say by how much, and the tests and
goldens should not move at all.

## 10. Unknowns carried forward — do not assume these are solved

- 9 of the 11 measured misfits were never opened live (only `ChargesHome` and `Unenroll` were).
- 3 form-shaped screens (`Unenroll`, `EmailClass`, `SendEmail`) have no reader and defer to the app.
- 2 screens fall back entirely: `GetOnlineRegUrl` and `ManageFamilyNotes(fident,meth)` — controls,
  but nothing that saves them. Their fixtures are reconstructions of counts, so they pin the
  decision, not the page.
- The report, task and settings write paths share a contract with record saves but **no verified
  transport**; only the record save has been measured against the real site.
- The crawl followed 96 URLs its own safety rule flagged; `crawl-map.md` does not yet explain them.
- `readLiveView`'s polling and `contradictsNote` against a live DOM are still hand-checked only.

### Status after the rebuild (2026-10-31)

Section 2 (registry), section 3 (one dispatcher), section 4 (the write path) and section 6 (layout)
are implemented; section 3's note tiebreaker and shell-less case still run in `main.js`, because they
need the live document and a timeout. Section 5's `chooseSource` exists and is tested, but the
live-first default is **not** switched on: it changes which document every model comes from, and no
fixture or golden can see that difference, only a signed-in session can. The unknowns above are
unchanged; none of them was resolved by moving code.
