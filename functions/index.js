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
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

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

/* ---------------------------------------------------------------------------
 * migrateToFacilitiesCleanliness
 *
 * One-off migration for the Cleanliness+Facilities merge. Moves data from three
 * legacy collections into new unified ones, maintaining half-populated records
 * (not fabricated combined ones) for historical accuracy.
 *
 * Three-pass operation:
 *   1. Office registry: union offices, office-names-comfort-room, office_names_surroundings
 *   2. Evaluations: move cleanliness + facilities records into facilities_cleanliness_evaluations
 *   3. Report settings: seed the new admin's settings from admin2's if not present
 *
 * Safe to run repeatedly; already-migrated records are skipped.
 * Uses same batching pattern as backfillEvaluationOfficeIds (450 per batch).
 * ------------------------------------------------------------------------- */
exports.migrateToFacilitiesCleanliness = onCall(async (request) => {
  await requireAdmin1(request);

  let officesCreated = 0;
  let officesSkipped = 0;
  let evalsMigrated = 0;
  let evalsSkipped = 0;
  let reportSettingsSeeded = false;

  // Pass 1: Office registry — collect distinct names and create fc_offices.
  try {
    const officeNames = new Set();

    // Collect from all three legacy sources.
    const facilitiesOfficeSn = await db.collection("offices").get();
    facilitiesOfficeSn.forEach(doc => {
      const name = (doc.data() || {}).name;
      if (name) officeNames.add(name.trim());
    });

    const comfortSnap = await db.collection("office-names-comfort-room").get();
    comfortSnap.forEach(doc => {
      const name = (doc.data() || {}).name;
      if (name) officeNames.add(name.trim());
    });

    const surroundingsSnap = await db.collection("office_names_surroundings").get();
    surroundingsSnap.forEach(doc => {
      const name = (doc.data() || {}).name;
      if (name) officeNames.add(name.trim());
    });

    // Create fc_offices docs, idempotent on normalized name.
    const batch = db.batch();
    let pending = 0;

    for (const name of officeNames) {
      // Check if this office already exists in fc_offices (idempotency).
      const existing = await db.collection("fc_offices")
        .where("name", "==", name)
        .limit(1)
        .get();

      if (existing.size > 0) {
        officesSkipped++;
        continue;
      }

      const docId = db.collection("fc_offices").doc().id;
      batch.set(db.doc(`fc_offices/${docId}`), {
        name,
        status: "active",
        createdAt: Date.now(),
        createdBy: request.auth.uid,
        legacySourceCollections: [], // Would be filled if we tracked source per office
        legacyDocIds: {}
      });

      officesCreated++;
      pending++;

      if (pending >= 450) {
        await batch.commit();
        pending = 0;
      }
    }

    if (pending > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("Office migration failed:", err);
    throw new HttpsError("internal", `Office migration failed: ${err.message}`);
  }

  // Pass 2: Evaluations — migrate from legacy nested/flat into unified collection.
  try {
    // Cleanliness is nested: cleanliness_evaluations/{category}/offices/{officeName}/evaluations/{id}
    const cleanlinessRoot = await db.collection("cleanliness_evaluations").get();

    for (const categoryDoc of cleanlinessRoot.docs) {
      const categoryId = categoryDoc.id; // "Comfort Room" or "Surroundings"

      const officesRef = categoryDoc.ref.collection("offices");
      const officesSnap = await officesRef.get();

      for (const officeDoc of officesSnap.docs) {
        const evalsRef = officeDoc.ref.collection("evaluations");
        const evalsSnap = await evalsRef.get();

        let batch = db.batch();
        let pending = 0;

        for (const evalDoc of evalsSnap.docs) {
          const data = evalDoc.data() || {};
          const evaluationId = data.evaluationId || evalDoc.id;

          // Check if already migrated (idempotency).
          if (data.migratedFrom) {
            evalsSkipped++;
            continue;
          }

          // Check if already exists in new collection (second idempotency check).
          const existing = await db.doc(`facilities_cleanliness_evaluations/${evaluationId}`).get();
          if (existing.exists) {
            evalsSkipped++;
            continue;
          }

          // Build the half-populated new record: only the Cleanliness section.
          const newRecord = {
            evaluationId,
            officeName: data.officeName || officeDoc.id,
            userId: data.userId || "",
            date: data.date || "",
            timestamp: data.timestamp || 0,
            sex: data.sex || "",
            userCategory: data.userCategory || "",
            course: data.course || "",
            year: data.year || "",
            category: "Facilities and Cleanliness",
            cleanlinessCategory: categoryId,
            cleanlinessRating1: data.rating1,
            cleanlinessRating2: data.rating2,
            cleanlinessRating3: data.rating3,
            cleanlinessRating4: data.rating4,
            cleanlinessRating5: data.rating5,
            cleanlinessComments: data.comments || "",
            evidenceUrls: data.evidenceUrls || [],
            evidenceTypes: data.evidenceTypes || [],
            status: data.status || "pending",
            migratedFrom: `cleanliness_evaluations/${categoryId}/offices/${officeDoc.id}/evaluations/${evalDoc.id}`,
            legacyCategory: "Cleanliness"
          };

          batch.set(db.doc(`facilities_cleanliness_evaluations/${evaluationId}`), newRecord);
          evalsMigrated++;
          pending++;

          if (pending >= 450) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
          }
        }

        if (pending > 0) {
          await batch.commit();
        }
      }
    }

    // Facilities: flat collection facility_evaluations/{id}
    const facilitiesSnap = await db.collection("facility_evaluations").get();

    let batch = db.batch();
    let pending = 0;

    for (const evalDoc of facilitiesSnap.docs) {
      const data = evalDoc.data() || {};
      const evaluationId = data.evaluationId || evalDoc.id;

      // Check if already migrated.
      if (data.migratedFrom) {
        evalsSkipped++;
        continue;
      }

      // Check if already exists in new collection.
      const existing = await db.doc(`facilities_cleanliness_evaluations/${evaluationId}`).get();
      if (existing.exists) {
        evalsSkipped++;
        continue;
      }

      // Build the half-populated new record: only the Facilities section.
      const newRecord = {
        evaluationId,
        officeName: data.officeName || "",
        userId: data.userId || "",
        date: data.date || "",
        timestamp: data.timestamp || 0,
        sex: data.sex || "",
        userCategory: data.userCategory || "",
        course: data.course || "",
        year: data.year || "",
        category: "Facilities and Cleanliness",
        facilitiesRating1: data.rating1,
        facilitiesRating2: data.rating2,
        facilitiesRating3: data.rating3,
        facilitiesRating4: data.rating4,
        facilitiesRating5: data.rating5,
        facilitiesRating6: data.rating6,
        facilitiesRating7: data.rating7,
        facilitiesRating8: data.rating8,
        facilitiesComments: data.comments || "",
        events: data.events || "",
        evidenceUrls: data.evidenceUrls || [],
        evidenceTypes: data.evidenceTypes || [],
        status: data.status || "pending",
        migratedFrom: `facility_evaluations/${evalDoc.id}`,
        legacyCategory: "Facilities"
      };

      batch.set(db.doc(`facilities_cleanliness_evaluations/${evaluationId}`), newRecord);
      evalsMigrated++;
      pending++;

      if (pending >= 450) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }

    if (pending > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("Evaluation migration failed:", err);
    throw new HttpsError("internal", `Evaluation migration failed: ${err.message}`);
  }

  // Pass 3: Report settings — seed adminfc from admin2 if not present.
  try {
    const adminFcSettings = await db.doc("reportSettingsAdminFC/current").get();

    if (!adminFcSettings.exists) {
      const admin2Settings = await db.doc("reportSettingsAdmin2/current").get();

      if (admin2Settings.exists) {
        const admin2Data = admin2Settings.data() || {};

        await db.doc("reportSettingsAdminFC/current").set({
          ...admin2Data,
          reportTitle: "Facilities and Cleanliness Evaluation Report (FCER)"
        });

        reportSettingsSeeded = true;
      }
    }
  } catch (err) {
    console.error("Report settings seeding failed:", err);
    // Non-fatal: continue even if report settings couldn't be seeded.
  }

  return {
    ok: true,
    officesCreated,
    officesSkipped,
    evalsMigrated,
    evalsSkipped,
    reportSettingsSeeded,
    message:
      `Migration complete. ` +
      `Created ${officesCreated} offices (${officesSkipped} skipped). ` +
      `Migrated ${evalsMigrated} evaluations (${evalsSkipped} skipped). ` +
      `Report settings ${reportSettingsSeeded ? "seeded" : "not needed"}.`
  };
});

/* ---------------------------------------------------------------------------
 * Push notifications — the Android app's in-app bell (NotificationsDialog)
 * only ever updates while the app is open. These two triggers pop a real
 * system notification on the respondent's phone for the two events worth
 * interrupting someone for: an admin's reply, and an evaluation status
 * change. Routine login/logout/eval_submitted notices stay in-app only.
 * ------------------------------------------------------------------------- */

/** The FCM token CampusVoiceMessagingService/HomeActivity save at users/{uid}.fcmToken. */
async function getUserPushToken(uid) {
  if (!uid) return null;
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? (snap.data() || {}).fcmToken || null : null;
}

/**
 * Sends one push. A missing/expired/uninstalled-app token is routine (the
 * respondent may simply never have opened the app with this feature yet, or
 * uninstalled it) — logged, not thrown, so it never fails the Firestore write
 * that triggered this.
 */
async function sendPush(token, title, body, data = {}) {
  if (!token) return;

  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      android: { priority: "high" }
    });
  } catch (err) {
    console.warn("Push notification could not be delivered:", err.code || err.message);
  }
}

