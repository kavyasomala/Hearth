import { UNIT_CONVERSIONS, WEIGHT_UNITS, VOLUME_UNITS, DIETARY_CONFLICTS } from './constants';

export const haptic = (pattern = [10]) => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
};

// ─── Ingredient substitutions ────────────────────────────────────────────────
// Ingredients that stand in for each other well enough that a recipe should
// still be suggested. Deliberately conservative: swapping within a group should
// change the dish a little, never break it. Matching is exact-after-normalising
// rather than substring, so "coconut milk" is not treated as "milk".

const SUBSTITUTE_GROUPS = [
  ['ground beef', 'ground turkey', 'ground chicken', 'ground pork', 'ground lamb', 'ground veal'],
  ['chicken breast', 'chicken thigh', 'turkey breast'],
  ['chicken stock', 'chicken broth', 'vegetable stock', 'vegetable broth', 'beef stock', 'beef broth'],
  ['olive oil', 'vegetable oil', 'canola oil', 'sunflower oil', 'avocado oil', 'grapeseed oil'],
  ['white vinegar', 'apple cider vinegar', 'rice vinegar', 'white wine vinegar', 'red wine vinegar'],
  ['onion', 'red onion', 'white onion', 'yellow onion', 'brown onion'],
  ['scallion', 'spring onion', 'green onion'],
  ['milk', 'whole milk', 'oat milk', 'almond milk', 'soy milk'],
  ['heavy cream', 'double cream', 'whipping cream'],
  ['butter', 'unsalted butter', 'salted butter'],
  ['parmesan', 'pecorino', 'grana padano'],
  ['soy sauce', 'tamari', 'coconut amino'],
  ['cilantro', 'coriander leaf', 'fresh coriander'],
  ['caster sugar', 'white sugar', 'granulated sugar'],
  ['basmati rice', 'jasmine rice', 'long grain rice', 'white rice'],
  ['penne', 'rigatoni', 'fusilli', 'farfalle'],
  ['cannellini bean', 'butter bean', 'navy bean', 'white bean'],
];

// Lowercase, trim, drop a trailing plural "s" so "thighs" meets "thigh"
const normIng = (s) => String(s ?? '').toLowerCase().trim().replace(/s$/, '');

const SUBSTITUTE_INDEX = (() => {
  const m = new Map();
  SUBSTITUTE_GROUPS.forEach((group, i) => group.forEach(member => m.set(normIng(member), i)));
  return m;
})();

// True when two ingredient names sit in the same substitution group
export function areInterchangeable(a, b) {
  const ga = SUBSTITUTE_INDEX.get(normIng(a));
  return ga !== undefined && ga === SUBSTITUTE_INDEX.get(normIng(b));
}

// What the user actually has that could stand in for `needed`, if anything
export function findSubstitute(needed, kitchenItems) {
  const g = SUBSTITUTE_INDEX.get(normIng(needed));
  if (g === undefined) return null;
  return kitchenItems.find(k => SUBSTITUTE_INDEX.get(normIng(k)) === g) || null;
}

// ─── Ingredient amounts ──────────────────────────────────────────────────────
// Amounts are stored as free text so things like "a pinch" or "1-2" survive
// round-tripping. These helpers give numeric amounts one canonical display form
// (fractions, because 1/2 reads better than 0.5) without touching the rest.

const VULGAR = {
  '¼': 1/4, '½': 1/2, '¾': 3/4, '⅐': 1/7, '⅑': 1/9, '⅒': 1/10,
  '⅓': 1/3, '⅔': 2/3, '⅕': 1/5, '⅖': 2/5, '⅗': 3/5, '⅘': 4/5,
  '⅙': 1/6, '⅚': 5/6, '⅛': 1/8, '⅜': 3/8, '⅝': 5/8, '⅞': 7/8,
};

// Fractions we'll round a *scaled* result to — the ones cooks actually measure.
// 1/16 earns its place once quarter batches are on the table.
const COOK_FRACS  = [[1,16],[1,8],[1,6],[1,4],[1,3],[3,8],[1,2],[5,8],[2,3],[3,4],[5,6],[7,8]];
// Fractions we'll recognise when a typed value lands on one exactly
const EXACT_FRACS = [[1,8],[1,6],[1,5],[1,4],[1,3],[3,8],[2,5],[1,2],[3,5],[5,8],[2,3],[3,4],[4,5],[5,6],[7,8]];

