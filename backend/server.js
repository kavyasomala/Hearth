/**
 * Hearth API — server.js
 *
 * Architecture:
 *  - PostgreSQL (Supabase) for storage — persistent across all deploys, no sync needed
 *  - JWT for auth — tokens last 30 days, stored client-side
 *  - Passwords stored as plaintext (private family app, not public SaaS)
 */

const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'https://hearth-z2lo.onrender.com' }));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const q = (sql, params) => pool.query(sql, params);
const uuid = () => crypto.randomUUID();

async function initDB() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      display_name  TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT DEFAULT 'guest',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS recipes (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      cuisine         TEXT,
      time            TEXT,
      servings        TEXT,
      cover_image_url TEXT,
      status          TEXT,
      cookbook        TEXT,
      reference       TEXT,
      tags            TEXT DEFAULT '[]',
      calories        TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id          TEXT PRIMARY KEY,
      recipe_id   TEXT NOT NULL REFERENCES recipes(id),
      name        TEXT NOT NULL,
      amount      TEXT,
      unit        TEXT,
      prep_note   TEXT,
      optional    BOOLEAN DEFAULT FALSE,
      group_label TEXT,
      order_index INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS instructions (
      id            TEXT PRIMARY KEY,
      recipe_id     TEXT NOT NULL REFERENCES recipes(id),
      step_number   INTEGER,
      body_text     TEXT,
      timer_seconds INTEGER,
      group_label   TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS recipe_notes (
      id          TEXT PRIMARY KEY,
      recipe_id   TEXT NOT NULL REFERENCES recipes(id),
      order_index INTEGER DEFAULT 0,
      body_text   TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS cookbooks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      author      TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      spine_color TEXT DEFAULT '#C65D3B',
      notes       TEXT DEFAULT '',
      recipes     TEXT DEFAULT '[]',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS cooking_notes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      type       TEXT DEFAULT 'rule',
      category   TEXT DEFAULT 'General Technique',
      image_url  TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS cooking_note_bullets (
      id          TEXT PRIMARY KEY,
      note_id     TEXT NOT NULL REFERENCES cooking_notes(id),
      text        TEXT,
      order_index INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS cooking_note_keywords (
      note_id TEXT NOT NULL REFERENCES cooking_notes(id),
      keyword TEXT NOT NULL,
      PRIMARY KEY (note_id, keyword)
    )`,
    `CREATE TABLE IF NOT EXISTS user_favorites (
      user_id   TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_make_soon (
      user_id   TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_cook_log (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      recipe_id   TEXT,
      recipe_name TEXT,
      rating      INTEGER,
      notes       TEXT,
      cooked_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS user_kitchen (
      user_id         TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      storage_type    TEXT DEFAULT 'fridge',
      PRIMARY KEY (user_id, ingredient_name)
    )`,
  ];
  for (const sql of tables) await q(sql);
  console.log('🗄️  Database ready (13 tables)');
}

// ─── Grocery Category Mapping ─────────────────────────────────────────────────

const CATEGORY_MAP = {
  produce:       ['onion','garlic','ginger','tomato','tomatoes','lemon','lime','spinach','carrot','carrots','celery','potato','potatoes','bell pepper','cucumber','zucchini','broccoli','cauliflower','mushroom','mushrooms','avocado','lettuce','kale','cabbage','spring onion','scallion','shallot','shallots','chilli','chili','jalapeño','capsicum','leek','asparagus','eggplant','aubergine','sweet potato','pumpkin','butternut squash','beetroot','radish','green beans','peas','corn','coriander','cilantro','parsley','basil','mint','thyme','rosemary','dill','chives','bay leaves','lemongrass','orange','lime leaves','thai basil','apple','banana','mango','berry','berries','strawberry','blueberry','peach','pear','grape','cherry'],
  'meat & fish': ['chicken','beef','pork','lamb','turkey','duck','bacon','sausage','mince','ground beef','ground pork','steak','salmon','tuna','shrimp','prawns','cod','tilapia','fish','crab','lobster','scallops','mussels','anchovies','ham','pancetta','prosciutto','chorizo','salami','veal','brisket','ribs','meatball','swordfish','trout','halibut','clams','oysters','squid','calamari'],
  dairy:         ['egg','eggs','milk','butter','cream','heavy cream','double cream','sour cream','yogurt','greek yogurt','cheese','parmesan','cheddar','feta','mozzarella','ricotta','cream cheese','brie','gouda','halloumi','creme fraiche','ghee','buttermilk','condensed milk','coconut milk','coconut cream'],
  sauces:        ['soy sauce','fish sauce','oyster sauce','hoisin sauce','worcestershire sauce','hot sauce','sriracha','ketchup','mayonnaise','ranch','caesar dressing','tomato paste','tomato sauce','passata','canned tomatoes','diced tomatoes','peanut butter','tahini','miso','mustard','dijon mustard','bbq sauce','teriyaki sauce','sambal','chilli sauce','aioli','pesto','hummus','vinaigrette','maple syrup','honey'],
  spices:        ['salt','pepper','black pepper','cumin','coriander powder','turmeric','paprika','smoked paprika','chilli flakes','cayenne','cinnamon','nutmeg','cardamom','cloves','star anise','bay leaf','oregano','dried thyme','dried rosemary','dried basil','mixed herbs','curry powder','garam masala','five spice','white pepper','msg','sesame seeds','chilli powder','allspice','vanilla extract','baking powder','baking soda','yeast'],
  alcohol:       ['wine','red wine','white wine','beer','vodka','rum','whiskey','bourbon','gin','tequila','brandy','sake','mirin','rice wine','sherry','port','champagne','prosecco','vermouth','kahlua'],
  staples:       ['rice','pasta','noodles','flour','bread','breadcrumbs','panko','oats','quinoa','lentils','chickpeas','black beans','kidney beans','cannellini beans','split peas','couscous','polenta','cornmeal','tortilla','wrap','pita','stock','broth','chicken stock','beef stock','vegetable stock','oil','olive oil','sesame oil','vegetable oil','coconut oil','vinegar','balsamic vinegar','rice vinegar','apple cider vinegar','sugar','brown sugar','cornstarch','cornflour','chocolate','cocoa','dried pasta','udon','rice noodles','glass noodles','wonton wrappers','frozen peas','frozen corn','frozen spinach','frozen edamame','frozen berries','ice cream','frozen prawns','frozen shrimp'],
};
const CATEGORY_META = {
  produce:       { emoji: '🥦', order: 1 },
  'meat & fish': { emoji: '🥩', order: 2 },
  dairy:         { emoji: '🥛', order: 3 },
  sauces:        { emoji: '🫙', order: 4 },
  spices:        { emoji: '🧂', order: 5 },
  alcohol:       { emoji: '🍷', order: 6 },
  staples:       { emoji: '🌾', order: 7 },
  other:         { emoji: '🛒', order: 8 },
};

const KEYWORD_INDEX = new Map();
for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
  for (const kw of keywords) KEYWORD_INDEX.set(kw, cat);
}

function categorise(name) {
  const lower = name.toLowerCase().trim();
  if (KEYWORD_INDEX.has(lower)) return KEYWORD_INDEX.get(lower);
  for (const [kw, cat] of KEYWORD_INDEX) {
    if (lower.includes(kw)) return cat;
  }
  return 'other';
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRecipe   = r => ({ ...r, tags: JSON.parse(r.tags || '[]'), coverImage: r.cover_image_url });
const fmtCookbook = r => ({ ...r, recipes: JSON.parse(r.recipes || '[]'), coverImage: r.cover_image, spineColor: r.spine_color });

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const existing = await q('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Username already taken' });
    const id = uuid();
    await q(`INSERT INTO users (id, username, display_name, password_hash, role) VALUES ($1,$2,$3,$4,'guest')`, [id, username.trim().toLowerCase(), null, password]);
    const { rows: [user] } = await q('SELECT id, username, display_name, role FROM users WHERE id = $1', [id]);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const { rows: [user] } = await q('SELECT * FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (!user)                        return res.status(401).json({ error: 'Invalid username or password' });
    if (user.role === 'suspended')    return res.status(403).json({ error: 'Your account has been suspended.' });
    if (password !== user.password_hash) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name || null, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const { rows: [user] } = await q('SELECT id, username, display_name, role FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.put('/api/user/display-name', authenticateToken, async (req, res) => {
  await q('UPDATE users SET display_name = $1 WHERE id = $2', [req.body.display_name?.trim() || null, req.user.id]);
  res.json({ success: true });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT id, username, display_name, password_hash AS password, role, created_at FROM users ORDER BY created_at ASC');
  res.json({ users: rows });
});

app.post('/api/auth/create-user', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const existing = await q('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Username already taken' });
    const id = uuid();
    await q(`INSERT INTO users (id, username, display_name, password_hash, role) VALUES ($1,$2,$3,$4,'guest')`, [id, username.trim().toLowerCase(), display_name?.trim() || null, password]);
    const { rows: [user] } = await q('SELECT id, username, display_name, role FROM users WHERE id = $1', [id]);
    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { role, password } = req.body;
  if (role     !== undefined) await q('UPDATE users SET role = $1 WHERE id = $2',          [role, req.params.id]);
  if (password !== undefined) await q('UPDATE users SET password_hash = $1 WHERE id = $2', [password, req.params.id]);
  const { rows: [user] } = await q('SELECT id, username, display_name, role FROM users WHERE id = $1', [req.params.id]);
  res.json({ user });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_favorites WHERE user_id = $1', [req.params.id]);
    await client.query('DELETE FROM user_make_soon  WHERE user_id = $1', [req.params.id]);
    await client.query('DELETE FROM user_cook_log   WHERE user_id = $1', [req.params.id]);
    await client.query('DELETE FROM user_kitchen    WHERE user_id = $1', [req.params.id]);
    await client.query('DELETE FROM users           WHERE id      = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ deleted: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Recipes ──────────────────────────────────────────────────────────────────

app.get('/api/recipes', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT r.id, r.name, r.cuisine, r.time, r.servings, r.calories, r.cover_image_url,
             r.status, r.cookbook, r.reference, r.tags, r.created_at,
             i.name AS ing_name
      FROM recipes r
      LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id
      ORDER BY r.name ASC, i.order_index ASC
    `);
    const recipeMap = new Map();
    for (const row of rows) {
      if (!recipeMap.has(row.id)) {
        recipeMap.set(row.id, {
          id: row.id, name: row.name, cuisine: row.cuisine, time: row.time,
          servings: row.servings, calories: row.calories, coverImage: row.cover_image_url,
          status: row.status, cookbook: row.cookbook, reference: row.reference,
          created_at: row.created_at, tags: JSON.parse(row.tags || '[]'), ingredients: [],
        });
      }
      if (row.ing_name) recipeMap.get(row.id).ingredients.push(row.ing_name);
    }
    res.json({ recipes: Array.from(recipeMap.values()) });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

app.get('/api/recipes/:id', async (req, res) => {
  try {
    const { rows: [recipe] } = await q('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    const { rows: ings }   = await q('SELECT * FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY order_index ASC', [req.params.id]);
    const { rows: steps }  = await q('SELECT * FROM instructions WHERE recipe_id = $1 ORDER BY step_number ASC',        [req.params.id]);
    const { rows: notes }  = await q('SELECT id, order_index, body_text AS text FROM recipe_notes WHERE recipe_id = $1 ORDER BY order_index ASC', [req.params.id]);
    res.json({
      recipe:          fmtRecipe(recipe),
      bodyIngredients: ings.map(i => ({ ...i, optional: Boolean(i.optional) })),
      instructions:    steps,
      notes,
    });
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

app.post('/api/recipes', authenticateToken, requireAdmin, async (req, res) => {
  const { details, ingredients, instructions, notes } = req.body;
  if (!details?.name?.trim()) return res.status(400).json({ error: 'Recipe name is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = uuid();
    await client.query(
      `INSERT INTO recipes (id,name,cuisine,time,servings,calories,cover_image_url,status,cookbook,reference,tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, details.name.trim(), details.cuisine||null, details.time||null, details.servings||null, details.calories||null,
       details.cover_image_url||null, details.status||null, details.cookbook||null, details.reference||null,
       JSON.stringify(Array.isArray(details.tags) ? details.tags : [])]
    );
    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (id,recipe_id,name,amount,unit,prep_note,optional,group_label,order_index) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [uuid(), id, ing.name.trim().toLowerCase(), ing.amount||null, ing.unit||null, ing.prep_note||null, Boolean(ing.optional), ing.group_label||null, ing.order_index??0]
        );
      }
    }
    if (Array.isArray(instructions)) {
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO instructions (id,recipe_id,step_number,body_text,timer_seconds,group_label) VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuid(), id, step.step_number, step.body_text.trim(), step.timer_seconds??null, step.group_label||null]
        );
      }
    }
    if (Array.isArray(notes)) {
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        await client.query(`INSERT INTO recipe_notes (id,recipe_id,order_index,body_text) VALUES ($1,$2,$3,$4)`, [uuid(), id, note.order_index??0, text]);
      }
    }
    await client.query('COMMIT');
    const { rows: [recipe] } = await q('SELECT * FROM recipes WHERE id = $1', [id]);
    res.status(201).json({ recipe: fmtRecipe(recipe) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/recipes error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/recipes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE recipes SET name=$1,cuisine=$2,time=$3,servings=$4,calories=$5,cover_image_url=$6,status=$7,cookbook=$8,reference=$9,tags=$10 WHERE id=$11`,
      [details.name, details.cuisine||null, details.time||null, details.servings||null, details.calories||null,
       details.cover_image_url||null, details.status||null, details.cookbook||null, details.reference||null,
       JSON.stringify(Array.isArray(details.tags) ? details.tags : []), id]
    );
    if (ingredients !== undefined) {
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (id,recipe_id,name,amount,unit,prep_note,optional,group_label,order_index) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [uuid(), id, ing.name.trim().toLowerCase(), ing.amount||null, ing.unit||null, ing.prep_note||null, Boolean(ing.optional), ing.group_label||null, ing.order_index??0]
        );
      }
    }
    if (instructions !== undefined) {
      await client.query('DELETE FROM instructions WHERE recipe_id = $1', [id]);
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO instructions (id,recipe_id,step_number,body_text,timer_seconds,group_label) VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuid(), id, step.step_number, step.body_text.trim(), step.timer_seconds??null, step.group_label||null]
        );
      }
    }
    if (notes !== undefined) {
      await client.query('DELETE FROM recipe_notes WHERE recipe_id = $1', [id]);
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        await client.query(`INSERT INTO recipe_notes (id,recipe_id,order_index,body_text) VALUES ($1,$2,$3,$4)`, [uuid(), id, note.order_index??0, text]);
      }
    }
    await client.query('COMMIT');
    const { rows: [recipe] } = await q('SELECT * FROM recipes WHERE id = $1', [id]);
    res.json({ recipe: fmtRecipe(recipe) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/recipes/:id error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/recipes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM recipe_notes       WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM instructions       WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM user_favorites     WHERE recipe_id = $1', [id]);
    await client.query('DELETE FROM user_make_soon     WHERE recipe_id = $1', [id]);
    const result = await client.query('DELETE FROM recipes WHERE id = $1', [id]);
    await client.query('COMMIT');
    if (!result.rowCount) return res.status(404).json({ error: 'Recipe not found' });
    res.json({ deleted: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Cookbooks ────────────────────────────────────────────────────────────────

app.get('/api/cookbooks', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM cookbooks ORDER BY title ASC');
    res.json({ cookbooks: rows.map(fmtCookbook) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cookbooks', authenticateToken, requireAdmin, async (req, res) => {
  const { title, author, coverImage, spineColor, notes } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const id = uuid();
  await q(`INSERT INTO cookbooks (id,title,author,cover_image,spine_color,notes,recipes) VALUES ($1,$2,$3,$4,$5,$6,'[]')`,
    [id, title.trim(), author||'', coverImage||'', spineColor||'#C65D3B', notes||'']);
  const { rows: [cb] } = await q('SELECT * FROM cookbooks WHERE id = $1', [id]);
  res.status(201).json({ cookbook: fmtCookbook(cb) });
});

app.put('/api/cookbooks/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { rows: [existing] } = await q('SELECT * FROM cookbooks WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Cookbook not found' });
  const { title, author, coverImage, spineColor, notes, recipes } = req.body;
  await q(
    `UPDATE cookbooks SET title=$1,author=$2,cover_image=$3,spine_color=$4,notes=$5,recipes=$6,updated_at=NOW() WHERE id=$7`,
    [title??existing.title, author??existing.author, coverImage??existing.cover_image,
     spineColor??existing.spine_color, notes??existing.notes,
     recipes !== undefined ? JSON.stringify(recipes) : existing.recipes, req.params.id]
  );
  const { rows: [cb] } = await q('SELECT * FROM cookbooks WHERE id = $1', [req.params.id]);
  res.json({ cookbook: fmtCookbook(cb) });
});

app.put('/api/cookbooks/:id/entries', authenticateToken, requireAdmin, async (req, res) => {
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) return res.status(400).json({ error: 'recipes must be an array' });
  await q(`UPDATE cookbooks SET recipes=$1,updated_at=NOW() WHERE id=$2`, [JSON.stringify(recipes), req.params.id]);
  const { rows: [cb] } = await q('SELECT * FROM cookbooks WHERE id = $1', [req.params.id]);
  if (!cb) return res.status(404).json({ error: 'Cookbook not found' });
  res.json({ cookbook: fmtCookbook(cb) });
});

app.delete('/api/cookbooks/:id', authenticateToken, requireAdmin, async (req, res) => {
  await q('DELETE FROM cookbooks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Cooking Notes ────────────────────────────────────────────────────────────

app.get('/api/cooking-notes', async (req, res) => {
  try {
    const { rows: notes }    = await q('SELECT * FROM cooking_notes ORDER BY category ASC, created_at ASC');
    const { rows: bullets }  = await q('SELECT note_id, text, order_index FROM cooking_note_bullets ORDER BY note_id, order_index ASC');
    const { rows: keywords } = await q('SELECT note_id, keyword FROM cooking_note_keywords');
    const bulletMap  = new Map();
    const keywordMap = new Map();
    for (const b of bullets)  { if (!bulletMap.has(b.note_id))  bulletMap.set(b.note_id,  []); bulletMap.get(b.note_id).push({ text: b.text, order_index: b.order_index }); }
    for (const k of keywords) { if (!keywordMap.has(k.note_id)) keywordMap.set(k.note_id, []); keywordMap.get(k.note_id).push(k.keyword); }
    res.json({ notes: notes.map(n => ({ ...n, bullets: bulletMap.get(n.id)||[], keywords: keywordMap.get(n.id)||[] })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cooking-notes', authenticateToken, requireAdmin, async (req, res) => {
  const { title, body, type, category, image_url, keywords=[], bullets=[] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!body?.trim())  return res.status(400).json({ error: 'body is required' });
  const id = uuid();
  await q(`INSERT INTO cooking_notes (id,title,body,type,category,image_url) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, title.trim(), body.trim(), type||'rule', category||'General Technique', image_url||null]);
  for (const b  of bullets)  await q('INSERT INTO cooking_note_bullets (id,note_id,text,order_index) VALUES ($1,$2,$3,$4)', [uuid(), id, b.text, b.order_index??0]);
  for (const kw of keywords) if (kw.trim()) await q('INSERT INTO cooking_note_keywords (note_id,keyword) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, kw.trim().toLowerCase()]);
  const { rows: [note] } = await q('SELECT * FROM cooking_notes WHERE id = $1', [id]);
  res.status(201).json({ note: { ...note, bullets, keywords } });
});

app.put('/api/cooking-notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, body, type, category, image_url, keywords=[], bullets=[] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  await q(`UPDATE cooking_notes SET title=$1,body=$2,type=$3,category=$4,image_url=$5 WHERE id=$6`,
    [title.trim(), body?.trim(), type||'rule', category||'General Technique', image_url||null, id]);
  await q('DELETE FROM cooking_note_bullets  WHERE note_id = $1', [id]);
  await q('DELETE FROM cooking_note_keywords WHERE note_id = $1', [id]);
  for (const b  of bullets)  await q('INSERT INTO cooking_note_bullets (id,note_id,text,order_index) VALUES ($1,$2,$3,$4)', [uuid(), id, b.text, b.order_index??0]);
  for (const kw of keywords) if (kw.trim()) await q('INSERT INTO cooking_note_keywords (note_id,keyword) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, kw.trim().toLowerCase()]);
  const { rows: [note] } = await q('SELECT * FROM cooking_notes WHERE id = $1', [id]);
  res.json({ note: { ...note, bullets, keywords } });
});

app.delete('/api/cooking-notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  await q('DELETE FROM cooking_note_bullets  WHERE note_id = $1', [req.params.id]);
  await q('DELETE FROM cooking_note_keywords WHERE note_id = $1', [req.params.id]);
  const result = await q('DELETE FROM cooking_notes WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Note not found' });
  res.json({ deleted: true });
});

// ─── User Data ────────────────────────────────────────────────────────────────

app.get('/api/user/favorites', authenticateToken, async (req, res) => {
  const { rows } = await q('SELECT recipe_id FROM user_favorites WHERE user_id = $1', [req.user.id]);
  res.json({ favorites: rows.map(r => r.recipe_id) });
});

app.put('/api/user/favorites', authenticateToken, async (req, res) => {
  const { favorites } = req.body;
  if (!Array.isArray(favorites)) return res.status(400).json({ error: 'favorites must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_favorites WHERE user_id = $1', [req.user.id]);
    for (const id of favorites) await client.query('INSERT INTO user_favorites (user_id,recipe_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.get('/api/user/make-soon', authenticateToken, async (req, res) => {
  const { rows } = await q('SELECT recipe_id FROM user_make_soon WHERE user_id = $1', [req.user.id]);
  res.json({ makeSoon: rows.map(r => r.recipe_id) });
});

app.put('/api/user/make-soon', authenticateToken, async (req, res) => {
  const { makeSoon } = req.body;
  if (!Array.isArray(makeSoon)) return res.status(400).json({ error: 'makeSoon must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_make_soon WHERE user_id = $1', [req.user.id]);
    for (const id of makeSoon) await client.query('INSERT INTO user_make_soon (user_id,recipe_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.get('/api/user/kitchen', authenticateToken, async (req, res) => {
  const { rows } = await q('SELECT ingredient_name, storage_type FROM user_kitchen WHERE user_id = $1', [req.user.id]);
  res.json({ kitchen: rows });
});

app.put('/api/user/kitchen', authenticateToken, async (req, res) => {
  const { kitchen } = req.body;
  if (!Array.isArray(kitchen)) return res.status(400).json({ error: 'kitchen must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_kitchen WHERE user_id = $1', [req.user.id]);
    for (const item of kitchen) {
      if (!item.ingredient_name?.trim()) continue;
      await client.query('INSERT INTO user_kitchen (user_id,ingredient_name,storage_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [req.user.id, item.ingredient_name.toLowerCase().trim(), item.storage_type||'fridge']);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.get('/api/user/cook-log', authenticateToken, async (req, res) => {
  if (req.query.recipe_id) {
    const { rows } = await q('SELECT * FROM user_cook_log WHERE user_id=$1 AND recipe_id=$2 ORDER BY cooked_at DESC', [req.user.id, req.query.recipe_id]);
    return res.json({ entries: rows });
  }
  const { rows } = await q('SELECT * FROM user_cook_log WHERE user_id=$1 ORDER BY cooked_at DESC', [req.user.id]);
  res.json({ entries: rows });
});

app.post('/api/user/cook-log', authenticateToken, async (req, res) => {
  const { recipe_id, recipe_name, rating, notes, cooked_at } = req.body;
  const realId = recipe_id && !recipe_id.startsWith('ref-') && recipe_id.length > 10 ? recipe_id : null;
  const id = uuid();
  await q(`INSERT INTO user_cook_log (id,user_id,recipe_id,recipe_name,rating,notes,cooked_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, req.user.id, realId, recipe_name?.trim()||null, rating??null, notes?.trim()||null, cooked_at||new Date().toISOString()]);
  const { rows: [entry] } = await q('SELECT * FROM user_cook_log WHERE id = $1', [id]);
  res.json({ entry });
});

// ─── Grocery List ─────────────────────────────────────────────────────────────

app.post('/api/grocery-list', async (req, res) => {
  const { recipeIds } = req.body;
  if (!Array.isArray(recipeIds) || !recipeIds.length) return res.status(400).json({ error: 'recipeIds must be a non-empty array' });
  try {
    const { rows } = await q(`
      SELECT r.id AS recipe_id, r.name AS recipe_name,
             i.name AS ingredient_name, i.amount, i.unit, i.prep_note, i.optional
      FROM recipes r
      JOIN recipe_ingredients i ON i.recipe_id = r.id
      WHERE r.id = ANY($1)
      ORDER BY i.name ASC
    `, [recipeIds]);

    if (!rows.length) return res.json({ categories: [], recipeNames: [] });

    const recipeNameMap = new Map();
    for (const row of rows) recipeNameMap.set(row.recipe_id, row.recipe_name);

    const itemMap = new Map();
    for (const row of rows) {
      const key = `${row.ingredient_name.toLowerCase().trim()}||${(row.unit||'').toLowerCase().trim()}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { name: row.ingredient_name, amounts: [], rawAmounts: [], unit: row.unit||'', prep_note: row.prep_note||'', optional: Boolean(row.optional), recipes: [], category: categorise(row.ingredient_name) });
      }
      const entry = itemMap.get(key);
      if (!entry.recipes.includes(row.recipe_name)) entry.recipes.push(row.recipe_name);
      const n = row.amount ? parseFloat(row.amount) : NaN;
      if (!isNaN(n)) entry.amounts.push(n);
      else if (row.amount) entry.rawAmounts.push(row.amount);
    }

    const catMap = new Map();
    for (const item of itemMap.values()) {
      let displayAmount = '';
      if (item.amounts.length) {
        const total = item.amounts.reduce((a, b) => a + b, 0);
        displayAmount = Number.isInteger(total) ? String(total) : total.toFixed(1).replace(/\.0$/, '');
        if (item.rawAmounts.length) displayAmount += ' + ' + item.rawAmounts.join(' + ');
      } else if (item.rawAmounts.length) {
        displayAmount = item.rawAmounts.join(' + ');
      }
      if (!catMap.has(item.category)) catMap.set(item.category, []);
      catMap.get(item.category).push({ name: item.name, amount: displayAmount, unit: item.unit, prep_note: item.prep_note, optional: item.optional, recipes: item.recipes });
    }

    const categories = Array.from(catMap.entries())
      .sort((a, b) => (CATEGORY_META[a[0]]?.order??99) - (CATEGORY_META[b[0]]?.order??99))
      .map(([cat, items]) => ({ name: cat.charAt(0).toUpperCase()+cat.slice(1), emoji: CATEGORY_META[cat]?.emoji??'🛒', items: items.sort((a,b)=>a.name.localeCompare(b.name)) }));

    res.json({ categories, recipeNames: Array.from(recipeNameMap.values()) });
  } catch (err) {
    console.error('grocery-list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Match Recipes ────────────────────────────────────────────────────────────

app.post('/api/match', (req, res) => {
  const { fridgeIngredients, recipes } = req.body;
  if (!Array.isArray(fridgeIngredients) || !Array.isArray(recipes)) return res.status(400).json({ error: 'Invalid payload' });
  const fridge = new Set(fridgeIngredients.map(i => i.toLowerCase().trim()));
  const matched = recipes.map(recipe => {
    const ings    = recipe.ingredients || [];
    const have    = ings.filter(i => fridge.has(i));
    const missing = ings.filter(i => !fridge.has(i));
    return { ...recipe, have, missing, matchScore: ings.length===0 ? 0 : have.length/ings.length, canMake: missing.length===0 && ings.length>0 };
  }).sort((a,b) => { if (a.canMake !== b.canMake) return a.canMake ? -1 : 1; return b.matchScore - a.matchScore; });
  res.json({ matched });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────

initDB().then(async () => {
  // If ADMIN_PASSWORD env var is set, upsert the admin account on startup.
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw) {
    const { rows: [existing] } = await q("SELECT id FROM users WHERE username = 'kavya'");
    if (existing) {
      await q("UPDATE users SET password_hash=$1, role='admin' WHERE username='kavya'", [adminPw]);
      console.log('🔑 Admin password reset from ADMIN_PASSWORD env var');
    } else {
      await q("INSERT INTO users (id,username,display_name,password_hash,role) VALUES ($1,'kavya','Kavya',$2,'admin')", [uuid(), adminPw]);
      console.log('🔑 Admin account created from ADMIN_PASSWORD env var');
    }
  }
  app.listen(PORT, () => console.log(`🍳 Hearth API running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
