# Studio Director — rebuilt screens

A ground-up rebuild of **The Studio Director**'s admin screens, built only from live HTML dumps
of the real pages — a full crawl of **447 screens**. It fetches each page with your existing
session, parses it into typed data, and renders its own view over it: **445 of the 447** now get a
rebuilt screen, and the **2** that do not are left to the app untouched (see
[`docs/crawl-map.md`](crawl-map.md)).

| Screen | Page | Built from |
|---|---|---|
| Week calendar | `admin.sd?page=CalendarPage` | live dump (`tables: 7`, `table.TimeBlock`) |
| Classes | `admin.sd?page=NewClass` | live dump (`#idSearchSpan`, 288 items) |
| Families | `admin.sd?page=NewFamily` | live dump (`#idSearchSpan`, 500+ items) |
| Students | `admin.sd?page=NewStudent` | live dump (`#idSearchSpan`, 500+ items) |
| Editing a class | `admin.sd?page=EditClass&cident=…` | live dump (`table.FormEx`, 25 rows, 4 tabs) |
| Editing a family | `admin.sd?page=EditFamily&fident=…` | live dump (`table.Form`, 20 rows) |
| Editing a student | `admin.sd?page=EditStudent&sident=…` | live dump (`table.Form`, 16 rows) |
| After a save | `admin.sd` (no `page=`) | live page, matched by its own sentence |
| Search results | `admin.sd?page=SearchResults&searchText=…` | live page, same panel shape as the lists |
| Reports (66) | `admin.sd?page=ClassRosterForm`, `StudentList`, `ChargesDetail`, … | crawl: filters in `table.Form`, `#runreport`, `table.ReportTable` |
| Record tabs | the `Edit*` panels (Enrollment, Skills, Calendar, …) | live dump: `.tabContainer` + `.tabContent` |
| Forms with an action (28) | `EmailToGroupForm`, `EmailClasses`, `StatementForm`, `ManageHolidays`, … | crawl: `table.Form` + a control that is not *Run Report* |
| Table screens (90) | `HomePage`, `Trends`, `Alerts`, `ManageSizes`, `PrintClassRoster`, every `Print*` sheet | crawl: tables with headings and rows |
| Toggle settings (79) | `SetPerforming`, `SearchDisplayFormat`, `PortalAccess`, `ManageFamilyStudentMax`, `ConfigureCalendar` | crawl: a control and a save, no rows |
| Landing pages (33) | `ChargesHome`, `EmailTextHome`, `AdvSearch`, `ReportsHome`, `AdminHome` | crawl: links, no rows |
| Notices (68) | `AddMultiplePayments`, `ManageZapier`, `SizeCostumes(meth)`, `DeleteExpiredCards(meth)` | crawl, then every one opened live: a sentence and the app's own control, no table |

## The readers, and the shape each claims

Every reader in `src/` claims one structure, and `page.js` tries them most-specific first. The
notice reader is last, because it is the one that can be wrong about a page whose contents the
server sent empty. The counts above are the crawl's, one row per reader.

**1. The week calendar.** Seven `table.TimeBlock` sections, one per weekday. Each class is
absolutely positioned inside its day with inline styles, and its details are in a hidden
tooltip:

```html
<table class="TimeBlock">
  <tr><th>Monday</th></tr>
  <tr><td>4:00p</td><td><div>
    <div style="top:90px;left:0%;width:25%;height:89px">
      <div style="background-color:#00ffff;z-index:100000">
        <a href="admin.sd?page=EditClass&amp;cident=101" style="color:#000">
          <b>4:00p</b>Ballet III - Ages 6-9
        </a>
      </div>
      <span style="display:none">Ballet III<br>Ms. Rivera<br>Studio A<br>
        3 spots available<br>0 waitlisted<br>Ages: 6-9</span>
    </div>
  </div></td></tr>
</table>
```

`left`/`width` are the lane (25% steps = four classes side by side), `top`/`height` are the
offset and duration, and the hidden span is the only source of name, instructor, location,
seats, waitlist and ages. Availability comes from `N spots available` — **never from
colour**, because the app colours some classes white whether they are full or not.

**2. The record list.** `NewClass` is a create/edit form, and the list of records lives in
the side panel beside it:

```html
<div id="idSearchSpan" class="searchResultPanel">
  <div class="searchResultBar"><div class="searchResultLabel">Classes</div></div>
  <div class="searchResultLabel"><input id="filter" name="filter" type="text"></div>
  <div class="searchResultList">
    <div class="searchResultItem"><a href="admin.sd?page=NewClass&amp;cident=101">…</a></div>
  </div>
</div>
```

The adapter reads the panel's own heading and shows it verbatim, so the same code serves
Classes, Families and Students without a per-page table. Routing is structural: a page with
`table.TimeBlock` is the week view, a page with `.searchResultList` is the list view, and
anything else is left to the original app.

The app lays the week out as absolutely-positioned divs inside one container per day, with
`top`/`height` in pixels and `left`/`width` in 25% steps. That geometry is where the studio
column, the start time and the duration come from — but the rebuilt view ignores the pixels:
it reads the times out of each block's text (`Stu 3 - 322 Teen/Senior Tap Company - 12+ - RO -
4:00 PM - 4:45 PM - 4 of 5 spots taken`) and sizes blocks at `PX_PER_MIN` (2 px) per minute.
So 15 minutes is a 30 px sliver, 90 minutes a 180 px block, and the hour gutter disappears
when no class is scheduled. A day is only as tall as its own first-to-last class.

Classes whose instructor is **`SRVDA Faculty`** (the studio's own pool, used to hold open
studio time) are left off the week view. They are not silently dropped: the footer reads
`… · 1 faculty hidden`, so the count always explains the difference against the original.
The match is on the instructor line only, case-insensitive, and exact — a class genuinely
taught by a person named in a longer string is still shown.

All three pages were dumped and all three carry the same panel. They differ only in the form
beside it, which this app does not parse:

| Page | Editor table | Controls |
|---|---|---|
| `NewClass` | `table.FormEx`, 25 rows | 43 |
| `NewFamily` | `table.Form`, 19 rows (`#guardian`, `#last_name`, `#address1`, `#email`, ...) | 23 |
| `NewStudent` | `table.Form`, 13 rows (`#first_name`, `#student_last_name`, `family`, `#birthday__mon`, ...) | 17 |

