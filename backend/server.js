const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'https://hearth-z2lo.onrender.com' }));
app.use(express.json());

// ─── Google Drive Setup ───────────────────────────────────────────────────────
const DB_PATH = '/tmp/hearth.db';
const DB_FILENAME = 'hearth.db';
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth });

async function downloadDBFromDrive() {
  try {
    const res = await drive.files.list({
      q: `name='${DB_FILENAME}' and '${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id)',
    });
    if (!res.data.files.length) {
      console.log('📂 No existing DB on Drive — starting fresh');
      return;
    }
    const fileId = res.data.files[0].id;
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    fs.writeFileSync(DB_PATH, Buffer.from(response.data));
    console.log('✅ DB downloaded from Drive');
  } catch (err) {
    console.error('⚠️  Drive download error:', err.message);
  }
}

let uploadTimeout = null;
function scheduleUpload() {
  if (uploadTimeout) clearTimeout(uploadTimeout);
  uploadTimeout = setTimeout(uploadDBToDrive, 2000);
}

async function uploadDBToDrive() {
  try {
    const res = await drive.files.list({
      q: `name='${DB_FILENAME}' and '${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id)',
    });
    const media = { mimeType: 'application/octet-stream', body: fs.createReadStream(DB_PATH) };
    if (res.data.files.length) {
      await drive.files.update({ fileId: res.data.files[0].id, media });
    } else {
      await drive.files.create({ requestBody: { name: DB_FILENAME, parents: [FOLDER_ID] }, media });
    }
    console.log('✅ DB synced to Drive');
  } catch (err) {
    console.error('⚠️  Drive upload error:', err.message);
  }
}

// ─── Database Setup ───────────────────────────────────────────────────────────
let db;

