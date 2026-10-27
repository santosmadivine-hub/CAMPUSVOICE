/* ============================================================================
 * CampusVoice — office account provisioning (ES module)
 *
 * Admin 1 only. Creates, updates, activates and deactivates the Firebase
 * Authentication account that belongs to each campus unit or office.
 *
 * Credentials live in Firebase Authentication. Firestore stores only the
 * office/role mapping — never a password, hashed or otherwise.
 *
 * Why a secondary Firebase app:
 *   createUserWithEmailAndPassword() signs the *current* session in as the
 *   newly created user. Running it on a second, throwaway app instance means
 *   Admin 1 stays signed in on the primary app while the new office account is
 *   provisioned on the side. This is the supported client-side pattern and
 *   needs no Cloud Functions.
 *
 * Operations that genuinely require the Admin SDK — disabling an account at
 * the Auth layer, deleting an Auth user, setting someone else's password —
 * are implemented as Firestore status flags enforced by Security Rules, and
 * the optional Cloud Functions in ./functions/ upgrade them to true Auth-level
 * actions when deployed. See SETUP-OFFICE-ACCOUNTS.md.
 * ========================================================================== */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  db, auth, firebaseConfig, PATHS, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, query, where, collection, writeBatch, runTransaction,
  toMillis, normalizeName, friendlyError
} from "./cv-core.js";

/* ----------------------------------------------------------------------------
 * Username / email conventions
 * -------------------------------------------------------------------------- */

/** Office accounts sign in with a username; this is the address behind it. */
export const OFFICE_EMAIL_DOMAIN = "offices.campusvoice.isufst";

export function usernameToEmail(username) {
  const u = String(username || "").trim();
  if (!u) return "";
  if (u.includes("@")) return u.toLowerCase();
  return `${slugUsername(u)}@${OFFICE_EMAIL_DOMAIN}`;
}

/** Usernames are lowercase, dot-free and safe for an email local-part. */
export function slugUsername(value) {
  return String(value || "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .substring(0, 48);
}

/** Suggests a username from an office name, e.g. "Registrar's Office" -> "registrars-office". */
export function suggestUsername(officeName) {
  return slugUsername(officeName) || "office";
}

export function validateUsername(username) {
  const u = slugUsername(username);
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (!/^[a-z0-9]/.test(u)) return "Username must start with a letter or number.";
  return null;
}

export function validatePassword(password) {
  const p = String(password || "");
  if (p.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/i.test(p)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(p)) return "Password must contain at least one number.";
  return null;
}

/** A password Admin 1 can hand over once; the office changes it on first sign-in. */
export function suggestPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  let out = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
  // Guarantee the generated value satisfies validatePassword().
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + "7";
  if (!/[a-z]/i.test(out)) out = "a" + out.slice(1);
  return out;
}

/* ----------------------------------------------------------------------------
 * Reading accounts
 * -------------------------------------------------------------------------- */

export async function fetchAccounts() {
  const snap = await getDocs(PATHS.accounts());
  return snap.docs.map(d => {
    const a = d.data() || {};
    return {
      uid: d.id,
      role: a.role || "",
      officeId: a.officeId || "",
      officeName: a.officeName || "",
      username: a.username || "",
      email: a.email || "",
      status: a.status || "active",
      createdAt: toMillis(a.createdAt),
      createdBy: a.createdBy || "",
      updatedAt: toMillis(a.updatedAt),
      lastLoginAt: toMillis(a.lastLoginAt)
    };
  });
}

export async function fetchOfficeAccounts() {
  const all = await fetchAccounts();
  return all
    .filter(a => a.role === "office")
    .sort((a, b) => (a.officeName || "").localeCompare(b.officeName || ""));
}

/** True when some other account already holds this username. */
export async function usernameTaken(username, exceptUid = "") {
  const key = slugUsername(username);
  if (!key) return false;
  const snap = await getDoc(PATHS.accountIndex(key));
  if (!snap.exists()) return false;
  return (snap.data()?.uid || "") !== exceptUid;
}

