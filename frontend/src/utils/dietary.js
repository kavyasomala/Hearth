// ─── Dietary Conflict Detection ──────────────────────────────────────────────
// Checks recipe ingredients against the user's active dietary restrictions
// and returns a list of warnings to display on the recipe page.

/**
 * Maps each dietary restriction to the ingredient keywords that violate it.
 * Keywords are matched as substrings against ingredient names (case-insensitive).
 */
export const DIETARY_CONFLICTS = {
  Vegetarian: {
    label: 'meat/fish',
    keywords: [
      'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon',
      'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'anchovy', 'anchovies',
      'bacon', 'ham', 'sausage', 'pepperoni', 'salami', 'prosciutto',
      'pancetta', 'lard', 'gelatin', 'meat', 'veal', 'bison', 'venison',
      'rabbit', 'mutton',
    ],
  },
  Vegan: {
    label: 'animal products',
    keywords: [
      'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon',
      'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'anchovy', 'anchovies',
      'bacon', 'ham', 'sausage', 'pepperoni', 'salami', 'prosciutto',
      'pancetta', 'lard', 'gelatin', 'meat', 'veal', 'bison', 'venison',
      'rabbit', 'mutton', 'milk', 'cream', 'butter', 'cheese', 'yogurt',
      'egg', 'eggs', 'honey', 'whey', 'casein', 'ghee', 'mayo', 'mayonnaise',
    ],
  },
  'Dairy-Free': {
    label: 'dairy',
    keywords: [
      'milk', 'cream', 'butter', 'cheese', 'yogurt', 'whey', 'casein', 'ghee',
      'cheddar', 'mozzarella', 'parmesan', 'brie', 'feta', 'ricotta',
      'mascarpone', 'sour cream', 'half and half', 'buttermilk', 'kefir',
      'cream cheese', 'crème fraîche', 'condensed milk', 'evaporated milk',
    ],
  },
  'Nut-Free': {
    label: 'nuts',
    keywords: [
      'almond', 'almonds', 'walnut', 'walnuts', 'pecan', 'pecans',
      'cashew', 'cashews', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts',
      'peanut', 'peanuts', 'macadamia', 'pine nut', 'pine nuts',
      'brazil nut', 'brazil nuts', 'chestnut', 'chestnuts',
      'nut butter', 'almond flour', 'almond milk', 'tahini', 'marzipan', 'praline',
    ],
  },
  'Gluten-Free': {
    label: 'gluten',
    keywords: [
      'flour', 'wheat', 'bread', 'pasta', 'barley', 'rye', 'semolina',
      'spelt', 'kamut', 'farro', 'bulgur', 'couscous', 'breadcrumb',
      'breadcrumbs', 'soy sauce', 'teriyaki', 'panko', 'crouton', 'croutons',
      'malt', 'beer', 'seitan', 'triticale',
    ],
    // Some matches need a more specific display message
    exceptions: {
      'soy sauce': 'Soy sauce (contains gluten)',
    },
  },
};

/**
 * Checks a list of recipe ingredients against the user's dietary filters.
 * Returns an array of warnings, one per violated restriction.
 *
 * @param {object[]} ingredients - recipe ingredient objects with .name
 * @param {string[]} dietaryFilters - active restriction labels e.g. ['Vegan', 'Nut-Free']
 * @returns {{ diet: string, label: string, conflicts: string[] }[]}
 */
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

    if (conflicts.length > 0) {
      warnings.push({ diet, label: rule.label, conflicts });
    }
  }

  return warnings;
};
