# Studio Director — screen map

Generated from `studio-director-pages.json` — **447 screens** crawled on 2026-10-31, 0 links deliberately not followed, 0 errors.

**96 links the safety rule flagged were followed on purpose** - see the
section at the end of this map for what they are and why they were safe.

**Complete:** the queue was drained, so every page the app links to is in here.

## Coverage

| Rebuilt view | Screens |
|---|---|
| Week calendar | 10 |
| Record lists (Classes, Families, Students, Instructors) | 8 |
| Record editors, with their tabs | 63 |
| Reports (filters + Run Report) | 66 |
| Forms with the app's own control (settings, letters, mail) | 28 |
| Table screens (dashboards, settings lists, print sheets) | 90 |
| Landing pages (tile index) | 33 |
| Toggle settings (a control and a Save) | 79 |
| Notices (a sentence and the app's own button) | 68 |
| Not rebuilt — falls back to the app | 2 |
| **Total** | **447** |

Coverage is predicted from the routing rules in `src/lib/page.js`, so a page listed as
covered is one this build takes over. `Not rebuilt` is the honest remainder.

The notice row is the least certain of them, because the app fills these pages in after the
HTML arrives. All 61 of these shapes have now been opened in a browser and measured (see
`docs/live-sample.json`): 50 really are notices and 11 are not. Five of those eleven were
then walked live and mounted as an index: `ChargesHome` (18 links) and `ManageWidgets` (8)
from the live document, `MergeFamily` (9), `EmailFamily` (8) and
`ManagePaymentMethods_studio` (7) from a fetched copy. The other six left the app its own
page, which is the safe answer rather than a wrong one. `PrintClass` and `PrintFamily` are
pickers of three and five list items, and since 0.17.0 the index reader takes a short menu when
every link is alone in its own list item; both now mount as tiles. `PreapproveStudents` keeps
three links that share a paragraph, which is a notice’s shape, so it stays with the app, as do
`EmailClass` and `SendEmail` (pickers with no list shape). `Unenroll` is a confirmation, and since
0.18.0 it renders as the ask-before-doing card with the app’s own Continue button. Two
of the `AddStudentMakeup` shapes redirect to the `tidExpired` notice rather than
drawing their own screen.

So the honest reading of the notice row is 50 confirmed notices, not 68: the 18-point gap is
the cost of classifying from fetched HTML alone. The table above still reflects the crawl,
because that is what the crawler could see; the measured numbers are here.
Probe mode (`?sdprobe=1`) records what a screen really contained.

## What is left, by shape

| Shape of the remainder | Screens | Examples |
|---|---|---|
| A couple of controls, no rows | 2 | `GetOnlineRegUrl`, `ManageFamilyNotes(fident,meth)` |

That ordering is the work order: one adapter per row covers every screen in it.

## Blind spots

A crawl is a GET: it never runs the app's JavaScript. Two kinds of screen therefore need
reading twice — once from the HTML, once from the page as drawn.

### Screens with no controls in the HTML — 79

A form, zero controls, zero rows — but these are not blank pages. Measured live, the HTML of
this bucket carried 0.7–1.8 kB of content in its content container; what it lacks is controls.
Most are notices, whose text and buttons the notice reader already handles. A minority have
their form drawn by the app after load, and only a rendered page shows which is which.

| Page | Title | Links |
|---|---|---|
| `AddChargeByTag` | Add Charge By Tag | 6 |
| `AddMultiplePayments` | Add Multiple Payments | 3 |
| `AddMultiplePaymentsForFamily` | Add Multiple Payments For Family | 3 |
| `AddStudentMakeup(cident,meth,tid)` | Schedule Make-up | 9 |
| `AddStudentMakeup(meth,methargs,tid)` | Schedule Make-up | 6 |
| `AddStudentMakeup(meth,start,tid)` | Schedule Make-up | 10 |
| `AddStudentMakeup(sident)` | Schedule Make-up | 2 |
| `AdvSearch` | Advanced Search | 6 |
| `CancelClasses` | Cancel Classes | 3 |
| `ChargesHome` | Charges & Payments | 18 |
| `CheckinNotConfigured` | Checkin Not Configured | 1 |
| `ClassScheduleForm` | Class Schedule | 4 |
| `DeleteExpiredCards` | Delete Expired Cards | 3 |
| `DeleteExpiredCards(meth)` | Delete Expired Cards | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `DisplayMessage(meth)` | — | 1 |
| `EmailClass(cident)` | Email Class | 5 |
| `EmailFamily(fident)` | Email Family | 8 |
| `EmailStudent(sident)` | Email Student | 4 |
| `Enroll(cident,sident)` | Enroll Student | 4 |
| `EPSManagePayInfo(fident,meth,returntid)` | Payment Info | 1 |
| `IncreaseRatesWizard` | Increase Rates Wizard | 4 |
| `InputPaymentMethod_studio(studioId)` | Input Payment Method_studio | 1 |
| `LedgerPaymentReceiptPage(meth,xident)` | Ledger Payment Receipt Page | 6 |
| `ManageClassPasswords` | Manage Class Passwords | 3 |
| `ManageEmailTemplates(meth,methargs)` | Email Templates | 5 |
| `ManageLegalDocuments` | Manage Legal Documents | 6 |
| `ManagePaymentMethods_studio(meth,payment-method-token,studioId)` | Manage Payment Methods_studio | 3 |
| `ManagePaymentMethods_studio(studioId)` | Manage Payment Methods_studio | 7 |
| `ManagePaymentMethods(fident)` | Manage Payment-Methods | 3 |
| `ManageScheduledEmails(emailid,meth)` | Delete Scheduled Email | 4 |
| `ManageUserDocuments(meth,methargs)` | Manage User Documents | 3 |
| `ManageWidgets` | Manage Widgets | 8 |
| `ManageZapier` | Manage Zapier | 3 |
| `MergeFamily(fident)` | Merge Family | 9 |
| `NewClassTypeCharge` | New Class Type Charge | 4 |
| `NewFamilyCharge` | New Family Charge | 6 |
| `NewFamilySessionCharge(fident)` | Session Charge | 3 |
| `NewPayment(fident)` | New Payment | 4 |
| `Override(sident)` | Override | 2 |
| `PayDiffCard(fident)` | Pay Diff Card | 2 |
| `PreapproveClasses(meth,methargs)` | Preapprove Classes | 3 |
| `PreapproveStudents(meth,methargs)` | Remove Student | 7 |
| `PrintClass(cident)` | Print: 818 Ballet | 6 |
| `PrintFamily(fident)` | Print Family | 7 |
| `PrintStudent(sident)` | Print Student | 4 |
| `RemoveStudentMeasurements` | Remove Student Measurements | 3 |
| `RemoveStudentMeasurements(meth)` | Remove Student Measurements | 1 |
| `ResetAllFamilyRegisterMsgs` | Reset All Family Register Msgs | 3 |
| `ResetAllFamilyRegisterMsgs(meth)` | Reset All Family Register Msgs | 1 |
| `ResetWaiver` | Reset Waiver | 3 |
| `ResetWaiver(meth)` | Reset Waiver | 1 |
| `RestoreOldSeason(meth,methargs)` | Restore Old Season | 3 |
| `SendEmail(iident,totype)` | Email Note | 6 |
| `SetClassForCharge(cident,meth,xident)` | Set Class For Charge | 3 |
| `SetClassForCharge(meth,methargs)` | Set Class For Charge | 3 |
| `SetRedYellowGreen` | Set Red Yellow Green | 14 |
| `SizeCostumes` | Size Costumes | 5 |
| `SizeCostumes(meth)` | Size Costumes | 1 |
| `StudioDirectorBillingInfo` | Studio Director Billing Info | 3 |
| `Unenroll(cident,sident)` | Drop Student | 5 |
| `UnenrollAll(sident)` | Unenroll All | 1 |

### Controls with no href, or not an anchor at all — 140 screens

The crawler used to record `a[href], button, input[type=…]` only. The record bar's controls
are `<a id="save" onclick="StudioDir.onSubmit('SaveStudent')">` — **no href at all** — so
Save, Delete and More were invisible in every earlier crawl, and so were the phone-label
`span.link`s on a family page. This is that set, per screen.

| Page | Title | Blink controls | Element |
|---|---|---|---|
| `HomePage` | Home | (no text) | a (no href) |
| `NewClass` | New Class | #save | a (no href) |
| `NewFamily` | New Family | #save | a (no href) |
| `NewStudent` | New Student | #save | a (no href) |
| `NewInstructor` | New Instructor | #save | a (no href) |
| `EmailTextHome` | Communications | Email Note | a (no href) |
| `SetTimeBlockCalendarFilters(returnURL)` | Set Calendar Filters | Check All | a (no href) |
| `SetTimeBlockCalendarFilters(returnURL)` | Set Calendar Filters | Uncheck All | a (no href) |
| `EditClass(cident)` | Class: 818 Ballet | #save | a (no href) |
| `EditClass(cident)` | Class: 818 Ballet | #delete | a (no href) |
| `HomePage(tab)` | Home | (no text) | a (no href) |
| `EditInstructor(iident)` | Instructor: Sam Ortega | #save | a (no href) |
| `EditInstructor(iident)` | Instructor: Sam Ortega | #delete | a (no href) |
| `EditFamily(fident)` | Family: Family 23 | #save | a (no href) |
| `EditFamily(fident)` | Family: Family 23 | #delete | a (no href) |
| `EditFamily(fident)` | Family: Family 23 | Mom Cell | span.link |
| `EditFamily(fident)` | Family: Family 23 | Dad Cell | span.link |
| `EditFamily(fident)` | Family: Family 23 | Home Phone | span.link |
| `EditStudent(sident)` | Student: Student 61 | #save | a (no href) |
| `EditStudent(sident)` | Student: Student 61 | #delete | a (no href) |
| `PerformanceCharge` | Performance Charge | #save | a (no href) |
| `EventCharge` | Event Charge | #save | a (no href) |
| `CostumeDepositCharge` | Costume Deposit Charge | #save | a (no href) |
| `CostumeBalanceCharge` | Costume Balance Charge | #save | a (no href) |
| `EditEmailSignature` | Email Signature | #save | a (no href) |
| `ManageEmailTemplates` | Email Templates | #save | a (no href) |
| `CostumeVendors(meth)` | — | Copy Copied! | a (no href) |
| `NewEditArchive(content,state)` | Do NOT add a season here unless yo | #save | a (no href) |
| `ManageHolidays` | Manage Holidays | #save | a (no href) |
| `ManageSessions` | Manage Sessions | #save | a (no href) |
| `NewEditDel(content,state)` | Charge Categories | #save | a (no href) |
| `ManageClassCardTypes` | Manage Class Card Types | #save | a (no href) |
| `EnableMultiInstructor` | Multi-Instructor Support | #save | a (no href) |
| `ManageTags(state)` | Manage Tags | #save | a (no href) |
| `ManagePaymentPlans` | Manage Payment Plans | #save | a (no href) |
| `ManagePromos` | Manage Promos | #save | a (no href) |
| `ManageAbsenceOptions` | Portal Absence Reporting Options | #save | a (no href) |
| `ManageDropReasons` | Manage Drop Reasons | #save | a (no href) |
| `ManageGenderOptions` | Manage Gender Options | #save | a (no href) |
| `ManagePronounOptions` | Manage Pronoun Options | #save | a (no href) |
| `ManageSkills` | Manage Skills | #save | a (no href) |
| `ManagePhoneNumbersFormat` | Manage Phone Numbers Format | #save | a (no href) |
| `ManagePhoneLabels` | Manage Phone Labels | #save | a (no href) |
| `EditContactInfo` | Studio Contact Info | #save | a (no href) |
| `SearchDisplayFormat` | Search and Sort | #save | a (no href) |
| `LayoutOptions` | Layout Options | #save | a (no href) |
| `EditBillingGroups` | Rate Groups | #save | a (no href) |
| `ManageRegFeeRules` | Auto Registration Fee Rules | #save | a (no href) |
| `ManageFamilyDiscounts` | Manage Family Discounts | #save | a (no href) |
| `ManageTagTuition` | Manage Tag Tuition | #save | a (no href) |
| `ManageSuppliers` | Manage Suppliers | #save | a (no href) |
| `ManageInventoryColors` | Manage Inventory Colors | #save | a (no href) |
| `ManageInventorySizes` | Manage Inventory Sizes | #save | a (no href) |
| `ManageInventoryItems` | Manage Inventory Items | #save | a (no href) |
| `ManageEvents` | Manage Events | #save | a (no href) |
| `ManageVendors` | Manage Vendors | #save | a (no href) |
| `ManageSizeChartNames` | Manage Size Chart Names | #save | a (no href) |
| `ManageCatalogs` | Manage Catalogs | #save | a (no href) |
| `ManageSizes` | Manage Sizes | #save | a (no href) |
| `CostumeShipToInfo(ident,meth)` | Costume Ship To Info | #save | a (no href) |
| `ManagePortalEnrollmentInfo` | Manage Portal Enrollment Info | #save | a (no href) |
| `ManagePortal` | Manage Portal | #save | a (no href) |
| `CopyClass(cident)` | Clone Class | #save | a (no href) |
| `ClassDocuments(cident)` | Class Documents | #save | a (no href) |
| `Attendance(cident)` | Attendance | #save | a (no href) |
| `EmailHistory(addrs,iident)` | Email History | Go back | a (no href) |
| `Timesheet(iident)` | Timesheet | #save | a (no href) |
| `Timesheet(cident,iident)` | Timesheet | #save | a (no href) |
| `EmailHistory(fident)` | Email History | Go back | a (no href) |
| `FamilyDocuments(fident)` | Family Documents | #save | a (no href) |
| `NewStudent(family)` | New Student | #save | a (no href) |
| `EditFamily(fident,startrow,tab)` | Family: Family 23 | #save | a (no href) |
| `EditFamily(fident,startrow,tab)` | Family: Family 23 | #delete | a (no href) |
| `EditFamily(fident,startrow,tab)` | Family: Family 23 | Mom Cell | span.link |
| `EditFamily(fident,startrow,tab)` | Family: Family 23 | Dad Cell | span.link |
| `EditFamily(fident,startrow,tab)` | Family: Family 23 | Home Phone | span.link |
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | #save | a (no href) |
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | #delete | a (no href) |
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | Mom Cell | span.link |
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | Dad Cell | span.link |
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | Home Phone | span.link |
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | (no text) | a (no href) |
| `EditCharge(xident)` | Edit Charge | #save | a (no href) |
| `EditCharge(xident)` | Edit Charge | #delete | a (no href) |
| `Override(sident)` | Override | #save | a (no href) |
| `Measurements(meth,sident)` | Measurements, Costumes & Performan | #save | a (no href) |
| `NewClass(private)` | New Class | #save | a (no href) |
| `AddClassChargeForm(cident)` | Add Class Charge | #save | a (no href) |
| `NewClassTypeCharge(meth,methargs)` | New Class Type Charge | #save | a (no href) |
| `ManageEmailTemplates(id,meth)` | Email Templates | #save | a (no href) |
| `ManageDripCampaigns(campaign_id,meth)` | Prospects | #save | a (no href) |
| `CostumeVendors(meth,rptsort)` | — | Copy Copied! | a (no href) |
| `NewEditArchive(content,season_ident,state)` | Seasons | #save | a (no href) |
| `NewEditArchive(content,season_ident,state)` | Seasons | #archive | a (no href) |
| `ManageHolidays(holiday_ident,meth)` | Manage Holidays | #save | a (no href) |
| `ManageHolidays(holiday_ident,meth)` | Manage Holidays | #delete | a (no href) |
| `ManageSessions(meth,session_ident)` | Manage Sessions | #save | a (no href) |
| `ManageSessions(meth,session_ident)` | Manage Sessions | #delete | a (no href) |
| `ManageSessions(showall)` | Manage Sessions | #save | a (no href) |
| `NewEditDel(category_ident,content,state)` | Charge Categories | #save | a (no href) |
| `NewEditDel(category_ident,content,state)` | Charge Categories | #delete | a (no href) |
| `ManageTags(meth,tag_ident)` | Manage Tags | #save | a (no href) |
| `ManageTags(meth,tag_ident)` | Manage Tags | #delete | a (no href) |
| `ManageDropReasons(drop_reason_ident,meth)` | Manage Drop Reasons | #save | a (no href) |
| `ManageDropReasons(drop_reason_ident,meth)` | Manage Drop Reasons | #delete | a (no href) |
| `ManagePhoneLabels(meth,plident)` | Manage Phone Labels | #save | a (no href) |
| `ManagePhoneLabels(meth,plident)` | Manage Phone Labels | #delete | a (no href) |
| `ManagePhoneLabels(meth,plident)` | Manage Phone Labels | #reassignlabel | a (no href) |
| `ManageZapier(meth)` | Manage Zapier | Copy | a (no href) |
| `ManageRegFeeRules(meth,rule_ident)` | Auto Registration Fee Rules | #save | a (no href) |
| `ManageRegFeeRules(meth,rule_ident)` | Auto Registration Fee Rules | #delete | a (no href) |
| `ManageFamilyDiscounts(meth,session)` | Manage Family Discounts | #save | a (no href) |
| `ManageFamilyDiscounts(meth,session)` | Manage Family Discounts | #delete | a (no href) |
| `ManageTagTuition(ident,meth)` | Manage Tag Tuition | #save | a (no href) |
| `ManageTagTuition(ident,meth)` | Manage Tag Tuition | #delete | a (no href) |
| `ManageSuppliers(meth,supplier_id)` | Manage Suppliers | #save | a (no href) |
| `ManageSuppliers(meth,supplier_id)` | Manage Suppliers | #delete | a (no href) |
| `ManageInventorySizes(meth,size_id)` | Manage Inventory Sizes | #save | a (no href) |
| `ManageInventorySizes(meth,size_id)` | Manage Inventory Sizes | #delete | a (no href) |
| `ManageInventoryItems(item_id,meth)` | Manage Inventory Items | #save | a (no href) |
| `ManageInventoryItems(item_id,meth)` | Manage Inventory Items | #delete | a (no href) |
| `ManageVendors(meth,vendor_ident)` | Manage Vendors | #save | a (no href) |
| `ManageVendors(meth,vendor_ident)` | Manage Vendors | #delete | a (no href) |
| `ManageSizeChartNames(meth,name_ident)` | Manage Size Chart Names | #save | a (no href) |
| `ManageSizeChartNames(meth,name_ident)` | Manage Size Chart Names | #delete | a (no href) |
| `ManageSizeChartEntries(meth,name_ident)` | Manage Size Chart Entries | #save | a (no href) |
| `ManageCatalogs(catalog_ident,meth)` | Manage Catalogs | #save | a (no href) |
| `ManageCatalogs(catalog_ident,meth)` | Manage Catalogs | #delete | a (no href) |
| `ManageSizes(costume_size_ident,meth)` | Manage Sizes | #save | a (no href) |
| `ManageSizes(costume_size_ident,meth)` | Manage Sizes | #delete | a (no href) |
| `GetOnlineRegUrl(meth)` | Get Online Reg Url | Check All | a (no href) |
| `GetOnlineRegUrl(meth)` | Get Online Reg Url | Uncheck All | a (no href) |
| `ManageWidgets(meth)` | Manage Widgets | Copy | a (no href) |
| `ClassPerformance(cident)` | Class Performance | #save | a (no href) |
| `StudentPerfPerforming(cident)` | Performing flags by student | #save | a (no href) |
| `Costumes(cident)` | Costumes | #save | a (no href) |
| `EditClass(cident,tab)` | Class: 818 Ballet | #save | a (no href) |
| `EditClass(cident,tab)` | Class: 818 Ballet | #delete | a (no href) |
| `EmailHistory(addrs,pos)` | Email History | Go back | a (no href) |
| `EditFamily(fident,tab)` | Family: Family 23 | #save | a (no href) |
| `EditFamily(fident,tab)` | Family: Family 23 | #delete | a (no href) |
| `EditFamily(fident,tab)` | Family: Family 23 | Mom Cell | span.link |
| `EditFamily(fident,tab)` | Family: Family 23 | Dad Cell | span.link |
| `EditFamily(fident,tab)` | Family: Family 23 | Home Phone | span.link |
| `AddFamilyChargeForm(category,charge,family_ident)` | Add Family Charge | #save | a (no href) |
| `EditCharge(allrows,xident)` | Edit Charge | #save | a (no href) |
| `EditCharge(allrows,xident)` | Edit Charge | #delete | a (no href) |
| `EditStudent(sident,tab)` | Student: Student 61 | #save | a (no href) |
| `EditStudent(sident,tab)` | Student: Student 61 | #delete | a (no href) |
| `Attendance(cident,sident)` | Attendance | #save | a (no href) |
| `ManageHolidays(meth)` | Manage Holidays | #save | a (no href) |
| `ManageSessions(meth)` | Manage Sessions | #save | a (no href) |
| `ManageSessions(meth,session_ident,showall)` | Manage Sessions | #save | a (no href) |
| `ManageSessions(meth,session_ident,showall)` | Manage Sessions | #delete | a (no href) |
| `ManageTags(meth)` | Manage Tags | #save | a (no href) |
| `ManageDropReasons(meth)` | Manage Drop Reasons | #save | a (no href) |
| `ManageGenderOptions(meth)` | Manage Gender Options | #save | a (no href) |
| `ManageRegFeeRules(meth)` | Auto Registration Fee Rules | #save | a (no href) |
| `ManageFamilyDiscounts(meth)` | Manage Family Discounts | #save | a (no href) |
| `ManageTagTuition(meth)` | Manage Tag Tuition | #save | a (no href) |
| `ManageSuppliers(meth)` | Manage Suppliers | #save | a (no href) |
| `ManageInventorySizes(meth)` | Manage Inventory Sizes | #save | a (no href) |
| `ManageInventoryItems(meth)` | Manage Inventory Items | #save | a (no href) |
| `ManageVendors(meth)` | Manage Vendors | #save | a (no href) |
| `ManageSizeChartNames(meth)` | Manage Size Chart Names | #save | a (no href) |
| `ManageCatalogs(meth)` | Manage Catalogs | #save | a (no href) |
| `ManageSizes(meth)` | Manage Sizes | #save | a (no href) |
| `Login` | — | #eyeIcon | span.fa |
| `ManageSessions(meth,showall)` | Manage Sessions | #save | a (no href) |
| `Register` | — | Close | div.Close |
| `Register` | — | #new PassEyeIcon | span.fa |
| `Register` | — | #repeat PassEyeIcon | span.fa |
| `Enroll` | — | Close | div.Close |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Store` | — | Close | div.Close |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Login(origin)` | — | #eyeIcon | span.fa |
| `Store(meth,tid)` | — | Close | div.Close |

### Settings cards with more than one control of their own — 24

These route to the small-form card, which used to offer a single Save button. Each one has
its own buttons (OK, Accept, Enroll), so the card offers all of them.

| Page | Title | Controls |
|---|---|---|
| `AdminBanner(meth)` | Admin Banner | OK / OK |
| `Login` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `Login(origin)` | — | [email protected] / (no text) / Log In / The Studio Director End User Terms of Service |
| `ManageCheckoutEmail` | Manage Checkout Email | [email protected] / OK |
| `UploadCheckoutEmailAttach` | Upload Checkout Email Attach | OK / OK |
| `UploadFamilyStudentPic(fident,type)` | Family Pictures | Studio Director's Terms / OK / OK |
| `UploadFamilyStudentPic(sident,type)` | Family Pictures | Studio Director's Terms / OK / OK |
| `UploadLogo` | Upload Logo | OK / OK |
| `UploadRegHeader` | Upload Reg Header | OK / OK |
| `UploadUserDocument` | Upload User Document | Studio Director's Terms / OK / OK |
| `UploadUserDocument(cident)` | Upload User Document | Studio Director's Terms / OK / OK |
| `UploadUserDocument(fident)` | Upload User Document | Studio Director's Terms / OK / OK |
| `ViewAccept(meth,methargs)` | Student Waiver & Release of Liability | [email protected] / San Ramon Valley Dance Academy (studio1) Rules and Policies / studio1 Rules and Policies |

## Screens by module

### Week calendar — 6 screens (3 week, 3 settings)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `CalendarPage` | Class Calendar | week | 58 | 1 | 0 | week |
| `ConfigureCalendar` | Configure Class Calendar | page | 0 | 6 | 0 | settings |
| `ConfigureCalendar(meth,methargs)` | Configure Class Calendar | record | 0 | 47 | 0 | settings |
| `ConfigureCalendar(meth)` | Configure Class Calendar | record | 0 | 56 | 0 | settings |
| `NewClassCharge` | New Class Charge | week | 58 | 1 | 0 | week |
| `PrintClassCalendar` | Print Class Calendar | week | 58 | 1 | 0 | week |

### Printing — 12 screens (1 week, 4 sheet, 2 index, 3 settings, 2 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `PrintClass(cident,meth)` | Print: 818 Ballet | record | 0 | 2 | 0 | settings |
| `PrintClass(cident)` | Print: 818 Ballet | record | 0 | 0 | 0 | index |
| `PrintClassCalendar(cident)` | Print Class Calendar | record | 58 | 1 | 0 | week |
| `PrintClassRoster(cident)` | Class Roster for 818 Ballet | record | 17 | 60 | 0 | sheet |
| `PrintFamily(fident,meth)` | Print Family | record | 1 | 3 | 0 | settings |
| `PrintFamily(fident)` | Print Family | record | 0 | 0 | 0 | index |
| `PrintInstructor(iident,initials)` | Print Schedule: Sam Ortega | record | 13 | 0 | 0 | sheet |
| `PrintStudent(meth,methargs)` | Print Student | record | 0 | 2 | 0 | settings |
| `PrintStudent(sident)` | Print Student | record | 0 | 0 | 0 | note |
| `PrintStudentSchedule(sident)` | Print Schedule: Student 61 | record | 0 | 0 | 0 | note |
| `PrintTuitionSummary(fident)` | Tuition Summary | record | 2 | 0 | 0 | sheet |
| `PrintTuitionSummary(meth,methargs)` |  | record | 2 | 0 | 0 | sheet |

### Records: classes — 14 screens (1 week, 2 editor, 1 report, 4 sheet, 2 index, 3 settings, 1 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `AltStartTimes(cident)` | Alternate Start Times | record | 1 | 2 | 0 | settings |
| `ClassDocuments(cident)` | Class Documents | record | 1 | 0 | 0 | index |
| `ClassSkills(meth,methargs)` | Skills Checkoff | record | 1 | 0 | 0 | note |
| `ClassSkillsWorksheetForm` | Class Skills Worksheet | form | 9 | 13 | 0 | report |
| `CopyClass(cident)` | Clone Class | record | 87 | 41 | 0 | week |
| `CopyClasses` | Copy Classes | form | 2 | 2 | 0 | sheet |
| `EditClass(cident,meth)` | Drop All Students | record | 0 | 8 | 0 | settings |
| `EditClass(cident,tab)` | Class: 818 Ballet | record | 110 | 40 | 4 | editor |
| `EditClass(cident)` | Class: 818 Ballet | record | 110 | 40 | 4 | editor |
| `PerfCostumeMgmt(cident)` | Performance and Costume Management | record | 2 | 0 | 0 | sheet |
| `PreapproveStudents(cident)` | Pre-approved Students | record | 4 | 3 | 0 | sheet |
| `PreapproveStudents(cident)` | Pre-approved Students | record | 3 | 2 | 0 | sheet |
| `PreapproveStudents(meth,methargs)` | Remove Student | record | 0 | 0 | 0 | index |
| `TagClassStudents(cident)` | Tag Students | record | 0 | 2 | 0 | settings |

### Records: families — 7 screens (3 list, 1 editor, 1 index, 1 settings, 1 none)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `EditFamily(allrows,fident,tab)` | Family: Family 23 | record+list | 194 | 20 | 4 | list |
| `EditFamily(fident,startrow,tab)` | Family: Family 23 | record+list | 45 | 20 | 4 | list |
| `EditFamily(fident,tab)` | Family: Family 23 | record | 45 | 19 | 4 | editor |
| `EditFamily(fident)` | Family: Family 23 | record+list | 45 | 20 | 4 | list |
| `ManageFamilyNotes(fident,meth)` |  | record | 0 | 1 | 0 | none |
| `ManagePortalText(fident)` | Manage Portal Text | record | 0 | 1 | 0 | settings |
| `PickCategory(fident)` | Pick Category | record | 0 | 0 | 0 | index |

### Records: students — 6 screens (1 list, 1 editor, 2 sheet, 2 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `EditStudent(sident,tab)` | Student: Student 61 | record | 32 | 17 | 4 | editor |
| `EditStudent(sident)` | Student: Student 61 | record+list | 32 | 18 | 4 | list |
| `Override(sident)` | Override | record | 0 | 0 | 0 | note |
| `UnenrollAll(sident)` | Unenroll All | record | 0 | 0 | 0 | note |
| `ViewOldEnrollment(sident)` | View Old Enrollment | record | 6 | 0 | 0 | sheet |
| `ViewOldSkillCharts(sident)` | View Old Skill Charts | record | 2 | 0 | 0 | sheet |

### Records: instructors — 1 screens (1 editor)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `EditInstructor(iident)` | Instructor: Sam Ortega | record | 28 | 14 | 2 | editor |

### Lists — 6 screens (4 list, 2 editor)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `NewClass` | New Class | list | 29 | 41 | 0 | list |
| `NewClass(private)` | New Class | record | 29 | 40 | 0 | editor |
| `NewFamily` | New Family | list | 19 | 22 | 0 | list |
| `NewInstructor` | New Instructor | list | 13 | 13 | 0 | list |
| `NewStudent` | New Student | list | 13 | 15 | 0 | list |
| `NewStudent(family)` | New Student | record | 13 | 14 | 0 | editor |

### Enrollment & attendance — 30 screens (3 week, 2 editor, 7 report, 4 sheet, 4 index, 5 settings, 5 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `AddStudentMakeup(cident,meth,tid)` | Schedule Make-up | record | 0 | 0 | 0 | index |
| `AddStudentMakeup(cident,sident)` | Schedule Make-up | record | 58 | 1 | 0 | week |
| `AddStudentMakeup(meth,methargs,tid)` | Schedule Make-up | record | 0 | 0 | 0 | index |
| `AddStudentMakeup(meth,start,tid)` | Schedule Make-up | record | 0 | 0 | 0 | index |
| `AddStudentMakeup(meth,tid)` | Schedule Make-up | record | 0 | 2 | 0 | settings |
| `AddStudentMakeup(sident)` | Schedule Make-up | record | 0 | 0 | 0 | note |
| `Attendance(cident,sident)` | Attendance | record | 2 | 1 | 0 | sheet |
| `Attendance(cident)` | Attendance | record | 18 | 182 | 0 | sheet |
| `CancelledClasses` | Cancelled Classes | form | 3 | 7 | 0 | report |
| `ChangeEnrollDate(cident,drop_ident,sident)` | Enrollment Dates | record | 2 | 6 | 0 | editor |
| `ClassAttendance` | Class Attendance | form | 9 | 13 | 0 | report |
| `Enroll` |  | page | 3 | 0 | 0 | sheet |
| `Enroll(cident,sident)` | Enroll Student | record | 0 | 0 | 0 | note |
| `Enroll(cident)` | Enroll Student | record | 0 | 0 | 0 | index |
| `Enroll(meth,methargs)` | Enroll Student | record | 0 | 1 | 0 | settings |
| `Enroll(sident)` | Enroll Student | record | 58 | 1 | 0 | week |
| `GlobalRegisterMessage` | Global Register Message | page | 0 | 7 | 0 | settings |
| `InstructorClassAttendance` | Instructor / Class Attendance (based on class schedules) | form | 10 | 14 | 0 | report |
| `MakeupClasses` | Make-up Classes | form | 3 | 7 | 0 | report |
| `ManagePortalEnrollmentInfo` | Manage Portal Enrollment Info | form | 8 | 8 | 0 | editor |
| `Register` |  | page | 21 | 22 | 0 | sheet |
| `RegisterMakeups` | Register Makeups | page | 0 | 11 | 0 | settings |
| `ResetAllFamilyRegisterMsgs` | Reset All Family Register Msgs | page | 0 | 0 | 0 | note |
| `ResetAllFamilyRegisterMsgs(meth)` | Reset All Family Register Msgs | record | 0 | 0 | 0 | note |
| `StudentAbsenceAndMakeups` | Student Absence/Make-ups | form | 7 | 11 | 0 | report |
| `StudentAttendance` | Student Attendance | form | 14 | 18 | 0 | report |
| `StudentPerfPerforming(cident)` | Performing flags by student | record | 1 | 0 | 0 | note |
| `StudentSignInForm` | Student Sign-in Sheets | form | 34 | 42 | 0 | report |
| `SwitchClasses(cident,sident)` | Switch Classes | record | 58 | 1 | 0 | week |
| `UncancelClasses` | Uncancel Classes | page | 0 | 7 | 0 | settings |

### Documents & waivers — 20 screens (6 sheet, 1 index, 10 settings, 3 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `FamilyDocuments(fident)` | Family Documents | record | 2 | 0 | 0 | sheet |
| `FamilyDocuments(meth,methargs,rptsort)` | Family Documents | record | 11 | 0 | 0 | sheet |
| `FamilyDocuments(meth,methargs)` | Family Documents | record | 11 | 0 | 0 | sheet |
| `ManageLegalDocuments` | Manage Legal Documents | page | 0 | 0 | 0 | index |
| `ManageUserDocuments` | Manage User Documents | page | 11 | 0 | 0 | sheet |
| `ManageUserDocuments(meth,methargs)` | Manage User Documents | record | 0 | 0 | 0 | note |
| `ManageUserDocuments(rptsort)` | Manage User Documents | record | 11 | 0 | 0 | sheet |
| `StudentWaivers` | Student Waivers | page | 1 | 0 | 0 | note |
| `StudentWaivers(meth)` | Student Waivers | record | 0 | 2 | 0 | settings |
| `UploadCheckoutEmailAttach` | Upload Checkout Email Attach | page | 0 | 1 | 0 | settings |
| `UploadFamilyStudentPic(fident,type)` | Family Pictures | record | 0 | 1 | 0 | settings |
| `UploadFamilyStudentPic(sident,type)` | Family Pictures | record | 0 | 1 | 0 | settings |
| `UploadLogo` | Upload Logo | page | 0 | 1 | 0 | settings |
| `UploadRegHeader` | Upload Reg Header | page | 0 | 1 | 0 | settings |
| `UploadUserDocument` | Upload User Document | page | 0 | 1 | 0 | settings |
| `UploadUserDocument(cident)` | Upload User Document | record | 0 | 1 | 0 | settings |
| `UploadUserDocument(fident)` | Upload User Document | record | 0 | 1 | 0 | settings |
| `ViewAccept(fident,sident)` | Online Acceptances | record | 2 | 0 | 0 | sheet |
| `ViewAccept(fident)` | Online Acceptances | record | 1 | 0 | 0 | note |
| `ViewAccept(meth,methargs)` | Student Waiver & Release of Liability | record | 0 | 5 | 0 | settings |

### Charges & payments — 71 screens (1 week, 17 editor, 15 report, 8 task, 7 sheet, 7 index, 6 settings, 10 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `AddChargeByTag` | Add Charge By Tag | page | 0 | 0 | 0 | index |
| `AddChargeByTag(meth,methargs)` | Add Charge By Tag | record | 5 | 8 | 0 | task |
| `AddClassChargeForm(cident)` | Add Class Charge | record | 5 | 7 | 0 | editor |
| `AddFamilyChargeForm(category,charge,family_ident)` | Add Family Charge | record | 8 | 8 | 0 | editor |
| `AddMultipleCharges` | Add Multiple Charges | form | 4 | 4 | 0 | task |
| `AddMultiplePayments` | Add Multiple Payments | page | 0 | 0 | 0 | note |
| `AddMultiplePaymentsForFamily` | Add Multiple Payments For Family | page | 0 | 0 | 0 | note |
| `AddPayPlanDiscounts` | Add Payment Plan or Promotion Discounts | form | 4 | 6 | 0 | task |
| `AgingList` | Aging / Collections List | form | 4 | 6 | 0 | report |
| `BuyInventory(fident)` | Buy Inventory | record | 1 | 1 | 0 | index |
| `ChargeListForm` | Charge List | form | 5 | 9 | 0 | report |
| `ChargesDetail` | Charges Detail | form | 8 | 12 | 0 | report |
| `ChargesHome` | Charges & Payments | page | 0 | 0 | 0 | index |
| `ChargesPaymentsSummary` | Charges/Payments Summary | form | 6 | 10 | 0 | report |
| `ChargeSummaryForm` | Charge Summary | form | 4 | 8 | 0 | report |
| `ClassPaymentsSummary` | Class Payments Summary | form | 8 | 12 | 0 | report |
| `CostumeBalanceCharge` | Costume Balance Charge | form | 5 | 8 | 0 | editor |
| `CostumeDepositCharge` | Costume Deposit Charge | form | 5 | 8 | 0 | editor |
| `DeleteMultipleCharges` | Delete Multiple Charges | form | 3 | 5 | 0 | task |
| `DeleteMultipleFamilyCharges(fident)` | Delete Multiple Family Charges | record | 137 | 137 | 0 | sheet |
| `DepositListForm` | Deposit List | form | 5 | 9 | 0 | report |
| `DepositSummaryForm` | Deposit Summary | form | 4 | 8 | 0 | report |
| `EditCharge(allrows,xident)` | Edit Charge | record | 9 | 8 | 0 | editor |
| `EditCharge(meth,methargs)` | Edit Charge | record | 2 | 0 | 0 | sheet |
| `EditCharge(xident)` | Edit Charge | record | 9 | 8 | 0 | editor |
| `EditPayment(allrows,xident)` | Edit Payment | record | 13 | 4 | 0 | sheet |
| `EditPayment(xident)` | Edit Payment | record | 13 | 4 | 0 | sheet |
| `EventCharge` | Event Charge | form | 7 | 10 | 0 | editor |
| `FamilyChargesPaymentsSummary` | Family Charges/Payments Summary | form | 10 | 14 | 0 | report |
| `InputPaymentMethod_studio(studioId)` | Input Payment Method_studio | record | 0 | 0 | 0 | note |
| `LedgerPaymentReceiptPage(meth,xident)` | Ledger Payment Receipt Page | record | 0 | 0 | 0 | index |
| `LedgerPaymentReceiptPage(xident)` | Current Enrollment | record | 2 | 0 | 0 | sheet |
| `ListPaymentsDue(meth)` | List Payments Due | record | 0 | 4 | 0 | settings |
| `LockLedger` | Lock Ledger | page | 0 | 3 | 0 | settings |
| `ManageAccountLedgerDisplay` | Manage Account Ledger Display | page | 0 | 4 | 0 | settings |
| `ManageAddtlClassCharges` | Manage Additional Class Charges | page | 0 | 1 | 0 | settings |
| `ManageAddtlClassCharges(cident,meth)` | Manage Additional Class Charges | record | 5 | 7 | 0 | task |
| `ManageCreditCardSurcharges` | Manage Credit Card Surcharges | page | 2 | 2 | 0 | sheet |
| `ManageFamilyDiscounts` | Manage Family Discounts | form | 10 | 6 | 0 | editor |
| `ManageFamilyDiscounts(meth,session)` | Manage Family Discounts | record | 10 | 6 | 0 | editor |
| `ManageFamilyDiscounts(meth)` | Manage Family Discounts | record | 10 | 6 | 0 | editor |
| `ManagePaymentMethods_studio(meth,payment-method-token,studioId)` | Manage Payment Methods_studio | record | 0 | 0 | 0 | note |
| `ManagePaymentMethods_studio(studioId)` | Manage Payment Methods_studio | record | 0 | 0 | 0 | index |
| `ManagePaymentMethods(fident)` | Manage Payment-Methods | record | 0 | 0 | 0 | note |
| `ManagePaymentPlans` | Manage Payment Plans | form | 8 | 10 | 0 | editor |
| `ManagePaymentPlans(meth)` | Manage Payment Plans | record | 0 | 1 | 0 | settings |
| `ManagePromos` | Manage Promos | form | 8 | 10 | 0 | editor |
| `ManageTagTuition` | Manage Tag Tuition | form | 9 | 14 | 0 | editor |
| `ManageTagTuition(ident,meth)` | Manage Tag Tuition | record | 9 | 14 | 0 | editor |
| `ManageTagTuition(meth)` | Manage Tag Tuition | record | 9 | 14 | 0 | editor |
| `NewClassTypeCharge` | New Class Type Charge | page | 0 | 0 | 0 | note |
| `NewClassTypeCharge(meth,methargs)` | New Class Type Charge | record | 6 | 9 | 0 | editor |
| `NewFamilyCharge` | New Family Charge | page | 0 | 0 | 0 | index |
| `NewFamilyCharge(meth)` | New Family Charge | record | 7 | 9 | 0 | task |
| `NewFamilySessionCharge` | Session Charge | page | 0 | 0 | 0 | index |
| `NewFamilySessionCharge(fident)` | Session Charge | record | 0 | 0 | 0 | note |
| `NewPayment(fident)` | New Payment | record | 0 | 0 | 0 | note |
| `PaymentAllocationDetail` | Payment Allocation Detail | form | 5 | 9 | 0 | report |
| `PaymentListForm` | Payment List | form | 4 | 8 | 0 | report |
| `PaymentPlansPromos` | Payment Plans/Promos | form | 4 | 8 | 0 | report |
| `PaymentSummaryForm` | Payment Summary | form | 4 | 8 | 0 | report |
| `PerformanceCharge` | Performance Charge | form | 5 | 8 | 0 | editor |
| `PortalPaymentWithGateway` | Configure Payment Behavior | page | 0 | 14 | 0 | settings |
| `SalesTaxChargedForm` | Sales Tax Charged | form | 2 | 6 | 0 | report |
| `SeasonChargesTrend` | Season Charges Trend | form | 4 | 8 | 0 | report |
| `SetClassForCharge(cident,meth,xident)` | Set Class For Charge | record | 0 | 0 | 0 | note |
| `SetClassForCharge(meth,methargs)` | Set Class For Charge | record | 0 | 0 | 0 | note |
| `SetClassForCharge(xident)` | Set Class For Charge | record | 58 | 1 | 0 | week |
| `ShowUnpaidCharges(fident)` | Unpaid Charges | record | 16 | 0 | 0 | sheet |
| `StatementForm` | Statement Letters | form | 9 | 17 | 0 | task |
| `SummaryInvoiceForm` | Summary Invoice | form | 8 | 15 | 0 | task |

### Communications — 39 screens (3 report, 6 task, 13 sheet, 7 index, 5 settings, 5 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `AdvSearch` | Advanced Search | page | 0 | 0 | 0 | index |
| `AdvSearch(meth)` | Email History Search | record | 0 | 1 | 0 | settings |
| `EditEmailSignature` | Email Signature | record | 0 | 1 | 0 | settings |
| `EmailClass(cident)` | Email Class | record | 0 | 0 | 0 | note |
| `EmailClasses` | Group of classes | form | 10 | 14 | 0 | task |
| `EmailFamily(fident,meth)` | Email Family | record | 1 | 4 | 0 | task |
| `EmailFamily(fident)` | Email Family | record | 0 | 0 | 0 | index |
| `EmailHistory(addrs,all,pos)` | Email History | record | 71 | 0 | 0 | sheet |
| `EmailHistory(addrs,iident)` | Email History | record | 27 | 0 | 0 | sheet |
| `EmailHistory(addrs,pos)` | Email History | record | 27 | 0 | 0 | sheet |
| `EmailHistory(fident)` | Email History | record | 27 | 0 | 0 | sheet |
| `EmailsSent` | Emails Sent | form | 5 | 9 | 0 | report |
| `EmailStudent(meth,methargs)` | Email Student | record | 0 | 3 | 0 | settings |
| `EmailStudent(sident)` | Email Student | record | 0 | 0 | 0 | note |
| `EmailTextHome` | Communications | page | 0 | 0 | 0 | index |
| `EmailTextHome(meth,methargs)` | Students enrolled in an instructor's classes | record | 0 | 0 | 0 | index |
| `EmailToGroupForm` | Group of students or families | form | 27 | 43 | 0 | task |
| `MailingLabelsForm` | Mailing Labels | form | 17 | 25 | 0 | task |
| `ManageCheckoutEmail` | Manage Checkout Email | page | 0 | 4 | 0 | settings |
| `ManageDripCampaigns` | Drip Email Campaigns | page | 5 | 0 | 0 | sheet |
| `ManageDripCampaigns(campaign_id,meth)` | Prospects | record | 4 | 4 | 0 | sheet |
| `ManageEmailTemplates` | Email Templates | page | 27 | 8 | 0 | sheet |
| `ManageEmailTemplates(id,meth)` | Email Templates | record | 27 | 8 | 0 | sheet |
| `ManageEmailTemplates(meth,methargs)` | Email Templates | record | 0 | 0 | 0 | note |
| `ManageScheduledEmails` | Scheduled Emails | page | 2 | 0 | 0 | sheet |
| `ManageScheduledEmails(emailid,meth)` | Delete Scheduled Email | record | 0 | 0 | 0 | note |
| `ManageWeeklyInsightEmail` | Manage Weekly Insight Email | page | 0 | 22 | 0 | settings |
| `RetrieveEmail(fident,id)` |  | record | 0 | 0 | 0 | index |
| `RetrieveEmail(id,iident)` |  | record | 0 | 0 | 0 | note |
| `RetrieveEmail(id)` |  | record | 0 | 0 | 0 | index |
| `SendEmail(cident,totype)` | Email Note | record | 5 | 11 | 0 | sheet |
| `SendEmail(emailid,totype)` | Email Note | record | 5 | 10 | 0 | sheet |
| `SendEmail(fident,totype)` | Email Note | record | 5 | 10 | 0 | sheet |
| `SendEmail(iident,totype)` | Email Note | record | 0 | 0 | 0 | index |
| `SendEmail(meth)` | Group of Instructors | record | 8 | 12 | 0 | task |
| `SendEmail(sident,totype)` | Email Note | record | 5 | 10 | 0 | sheet |
| `SMSHistoryReport` | Text Message History | form | 4 | 8 | 0 | report |
| `StudentMailingLabelsForm` | Student Mailing Labels | form | 17 | 25 | 0 | task |
| `ViewBouncedEmails` | View Bounced Emails & Reported as Spam | form | 5 | 9 | 0 | report |

### Costumes & inventory — 46 screens (11 editor, 10 report, 1 task, 16 sheet, 4 settings, 4 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `ClassPerformance(cident)` | Class Performance | record | 11 | 9 | 0 | editor |
| `CostumeLabels` | Costume Labels | form | 7 | 7 | 0 | report |
| `CostumeOrderList` | Costume Order List | form | 5 | 5 | 0 | report |
| `CostumePurchaseOrder` | Costume Purchase Order | form | 5 | 5 | 0 | report |
| `Costumes(cident)` | Costumes | record | 15 | 12 | 0 | editor |
| `CostumeShipToInfo(ident,meth)` | Costume Ship To Info | record | 11 | 11 | 0 | editor |
| `CostumeVendors` | Costume Vendors | form | 2 | 2 | 0 | report |
| `CostumeVendors(meth,rptsort)` |  | record | 31 | 0 | 0 | sheet |
| `CostumeVendors(meth)` |  | record | 31 | 0 | 0 | sheet |
| `CostumeVendorSizeCharts` | Costume Vendor Size Charts | form | 2 | 2 | 0 | report |
| `InventoryCosts` | Inventory Costs | form | 8 | 16 | 0 | report |
| `InventoryOnHand` | Inventory Items/Current Quantity on Hand | form | 10 | 10 | 0 | report |
| `InventoryTransactionHistory` | Inventory Transaction History | form | 13 | 21 | 0 | report |
| `ManageCatalogs` | Manage Catalogs | form | 19 | 2 | 0 | sheet |
| `ManageCatalogs(catalog_ident,meth)` | Manage Catalogs | record | 19 | 2 | 0 | sheet |
| `ManageCatalogs(meth)` | Manage Catalogs | record | 19 | 2 | 0 | sheet |
| `ManageInventory` | Manage Inventory | form | 7 | 7 | 0 | task |
| `ManageInventoryColors` | Manage Inventory Colors | form | 5 | 3 | 0 | sheet |
| `ManageInventoryItems` | Manage Inventory Items | form | 34 | 17 | 0 | editor |
| `ManageInventoryItems(item_id,meth)` | Manage Inventory Items | record | 34 | 17 | 0 | editor |
| `ManageInventoryItems(meth,methargs)` | Manage Inventory Items | record | 0 | 9 | 0 | settings |
| `ManageInventoryItems(meth)` | Manage Inventory Items | record | 34 | 17 | 0 | editor |
| `ManageInventorySizes` | Manage Inventory Sizes | form | 16 | 3 | 0 | sheet |
| `ManageInventorySizes(meth,size_id)` | Manage Inventory Sizes | record | 16 | 3 | 0 | sheet |
| `ManageInventorySizes(meth)` | Manage Inventory Sizes | record | 16 | 3 | 0 | sheet |
| `ManageSizeChartEntries(meth,name_ident)` | Manage Size Chart Entries | record | 13 | 6 | 0 | editor |
| `ManageSizeChartNames` | Manage Size Chart Names | form | 51 | 3 | 0 | sheet |
| `ManageSizeChartNames(meth,name_ident)` | Manage Size Chart Names | record | 51 | 3 | 0 | sheet |
| `ManageSizeChartNames(meth)` | Manage Size Chart Names | record | 51 | 3 | 0 | sheet |
| `ManageSizes` | Manage Sizes | form | 97 | 3 | 0 | sheet |
| `ManageSizes(costume_size_ident,meth)` | Manage Sizes | record | 97 | 3 | 0 | sheet |
| `ManageSizes(meth)` | Manage Sizes | record | 97 | 3 | 0 | sheet |
| `ManageVendors` | Manage Vendors | form | 47 | 17 | 0 | editor |
| `ManageVendors(meth,vendor_ident)` | Manage Vendors | record | 47 | 17 | 0 | editor |
| `ManageVendors(meth)` | Manage Vendors | record | 47 | 17 | 0 | editor |
| `Measurements(meth,sident)` | Measurements, Costumes & Performances | record | 14 | 11 | 0 | editor |
| `MeasurementsByClass(cident)` | Student Measurement and Costume Size | record | 45 | 150 | 0 | sheet |
| `MeasurementWorksheet` | Costume / Student Measurement Worksheet | form | 11 | 15 | 0 | report |
| `RemoveStudentMeasurements` | Remove Student Measurements | page | 0 | 0 | 0 | note |
| `RemoveStudentMeasurements(meth)` | Remove Student Measurements | record | 0 | 0 | 0 | note |
| `SetDefaultPerforming` | Set Default Performing | page | 0 | 1 | 0 | settings |
| `SetPerforming` | Set Performing | page | 0 | 1 | 0 | settings |
| `SizeCostumes` | Size Costumes | page | 0 | 0 | 0 | note |
| `SizeCostumes(meth)` | Size Costumes | record | 0 | 0 | 0 | note |
| `SplitPerformances` | Split Performances | page | 0 | 1 | 0 | settings |
| `StudentCostumeList` | Student Costume List | form | 7 | 7 | 0 | report |

### Reports & dashboards — 41 screens (24 report, 6 task, 8 sheet, 1 index, 1 settings, 1 note)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `Alerts` |  | page | 1141 | 0 | 0 | sheet |
| `BirthdayCardForm` | Birthday Card | form | 8 | 16 | 0 | task |
| `CheckExpDatesForm` | Check Expiration Dates | form | 3 | 6 | 0 | report |
| `ClassConfirmationForm` | Class Confirmation | form | 7 | 13 | 0 | task |
| `ClassDropHistory` | Class Drop History | form | 10 | 14 | 0 | report |
| `ClassListForm` | Class List | form | 13 | 17 | 0 | report |
| `ClassResourceBlockForm` | Class Resource Block | form | 7 | 11 | 0 | report |
| `ClassRosterForm` | Class Roster | form | 30 | 40 | 0 | report |
| `ClassScheduleForm` | Class Schedule | page | 0 | 0 | 0 | note |
| `CustomReport(report_id)` | Event Cast List by Student | record | 4 | 4 | 0 | report |
| `DropSummary` | Drop Summary | form | 8 | 12 | 0 | report |
| `EventCastList` | Event Cast List | form | 8 | 10 | 0 | report |
| `EventCastSummary` | Event Cast Summary | form | 7 | 9 | 0 | report |
| `EventConfirmationForm` | Event Confirmation | form | 4 | 6 | 0 | task |
| `EventList` | Event List | form | 6 | 6 | 0 | report |
| `EventProgramForm` | Event Program | form | 2 | 2 | 0 | sheet |
| `FamilyEventList` | Family / Event List | form | 5 | 5 | 0 | report |
| `FamilyListForm` | Family List | form | 5 | 7 | 0 | report |
| `FamilyListForm(overdue)` | Overdue List | record | 5 | 7 | 0 | report |
| `HomePage` | Home | page | 22 | 0 | 5 | sheet |
| `HomePage(tab)` | Home | record | 16 | 0 | 5 | sheet |
| `HowHeardForm` | How Families Heard About Us Metrics | form | 3 | 7 | 0 | report |
| `InstructorList` | Instructor List | form | 7 | 7 | 0 | report |
| `InstructorWorkSchedules` | Instructor Work Schedules | form | 12 | 20 | 0 | report |
| `LargeTrend(metric)` |  | record | 58 | 0 | 0 | sheet |
| `PreapprovedStudentClassList` | Pre-approved Student/Class List | form | 6 | 6 | 0 | report |
| `RegFeeHistory(type)` | Reg Fee History | record | 2 | 0 | 0 | sheet |
| `ReportCard` | Report Card | form | 7 | 13 | 0 | task |
| `ReportsHome` | Reports Home | page | 0 | 1 | 0 | index |
| `RetentionList` | Retention List | form | 8 | 16 | 0 | report |
| `SetAdminHomePageMsg` | Set Admin Home Page Msg | page | 0 | 1 | 0 | settings |
| `StudentClassListForm` | Student / Class List | form | 11 | 19 | 0 | report |
| `StudentContactList` | Student Contact List | form | 8 | 8 | 0 | report |
| `StudentDropHistory` | Student Drop History | form | 10 | 14 | 0 | report |
| `StudentList` | Student List | form | 14 | 22 | 0 | report |
| `StudentSkillsReport` | Student Skills | form | 12 | 16 | 0 | report |
| `StudentSummaryForm` | Student Summary | form | 13 | 21 | 0 | task |
| `TransactionDetailForm` | Transaction Detail | form | 9 | 17 | 0 | task |
| `Trends` |  | page | 16 | 0 | 0 | sheet |
| `ViewDropClassHistory(cident)` | Drop History | record | 2 | 0 | 0 | sheet |
| `ViewEcomLogForm` | Transactions | form | 5 | 13 | 0 | report |

### Settings & portal — 148 screens (1 week, 26 editor, 6 report, 7 task, 26 sheet, 8 index, 38 settings, 35 note, 1 none)

| Page | Title | Kind | Rows | Controls | Tabs | View |
|---|---|---|---|---|---|---|
| `AddStudentDropIn(sident)` | Add Trial/Drop-in | record | 58 | 1 | 0 | week |
| `AdminBanner` | Admin Banner | page | 0 | 3 | 0 | settings |
| `AdminBanner(meth)` | Admin Banner | record | 0 | 1 | 0 | settings |
| `AdminHome` | Settings | page | 0 | 1 | 0 | index |
| `AdminHome(tab)` | Settings | record | 0 | 1 | 0 | index |
| `ApproveAndLockRange` | Approve And Lock Range | page | 0 | 6 | 0 | settings |
| `AssignSkills` | Assign Skills | form | 4 | 4 | 0 | task |
| `CancelClasses` | Cancel Classes | page | 0 | 0 | 0 | note |
| `ChangeDropDate(cident,drop_ident,sident)` | Change Drop Date | record | 2 | 6 | 0 | task |
| `ChangeDropDate(cident,dropdate,sident)` | Change Drop Date | record | 2 | 6 | 0 | task |
| `ChangePassword` | Change Password | form | 3 | 3 | 0 | sheet |
| `CheckinNotConfigured` | Checkin Not Configured | page | 0 | 0 | 0 | note |
| `ClearPreapprovedClasses` | Clear Preapproved Classes | form | 4 | 4 | 0 | task |
| `DeleteExpiredCards` | Delete Expired Cards | page | 0 | 0 | 0 | note |
| `DeleteExpiredCards(meth)` | Delete Expired Cards | record | 0 | 0 | 0 | note |
| `DeleteImages` | Delete Images | page | 180 | 897 | 0 | sheet |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `DisplayMessage(meth)` |  | record | 0 | 0 | 0 | note |
| `EditBillingGroups` | Rate Groups | record | 28 | 27 | 0 | sheet |
| `EditContactInfo` | Studio Contact Info | record | 14 | 13 | 0 | editor |
| `EnableMultiInstructor` | Multi-Instructor Support | page | 1 | 1 | 0 | settings |
| `EPSManagePayInfo(fident,meth,returntid)` | Payment Info | record | 0 | 0 | 0 | note |
| `EPSManagePayInfo(fident)` | Payment Info | record | 10 | 11 | 0 | task |
| `FamilyNotes` | Family Notes | form | 7 | 15 | 0 | report |
| `GetOnlineRegUrl` | Get Online Reg Url | page | 0 | 2 | 0 | none |
| `GetOnlineRegUrl(meth)` | Get Online Reg Url | record | 2 | 13 | 0 | sheet |
| `IncreaseRatesWizard` | Increase Rates Wizard | page | 0 | 0 | 0 | note |
| `InstructorClassTimesheets` | Instructor / Class Attendance (based on instructor timesheet | form | 10 | 14 | 0 | report |
| `LayoutOptions` | Layout Options | form | 7 | 7 | 0 | editor |
| `Login` |  | page | 0 | 2 | 0 | settings |
| `Login` |  | page | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `Login(origin)` |  | record | 0 | 2 | 0 | settings |
| `ManageAbsenceOptions` | Portal Absence Reporting Options | page | 0 | 4 | 0 | settings |
| `ManageClassCardTypes` | Manage Class Card Types | form | 38 | 63 | 0 | editor |
| `ManageClassPasswords` | Manage Class Passwords | page | 0 | 0 | 0 | note |
| `ManageClassPasswords(meth)` | Manage Class Passwords | record | 3 | 3 | 0 | sheet |
| `ManageCustomInstructorFields` | Manage Custom Instructor Fields | page | 15 | 20 | 0 | sheet |
| `ManageCustomStudentFields` | Manage Custom Student Fields | page | 40 | 50 | 0 | sheet |
| `ManageDropReasons` | Manage Drop Reasons | form | 17 | 2 | 0 | sheet |
| `ManageDropReasons(drop_reason_ident,meth)` | Manage Drop Reasons | record | 17 | 2 | 0 | sheet |
| `ManageDropReasons(meth)` | Manage Drop Reasons | record | 17 | 2 | 0 | sheet |
| `ManageEvents` | Manage Events | form | 7 | 7 | 0 | editor |
| `ManageFamilyStudentMax` | Manage Family Student Max | page | 0 | 2 | 0 | settings |
| `ManageGenderOptions` | Manage Gender Options | form | 8 | 2 | 0 | sheet |
| `ManageGenderOptions(meth,sex_ident)` | Manage Gender Options | record | 8 | 2 | 0 | sheet |
| `ManageGenderOptions(meth)` | Manage Gender Options | record | 8 | 2 | 0 | sheet |
| `ManageGoogle` | Manage Google | page | 0 | 1 | 0 | settings |
| `ManageGoogle(meth)` | Manage Google | record | 0 | 1 | 0 | settings |
| `ManageHolidays` | Manage Holidays | form | 29 | 6 | 0 | editor |
| `ManageHolidays(holiday_ident,meth)` | Manage Holidays | record | 29 | 6 | 0 | editor |
| `ManageHolidays(meth)` | Manage Holidays | record | 29 | 6 | 0 | editor |
| `ManagePhoneLabels` | Manage Phone Labels | form | 14 | 3 | 0 | sheet |
| `ManagePhoneLabels(meth,plident)` | Manage Phone Labels | record | 14 | 3 | 0 | sheet |
| `ManagePhoneLabels(meth)` | Manage Phone Labels | record | 0 | 3 | 0 | settings |
| `ManagePhoneNumbersFormat` | Manage Phone Numbers Format | form | 1 | 1 | 0 | settings |
| `ManagePortal` | Manage Portal | page | 0 | 1 | 0 | settings |
| `ManagePortalNotifications` | Manage Portal Notifications | page | 0 | 2 | 0 | settings |
| `ManagePortalStyles` | Manage Portal Styles | page | 8 | 8 | 0 | sheet |
| `ManagePronounOptions` | Manage Pronoun Options | page | 0 | 1 | 0 | settings |
| `ManageRegFeeRules` | Auto Registration Fee Rules | form | 21 | 25 | 0 | editor |
| `ManageRegFeeRules(meth,methargs)` | Auto Registration Fee Rules | record | 0 | 1 | 0 | settings |
| `ManageRegFeeRules(meth,rule_ident)` | Auto Registration Fee Rules | record | 21 | 16 | 0 | editor |
| `ManageRegFeeRules(meth)` | Auto Registration Fee Rules | record | 21 | 25 | 0 | editor |
| `ManageSessions` | Manage Sessions | form | 17 | 16 | 0 | editor |
| `ManageSessions(meth,session_ident,showall)` | Manage Sessions | record | 18 | 16 | 0 | editor |
| `ManageSessions(meth,session_ident)` | Manage Sessions | record | 17 | 16 | 0 | editor |
| `ManageSessions(meth,showall)` | Manage Sessions | record | 18 | 16 | 0 | editor |
| `ManageSessions(meth)` | Manage Sessions | record | 17 | 16 | 0 | editor |
| `ManageSessions(showall)` | Manage Sessions | record | 18 | 16 | 0 | editor |
| `ManageSkills` | Manage Skills | form | 10 | 8 | 0 | editor |
| `ManageSkills(meth)` | Manage Skills | record | 0 | 2 | 0 | settings |
| `ManageSuppliers` | Manage Suppliers | form | 18 | 15 | 0 | editor |
| `ManageSuppliers(meth,supplier_id)` | Manage Suppliers | record | 18 | 15 | 0 | editor |
| `ManageSuppliers(meth)` | Manage Suppliers | record | 18 | 15 | 0 | editor |
| `ManageTags(meth,tag_ident)` | Manage Tags | record | 10 | 2 | 0 | sheet |
| `ManageTags(meth)` | Manage Tags | record | 10 | 2 | 0 | sheet |
| `ManageTags(state)` | Manage Tags | record | 10 | 2 | 0 | sheet |
| `ManageWidgets` | Manage Widgets | page | 0 | 0 | 0 | index |
| `ManageWidgets(meth)` | Manage Widgets | record | 0 | 1 | 0 | settings |
| `ManageZapier` | Manage Zapier | page | 0 | 0 | 0 | note |
| `ManageZapier(meth)` | Manage Zapier | record | 0 | 1 | 0 | settings |
| `MergeFamily(fident)` | Merge Family | record | 0 | 0 | 0 | index |
| `NewEditArchive(content,season_ident,state)` | Seasons | record | 17 | 13 | 0 | editor |
| `NewEditArchive(content,state)` | Do NOT add a season here unless you know how to set up all t | record | 17 | 13 | 0 | editor |
| `NewEditDel(category_ident,content,state)` | Charge Categories | record | 40 | 5 | 0 | editor |
| `NewEditDel(content,state)` | Charge Categories | record | 40 | 5 | 0 | editor |
| `OnlineRegPermissions` | Online Registration Permissions | page | 0 | 11 | 0 | settings |
| `PayDiffCard(fident)` | Pay Diff Card | record | 0 | 0 | 0 | note |
| `PortalAccess` | Portal Access | page | 0 | 11 | 0 | settings |
| `PreapproveClasses(meth,methargs)` | Preapprove Classes | record | 0 | 0 | 0 | note |
| `PreapproveClasses(sident)` | Preapprove Classes | record | 1 | 0 | 0 | note |
| `PreapprovedLetters` | Pre-approved Classes | form | 6 | 8 | 0 | task |
| `ResetPassword` | Reset Password | page | 0 | 0 | 0 | index |
| `ResetPassword(username)` | Reset Password | record | 2 | 2 | 0 | sheet |
| `ResetStaffPassword` | Reset Staff Password | page | 0 | 0 | 0 | index |
| `ResetStaffPassword(username)` | Reset Staff Password | record | 2 | 2 | 0 | sheet |
| `ResetTags` | Reset Tags | page | 0 | 2 | 0 | settings |
| `ResetWaiver` | Reset Waiver | page | 0 | 0 | 0 | note |
| `ResetWaiver(meth)` | Reset Waiver | record | 0 | 0 | 0 | note |
| `RestoreOldSeason` | Restore Old Season | page | 0 | 0 | 0 | index |
| `RestoreOldSeason(meth,methargs)` | Restore Old Season | record | 0 | 0 | 0 | note |
| `SearchDisplayFormat` | Search and Sort | page | 0 | 2 | 0 | settings |
| `SetCancelClassReminders` | Set Cancel Class Reminders | page | 0 | 1 | 0 | settings |
| `SetOnlineRegOK` | Set Online Registration Allowed | form | 7 | 19 | 0 | task |
| `SetRedYellowGreen` | Set Red Yellow Green | page | 0 | 0 | 0 | index |
| `SetRedYellowGreen(meth,methargs)` | Set Red Yellow Green | record | 0 | 2 | 0 | settings |
| `SetTimeBlockCalendarFilters(returnURL)` | Set Calendar Filters | record | 9 | 13 | 0 | sheet |
| `SetupSeasonWizard` | Setup Season Wizard | page | 0 | 1 | 0 | settings |
| `SetViewRatesPoliciesLink` | Set View Rates Policies Link | page | 0 | 1 | 0 | settings |
| `Store` |  | page | 4 | 1 | 0 | sheet |
| `Store(meth,tid)` |  | record | 4 | 1 | 0 | sheet |
| `StudentClassCardUseage` | Student Class Card Usage | form | 3 | 3 | 0 | report |
| `StudentMakeUps` | Student Make-ups/Trials/Drop-ins | form | 9 | 13 | 0 | report |
| `StudentsNotReturning` | Students Not Returning | form | 3 | 3 | 0 | report |
| `StudioDirectorBillingInfo` | Studio Director Billing Info | page | 0 | 0 | 0 | note |
| `Timesheet(cident,iident)` | Timesheet | record | 6 | 4 | 0 | editor |
| `Timesheet(iident)` | Timesheet | record | 61 | 48 | 0 | editor |
| `Unenroll(cident,sident)` | Drop Student | record | 0 | 0 | 0 | note |
| `ViewMissingRates` | View Missing Rates | page | 3 | 0 | 0 | sheet |
| `ViewMissingRates(meth)` | View Missing Rates | record | 13 | 0 | 0 | sheet |
| `ZipCodes` | Family ZIP Codes | form | 6 | 10 | 0 | report |

## Links not followed

Anything whose page name contains an action verb is recorded and never requested, because
a crawl must not delete, charge, or email. These are the screens behind those links:

None, because this run followed every flagged link. It says so below.

## Links the safety rule flagged

`tools/scrape-all.js` will not request a link whose page name contains an action verb,
because a crawl must not delete, charge, or email. A run with `{ all: true }` follows them
anyway and records each one in `followedRisky`; this crawl was such a run, and followed
96 of them.

Every one was a plain GET, and 96 of 96 are in this map as screens.
What the rule matched is the name of the screen behind the link, not an act:

| Kind | Screens | Examples |
|---|---|---|
| record | 57 | `SendEmail(meth)`, `ViewDropClassHistory(cident)`, `SendEmail(iident,totype)`, +54 more |
| page | 21 | `NewFamilyCharge`, `NewClassTypeCharge`, `AddChargeByTag`, +18 more |
| form | 17 | `PerformanceCharge`, `EventCharge`, `CostumeDepositCharge`, +14 more |
| week | 1 | `NewClassCharge` |

None came back with a confirmation title, so no GET changed a record: the destinations are
the charge, delete, reset and email *forms* themselves, which is where the crawl had to go
to map them. The `Login` and `Register` links point at the public portal sign-in page.
