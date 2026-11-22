/* =============================================================================
   IST Trust Zone — Mesajlar (Firebase real vaxt)
   Məlumat yeri:  ist/messages  (Realtime Database)
   1) Konfiq/şablonlar  2) Köməkçilər  3) Store (Firebase)  4) Dəqiq axtarış
   5) Siyahılar + mesaj pəncərəsi  6) İdarəetmə paneli  7) Başlanğıc
   ============================================================================= */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------ 1) Konfiq ------------------------------ */
  var ADMIN_CODE = "1006";
  var DB_PATH = "ist/messages";
  var CACHE_KEY = "ist_msgs_cache_v1";
  var DEFAULT_BRANCHES = {
    elmler: { name: "Elmlər", map: "https://maps.app.goo.gl/Dc2B434XsM8aTFgu8" },
    ramana: { name: "Ramana", map: "https://maps.app.goo.gl/WuJ8NdbjYYQXct5D6" }
  };
  var PLACEHOLDERS = [
    ["{kurs}", "Kursun adı"], ["{kod}", "Qısa kod"], ["{tarix}", "Tarix"], ["{saat}", "Saat"],
    ["{filial}", "Filial"], ["{xerite}", "Xəritə linki"], ["{qiymet}", "Ödəniş"]
  ];
  var DEFAULT_TPL = {
    msg:
      "Salam.\n\nSizə bildiririk ki, *\u201C{kurs}\u201D* kursu aşağıdakı tarix və saatda başlayacaq:\n\n" +
      "\u{1F4C5} Tarix: {tarix}\n\u{1F563} Saat: {saat}\n\u{1F4CD} Məkan: {filial} filialı\n\u{1F4CC} Konum: {xerite}\n\n" +
      "Kursun ödənişi: {qiymet} AZN (rüsum daxil).\n\nÖdənişi Qeydiyyat şöbəsinə yaxınlaşaraq edə bilərsiniz.\n\n" +
      "Diqqət: Ödəniş kurs başlamazdan əvvəl və ya ilk dərs günü tam şəkildə edilməlidir. Əks halda qeydiyyat rəsmiləşdirilməyəcək.\n\n" +
      "Agentliyin tələblərinə əsasən, davamiyyət və dərs jurnalları nəzarətdə saxlanılır. Gecikmə və ya dərslərdə iştirak etməmə səbəbindən imtahana buraxılmama halında təlim müəssisəsi məsuliyyət daşımır.\n\n" +
      "Zəhmət olmasa, kursda iştirak edib-etməyəcəyinizi təsdiqləyin.",
    exam:
      "Salam,\n\nDövlət Dəniz və Liman Agentliyi tərəfindən {kurs} kursunun imtahanı keçiriləcəkdir.\n\n" +
      "\u{1F4C5} Tarix: {tarix}\n\u{23F0} Saat: {saat}\n\u{1F4CD} Yerləşdiyi ünvan: Dövlət Dəniz və Liman Agentliyi\n" +
      "\u{1F517} Konum: https://maps.app.goo.gl/R7kzyvyqhdYipxW76\n\n" +
      "Qeyd: İmtahana gələrkən şəxsiyyət vəsiqənizin əslini və 2 ədəd kopyasını özünüzlə gətirməyiniz mütləqdir. Əks təqdirdə imtahana buraxılmayacaqsınız."
  };

  function deriveBranch(base, k) { return String(base).replace(/\{filial\}/g, DEFAULT_BRANCHES[k].name).replace(/\{xerite\}/g, DEFAULT_BRANCHES[k].map); }
  function defaultTpl(key) {
    if (key === "msgElmler") return deriveBranch(DEFAULT_TPL.msg, "elmler");
    if (key === "msgRamana") return deriveBranch(DEFAULT_TPL.msg, "ramana");
    return DEFAULT_TPL.exam;
  }

  /* ---------------------------- 2) Köməkçilər ---------------------------- */
  function esc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  /* Böyük/kiçik hərf və ə/ı/ö/ü/ş/ç/ğ fərq etməsin (SI = si = sı) */
  function fold(s) {
    return String(s == null ? "" : s).replace(/İ/g, "i").replace(/I/g, "i").toLowerCase()
      .replace(/ı/g, "i").replace(/ə/g, "e").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");
  }
  function codeOf(abbr) { return fold(abbr).replace(/[^a-z]/g, ""); }         /* 251SI → si */
  function codeLabel(abbr) { return String(abbr || "").replace(/[^A-Za-zƏəİıÖöÜüŞşÇçĞğ]/g, "").toUpperCase(); }
  function wordStart(h, q) {
    var i = h.indexOf(q);
    while (i > -1) { if (i === 0 || /[\s\-\/(]/.test(h.charAt(i - 1))) return true; i = h.indexOf(q, i + 1); }
    return false;
  }
  function highlight(text, toks) {
    var src = String(text == null ? "" : text);
    if (!toks.length) return esc(src);
    var f = fold(src);
    if (f.length !== src.length) return esc(src);
    var rs = [];
    toks.forEach(function (t) { if (!t) return; var i = f.indexOf(t); while (i > -1) { rs.push([i, i + t.length]); i = f.indexOf(t, i + t.length); } });
    if (!rs.length) return esc(src);
    rs.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", pos = 0;
    rs.forEach(function (r) {
      if (r[1] <= pos) return;
      var s = Math.max(r[0], pos);
      out += esc(src.slice(pos, s)) + "<mark>" + esc(src.slice(s, r[1])) + "</mark>"; pos = r[1];
    });
    return out + esc(src.slice(pos));
  }
  function objToArr(o) {
    return Object.keys(o || {}).map(function (k) { return Object.assign({}, o[k], { id: k }); });
  }
  function clean(o) { var r = {}; Object.keys(o).forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
  function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; }

  var toastTimer;
  function toast(msg, kind) {
    var t = $("toast"); t.dataset.kind = kind || "ok"; $("toastText").textContent = msg;
    t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2500);
  }

  /* Təsdiq / mətn daxil etmə pəncərəsi */
  function ask(opts) {
    return new Promise(function (resolve) {
      var dlg = $("dlg"), inp = $("dlgInput");
      $("dlgTitle").textContent = opts.title; $("dlgText").textContent = opts.text || "";
      inp.hidden = !opts.input; inp.value = opts.value || "";
      $("dlgYes").textContent = opts.yes || "Təsdiqlə";
      dlg.classList.add("open");
      if (opts.input) setTimeout(function () { inp.focus(); inp.select(); }, 30);
      function done(v) { dlg.classList.remove("open"); $("dlgYes").onclick = $("dlgNo").onclick = inp.onkeydown = null; resolve(v); }
      $("dlgYes").onclick = function () { done(opts.input ? inp.value.trim() : true); };
      $("dlgNo").onclick = function () { done(opts.input ? null : false); };
      inp.onkeydown = function (e) { if (e.key === "Enter") $("dlgYes").click(); };
    });
  }

  /* ---------------------------- 3) Store (Firebase) ---------------------------- */
  var state = { courses: [], mixed: [], custom: [], tpl: null, seeded: false };
  var listeners = [], firstLoad = true;

  function cloneB(b) { return { elmler: Object.assign({}, b.elmler), ramana: Object.assign({}, b.ramana) }; }
  function branchOf(k) { return DEFAULT_BRANCHES[k] || DEFAULT_BRANCHES.elmler; }
  function tomorrow() { var d = new Date(); d.setDate(d.getDate() + 1); return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear(); }

  function defaultsState() {
    return {
      courses: DEFAULT_COURSES.map(function (c) { return Object.assign({}, c, { id: String(c.id) }); }),
      mixed: DEFAULT_MIXED.map(function (m, i) { return { id: m.id, title: m.title, content: m.content, ord: i + 1 }; }),
      custom: [], tpl: { msgElmler: defaultTpl("msgElmler"), msgRamana: defaultTpl("msgRamana"), exam: defaultTpl("exam") }, seeded: false
    };
  }
  function fromDb(v) {
    if (!v || !v.meta || !v.meta.seeded) return defaultsState();
    var byOrd = function (a, b) { return (a.ord || 0) - (b.ord || 0) || String(a.id).localeCompare(String(b.id)); };
    return {
      seeded: true,
      courses: objToArr(v.courses).filter(function (c) { return typeof c.name === "string"; }).sort(function (a, b) { return Number(a.id) - Number(b.id); }),
      mixed: objToArr(v.mixed).sort(byOrd),
      custom: objToArr(v.custom).map(function (c) { c.items = objToArr(c.items).sort(byOrd); return c; }).sort(byOrd),
      tpl: (function () {
        var t = v.templates || {};
        return {
          msgElmler: t.msgElmler || (t.msg ? deriveBranch(t.msg, "elmler") : defaultTpl("msgElmler")),
          msgRamana: t.msgRamana || (t.msg ? deriveBranch(t.msg, "ramana") : defaultTpl("msgRamana")),
          exam: t.exam || defaultTpl("exam")
        };
      })()
    };
  }
  function seedTree() {
    var t = { meta: { seeded: true }, templates: { msgElmler: defaultTpl("msgElmler"), msgRamana: defaultTpl("msgRamana"), exam: defaultTpl("exam") }, courses: {}, mixed: {} };
    DEFAULT_COURSES.forEach(function (c) { var o = Object.assign({}, c); delete o.id; t.courses[c.id] = o; });
    DEFAULT_MIXED.forEach(function (m, i) { t.mixed[m.id] = { title: m.title, content: m.content, ord: i + 1 }; });
    return t;
  }
  function setState(s, remote, meta) {
    state = s; reindex();
    listeners.forEach(function (fn) { try { fn(remote, meta); } catch (e) { console.error(e); } });
  }

  function startStore() {
    try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); if (c) state = fromDb(c); else state = defaultsState(); } catch (e) { state = defaultsState(); }
    reindex();
    if (!ISTDB.ok) return;
    ISTDB.ref(DB_PATH).on("value", function (snap) {
      var v = snap.val();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch (e) {}
      var meta = (v && v.meta) || {};
      var foreign = !firstLoad && meta.updatedBy && meta.updatedBy !== ISTDB.clientId;
      firstLoad = false;
      setState(fromDb(v), foreign, meta);
      if (foreign) toast("Mesajlar yeniləndi");
    }, function (err) { console.warn("[messages] oxunmadı:", err); toast("Məlumat oxunmadı", "error"); });
  }

  function seedIfNeeded() {
    if (state.seeded) return Promise.resolve();
    return ISTDB.ref(DB_PATH).transaction(function (cur) { return cur === null ? seedTree() : undefined; });
  }
  /* updates: DB_PATH-a nisbətən yol → dəyər (null = sil). Hamı üçün dərhal tətbiq olunur. */
  function write(updates) {
    if (!ISTDB.ok) return Promise.reject(new Error("Firebase əlçatan deyil"));
    return seedIfNeeded().then(function () {
      updates["meta/seeded"] = true;
      updates["meta/updatedAt"] = ISTDB.now();
      updates["meta/updatedBy"] = ISTDB.clientId;
      return ISTDB.ref(DB_PATH).update(updates);
    });
  }
  function newKey(child) { return ISTDB.ref(DB_PATH + "/" + child).push().key; }

  /* ---------------------------- 4) Dəqiq axtarış ---------------------------- */
  var IndexC = [], IndexM = [];
  var queries = { messages: "", exams: "", mixed: "" };
  function reindex() {
    IndexC = state.courses.map(function (c) {
      return { c: c, abbrF: fold(c.abbr), codeF: codeOf(c.abbr), nameF: fold(c.name), extra: fold((c.subtitle || "") + " " + (c.duration || "")) };
    });
    IndexM = state.mixed.map(function (m) { return { m: m, titleF: fold(m.title), contentF: fold(m.content) }; });
  }
  /* 0 = kod dəqiq uyğundur (SK → SK).  99 = uyğun deyil */
  function rankCourse(r, q, toks) {
    if (r.abbrF && (q === r.abbrF || q === r.codeF)) return 0;
    if (r.abbrF && (r.abbrF.indexOf(q) === 0 || (r.codeF && r.codeF.indexOf(q) === 0))) return 1;
    if (r.abbrF && r.abbrF.indexOf(q) > -1) return 2;
    if (r.nameF.indexOf(q) === 0) return 3;
    if (wordStart(r.nameF, q)) return 4;
    if (r.nameF.indexOf(q) > -1 || r.extra.indexOf(q) > -1) return 5;
    if (toks.length > 1) {
      var hay = r.abbrF + " " + r.nameF + " " + r.extra;
      if (toks.every(function (t) { return hay.indexOf(t) > -1; })) return 6;
    }
    return 99;
  }
  function tokens(q) { return fold(q).trim().split(/\s+/).filter(Boolean); }
  function searchCourses(q) {
    var f = fold(q).trim();
    if (!f) return IndexC.map(function (r) { return { c: r.c, r: 50 }; });
    var toks = tokens(q);
    return IndexC.map(function (r) { return { c: r.c, r: rankCourse(r, f, toks) }; })
      .filter(function (x) { return x.r < 99; })
      .sort(function (a, b) { return a.r - b.r || Number(a.c.id) - Number(b.c.id); });
  }
  function searchMixed(q) {
    var f = fold(q).trim();
    if (!f) return IndexM.map(function (r) { return { m: r.m, r: 50 }; });
    var toks = tokens(q);
    return IndexM.map(function (r) {
      var rank = 99;
      if (r.titleF.indexOf(f) === 0) rank = 0; else if (r.titleF.indexOf(f) > -1) rank = 1; else if (r.contentF.indexOf(f) > -1) rank = 2;
      else if (toks.length > 1 && toks.every(function (t) { return (r.titleF + " " + r.contentF).indexOf(t) > -1; })) rank = 3;
      return { m: r.m, r: rank };
    }).filter(function (x) { return x.r < 99; }).sort(function (a, b) { return a.r - b.r; });
  }

  /* ------------------------ 5) Siyahılar + mesaj pəncərəsi ------------------------ */
  var currentTab = "messages", selectedId = null, selectedMixed = null, selectedMode = "messages", selectedBranch = "elmler";
  var TABS = ["messages", "exams", "mixed"];
  var arrow = '<svg class="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>';

  function switchTab(tab) {
    if (TABS.indexOf(tab) < 0) return;
    currentTab = tab;
    TABS.forEach(function (t) {
      $("sec-" + t).classList.toggle("active", t === tab);
      var b = document.querySelector('.tab[data-tab="' + t + '"]'); b.classList.toggle("active", t === tab);
    });
    renderTab(tab);
  }
  function setCount(tab, n, searching) { var el = document.querySelector('[data-count="' + tab + '"]'); if (el) el.textContent = searching ? n + " nəticə" : ""; }

  function renderTab(tab) {
    var box = $("list-" + tab), q = queries[tab], toks = tokens(q);
    if (tab === "mixed") {
      var rowsM = searchMixed(q);
      setCount(tab, rowsM.length, toks.length > 0);
      if (!rowsM.length) { box.innerHTML = '<div class="empty">Nəticə tapılmadı</div>'; return; }
      box.innerHTML = rowsM.map(function (x) {
        return '<button class="item" type="button" data-mixed="' + esc(x.m.id) + '"><div class="lead"><span class="num">' + esc(String(x.m.id).replace(/^m/, "")) + '</span></div>' +
          '<div class="info"><div class="name">' + highlight(x.m.title, toks) + '</div><div class="sub">' + highlight(clip(x.m.content, 80), toks) + "</div></div>" + arrow + "</button>";
      }).join("");
      return;
    }
    var rows = searchCourses(q);
    setCount(tab, rows.length, toks.length > 0);
    if (!rows.length) { box.innerHTML = '<div class="empty">Nəticə tapılmadı</div>'; return; }
    box.innerHTML = rows.map(function (x, i) {
      var c = x.c, code = codeLabel(c.abbr);
      var lead = code ? '<span class="flag' + (x.r === 0 && toks.length ? " on" : "") + '">' + esc(code) + "</span>" : '<span class="num">' + esc(c.id) + "</span>";
      var badge = (c.dualBranch && tab === "messages") ? '<span class="badge">2 filial</span>' : "";
      return '<button class="item' + (x.r === 0 && toks.length && i === 0 ? " first" : "") + '" type="button" data-course="' + esc(c.id) + '"><div class="lead">' + lead + "</div>" +
        '<div class="info"><div class="name">' + highlight(c.name, toks) + "</div>" + badge + "</div>" + arrow + "</button>";
    }).join("");
  }
  function renderAll() { TABS.forEach(renderTab); }

  document.addEventListener("click", function (e) {
    var it = e.target.closest(".item");
    if (!it) return;
    if (it.dataset.course) openCourse(it.dataset.course, currentTab === "exams" ? "exams" : "messages");
    else if (it.dataset.mixed) openMixed(it.dataset.mixed);
  });
  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { switchTab(b.dataset.tab); }); });

  function findCourse(id) { return state.courses.find(function (c) { return String(c.id) === String(id); }) || null; }
  function findMixed(id) { return state.mixed.find(function (m) { return String(m.id) === String(id); }) || null; }

  function fill(tpl, v) { return String(tpl).replace(/\{(kurs|kod|tarix|saat|filial|xerite|qiymet)\}/g, function (m, k) { return v[k] != null && v[k] !== "" ? v[k] : m; }); }
  function tplFor(c, mode, branchKey) {
    if (mode === "exams") return c.tplExam || state.tpl.exam;
    if (c.dualBranch && branchKey === "ramana") return c.tplMsgRamana || c.tplMsg || state.tpl.msgRamana;
    return c.tplMsgElmler || c.tplMsg || state.tpl.msgElmler;
  }
  function vars(c, mode, date, time, b) {
    return { kurs: c.name, kod: codeLabel(c.abbr), tarix: date || "öz_tarixim", saat: mode === "exams" ? (time || "öz_saatım") : "08:30-16:20", filial: b.name, xerite: b.map, qiymet: c.total != null ? c.total : "" };
  }
  function openModal() { $("modal").classList.add("open"); }
  function closeModal() { $("modal").classList.remove("open"); selectedId = selectedMixed = null; }
  function openCourse(id, mode) {
    var c = findCourse(id); if (!c) return;
    selectedId = String(c.id); selectedMixed = null; selectedMode = mode; selectedBranch = "elmler";
    $("modalTitle").textContent = c.name;
    renderModalBody(); openModal();
  }
  function openMixed(id) {
    var m = findMixed(id); if (!m) return;
    selectedMixed = String(m.id); selectedId = null;
    $("modalTitle").textContent = m.title;
    $("modalBody").innerHTML = '<div class="msg-preview" id="msgPreview">' + esc(m.content) + "</div>"; openModal();
  }
  function renderModalBody() {
    var c = findCourse(selectedId); if (!c) return;
    var dual = c.dualBranch && selectedMode === "messages", html = "";
    if (dual) html += '<div class="branch"><button type="button" data-b="elmler" class="' + (selectedBranch === "elmler" ? "active" : "") + '">' + esc(branchOf("elmler").name) + '</button><button type="button" data-b="ramana" class="' + (selectedBranch === "ramana" ? "active" : "") + '">' + esc(branchOf("ramana").name) + '</button></div>';
    html += selectedMode === "messages"
      ? '<div class="inputs"><div><label for="inDate">Tarix</label><input class="field" id="inDate" placeholder="21.08.2026"></div></div>'
      : '<div class="inputs"><div><label for="inDate">Tarix</label><input class="field" id="inDate" placeholder="21.08.2026"></div><div><label for="inTime">Saat</label><input class="field" id="inTime" placeholder="11:30" inputmode="numeric"></div></div>';
    html += '<div class="msg-preview" id="msgPreview"></div>';
    $("modalBody").innerHTML = html;
    if (selectedMode === "exams") $("inDate").value = tomorrow();   /* imtahan tarixi: sabahkı gün (dəyişmək olar) */
    updatePreview();
  }
  function modalText() {
    if (selectedMixed) { var m = findMixed(selectedMixed); return m ? m.content : ""; }
    var c = findCourse(selectedId); if (!c) return "";
    var d = $("inDate") ? $("inDate").value.trim() : "", t = $("inTime") ? $("inTime").value.trim() : "";
    return fill(tplFor(c, selectedMode, selectedBranch), vars(c, selectedMode, d, t, branchOf(selectedBranch)));
  }
  function updatePreview() { var p = $("msgPreview"); if (p) p.textContent = modalText(); }
  $("modalBody").addEventListener("input", function (e) {
    if (e.target.id === "inTime") { var v = e.target.value.replace(/[^0-9]/g, ""); if (v.length > 2) v = v.slice(0, 2) + ":" + v.slice(2, 4); e.target.value = v; }
    updatePreview();
  });
  $("modalBody").addEventListener("click", function (e) {
    var b = e.target.closest("[data-b]"); if (!b) return;
    selectedBranch = b.dataset.b; var d = $("inDate").value; renderModalBody(); $("inDate").value = d; updatePreview();
  });
  $("modalClose").addEventListener("click", closeModal);
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });

  $("copyBtn").addEventListener("click", function () {
    var t = modalText();
    function ok() { if (window.__snowBurst) window.__snowBurst(); toast("Mesaj kopyalandı"); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { fallbackCopy(t, ok); });
    else fallbackCopy(t, ok);
  });
  function fallbackCopy(str, ok) {
    var ta = document.createElement("textarea"); ta.value = str; ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta); ta.select(); var done = false;
    try { done = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta); if (done) ok(); else toast("Kopyalama uğursuz oldu", "error");
  }

  /* Uzaqdan dəyişiklik gələndə açıq pəncərə də yenilənir (daxil edilmiş tarix saxlanılır) */
  listeners.push(function () {
    renderAll();
    if ($("modal").classList.contains("open") && selectedId) {
      var c = findCourse(selectedId);
      if (!c) { closeModal(); return; }
      $("modalTitle").textContent = c.name;
      updatePreview();
    }
    if (adminOpen) renderAdminCurrent();
  });

  /* ------------------------------ 6) İdarəetmə ------------------------------ */
  /* Ağac:  Əsas → Mesaj şablonları → (Kurs mesajı | İmtahan mesajı) → kurs siyahısı → redaktə
            Əsas → Qarışıq mesajlar / əlavə başlıqlar → mesaj siyahısı → redaktə                */
  var adminOpen = false, adminCat = null, editingId = null, formKind = null, adminQuery = "";
  var tf = null;   /* şablon redaktə vəziyyəti */
  var ico = {
    tpl: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>',
    chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/></svg>',
    exam: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    del: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>'
  };
  function showView(id) { document.querySelectorAll(".view").forEach(function (v) { v.classList.toggle("active", v.id === id); }); $("admin").scrollTop = 0; }

  function openAdmin() { closeModal(); adminOpen = true; $("admin").classList.add("open"); document.body.style.overflow = "hidden"; showMain(); }
  function closeAdmin() {
    adminOpen = false; $("admin").classList.remove("open"); document.body.style.overflow = "";
    TABS.forEach(function (t) { queries[t] = ""; $("q-" + t).value = ""; }); renderAll();
  }
  function showMain() { adminCat = null; renderCats(); showView("v-main"); }
  function renderAdminCurrent() {
    if ($("v-main").classList.contains("active")) renderCats();
    else if ($("v-list").classList.contains("active")) renderList(true);
  }
  function fail(err) { console.error(err); toast("Saxlanmadı: " + (err && err.message ? err.message : "xəta"), "error"); }

  function categories() {
    var cs = [
      { id: "templates", name: "Mesaj şablonları", s: "Kurs mesajı və imtahan mesajı — hər kurs üçün ayrıca", n: state.courses.length, ico: ico.tpl },
      { id: "mixed", name: "Qarışıq mesajlar", s: "Hazır cavab mətnləri", n: state.mixed.length, ico: ico.chat }
    ];
    state.custom.forEach(function (c) { cs.push({ id: "custom:" + c.id, name: c.name, s: "Əlavə başlıq", n: (c.items || []).length, ico: ico.chat }); });
    return cs;
  }
  function renderCats() {
    $("cats").innerHTML = categories().map(function (c) {
      return '<button class="cat" type="button" data-cat="' + esc(c.id) + '"><span class="ico">' + c.ico + '</span><span><b>' + esc(c.name) + '</b><span class="s">' + esc(c.s) + '</span></span><span class="cnt">' + c.n + "</span></button>";
    }).join("") + '<button class="add-dash" type="button" id="addCat">+ Yeni başlıq əlavə et</button>';
  }
  $("cats").addEventListener("click", function (e) {
    var cat = e.target.closest("[data-cat]");
    if (cat) { adminCat = cat.dataset.cat; adminQuery = ""; renderList(); showView("v-list"); return; }
    if (e.target.id === "addCat") {
      ask({ title: "Yeni başlıq", text: "Başlığın adını yazın:", input: true, yes: "Əlavə et" }).then(function (name) {
        if (!name) return;
        var id = "custom_" + newKey("custom");
        write({ ["custom/" + id]: { name: name.slice(0, 120), ord: Date.now() } }).then(function () { toast("Başlıq əlavə olundu"); }).catch(fail);
      });
    }
  });

  function customCat() { var id = String(adminCat).replace(/^custom:/, ""); return state.custom.find(function (c) { return String(c.id) === id; }); }
  function isTplCourses() { return adminCat === "tpl:msg" || adminCat === "tpl:exam"; }
  function customized(c, sub) { return sub === "exam" ? !!c.tplExam : !!(c.tplMsgElmler || c.tplMsgRamana || c.tplMsg); }

  function renderList(keepSearch) {
    var box = $("rows"), searchWrap = $("adminSearchWrap"), tools = $("listTools");
    tools.innerHTML = ""; $("addItem").hidden = true; searchWrap.hidden = true;

    /* --- Mesaj şablonları: 2 kateqoriya --- */
    if (adminCat === "templates") {
      $("listTitle").textContent = "Mesaj şablonları";
      box.innerHTML = '<div class="cats">' +
        '<button class="cat big" type="button" data-sub="msg"><span class="ico">' + ico.book + '</span><span><b>Kurs mesajı</b><span class="s">“Mesajlar” bölməsi — Elmlər və Ramana</span></span><span class="cnt">' + state.courses.length + ' kurs</span></button>' +
        '<button class="cat big" type="button" data-sub="exam"><span class="ico">' + ico.exam + '</span><span><b>İmtahan mesajı</b><span class="s">“İmtahanlar” bölməsi</span></span><span class="cnt">' + state.courses.length + ' kurs</span></button></div>';
      return;
    }
    /* --- Kurs siyahısı (istifadəçi paneli kimi) --- */
    if (isTplCourses()) {
      var sub = adminCat === "tpl:exam" ? "exam" : "msg";
      $("listTitle").textContent = sub === "exam" ? "İmtahan mesajı" : "Kurs mesajı";
      searchWrap.hidden = false;
      if (!keepSearch) $("adminSearch").value = adminQuery;
      var rows = searchCourses(adminQuery), toks = tokens(adminQuery);
      var html = '<button class="crow general" type="button" data-general="1"><span class="gi">' + ico.tpl + '</span><span class="info"><span class="t">Ümumi mətn — bütün kurslar üçün</span><span class="p">Fərdi mətni olmayan hər kurs bunu istifadə edir</span></span>' + ico.chev + '</button>';
      html += rows.length ? rows.map(function (x) {
        var c = x.c, code = codeLabel(c.abbr), custom = customized(c, sub);
        return '<button class="crow" type="button" data-course="' + esc(c.id) + '"><span class="lead">' + (code ? '<span class="flag">' + esc(code) + "</span>" : '<span class="num">' + esc(c.id) + "</span>") + '</span>' +
          '<span class="info"><span class="t">' + highlight(c.name, toks) + '</span><span class="p">' + (custom ? '<em class="st on">Fərdi mətn</em>' : '<em class="st">Ümumi mətn</em>') + (sub === "msg" && c.dualBranch ? '<em class="st br">Elmlər + Ramana</em>' : "") + "</span></span>" + ico.chev + "</button>";
      }).join("") : '<div class="empty">Nəticə tapılmadı</div>';
      box.innerHTML = html;
      return;
    }
    /* --- Qarışıq / əlavə başlıqlar --- */
    var cat = categories().find(function (c) { return c.id === adminCat; });
    if (!cat) { showMain(); return; }
    $("listTitle").textContent = cat.name;
    if (String(adminCat).indexOf("custom:") === 0) tools.innerHTML = '<button class="btn btn-ghost" type="button" data-tool="rename">Adı dəyiş</button> <button class="btn btn-danger" type="button" data-tool="delcat">Başlığı sil</button>';
    $("addItem").hidden = false; $("addItem").textContent = "+ Yeni mesaj əlavə et";
    var items = adminItems();
    box.innerHTML = items.length ? items.map(function (it) {
      return '<div class="arow"><div class="info"><div class="t">' + esc(it.t) + '</div><div class="p">' + esc(it.p) + '</div></div><div class="acts">' +
        '<button class="icon-btn" type="button" data-edit="' + esc(it.id) + '" title="Redaktə et" aria-label="Redaktə et">' + ico.edit + "</button>" +
        '<button class="icon-btn danger" type="button" data-del="' + esc(it.id) + '" title="Sil" aria-label="Sil">' + ico.del + "</button></div></div>";
    }).join("") : '<div class="empty">Hələ mesaj yoxdur</div>';
  }
  function adminItems() {
    if (adminCat === "mixed") return state.mixed.map(function (m) { return { id: m.id, t: m.title, p: m.content }; });
    var cat = customCat(); return cat ? (cat.items || []).map(function (i) { return { id: i.id, t: i.title, p: i.content }; }) : [];
  }
  $("adminSearch").addEventListener("input", function (e) { adminQuery = e.target.value; renderList(true); });
  $("listBack").addEventListener("click", function () {
    if (isTplCourses()) { adminCat = "templates"; renderList(); } else showMain();
  });
  $("addItem").addEventListener("click", function () { openItemForm(null); });
  $("listTools").addEventListener("click", function (e) {
    var t = e.target.dataset.tool, cat = customCat(); if (!t || !cat) return;
    if (t === "rename") ask({ title: "Başlığın adı", input: true, value: cat.name, yes: "Yadda saxla" }).then(function (n) { if (n) write({ ["custom/" + cat.id + "/name"]: n.slice(0, 120) }).then(function () { toast("Hamı üçün yeniləndi"); }).catch(fail); });
    else ask({ title: "Başlıq silinsin?", text: "“" + cat.name + "” və içindəki bütün mesajlar hamı üçün silinəcək.", yes: "Sil" }).then(function (ok) { if (ok) write({ ["custom/" + cat.id]: null }).then(function () { toast("Başlıq silindi"); showMain(); }).catch(fail); });
  });
  $("rows").addEventListener("click", function (e) {
    var sub = e.target.closest("[data-sub]");
    if (sub) { adminCat = "tpl:" + sub.dataset.sub; adminQuery = ""; renderList(); return; }
    var g = e.target.closest("[data-general]");
    if (g) { openTplForm(null); return; }
    var cr = e.target.closest("[data-course]");
    if (cr) { openTplForm(cr.dataset.course); return; }
    var ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) openItemForm(ed.dataset.edit);
    if (del) deleteItem(del.dataset.del);
  });
  function deleteItem(id) {
    var it = adminItems().find(function (x) { return String(x.id) === String(id); });
    ask({ title: "Silinsin?", text: "“" + (it ? clip(it.t, 80) : "") + "” hamı üçün silinəcək.", yes: "Sil" }).then(function (ok) {
      if (!ok) return;
      var path = adminCat === "mixed" ? "mixed/" + id : "custom/" + customCat().id + "/items/" + id;
      write({ [path]: null }).then(function () { toast("Silindi — hamıda yeniləndi"); }).catch(fail);
    });
  }

  function backToList() { renderList(); showView("v-list"); }
  $("formBack").addEventListener("click", backToList);

  /* ---- Qarışıq / əlavə başlıq mesajı formu ---- */
  function openItemForm(id) {
    formKind = "item"; editingId = id == null ? null : String(id);
    var cur = adminItems().find(function (i) { return String(i.id) === editingId; });
    $("formTitle").textContent = cur ? "Mesajı redaktə et" : "Yeni mesaj";
    $("form").innerHTML =
      '<div class="fgroup"><label for="fTitle">Başlıq</label><input id="fTitle" value="' + esc(cur ? cur.t : "") + '"></div>' +
      '<div class="fgroup"><label for="fText">Mesaj mətni</label><textarea id="fText" style="min-height:240px">' + esc(cur ? cur.p : "") + "</textarea></div>" + formFoot();
    showView("v-form");
  }
  function formFoot() {
    return '<div class="form-foot"><button class="btn btn-primary" type="button" id="formSave">Yadda saxla və hamıya tətbiq et</button><button class="btn btn-ghost" type="button" id="formCancel">Ləğv et</button></div>' +
      '<div class="apply-note">Təsdiqlədikdən sonra dəyişiklik saytı açan hər kəsdə avtomatik yenilənir.</div>';
  }

  /* ---- Şablon redaktəsi (kurs üzrə və ya ümumi) ---- */
  var chipLabels = { "{kurs}": "Kursun adı", "{kod}": "Qısa kod", "{tarix}": "Tarix", "{saat}": "Saat", "{filial}": "Filial", "{xerite}": "Xəritə linki", "{qiymet}": "Ödəniş" };
  function chipsFor(general, exam) {
    var list = general ? PLACEHOLDERS.map(function (p) { return p[0]; }) : (exam ? ["{tarix}", "{saat}"] : ["{tarix}"]);
    return '<div class="chips">' + list.map(function (k) { return '<button type="button" class="chip" data-ph="' + k + '" title="' + chipLabels[k] + '">' + chipLabels[k] + " " + k + "</button>"; }).join("") + "</div>";
  }
  /* Redaktə mətni: kurs üçün real dəyərlər (ad, ödəniş, filial) artıq yazılıb, yalnız {tarix}/{saat} qalır */
  function editBase(c, sub, bk) {
    var g = sub === "exam" ? state.tpl.exam : (bk === "ramana" ? state.tpl.msgRamana : state.tpl.msgElmler);
    var v = vars(c, sub === "exam" ? "exams" : "messages", "{tarix}", "{saat}", branchOf(bk));
    return fill(g, v);
  }
  function courseOverride(c, key) {
    if (key === "exam") return c.tplExam || "";
    if (key === "ramana") return c.tplMsgRamana || c.tplMsg || "";
    return c.tplMsgElmler || c.tplMsg || "";
  }

  function openTplForm(courseId) {
    var sub = adminCat === "tpl:exam" ? "exam" : "msg";
    var c = courseId ? findCourse(courseId) : null;
    if (courseId && !c) return;
    formKind = "tpl"; editingId = courseId ? String(courseId) : null;
    var keys = sub === "exam" ? ["exam"] : ["elmler", "ramana"];
    tf = { sub: sub, course: c, general: !c, keys: keys, cur: keys[0], text: {}, base: {}, dual: c ? !!c.dualBranch : false };
    keys.forEach(function (k) {
      if (c) {
        tf.base[k] = editBase(c, sub, k === "ramana" ? "ramana" : "elmler");
        tf.text[k] = courseOverride(c, k) || tf.base[k];
      } else {
        tf.text[k] = sub === "exam" ? state.tpl.exam : (k === "ramana" ? state.tpl.msgRamana : state.tpl.msgElmler);
        tf.base[k] = null;
      }
    });
    $("formTitle").textContent = (sub === "exam" ? "İmtahan mesajı" : "Kurs mesajı") + (c ? "" : " — ümumi mətn");
    renderTplForm();
    showView("v-form");
  }
  function branchBtns() {
    if (tf.sub === "exam") return "";
    return '<div class="seg big" id="tfSeg">' + tf.keys.map(function (k) {
      var nm = branchOf(k).name, changed = tf.course && tf.text[k] !== tf.base[k];
      return '<button type="button" data-k="' + k + '" class="' + (tf.cur === k ? "active" : "") + '">' + esc(nm) + (changed ? ' <i class="dot"></i>' : "") + "</button>";
    }).join("") + "</div>";
  }
  function renderTplForm() {
    var c = tf.course, head = "";
    if (c) {
      var code = codeLabel(c.abbr);
      head = '<div class="tf-head">' + (code ? '<span class="flag lg">' + esc(code) + "</span>" : "") + '<div><div class="tf-name">' + esc(c.name) + '</div><div class="tf-sub">' + (tf.sub === "exam" ? "İmtahan mesajı" : "Kurs mesajı") + "</div></div></div>";
    } else {
      head = '<div class="tf-head"><span class="gi">' + ico.tpl + '</span><div><div class="tf-name">Ümumi mətn</div><div class="tf-sub">Fərdi mətni olmayan bütün kurslara tətbiq olunur</div></div></div>';
    }
    var dualBox = (c && tf.sub === "msg") ? '<label class="check"><input type="checkbox" id="tfDual"' + (tf.dual ? " checked" : "") + '> Bu kursda Ramana filialı da var (istifadəçi panelində Elmlər/Ramana düyməsi görünür)</label>' : "";
    var note = c ? '<p class="fhint">Mətn istifadəçi panelindəki kimi yazılıb. <b>{tarix}</b>' + (tf.sub === "exam" ? " və <b>{saat}</b>" : "") + ' istifadə zamanı avtomatik doldurulur — onları olduğu kimi saxlayın. <button type="button" class="link-btn" id="tfReset">Ümumi mətnə qaytar</button></p>'
      : '<p class="fhint">{kurs}, {tarix} kimi sözlər istifadə zamanı avtomatik doldurulur. <button type="button" class="link-btn" id="tfReset">Standart mətnə qaytar</button></p>';
    $("form").innerHTML = head + branchBtns() + dualBox +
      '<div class="fgroup"><textarea id="tfText" class="bubble" aria-label="Mesaj mətni"></textarea>' + note + chipsFor(!c, tf.sub === "exam") + "</div>" + formFoot();
    $("tfText").value = tf.text[tf.cur];
  }
  $("form").addEventListener("input", function (e) { if (e.target.id === "tfText" && tf) tf.text[tf.cur] = e.target.value; });
  $("form").addEventListener("change", function (e) { if (e.target.id === "tfDual" && tf) tf.dual = e.target.checked; });
  $("form").addEventListener("click", function (e) {
    var t = e.target;
    if (formKind === "tpl" && tf) {
      var ph = t.closest("[data-ph]");
      if (ph) { var ta = $("tfText"), s = ta.selectionStart, en = ta.selectionEnd; ta.value = ta.value.slice(0, s) + ph.dataset.ph + ta.value.slice(en); ta.focus(); ta.selectionStart = ta.selectionEnd = s + ph.dataset.ph.length; tf.text[tf.cur] = ta.value; return; }
      var sg = t.closest("#tfSeg button");
      if (sg) { tf.text[tf.cur] = $("tfText").value; tf.cur = sg.dataset.k; var keepDual = $("tfDual") ? $("tfDual").checked : tf.dual; tf.dual = keepDual; renderTplForm(); return; }
      if (t.id === "tfReset") {
        tf.text[tf.cur] = tf.course ? tf.base[tf.cur] : defaultTpl(tf.sub === "exam" ? "exam" : (tf.cur === "ramana" ? "msgRamana" : "msgElmler"));
        $("tfText").value = tf.text[tf.cur]; if ($("tfSeg")) { var d = $("tfDual") ? $("tfDual").checked : tf.dual; tf.dual = d; renderTplForm(); } return;
      }
    }
    if (t.id === "formCancel") { backToList(); return; }
    if (t.id === "formSave") saveForm();
  });

  function saveForm() {
    var btn = $("formSave"), upd = {};
    if (formKind === "tpl") {
      tf.text[tf.cur] = $("tfText").value;
      for (var i = 0; i < tf.keys.length; i++) if (!String(tf.text[tf.keys[i]]).trim()) { toast("Mesaj boş ola bilməz", "warn"); return; }
      if (tf.course) {
        var id = tf.course.id, fld = { exam: "tplExam", elmler: "tplMsgElmler", ramana: "tplMsgRamana" };
        tf.keys.forEach(function (k) { upd["courses/" + id + "/" + fld[k]] = tf.text[k] === tf.base[k] ? null : tf.text[k].slice(0, 20000); });
        if (tf.sub === "msg") {
          upd["courses/" + id + "/tplMsg"] = null;
          upd["courses/" + id + "/dualBranch"] = $("tfDual") ? ($("tfDual").checked ? true : null) : (tf.dual ? true : null);
        }
      } else if (tf.sub === "exam") upd["templates/exam"] = tf.text.exam;
      else { upd["templates/msgElmler"] = tf.text.elmler; upd["templates/msgRamana"] = tf.text.ramana; }
    } else {
      var title = $("fTitle").value.trim(), text = $("fText").value.trim();
      if (!title || !text) { toast("Başlıq və mətn boş ola bilməz", "warn"); return; }
      var base = adminCat === "mixed" ? "mixed/" : "custom/" + customCat().id + "/items/";
      var list = adminCat === "mixed" ? state.mixed : (customCat().items || []);
      var dup = list.some(function (x) { return String(x.id) !== editingId && x.title === title && x.content === text; });
      if (dup) { toast("Bu mesaj artıq mövcuddur", "warn"); return; }
      var key = editingId || newKey(adminCat === "mixed" ? "mixed" : "custom/" + customCat().id + "/items");
      var ex = list.find(function (x) { return String(x.id) === editingId; });
      upd[base + key] = { title: title.slice(0, 200), content: text.slice(0, 20000), ord: ex && ex.ord ? ex.ord : Date.now() };
    }
    btn.disabled = true; btn.textContent = "Saxlanılır…";
    write(upd).then(function () { toast("Hamı üçün yeniləndi"); backToList(); }).catch(function (err) { btn.disabled = false; btn.textContent = "Yadda saxla və hamıya tətbiq et"; fail(err); });
  }
  $("adminExit").addEventListener("click", closeAdmin);

  /* ------------------------------ 7) Başlanğıc ------------------------------ */
  TABS.forEach(function (t) {
    var inp = $("q-" + t);
    inp.addEventListener("input", function () {
      if (fold(inp.value).trim() === ADMIN_CODE) { inp.value = ""; queries[t] = ""; renderTab(t); openAdmin(); return; }
      queries[t] = inp.value; renderTab(t);
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Escape" && inp.value) { inp.value = ""; queries[t] = ""; renderTab(t); e.stopPropagation(); } });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if ($("dlg").classList.contains("open")) return;
      if ($("modal").classList.contains("open")) { closeModal(); e.preventDefault(); return; }
      if (adminOpen) { closeAdmin(); e.preventDefault(); }
    }
    if (e.ctrlKey && e.code === "Space") { e.preventDefault(); switchTab(TABS[(TABS.indexOf(currentTab) + 1) % TABS.length]); }
  });
  /* Ana səhifədən gələn “idarəetməni aç” əmri */
  window.addEventListener("message", function (e) { if (e.data && e.data.ist === "open-admin") openAdmin(); });
  startStore();
  switchTab("messages");
  if (location.hash === "#admin") openAdmin();
})();