function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'guest',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cuisine TEXT,
      time TEXT,
      servings TEXT,
      cover_image_url TEXT,
      status TEXT,
      cookbook TEXT,
      reference TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id),
      name TEXT NOT NULL,
      amount TEXT,
      unit TEXT,
      prep_note TEXT,
      optional INTEGER DEFAULT 0,
      group_label TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS instructions (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id),
      step_number INTEGER,
      body_text TEXT,
      timer_seconds INTEGER,
      group_label TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_notes (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id),
      order_index INTEGER DEFAULT 0,
      body_text TEXT
    );

    CREATE TABLE IF NOT EXISTS cookbooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      spine_color TEXT DEFAULT '#C65D3B',
      notes TEXT DEFAULT '',
      recipes TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cooking_notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT DEFAULT 'rule',
      category TEXT DEFAULT 'General Technique',
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cooking_note_bullets (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES cooking_notes(id),
      text TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cooking_note_keywords (
      note_id TEXT NOT NULL REFERENCES cooking_notes(id),
      keyword TEXT NOT NULL,
      PRIMARY KEY (note_id, keyword)
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS user_make_soon (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS user_cook_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      recipe_id TEXT,
      recipe_name TEXT,
      rating INTEGER,
      notes TEXT,
      cooked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_kitchen (
      user_id TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      storage_type TEXT DEFAULT 'fridge',
      PRIMARY KEY (user_id, ingredient_name)
    );
  `);

  console.log('🗄️  Database ready');
}

const uuid = () => crypto.randomUUID();

// ─── Grocery Category Mapping ─────────────────────────────────────────────────
const CATEGORY_MAP = {
  produce: ['onion','garlic','ginger','tomato','tomatoes','lemon','lime','spinach','carrot','carrots','celery','potato','potatoes','bell pepper','cucumber','zucchini','broccoli','cauliflower','mushroom','mushrooms','avocado','lettuce','kale','cabbage','spring onion','scallion','shallot','shallots','chilli','chili','jalapeño','capsicum','leek','asparagus','eggplant','aubergine','sweet potato','pumpkin','butternut squash','beetroot','radish','green beans','peas','corn','coriander','cilantro','parsley','basil','mint','thyme','rosemary','dill','chives','bay leaves','lemongrass','orange','lime leaves','thai basil','apple','banana','mango','berry','berries','strawberry','blueberry','peach','pear','grape','cherry'],
  'meat & fish': ['chicken','beef','pork','lamb','turkey','duck','bacon','sausage','mince','ground beef','ground pork','steak','salmon','tuna','shrimp','prawns','cod','tilapia','fish','crab','lobster','scallops','mussels','anchovies','ham','pancetta','prosciutto','chorizo','salami','veal','brisket','ribs','meatball','swordfish','trout','halibut','clams','oysters','squid','calamari'],
  dairy: ['egg','eggs','milk','butter','cream','heavy cream','double cream','sour cream','yogurt','greek yogurt','cheese','parmesan','cheddar','feta','mozzarella','ricotta','cream cheese','brie','gouda','halloumi','creme fraiche','ghee','buttermilk','condensed milk','coconut milk','coconut cream'],
  sauces: ['soy sauce','fish sauce','oyster sauce','hoisin sauce','worcestershire sauce','hot sauce','sriracha','ketchup','mayonnaise','ranch','caesar dressing','tomato paste','tomato sauce','passata','canned tomatoes','diced tomatoes','peanut butter','tahini','miso','mustard','dijon mustard','bbq sauce','teriyaki sauce','sambal','chilli sauce','aioli','pesto','hummus','vinaigrette','maple syrup','honey'],
  spices: ['salt','pepper','black pepper','cumin','coriander powder','turmeric','paprika','smoked paprika','chilli flakes','cayenne','cinnamon','nutmeg','cardamom','cloves','star anise','bay leaf','oregano','dried thyme','dried rosemary','dried basil','mixed herbs','curry powder','garam masala','five spice','white pepper','msg','sesame seeds','chilli powder','allspice','vanilla extract','baking powder','baking soda','yeast'],
  alcohol: ['wine','red wine','white wine','beer','vodka','rum','whiskey','bourbon','gin','tequila','brandy','sake','mirin','rice wine','sherry','port','champagne','prosecco','vermouth','kahlua'],
  staples: ['rice','pasta','noodles','flour','bread','breadcrumbs','panko','oats','quinoa','lentils','chickpeas','black beans','kidney beans','cannellini beans','split peas','couscous','polenta','cornmeal','tortilla','wrap','pita','stock','broth','chicken stock','beef stock','vegetable stock','oil','olive oil','sesame oil','vegetable oil','coconut oil','vinegar','balsamic vinegar','rice vinegar','apple cider vinegar','sugar','brown sugar','cornstarch','cornflour','chocolate','cocoa','dried pasta','udon','rice noodles','glass noodles','wonton wrappers','frozen peas','frozen corn','frozen spinach','frozen edamame','frozen berries','ice cream','frozen prawns','frozen shrimp'],
};
const CATEGORY_META = {
  produce:      { emoji: '🥦', order: 1 },
  'meat & fish':{ emoji: '🥩', order: 2 },
  dairy:        { emoji: '🥛', order: 3 },
  sauces:       { emoji: '🫙', order: 4 },
  spices:       { emoji: '🧂', order: 5 },
  alcohol:      { emoji: '🍷', order: 6 },
  staples:      { emoji: '🌾', order: 7 },
  other:        { emoji: '🛒', order: 8 },
};
function categorise(name) {
  const lower = name.toLowerCase().trim();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k) || k.includes(lower))) return cat;
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

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    const id = uuid();
    db.prepare(`INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, 'guest')`)
      .run(id, username.trim().toLowerCase(), password);
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    scheduleUpload();
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    if (user.role === 'suspended') return res.status(403).json({ error: 'Your account has been suspended.' });
    if (password !== user.password_hash) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name || null, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.put('/api/user/display-name', authenticateToken, (req, res) => {
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(req.body.display_name?.trim() || null, req.user.id);
  scheduleUpload();
  res.json({ success: true });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, display_name, password_hash AS password, role, created_at FROM users ORDER BY created_at ASC').all();
  res.json({ users });
});

app.post('/api/auth/create-user', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    const id = uuid();
    db.prepare(`INSERT INTO users (id, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, 'guest')`)
      .run(id, username.trim().toLowerCase(), display_name?.trim() || null, password);
    const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(id);
    scheduleUpload();
    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { role, password } = req.body;
  if (role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (password !== undefined) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password, req.params.id);
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.params.id);
  scheduleUpload();
  res.json({ user });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM user_favorites WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM user_make_soon WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM user_cook_log WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM user_kitchen WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  scheduleUpload();
  res.json({ deleted: true });
});

// ─── Recipes ──────────────────────────────────────────────────────────────────
app.get('/api/recipes', (req, res) => {
  try {
    const recipes = db.prepare('SELECT * FROM recipes ORDER BY name ASC').all();
    const result = recipes.map(r => {
      const ingredients = db.prepare('SELECT name FROM recipe_ingredients WHERE recipe_id = ? ORDER BY order_index ASC').all(r.id).map(i => i.name);
      return { ...r, tags: JSON.parse(r.tags || '[]'), ingredients, coverImage: r.cover_image_url };
    });
    res.json({ recipes: result });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

app.get('/api/recipes/:id', (req, res) => {
  try {
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    const bodyIngredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY order_index ASC').all(req.params.id);
    const instructions = db.prepare('SELECT * FROM instructions WHERE recipe_id = ? ORDER BY step_number ASC').all(req.params.id);
    const notes = db.prepare('SELECT id, order_index, body_text AS text FROM recipe_notes WHERE recipe_id = ? ORDER BY order_index ASC').all(req.params.id);
    res.json({
      recipe: { ...recipe, tags: JSON.parse(recipe.tags || '[]'), coverImage: recipe.cover_image_url },
      bodyIngredients: bodyIngredients.map(i => ({ ...i, optional: Boolean(i.optional) })),
      instructions,
      notes,
    });
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

app.post('/api/recipes', authenticateToken, requireAdmin, (req, res) => {
  const { details, ingredients, instructions, notes } = req.body;
  if (!details?.name?.trim()) return res.status(400).json({ error: 'Recipe name is required' });
  try {
    const id = uuid();
    db.prepare(`INSERT INTO recipes (id, name, cuisine, time, servings, cover_image_url, status, cookbook, reference, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, details.name.trim(), details.cuisine || null, details.time || null, details.servings || null,
        details.cover_image_url || null, details.status || null, details.cookbook || null,
        details.reference || null, JSON.stringify(Array.isArray(details.tags) ? details.tags : []));

    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        db.prepare(`INSERT INTO recipe_ingredients (id, recipe_id, name, amount, unit, prep_note, optional, group_label, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uuid(), id, ing.name.trim().toLowerCase(), ing.amount || null, ing.unit || null,
            ing.prep_note || null, ing.optional ? 1 : 0, ing.group_label || null, ing.order_index ?? 0);
      }
    }
    if (Array.isArray(instructions)) {
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        db.prepare(`INSERT INTO instructions (id, recipe_id, step_number, body_text, timer_seconds, group_label) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(uuid(), id, step.step_number, step.body_text.trim(), step.timer_seconds ?? null, step.group_label || null);
      }
    }
    if (Array.isArray(notes)) {
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        db.prepare(`INSERT INTO recipe_notes (id, recipe_id, order_index, body_text) VALUES (?, ?, ?, ?)`)
          .run(uuid(), id, note.order_index ?? 0, text);
      }
    }

    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
    scheduleUpload();
    res.status(201).json({ recipe: { ...recipe, tags: JSON.parse(recipe.tags || '[]'), coverImage: recipe.cover_image_url } });
  } catch (err) {
    console.error('POST /api/recipes error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/recipes/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;
  try {
    db.prepare(`UPDATE recipes SET name=?, cuisine=?, time=?, servings=?, cover_image_url=?, status=?, cookbook=?, reference=?, tags=? WHERE id=?`)
      .run(details.name, details.cuisine || null, details.time || null, details.servings || null,
        details.cover_image_url || null, details.status || null, details.cookbook || null,
        details.reference || null, JSON.stringify(Array.isArray(details.tags) ? details.tags : []), id);

    if (ingredients !== undefined) {
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        db.prepare(`INSERT INTO recipe_ingredients (id, recipe_id, name, amount, unit, prep_note, optional, group_label, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uuid(), id, ing.name.trim().toLowerCase(), ing.amount || null, ing.unit || null,
            ing.prep_note || null, ing.optional ? 1 : 0, ing.group_label || null, ing.order_index ?? 0);
      }
    }
    if (instructions !== undefined) {
      db.prepare('DELETE FROM instructions WHERE recipe_id = ?').run(id);
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        db.prepare(`INSERT INTO instructions (id, recipe_id, step_number, body_text, timer_seconds, group_label) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(uuid(), id, step.step_number, step.body_text.trim(), step.timer_seconds ?? null, step.group_label || null);
      }
    }
    if (notes !== undefined) {
      db.prepare('DELETE FROM recipe_notes WHERE recipe_id = ?').run(id);
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        db.prepare(`INSERT INTO recipe_notes (id, recipe_id, order_index, body_text) VALUES (?, ?, ?, ?)`)
          .run(uuid(), id, note.order_index ?? 0, text);
      }
    }

    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
    scheduleUpload();
    res.json({ recipe: { ...recipe, tags: JSON.parse(recipe.tags || '[]'), coverImage: recipe.cover_image_url } });
  } catch (err) {
    console.error('PUT /api/recipes/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/recipes/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM recipe_notes WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM instructions WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM user_favorites WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM user_make_soon WHERE recipe_id = ?').run(id);
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'Recipe not found' });
  scheduleUpload();
  res.json({ deleted: true });
});