// Strict: returns NaN unless the WHOLE string is one amount, so ranges
// ("1-2") and prose ("a pinch") are left for the caller to pass through.
export function parseAmount(str) {
  if (str == null) return NaN;
  const s = String(str).trim();
  if (!s) return NaN;

  const vulgar = s.match(/^(\d+)?\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (vulgar) return (vulgar[1] ? +vulgar[1] : 0) + VULGAR[vulgar[2]];

  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return +mixed[3] ? +mixed[1] + +mixed[2] / +mixed[3] : NaN;

  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return +frac[2] ? +frac[1] / +frac[2] : NaN;

  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return parseFloat(s);
  return NaN;
}

function toFraction(n, fracs, epsilon) {
  if (!isFinite(n) || n < 0) return String(n);
  if (Math.abs(n - Math.round(n)) < epsilon) return String(Math.round(n));
  const whole = Math.floor(n);
  const rem   = n - whole;
  // Closest match, not first match — otherwise a loose epsilon lets 1/3 claim
  // 0.375 before 3/8 (its exact value) gets a look in.
  let best = null, bestDist = epsilon;
  for (const [num, den] of fracs) {
    const dist = Math.abs(rem - num / den);
    if (dist < bestDist) { bestDist = dist; best = [num, den]; }
  }
  if (best) return whole ? `${whole} ${best[0]}/${best[1]}` : `${best[0]}/${best[1]}`;
  return String(Math.round(n * 100) / 100);
}

// Exact-only — for displaying and canonicalising what someone typed.
// 0.5 → "1/2", but 0.3 stays "0.3" rather than being rounded to "1/3".
export const formatAmount = (n) => toFraction(n, EXACT_FRACS, 1e-6);

// Approximate — for scaled results, where "1/3 cup" beats "0.333 cup".
export const formatScaledAmount = (n) => toFraction(n, COOK_FRACS, 0.05);

// ─── Units ───────────────────────────────────────────────────────────────────
// One spelling per unit. Recipes arrive with "Tbsp.", "tablespoons", "T" and
// "tbs" all meaning the same thing, which makes amounts look inconsistent and
// breaks any grouping that compares units as strings.

const UNIT_CANON = {
  // Single-letter t/T are handled separately — they differ only by case
  tsp:  ['tsp', 'teaspoon'],
  tbsp: ['tbsp', 'tablespoon', 'tbs', 'tbl'],
  cup:  ['cup', 'c'],
  oz:   ['oz', 'ounce'],
  'fl oz': ['fl oz', 'floz', 'fluid ounce'],
  lb:   ['lb', 'pound', '#'],
  g:    ['g', 'gram', 'gm'],
  kg:   ['kg', 'kilogram', 'kilo'],
  ml:   ['ml', 'milliliter', 'millilitre', 'cc'],
  l:    ['l', 'liter', 'litre'],
  qt:   ['qt', 'quart'],
  pt:   ['pt', 'pint'],
  gal:  ['gal', 'gallon'],
  clove: ['clove'],
  can:  ['can', 'tin'],
  pkg:  ['pkg', 'package', 'packet'],
  slice: ['slice'],
  piece: ['piece', 'pc'],
  bunch: ['bunch'],
  stalk: ['stalk', 'rib'],
  head: ['head'],
  sprig: ['sprig'],
  pinch: ['pinch'],
  dash: ['dash'],
  handful: ['handful'],
  stick: ['stick'],
  jar: ['jar'],
  bag: ['bag'],
  sheet: ['sheet'],
  fillet: ['fillet'],
  rasher: ['rasher'],
  knob: ['knob'],
  block: ['block'],
  strip: ['strip'],
  splash: ['splash'],
};

// Units written out in full agree with the amount; abbreviations never do
// ("2 tbsp", not "2 tbsps"). Anything not listed here is left as it is.
const UNIT_PLURAL = {
  cup: 'cups', clove: 'cloves', can: 'cans', pkg: 'pkgs', slice: 'slices',
  piece: 'pieces', bunch: 'bunches', stalk: 'stalks', head: 'heads',
  sprig: 'sprigs', pinch: 'pinches', dash: 'dashes', handful: 'handfuls',
  stick: 'sticks', jar: 'jars', bag: 'bags', sheet: 'sheets',
  fillet: 'fillets', rasher: 'rashers', knob: 'knobs', block: 'blocks',
  strip: 'strips', splash: 'splashes',
};

const UNIT_LOOKUP = (() => {
  const m = new Map();
  for (const [canon, forms] of Object.entries(UNIT_CANON)) {
    for (const f of forms) m.set(f.toLowerCase(), canon);
  }
  return m;
})();

// Canonical unit, or the lower-cased original when it isn't one we know.
// Case and a trailing period/plural are stripped before lookup, so "Tbsp.",
// "tablespoons" and "TBSP" all land on "tbsp". Must agree with the copy in
// backend/server.js, which normalises the same values on write.
export function normalizeUnit(unit) {
  const raw = String(unit ?? '').trim();
  if (!raw) return '';
  // Recipe convention: capital T is tablespoon, lowercase t is teaspoon.
  // These must be checked before lowercasing, or one silently overwrites the other.
  const bare = raw.replace(/\.$/, '');
  if (bare === 'T') return 'tbsp';
  if (bare === 't') return 'tsp';
  const key = bare.toLowerCase();
  return UNIT_LOOKUP.get(key)            // exact ("tbsp", "cup")
      ?? UNIT_LOOKUP.get(key.replace(/s$/, ''))   // plural ("cups", "cloves")
      ?? key;                            // unknown units still land in lower case
}

// Display form of a unit: canonical spelling, agreeing with the amount.
// "1 cup" / "2 cups", but "2 tbsp" stays abbreviated.
export function formatUnit(unit, amount) {
  const canon = normalizeUnit(unit);
  if (!canon) return '';
  const n = parseAmount(amount);
  if (!isFinite(n) || Math.abs(n) <= 1) return canon;
  return UNIT_PLURAL[canon] ?? canon;
}

// Collapses runs of whitespace and drops zero-width characters, which trim()
// leaves behind. A stray one of these is what put a gap in front of the comma
// between an ingredient and its prep note.
export function cleanIngName(name) {
  return String(name ?? '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // A stored name should never end in punctuation; a trailing comma renders
    // as "lime, , zested" once the prep note is appended.
    .replace(/[,;:.]+$/, '')
    .trim();
}

// Prep notes are free text, so only case and stray edge punctuation are
// touched. Rows written before normalisation existed still read as "Day old",
// so display calls this too rather than trusting what is stored.
export function normalizePrep(note) {
  const clean = String(note ?? '').trim()
    .replace(/^[,;]+\s*/, '').replace(/[,;]+\s*$/, '').trim();
  return clean ? clean.toLowerCase() : '';
}

// Canonical display form of a stored amount; non-numeric text passes through.
export function normalizeAmount(str) {
  const n = parseAmount(str);
  return isFinite(n) ? formatAmount(n) : (str ?? '');
}

// Amount scaled by `scale`, formatted for display. Non-numeric text passes through.
export function scaleAmount(str, scale) {
  const n = parseAmount(str);
  if (!isFinite(n)) return str ?? '';
  if (scale === 1) return formatAmount(n);
  return formatScaledAmount(n * scale);
}

export const pct = (score) => Math.round(score * 100);

export const toNum = (v) => {
  const n = Number(v);
  return (!isNaN(n) && v !== '' && v !== null && v !== undefined) ? n : null;
};

// Mass nouns and already-plural staples: these never change with the amount,
// in either direction.
const NO_PLURALIZE = [
  'water','milk','cream','oil','olive oil','coconut oil','sesame oil','vegetable oil','broth','stock',
  'juice','wine','beer','vinegar','coconut milk','coconut cream','buttermilk','condensed milk',
  'salt','pepper','sugar','flour','cornstarch','baking powder','baking soda','yeast','cocoa',
  'cumin','turmeric','paprika','cinnamon','nutmeg','cardamom','cayenne','oregano','thyme',
  'sauce','paste','honey','syrup','miso','tahini','butter','ghee','lard',
  'cheese','parmesan','cheddar','feta','mozzarella','ricotta','cream cheese','brie','gouda',
  'halloumi','creme fraiche','sour cream','yogurt','greek yogurt',
  'rice','pasta','bread','oats','quinoa','couscous','polenta',
  'beef','pork','lamb','turkey','duck','fish','salmon','tuna','cod','chicken','bacon',
  'spinach','kale','lettuce','basil','parsley','coriander','cilantro','dill','chives',
  'ginger','garlic','zest',
  // Already plural, so neither direction should touch them
  'greens','grits','sprinkles','capers','noodles','breadcrumbs',
];

// The handful of food words ending in -o that take -oes rather than -os.
// Everything else (avocado, burrito, taco) just takes -s, so this is a list
// rather than a rule.
const O_ES = ['tomato', 'potato', 'mango', 'volcano'];
const takesOes = (lower) => O_ES.some(w => lower === w || lower.endsWith(' ' + w));
const isOesPlural = (lower) => O_ES.some(w => lower === w + 'es' || lower.endsWith(' ' + w + 'es'));

const isUncountable = (lower) =>
  NO_PLURALIZE.some(w => lower === w || lower.endsWith(' ' + w));

export const pluralizeIng = (name, amount) => {
  if (!name) return name;
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 1) return name;
  const lower = name.toLowerCase().trim();
  if (isUncountable(lower)) return name;
  if (lower.endsWith('s')) return name;
  if (takesOes(lower)) return name + 'es';
  if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x') || lower.endsWith('z')) return name + 'es';
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(lower)) return name.slice(0, -1) + 'ies';
  if (lower.endsWith('fe')) return name.slice(0, -2) + 'ves';
  if (lower.endsWith('f') && !lower.endsWith('ff')) return name.slice(0, -1) + 'ves';
  return name + 's';
};

