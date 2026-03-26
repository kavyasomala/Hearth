// ─── General Purpose Helpers ─────────────────────────────────────────────────

/**
 * Safely converts a value to a number, returning null if not valid.
 * Used everywhere we display calories, protein, fiber etc.
 * @param {*} v
 * @returns {number|null}
 */
export const toNum = (v) => {
  const n = Number(v);
  return !isNaN(n) && v !== '' && v !== null && v !== undefined ? n : null;
};

/**
 * Auto-pluralizes ingredient names for display.
 * Only applies to clearly countable nouns — skips mass nouns, liquids, etc.
 * @param {string} name
 * @param {string|number} amount
 * @returns {string}
 */
export const pluralizeIng = (name, amount) => {
  if (!name) return name;
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 1) return name;
  const lower = name.toLowerCase().trim();

  // Never pluralize mass nouns, liquids, powders, or already-plural forms
  const NO_PLURALIZE = [
    'water', 'milk', 'cream', 'oil', 'olive oil', 'coconut oil', 'sesame oil',
    'vegetable oil', 'broth', 'stock', 'juice', 'wine', 'beer', 'vinegar',
    'coconut milk', 'coconut cream', 'buttermilk', 'condensed milk',
    'salt', 'pepper', 'sugar', 'flour', 'cornstarch', 'baking powder',
    'baking soda', 'yeast', 'cocoa', 'cumin', 'turmeric', 'paprika',
    'cinnamon', 'nutmeg', 'cardamom', 'cayenne', 'oregano', 'thyme',
    'sauce', 'paste', 'honey', 'syrup', 'miso', 'tahini', 'butter', 'ghee', 'lard',
    'cheese', 'parmesan', 'cheddar', 'feta', 'mozzarella', 'ricotta',
    'cream cheese', 'brie', 'gouda', 'halloumi', 'creme fraiche',
    'sour cream', 'yogurt', 'greek yogurt',
    'rice', 'pasta', 'bread', 'oats', 'quinoa', 'couscous', 'polenta',
    'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna',
    'cod', 'chicken', 'bacon', 'spinach', 'kale', 'lettuce', 'basil',
    'parsley', 'coriander', 'cilantro', 'dill', 'chives', 'ginger',
    'garlic', 'zest',
  ];

  if (NO_PLURALIZE.some(w => lower === w || lower.endsWith(' ' + w))) return name;
  if (lower.endsWith('s')) return name;

  // Standard English pluralization rules
  if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x') || lower.endsWith('z')) return name + 'es';
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(lower)) return name.slice(0, -1) + 'ies';
  if (lower.endsWith('fe')) return name.slice(0, -2) + 'ves';
  if (lower.endsWith('f') && !lower.endsWith('ff')) return name.slice(0, -1) + 'ves';
  return name + 's';
};

/**
 * Triggers haptic feedback on supported devices.
 * Wrapped in try/catch so it fails silently everywhere else.
 * @param {number[]} pattern - vibration pattern in ms
 */
export const haptic = (pattern = [10]) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
};

/**
 * Auto-extracts keywords from a description string.
 * Used to pre-populate the tooltip keywords field in cooking notes.
 * @param {string} desc
 * @returns {string[]}
 */
export const autoKeywordsFromDescription = (desc) => {
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'it', 'its', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'not', 'no',
    'so', 'if', 'as', 'by', 'from', 'up', 'out', 'more', 'also', 'than',
    'then', 'when', 'always', 'never', 'very', 'too', 'just', 'well',
    'make', 'use', 'your', 'their',
  ]);

  const words = desc.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const seen = new Set();
  const keywords = [];

  for (const w of words) {
    if (w.length >= 4 && !STOP_WORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      keywords.push(w);
      if (keywords.length >= 8) break;
    }
  }

  return keywords;
};

/**
 * Simple localStorage wrapper with JSON parse/stringify.
 * Falls back gracefully if localStorage is unavailable.
 */
export const LS = {
  get: (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  },
};
