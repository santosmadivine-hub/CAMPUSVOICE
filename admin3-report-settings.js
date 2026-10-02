/* CampusVoice – Admin 3 Report Header & Footer Settings (shared core, no UI)
   Firestore: reportSettingsAdmin3/current  (live settings)
              reportSettingsAdmin3/default  (baseline for "Reset to Default")
   Used by:
     - admin3-reports.html           -> window.ReportSettings (headerHtml / titleHtml / footerHtml / signaturesHtml / officeLine / esc / get / loadReportSettings)
     - admin3-report-settings.html   -> imports the exports below to edit the settings
   The Firebase app must be initialized (initializeApp) BEFORE this module runs. */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db     = getFirestore(getApp());
// Top-level collection used only by Admin 3
export const curRef = doc(db, "reportSettingsAdmin3", "current");
export const defRef = doc(db, "reportSettingsAdmin3", "default");

export const GROUPS = [
  { title: "Header", fields: [
    { k: "logoLeft",       l: "Organization logo (left)",      t: "image", max: 400 },
    { k: "logoRight",      l: "Secondary logo / seal (right)", t: "image", max: 400 },
    { k: "topText",        l: "Line above organization name",  t: "text" },
    { k: "orgName",        l: "School / organization name",    t: "text" },
    { k: "orgShort",       l: "Short name (used in report details)", t: "text" },
    { k: "campusName",     l: "Campus name (used in report details)", t: "text" },
    { k: "department",     l: "Department / office",           t: "text" },
    { k: "additionalText", l: "Additional header text (one line per row)", t: "area" },
    { k: "reportTitle",    l: "Report title – ratings report", t: "text" },
    { k: "commentsTitle",  l: "Report title – comments page",  t: "text" },
    { k: "headerAlign",    l: "Header alignment",              t: "align" }
  ]},
  { title: "Footer", fields: [
    { k: "preparedLabel", l: "Prepared by – label",    t: "text" },
    { k: "preparedName",  l: "Prepared by – name",     t: "text" },
    { k: "preparedPos",   l: "Prepared by – position / designation", t: "text" },
    { k: "notedLabel",    l: "Noted by – label",       t: "text" },
    { k: "notedName",     l: "Noted by – name",        t: "text" },
    { k: "notedPos",      l: "Noted by – position / designation", t: "text" },
    { k: "footerImage",   l: "Footer image (accreditations, etc.)", t: "image", max: 1400 }
  ]}
];
export const ALL = GROUPS.flatMap(g => g.fields);

export const DEFAULTS = {
  logoLeft: "2.png", logoRight: "3.jpg", footerImage: "4.jpg",
  topText: "Republic of the Philippines",
  orgName: "Iloilo State University of Fisheries Science and Technology",
  orgShort: "ISUFST",
  campusName: "San Enrique Campus",
  department: "General Services Office",
  additionalText: "San Enrique, Iloilo | rdo@isufst.edu.ph | Contact No: (033) 323-2050 / (033) 323-3400\nWebsite: www.isufst.edu.ph",
  reportTitle: "Client Satisfaction Measurement (CSM) Report",
  commentsTitle: "Comments & Suggestions Report",
  headerAlign: "center",
  preparedLabel: "Prepared by:",
  preparedName: "Mr. Joneben Penol",
  preparedPos: "General Services Office",
  notedLabel: "Noted by:",
  notedName: "MICHAEL B. DIZON, EDD, PHD",
  notedPos: "Campus Administrator"
};

let settings  = { ...DEFAULTS };   // live settings (defaults until Firestore answers)
let ready;

export const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* ---------- HTML-string builders ---------- */
// Letterhead (logos + text lines + divider). Pass titleKey = null to omit the
// title, because Admin 3 adds its own title (and "(Continued)") per page.
export function headerHtml(s = settings, titleKey = null) {
  const align = s.headerAlign || "center";
  const logo = (src, cls) => src
    ? `<div class="${cls}"><img src="${esc(src)}" alt="${esc(s.orgName)}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;"></div>` : "";
  const lines = [[s.topText, "rep"], [s.orgName, "uni"], [s.department, "dept"]]
    .concat(String(s.additionalText || "").split("\n").map(t => [t, "addr"]))
    .filter(x => x[0] && String(x[0]).trim())
    .map(x => `<div class="${x[1]}">${esc(x[0])}</div>`).join("");
  const title = titleKey && s[titleKey] ? `<div class="official-title">${esc(s[titleKey])}</div>` : "";
  return `<div class="lh-row">${logo(s.logoLeft, "lh-logo-box")}<div class="lh-text" style="text-align:${align};">${lines}</div>${logo(s.logoRight, "lh-seal-box")}</div>
    <hr class="lh-divider">${title}`;
}
export function titleHtml(text, suffix = "") {
  return text ? `<div class="official-title">${esc(text)}${esc(suffix)}</div>` : "";
}
// Simple footer (used by the live preview only; the report pages build their
// own fixed-height footer image so pagination stays accurate).
export function footerHtml(s = settings) {
  return s.footerImage
    ? `<div class="official-footer"><img src="${esc(s.footerImage)}" alt="${esc(s.orgName)}" crossorigin="anonymous"></div>` : "";
}
export function signaturesHtml(s = settings) {
  const block = (l, n, p) => (l || n || p) ? `<div class="sig-block">
      ${l ? `<div class="sig-label">${esc(l)}</div>` : ""}
      <div style="margin-bottom:6px;font-style:italic;font-size:9.5pt;">_______________________</div>
      ${n ? `<span class="sig-name">${esc(n)}</span>` : ""}
      ${p ? `<div class="sig-title">${esc(p)}</div>` : ""}</div>` : "";
  const b = block(s.preparedLabel, s.preparedName, s.preparedPos) + block(s.notedLabel, s.notedName, s.notedPos);
  return b ? `<div class="official-signatures">${b}</div>` : "";
}
const officeLine = (office, s = settings) =>
  [office, [s.orgShort || s.orgName, s.campusName].filter(Boolean).join(" – ")].filter(Boolean).join(", ");

/* ---------- Firestore ---------- */
export function loadReportSettings() {
  if (!ready) ready = new Promise(resolve => {
    onSnapshot(curRef, snap => {
      settings = snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
      if (!snap.exists()) setDoc(curRef, { ...DEFAULTS, updatedAt: new Date().toISOString() }).catch(() => {});
      // Tell the page to repaint any report that is currently open
      window.dispatchEvent(new Event("reportsettingschange"));
      resolve(settings);
    }, err => { console.error(err); alert("Could not load report settings: " + err.message); resolve(settings); });
  });
  return ready;
}

/* ---------- public API used by admin3 ---------- */
window.ReportSettings = {
  loadReportSettings, headerHtml, titleHtml, footerHtml, signaturesHtml, officeLine, esc,
  get: () => JSON.parse(JSON.stringify(settings))
};

loadReportSettings();