## Editing

Click a row in a list, or a class on the calendar, and you land on a rebuilt editor for that
record — one row per field, the app's own values, and a Save that actually saves.

### How the editor is built

The record editor is a form table with one row per field, confirmed from all three `Edit`
dumps. `EditFamily` and `EditStudent` use `table.Form` beside the list panel; `EditClass` has
no side panel and uses `table.FormEx` (25 rows) with Overview / Enrollment / Skills / Calendar
tabs:

```html
<table class="Form">
  <tr><td>Guardian</td><td><input id="guardian" name="guardian" value="…"></td></tr>
  <tr><td>State</td><td><select id="state" name="state">…</select></td></tr>
</table>
```

[form.js](../src/lib/form.js) reads the label from the first cell and every control in the second,
keeping the control's own id (or its name, when the dumps show a field with no id and that name
is unique — `select name="family"` on the student page). Nothing is hard-coded per record type,
so the same adapter covers family and student, and would cover class the moment its form is
confirmed.

### How saving works

[The editor never builds a POST](../src/lib/save.js). It compares what you typed against what the
page arrived with, writes **only the changed fields** into the app's live controls, fires their
`input` and `change` events, and then clicks `a#save` — the app's own Save link.

That has three consequences worth stating plainly:

- The app's submit contract (`#idPage`, `#idMeth`, `#idMethArgs`), its validation, its masks and
  its redirect all run exactly as they do for a normal click. None of it is reimplemented.
- Every field the editor does not show keeps the value the server sent, because it is still in
  the real form, untouched. Nothing is dropped on save.
- If the page has no Save link, the editor says so instead of pretending.

### Global search

The header has a **Search everything** box. It does not search anything itself: the app's search
looks through every field of every record type — names, logins, phone numbers, emails — and none
of that is in the HTML we read, where a record is a label and a link. So [`search.js`](../src/lib/search.js)
types the query into the app's own `.searchBox` and presses exactly one thing:

1. the app's search button, if the box has one;
2. otherwise the box's own form — **but never `form#idForm`**, which carries `#idPage`/`#idMeth`
   and would re-post the editor instead of searching;
3. otherwise Enter (`keydown`, `keypress`, `keyup`, with `key`/`code`/`keyCode`), for a box the
   app submits from its own handler.

The results page is `admin.sd?page=SearchResults&searchText=…`, and it gets its own mount path
for two reasons:

- **It is not a record page.** `searchText` is a query, not an id — but the record rule treated
  any non-navigation parameter as one, so this page was being handed back to the app untouched.
  Navigation parameters (`page`, `clicktab`, `filter`, `searchtext`) are now matched without
  regard to the app's casing, which is how `searchText` slipped through.
- **Its rows are not in the URL.** The page carries DWR iframes and fills the panel from the
  app's own JS, so a GET returns no results. It is read live, polling for
  `.searchResultItem` (up to 4 s) before rendering — the same panel shape as every other list,
  so the list view renders it unchanged, mixed types and all.

The query is prefilled into the header box from the URL (`searchText`, `q`, `search`, …) so it
does not vanish when the page loads. An empty result panel is still a result: the page says
`No records to show.` rather than falling back to "not rebuilt".

Each row in a mixed list carries a **badge** — `FAMILY`, `STUDENT`, `CLASS`, `INSTRUCTOR` —
derived from the link's own `?page=EditFamily`-style target, with the app's label as fallback
(`Family: Frank/Naz Abedini` → badge `Family`, name `Frank/Naz Abedini`). Badges only appear when
a list really mixes types, so a Families list stays unlabelled rather than repeating the word on
every row.

### The screen after a save

The app answers a save with a plain `admin.sd` page — no `page=` parameter — that says
"<item> has been updated." with the record list beside it. That page is rebuilt too, and one
detail matters: **it is read live, not fetched.** The browser is already showing the response
from the POST, and a GET of the same URL would return something else entirely, so
[`main.js`](../src/main.js) mounts from `document` when the URL has no `page` parameter.

Nothing about that screen is hard-coded. [`confirmation.js`](../src/lib/confirmation.js) looks for
the sentence itself — the element whose own text matches `has been updated|saved|added|…`,
skipping the record panel so a family can never be mistaken for a message — because no dump of
that response exists yet and a class name would be a guess. A refused save is recognised the
same way (`could not be saved`, `invalid`, `failed`, …), but only on that bare URL: ordinary
pages are full of those words, so the looser check never runs anywhere else. Its card shows `!`
in red instead of `✓`, and the title reads **Not saved**.

### The record list beside the form

When a record page carries the search panel (`#idSearchSpan`, as it does for a family, a
student, and a class opened from the class list with `searchidx`), the editor shows that list
in a column to its left: filter, count, and the current record highlighted. Clicking a row opens
that record — so moving from Ballet III to Jazz I is one click, not a trip back to Classes.

