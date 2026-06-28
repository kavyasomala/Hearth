import { UNIT_CONVERSIONS, WEIGHT_UNITS, VOLUME_UNITS, DIETARY_CONFLICTS } from './constants';

export const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

export const haptic = (pattern = [10]) => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
};

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