/** True when this office already has an account (one account per office). */
export async function officeHasAccount(officeId, exceptUid = "") {
  const snap = await getDocs(query(PATHS.accounts(), where("officeId", "==", officeId)));
  return snap.docs.some(d => d.id !== exceptUid);
}

/* ----------------------------------------------------------------------------
 * Creating an office account
 * -------------------------------------------------------------------------- */

/**
 * Creates the Firebase Auth user for an office and writes its role mapping.
 *
 * @param {object}   p
 * @param {string}   p.officeId    doc id under services/offices/records
 * @param {string}   p.officeName
 * @param {string}   p.username
 * @param {string}   p.password    handed to the office once; never stored
 * @param {string}   p.createdBy   uid of the signed-in Admin 1
 * @returns {Promise<{uid:string, username:string, email:string}>}
 */
export async function createOfficeAccount({ officeId, officeName, username, password, createdBy }) {
  if (!officeId)   throw new Error("Select the office this account belongs to.");
  if (!officeName) throw new Error("The selected office has no name.");

  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const user = slugUsername(username);
  const email = usernameToEmail(user);

  if (await usernameTaken(user))
    throw new Error(`The username "${user}" is already in use.`);

  if (await officeHasAccount(officeId))
    throw new Error(`${officeName} already has an account. Edit that account instead.`);

  // --- provision the Auth user on a throwaway app so Admin 1 stays signed in ---
  const secondary = initializeApp(firebaseConfig, `cv-provision-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);
  let uid;

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    uid = cred.user.uid;
  } catch (err) {
    await signOutSecondary(secondaryAuth).catch(() => {});
    await deleteApp(secondary).catch(() => {});
    throw new Error(friendlyError(err));
  }

  await signOutSecondary(secondaryAuth).catch(() => {});
  await deleteApp(secondary).catch(() => {});

  // --- role mapping, username index and the office back-reference, together ---
  const now = Date.now();
  const batch = writeBatch(db);

  batch.set(PATHS.account(uid), {
    role: "office",
    officeId,
    officeName,
    username: user,
    email,
    status: "active",
    permissions: OFFICE_PERMISSIONS,
    createdAt: now,
    createdBy: createdBy || "",
    updatedAt: now
  });

  batch.set(PATHS.accountIndex(user), { uid, email, role: "office", officeId });

  batch.update(PATHS.office(officeId), {
    accountUid: uid,
    accountEmail: email,
    accountUsername: user,
    status: "active"
  });

  try {
    await batch.commit();
  } catch (err) {
    // The Auth user now exists without a role mapping, so it can sign in but
    // reach nothing. Say so plainly rather than reporting a clean success.
    throw new Error(
      "The login was created but its office link could not be saved " +
      `(${friendlyError(err)}). Use "Repair account link" on the account row to finish setup.`
    );
  }

  return { uid, username: user, email };
}

/** The capability set an office account carries. Read by the UI and the rules. */
export const OFFICE_PERMISSIONS = {
  viewOwnDashboard:    true,
  viewOwnEvaluations:  true,
  viewOwnAnalytics:    true,
  generateOwnCodes:    true,
  exportOwnReports:    true,
  manageAccounts:      false,
  viewAllOffices:      false,
  switchOffice:        false
};

/* ----------------------------------------------------------------------------
 * Updating / activating / deactivating
 * -------------------------------------------------------------------------- */

/** Renames the account's username, keeping the lookup index consistent. */
export async function changeAccountUsername(uid, newUsername) {
  const next = slugUsername(newUsername);
  const error = validateUsername(next);
  if (error) throw new Error(error);

  const snap = await getDoc(PATHS.account(uid));
  if (!snap.exists()) throw new Error("That account no longer exists.");

  const current = snap.data() || {};
  if (current.username === next) return { changed: false };

  if (await usernameTaken(next, uid))
    throw new Error(`The username "${next}" is already in use.`);

  const batch = writeBatch(db);
  batch.update(PATHS.account(uid), { username: next, updatedAt: Date.now() });
  batch.set(PATHS.accountIndex(next), {
    uid,
    email: current.email || "",
    role: current.role || "office",
    officeId: current.officeId || ""
  });
  if (current.username) batch.delete(PATHS.accountIndex(current.username));
  if (current.officeId) batch.update(PATHS.office(current.officeId), { accountUsername: next });

  await batch.commit();

  // The Auth sign-in address is derived from the username, so it no longer
  // matches. The login page resolves usernames through account_index, which
  // this batch just updated, so sign-in keeps working on the stored email.
  return { changed: true, username: next };
}

/** Moves an account to a different office. */
export async function reassignAccountOffice(uid, officeId, officeName) {
  if (!officeId) throw new Error("Select an office.");

  if (await officeHasAccount(officeId, uid))
    throw new Error(`${officeName} already has an account.`);

  const snap = await getDoc(PATHS.account(uid));
  if (!snap.exists()) throw new Error("That account no longer exists.");
  const previous = snap.data() || {};

  const batch = writeBatch(db);
  batch.update(PATHS.account(uid), { officeId, officeName, updatedAt: Date.now() });
  batch.update(PATHS.office(officeId), {
    accountUid: uid,
    accountEmail: previous.email || "",
    accountUsername: previous.username || ""
  });
  if (previous.officeId && previous.officeId !== officeId) {
    batch.update(PATHS.office(previous.officeId), {
      accountUid: "", accountEmail: "", accountUsername: ""
    });
  }
  if (previous.username) {
    batch.set(PATHS.accountIndex(previous.username), {
      uid, email: previous.email || "", role: previous.role || "office", officeId
    });
  }

  await batch.commit();
}

/**
 * Activates or deactivates an office account.
 *
 * A deactivated account can still authenticate, but Security Rules deny every
 * read and write while status !== "active", and the page guard signs it out on
 * arrival. Deploy the optional Cloud Function to also disable the Auth user so
 * the sign-in itself is refused.
 */
export async function setAccountStatus(uid, status) {
  if (!["active", "inactive"].includes(status))
    throw new Error("Status must be active or inactive.");

  const snap = await getDoc(PATHS.account(uid));
  if (!snap.exists()) throw new Error("That account no longer exists.");
  const account = snap.data() || {};

  const batch = writeBatch(db);
  batch.update(PATHS.account(uid), { status, updatedAt: Date.now() });
  if (account.officeId) batch.update(PATHS.office(account.officeId), { status });
  await batch.commit();
}

/** Emails a password-reset link. Only works for a real, deliverable address. */
export async function sendAccountPasswordReset(email) {
  if (!email) throw new Error("This account has no email address on file.");
  if (email.endsWith(`@${OFFICE_EMAIL_DOMAIN}`)) {
    throw new Error(
      "This account uses an internal username, not a real mailbox, so no reset " +
      "email can be delivered. Set a new password for the office directly instead."
    );
  }
  await sendPasswordResetEmail(auth, email);
}

/**
 * Removes the Firestore role mapping for an account.
 *
 * The Firebase Auth user itself survives — deleting another user's Auth record
 * requires the Admin SDK. With no role mapping and no index entry the account
 * can authenticate but reach nothing, which is why it is deactivated first.
 */
export async function revokeAccount(uid) {
  const snap = await getDoc(PATHS.account(uid));
  if (!snap.exists()) return;
  const account = snap.data() || {};

  const batch = writeBatch(db);
  batch.delete(PATHS.account(uid));
  if (account.username) batch.delete(PATHS.accountIndex(account.username));
  if (account.officeId) {
    batch.update(PATHS.office(account.officeId), {
      accountUid: "", accountEmail: "", accountUsername: ""
    });
  }
  await batch.commit();
}

/**
 * Rewrites the index entry and office back-reference from the account record.
 * Fixes an account whose creation was interrupted part-way.
 */
export async function repairAccountLink(uid) {
  const snap = await getDoc(PATHS.account(uid));
  if (!snap.exists()) throw new Error("That account no longer exists.");
  const a = snap.data() || {};

  const batch = writeBatch(db);
  if (a.username) {
    batch.set(PATHS.accountIndex(a.username), {
      uid, email: a.email || "", role: a.role || "office", officeId: a.officeId || ""
    });
  }
  if (a.officeId) {
    batch.update(PATHS.office(a.officeId), {
      accountUid: uid, accountEmail: a.email || "", accountUsername: a.username || ""
    });
  }
  await batch.commit();
}

/* ----------------------------------------------------------------------------
 * Legacy transaction-code migration
 * -------------------------------------------------------------------------- */

/**
 * Copies codes from services/transaction_code/office_name/{officeName}/codes
 * into the canonical transaction_codes collection, stamping each with its
 * officeId.
 *
 * Existing canonical codes are never overwritten, so the migration is safe to
 * run more than once. The legacy documents are left in place — nothing is
 * deleted — so a code in circulation keeps resolving either way.
 *
 * @returns {Promise<{migrated:number, skipped:number}>}
 */
export async function migrateLegacyCodes(officeId, officeName, generatedBy) {
  if (!officeId || !officeName) throw new Error("Office id and name are both required.");

  const legacy = await getDocs(PATHS.legacyOfficeCodes(officeName));
  let migrated = 0;
  let skipped = 0;

  for (const d of legacy.docs) {
    const c = d.data() || {};
    const code = String(c.code || d.id).trim().toUpperCase();
    if (!code) { skipped++; continue; }

    try {
      await runTransaction(db, async (tx) => {
        const ref = PATHS.code(code);
        if ((await tx.get(ref)).exists()) throw new Error("exists");

        tx.set(ref, {
          code,
          officeId,
          officeName,
          status: String(c.status || "unused").toLowerCase() === "used" ? "used" : "unused",
          category: "Services",
          generatedAt: toMillis(c.createdAt ?? c.generatedAt) || Date.now(),
          generatedBy: c.generatedBy || generatedBy || "migration",
          usedAt: toMillis(c.usedAt) || null,
          evaluationId: c.evaluationId || null,
          migratedFrom: `services/transaction_code/office_name/${officeName}/codes/${d.id}`
        });
      });
      migrated++;
    } catch (err) {
      if (err?.message === "exists") { skipped++; continue; }
      throw err;
    }
  }

  return { migrated, skipped };
}

/* ----------------------------------------------------------------------------
 * Administrator bootstrap
 * -------------------------------------------------------------------------- */

/**
 * Writes the role mapping for one of the three built-in administrators.
 *
 * Called by the login page the first time an admin signs in after this
 * upgrade, once their Firebase Auth account has been created from the
 * credentials they just typed. Existing admin behaviour is unchanged — they
 * keep the same username and password.
 */
export async function ensureAdminAccount(uid, role, email, username) {
  const existing = await getDoc(PATHS.account(uid));
  const now = Date.now();

  if (existing.exists()) {
    await updateDoc(PATHS.account(uid), { lastLoginAt: now });
    return;
  }

  const batch = writeBatch(db);
  batch.set(PATHS.account(uid), {
    role,
    officeId: "",
    officeName: "",
    username: username || role,
    email,
    status: "active",
    permissions: {
      ...OFFICE_PERMISSIONS,
      manageAccounts: role === "admin1",
      viewAllOffices: true,
      switchOffice:   role === "admin1"
    },
    createdAt: now,
    createdBy: "bootstrap",
    updatedAt: now,
    lastLoginAt: now
  });
  batch.set(PATHS.accountIndex(username || role), { uid, email, role, officeId: "" });
  await batch.commit();
}

export async function recordLogin(uid) {
  try { await updateDoc(PATHS.account(uid), { lastLoginAt: Date.now() }); }
  catch (err) { console.warn("Could not record the login timestamp:", err?.code || err); }
}
