/* =============================================================================
   IST Trust Zone — Sayt rejimi (Normal / Qış / Qar / Dark / Cyber) + keçid effektləri
   Rejim Firebase-də saxlanır:  ist/settings/mode
   Admin təsdiqlədikdə saytı açıq saxlayan HƏR KƏSDƏ avtomatik dəyişir.

   window.IstTheme
     MODES, INFO           – rejimlərin siyahısı və təsviri
     mode                  – hazırda ekranda göstərilən rejim
     remoteMode            – hamıda aktiv olan (bazadakı) rejim
     preview(m)/clearPreview() – yalnız bu ekranda önizləmə (admin üçün)
     commit(m)             – Promise: rejimi hamı üçün saxlayır
     onChange(fn)          – fn(mode) hər dəyişəndə çağırılır
     meta                  – {updatedAt, updatedBy} son dəyişiklik haqqında
   window.IstFx.transition(onCovered, onDone) – rejimə uyğun keçid effekti
   ============================================================================= */
(function () {
  "use strict";

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var KEY = "ist_mode_v2";
  var DEFAULT_MODE = "winter";
  var MODES = ["normal", "winter", "snow", "dark", "cyber", "micro"];
  var INFO = {
    normal: { name: "Normal",  desc: "Qarsız, sadə və təmiz görünüş." },
    winter: { name: "Qış",     desc: "Qar örtüyü, buz keçidləri, maus və barmaqla qarı sürüşdürmə." },
    snow:   { name: "Qar",     desc: "Səhər boz səması və yüngül qar yağışı." },
    dark:   { name: "Dark",    desc: "Yumşaq tünd rənglər — gözü yormayan rahat görünüş." },
    micro:  { name: "Micro",  desc: "Açıq rənglər, aydın mətnlər və rahat görünüş." },
    cyber:  { name: "Cyber",   desc: "Elektrik mavisi, neon yaşıl və siqnal sarısı." }
  };

  function valid(m) { return MODES.indexOf(m) !== -1 ? m : null; }
  function readCache() { try { return valid(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function writeCache(m) { try { localStorage.setItem(KEY, m); } catch (e) {} }

  var remote = readCache();          /* ilk boyama üçün son bilinən rejim (yanıb-sönmə olmasın) */
  var previewMode = null;
  var listeners = [];
  var meta = {};
  var current = null;

  function effective() { return previewMode || remote || DEFAULT_MODE; }

  function apply() {
    var m = effective();
    if (m === current) return;
    current = m;
    document.documentElement.setAttribute("data-mode", m);
    if (window.IstSnow) window.IstSnow.setMode(m);
    fxFor(m);
    listeners.forEach(function (fn) { try { fn(m); } catch (e) { console.error(e); } });
  }


  /* ===========================================================================
     Canlı fon: #bgfx (rejimlərə uyğun CSS effektləri)
     =========================================================================== */
  function ensureBgfx() {
    if (document.getElementById("bgfx")) return;
    var d = document.createElement("div"); d.id = "bgfx"; d.setAttribute("aria-hidden", "true");
    d.innerHTML = "<i></i><i></i><i></i>";
    document.body.insertBefore(d, document.body.firstChild);
  }
  function fxFor() { ensureBgfx(); }

  var api = {
    MODES: MODES,
    INFO: INFO,
    get mode() { return current || effective(); },
    get remoteMode() { return remote || DEFAULT_MODE; },
    get meta() { return meta; },
    preview: function (m) { previewMode = valid(m); apply(); },
    clearPreview: function () { previewMode = null; apply(); },
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    commit: function (m) {
      m = valid(m);
      if (!m) return Promise.reject(new Error("Yanlış rejim"));
      if (!window.ISTDB || !ISTDB.ok) return Promise.reject(new Error("Firebase əlçatan deyil"));
      return ISTDB.ref("ist/settings").update({ mode: m, updatedAt: ISTDB.now(), updatedBy: ISTDB.clientId });
    }
  };
  window.IstTheme = api;

  apply();

  if (window.ISTDB && ISTDB.ok) {
    ISTDB.ref("ist/settings").on("value", function (snap) {
      var v = snap.val() || {};
      remote = valid(v.mode) || DEFAULT_MODE;
      meta = { updatedAt: v.updatedAt || null, updatedBy: v.updatedBy || null };
      writeCache(remote);
      apply();
      /* meta dəyişikliyini də dinləyicilərə bildir */
      listeners.forEach(function (fn) { try { fn(current); } catch (e) {} });
    }, function (err) { console.warn("[theme] rejim oxunmadı:", err); });
  }

  /* ===========================================================================
     Keçid effektləri
     Qış rejimində: buz pərdəsi + külək zolaqları. Digər rejimlərdə: sakit solma.
     =========================================================================== */
  var canAnim = !!(document.documentElement.animate);

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function poly(a, b, c, d) { return "polygon(" + a + "% 0%," + b + "% 0%," + c + "% 100%," + d + "% 100%)"; }

  var T_IN = 400, T_OUT = 460, EASE = "cubic-bezier(.65,0,.35,1)";
  var IN_FROM = poly(0, 0, 0, 0), IN_TO = poly(0, 122, 110, 0);
  var OUT_FROM = IN_TO, OUT_TO = poly(122, 244, 232, 122);

  function makeSheet() {
    var el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;inset:0;z-index:9400;pointer-events:none;" +
      "background-color:#16314E;" +
      "background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.6px)," +
      "linear-gradient(118deg,#0E2037 0%,#16314E 55%,#1D3D5F 100%);" +
      "background-size:20px 20px,auto;";
    document.body.appendChild(el);
    return el;
  }

  function streaksFx(total, frontAt) {
    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9460";
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = window.innerWidth, H = window.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    document.body.appendChild(c);
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = "round";
    var P = [], t0 = 0, last = 0;
    function step(ts) {
      if (!t0) { t0 = last = ts; }
      var dt = Math.min(0.033, (ts - last) / 1000); last = ts;
      var el = ts - t0;
      if (el >= total) { c.remove(); return; }
      var fx = frontAt(el), n = Math.round(5 * dt * 60);
      for (var i = 0; i < n && P.length < 140; i++) {
        P.push({ x: fx + rnd(-34, 8), y: rnd(0, H), vx: rnd(900, 1500), vy: rnd(-25, 25), len: rnd(16, 44), life: rnd(0.22, 0.46), age: 0, a: rnd(0.45, 0.95) });
      }
      g.clearRect(0, 0, W, H);
      for (var j = P.length - 1; j >= 0; j--) {
        var p = P[j]; p.age += dt;
        if (p.age > p.life) { P.splice(j, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        var k = 1 - p.age / p.life;
        g.strokeStyle = "rgba(236,246,255," + (p.a * k).toFixed(3) + ")";
        g.lineWidth = 1.3 + k * 0.4;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.len * (0.35 + 0.65 * k), p.y); g.stroke();
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function frostSweep(onCovered, onDone) {
    var W = window.innerWidth, sheet = makeSheet();
    streaksFx(T_IN + T_OUT + 60, function (el) { return W * 1.22 * smooth(el < T_IN ? el / T_IN : (el - T_IN) / T_OUT); });
    var a1 = sheet.animate([{ clipPath: IN_FROM }, { clipPath: IN_TO }], { duration: T_IN, easing: EASE, fill: "forwards" });
    a1.onfinish = function () {
      onCovered();
      var a2 = sheet.animate([{ clipPath: OUT_FROM }, { clipPath: OUT_TO }], { duration: T_OUT, easing: EASE, fill: "forwards" });
      a2.onfinish = function () { sheet.remove(); if (onDone) onDone(); };
    };
  }

  function veil(onCovered, onDone) {
    var el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;inset:0;z-index:9400;pointer-events:none;background:#0B2A4A;opacity:0";
    document.body.appendChild(el);
    var a1 = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: "ease-out", fill: "forwards" });
    a1.onfinish = function () {
      onCovered();
      var a2 = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 230, easing: "ease-in", fill: "forwards" });
      a2.onfinish = function () { el.remove(); if (onDone) onDone(); };
    };
  }

  window.IstFx = {
    transition: function (onCovered, onDone) {
      if (reduce || !canAnim) { onCovered(); if (onDone) onDone(); return; }
      if (api.mode === "winter") frostSweep(onCovered, onDone); else veil(onCovered, onDone);
    }
  };
})();