// title per notifications/{uid}/items type — only these two are worth a
// phone pop-up; login/logout stay in-app only.
const PUSHED_NOTIFICATION_TITLES = {
  eval_status: "Evaluation Status Updated",
  eval_submitted: "Evaluation Submitted"
};

exports.notifyOnEvalStatusChange = onDocumentCreated(
  "notifications/{uid}/items/{itemId}",
  async (event) => {
    const data = event.data?.data();
    const title = data && PUSHED_NOTIFICATION_TITLES[data.type];
    if (!title) return;

    const token = await getUserPushToken(event.params.uid);
    await sendPush(
      token,
      title,
      data.message || "One of your evaluations has an update.",
      { type: data.type, evaluationId: data.evaluationId || "" }
    );
  }
);

exports.notifyOnAdminReply = onDocumentCreated(
  "conversations/{evaluationId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    // The respondent's own messages (senderRole "user") never trigger this —
    // there is nothing to push back to them for a message they just sent.
    if (!message || message.senderRole !== "admin") return;

    const convoSnap = await db.doc(`conversations/${event.params.evaluationId}`).get();
    if (!convoSnap.exists) return;
    const convo = convoSnap.data() || {};

    const token = await getUserPushToken(convo.userId);
    await sendPush(
      token,
      convo.officeName ? `New message about your ${convo.officeName} evaluation` : "New message",
      message.text || "You have a new reply.",
      { type: "new_message", evaluationId: event.params.evaluationId }
    );
  }
);