// Words that are already singular despite the trailing s, so stripping it
// would produce nonsense ("hummu", "asparagu").
const KEEPS_ITS_S = /(ss|us|is)$/;

// The inverse of pluralizeIng, used when an amount drops back to one.
// Deliberately cautious: anything it is not confident about is left alone,
// since a wrong singular reads worse than an unchanged plural.
export const singularizeIng = (name) => {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  if (isUncountable(lower) || !lower.endsWith('s') || KEEPS_ITS_S.test(lower)) return name;
  if (isOesPlural(lower)) return name.slice(0, -2);
  if (lower.endsWith('ies') && lower.length > 4)  return name.slice(0, -3) + 'y';
  if (lower.endsWith('ves')) return name.slice(0, -3) + (/(kni|li|wi)ves$/.test(lower) ? 'fe' : 'f');
  if (/(ch|sh|x|z)es$/.test(lower)) return name.slice(0, -2);
  return name.slice(0, -1);
};

// Display form of an ingredient name: number agreement against the amount.
// With a unit the name is a measurement, so it stays singular ("2 cups
// banana"); without one it is a count ("2 bananas", "1 banana").
export const formatIngName = (name, amount, unit) => {
  const clean = cleanIngName(name);
  if (!clean) return clean;
  if (normalizeUnit(unit)) return singularizeIng(clean);
  const n = parseAmount(amount);
  if (!isFinite(n)) return clean;
  return Math.abs(n) > 1 ? pluralizeIng(clean, n) : singularizeIng(clean);
};

