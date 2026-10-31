# Studio Director Comfort Skin

A read-only usability layer for **The Studio Director** (`app.thestudiodirector.com`), delivered as a
Tampermonkey / Violentmonkey userscript. It restyles and augments the pages the app already serves.

> **There are now two projects in this repo.** This README covers the *skin* (`studio-director-skin.user.js`),
> which decorates the app's own pages. The rebuilt screens (`studio-director-rebuilt.user.js`) are a
> ground-up replacement frontend that parses four pages into typed data and renders its own views —
> see [`web/README.md`](web/README.md). Install only one of them at a time.
>
> The earlier rebuild attempts (`app/`, `studio-director-calendar.user.js`) have been removed: they
> accumulated adapters for page shapes that were never actually dumped. `web/` is the current build
> and contains only what the dumps show. The page-diagnosis script that produced those dumps now
> lives at `web/tools/diagnose-page.js`.

## What it does

| Area | Change |
|---|---|
| Layout | Removes the hard-coded `min-width: 1340px` that breaks laptop screens, and gives narrow viewports a scroll path. |
| Typography | One font family instead of Arial/Verdana/Open Sans mixed per element; larger, higher-contrast text. |
| Data tables | Sticky headers, zebra rows, row hover, right-aligned numeric and money columns, and a client-side row filter with a live count. Applied only to tables detected as data tables. |
| Roster focus | On any screen with a real list (8+ rows), the block holding the biggest table is marked primary and takes the width freed by folding the **inert** blocks in front of it. Anything containing a form control is never folded, nothing is moved, and one click restores everything. It only acts when one table clearly dominates — a second table half its size means a multi-panel screen, and it leaves the layout alone. |
| Ledger | The balance summary (`table.LedgerHeader`) is pinned above the running ledger, and the ledger's own column header sticks just below it at the summary's measured height. Amounts right-align even when they use signed forms like `-$120.00`. |
| Calendar | Today emphasised, weekends tinted, a non-colour legend for the "space available / full" indicators, and auto-scroll to today. |
| Status colours | `openClass` / `fullClass` / `notApplied` gain a non-colour cue (accent bar, dotted underline) so state does not rely on green vs red alone. |
| Tabs | On tabbed detail screens (`Overview / Students / Ledger / Notes`), table work happens only in the panel that is actually rendered, and switching tabs enhances the newly shown panel. The tab you last used on a screen reopens next time you visit it. |
| Navigation | **Ctrl/Cmd + K** command palette indexing every `.sd?page=` link on the current screen, with fuzzy search, arrow keys and Enter. Recently visited pages surface automatically. |
| Pinning | Pin the pages you use daily; pinned pages lead the palette and appear as a chip strip on the Home screen. |
| Theme | Light, dark, or follow the system. |
| Density | Comfortable or compact cell padding. |
| Focus | Visible focus rings for keyboard navigation. |
| Login | Restyled sign-in page (same form, same behaviour). |

## What it deliberately does not do

- **No network requests.** The script issues zero `fetch`/`XHR` calls. Your session cookie, the
  server and your account are untouched — it only reads what the page already rendered.
- **No writes.** No forms are submitted, no data is changed.
- **No data leaves the browser.** Settings live in userscript storage (or `localStorage`).
- It does not work in The Studio Director's native mobile app or on iOS Safari.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Safari) or
   [Violentmonkey](https://violentmonkey.github.io/) (Firefox).
2. Open the userscript manager's dashboard → **New script**.
3. Replace the template with the contents of `studio-director-skin.user.js` and save.
4. Load the app and sign in as usual. The skin applies immediately.

The `@match` is `https://app.thestudiodirector.com/*/*`, so it works for **any** studio tenant, not
just yours. The tenant is read from the URL path at runtime.

### Sharing with friends (auto-update)

Host the `.user.js` file anywhere that serves plain text over HTTPS (a GitHub Gist's raw URL, a
static host, an internal server), then add these two lines to the metadata block before sharing:

```js
// @updateURL    https://your.host/studio-director-skin.user.js
// @downloadURL  https://your.host/studio-director-skin.user.js
```

They are intentionally **not** included — shipping a placeholder URL makes the update check fail on
every launch. Once the lines point somewhere real, each friend installs once and receives updates
whenever you bump `@version`.

## Controls

- **Ctrl/Cmd + K** — jump to page palette
- **↑ / ↓** — move selection, **Enter** — open, **Esc** — close
- **Userscript menu** (Tampermonkey toolbar icon):
  - Jump to page…
  - Pin / unpin this page
  - Toggle roster focus (fold inert blocks)
  - Toggle remember-tab
  - Toggle density (comfortable / compact)
  - Cycle theme (auto / light / dark)
  - Diagnose this page (console) — now also lists each content block with its row, control,
    table and node counts, with no text, which is enough to tune a page module

Add `?skinDebug=1` to any URL (or enable `debug` in storage) to outline the tables, columns and
widgets the script has claimed.

## Verification

Tested against the app's real `admin.css` using `harness.html`, which now reproduces the
authenticated shell captured from a live structure dump: `.topBarContainer`, `.standardMainContent`,
`#sideNavBar`, `#mainContent > .contentContainer`, a left detail pane with live controls, an inert
banner, and a 12-row roster.

Checked on the current revision: no console errors attributable to the script; `body` `min-width`
relaxes from `1340px` to `0`, and at a 1024 px viewport the document scroll width goes from
**1340 px (overflowing)** to **1024 px (no overflow)**; sticky headers resolve to `position: sticky`;
12 money cells are right-aligned; the palette indexes **13** de-duplicated destinations; density
switches cell padding between `7px 10px` and `3px 7px`; dark mode resolves body to
`rgb(21, 26, 34)` with `rgb(230, 235, 243)` text.

Roster module: the 12-row roster pane is chosen as primary and a 2-row meeting table is not; exactly
the one inert block in front of it is folded; the detail pane holding 5 form controls is untouched;
the toggle cycles `1 → 0 → 1` folded blocks with matching labels. Because `.contentContainer` is a
**row flex** in their stylesheet, the toggle bar mounts above the row (800×28) — the first attempt
rendered it *inside* the row as a squeezed 70 px-wide column, which is what caught the problem.

Ledger (`harness-tabs.html`): the running amount column went from **0 of 9** cells aligned to **9 of 9**. The cause was real, not cosmetic — `-$120.00` failed the old money pattern, so only 6 of 9 rows matched and the column fell under the 70% numeric threshold. The balance summary pins at `top: 0` and the ledger's column header sits at `39px` (the summary's measured height); after scrolling the container 500 px they measured at `0` and `39` from the viewport top, so both hold. Reaching that required clearing `overflow` on the two wrappers that clip without ever scrolling (`#tab-ledger-content`, `.Content`) — a non-scrolling `overflow: auto` ancestor silently becomes the sticky containing block. `#mainContent` is never touched, so the app keeps its real scroll container.

