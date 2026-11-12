/* ============================================================
 * data.js — all learning content for the French trainer.
 * Loaded before store.js / app.js (plain script, globals).
 * ============================================================ */

"use strict";

/* ---------- Normalisation ----------
 * Lenient comparison for typed answers: case-insensitive, accent-insensitive,
 * apostrophes dropped ("j'ai" = "jai"), hyphens/spaces ignored, and the
 * filler word "et" in numbers is ignored ("vingt et un" = "vingt-un"). */
function norm(s) {
  return (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[-–—]/g, " ")
    .split(/\s+/)
    .filter(w => w && w !== "et")
    .join("");
}

/* ---------- Numbers 0–100 ---------- */

const UNITS_FR = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf"
];

const TENS_FR = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

/** Canonical French spelling of n (0–100). */
function frenchNumber(n) {
  if (n < 20) return UNITS_FR[n];
  if (n < 70) {
    const t = TENS_FR[Math.floor(n / 10)], u = n % 10;
    if (u === 0) return t;
    if (u === 1) return t + " et un";          // vingt et un, trente et un, … soixante et un
    return t + "-" + UNITS_FR[u];
  }
  if (n < 80) {                                 // 70–79
    const u = n - 60;                           // 10–19
    if (u === 11) return "soixante et onze";    // 71
    return "soixante-" + UNITS_FR[u];           // 70 = soixante-dix … 79
  }
  if (n === 80) return "quatre-vingts";         // takes -s when not followed by another number
  if (n < 100) return "quatre-vingt-" + UNITS_FR[n - 80]; // 81–99, no "et", no -s on vingt
  return "cent";                                // 100
}

const NUMBERS_RANGE = Array.from({ length: 101 }, (_, i) => i);

/** Accepted typed answers for a number (accent- and hyphen-insensitive variants). */
function numberAccept(n) {
  const c = frenchNumber(n);
  const set = new Set([norm(c)]);
  if (c.endsWith("s")) set.add(norm(c.slice(0, -1))); // tolerate "quatre-vingt" for 80
  return [...set];
}

/* ---------- Pronouns ---------- */

const PRONOUNS = [
  { key: "je",   label: "je" },
  { key: "tu",   label: "tu" },
  { key: "il",   label: "il / elle" },
  { key: "nous", label: "nous" },
  { key: "vous", label: "vous" },
  { key: "ils",  label: "ils / elles" },
];

/* ---------- Irregular verbs: avoir, être, aller ---------- */

const IRREGULAR_VERBS = {
  avoir: {
    label: "avoir",
    forms: { je: "j'ai", tu: "as", il: "a", nous: "avons", vous: "avez", ils: "ont" },
  },
  etre: {
    label: "être",
    forms: { je: "suis", tu: "es", il: "est", nous: "sommes", vous: "êtes", ils: "sont" },
  },
  aller: {
    label: "aller",
    forms: { je: "vais", tu: "vas", il: "va", nous: "allons", vous: "allez", ils: "vont" },
  },
};

/* ---------- Regular -er verbs (class I) ----------
 * Full conjugations stored explicitly so spelling-change verbs
 * (manger → nous mangeons, commencer → nous commençons) are correct. */

const ER_VERBS = [
  { inf: "parler",    forms: { je: "parle",     tu: "parles",     il: "parle",     nous: "parlons",    vous: "parlez",    ils: "parlent" } },
  { inf: "aimer",     forms: { je: "aime",      tu: "aimes",      il: "aime",      nous: "aimons",     vous: "aimez",     ils: "aiment" } },
  { inf: "regarder",  forms: { je: "regarde",   tu: "regardes",   il: "regarde",   nous: "regardons",  vous: "regardez",   ils: "regardent" } },
  { inf: "écouter",   forms: { je: "écoute",    tu: "écoutes",    il: "écoute",    nous: "écoutons",   vous: "écoutez",    ils: "écoutent" } },
  { inf: "travailler",forms: { je: "travaille", tu: "travailles", il: "travaille", nous: "travaillons",vous: "travaillez", ils: "travaillent" } },
  { inf: "habiter",   forms: { je: "habite",    tu: "habites",    il: "habite",    nous: "habitons",   vous: "habitez",    ils: "habitent" } },
  { inf: "chanter",   forms: { je: "chante",    tu: "chantes",    il: "chante",    nous: "chantons",   vous: "chantez",    ils: "chantent" } },
  { inf: "danser",    forms: { je: "danse",     tu: "danses",     il: "danse",     nous: "dansons",    vous: "dansez",     ils: "dansent" } },
  { inf: "chercher",  forms: { je: "cherche",   tu: "cherches",   il: "cherche",   nous: "cherchons",  vous: "cherchez",   ils: "cherchent" } },
  { inf: "trouver",   forms: { je: "trouve",    tu: "trouves",    il: "trouve",    nous: "trouvons",   vous: "trouvez",    ils: "trouvent" } },
  { inf: "jouer",     forms: { je: "joue",      tu: "joues",      il: "joue",      nous: "jouons",     vous: "jouez",      ils: "jouent" } },
  { inf: "donner",    forms: { je: "donne",     tu: "donnes",     il: "donne",     nous: "donnons",    vous: "donnez",     ils: "donnent" } },
  { inf: "manger",    forms: { je: "mange",     tu: "manges",     il: "mange",     nous: "mangeons",   vous: "mangez",     ils: "mangent" } },
  { inf: "commencer", forms: { je: "commence",  tu: "commences",  il: "commence",  nous: "commençons", vous: "commencez",  ils: "commencent" } },
];