export const checkDietaryConflicts = (ingredients, dietaryFilters) => {
  if (!dietaryFilters?.length || !ingredients?.length) return [];
  const warnings = [];
  for (const diet of dietaryFilters) {
    const rule = DIETARY_CONFLICTS[diet];
    if (!rule) continue;
    const conflicts = [];
    for (const ing of ingredients) {
      const name = (ing.name || '').toLowerCase().trim();
      if (!name) continue;
      const matched = rule.keywords.find(k => name.includes(k));
      if (matched) {
        const exceptionKey = Object.keys(rule.exceptions || {}).find(k => name.includes(k));
        conflicts.push(exceptionKey ? rule.exceptions[exceptionKey] : ing.name);
      }
    }
    if (conflicts.length > 0) warnings.push({ diet, label: rule.label, conflicts });
  }
  return warnings;
};

export const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
export const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

export const unitType = (u) => {
  const l = (u || '').toLowerCase().trim();
  if (WEIGHT_UNITS.has(l)) return 'weight';
  if (VOLUME_UNITS.has(l)) return 'volume';
  return 'other';
};

export const formatWeight = (g) => {
  if (g >= 900) return `${(g / 1000).toFixed(2).replace(/\.?0+$/, '')} kg`;
  return `${Math.round(g)} g`;
};

export const formatVolume = (ml) => {
  if (ml >= 900) return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L`;
  if (ml >= 14) return `${(ml / 236.588).toFixed(2).replace(/\.?0+$/, '')} cups`;
  if (ml >= 5) return `${(ml / 14.7868).toFixed(2).replace(/\.?0+$/, '')} tbsp`;
  return `${(ml / 4.92892).toFixed(2).replace(/\.?0+$/, '')} tsp`;
};

export const consolidateItems = (items) => {
  const map = {};
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (!map[key]) { map[key] = { ...item, _sources: [...(item._sources || [item])] }; continue; }
    const existing = map[key];
    const amt1 = parseFloat(existing.amount) || 0;
    const amt2 = parseFloat(item.amount) || 0;
    const t1 = unitType(existing.unit);
    const t2 = unitType(item.unit);
    if (t1 === t2 && t1 !== 'other' && t1 !== '') {
      const base1 = amt1 * (UNIT_CONVERSIONS[(existing.unit || '').toLowerCase().trim()] || 1);
      const base2 = amt2 * (UNIT_CONVERSIONS[(item.unit || '').toLowerCase().trim()] || 1);
      const total = base1 + base2;
      const formatted = t1 === 'weight' ? formatWeight(total) : formatVolume(total);
      const parts = formatted.split(' ');
      existing.amount = parts[0];
      existing.unit = parts.slice(1).join(' ');
      existing._sources.push(item);
    } else if (!existing.unit && !item.unit && amt1 && amt2) {
      existing.amount = String(amt1 + amt2);
      existing._sources.push(item);
    } else {
      const extra = [item.amount, item.unit].filter(Boolean).join(' ');
      existing._extra = existing._extra ? `${existing._extra} + ${extra}` : extra;
      existing._sources.push(item);
    }
  }
  return Object.values(map);
};
