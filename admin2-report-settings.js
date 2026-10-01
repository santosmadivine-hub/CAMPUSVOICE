import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db     = getFirestore(getApp());
// Top-level collection (outside "services"), used only by Admin 2
const curRef = doc(db, "reportSettingsAdmin2", "current");
const defRef = doc(db, "reportSettingsAdmin2", "default");

const GROUPS = [
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
const ALL = GROUPS.flatMap(g => g.fields);

const DEFAULTS = {
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
let draft     = {};
let formDirty = false;
let ready;

const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* ---------- HTML-string builders (Admin 2 paginates from strings) ---------- */
function headerHtml(s = settings, titleKey = "reportTitle") {
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
function footerHtml(s = settings) {
  return s.footerImage
    ? `<div class="official-footer"><img src="${esc(s.footerImage)}" alt="${esc(s.orgName)}" crossorigin="anonymous"></div>` : "";
}
function signaturesHtml(s = settings) {
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
function loadReportSettings() {
  if (!ready) ready = new Promise(resolve => {
    onSnapshot(curRef, snap => {
      settings = snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
      if (!snap.exists()) setDoc(curRef, { ...DEFAULTS, updatedAt: new Date().toISOString() }).catch(() => {});
      if (!formDirty) { draft = { ...settings }; fillForm(); }
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

/* ---------- settings UI ---------- */
const css = document.createElement("style");
css.textContent = `
#rsCard{background:#fff;border:1px solid #bae6fd;border-radius:14px;padding:18px;margin-bottom:18px;font-family:'DM Sans',sans-serif}
#rsCard .rs-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
#rsCard .rs-title{font-size:16px;font-weight:700;color:#0f172a}
#rsCard .rs-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:14px}
#rsCard h4{margin:14px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:#64748b}
#rsCard label{display:block;font-size:12px;font-weight:600;color:#475569;margin:10px 0 4px}
#rsCard input[type=text],#rsCard select,#rsCard textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #dbe4ee;border-radius:10px;background:#f8fafc;font-family:'DM Sans',sans-serif;font-size:14px;color:#0f172a}
#rsCard textarea{min-height:70px;resize:vertical}
#rsCard .rs-img{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#rsCard .rs-img img{max-width:90px;max-height:44px;border:1px solid #e2e8f0;border-radius:6px;background:#fff}
#rsCard .rs-btn{padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-family:'DM Sans',sans-serif;font-size:14px}
#rsCard .rs-gray{background:#e2e8f0;color:#475569}#rsCard .rs-green{background:#16a34a;color:#fff}#rsCard .rs-purple{background:#7c3aed;color:#fff}
#rsCard .rs-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
#rsCard .rs-preview{background:#f1f5f9;border-radius:12px;padding:14px;position:sticky;top:12px;overflow:hidden}
#rsCard .rs-preview .cvr-page{min-height:0;max-width:100%}
#rsCard .rs-note{font-size:12px;color:#94a3b8;margin:6px 0 0}
@media(max-width:1100px){#rsCard .rs-grid{grid-template-columns:1fr}}
@media print{#rsCard{display:none!important}}`;
document.head.appendChild(css);

const card = document.createElement("div");
card.id = "rsCard";
card.innerHTML = `
  <div class="rs-head">
    <div class="rs-title">⚙️ Report Header &amp; Footer Settings</div>
    <button class="rs-btn rs-gray" id="rsToggle">Show settings</button>
  </div>
  <div id="rsBody" style="display:none;">
    <div class="rs-grid">
      <div id="rsForm">
        ${GROUPS.map(g => `<h4>${g.title} settings</h4>` + g.fields.map(f => `
          <label for="rs_${f.k}">${f.l}</label>` + (
          f.t === "text"  ? `<input type="text" id="rs_${f.k}" data-k="${f.k}">` :
          f.t === "area"  ? `<textarea id="rs_${f.k}" data-k="${f.k}"></textarea>` :
          f.t === "align" ? `<select id="rs_${f.k}" data-k="${f.k}"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>` :
          `<div class="rs-img"><img id="rs_${f.k}_img" style="display:none"><input type="file" accept="image/*" data-img="${f.k}" data-max="${f.max}"><button class="rs-btn rs-gray" type="button" data-clear="${f.k}">Remove</button></div>`
        )).join("")).join("")}
        <div class="rs-actions">
          <button class="rs-btn rs-green"  id="rsSave">💾 Save Changes</button>
          <button class="rs-btn rs-gray"   id="rsReset">↺ Reset to Default</button>
          <button class="rs-btn rs-purple" id="rsSaveDefault">⭐ Save as Default</button>
        </div>
        <p class="rs-note">Saved to Firebase and used by the preview, print, PDF export and all reports.</p>
      </div>
      <div>
        <h4 style="margin-top:0">Live preview</h4>
        <div class="rs-preview"><div class="cvr-page">
          <div class="cvr-page-header"><div class="cvr-inner-header" id="rsPvH"></div></div>
          <div class="cvr-page-content"><div class="cvr-inner-content" id="rsPvS"></div></div>
          <div class="cvr-page-footer"><div class="cvr-inner-footer" id="rsPvF"></div></div>
        </div></div>
      </div>
    </div>
  </div>`;
const anchor = document.getElementById("reportPreview");
anchor.parentNode.insertBefore(card, anchor);

const $ = id => document.getElementById(id);
$("rsToggle").onclick = () => {
  const open = $("rsBody").style.display === "none";
  $("rsBody").style.display = open ? "block" : "none";
  $("rsToggle").textContent = open ? "Hide settings" : "Show settings";
};

function fillForm() {
  ALL.forEach(f => {
    if (f.t === "image") {
      const img = $(`rs_${f.k}_img`);
      img.src = draft[f.k] || ""; img.style.display = draft[f.k] ? "block" : "none";
    } else $(`rs_${f.k}`).value = draft[f.k] ?? (f.t === "align" ? "center" : "");
  });
  livePreview();
}
function livePreview() {
  $("rsPvH").innerHTML = headerHtml(draft, "reportTitle");
  $("rsPvS").innerHTML = "";
  // Signatures live in the footer (same as Admin 1): Prepared by / Noted by, then the footer image
  $("rsPvF").innerHTML = signaturesHtml(draft) + footerHtml(draft);
}

card.addEventListener("input", e => {
  const k = e.target.dataset.k; if (!k) return;
  draft[k] = e.target.value; formDirty = true; livePreview();
});
card.addEventListener("change", async e => {
  const k = e.target.dataset.img; if (!k || !e.target.files[0]) return;
  try {
    draft[k] = await fileToDataUrl(e.target.files[0], +e.target.dataset.max || 400);
    formDirty = true; fillForm();
  } catch { alert("Could not read that image."); }
});
card.addEventListener("click", e => {
  const k = e.target.dataset.clear; if (!k) return;
  draft[k] = ""; formDirty = true; fillForm();
});

function fileToDataUrl(file, max) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.8));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

const payload = () => { const o = {}; ALL.forEach(f => o[f.k] = draft[f.k] ?? ""); o.updatedAt = new Date().toISOString(); return o; };
const tooBig = p => JSON.stringify(p).length > 900000;   // Firestore documents max out at 1 MiB

$("rsSave").onclick = async () => {
  const p = payload();
  if (tooBig(p)) { alert("❌ The images are too large. Please use smaller images."); return; }
  try { await setDoc(curRef, p); formDirty = false; alert("✅ Header & footer settings saved."); }
  catch (err) { alert("❌ Failed to save: " + err.message); }
};
$("rsSaveDefault").onclick = async () => {
  if (!confirm("Use the current form values as the default that “Reset to Default” restores?")) return;
  const p = payload();
  if (tooBig(p)) { alert("❌ The images are too large. Please use smaller images."); return; }
  try { await setDoc(defRef, p); alert("✅ Default saved."); }
  catch (err) { alert("❌ Failed to save default: " + err.message); }
};
$("rsReset").onclick = async () => {
  try {
    const snap = await getDoc(defRef);
    if (!confirm("Replace the current settings with the default?")) return;
    draft = snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
    await setDoc(curRef, payload()); formDirty = false; fillForm();
  } catch (err) { alert("❌ Failed to reset: " + err.message); }
};

loadReportSettings();
