import { UNIT_CONVERSIONS, WEIGHT_UNITS, VOLUME_UNITS, DIETARY_CONFLICTS } from './constants';

export const haptic = (pattern = [10]) => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
};

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

export const pluralizeIng = (name, amount) => {
  if (!name) return name;
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 1) return name;
  const lower = name.toLowerCase().trim();

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
  ];
  if (NO_PLURALIZE.some(w => lower === w || lower.endsWith(' ' + w))) return name;
  if (lower.endsWith('s')) return name;
  if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x') || lower.endsWith('z')) return name + 'es';
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(lower)) return name.slice(0, -1) + 'ies';
  if (lower.endsWith('fe')) return name.slice(0, -2) + 'ves';
  if (lower.endsWith('f') && !lower.endsWith('ff')) return name.slice(0, -1) + 'ves';
  return name + 's';
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
