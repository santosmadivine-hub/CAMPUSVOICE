# CampusVoice — Office Accounts, Transaction Codes & Summary Analytics

Setup and deployment guide for the per-office upgrade.
ISUFST-SEC · Firebase project `kristal-adb78`

> **Read the deployment order in §3 before you deploy anything.** The security
> rules require every account to exist in Firebase Authentication first. Deploy
> the rules too early and the dashboards lock themselves out.

---

## 1. What changed

| Area | Before | Now |
|---|---|---|
| Login | Three hard-coded admins; passwords in plain text in `admin_settings` | Firebase Authentication for every account; Firestore holds only roles |
| Accounts | Admin 1/2/3 only | Plus one account per campus unit or office |
| Transaction codes | `services/transaction_code/office_name/{name}/codes/*`, marked used on *entry* | `transaction_codes/{code}`, tied to an `officeId`, marked used only after a **successful submission** |
| Code uniqueness | Random, collisions possible | Document ID *is* the code, so Firestore enforces uniqueness |
| Office isolation | Pages hidden by role | Enforced by Firestore Security Rules |
| Summary Analytics | One page, Admin 1 only, no filters | Shared page with office / start date / end date / category filters; offices locked to their own |

### New files

```
cv-core.js                 shared module: auth, session guard, office data access, analytics maths
cv-accounts.js             office account provisioning (Admin 1)
cv-analytics.css           Summary Analytics styles
cv-office.css              shared styles for the office pages
office-dashboard.html      office home
office-codes.html          generate / track / export this office's codes
office-analytics.html      Summary Analytics (Admin 1 and offices)
admin1-accounts.html       Admin 1: create and manage office accounts
firestore.rules            security rules
functions/                 optional Cloud Functions for Admin-SDK-only operations
```

`admin1-office-analytics.html` now forwards to `office-analytics.html`, so old
links and bookmarks keep working.

---

## 2. Firestore data model

```
accounts/{uid}
  role           "admin1" | "admin2" | "admin3" | "office"
  officeId       services/offices/records doc id   (office accounts only)
  officeName     cached display name
  username       sign-in name
  email          derived Authentication address
  status         "active" | "inactive"
  permissions    { … }
  createdAt / createdBy / updatedAt / lastLoginAt

account_index/{username}        username -> email, so sign-in accepts a username
  uid, email, role, officeId

transaction_codes/{code}        ← the document ID is the code itself
  code, officeId, officeName
  status         "unused" | "used"
  generatedAt, generatedBy
  usedAt, evaluationId

services/offices/records/{officeId}        unchanged, plus:
  status, createdAt, accountUid, accountEmail, accountUsername

services/evaluations/records/{id}          unchanged, plus:
  officeId                                 stamped by the app on submission
  feedbackStatus, feedbackUpdatedAt, feedbackUpdatedBy, officeNotes
```

### Two deliberate deviations from the brief

**1. Offices stay at `services/offices/records/{officeId}`, not `offices/{officeId}`.**
The top-level `offices` collection is already in use by Admin 3 for facilities.
Adding a second one would split the registry in two and break the requirement
that the Android app and the web dashboard share one set of office IDs.

**2. `status` is stored lowercase (`unused` / `used`) and displayed capitalised.**
Every existing page compares `status === "unused"` exactly. Changing the stored
casing would silently break them. The UI and all exports show "Unused" / "Used".

### Why the code is the document ID

Firestore refuses to create a document that already exists, so no two codes can
ever hold the same value — no separate uniqueness check, no race. It also means
the app resolves a code with one direct read instead of a query, which is what
lets the security rules forbid *listing* codes: a respondent can check the code
in their hand but cannot discover anybody else's.

---

## 3. Deployment order

**Follow this sequence.** Steps 1 and 2 must happen *before* step 3.

### Step 1 — Sign in once as each administrator (rules NOT yet deployed)

Open `index.html` and sign in as each of the three administrators using their
**current** credentials:

