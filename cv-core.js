/* ============================================================================
 * CampusVoice — shared core module (ES module)
 * ISUFST-SEC · School Evaluation System
 *
 * Single place for:
 *   · Firebase app / auth / firestore singletons
 *   · Session + role guard (Firebase Authentication)
 *   · Office-scoped data access (offices, transaction codes, evaluations)
 *   · Analytics math shared by Summary Analytics, Dashboard and Reports
 *   · CSV / Excel-compatible export helpers
 *
 * Pages import what they need:
 *   import { guard, loadOfficeAnalytics } from "./cv-core.js";
 *
 * The legacy global `shared.js` (buildSidebar / buildTopbar) is untouched —
 * this module adds the office role on top of it.
 * ========================================================================== */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider,
  updateEmail, verifyBeforeUpdateEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, collectionGroup, doc, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where,
  orderBy, limit, writeBatch, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ----------------------------------------------------------------------------
 * 1. Firebase — the existing CampusVoice project, unchanged
 * -------------------------------------------------------------------------- */

export const firebaseConfig = {
  apiKey:            "AIzaSyBGLm1iZIMEfNfZIWbGXs8teGwJXHmLr1E",
  authDomain:        "kristal-adb78.firebaseapp.com",
  databaseURL:       "https://kristal-adb78-default-rtdb.firebaseio.com",
  projectId:         "kristal-adb78",
  storageBucket:     "kristal-adb78.firebasestorage.app",
  messagingSenderId: "1016283938031",
  appId:             "1:1016283938031:web:54c4d13409d9784ad7af1a",
  measurementId:     "G-LK8D1CBQ2J"
};

export const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, addDoc, onSnapshot, query, where, orderBy, limit, writeBatch,
  runTransaction, serverTimestamp, signOut, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider
};

/* ----------------------------------------------------------------------------
 * 2. Firestore paths
 *
 * Office registry stays where the existing system already keeps it —
 * services/offices/records/{officeId}. The top-level `offices` collection is
 * already owned by Admin 3 (facilities), so reusing it would collide.
 * -------------------------------------------------------------------------- */

export const PATHS = {
  offices:      () => collection(db, "services", "offices", "records"),
  office:       (id) => doc(db, "services", "offices", "records", id),
  evaluations:  () => collection(db, "services", "evaluations", "records"),
  evaluation:   (id) => doc(db, "services", "evaluations", "records", id),
  reports:      () => collection(db, "services", "reports", "records"),
  codes:        () => collection(db, "transaction_codes"),
  code:         (codeId) => doc(db, "transaction_codes", codeId),
  accounts:     () => collection(db, "accounts"),
  account:      (uid) => doc(db, "accounts", uid),
  accountIndex: (username) => doc(db, "account_index", String(username).trim().toLowerCase()),
  // Legacy, read-only compatibility: services/transaction_code/office_name/{officeName}/codes/{id}
  legacyCodes:  () => collectionGroup(db, "codes"),
  legacyOfficeCodes: (officeName) =>
    collection(db, "services", "transaction_code", "office_name", officeName, "codes")
};

export const ROLES = {
  admin1: { label: "Admin 1 – Services",    home: "admin1-dashboard.html" },
  admin2: { label: "Admin 2 – Cleanliness", home: "admin2-dashboard.html" },
  admin3: { label: "Admin 3 – Facilities",  home: "admin3-dashboard.html" },
  office: { label: "Office Account",        home: "office-dashboard.html" }
};

/** Admin 1 is the only role allowed to manage accounts and switch offices. */
export const SUPER_ADMIN = "admin1";

/** Auth email convention for the three built-in administrator roles. */
export const adminEmail = (role) => `${role}@campusvoice.isufst`;

/* ----------------------------------------------------------------------------
 * 3. Session + role guard
 * -------------------------------------------------------------------------- */

let cachedSession = null;

/**
 * Resolves the signed-in user to a CampusVoice session:
 *   { uid, email, role, officeId, officeName, status, isAdmin, canSwitchOffice }
 * Resolves to null when nobody is signed in.
 */
export function getSession() {
  if (cachedSession) return Promise.resolve(cachedSession);

  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, async (user) => {
      stop();
      if (!user) return resolve(null);

      let data = {};
      try {
        const snap = await getDoc(PATHS.account(user.uid));
        if (snap.exists()) data = snap.data() || {};
      } catch (err) {
        console.error("Could not read the account record for this user:", err);
      }

      cachedSession = {
        uid:        user.uid,
        email:      user.email || data.email || "",
        role:       data.role || "",
        officeId:   data.officeId || "",
        officeName: data.officeName || "",
        username:   data.username || "",
        status:     data.status || "active",
        photoURL:   data.photoURL || "",
        isAdmin:    String(data.role || "").startsWith("admin"),
        canSwitchOffice: data.role === SUPER_ADMIN
      };
      resolve(cachedSession);
    });
  });
}

export function clearSessionCache() { cachedSession = null; }

/** Updates the cached session in place, e.g. right after a profile photo change. */
function patchSessionCache(patch) {
  if (cachedSession) Object.assign(cachedSession, patch);
}

