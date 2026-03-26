// ─── Nutrition Utilities ─────────────────────────────────────────────────────

/**
 * Unit → grams/ml conversion factors.
 * Weight units convert to grams, volume units convert to ml.
 */
export const UNIT_GRAMS = {
  g: 1, kg: 1000, oz: 28.35, lb: 453.6,
  cup: 240, cups: 240, ml: 1, l: 1000,
  tbsp: 15, tsp: 5,
};

/**
 * Calculates total nutrition (calories, protein, fiber) for a list of recipe ingredients
 * by matching them against the full ingredient database.
 *
 * Skips ingredients with no nutrition data, or where the unit can't be converted.
 *
 * @param {object[]} ings - recipe ingredient objects with .name, .amount, .unit
 * @param {object[]} allIngredients - full ingredient DB objects with .calories, .protein, .fiber, .grams_per_unit
 * @returns {{ calories: number, protein: number, fiber: number } | null}
 */
export const calcNutrition = (ings, allIngredients = []) => {
  let totalCal = 0, totalProt = 0, totalFiber = 0, matched = 0;

  for (const ing of (ings || [])) {
    if (ing._isGroup) continue;

    const name = (ing.name || '').toLowerCase().trim();

    // Try exact match first, then substring match
    const dbIng = allIngredients.find(a => {
      const n = (typeof a === 'string' ? a : a.name || '').toLowerCase();
      return n === name;
    }) || allIngredients.find(a => {
      const n = (typeof a === 'string' ? a : a.name || '').toLowerCase();
      return name.includes(n) || n.includes(name);
    });

    if (!dbIng || typeof dbIng === 'string') continue;
    if (dbIng.calories == null) continue;

    const amount = parseFloat(ing.amount) || 1;
    const unit = (ing.unit || '').toLowerCase().trim();
    let gramsTotal;

    if (UNIT_GRAMS[unit]) {
      // Known weight/volume unit
      gramsTotal = amount * UNIT_GRAMS[unit];
    } else if (dbIng.grams_per_unit) {
      // Unitless (e.g. "3 eggs") — use the per-unit weight from the DB
      gramsTotal = amount * dbIng.grams_per_unit;
    } else {
      // No way to convert — skip
      continue;
    }

    const factor = gramsTotal / 100;
    totalCal   += (dbIng.calories || 0) * factor;
    totalProt  += (dbIng.protein  || 0) * factor;
    totalFiber += (dbIng.fiber    || 0) * factor;
    matched++;
  }

  return matched > 0
    ? { calories: Math.round(totalCal), protein: Math.round(totalProt), fiber: Math.round(totalFiber) }
    : null;
};