| Account | Username | Password |
|---|---|---|
| Admin 1 — Services | `admin1` | `admin123` |
| Admin 2 — Cleanliness | `admin2` | `admin456` |
| Admin 3 — Facilities | `admin3` | `admin789` |

(If a password was changed by editing `admin_settings` in the Firestore console,
use that one instead.)

The first sign-in creates a real Firebase Authentication account for that
administrator — `admin1@campusvoice.isufst` and so on — using the password just
typed, and writes their `accounts/{uid}` record. Nothing to configure; the
username and password do not change.

Confirm in the Firebase console → Authentication that three users now exist, and
in Firestore that `accounts` holds three documents with roles `admin1`,
`admin2`, `admin3` and `status: "active"`.

> If an administrator's password is shorter than 6 characters, Firebase
> Authentication will refuse it. Set a longer one in `admin_settings` first,
> then sign in.

### Step 2 — Create the office accounts and migrate the codes

Still signed in as Admin 1:

1. **Office Management** — confirm every campus unit or office is registered.
2. **Office Accounts** → **Create Office Account** for each one. Note the
   username and password shown; they are displayed once and cannot be
   recovered, only reset.
3. If the yellow banner reports codes still needing migration, choose
   **Migrate codes for all offices**. This copies codes out of the old
   per-office subcollections into `transaction_codes` and stamps each with its
   office ID. Nothing is deleted, and running it twice is harmless.

**Do not skip the migration.** The mobile app now resolves a code by direct
lookup in `transaction_codes`, so a code printed before this upgrade will be
rejected until it has been moved across.

### Step 3 — Deploy the security rules

```bash
firebase deploy --only firestore:rules
```

Then check that each dashboard still loads: Admin 1, Admin 2, Admin 3 and one
office account.

### Step 4 — Delete the plain-text passwords

`admin_settings` held administrator usernames and passwords in clear text,
readable by anyone holding the public API key. Credentials now live in Firebase
Authentication and the rules deny all access to that collection.

**Delete the `admin_settings` collection in the Firestore console.** This is the
single most valuable part of this upgrade; do not leave it for later.

### Step 5 — Rebuild and distribute the Android app

```bash
cd CampusVioce
./gradlew assembleRelease
```

The app now asks which office the respondent transacted with, validates that
the code belongs to that office, and consumes the code only after the
evaluation has been stored.

### Step 6 (optional) — Deploy the Cloud Functions

```bash
cd CAMPUSVOICE/functions
npm install
firebase deploy --only functions
```

Only needed for the three things the Admin SDK alone can do — see §6.

---

## 4. How office isolation is enforced

Hiding a page is not a security boundary. Each of these is a rule, checked by
Firestore on every request:

| Attempt | Outcome |
|---|---|
| Office lists all evaluations | **Denied.** `list` requires every returned document to match the caller's `officeId` or office name, so only the two scoped queries succeed. |
| Office lists another office's codes | **Denied.** Same mechanism on `transaction_codes`. |
| Office edits a respondent's answers | **Denied.** `update` is restricted to `feedbackStatus`, `feedbackUpdatedAt`, `feedbackUpdatedBy` and `officeNotes`. |
| Office creates a code for another office | **Denied.** `create` requires `officeId` to equal the caller's own. |
| Respondent enumerates unused codes | **Denied.** `get` on a single code is allowed; `list` is not. |
| Respondent marks a code used for a different office | **Denied.** The code's `officeId` is immutable on update. |
| Deactivated office opens any page | **Denied.** Every rule routes through `activeAccount()`, which requires `status == "active"`. |
| Office grants itself `admin1` | **Denied.** Only Admin 1 may write a role; others may only touch `lastLoginAt` on their own record. |
| Office reactivates itself | **Denied.** It cannot write `status` on its own record or on its office. |

The office pages run **two narrow queries** rather than reading the collection
and filtering in the browser:

```js
where("officeId", "==", officeId)   // records submitted since officeId stamping
where("office",   "==", officeName) // records from before that existed
```