/**
 * Office accounts and administrators sign in on two separate pages — see
 * index.html (admin1/2/3) and office-login.html (office). Picks whichever one
 * fits the roles a page allows, so a redirect never lands someone on the
 * wrong portal.
 */
function loginPageFor(allowedRoles) {
  if (allowedRoles && allowedRoles.length === 1 && allowedRoles[0] === "office") {
    return "office-login.html";
  }
  return "index.html";
}

/**
 * Page-level access gate. Redirects to the appropriate login page when the
 * visitor is not signed in, lacks an allowed role, or has been deactivated
 * by Admin 1.
 *
 * Firestore Security Rules enforce the same boundaries server-side — this only
 * keeps the UI honest and gives a readable message.
 *
 * @param {string[]} allowedRoles e.g. ["office"] or ["admin1"]
 * @returns {Promise<object>} the session (never null — it redirects instead)
 */
export async function guard(allowedRoles) {
  const session = await getSession();

  if (!session) {
    sessionStorage.setItem("cv-login-notice", "Please sign in to continue.");
    location.replace(loginPageFor(allowedRoles));
    return new Promise(() => {});            // halt the caller
  }

  if (session.status !== "active") {
    await signOut(auth).catch(() => {});
    sessionStorage.setItem("cv-login-notice",
      "This account has been deactivated. Please contact Admin 1.");
    location.replace(session.role === "office" ? "office-login.html" : "index.html");
    return new Promise(() => {});
  }

  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(session.role)) {
    sessionStorage.setItem("cv-login-notice",
      "Your account does not have access to that page.");
    location.replace(ROLES[session.role]?.home || loginPageFor(allowedRoles));
    return new Promise(() => {});
  }

  if (session.role === "office" && !session.officeId) {
    sessionStorage.setItem("cv-login-notice",
      "This office account is not linked to an office yet. Please contact Admin 1.");
    await signOut(auth).catch(() => {});
    location.replace("office-login.html");
    return new Promise(() => {});
  }

  return session;
}

export async function logout() {
  // Read the role BEFORE clearing the cache, so each account type lands back
  // on its own sign-in page rather than a shared one.
  const wasOffice = cachedSession?.role === "office";
  clearSessionCache();
  try { await signOut(auth); } catch (err) { console.error(err); }
  location.replace(wasOffice ? "office-login.html" : "index.html");
}

/* ----------------------------------------------------------------------------
 * 4. Office-account navigation — mirrors shared.js styling exactly
 * -------------------------------------------------------------------------- */

/* Summary Analytics lives inside Dashboard now, so it has no nav entry of
   its own — office-dashboard.html already covers it. Settings is a real
   page (office-settings.html), not a modal, combining Profile, Change
   Password and About App behind one link. */
const OFFICE_NAV = [
  { id: "dashboard", icon: "📊", label: "Dashboard",         href: "office-dashboard.html" },
  { id: "codes",     icon: "🎟", label: "Transaction Codes", href: "office-codes.html" },
  { id: "settings",  icon: "⚙️", label: "Settings",          href: "office-settings.html" }
];

export function buildOfficeSidebar(activePage, session) {
  const officeName = escapeHtml(session?.officeName || "Office");

  return `
    <aside class="sidebar" id="sidebar">

      <div class="sidebar-logo">
        <div class="wordmark">CampusVoice</div>
        <div class="campus">ISUFST-SEC</div>
      </div>

      <div class="sidebar-role role-admin1" title="${officeName}">
        🏢 ${officeName}
      </div>

      <nav class="nav">
        ${OFFICE_NAV.map(n => `
          <a class="nav-item ${n.id === activePage ? "active-a1" : ""}" href="${n.href}">
            <span class="nav-icon">${n.icon}</span>
            <span>${n.label}</span>
          </a>
        `).join("")}
      </nav>

      <div class="sidebar-footer">
        <a class="logout-btn" href="#" id="cv-logout" aria-label="Logout" title="Logout">
          <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="logout-text">Logout</span>
        </a>
      </div>

    </aside>
  `;
}

/**
 * First letter shown on an avatar that has no photo — a stand-in identicon.
 * Exported so office-settings.html can render the same fallback for its own,
 * larger avatar.
 */
export function avatarInitial(session) {
  const source = session?.username || session?.officeName || session?.email || "O";
  return String(source).trim().charAt(0).toUpperCase() || "O";
}

/** The <img> or lettered-circle markup for one avatar, given a photo URL. */
export function avatarInnerHtml(photoURL, initial) {
  return photoURL
    ? `<img src="${escapeHtml(photoURL)}" alt="">`
    : `<span class="avatar-fallback">${escapeHtml(initial)}</span>`;
}

export function buildOfficeTopbar(pageTitle, subtitle, session) {
  return `
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:12px;">
        <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
        <div class="page-heading">
          <div class="page-title">${escapeHtml(pageTitle)}</div>
          ${subtitle ? `<div class="page-subtitle">${escapeHtml(subtitle)}</div>` : ""}
        </div>
      </div>
      <div class="topbar-right">
        <a class="profile-chip" href="office-settings.html" title="Settings">
          <span class="profile-avatar">
            ${avatarInnerHtml(session?.photoURL, avatarInitial(session))}
          </span>
          <span class="profile-info">
            <span class="profile-name">${escapeHtml(session?.username || session?.officeName || "Office")}</span>
            <span class="profile-role">${escapeHtml(roleBadge(session))}</span>
          </span>
        </a>
      </div>
    </div>
  `;
}

