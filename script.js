"use strict";

/* ═══════════════════════════════════════════════════════════
   Kitchen Vision AI — script.js
   All original logic preserved:
     ✓ getElementById("imageUpload")
     ✓ new FormData()  +  formData.append("image", fileInput.files[0])
     ✓ fetch("/predict", { method:"POST", body:formData })
     ✓ .then(response => response.json())
     ✓ data.ingredient, data.nutrition?.*, data.recipes.join()
     ✓ document.getElementById("result")
   Enhanced: loading state, progress bar, rich HTML render,
             staggered animations, error handling, toast
═══════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────
   UTIL
──────────────────────────────────────────────── */
const $  = id => document.getElementById(id);

function escapeHTML(str) {
  return String(str ?? "—")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

/* ────────────────────────────────────────────────
   PROGRESS BAR  (fixed top bar, simulated stages)
──────────────────────────────────────────────── */
const STAGES = [
  { pct: 18, label: "Uploading image…"        },
  { pct: 38, label: "Pre-processing pixels…"  },
  { pct: 60, label: "Running neural network…" },
  { pct: 78, label: "Classifying ingredient…" },
  { pct: 91, label: "Fetching nutrition data…"},
  { pct: 97, label: "Building recipes…"       },
];

let _timer  = null;
let _stage  = 0;

function progressStart() {
  _stage = 0;

  /* create bar once */
  let bar = $("kv-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "kv-bar";
    bar.innerHTML = `
      <div id="kv-track"><div id="kv-fill"></div></div>
      <span id="kv-label">Initialising…</span>`;

    Object.assign(bar.style, {
      position:"fixed", top:"0", left:"0", right:"0", zIndex:"9999",
      display:"flex", alignItems:"center", gap:"12px",
      padding:"7px 18px",
      background:"rgba(8,12,10,.94)", borderBottom:"1px solid rgba(74,222,128,.18)",
      fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:"#4ade80",
      backdropFilter:"blur(6px)",
      opacity:"0", transition:"opacity .25s ease",
    });

    document.body.prepend(bar);
    requestAnimationFrame(() => (bar.style.opacity = "1"));

    const track = $("kv-track");
    const fill  = $("kv-fill");
    Object.assign(track.style, {
      flex:"1", height:"4px", background:"rgba(74,222,128,.15)", borderRadius:"2px", overflow:"hidden",
    });
    Object.assign(fill.style, {
      height:"100%", width:"0%",
      background:"linear-gradient(90deg,#4ade80,#22c55e)",
      borderRadius:"2px", transition:"width .55s cubic-bezier(.4,0,.2,1)",
    });
  }

  _nextStage();
}

function _nextStage() {
  if (_stage >= STAGES.length) return;
  const { pct, label } = STAGES[_stage++];
  const fill = $("kv-fill"), lbl = $("kv-label");
  if (lbl)  lbl.textContent = label;
  if (fill) requestAnimationFrame(() => (fill.style.width = pct + "%"));
  _timer = setTimeout(_nextStage, 520 + Math.random() * 180);
}

function progressFinish(cb) {
  clearTimeout(_timer);
  const fill = $("kv-fill"), lbl = $("kv-label");
  if (fill) fill.style.width = "100%";
  if (lbl)  lbl.textContent  = "Complete ✓";
  setTimeout(() => {
    const bar = $("kv-bar");
    if (bar) { bar.style.opacity = "0"; setTimeout(() => bar.remove(), 280); }
    cb?.();
  }, 480);
}

function progressError() {
  clearTimeout(_timer);
  const lbl = $("kv-label");
  if (lbl) lbl.textContent = "Analysis failed ✕";
  setTimeout(() => $("kv-bar")?.remove(), 1200);
}

/* ────────────────────────────────────────────────
   TOAST
──────────────────────────────────────────────── */
let _toastTimer = null;

function toast(msg, type = "ok") {
  let t = $("kv-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "kv-toast";
    Object.assign(t.style, {
      position:"fixed", bottom:"26px", right:"22px", zIndex:"10000",
      padding:"11px 18px", borderRadius:"5px",
      fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", letterSpacing:".06em",
      boxShadow:"0 4px 22px rgba(0,0,0,.4)",
      opacity:"0", transform:"translateY(10px)",
      transition:"opacity .3s ease,transform .3s ease", pointerEvents:"none",
    });
    document.body.appendChild(t);
  }

  const MAP = {
    ok:   { bg:"#0e1410", border:"rgba(74,222,128,.38)",  color:"#4ade80" },
    warn: { bg:"#1a1208", border:"rgba(251,191,36,.38)",  color:"#fbbf24" },
    err:  { bg:"#140e0e", border:"rgba(248,113,113,.38)", color:"#f87171" },
  };
  const c = MAP[type] || MAP.ok;
  Object.assign(t.style, { background:c.bg, border:`1px solid ${c.border}`, color:c.color });
  t.textContent = msg;

  requestAnimationFrame(() => {
    t.style.opacity   = "1";
    t.style.transform = "translateY(0)";
  });

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.style.opacity   = "0";
    t.style.transform = "translateY(10px)";
  }, 3200);
}