Both are provably scoped to one office, so the rule can demand it. Reading
everything and filtering client-side would have forced the rule wide open — the
exact isolation this is meant to guarantee.

### Testing the rules

```bash
firebase emulators:start --only firestore
```

Worth checking by hand, signed in as an office account, that this is refused:

```js
// Must fail with permission-denied
await getDocs(collection(db, "services", "evaluations", "records"));
await getDocs(collection(db, "transaction_codes"));
```

---

## 5. Transaction code lifecycle

```
Admin 1 or the office generates a code
  └─ transaction_codes/{CODE}  status: unused, officeId stamped

Respondent selects their office and enters the code
  └─ single read of transaction_codes/{CODE}
     · not found              → "Invalid transaction code"
     · status == used         → "Transaction code already used"
     · officeId ≠ selected    → "This code was issued by <other office>"
     · otherwise              → the questionnaire opens; code NOT yet consumed

Respondent submits
  └─ the evaluation is written first
  └─ then runTransaction() on the code:
     re-reads status, aborts if it is no longer unused,
     otherwise sets status: used, usedAt, evaluationId
```

Two properties follow:

- **An abandoned questionnaire does not waste a code.** The old behaviour
  consumed it the moment it was typed.
- **Two simultaneous submissions cannot share a code.** The transaction re-reads
  the status inside the commit, so exactly one wins and the other is told the
  code was just used.

If the code claim fails *after* the evaluation was stored, the respondent is
still shown the success dialog and told plainly that the code could not be
marked used — their evaluation is safe, which is what matters. The code shows as
unused in the dashboard and Admin 1 can correct it.

---

## 6. Account management

| Action | Where | Mechanism |
|---|---|---|
| Create | Office Accounts → Create | Auth user created on a secondary Firebase app, so Admin 1 stays signed in |
| Change username | Row → Username | Rewrites `accounts` and `account_index` together |
| Move to another office | Row → Office | Re-points the mapping; no evaluation or code data moves |
| Deactivate | Row → Deactivate | `status: "inactive"`; rules deny everything, guard signs them out |
| Activate | Row → Activate | `status: "active"` |
| Repair link | Row → Repair link | Rebuilds the index entry and office back-reference after an interrupted creation |
| Revoke | Row → Revoke | Removes the Firestore mapping; the sign-in survives but reaches nothing |

### What needs the Admin SDK

Three operations cannot be done from the browser, because the client SDK can
only act on the *currently signed-in* user:

- **Disabling the sign-in itself.** Deactivation blocks all data access and
  signs the account out, which is sufficient in practice — but the credentials
  still authenticate. `setOfficeAccountDisabled` closes that.
- **Setting someone else's password.** Use `setOfficeAccountPassword`, or delete
  and recreate the account.
- **Deleting an Authentication user.** Use `deleteOfficeAccount`, or remove it
  in the Firebase console.

Deploy `functions/` if you want these. Without them, deactivate + revoke, then
delete the user in the console.

> Office usernames resolve to `<username>@offices.campusvoice.isufst`, which is
> not a real mailbox — so password-reset emails cannot be delivered. Reset
> passwords from this page, not by email.

---

## 7. Summary Analytics

`office-analytics.html` serves both Admin 1 and the office accounts from one
implementation, keeping the existing layout and visual style.

- **Summary cards** — Total Evaluations, Avg Satisfaction, Overall Rating with
  its descriptive label, Respondents
- **Evaluation Dimensions** — mean per criterion, flipping to horizontal bars on
  phones
- **Transaction Code Usage** — generated / used / unused totals, donut, legend
  with counts, usage rate
- **Evaluations Over Time** — switchable between average rating and number of
  evaluations
- **Dimension Breakdown** — rating out of 5 and satisfaction %, with progress
  bars
- **Filters** — office, start date, end date, evaluation category

Every figure comes from `computeAnalytics()` in `cv-core.js`, so the cards,
charts and table are computed once from the same filtered list and cannot
disagree with one another.

