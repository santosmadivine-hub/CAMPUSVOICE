/* CampusVoice – Admin 2 Report Header & Footer Settings (shared core, no UI)
   Firestore: reportSettingsAdmin2/current  (live settings)
              reportSettingsAdmin2/default  (baseline for "Reset to Default")
   Used by:
     - admin2-reports.html           -> window.ReportSettings (headerHtml / footerHtml / signaturesHtml / officeLine / get)
     - admin2-report-settings.html   -> imports the exports below to edit the settings
   The Firebase app must be initialized (initializeApp) BEFORE this module runs. */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db     = getFirestore(getApp());
// Top-level collection (outside "services"), used only by Admin 2
export const curRef = doc(db, "reportSettingsAdmin2", "current");
export const defRef = doc(db, "reportSettingsAdmin2", "default");

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
  reportTitle: "Cleanliness Evaluation Report (CER)",
  commentsTitle: "Comments & Suggestions",
  headerAlign: "center",
  preparedLabel: "Prepared by:",
  preparedName: "Melby P. Parreno,Ed.D",
  preparedPos: "General Services Office",
  notedLabel: "Noted by:",
  notedName: "MICHAEL B. DIZON, EDD, PHD",
  notedPos: "Campus Administrator"
};

let settings  = { ...DEFAULTS };   // live settings (defaults until Firestore answers)
let ready;

const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* ---------- HTML-string builders (Admin 2 paginates from strings) ---------- */
export function headerHtml(s = settings, titleKey = "reportTitle") {
  const align = s.headerAlign || "center";
  const logo = (src, cls) => src
    ? `<div class="${cls}"><img src="${esc(src)}" alt="${esc(s.orgName)}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;"></div>` : "";
  const lines = [[s.topText, "rep"], [s.orgName, "uni"], [s.department, "dept"]]
    .concat(String(s.additionalText || "").split("\n").map(t => [t, "addr"]))
    .filter(x => x[0] && String(x[0]).trim())
    .map(x => `<div class="${x[1]}">${esc(x[0])}</div>`).join("");
  const title = s[titleKey] ? `<div class="official-title">${esc(s[titleKey])}</div>` : "";
  return `<div class="lh-row">${logo(s.logoLeft, "lh-logo-box")}<div class="lh-text" style="text-align:${align};">${lines}</div>${logo(s.logoRight, "lh-seal-box")}</div>
    <hr class="lh-divider">${title}`;
}
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

/* ---------- public API used by admin2 ---------- */
window.ReportSettings = {
  loadReportSettings, headerHtml, footerHtml, signaturesHtml, officeLine,
  get: () => JSON.parse(JSON.stringify(settings))
};

loadReportSettings();
