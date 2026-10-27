/* ============================================================================
 * CampusVoice — Cloud Functions for sensitive administrative operations
 * ISUFST-SEC · School Evaluation System
 *
 * OPTIONAL. The web dashboard works without these: deactivation is enforced by
 * Firestore Security Rules (`accounts/{uid}.status != 'active'` denies every
 * read and write), and office accounts are created client-side on a secondary
 * Firebase app so Admin 1 keeps their session.
 *
 * Three things, though, can only be done by the Firebase Admin SDK:
 *
 *   setOfficeAccountDisabled — refuse the sign-in itself, not just the data
 *   setOfficeAccountPassword — set a new password for an office that lost theirs
 *   deleteOfficeAccount      — remove the Authentication user entirely
 *
 * Deploy:
 *   cd functions && npm install
 *   firebase deploy --only functions
 *
 * Every function verifies that the caller is the signed-in Admin 1, by reading
 * accounts/{uid} server-side. A caller's claim about their own role is never
 * trusted.
 * ========================================================================== */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const auth = getAuth();

const SUPER_ADMIN = "admin1";

/* ---------------------------------------------------------------------------
 * Authorisation
 * ------------------------------------------------------------------------- */

/**
 * Confirms the caller is signed in as an active Admin 1.
 * Reads the role from Firestore rather than from anything the client sent.
 */
async function requireAdmin1(request) {
  const uid = request.auth && request.auth.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to perform this action.");
  }

  const snap = await db.doc(`accounts/${uid}`).get();

  if (!snap.exists) {
    throw new HttpsError("permission-denied", "This account has no role assigned.");
  }

  const account = snap.data() || {};

  if (account.role !== SUPER_ADMIN || account.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Only the main administrator (Admin 1) can manage office accounts."
    );
  }

  return { uid, account };
}

/** Loads the target office account and refuses anything that is not one. */
async function requireOfficeAccount(uid) {
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "An account id is required.");
  }

  const snap = await db.doc(`accounts/${uid}`).get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "That account no longer exists.");
  }

  const account = snap.data() || {};

  // Guards against an administrator account being disabled or deleted here,
  // which would lock the campus out of its own dashboard.
  if (account.role !== "office") {
    throw new HttpsError(
      "failed-precondition",
      "This function only manages office accounts, not administrator accounts."
    );
  }

  return account;
}

/* ---------------------------------------------------------------------------
 * setOfficeAccountDisabled
 *
 * Disables or re-enables the Authentication user, so a deactivated office
 * cannot even sign in. Keeps the Firestore status flag in step, which is what
 * the Security Rules read.
 * ------------------------------------------------------------------------- */
exports.setOfficeAccountDisabled = onCall(async (request) => {
  const caller = await requireAdmin1(request);

  const { uid, disabled } = request.data || {};

  if (typeof disabled !== "boolean") {
    throw new HttpsError("invalid-argument", "`disabled` must be true or false.");
  }

  const account = await requireOfficeAccount(uid);

  await auth.updateUser(uid, { disabled });

  // Revoke outstanding refresh tokens so an already-open session cannot keep
  // working until its ID token happens to expire.
  if (disabled) {
    await auth.revokeRefreshTokens(uid);
  }

  const status = disabled ? "inactive" : "active";
  const batch = db.batch();

  batch.update(db.doc(`accounts/${uid}`), {
    status,
    authDisabled: disabled,
    updatedAt: Date.now(),
    updatedBy: caller.uid
  });

  if (account.officeId) {
    batch.update(db.doc(`services/offices/records/${account.officeId}`), { status });
  }

  await batch.commit();

  return {
    ok: true,
    uid,
    status,
    message: disabled
      ? `${account.username} can no longer sign in.`
      : `${account.username} can sign in again.`
  };
});

/* ---------------------------------------------------------------------------
 * setOfficeAccountPassword
 *
 * Sets a new password for an office that has lost theirs. Admin 1 hands the
 * new password over and the office changes it. The password is never written
 * to Firestore — only the fact that it was reset, and by whom.
 * ------------------------------------------------------------------------- */