### How the figures are calculated

- **Dimensions.** `sqd1`–`sqd8` map to Responsiveness, Reliability, Access &
  Facilities, Communication, Costs, Integrity, Assurance, Outcome. `sqd0` is the
  overall-satisfaction item and is reported separately, not as a ninth
  dimension.
- **"N/A" is excluded, not zeroed.** A respondent answering N/A on Costs does
  not drag that dimension towards zero — the previous behaviour, which parsed
  N/A to 0, understated every office that had any.
- **Overall rating** is the mean of the dimensions with at least one response.
- **Satisfaction %** is `overall / 5 × 100`.
- **Respondents** counts distinct `userId`s, with each anonymous submission
  counted once on its own — so it is a true unique count rather than a copy of
  the evaluation total.

The office switcher is disabled for office accounts and enabled for Admin 1. The
lock is in the rules; the disabled dropdown is only the visible half.

---

## 8. Office navigation

| Page | Purpose |
|---|---|
| Dashboard | Totals, rating, codes remaining, latest comments |
| Transaction Codes | Generate in batches, filter by status and generation date, export |
| Summary Analytics | As §7 |

Evaluation Management and Reports were removed from the office navigation.
An office account's own evaluation data still feeds its Dashboard and Summary
Analytics (both read `services/evaluations/records` filtered to that office),
but there is no longer a dedicated page for browsing individual submissions,
updating feedback status, or exporting a per-office report.

---

## 9. Troubleshooting

**"Invalid credentials" for an administrator who has never signed in since the
upgrade**
Their Authentication account is created on the first successful sign-in, which
reads `admin_settings`. If the rules are already deployed, that read is denied
and only the seed passwords in §3 will work. Create the user in the Firebase
console (`adminN@campusvoice.isufst`) and add an `accounts/{uid}` document with
the right role and `status: "active"`.

**"Your dashboard password was changed in the database but your secure login
still uses the previous one"**
`admin_settings` was edited after the Authentication account was created. Sign
in with the earlier password, or reset it in the Firebase console.

**An office sees "You do not have permission to view this data"**
Check `accounts/{uid}`: `status` must be `active` and `officeId` must match a
live document under `services/offices/records`. Use **Repair link** if the
office's `accountUid` is missing.

**A respondent's code is rejected as invalid even though it exists**
It is still in the legacy location. Run **Migrate codes for all offices**.

**The app says a code belongs to a different office**
Working as intended. Either the wrong office was selected, or the code really
was issued elsewhere. The office that issued it is named in the message.

**Summary Analytics shows no evaluations for an office that clearly has some**
Those records predate `officeId` stamping *and* the office has since been
renamed, so neither query matches. Run the `backfillEvaluationOfficeIds` Cloud
Function, which stamps `officeId` by matching the office name.

**Charts do not render**
Chart.js is loaded from a CDN; the card shows a readable message when it is
unreachable. Check the connection.

**`FirebaseError: Firebase App named '[DEFAULT]' already exists with different
options` after editing a page**
Every page now loads `cv-core.js`, which initialises the default Firebase app —
and the older pages still call `initializeApp(firebaseConfig)` themselves.
Firebase returns the existing app when the options are *identical* and throws
when they differ. Nine pages were missing `databaseURL`; all sixteen config
literals are now byte-identical. **If you add or edit a `firebaseConfig` block,
copy it verbatim from `cv-core.js`.** New pages should skip the literal
entirely and import `db` / `auth` from `cv-core.js` instead.

---

## 10. What was deliberately left alone

- Admin 2 (Cleanliness) and Admin 3 (Facilities) keep their own collections,
  pages and workflows untouched, apart from the sign-in gate every page now
  carries.
- The visual design, colour scheme, navigation, branding and layout are
  unchanged; the new pages reuse `shared.css` plus the extracted analytics
  styles.
- Existing evaluation records are neither migrated nor duplicated. Analytics is
  computed from them directly, and the legacy code documents are kept rather
  than deleted.
