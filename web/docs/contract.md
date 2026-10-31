# Reader contract

What each reader takes, what it refuses, and what it returns — as implemented today. This
exists because a rewrite deletes the header comments that carry most of this knowledge, and a
rewrite that has to re-derive it will get the thresholds wrong in ways nobody notices until a
screen renders badly.

Two things make this project rewritable at all, and both are load-bearing:

1. **The readers are pure.** `readPage(doc, url)` and its children take a document and return a
   model. No network, no globals, no storage. Everything below can therefore be tested and
   diffed without a browser.
2. **The reference behaviour is frozen as data.** `test/golden/*.json` holds the exact model each
   fixture produces. `npm run golden` fails when the current code disagrees with it. That file
   set, not this prose, is the authoritative shape.

## The chain, in order

`src/lib/page.js` tries these in this order and stops at the first that answers. The order is the
contract: most specific first, and the notice last because it is the only reader that can be
wrong about a page it cannot fully see.

| # | Reader | Answers when | Refuses when |
|---|---|---|---|
| 1 | `confirmationOf` | the content holds a sentence matching *has been updated / saved / added / deleted / enrolled …* (≤240 chars) | no such sentence; on any URL other than the bare `admin.sd` the refusals are not looked for |
| 2 | `readWeek` | `table.TimeBlock` blocks are present | none — it either finds blocks or returns null |
| 3 | `readList` | `#idSearchSpan .searchResultList` exists (rows, or `allowEmpty`) | no panel |
| 4 | `readReport` | a filter form **and** a run control (`#runreport`, or a label matching `run/generate/create/show/view/update/apply (the) report`) | no run control |
| 5 | `readTask` | `readForm` yields fields **and** the content has pressable actions | no form, or no actions |
| 6 | `readSheet` | data tables with ≥2 rows (excluding `WeekdayCheckboxes`, `Layout`, `TimeBlock`, `Form`, `FormEx`) | fewer than two rows anywhere |
| 7 | `readIndex` | ≥6 content links and <2 table rows | fewer than six links, or a table of rows |
| 8 | `readSettings` | a control plus a save/own control, ≤30 fields | nothing to press; a *headed* table with rows (that is a sheet) |
| 9 | `readNote` | no controls, <2 rows, <6 links, ≥1 action, ≥1 line of text | any of those thresholds is crossed |

`readNote`'s three refusals are exported as `contradictsNote(doc)` because `main.js` reuses them
to detect that a fetched page disagrees with the live one — see *Paths outside the chain*.

## What each model carries

Do not transcribe these from here. `test/golden/*.json` is the record; the files below are where
each shape is produced.

| Reader | File | Shape, in brief |
|---|---|---|
| confirmation | `confirmation.js` | `{ ok, title, message, breadcrumb }` |
| week | `calendar.js` | days → blocks: `{ name, instructor, studio, spots, waitlist, ages, start, height, lane }`; `totals`, `hidden` |
| list | `list.js` | items `{ label, href, type, badge }`, `count`, `label`; `TYPE_BY_PAGE` maps a page to its badge, `LABEL_TYPE` strips an app-side prefix |
| report | `report.js` | `title`, `rows` (filters), `results.tables`, `results.rows`, `trigger` |
| task | `task.js` | `title`, `rows`, `fields`, `form`, `actions`, `primary`, `links` |
| sheet | `sheet.js` | `tables[]` with headings, cells and links, `rows`, `shown`, `truncated` (300 cap) |
| index | `index-page.js` | `groups[] { label, items[] }`, `count`, `limit` (300), `truncated` |
| settings | `settings.js` | `fields[] { key, label, source, type, value, options }`, `actions`, `save`, `primary` |
| note | `note.js` | `lines[]`, `actions[]`, `primary`, `title`, `breadcrumb` |

`source` on a settings field is one of `label`, `cell`, `title`, `block`, `name`. `name` means the
label was guessed from the control's id and the UI must say so — that is the "from field name"
note, and it is a promise, not decoration.

## Paths outside the chain

`main.js` handles four cases the chain cannot, and a rewrite must keep all four:

- **Record pages.** `isRecordPage(url)` → `readForm` + `a#save` (or more than one tab). Read with
  `readForm` directly, never `readPage`: the class editor carries a Calendar tab with seven
  `TimeBlock` tables, which `readWeek` would claim.