Tabs (`harness-tabs.html`, mirroring the real `EditFamily` tab markup): at load only the visible Ledger
panel's table is claimed — the Overview and Students tables stay untouched and there is exactly **1**
toolbar. Clicking Overview lazily claims its table (**1 → 2** data tables, toolbar visible), and the
ledger's toolbar survives. The choice is stored as `{"<page>": "overview"}`, and after a reload the
skin restored Overview over the page's hard-coded default (`overview` selected, ledger panel
`display:none`), with that panel enhanced. The skin never toggles the app's tab classes — it clicks
the app's own tab and lets the app switch.

The multi-table guardrail was tested by adding a rival 8-row table to the same screen: the fold count
went from 1 to **0**, so a ledger-style screen is left alone. Turning roster focus off now removes the
folded class, the toggle bar, the `sds-primary` marker and the `sds-rowflex` hook (0/0/false/false),
and re-running restores all four — the first version left the flex growth behind when switched off.

`diagnose()` emits its whole report as a **single** `console.log` string between clear markers, so
"Copy string" in devtools captures the summary, the content block list and the structure at once,
instead of several collapsed entries that get truncated when copied by hand.

Verified on an earlier revision of the harness that included the login form and calendar: login
input and container both measure 320 px so the form does not overflow, and the calendar legend,
today emphasis and scroll-to-today behave as described.

### Regenerating the harness

The preview server serves only the registered HTML file, so the script has to be inlined to run
locally. The `*.run.html` copies are **generated** — never edit them, and they are not kept in the
repo. Rebuild one whenever you want to open a harness:

```bash
for f in harness harness-tabs; do
  awk '{ if ($0 ~ /<script src="studio-director-skin.user.js"><\/script>/) { print "<script>"; while ((getline line < "studio-director-skin.user.js") > 0) print line; close("studio-director-skin.user.js"); print "</script>"; } else print }' $f.html > $f.run.html
done
```

Two harnesses, two jobs: `harness.html` is the roster/list screen, `harness-tabs.html` is the tabbed
detail screen. Both are development scaffolding, not part of the skin — delete them whenever you
no longer want them.

## Known limits

- **Roster focus is heuristic, not per-screen.** It picks the primary table by row count and folds
  only what sits *before* it and holds no form control. Multi-table screens are skipped entirely
  rather than guessed at, so a ledger or family record is left untouched. If it still gets a screen
  wrong, one click restores everything, or turn it off from the menu. A precise module per screen
  needs that screen's block list — the Diagnose command now prints exactly that.
- **It never folds blocks after the primary table, and never moves a node.** Folding is a CSS class
  toggle, so the app's own scripts and form serialisation are unaffected.
- **The ledger pin removes clipping from two wrappers.** `#tab-ledger-content` and `.Content` get `overflow: visible`, because each clipped without ever scrolling and that silently disabled `position: sticky`. Scrolling moves to `#mainContent`, which is built for it, but this is the one place the skin changes a layout rule rather than only adding to it — worth removing if a screen starts drawing outside its box.
- **Dark mode is best effort.** The app hard-codes background colours in ~445 rules; the common
  surfaces are covered, but a rarely used screen may show a light patch. Light mode is exact.
- **The scraped "morning glance" dashboard was cut** from this version. It would have been the only
  feature making network requests, and it cannot be written correctly without knowing which pages
  hold which totals. Pinning plus the palette covers the same "too many clicks" problem with none of
  the risk.
- Selectors are centralised at the top of the file; if The Studio Director restyles a screen, it is
  a one-place fix.

## Next step: page dumps

To build per-page reordering, save one copy of each screen that matters — In devtools: **Elements →
right-click `<html>` → Copy → Copy outerHTML** — for the schedule/calendar, rosters, financials and
enrollment screens.

> **These files contain student names, guardian names and payment data.** Keep them out of version
> control and redact names before sharing. If you would rather not hand over markup at all, run the
> **Diagnose this page** menu command and copy the **whole single string** it logs — tags, classes
> and counts only, no page text. That is usually enough to write a page module, and it cannot leak
> a student's name.

## A note on scope

This is a personal skin for a product you pay for, applied to your own account. Keep it that way:
don't republish the app's data, don't hand it out as a service, and don't point it at accounts that
aren't yours. The script makes no requests and changes no data, which is what keeps it uninteresting
to the people who run the service. If something is genuinely unusable, telling Studio Director
support is also worth doing — that fixes it for everyone.