// ─── Cookbooks ────────────────────────────────────────────────────────────────
app.get('/api/cookbooks', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM cookbooks ORDER BY title ASC').all();
    res.json({ cookbooks: rows.map(r => ({ ...r, recipes: JSON.parse(r.recipes || '[]'), coverImage: r.cover_image, spineColor: r.spine_color })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cookbooks', authenticateToken, requireAdmin, (req, res) => {
  const { title, author, coverImage, spineColor, notes } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const id = uuid();
  db.prepare(`INSERT INTO cookbooks (id, title, author, cover_image, spine_color, notes, recipes) VALUES (?, ?, ?, ?, ?, ?, '[]')`)
    .run(id, title.trim(), author || '', coverImage || '', spineColor || '#C65D3B', notes || '');
  const r = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(id);
  scheduleUpload();
  res.status(201).json({ cookbook: { ...r, recipes: [], coverImage: r.cover_image, spineColor: r.spine_color } });
});

app.put('/api/cookbooks/:id', authenticateToken, requireAdmin, (req, res) => {
  const { title, author, coverImage, spineColor, notes, recipes } = req.body;
  const existing = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cookbook not found' });
  db.prepare(`UPDATE cookbooks SET title=?, author=?, cover_image=?, spine_color=?, notes=?, recipes=?, updated_at=datetime('now') WHERE id=?`)
    .run(title ?? existing.title, author ?? existing.author, coverImage ?? existing.cover_image,
      spineColor ?? existing.spine_color, notes ?? existing.notes,
      recipes !== undefined ? JSON.stringify(recipes) : existing.recipes, req.params.id);
  const r = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(req.params.id);
  scheduleUpload();
  res.json({ cookbook: { ...r, recipes: JSON.parse(r.recipes || '[]'), coverImage: r.cover_image, spineColor: r.spine_color } });
});

app.put('/api/cookbooks/:id/entries', authenticateToken, requireAdmin, (req, res) => {
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) return res.status(400).json({ error: 'recipes must be an array' });
  db.prepare(`UPDATE cookbooks SET recipes=?, updated_at=datetime('now') WHERE id=?`)
    .run(JSON.stringify(recipes), req.params.id);
  const r = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Cookbook not found' });
  scheduleUpload();
  res.json({ cookbook: { ...r, recipes: JSON.parse(r.recipes || '[]'), coverImage: r.cover_image, spineColor: r.spine_color } });
});

app.delete('/api/cookbooks/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM cookbooks WHERE id = ?').run(req.params.id);
  scheduleUpload();
  res.json({ ok: true });
});

