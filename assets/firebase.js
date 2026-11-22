/* =============================================================================
   IST Trust Zone — Firebase (Realtime Database) qoşulması
   Hər iki səhifə (əsas sayt + mesajlar) bu faylı istifadə edir.
   window.ISTDB:
     ok            – Firebase SDK işə düşübsə true
     ref(path)     – Realtime Database istinadı
     onStatus(fn)  – bağlantı vəziyyəti ('online' | 'offline' | 'unavailable')
     status        – cari vəziyyət
     clientId      – bu brauzer sessiyasının unikal id-si (öz dəyişikliyini tanımaq üçün)
     now()         – server vaxtı markeri
   ============================================================================= */
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyCjhP79Vq25uYwMPzBOs-MUv92-MF5D-ms",
    authDomain: "examresult-21cf3.firebaseapp.com",
    databaseURL: "https://examresult-21cf3-default-rtdb.firebaseio.com",
    projectId: "examresult-21cf3",
    storageBucket: "examresult-21cf3.firebasestorage.app",
    messagingSenderId: "889924282994",
    appId: "1:889924282994:web:9d3a305af145228cce70eb"
  };

  var listeners = [];
  var api = {
    ok: false,
    status: "unavailable",
    clientId: "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    db: null,
    ref: function () { return null; },
    now: function () { return Date.now(); },
    onStatus: function (fn) {
      listeners.push(fn);
      try { fn(api.status); } catch (e) {}
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
  };

  function setStatus(s) {
    api.status = s;
    listeners.forEach(function (fn) { try { fn(s); } catch (e) { console.error(e); } });
  }

  try {
    if (!window.firebase || !firebase.initializeApp) throw new Error("Firebase SDK yüklənmədi");
    var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    var db = firebase.database(app);
    api.db = db;
    api.ok = true;
    api.ref = function (path) { return db.ref(path); };
    api.now = function () { return firebase.database.ServerValue.TIMESTAMP; };
    setStatus("offline");
    db.ref(".info/connected").on("value", function (snap) {
      setStatus(snap.val() === true ? "online" : "offline");
    });
  } catch (err) {
    console.warn("[ISTDB] Firebase əlçatan deyil, sayt lokal rejimdə işləyəcək:", err);
    setStatus("unavailable");
  }

  window.ISTDB = api;
})();
