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

// ─── Grocery category mapping ─────────────────────────────────────────────────
// Categories intentionally mirror the Kitchen tab: Produce, Meat & Fish, Dairy,
// Sauces, Spices, Alcohol, Staples, Other
const CATEGORY_MAP = {
  produce: [
    'onion','garlic','ginger','tomato','tomatoes','lemon','lime','spinach',
    'carrot','carrots','celery','potato','potatoes','bell pepper','cucumber',
    'zucchini','broccoli','cauliflower','mushroom','mushrooms','avocado',
    'lettuce','kale','cabbage','spring onion','scallion','shallot','shallots',
    'chilli','chili','jalapeño','capsicum','leek','asparagus','eggplant',
    'aubergine','sweet potato','pumpkin','butternut squash','beetroot','radish',
    'green beans','peas','corn','coriander','cilantro','parsley','basil',
    'mint','thyme','rosemary','dill','chives','bay leaves','lemongrass',
    'orange','lime leaves','thai basil','apple','banana','mango','berry',
    'berries','strawberry','blueberry','peach','pear','grape','cherry',
  ],
  'meat & fish': [
    'chicken','beef','pork','lamb','turkey','duck','bacon','sausage','mince',
    'ground beef','ground pork','steak','salmon','tuna','shrimp','prawns',
    'cod','tilapia','fish','crab','lobster','scallops','mussels','anchovies',
    'ham','pancetta','prosciutto','chorizo','salami','veal','brisket','ribs',
    'meatball','swordfish','trout','halibut','clams','oysters','squid','calamari',
  ],
  dairy: [
    'egg','eggs','milk','butter','cream','heavy cream','double cream','sour cream',
    'yogurt','greek yogurt','cheese','parmesan','cheddar','feta','mozzarella',
    'ricotta','cream cheese','brie','gouda','halloumi','creme fraiche','ghee',
    'buttermilk','condensed milk','coconut milk','coconut cream',
  ],
  sauces: [
    'soy sauce','fish sauce','oyster sauce','hoisin sauce','worcestershire sauce',
    'hot sauce','sriracha','ketchup','mayonnaise','ranch','caesar dressing',
    'italian dressing','tomato paste','tomato sauce','passata','canned tomatoes',
    'diced tomatoes','peanut butter','tahini','miso','mustard','dijon mustard',
    'bbq sauce','teriyaki sauce','sambal','chilli sauce','aioli','pesto',
    'hummus','vinaigrette','maple syrup','honey',
  ],
  spices: [
    'salt','pepper','black pepper','cumin','coriander powder','turmeric','paprika',
    'smoked paprika','chilli flakes','cayenne','cinnamon','nutmeg','cardamom',
    'cloves','star anise','bay leaf','oregano','dried thyme','dried rosemary',
    'dried basil','mixed herbs','curry powder','garam masala','five spice',
    'white pepper','msg','sesame seeds','chilli powder','allspice',
    'vanilla extract','baking powder','baking soda','yeast',
  ],
  alcohol: [
    'wine','red wine','white wine','beer','vodka','rum','whiskey','bourbon',
    'gin','tequila','brandy','sake','mirin','rice wine','sherry','port',
    'champagne','prosecco','vermouth','kahlua',
  ],
  staples: [
    'rice','pasta','noodles','flour','bread','breadcrumbs','panko','oats',
    'quinoa','lentils','chickpeas','black beans','kidney beans','cannellini beans',
    'split peas','couscous','polenta','cornmeal','tortilla','wrap','pita',
    'stock','broth','chicken stock','beef stock','vegetable stock',
    'oil','olive oil','sesame oil','vegetable oil','coconut oil',
    'vinegar','balsamic vinegar','rice vinegar','apple cider vinegar',
    'sugar','brown sugar','cornstarch','cornflour','chocolate','cocoa',
    'dried pasta','udon','rice noodles','glass noodles','wonton wrappers',
    'frozen peas','frozen corn','frozen spinach','frozen edamame',
    'frozen berries','ice cream','frozen prawns','frozen shrimp',
  ],
};

function categorise(ingredientName) {
  const lower = ingredientName.toLowerCase().trim();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k) || k.includes(lower))) return cat;
  }
  return 'other';
}