// ─── Cooking Notes ────────────────────────────────────────────────────────────
app.get('/api/cooking-notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM cooking_notes ORDER BY category ASC, created_at ASC').all();
    const result = notes.map(n => ({
      ...n,
      bullets: db.prepare('SELECT text, order_index FROM cooking_note_bullets WHERE note_id = ? ORDER BY order_index ASC').all(n.id),
      keywords: db.prepare('SELECT keyword FROM cooking_note_keywords WHERE note_id = ?').all(n.id).map(k => k.keyword),
    }));
    res.json({ notes: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cooking-notes', authenticateToken, requireAdmin, (req, res) => {
  const { title, body, type, category, image_url, keywords = [], bullets = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  const id = uuid();
  db.prepare(`INSERT INTO cooking_notes (id, title, body, type, category, image_url) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, title.trim(), body.trim(), type || 'rule', category || 'General Technique', image_url || null);
  for (const b of bullets) db.prepare('INSERT INTO cooking_note_bullets (id, note_id, text, order_index) VALUES (?, ?, ?, ?)').run(uuid(), id, b.text, b.order_index ?? 0);
  for (const kw of keywords) if (kw.trim()) db.prepare('INSERT OR IGNORE INTO cooking_note_keywords (note_id, keyword) VALUES (?, ?)').run(id, kw.trim().toLowerCase());
  const note = db.prepare('SELECT * FROM cooking_notes WHERE id = ?').get(id);
  scheduleUpload();
  res.status(201).json({ note: { ...note, bullets, keywords } });
});

app.put('/api/cooking-notes/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, body, type, category, image_url, keywords = [], bullets = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  db.prepare(`UPDATE cooking_notes SET title=?, body=?, type=?, category=?, image_url=? WHERE id=?`)
    .run(title.trim(), body?.trim(), type || 'rule', category || 'General Technique', image_url || null, id);
  db.prepare('DELETE FROM cooking_note_bullets WHERE note_id = ?').run(id);
  db.prepare('DELETE FROM cooking_note_keywords WHERE note_id = ?').run(id);
  for (const b of bullets) db.prepare('INSERT INTO cooking_note_bullets (id, note_id, text, order_index) VALUES (?, ?, ?, ?)').run(uuid(), id, b.text, b.order_index ?? 0);
  for (const kw of keywords) if (kw.trim()) db.prepare('INSERT OR IGNORE INTO cooking_note_keywords (note_id, keyword) VALUES (?, ?)').run(id, kw.trim().toLowerCase());
  const note = db.prepare('SELECT * FROM cooking_notes WHERE id = ?').get(id);
  scheduleUpload();
  res.json({ note: { ...note, bullets, keywords } });
});

app.delete('/api/cooking-notes/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM cooking_note_bullets WHERE note_id = ?').run(req.params.id);
  db.prepare('DELETE FROM cooking_note_keywords WHERE note_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM cooking_notes WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Note not found' });
  scheduleUpload();
  res.json({ deleted: true });
});

// ─── User Data ────────────────────────────────────────────────────────────────
app.get('/api/user/favorites', authenticateToken, (req, res) => {
  const rows = db.prepare('SELECT recipe_id FROM user_favorites WHERE user_id = ?').all(req.user.id);
  res.json({ favorites: rows.map(r => r.recipe_id) });
});

app.put('/api/user/favorites', authenticateToken, (req, res) => {
  const { favorites } = req.body;
  if (!Array.isArray(favorites)) return res.status(400).json({ error: 'favorites must be an array' });
  db.prepare('DELETE FROM user_favorites WHERE user_id = ?').run(req.user.id);
  for (const id of favorites) db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, recipe_id) VALUES (?, ?)').run(req.user.id, id);
  scheduleUpload();
  res.json({ success: true });
});

app.get('/api/user/make-soon', authenticateToken, (req, res) => {
  const rows = db.prepare('SELECT recipe_id FROM user_make_soon WHERE user_id = ?').all(req.user.id);
  res.json({ makeSoon: rows.map(r => r.recipe_id) });
});

app.put('/api/user/make-soon', authenticateToken, (req, res) => {
  const { makeSoon } = req.body;
  if (!Array.isArray(makeSoon)) return res.status(400).json({ error: 'makeSoon must be an array' });
  db.prepare('DELETE FROM user_make_soon WHERE user_id = ?').run(req.user.id);
  for (const id of makeSoon) db.prepare('INSERT OR IGNORE INTO user_make_soon (user_id, recipe_id) VALUES (?, ?)').run(req.user.id, id);
  scheduleUpload();
  res.json({ success: true });
});

app.get('/api/user/kitchen', authenticateToken, (req, res) => {
  const kitchen = db.prepare('SELECT ingredient_name, storage_type FROM user_kitchen WHERE user_id = ?').all(req.user.id);
  res.json({ kitchen });
});

app.put('/api/user/kitchen', authenticateToken, (req, res) => {
  const { kitchen } = req.body;
  if (!Array.isArray(kitchen)) return res.status(400).json({ error: 'kitchen must be an array' });
  db.prepare('DELETE FROM user_kitchen WHERE user_id = ?').run(req.user.id);
  for (const item of kitchen) {
    if (!item.ingredient_name?.trim()) continue;
    db.prepare('INSERT OR IGNORE INTO user_kitchen (user_id, ingredient_name, storage_type) VALUES (?, ?, ?)').run(req.user.id, item.ingredient_name.toLowerCase().trim(), item.storage_type || 'fridge');
  }
  scheduleUpload();
  res.json({ success: true });
});

app.get('/api/user/cook-log', authenticateToken, (req, res) => {
  let sql = 'SELECT * FROM user_cook_log WHERE user_id = ?';
  const params = [req.user.id];
  if (req.query.recipe_id) { sql += ' AND recipe_id = ?'; params.push(req.query.recipe_id); }
  sql += ' ORDER BY cooked_at DESC';
  res.json({ entries: db.prepare(sql).all(...params) });
});

app.post('/api/user/cook-log', authenticateToken, (req, res) => {
  const { recipe_id, recipe_name, rating, notes, cooked_at } = req.body;
  const hasRealId = recipe_id && !recipe_id.startsWith('ref-') && recipe_id.length > 10;
  const id = uuid();
  db.prepare(`INSERT INTO user_cook_log (id, user_id, recipe_id, recipe_name, rating, notes, cooked_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.id, hasRealId ? recipe_id : null, recipe_name?.trim() || null, rating ?? null, notes?.trim() || null, cooked_at || new Date().toISOString());
  const entry = db.prepare('SELECT * FROM user_cook_log WHERE id = ?').get(id);
  scheduleUpload();
  res.json({ entry });
});

// ─── Grocery List ─────────────────────────────────────────────────────────────
app.post('/api/grocery-list', (req, res) => {
  const { recipeIds } = req.body;
  if (!Array.isArray(recipeIds) || !recipeIds.length) return res.status(400).json({ error: 'recipeIds must be a non-empty array' });
  try {
    const placeholders = recipeIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.id AS recipe_id, r.name AS recipe_name, i.name AS ingredient_name, i.amount, i.unit, i.prep_note, i.optional
      FROM recipes r
      JOIN recipe_ingredients i ON i.recipe_id = r.id
      WHERE r.id IN (${placeholders})
      ORDER BY i.name ASC
    `).all(...recipeIds);

    if (!rows.length) return res.json({ categories: [], recipeNames: [] });

    const recipeNameMap = new Map();
    for (const row of rows) recipeNameMap.set(row.recipe_id, row.recipe_name);

    const itemMap = new Map();
    for (const row of rows) {
      const key = `${row.ingredient_name.toLowerCase().trim()}||${(row.unit || '').toLowerCase().trim()}`;
      if (!itemMap.has(key)) itemMap.set(key, { name: row.ingredient_name, amounts: [], rawAmounts: [], unit: row.unit || '', prep_note: row.prep_note || '', optional: Boolean(row.optional), recipes: [], category: categorise(row.ingredient_name) });
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
      } else if (item.rawAmounts.length) displayAmount = item.rawAmounts.join(' + ');
      if (!catMap.has(item.category)) catMap.set(item.category, []);
      catMap.get(item.category).push({ name: item.name, amount: displayAmount, unit: item.unit, prep_note: item.prep_note, optional: item.optional, recipes: item.recipes });
    }

    const categories = Array.from(catMap.entries())
      .sort((a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99))
      .map(([cat, items]) => ({ name: cat.charAt(0).toUpperCase() + cat.slice(1), emoji: CATEGORY_META[cat]?.emoji ?? '🛒', items: items.sort((a, b) => a.name.localeCompare(b.name)) }));

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
    const ings = recipe.ingredients || [];
    const have = ings.filter(i => fridge.has(i));
    const missing = ings.filter(i => !fridge.has(i));
    const matchScore = ings.length === 0 ? 0 : have.length / ings.length;
    return { ...recipe, have, missing, matchScore, canMake: missing.length === 0 && ings.length > 0 };
  }).sort((a, b) => { if (a.canMake && !b.canMake) return -1; if (!a.canMake && b.canMake) return 1; return b.matchScore - a.matchScore; });
  res.json({ matched });
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

downloadDBFromDrive().then(() => {
  initDB();
  app.listen(PORT, () => console.log(`🍳 Hearth API running on port ${PORT}`));
});
