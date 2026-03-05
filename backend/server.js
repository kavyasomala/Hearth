const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: 'https://hearth-z2lo.onrender.com'
}));
app.use(express.json());

// ─── Postgres client ────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ─── Grocery category mapping ───────────────────────────────────────────────
const CATEGORY_MAP = {
  produce: ['onion', 'garlic', 'ginger', 'tomato', 'tomatoes', 'lemon', 'lime', 'spinach',
    'carrot', 'carrots', 'celery', 'potato', 'potatoes', 'bell pepper', 'cucumber',
    'zucchini', 'broccoli', 'cauliflower', 'mushroom', 'mushrooms', 'avocado',
    'lettuce', 'kale', 'cabbage', 'spring onion', 'scallion', 'shallot', 'shallots',
    'chilli', 'chili', 'jalapeño', 'capsicum', 'leek', 'asparagus', 'eggplant',
    'aubergine', 'sweet potato', 'pumpkin', 'butternut squash', 'beetroot', 'radish',
    'green beans', 'peas', 'corn', 'coriander', 'cilantro', 'parsley', 'basil',
    'mint', 'thyme', 'rosemary', 'dill', 'chives', 'bay leaves', 'lemongrass',
    'orange', 'lime leaves', 'thai basil'],

  'meat & seafood': ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon',
    'sausage', 'mince', 'ground beef', 'ground pork', 'steak', 'salmon', 'tuna',
    'shrimp', 'prawns', 'cod', 'tilapia', 'fish', 'crab', 'lobster', 'scallops',
    'mussels', 'anchovies', 'ham', 'pancetta', 'prosciutto', 'chorizo', 'salami'],

  'dairy & eggs': ['egg', 'eggs', 'milk', 'butter', 'cream', 'heavy cream', 'double cream',
    'sour cream', 'yogurt', 'greek yogurt', 'cheese', 'parmesan', 'cheddar', 'feta',
    'mozzarella', 'ricotta', 'cream cheese', 'brie', 'gouda', 'halloumi',
    'creme fraiche', 'ghee', 'buttermilk', 'condensed milk', 'coconut milk',
    'coconut cream'],

  'pantry & dry goods': ['rice', 'pasta', 'noodles', 'flour', 'bread', 'breadcrumbs',
    'panko', 'oats', 'quinoa', 'lentils', 'chickpeas', 'black beans', 'kidney beans',
    'cannellini beans', 'lentil', 'split peas', 'couscous', 'polenta', 'cornmeal',
    'tortilla', 'wrap', 'pita', 'stock', 'broth', 'chicken stock', 'beef stock',
    'vegetable stock', 'oil', 'olive oil', 'sesame oil', 'vegetable oil', 'coconut oil',
    'vinegar', 'balsamic vinegar', 'rice vinegar', 'apple cider vinegar',
    'soy sauce', 'fish sauce', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce',
    'tomato paste', 'tomato sauce', 'passata', 'canned tomatoes', 'diced tomatoes',
    'coconut milk', 'sugar', 'brown sugar', 'honey', 'maple syrup', 'cornstarch',
    'cornflour', 'baking powder', 'baking soda', 'yeast', 'vanilla extract',
    'chocolate', 'cocoa', 'peanut butter', 'tahini', 'miso', 'dried pasta',
    'udon', 'rice noodles', 'glass noodles', 'wonton wrappers'],

  'spices & condiments': ['salt', 'pepper', 'black pepper', 'cumin', 'coriander',
    'turmeric', 'paprika', 'smoked paprika', 'chilli flakes', 'cayenne', 'cinnamon',
    'nutmeg', 'cardamom', 'cloves', 'star anise', 'bay leaf', 'oregano', 'thyme',
    'dried thyme', 'dried rosemary', 'dried basil', 'mixed herbs', 'curry powder',
    'garam masala', 'five spice', 'mustard', 'dijon mustard', 'hot sauce', 'sriracha',
    'ketchup', 'mayonnaise', 'ranch', 'caesar dressing', 'italian dressing',
    'white pepper', 'msg', 'sesame seeds', 'chilli powder'],

  frozen: ['frozen peas', 'frozen corn', 'frozen spinach', 'frozen edamame',
    'frozen berries', 'ice cream', 'frozen prawns', 'frozen shrimp'],
};