- **The bare `admin.sd` URL.** That is what the app returns after a POST, so it is read **live**
  from `document`, never fetched — a GET of the same URL returns something else.
- **Search results.** The rows are drawn by the app after load; the page is polled for
  `.searchResultItem` (up to 4 s) and then read live.
- **Print windows.** No shell at all (no `#sideNavBar`, no `#topBarContainer`), so `readPage`
  refuses them. `readSheet` + `.formTitle`/`.ReportName` is the answer; anything else stays with
  the app rather than being covered with "no view".
- **The note tiebreaker.** A note is only mounted after `contradictsNote(document)` says the live
  page agrees. If it disagrees and no reader claims the live page, the app keeps its page and the
  console says `[sd] note contradicted by the live page - leaving the app alone`.

## Behaviours that are promises

These were asked for by name. Each must survive a rewrite; the third column is what proves it.

| Behaviour | Where it lives | Pinned by |
|---|---|---|
| `SRVDA Faculty` classes hidden from the week, counted in the footer | `calendar.js` `FACULTY`, `App.svelte` | `parse.test.mjs` |
| Mixed lists get type badges, single-type lists do not | `list.js` | `parse.test.mjs` |
| Landing pages render as a searchable tile grid, capped at 300 drawn | `index-page.js` | `index.test.mjs` |
| New / Save / Print / Email / Delete / Edit Family / More on a record | `bar.js`, `Editor.svelte` | `bar.test.mjs` |
| Settings rows never invent a label — guessed ones say so | `settings.js`, `Settings.svelte` | `settings.test.mjs` |
| The enroll step offers its own Enroll/Cancel, not a generic Save | `settings.js` | `settings.test.mjs` |
| Record tabs render, including the hidden panels | `tabs.js` | `tabs.test.mjs` |
| One report adapter for all 66 report screens | `report.js` | `report.test.mjs` |
| Print forms route to a sheet, not "no view" | `main.js`, `sheet.js` | `sheet.test.mjs` (the reader) |
| Notice screens render their sentence and the app's own control | `note.js` | `note.test.mjs` |
| Search results carry the app's own labels and links | `list.js`, `search.js` | `parse.test.mjs` |

One caveat about that column, and it matters for a rewrite: **every one of those tests exercises a
pure reader.** The mount *decision* used to be inline in `main.js` for the same reason the readers
were extracted; it now lives in `src/lib/choose.js` (`wantsLiveLook`, `decideMount`) and
`choose.test.mjs` pins all seven cases — the note tiebreaker and the no-view retry included.

Still needing a document and a session, and so covered only by the hand checks below:
`readLiveView`'s polling loop and the search-results wait (both are timers), and
`contradictsNote` against a live DOM. The **rules those loops act on** are pure and tested:
`decideShellLess` (a print window is a screen only when a reader claims it *and* it names itself)
and `hasReadyView` (which views end the wait — a note deliberately does not).

## Acceptance criteria for a rewrite

A reimplementation is done when all of these hold — not when it looks right on the screens you
happened to open.

1. `npm test` — all 12 suites, 142 tests, unchanged. Do not edit a test to make the new code pass;
   if a test must change, that is a behaviour change and needs saying out loud.
2. `npm run golden` — all 15 fixtures produce byte-identical models. This is the one that catches
   the 445 screens nobody opens.
3. The live checks that no fixture can cover, run by hand in a browser: a record save persists
   (`tools/save-check.js`), a note-shaped screen whose live page disagrees routes to the live view
   (`ChargesHome`), and a form-shaped screen with no reader leaves the app untouched (`Unenroll`).

## The rewrite, in progress

The plan for the replacement — invariants, reader registry, write-path contract, live-first
reading and the acceptance gate — is [`rebuild-spec.md`](rebuild-spec.md). This section is the
increment log; that file is the design.

This workspace is a repository as of the rebuild (`7ce29c9`, tag `pre-rebuild`), so each increment is
a commit that can be read and reverted, and the work happened on a `rebuild` branch. The method is
unchanged: rewrite **one piece at a time**, in place, with both gates green after each step. Never a
big-bang replacement.