/* ---------- Regular -ir verbs (class II, finir pattern) ---------- */

const IR_VERBS = [
  { inf: "finir",     forms: { je: "finis",     tu: "finis",     il: "finit",     nous: "finissons",    vous: "finissez",    ils: "finissent" } },
  { inf: "choisir",   forms: { je: "choisis",   tu: "choisis",   il: "choisit",   nous: "choisissons",  vous: "choisissez",  ils: "choisissent" } },
  { inf: "réussir",   forms: { je: "réussis",   tu: "réussis",   il: "réussit",   nous: "réussissons",  vous: "réussissez",  ils: "réussissent" } },
  { inf: "réfléchir", forms: { je: "réfléchis", tu: "réfléchis", il: "réfléchit", nous: "réfléchissons",vous: "réfléchissez", ils: "réfléchissent" } },
  { inf: "grandir",   forms: { je: "grandis",   tu: "grandis",   il: "grandit",   nous: "grandissons",  vous: "grandissez",  ils: "grandissent" } },
  { inf: "agir",      forms: { je: "agis",      tu: "agis",      il: "agit",      nous: "agissons",    vous: "agissez",     ils: "agissent" } },
  { inf: "remplir",   forms: { je: "remplis",   tu: "remplis",   il: "remplit",   nous: "remplissons",  vous: "remplissez",  ils: "remplissent" } },
  { inf: "obéir",     forms: { je: "obéis",     tu: "obéis",     il: "obéit",     nous: "obéissons",   vous: "obéissez",    ils: "obéissent" } },
  { inf: "rougir",    forms: { je: "rougis",    tu: "rougis",    il: "rougit",    nous: "rougissons",   vous: "rougissez",   ils: "rougissent" } },
  { inf: "établir",   forms: { je: "établis",   tu: "établis",   il: "établit",   nous: "établissons",  vous: "établissez",  ils: "établissent" } },
];

/* ---------- Topics ---------- */

const TOPICS = [
  {
    id: "numbers", kind: "numbers",
    name: "Numbers 0–100",
    icon: "🔢",
    desc: "French number words for 0 to 100 — vingt, soixante-dix, quatre-vingts… in both directions.",
  },
  {
    id: "avoir", kind: "verb", verb: "avoir",
    name: "avoir — present tense",
    icon: "💬",
    desc: "j'ai, tu as, il a, nous avons, vous avez, ils ont.",
  },
  {
    id: "etre", kind: "verb", verb: "etre",
    name: "être — present tense",
    icon: "✨",
    desc: "je suis, tu es, il est, nous sommes, vous êtes, ils sont.",
  },
  {
    id: "aller", kind: "verb", verb: "aller",
    name: "aller — present tense",
    icon: "🚶",
    desc: "je vais, tu vas, il va, nous allons, vous allez, ils vont.",
  },
  {
    id: "er", kind: "class", cls: "er",
    name: "-er verbs · class I",
    icon: "🅰️",
    desc: "Regular first-group verbs: parler, aimer, manger… (-e, -es, -e, -ons, -ez, -ent).",
  },
  {
    id: "ir", kind: "class", cls: "ir",
    name: "-ir verbs · class II",
    icon: "🅱️",
    desc: "Regular second-group verbs (finir pattern): finir, choisir, réussir… (-is, -is, -it, -issons, -issez, -issent).",
  },
];

function topicById(id) { return TOPICS.find(t => t.id === id); }
