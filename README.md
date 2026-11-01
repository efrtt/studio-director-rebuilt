# Studio Director, rebuilt

An unofficial userscript that gives [The Studio Director](https://www.thestudiodirector.com/)'s admin
screens a rebuilt client: a week calendar that fits on a laptop, record lists you can filter and walk,
editors that save only what you changed, and readable renders of the reports, table screens and
settings pages the app serves as bare HTML.

It runs in your browser on top of the app you already pay for, with your existing session. No account,
no server, no API key.

> **Not affiliated with The Studio Director.** This is a personal client for an account you own. It is
> not a replacement service, it does not redistribute anyone's data, and it is not supported by the
> vendor.

## What it does

- **Week and month calendars.** Classes as blocks sized by real duration, studio columns, seat and
  waitlist counts read from the page rather than from colour, and a footer that totals the week.
- **Record lists.** Classes, families and students get a filterable list with live counts and mixed-type
  badges; opening a row goes straight to that record instead of through the app's search.
- **Record editors.** One row per field, the app's own values, record tabs (Enrollment, Skills,
  Calendar, …) rendered from the panels already in the response, and the record's own buttons — New,
  Print, Email, Delete, Edit Family — back where you can reach them.
- **Reports, table screens and settings.** The 66 report screens share one adapter, so do the print
  forms and the big sheets. Settings pages offer their own controls rather than an invented Save.
- **Landing pages as a grid.** Menu screens become a searchable tile grid instead of a wall of links.
- **Themes.** Light, dark, or follow the system.
- **Esc gets you out.** The original page is still there, untouched, one keypress away.

## How it works

The script reads the page the browser already loaded and parses it into a plain model — no network call
is needed on most screens. A single same-origin `GET` is the fallback for pages the app fills in after
load. A model is turned into a Svelte view, and every reader is a pure function of a document and a URL,
which is what lets the whole thing be tested without a browser.

Writes are never constructed here. The editor puts your changed values into the app's own live form
controls and clicks the app's own Save, so validation, masks and redirects all remain the app's
business. Fields you did not touch keep the value the server sent.

## Install

Requires [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Safari) or
[Violentmonkey](https://violentmonkey.github.io/) (Firefox).

1. Build the userscript (Node 20 or newer):

   ```bash
   cd web
   npm ci
   npm run userscript     # writes ../studio-director-rebuilt.user.js
   ```

2. In your userscript manager, create a new script and paste in the contents of
   `studio-director-rebuilt.user.js`.
3. Open The Studio Director and sign in as usual.

The `@match` is `https://app.thestudiodirector.com/*/*`, so it works on any studio tenant; the tenant is
read from the URL. The metadata block points `@updateURL` at the built file on this repo's `main`
branch, so an installed copy picks up a new build when the version is bumped.

## Using it

- **Esc**, the **Original** button, or `#original` on a URL returns the app's own page. Anything
  unsaved is discarded.
- The rebuilt rail replaces the app's navigation and links to the same pages, rebuilt.
- On a record, the left column lists sibling records when the page itself carries that list — so moving
  from one family to the next is one click.

## Safety

- **The app posts, not the script.** No POST body, method name or token is ever built here.
- **Only changed fields are written.** Everything else stays as the server sent it.
- **At most one same-origin `GET` per page view**, and none on screens the live page already answers.
  Cookies and credentials are never read, stored or logged.
- **The sign-in page is never replaced.**
- **Nothing leaves the browser.** Theme and other preferences live in local storage.

## Development

Everything lives in [`web/`](web/). The readers are pure functions, the recorded reference behaviour is
frozen as JSON, and CI enforces both.

```bash
cd web
npm ci
npm test            # every reader, router and writer
npm run golden      # the recorded screens, model for model
npm run demo        # self-contained demo pages from the fixtures
npm run userscript  # rebuild ../studio-director-rebuilt.user.js
npm run serve       # serve the demo pages locally
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the tests, the goldens, the build, and
fails if the committed userscript does not match the source it was built from.

```text
web/
  src/            readers, model, views (Svelte), styles
  test/           fixtures, golden models, suites
  tools/          build, golden, capture, crawl and demo scripts
  docs/           contract, design notes, crawl map, screenshots
```

Captured pages and the models they produce are committed under `web/test/fixtures` and
`web/test/golden`. They contain structure and same-length filler text, never record content — the crawl
tools read tags, classes, headings and counts only.

## Docs

- [`web/docs/architecture.md`](web/docs/architecture.md) — the long write-up: each reader, what it claims and what it refuses.
- [`web/docs/contract.md`](web/docs/contract.md) — the invariants, and the golden models that pin them.
- [`web/docs/adding-a-page.md`](web/docs/adding-a-page.md) — how to cover a screen the rebuild misses.
- [`web/docs/crawl-map.md`](web/docs/crawl-map.md) — every screen in the crawl and which reader owns it.
- [`web/docs/rebuild-spec.md`](web/docs/rebuild-spec.md) — the design the rebuild follows.

## Limitations

- **Unofficial and unversioned against the app.** If The Studio Director changes a screen, a reader can
  stop claiming it; the page then falls back to the app's own markup, which is the intended failure mode
  but still a miss.
- **Two screens are deliberately left alone**, because neither can be read or saved safely; see
  [`web/docs/contract.md`](web/docs/contract.md).
- **Desktop browsers only.** It does not work in the vendor's mobile app or on iOS Safari.
- **No affiliation and no warranty.** Use it on your own account, at your own risk.