/* ────────────────────────────────────────────────
   RICH RESULT RENDERER
   Uses the exact same data.* paths as the original
──────────────────────────────────────────────── */
function renderResult(data) {
  const el = document.getElementById("result");   // ← original selector
  if (!el) return;

  const n = data.nutrition ?? {};

  const NUTRIENTS = [
    { key:"Calories",  icon:"🔥", hi:true  },
    { key:"Protein",   icon:"💪", hi:false },
    { key:"Carbs",     icon:"🌾", hi:false },
    { key:"Fat",       icon:"🫒", hi:false },
    { key:"Iron",      icon:"⚙️", hi:false },
    { key:"Vitamin C", icon:"🍋", hi:false },
  ];

  /* nutrition cells — data.nutrition?.* (original paths) */
  const nutriHTML = NUTRIENTS.map(({ key, icon, hi }, i) => `
    <div style="
      background:#141c16;border:1px solid rgba(74,222,128,.12);border-radius:5px;
      padding:16px 12px;text-align:center;
      opacity:0;transform:translateY(10px);
      transition:opacity .4s ease ${i * .07}s,transform .4s ease ${i * .07}s,
                 border-color .2s,background .2s;cursor:default;"
      class="kv-nc"
      onmouseover="this.style.borderColor='rgba(74,222,128,.4)';this.style.background='rgba(74,222,128,.05)'"
      onmouseout="this.style.borderColor='rgba(74,222,128,.12)';this.style.background='#141c16'">
      <span style="font-size:1.25rem;display:block;margin-bottom:6px">${icon}</span>
      <span style="
        font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:700;
        color:${hi ? "#4ade80" : "#e8f0ea"};display:block;margin-bottom:4px">
        ${escapeHTML(n[key])}
      </span>
      <span style="
        font-family:'IBM Plex Mono',monospace;font-size:9px;
        letter-spacing:.18em;text-transform:uppercase;color:rgba(232,240,234,.4)">
        ${escapeHTML(key)}
      </span>
    </div>`).join("");

  /* recipes — data.recipes (original path) */
  const recipesHTML = Array.isArray(data.recipes) && data.recipes.length
    ? data.recipes.map((r, i) => `
        <li style="
          display:grid;grid-template-columns:40px 1fr;gap:14px;align-items:center;
          padding:13px 0;border-bottom:1px solid rgba(74,222,128,.1);
          font-family:'Syne',sans-serif;font-size:.92rem;font-weight:600;
          color:rgba(232,240,234,.72);letter-spacing:-.01em;
          opacity:0;transform:translateX(-8px);
          transition:opacity .4s ease ${.35 + i * .08}s,transform .4s ease ${.35 + i * .08}s,
                     color .2s,padding-left .2s;cursor:default;"
          class="kv-ri"
          onmouseover="this.style.color='#e8f0ea';this.style.paddingLeft='6px'"
          onmouseout="this.style.color='rgba(232,240,234,.72)';this.style.paddingLeft='0'">
          <span style="
            font-family:'IBM Plex Mono',monospace;font-size:10px;
            color:#4ade80;text-align:right">0${i + 1}</span>
          ${escapeHTML(r)}
        </li>`)
      .join("")
    : `<li style="color:rgba(232,240,234,.3);font-style:italic;padding:12px 0">No recipes found.</li>`;

  el.innerHTML = `
    <div style="
      font-family:'Syne',sans-serif;
      background:#0e1410;border:1px solid rgba(74,222,128,.18);border-radius:7px;
      overflow:hidden;box-shadow:0 0 40px rgba(74,222,128,.07);
      animation:kvRise .55s ease both;">

      <!-- ── Detected Ingredient (data.ingredient) ── -->
      <div style="padding:26px 30px 22px;border-bottom:1px solid rgba(74,222,128,.1)">
        <p style="
          font-family:'IBM Plex Mono',monospace;font-size:10px;
          letter-spacing:.2em;text-transform:uppercase;color:#4ade80;
          margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <span style="width:18px;height:1px;background:#4ade80;display:inline-block;flex-shrink:0"></span>
          Detected Ingredient
        </p>
        <p style="
          font-family:'Instrument Serif',Georgia,serif;font-style:italic;
          font-size:clamp(1.9rem,5vw,3rem);color:#4ade80;
          line-height:1.1;letter-spacing:-.01em;margin:0">
          ${escapeHTML(data.ingredient)}
        </p>
      </div>

      <!-- ── Nutrition Information (data.nutrition?.*)  ── -->
      <div style="padding:22px 30px;border-bottom:1px solid rgba(74,222,128,.1)">
        <p style="
          font-family:'IBM Plex Mono',monospace;font-size:10px;
          letter-spacing:.2em;text-transform:uppercase;color:#4ade80;
          margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span style="width:18px;height:1px;background:#4ade80;display:inline-block;flex-shrink:0"></span>
          Nutrition Information
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${nutriHTML}
        </div>
      </div>

      <!-- ── Recipes (data.recipes) ── -->
      <div style="padding:22px 30px">
        <p style="
          font-family:'IBM Plex Mono',monospace;font-size:10px;
          letter-spacing:.2em;text-transform:uppercase;color:#4ade80;
          margin-bottom:4px;display:flex;align-items:center;gap:8px">
          <span style="width:18px;height:1px;background:#4ade80;display:inline-block;flex-shrink:0"></span>
          Recipes
        </p>
        <ol style="list-style:none;padding:0;margin:0">${recipesHTML}</ol>
      </div>

    </div>`;

  /* inject keyframe once */
  if (!$("kv-style")) {
    const s = document.createElement("style");
    s.id = "kv-style";
    s.textContent = `
      @keyframes kvRise {
        from { opacity:0; transform:translateY(16px) }
        to   { opacity:1; transform:translateY(0) }
      }
      @keyframes kvShake {
        0%,100%{transform:translateX(0)}
        20%{transform:translateX(-6px)} 40%{transform:translateX(6px)}
        60%{transform:translateX(-4px)} 80%{transform:translateX(4px)}
      }
      .kv-shake { animation:kvShake .5s ease }`;
    document.head.appendChild(s);
  }

  /* trigger stagger animations next frame */
  requestAnimationFrame(() => {
    el.querySelectorAll(".kv-nc,.kv-ri").forEach(node => {
      node.style.opacity   = "1";
      node.style.transform = "none";
    });
  });

  el.scrollIntoView({ behavior:"smooth", block:"start" });
}

