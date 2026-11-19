(() => {
  "use strict";
  const V = window.BEYIN;
  const $ = (id) => document.getElementById(id);
  if (!V || !Array.isArray(V.dugumler) || !V.dugumler.length) {
    $("durum").textContent = V ? "Veride hiç not yok — uret.py'yi notlarının klasörüyle çalıştır." : "Veri yüklenemedi — veri.js bulunamadı ya da bozuk.";
    return;
  }
  // eksik alanlar (eski ya da elle yazılmış veri.js) sayfayı düşürmesin
  V.alanlar = V.alanlar || []; V.kenarlar = V.kenarlar || []; V.gorevler = V.gorevler || []; V.bitenler = V.bitenler || [];
  V.istatistik = V.istatistik || {};

  // ---------- veri ----------
  const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const css = getComputedStyle(document.documentElement);
  const ZEMIN = css.getPropertyValue("--zemin").trim() || "#06090D";
  const YAZI = css.getPropertyValue("--f-govde").trim() || "system-ui, sans-serif";
  // Alanlar veriden gelir: [anahtar, ad, renk?, gezegen?]. Renk/gezegen verilmezse sıraya göre varsayılan paletten alınır
  // (1. alan krem/Satürn, 2. kızıl/Mars, 3. turuncu/Jüpiter, 4. turkuaz/Uranüs, 5. yeşil/Dünya, 6. mavi/Neptün, 7. mor/Plüton, 8. gri/Venüs).
  const AYAR = V.ayar || {};
  const PALET = ["#F6DFA4", "#FF7A98", "#FFB45E", "#52D6C6", "#A6E36A", "#78AEFF", "#BC9BF6", "#A9B4C0"];
  const GEZEGEN_SIRA = ["saturn", "mars", "jupiter", "uranus", "dunya", "neptun", "pluton", "venus"];
  const ALAN = {}, ALAN_GEZEGEN = {}, BILINMEYEN = { ad: "Diğer", renk: "#A9B4C0" };
  // renk veriden gelir: yalnız #RGB / #RRGGBB kabul edilir (style'a ya da HTML'e kaçışsız dize girmesin)
  const renkMi = (r) => typeof r === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(r.trim());
  V.alanlar.forEach(([k, ad, renk, gezegen], i) => {
    const cssRenk = css.getPropertyValue("--a-" + k).trim();
    ALAN[k] = { ad: String(ad == null ? k : ad), renk: renkMi(renk) ? renk.trim() : renkMi(cssRenk) ? cssRenk : PALET[i % PALET.length] };
    ALAN_GEZEGEN[k] = GEZEGEN_SIRA.includes(gezegen) ? gezegen : GEZEGEN_SIRA[i % GEZEGEN_SIRA.length];
  });
  const alanOf = (k) => ALAN[k] || BILINMEYEN;
  const hex = (h) => {
    let x = String(h).replace("#", "");
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    const n = parseInt(x, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const nokta = (renk, sinif) => { const i = document.createElement("i"); if (sinif) i.className = sinif; i.style.background = renk; return i; };
  const gunSayisi = (iso) => Math.round((Date.parse(iso + "T00:00:00") - Date.parse(V.istatistik.baslangic + "T00:00:00")) / 864e5);
  const kisaTarih = (iso) => { const [y, a, g] = iso.slice(0, 10).split("-").map(Number); return g + " " + AYLAR[a - 1]; };
  const KATMAN_AD = { cekirdek: "çekirdek · her oturum yüklenir", canli: "konu sayfası · aranır", arsiv: "arşiv · uzun süreli bellek",
    noron: "nöron · mesajdaki sözle kendiliğinden gelir" };
  Object.assign(KATMAN_AD, V.katmanAd || {});
  const NT_AD = { kural: "kural", ders: "ders (tuzak)", olgu: "olgu" };
  const NORONLU = V.dugumler.some((d) => d.katman === "noron");   // Beyin v4 kasası mı, düz not klasörü mü
  // Beyin v4 (11 Kas): nöron = kural/ders/olgu kartı; rengi kaynak sayfasının alanından, sert kural (⛔) kırmızıya, olgu soluk
  const karis3 = (a, b, t) => a.map((v, k) => Math.round(v * (1 - t) + b[k] * t));
  const noronRgb = (d, r) => d.sert ? karis3(r, [255, 86, 74], .62) : d.nt === "olgu" ? karis3(r, [200, 210, 220], .45) : d.nt === "ders" ? karis3(r, [255, 255, 255], .18) : r;

  const D = V.dugumler.map((d, i) => ({
    ...d, i, bolumler: d.bolumler || [], metin: d.metin || "", karakter: d.karakter || 0, ad: d.ad || d.id, baslik: d.baslik || d.ad || d.id, rgb: d.katman === "noron" ? noronRgb(d, hex(alanOf(d.alan).renk)) : hex(alanOf(d.alan).renk), komsu: [],
    yaricap: d.katman === "noron" ? 2.4 + Math.sqrt(d.karakter) / 34 :
      (d.katman === "cekirdek" ? 15 : d.katman === "arsiv" ? 6 : 8) + Math.sqrt(d.karakter) / (d.katman === "arsiv" ? 16 : 11),
    gun: gunSayisi(d.dogum), taze: (Date.parse(V.istatistik.bugun) - Date.parse(d.guncelleme)) / 864e5 <= 1,
    px: 0, py: 0, pz: 0, ps: 1, gor: 1, atesle: 0, dalga: 0,
  }));
  const ID = Object.fromEntries(D.map((d) => [d.id, d]));
  const K = V.kenarlar.map(([a, b, n]) => ({ a: ID[a], b: ID[b], n })).filter((k) => k.a && k.b);
  for (const k of K) { k.a.komsu.push(k.b); k.b.komsu.push(k.a); }
  const SON_GUN = Math.max(0, gunSayisi(V.istatistik.bugun));

  // ---------- künye ----------
  const ist = V.istatistik;
  const binlik = (n) => n.toLocaleString("tr-TR");
  function durumYaz() {
    const dk = Math.max(0, Math.round((Date.now() - Date.parse(ist.son_degisim.replace(" ", "T"))) / 6e4));
    const once = !isFinite(dk) ? "" : dk < 60 ? dk + " dk önce" : dk < 1440 ? Math.round(dk / 60) + " sa önce"
      : dk < 7 * 1440 ? Math.round(dk / 1440) + " gün önce" : kisaTarih(ist.son_degisim) + " " + ist.son_degisim.slice(0, 4) + "'te";
    const n = document.createElement("span"); n.className = "nabiz";
    $("durum").replaceChildren(n, document.createTextNode(once ? once + " güncellendi" : "hafıza"));
  }
  durumYaz(); setInterval(durumYaz, 60000);
  const NORAL_ALTYAZI = ist.noron + " nöron · " + (ist.sayfa ? ist.sayfa + " sayfa · " : "") + ist.sinaps + " sinaps · " +
    binlik(Math.round(ist.karakter / 1000)) + " bin karakter · " + (ist.oturum ? ist.oturum + " oturum · " : "") + ist.gun + " gün";
  $("altyazi").textContent = NORAL_ALTYAZI;
  document.documentElement.lang = "tr";   // büyük harfe çevrilen yazılarda i → İ (SİNAPS, AÇIK İŞLER)
  const acik = V.gorevler.filter((g) => g.durum !== "askida").length;
  $("isSay").textContent = acik;

  // ---------- lejant ----------
  let vurguAlan = null;
  for (const [k, a] of Object.entries(ALAN)) {
    if (!D.some((d) => d.alan === k)) continue;
    const b = document.createElement("button");
    b.setAttribute("aria-pressed", "false");
    b.append(nokta(a.renk), document.createTextNode(a.ad));   // alan adı veriden gelir: HTML olarak değil, düz yazı olarak
    b.addEventListener("click", () => {
      vurguAlan = vurguAlan === k ? null : k;
      for (const x of $("lejant").children) x.setAttribute("aria-pressed", "false");
      if (vurguAlan) b.setAttribute("aria-pressed", "true");
    });
    $("lejant").appendChild(b);
  }

  // ---------- tuval ----------
  const tv = $("tuval"), cx = tv.getContext("2d");
  let W = 0, H = 0, DPR = 1, DPR_TAVAN = 3;
  const azHareket = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function boyutla() {
    // ekranın tam piksel yoğunluğu (iPhone 3x); telefon yavaşlarsa kare döngüsü tavanı 2'ye indirir
    DPR = Math.min(DPR_TAVAN, window.devicePixelRatio || 1);
    W = tv.clientWidth; H = tv.clientHeight;
    tv.width = Math.round(W * DPR); tv.height = Math.round(H * DPR);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener("resize", boyutla); boyutla();
  const sifirla = () => cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const birim = (x, y, s) => cx.setTransform(DPR * s, 0, 0, DPR * s, DPR * x, DPR * y);   // birim uzay → ekran
  const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";

  // tohumlu rastgele (nöron başına hep aynı biçim)
  function rastgele(tohum) { let s = 0; for (const ch of tohum) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // her nöron için bir kez, birim uzayda: GÖLGELİ KÜRE + ışıma gradyanları.
  // Dendrit/uzantı yok (çizgi dallar
  // şimşek, dolgu uzantılar sivri yıldız gibi durdu): ışığı sol üstten alan, kenarı koyulaşan küre + ince kenar ışığı.
  // Derinlik: uzak küre küçük ve soluk, yakın olan önünde (normal karışım). Her karede vektör çizilir, her ölçekte keskin.
  for (const d of D) {
    const acik = d.rgb.map((v) => Math.round(v + (255 - v) * .62)), koyu = d.rgb.map((v) => Math.round(v * .4));
    const kure = cx.createRadialGradient(-.36, -.4, .05, 0, 0, 1);
    kure.addColorStop(0, rgba(acik, 1)); kure.addColorStop(.42, rgba(d.rgb, 1));
    kure.addColorStop(.9, rgba(koyu, 1)); kure.addColorStop(1, rgba(koyu, .95));
    const hale = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
    hale.addColorStop(0, rgba(d.rgb, .34)); hale.addColorStop(.42, rgba(d.rgb, .09)); hale.addColorStop(1, rgba(d.rgb, 0));
    d.kure = kure; d.hale = hale; d.halka = rgba(d.rgb, 1); d.kenar = rgba(acik, .4);
  }

  // ---------- görünüm ----------
  let yaw = 0.6, pitch = -0.22, yakin = 1, hedef = null, sonDokunus = 0, secili = null, zamanGun = SON_GUN, oynuyor = false;
  const darbeler = [];
  // iki görünüm (30 Eki): nöral ağ ve yörünge (güneş sistemi); her biri kendi kamerasını saklar
  let gorunum = "noral";
  const KAMERA = { noral: { yaw: .6, pitch: -.22, yakin: 1 }, yorunge: { yaw: .35, pitch: -1.05, yakin: 1 } };
  const kamera = { noral: { ...KAMERA.noral }, yorunge: { ...KAMERA.yorunge } };
  const yakinTavan = () => (gorunum === "yorunge" ? 7 : 3.2);
  const egimSinir = () => (gorunum === "yorunge" ? [-1.5, .5] : [-1.25, 1.25]);
  function izdus() {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const olcek = Math.min(W, H * (W > H ? 0.95 : 0.62)) * 0.27 * yakin, ox = W / 2, oy = H * 0.48;   // yatay ekranda yükseklik daha cömert
    for (const d of D) {
      const [x, y, z] = d.konum;
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const p = 3.2 / (3.2 + z2);
      d.sx = ox + x1 * olcek * p; d.sy = oy - y2 * olcek * p; d.sz = z2; d.ps = p;
    }
  }
  function gorunur(d) { return (gorunum === "yorunge" ? d.yGun : d.gun) <= zamanGun; }

  function ciz(t, dt) {
    sifirla();
    // zemin ve kenar karartması sayfanın sabit arka planında (CSS); tuval saydam — her karede tam ekran boyama yok
    cx.globalCompositeOperation = "source-over";
    cx.clearRect(0, 0, W, H);
    cx.globalCompositeOperation = "lighter";
    cx.lineCap = "round";
    const odak = secili ? new Set([secili, ...secili.komsu]) : null;
    // sinapslar
    // (Beyin v4: yüzlerce sinaps) aynı renk + saydamlıktaki çizgiler tek yolda toplanır — her çizgiye ayrı stroke
    // yazılım çizimde kare hızını yarıya indiriyordu; saydamlık 0,01 adımına yuvarlanır (göz farkı görmez)
    const kova = new Map();
    for (const k of K) {
      if (!gorunur(k.a) || !gorunur(k.b)) continue;
      let alfa = 0.05 + 0.05 * Math.min(3, k.n);
      const derin = Math.max(.25, 1 - ((k.a.sz + k.b.sz) / 2 + 1.6) / 3.6);
      alfa *= derin;
      if (k.a.katman === "noron" || k.b.katman === "noron") alfa *= .7;
      const kalin = odak && (k.a === secili || k.b === secili);
      if (odak) alfa = odak.has(k.a) && odak.has(k.b) && kalin ? .55 : alfa * .25;
      if (vurguAlan) alfa = k.a.alan === vurguAlan || k.b.alan === vurguAlan ? alfa * 1.8 : alfa * .25;
      const r = k.a.katman === "noron" && k.b.katman !== "noron" ? k.b.rgb : k.a.rgb;
      const anah = r[0] + "," + r[1] + "," + r[2] + "," + (Math.round(alfa * 100) / 100) + (kalin ? "|k" : "");
      let y = kova.get(anah); if (!y) kova.set(anah, (y = []));
      y.push(k.a.sx, k.a.sy, k.b.sx, k.b.sy);
    }
    for (const [anah, y] of kova) {
      const [renk, kalin] = anah.split("|");
      cx.strokeStyle = "rgba(" + renk + ")"; cx.lineWidth = kalin ? 1.2 : .55;
      cx.beginPath();
      for (let i = 0; i < y.length; i += 4) { cx.moveTo(y[i], y[i + 1]); cx.lineTo(y[i + 2], y[i + 3]); }
      cx.stroke();
    }
    // sinyal akışı: sinaps boyunca yavaş süzülen, kuyruğu sönen yumuşak ışık izi (kıvılcım/patlama yok)
    for (let i = darbeler.length - 1; i >= 0; i--) {
      const p = darbeler[i];
      p.t += dt / p.sure;
      if (p.t >= 1) {
        darbeler.splice(i, 1);
        const varis = p.ters ? p.k.a : p.k.b;
        varis.atesle = Math.max(varis.atesle, .3);
        if (Math.random() < .15 && darbeler.length < 12) darbeBaslat(varis);
        continue;
      }
      if (!gorunur(p.k.a) || !gorunur(p.k.b)) { darbeler.splice(i, 1); continue; }
      const e = p.t < .5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;   // yavaş başla, yavaş bitir
      const a = p.k.a, b = p.k.b, L = Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1;
      const u = p.ters ? 1 - e : e, kuyruk = Math.max(10, Math.min(46, L * .2)) / L;
      const u2 = p.ters ? Math.min(1, u + kuyruk) : Math.max(0, u - kuyruk);
      const hx = a.sx + (b.sx - a.sx) * u, hy = a.sy + (b.sy - a.sy) * u, tx = a.sx + (b.sx - a.sx) * u2, ty = a.sy + (b.sy - a.sy) * u2;
      const renk = p.ters ? b.rgb : a.rgb, g = cx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, rgba(renk, 0)); g.addColorStop(1, rgba(renk, .85));
      cx.globalAlpha = Math.sin(Math.PI * p.t) * .75;
      cx.strokeStyle = g; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(hx, hy); cx.stroke();
    }
    cx.globalAlpha = 1;
    // nöronlar (arkadan öne)
    const sira = D.filter(gorunur).sort((a, b) => b.sz - a.sz);
    for (const d of sira) {
      let alfa = Math.max(.18, Math.min(1, 1.15 - (d.sz + 1.6) / 3.8)) * (d.katman === "arsiv" ? .62 : d.katman === "noron" ? .9 : 1);
      if (odak && !odak.has(d)) alfa *= .3;
      if (vurguAlan && d.alan !== vurguAlan) alfa *= .25;
      const dogal = zamanGun < SON_GUN && SON_GUN - 0 > 0 ? Math.min(1, (zamanGun - d.gun + 1) / 2.5) : 1;
      const nefes = d.taze && !azHareket ? 1 + .09 * Math.sin(t / 380 + d.i) : 1;
      const ates = 1 + d.atesle * .2;
      // küre yarıçapı (px): bilgi miktarıyla büyür, derinlikle küçülür; 3,2–19 px arası
      // arşiv (uzun süreli bellek) dış halkada daha küçük kalır: metni büyük ama ilgi odağı canlı sayfalar
      const arsiv = d.katman === "arsiv", nor = d.katman === "noron";
      const ro = Math.max(nor ? 1.6 : 3.2, Math.min(arsiv ? 13 : nor ? 7 : 19, d.yaricap * d.ps * yakin * (arsiv ? .4 : .55))) * nefes * ates * (d === secili ? 1.2 : 1), a = alfa * dogal;
      d.ro = ro;
      // ışıma: kürenin çevresinde yumuşak, düşük (kümede sis yapmaz); ateşlenince parlar.
      // Küçük nöronda ışıma yalnız ateşlenince/seçilince (180 ek gradyan dolgusu kare hızını düşürüyordu)
      if (!nor || d.atesle > .05 || d === secili || ro > 4.5) {
        birim(d.sx, d.sy, ro * 2.6);
        cx.globalCompositeOperation = "lighter";
        cx.globalAlpha = a * (.55 + d.atesle * .45) * (nor ? .7 : 1);
        cx.fillStyle = d.hale; cx.fillRect(-1, -1, 2, 2);
      }
      // küre: ışık sol üstten, kenar koyulaşır; yakın olan uzaktakinin önünde (normal karışım)
      birim(d.sx, d.sy, ro);
      cx.globalCompositeOperation = "source-over";
      cx.globalAlpha = a * (d.katman === "arsiv" ? .78 : 1);
      cx.fillStyle = d.kure; cx.beginPath(); cx.arc(0, 0, 1, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = d.kenar; cx.lineWidth = .9 / ro; cx.stroke();
      // dalga halkası: yalnız dokunulan nöronda ve doğrudan komşularında
      if (d.dalga > .04) {
        cx.globalAlpha = a * d.dalga * .7;
        cx.strokeStyle = d.halka; cx.lineWidth = 1.2 / ro;
        cx.beginPath(); cx.arc(0, 0, 1.3 + (1 - d.dalga) * 2.2, 0, Math.PI * 2); cx.stroke();
        d.dalga *= .955;
      }
      sifirla();
      d.atesle *= .94;
    }
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = "source-over";
    // etiketler — öncelik sırasıyla; üst üste binen etiket çizilmez (seçili her zaman çizilir)
    cx.textAlign = "center"; cx.textBaseline = "top";
    const turda = turGovde(), bas = secili || turda, aday = [];   // turda yalnız gezilen nöronun adı
    if (turda) aday.push(turda);
    else {
      if (secili) aday.push(secili, ...[...secili.komsu].sort((a, b) => b.derece - a.derece));
      aday.push(...D.filter((d) => d.katman === "cekirdek"));
      if (!odak && yakin > 1.35) aday.push(...[...sira].reverse().filter((d) => d.katman !== "arsiv" && d.katman !== "noron" && d.ps > .95));
      if (!odak && yakin > 2.6) aday.push(...[...sira].reverse().filter((d) => d.katman === "noron" && d.ps > 1.05));
    }
    const kutular = [], cizildi = new Set();
    for (const d of aday) {
      if (cizildi.has(d) || !gorunur(d)) continue;
      const fs = d === bas ? 14 : 11.5;
      cx.font = (d === bas ? "600 " : "500 ") + fs + "px " + YAZI;
      const gen = cx.measureText(d.ad).width, y = d.sy + (d.ro || 8) + 5;
      const kutu = [d.sx - gen / 2 - 3, y - 2, d.sx + gen / 2 + 3, y + fs + 2];
      if (d !== bas && kutular.some((k) => kutu[0] < k[2] && kutu[2] > k[0] && kutu[1] < k[3] && kutu[3] > k[1])) continue;
      kutular.push(kutu); cizildi.add(d);
      cx.lineWidth = 4; cx.strokeStyle = "rgba(6,9,13,.85)"; cx.strokeText(d.ad, d.sx, y);
      cx.fillStyle = d === bas ? "#FFFFFF" : "rgba(228,233,238,.86)"; cx.fillText(d.ad, d.sx, y);
    }
  }

  function darbeBaslat(kaynak) {
    if (azHareket) return;
    const adaylar = K.filter((k) => (k.a === kaynak || k.b === kaynak) && gorunur(k.a) && gorunur(k.b));
    if (!adaylar.length) return;
    const k = adaylar[Math.floor(Math.random() * adaylar.length)];
    darbeler.push({ k, t: 0, ters: k.b === kaynak, sure: 1700 + Math.random() * 1300 });
  }
  function rastgeleDarbe() {
    const g = D.filter(gorunur);
    if (!g.length) return;
    const taze = g.filter((d) => d.taze);
    const kaynak = taze.length && Math.random() < .45 ? taze[Math.floor(Math.random() * taze.length)] : g[Math.floor(Math.random() * g.length)];
    darbeBaslat(kaynak);
  }
  function atesle(d, halkali = true) {
    // halka yalnız dokunulan nöronda ve doğrudan komşularında; ikinci adım ve açılış dalgası halkasız (görüntü sakin kalsın)
    d.atesle = 1;
    if (halkali) d.dalga = 1;
    let dalga = [d], gorulen = new Set([d]);
    for (let adim = 1; adim <= 2; adim++) {
      const sonraki = [];
      for (const x of dalga) for (const y of x.komsu) if (!gorulen.has(y)) { gorulen.add(y); sonraki.push(y); }
      sonraki.forEach((y) => setTimeout(() => {
        y.atesle = Math.max(y.atesle, 1 - adim * .3);
        if (halkali && adim === 1) y.dalga = Math.max(y.dalga, .6);
      }, adim * 260));
      dalga = sonraki;
    }
    for (let i = 0; i < Math.min(8, d.komsu.length); i++) setTimeout(() => darbeBaslat(d), i * 110);
  }

  // ---------- yörünge görünümü (30 Eki) ----------
  // Hafıza bir güneş sistemi: çekirdek = merkezde yıldızlar (ayar.gunes ya da en büyük çekirdek sayfa güneş, ötekiler eş yıldız),
  // canlı sayfa = gezegen (boy = bilgi, renk = alan), alan = yörünge (alanlar sırasıyla içten dışa),
  // sayfanın "-gecmis" arşivi = ayı, öteki arşiv kayıtları = kuyruklu yıldız, açık iş = yapay uydu.
  // Bağlantı = gezegenler arası rota (yalnız seçilince), ışık akışı = rotada süzülen uzay aracı. Işık güneşten gelir
  // (evreler gerçek), hız Kepler'e uyar (T ∝ r^1.5). Nöral görünümün ilkeleri aynı: tane/resim yok, her karede vektör,
  // ışıma küçük; güneşte ışın, yıldızlarda sivri parıltı yok.
  const TAM = Math.PI * 2;
  const Y = { R0: .62, ADIM: .19, GUN_SN: 9, KAM: 5.5 };   // iç yörünge, yörünge aralığı, 1 gün = 9 sn, kamera uzaklığı
  const VERI_YAZI = css.getPropertyValue("--f-veri").trim() || "monospace";
  const yildizlar = D.filter((d) => d.katman === "cekirdek");
  const gunes = ID[AYAR.gunes] || [...yildizlar].sort((a, b) => b.karakter - a.karakter)[0] || null;
  for (const d of D) {
    const es = d.katman === "arsiv" && d.id.endsWith("-gecmis") ? ID[d.id.slice(0, -7)] : null;
    d.tur = d.katman === "noron" ? "noron" : d.katman === "cekirdek" ? "yildiz" : d.katman !== "arsiv" ? "gezegen" : es && es.katman !== "arsiv" ? "ay" : "kuyruklu";
    d.ebeveyn = d.tur === "ay" ? es : d.tur === "noron" ? (ID[d.kaynak] && ID[d.kaynak].katman !== "noron" ? ID[d.kaynak] : null) : null;
    // dünya biriminde yarıçap: boy = bilgi (karekökle; en büyük gezegen en küçüğün ~2 katı)
    const k = Math.sqrt(d.karakter);
    d.yR = d === gunes ? .12 : d.tur === "yildiz" ? .056 + k / 6000 : d.tur === "gezegen" ? .034 + k / 2100 : d.tur === "ay" ? .016 + k / 8000 : d.tur === "noron" ? .0045 + k / 40000 : .018 + k / 13000;
    // yıldızlar 21 Ağu'dan beri var (çekirdeğin doğum tarihi sayfa metnindeki en eski tarihten hesaplanıyor, geç kalıyor)
    d.wx = d.wy = d.wz = 0; d.yGun = d.tur === "yildiz" ? 0 : d.gun; d.lfi = 0; d.ls = 0; d.lz = 0;
  }
  // yörüngeler: alan başına bir halka, index sırasıyla içten dışa; gezegenler halkaya yayılır
  const alanSira = (a) => { const i = V.alanlar.findIndex(([k]) => k === a); return i < 0 ? 99 : i; };
  const yorungeler = [...new Set(D.filter((d) => d.tur === "gezegen").map((d) => d.alan))].sort((a, b) => alanSira(a) - alanSira(b)).map((alan, i) => {
    const g = rastgele("yorunge:" + alan), r = Y.R0 + i * Y.ADIM;
    const o = { alan, r, egim: (g() - .5) * .12, dugum: g() * TAM, donem: 10 * Math.pow(r / Y.R0, 1.5), rgb: hex(alanOf(alan).renk) };
    o.gezegenler = D.filter((d) => d.tur === "gezegen" && d.alan === alan).sort((a, b) => a.dogum.localeCompare(b.dogum) || a.id.localeCompare(b.id));
    const faz = g() * TAM, n = o.gezegenler.length;
    o.gezegenler.forEach((d, j) => { d.yo = { yorunge: o, aci: faz + (j + (g() - .5) * .5) * TAM / n }; });
    return o;
  });
  // eş yıldızlar güneşin, aylar gezegeninin, uydular sayfasının çevresinde döner (gerçek zamanla, saniye)
  const esler = yildizlar.filter((d) => d !== gunes).sort((a, b) => b.karakter - a.karakter);
  esler.forEach((d, i) => { const g = rastgele("es:" + d.id); d.yo = { a: .23 + i * .13, egim: (g() - .5) * .35, dugum: g() * TAM, faz: g() * TAM, sn: 48 + i * 34 }; });
  const aylar = D.filter((d) => d.tur === "ay");
  for (const d of aylar) {
    const e = d.ebeveyn, k = (e.ayNo = (e.ayNo || 0) + 1) - 1, g = rastgele("ay:" + d.id);
    d.yo = { a: e.yR * 1.9 + .032 + k * .03, egim: (g() - .5) * 1.1, dugum: g() * TAM, faz: g() * TAM, sn: 15 + k * 7 + g() * 4 };
    e.yGun = Math.min(e.yGun, d.gun);   // ayı gezegeninden önce doğduysa gezegen ayıyla birlikte belirir
  }
  // nöron kuşağı (Beyin v4, 11 Kas): her nöron kaynak sayfasının (gezegenin) çevresinde ince bir asteroit kuşağında döner;
  // kaynağı gezegen değilse güneşin çevresinde. Kuşak düzlemi gezegen başına bir kez seçilir, nöronlar ona hafifçe saçılır.
  const kusak = D.filter((d) => d.tur === "noron");
  const kusakSay = {}, kusakNo = {};
  for (const d of kusak) { d.ebeveyn = d.ebeveyn || gunes; if (d.ebeveyn) kusakSay[d.ebeveyn.id] = (kusakSay[d.ebeveyn.id] || 0) + 1; }
  for (const d of kusak) {
    const e = d.ebeveyn;
    if (!e) { d.yo = { a: 0, egim: 0, dugum: 0, faz: 0, sn: 1 }; continue; }
    const n = kusakSay[e.id], j = (kusakNo[e.id] = (kusakNo[e.id] || 0) + 1) - 1, g = rastgele("kusak:" + d.id);
    if (!e.kusak) { const ge = rastgele("kusakDuz:" + e.id); e.kusak = { egim: (ge() - .5) * .6, dugum: ge() * TAM }; }
    d.yo = { a: e.yR * 1.6 + .02 + (j % 3) * .007 + g() * .005, egim: e.kusak.egim + (g() - .5) * .1, dugum: e.kusak.dugum,
      faz: j / n * TAM + g() * .25, sn: 28 + g() * 12 };
    d.yGun = Math.max(d.yGun, e.yGun);   // nöron kaynağından önce görünmez
  }
  // kuyruklu yıldızlar: basık yörünge, güneşe yaklaşınca hızlanır (Kepler denklemi); en taze kayıt en içte
  const kuyrukluar = D.filter((d) => d.tur === "kuyruklu").sort((a, b) => b.guncelleme.localeCompare(a.guncelleme) || a.id.localeCompare(b.id));
  kuyrukluar.forEach((d, i) => {
    const g = rastgele("kuyruklu:" + d.id), q = .36 + i * .16, Q = 1.62 + i * .3, a = (q + Q) / 2;
    d.yo = { a, e: (Q - q) / (Q + q), egim: .22 + g() * .3, dugum: g() * TAM, w: g() * TAM, faz: g(), donem: 10 * Math.pow(a / Y.R0, 1.5) };
  });
  // yapay uydular: askıda olmayan her açık iş, sayfasının çevresinde; öncelikli altın, 21 günü geçen kırmızı nabız
  const uydular = [];
  for (const x of V.gorevler) {
    const e = ID[x.sayfa];
    if (!e || x.durum === "askida") continue;
    const k = (e.uyduNo = (e.uyduNo || 0) + 1) - 1, g = rastgele("uydu:" + x.no), eski = x.yas > 21;
    uydular.push({ uydu: true, x, e, eski, a: e.yR * 1.45 + .012 + k * .013, egim: (g() - .5) * 2.4, dugum: g() * TAM, faz: g() * TAM,
      sn: 7 + k * 2.5 + g() * 2, panel: g() * Math.PI, renk: eski ? [255, 112, 92] : x.oncelik ? [241, 200, 120] : [214, 226, 238],
      wx: 0, wy: 0, wz: 0, sx: 0, sy: 0, sz: 0, ps: 1, ekranda: false });
  }
  const YORUNGE_ALTYAZI = [[yildizlar.length, "yıldız"], [yorungeler.reduce((s, o) => s + o.gezegenler.length, 0), "gezegen"], [aylar.length, "ay"],
    [kuyrukluar.length, "kuyruklu yıldız"], [uydular.length, "uydu (açık iş)"], [kusak.length, "nöron (kuşak)"]].filter(([n]) => n).map(([n, s]) => n + " " + s).join(" · ") + " · boy = bilgi";
  const turAd = (d) => d.tur === "noron" ? "nöron · " + (NT_AD[d.nt] || d.nt) + (d.sert ? " · sert kural" : "") + (d.gecersiz ? " · yerine geçildi" : "") + " · kuşakta"
    : d.tur === "yildiz" ? (d === gunes ? "güneş · çekirdek" : "eş yıldız · çekirdek")
    : d.tur === "gezegen" ? "gezegen · " + d.doku.ad + " esintili" : d.tur === "ay" ? "ay · " + d.doku.ad + " esintili · geçmiş" : "kuyruklu yıldız · kayıt (arşiv)";

  // ---------- gerçek gezegen dokuları (30 Eki, 2. tur) ----------
  // Her alan bir gerçek gezegen ailesi (ALAN_GEZEGEN: veriden ya da sıradan; varsayılan palet lejant rengine en yakın gezegeni
  // seçer: krem Satürn, kızıl Mars, turuncu Jüpiter, turkuaz Uranüs, yeşil Dünya, mavi Neptün, mor Plüton). Aylar ebeveyn
  // gezegenin gerçek aylarından (büyük geçmiş en ünlü ayı alır); bir yıldızın geçmişi yıldızın en yakın gezegeni Merkür. Doku resim değil: enlem kuşakları
  // kameranın eğimine göre elips yaylarıyla, kıta / leke / krater enlem-boylam çokgeniyle her karede vektör çizilir. Gezegen
  // kendi ekseninde döner; aylar ebeveynine hep aynı yüzü gösterir (kütleçekim kilidi). Renk lejantla bağı kopmasın diye
  // alan rengine biraz karışır. Enlem/boylam derece; leke: [enlem, boylam, enlem yarıçapı, boylam yarıçapı].
  const AFRIKA = [[35, -6], [37, 10], [32, 32], [22, 37], [12, 44], [2, 42], [-10, 40], [-25, 35], [-34, 20], [-29, 16], [-17, 12], [-5, 9], [4, 8], [5, -5], [5, -14], [15, -17], [28, -12]];
  const AVRUPA = [[36, -9], [43, -9], [48, -4], [54, 8], [58, 6], [62, 5], [70, 22], [70, 40], [60, 50], [47, 48], [42, 42], [41, 29], [38, 24], [40, 18], [44, 12], [38, 15], [37, 5]];
  const ASYA = [[42, 42], [47, 48], [60, 50], [70, 40], [73, 70], [77, 105], [72, 140], [66, 180], [60, 165], [52, 157], [43, 140], [35, 128], [30, 122], [22, 114],
    [10, 108], [1, 104], [8, 98], [16, 94], [22, 88], [8, 77], [20, 72], [25, 62], [25, 57], [30, 48], [37, 36]];
  const K_AMERIKA = [[70, -165], [71, -125], [69, -90], [62, -75], [58, -62], [50, -56], [45, -63], [41, -70], [35, -76], [30, -81], [25, -80], [29, -90], [20, -97],
    [16, -88], [9, -79], [15, -92], [20, -105], [30, -114], [38, -123], [48, -125], [58, -137], [60, -150]];
  const G_AMERIKA = [[12, -72], [10, -62], [5, -52], [-5, -35], [-13, -38], [-23, -42], [-34, -53], [-40, -62], [-52, -68], [-54, -72], [-45, -75], [-30, -71], [-18, -70], [-5, -81], [2, -79], [8, -77]];
  // kutup buzulu: kutbu saran düzensiz çokgen (tam elips yukarıdan bakınca parlak kabarcık gibi duruyordu; gezegenle döner)
  const buzul = (enlemler) => enlemler.map((la, i) => [la, i * 360 / enlemler.length]);
  const DOKU = {
    saturn: { ad: "Satürn", ort: "#D8C08E", donus: 26, eksen: 27,   // gerçek eksen eğikliği: halkalar yörüngede dolandıkça açılıp kapanır
      bant: [[-90, "#B49A68"], [-62, "#D3BA88"], [-42, "#C9AC78"], [-26, "#E0C896"], [-11, "#EEDCB2"], [11, "#D9BF8B"], [25, "#E7D1A2"], [42, "#CDB17E"], [63, "#B99F6E"]],
      ozellik: [{ n: [[77, 0], [77, 60], [77, 120], [77, 180], [77, 240], [77, 300]], renk: "#8E8C74", alfa: .8, duz: true, min: 3.5 },   // kuzey kutup altıgeni
        { kuzey: 85, renk: "#77704F", alfa: .85, min: 5 }],
      halka: [[1.24, 1.38, "rgba(176,160,132,.22)"], [1.38, 1.53, "rgba(190,175,146,.34)"],                                      // C halkası
        [1.53, 1.66, "rgba(226,210,174,.70)"], [1.66, 1.82, "rgba(238,224,190,.88)"], [1.82, 1.95, "rgba(228,212,176,.78)"],   // B halkası
        [2.03, 2.19, "rgba(212,196,160,.66)"], [2.21, 2.27, "rgba(206,190,154,.56)"]] },                                       // Cassini boşluğu, A halkası, Encke boşluğu
    mars: { ad: "Mars", ort: "#BE5733", donus: 60, atmos: "rgba(255,175,140,.35)",
      bant: [[-90, "#BF5632"]],
      ozellik: [{ n: [[20, 58], [24, 70], [12, 79], [-4, 75], [-2, 66], [9, 61]], renk: "#7A3320", alfa: .72, min: 3 },   // Syrtis Major
        { n: [[56, -42], [53, -14], [41, -10], [35, -24], [43, -40]], renk: "#7E3622", alfa: .62, min: 3 },                // Acidalia
        { n: [[-14, -62], [-11, -18], [-24, 2], [-33, -24], [-27, -56]], renk: "#7A3421", alfa: .62, min: 3 },             // Erythraeum
        { n: [[50, 98], [47, 132], [34, 129], [32, 104]], renk: "#843A25", alfa: .4, min: 4 },                           // Utopia
        { leke: [-42, 68, 9, 15], renk: "#E3A57E", alfa: .55, min: 4 },                                                   // Hellas
        { cizgi: [[-6, -96], [-8, -80], [-10, -64], [-12, -50], [-15, -40]], renk: "#5E2416", alfa: .75, kalin: .05, min: 7 },   // Valles Marineris
        { leke: [18, -134, 4, 5], renk: "#D9875E", alfa: .6, min: 7 },                                                    // Olympus Mons
        { n: buzul([80, 77, 79, 83, 78, 76, 79, 82, 77, 80, 83, 78]), renk: "#F4EFEA", alfa: .9 },
        { n: buzul([-81, -84, -80, -82, -85, -81, -83, -80, -84, -82]), renk: "#EFEAE5", alfa: .85 }] },
    jupiter: { ad: "Jüpiter", ort: "#CDB08E", donus: 20, atmos: "rgba(255,228,195,.3)",
      bant: [[-90, "#9C8670"], [-53, "#D7C2A3"], [-37, "#B58864"], [-28, "#E8D7BA"], [-19, "#B2724A"], [-7, "#EFDCBA"], [7, "#B47650"], [17, "#E6D3B3"],
        [26, "#BE9068"], [36, "#DECAAC"], [53, "#A28A72"]],
      ozellik: [{ leke: [-21, 30, 6.5, 13], renk: "#ECD3B6", alfa: .9, min: 3 }, { leke: [-21, 30, 5, 10.5], renk: "#C2573A", alfa: .95, min: 3 },   // Büyük Kırmızı Leke
        { leke: [-35, 120, 2.5, 4], renk: "#F4EBDA", alfa: .85, min: 6 }, { leke: [-35, 170, 2.2, 3.5], renk: "#F4EBDA", alfa: .8, min: 6 },        // beyaz ovaller
        { leke: [12, -60, 1.6, 6], renk: "#8E5A3A", alfa: .6, min: 7 }] },
    uranus: { ad: "Uranüs", ort: "#A5DEE2", donus: 34, eksen: 98, atmos: "rgba(190,245,250,.45)",   // yan yatmış eksen, dik halkalar
      bant: [[-90, "#93D3D8"], [-35, "#A0DCE0"], [15, "#ABE3E6"], [55, "#BDEDEE"]],
      ince: [1.62, 1.72, 1.82, 2.02], inceRenk: "rgba(196,214,220,.5)" },
    dunya: { ad: "Dünya", ort: "#3F7AA8", donus: 48, atmos: "rgba(120,180,255,.65)",
      bant: [[-90, "#2A63AA"]],
      ozellik: [{ n: AFRIKA, renk: "#5B9446", min: 2.5 }, { n: AVRUPA, renk: "#5E9A4A", min: 2.5 }, { n: ASYA, renk: "#5A9145", min: 2.5 },
        { n: K_AMERIKA, renk: "#5C9748", min: 2.5 }, { n: G_AMERIKA, renk: "#4F8F3E", min: 2.5 },
        { n: [[-11, 131], [-11, 142], [-17, 146], [-25, 153], [-38, 147], [-35, 138], [-32, 133], [-34, 118], [-22, 114], [-14, 125]], renk: "#6A9A48", min: 3 },   // Avustralya
        { n: [[60, -44], [66, -35], [70, -22], [81, -15], [83, -35], [78, -70], [70, -54]], renk: "#E9EEF2", min: 3 },                                          // Grönland
        { n: [[31, -8], [32, 12], [31, 30], [22, 33], [16, 30], [15, 10], [17, -10], [25, -14]], renk: "#C4A66C", alfa: .9, min: 4 },                         // Sahra
        { n: [[30, 36], [28, 48], [23, 58], [16, 52], [13, 44], [20, 40]], renk: "#C9AB72", alfa: .85, min: 5 },                                             // Arabistan
        { n: [[-20, 123], [-21, 138], [-29, 138], [-31, 128], [-26, 120]], renk: "#C7A066", alfa: .8, min: 5 },
        { n: buzul([78, 74, 76, 80, 75, 72, 77, 81, 76, 73, 78, 80]), renk: "#F1F5F8", alfa: .88 },   // Arktik deniz buzu
        { guney: -68, renk: "#F4F7FA", alfa: .95 },
        { leke: [50, -30, 3.5, 30], renk: "#FFFFFF", alfa: .5, bulut: true, min: 6.5 }, { leke: [-46, 55, 3.5, 34], renk: "#FFFFFF", alfa: .5, bulut: true, min: 6.5 },
        { leke: [8, 125, 3, 18], renk: "#FFFFFF", alfa: .45, bulut: true, min: 6.5 }, { leke: [58, 140, 3, 24], renk: "#FFFFFF", alfa: .5, bulut: true, min: 6.5 },
        { leke: [-52, -105, 3, 28], renk: "#FFFFFF", alfa: .5, bulut: true, min: 6.5 }, { leke: [24, -150, 2.8, 14], renk: "#FFFFFF", alfa: .45, bulut: true, min: 6.5 },
        { leke: [-10, -20, 2.5, 16], renk: "#FFFFFF", alfa: .4, bulut: true, min: 6.5 },
        { sehir: [[40, -74], [34, -118], [41, -88], [30, -95], [19, -99], [-23, -46], [-34, -58], [4, -74], [51, 0], [48, 2], [52, 13], [41, 12], [40, -4], [55, 37],
          [41, 29], [30, 31], [6, 3], [-26, 28], [28, 77], [19, 73], [31, 121], [39, 116], [35, 139], [37, 127], [1, 104], [-6, 107], [-34, 151], [-37, 145],
          [14, 100], [23, 113], [25, 55], [24, 47]], min: 6 }] },   // şehir ışıkları: yalnız gece yüzünde
    neptun: { ad: "Neptün", ort: "#3557C8", donus: 38, atmos: "rgba(110,150,255,.55)",
      bant: [[-90, "#2643A8"], [-52, "#3050C4"], [-28, "#3A5ED2"], [-8, "#3458CC"], [20, "#4064D6"], [52, "#2E4DBE"]],
      ozellik: [{ leke: [-21, 30, 5, 11], renk: "#1A2A70", alfa: .9, min: 3 },   // Büyük Karanlık Leke
        { leke: [-27, 50, 1.6, 8], renk: "#EAF1FF", alfa: .85, min: 4 }, { leke: [-42, 150, 1.5, 4], renk: "#DDE6FF", alfa: .8, min: 6 },
        { leke: [28, -80, 1.2, 12], renk: "#C9D8FF", alfa: .5, bulut: true, min: 6.5 }] },
    pluton: { ad: "Plüton", ort: "#C2A080", donus: 140, atmos: "rgba(150,190,255,.35)",   // mavi pus (New Horizons)
      bant: [[-90, "#B58F70"], [58, "#A88C7A"]],
      ozellik: [{ n: [[12, 170], [24, 156], [38, 152], [48, 160], [48, 172], [42, 180], [48, 190], [46, 202], [36, 210], [22, 206], [10, 194], [-2, 182]], renk: "#F2E9DD", alfa: .95, min: 2.5 },   // kalp (Tombaugh Regio)
        { n: [[-2, 110], [2, 128], [-2, 145], [-12, 160], [-24, 152], [-26, 132], [-20, 112]], renk: "#6A4232", alfa: .85, min: 3 },   // Cthulhu Macula
        { leke: [-18, -60, 7, 18], renk: "#7A4E3B", alfa: .5, min: 5 }] },
    venus: { ad: "Venüs", ort: "#DFC892", donus: 90, atmos: "rgba(255,235,190,.4)",
      bant: [[-90, "#D8C08A"], [-40, "#E4CE98"], [-12, "#EAD7A4"], [14, "#E2CB95"], [42, "#D6BE88"]] },
    merkur: { ad: "Merkür", ort: "#9A948C", donus: 200,
      bant: [[-90, "#948E87"]],
      ozellik: [{ leke: [30, 170, 14, 16], renk: "#B3ACA4", alfa: .7, min: 3 }, { leke: [-20, 40, 5, 6], renk: "#7E7871", alfa: .7, min: 4 },
        { leke: [10, -60, 4, 4], renk: "#7E7871", alfa: .6, min: 5 }, { leke: [-45, -120, 6, 7], renk: "#ABA49C", alfa: .6, min: 5 }, { leke: [50, 60, 4, 5], renk: "#7E7871", alfa: .6, min: 5 }] },
    // aylar
    ay: { ad: "Ay", ort: "#A9A69F", bant: [[-90, "#B9B6AE"]],
      ozellik: [{ n: [[35, -55], [30, -35], [12, -25], [-5, -30], [-15, -45], [-5, -62], [15, -68]], renk: "#77746D", alfa: .85, min: 2 },   // Procellarum
        { leke: [33, -16, 11, 13], renk: "#77746D", alfa: .85, min: 2 }, { leke: [28, 18, 7, 8], renk: "#7B7871", alfa: .85, min: 3 },     // Imbrium, Serenitatis
        { leke: [8, 31, 9, 10], renk: "#7B7871", alfa: .85, min: 3 }, { leke: [17, 59, 4, 5], renk: "#77746D", alfa: .85, min: 4 },       // Tranquillitatis, Crisium
        { leke: [-21, -16, 6, 7], renk: "#807D76", alfa: .8, min: 4 }, { leke: [-43, -11, 2.2, 2.6], renk: "#ECEAE3", alfa: .95, min: 4 }] },   // Nubium, Tycho
    titan: { ad: "Titan", ort: "#D49A52", atmos: "rgba(240,180,100,.75)", bant: [[-90, "#C98C46"], [-25, "#D9A158"], [35, "#D0954E"]] },
    enceladus: { ad: "Enceladus", ort: "#EEF2F5", bant: [[-90, "#EEF2F5"]],
      ozellik: [[-20, 40], [10, 70], [40, 100], [70, 130]].map(([a, b]) => ({ cizgi: [[-70, a], [-82, b]], renk: "#7FAED3", alfa: .9, kalin: .06, min: 3 })) },   // kaplan çizgileri
    mimas: { ad: "Mimas", ort: "#ABA8A3", bant: [[-90, "#B4B1AC"]], ozellik: [{ leke: [0, 100, 20, 22], renk: "#8C8984", alfa: .7, min: 2 }, { leke: [0, 100, 3, 3], renk: "#C8C5BF", alfa: .9, min: 4 }] },
    phobos: { ad: "Phobos", ort: "#73655A", bant: [[-90, "#7A6B5F"]],
      ozellik: [{ leke: [-1, 50, 16, 19], renk: "#5B4F46", alfa: .75, min: 2 }, { cizgi: [[20, 60], [10, 120]], renk: "#5E5249", alfa: .6, kalin: .04, min: 5 }, { cizgi: [[10, 55], [0, 115]], renk: "#5E5249", alfa: .6, kalin: .04, min: 5 }] },
    deimos: { ad: "Deimos", ort: "#9A8A7C", bant: [[-90, "#9E8E80"]], ozellik: [{ leke: [10, -40, 6, 7], renk: "#857668", alfa: .5, min: 4 }] },
    io: { ad: "Io", ort: "#D8C25E", bant: [[-90, "#C9A957"], [-55, "#E3D06C"], [55, "#C9A957"]],
      ozellik: [{ leke: [-5, 20, 6, 7], renk: "#9C4F2B", alfa: .8, min: 2 }, { leke: [20, -60, 4, 5], renk: "#6E3F22", alfa: .8, min: 3 }, { leke: [-30, 120, 5, 6], renk: "#F0E5AE", alfa: .7, min: 3 }] },
    europa: { ad: "Europa", ort: "#DCD0BA", bant: [[-90, "#E3D9C6"]],
      ozellik: [[[40, -60], [10, -20], [-20, 20], [-45, 60]], [[50, 40], [20, 70], [-10, 110]], [[-10, -120], [15, -80], [35, -40]]].map((c) => ({ cizgi: c, renk: "#9C6B4A", alfa: .7, kalin: .035, min: 3 })) },
    ganymede: { ad: "Ganymede", ort: "#A39585", bant: [[-90, "#9A8C7E"]],
      ozellik: [{ n: [[30, -40], [42, 10], [25, 45], [0, 30], [-12, -15]], renk: "#C2B7A8", alfa: .7, min: 2 }, { n: [[50, 120], [45, 170], [20, 165], [25, 120]], renk: "#6F655B", alfa: .7, min: 3 }] },
    callisto: { ad: "Callisto", ort: "#6E6257", bant: [[-90, "#5E5248"]],
      ozellik: [{ leke: [20, 40, 8, 9], renk: "#A79A8B", alfa: .7, min: 2 }, { leke: [-30, -50, 3, 3], renk: "#D8D0C4", alfa: .8, min: 3 }, { leke: [50, -120, 2.5, 3], renk: "#CFC6B9", alfa: .8, min: 4 }] },
    miranda: { ad: "Miranda", ort: "#A3A19B", bant: [[-90, "#A8A6A0"]],
      ozellik: [{ n: [[-10, -20], [5, 0], [-10, 20], [-18, 12], [-6, 0], [-18, -12]], renk: "#D3D1CA", alfa: .85, duz: true, min: 3 },   // köşeli "chevron"
        { n: [[25, 60], [45, 95], [25, 130], [8, 95]], renk: "#7E7C77", alfa: .7, duz: true, min: 3 }] },
    titania: { ad: "Titania", ort: "#A79C93", bant: [[-90, "#A79C93"]], ozellik: [{ cizgi: [[30, -40], [0, -10], [-30, 20]], renk: "#6E655F", alfa: .7, kalin: .04, min: 3 }] },
    triton: { ad: "Triton", ort: "#CFC3B4", bant: [[-90, "#E8D6CB"], [-14, "#B2AD9B"], [45, "#C4BFAE"]] },   // pembemsi güney başlığı, "kavun kabuğu"
    proteus: { ad: "Proteus", ort: "#6A6661", bant: [[-90, "#6C6863"]], ozellik: [{ leke: [-10, 30, 14, 16], renk: "#57534F", alfa: .7, min: 2 }] },
    charon: { ad: "Charon", ort: "#9C8E86", bant: [[-90, "#A39C97"], [62, "#7C4C3C"]] },   // kızıl kuzey kutbu (Mordor Macula)
    nix: { ad: "Nix", ort: "#CCC5BE", bant: [[-90, "#D0CCC6"]], ozellik: [{ leke: [20, 30, 10, 12], renk: "#B98D7A", alfa: .5, min: 3 }] },
    hydra: { ad: "Hydra", ort: "#C2BDB7", bant: [[-90, "#C2BDB7"]] },
  };
  const AY_AILESI = { saturn: ["titan", "enceladus", "mimas"], mars: ["phobos", "deimos"], jupiter: ["io", "europa", "ganymede", "callisto"], uranus: ["miranda", "titania"],
    dunya: ["ay"], neptun: ["triton", "proteus"], pluton: ["charon", "nix", "hydra"], venus: ["ay"], yildiz: ["merkur"] };
  {
    // geometriyi bir kez hazırla (radyan, [cos enlem, sin enlem, boylam] düz dizileri; leke → 12 köşeli oval), rengi gövdeye göre karıştır
    const DR = Math.PI / 180, hazir = {};
    const nokta = (pts) => { const a = []; for (const [la, lo] of pts) a.push(Math.cos(la * DR), Math.sin(la * DR), lo * DR); return a; };
    const oval = ([la, lo, rl, rb]) => { const p = []; for (let i = 0; i < 12; i++) { const t = i / 12 * TAM; p.push([la + rl * Math.sin(t), lo + rb * Math.cos(t) / Math.max(.2, Math.cos(la * DR))]); } return p; };
    const hazirla = (tip) => hazir[tip] || (hazir[tip] = { ...DOKU[tip], bant: DOKU[tip].bant.map(([la, r]) => [la * DR, r]),
      ozellik: (DOKU[tip].ozellik || []).map((o) => ({ ...o, alfa: o.alfa ?? 1, min: o.min || 0, kuzey: o.kuzey === undefined ? undefined : o.kuzey * DR,
        guney: o.guney === undefined ? undefined : o.guney * DR, p: o.n ? nokta(o.n) : o.leke ? nokta(oval(o.leke)) : o.cizgi ? nokta(o.cizgi) : o.sehir ? nokta(o.sehir) : null })) });
    const karis = (h, c, t) => { const a = hex(h); return [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + c[i] * t)); };
    // aylar: ailesindeki gerçek aylar büyük geçmişten küçüğe sırayla
    const aile = {};
    for (const d of aylar) { const e = d.ebeveyn, ad = e.tur === "yildiz" ? "yildiz" : ALAN_GEZEGEN[e.alan] || "venus"; (aile[ad] = aile[ad] || []).push(d); }
    for (const [ad, liste] of Object.entries(aile)) {
      liste.sort((a, b) => b.karakter - a.karakter || a.id.localeCompare(b.id));
      liste.forEach((d, i) => { d.dokuTip = (AY_AILESI[ad] || [])[i] || "ay"; });
    }
    for (const d of D) {
      if (d.tur === "gezegen") d.dokuTip = ALAN_GEZEGEN[d.alan] || "venus";
      if (!d.dokuTip) continue;
      const G = hazirla(d.dokuTip), t = d.tur === "ay" ? .12 : .22, renk = (h) => rgba(karis(h, d.rgb, t), 1), g = rastgele("doku:" + d.id);
      d.doku = { ad: G.ad, donus: G.donus || 0, faz: g() * TAM, atmos: G.atmos || null, halka: G.halka || null, ince: G.ince || null, inceRenk: G.inceRenk,
        bant: G.bant.map(([la, h]) => [la, renk(h)]), ozellik: G.ozellik.map((o) => ({ ...o, renk: o.renk ? renk(o.renk) : null })), sehir: null, egik: !!G.eksen };
      d.doku.sehir = (d.doku.ozellik.find((o) => o.sehir) || {}).p || null;
      if (G.eksen) {   // eğik eksen n ve onunla dik taban (e1, e2): yüzey noktası = cos enlem·(cos L·e1 + sin L·e2) + sin enlem·n
        const al = g() * TAM, e = G.eksen * DR, n = [Math.sin(e) * Math.cos(al), Math.cos(e), Math.sin(e) * Math.sin(al)];
        const h = Math.abs(n[2]) < .9 ? [0, 0, 1] : [1, 0, 0], c1 = [n[1] * h[2] - n[2] * h[1], n[2] * h[0] - n[0] * h[2], n[0] * h[1] - n[1] * h[0]];
        const u = Math.hypot(...c1), e1 = c1.map((v) => v / u), e2 = [e1[1] * n[2] - e1[2] * n[1], e1[2] * n[0] - e1[0] * n[2], e1[0] * n[1] - e1[1] * n[0]];
        Object.assign(d.doku, { ekX: n[0], ekY: n[1], ekZ: n[2], e1, e2 });
      }
      d.yOrt = karis(G.ort, d.rgb, t);
    }
    // halkalı gezegende aylar ve uydular halkanın dışından dolaşır
    for (const d of aylar) { const T = d.ebeveyn.doku; if (T && (T.halka || T.ince)) d.yo.a += d.ebeveyn.yR * .9; }
    for (const d of kusak) { const T = d.ebeveyn && d.ebeveyn.doku; if (T && (T.halka || T.ince)) d.yo.a += d.ebeveyn.yR * .9; }
    for (const s of uydular) { const T = s.e.doku; if (T && (T.halka || T.ince)) s.a += s.e.yR * 1.05; }
  }

  // her gövde için bir kez, birim uzayda: yıldızda ışıyan disk + korona; gezegende (uzaktayken, dokusuz) gündüz yüzü (ışığın
  // geldiği yana göre 9 kademe), gece yüzü, ışıma — dokunun ortalama renginde
  // güneş sarı-beyaz; eş yıldızlar büyükten küçüğe turuncu cüce, mavi-beyaz, kırmızı cüce…
  const ES_RGB = [[255, 178, 112], [192, 218, 255], [255, 140, 110], [236, 240, 255]];
  const YILDIZ_RGB = { [gunes ? gunes.id : ""]: [255, 222, 156] };
  esler.forEach((d, i) => { YILDIZ_RGB[d.id] = ES_RGB[i % ES_RGB.length]; });
  for (const d of D) {
    if (d.tur === "yildiz") {
      const c = YILDIZ_RGB[d.id] || [255, 222, 156], beyaz = c.map((v) => Math.round(v + (255 - v) * .7));
      const disk = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
      disk.addColorStop(0, "#FFFFFF"); disk.addColorStop(.5, rgba(beyaz, 1)); disk.addColorStop(.86, rgba(c, 1)); disk.addColorStop(1, rgba(c.map((v) => Math.round(v * .8)), 1));
      const korona = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
      korona.addColorStop(0, rgba(c, .55)); korona.addColorStop(.2, rgba(c, .22)); korona.addColorStop(.5, rgba(c, .06)); korona.addColorStop(1, rgba(c, 0));
      d.yRgb = c; d.yDisk = disk; d.yKorona = korona;
      continue;
    }
    // rota ve uzay aracı rengi alan renginde kalır (lejant); gövdenin kendi görünüşü dokunun ortalama renginde (yOrt)
    d.yRgb = d.tur === "ay" ? d.rgb.map((v) => Math.round(v * .55 + 68)) : d.rgb;
    const c = d.yOrt || d.yRgb;
    const acikR = c.map((v) => Math.round(v + (255 - v) * .55)), koyuR = c.map((v) => Math.round(v * .5));
    d.yGece = rgba(c.map((v) => Math.round(v * .14 + 8)), 1); d.yKenar = rgba(c, .3); d.yGunduz = [];
    for (let k = 0; k <= 8; k++) {
      const m = k / 8 * .8, g = cx.createRadialGradient(m, 0, 0, m, 0, 1.4);
      g.addColorStop(0, rgba(acikR, 1)); g.addColorStop(.45, rgba(c, 1)); g.addColorStop(1, rgba(koyuR, 1));
      d.yGunduz.push(g);
    }
    const kuy = d.tur === "kuyruklu", hale = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
    hale.addColorStop(0, rgba(c, kuy ? .5 : .3)); hale.addColorStop(.45, rgba(c, kuy ? .14 : .07)); hale.addColorStop(1, rgba(c, 0));
    d.yHale = hale;
    if (kuy) {
      const ck = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
      ck.addColorStop(0, "#FFFFFF"); ck.addColorStop(.6, rgba(acikR, 1)); ck.addColorStop(1, rgba(c, 1));
      d.yCekirdek = ck;
    }
  }
  const uyduHale = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
  uyduHale.addColorStop(0, "rgba(255,112,92,.6)"); uyduHale.addColorStop(1, "rgba(255,112,92,0)");

  // gökyüzü: kürede tohumlu yıldızlar (çoğu sönük, azı parlak); sonsuz uzakta, kamerayla döner, yakınlaşmayla büyümez
  const GOK_N = 1800, gok = new Float32Array(GOK_N * 5);
  {
    const g = rastgele("gokyuzu");
    for (let i = 0; i < GOK_N; i++) {
      const u = g() * 2 - 1, f = g() * TAM, r = Math.sqrt(1 - u * u);
      gok.set([r * Math.cos(f), u, r * Math.sin(f), Math.pow(g(), 3.2), g()], i * 5);
    }
  }
  const GOK_RENK = [[244, 246, 255], [200, 218, 255], [255, 226, 186]];
  const gokHale = GOK_RENK.map((c) => { const g = cx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, rgba(c, .45)); g.addColorStop(1, rgba(c, 0)); return g; });
  const gokStil = [];   // yıldız başına sabit renk (kırpışmayanlar için)
  for (let i = 0; i < GOK_N; i++) { const r = gok[i * 5 + 4]; gokStil.push(rgba(GOK_RENK[r < .62 ? 0 : r < .86 ? 1 : 2], (.14 + gok[i * 5 + 3] * .75).toFixed(3))); }

  // kamera: yMerkez'e bakar (gezegen izlenirken o gezegen); izd() bir dünya noktasını ekrana düşürür (PX, PY, PZ, PP)
  let ySaat = 0, yZaman = SON_GUN, takip = null, Yoy = 0;
  const yMerkez = [0, 0, 0];
  let Ycy = 1, Ysy = 0, Ycp = 1, Ysp = 0, Yol = 100, Yox = 0, PX = 0, PY = 0, PZ = 0, PP = 1, QX = 0, QY = 0, QZ = 0;
  function izd(x, y, z) {
    x -= yMerkez[0]; y -= yMerkez[1]; z -= yMerkez[2];
    const x1 = x * Ycy + z * Ysy, z1 = -x * Ysy + z * Ycy, y2 = y * Ycp - z1 * Ysp, z2 = y * Ysp + z1 * Ycp, uz = Y.KAM + z2;
    PP = uz > .5 ? Y.KAM / uz : 0; PX = Yox + x1 * Yol * PP; PY = Yoy - y2 * Yol * PP; PZ = z2;
  }
  function egik(x, z, egim, dugum) {   // yörünge düzlemindeki (x, 0, z) noktasını eğip döndür → QX, QY, QZ
    const z1 = z * Math.cos(egim), c = Math.cos(dugum), s = Math.sin(dugum);
    QX = x * c + z1 * s; QY = -z * Math.sin(egim); QZ = -x * s + z1 * c;
  }
  function kuyrukluNokta(o, E) {       // dış merkezlilik açısından (E) uzaydaki noktaya
    const x = o.a * (Math.cos(E) - o.e), z = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E), cw = Math.cos(o.w), sw = Math.sin(o.w);
    egik(x * cw - z * sw, x * sw + z * cw, o.egim, o.dugum);
  }
  function yKonumlar(Tu, sn) {         // Tu: evren günü (zaman cetveli + akan saat), sn: gerçek saniye
    for (const d of esler) {
      const o = d.yo, u = o.faz + sn * TAM / o.sn;
      egik(o.a * Math.cos(u), o.a * Math.sin(u), o.egim, o.dugum); d.wx = QX; d.wy = QY; d.wz = QZ;
    }
    for (const o of yorungeler) for (const d of o.gezegenler) {
      const u = d.yo.aci + Tu * TAM / o.donem;
      egik(o.r * Math.cos(u), o.r * Math.sin(u), o.egim, o.dugum); d.wx = QX; d.wy = QY; d.wz = QZ;
    }
    for (const d of kuyrukluar) {
      const o = d.yo, M = TAM * (Tu / o.donem + o.faz);
      let E = M + o.e * Math.sin(M);
      for (let i = 0; i < 6; i++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
      kuyrukluNokta(o, E); d.wx = QX; d.wy = QY; d.wz = QZ;
    }
    for (const d of aylar) {
      const o = d.yo, e = d.ebeveyn, u = o.faz + sn * TAM / o.sn;
      egik(o.a * Math.cos(u), o.a * Math.sin(u), o.egim, o.dugum); d.wx = e.wx + QX; d.wy = e.wy + QY; d.wz = e.wz + QZ;
    }
    for (const s of uydular) {
      const e = s.e, u = s.faz + sn * TAM / s.sn;
      egik(s.a * Math.cos(u), s.a * Math.sin(u), s.egim, s.dugum); s.wx = e.wx + QX; s.wy = e.wy + QY; s.wz = e.wz + QZ;
    }
    for (const d of kusak) {
      const o = d.yo, e = d.ebeveyn || { wx: 0, wy: 0, wz: 0 }, u = o.faz + sn * TAM / o.sn;
      egik(o.a * Math.cos(u), o.a * Math.sin(u), o.egim, o.dugum); d.wx = e.wx + QX; d.wy = e.wy + QY; d.wz = e.wz + QZ;
    }
  }
  function yIzdus(dt) {
    if (!azHareket) ySaat += dt / 1000;
    // zaman cetveli: kısa adımda yörüngeler yumuşakça döner (geri sarılır), uzak sıçramada (▶ başa sarınca) doğrudan atlar
    yZaman = Math.abs(zamanGun - yZaman) > 4 ? zamanGun : yZaman + (zamanGun - yZaman) * Math.min(1, dt / 140);
    yKonumlar(yZaman + ySaat / Y.GUN_SN, ySaat);
    const k = Math.min(1, dt / 220), m = takip && gorunur(takip) ? takip : null;
    yMerkez[0] += ((m ? m.wx : 0) - yMerkez[0]) * k; yMerkez[1] += ((m ? m.wy : 0) - yMerkez[1]) * k; yMerkez[2] += ((m ? m.wz : 0) - yMerkez[2]) * k;
    Ycy = Math.cos(yaw); Ysy = Math.sin(yaw); Ycp = Math.cos(pitch); Ysp = Math.sin(pitch);
    Yol = Math.min(W * .45, H * .36) / 1.85 * yakin; Yox = W / 2;
    if (bantKirli) bantOlc();
    const oyH = (bantUst + Math.max(bantUst + 120, bantAlt)) / 2;   // ayrıntı sayfası açıkken sistem yukarı, görünür alana kayar
    Yoy = Yoy ? Yoy + (oyH - Yoy) * Math.min(1, dt / 260) : oyH;
    for (const d of D) {
      izd(d.wx, d.wy, d.wz); d.sx = PX; d.sy = PY; d.sz = PZ; d.ps = PP; d.ekranda = PP > 0;
      if (d.tur === "yildiz") continue;
      // ışık güneşten: kamera uzayındaki yönü → gündüz yüzünün ekrandaki açısı (lfi) ve görünen evre (lz > 0: güneş arkada, hilal)
      const r = Math.hypot(d.wx, d.wy, d.wz) || 1, Lx = -d.wx / r, Ly = -d.wy / r, Lz = -d.wz / r;
      const lx = Lx * Ycy + Lz * Ysy, lz1 = -Lx * Ysy + Lz * Ycy, ly = Ly * Ycp - lz1 * Ysp;
      d.lfi = Math.atan2(-ly, lx); d.ls = Math.hypot(lx, ly); d.lz = Ly * Ysp + lz1 * Ycp;
    }
    for (const s of uydular) { izd(s.wx, s.wy, s.wz); s.sx = PX; s.sy = PY; s.sz = PZ; s.ps = PP; s.ekranda = PP > 0; }
  }

  const egriTampon = new Float32Array(97 * 3);
  function egriCiz(N, nokta, rgb, alfa, kalin) {   // kapalı eğri (N: 8'in katı, ≤96); 8 parça, önü parlak arkası sönük
    let onX = 0, onY = -1e9;
    for (let i = 0; i <= N; i++) {
      nokta(i / N); izd(QX, QY, QZ);
      egriTampon[i * 3] = PX; egriTampon[i * 3 + 1] = PY; egriTampon[i * 3 + 2] = PP > 0 ? PZ : NaN;
      if (PP > 0 && PY > onY) { onY = PY; onX = PX; }
    }
    cx.lineWidth = kalin;
    const adim = N / 8;
    for (let p = 0; p < 8; p++) {
      const i0 = p * adim, i1 = i0 + adim, z = (egriTampon[i0 * 3 + 2] + egriTampon[i1 * 3 + 2]) / 2;
      if (z !== z) continue;   // kameranın arkasında
      cx.strokeStyle = rgba(rgb, (alfa * Math.max(.3, Math.min(1, .7 - z * .35))).toFixed(3));
      cx.beginPath(); cx.moveTo(egriTampon[i0 * 3], egriTampon[i0 * 3 + 1]);
      for (let i = i0 + 1; i <= i1; i++) cx.lineTo(egriTampon[i * 3], egriTampon[i * 3 + 1]);
      cx.stroke();
    }
    return [onX, onY];
  }
  // rota: iki gövde arasında güneşin çevresinde kıvrılan yol (yarıçap ve açı birlikte değişir, ortası biraz kalkık)
  function rotaHazir(a, b) {
    const ta = Math.atan2(a.wz, a.wx);
    let fark = Math.atan2(b.wz, b.wx) - ta;
    if (fark > Math.PI) fark -= TAM; else if (fark < -Math.PI) fark += TAM;
    return { ra: Math.hypot(a.wx, a.wz), rb: Math.hypot(b.wx, b.wz), ta, fark, ya: a.wy, yb: b.wy, kalk: .04 + .1 * Math.abs(fark) / Math.PI };
  }
  function rotaNokta(r, u) {
    const R = r.ra + (r.rb - r.ra) * u, T = r.ta + r.fark * u;
    QX = R * Math.cos(T); QZ = R * Math.sin(T); QY = r.ya + (r.yb - r.ya) * u + Math.sin(Math.PI * u) * r.kalk;
  }
  function yolCiz(r, n) {
    cx.beginPath();
    let suruyor = false;
    for (let j = 0; j <= n; j++) {
      rotaNokta(r, j / n); izd(QX, QY, QZ);
      if (PP <= 0) { suruyor = false; continue; }   // kameranın arkası: yolu kes
      if (suruyor) cx.lineTo(PX, PY); else { cx.moveTo(PX, PY); suruyor = true; }
    }
    cx.stroke();
  }

  function gokyuzuCiz(t) {
    // yıldızlar tek tek çizilir: dağınık noktaları tek yolda toplamak, yazılımla çizen tarayıcıda bütün ekranı taratıyor (25 → 39 kare/sn)
    const F = Math.max(W, H) * .62, ox = W / 2, oy = H / 2;
    cx.globalAlpha = 1;
    for (let i = 0; i < GOK_N; i++) {
      const j = i * 5, x = gok[j], y = gok[j + 1], z = gok[j + 2];
      const x1 = x * Ycy + z * Ysy, z1 = -x * Ysy + z * Ycy, y2 = y * Ycp - z1 * Ysp, z2 = y * Ysp + z1 * Ycp;
      if (z2 < .1) continue;
      const sx = ox + x1 / z2 * F, sy = oy - y2 / z2 * F;
      if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;
      const p = gok[j + 3], r = .32 + p * .95, renk = gok[j + 4] < .62 ? 0 : gok[j + 4] < .86 ? 1 : 2;
      if (p > .55) {   // parlak birkaç yıldız: yavaşça kırpışır, en parlakların çevresinde küçük yumuşak ışıma (ışın yok)
        const a = (.14 + p * .75) * (azHareket ? 1 : .8 + .2 * Math.sin(t / (900 + 700 * gok[j + 4]) + i));
        if (p > .75) { birim(sx, sy, r * 4.5); cx.globalAlpha = a * .5; cx.fillStyle = gokHale[renk]; cx.fillRect(-1, -1, 2, 2); sifirla(); }
        cx.globalAlpha = 1; cx.fillStyle = rgba(GOK_RENK[renk], a.toFixed(3));
        cx.beginPath(); cx.arc(sx, sy, r, 0, TAM); cx.fill();
        continue;
      }
      cx.fillStyle = gokStil[i];
      if (r < .6) cx.fillRect(sx - r, sy - r, r * 2, r * 2);   // 1–2 cihaz pikseli: kare ile daire ayırt edilmez
      else { cx.beginPath(); cx.arc(sx, sy, r, 0, TAM); cx.fill(); }
    }
  }

  // aydınlatılan küre: gece yüzü + güneşe bakan yarım disk ve sonlandırıcı (yarım elips) arasındaki gündüz yüzü.
  // Tuval, +x güneşin ekrandaki yönüne bakacak biçimde döndürülür; |lz| sonlandırıcı elipsin genişliği (hilal ↔ dolunay).
  // Sonlandırıcı sert değil (alacakaranlık): gündüz yüzü n kademeyle gece tarafına taşar; k. kademenin saydamlığı a/(n+1-a·k),
  // böylece her kademe toplam örtüyü eşit adımla (a/(n+1)) artırır — "yarısı boyalı bilye" de, çizgi çizgi bant da olmaz.
  // Kademe sayısı ekrandaki boya göre: küçük gövdede 1, orta 4, yakın planda 8.
  function yKure(d, ro, a) {
    const c = Math.cos(d.lfi) * ro * DPR, s = Math.sin(d.lfi) * ro * DPR, lz = d.lz;
    cx.setTransform(c, s, -s, c, DPR * d.sx, DPR * d.sy);
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a;
    cx.fillStyle = d.yGece; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM); cx.fill();
    cx.fillStyle = d.yGunduz[Math.round((lz < 0 ? d.ls : 1) * 8)];
    const n = ro < 2.5 ? 0 : ro < 9 ? 3 : 7;
    for (let k = 0; k <= n; k++) {
      const l = Math.max(-1, Math.min(1, lz - (n ? .15 - .3 * k / n : 0)));
      cx.globalAlpha = a / (n + 1 - a * k);   // soluk (a < 1) gövdede de toplam örtü a'da kalsın
      cx.beginPath(); cx.arc(0, 0, 1, -Math.PI / 2, Math.PI / 2); cx.ellipse(0, 0, Math.max(.001, Math.abs(l)), 1, 0, Math.PI / 2, -Math.PI / 2, l > 0); cx.fill();
    }
    cx.globalAlpha = a; cx.strokeStyle = d.yKenar; cx.lineWidth = .8 / ro; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM); cx.stroke();
  }
  function gezegenCiz(d, ro, a, t) {
    const aydinlik = (1 - d.lz) / 2, nabiz = d.taze && !azHareket ? .1 * (1 + Math.sin(t / 520 + d.i)) : 0;
    birim(d.sx, d.sy, ro * 2.4);
    cx.globalCompositeOperation = "lighter";
    cx.globalAlpha = a * Math.min(1, (.2 + nabiz + d.atesle * .5) * (.4 + .6 * aydinlik));
    cx.fillStyle = d.yHale; cx.fillRect(-1, -1, 2, 2);
    const T = d.doku, halkali = T && (T.halka || T.ince);
    if (halkali) halkaCiz(d, ro, a, false);                 // halkanın arka yarısı gezegenin arkasında
    if (T && ro >= dokuEsik) dokuluKure(d, ro, a); else yKure(d, ro, a);   // küçükken dokusuz, ortalama renkte
    if (halkali) halkaCiz(d, ro, a, true);                  // ön yarısı önünde
  }

  // --- doku çizimi: birim disk (r = 1), eksen ekranda yukarı; eğik eksenli gezegende (Uranüs) çerçeve döndürülür ---
  // dokuEsik: dokunun çizildiği en küçük boy (px). Yavaş cihazda kare döngüsü önce çözünürlüğü 3x → 2x indirir; yine yavaşsa
  // eşik 7'ye çıkar: uzak görünüm sade küre, yakın plan dokulu.
  let dokuEsik = 2.4;
  let KX = 0, KY = 0, KZ = 0, EM = 1, ENZ = 0, ECR = 1, ESR = 0;
  let B1x = 1, B1y = 0, B1z = 0, BNx = 0, BNy = 1, BNz = 0, B2x = 0, B2y = 0, B2z = 1;   // yüzey tabanı (düz eksende birim)
  function eksenCercevesi(T) {   // EM: eksenin ekrandaki boyu, ENZ: kameraya göre derinliği (< 0: kuzey kutbu bize dönük), ECR/ESR: çerçeve dönüşü
    if (!T.egik) { EM = Ycp; ENZ = Ysp; ECR = 1; ESR = 0; B1x = 1; B1y = 0; B1z = 0; BNx = 0; BNy = 1; BNz = 0; B2x = 0; B2y = 0; B2z = 1; return; }
    [B1x, B1y, B1z] = T.e1; [B2x, B2y, B2z] = T.e2; BNx = T.ekX; BNy = T.ekY; BNz = T.ekZ;
    const x1 = T.ekX * Ycy + T.ekZ * Ysy, z1 = -T.ekX * Ysy + T.ekZ * Ycy, y2 = T.ekY * Ycp - z1 * Ysp;
    ENZ = T.ekY * Ysp + z1 * Ycp; EM = Math.hypot(x1, y2) || 1e-6; ECR = y2 / EM; ESR = x1 / EM;
  }
  function kurePx(cl, sl, lon, w) {   // yüzeydeki nokta (enlem cos/sin, boylam) → birim disk (KX, KY); KZ < 0 ise görünür
    const L = lon + w, c = cl * Math.cos(L), sn = cl * Math.sin(L);
    const x = c * B1x + sl * BNx + sn * B2x, y = c * B1y + sl * BNy + sn * B2y, z = c * B1z + sl * BNz + sn * B2z;
    const x1 = x * Ycy + z * Ysy, z1 = -x * Ysy + z * Ycy;
    KX = x1; KY = -(y * Ycp - z1 * Ysp); KZ = y * Ysp + z1 * Ycp;
  }
  const CX_ = new Float32Array(64), CY_ = new Float32Array(64);
  function cokgenYolu(p, w, duz) {   // arkada kalan köşe ufka (disk kenarına) yapışır; hepsi arkadaysa çizilmez
    const n = p.length / 3;
    let gor = 0;
    for (let i = 0; i < n; i++) {
      kurePx(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], w);
      if (KZ < 0) gor++; else { const r = Math.hypot(KX, KY) || 1; KX /= r; KY /= r; }
      CX_[i] = KX; CY_[i] = KY;
    }
    if (!gor) return false;
    if (duz) { cx.moveTo(CX_[0], CY_[0]); for (let i = 1; i < n; i++) cx.lineTo(CX_[i], CY_[i]); }
    else {   // yumuşak kenar: köşeler arası orta noktalardan ikinci derece eğri (kıta, leke)
      cx.moveTo((CX_[n - 1] + CX_[0]) / 2, (CY_[n - 1] + CY_[0]) / 2);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; cx.quadraticCurveTo(CX_[i], CY_[i], (CX_[i] + CX_[j]) / 2, (CY_[i] + CY_[j]) / 2); }
    }
    cx.closePath();
    return true;
  }
  // enlem fi'nin kuzeyinde görünen bölge: enlem çemberi ekranda merkezi (0, -sin fi·EM), yarı eksenleri cos fi ve cos fi·|ENZ| olan
  // elips; görünen yayı + kuzey yandaki disk kenarı. Yolu ekler (her alt yol moveTo ile başlar), "evenodd" ile doldurulur.
  function sapkaYolu(fi) {
    const cf = Math.cos(fi), sf = Math.sin(fi), m = EM, nz = ENZ;
    if (cf < 1e-5) return;
    const cyy = -sf * m, b = Math.max(1e-5, cf * Math.abs(nz)), k = cf * m > 1e-6 ? -sf * nz / (cf * m) : (-sf * nz > 0 ? 2 : -2);
    if (k >= 1) {   // çember tümüyle görünür: kutup bize dönükse içi, değilse disk eksi içi
      if (nz >= 0) { cx.moveTo(1, 0); cx.arc(0, 0, 1, 0, TAM); }
      cx.moveTo(cf, cyy); cx.ellipse(0, cyy, cf, b, 0, 0, TAM);
      return;
    }
    if (k <= -1) { if (-nz > sf) { cx.moveTo(1, 0); cx.arc(0, 0, 1, 0, TAM); } return; }   // çember tümüyle arkada
    const as = Math.asin(k), l1 = Math.PI - as, l2 = TAM + as;
    const X1 = cf * Math.cos(l1), Y1 = cyy + cf * nz * Math.sin(l1), X2 = cf * Math.cos(l2), Y2 = cyy + cf * nz * Math.sin(l2);
    cx.moveTo(X1, Y1);
    if (nz >= 0) cx.ellipse(0, cyy, cf, b, 0, l1, l2, false); else cx.ellipse(0, cyy, cf, b, 0, -l1, -l2, true);
    cx.arc(0, 0, 1, Math.atan2(Y2, X2), Math.atan2(Y1, X1), true);
    cx.closePath();
  }
  function isikYolu(l) {   // gündüz yüzü (yKure'deki yol): güneşe bakan yarım disk + sonlandırıcı yarım elips
    cx.moveTo(0, -1); cx.arc(0, 0, 1, -Math.PI / 2, Math.PI / 2);
    cx.ellipse(0, 0, Math.max(.001, Math.abs(l)), 1, 0, Math.PI / 2, -Math.PI / 2, l > 0); cx.closePath();
  }
  const KENAR_KARART = cx.createRadialGradient(0, 0, 0, 0, 0, 1);   // kürenin kenarı koyulaşır (hacim)
  KENAR_KARART.addColorStop(0, "rgba(0,0,0,0)"); KENAR_KARART.addColorStop(.62, "rgba(0,0,0,.05)"); KENAR_KARART.addColorStop(1, "rgba(0,0,0,.42)");
  const PARILTI = [];   // güneşe bakan noktada hafif parıltı (9 kademe, yKure ile aynı)
  for (let k = 0; k <= 8; k++) {
    const m = k / 8 * .8, g = cx.createRadialGradient(m, 0, 0, m, 0, 1.1);
    g.addColorStop(0, "rgba(255,250,240,.13)"); g.addColorStop(.5, "rgba(255,250,240,.03)"); g.addColorStop(1, "rgba(255,250,240,0)");   // hafif: plastik top gibi parlamasın
    PARILTI.push(g);
  }
  function dokuluKure(d, ro, a) {
    const T = d.doku, S = DPR * ro;
    // dönüş: gezegen kendi ekseninde; ay ebeveynine hep aynı yüzü gösterir (yörünge açısıyla birlikte döner)
    const w = d.tur === "ay" ? d.yo.faz + ySaat * TAM / d.yo.sn + Math.PI + T.faz : T.faz + (azHareket || !T.donus ? 0 : ySaat * TAM / T.donus);
    eksenCercevesi(T);
    cx.setTransform(S * ECR, S * ESR, -S * ESR, S * ECR, DPR * d.sx, DPR * d.sy);
    // kırpma (clip) yok — yazılımla çizen tarayıcıda kare hızını yarıya düşürüyordu (60 → 25). Gerek de yok: şapka yolları
    // disk kenarıyla sınırlı; çokgenin köşeleri ve kontrol noktaları disk içinde (arkadakiler kenara yapışık), eğri de onların
    // dışbükey zarfında kalır; ışık katmanları disk biçiminde.
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a;
    // yüzey: güneyden kuzeye enlem kuşakları, sonra kıta / leke / kutup / çizgi
    cx.fillStyle = T.bant[0][1]; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM); cx.fill();
    // uzaktayken (ekranda < 9 px) komşu kuşaklar ikişer birleşir: ince kuşak seçilmiyor, her biri ayrı çizim komutu
    for (let i = 1, adim = ro < 9 ? 2 : 1; i < T.bant.length; i += adim) { cx.beginPath(); sapkaYolu(T.bant[i][0]); cx.fillStyle = T.bant[i][1]; cx.fill("evenodd"); }
    for (const o of T.ozellik) {
      if (ro < o.min || o.sehir) continue;
      const sapka = o.kuzey !== undefined || o.guney !== undefined;
      if (T.egik) cx.setTransform(sapka ? S * ECR : S, sapka ? S * ESR : 0, sapka ? -S * ESR : 0, sapka ? S * ECR : S, DPR * d.sx, DPR * d.sy);
      cx.globalAlpha = a * o.alfa; cx.beginPath();
      if (o.kuzey !== undefined) { sapkaYolu(o.kuzey); cx.fillStyle = o.renk; cx.fill("evenodd"); }
      else if (o.guney !== undefined) { cx.moveTo(1, 0); cx.arc(0, 0, 1, 0, TAM); sapkaYolu(o.guney); cx.fillStyle = o.renk; cx.fill("evenodd"); }
      else if (o.cizgi) {
        const p = o.p, n = p.length / 3;
        let suruyor = false;
        for (let i = 0; i < n; i++) {
          kurePx(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], w);
          if (KZ >= 0) { suruyor = false; continue; }
          if (suruyor) cx.lineTo(KX, KY); else { cx.moveTo(KX, KY); suruyor = true; }
        }
        cx.strokeStyle = o.renk; cx.lineWidth = o.kalin; cx.stroke();
      } else if (cokgenYolu(o.p, o.bulut ? w * 1.18 + 1.3 : w, o.duz)) { cx.fillStyle = o.renk; cx.fill(); }   // bulutlar yüzeyden hızlı döner
    }
    // ışık: kenar kararması, güneş yönünde parıltı, gece perdesi (yKure'deki alacakaranlık kademeleri; doku gece yüzünde soluk görünür)
    const c = Math.cos(d.lfi) * S, s = Math.sin(d.lfi) * S, lz = d.lz;
    cx.setTransform(c, s, -s, c, DPR * d.sx, DPR * d.sy);
    cx.globalAlpha = a; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM);
    cx.fillStyle = KENAR_KARART; cx.fill();
    if (ro >= 6) { cx.fillStyle = PARILTI[Math.round((lz < 0 ? d.ls : 1) * 8)]; cx.fill(); }
    const n = ro < 6 ? 1 : ro < 9 ? 2 : 7, K = .88;   // alacakaranlık kademesi boya göre
    cx.fillStyle = "#03060A";
    for (let k = 0; k <= n; k++) {
      const l = Math.max(-1, Math.min(1, lz + .15 - .3 * k / n));
      cx.globalAlpha = a * K / (n + 1 - K * k);
      cx.beginPath(); cx.moveTo(1, 0); cx.arc(0, 0, 1, 0, TAM); isikYolu(l); cx.fill("evenodd");
    }
    // Dünya: şehir ışıkları yalnız gece yüzünde (yüzey normali güneşten öteye bakıyorsa)
    if (T.sehir && ro >= 8) {
      cx.setTransform(S, 0, 0, S, DPR * d.sx, DPR * d.sy);
      const lx = d.ls * Math.cos(d.lfi), ly = d.ls * Math.sin(d.lfi), rr = Math.min(.08, .6 / ro), p = T.sehir;
      cx.globalCompositeOperation = "lighter"; cx.globalAlpha = a; cx.fillStyle = "rgba(255,206,130,.9)"; cx.beginPath();
      for (let i = 0; i < p.length; i += 3) {
        kurePx(p[i], p[i + 1], p[i + 2], w);
        if (KZ >= 0 || KX * lx + KY * ly + KZ * lz > -.08) continue;
        cx.moveTo(KX + rr, KY); cx.arc(KX, KY, rr, 0, TAM);
      }
      cx.fill(); cx.globalCompositeOperation = "source-over";
    }
    // atmosfer: aydınlık kenarda ince ışık; ardından gece yüzünün de seçilmesi için ince kenar çizgisi
    cx.setTransform(c, s, -s, c, DPR * d.sx, DPR * d.sy);
    if (T.atmos) { cx.globalAlpha = a; cx.strokeStyle = T.atmos; cx.lineWidth = 1.4 / ro; cx.beginPath(); cx.arc(0, 0, 1, -Math.PI * .46, Math.PI * .46); cx.stroke(); }
    cx.globalAlpha = a; cx.strokeStyle = d.yKenar; cx.lineWidth = .8 / ro; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM); cx.stroke();
  }
  function halkaCiz(d, ro, a, on) {
    // halka gezegenin ekvator düzleminde: ekranda (r, r·|ENZ|) elipsi; yakın yarı (on) gezegenin önünde, uzak yarı arkasında
    const T = d.doku, S = DPR * ro;
    eksenCercevesi(T);
    const b = Math.abs(ENZ), alt = (ENZ < 0) === on;
    cx.setTransform(S * ECR, S * ESR, -S * ESR, S * ECR, DPR * d.sx, DPR * d.sy);
    cx.save();
    cx.beginPath(); cx.rect(-3, alt ? 0 : -3, 6, 3); cx.clip();
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a;
    if (T.halka) for (const [r1, r2, renk] of T.halka) {   // dolu halka: dış elips eksi iç elips (eğik bakışta incelir)
      cx.fillStyle = renk; cx.beginPath();
      cx.moveTo(r2, 0); cx.ellipse(0, 0, r2, Math.max(1e-4, r2 * b), 0, 0, TAM);
      cx.moveTo(r1, 0); cx.ellipse(0, 0, r1, Math.max(1e-4, r1 * b), 0, 0, TAM);
      cx.fill("evenodd");
    }
    if (T.ince) { cx.strokeStyle = T.inceRenk; cx.lineWidth = .7 / ro; for (const r of T.ince) { cx.beginPath(); cx.ellipse(0, 0, r, Math.max(1e-4, r * b), 0, 0, TAM); cx.stroke(); } }
    // gezegenin halkaya düşen gölgesi: güneşin ters yönünde, gezegen genişliğinde bir şerit, yalnız halka üstünde. Güneş
    // gezegenin arkasındaysa gölge bize doğru (ön yarıya), önündeyse arkaya (arka yarıya) düşer.
    if (T.halka && (on ? d.lz > 0 : d.lz <= 0)) {
      const r1 = T.halka[0][0], r2 = T.halka[T.halka.length - 1][1];
      cx.beginPath(); cx.moveTo(r2, 0); cx.ellipse(0, 0, r2, Math.max(1e-4, r2 * b), 0, 0, TAM); cx.moveTo(r1, 0); cx.ellipse(0, 0, r1, Math.max(1e-4, r1 * b), 0, 0, TAM);
      cx.clip("evenodd");
      const gx = Math.cos(d.lfi), gy = Math.sin(d.lfi), ux = -(gx * ECR + gy * ESR) * d.ls * 2.6, uy = -(-gx * ESR + gy * ECR) * d.ls * 2.6;
      const u = Math.hypot(ux, uy);
      if (u > .05) {
        const px = -uy / u, py = ux / u;
        cx.globalAlpha = a; cx.fillStyle = "rgba(3,5,9,.62)"; cx.beginPath();
        cx.moveTo(px, py); cx.lineTo(ux + px, uy + py); cx.lineTo(ux - px, uy - py); cx.lineTo(-px, -py); cx.closePath(); cx.fill();
      }
    }
    cx.restore();
  }
  function yildizCiz(d, ro, a, t) {
    const nefes = azHareket ? 1 : 1 + .025 * Math.sin(t / 1400 + d.i);
    birim(d.sx, d.sy, ro * (d === gunes ? 5.2 : 3.8) * nefes);
    cx.globalCompositeOperation = "lighter"; cx.globalAlpha = a * (.8 + d.atesle * .2);
    cx.fillStyle = d.yKorona; cx.fillRect(-1, -1, 2, 2);
    birim(d.sx, d.sy, ro);
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a;
    cx.fillStyle = d.yDisk; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM); cx.fill();
  }
  function kuyrukluCiz(d, ro, a) {
    // kuyruk hep güneşin tersine bakar; güneşe yaklaştıkça uzar ve parlar
    const r = Math.hypot(d.wx, d.wy, d.wz) || 1, L = Math.max(.1, Math.min(.8, .3 / r)), parlak = Math.min(1, .45 / r);
    izd(d.wx * (1 + L / r), d.wy * (1 + L / r), d.wz * (1 + L / r));
    sifirla();
    cx.globalCompositeOperation = "lighter"; cx.globalAlpha = a;
    if (PP > 0) {
      const tx = PX, ty = PY, dx = tx - d.sx, dy = ty - d.sy, uz = Math.hypot(dx, dy) || 1, nx = -dy / uz, ny = dx / uz;
      const w0 = ro * 1.4, w1 = ro * 2 + uz * .2;
      let g = cx.createLinearGradient(d.sx, d.sy, tx, ty);   // toz kuyruğu: geniş, yumuşak, alan renginde
      g.addColorStop(0, rgba(d.yRgb, (.42 * parlak).toFixed(3))); g.addColorStop(.4, rgba(d.yRgb, (.14 * parlak).toFixed(3))); g.addColorStop(1, rgba(d.yRgb, 0));
      cx.fillStyle = g; cx.beginPath();
      cx.moveTo(d.sx + nx * w0, d.sy + ny * w0);
      cx.quadraticCurveTo(d.sx + dx * .55 + nx * w1 * .75, d.sy + dy * .55 + ny * w1 * .75, tx + nx * w1, ty + ny * w1);
      cx.lineTo(tx - nx * w1, ty - ny * w1);
      cx.quadraticCurveTo(d.sx + dx * .55 - nx * w1 * .75, d.sy + dy * .55 - ny * w1 * .75, d.sx - nx * w0, d.sy - ny * w0);
      cx.closePath(); cx.fill();
      g = cx.createLinearGradient(d.sx, d.sy, d.sx + dx * 1.25, d.sy + dy * 1.25);   // iyon kuyruğu: ince, düz, mavimsi
      g.addColorStop(0, "rgba(170,205,255," + (.4 * parlak).toFixed(3) + ")"); g.addColorStop(1, "rgba(170,205,255,0)");
      cx.strokeStyle = g; cx.lineWidth = Math.max(.8, ro * .5);
      cx.beginPath(); cx.moveTo(d.sx, d.sy); cx.lineTo(d.sx + dx * 1.25, d.sy + dy * 1.25); cx.stroke();
    }
    birim(d.sx, d.sy, ro * 3.4); cx.globalAlpha = a * Math.min(1, .6 + .4 * parlak + d.atesle * .3);   // koma
    cx.fillStyle = d.yHale; cx.fillRect(-1, -1, 2, 2);
    birim(d.sx, d.sy, ro); cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a;      // çekirdek
    cx.fillStyle = d.yCekirdek; cx.beginPath(); cx.arc(0, 0, 1, 0, TAM); cx.fill();
  }
  function uyduCiz(s, a, t) {
    // küçük elmas gövde; yakınlaşınca iki yanında güneş paneli (uzakta çizgi parazit gibi duruyor, yalnız renkli nokta);
    // eski iş yumuşak kırmızı nabızla (sert yanıp sönme değil)
    const r = Math.max(1.1, Math.min(2.6, 1.15 * s.ps * Math.sqrt(yakin))), nabiz = s.eski && !azHareket ? .5 + .5 * Math.sin(t / 480 + s.faz) : 1;
    sifirla();
    if (s.eski) { birim(s.sx, s.sy, r * 4.2); cx.globalCompositeOperation = "lighter"; cx.globalAlpha = a * .55 * nabiz; cx.fillStyle = uyduHale; cx.fillRect(-1, -1, 2, 2); sifirla(); }
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a;
    if (r >= 1.7) {
      const pa = s.panel + (azHareket ? 0 : ySaat * .4), c = Math.cos(pa) * r * 2.6, sn = Math.sin(pa) * r * 2.6;
      cx.strokeStyle = "rgba(150,178,214,.9)"; cx.lineWidth = Math.max(.7, r * .55);
      cx.beginPath(); cx.moveTo(s.sx - c, s.sy - sn); cx.lineTo(s.sx + c, s.sy + sn); cx.stroke();
    }
    cx.fillStyle = rgba(s.renk, (s.eski ? .55 + .45 * nabiz : 1).toFixed(3));
    cx.beginPath(); cx.moveTo(s.sx, s.sy - r); cx.lineTo(s.sx + r, s.sy); cx.lineTo(s.sx, s.sy + r); cx.lineTo(s.sx - r, s.sy); cx.closePath(); cx.fill();
  }
  function yDarbeler(dt) {
    // nöral görünümdeki ışık akışının karşılığı: uzay aracı rotada yavaş süzülür, kuyruğu söner; rota o sırada soluk görünür
    cx.globalCompositeOperation = "lighter"; cx.globalAlpha = 1;
    for (let i = darbeler.length - 1; i >= 0; i--) {
      const p = darbeler[i];
      p.t += dt / p.sure;
      if (p.t >= 1) {
        darbeler.splice(i, 1);
        const varis = p.ters ? p.k.a : p.k.b;
        varis.atesle = Math.max(varis.atesle, .3);
        if (Math.random() < .15 && darbeler.length < 12) darbeBaslat(varis);
        continue;
      }
      if (!gorunur(p.k.a) || !gorunur(p.k.b)) { darbeler.splice(i, 1); continue; }
      const e = p.t < .5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;
      const r = rotaHazir(p.k.a, p.k.b), bas = p.ters ? 1 - e : e, L = Math.hypot(p.k.b.sx - p.k.a.sx, p.k.b.sy - p.k.a.sy) * 1.3 + 1;
      const kuy = Math.max(.05, Math.min(.3, 42 / L)), son = p.ters ? Math.min(1, bas + kuy) : Math.max(0, bas - kuy);
      const renk = (p.ters ? p.k.b : p.k.a).yRgb, A = Math.sin(Math.PI * p.t) * .75;
      cx.lineWidth = .6; cx.strokeStyle = rgba(renk, (.07 * A).toFixed(3));
      yolCiz(r, 20);
      // iz tek parça çizilir (parça parça çizince boncuk dizisi gibi duruyordu); kuyruktan başa doğrusal renk geçişi
      const iz = [];
      for (let j = 0; j <= 8; j++) { rotaNokta(r, son + (bas - son) * j / 8); izd(QX, QY, QZ); if (PP > 0) iz.push(PX, PY); }
      if (iz.length < 4) continue;
      const g = cx.createLinearGradient(iz[0], iz[1], iz[iz.length - 2], iz[iz.length - 1]);
      g.addColorStop(0, rgba(renk, 0)); g.addColorStop(1, rgba(renk, (A * .85).toFixed(3)));
      cx.strokeStyle = g; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(iz[0], iz[1]);
      for (let j = 2; j < iz.length; j += 2) cx.lineTo(iz[j], iz[j + 1]);
      cx.stroke();
    }
  }

  function yCiz(t, dt) {
    sifirla();
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = 1;
    cx.clearRect(0, 0, W, H);
    gokyuzuCiz(t);
    const odak = secili ? new Set([secili, ...secili.komsu]) : null;
    cx.lineCap = "round"; cx.lineJoin = "round";
    // yörüngeler: alan başına bir halka (lejantta seçilen alan parlar, adı halkanın önüne yazılır)
    let yEtiket = null;
    for (const o of yorungeler) {
      if (!o.gezegenler.some(gorunur)) continue;
      const vurgu = vurguAlan === o.alan;
      const alfa = vurguAlan ? (vurgu ? .55 : .06) : odak ? (secili.yo && secili.yo.yorunge === o ? .34 : .1) : .2;
      const on = egriCiz(96, (u) => egik(o.r * Math.cos(u * TAM), o.r * Math.sin(u * TAM), o.egim, o.dugum), o.rgb, alfa, vurgu ? 1.1 : .7);
      if (vurgu) yEtiket = [o, on];
    }
    for (const d of kuyrukluar) if (gorunur(d)) egriCiz(96, (u) => kuyrukluNokta(d.yo, u * TAM), d.yRgb, odak && !odak.has(d) ? .03 : vurguAlan && d.alan !== vurguAlan ? .02 : .07, .6);
    const ayA = Math.min(.16, (yakin - 1.5) * .12);   // ay yörüngeleri yalnız yakınlaşınca
    if (ayA > 0) for (const d of aylar) if (gorunur(d)) {
      const e = d.ebeveyn, o = d.yo;
      egriCiz(48, (u) => { egik(o.a * Math.cos(u * TAM), o.a * Math.sin(u * TAM), o.egim, o.dugum); QX += e.wx; QY += e.wy; QZ += e.wz; }, d.yRgb, ayA * (odak && !odak.has(d) ? .3 : 1), .6);
    }
    // seçilen gövdenin bağlantıları: güneşin çevresinde kıvrılan rotalar
    if (secili && gorunur(secili)) {
      cx.globalCompositeOperation = "lighter"; cx.lineWidth = .9; cx.strokeStyle = rgba(secili.yRgb, .3);
      // gezegen seçiliyken kendi kuşağındaki nöronlara rota çizilmez (kalabalık); nöron seçiliyse bütün bağları
      for (const n of secili.komsu) if (gorunur(n) && (secili.tur === "noron" || n.tur !== "noron" || n.ebeveyn !== secili)) yolCiz(rotaHazir(secili, n), 24);
    }
    yDarbeler(dt);
    // gövdeler: arkadan öne (yakın olan uzaktakinin önünde)
    const uyduA = Math.max(0, Math.min(1, zamanGun - (SON_GUN - 1.5)));   // açık işler "bugün"e ait: geçmişte görünmez
    // kuşak taşları (nöronlar): renk grubuyla toplu çizilir, gövdelerin arkasında (küçük noktalar; derinlik sırası gözle fark edilmez)
    const kTas = new Map();
    for (const d of kusak) {
      if (!d.ekranda || !gorunur(d) || d === secili || d.dalga > .04 || d.atesle > .05) continue;
      if (d.sx < -10 || d.sx > W + 10 || d.sy < -10 || d.sy > H + 10) continue;
      let a = Math.max(.5, Math.min(1, .85 - d.sz * .22));
      if (odak && !odak.has(d) && !odak.has(d.ebeveyn)) a *= .3;
      if (vurguAlan && d.alan !== vurguAlan) a *= .25;
      const dogal = zamanGun >= SON_GUN ? 1 : Math.max(0, Math.min(1, (zamanGun - d.yGun + 1) / 2.5));
      const ro = Math.max(.9, Math.min(6, d.yR * Yol * d.ps * (.3 + .7 * dogal)));
      d.ro = ro;
      const anah = d.yRgb.join(",") + "," + (Math.round(a * .55 * dogal * 20) / 20);
      let y = kTas.get(anah); if (!y) kTas.set(anah, (y = []));
      y.push(d.sx, d.sy, ro);
    }
    cx.globalCompositeOperation = "lighter";
    for (const [anah, y] of kTas) {
      cx.fillStyle = "rgba(" + anah + ")"; cx.beginPath();
      for (let i = 0; i < y.length; i += 3) { cx.moveTo(y[i] + y[i + 2], y[i + 1]); cx.arc(y[i], y[i + 1], y[i + 2], 0, TAM); }
      cx.fill();
    }
    cx.globalCompositeOperation = "source-over";
    const liste = D.filter((d) => d.ekranda && gorunur(d) && (d.tur !== "noron" || d === secili || d.dalga > .04 || d.atesle > .05));
    if (uyduA > 0) for (const s of uydular) if (s.ekranda && gorunur(s.e)) liste.push(s);
    liste.sort((a, b) => b.sz - a.sz);
    for (const d of liste) {
      const sahip = d.uydu ? d.e : d;
      let a = Math.max(.5, Math.min(1, .85 - d.sz * .22));
      if (odak && !odak.has(sahip)) a *= .3;
      if (vurguAlan && sahip.alan !== vurguAlan) a *= .25;
      if (d.uydu) { uyduCiz(d, a * uyduA, t); continue; }
      const dogal = d.tur === "yildiz" || zamanGun >= SON_GUN ? 1 : Math.max(0, Math.min(1, (zamanGun - d.yGun + 1) / 2.5));
      const ro = Math.max(d.tur === "noron" ? .9 : d.tur === "ay" ? 1.2 : 1.6, Math.min(90, d.yR * Yol * d.ps * (.3 + .7 * dogal) * (d === secili ? 1.6 : 1)));
      d.ro = ro;
      if (d.tur !== "kuyruklu" && (d.sx < -ro * 6 || d.sx > W + ro * 6 || d.sy < -ro * 6 || d.sy > H + ro * 6)) continue;
      if (d.tur === "noron") {   // kuşak taşı: düz, küçük, ışıyan nokta (doku yok); seçiliyse halkayla
        cx.globalCompositeOperation = "lighter"; cx.globalAlpha = a * (.55 + d.atesle * .45) * dogal;
        cx.fillStyle = rgba(d.yRgb, 1); cx.beginPath(); cx.arc(d.sx, d.sy, ro, 0, TAM); cx.fill();
        if (d === secili || d.dalga > .04) {
          cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a * Math.max(d === secili ? .8 : 0, d.dalga * .7);
          cx.strokeStyle = rgba(d.yRgb, 1); cx.lineWidth = 1; cx.beginPath(); cx.arc(d.sx, d.sy, ro + 4 + (1 - d.dalga) * 8, 0, TAM); cx.stroke();
          d.dalga *= .955;
        }
        cx.globalCompositeOperation = "source-over"; sifirla(); d.atesle *= .94;
        continue;
      }
      if (d.tur === "yildiz") yildizCiz(d, ro, a, t);
      else if (d.tur === "kuyruklu") kuyrukluCiz(d, ro, a);
      else gezegenCiz(d, ro, d.tur === "ay" ? a * .9 : a, t);
      sifirla();
      if (dogal < 1) {   // yeni doğan gövde toz diskinden toplanır
        const R = ro * (1.8 + 3 * (1 - dogal));
        cx.globalCompositeOperation = "lighter"; cx.globalAlpha = a * (1 - dogal) * .5; cx.strokeStyle = rgba(d.yRgb, 1); cx.lineWidth = 1;
        cx.beginPath(); cx.ellipse(d.sx, d.sy, R, R * Math.max(.15, Math.abs(Ysp)), 0, 0, TAM); cx.stroke();
      }
      // dalga halkası: yalnız dokunulan gövdede ve doğrudan komşularında
      if (d.dalga > .04) {
        cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a * d.dalga * .7; cx.strokeStyle = rgba(d.yRgb, 1); cx.lineWidth = 1.2;
        cx.beginPath(); cx.arc(d.sx, d.sy, ro * 1.3 + 4 + (1 - d.dalga) * (ro * 2.2 + 10), 0, TAM); cx.stroke();
        d.dalga *= .955;
      }
      d.atesle *= .94;
    }
    // etiketler: seçili + bağlantıları, yıldızlar, lejantta seçilen alan, yakınlaşınca öndekiler; üst üste binen çizilmez
    sifirla(); cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
    cx.textAlign = "center"; cx.textBaseline = "top";
    const kutular = [];
    if (yEtiket) {
      const [o, [x, y]] = yEtiket, ai = DOKU[ALAN_GEZEGEN[o.alan]];
      const s = (alanOf(o.alan).ad + (ai ? " · " + ai.ad : "")).toLocaleUpperCase("tr-TR");   // ör. KİTAPLAR · JÜPİTER
      cx.font = "500 10px " + VERI_YAZI;
      const gen = cx.measureText(s).width;
      cx.lineWidth = 4; cx.strokeStyle = "rgba(3,5,9,.85)"; cx.strokeText(s, x, y + 7);
      cx.fillStyle = rgba(o.rgb, .95); cx.fillText(s, x, y + 7);
      kutular.push([x - gen / 2 - 3, y + 5, x + gen / 2 + 3, y + 19]);
    }
    // ekran koruyucu turunda yalnız gezilen gövdenin adı (sinema sadeliği); seçili gibi kalın ve beyaz
    const turda = turGovde(), bas = secili || turda, aday = [];
    if (turda) aday.push(turda);
    else {
      if (secili) aday.push(secili, ...[...secili.komsu].sort((a, b) => b.derece - a.derece));
      if (gunes) aday.push(gunes);   // eş yıldızların adı güneşinkiyle çakışıyor: onlar yakınlaşınca ya da seçilince
      if (yakin > 1.35) aday.push(...esler);
      if (vurguAlan) aday.push(...liste.filter((d) => !d.uydu && d.tur !== "noron" && d.alan === vurguAlan).reverse());
      if (!odak && yakin > 1.35) aday.push(...liste.filter((d) => !d.uydu && d.tur !== "ay" && d.tur !== "noron").reverse());
      if (!odak && yakin > 4) aday.push(...liste.filter((d) => d.tur === "noron").reverse());
    }
    const cizildi = new Set();
    for (const d of aday) {
      if (cizildi.has(d) || !gorunur(d) || !d.ekranda) continue;
      const fs = d === bas ? 14 : 11.5;
      cx.font = (d === bas ? "600 " : "500 ") + fs + "px " + YAZI;
      const gen = cx.measureText(d.ad).width, y = d.sy + (d.ro || 6) + 5;
      if (d.sx + gen / 2 < 0 || d.sx - gen / 2 > W || y > H || y + fs < 0) continue;
      const kutu = [d.sx - gen / 2 - 3, y - 2, d.sx + gen / 2 + 3, y + fs + 2];
      if (d !== bas && kutular.some((k) => kutu[0] < k[2] && kutu[2] > k[0] && kutu[1] < k[3] && kutu[3] > k[1])) continue;
      kutular.push(kutu); cizildi.add(d);
      cx.lineWidth = 4; cx.strokeStyle = "rgba(3,5,9,.85)"; cx.strokeText(d.ad, d.sx, y);
      cx.fillStyle = d === bas ? "#FFFFFF" : "rgba(228,233,238,.86)"; cx.fillText(d.ad, d.sx, y);
    }
  }
  // izle: dokunulan gövdeye kamera uçar ve onu takip eder — ayrıntı sayfasının üstünde kalan alanın ortasında durur
  // (sayfa ekranın yarısını kaplıyor; gezegen altında kalmasın). "Yaklaş" ya da ikinci dokunuş: yakın plan (ayları, uyduları).
  let yakinPlan = false;
  const IZLE_YAKIN = () => (yakinPlan ? 3.2 : 1.7);
  function izle(d) {
    takip = d;
    hedef = { yaw, pitch: Math.min(-.3, pitch), yakin: IZLE_YAKIN() };
    yaklasYaz();
  }
  function yakinlas() { yakinPlan = !yakinPlan; if (secili) izle(secili); }
  function takipBitir() { if (takip) { takip = null; hedef = { yaw, pitch, yakin: 1 }; } yakinPlan = false; yaklasYaz(); }
  function yaklasYaz() { $("sYaklas").textContent = yakinPlan ? "Uzaklaş" : "Yaklaş"; }
  // görünür bant: lejantın altı ile alttaki zaman cetvelinin (sayfa açıkken sayfanın) üstü arası; sistem bunun ortasında.
  // Tam ekranda çubuklar yok: bant künyenin üst payından (iPhone'da çentik) en alta. offsetTop: çekilme kaymasını saymaz.
  let bantUst = 104, bantAlt = 734, bantKirli = true;
  addEventListener("resize", () => { bantKirli = true; });
  function bantOlc() {
    bantUst = tamKip ? parseFloat(getComputedStyle(document.querySelector(".kunye")).paddingTop) : $("lejant").offsetTop + $("lejant").offsetHeight + 6;
    bantAlt = H - (secili ? $("sayfa").offsetHeight : tamKip ? 0 : document.querySelector(".alt").offsetHeight);
    bantKirli = false;
  }

  // ---------- döngü ----------
  let onceki = performance.now(), sonDarbe = 0, yavas = 0, ortDt = 16;
  function kare(t) {
    const dt = Math.min(64, t - onceki); onceki = t;
    // yavaş cihaz koruması: kare süresinin kayan ortalaması ~3 sn boyunca 30 ms'yi aşarsa önce çözünürlük tavanı 3x → 2x,
    // yörüngede yine yavaşsa dokular yalnız yakın planda. (Tek tek kareye bakan eski sayaç, kareler düzensiz gelince — biri
    // hızlı biri yavaş — hiç dolmuyordu; 30 Eki.)
    ortDt = ortDt * .96 + dt * .04;
    yavas = ortDt > 30 ? yavas + 1 : 0;
    if (yavas > 90) {
      yavas = 0;
      if (DPR_TAVAN > 2) { DPR_TAVAN = 2; boyutla(); } else if (gorunum === "yorunge" && dokuEsik < 7) dokuEsik = 7;
    }
    turAdim(t);
    if (hedef) {
      yaw += (hedef.yaw - yaw) * .12; pitch += (hedef.pitch - pitch) * .12; yakin += (hedef.yakin - yakin) * .1;
      if (Math.abs(hedef.yaw - yaw) < .002 && Math.abs(hedef.pitch - pitch) < .002 && Math.abs(hedef.yakin - yakin) < .004) hedef = null;
    } else if (!azHareket && t - sonDokunus > 2500 && !secili) {
      // turda nöral kamera dönmez (beynin merkezi çevresinde döner, gezilen nöron kenara kayardı): ağır ağır yaklaşır
      if (gorunum === "noral" && turGovde()) yakin = Math.min(yakinTavan(), yakin + dt * .00003);
      else yaw += dt * (gorunum === "yorunge" ? .00004 : .00009);   // yörüngede gezegenler zaten dönüyor: kamera daha ağır
    }
    if (oynuyor) {
      zamanGun = Math.min(SON_GUN, zamanGun + dt / 160);
      $("gun").value = Math.floor(zamanGun); gunYaz();
      if (zamanGun >= SON_GUN) { oynuyor = false; $("dOyna").textContent = "▶"; }
    }
    if (!azHareket && t - sonDarbe > 520) { sonDarbe = t; if (darbeler.length < 12) rastgeleDarbe(); }
    if (gorunum === "yorunge") { yIzdus(dt); yCiz(t, dt); } else { izdus(); ciz(t, dt); }
    rafNo = document.hidden ? 0 : requestAnimationFrame(kare);
  }
  let rafNo = 0;
  function dongu() { cancelAnimationFrame(rafNo); rafNo = requestAnimationFrame((t) => { onceki = t; kare(t); }); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) dongu(); });

  // ---------- zaman yolculuğu ----------
  $("gun").max = SON_GUN; $("gun").value = SON_GUN;
  function gunYaz() {
    const g = Math.floor(zamanGun), t = new Date(Date.parse(ist.baslangic + "T00:00:00") + g * 864e5);
    const yo = gorunum === "yorunge", dogan = D.filter((d) => (yo ? d.yGun : d.gun) <= g);
    const nsay = dogan.filter((d) => d.katman === "noron").length;   // v4: "nöron" = kural/ders/olgu kartı; sayfalar ayrı sayılır
    $("gunYazi").textContent = t.getDate() + " " + AYLAR[t.getMonth()] + " · " + (yo ? dogan.length + " gök cismi"
      : NORONLU ? nsay + " nöron · " + (dogan.length - nsay) + " sayfa" : dogan.length + " nöron");
  }
  gunYaz();
  $("gun").addEventListener("input", (e) => { oynuyor = false; $("dOyna").textContent = "▶"; zamanGun = +e.target.value; gunYaz(); });
  $("dOyna").addEventListener("click", () => {
    if (oynuyor) { oynuyor = false; $("dOyna").textContent = "▶"; return; }
    if (zamanGun >= SON_GUN) zamanGun = 0;
    oynuyor = true; $("dOyna").textContent = "❚❚"; sonDokunus = performance.now();
  });

  // ---------- dokunma ----------
  const imlecler = new Map();
  let suruk = null, kistir = null;
  tv.addEventListener("pointerdown", (e) => {
    tv.setPointerCapture(e.pointerId);
    imlecler.set(e.pointerId, { x: e.clientX, y: e.clientY });
    sonDokunus = performance.now(); hedef = null;
    if (imlecler.size === 1) suruk = { x: e.clientX, y: e.clientY, yaw, pitch, t: performance.now(), oynadi: 0 };
    if (imlecler.size === 2) { const [a, b] = [...imlecler.values()]; kistir = { d: Math.hypot(a.x - b.x, a.y - b.y), yakin }; suruk = null; }
  });
  tv.addEventListener("pointermove", (e) => {
    if (!imlecler.has(e.pointerId)) return;
    imlecler.set(e.pointerId, { x: e.clientX, y: e.clientY });
    sonDokunus = performance.now();
    if (kistir && imlecler.size === 2) {
      const [a, b] = [...imlecler.values()];
      yakin = Math.max(.6, Math.min(yakinTavan(), kistir.yakin * Math.hypot(a.x - b.x, a.y - b.y) / kistir.d));
    } else if (suruk) {
      const dx = e.clientX - suruk.x, dy = e.clientY - suruk.y;
      suruk.oynadi = Math.max(suruk.oynadi, Math.hypot(dx, dy));
      // "tut ve sürükle": parmak sağa → ön yüz sağa, yukarı → yukarı (29 Eki: önceki işaretler ters çalışıyordu)
      const [ea, eu] = egimSinir();
      yaw = suruk.yaw - dx * .006; pitch = Math.max(ea, Math.min(eu, suruk.pitch - dy * .006));
    }
  });
  const birak = (e) => {
    if (suruk && imlecler.size === 1 && suruk.oynadi < 8 && performance.now() - suruk.t < 450) dokun(e.clientX, e.clientY);
    imlecler.delete(e.pointerId);
    if (imlecler.size < 2) kistir = null;
    if (!imlecler.size) suruk = null;
  };
  tv.addEventListener("pointerup", birak); tv.addEventListener("pointercancel", birak);
  tv.addEventListener("wheel", (e) => { e.preventDefault(); yakin = Math.max(.6, Math.min(yakinTavan(), yakin * (e.deltaY < 0 ? 1.08 : .93))); sonDokunus = performance.now(); }, { passive: false });
  let sonTik = 0;
  function dokun(x, y) {
    const yo = gorunum === "yorunge";
    let en = null, enM = Infinity;
    for (const d of D) {
      if (!gorunur(d) || (yo && !d.ekranda)) continue;
      const m = Math.hypot(d.sx - x, d.sy - y), sinir = yo ? Math.max(20, d.ro * 1.6) : Math.max(22, d.yaricap * d.ps * yakin * 1.3);
      if (m < sinir && m - (d.sz < 0 ? 6 : 0) < enM) { en = d; enM = m; }
    }
    const simdi = performance.now();
    if (!en && simdi - sonTik < 350) { hedef = { yaw, pitch: KAMERA[gorunum].pitch, yakin: 1 }; takip = null; sec(null); }
    sonTik = simdi;
    if (en) {
      // yörüngede: seçili gövdeye yeniden dokunmak (ya da izlerken başka gövdeye dokunmak) = yaklaş ve izle
      // yörüngede: dokunulan gövdeye kamera uçar; seçili gövdeye yeniden dokunmak = yakın plan aç/kapa
      if (yo && en === secili) yakinlas();
      else { sec(en); atesle(en); if (yo) izle(en); }
    } else if (secili) sec(null);
  }
  function odakla(d) { if (gorunum === "yorunge") izle(d); else noralOdakla(d); }
  function noralOdakla(d) {
    const [x, y, z] = d.konum, ro = Math.hypot(x, z) || 1e-6;
    let hy = Math.atan2(x, -z);
    while (hy - yaw > Math.PI) hy -= Math.PI * 2;
    while (hy - yaw < -Math.PI) hy += Math.PI * 2;
    hedef = { yaw: hy, pitch: Math.max(-1.2, Math.min(1.2, Math.atan2(-y, ro))), yakin: Math.max(yakin, 1.25) };
  }

  // ---------- ayrıntı sayfası ----------
  function sec(d) {
    secili = d;
    if (!d) { $("sayfa").classList.add("kapali"); takipBitir(); bantKirli = true; return; }
    const a = alanOf(d.alan), yo = gorunum === "yorunge";
    $("sBaslik").textContent = d.baslik;
    $("sEtiket").innerHTML = "";
    for (const t of [a.ad, yo ? turAd(d) : KATMAN_AD[d.katman], d.yol]) { const s = document.createElement("span"); s.className = "etiket"; s.textContent = t; $("sEtiket").appendChild(s); }
    $("sEtiket").firstChild.style.borderColor = a.renk;
    $("sOlcu").innerHTML = "";
    for (const [b, s] of [[d.satir, "satır"], [binlik(d.karakter), "karakter"], [d.derece, yo ? "bağlantı" : "sinaps"], [kisaTarih(d.guncelleme), "güncel"]]) {
      const k = document.createElement("div"); k.innerHTML = "<b></b><span></span>"; k.firstChild.textContent = b; k.lastChild.textContent = s; $("sOlcu").appendChild(k);
    }
    $("sKomsu").innerHTML = "";
    [...d.komsu].sort((x, y) => y.derece - x.derece).slice(0, 12).forEach((k) => {
      const b = document.createElement("button");
      b.append(nokta(alanOf(k.alan).renk), document.createTextNode(k.ad));
      b.addEventListener("click", () => { sec(k); atesle(k); odakla(k); });
      $("sKomsu").appendChild(b);
    });
    // yörüngede: sayfanın yapay uyduları = açık işleri (renk uydununki: öncelikli altın, 21 günü geçen kırmızı)
    const isler = yo ? V.gorevler.filter((x) => x.sayfa === d.id && x.durum !== "askida") : [];
    $("sIs").innerHTML = ""; $("sIs").hidden = !isler.length;
    if (isler.length) {
      const h = document.createElement("p"); h.className = "grup"; h.textContent = "Uydular · açık işler " + isler.length; $("sIs").appendChild(h);
      for (const x of isler) {
        const b = document.createElement("button"), eski = x.yas > 21;
        b.innerHTML = "<i></i><b></b><span></span>";
        b.querySelector("i").style.background = eski ? "#FF705C" : x.oncelik ? "var(--vurgu)" : "#D6E2EE";
        b.querySelector("b").textContent = x.no; b.querySelector("span").textContent = x.baslik.replace(/`/g, "");
        if (eski) { const e = document.createElement("em"); e.textContent = "⚠ " + x.yas + " gün"; b.appendChild(e); }
        b.addEventListener("click", () => isAc(x));
        $("sIs").appendChild(b);
      }
    }
    $("sYaklas").hidden = !yo; yaklasYaz();
    $("sayfa").classList.remove("kapali");
    bantKirli = true;
  }
  $("sKapat").addEventListener("click", () => sec(null));
  $("sYaklas").addEventListener("click", yakinlas);
  $("sOku").addEventListener("click", () => secili && oku(secili.id));

  // ---------- güvenli markdown ----------
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function satirIci(s) {
    return s.split(/(`[^`]*`)/).map((p) => {
      if (p.length >= 2 && p[0] === "`" && p[p.length - 1] === "`") return "<code>" + esc(p.slice(1, -1)) + "</code>";
      let t = esc(p);
      t = t.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (m, ad, bas, takma) =>
        '<a href="#" data-git="' + ad.trim() + '"' + (bas ? ' data-bas="' + bas.trim() + '"' : "") + ">" + (takma || ad).trim() + "</a>");
      t = t.replace(/\*\*([^*<>"]+)\*\*/g, "<strong>$1</strong>");   // etiket/öznitelik sınırını aşmaz
      t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      t = t.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      return t;
    }).join("");
  }
  const LISTE = /^\s*([-*•]|\d+\.)\s+/;
  function mdHTML(metin) {
    const L = metin.split("\n"), h = [];
    let i = 0;
    while (i < L.length) {
      const s = L[i];
      if (/^\s*<!--.*-->\s*$/.test(s) || !s.trim()) { i++; continue; }
      if (/^\s*```/.test(s)) {
        let j = i + 1; const buf = [];
        while (j < L.length && !/^\s*```/.test(L[j])) buf.push(L[j++]);
        h.push('<pre data-s="' + (i + 1) + '"><code>' + esc(buf.join("\n")) + "</code></pre>"); i = j + 1; continue;
      }
      const m = s.match(/^(#{1,6})\s+(.*)$/);
      if (m) { const n = Math.min(m[1].length + 1, 5); h.push("<h" + n + ' data-s="' + (i + 1) + '">' + satirIci(m[2]) + "</h" + n + ">"); i++; continue; }
      if (/^\s*---\s*$/.test(s)) { h.push("<hr>"); i++; continue; }
      if (/^\s*\|/.test(s)) {
        const satirlar = []; let j = i;
        while (j < L.length && /^\s*\|/.test(L[j])) satirlar.push(L[j++]);
        const ayrac = (r) => /^[\s|:-]+$/.test(r);
        const hucre = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        let t = '<div class="tablo" data-s="' + (i + 1) + '"><table>';
        satirlar.forEach((r, k) => {
          if (ayrac(r)) return;
          const tag = k === 0 && satirlar[1] && ayrac(satirlar[1]) ? "th" : "td";
          t += "<tr>" + hucre(r).map((c) => "<" + tag + ">" + satirIci(c) + "</" + tag + ">").join("") + "</tr>";
        });
        h.push(t + "</table></div>"); i = j; continue;
      }
      if (/^\s*>/.test(s)) {
        const buf = []; let j = i;
        while (j < L.length && /^\s*>/.test(L[j])) buf.push(L[j++].replace(/^\s*>\s?/, ""));
        h.push('<blockquote data-s="' + (i + 1) + '">' + satirIci(buf.join(" ")) + "</blockquote>"); i = j; continue;
      }
      if (LISTE.test(s)) {
        const ogeler = [], sirali = /^\s*\d+\./.test(s); let j = i;
        while (j < L.length && (LISTE.test(L[j]) || (/^\s{2,}\S/.test(L[j]) && ogeler.length))) {
          if (LISTE.test(L[j])) ogeler.push({ g: L[j].match(/^\s*/)[0].length, t: L[j].replace(LISTE, ""), s: j + 1 });
          else ogeler[ogeler.length - 1].t += " " + L[j].trim();
          j++;
        }
        const etk = sirali ? "ol" : "ul";
        h.push("<" + etk + ' data-s="' + (i + 1) + '">' + ogeler.map((o) => '<li data-s="' + o.s + '"' + (o.g >= 2 ? ' class="ic2"' : "") + ">" + satirIci(o.t) + "</li>").join("") + "</" + etk + ">");
        i = j; continue;
      }
      const buf = [s]; let j = i + 1;
      while (j < L.length && L[j].trim() && !/^\s*(#{1,6}\s|```|\||>|---\s*$)/.test(L[j]) && !LISTE.test(L[j])) buf.push(L[j++]);
      h.push('<p data-s="' + (i + 1) + '">' + satirIci(buf.join(" ")) + "</p>"); i = j;
    }
    return h.join("\n");
  }

  // ---------- katmanlar ----------
  const yigin = [];
  // açılan katman en üste: hepsi aynı z-index'teydi, aramadan ya da işlerden açılan okuyucu altta kalıyordu (30 Eki)
  // erişilebilirlik: katman açılınca odak içine (geri düğmesine) gider, kapanınca açan düğmeye döner
  const odakGeri = [];
  function katmanAc(id) {
    const ilk = $(id).hidden;
    $(id).hidden = false; if (yigin[yigin.length - 1] !== id) yigin.push(id); $(id).style.zIndex = 6 + yigin.length;
    if (ilk) { odakGeri.push(document.activeElement); const g = $(id).querySelector("header button"); if (g && id !== "katAra") g.focus({ preventScroll: true }); }
  }
  function katmanKapat() {
    const id = yigin.pop(); if (!id) return;
    $(id).hidden = true;
    const o = odakGeri.pop(); if (o && o.focus && document.contains(o)) o.focus({ preventScroll: true });
  }
  for (const id of ["okuGeri", "araGeri", "isGeri"]) $(id).addEventListener("click", katmanKapat);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (yigin.length) katmanKapat(); else if (!secili && tamKip) tamDegistir(); else sec(null); return; }
    const yaziyor = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || e.ctrlKey || e.metaKey || e.altKey;
    if (yaziyor || yigin.length) return;
    // klavyeyle gezinme: / ara · oklar döndür · + − yakınlaştır
    const [ea, eu] = egimSinir();
    const adim = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[e.key];
    if (e.key === "/") { e.preventDefault(); $("dAra").click(); }
    else if (adim) { e.preventDefault(); hedef = null; yaw += adim[0]; pitch = Math.max(ea, Math.min(eu, pitch + adim[1])); sonDokunus = performance.now(); }
    else if (e.key === "+" || e.key === "=") { yakin = Math.min(yakinTavan(), yakin * 1.12); sonDokunus = performance.now(); }
    else if (e.key === "-" || e.key === "_") { yakin = Math.max(.6, yakin / 1.12); sonDokunus = performance.now(); }
  });

  let okunan = null;
  function oku(id, satir, sorgu) {
    const d = ID[id];
    if (!d) return;
    okunan = d;
    $("okuBaslik").textContent = d.baslik;
    $("okuIcerik").innerHTML = mdHTML(d.metin);
    $("okuBolum").innerHTML = "";
    for (const [s, sev, t] of d.bolumler) {
      if (sev < 2) continue;
      const b = document.createElement("button");
      b.textContent = (sev === 3 ? "· " : "") + t.replace(/\*\*/g, "").replace(/`/g, "");
      b.addEventListener("click", () => satiraGit(s));
      $("okuBolum").appendChild(b);
    }
    $("okuBolum").hidden = !$("okuBolum").children.length;
    katmanAc("katOku");
    $("okuGovde").scrollTop = 0;
    if (satir) setTimeout(() => satiraGit(satir, sorgu), 30);
  }
  function satiraGit(satir, sorgu) {
    let en = null;
    for (const el of $("okuIcerik").querySelectorAll("[data-s]")) { if (+el.dataset.s <= satir) en = el; else break; }
    if (!en) return;
    en.scrollIntoView({ block: "center", behavior: "instant" });
    en.classList.remove("parla"); void en.offsetWidth; en.classList.add("parla");
    if (sorgu) isaretle(en, sorgu);
  }
  $("okuIcerik").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-git]");
    if (!a) return;
    e.preventDefault();
    const hedefD = ID[a.dataset.git];
    if (!hedefD) return;
    let s = 0;
    if (a.dataset.bas) { const k = katla(a.dataset.bas); const b = hedefD.bolumler.find(([, , t]) => katla(t).startsWith(k) || katla(t).includes(k)); if (b) s = b[0]; }
    katmanKapat(); oku(hedefD.id, s);
  });
  $("okuGoster").addEventListener("click", () => {
    if (!okunan) return;
    while (yigin.length) katmanKapat();
    zamanGun = SON_GUN; $("gun").value = SON_GUN; gunYaz();
    sec(okunan); atesle(okunan); odakla(okunan);
  });

  // ---------- arama (Türkçe harf duyarsız) ----------
  const KAT = { "İ": "i", "I": "i", "ı": "i", "Ş": "s", "ş": "s", "Ğ": "g", "ğ": "g", "Ü": "u", "ü": "u", "Ö": "o", "ö": "o", "Ç": "c", "ç": "c", "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u" };
  function katla(s) { let o = ""; for (let i = 0; i < s.length; i++) { const c = s[i]; o += KAT[c] || c.toLowerCase().charAt(0) || c; } return o; }
  let dizin = null;
  function dizinKur() {
    dizin = D.map((d) => {
      const satirlar = d.metin.split("\n"), bol = [];
      let son = "";
      const bas = new Map(d.bolumler.map(([s, , t]) => [s, t]));
      satirlar.forEach((_, i) => { if (bas.has(i + 1)) son = bas.get(i + 1); bol.push(son); });
      return { d, satirlar, katli: satirlar.map(katla), bol };
    });
  }
  function isaretle(el, sorgu) {
    const q = katla(sorgu);
    const yuru = (n) => {
      if (n.nodeType === 3) {
        const k = katla(n.nodeValue), i = k.indexOf(q);
        if (i < 0) return;
        const m = document.createElement("mark"), sonra = n.splitText(i);
        sonra.splitText(q.length); m.textContent = sonra.nodeValue; sonra.replaceWith(m);
      } else if (n.nodeType === 1 && n.tagName !== "MARK") [...n.childNodes].forEach(yuru);
    };
    yuru(el);
  }
  function parca(ham, q) {
    const s = ham.replace(/\*\*|`/g, ""), k = katla(s);
    let i = k.indexOf(q), n = q.length;
    if (i < 0) { const w = q.split(/\s+/)[0]; i = Math.max(0, k.indexOf(w)); n = w.length; }
    const bas = Math.max(0, i - 50), son = Math.min(s.length, i + n + 70);
    return (bas ? "…" : "") + esc(s.slice(bas, i)) + "<mark>" + esc(s.slice(i, i + n)) + "</mark>" + esc(s.slice(i + n, son)) + (son < s.length ? "…" : "");
  }
  const ARA_BILGI = NORONLU ? "Nöronlar, konu sayfaları ve arşiv birlikte aranır." : "Bütün notlar ve arşiv birlikte aranır.";
  $("araBilgi").textContent = ARA_BILGI;
  const eslesir = (k, q, kelimeler) => k.includes(q) || (kelimeler.length > 1 && kelimeler.every((w) => k.includes(w)));
  let araZaman = 0;
  $("araKutu").addEventListener("input", () => { clearTimeout(araZaman); araZaman = setTimeout(ara, 180); });
  function ara() {
    const ham = $("araKutu").value.trim(), q = katla(ham);
    const kutu = $("araSonuc");
    kutu.innerHTML = "";
    if (q.length < 2) { $("araBilgi").textContent = ARA_BILGI; return; }
    if (!dizin) dizinKur();
    let toplam = 0, dosya = 0;
    const SIRA = { cekirdek: 0, noron: 1, canli: 2, arsiv: 3 };
    const sirali = [...dizin].sort((a, b) => (SIRA[a.d.katman] ?? 4) - (SIRA[b.d.katman] ?? 4));
    const kelimeler = q.split(/\s+/).filter(Boolean);
    for (const x of sirali) {
      const isabet = [];
      x.katli.forEach((k, i) => { if (eslesir(k, q, kelimeler)) isabet.push(i); });
      if (!isabet.length) continue;
      toplam += isabet.length; dosya++;
      for (const i of isabet.slice(0, x.d.katman === "arsiv" ? 2 : 3)) {
        const b = document.createElement("button");
        b.className = "sonuc";
        b.innerHTML = '<div class="ust"><b></b><span></span></div><div class="parca">' + parca(x.satirlar[i], q) + "</div>";
        b.querySelector(".ust").prepend(nokta(alanOf(x.d.alan).renk));
        b.querySelector("b").textContent = x.d.ad;
        b.querySelector("span").textContent = x.bol[i] ? "§ " + x.bol[i].replace(/\*\*/g, "") : "";
        b.addEventListener("click", () => oku(x.d.id, i + 1, ham));
        kutu.appendChild(b);
      }
      if (isabet.length > 3) { const p = document.createElement("p"); p.className = "bilgi"; p.textContent = "+" + (isabet.length - 3) + " eşleşme daha bu sayfada"; kutu.appendChild(p); }
    }
    $("araBilgi").textContent = toplam ? toplam + " eşleşme · " + dosya + " sayfa" : "Eşleşme yok.";
  }
  $("dAra").addEventListener("click", () => { katmanAc("katAra"); setTimeout(() => $("araKutu").focus(), 50); });

  // ---------- açık işler ----------
  // iş durumları: [anahtar, görünen ad]; veri kendi adlarını verebilir (V.durumlar). "oncelik" bayrağı ayrı grup olur.
  const DURUM = V.durumlar || [["oncelik", "Öncelikli"], ["bende", "Bende"], ["sende", "Sende"], ["dista", "Dışarıdan bekleniyor"], ["askida", "Askıda"]];
  function islerKur() {
    const g = $("isGovde");
    g.innerHTML = "";
    for (const [k, ad] of DURUM) {
      const liste = V.gorevler.filter((x) => (k === "oncelik" ? x.oncelik && x.durum !== "askida" : x.durum === k && !(x.oncelik && k !== "askida")));
      if (!liste.length) continue;
      const h = document.createElement("p"); h.className = "grup"; h.textContent = ad + " · " + liste.length; g.appendChild(h);
      for (const x of liste) {
        const b = document.createElement("button");
        b.className = "is " + x.durum;
        b.innerHTML = '<div class="bas"><b></b><span></span></div>' + (x.ozet ? '<div class="oz"></div>' : "") + '<div class="meta"></div>';
        b.querySelector(".bas b").textContent = x.no;
        b.querySelector(".bas span").textContent = x.baslik.replace(/`/g, "");
        if (x.ozet) b.querySelector(".oz").textContent = x.ozet.replace(/\*\*|`/g, "");
        const meta = b.querySelector(".meta");
        meta.textContent = (x.son ? "son dokunuş " + kisaTarih(x.son) : "") + (x.sayfa ? " · " + x.sayfa : "");
        if (x.yas > 21 && x.durum !== "askida") { const e = document.createElement("span"); e.className = "eski"; e.textContent = " · ⚠ " + x.yas + " gün"; meta.appendChild(e); }
        b.addEventListener("click", () => isAc(x));
        g.appendChild(b);
      }
    }
    const h = document.createElement("p"); h.className = "grup"; h.textContent = "Son bitenler"; g.appendChild(h);
    for (const x of V.bitenler) {
      const b = document.createElement("button");
      b.className = "is"; b.innerHTML = '<div class="oz"></div>';
      b.querySelector(".oz").textContent = x.metin;
      if (x.sayfa && ID[x.sayfa]) b.addEventListener("click", () => oku(x.sayfa));
      g.appendChild(b);
    }
  }
  function isAc(x) {   // işi iş listesi sayfasındaki kendi bölümünde aç; o sayfa yoksa işin bağlı olduğu sayfayı
    const il = ID[AYAR.isListesi || "is-listesi"];
    const bas = il && il.bolumler.find(([, , t]) => t.startsWith(x.no + " ·"));
    if (il) oku(il.id, bas ? bas[0] : 1);
    else if (ID[x.sayfa]) oku(x.sayfa);
  }
  $("dIs").addEventListener("click", () => { islerKur(); katmanAc("katIs"); });

  // ---------- görünüm seçimi: Beyin ↔ Yörünge ----------
  // düğme gidilecek görünümün simgesini taşır; seçim bu tarayıcıda hatırlanır (depolama kapalıysa nöral açılır)
  const SIMGE = {
    yorunge: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="12" cy="12" rx="10.2" ry="4.3" transform="rotate(-22 12 12)"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/><circle cx="20" cy="7.7" r="1.8" fill="currentColor" stroke="none"/></svg>',
    noral: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5.5 16.5 11.5 6.5 18.5 14Z M11.5 6.5 19.5 4.5"/><circle cx="5.5" cy="16.5" r="2.4" fill="currentColor" stroke="none"/><circle cx="11.5" cy="6.5" r="2.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="14" r="2.2" fill="currentColor" stroke="none"/><circle cx="19.5" cy="4.5" r="1.5" fill="currentColor" stroke="none"/></svg>',
  };
  function gorunumSec(g) {
    kamera[gorunum] = { yaw, pitch, yakin };
    gorunum = g;
    ({ yaw, pitch, yakin } = kamera[g]);
    hedef = null; takip = null; yakinPlan = false; darbeler.length = 0;
    const yo = g === "yorunge";
    document.body.classList.toggle("yorunge", yo);
    $("dGorunum").innerHTML = SIMGE[yo ? "noral" : "yorunge"];
    $("dGorunum").setAttribute("aria-label", yo ? "Nöral görünüme geç" : "Yörünge görünümüne geç");
    tv.setAttribute("aria-label", yo ? "Hafızanın güneş sistemi: dokun, sürükle, iki parmakla yakınlaştır; seçili gezegene yeniden dokun: yaklaş"
      : "Hafızanın 3B nöron haritası: dokun, sürükle, iki parmakla yakınlaştır");
    $("altyazi").textContent = yo ? YORUNGE_ALTYAZI : NORAL_ALTYAZI;
    $("okuGoster").textContent = yo ? "Yörüngede" : "Beyinde";
    gunYaz();
    if (secili) sec(secili);
    try { localStorage.setItem("canli-beyin-gorunum", g); } catch (e) { /* depolama kapalı olabilir */ }
  }
  $("dGorunum").addEventListener("click", () => {
    const yeni = gorunum === "yorunge" ? "noral" : "yorunge";
    if (azHareket) { gorunumSec(yeni); return; }
    tv.style.opacity = "0";   // kısa geçiş: tuval söner, görünüm değişir, yeniden belirir
    setTimeout(() => { gorunumSec(yeni); tv.style.opacity = ""; }, 200);
  });

  // ---------- tam ekran ----------
  // Düğme çubukları çeker (CSS body.tam); tarayıcı izin veriyorsa gerçek tam ekranı da açar. iPhone'da tarayıcılar sayfayı
  // tam ekrana almıyor (Apple yalnız videoya izin veriyor): orada yalnız çubuklar çekilir, tarayıcının/uygulamanın çubuğu kalır.
  const TAM_SIMGE = {
    ac: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5V4h5.5M14.5 4H20v5.5M20 14.5V20h-5.5M9.5 20H4v-5.5"/></svg>',
    kapa: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4v5.5H4M14.5 4v5.5H20M20 14.5h-5.5V20M4 14.5h5.5V20"/></svg>',
  };
  let tamKip = false, tur = null, uyanik = null;
  const tamOge = () => document.fullscreenElement || document.webkitFullscreenElement;
  function tamYaz(acik) {
    const b = $("dTam"), once = b.getBoundingClientRect().top;
    tamKip = acik;
    document.body.classList.toggle("tam", acik);
    if (acik) { sonDokunus = performance.now(); uyanikTut(); }   // tur, girişten 4 sn sonra başlar
    else {
      if (tur && tur.d && !secili) { takip = null; yakinPlan = false; hedef = { yaw, pitch: KAMERA[gorunum].pitch, yakin: 1 }; }   // turdan genel görünüme
      tur = null; turYazi(null);
      if (uyanik && uyanik.release) uyanik.release();
      uyanik = null;
    }
    b.innerHTML = TAM_SIMGE[acik ? "kapa" : "ac"];
    b.setAttribute("aria-label", acik ? "Tam ekrandan çık" : "Tam ekran");
    // düğme cetvelin üstünden köşeye kayarak iner, çıkarken geri kalkar
    const fark = once - b.getBoundingClientRect().top;
    if (fark && !azHareket) b.animate([{ transform: "translateY(" + fark + "px)" }, { transform: "none" }], { duration: 280, easing: "ease" });
    bantKirli = true;
  }
  function tamDegistir() {
    const el = document.documentElement;
    tamYaz(!tamKip);
    try {
      let s = null;
      if (tamKip && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) s = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen();
      else if (!tamKip && tamOge()) s = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
      if (s && s.catch) s.catch(() => {});   // çerçeve reddederse çubuksuz görünüm yine de kalır
    } catch (e) { /* aynı: tarayıcı reddetti */ }
  }
  $("dTam").addEventListener("click", tamDegistir);
  // tarayıcının kendi çıkışı (Esc, Android geri hareketi) çubukları da geri getirir
  const tamCikti = () => { if (tamKip && !tamOge()) tamYaz(false); };
  document.addEventListener("fullscreenchange", tamCikti);
  document.addEventListener("webkitfullscreenchange", tamCikti);

  // ---------- ekran koruyucu turu (30 Eki) ----------
  // Tam ekranda 4 sn dokunulmazsa kamera gövdeden gövdeye süzülür: karışık sıra, durak başına ~9 sn, her çekim başka açı
  // ve boyda; sol altta adı, alanı ve ölçüleri. Dokunmak turu durdurur (kamera olduğu yerde kalır), 4 sn sonra sıradakiyle
  // sürer; tam ekrandan çıkınca genel görünüme dönülür. Az hareket ayarında tur yok.
  const TUR_BEKLE = 4000, TUR_DURAK = 9000;
  function turGovde() { return !secili && tur && tur.akar ? tur.d : null; }
  function turAdim(t) {
    if (!tamKip || azHareket) return;
    if (!tur) tur = { sira: [], d: null, son: 0, akar: false };
    if (secili || yigin.length || t - sonDokunus < TUR_BEKLE) { if (tur.akar) { tur.akar = false; turYazi(null); } return; }
    if (!tur.akar) { tur.akar = true; tur.son = -Infinity; }
    if (t - tur.son > TUR_DURAK) { tur.son = t; turDurak(); }
  }
  function turDurak() {
    let d = tur.sira.pop();
    while (d && !gorunur(d)) d = tur.sira.pop();   // zaman cetveli geri alındıysa henüz doğmamış olanlar atlanır
    if (!d) {   // hepsi gezildi: yeniden karılır (az önceki başa gelmez)
      const s = D.filter((x) => gorunur(x) && x !== tur.d && x.katman !== "noron");   // turda nöronlar değil sayfalar gezilir
      for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
      tur.sira = s; d = s.pop();
      if (!d) return;
    }
    tur.d = d;
    if (gorunum === "yorunge") {
      // çekim boyu: gövde ekranda 18-34 px yarıçap — kimi durak yakın plan, kimi yörüngesiyle birlikte
      const taban = Math.min(W * .45, H * .36) / 1.85;
      takip = d; yakinPlan = false;
      hedef = { yaw: yaw + (Math.random() - .5) * 1.4, pitch: -.3 - Math.random() * .7, yakin: Math.max(1.6, Math.min(yakinTavan(), (18 + Math.random() * 16) / (d.yR * taban))) };
    } else {
      noralOdakla(d); hedef.yakin = 1.5 + Math.random() * .8;
    }
    atesle(d, false);
    turYazi(d);
  }
  let turYaziZaman = 0;
  function turYazi(d) {   // eskisi söner; kamera yola çıkınca yenisi belirir
    $("tur").classList.remove("gor");
    clearTimeout(turYaziZaman);
    if (!d) return;
    turYaziZaman = setTimeout(() => {
      const a = alanOf(d.alan), yo = gorunum === "yorunge";
      const is = yo ? V.gorevler.filter((x) => x.sayfa === d.id && x.durum !== "askida").length : 0;
      $("turRenk").style.background = a.renk;
      $("turUst").textContent = a.ad + " · " + (yo ? turAd(d) : KATMAN_AD[d.katman]);
      $("turBaslik").textContent = d.baslik;
      $("turOlcu").textContent = [d.derece + (yo ? " bağlantı" : " sinaps"), is ? is + " açık iş" : "", "güncel " + kisaTarih(d.guncelleme)].filter(Boolean).join(" · ");
      $("tur").classList.add("gor");
    }, 900);
  }
  // tur sürerken telefon kendiliğinden kararmasın (izin vermeyen tarayıcıda sessizce geçer); sekme gizlenince kilit düşer, dönünce yeniden
  function uyanikTut() {
    if (!tamKip || uyanik || !navigator.wakeLock) return;
    const istek = navigator.wakeLock.request("screen").then((k) => {
      if (!tamKip || uyanik !== istek) { k.release(); return; }   // bu arada tam ekrandan çıkıldıysa
      uyanik = k; k.addEventListener("release", () => { if (uyanik === k) uyanik = null; });
    }).catch(() => { if (uyanik === istek) uyanik = null; });
    uyanik = istek;
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) uyanikTut(); });

  // düğme normalde zaman cetvelinin hemen üstünde; cetvelin boyu altyazıyla değişir (görünüm, ekran genişliği)
  const altCubuk = document.querySelector(".alt");
  const altOlc = () => { document.body.style.setProperty("--alt-h", altCubuk.offsetHeight + "px"); bantKirli = true; };
  altOlc(); new ResizeObserver(altOlc).observe(altCubuk);
  tamYaz(false);

  // ---------- başlat ----------
  // bağlantıyla açılış: ?gorunum=yorunge|noral (paylaşılan bağlantı belli görünümde açılsın) · ?ac=<not kimliği> (o not seçili açılır)
  const adres = new URLSearchParams(location.search);
  let ilkGorunum = "noral";
  try { if (localStorage.getItem("canli-beyin-gorunum") === "yorunge") ilkGorunum = "yorunge"; } catch (e) { /* depolama kapalı */ }
  if (["noral", "yorunge"].includes(adres.get("gorunum"))) ilkGorunum = adres.get("gorunum");
  gorunumSec(ilkGorunum);
  izdus();
  dongu();
  const ilkAcik = ID[adres.get("ac") || ""];
  setTimeout(() => {
    if (ilkAcik) { sec(ilkAcik); atesle(ilkAcik); odakla(ilkAcik); return; }
    const c = ID[AYAR.nabiz] || gunes || D[0]; if (c) atesle(c, false);
  }, 900);
})();
