
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db     = getFirestore(getApp());
export const curRef = doc(db, "services", "reportSettings", "records", "current");
export const defRef = doc(db, "services", "reportSettings", "records", "default");

/* Admin-form definition (labels of the settings screen, not report content) */
export const GROUPS = [
  { title: "Header", fields: [
    { k: "logoLeft",       l: "Organization logo (left)",  t: "image", max: 400 },
    { k: "logoRight",      l: "Secondary logo / seal (right)", t: "image", max: 400 },
    { k: "topText",        l: "Line above organization name", t: "text" },
    { k: "orgName",        l: "School / organization name", t: "text" },
    { k: "orgShort",       l: "Short name (used in report details)", t: "text" },
    { k: "campusName",     l: "Campus name (used in report details)", t: "text" },
    { k: "department",     l: "Department / office",       t: "text" },
    { k: "additionalText", l: "Additional header text (one line per row)", t: "area" },
    { k: "reportTitle",    l: "Report title – ratings report", t: "text" },
    { k: "commentsTitle",  l: "Report title – comments page",  t: "text" },
    { k: "headerAlign",    l: "Header alignment", t: "align" }
  ]},
  { title: "Footer", fields: [
    { k: "preparedLabel", l: "Prepared by – label",    t: "text" },
    { k: "preparedName",  l: "Prepared by – name",     t: "text" },
    { k: "preparedPos",   l: "Prepared by – position / designation", t: "text" },
    { k: "notedLabel",    l: "Noted by – label",       t: "text" },
    { k: "notedName",     l: "Noted by – name",        t: "text" },
    { k: "notedPos",      l: "Noted by – position / designation", t: "text" },
    { k: "footerImage",   l: "Footer image (accreditations, etc.)", t: "image", max: 1600 }
  ]}
];
export const ALL = GROUPS.flatMap(g => g.fields);

/* Built-in starting values (used only until settings are saved in Firestore). */
export const DEFAULTS = {
  logoLeft: "", logoRight: "", footerImage: "",
  topText: "Republic of the Philippines",
  orgName: "Iloilo State University of Fisheries Science and Technology",
  orgShort: "ISUFST",
  campusName: "San Enrique Campus",
  department: "Research & Development Office",
  additionalText: "San Enrique, Iloilo | rdo@isufst.edu.ph | (033) 323-2050 / (033) 323-3400\nWebsite: www.isufst.edu.ph",
  reportTitle: "Client Satisfaction Measurement (CSM) Report",
  commentsTitle: "Client Satisfaction Measurement (CSM) – Comments & Suggestions",
  headerAlign: "center",
  preparedLabel: "Prepared by:",
  preparedName: "Ricky Jun P. Garcia, MSAgri",
  preparedPos: "Chair, Research and Development",
  notedLabel: "Noted by:",
  notedName: "Michael B. Dizon, EdD, PhD",
  notedPos: "Campus Administrator"
};

let settings = {};      // live Firestore settings
let pinned   = null;    // snapshot used when viewing a saved report
let ready;              // resolves after first Firestore load

const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* ---------- reusable renderers (preview, print, PDF, saved reports, live preview) ---------- */
export function renderReportHeader(el, s, titleKey = "reportTitle") {
  if (!el) return;
  const align = s.headerAlign || "center";
  const logo  = (src, w, h) => src
    ? `<div class="lh-logo-box" style="width:${w}px;height:${h}px;flex-shrink:0;"><img src="${src}" alt="${esc(s.orgName)}" style="width:100%;height:100%;object-fit:contain;"></div>` : "";
  const lines = [[s.topText,"rep"],[s.orgName,"uni"],[s.addressLine,"addr1"],[s.department,"dept"]]
    .concat(String(s.additionalText || "").split("\n").map(t => [t,"addr"]))
    .filter(x => x[0] && String(x[0]).trim())
    .map(x => `<div class="${x[1]}">${esc(x[0])}</div>`).join("");
  const title = s[titleKey] ? `<div class="csm-doc-title">${esc(s[titleKey])}</div>` : "";
  el.innerHTML = `
    <div class="lh-row">${logo(s.logoLeft, 125, 75)}<div class="lh-text" style="text-align:${align};">${lines}</div>${logo(s.logoRight, 100, 85)}</div>
    ${(lines || s.logoLeft || s.logoRight) ? '<hr class="lh-divider">' : ""}${title}`;
}
export function renderReportFooter(el, s) {
  if (!el) return;
  const block = (l, n, p) => (l || n || p) ? `<div class="csm-sig-block">
      ${l ? `<div class="csm-sig-label">${esc(l)}</div>` : ""}
      ${n ? `<div class="csm-sig-name">${esc(n)}</div>` : ""}
      ${p ? `<div class="csm-sig-title">${esc(p)}</div>` : ""}</div>` : "";
  const sigs = block(s.preparedLabel, s.preparedName, s.preparedPos) + block(s.notedLabel, s.notedName, s.notedPos);
  el.innerHTML = (sigs ? `<div class="csm-sigs">${sigs}</div>` : "") +
    (s.footerImage ? `<div class="csm-footer"><img src="${s.footerImage}" alt="${esc(s.orgName)}"></div>` : "");
}

function renderAll() {
  const s = pinned || settings;
  document.querySelectorAll("[data-report-header]").forEach(el => renderReportHeader(el, s, el.dataset.titleKey));
  document.querySelectorAll("[data-report-footer]").forEach(el => renderReportFooter(el, s));
}

export function loadReportSettings() {
  if (!ready) ready = new Promise(resolve => {
    onSnapshot(curRef, snap => {
      settings = snap.exists() ? snap.data() : { ...DEFAULTS };
      // First run: store the defaults so they become the editable live settings
      if (!snap.exists()) setDoc(curRef, { ...DEFAULTS, updatedAt: new Date().toISOString() }).catch(() => {});
      renderAll();
      resolve(settings);
    }, err => { console.error(err); alert("Could not load report settings: " + err.message); resolve({}); });
  });
  return ready;
}

/* ---------- public API used by the reports page ---------- */
window.ReportSettings = {
  loadReportSettings, renderReportHeader, renderReportFooter,
  get: () => JSON.parse(JSON.stringify(settings)),
  render: snapshot => { pinned = snapshot || null; renderAll(); },
  officeLine: office => [office, [settings.orgShort || settings.orgName, settings.campusName].filter(Boolean).join(" – ")]
    .filter(Boolean).join(", ")
};

loadReportSettings();
