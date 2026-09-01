/**
 * PILOT COMMUNE DATA — INCOMPLETE BY DESIGN.
 *
 * Algeria has ~1,540 communes. This file covers the eight fire-prone wilayas
 * only, and within those it lists the main communes rather than all of them.
 * That is enough to run a single-wilaya pilot, and NOT enough to launch
 * nationally.
 *
 * ⚠️  Before national launch, import the full official commune dataset via
 *     `scripts/seed-geo.ts --file communes.json` (see that script). The
 *     importer upserts on `code`, so re-running it is safe.
 *
 * ⚠️  `code` values here are SYNTHETIC (wilaya code + sequence), not official
 *     commune codes. The full-dataset import replaces them. Nothing in the app
 *     should ever parse meaning out of a commune code.
 *
 * ⚠️  Arabic and French spellings need review by a native Algerian Arabic
 *     speaker before launch.
 */

export type SeedCommune = {
  wilayaCode: string;
  code: string;
  nameAr: string;
  nameFr: string;
};

const build = (wilayaCode: string, rows: Array<[string, string]>): SeedCommune[] =>
  rows.map(([nameAr, nameFr], i) => ({
    wilayaCode,
    code: `${wilayaCode}${String(i + 1).padStart(3, '0')}`,
    nameAr,
    nameFr,
  }));

/* 06 — Béjaïa */
const bejaia = build('06', [
  ['بجاية', 'Béjaïa'],
  ['أقبو', 'Akbou'],
  ['خراطة', 'Kherrata'],
  ['سوق الاثنين', 'Souk El Tenine'],
  ['أوقاس', 'Aokas'],
  ['تيشي', 'Tichy'],
  ['صدوق', 'Seddouk'],
  ['سيدي عيش', 'Sidi Aïch'],
  ['القصر', 'El Kseur'],
  ['أميزور', 'Amizour'],
  ['برباشة', 'Barbacha'],
  ['أدكار', 'Adekar'],
  ['توجة', 'Toudja'],
  ['درقينة', 'Darguina'],
  ['ملبو', 'Melbou'],
  ['تازمالت', 'Tazmalt'],
  ['إيغيل علي', 'Ighil Ali'],
  ['شميني', 'Chemini'],
  ['أوزلاقن', 'Ouzellaguen'],
]);

/* 15 — Tizi Ouzou */
const tiziOuzou = build('15', [
  ['تيزي وزو', 'Tizi Ouzou'],
  ['عزازقة', 'Azazga'],
  ['لاربعاء ناث إيراثن', 'Larbaâ Nath Irathen'],
  ['ذراع بن خدة', 'Draâ Ben Khedda'],
  ['تيقزيرت', 'Tigzirt'],
  ['عين الحمام', 'Aïn El Hammam'],
  ['بوغني', 'Boghni'],
  ['ذراع الميزان', 'Draâ El Mizan'],
  ['واقنون', 'Ouaguenoun'],
  ['ماكودة', 'Makouda'],
  ['مقلع', 'Mekla'],
  ['بوزقان', 'Bouzeguene'],
  ['فريحة', 'Freha'],
  ['تيزي راشد', 'Tizi Rached'],
  ['بني دوالة', 'Beni Douala'],
  ['الوعديات', 'Ouadhias'],
  ['معاتقة', 'Maâtkas'],
  ['تيزي غنيف', 'Tizi Gheniff'],
  ['إيفرحونان', 'Iferhounene'],
  ['يعقورن', 'Yakouren'],
  ['أزفون', 'Azeffoun'],
  ['أغريب', 'Aghribs'],
]);

/* 18 — Jijel */
const jijel = build('18', [
  ['جيجل', 'Jijel'],
  ['الطاهير', 'Taher'],
  ['الميلية', 'El Milia'],
  ['الشقفة', 'Chekfa'],
  ['زيامة منصورية', 'Ziama Mansouriah'],
  ['العوانة', 'El Aouana'],
  ['تاكسنة', 'Texenna'],
  ['سطارة', 'Settara'],
  ['جيملة', 'Djimla'],
  ['سلمى بن زيادة', 'Selma Benziada'],
  ['قاوس', 'Kaous'],
  ['الأمير عبد القادر', 'Emir Abdelkader'],
  ['سيدي عبد العزيز', 'Sidi Abdelaziz'],
  ['أولاد يحيى خدروش', 'Ouled Yahia Khadrouche'],
  ['برج الطهر', 'Bordj Tahar'],
]);

