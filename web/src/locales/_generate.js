/**
 * Locale generator for "Walk With Me".
 *
 * Reads locales/en.json (the source of truth for the key tree) and applies
 * per-language overrides. Any key a language does not provide falls back to
 * the English text, so no language file can ever be missing a key.
 *
 * Output:
 *   - locales/<code>.json  (nested, one file per language)
 *   - i18n.json            (all languages in one file)
 *
 * Run:  node locales/_generate.js
 */
const fs = require("fs");
const path = require("path");

const dir = __dirname;

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function nest(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Language metadata: code, English name, endonym (name in its own language).
// The `languages` block of every file shows each language's endonym.
// ---------------------------------------------------------------------------
const LANGS = [
  ["en", "English", "English"],
  ["am", "Amharic", "\u12a0\u121b\u122d\u129b"],
  ["om", "Afaan Oromo", "Afaan Oromoo"],
  ["ti", "Tigrinya", "\u1275\u130d\u122d\u129b"],
  ["so", "Somali", "Soomaali"],
  ["sw", "Swahili", "Kiswahili"],
  ["rw", "Kinyarwanda", "Ikinyarwanda"],
  ["rn", "Kirundi", "Ikirundi"],
  ["lg", "Luganda", "Luganda"],
  ["ki", "Kikuyu", "G\u0129k\u0169y\u0169"],
  ["sn", "Shona", "ChiShona"],
  ["ny", "Nyanja (Chichewa)", "Chichewa"],
  ["zu", "Zulu", "isiZulu"],
  ["xh", "Xhosa", "isiXhosa"],
  ["st", "Sesotho", "Sesotho"],
  ["sg", "Sango", "Y\u00e2ng\u00e2 t\u00ee S\u00e4ng\u00f6"],
  ["wo", "Wolof", "Wolof"],
  ["ha", "Hausa", "Hausa"],
  ["yo", "Yoruba", "Yor\u00f9b\u00e1"],
  ["ig", "Igbo", "Igbo"],
  ["ff", "Fulfulde", "Fulfulde"],
  ["mg", "Malagasy", "Malagasy"],
];

const languageBlock = {};
for (const [code, , endonym] of LANGS) languageBlock["languages." + code] = endonym;

// Overrides per language (flat dotted keys). Missing keys fall back to English.
const T = {};

// ---------------------------------------------------------------- Swahili (sw)
T.sw = {
  "app.tagline": "Mwenza wako wa kutembea kila siku",
  "common.cancel": "Ghairi",
  "common.save": "Hifadhi",
  "common.delete": "Futa",
  "common.edit": "Hariri",
  "common.back": "Rudi",
  "common.next": "Inayofuata",
  "common.continue": "Endelea",
  "common.retry": "Jaribu tena",
  "common.confirm": "Thibitisha",
  "common.close": "Funga",
  "common.loading": "Inapakia...",
  "common.search": "Tafuta",
  "common.language": "Lugha",
  "common.ok": "Sawa",
  "common.done": "Imekamilika",
  "nav.home": "Nyumbani",
  "nav.walks": "Matembezi",
  "nav.stats": "Takwimu",
  "nav.profile": "Wasifu",
  "nav.settings": "Mipangilio",
  "nav.notifications": "Arifa",
  "nav.help": "Msaada",
  "auth.welcome": "Karibu",
  "auth.welcomeBack": "Karibu tena",
  "auth.signIn": "Ingia",
  "auth.signUp": "Unda akaunti",
  "auth.signOut": "Toka",
  "auth.email": "Barua pepe",
  "auth.phoneNumber": "Namba ya simu",
  "auth.password": "Nenosiri",
  "auth.confirmPassword": "Thibitisha nenosiri",
  "auth.fullName": "Jina kamili",
  "auth.forgotPassword": "Umesahau nenosiri?",
  "auth.orContinueWith": "au endelea na",
  "auth.terms": "Kwa kuendelea unakubali Masharti yetu ya Huduma na Sera ya Faragha",
  "onboarding.title1": "Tembea kila siku",
  "onboarding.desc1": "Weka lengo la kila siku na ujenge tabia nzuri ya kutembea.",
  "onboarding.title2": "Fuatilia njia yako",
  "onboarding.desc2": "Rekodi umbali, muda na hatua kwenye kila matembezi.",
  "onboarding.title3": "Tembea pamoja",
  "onboarding.desc3": "Alika marafiki na familia watembee nawe.",
  "onboarding.skip": "Ruka",
  "onboarding.getStarted": "Anza",
  "home.greeting": "Habari",
  "home.todayGoal": "Lengo la leo",
  "home.steps": "Hatua",
  "home.distance": "Umbali",
  "home.time": "Muda",
  "home.calories": "Kalori",
  "home.startWalk": "Anza matembezi",
  "home.dailyStreak": "Mfululizo wa siku",
  "home.badges": "Beji",
  "home.noWalksYet": "Hakuna matembezi bado. Anza matembezi yako ya kwanza!",
  "walk.start": "Anza",
  "walk.pause": "Simamisha",
  "walk.resume": "Endeleza",
  "walk.finish": "Maliza",
  "walk.cancelWalk": "Ghairi matembezi",
  "walk.distanceUnit": "km",
  "walk.avgPace": "Kasi ya wastani",
  "walk.paceUnit": "dk/km",
  "walk.walkSaved": "Matembezi yamehifadhiwa",
  "walk.walkCancelled": "Matembezi yameghairiwa",
  "walk.confirmFinish": "Maliza matembezi haya?",
  "stats.weekly": "Kila wiki",
  "stats.monthly": "Kila mwezi",
  "stats.totalDistance": "Umbali wote",
  "stats.totalTime": "Muda wote",
  "stats.averagePace": "Kasi ya wastani",
  "stats.bestDay": "Siku bora",
  "stats.noData": "Hakuna data bado",
  "profile.editProfile": "Hariri wasifu",
  "profile.name": "Jina",
  "profile.age": "Umri",
  "profile.height": "Urefu",
  "profile.weight": "Uzito",
  "profile.units": "Vipimo",
  "profile.goal": "Lengo la kila siku",
  "profile.saveChanges": "Hifadhi mabadiliko",
  "settings.appearance": "Muonekano",
  "settings.theme": "Mandhari",
  "settings.darkMode": "Hali ya giza",
  "settings.lightMode": "Hali ya mwanga",
  "settings.sound": "Sauti",
  "settings.vibration": "Mtetemo",
  "settings.privacy": "Faragha",
  "settings.dataUsage": "Matumizi ya data",
  "settings.about": "Kuhusu",
  "settings.version": "Toleo",
  "settings.termsOfService": "Masharti ya Huduma",
  "settings.privacyPolicy": "Sera ya Faragha",
  "settings.logout": "Toka",
  "notifications.dailyReminder": "Ukumbusho wa kila siku",
  "notifications.walkReminder": "Ni wakati wa matembezi yako ya kila siku!",
  "notifications.streakMilestone": "Umefikia hatua mpya ya mfululizo!",
  "notifications.badgeEarned": "Umepata beji mpya!",
  "errors.generic": "Hitilafu imetokea. Tafadhali jaribu tena.",
  "errors.network": "Hakuna muunganisho wa intaneti.",
  "errors.invalidEmail": "Tafadhali ingiza barua pepe sahihi.",
  "errors.passwordTooShort": "Nenosiri lazima liwe na angalau herufi 6.",
  "errors.passwordMismatch": "Manenosiri hayafanani.",
  "errors.fillAllFields": "Tafadhali jaza sehemu zote.",
  "errors.userNotFound": "Hakuna akaunti iliyopatikana na barua pepe hii.",
  "errors.wrongPassword": "Nenosiri si sahihi.",
  "errors.walkInProgress": "Matembezi tayari yanaendelea.",
};

// ----------------------------------------------------------------- Somali (so)
T.so = {
  "app.name": "Il Soco",
  "app.tagline": "Wehelkaaga maalinle ee socodka",
  "common.cancel": "Ka jooji",
  "common.save": "Keydi",
  "common.delete": "Tirtir",
  "common.edit": "Wax ka beddel",
  "common.back": "Dib",
  "common.next": "Xiga",
  "common.continue": "Sii wad",
  "common.retry": "Isku day mar kale",
  "common.confirm": "Xaqiiji",
  "common.close": "Xir",
  "common.loading": "Waa la soo dejinayaa...",
  "common.search": "Raadi",
  "common.language": "Luqad",
  "common.ok": "Hagaag",
  "common.done": "Dhammaaday",
  "nav.home": "Guriga",
  "nav.walks": "Socodka",
  "nav.stats": "Tirakoob",
  "nav.profile": "Astaanta",
  "nav.settings": "Dejinta",
  "nav.notifications": "Ogeysiisyo",
  "nav.help": "Caawinaad",
  "auth.welcome": "Soo dhawoow",
  "auth.welcomeBack": "Soo dhawoow mar kale",
  "auth.signIn": "Soo gal",
  "auth.signUp": "Abuur akoon",
  "auth.signOut": "Ka bax",
  "auth.email": "Iimayl",
  "auth.phoneNumber": "Lambarka telefoonka",
  "auth.password": "Furaha sirta",
  "auth.confirmPassword": "Xaqiiji furaha sirta",
  "auth.fullName": "Magaca buuxa",
  "auth.forgotPassword": "Ma ilowday furaha sirta?",
  "auth.orContinueWith": "ama ku sii wad",
  "auth.terms": "Markaad sii waddo waxaad ogolaanaysaa Shuruudaha Adeegga iyo Siyaasadda Asturnaanta",
  "onboarding.title1": "Maalin kasta soco",
  "onboarding.desc1": "Deji yool maalinle oo dhis caado socod caafimaad leh.",
  "onboarding.title2": "La soco wadadaada",
  "onboarding.desc2": "Diiwaangeli masaafada, waqtiga iyo tallaabooyinka socod kasta.",
  "onboarding.title3": "Wada soco",
  "onboarding.desc3": "Ku casuum saaxiibbadaada iyo qoyskaaga inay kula socdaan.",
  "onboarding.skip": "Booqo",
  "onboarding.getStarted": "Bilow",
  "home.greeting": "Salaam",
  "home.todayGoal": "Yoolka maanta",
  "home.steps": "Tallaabooyin",
  "home.distance": "Masaafo",
  "home.time": "Waqti",
  "home.calories": "Kalori",
  "home.startWalk": "Bilow socod",
  "home.dailyStreak": "Silsilad maalinle",
  "home.badges": "Calaamado",
  "home.noWalksYet": "Weli socod ma jiro. Bilow socodkaaga ugu horreeya!",
  "walk.start": "Bilow",
  "walk.pause": "Hakad",
  "walk.resume": "Sii wad",
  "walk.finish": "Dhameystir",
  "walk.cancelWalk": "Ka jooji socodka",
  "walk.distanceUnit": "km",
  "walk.avgPace": "Xawaaraha celceliska",
  "walk.paceUnit": "daqiiqo/km",
  "walk.walkSaved": "Socodka si guuleysan ayaa loo keydiyay",
  "walk.walkCancelled": "Socodka waa la joojiyay",
  "walk.confirmFinish": "Ma dhammaysaa socodkan?",
  "stats.weekly": "Toddobaadle",
  "stats.monthly": "Bille",
  "stats.totalDistance": "Masaafada guud",
  "stats.totalTime": "Waqtiga guud",
  "stats.averagePace": "Xawaaraha celceliska",
  "stats.bestDay": "Maalinta ugu fiican",
  "stats.noData": "Weli xog ma jirto",
  "profile.editProfile": "Wax ka beddel astaanta",
  "profile.name": "Magac",
  "profile.age": "Da'",
  "profile.height": "Dherer",
  "profile.weight": "Miisaan",
  "profile.units": "Unugyo",
  "profile.goal": "Yool maalinle",
  "profile.saveChanges": "Keydi isbeddellada",
  "settings.appearance": "Muuqaal",
  "settings.theme": "Mawduuc",
  "settings.darkMode": "Hab madow",
  "settings.lightMode": "Hab iftiin",
  "settings.sound": "Cod",
  "settings.vibration": "Gariir",
  "settings.privacy": "Asturnaan",
  "settings.dataUsage": "Isticmaalka xogta",
  "settings.about": "Ku saabsan",
  "settings.version": "Nooc",
  "settings.termsOfService": "Shuruudaha Adeegga",
  "settings.privacyPolicy": "Siyaasadda Asturnaanta",
  "settings.logout": "Ka bax",
  "notifications.dailyReminder": "Xusuusin maalinle",
  "notifications.walkReminder": "Waa waqtigii socodkaaga maalinle!",
  "notifications.streakMilestone": "Waxaad gaadhay heer cusub oo silsilad!",
  "notifications.badgeEarned": "Waxaad kasbatay calaamad cusub!",
  "errors.generic": "Khalad ayaa dhacay. Fadlan isku day mar kale.",
  "errors.network": "Xiriir internet ma jiro.",
  "errors.invalidEmail": "Fadlan geli iimayl sax ah.",
  "errors.passwordTooShort": "Furaha sirta waa inuu ka koobnaadaa ugu yaraan 6 xaraf.",
  "errors.passwordMismatch": "Furayaasha sirta isku mid ma aha.",
  "errors.fillAllFields": "Fadlan buuxi dhammaan goobaha.",
  "errors.userNotFound": "Iimaylkaan akoon laguma helin.",
  "errors.wrongPassword": "Furaha sirta waa khalad.",
  "errors.walkInProgress": "Socod horey ayaa u socday.",
};

// -------------------------------------------------------------- Amharic (am)
T.am = {
  "app.name": "ከእኔ ጋር ተራመድ",
  "app.tagline": "የዕለት ተዕለት የእርምጃ ጓደኛህ",
  "common.cancel": "ይቅር",
  "common.save": "አስቀምጥ",
  "common.delete": "ሰርዝ",
  "common.edit": "አርትዕ",
  "common.back": "ተመለስ",
  "common.next": "ቀጣይ",
  "common.continue": "ቀጥል",
  "common.retry": "እንደገና ሞክር",
  "common.confirm": "አረጋግጥ",
  "common.close": "ዝጋ",
  "common.loading": "በመጫን ላይ...",
  "common.search": "ፈልግ",
  "common.language": "ቋንቋ",
  "common.ok": "እሺ",
  "common.done": "ተጠናቋል",
  "nav.home": "መነሻ",
  "nav.walks": "ጉዞዎች",
  "nav.stats": "ስታቲስቲክስ",
  "nav.profile": "መገለጫ",
  "nav.settings": "ቅንብሮች",
  "nav.notifications": "ማሳወቂያዎች",
  "nav.help": "እርዳታ",
  "auth.welcome": "እንኳን ደህና መጡ",
  "auth.welcomeBack": "እንኳን ደህና ተመለሱ",
  "auth.signIn": "ይግቡ",
  "auth.signUp": "መለያ ይክፈቱ",
  "auth.signOut": "ይውጡ",
  "auth.email": "ኢሜይል",
  "auth.phoneNumber": "የስልክ ቁጥር",
  "auth.password": "የይለፍ ቃል",
  "auth.confirmPassword": "የይለፍ ቃል አረጋግጥ",
  "auth.fullName": "ሙሉ ስም",
  "auth.forgotPassword": "የይለፍ ቃል ረሱ?",
  "auth.orContinueWith": "ወይም በዚህ ይቀጥሉ",
  "auth.terms": "በመቀጠል የአገልግሎት ውሎቻችንን እና የግለኝነት መመሪያችንን ትቀበላለህ",
  "onboarding.title1": "በየቀኑ ይራመዱ",
  "onboarding.desc1": "የዕለታዊ ግብ ያስቀምጡ እና ጤናማ የመራመድ ልማድ ይገንቡ።",
  "onboarding.title2": "መንገድዎን ይከታተሉ",
  "onboarding.desc2": "በእያንዳንዱ ጉዞ ርቀት፣ ጊዜ እና እርምጃዎችን ይመዝግቡ።",
  "onboarding.title3": "አብረው ይራመዱ",
  "onboarding.desc3": "ጓደኞችዎን እና ቤተሰብዎን አብረው እንዲራመዱ ይጋብዙ።",
  "onboarding.skip": "ዝለል",
  "onboarding.getStarted": "ይጀምሩ",
  "home.greeting": "ሰላም",
  "home.todayGoal": "የዛሬ ግብ",
  "home.steps": "እርምጃዎች",
  "home.distance": "ርቀት",
  "home.time": "ጊዜ",
  "home.calories": "ካሎሪ",
  "home.startWalk": "ጉዞ ጀምር",
  "home.dailyStreak": "ተከታታይ ቀናት",
  "home.badges": "ባጆች",
  "home.noWalksYet": "እስካሁን ጉዞ የለም። የመጀመሪያ ጉዞዎን ይጀምሩ!",
  "walk.start": "ጀምር",
  "walk.pause": "አቁም",
  "walk.resume": "ቀጥል",
  "walk.finish": "ጨርስ",
  "walk.cancelWalk": "ጉዞ ሰርዝ",
  "walk.distanceUnit": "ኪሜ",
  "walk.avgPace": "አማካይ ፍጥነት",
  "walk.paceUnit": "ደቂቃ/ኪሜ",
  "walk.walkSaved": "ጉዞው በተሳካ ሁኔታ ተቀምጧል",
  "walk.walkCancelled": "ጉዞው ተሰርዟል",
  "walk.confirmFinish": "ይህን ጉዞ ጨርስ?",
  "stats.weekly": "በሳምንት",
  "stats.monthly": "በወር",
  "stats.totalDistance": "ጠቅላላ ርቀት",
  "stats.totalTime": "ጠቅላላ ጊዜ",
  "stats.averagePace": "አማካይ ፍጥነት",
  "stats.bestDay": "ምርጥ ቀን",
  "stats.noData": "እስካሁን ውሂብ የለም",
  "profile.editProfile": "መገለጫ አርትዕ",
  "profile.name": "ስም",
  "profile.age": "ዕድሜ",
  "profile.height": "ቁመት",
  "profile.weight": "ክብደት",
  "profile.units": "መለኪያ",
  "profile.goal": "የዕለታዊ ግብ",
  "profile.saveChanges": "ለውጦችን አስቀምጥ",
  "settings.appearance": "አቀራረብ",
  "settings.theme": "ገጽታ",
  "settings.darkMode": "ጨለማ ገጽታ",
  "settings.lightMode": "ብርሃን ገጽታ",
  "settings.sound": "ድምጽ",
  "settings.vibration": "ንቅናቄ",
  "settings.privacy": "ግለኝነት",
  "settings.dataUsage": "የውሂብ አጠቃቀም",
  "settings.about": "ስለ እኛ",
  "settings.version": "ስሪት",
  "settings.termsOfService": "የአገልግሎት ውሎች",
  "settings.privacyPolicy": "የግለኝነት መመሪያ",
  "settings.logout": "ውጣ",
  "notifications.dailyReminder": "የዕለታዊ ማስታወሻ",
  "notifications.walkReminder": "የዕለታዊ ጉዞዎ ጊዜ ሆኗል!",
  "notifications.streakMilestone": "አዲስ የተከታታይ ምዕራፍ ላይ ደርሰዋል!",
  "notifications.badgeEarned": "አዲስ ባጅ አግኝተዋል!",
  "errors.generic": "የተሳሳተ ነገር ተከስቷል። እባክዎ እንደገና ይሞክሩ።",
  "errors.network": "የኢንተርኔት ግንኙነት የለም።",
  "errors.invalidEmail": "እባክዎ ትክክለኛ ኢሜይል ያስገቡ።",
  "errors.passwordTooShort": "የይለፍ ቃል ቢያንስ 6 ፊደሎች መሆን አለበት።",
  "errors.passwordMismatch": "የይለፍ ቃላቱ አይመሳሰሉም።",
  "errors.fillAllFields": "እባክዎ ሁሉንም መስኮች ይሙሉ።",
  "errors.userNotFound": "በዚህ ኢሜይል መለያ አልተገኘም።",
  "errors.wrongPassword": "የይለፍ ቃል ትክክል አይደለም።",
  "errors.walkInProgress": "ጉዞ አስቀድሞ በመካሄድ ላይ ነው።",
};

// ------------------------------------------------------------ Oromo (om)
T.om = {
  "app.name": "Naa Waliin Deemi",
  "app.tagline": "Hiriyaa guyyaa guyyaa sochii kee",
  "common.cancel": "Haqi",
  "common.save": "Olkaa'i",
  "common.delete": "Haqi",
  "common.edit": "Gulaali",
  "common.back": "Deebi'i",
  "common.next": "Itti aanu",
  "common.continue": "Itti fufi",
  "common.retry": "Irra deebi'ii yaali",
  "common.confirm": "Mirkaneessi",
  "common.close": "Cufi",
  "common.loading": "Fe'aa jira...",
  "common.search": "Barbaadi",
  "common.language": "Afaan",
  "common.ok": "Tole",
  "common.done": "Xumurame",
  "nav.home": "Mana",
  "nav.walks": "Deemsa",
  "nav.stats": "Lakkoofsa",
  "nav.profile": "Profaayilii",
  "nav.settings": "Qindaa'ina",
  "nav.notifications": "Beeksisa",
  "nav.help": "Gargaarsa",
  "auth.welcome": "Baga nagaan dhuftan",
  "auth.welcomeBack": "Baga nagaan deebitan",
  "auth.signIn": "Seeni",
  "auth.signUp": "Herrega uumi",
  "auth.signOut": "Bahi",
  "auth.email": "Imeelii",
  "auth.phoneNumber": "Lakkoofsa bilbilaa",
  "auth.password": "Jecha iccitii",
  "auth.confirmPassword": "Jecha iccitii mirkaneessi",
  "auth.fullName": "Maqaa guutuu",
  "auth.forgotPassword": "Jecha iccitii dagatte?",
  "auth.orContinueWith": "yookaan itti fufi",
  "auth.terms": "Itti fufuun keetiin Haala Tajaajila fi Imaammata Iccitii keenya fudhatta",
  "onboarding.title1": "Guyyaa guyyaan deemi",
  "onboarding.desc1": "Kaayyoo guyyaa guyyaa kaa'iitii amala deemsa fayyaa ijaari.",
  "onboarding.title2": "Daandii kee hordofi",
  "onboarding.desc2": "Deemsa hunda fageenya, yeroo fi tarkaanfii galmeessi.",
  "onboarding.title3": "Waliin deemi",
  "onboarding.desc3": "Hiriyoota fi maatii kee si waliin akka deeman affeeri.",
  "onboarding.skip": "Darbi",
  "onboarding.getStarted": "Jalqabi",
  "home.greeting": "Akkam",
  "home.todayGoal": "Kaayyoo har'aa",
  "home.steps": "Tarkaanfii",
  "home.distance": "Fageenya",
  "home.time": "Yeroo",
  "home.calories": "Kaalorii",
  "home.startWalk": "Deemsa jalqabi",
  "home.dailyStreak": "Guyyoota walitti aanan",
  "home.badges": "Mallattoo",
  "home.noWalksYet": "Deemsi tokkollee hin jiru. Deemsa jalqabaa kee jalqabi!",
  "walk.start": "Jalqabi",
  "walk.pause": "Dhaabi",
  "walk.resume": "Itti fufi",
  "walk.finish": "Xumuri",
  "walk.cancelWalk": "Deemsa haqi",
  "walk.distanceUnit": "km",
  "walk.avgPace": "Saffisa giddu-galeessa",
  "walk.paceUnit": "daq/km",
  "walk.walkSaved": "Deemsi milkaa'inaan olkaa'ame",
  "walk.walkCancelled": "Deemsi haqame",
  "walk.confirmFinish": "Deemsa kana xumurtaa?",
  "stats.weekly": "Torbanii torbaniin",
  "stats.monthly": "Ji'aan ji'aan",
  "stats.totalDistance": "Fageenya waliigalaa",
  "stats.totalTime": "Yeroo waliigalaa",
  "stats.averagePace": "Saffisa giddu-galeessa",
  "stats.bestDay": "Guyyaa gaarii",
  "stats.noData": "Ragaan amma hin jiru",
  "profile.editProfile": "Profaayilii gulaali",
  "profile.name": "Maqaa",
  "profile.age": "Umurii",
  "profile.height": "Dheerina",
  "profile.weight": "Ulfaatina",
  "profile.units": "Safartuu",
  "profile.goal": "Kaayyoo guyyaa guyyaa",
  "profile.saveChanges": "Jijjiirama olkaa'i",
  "settings.appearance": "Bifa",
  "settings.theme": "Mata-duree",
  "settings.darkMode": "Bifa dukkanaa",
  "settings.lightMode": "Bifa ifaa",
  "settings.sound": "Sagalee",
  "settings.vibration": "Sochii",
  "settings.privacy": "Iccitii",
  "settings.dataUsage": "Itti fayyadama ragaa",
  "settings.about": "Waa'ee",
  "settings.version": "Fooyya'ina",
  "settings.termsOfService": "Haala Tajaajila",
  "settings.privacyPolicy": "Imaammata Iccitii",
  "settings.logout": "Bahi",
  "notifications.dailyReminder": "Yaadachiisa guyyaa guyyaa",
  "notifications.walkReminder": "Yeroon deemsa guyyaa kee gaheera!",
  "notifications.streakMilestone": "Sadarkaa haaraa guyyoota walitti aanan geesse!",
  "notifications.badgeEarned": "Mallattoo haaraa argatte!",
  "errors.generic": "Dogoggorri uumame. Maaloo irra deebi'ii yaali.",
  "errors.network": "Quunnamtii interneetii hin jiru.",
  "errors.invalidEmail": "Maaloo imeelii sirrii galchi.",
  "errors.passwordTooShort": "Jechi iccitii yoo xiqqaate qubee 6 qabaachuu qaba.",
  "errors.passwordMismatch": "Jechoonni iccitii wal hin fakkaatan.",
  "errors.fillAllFields": "Maaloo dirree hunda guuti.",
  "errors.userNotFound": "Imeelii kanaan herregni hin argamne.",
  "errors.wrongPassword": "Jechi iccitii sirrii miti.",
  "errors.walkInProgress": "Deemsi duraan adeemaa jira.",
};

// Pull in the translation parts and merge them into T.
// merge deep per language: a later part must ADD to a language's keys, not
// replace the whole language object (parts split the same language across files).
for (const part of [
  "_translations-2.js",
  "_translations-3.js",
  "_translations-4.js",
  "_translations-5.js",
  "_translations-6.js",
  "_translations-7.js",
  "_translations-8.js",
]) {
  const loaded = require(path.join(dir, part));
  for (const [code, strings] of Object.entries(loaded)) {
    T[code] = Object.assign({}, T[code], strings);
  }
}

// ---------------------------------------------------------------- generate
const enRaw = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const enFlat = flatten(enRaw);
const enKeys = Object.keys(enFlat);
const combined = {};

const report = [];

for (const [code] of LANGS) {
  // English is the untouched base; every other language layers overrides on top.
  const overrides = code === "en" ? {} : Object.assign({}, T[code] || {}, languageBlock);

  // Warn about override keys that do not exist in the English base tree.
  const unknown = Object.keys(overrides).filter((k) => !(k in enFlat));
  if (unknown.length) {
    throw new Error(
      `[${code}] override keys not present in en.json: ${unknown.join(", ")}`
    );
  }

  const mergedFlat = Object.assign({}, enFlat, overrides);
  const merged = nest(mergedFlat);

  fs.writeFileSync(
    path.join(dir, code + ".json"),
    JSON.stringify(merged, null, 2) + "\n",
    "utf8"
  );

  combined[code] = merged;

  const translated = code === "en" ? enKeys.length : Object.keys(T[code] || {}).length;
  report.push({ code, keys: enKeys.length, translated });
}

// Combined single-file bundle at project root.
fs.writeFileSync(
  path.join(dir, "..", "i18n.json"),
  JSON.stringify(combined, null, 2) + "\n",
  "utf8"
);

// Manifest describing available languages for a language switcher UI.
const manifest = LANGS.map(([code, name, endonym]) => ({ code, name, endonym }));
fs.writeFileSync(
  path.join(dir, "index.json"),
  JSON.stringify({ defaultLocale: "en", locales: manifest }, null, 2) + "\n",
  "utf8"
);

console.log("Language   Keys  Translated(overrides)");
for (const r of report) {
  console.log(r.code.padEnd(4), String(r.keys).padStart(6), String(r.translated).padStart(8));
}
console.log(`\nWrote ${LANGS.length} locale files + i18n.json + index.json`);