const CATEGORY_META = {
  'produce':     { emoji: '🥦', order: 1 },
  'meat & fish': { emoji: '🥩', order: 2 },
  'dairy':       { emoji: '🥛', order: 3 },
  'sauces':      { emoji: '🫙', order: 4 },
  'spices':      { emoji: '🧂', order: 5 },
  'alcohol':     { emoji: '🍷', order: 6 },
  'staples':     { emoji: '🌾', order: 7 },
  'other':       { emoji: '🛒', order: 8 },
};

// ─── GET /api/recipes ───────────────────────────────────────────────────────
app.get('/api/recipes', async (req, res) => {
  try {
    const sql = `
      SELECT
        r.id, r.name, r.cuisine, r.calories, r.protein, r.fiber,
        r.time, r.servings, r.cover_image_url AS "coverImage", r.status,
        r.mealpreppable, r.make_soon, r.link,
        r.cookbook, r.reference,
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
    const { rows } = await query(
      'SELECT name, type, calories, protein, fiber FROM ingredients ORDER BY name ASC;'
    );
    res.json({ ingredients: rows });
  } catch (err) {
    console.error('GET /api/ingredients error:', err);
    res.status(500).json({ error: 'Failed to load ingredients' });
  }
});

// ─── POST /api/ingredients ──────────────────────────────────────────────────
app.post('/api/ingredients', async (req, res) => {
  const { name, type, calories, protein, fiber } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await query(
      `INSERT INTO ingredients (name, type, calories, protein, fiber)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         type     = EXCLUDED.type,
         calories = EXCLUDED.calories,
         protein  = EXCLUDED.protein,
         fiber    = EXCLUDED.fiber
       RETURNING name, type, calories, protein, fiber`,
      [name.trim().toLowerCase(), type || 'staple', calories ?? null, protein ?? null, fiber ?? null]
    );
    res.json({ ingredient: rows[0] });
  } catch (err) {
    console.error('POST /api/ingredients error:', err);
    res.status(500).json({ error: err.message || 'Failed to create ingredient' });
  }
});

// ─── PUT /api/ingredients/:name ─────────────────────────────────────────────
app.put('/api/ingredients/:name', async (req, res) => {
  const oldName = decodeURIComponent(req.params.name).toLowerCase().trim();
  const { name, type, calories, protein, fiber } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const newName = name.trim().toLowerCase();
  try {
    const { rows } = await query(
      `UPDATE ingredients SET
         name     = $1,
         type     = $2,
         calories = $3,
         protein  = $4,
         fiber    = $5
       WHERE name = $6
       RETURNING name, type, calories, protein, fiber`,
      [newName, type || 'staple', calories ?? null, protein ?? null, fiber ?? null, oldName]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ ingredient: rows[0] });
  } catch (err) {
    console.error('PUT /api/ingredients/:name error:', err);
    res.status(500).json({ error: err.message || 'Failed to update ingredient' });
  }
});

// ─── DELETE /api/ingredients/:name ──────────────────────────────────────────
app.delete('/api/ingredients/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name).toLowerCase().trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove from all recipe body ingredients first (FK constraint)
    await client.query(
      `DELETE FROM recipe_body_ingredients
       WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = $1)`,
      [name]
    );
    const { rowCount } = await client.query('DELETE FROM ingredients WHERE name = $1', [name]);
    await client.query('COMMIT');
    if (!rowCount) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ deleted: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE /api/ingredients/:name error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete ingredient' });
  } finally {
    client.release();
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
        r.cookbook, r.reference,
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

// ─── POST /api/recipes ──────────────────────────────────────────────────────
app.post('/api/recipes', async (req, res) => {
  const { details, ingredients, instructions, notes } = req.body;
  if (!details?.name?.trim()) return res.status(400).json({ error: 'Recipe name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: recipeRows } = await client.query(`
      INSERT INTO recipes
        (name, cuisine, time, servings, calories, protein, cover_image_url,
         status, cookbook, reference)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      details.name.trim(),
      details.cuisine || null,
      details.time || null,
      details.servings || null,
      details.calories !== '' && details.calories != null ? Number(details.calories) : null,
      details.protein  !== '' && details.protein  != null ? Number(details.protein)  : null,
      details.cover_image_url || null,
      details.status || null,
      details.cookbook || null,
      details.reference || details.page_number || null,
    ]);
    const newId = recipeRows[0].id;

    // Tags
    if (Array.isArray(details.tags)) {
      for (const tagName of details.tags) {
        const { rows: tagRows } = await client.query(
          `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [tagName]
        );
        await client.query(
          `INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newId, tagRows[0].id]
        );
      }
    }

    // Ingredients
    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        const ingName = ing.name?.trim().toLowerCase();
        if (!ingName) continue;
        const { rows: ingRows } = await client.query(
          `INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [ingName]
        );
        await client.query(
          `INSERT INTO recipe_body_ingredients
             (recipe_id, ingredient_id, amount, unit, prep_note, optional, group_label, order_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [newId, ingRows[0].id, ing.amount || null, ing.unit || null,
           ing.prep_note || null, Boolean(ing.optional), ing.group_label || null, ing.order_index ?? 0]
        );
      }
    }

    // Instructions
    if (Array.isArray(instructions)) {
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO instructions (recipe_id, step_number, body_text) VALUES ($1,$2,$3)`,
          [newId, step.step_number, step.body_text.trim()]
        );
      }
    }

    // Notes
    if (Array.isArray(notes)) {
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        await client.query(
          `INSERT INTO notes (recipe_id, order_index, body_text) VALUES ($1,$2,$3)`,
          [newId, note.order_index ?? 0, text]
        );
      }
    }

    await client.query('COMMIT');

    const { rows } = await client.query(
      `SELECT *, cover_image_url AS "coverImage" FROM recipes WHERE id = $1`, [newId]
    );
    res.status(201).json({ recipe: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/recipes error:', err);
    res.status(500).json({ error: err.message || 'Failed to create recipe' });
  } finally {
    client.release();
  }
});

// ─── PUT /api/recipes/:id ───────────────────────────────────────────────────
app.put('/api/recipes/:id', async (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE recipes SET
        name              = $1,
        cuisine           = $2,
        time              = $3,
        servings          = $4,
        calories          = $5,
        protein           = $6,
        cover_image_url   = $7,
        status            = $8,
        cookbook          = $9,
        reference         = $10
      WHERE id = $11
    `, [
      details.name,
      details.cuisine || null,
      details.time || null,
      details.servings || null,
      details.calories !== '' && details.calories != null ? Number(details.calories) : null,
      details.protein  !== '' && details.protein  != null ? Number(details.protein)  : null,
      details.cover_image_url || null,
      details.status || null,
      details.cookbook || null,
      details.reference || details.page_number || null,
      id,
    ]);

    // Update tags if provided
    const tagList = details.tags ?? req.body.tags;
    if (Array.isArray(tagList)) {
      await client.query('DELETE FROM recipe_tags WHERE recipe_id = $1', [id]);
      for (const tagName of tagList) {
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

    // Only update sections if explicitly provided
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
          `INSERT INTO recipe_body_ingredients
             (recipe_id, ingredient_id, amount, unit, prep_note, optional, group_label, order_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, ingRows[0].id, ing.amount || null, ing.unit || null,
           ing.prep_note || null, Boolean(ing.optional), ing.group_label || null, ing.order_index ?? 0]
        );
      }
    }

    if (instructions !== null && instructions !== undefined) {
      await client.query('DELETE FROM instructions WHERE recipe_id = $1', [id]);
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO instructions (recipe_id, step_number, body_text) VALUES ($1,$2,$3)`,
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
          `INSERT INTO notes (recipe_id, order_index, body_text) VALUES ($1,$2,$3)`,
          [id, note.order_index ?? 0, text]
        );
      }
    }

    await client.query('COMMIT');

    const { rows } = await client.query(`
      SELECT r.*, r.cover_image_url AS "coverImage",
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

// ─── DELETE /api/recipes/:id ────────────────────────────────────────────────
app.delete('/api/recipes/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete child rows first to respect FK constraints
    await client.query('DELETE FROM notes                   WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM instructions            WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM recipe_body_ingredients WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM recipe_tags             WHERE recipe_id = $1', [id]);
    const { rowCount } = await client.query('DELETE FROM recipes WHERE id = $1', [id]);
    await client.query('COMMIT');
    if (!rowCount) return res.status(404).json({ error: 'Recipe not found' });
    res.json({ deleted: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE /api/recipes/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete recipe' });
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

    // Aggregate: group by ingredient name + unit so we can sum numeric amounts
    // Key: `${ingredient_name}||${unit}` to keep same-unit quantities together
    const itemMap = new Map();
    for (const row of rows) {
      const ingKey = `${row.ingredient_name.toLowerCase().trim()}||${(row.unit || '').toLowerCase().trim()}`;
      if (!itemMap.has(ingKey)) {
        itemMap.set(ingKey, {
          name: row.ingredient_name,
          amounts: [],           // collect all numeric amounts
          rawAmounts: [],        // collect all raw amount strings (for non-numeric)
          unit: row.unit || '',
          prep_note: row.prep_note || '',
          optional: Boolean(row.optional),
          recipes: [],
          category: categorise(row.ingredient_name),
        });
      }
      const entry = itemMap.get(ingKey);
      // Track recipe name
      if (!entry.recipes.includes(row.recipe_name)) entry.recipes.push(row.recipe_name);
      // Accumulate amounts
      const n = row.amount ? parseFloat(row.amount) : NaN;
      if (!isNaN(n)) {
        entry.amounts.push(n);
      } else if (row.amount) {
        entry.rawAmounts.push(row.amount);
      }
    }

    const catMap = new Map();
    for (const item of itemMap.values()) {
      let displayAmount = '';
      if (item.amounts.length > 0) {
        const total = item.amounts.reduce((a, b) => a + b, 0);
        // Format: integer if whole, otherwise 1 decimal
        displayAmount = Number.isInteger(total) ? String(total) : total.toFixed(1).replace(/\.0$/, '');
        // If there were also non-numeric entries, append them
        if (item.rawAmounts.length > 0) displayAmount += ' + ' + item.rawAmounts.join(' + ');
      } else if (item.rawAmounts.length > 0) {
        displayAmount = item.rawAmounts.join(' + ');
      }

      if (!catMap.has(item.category)) catMap.set(item.category, []);
      catMap.get(item.category).push({
        name: item.name,
        amount: displayAmount,
        unit: item.unit,
        prep_note: item.prep_note,
        optional: item.optional,
        recipes: item.recipes,
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

// ─── POST /api/cook-log ─────────────────────────────────────────────────────
app.post('/api/cook-log', async (req, res) => {
  const { recipe_id, recipe_name, rating, notes, cooked_at } = req.body;
  // Allow either a real recipe_id (UUID) or just a recipe_name for cookbook-only entries
  const hasRealId = recipe_id && !String(recipe_id).startsWith('ref-');
  if (!hasRealId && !recipe_name) return res.status(400).json({ error: 'recipe_id or recipe_name is required' });
  try {
    const { rows } = await query(`
      INSERT INTO cook_log (recipe_id, recipe_name, rating, notes, cooked_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      hasRealId ? recipe_id : null,
      recipe_name?.trim() || null,
      rating ?? null,
      notes?.trim() || null,
      cooked_at ? new Date(cooked_at) : new Date(),
    ]);
    res.json({ entry: rows[0] });
  } catch (err) {
    console.error('POST /api/cook-log error:', err);
    res.status(500).json({ error: err.message || 'Failed to save cook log' });
  }
});

// ─── GET /api/cook-log ──────────────────────────────────────────────────────
app.get('/api/cook-log', async (req, res) => {
  try {
    let sql = 'SELECT * FROM cook_log';
    const params = [];
    if (req.query.recipe_id) {
      sql += ' WHERE recipe_id = $1';
      params.push(req.query.recipe_id);
    }
    sql += ' ORDER BY cooked_at DESC';
    const { rows } = await query(sql, params);
    res.json({ entries: rows });
  } catch (err) {
    console.error('GET /api/cook-log error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch cook log' });
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