function categorise(ingredientName) {
  const lower = ingredientName.toLowerCase().trim();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k) || k.includes(lower))) return cat;
  }
  return 'other';
}

const CATEGORY_META = {
  'produce':            { emoji: '🥦', order: 1 },
  'meat & seafood':     { emoji: '🥩', order: 2 },
  'dairy & eggs':       { emoji: '🥚', order: 3 },
  'pantry & dry goods': { emoji: '🫙', order: 4 },
  'spices & condiments':{ emoji: '🧂', order: 5 },
  'frozen':             { emoji: '🧊', order: 6 },
  'other':              { emoji: '🛒', order: 7 },
};

// ─── GET /api/recipes ───────────────────────────────────────────────────────
app.get('/api/recipes', async (req, res) => {
  try {
    const sql = `
      SELECT
        r.id, r.name, r.cuisine, r.calories, r.protein, r.fiber,
        r.time, r.servings, r.cover_image_url AS "coverImage", r.status,
        r.mealpreppable, r.make_soon, r.link,
        COALESCE(
          (SELECT array_agg(i.name ORDER BY i.name)
           FROM recipe_body_ingredients rbi
           JOIN ingredients i ON i.id = rbi.ingredient_id
           WHERE rbi.recipe_id = r.id), '{}'
        ) AS ingredients,
        COALESCE(
          (SELECT array_agg(t.name ORDER BY t.name)
           FROM recipe_tags rt
           JOIN tags t ON t.id = rt.tag_id
           WHERE rt.recipe_id = r.id), '{}'
        ) AS tags
      FROM recipes r
      ORDER BY r.name;
    `;
    const { rows } = await query(sql);
    res.json({ recipes: rows.map(r => ({ ...r, ingredients: r.ingredients || [], tags: r.tags || [] })) });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

// ─── GET /api/ingredients ───────────────────────────────────────────────────
app.get('/api/ingredients', async (req, res) => {
  try {
    const { rows } = await query('SELECT name, type FROM ingredients ORDER BY name ASC;');
    res.json({ ingredients: rows });
  } catch (err) {
    console.error('GET /api/ingredients error:', err);
    res.status(500).json({ error: 'Failed to load ingredients' });
  }
});

// ─── GET /api/recipes/:id ───────────────────────────────────────────────────
app.get('/api/recipes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: recipeRows } = await query(`
      SELECT
        r.id, r.notion_id, r.name, r.cuisine, r.calories, r.protein, r.fiber,
        r.time, r.servings, r.cover_image_url AS "coverImage",
        r.status, r.mealpreppable, r.make_soon, r.link,
        COALESCE(
          (SELECT array_agg(i.name ORDER BY i.name)
           FROM recipe_body_ingredients rbi
           JOIN ingredients i ON i.id = rbi.ingredient_id
           WHERE rbi.recipe_id = r.id), '{}'
        ) AS ingredients,
        COALESCE(
          (SELECT array_agg(t.name ORDER BY t.name)
           FROM recipe_tags rt
           JOIN tags t ON t.id = rt.tag_id
           WHERE rt.recipe_id = r.id), '{}'
        ) AS tags
      FROM recipes r
      WHERE r.id = $1
      LIMIT 1;
    `, [id]);

    if (!recipeRows.length) return res.status(404).json({ error: 'Recipe not found' });
    const recipe = { ...recipeRows[0], ingredients: recipeRows[0].ingredients || [], tags: recipeRows[0].tags || [] };

    const { rows: ingRows } = await query(`
      SELECT
        rbi.id,
        i.name,
        rbi.amount,
        rbi.unit,
        rbi.prep_note,
        rbi.optional,
        rbi.group_label,
        rbi.order_index
      FROM recipe_body_ingredients rbi
      JOIN ingredients i ON i.id = rbi.ingredient_id
      WHERE rbi.recipe_id = $1
      ORDER BY rbi.order_index ASC, i.name ASC;
    `, [id]);

    const { rows: instrRows } = await query(`
      SELECT id, step_number, body_text
      FROM instructions
      WHERE recipe_id = $1
      ORDER BY step_number ASC;
    `, [id]);

    const { rows: notesRows } = await query(`
      SELECT id, order_index, body_text AS text
      FROM notes
      WHERE recipe_id = $1
      ORDER BY order_index ASC;
    `, [id]);

    res.json({
      recipe,
      bodyIngredients: ingRows,
      instructions: instrRows.map(r => ({ id: r.id, step_number: r.step_number, body_text: r.body_text })),
      notes: notesRows,
    });
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

// ─── PUT /api/recipes/:id ───────────────────────────────────────────────────
app.put('/api/recipes/:id', async (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Always update core recipe details
    await client.query(`
      UPDATE recipes SET
        name             = $1,
        cuisine          = $2,
        time             = $3,
        servings         = $4,
        calories         = $5,
        protein          = $6,
        cover_image_url  = $7,
        status           = $8
      WHERE id = $9
    `, [
      details.name,
      details.cuisine || null,
      details.time || null,
      details.servings || null,
      details.calories !== '' && details.calories != null ? Number(details.calories) : null,
      details.protein  !== '' && details.protein  != null ? Number(details.protein)  : null,
      details.cover_image_url || null,
      details.status || null,
      id,
    ]);

    // Update tags if provided
    if (Array.isArray(req.body.tags)) {
      await client.query('DELETE FROM recipe_tags WHERE recipe_id = $1', [id]);
      for (const tagName of req.body.tags) {
        const { rows: tagRows } = await client.query(
          `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [tagName]
        );
        await client.query(
          `INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, tagRows[0].id]
        );
      }
    }

    // Only update ingredients/instructions/notes if the section was explicitly provided (not null)
    if (ingredients !== null && ingredients !== undefined) {
      await client.query('DELETE FROM recipe_body_ingredients WHERE recipe_id = $1', [id]);
      for (const ing of ingredients) {
        const ingName = ing.name?.trim().toLowerCase();
        if (!ingName) continue;
        const { rows: ingRows } = await client.query(
          `INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [ingName]
        );
        await client.query(
          `INSERT INTO recipe_body_ingredients (recipe_id, ingredient_id, amount, unit, prep_note, optional, group_label, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, ingRows[0].id, ing.amount || null, ing.unit || null, ing.prep_note || null, Boolean(ing.optional), ing.group_label || null, ing.order_index ?? 0]
        );
      }
    }

    if (instructions !== null && instructions !== undefined) {
      await client.query('DELETE FROM instructions WHERE recipe_id = $1', [id]);
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO instructions (recipe_id, step_number, body_text) VALUES ($1, $2, $3)`,
          [id, step.step_number, step.body_text.trim()]
        );
      }
    }

    if (notes !== null && notes !== undefined) {
      await client.query('DELETE FROM notes WHERE recipe_id = $1', [id]);
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        await client.query(
          `INSERT INTO notes (recipe_id, order_index, body_text) VALUES ($1, $2, $3)`,
          [id, note.order_index ?? 0, text]
        );
      }
    }

    await client.query('COMMIT');

    const { rows } = await client.query(`
      SELECT r.*,
        r.cover_image_url AS "coverImage",
        COALESCE(
          (SELECT array_agg(i.name ORDER BY i.name)
           FROM recipe_body_ingredients rbi
           JOIN ingredients i ON i.id = rbi.ingredient_id
           WHERE rbi.recipe_id = r.id), '{}'
        ) AS ingredients
      FROM recipes r WHERE r.id = $1
    `, [id]);

    res.json({ recipe: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/recipes/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to save recipe' });
  } finally {
    client.release();
  }
});