A class opened directly by id (`?page=EditClass&cident=…`, as the calendar's links do) has no
panel on the page, so there is no list and the form takes the full width. Same rule both ways:
the list appears when the page really has one.

### The record tabs

The `Edit*` pages carry tabs — a class's Overview, Enrollment, Skills and Calendar; a family's
students, ledger and notes; a student's enrollment, family and skills. All of them ship in the
same response, every panel after the first hidden with `display:none`, so rebuilding them costs
no extra request:

```html
<div class="tabContainer">
  <div id="tab-overview" class="tab selectedTab">Overview</div>
  <div id="tab-enrollment" class="tab">Enrollment</div>
</div>
<div id="tab-enrollment-content" class="tabContent" style="display:none">
  <a id="addstudent" class="Btn" href="#">Add student</a>
  <table id="enrollmenttable" class="SimpleSD">
    <tr><th>First Name</th>…<th class="AR">Actions</th></tr>
    <tr><td><a href="admin.sd?page=EditStudent&amp;sident=9001">Ada</a></td>…</tr>
  </table>
</div>
```

[`src/lib/tabs.js`](../src/lib/tabs.js) reads the strip and one panel per tab: the tables in order,
each under the section label above it (`Waitlist`), the column headings from `th`, and each cell
as text plus the link it holds. Rows link to their own rebuilt editors, so a student in a class
roster opens that student. A column headed `th.AR` keeps the app's right alignment. Panels that
say `No skills.` keep that sentence instead of rendering an empty table.

The first tab is the record itself and stays the form editor; the rest are read-only, because
anything that *changes* them (`Add student`, `Tags`, `Add skill`) is a JS control with no URL.
Those are shown as dashed buttons and the panel says so: changes go through **Full page**. Faking
them would mean a control that looks live and does nothing.

Two markup details the reader exists to survive, both found on the live pages:

- The **selected** tab is `class="selectedTab"` with no `tab` class. A `.tab`-only selector drops
  it, which shifts every label up one place: the Overview form appears under the Enrollment
  label and the real Enrollment tab cannot be opened. Tabs are read as the strip's own children,
  with `.tab` / `.tabButton` / `.selectedTab` as the fallback.
- Panels do not nest one level: the family's Students roster sits two divs and a `MultiTable`
  spacer deep. Tables are found anywhere in the panel (skipping tables nested in another
  table's cell), and each keeps the section label above it.

### The record's own buttons

A rebuilt editor started with Reset / Save / Full page — which meant a student page could be
edited but not printed, mailed, deleted, or walked to its family, because those controls live
in the app's bar underneath the overlay. They are back, read from the same response:

```html
<div class="ButtonBar">
  <a id="new"     href="admin.sd?page=NewStudent">New</a>
  <a id="save"    onclick="StudioDir.onSubmit('SaveStudent');">Save</a>
  <a id="print"   href="admin.sd?page=PrintStudent&amp;sident=1784123965316">Print</a>
  <a id="email"   href="admin.sd?page=EmailStudent&amp;sident=1784123965316">Email</a>
  <a id="delete"  onclick="StudioDir.onSubmit('DelStudent');">Delete</a>
  <a id="editfamily" href="admin.sd?page=EditFamily&amp;fident=1784123965271">Edit Family</a>
  <div id="menuBtn" class="menuButton"><a class="menuLink">More</a><div class="menu">…</div></div>
</div>
```

[`src/lib/bar.js`](../src/lib/bar.js) reads the bar's own anchors in page order — New, Print, Email,
Clone on a class, Delete, Edit Family — and the More menu's items, without a per-type table. The
differences between record types are in the page, so the same reader covers a family, a student,
an instructor and a class.

There are two kinds of control, and they want opposite handling. **An href is a page the app
renders**, so it becomes an ordinary link: `PrintStudent&sident=…` already carries the record id,
which is the app's to build. **No href is the app's own script**, so the button is pressed on the
live page — the same `clickActionInApp` the table screens use. Delete therefore runs
`StudioDir.onSubmit('DelStudent')` in the app, with its own confirmation, instead of a rebuilt
delete whose consequences nobody has documented.

Delete asks first (`Delete?`), and any control that would drop unsaved edits asks before it goes.
If the app's element cannot be found on the live page, the button is disabled with the reason in
its tooltip — a control that silently does nothing is worse than one that says why.

**Save stays out of the bar.** There is one Save, the editor's own: it writes only the changed
fields and clicks the app's `a#save`. A second Save copied from the bar would submit every field
in the form, including the ones the editor never showed.

### Reports

The crawl found 66 of them, and they are one shape, so one adapter serves all of them:

```html
<table class="Form"><tr><td>Season</td><td><select id="classes_season">…</select></td></tr> …</table>
<a id="runreport" href="#">Run Report</a>
<table class="ReportTable"><tr><th>Class</th><th>Day</th>…</tr><tr>…</tr></table>
```

[`src/lib/report.js`](../src/lib/report.js) reads the filters with the record editor's own field
reader — the rows are the same shape — then a run control (`#runreport`, or a button whose label
reads *Run Report* / *Generate*), then any `table.ReportTable` output.

Running does not reimplement the app's request. The changed filters are written into the app's
**live** controls, their `input`/`change` events fired, and the app's own run control is clicked —
exactly the Save contract described above. Two consequences worth stating:

- Untouched filters still run. Every other action here refuses to submit nothing; a report with
  its defaults is the most common way to use one.
- A page that has already run (`.ReportName` plus a filled `ReportTable`) renders as a results
  page: rows, links to the records they name, no run button, because there is none on the page.

A settings form is not a report: `ManageHolidays` has a `Save Changes` link and no run control,
so it becomes a task (below) rather than growing a Run Report button it does not have.

### Forms with the app's own control

The crawl found 47 screens that are a form and whose submit control is not Save: **compose a
message to a group** (`EmailToGroupForm`), **select the classes to mail** (`EmailClasses`), **print
statements** (`StatementForm`), the letter templates, `AddMultipleCharges`. They share the editor's
shape — a `table.Form`/`table.FormEx` of labelled rows — and differ only in what the button says:
`Compose Email`, `Select by Filter`, `Print letters`, `Next`.

[`src/lib/task.js`](../src/lib/task.js) reads the fields with the editor's own field reader and then
**offers the page's own controls** instead of inventing one. Pressing a button writes the edited
fields into the app's live inputs, fires `input`/`change`, and clicks the app's element — the same
contract as Save and Run Report, so validation and any follow-on step stay the app's business.

Two rules keep it from pressing the wrong thing. A control is found by id first (`#composeemail`,
`#save`, `#next`); without an id, only a label that appears **exactly once** on the page may be
pressed. `Attendance` has five `Cancel Class` links, one per class date, and none of them is
pressable — the view says so and points at the full page.

A form with no control of its own at all (`ManageHolidays` outside the top bar's Save) is not a
task: it yields nothing and stays with the app.

### Table screens

About 120 screens are a table and nothing else that matters: the **Home** schedule, `Trends`,
`Alerts` (1,142 rows), `ManageSizes`, `ManageVendors`, `CopyClasses`, `PrintClassRoster`, and every
`Print*` sheet.

[`src/lib/sheet.js`](../src/lib/sheet.js) reads every table in the content that is really data — not
`TimeBlock` (the week view owns that), not `table.Form`/`TableEx` (a form is not a table of
records), not the `Layout` table that wraps whole pages — and keeps the app's own column headings
and cell links. The view is **read-only**: a filter across every table at once, the tables, and
the page's controls where they can be pressed safely. It prints: `@media print` drops the rail,
the header and the footer, and there is a `Print this view` button when the page has no print
control of its own.

The row cap is 300 (`readTable`), and a page that had 1,142 rows says `showing 300`. A page with
fewer than two data rows is not a table screen — the tile index covers those.

Two things a live dump of `PrintClassRoster` settled:

- **A print window has no shell.** No `form#idForm`, no `#sideNavBar`, no `.topBarContainer`, no
  `#mainContent` — just `.formTitle`, the table and the browser extensions' own roots. The old
  `!hasShell` branch covered that page with "No view for this page yet", which is the worst
  possible answer for a print popup. It is now read as a sheet, with the rail gone (the grid's
  first column is `auto`, so an empty rail collapses).
- **A table can have two heading rows.** `table.AttendanceRoster` prints a one-cell title
  ("Current Class Roster") and *then* its ten columns, four of them `th.dateHeader`. Taking the
  first heading row printed one heading over ten cells. The widest heading row is now the
  columns and the single-cell ones become a caption above the table.

Together with the task adapter this is why `HomePage` and `Alerts` no longer fall back to the app:
the schedule and the alert list are read as tables instead of being refused as menus.

### Toggle settings

About 45 screens are one control and a button: **SetPerforming** (a select and an OK),
**SearchDisplayFormat** (two selects), **ManageFamilyStudentMax** (two numbers), **ConfigureCalendar**
(a radio pair), **PortalAccess** (eleven selects). The crawl shows what they are *not*: no
`table.Form` to read, and often no table at all — the controls sit in plain blocks.

[`src/lib/settings.js`](../src/lib/settings.js) therefore reads the controls themselves, and finds each
one's label the way a reader of the page does:

| Where the label comes from | Source |
|---|---|
| `<label for="…">` | `label` |
| the cell before it in a table row | `cell` |
| `aria-label` / `title` | `title` |
| the block before it (`<div>Format</div><select>`) | `block` |
| its own id or name, humanised (`legacy_header` → “Legacy header”) | `name` |

A row whose label is the last kind carries a small **“from field name”** note *under* it: that label
is a guess at the app's wording, not the app's wording, and it should look like one. The note sits
on its own line, because a chip beside the name read as a second label — on the enroll screen,
which has no labels at all, every row looked like it had two. The footer still counts them.

**Every control on the page is offered, not just one Save.** Some of these screens are not “flip a
setting and save”: the enroll step is two date pickers and the app's own **Enroll** and **Cancel**.
Showing a single Save button left that screen with no way forward — the date pickers appeared and
the buttons did not. Each button now presses its own control on the live page, and when the page
has buttons of its own the top bar's generic `#save` is *not* offered beside them, so there is
never a “Save” where the app wanted “Enroll”.

One more thing these screens taught: **not every button is an anchor with an href.**
[`actions.js`](../src/lib/actions.js) now accepts an anchor with no href at all (the bar's Save and
Delete are exactly that), a `div`/`span`/`li` carrying an `onclick`, and the app's own `.Btn` /
`.BtnOutln` classes — while refusing tabs, password-eye icons and menu toggles, which carry an
`onclick` but are parts of a screen rather than its controls. A wrapper that only carries the
handler for a real control inside it is not counted twice.

Three rules keep this adapter honest:

- **Radios are one setting, not several.** `admincal` is a choice between two, so it becomes one row
  with two options — and its label is the block *around* the choices (“Calendar style”), never the
  first choice's own words (“Admin calendar”). Writing it checks one radio in the live set.
- **A headed table with rows is a sheet, not a card.** That is what stops this adapter taking over
  `ManageSizes`; a *heading-less* two-column table is a form laid out as a table, which several of
  these pages use, and it stays with the settings.
- **Nothing to save, no screen.** The adapter yields nothing unless the page has a control to press
  or the top bar's `#save`. `ManagePortal`'s lone select therefore stays with the app instead of
  becoming an un-saveable card.
- **Two controls side by side do not name each other.** A control is never used as the label for
  the control after it, and the page's title and button rows are never labels either. Without that,
  the second date picker on the enroll step was labelled with the first one's *selected option*.
  And pressing a control never finds this UI's own twin: `#sd-root` is excluded from every lookup,
  because the card has an “Enroll” button too and the app's is the one that must run.

An empty select is not offered: `SplitPerformances` fills its events list in with the app's own JS.

### Landing pages

Five rail destinations are menus, not screens: **Charges & Payments**, **Communications**,
**Advanced Search**, **Reports** and **Settings**. The crawl shows the shape plainly — zero
tables, zero form rows, and 20 to 60 links that all lead somewhere real.

[`src/lib/index-page.js`](../src/lib/index-page.js) collects the links inside the content, drops
the rail, the top bar and the breadcrumb, and groups what is left by the nearest heading above it
(`Charges`, `Payments`, `Settings`). The view is a filtered grid of tiles: type `charge` and the
menu narrows across every group at once, which is the thing a wall of blue text cannot do.

A page that shows data is not a menu. The rule is a row count — two or more table rows anywhere
in the content means the page has something to say, and it becomes a **table screen** instead. That
is what keeps the Home schedule (a table under JS tabs) and `Alerts` out of the index.

A menu has tens of links; a picker has thousands. `Enroll(cident)` is **4,271** — every student in
the school, one link each — and `EnrollmentSearch` is 501. The crawl settles what those are: the
links are in the HTML, server-rendered, so nothing is gained by reading the live page instead.

They are not refused any more either. The page is read whole and the view draws **300 tiles at a
 time**, saying so (`Showing 300 of 421 links — type a few letters to narrow`); the filter still
searches every one, so a student at position 3,000 is one keystroke away rather than unreachable.
That is the difference between a cap on reading and a cap on drawing.

### Notices

68 screens are, by the crawl's reading, a step rather than a form: a sentence saying what to do
next, and the app's own button. `AddMultiplePayments` is the shape of the whole bucket — a
breadcrumb, a title, a `contentInfo` block and one control, with no table and no field to edit. Before
[`src/lib/note.js`](../src/lib/note.js) every one of them landed on "no view for this page yet", which
is the worst answer for a screen that is one press away from working.

The reader is deliberately the last one tried, and it refuses anything another reader should own:
any `input`/`select`/`textarea` (a form), two or more data rows (a table), or six or more links (a
menu). Those three refusals are exported as `contradictsNote()`, because they answer a second
question too.

**A note is checked against the live page before it is trusted.** The reader only wins on pages the
server sends nearly empty — which is exactly the set of pages the app fills in after load. So
before mounting a note, [`main.js`](../src/main.js) asks `contradictsNote(document)` of the live page.
If the browser is showing more than a notice can hold, the router is re-run against what is
actually there and the live view wins. Measured on the real site, `ChargesHome` produced a notice
from its fetched copy and an 18-link index from the live one; `Unenroll` fetched with no readable
view at all and turned out to carry five form controls, so the app keeps that page. If the live page contradicts the note and no reader claims
it, the app keeps its own page and the console says
`[sd] note contradicted by the live page - leaving the app alone` — a wrong notice over a working
form is worse than no overlay at all.

The 50 genuine notices pay nothing for that check: it is a synchronous count of what is already on
the page, and it only triggers a live re-read when the counts disagree.

### When a record page gets the editor, and when it does not

A record editor is a form **plus a way to save it**. The app keeps Save in the top bar (`a#save`),
which the crawl does not read — it starts at the content root — so the rule is:

- form readable **and** `#save` present **or** the page has tabs → **the editor**;
- form readable, no save, but it has its own control → **a task** (or a sheet, if it has tables);
- nothing readable → **the app**, untouched: no overlay, no styles.

**The page router gets the last word.** Once the editor, task, sheet and settings readers all
decline, the page is routed normally — because a page can carry a record parameter and still be
something else: `Enroll(sident)` and `SwitchClasses` are the **week calendar**, `EnrollmentSearch`
is a **record list**, `EmailTextHome(meth)` is a **menu**. Before this, all three fell back to the
app for no better reason than having `?sident=` in their URL.

A dump of the real `EditStudent` confirms the check: `a#save` sits in `div.ButtonBar` beside
`a#new`, `a#print`, `a#email` and `a#delete`, with `onclick="StudioDir.onSubmit('SaveStudent')"`
and no href, which is exactly what `save.js` clicks.

That is what keeps `Attendance(cident)` (121 controls) and `PrintClassRoster` (40) out of
the editor. It also fixed a latent bug: a record page reached without `page=Edit…` in the URL — the
URL the app leaves behind after a refused save — used to be read through the page router, and the
Calendar tab's seven `TimeBlock` tables turned it into the week calendar. `readWeek` now ignores
tables inside a `.tabContent`, and `mountLive` checks for a record form first.

A page counts as a record page when its URL carries any query parameter beyond `page`,
`clicktab` and `filter`, or when its page name starts with `Edit`:

- `?page=EditClass&cident=1782910697458` — the calendar's own link, verbatim from the dump
- `?page=EditFamily&fident=4401&searchidx=2` — a family record
- `?page=NewClass&cident=101` — a `New` page opened on an existing record

## Install

```bash
cd web
npm install
npm run userscript     # writes ../studio-director-rebuilt.user.js
```

Then add `studio-director-rebuilt.user.js` to Tampermonkey/Violentmonkey as a new script.
It matches `https://app.thestudiodirector.com/*/*`, so it works for any tenant.

## Testing on the real site

### 0. Optional: check the fetch fallback (no install)

Reading happens on the live page first now, so most screens cost no request at all. The `GET` is
the fallback for pages the app draws after load, and it is still worth knowing it carries your
session: a shell page that answers with the sign-in screen has nothing to fall back on. Sign in,
open the class calendar, and paste this into the DevTools console.

```js
fetch(location.href, { credentials: 'same-origin' })
  .then((r) => r.text().then((t) => ({ status: r.status, url: r.url, bytes: t.length, html: t })))
  .then(({ status, url, bytes, html }) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    console.log({ status, url, bytes,
      blockTables: d.querySelectorAll('table.TimeBlock').length,
      records: d.querySelectorAll('.searchResultItem').length,
      login: !!d.querySelector('.LoginContainer') });
  });
```

Expected on the calendar: `blockTables: 7`, `records: 0`, `login: false`, same URL. On
Classes/Families/Students: `records` in the hundreds. If `login` comes back `true` the fetch is
not carrying your session and the app will fall back to the original page — stop there and tell
me, because everything downstream depends on it.

### 1. Install

- Tampermonkey dashboard → **+** (new script) → select all → paste the contents of
  `studio-director-rebuilt.user.js` → **Ctrl/Cmd + S**.
- Confirm the dashboard lists it as enabled with match `https://app.thestudiodirector.com/*/*`.
- Disable `studio-director-skin.user.js` while testing. Two scripts that both read the page
  will fight over it.

### 2. Load the four screens

| URL | Expect |
|---|---|
| `admin.sd?page=CalendarPage` | One section per day, in the app's order. Inside each: hours down the left edge and four studio columns left to right, with every class a block as tall as its duration, in the app's colour. Footer like `42 classes · 87 spots open · 9 waitlisted`. Hover a block: the full tooltip. |
| `admin.sd?page=NewClass` | Side panel becomes the list: heading `Classes`, filter box, `N of N`, rows opening the class editor. |
| `admin.sd?page=NewFamily` | Same, heading `Families`. |
| `admin.sd?page=NewStudent` | Same, heading `Students`. |
| Any record: `?page=EditClass&cident=…`, `?page=EditFamily&fident=…`, `?page=EditStudent&sident=…` | Rebuilt editor: the record list on the left (when the page has one, current row highlighted), labels and values on the right, `N fields` in the footer. A class shows 17+ fields; a family 22; a student 15. |

On all four list/calendar screens: the rail on the left has **11** entries and they navigate;
the app's own form is hidden but still in the DOM; **Esc** or **Original** restores it exactly
as it was.

### 3. What to check, in order

1. **Does the rebuilt view appear at all?** If you see "Not rebuilt yet", the fetched HTML
did not contain `table.TimeBlock` or `.searchResultItem` — step 0 tells you which.
2. **Does the rail match the app's?** Labels appear once (the app prints each twice), and
clicking one loads that page rebuilt.3. **Do the numbers match the app?** Compare seat counts and the week total against the
   original page (press Esc). A mismatch means the tooltip text changed format.
4. **Does the editor open?** Click a list row or a calendar card. You should get the rebuilt
   editor for that record, filled in. If you get the app's own page instead, the form was not
   recognised — that is the safe fallback, and the URL is what I need to see.
5. **Does a save actually save?** Yes — verified once on a test record, and the mechanism is
   known (see *The save handler, verified* below). Change one harmless field, press **Save**,
   reload and confirm it stuck; that is a re-check after an app update, not an open question.

### 4. If something is wrong

Open the console: the script announces itself with `[sd]` prefixed messages and never throws
silently.

```js
// did the app mount, and what did it take the page to be?
document.getElementById('sd-root')?.innerText.slice(0, 200);
```

`SD` itself is not reachable from a console: the bundle is function-scoped inside the userscript
wrapper, so `SD.probeDump()` is not a thing. The probe publishes its own handle instead, and only
while armed. Visit a page with `?sdprobe=1` appended (the flag sticks for the session, and
`?sdprobe=0` clears it), reload, then:

```js
sdProbe.log();    // every screen seen: counts, the view mounted, and its source
sdProbe.dump();   // the same as JSON, ready to paste
sdProbe.clear();  // forget it
```

Each entry carries `source`: `live` (read where it stood, no request), `fetched` (one `GET`), or
`app` (declined to cover it). That column is the quickest way to tell me which screens are not
being claimed.

To inspect the page the script *fetched* rather than the one you see, suffix the URL with
`#original`: that tears the overlay down and leaves the app's own markup. The most useful
report back to me is the exact page name plus what the rebuilt view said versus what the
original showed.

### 5. Turning it off

Disable it in the Tampermonkey dashboard, or add `#original` to any URL. Nothing was written
to the app, so there is nothing to clean up.

## Safety

- **The app posts, not this script.** Reading is either the live page or a plain same-origin
  `GET`. Saving writes the changed values into the app's own form and clicks the app's own Save
  link; no POST body, no method name and no token is ever constructed here.
- **Only changed fields are touched.** Everything else keeps the value the server sent.
- **At most one same-origin GET per page view**, with `credentials: 'same-origin'`, and none at
  all on a page the live read already answers. Nothing is sent anywhere else, and no cookie or
  credential is read, stored or logged.
- **The sign-in page is never replaced** — that is where the session is created.
- **Esc** (or the **Original** button, or `#original`) returns the app's own page, form intact,
  and discards anything unsaved.

## Verify

```bash
cd web
npm test          # adapters, routing, rail, editors, saving, forms, tables, toggles — 14 suites, 160 assertions
npm run golden    # the 20 recorded screens, model for model
npm run demo      # demo/*.html — self-contained pages, plus live-*.html
```

- `demo/week.html`, `demo/classes.html`, `demo/families.html`, `demo/students.html` —
  each fixture inlined as inert text and rendered by the built bundle. Open from disk.
- `demo/live-*.html` — the fixture served as a real page with the userscript attached, so
  the whole path (GET → parse → cover) runs exactly as it does in production. These need
  `studio-director-rebuilt.user.js` next to them:

  ```bash
  node tools/serve.mjs .. 4800
  ```

## Capturing a new dump

The structure dumps this project is built from are produced by
[`tools/diagnose-page.js`](../tools/diagnose-page.js). Paste the whole file into the browser
console on any `.sd` page and copy the single string it prints. It reports structure only —
tags, ids, classes, headings, row counts, control names — and never reads cell text, so no
names, balances, dates of birth or emails can end up in it.

That is how to answer questions like "what does the family record page actually look like"
without sending anyone a screenshot of client data.

### Dumping one specific page (e.g. `EditStudent` or `PrintClassRoster`)

1. Sign in and open the page itself, not a list: `?page=EditStudent&sident=…` from a student's
   link, `?page=PrintClassRoster&cident=…` from a class's Print menu.
2. Open DevTools → Console. If the userscript is installed, press **Esc** or click **Original**
   first, so the dump describes the app's page and not the rebuilt one.
3. Paste all of [`tools/diagnose-page.js`](../tools/diagnose-page.js) and press Enter.
4. Run `sdDumpSave()`. It downloads `dump-EditStudent.txt` (or `dump-PrintClassRoster.txt`).

What to look for in the file:

```
--- page controls (outside data tables) ---
has #save: yes
  a#save  id=save  href=#  onclick=-  text="Save"
  a  id=-  href=#  onclick=window.print();return false;  text="Print"
```

That block was added for exactly these two questions. `has #save` says whether the page is an
editor at all, and the control list gives each button's id, href, `onclick` and label — the three
things the app's own submit controls need in order to be pressed from the rebuilt view. `table …`
sections above it give the columns, and `--- tabs ---` gives the panels.

A dump is only needed when a page's shape is unknown. `EditStudent` and `PrintClassRoster` are both
covered now (`PrintClassRoster` as a table screen), so this is for the 2 screens still falling
back to the app.

### Mapping the whole app at once

One page at a time does not scale to a site with subpages, print screens and costume
management. [`tools/scrape-all.js`](../tools/scrape-all.js) does the whole walk: paste it into
the console on any `.sd` page, then run

```js
await sdCrawl()              // walks up to 400 page shapes
await sdCrawl()              // continues where it stopped; nothing is fetched twice
sdCrawlStop()                // stops after the current request, keeping the queue
sdCrawlSave()                // downloads the result so far
sdCrawl({ fresh: true })     // forget the map and start over
```

The crawl keeps its queue, its visited shapes and its results in memory, so a run that
reaches the cap (or that you stop) is resumable rather than something to redo. The file says
what it does not cover: `stoppedEarly`, `remaining`, and a `pending` array of the shapes still
to visit. `sdCrawlReset()` clears it by hand.

It starts at the page you are on, follows the rail, the top bar, every link and action button
inside the content, and follows those pages in turn. Three rules keep it honest and small:

- **One request per page *shape*.** `EditClass&cident=101` and `EditClass&cident=102` are the
  same screen with a different record, so only the first is fetched. A whole-site crawl is
  tens of requests, not thousands. `searchidx`, `clicktab`, `filter` and `searchText` are
  ignored when comparing, so the tab you arrived from does not fork the crawl.
- **Subpages are recorded even when hidden.** The record pages ship their tab panels
  (Overview, Enrollment, Skills, Calendar) in the HTML with `display:none`, so one fetch is
  enough to see what each one contains: its tables, its column headings and how many controls
  it has. Panels that only appear after a click are named under `actions` with `js: true`.
- **Nothing destructive is ever requested.** A link whose page name contains an action verb
  (`Delete`, `Remove`, `Send`, `ProcessPayment`, …) is written into `skipped` with its label and
  URL, and never fetched. Getting this wrong would delete a family or email a class, so it is
  also the one rule with a test of its own. Compose and landing screens (`EmailClass`,
  `ChargesHome`) are plain GETs and *are* crawled.

Like the single-page dump it reads structure only: table headings are the app's own column
labels and are kept; the text inside cells, panels and form fields is never read. The output is
one entry per screen, with `kind` (`week`, `list`, `record+list`, `record`, `report`, `form`,
`page`), tables and their headings, controls, tabs, panels, actions and outgoing link shapes —
enough to design a rebuilt screen for each one.

[`tools/crawl-report.mjs`](../tools/crawl-report.mjs) turns that file into a map: coverage, the
remainder grouped by the adapter that would cover it, and every screen per module.

```bash
npm run map      # writes docs/crawl-map.md from data/pages.json
```

## What the dumps do not tell us

### The record list is one window, not the whole set

The side panel arrives with **500 rows** and its heading says how many exist in total
(`4291 Items`). There is no pager: the probe found 0 anchors in the panel and a plain
`Show All` control at its end. So the rebuilt list shows `N of 4291`, and when the page admits
there are more it **loads the rest by itself on open** — no button to press. The button remains
as a retry if the widening fails.

That automatic widening happens on the list pages only. The panel beside an editor does not
auto-expand: pressing the app's `Show All` behind a live form could re-render what you are
typing into, so there it waits for a click.

That button does not build a URL. It presses the app's own `Show All` on the live page, waits
for the panel's row count to stop growing, then re-reads the page — whatever the app does behind
that control (fetch, re-render, navigate) is what happens, and the overlay re-renders with the
fuller list. Filtering then searches every row that arrived. On a page whose panel has no such
control the button is not offered at all, and the note says so instead of failing after a click.

A bare `.click()` proved not to be enough on the live page, so pressing is a short ladder:
jQuery's `trigger` (the app ships jQuery), then a native click, then a full pointer/mouse
sequence — on the label, the link around it and the link inside it. Each rung gets 1.5 s to show
growth. If a rung makes the app *request* something, the ladder stops there and gives it the full
20 s window rather than firing a second request for the same rows. While all this runs, XHR and
`fetch` URLs are recorded; if the list never grows, the note names the request instead of just
resetting the button.

`sdPanel()` in [`tools/diagnose-page.js`](../tools/diagnose-page.js) is how that was established:
it prints the panel's pager anchors, the filter's attributes and the page's script URLs, with
every record label skipped.

### What the class editor does not cover

Three things on `EditClass` sit outside the form table and are therefore not rebuilt:

- **The hidden registration tables** (`#weeklyregtable`, `#dsregtable`) — two controls each, so
  they fall below the four-field floor and stay exactly as the app rendered them.

(The weekday checkboxes *are* rebuilt: they sit in the Day row as `#day__1` … `#day__64`, the
bitmask is labelled `Sun` … `Sat` with 1 = Sunday, and a save writes the same control ids.)
- **The date picker** (`#dates__select`), which has no options until the app's own JS fills it,
  so it is not offered as a field.

The dump also listed only 20 of the page's 40 controls (`… 15 more`). Nothing depends on that
tail: the adapter reads whatever rows the form has, and the fixture covers the controls that
were named.

### What the crawl could not see, measured

[`pages.json`](../data/pages.json) was re-crawled on 2026-10-31 with the
fixed capture: **447 screens, 0 errors, queue drained.** Every root destination, every
`Manage*` screen, every print form and every settings page is in it — but a GET cannot see three
things, and the map now says which:

1. **Controls with no href** — 110 screens carry **157** controls the earlier crawler never recorded,
   because it read `a[href]` and these are `<a id="save" onclick="StudioDir.onSubmit('SaveStudent')">`
   with no href at all: **98 × `#save`**, **25 × `#delete`**, plus `Go back`, `Check All` / `Uncheck All`,
   `Copy`, `Close Search Results`, `#archive` and `#reassignlabel`. Save was therefore absent from
   every crawl before this one, which is exactly the control an editor reader depends on.
2. **Controls that are not anchors** — 12 controls on 4 screens, all `span.link` phone-label editors
   on `EditFamily` (`Mom Cell`, `Dad Cell`, `Home Phone`).
3. **Screens the server sends empty** — **61 of the 447**: a form, **zero** controls, zero rows and
   a handful of links, with the app drawing the real contents afterwards. `Enroll(cident,sident)` —
   the enroll step — is one, and so are `DelStudent`, `UnenrollAll`, `PrintStudent`,
   `AddStudentMakeup`, `ManageClassPasswords`, `IncreaseRatesWizard` and `SizeCostumes`. Nothing
   fixes this from the HTML: those controls do not exist until the app's JS makes them.

   All 61 have since been opened in a browser and measured, one page load at a time, and the
   results are in [`docs/live-sample.json`](live-sample.json): **50 really are notices** and
   **11 are not**. Eight carry seven or more links and are menus in disguise (`ChargesHome` has
   18, `MergeFamily` 9), and three carry form controls (`Unenroll` has five). That measurement is
   what the notice section below is built to survive.

Six shapes in the older file did not reappear this run — `DelStudent(sident)`,
`DelStudent(confirm,sident)`, and four `ManageStudentWaiver` / `StudentWaivers` shapes — because
they are reached from a *record's* row links and the crawl visits one record per shape. One new
shape did: `ManageInventoryItems(meth,methargs)`. Nothing errored; those six are simply queued
their next run.

The same blind spot hid a second kind of problem, which the crawl *can* now see: six screens that
route to the settings card and carry more than one control of their own — `ManageCheckoutEmail`,
`UploadFamilyStudentPic(fident,type)`, `AdminBanner(meth)`, `ManageStudentWaiver` (both shapes) and
`ViewAccept(meth,methargs)`. Before this fix each showed exactly one button; now they show every
control the page has.

### The save handler, verified

No dump can show JavaScript, so this was the one link only the real site could settle. It is
settled. On 2026-10-31 a write through this editor's own path — the value put into `#comments`,
`input` and `change` fired, `a#save` clicked — was submitted by the app and persisted across the
reload. Running it a second time reported the field as already holding the first run's value.

One caveat, because it is the difference between evidence and impression: that second read only
proves persistence if the record was **reopened** — reloaded, or opened again from the list.
Reaching it with the browser's **Back** button can restore the page from its own cache with the
old value still in the input, which says nothing about the server. So persistence is confirmed
to the extent that a hard reload still shows the value; the transport conclusion below does not
depend on it at all.

It also settled the mechanism: **Save is a full-page form POST, not an XHR.** The browser
serialised the live controls itself and navigated to “… has been updated”. That is why the write
works — the browser reads the control at submit time, so the `input`/`change` events exist for the
app's own masks and dirty tracking, not for the payload. **No event ladder is needed for a record
save**, which was the fallback plan if this had failed.

Still untested, and worth the same treatment if one of them ever misbehaves: **Run Report**, a
task's own control (`Compose Email`, `Next`), and a settings-screen Save. Those share the same
write-then-click contract but not necessarily the same transport.

[`tools/save-check.js`](../tools/save-check.js) asks that question directly rather than by
impression. Paste it into the console on a record page with the overlay off (press **Esc**), then:

```js
sdSaveFields()                    // which free-text fields are safe to try
sdSaveCheck('notes', 'sd-check-1')// writes it exactly as save.js does, then clicks Save
sdSaveResult()                    // after the reload: what the app itself sent
sdSaveRevert()                    // put the old value back
```

It patches `XMLHttpRequest`, `fetch` **and** form submission before the click, then reports the body
the app builds. A save that ends in a full-page “… has been updated” is a document POST rather
than an XHR; that case is captured as `POST(form, …)` and is the strongest evidence of the three,
because the body is the one the browser serialised from the live DOM. If the body carries the
value, the app read the control and saving works. If there is a body without it, the app
serialises its own copy of the record and `save.js` needs more events (`keyup`, `blur`, jQuery
`.trigger`) — the same ladder `expand.js` uses for its press. Either answer is evidence; neither
can be reached from the server side.

The log lives in `sessionStorage`, so it survives the reload a save causes: re-paste the script on
the confirmation page and `sdSaveResult()` still reads it. `sdSaveRevert()` has to run on the
record page itself, where the field and `#save` both exist.

### Nothing about the rest of the record


The structure dumps carry tags, classes and form control ids — no text, no attributes. So two
things are still unverified, and both are passed through rather than interpreted:

- **Record link hrefs.** The item `<a>` is shown with whatever `href` the page gave it, so the
  id parameter (`cident`, `fident`, `sid`) never has to be known by this app. It only has to
  survive being rendered.
- **Item label text.** Shown verbatim. If a family row reads "Lovelace — Dana", it reads the
  same here; nothing is split, reordered or reformatted.

The rail is built from `#sideNavBar a.sideNavLink` on whichever page loaded, so it always
reflects the app's own navigation (11 entries today).
