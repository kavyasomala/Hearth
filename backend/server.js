const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
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

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set in .env');
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

// ─── Auth Middleware ─────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ─── Grocery category mapping ─────────────────────────────────────────────────
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

// ─── POST /api/auth/register ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const existing = await query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Username already taken' });
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'guest') RETURNING id, username, role`,
      [username.trim().toLowerCase(), password]
    );
    const user = rows[0];
    await query(`INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res.status(500).json({ error: err.message || 'Failed to register' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid username or password' });
    const user = rows[0];
    if (user.role === 'suspended') return res.status(403).json({ error: 'Your account has been suspended.' });
    if (password !== user.password_hash) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name || null, role: user.role } });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ error: err.message || 'Failed to login' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query('SELECT id, username, display_name, role FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── POST /api/auth/create-user (admin only) ────────────────────────────────
app.post('/api/auth/create-user', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const existing = await query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Username already taken' });
    const { rows } = await query(
      `INSERT INTO users (username, display_name, password_hash, role) VALUES ($1, $2, $3, 'guest') RETURNING id, username, display_name, role`,
      [username.trim().toLowerCase(), display_name?.trim() || null, password]
    );
    await query(`INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [rows[0].id]);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('POST /api/auth/create-user error:', err);
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

// ─── GET /api/admin/users (admin only) ───────────────────────────────────────
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, display_name, password_hash AS password, role, created_at FROM users ORDER BY created_at ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── PUT /api/user/display-name ───────────────────────────────────────────────
app.put('/api/user/display-name', authenticateToken, async (req, res) => {
  const { display_name } = req.body;
  try {
    await query(`UPDATE users SET display_name = $1 WHERE id = $2`, [display_name?.trim() || null, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update display name' });
  }
});

// ─── PUT /api/admin/users/:id (admin only) — suspend/restore/reset password ──
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, password } = req.body;
  try {
    if (role !== undefined) {
      await query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
    }
    if (password !== undefined) {
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [password, id]);
    }
    const { rows } = await query(`SELECT id, username, role FROM users WHERE id = $1`, [id]);
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── DELETE /api/admin/users/:id (admin only) ────────────────────────────────
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM user_settings WHERE user_id = $1`, [id]);
    await query(`DELETE FROM user_favorites WHERE user_id = $1`, [id]);
    await query(`DELETE FROM user_make_soon WHERE user_id = $1`, [id]);
    await query(`DELETE FROM user_cook_log WHERE user_id = $1`, [id]);
    await query(`DELETE FROM user_kitchen WHERE user_id = $1`, [id]);
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── GET /api/user/settings ──────────────────────────────────────────────────
app.get('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT hide_incompatible, dietary_filters FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    if (!rows.length) {
      // Create default settings if missing
      await query(`INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [req.user.id]);
      return res.json({ hide_incompatible: false, dietary_filters: [] });
    }
    res.json({ hide_incompatible: rows[0].hide_incompatible, dietary_filters: rows[0].dietary_filters || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ─── PUT /api/user/settings ──────────────────────────────────────────────────
app.put('/api/user/settings', authenticateToken, async (req, res) => {
  const { hide_incompatible, dietary_filters } = req.body;
  try {
    await query(
      `INSERT INTO user_settings (user_id, hide_incompatible, dietary_filters)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         hide_incompatible = EXCLUDED.hide_incompatible,
         dietary_filters   = EXCLUDED.dietary_filters`,
      [req.user.id, hide_incompatible ?? false, dietary_filters ?? []]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── GET /api/user/kitchen ───────────────────────────────────────────────────
app.get('/api/user/kitchen', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT ingredient_name, storage_type FROM user_kitchen WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ kitchen: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch kitchen' });
  }
});

// ─── PUT /api/user/kitchen ───────────────────────────────────────────────────
// Replaces the entire kitchen list for the user
app.put('/api/user/kitchen', authenticateToken, async (req, res) => {
  const { kitchen } = req.body; // [{ ingredient_name, storage_type }]
  if (!Array.isArray(kitchen)) return res.status(400).json({ error: 'kitchen must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_kitchen WHERE user_id = $1', [req.user.id]);
    for (const item of kitchen) {
      if (!item.ingredient_name?.trim()) continue;
      await client.query(
        `INSERT INTO user_kitchen (user_id, ingredient_name, storage_type) VALUES ($1, $2, $3)`,
        [req.user.id, item.ingredient_name.toLowerCase().trim(), item.storage_type || 'fridge']
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to save kitchen' });
  } finally {
    client.release();
  }
});

// ─── GET /api/user/favorites ─────────────────────────────────────────────────
app.get('/api/user/favorites', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT recipe_id FROM user_favorites WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ favorites: rows.map(r => r.recipe_id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// ─── PUT /api/user/favorites ─────────────────────────────────────────────────
app.put('/api/user/favorites', authenticateToken, async (req, res) => {
  const { favorites } = req.body; // array of recipe UUIDs
  if (!Array.isArray(favorites)) return res.status(400).json({ error: 'favorites must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_favorites WHERE user_id = $1', [req.user.id]);
    for (const recipeId of favorites) {
      await client.query(
        `INSERT INTO user_favorites (user_id, recipe_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.user.id, recipeId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to save favorites' });
  } finally {
    client.release();
  }
});

// ─── GET /api/user/make-soon ─────────────────────────────────────────────────
app.get('/api/user/make-soon', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT recipe_id FROM user_make_soon WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ makeSoon: rows.map(r => r.recipe_id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch make soon' });
  }
});

// ─── PUT /api/user/make-soon ─────────────────────────────────────────────────
app.put('/api/user/make-soon', authenticateToken, async (req, res) => {
  const { makeSoon } = req.body; // array of recipe UUIDs
  if (!Array.isArray(makeSoon)) return res.status(400).json({ error: 'makeSoon must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_make_soon WHERE user_id = $1', [req.user.id]);
    for (const recipeId of makeSoon) {
      await client.query(
        `INSERT INTO user_make_soon (user_id, recipe_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.user.id, recipeId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to save make soon' });
  } finally {
    client.release();
  }
});

// ─── GET /api/recipes ───────────────────────────────────────────────────────
app.get('/api/recipes', async (req, res) => {
  try {
    const sql = `
      SELECT
        r.id, r.name, r.cuisine, r.calories, r.protein, r.fiber,
        r.time, r.servings, r.cover_image_url AS "coverImage", r.status,
        r.cookbook, r.reference,
        COALESCE(r.tags, '{}') AS tags,
        COALESCE(
          (SELECT array_agg(i.name ORDER BY i.name)
           FROM recipe_body_ingredients rbi
           JOIN ingredients i ON i.id = rbi.ingredient_id
           WHERE rbi.recipe_id = r.id), '{}'
        ) AS ingredients
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
      'SELECT name, type, calories, protein, fiber, grams_per_unit FROM ingredients ORDER BY name ASC;'
    );
    res.json({ ingredients: rows });
  } catch (err) {
    console.error('GET /api/ingredients error:', err);
    res.status(500).json({ error: 'Failed to load ingredients' });
  }
});

// ─── POST /api/ingredients ──────────────────────────────────────────────────
app.post('/api/ingredients', authenticateToken, requireAdmin, async (req, res) => {
  const { name, type, calories, protein, fiber, grams_per_unit } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await query(
      `INSERT INTO ingredients (name, type, calories, protein, fiber, grams_per_unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET
         type           = EXCLUDED.type,
         calories       = EXCLUDED.calories,
         protein        = EXCLUDED.protein,
         fiber          = EXCLUDED.fiber,
         grams_per_unit = EXCLUDED.grams_per_unit
       RETURNING name, type, calories, protein, fiber, grams_per_unit`,
      [name.trim().toLowerCase(), type || 'staple', calories ?? null, protein ?? null, fiber ?? null, grams_per_unit ?? null]
    );
    res.json({ ingredient: rows[0] });
  } catch (err) {
    console.error('POST /api/ingredients error:', err);
    res.status(500).json({ error: err.message || 'Failed to create ingredient' });
  }
});

// ─── PUT /api/ingredients/:name ─────────────────────────────────────────────
app.put('/api/ingredients/:name', authenticateToken, requireAdmin, async (req, res) => {
  const oldName = decodeURIComponent(req.params.name).toLowerCase().trim();
  const { name, type, calories, protein, fiber, grams_per_unit } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const newName = name.trim().toLowerCase();
  try {
    const { rows } = await query(
      `UPDATE ingredients SET
         name           = $1,
         type           = $2,
         calories       = $3,
         protein        = $4,
         fiber          = $5,
         grams_per_unit = $6
       WHERE name = $7
       RETURNING name, type, calories, protein, fiber, grams_per_unit`,
      [newName, type || 'staple', calories ?? null, protein ?? null, fiber ?? null, grams_per_unit ?? null, oldName]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ ingredient: rows[0] });
  } catch (err) {
    console.error('PUT /api/ingredients/:name error:', err);
    res.status(500).json({ error: err.message || 'Failed to update ingredient' });
  }
});

