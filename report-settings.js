/* CampusVoice – Report Header & Footer Settings
   Firestore: services/reportSettings/records/current  (live settings)
              services/reportSettings/records/default  (baseline for "Reset to Default")
   No header/footer content is defined in this file. Every report value comes from Firestore. */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db     = getFirestore(getApp());
const curRef = doc(db, "services", "reportSettings", "records", "current");
const defRef = doc(db, "services", "reportSettings", "records", "default");

/* Admin-form definition only (labels of the settings screen, not report content) */
const GROUPS = [
  { title: "Header", fields: [
    { k: "logoLeft",       l: "Organization logo (left)",  t: "image", max: 400 },
    { k: "logoRight",      l: "Secondary logo / seal (right)", t: "image", max: 400 },
    { k: "topText",        l: "Line above organization name", t: "text" },
    { k: "orgName",        l: "School / organization name", t: "text" },
    { k: "orgShort",       l: "Short name (used in report details)", t: "text" },
    { k: "campusName",     l: "Campus name",               t: "text" },
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
const ALL = GROUPS.flatMap(g => g.fields);

let settings = {};      // live Firestore settings
let pinned   = null;    // snapshot used when viewing a saved report
let draft    = {};      // admin form state
let ready;              // resolves after first Firestore load

const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* ---------- reusable renderers (used by preview, print, PDF, saved reports, live preview) ---------- */
function renderReportHeader(el, s, titleKey = "reportTitle") {
  if (!el) return;
  const align = s.headerAlign || "center";
  const logo  = src => src
    ? `<div class="lh-logo-box" style="width:150px;height:90px;"><img src="${src}" alt="${esc(s.orgName)}" style="width:100%;height:100%;object-fit:contain;"></div>` : "";
  const lines = [[s.topText,"rep"],[s.orgName,"uni"],[s.campusName,"rep"],[s.department,"dept"]]
    .concat(String(s.additionalText || "").split("\n").map(t => [t,"addr"]))
    .filter(x => x[0] && String(x[0]).trim())
    .map(x => `<div class="${x[1]}">${esc(x[0])}</div>`).join("");
  const title = s[titleKey] ? `<div class="csm-doc-title">${esc(s[titleKey])}</div>` : "";
  el.innerHTML = `
    <div class="lh-row">${logo(s.logoLeft)}<div class="lh-text" style="text-align:${align};">${lines}</div>${logo(s.logoRight)}</div>
    ${(lines || s.logoLeft || s.logoRight) ? '<hr class="lh-divider">' : ""}${title}`;
}

function renderReportFooter(el, s) {
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

function loadReportSettings() {
  if (!ready) ready = new Promise(resolve => {
    onSnapshot(curRef, snap => {
      settings = snap.exists() ? snap.data() : {};
      renderAll();
      if (!formDirty) { draft = { ...settings }; fillForm(); }
      resolve(settings);
    }, err => { console.error(err); alert("Could not load report settings: " + err.message); resolve({}); });
  });
  return ready;
}

/* ---------- public API used by the dashboard ---------- */
window.ReportSettings = {
  loadReportSettings, renderReportHeader, renderReportFooter,
  get: () => JSON.parse(JSON.stringify(settings)),
  render: snapshot => { pinned = snapshot || null; renderAll(); },
  officeLine: office => [office, [settings.orgShort || settings.orgName, settings.campusName].filter(Boolean).join(" – ")]
    .filter(Boolean).join(", ")
};

/* ---------- settings UI ---------- */
let formDirty = false;

const css = document.createElement("style");
css.textContent = `
#rsCard .rs-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
#rsCard .rs-col h4{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:#64748b}
#rsCard label{display:block;font-size:12px;font-weight:600;color:#475569;margin:10px 0 4px}
#rsCard .input,#rsCard select,#rsCard textarea{width:100%;box-sizing:border-box}
#rsCard textarea{min-height:70px;resize:vertical;padding:10px 12px;border:1px solid #dbe4ee;border-radius:10px;background:#f8fafc;font-family:'DM Sans',sans-serif;font-size:14px}
#rsCard .rs-img{display:flex;align-items:center;gap:10px}
#rsCard .rs-img img{max-width:90px;max-height:44px;border:1px solid #e2e8f0;border-radius:6px;background:#fff}
#rsCard .rs-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
#rsCard .rs-preview{background:#f1f5f9;border-radius:12px;padding:14px;position:sticky;top:12px}
#rsCard .rs-preview .generated-report{min-height:0;transform-origin:top left}
#rsCard .rs-note{font-size:12px;color:#94a3b8;margin:6px 0 0}
@media(max-width:1100px){#rsCard .rs-grid{grid-template-columns:1fr}}
@media print{#rsCard{display:none!important}}`;
document.head.appendChild(css);

const card = document.createElement("div");
card.className = "card"; card.id = "rsCard";
card.innerHTML = `
  <div class="card-header">
    <div class="card-title">⚙️ Report Header &amp; Footer Settings</div>
    <button class="btn btn-gray" id="rsToggle">Show settings</button>
  </div>
  <div id="rsBody" style="display:none;">
    <div class="rs-grid">
      <div class="rs-col" id="rsForm">
        ${GROUPS.map(g => `<h4 style="margin-top:14px">${g.title} settings</h4>` + g.fields.map(f => `
          <label for="rs_${f.k}">${f.l}</label>` + (
          f.t === "text"  ? `<input class="input" id="rs_${f.k}" data-k="${f.k}">` :
          f.t === "area"  ? `<textarea id="rs_${f.k}" data-k="${f.k}"></textarea>` :
          f.t === "align" ? `<select id="rs_${f.k}" data-k="${f.k}"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>` :
          `<div class="rs-img"><img id="rs_${f.k}_img" style="display:none"><input type="file" accept="image/*" data-img="${f.k}" data-max="${f.max}"><button class="btn btn-gray" type="button" data-clear="${f.k}">Remove</button></div>`
        )).join("")).join("")}
        <div class="rs-actions">
          <button class="btn btn-green"  id="rsSave">💾 Save Changes</button>
          <button class="btn btn-gray"   id="rsReset">↺ Reset to Default</button>
          <button class="btn btn-purple" id="rsSaveDefault">⭐ Save as Default</button>
        </div>
        <p class="rs-note">Saved to Firebase and used by the preview, print, PDF export and newly saved reports. Saved reports keep the header/footer they were created with.</p>
      </div>
      <div class="rs-col">
        <h4>Live preview</h4>
        <div class="rs-preview"><div class="generated-report">
          <div class="generated-report-header" id="rsPvH"></div>
          <div class="generated-report-footer" id="rsPvF"></div>
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
  renderReportHeader($("rsPvH"), draft, "reportTitle");
  renderReportFooter($("rsPvF"), draft);
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
        res(c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

const payload = () => { const o = {}; ALL.forEach(f => o[f.k] = draft[f.k] ?? ""); o.updatedAt = new Date().toISOString(); return o; };

$("rsSave").onclick = async () => {
  try { await setDoc(curRef, payload()); formDirty = false; alert("✅ Header & footer settings saved."); }
  catch (err) { alert("❌ Failed to save: " + err.message); }
};
$("rsSaveDefault").onclick = async () => {
  if (!confirm("Use the current form values as the default that “Reset to Default” restores?")) return;
  try { await setDoc(defRef, payload()); alert("✅ Default saved."); }
  catch (err) { alert("❌ Failed to save default: " + err.message); }
};
$("rsReset").onclick = async () => {
  try {
    const snap = await getDoc(defRef);
    if (!snap.exists()) { alert("No default has been saved yet. Use “Save as Default” first."); return; }
    if (!confirm("Replace the current settings with the saved default?")) return;
    draft = { ...snap.data() };
    await setDoc(curRef, payload()); formDirty = false; fillForm();
  } catch (err) { alert("❌ Failed to reset: " + err.message); }
};

loadReportSettings();
