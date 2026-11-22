/* Defolt mesaj məlumatları: Firebase boşdursa və ya ilk dəfə yazılarkən istifadə olunur */
var DEFAULT_COURSES = [
  {id:1,name:"Əmniyyətli İdarəetmə haqqında Beynəlxalq Məcəllə",abbr:"SP",price:235,total:251,duration:"2 gün"},
  {id:2,name:"Gəminin Mühafizəsi üzrə ümumi hazırlıq və təlimat",abbr:"251SI",price:144,total:160,duration:"1 gün"},
  {id:3,name:"Gəminin Mühafizəsi üzrə müəyyən edilmiş vəzifələrə malik şəxslərin hazırlığı",abbr:"160SH",price:235,total:251,duration:"2 gün"},
  {id:4,name:"Gəmi mühafizəsi üzrə məsul Şəxs",abbr:"251SG",price:235,total:251,duration:"3 gün"},
  {id:5,name:"Bütün dənizçilər üçün təhlükəsizlik üzrə tanışlıq, ilkin hazırlıq və təlimat",abbr:"251SO",dualBranch:true,price:650,total:666,duration:"10 gün"},
  {id:6,name:"Kapitan Körpüsü Resurslarının İdarə Olunması",abbr:"666SW",price:400,total:416,duration:"6 gün"},
  {id:7,name:"Gəminin İdarə Olunması və Manevr Edilməsi",abbr:"416SV",price:350,total:366,duration:"5 gün"},
  {id:8,name:"Radar, ARPA, kapitan körpüsü komandası və axtarış-xilasetmə (idarəetmə səviyyəsi)",abbr:"366SQ",price:611,total:627,duration:"5 gün"},
  {id:9,name:"Radar müşahidəsi və təsviri, ARPA-nın istismarı (operativ səviyyə)",abbr:"627SR",price:900,total:916,duration:"13 gün"},
  {id:10,name:"Elektron Xəritə Displeyinin və İnformasiya Sistemlərinin İstismar Qaydaları (ECDIS)",abbr:"916SZ",price:350,total:366,duration:"5 gün"},
  {id:11,name:"Sərnişinlərin, yükün və gəmi gövdəsinin təhlükəsizliyi üzrə hazırlıq (Ro-Ro)",abbr:"366SF",price:300,total:316,duration:"3 gün"},
  {id:12,name:"Sərnişinlərə bilavasitə xidmət göstərən heyət üzvləri üçün təhlükəsizlik üzrə hazırlıq",abbr:"316SD",price:235,total:251,duration:"1 gün"},
  {id:13,name:"İzdihamın idarə olunması üzrə hazırlıq",abbr:"251SC",price:235,total:251,duration:"2 gün"},
  {id:14,name:"Böhran zamanı idarəetmə və insan davranışı üzrə hazırlıq",abbr:"251SE",price:235,total:251,duration:"2 gün"},
  {id:15,name:"Gəmi qaz analizatorları və onların istismarı",abbr:"251ST",price:235,total:251,duration:"1 gün"},
  {id:16,name:"İnert qaz sistemi",abbr:"251SX",price:235,total:251,duration:"2 gün"},
  {id:17,name:"Gəmidə ilk tibbi yardım",abbr:"251SN",price:300,total:316,duration:"5 gün"},
  {id:18,name:"Gəmidə tibbi nəzarət",abbr:"316SM",price:350,total:366,duration:"6 gün"},
  {id:19,name:"Qlobal Dəniz Fəlakət və Əmniyyətli Rabitə Sisteminin Ümumi Operatoru",abbr:"366DQ",price:1050,total:1066,duration:"14 gün"},
  {id:20,name:"Neft və kimyəvi maddələr daşıyan tankerlərdə yük əməliyyatına dair ilkin hazırlıq və kvalifikasiya",abbr:"1066SA",price:320,total:336,duration:"6 gün"},
  {id:21,name:"Neft tankerlərdə yük əməliyyatına dair geniş proqram üzrə hazırlıq",abbr:"336SB",price:350,total:366,duration:"7 gün"},
  {id:22,name:"Kimyəvi maddələr daşıyan tankerlərdə yük əməliyyatına dair geniş proqram üzrə hazırlıq",abbr:"366AS",price:370,total:386,duration:"8 gün"},
  {id:23,name:"Təhlükəli və zərərli yüklərin daşınması",abbr:"386SK",price:400,total:416,duration:"5 gün"},
  {id:24,name:"Maşın şöbəsinin resurslarının idarə olunması",abbr:"416ER",price:300,total:316,duration:"5 gün"},
  {id:25,name:"Liderlik və birgə iş fəaliyyəti",abbr:"316DL",price:300,total:316,duration:"3 gün"},
  {id:26,name:"Yanğınla mübarizə geniş proqram üzrə",abbr:"316SJ",price:350,total:366,duration:"4 gün"},
  {id:27,name:"Sürətli olmayan xilasedici qayıq, növbətçi qayıq və sallar üzrə mütəxəssis",abbr:"366SL",dualBranch:true,price:300,total:316,duration:"4 gün"},
  {id:28,name:"Sürətli xilasetmə qayıqları üzrə mütəxəssis",abbr:"316SU",price:300,total:316,duration:"3 gün"}
];
var DEFAULT_MIXED = [
  {id:"m1",title:"Sənəd tələbi",content:"Salam, hər vaxtınız xeyir.\n\nZəhmət olmasa, aşağıda qeyd etdiyim sənədləri göndərərsiniz:\n\n* Şəxsiyyət vəsiqəsinin ön və arxa tərəfi\n* Tibbi kitabçanın şəkil olan hissəi və təkrar müayinədən keçmə hissəsi\n* Diplomun şəkli"},
  {id:"m2",title:"6–9 aylıq kurslar haqqında",content:"Salam.\n\n6–9 aylıq kurslar hazırda fəaliyyət göstərmir. Kursların nə vaxt yenidən açılacağı ilə bağlı isə hələlik dəqiq məlumat yoxdur.\n\nBu kurslara yazılmaq üçün Azərbaycan Dövlət Dəniz Akademiyasını (ADDA) və ya Azərbaycan Dövlət Dənizçilik Kollecini (ADK) bitirmək tələb olunur."},
  {id:"m3",title:"Ödəniş xəbərdarlığı",content:"Salam,\nX kurs üzrə ödənişiniz olunmayıb.\nZəhmət olmasa, ödənişi nə vaxt edəcəyiniz barədə məlumat verməyinizi xahiş edirik.\nNəzərinizə çatdırırıq ki, ödəniş edilmədiyi təqdirdə imtahanda iştirakınız mümkün olmayacaq."}
];