**Done: `src/lib/note.js`.** Reimplemented from this document rather than from itself. The notice
reader is the largest and least certain in the build (68 predicted, 50 measured), and until this
increment **no golden covered it at all** — nine views were pinned, notices were not, so a rewrite
could have broken every one of them with both gates still green. `notice-addmultiplepayments.html`
closed that hole (19 → 20 goldens); the rewrite then reproduced its model byte-for-byte, with the
six `note.test.mjs` tests and the twelve `choose.test.mjs` tests unchanged.

**Done after that:** one model layer (`model/root.js`, `table.js`, `fields.js`, `diff.js`,
`press.js`), the reader registry with its gates as data, one route decision for the five entry
points, and a `kind → component` view map. The write paths share one diff and one applier that names
a field it could not write instead of claiming success. Deltas, the two guards that caught
regressions, and the one step deliberately not taken (live-first reading, which needs a signed-in
session to verify) are in [`rebuild-plan.md`](rebuild-plan.md).

**Then live-first reading.** `main.js` reads the live document before fetching, and fetches only when
`chooseSource` says the live page cannot answer (no shell, or an empty content root). A claimed live
page costs no request at all. The hand-checks in the plan still apply, and this one is unverified
against the real app.

Remaining: the live hand-checks listed in [`rebuild-plan.md`](rebuild-plan.md).

## What a rewrite should design out

Not complaints — requirements, so the same shape is not rebuilt by accident:

- the try-each-reader-until-one-wins chain, and its implicit ordering contract;
- duplicated action/link reading across `note`, `task` and `sheet`;
- the fetched-then-live double read, which exists only because a GET cannot see post-load content;
- per-shape special cases: the faculty regex, the weekday bitmask, the `NOT_DATA` table exclusion;
- the absence of types, in a codebase whose whole job is reading untyped HTML.

## Fixtures: captured, or not written

`test/fixtures` holds two kinds, and the difference matters more than it looks:

- **Captures** of real pages — the calendar, the three editors, a report, a sheet, a search, a
  settings page, a task, a confirmation. These can be trusted to resemble what the app serves.
- **`fetched-*` shells** — `fetched-unenroll.html`, `fetched-emailclass.html` — reconstructed from the
  crawler's own structure record (title, 0 tables, 0 controls, 5 links) for screens whose *rendered*
  form is drawn by the app's JavaScript. Their live shapes are measured in `docs/live-sample.json`,
  not here, because hand-authoring the markup of a JS-drawn page would be invention — and a test
  that passes against invented markup is worse than no test at all.

Both land on **no view**, which is worth pinning precisely because it is not the obvious answer:
the breadcrumb link inside the content root puts each page at `readNote`'s six-link gate, while
`readIndex` excludes chrome and counts only five items, so neither reader claims them. They reach
`main.js` through `!model.view` → live re-read, **not** through the note tiebreaker. A rewrite that
"tidied" either threshold would start covering these two screens with a notice again.

## Reference build

Frozen before any rewrite so old and new can be compared on the same URL:

- `@version 0.13.0`, `studio-director-rebuilt.user.js` 180,758 bytes
- `dist/sd.js` 177,416 bytes (49,440 bytes gzipped)
- 12 suites / **142** tests, **20** golden models
- recorded 2026-10-31, after the wiring extraction (`choose.js`: the mount decision, the print
  branch, the live-wait set) — the figures are the artefact at that point, so a rebuild will move
  the byte counts and the diff will say by how much

## What is still unknown

Stated here so a rewrite does not assume these were solved:

- 9 of the 11 measured misfits were never opened live (only `ChargesHome` and `Unenroll` were).
- 3 form-shaped screens (`Unenroll`, `EmailClass`, `SendEmail`) have no reader and defer to the app.
- 2 screens fall back entirely: **`GetOnlineRegUrl`** (2 controls, 2 links) and
  **`ManageFamilyNotes(fident,meth)`** (1 control, 3 links). Both have controls and nothing that
  saves them, which is exactly why no reader claims them. Their markup was recorded only as counts,
  so `test/fixtures/fetched-onlineregurl.html` and `fetched-familynotes.html` are reconstructions of
  that shape — they pin the decision, not the page.
- The report, task and settings write paths share a contract with record saves but **not a verified
  transport** — only the record save has been measured.
- The crawl followed 96 URLs its own safety rule flagged; the map does not yet explain that.