// ─── DELETE /api/ingredients/:name ──────────────────────────────────────────
app.delete('/api/ingredients/:name', authenticateToken, requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name).toLowerCase().trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
        r.id, r.name, r.cuisine, r.calories, r.protein, r.fiber,
        r.time, r.servings, r.cover_image_url AS "coverImage",
        r.status, r.cookbook, r.reference,
        COALESCE(r.tags, '{}') AS tags,
        COALESCE(
          (SELECT array_agg(i.name ORDER BY i.name)
           FROM recipe_body_ingredients rbi
           JOIN ingredients i ON i.id = rbi.ingredient_id
           WHERE rbi.recipe_id = r.id), '{}'
        ) AS ingredients
      FROM recipes r
      WHERE r.id = $1
      LIMIT 1;
    `, [id]);

    if (!recipeRows.length) return res.status(404).json({ error: 'Recipe not found' });
    const recipe = { ...recipeRows[0], ingredients: recipeRows[0].ingredients || [], tags: recipeRows[0].tags || [] };

    const { rows: ingRows } = await query(`
      SELECT
        rbi.id, i.name, rbi.amount, rbi.unit, rbi.prep_note,
        rbi.optional, rbi.group_label, rbi.order_index
      FROM recipe_body_ingredients rbi
      JOIN ingredients i ON i.id = rbi.ingredient_id
      WHERE rbi.recipe_id = $1
      ORDER BY rbi.order_index ASC, i.name ASC;
    `, [id]);

    const { rows: instrRows } = await query(`
      SELECT id, step_number, body_text, timer_seconds
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
      instructions: instrRows.map(r => ({ id: r.id, step_number: r.step_number, body_text: r.body_text, timer_seconds: r.timer_seconds ?? null })),
      notes: notesRows,
    });
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