/* 21 — Skikda */
const skikda = build('21', [
  ['سكيكدة', 'Skikda'],
  ['القل', 'Collo'],
  ['عزابة', 'Azzaba'],
  ['الحروش', 'El Harrouch'],
  ['تمالوس', 'Tamalous'],
  ['رمضان جمال', 'Ramdane Djamel'],
  ['عين قشرة', 'Aïn Kechra'],
  ['بين الويدان', 'Bin El Ouiden'],
  ['أولاد عطية', 'Ouled Attia'],
  ['الزيتونة', 'Zitouna'],
  ['الشرايع', 'Cheraia'],
  ['كركرة', 'Kerkera'],
  ['أم الطوب', 'Oum Toub'],
]);

/* 19 — Sétif */
const setif = build('19', [
  ['سطيف', 'Sétif'],
  ['العلمة', 'El Eulma'],
  ['عين ولمان', 'Aïn Oulmene'],
  ['بوقاعة', 'Bougaa'],
  ['عين أرنات', 'Aïn Arnat'],
  ['بني ورتيلان', 'Beni Ourtilane'],
  ['بني عزيز', 'Beni Aziz'],
  ['قنزات', 'Guenzet'],
  ['عين الكبيرة', 'Aïn El Kebira'],
  ['جميلة', 'Djemila'],
  ['عموشة', 'Amoucha'],
  ['بابور', 'Babor'],
  ['سرج الغول', 'Serdj El Ghoul'],
]);

/* 10 — Bouira */
const bouira = build('10', [
  ['البويرة', 'Bouira'],
  ['الأخضرية', 'Lakhdaria'],
  ['سور الغزلان', 'Sour El Ghozlane'],
  ['مشدالة', "M'Chedallah"],
  ['قادرية', 'Kadiria'],
  ['بشلول', 'Bechloul'],
  ['حيزر', 'Haizer'],
  ['الأصنام', 'El Asnam'],
  ['عومر', 'Aomar'],
  ['أهنيف', 'Ahnif'],
  ['سحاريج', 'Saharidj'],
  ['أغبالو', 'Aghbalou'],
  ['شرفة', 'Chorfa'],
  ['برج أوخريص', 'Bordj Okhriss'],
]);

/* 36 — El Tarf */
const elTarf = build('36', [
  ['الطارف', 'El Tarf'],
  ['القالة', 'El Kala'],
  ['بن مهيدي', 'Ben Mehidi'],
  ['بوثلجة', 'Bouteldja'],
  ['الذرعان', 'Dréan'],
  ['بسباس', 'Besbes'],
  ['شيحاني', 'Chihani'],
  ['الزيتونة', 'Zitouna'],
  ['عين العسل', 'Aïn El Assel'],
  ['بوحجار', 'Bouhadjar'],
  ['الصوارخ', 'Souarekh'],
]);

/* 09 — Blida */
const blida = build('09', [
  ['البليدة', 'Blida'],
  ['بوفاريك', 'Boufarik'],
  ['الأربعاء', 'Larbaâ'],
  ['موزاية', 'Mouzaia'],
  ['العفرون', 'El Affroun'],
  ['الشريعة', 'Chréa'],
  ['بوقرة', 'Bougara'],
  ['أولاد يعيش', 'Ouled Yaich'],
  ['بني تامو', 'Beni Tamou'],
  ['الصومعة', 'Soumaa'],
  ['الشفة', 'Chiffa'],
  ['حمام ملوان', 'Hammam Melouane'],
  ['بوعينان', 'Bouinan'],
]);

export const COMMUNES: SeedCommune[] = [
  ...bejaia,
  ...tiziOuzou,
  ...jijel,
  ...skikda,
  ...setif,
  ...bouira,
  ...elTarf,
  ...blida,
];