/* ────────────────────────────────────────────────
   MAIN FUNCTION  ← original signature kept exactly
──────────────────────────────────────────────── */
function uploadImage() {

  /* ── original core (unchanged) ───────────────── */
  let fileInput = document.getElementById("imageUpload");
  let formData  = new FormData();
  formData.append("image", fileInput.files[0]);

  /* ── guard (non-breaking addition) ───────────── */
  if (!fileInput.files[0]) {
    toast("Please select an image first.", "warn");
    fileInput.closest("form")?.classList.add("kv-shake");
    setTimeout(() => fileInput.closest("form")?.classList.remove("kv-shake"), 600);
    return;
  }

  progressStart();
  toast("Analysing your ingredient…", "ok");

  /* ── original fetch chain (structure unchanged) ─ */
  fetch("/predict", {
    method: "POST",
    body:   formData,
  })

  .then(response => response.json())

  .then(data => {

    /*
     * Original plain-text version (preserved as reference):
     *
     * let result = `
     * Detected Ingredient: ${data.ingredient}
     * Nutrition Information
     * Calories:  ${data.nutrition?.Calories}
     * Protein:   ${data.nutrition?.Protein}
     * Carbs:     ${data.nutrition?.Carbs}
     * Fat:       ${data.nutrition?.Fat}
     * Iron:      ${data.nutrition?.Iron}
     * Vitamin C: ${data.nutrition?.["Vitamin C"]}
     * Recipes:
     * ${data.recipes.join(", ")}`;
     * document.getElementById("result").innerText = result;
     *
     * Same data.* paths — now rendered as rich HTML:
     */

    progressFinish(() => {
      renderResult(data);
      toast("✦ Analysis complete", "ok");
    });

  })

  /* ── error handling (addition, does not alter happy path) ── */
  .catch(err => {
    progressError();
    toast("Error: " + (err.message || "Request failed"), "err");

    const el = document.getElementById("result");
    if (el) {
      el.innerHTML = `
        <div style="
          background:#140e0e;border:1px solid rgba(248,113,113,.3);border-radius:6px;
          padding:20px 24px;font-family:'IBM Plex Mono',monospace;
          font-size:12px;color:#f87171;letter-spacing:.05em;">
          ✕ &nbsp;${escapeHTML(err.message || "Something went wrong. Please try again.")}
        </div>`;
    }
  });

}