// ─── POST /api/match ────────────────────────────────────────────────────────
app.post('/api/match', async (req, res) => {
  try {
    const { fridgeIngredients, recipes } = req.body;
    if (!Array.isArray(fridgeIngredients) || !Array.isArray(recipes))
      return res.status(400).json({ error: 'Invalid payload' });

    const fridge = new Set(fridgeIngredients.map(i => i.toLowerCase().trim()));
    const matched = recipes.map(recipe => {
      const ings = recipe.ingredients || [];
      const have = ings.filter(i => fridge.has(i));
      const missing = ings.filter(i => !fridge.has(i));
      const matchScore = ings.length === 0 ? 0 : have.length / ings.length;
      return { ...recipe, have, missing, matchScore, canMake: missing.length === 0 && ings.length > 0 };
    });
    matched.sort((a, b) => {
      if (a.canMake && !b.canMake) return -1;
      if (!a.canMake && b.canMake) return 1;
      return b.matchScore - a.matchScore;
    });
    res.json({ matched });
  } catch (err) {
    console.error('POST /api/match error:', err);
    res.status(500).json({ error: 'Failed to match recipes' });
  }
});

// ─── POST /api/grocery-list ─────────────────────────────────────────────────
app.post('/api/grocery-list', async (req, res) => {
  const { recipeIds } = req.body;
  if (!Array.isArray(recipeIds) || recipeIds.length === 0)
    return res.status(400).json({ error: 'recipeIds must be a non-empty array' });

  try {
    const { rows } = await query(`
      SELECT
        r.id   AS recipe_id,
        r.name AS recipe_name,
        i.name AS ingredient_name,
        rbi.amount,
        rbi.unit,
        rbi.prep_note,
        rbi.optional
      FROM recipes r
      JOIN recipe_body_ingredients rbi ON rbi.recipe_id = r.id
      JOIN ingredients i ON i.id = rbi.ingredient_id
      WHERE r.id = ANY($1::uuid[])
      ORDER BY i.name ASC;
    `, [recipeIds]);

    if (!rows.length) return res.json({ categories: [], recipeNames: [] });

    const recipeNameMap = new Map();
    for (const row of rows) recipeNameMap.set(row.recipe_id, row.recipe_name);
    const recipeNames = Array.from(recipeNameMap.values());

    const itemMap = new Map();
    for (const row of rows) {
      const key = row.ingredient_name.toLowerCase().trim();
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          name: row.ingredient_name,
          amount: row.amount || '',
          unit: row.unit || '',
          prep_note: row.prep_note || '',
          optional: Boolean(row.optional),
          recipes: [],
          category: categorise(row.ingredient_name),
        });
      }
      const entry = itemMap.get(key);
      if (!entry.recipes.includes(row.recipe_name)) entry.recipes.push(row.recipe_name);
    }

    const catMap = new Map();
    for (const item of itemMap.values()) {
      if (!catMap.has(item.category)) catMap.set(item.category, []);
      catMap.get(item.category).push({
        name: item.name, amount: item.amount, unit: item.unit,
        prep_note: item.prep_note, optional: item.optional, recipes: item.recipes,
      });
    }

    const categories = Array.from(catMap.entries())
      .sort((a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99))
      .map(([cat, items]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        emoji: CATEGORY_META[cat]?.emoji ?? '🛒',
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    res.json({ categories, recipeNames });
  } catch (err) {
    console.error('POST /api/grocery-list error:', err);
    res.status(500).json({ error: 'Failed to build grocery list' });
  }
});

// ─── Stubs ──────────────────────────────────────────────────────────────────
app.post('/api/parse-ingredients', (_req, res) =>
  res.status(501).json({ error: 'Not implemented.' }));

app.post('/api/save-ingredients', (_req, res) =>
  res.status(501).json({ error: 'Not implemented.' }));

// ─── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🍳 Recipe API running on http://localhost:${PORT}`));