function roleBadge(session) {
  if (!session) return "Guest";
  if (session.role === "office") return "Office Administrator";
  return ROLES[session.role]?.label || session.role;
}

/**
 * Mounts the office chrome and wires logout and the existing hamburger
 * toggle. Pages call this once, right after `guard(["office"])`. Settings
 * (profile photo, change password, about app) is office-settings.html, a
 * real page linked from the sidebar and the topbar's profile chip — not
 * something this function injects.
 */
export function mountOfficeChrome({ activePage, title, subtitle, session }) {
  const sidebarMount = document.getElementById("sidebar-mount");
  const topbarMount  = document.getElementById("topbar-mount");

  if (sidebarMount) sidebarMount.innerHTML = buildOfficeSidebar(activePage, session);
  if (topbarMount)  topbarMount.innerHTML  = buildOfficeTopbar(title, subtitle, session);

  const logoutLink = document.getElementById("cv-logout");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => { e.preventDefault(); logout(); });
  }

  // shared.js binds the hamburger on DOMContentLoaded, which has already fired
  // by the time the guard resolves — so bind it again for this freshly injected markup.
  if (typeof window.initSidebarToggle === "function") window.initSidebarToggle();
}

/**
 * Changes the signed-in user's own password — used by office-settings.html's
 * Change Password tab.
 *
 * Changing a password is a sensitive operation, so Firebase Authentication
 * requires a *recent* sign-in before it will allow one — reauthenticating
 * with the current password right here satisfies that and doubles as
 * confirming the current password is actually correct.
 */
export async function changeOwnPassword(currentPassword, newPassword) {
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  if (newPassword === currentPassword) {
    throw new Error("Choose a password different from your current one.");
  }

  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (err) {
    const code = err?.code || "";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      throw new Error("Incorrect current password.");
    }
    throw new Error(friendlyError(err));
  }
}

/**
 * Changes the signed-in user's own Gmail address — used by
 * office-settings.html's Profile section.
 *
 * Tries the direct update first; some Firebase projects enforce email
 * verification before letting the sign-in address change (enumeration
 * protection), which surfaces as `auth/operation-not-allowed` — that case
 * falls back to emailing a confirmation link to the NEW address instead.
 * Firestore's cached `email` is intentionally left untouched until the
 * change is confirmed, either immediately (direct update) or by
 * `syncOwnEmailRecord()` once the real Authentication record has changed —
 * updating it eagerly would point this account's own login at an email
 * Firebase doesn't actually recognise yet.
 *
 * @returns {Promise<{verified:boolean, email:string}>} verified is false
 *   when a confirmation link was sent instead of changing the address outright.
 */
export async function changeOwnEmail(currentPassword, newEmail) {
  const emailError = validateGmailAddress(newEmail);
  if (emailError) throw new Error(emailError);

  const normalizedEmail = String(newEmail).trim().toLowerCase();

  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (normalizedEmail === user.email.toLowerCase()) {
    throw new Error("That is already your current Gmail address.");
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  } catch (err) {
    const code = err?.code || "";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      throw new Error("Incorrect current password.");
    }
    throw new Error(friendlyError(err));
  }

  try {
    await updateEmail(user, normalizedEmail);
    await syncOwnEmailRecord(normalizedEmail);
    return { verified: true, email: normalizedEmail };
  } catch (err) {
    const code = err?.code || "";

    if (code === "auth/operation-not-allowed") {
      await verifyBeforeUpdateEmail(user, normalizedEmail);
      return { verified: false, email: normalizedEmail };
    }
    if (code === "auth/email-already-in-use") {
      throw new Error("That Gmail address is already associated with another account.");
    }
    throw new Error(friendlyError(err));
  }
}

/** Mirrors a just-confirmed email change into Firestore: the account
 *  record, its username index entry, and its office's cached copy. */
async function syncOwnEmailRecord(newEmail) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const snap = await getDoc(PATHS.account(uid));
  const data = snap.exists() ? snap.data() || {} : {};

  const batch = writeBatch(db);
  batch.update(PATHS.account(uid), { email: newEmail, updatedAt: Date.now() });

  if (data.username) {
    batch.set(PATHS.accountIndex(data.username), {
      uid, email: newEmail, role: data.role || "office", officeId: data.officeId || ""
    });
  }
  if (data.officeId) {
    batch.update(PATHS.office(data.officeId), { accountEmail: newEmail });
  }

  await batch.commit();
  patchSessionCache({ email: newEmail });
}

/* ----------------------------------------------------------------------------
 * 4b. Profile photo (Cloudinary)
 *
 * Images are stored with Cloudinary, the same unsigned-upload target the
 * Android app already uses (CloudinaryUploader.kt), so the web side needs no
 * new backend of its own: same cloud name, same upload preset.
 * -------------------------------------------------------------------------- */

const CLOUDINARY_CLOUD_NAME   = "rxe2il0s";
const CLOUDINARY_UPLOAD_PRESET = "campusvoice_upload";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;   // 5MB

/**
 * Uploads an image file straight from the browser to Cloudinary (unsigned
 * preset — no API secret involved) and returns its public URL.
 */