exports.setOfficeAccountPassword = onCall(async (request) => {
  const caller = await requireAdmin1(request);

  const { uid, password } = request.data || {};

  if (typeof password !== "string" || password.length < 8) {
    throw new HttpsError("invalid-argument", "The password must be at least 8 characters.");
  }

  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    throw new HttpsError(
      "invalid-argument",
      "The password must contain at least one letter and one number."
    );
  }

  const account = await requireOfficeAccount(uid);

  await auth.updateUser(uid, { password });

  // Force a fresh sign-in everywhere, so an old session cannot continue.
  await auth.revokeRefreshTokens(uid);

  await db.doc(`accounts/${uid}`).update({
    passwordResetAt: Date.now(),
    passwordResetBy: caller.uid,
    updatedAt: Date.now()
  });

  return {
    ok: true,
    uid,
    message: `Password reset for ${account.username}. Hand the new password over securely.`
  };
});

/* ---------------------------------------------------------------------------
 * deleteOfficeAccount
 *
 * Removes the Authentication user and every Firestore trace of the account.
 * The office's evaluations, transaction codes and reports are NOT touched —
 * they belong to the office, not to the login.
 * ------------------------------------------------------------------------- */
exports.deleteOfficeAccount = onCall(async (request) => {
  await requireAdmin1(request);

  const { uid } = request.data || {};
  const account = await requireOfficeAccount(uid);

  // Delete the sign-in first: if the Firestore cleanup then fails, the login
  // is already gone, which fails safe. The reverse order could leave a working
  // login with no role mapping.
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    // An Auth user that is already missing is not an error for this operation.
    if (err.code !== "auth/user-not-found") {
      throw new HttpsError("internal", `Could not delete the sign-in: ${err.message}`);
    }
  }

  const batch = db.batch();
  batch.delete(db.doc(`accounts/${uid}`));

  if (account.username) {
    batch.delete(db.doc(`account_index/${account.username}`));
  }

  if (account.officeId) {
    batch.update(db.doc(`services/offices/records/${account.officeId}`), {
      accountUid: FieldValue.delete(),
      accountEmail: FieldValue.delete(),
      accountUsername: FieldValue.delete()
    });
  }

  await batch.commit();

  return {
    ok: true,
    message: `${account.username} has been deleted. ` +
             `${account.officeName || "The office"}'s evaluations and codes are untouched.`
  };
});

/* ---------------------------------------------------------------------------
 * backfillEvaluationOfficeIds
 *
 * One-off maintenance: stamps `officeId` on service evaluations that predate
 * it, matching on the office name. Analytics works without this — the office
 * pages also query by name — but stamping lets every query use the ID alone.
 *
 * Safe to run repeatedly; already-stamped records are skipped.
 * ------------------------------------------------------------------------- */
exports.backfillEvaluationOfficeIds = onCall(async (request) => {
  await requireAdmin1(request);

  const officesSnap = await db.collection("services/offices/records").get();
  const idByName = new Map();

  officesSnap.forEach((doc) => {
    const name = (doc.data() || {}).name;
    if (name) idByName.set(name, doc.id);
  });

  const evalsSnap = await db.collection("services/evaluations/records").get();

  let stamped = 0;
  let unmatched = 0;
  let alreadyDone = 0;

  let batch = db.batch();
  let pending = 0;

  for (const doc of evalsSnap.docs) {
    const data = doc.data() || {};

    if (data.officeId) { alreadyDone++; continue; }

    const officeId = idByName.get(data.office);
    if (!officeId) { unmatched++; continue; }

    batch.update(doc.ref, { officeId });
    stamped++;
    pending++;

    // Firestore allows 500 writes per batch.
    if (pending >= 450) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();

  return {
    ok: true,
    stamped,
    alreadyDone,
    unmatched,
    message: `Stamped ${stamped} evaluation(s). ` +
             `${alreadyDone} already had an office ID. ` +
             `${unmatched} could not be matched to a registered office by name.`
  };
});
