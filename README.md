# IST Trust Zone — qiymət və mesaj sistemi

Real vaxt (Firebase Realtime Database) ilə işləyən statik sayt. Heç bir build lazım deyil.

## Fayllar
- `index.html` – əsas səhifə (kurslar, hesablama, PDF, reklam afişi)
- `messages/` – mesajlar bölməsi (`messages.js`, `defaults.js`, `messages.css`)
- `assets/firebase.js` – Firebase konfiqurasiyası və qoşulma
- `assets/theme.js` – sayt rejimi (Normal / Qış / Qar) və keçid effektləri
- `snow.js` – qar mühərriki
- `database.rules.json` – Firebase qaydaları (Firebase Console → Realtime Database → Rules-a yapışdırın)

## İdarəetmə
- **Əsas səhifə** → axtarışa `1006` yaz → İdarəetmə paneli: rejimi seç, önizləmə et, “Təsdiqlə və hamıya tətbiq et”.
- **Mesajlar** → axtarışa `1006` yaz → kursun adı, qısa söz (kod), ödəniş, mesaj mətni və şablonlar. Yadda saxladıqda hamıda avtomatik yenilənir.

## Məlumat strukturu
`ist/settings/mode` və `ist/messages/{courses,mixed,custom,templates,meta}`.
İlk saxlama zamanı defolt mesajlar bazaya avtomatik yazılır.

## Təhlükəsizlik qeydi
`1006` yalnız interfeysi gizlədir, təhlükəsizlik mexanizmi deyil. Bazaya yazmaq hələlik açıqdır.
Daha sərt qorunma üçün Firebase Authentication (admin hesabı) əlavə edib qaydalarda `auth != null` tələb edin.