export async function uploadProfilePhoto(file) {
  if (!file) throw new Error("No file selected.");
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG, etc.).");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Images must be 5MB or smaller.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  let response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: form }
    );
  } catch (err) {
    throw new Error("Could not reach the image upload service. Check your internet connection.");
  }

  if (!response.ok) {
    throw new Error("The image upload failed. Please try a different photo.");
  }

  const data = await response.json().catch(() => null);
  if (!data?.secure_url) {
    throw new Error("The image upload did not return a usable address.");
  }
  return data.secure_url;
}

/** Sets or clears the signed-in account's own profile photo. */
export async function updateOwnProfilePhoto(photoURL) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Your session has expired. Please sign in again.");

  await updateDoc(PATHS.account(uid), { photoURL: photoURL || null });
  patchSessionCache({ photoURL: photoURL || "" });
}

/* ----------------------------------------------------------------------------
 * 5. Small utilities
 * -------------------------------------------------------------------------- */

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

/** Accepts millis, numeric strings, ISO strings, Date objects and Firestore Timestamps. */
export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  if (!isNaN(n) && n > 0) return n;
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

/** Local-calendar day key, so date filters match what the user sees. */
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Start of day in local time, from a yyyy-mm-dd <input type="date"> value. */
export function startOfDay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** End of day in local time (inclusive), from a yyyy-mm-dd value. */
export function endOfDay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/**
 * The password policy shared by every account-creation and password-change
 * flow in the app (office account creation, Change Password, etc.). Lives
 * here rather than in cv-accounts.js so this module's own Change Password
 * modal can use it without a circular import; cv-accounts.js re-exports it
 * so existing pages that import it from there keep working unchanged.
 */
export function validatePassword(password) {
  const p = String(password || "");
  if (p.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/i.test(p)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(p)) return "Password must contain at least one number.";
  return null;
}

/**
 * A Gmail address, specifically — @gmail.com or its @googlemail.com alias.
 * Lives here, not cv-accounts.js, for the same reason validatePassword does:
 * this module's own changeOwnEmail() needs it without a circular import.
 */
const GMAIL_PATTERN = /^[a-z0-9](?:[a-z0-9._%+-]{0,63})@(gmail\.com|googlemail\.com)$/i;

export function validateGmailAddress(email) {
  const value = String(email || "").trim();
  if (!value) return "Gmail address is required.";
  if (!GMAIL_PATTERN.test(value)) return "Enter a valid Gmail address (it must end in @gmail.com).";
  return null;
}

/** Turns a Firebase error into something a campus staff member can act on. */
export function friendlyError(err) {
  const code = err?.code || "";
  if (code === "permission-denied")
    return "You do not have permission to view this data. If this is unexpected, contact Admin 1.";
  if (code === "unavailable" || code === "failed-precondition")
    return "Cannot reach the database. Check your internet connection and try again.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential")
    return "Incorrect username or password.";
  if (code === "auth/user-not-found")   return "No account found for that username.";
  if (code === "auth/too-many-requests")return "Too many attempts. Please wait a moment and try again.";
  if (code === "auth/email-already-in-use")
    return "An account already exists for that username or email.";
  if (code === "auth/weak-password")    return "Password must be at least 6 characters.";
  if (code === "auth/network-request-failed")
    return "Network error. Check your internet connection and try again.";
  return err?.message || "Something went wrong. Please try again.";
}

/** Lightweight toast, styled to match the existing admin pages. */
export function toast(message, isError = false) {
  let stack = document.getElementById("cv-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "cv-toast-stack";
    stack.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:10000;display:flex;" +
      "flex-direction:column;gap:10px;align-items:flex-end;pointer-events:none;";
    document.body.appendChild(stack);
  }

  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText =
    "background:#0f172a;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;" +
    "font-family:'DM Sans',sans-serif;box-shadow:0 10px 26px rgba(15,23,42,.28);" +
    "max-width:min(420px,88vw);opacity:0;transform:translateY(8px);" +
    "transition:opacity .25s ease,transform .25s ease;" +
    `border-left:4px solid ${isError ? "#ef4444" : "#38bdf8"};`;
  stack.appendChild(el);

  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 260);
  }, 3800);
}

/* ----------------------------------------------------------------------------
 * 6. Evaluation dimensions
 *
 * The Services questionnaire stores sqd0..sqd8. sqd0 is the overall
 * satisfaction item; sqd1..sqd8 are the eight ARTA service-quality
 * dimensions reported in Summary Analytics. "N/A" answers are excluded
 * from averages rather than counted as zero.
 * -------------------------------------------------------------------------- */

export const DIMENSION_LABELS = [
  "Responsiveness", "Reliability", "Access & Facilities", "Communication",
  "Costs", "Integrity", "Assurance", "Outcome"
];

/** sqd1..sqd8 map onto DIMENSION_LABELS in order. */
export const DIMENSION_FIELDS = ["sqd1","sqd2","sqd3","sqd4","sqd5","sqd6","sqd7","sqd8"];