// ─── POST /api/recipes ──────────────────────────────────────────────────────
app.post('/api/recipes', authenticateToken, requireAdmin, async (req, res) => {
  const { details, ingredients, instructions, notes } = req.body;
  if (!details?.name?.trim()) return res.status(400).json({ error: 'Recipe name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: recipeRows } = await client.query(`
      INSERT INTO recipes
        (name, cuisine, time, servings, calories, protein, fiber, cover_image_url,
         status, cookbook, reference, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
    `, [
      details.name.trim(),
      details.cuisine || null,
      details.time || null,
      details.servings || null,
      details.calories !== '' && details.calories != null ? Number(details.calories) : null,
      details.protein  !== '' && details.protein  != null ? Number(details.protein)  : null,
      details.fiber    !== '' && details.fiber    != null ? Number(details.fiber)    : null,
      details.cover_image_url || null,
      details.status || null,
      details.cookbook || null,
      details.reference || details.page_number || null,
      Array.isArray(details.tags) ? details.tags : [],
    ]);
    const newId = recipeRows[0].id;

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
          `INSERT INTO instructions (recipe_id, step_number, body_text, timer_seconds) VALUES ($1,$2,$3,$4)`,
          [newId, step.step_number, step.body_text.trim(), step.timer_seconds ?? null]
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
app.put('/api/recipes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE recipes SET
        name            = $1,
        cuisine         = $2,
        time            = $3,
        servings        = $4,
        calories        = $5,
        protein         = $6,
        cover_image_url = $7,
        status          = $8,
        cookbook        = $9,
        reference       = $10,
        tags            = $11
      WHERE id = $12
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
      Array.isArray(details.tags) ? details.tags : [],
      id,
    ]);

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
          `INSERT INTO instructions (recipe_id, step_number, body_text, timer_seconds) VALUES ($1,$2,$3,$4)`,
          [id, step.step_number, step.body_text.trim(), step.timer_seconds ?? null]
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
        COALESCE(r.tags, '{}') AS tags,
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
app.delete('/api/recipes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM notes                   WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM instructions            WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM recipe_body_ingredients WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM user_favorites          WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM user_make_soon          WHERE recipe_id = $1', [id]);
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
        rbi.amount, rbi.unit, rbi.prep_note, rbi.optional
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
      const ingKey = `${row.ingredient_name.toLowerCase().trim()}||${(row.unit || '').toLowerCase().trim()}`;
      if (!itemMap.has(ingKey)) {
        itemMap.set(ingKey, {
          name: row.ingredient_name,
          amounts: [], rawAmounts: [],
          unit: row.unit || '',
          prep_note: row.prep_note || '',
          optional: Boolean(row.optional),
          recipes: [],
          category: categorise(row.ingredient_name),
        });
      }
      const entry = itemMap.get(ingKey);
      if (!entry.recipes.includes(row.recipe_name)) entry.recipes.push(row.recipe_name);
      const n = row.amount ? parseFloat(row.amount) : NaN;
      if (!isNaN(n)) entry.amounts.push(n);
      else if (row.amount) entry.rawAmounts.push(row.amount);
    }

    const catMap = new Map();
    for (const item of itemMap.values()) {
      let displayAmount = '';
      if (item.amounts.length > 0) {
        const total = item.amounts.reduce((a, b) => a + b, 0);
        displayAmount = Number.isInteger(total) ? String(total) : total.toFixed(1).replace(/\.0$/, '');
        if (item.rawAmounts.length > 0) displayAmount += ' + ' + item.rawAmounts.join(' + ');
      } else if (item.rawAmounts.length > 0) {
        displayAmount = item.rawAmounts.join(' + ');
      }
      if (!catMap.has(item.category)) catMap.set(item.category, []);
      catMap.get(item.category).push({
        name: item.name, amount: displayAmount, unit: item.unit,
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

// ─── POST /api/user/cook-log ─────────────────────────────────────────────────
app.post('/api/user/cook-log', authenticateToken, async (req, res) => {
  const { recipe_id, recipe_name, rating, notes, cooked_at } = req.body;
  const hasRealId = recipe_id && typeof recipe_id === 'string' && !recipe_id.startsWith('ref-') && recipe_id.length > 10;
  if (!hasRealId && !recipe_name?.trim()) return res.status(400).json({ error: 'recipe_id or recipe_name is required' });
  try {
    const { rows } = await query(`
      INSERT INTO user_cook_log (recipe_id, recipe_name, rating, notes, cooked_at, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      hasRealId ? recipe_id : null,
      recipe_name?.trim() || null,
      rating ?? null,
      notes?.trim() || null,
      cooked_at ? new Date(cooked_at) : new Date(),
      req.user.id,
    ]);
    res.json({ entry: rows[0] });
  } catch (err) {
    console.error('POST /api/user/cook-log error:', err);
    res.status(500).json({ error: err.message || 'Failed to save cook log' });
  }
});

// ─── GET /api/user/cook-log ──────────────────────────────────────────────────
app.get('/api/user/cook-log', authenticateToken, async (req, res) => {
  try {
    let sql = 'SELECT * FROM user_cook_log WHERE user_id = $1';
    const params = [req.user.id];
    if (req.query.recipe_id) {
      sql += ` AND recipe_id = $2`;
      params.push(req.query.recipe_id);
    }
    sql += ' ORDER BY cooked_at DESC';
    const { rows } = await query(sql, params);
    res.json({ entries: rows });
  } catch (err) {
    console.error('GET /api/user/cook-log error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch cook log' });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🍳 Hearth API running on http://localhost:${PORT}`));
