// ─── Unit Conversion Utilities ───────────────────────────────────────────────
// Used primarily in the grocery list to consolidate ingredient amounts
// across multiple recipes (e.g. "1 cup + 2 tbsp butter" → "1.13 cups butter")

/** Full conversion table: unit name → ml (volume) or grams (weight) */
export const UNIT_CONVERSIONS = {
  // Weight → grams
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, pound: 453.592, pounds: 453.592,
  // Volume → ml
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  cup: 236.588, cups: 236.588,
  'fl oz': 29.5735, 'fluid oz': 29.5735,
};

const WEIGHT_UNITS = new Set([
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds',
]);

const VOLUME_UNITS = new Set([
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres',
  'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups', 'fl oz', 'fluid oz',
]);

/** Returns 'weight', 'volume', or 'other' for a given unit string */
export const unitType = (u) => {
  const l = (u || '').toLowerCase().trim();
  if (WEIGHT_UNITS.has(l)) return 'weight';
  if (VOLUME_UNITS.has(l)) return 'volume';
  return 'other';
};

/** Formats a gram value back to a readable weight string */
export const formatWeight = (g) => {
  if (g >= 900) return `${(g / 1000).toFixed(2).replace(/\.?0+$/, '')} kg`;
  return `${Math.round(g)} g`;
};

/** Formats an ml value back to a readable volume string */
export const formatVolume = (ml) => {
  if (ml >= 900) return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L`;
  if (ml >= 14)  return `${(ml / 236.588).toFixed(2).replace(/\.?0+$/, '')} cups`;
  if (ml >= 5)   return `${(ml / 14.7868).toFixed(2).replace(/\.?0+$/, '')} tbsp`;
  return `${(ml / 4.92892).toFixed(2).replace(/\.?0+$/, '')} tsp`;
};

/**
 * Consolidates a flat list of grocery items by name,
 * merging amounts where units are compatible.
 * Items with incompatible units get an _extra note instead.
 *
 * @param {object[]} items
 * @returns {object[]}
 */
export const consolidateItems = (items) => {
  const map = {};

  for (const item of items) {
    const key = item.name.toLowerCase().trim();

    if (!map[key]) {
      map[key] = { ...item, _sources: [...(item._sources || [item])] };
      continue;
    }

    const existing = map[key];
    const amt1 = parseFloat(existing.amount) || 0;
    const amt2 = parseFloat(item.amount) || 0;
    const t1 = unitType(existing.unit);
    const t2 = unitType(item.unit);

    if (t1 === t2 && t1 !== 'other' && t1 !== '') {
      // Same unit type — convert to base and sum
      const base1 = amt1 * (UNIT_CONVERSIONS[(existing.unit || '').toLowerCase().trim()] || 1);
      const base2 = amt2 * (UNIT_CONVERSIONS[(item.unit || '').toLowerCase().trim()] || 1);
      const total = base1 + base2;
      const formatted = t1 === 'weight' ? formatWeight(total) : formatVolume(total);
      const parts = formatted.split(' ');
      existing.amount = parts[0];
      existing.unit = parts.slice(1).join(' ');
      existing._sources.push(item);
    } else if (!existing.unit && !item.unit && amt1 && amt2) {
      // Both unitless (e.g. "3 eggs") — just add the numbers
      existing.amount = String(amt1 + amt2);
      existing._sources.push(item);
    } else {
      // Can't merge — append as a note
      const extra = [item.amount, item.unit].filter(Boolean).join(' ');
      existing._extra = existing._extra ? `${existing._extra} + ${extra}` : extra;
      existing._sources.push(item);
    }
  }

  return Object.values(map);
};