/**
 * Normalises uploaded evidence into [{ url, type }].
 *
 * Mirrors parseEvidence() in the multimedia pages so one schema is understood
 * everywhere: the current multi-file shape written by the evaluation
 * activities (evidenceUrls[] / evidenceTypes[]), the earlier single-file shape
 * (evidenceUrl / evidenceType), and a fileUrl-only fallback whose type is
 * guessed from the extension.
 */
export function parseEvidence(raw) {
  const items = [];

  if (Array.isArray(raw.evidenceUrls) && raw.evidenceUrls.length) {
    const types = Array.isArray(raw.evidenceTypes) ? raw.evidenceTypes : [];
    raw.evidenceUrls.forEach((url, i) => {
      if (url) items.push({ url, type: types[i] === "video" ? "video" : "image" });
    });
    return items;
  }

  if (raw.evidenceUrl) {
    return [{ url: raw.evidenceUrl, type: raw.evidenceType === "video" ? "video" : "image" }];
  }

  if (raw.fileUrl) {
    const isVideo = /\.(mp4|mov|webm|mkv|avi|m4v|ogg)(\?|$)/i.test(raw.fileUrl);
    return [{ url: raw.fileUrl, type: isVideo ? "video" : "image" }];
  }

  return items;
}

/** Reads one dimension score, tolerating sq#/sqd#/rating# field names and "N/A". */
function dimensionValue(record, index) {
  const n = index + 1;
  const raw = record[`sqd${n}`] ?? record[`sq${n}`] ?? record[`rating${n}`];
  if (raw === undefined || raw === null || raw === "") return null;
  if (String(raw).trim().toUpperCase() === "N/A") return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

/** Normalises a raw Firestore evaluation into the shape analytics works with. */
export function normalizeEvaluation(id, raw) {
  const dims = DIMENSION_LABELS.map((_, i) => dimensionValue(raw, i));
  const answered = dims.filter(v => v !== null);

  return {
    id,
    officeId:   raw.officeId || "",
    office:     raw.office || raw.officeName || "Unknown",
    category:   raw.category || "Services",
    dims,
    avg:        answered.length ? answered.reduce((a, b) => a + b, 0) / answered.length : 0,
    answered:   answered.length,
    userId:     raw.userId || "",
    respondentKey: raw.userId || raw.email || `anon:${id}`,
    suggestions: raw.suggestions || "",
    transactionCode: raw.transactionCode || raw.code || "",
    sex: raw.sex || "", age: raw.age || "", region: raw.region || "",
    clientType: raw.clientType || "", serviceAvailed: raw.serviceAvailed || "",
    cc1: raw.cc1 || "", cc2: raw.cc2 || "", cc3: raw.cc3 || "",
    sqd0: raw.sqd0 ?? "",
    media: parseEvidence(raw),
    timestamp:  toMillis(raw.timestamp ?? raw.submittedAt ?? raw.date),
    status:     raw.feedbackStatus || raw.status || "New",
    raw
  };
}

export function ratingLabel(avg) {
  if (avg >= 4.5) return "Excellent";
  if (avg >= 3.5) return "Very Good";
  if (avg >= 2.5) return "Good";
  if (avg >= 1.5) return "Fair";
  if (avg >  0)   return "Poor";
  return "No data";
}

/**
 * A face that reacts to the same tiers as ratingLabel(), so the two never
 * disagree — low ratings read as unhappy, high ones as pleased. Falls back
 * to the plain office icon when there is nothing to react to yet.
 */
export function ratingEmoji(avg) {
  if (avg >= 4.5) return "😄";
  if (avg >= 3.5) return "🙂";
  if (avg >= 2.5) return "😐";
  if (avg >= 1.5) return "🙁";
  if (avg >  0)   return "😢";
  return "🏢";
}

/**
 * Every number Summary Analytics, the office Dashboard and Reports display,
 * computed from one list of evaluations so the cards, charts and table can
 * never disagree with each other.
 */
export function computeAnalytics(evaluations, codes = []) {
  const total = evaluations.length;

  // Per-dimension mean over the evaluations that actually answered it.
  const dimensions = DIMENSION_LABELS.map((label, i) => {
    const values = evaluations.map(e => e.dims[i]).filter(v => v !== null && v !== undefined);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { label, avg, pct: (avg / 5) * 100, responses: values.length };
  });

  const scored = dimensions.filter(d => d.responses > 0);
  const overall = scored.length ? scored.reduce((a, d) => a + d.avg, 0) / scored.length : 0;

  // Unique respondents: distinct signed-in users, plus each anonymous
  // submission counted once on its own.
  const respondents = new Set(evaluations.map(e => e.respondentKey)).size;

  const timestamps = evaluations.map(e => e.timestamp).filter(Boolean);

  // Evaluations over time, by local calendar day.
  const byDay = {};
  evaluations.forEach(e => {
    if (!e.timestamp) return;
    const key = dayKey(e.timestamp);
    if (!byDay[key]) byDay[key] = { sum: 0, count: 0 };
    byDay[key].sum += e.avg;
    byDay[key].count += 1;
  });
  const trend = Object.keys(byDay).sort().map(key => ({
    day: key,
    count: byDay[key].count,
    avg: byDay[key].sum / byDay[key].count
  }));

  const used   = codes.filter(c => c.status === "used").length;
  const unused = codes.filter(c => c.status === "unused").length;

  return {
    total,
    overall,
    overallLabel: ratingLabel(overall),
    satisfaction: (overall / 5) * 100,
    respondents,
    dimensions,
    trend,
    minTs: timestamps.length ? Math.min(...timestamps) : null,
    maxTs: timestamps.length ? Math.max(...timestamps) : null,
    codes: {
      total: codes.length,
      used,
      unused,
      other: codes.length - used - unused,
      usageRate: codes.length ? (used / codes.length) * 100 : 0
    }
  };
}

/* ----------------------------------------------------------------------------
 * 7. Office-scoped data access
 *
 * Every read here is filtered by officeId. An office account can only ever
 * pass its own officeId, and Firestore Security Rules reject anything else —
 * the filter is for correctness and cost, not for security.
 * -------------------------------------------------------------------------- */

export async function fetchOffices() {
  const snap = await getDocs(PATHS.offices());
  return snap.docs
    .map(d => ({
      id: d.id,
      name: d.data().name || d.id,
      status: d.data().status || "active",
      inCharge: d.data().inCharge || "",
      accountUid: d.data().accountUid || d.data().authUid || "",
      accountEmail: d.data().accountEmail || d.data().email || "",
      accountUsername: d.data().accountUsername || d.data().username || "",
      createdAt: toMillis(d.data().createdAt)
    }))
    .filter(o => o.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchOffice(officeId) {
  if (!officeId) return null;
  const snap = await getDoc(PATHS.office(officeId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    name: data.name || snap.id,
    status: data.status || "active",
    inCharge: data.inCharge || "",
    accountUid: data.accountUid || data.authUid || "",
    accountEmail: data.accountEmail || data.email || "",
    accountUsername: data.accountUsername || data.username || "",
    createdAt: toMillis(data.createdAt)
  };
}

/**
 * Transaction codes for one office.
 *
 * Reads the canonical `transaction_codes` collection, then folds in any
 * remaining legacy codes under services/transaction_code/office_name/{name}/codes
 * so codes handed out before this upgrade still appear and still work.
 * A code present in both is reported once, from the canonical collection.
 */
export async function fetchOfficeCodes(officeId, officeName) {
  const out = [];
  const seen = new Set();

  try {
    const snap = await getDocs(query(PATHS.codes(), where("officeId", "==", officeId)));
    snap.forEach(d => {
      const c = d.data() || {};
      const code = c.code || d.id;
      seen.add(code);
      out.push({
        id: d.id, code,
        officeId: c.officeId || officeId,
        officeName: c.officeName || officeName || "",
        status: String(c.status || "unused").toLowerCase(),
        generatedAt: toMillis(c.generatedAt),
        generatedBy: c.generatedBy || "",
        usedAt: toMillis(c.usedAt),
        evaluationId: c.evaluationId || "",
        legacy: false
      });
    });
  } catch (err) {
    console.error("Could not load transaction codes:", err);
    throw err;
  }

  if (officeName) {
    try {
      const legacySnap = await getDocs(PATHS.legacyOfficeCodes(officeName));
      legacySnap.forEach(d => {
        const c = d.data() || {};
        const code = c.code || d.id;
        if (seen.has(code)) return;
        out.push({
          id: d.id, code,
          officeId: c.officeId || officeId,
          officeName,
          status: String(c.status || "unused").toLowerCase(),
          generatedAt: toMillis(c.createdAt ?? c.generatedAt),
          generatedBy: c.generatedBy || "",
          usedAt: toMillis(c.usedAt),
          evaluationId: c.evaluationId || "",
          legacy: true
        });
      });
    } catch (err) {
      // A missing legacy path is normal for a newly created office.
      console.warn("Legacy transaction codes unavailable for", officeName, err?.code || err);
    }
  }

  return out.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));
}

/**
 * Evaluations for one office.
 *
 * Deliberately TWO narrow queries rather than one full-collection read:
 *
 *   1. officeId == this office   — records submitted since officeId stamping
 *   2. office    == office name  — records submitted before that existed
 *
 * Both are provably scoped to a single office, so the Firestore list rule can
 * require it and still let the query through. Reading the whole collection and
 * filtering in the browser would force the rule open to every evaluation,
 * which is exactly the isolation this is supposed to guarantee.
 *
 * Results are merged and de-duplicated, since a record may satisfy both.
 */
export async function fetchOfficeEvaluations(officeId, officeName) {
  const queries = [];

  if (officeId)   queries.push(query(PATHS.evaluations(), where("officeId", "==", officeId)));
  if (officeName) queries.push(query(PATHS.evaluations(), where("office", "==", officeName)));

  if (!queries.length) return [];

  const snaps = await Promise.all(
    queries.map(q => getDocs(q).catch(err => {
      // A missing composite index or a permission edge case on one of the two
      // shapes should not blank the page — surface it and keep the other.
      console.error("An evaluation query failed:", err);
      return null;
    }))
  );

  if (snaps.every(s => s === null)) {
    throw new Error("Evaluations could not be loaded. Please try again.");
  }

  const seen = new Set();
  const out = [];

  snaps.filter(Boolean).forEach(snap => {
    snap.docs.forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      out.push(normalizeEvaluation(d.id, d.data() || {}));
    });
  });

  return out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Admin-wide read: every evaluation, for the Admin 1 pages that legitimately
 * span all offices. Offices must use fetchOfficeEvaluations instead.
 */
export async function fetchAllEvaluations() {
  const snap = await getDocs(PATHS.evaluations());
  return snap.docs
    .map(d => normalizeEvaluation(d.id, d.data() || {}))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/** Applies the Summary Analytics filter bar to an already-fetched list. */
export function applyFilters(evaluations, { startDate, endDate, category } = {}) {
  const from = startOfDay(startDate);
  const to   = endOfDay(endDate);

  return evaluations.filter(e => {
    if (from && (!e.timestamp || e.timestamp < from)) return false;
    if (to   && (!e.timestamp || e.timestamp > to))   return false;
    if (category && normalizeName(e.category) !== normalizeName(category)) return false;
    return true;
  });
}

/** Same date window, applied to transaction codes by generation date. */
export function filterCodes(codes, { startDate, endDate, status } = {}) {
  const from = startOfDay(startDate);
  const to   = endOfDay(endDate);

  return codes.filter(c => {
    if (from && (!c.generatedAt || c.generatedAt < from)) return false;
    if (to   && (!c.generatedAt || c.generatedAt > to))   return false;
    if (status && c.status !== status) return false;
    return true;
  });
}

/**
 * One office-scoped analytics payload: office, codes, evaluations and every
 * derived figure. Used by Summary Analytics, the office Dashboard and Reports.
 */
export async function loadOfficeAnalytics(officeId, officeName, filters = {}) {
  const office = await fetchOffice(officeId);
  const name = office?.name || officeName || "";

  const [codes, evaluations] = await Promise.all([
    fetchOfficeCodes(officeId, name),
    fetchOfficeEvaluations(officeId, name)
  ]);

  const filteredEvals = applyFilters(evaluations, filters);
  const filteredCodes = filters.startDate || filters.endDate
    ? filterCodes(codes, filters)
    : codes;

  return {
    office: office || { id: officeId, name, status: "active" },
    officeName: name,
    codes, evaluations,
    filteredCodes, filteredEvals,
    stats: computeAnalytics(filteredEvals, filteredCodes)
  };
}

/* ----------------------------------------------------------------------------
 * 8. Transaction code generation
 * -------------------------------------------------------------------------- */

/**
 * Office prefix for generated codes. Mirrors the rule office-codes.html
 * already uses, so new codes look like the existing ones:
 *   1. the last acronym-like token  ("SIPP Coordinator (OJT-BSOA)" -> BSOA)
 *   2. otherwise the word initials  ("Guidance Counselor" -> GC)
 *   3. otherwise the first 6 letters of a single-word name
 */
export function codePrefix(officeName) {
  const name = String(officeName || "").trim();
  const acronyms = name.match(/\b[A-Z]{2,}\b/g) || [];

  let prefix;
  if (acronyms.length) {
    prefix = acronyms[acronyms.length - 1].substring(0, 6);
  } else {
    const words = name.split(/\s+/).filter(Boolean);
    prefix = words.length > 1
      ? words.map(w => w[0]).join("").toUpperCase().substring(0, 6)
      : name.replace(/\s+/g, "").substring(0, 6).toUpperCase();
  }

  return (prefix.replace(/[^A-Z0-9]/g, "") || "GEN");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no I/O/0/1 — unambiguous in print

/** Cryptographically random suffix, so codes cannot be guessed or predicted. */
function randomSuffix(length = 7) {
  const bytes = new Uint8Array(length);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function makeCode(officeName) {
  return `${codePrefix(officeName)}-${randomSuffix()}`;
}

/**
 * Generates `quantity` codes for one office.
 *
 * The document ID *is* the code string, so Firestore itself guarantees
 * uniqueness: a collision fails the create and the loop simply retries with a
 * fresh suffix. Nothing can produce two codes with the same value, and no
 * existing code can be silently overwritten.
 *
 * @returns {Promise<{created: string[], failed: number}>}
 */
export async function generateCodes({ officeId, officeName, quantity, generatedBy, onProgress }) {
  if (!officeId) throw new Error("An office must be selected before generating codes.");

  const count = Math.min(200, Math.max(1, parseInt(quantity, 10) || 1));
  const created = [];
  let failed = 0;

  for (let i = 0; i < count; i++) {
    let saved = false;

    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const code = makeCode(officeName);
      try {
        // runTransaction + a non-existence check: refuses to reuse a code value.
        await runTransaction(db, async (tx) => {
          const ref = PATHS.code(code);
          const existing = await tx.get(ref);
          if (existing.exists()) throw new Error("duplicate-code");

          tx.set(ref, {
            code,
            officeId,
            officeName: officeName || "",
            status: "unused",
            category: "Services",
            generatedAt: Date.now(),
            generatedBy: generatedBy || "",
            usedAt: null,
            evaluationId: null
          });
        });
        created.push(code);
        saved = true;
      } catch (err) {
        if (err?.message === "duplicate-code") continue;   // retry with a new suffix
        throw err;                                          // permission / network — surface it
      }
    }

    if (!saved) failed++;
    if (onProgress) onProgress(i + 1, count);
  }

  return { created, failed };
}

/**
 * Validates a code for an office WITHOUT consuming it.
 * Used by the respondent-facing check before the questionnaire opens.
 *
 * @returns {Promise<{ok:boolean, reason?:string, code?:object}>}
 */
export async function validateCode(codeValue, expectedOfficeId) {
  const normalized = String(codeValue || "").trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "Please enter a transaction code." };

  const snap = await getDoc(PATHS.code(normalized));
  if (!snap.exists()) return { ok: false, reason: "Invalid transaction code." };

  const data = snap.data() || {};
  if (String(data.status || "").toLowerCase() === "used")
    return { ok: false, reason: "This transaction code has already been used." };

  if (expectedOfficeId && data.officeId !== expectedOfficeId)
    return {
      ok: false,
      reason: `This code was issued for ${data.officeName || "another office"} ` +
              `and cannot be used to evaluate the office you selected.`
    };

  return { ok: true, code: { id: snap.id, ...data } };
}

/**
 * Atomically claims a code once an evaluation has been saved successfully.
 *
 * Runs inside a Firestore transaction, so two respondents submitting at the
 * same instant cannot both consume the same code — the second one loses and
 * is told the code was just used.
 */
export async function consumeCode(codeValue, { officeId, evaluationId }) {
  const normalized = String(codeValue || "").trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "Missing transaction code." };

  try {
    await runTransaction(db, async (tx) => {
      const ref = PATHS.code(normalized);
      const snap = await tx.get(ref);

      if (!snap.exists()) throw new Error("not-found");
      const data = snap.data() || {};
      if (String(data.status || "").toLowerCase() === "used") throw new Error("already-used");
      if (officeId && data.officeId !== officeId) throw new Error("wrong-office");

      tx.update(ref, {
        status: "used",
        usedAt: Date.now(),
        evaluationId: evaluationId || null
      });
    });
    return { ok: true };
  } catch (err) {
    if (err?.message === "not-found")    return { ok: false, reason: "Invalid transaction code." };
    if (err?.message === "already-used") return { ok: false, reason: "This transaction code has already been used." };
    if (err?.message === "wrong-office") return { ok: false, reason: "This code belongs to a different office." };
    return { ok: false, reason: friendlyError(err) };
  }
}

/* ----------------------------------------------------------------------------
 * 9. Export helpers — CSV is opened directly by Excel
 * -------------------------------------------------------------------------- */

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  // Guard against spreadsheet formula injection in exported text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCSV(headers, rows) {
  return [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadFile(filename, mime, content) {
  const blob = new Blob([`﻿${content}`], { type: `${mime};charset=utf-8` });  // BOM: Excel reads UTF-8
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCodesCSV(codes, officeName) {
  const rows = codes.map((c, i) => [
    i + 1, c.code, c.officeName || officeName || "", c.officeId || "",
    c.status === "used" ? "Used" : "Unused",
    c.generatedAt ? formatDateTime(c.generatedAt) : "",
    c.generatedBy || "",
    c.usedAt ? formatDateTime(c.usedAt) : "",
    c.evaluationId || ""
  ]);

  const csv = toCSV(
    ["#","Code","Office","Office ID","Status","Generated At","Generated By","Used At","Evaluation ID"],
    rows
  );

  const slug = String(officeName || "all-offices").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  downloadFile(`transaction-codes-${slug}.csv`, "text/csv", csv);
  return codes.length;
}

export function exportEvaluationsCSV(evaluations, officeName) {
  const rows = evaluations.map((e, i) => [
    i + 1, e.transactionCode, e.office, e.category,
    e.sqd0, ...e.dims.map(v => (v === null ? "N/A" : v)),
    e.avg ? e.avg.toFixed(2) : "",
    e.sex, e.age, e.region, e.clientType, e.serviceAvailed,
    e.cc1, e.cc2, e.cc3,
    e.suggestions, e.status,
    e.timestamp ? formatDateTime(e.timestamp) : ""
  ]);

  const csv = toCSV(
    ["#","Transaction Code","Office","Category","SQD0",
     ...DIMENSION_LABELS, "Average Rating",
     "Sex","Age","Region","Client Type","Service Availed",
     "CC1","CC2","CC3","Suggestions","Feedback Status","Submitted At"],
    rows
  );

  const slug = String(officeName || "office").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  downloadFile(`evaluations-${slug}.csv`, "text/csv", csv);
  return evaluations.length;
}

/* ----------------------------------------------------------------------------
 * 10. Chart.js guard — a missing CDN should degrade, not blank the page
 * -------------------------------------------------------------------------- */

export function safeChart(wrapId, canvasId, build) {
  const wrap = document.getElementById(wrapId);

  if (typeof window.Chart === "undefined") {
    if (wrap) wrap.innerHTML =
      `<div class="chart-error">Chart library failed to load. Check your internet connection and reload.</div>`;
    return null;
  }

  try {
    return build(document.getElementById(canvasId));
  } catch (err) {
    console.error(`Could not render chart "${canvasId}":`, err);
    if (wrap) wrap.innerHTML = `<div class="chart-error">Couldn't render this chart.</div>`;
    return null;
  }
}

export const CHART_PALETTE =
  ["#2563eb","#06b6d4","#8b5cf6","#0ea5e9","#f59e0b","#10b981","#ef4444","#6366f1"];
