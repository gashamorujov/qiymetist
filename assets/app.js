/* =============================================================================
   IST Trust Zone — əsas səhifənin məntiqi
   1) Köməkçilər   2) Cədvəl + axtarış   3) Hesablama + PDF   4) Kurs adı pəncərəsi
   5) Reklam (PNG)   6) Mesajlar qatı   7) İdarəetmə paneli (1006)   8) Başlanğıc
   ============================================================================= */
(function () {
  "use strict";

  var COURSES = window.COURSES || [];
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------- 1) Köməkçilər ---------------------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /* Axtarış üçün qatlama: böyük/kiçik hərf və Azərbaycan hərfləri (ə→e, ı→i, ş→s ...) fərq etməz. */
  function fold(s) {
    return String(s == null ? "" : s).replace(/İ/g, "i").replace(/I/g, "i").toLowerCase()
      .replace(/ı/g, "i").replace(/ə/g, "e").replace(/ö/g, "o").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");
  }
  function fmt(n) {
    if (n === null || n === undefined) return null;
    return n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function dash() { return '<span class="dash">—</span>'; }
  function hrsToDays(h) { return h !== null ? Math.ceil(h / 8) : "—"; }

  var toastTimer;
  function toast(msg, kind) {
    var t = $("toast");
    t.dataset.kind = kind || "ok";
    $("toastText").textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ----------------------- 2) Cədvəl + dəqiq axtarış ---------------------- */
  var tableBody = $("tableBody"), emptyState = $("emptyState"), searchInput = $("searchInput"),
      clearBtn = $("clearBtn"), searchMeta = $("searchMeta"), panel = $("panel");
  var selected = new Map();

  function wordStart(h, q) {
    var i = h.indexOf(q);
    while (i > -1) { if (i === 0 || /[\s\-\/(]/.test(h.charAt(i - 1))) return true; i = h.indexOf(q, i + 1); }
    return false;
  }

  /* Kod dəqiq uyğun gələrsə ən üstdə: SK → SK, SL → SL.  0 = ən yaxşı, 99 = uyğun deyil */
  function rank(c, q, toks) {
    var code = fold(c.code), az = fold(c.az), en = fold(c.en);
    if (code === q) return 0;
    if (code.indexOf(q) === 0) return 1;
    if (code.indexOf(q) > -1) return 2;
    if (az.indexOf(q) === 0 || en.indexOf(q) === 0) return 3;
    if (wordStart(az, q) || wordStart(en, q)) return 4;
    if (az.indexOf(q) > -1 || en.indexOf(q) > -1) return 5;
    if (toks.length > 1) {
      var hay = code + " " + az + " " + en;
      if (toks.every(function (t) { return hay.indexOf(t) > -1; })) return 6;
    }
    return 99;
  }

  function filterCourses(raw) {
    var q = fold(raw).trim();
    if (!q) return COURSES;
    var toks = q.split(/\s+/).filter(Boolean);
    return COURSES
      .map(function (c) { return { c: c, r: rank(c, q, toks) }; })
      .filter(function (x) { return x.r < 99; })
      .sort(function (a, b) { return a.r - b.r || a.c.no - b.c.no; })
      .map(function (x) { return x.c; });
  }

  function rowHtml(c) {
    var on = selected.has(c.code), canAdd = c.price !== null;
    return '<div class="row cols' + (on ? " added" : "") + '" data-code="' + esc(c.code) + '">' +
      '<div class="no">' + c.no + "</div>" +
      '<div class="flag' + (on ? " on" : "") + '" data-act="name" role="button" tabindex="0" title="Kursun adını göstər">' + esc(c.code) + "</div>" +
      '<div class="nm" data-act="name"><div class="az">' + esc(c.az) + '</div><div class="en">' + esc(c.en) + "</div></div>" +
      '<div class="cell">' + (c.hours !== null ? c.hours : dash()) + "<small>saat</small></div>" +
      '<div class="cell">' + (c.count !== null ? c.count + " nəfər" : dash()) + "<small>qrup</small></div>" +
      '<div class="cell price"><b>' + (c.price !== null ? fmt(c.price) + " AZN" : dash()) + "</b></div>" +
      '<div class="cell price"><b>' + (c.fee !== null ? fmt(c.fee) + " AZN" : dash()) + "</b>" + (c.fee !== null ? "<small>rüsumla</small>" : "") + "</div>" +
      '<div class="meta"><div class="l"><span><b>' + (c.hours !== null ? c.hours : "—") + "</b> saat</span><span><b>" + (c.count !== null ? c.count : "—") + "</b> nəfər</span></div>" +
        '<div class="p"><b>' + (c.price !== null ? fmt(c.price) + " AZN" : "—") + "</b><small>" + (c.fee !== null ? "rüsumla " + fmt(c.fee) + " AZN" : "") + "</small></div></div>" +
      '<button class="add' + (on ? " on" : "") + '" type="button" data-act="toggle"' + (canAdd ? "" : " disabled") + ' aria-label="Hesablamaya əlavə et">' + (on ? "✓" : "+") + "</button>" +
      "</div>";
  }

  function renderTable(list) {
    if (!list.length) { tableBody.innerHTML = ""; emptyState.hidden = false; return; }
    emptyState.hidden = true;
    tableBody.innerHTML = list.map(rowHtml).join("");
  }

  function currentList() { return filterCourses(searchInput.value); }
  function refresh() { renderTable(currentList()); renderCalc(); }

  function updateSearchMeta(list) {
    var q = searchInput.value.trim();
    searchMeta.innerHTML = (q && list.length !== COURSES.length)
      ? "<b>" + COURSES.length + "</b> kursdan <b>" + list.length + "</b>-u tapıldı" : "";
  }

  function toggleSelect(course) {
    if (selected.has(course.code)) selected.delete(course.code); else selected.set(course.code, course);
    refresh();
  }

  tableBody.addEventListener("click", function (e) {
    var act = e.target.closest("[data-act]");
    if (!act) return;
    var row = act.closest(".row");
    var course = row && COURSES.find(function (c) { return c.code === row.dataset.code; });
    if (!course) return;
    if (act.dataset.act === "toggle") toggleSelect(course); else showName(course);
  });
  tableBody.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("flag")) {
      e.preventDefault(); e.target.click();
    }
  });

  searchInput.addEventListener("input", function () {
    var v = searchInput.value;
    /* Gizli idarəetmə kodu */
    if (fold(v).trim() === "1006") {
      searchInput.value = ""; clearBtn.classList.remove("show");
      renderTable(COURSES); updateSearchMeta(COURSES);
      openAdmin();
      return;
    }
    clearBtn.classList.toggle("show", v.length > 0);
    var list = filterCourses(v);
    renderTable(list); updateSearchMeta(list);
  });
  /* Enter: yazılan kod kursun koduna dəqiq uyğundursa kurs seçilir və axtarış təmizlənir */
  searchInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var q = fold(searchInput.value).trim();
    if (!q) return;
    var course = COURSES.find(function (c) { return fold(c.code) === q; });
    if (!course || course.price === null) return;
    e.preventDefault();
    if (!selected.has(course.code)) selected.set(course.code, course);
    searchInput.value = ""; clearBtn.classList.remove("show");
    refresh(); updateSearchMeta(COURSES);
  });
  clearBtn.addEventListener("click", function () {
    searchInput.value = ""; clearBtn.classList.remove("show");
    renderTable(COURSES); updateSearchMeta(COURSES); searchInput.focus();
  });
  /* -------------------------- 3) Hesablama + PDF -------------------------- */
  var calcItems = $("calcItems"), calcCountBadge = $("calcCountBadge"), sumBase = $("sumBase"),
      sumDiscount = $("sumDiscount"), sumTotal = $("sumTotal"), sumTotalLabel = $("sumTotalLabel"),
      discountSelect = $("discountSelect"), feeModeSelect = $("feeMode"), discountNote = $("discountNote"),
      customWrap = $("customDiscountWrap"), customInput = $("customDiscountInput");

  function discountNoteText(mode, withFee, customRate) {
    if (mode === "martyr") return "Hər seçilmiş kurs üzrə yalnız 16 AZN ödənilir.";
    if (mode === "none") return "";
    var rate = mode === "custom" ? customRate : (mode === "veteran" ? 30 : mode === "war" ? 10 : mode === "disability" ? 15 : "");
    return withFee
      ? "Rüsumsuz qiymətə " + rate + "% endirim tətbiq olunur, üzərinə 16 AZN rüsum əlavə edilir."
      : "Rüsumsuz qiymətə " + rate + "% endirim tətbiq olunur.";
  }

  function renderCalc() {
    var items = Array.from(selected.values()), n = items.length;
    var withFee = feeModeSelect.value === "fee";
    calcCountBadge.textContent = n + " kurs";

    if (!n) {
      calcItems.innerHTML = '<div class="calc-empty">Hələ kurs seçilməyib. Cədvəldəki “+” düyməsinə bas.</div>';
    } else {
      calcItems.innerHTML = items.map(function (c) {
        return '<div class="ci"><div><div class="ci-name">' + esc(c.az) + '</div><div class="ci-code">' + esc(c.code) + "</div></div>" +
          '<div class="ci-r"><div class="ci-price">' + fmt(c.price) + " AZN" + (withFee ? " + 16 AZN rüsum" : "") + '</div>' +
          '<button class="ci-rm" type="button" data-code="' + esc(c.code) + '">sil</button></div></div>';
      }).join("");
    }

    var baseSum = items.reduce(function (s, c) { return s + (c.price || 0); }, 0);
    var feeSum = items.reduce(function (s, c) { return s + (c.fee || 0); }, 0);
    var totalFee = n * 16;
    var mode = discountSelect.value;
    var customRate = Math.min(Math.max(parseFloat(customInput.value) || 0, 0), 100);
    discountNote.textContent = discountNoteText(mode, withFee, customRate);
    customWrap.hidden = mode !== "custom";

    var finalTotal = withFee ? feeSum : baseSum, discountAmount = 0;
    function applyPct(rate) { discountAmount = baseSum * rate; finalTotal = (baseSum - discountAmount) + (withFee ? totalFee : 0); }

    if (mode === "martyr") { finalTotal = n * 16; discountAmount = (withFee ? feeSum : baseSum) - finalTotal; }
    else if (mode === "custom") applyPct(customRate / 100);
    else if (mode === "veteran") applyPct(0.30);
    else if (mode === "war") applyPct(0.10);
    else if (mode === "disability") applyPct(0.15);

    sumBase.textContent = fmt(baseSum) + " AZN";
    sumDiscount.textContent = (discountAmount > 0 ? "− " : "") + fmt(discountAmount) + " AZN";
    sumTotal.textContent = fmt(finalTotal) + " AZN";
    sumTotalLabel.textContent = withFee ? "Yekun (rüsum daxil)" : "Yekun (rüsumsuz)";
  }

  calcItems.addEventListener("click", function (e) {
    var b = e.target.closest(".ci-rm");
    if (!b) return;
    var c = COURSES.find(function (x) { return x.code === b.dataset.code; });
    if (c) toggleSelect(c);
  });
  discountSelect.addEventListener("change", renderCalc);
  feeModeSelect.addEventListener("change", renderCalc);
  customInput.addEventListener("input", renderCalc);

  function selectPreset(codes) {
    codes.forEach(function (code) {
      var c = COURSES.find(function (x) { return x.code === code; });
      if (c && !selected.has(code)) selected.set(code, c);
    });
    refresh();
  }
  $("select5Btn").addEventListener("click", function () { selectPreset(["SP", "SH", "SL", "SI", "SO"]); });
  $("select3Btn").addEventListener("click", function () { selectPreset(["SH", "SL", "SK"]); });
  $("selectZ1Btn").addEventListener("click", function () { selectPreset(["DL", "SJ", "SN", "SW"]); });
  $("selectZ2Btn").addEventListener("click", function () { selectPreset(["SN", "SJ", "DL", "ER"]); });
  $("clearCalc").addEventListener("click", function () { selected.clear(); refresh(); });

  var pdfBtn = $("exportPdf"), pdfBtnHtml = pdfBtn.innerHTML;
  function generatePdf() {
    var items = Array.from(selected.values());
    if (!items.length) {
      pdfBtn.textContent = "⚠ Heç bir kurs seçilməyib";
      setTimeout(function () { pdfBtn.innerHTML = pdfBtnHtml; }, 2000);
      return;
    }
    pdfBtn.disabled = true; pdfBtn.textContent = "⏳ Hazırlanır...";

    var tmpl = $("pdfTemplate");
    $("pdfLogo").src = window.IST_LOGO || "";

    var now = new Date();
    $("pdfDate").textContent = String(now.getDate()).padStart(2, "0") + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + now.getFullYear();
    $("pdfCount").textContent = items.length;
    var totalHours = items.reduce(function (s, c) { return s + (c.hours || 0); }, 0);
    $("pdfDays").textContent = hrsToDays(totalHours);

    var mode = discountSelect.value, withFee = feeModeSelect.value === "fee";
    var customRate = Math.min(Math.max(parseFloat(customInput.value) || 0, 0), 100);
    var labels = {
      none: "Yoxdur", veteran: "Qazi (30% endirim)", war: "Müharibə iştirakçısı (10% endirim)",
      disability: "Əlilliyi olan şəxs (15% endirim)", custom: "Xüsusi faiz (" + customRate + "% endirim)", martyr: "Şəhid ailəsi (I dərəcə)"
    };
    $("pdfDiscount").textContent = labels[mode] || mode;

    var hasDiscount = mode !== "none";
    $("pdfDiscHead").style.display = hasDiscount ? "" : "none";
    $("pdfSumOrigRow").style.display = "";
    $("pdfSumDiscRow").style.display = hasDiscount ? "" : "none";

    function courseOrig(c) { return withFee ? (c.fee || 0) : (c.price || 0); }
    function courseDisc(c) {
      if (mode === "martyr") return 16;
      var base = c.price || 0, add = withFee ? 16 : 0;
      if (mode === "custom") return base * (1 - customRate / 100) + add;
      if (mode === "veteran") return base * 0.70 + add;
      if (mode === "war") return base * 0.90 + add;
      if (mode === "disability") return base * 0.85 + add;
      return courseOrig(c);
    }
    var fmtA = function (n) { return n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AZN"; };
    var origTotal = items.reduce(function (s, c) { return s + courseOrig(c); }, 0);
    var discTotal = items.reduce(function (s, c) { return s + courseDisc(c); }, 0);

    $("pdfTbody").innerHTML = items.map(function (c, i) {
      return '<tr style="' + (i % 2 === 0 ? "background:#F6F8FA;" : "") + '">' +
        '<td style="padding:8px 10px; text-align:left; color:#5C7387;">' + (i + 1) + "</td>" +
        '<td style="padding:8px 10px; text-align:left; font-weight:600; font-size:10.5px;">' + esc(c.az) + "</td>" +
        '<td style="padding:8px 10px; text-align:center;">' + hrsToDays(c.hours) + "</td>" +
        '<td style="padding:8px 10px; text-align:right; font-weight:600;">' + fmtA(courseOrig(c)) + "</td>" +
        (hasDiscount ? '<td style="padding:8px 10px; text-align:right; font-weight:700; background:#F3EAD4;">' + fmtA(courseDisc(c)) + "</td>" : "") +
        "</tr>";
    }).join("");
    $("pdfSumOriginal").textContent = fmtA(origTotal);
    $("pdfSumTotal").textContent = fmtA(discTotal);

    tmpl.style.cssText += ";position:fixed;left:0;top:0;z-index:99999;opacity:1;pointer-events:none";
    function hide() { tmpl.style.opacity = "0"; tmpl.style.zIndex = "-1"; tmpl.style.left = "-9999px"; }

    setTimeout(function () {
      html2canvas(tmpl, { scale: 3, useCORS: true, logging: false, backgroundColor: "#ffffff", width: 794, windowWidth: 794 })
        .then(function (canvas) {
          var doc = new window.jspdf.jsPDF("p", "mm", "a4");
          var imgW = 190, imgH = (canvas.height / canvas.width) * imgW;
          doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, 10, imgW, imgH);
          doc.save("IST_Trust_Zone_qiymet_teklifi.pdf");
          hide(); pdfBtn.disabled = false; pdfBtn.innerHTML = pdfBtnHtml;
        })
        .catch(function (err) {
          console.error("html2canvas xətası:", err);
          hide(); pdfBtn.disabled = false; pdfBtn.textContent = "Xəta baş verdi";
          setTimeout(function () { pdfBtn.innerHTML = pdfBtnHtml; }, 2200);
        });
    }, 200);
  }
  pdfBtn.addEventListener("click", generatePdf);

  /* ------------------------- 4) Kurs adı pəncərəsi ------------------------- */
  var nameScrim = $("nameScrim");
  function openScrim(el) { el.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeScrim(el) { el.classList.remove("open"); if (!document.querySelector(".scrim.open, .layer.show")) document.body.style.overflow = ""; }
  function showName(c) {
    $("nameCode").textContent = c.code;
    $("nameAz").textContent = c.az;
    $("nameEn").textContent = c.en || "";
    $("nameFacts").innerHTML =
      '<div class="fact"><span>Müddət</span><b>' + (c.hours !== null ? c.hours + " saat" : "—") + "</b></div>" +
      '<div class="fact"><span>Qrup</span><b>' + (c.count !== null ? c.count + " nəfər" : "—") + "</b></div>" +
      '<div class="fact"><span>Rüsumla</span><b>' + (c.fee !== null ? fmt(c.fee) + " AZN" : "—") + "</b></div>";
    openScrim(nameScrim);
  }
  document.addEventListener("click", function (e) {
    var closer = e.target.closest("[data-close]");
    if (closer) { closeScrim($(closer.dataset.close)); return; }
    if (e.target === nameScrim) closeScrim(nameScrim);
  });

  /* ------------------------- 5) Reklam / kurs elanı ------------------------ */
  var HOURS_PER_DAY = 8;
  var adLayer = $("adLayer"), adSearchInput = $("adSearchInput"), adResults = $("adSearchResults"),
      adEmpty = $("adSearchEmpty"), adSelList = $("adSelectedList"), adSelEmpty = $("adSelectedEmpty"),
      adSelCount = $("adSelectedCount"), adFeeNo = $("adFeeNo"), adFeeYes = $("adFeeYes"),
      adTableWrap = $("adPosterTableWrap"), adPoster = $("adPoster"), adScale = $("adPosterScale"),
      adFrame = $("adPreviewFrame"), adExportBtn = $("adExportBtn");
  var adSelected = new Map(), adFeeMode = "nofee";

  function adFit() {
    var avail = adFrame.clientWidth - 2 * parseFloat(getComputedStyle(adFrame).paddingLeft || 0);
    var scale = Math.min(1, avail / 900);
    adScale.style.transform = scale < 1 ? "scale(" + scale + ")" : "";
    adScale.style.marginBottom = scale < 1 ? (scale - 1) * adPoster.offsetHeight + "px" : "";
  }
  window.addEventListener("resize", adFit);

  function adPrice(c) { return c.price == null ? null : (adFeeMode === "fee" ? c.fee : c.price); }
  function adDays(c) { return c.hours ? Math.max(1, Math.ceil(c.hours / HOURS_PER_DAY)) : 1; }
  function fmtDate(d) { return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear(); }
  function adEnd(startStr, c) {
    if (!startStr) return null;
    var s = new Date(startStr + "T00:00:00");
    if (isNaN(s.getTime())) return null;
    var e = new Date(s); e.setDate(e.getDate() + adDays(c) - 1);
    return e;
  }

  function adRenderSearch(q) {
    var query = fold(q).trim();
    if (!query) { adResults.classList.remove("show"); adEmpty.classList.remove("show"); adResults.innerHTML = ""; return; }
    var toks = query.split(/\s+/);
    var matches = COURSES.map(function (c) { return { c: c, r: rank(c, query, toks) }; })
      .filter(function (x) { return x.r < 99 && !adSelected.has(x.c.no); })
      .sort(function (a, b) { return a.r - b.r || a.c.no - b.c.no; })
      .slice(0, 30).map(function (x) { return x.c; });
    if (!matches.length) { adResults.classList.remove("show"); adEmpty.classList.add("show"); adResults.innerHTML = ""; return; }
    adEmpty.classList.remove("show"); adResults.classList.add("show");
    adResults.innerHTML = matches.map(function (c) {
      return '<div class="ad-res" data-no="' + c.no + '"><span class="flag">' + esc(c.code) + '</span><span class="n">' + esc(c.az) + '</span><span class="p">+</span></div>';
    }).join("");
  }
  adResults.addEventListener("click", function (e) {
    var row = e.target.closest(".ad-res");
    if (!row) return;
    var c = COURSES.find(function (x) { return x.no === Number(row.dataset.no); });
    if (c) adAdd(c);
    adSearchInput.value = ""; adRenderSearch(""); adSearchInput.focus();
  });
  adSearchInput.addEventListener("input", function () { adRenderSearch(adSearchInput.value); });

  function adAdd(c) { if (adSelected.has(c.no)) return; adSelected.set(c.no, { course: c, startDate: "" }); adRenderSelected(); adRenderPoster(); }
  function adRemove(no) { adSelected.delete(no); adRenderSelected(); adRenderPoster(); }
  function adSetFee(mode) {
    adFeeMode = mode;
    adFeeNo.classList.toggle("active", mode === "nofee"); adFeeYes.classList.toggle("active", mode === "fee");
    adRenderSelected(); adRenderPoster();
  }
  adFeeNo.addEventListener("click", function () { adSetFee("nofee"); });
  adFeeYes.addEventListener("click", function () { adSetFee("fee"); });

  function adRenderSelected() {
    adSelCount.textContent = String(adSelected.size);
    adSelList.querySelectorAll(".ad-card").forEach(function (el) { el.remove(); });
    adSelEmpty.style.display = adSelected.size ? "none" : "";
    adSelected.forEach(function (entry) {
      var c = entry.course, price = adPrice(c), end = adEnd(entry.startDate, c);
      var card = document.createElement("div");
      card.className = "ad-card";
      card.innerHTML =
        '<div class="ad-card-head"><div><div class="ad-card-name">' + esc(c.code) + " — " + esc(c.az) + '</div>' +
        '<div class="ad-card-price">' + (price != null ? fmt(price) + " AZN" : "Qiymət yoxdur") + '</div></div>' +
        '<button class="ad-rm" type="button" aria-label="Sil">✕</button></div>' +
        '<div class="ad-dates"><div class="f"><label>Başlama tarixi</label><input type="date" value="' + esc(entry.startDate) + '"></div>' +
        '<div class="arr">→</div><div class="end">' + (end ? fmtDate(end) : "—") + "</div></div>";
      card.querySelector(".ad-rm").addEventListener("click", function () { adRemove(c.no); });
      card.querySelector("input").addEventListener("change", function (e) { entry.startDate = e.target.value; adRenderSelected(); adRenderPoster(); });
      adSelList.appendChild(card);
    });
  }

  function adRenderPoster() {
    var entries = Array.from(adSelected.values());
    if (!entries.length) {
      adTableWrap.innerHTML = '<div class="ad-poster-empty">Kurs seçdikdə cədvəl burada görünəcək.</div>';
      adFit(); return;
    }
    var rows = entries.map(function (en) {
      var c = en.course, end = adEnd(en.startDate, c), p = adPrice(c);
      var date = (en.startDate && end) ? fmtDate(new Date(en.startDate + "T00:00:00")) + "–" + fmtDate(end) : "—";
      return '<tr><td class="c-name">' + esc(c.az) + '</td><td class="c-date">' + date + '</td><td class="c-price">' + (p != null ? fmt(p) + " AZN" : "—") + "</td></tr>";
    }).join("");
    adTableWrap.innerHTML = '<table class="ad-poster-table"><thead><tr><th class="c-name">Kursun adı</th><th class="c-date">Tarix</th><th class="c-price">Qiymət</th></tr></thead><tbody>' + rows + "</tbody></table>";
    adFit();
  }

  var adBusy = false;
  function adOpen() {
    if (adBusy || adLayer.classList.contains("show")) return;
    adBusy = true;
    IstFx.transition(function () {
      adLayer.classList.add("show"); document.body.style.overflow = "hidden";
      $("adPosterLogo").src = window.IST_LOGO || "";
      adRenderSelected(); adRenderPoster();
    }, function () { adBusy = false; });
  }
  function adClose() {
    if (adBusy || !adLayer.classList.contains("show")) return;
    adBusy = true;
    IstFx.transition(function () {
      adLayer.classList.remove("show");
      if (!document.querySelector(".scrim.open, .layer.show")) document.body.style.overflow = "";
    }, function () { adBusy = false; });
  }
  $("openAdBtn").addEventListener("click", adOpen);
  $("adBackBtn").addEventListener("click", adClose);

  adExportBtn.addEventListener("click", function () {
    var original = adExportBtn.innerHTML;
    if (!adSelected.size) {
      adExportBtn.textContent = "⚠ Əvvəlcə kurs seç";
      setTimeout(function () { adExportBtn.innerHTML = original; }, 2000);
      return;
    }
    adExportBtn.disabled = true; adExportBtn.textContent = "⏳ Hazırlanır...";
    var pt = adScale.style.transform, pm = adScale.style.marginBottom;
    adScale.style.transform = ""; adScale.style.marginBottom = "";   /* PNG həmişə tam ölçüdə */
    html2canvas(adPoster, { scale: 3, backgroundColor: "#FFFFFF", useCORS: true, logging: false }).then(function (canvas) {
      adScale.style.transform = pt; adScale.style.marginBottom = pm;
      var a = document.createElement("a"), d = new Date();
      a.download = "IST_Trust_Zone_reklam_" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + ".png";
      a.href = canvas.toDataURL("image/png", 1.0); a.click();
      adExportBtn.disabled = false; adExportBtn.innerHTML = original;
    }).catch(function (err) {
      adScale.style.transform = pt; adScale.style.marginBottom = pm;
      console.error("PNG xətası:", err);
      adExportBtn.disabled = false; adExportBtn.textContent = "Xəta baş verdi";
      setTimeout(function () { adExportBtn.innerHTML = original; }, 2000);
    });
  });

  /* ------------------------------ 6) Mesajlar ------------------------------ */
  var msgLayer = $("msgLayer"), msgFrame = $("msgFrame"), msgBusy = false, msgLoaded = false;
  function loadMessages(withAdmin) {
    var url = new URL("messages/index.html", document.baseURI).href;
    if (!msgLoaded) {
      msgLoaded = true;
      msgFrame.src = url + (withAdmin ? "#admin" : "");
    } else if (withAdmin && msgFrame.contentWindow) {
      msgFrame.contentWindow.postMessage({ ist: "open-admin" }, "*");
    }
  }
  function openMessages(withAdmin) {
    if (msgBusy || msgLayer.classList.contains("show")) return;
    msgBusy = true;
    IstFx.transition(function () {
      loadMessages(withAdmin);
      msgLayer.classList.add("show"); document.body.style.overflow = "hidden";
    }, function () { msgBusy = false; });
  }
  function closeMessages() {
    if (msgBusy || !msgLayer.classList.contains("show")) return;
    msgBusy = true;
    IstFx.transition(function () {
      msgLayer.classList.remove("show");
      if (!document.querySelector(".scrim.open, .layer.show")) document.body.style.overflow = "";
    }, function () { msgBusy = false; });
  }
  $("openMsgBtn").addEventListener("click", function () { openMessages(false); });
  $("openMsgBtn").addEventListener("pointerenter", function () { if (!msgLoaded) loadMessages(false); }, { once: true });
  $("msgBackBtn").addEventListener("click", closeMessages);

  /* ------------------------ 7) İdarəetmə paneli (1006) --------------------- */
  var adminScrim = $("adminScrim"), modesEl = $("modes"), pendingEl = $("pending"), applyBtn = $("adminApply");
  var draftMode = null;

  var ART = {
    normal:
      '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="92" fill="#EEF3F7"/>' +
      '<g stroke="#0B2A4A" stroke-opacity=".08"><path d="M0 23h200M0 46h200M0 69h200M33 0v92M66 0v92M100 0v92M133 0v92M166 0v92"/></g>' +
      '<path d="M0 70c20-8 36 8 56 0s36 8 56 0 36 8 56 0 22 4 32 0v22H0z" fill="#0E7C86" fill-opacity=".18"/>' +
      '<circle cx="100" cy="42" r="16" fill="none" stroke="#FF5C1A" stroke-width="7"/><path d="M100 26v32M84 42h32" stroke="#fff" stroke-width="3" stroke-dasharray="6 20" stroke-dashoffset="3"/></svg>',
    winter:
      '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6eefa"/><stop offset="1" stop-color="#b9cde6"/></linearGradient></defs><rect width="200" height="92" fill="url(#gw)"/>' +
      '<g fill="#fff"><circle cx="24" cy="14" r="2.4"/><circle cx="58" cy="30" r="1.8"/><circle cx="92" cy="12" r="2.8"/><circle cx="130" cy="26" r="2"/><circle cx="168" cy="14" r="2.6"/><circle cx="184" cy="40" r="1.8"/><circle cx="40" cy="48" r="1.6"/><circle cx="112" cy="46" r="1.8"/></g>' +
      '<path d="M0 66c18-10 34-2 52-8s32-10 52-4 36 8 54 0 30-6 42-2v40H0z" fill="#fff"/><path d="M0 76c22-6 40 2 62-2s40-6 60 0 50 4 78-2v20H0z" fill="#dbe7f6"/></svg>',
    snow:
      '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="92" fill="#05070A"/>' +
      '<g fill="#fff"><circle cx="20" cy="16" r="2.6"/><circle cx="46" cy="52" r="1.6" fill-opacity=".7"/><circle cx="72" cy="24" r="2.2"/><circle cx="96" cy="70" r="3"/><circle cx="124" cy="14" r="1.6" fill-opacity=".7"/><circle cx="148" cy="46" r="2.8"/><circle cx="176" cy="22" r="2"/><circle cx="182" cy="68" r="2.4"/><circle cx="14" cy="76" r="1.6" fill-opacity=".6"/><circle cx="116" cy="40" r="1.4" fill-opacity=".6"/><circle cx="34" cy="34" r="3.2"/><circle cx="84" cy="48" r="2.4"/><circle cx="160" cy="62" r="3"/></g></svg>'
  };

  ART.dark = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="92" fill="#0A1422"/><g stroke="#fff" stroke-opacity=".06"><path d="M0 23h200M0 46h200M0 69h200M33 0v92M66 0v92M100 0v92M133 0v92M166 0v92"/></g><rect x="24" y="22" width="92" height="12" rx="6" fill="#1E4E80"/><rect x="24" y="42" width="152" height="9" rx="4.5" fill="#25395A"/><rect x="24" y="58" width="120" height="9" rx="4.5" fill="#25395A"/><circle cx="160" cy="28" r="9" fill="#FF5C1A"/></svg>';
  ART.cyber = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="gc" x1="0" x2="1"><stop offset="0" stop-color="#4152D6"/><stop offset="1" stop-color="#B026FF"/></linearGradient></defs><rect width="200" height="92" fill="#070A18"/><g stroke="#00F0FF" stroke-opacity=".18"><path d="M0 23h200M0 46h200M0 69h200M33 0v92M66 0v92M100 0v92M133 0v92M166 0v92"/></g><circle cx="170" cy="14" r="30" fill="#FF2BD6" fill-opacity=".22"/><rect x="24" y="22" width="92" height="12" rx="6" fill="url(#gc)"/><rect x="24" y="42" width="152" height="9" rx="4.5" fill="none" stroke="#00F0FF"/><rect x="24" y="58" width="120" height="9" rx="4.5" fill="none" stroke="#00F0FF" stroke-opacity=".5"/></svg>';

  ART.micro = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="92" fill="#000"/><g font-family="monospace" font-size="9" fill="#00FF41"><text x="12" y="22">$ ssh root@ist</text><text x="12" y="38" fill-opacity=".7">&gt; access granted</text><text x="12" y="54" fill-opacity=".45">&gt; loading modules...</text></g><rect x="12" y="62" width="7" height="11" fill="#00FF41"/></svg>';
  ART.snow = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="gsd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#98A6A9"/><stop offset="1" stop-color="#D8DEDB"/></linearGradient><radialGradient id="sund"><stop offset="0" stop-color="#F5E2B4" stop-opacity=".9"/><stop offset="1" stop-color="#F5E2B4" stop-opacity="0"/></radialGradient></defs><rect width="200" height="92" fill="url(#gsd)"/><circle cx="151" cy="34" r="32" fill="url(#sund)"/><circle cx="151" cy="34" r="10" fill="#F3DFAE"/><path d="M0 59c23-9 38 2 59-5s39 2 59-3 50 5 82-3v23H0z" fill="#E7EBE7" fill-opacity=".42"/><g fill="#fff"><circle cx="20" cy="20" r="2"/><circle cx="53" cy="43" r="1.7"/><circle cx="91" cy="17" r="2.2"/><circle cx="119" cy="62" r="1.8"/><circle cx="177" cy="57" r="2"/><circle cx="36" cy="73" r="1.5"/></g></svg>';
  ART.dark = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="92" fill="#15181E"/><circle cx="40" cy="10" r="46" fill="#5C78BE" fill-opacity=".14"/><rect x="18" y="20" width="96" height="12" rx="6" fill="#33425C"/><rect x="18" y="40" width="160" height="9" rx="4.5" fill="#2C323D"/><rect x="18" y="56" width="124" height="9" rx="4.5" fill="#2C323D"/><circle cx="162" cy="26" r="8" fill="#E9A06A"/></svg>';
  ART.cyber = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="92" fill="#061525"/><g stroke="#36F0C5" stroke-opacity=".16"><path d="M0 23h200M0 46h200M0 69h200M33 0v92M66 0v92M100 0v92M133 0v92M166 0v92"/></g><circle cx="163" cy="22" r="21" fill="#E9F451" fill-opacity=".14"/><circle cx="163" cy="22" r="7" fill="#E9F451"/><rect x="25" y="23" width="88" height="11" rx="5.5" fill="#36F0C5"/><rect x="25" y="44" width="150" height="8" rx="4" fill="none" stroke="#36F0C5"/><rect x="25" y="60" width="119" height="8" rx="4" fill="none" stroke="#4AB7F0"/><path d="M28 80h29" stroke="#E9F451" stroke-width="3" stroke-linecap="round"/></svg>';
  ART.micro = '<svg class="mode-art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123A5B"/><stop offset="1" stop-color="#081A2A"/></linearGradient></defs><rect width="200" height="92" fill="url(#mbg)"/><circle cx="164" cy="18" r="30" fill="#55B8F2" fill-opacity=".12"/><rect x="18" y="12" width="164" height="68" rx="11" fill="#10263A" stroke="#2A4963"/><rect x="18" y="12" width="164" height="17" rx="11" fill="#173650"/><circle cx="31" cy="20.5" r="3" fill="#58C8D5"/><circle cx="42" cy="20.5" r="3" fill="#55B8F2"/><circle cx="53" cy="20.5" r="3" fill="#91D4FF"/><rect x="31" y="40" width="59" height="7" rx="3.5" fill="#91D4FF"/><rect x="31" y="54" width="129" height="5" rx="2.5" fill="#58C8D5" fill-opacity=".85"/><rect x="31" y="67" width="101" height="5" rx="2.5" fill="#55B8F2" fill-opacity=".82"/></svg>';

  function fmtWhen(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function renderAdmin() {
    var remote = IstTheme.remoteMode, shown = draftMode || remote;
    modesEl.innerHTML = IstTheme.MODES.map(function (m) {
      var info = IstTheme.INFO[m], tag = "";
      if (m === remote) tag = '<span class="tag">Hamıda aktiv</span>';
      else if (m === draftMode) tag = '<span class="tag draft">Önizləmə</span>';
      return '<button type="button" class="mode' + (m === shown ? " sel" : "") + '" role="radio" aria-checked="' + (m === shown) + '" data-mode="' + m + '">' +
        ART[m] + '<span class="mode-txt"><b>' + esc(info.name) + " " + tag + "</b><span>" + esc(info.desc) + "</span></span></button>";
    }).join("");

    var changed = draftMode && draftMode !== remote;
    applyBtn.disabled = !changed;
    pendingEl.hidden = !changed;
    if (changed) {
      pendingEl.innerHTML = "<span>👁</span><span><b>Önizləmə rejimi:</b> “" + esc(IstTheme.INFO[draftMode].name) +
        "” yalnız sizin ekranınızda görünür. Hamıya tətbiq etmək üçün təsdiqləyin.</span>";
    }
    var meta = IstTheme.meta || {};
    $("adminMeta").textContent = meta.updatedAt ? "Son dəyişiklik: " + fmtWhen(meta.updatedAt) + (meta.updatedBy === ISTDB.clientId ? " (siz)" : "") : "";
  }

  function openAdmin() {
    draftMode = null;
    renderAdmin();
    openScrim(adminScrim);
  }
  function closeAdmin() {
    draftMode = null;
    IstTheme.clearPreview();
    closeScrim(adminScrim);
  }
  modesEl.addEventListener("click", function (e) {
    var b = e.target.closest(".mode");
    if (!b) return;
    var m = b.dataset.mode;
    draftMode = m === IstTheme.remoteMode ? null : m;
    IstTheme.preview(draftMode);
    renderAdmin();
  });
  applyBtn.addEventListener("click", function () {
    if (!draftMode) return;
    var m = draftMode;
    applyBtn.disabled = true;
    IstTheme.commit(m).then(function () {
      draftMode = null; IstTheme.clearPreview(); renderAdmin();
      toast("Rejim hamı üçün dəyişdirildi: " + IstTheme.INFO[m].name);
    }).catch(function (err) {
      console.error(err); applyBtn.disabled = false;
      toast("Saxlanmadı: " + (err && err.message ? err.message : "bağlantı xətası"), "error");
    });
  });
  $("adminClose").addEventListener("click", closeAdmin);
  $("adminCancel").addEventListener("click", closeAdmin);
  adminScrim.addEventListener("click", function (e) { if (e.target === adminScrim) closeAdmin(); });
  IstTheme.onChange(function () { if (adminScrim.classList.contains("open")) renderAdmin(); });

  /* ------------------------------- Esc düyməsi ----------------------------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (adminScrim.classList.contains("open")) { closeAdmin(); return; }
    if (nameScrim.classList.contains("open")) { closeScrim(nameScrim); return; }
    if (adLayer.classList.contains("show")) { adSelected.clear(); adRenderSelected(); adRenderPoster(); adClose(); return; }
    if (msgLayer.classList.contains("show")) { closeMessages(); return; }
    if (selected.size) { selected.clear(); refresh(); }
  });

  /* ------------------------------- 8) Başlanğıc ---------------------------- */
  document.querySelectorAll("img[data-logo]").forEach(function (img) { img.src = window.IST_LOGO || "assets/logo.png"; });
  $("statCount").textContent = COURSES.length;
  $("statHours").textContent = COURSES.reduce(function (s, c) { return s + (c.hours || 0); }, 0).toLocaleString("az-AZ");
  renderTable(COURSES); updateSearchMeta(COURSES); renderCalc();
})();
