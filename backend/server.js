/**
 * Hearth API — server.js
 *
 * Architecture overview:
 *  - SQLite (better-sqlite3) for storage — synchronous, no connection pool needed
 *  - Google Drive for persistence — DB file is downloaded on startup and
 *    re-uploaded 2 seconds after any write (debounced)
 *  - JWT for auth — tokens last 30 days, stored client-side
 *  - Passwords stored as plaintext (this is a private family app, not public SaaS)
 */

const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const fs         = require('fs');
const crypto     = require('crypto');
const Database   = require('better-sqlite3');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'https://hearth-z2lo.onrender.com' }));
app.use(express.json());

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_PATH     = '/tmp/hearth.db';   // writable on Render's free tier
const DB_FILENAME = 'hearth.db';
const FOLDER_ID   = process.env.GOOGLE_DRIVE_FOLDER_ID;
const PORT        = process.env.PORT || 3001;

// ─── Google Drive ─────────────────────────────────────────────────────────────
// We use a service account with drive.file scope so it can only see files it
// created (not the user's entire Drive). The private key comes from Render's
// environment variables — never hardcoded.

const driveAuth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key:   (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth: driveAuth });

// Find the DB file in Drive (returns file ID or null)
async function findDriveFile() {
  const res = await drive.files.list({
    q:      `name='${DB_FILENAME}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id)',
  });
  return res.data.files[0]?.id ?? null;
}

// Called once on startup — pulls the latest DB down from Drive
async function downloadDBFromDrive() {
  try {
    const fileId = await findDriveFile();
    if (!fileId) {
      console.log('📂 No existing DB on Drive — starting fresh');
      return;
    }
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

// Debounced — waits 2 s after the last write before uploading.
// This batches rapid sequential writes (e.g. recipe + ingredients) into one upload.
let uploadTimeout = null;
function scheduleUpload() {
  if (uploadTimeout) clearTimeout(uploadTimeout);
  uploadTimeout = setTimeout(uploadDBToDrive, 2000);
}

async function uploadDBToDrive() {
  try {
    const fileId = await findDriveFile();
    const media  = { mimeType: 'application/octet-stream', body: fs.createReadStream(DB_PATH) };
    if (fileId) {
      await drive.files.update({ fileId, media });
    } else {
      await drive.files.create({ requestBody: { name: DB_FILENAME, parents: [FOLDER_ID] }, media });
    }
    console.log('✅ DB synced to Drive');
  } catch (err) {
    console.error('⚠️  Drive upload error:', err.message);
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────
// WAL mode: allows reads to happen concurrently with writes (faster under load).
// foreign_keys ON: enforces referential integrity (e.g. can't add ingredient for
// a recipe that doesn't exist).

let db;

function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      display_name  TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT DEFAULT 'guest',      -- 'guest' | 'admin' | 'suspended'
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      cuisine        TEXT,
      time           TEXT,
      servings       TEXT,
      cover_image_url TEXT,
      status         TEXT,                     -- e.g. 'want to try', 'regular'
      cookbook       TEXT,                     -- display label only, not a FK
      reference      TEXT,                     -- source URL or book name
      tags           TEXT DEFAULT '[]',        -- JSON array of strings
      calories       TEXT,                     -- per serving, e.g. '350 kcal'
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id          TEXT PRIMARY KEY,
      recipe_id   TEXT NOT NULL REFERENCES recipes(id),
      name        TEXT NOT NULL,
      amount      TEXT,
      unit        TEXT,
      prep_note   TEXT,
      optional    INTEGER DEFAULT 0,           -- 0 = required, 1 = optional
      group_label TEXT,                        -- e.g. 'For the sauce'
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS instructions (
      id            TEXT PRIMARY KEY,
      recipe_id     TEXT NOT NULL REFERENCES recipes(id),
      step_number   INTEGER,
      body_text     TEXT,
      timer_seconds INTEGER,
      group_label   TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_notes (
      id          TEXT PRIMARY KEY,
      recipe_id   TEXT NOT NULL REFERENCES recipes(id),
      order_index INTEGER DEFAULT 0,
      body_text   TEXT
    );

    CREATE TABLE IF NOT EXISTS cookbooks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      author      TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      spine_color TEXT DEFAULT '#C65D3B',
      notes       TEXT DEFAULT '',
      recipes     TEXT DEFAULT '[]',           -- JSON array of recipe stubs/ids
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cooking_notes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      type       TEXT DEFAULT 'rule',          -- 'rule' | 'tip' | 'technique'
      category   TEXT DEFAULT 'General Technique',
      image_url  TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cooking_note_bullets (
      id          TEXT PRIMARY KEY,
      note_id     TEXT NOT NULL REFERENCES cooking_notes(id),
      text        TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cooking_note_keywords (
      note_id TEXT NOT NULL REFERENCES cooking_notes(id),
      keyword TEXT NOT NULL,
      PRIMARY KEY (note_id, keyword)
    );

    -- Per-user recipe lists (favorites, make-soon)
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id   TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS user_make_soon (
      user_id   TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS user_cook_log (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      recipe_id   TEXT,                        -- null for free-text log entries
      recipe_name TEXT,
      rating      INTEGER,
      notes       TEXT,
      cooked_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_kitchen (
      user_id         TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      storage_type    TEXT DEFAULT 'fridge',   -- 'fridge' | 'freezer' | 'pantry'
      PRIMARY KEY (user_id, ingredient_name)
    );
  `);

  prepareCachedStatements();
  console.log('🗄️  Database ready');
}

// ─── Cached Prepared Statements ───────────────────────────────────────────────
// Preparing a statement parses and compiles the SQL — doing it once at startup
// is faster than re-preparing on every request.

let stmts = {};

function prepareCachedStatements() {
  stmts = {
    // users
    getUserByUsername:  db.prepare('SELECT * FROM users WHERE username = ?'),
    getUserById:        db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?'),
    getAllUsers:        db.prepare('SELECT id, username, display_name, password_hash AS password, role, created_at FROM users ORDER BY created_at ASC'),
    insertUser:         db.prepare(`INSERT INTO users (id, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, 'guest')`),
    updateUserRole:     db.prepare('UPDATE users SET role = ? WHERE id = ?'),
    updateUserPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    updateDisplayName:  db.prepare('UPDATE users SET display_name = ? WHERE id = ?'),
    deleteUserData:     db.prepare('DELETE FROM user_favorites WHERE user_id = ?'),  // used alongside others in a transaction

    // recipes — bulk fetch uses a JOIN to avoid N+1 queries
    getAllRecipes: db.prepare(`
      SELECT r.id, r.name, r.cuisine, r.time, r.servings, r.calories, r.cover_image_url,
             r.status, r.cookbook, r.reference, r.tags, r.created_at,
             i.name AS ing_name
      FROM recipes r
      LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id
      ORDER BY r.name ASC, i.order_index ASC
    `),
    getRecipeById:       db.prepare('SELECT * FROM recipes WHERE id = ?'),
    getIngredients:      db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY order_index ASC'),
    getInstructions:     db.prepare('SELECT * FROM instructions WHERE recipe_id = ? ORDER BY step_number ASC'),
    getRecipeNotes:      db.prepare('SELECT id, order_index, body_text AS text FROM recipe_notes WHERE recipe_id = ? ORDER BY order_index ASC'),
    insertRecipe:        db.prepare(`INSERT INTO recipes (id, name, cuisine, time, servings, calories, cover_image_url, status, cookbook, reference, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    updateRecipe:        db.prepare(`UPDATE recipes SET name=?, cuisine=?, time=?, servings=?, calories=?, cover_image_url=?, status=?, cookbook=?, reference=?, tags=? WHERE id=?`),
    deleteRecipe:        db.prepare('DELETE FROM recipes WHERE id = ?'),
    insertIngredient:    db.prepare(`INSERT INTO recipe_ingredients (id, recipe_id, name, amount, unit, prep_note, optional, group_label, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    deleteIngredients:   db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?'),
    insertInstruction:   db.prepare(`INSERT INTO instructions (id, recipe_id, step_number, body_text, timer_seconds, group_label) VALUES (?, ?, ?, ?, ?, ?)`),
    deleteInstructions:  db.prepare('DELETE FROM instructions WHERE recipe_id = ?'),
    insertRecipeNote:    db.prepare(`INSERT INTO recipe_notes (id, recipe_id, order_index, body_text) VALUES (?, ?, ?, ?)`),
    deleteRecipeNotes:   db.prepare('DELETE FROM recipe_notes WHERE recipe_id = ?'),

    // cookbooks
    getAllCookbooks:  db.prepare('SELECT * FROM cookbooks ORDER BY title ASC'),
    getCookbookById:  db.prepare('SELECT * FROM cookbooks WHERE id = ?'),
    insertCookbook:   db.prepare(`INSERT INTO cookbooks (id, title, author, cover_image, spine_color, notes, recipes) VALUES (?, ?, ?, ?, ?, ?, '[]')`),
    updateCookbook:   db.prepare(`UPDATE cookbooks SET title=?, author=?, cover_image=?, spine_color=?, notes=?, recipes=?, updated_at=datetime('now') WHERE id=?`),
    updateCookbookEntries: db.prepare(`UPDATE cookbooks SET recipes=?, updated_at=datetime('now') WHERE id=?`),
    deleteCookbook:   db.prepare('DELETE FROM cookbooks WHERE id = ?'),

    // cooking notes — bulk fetch with two extra queries (all bullets + all keywords)
    // rather than N×2 queries per note
    getAllCookingNotes:    db.prepare('SELECT * FROM cooking_notes ORDER BY category ASC, created_at ASC'),
    getAllNoteBullets:     db.prepare('SELECT note_id, text, order_index FROM cooking_note_bullets ORDER BY note_id, order_index ASC'),
    getAllNoteKeywords:    db.prepare('SELECT note_id, keyword FROM cooking_note_keywords'),
    getCookingNoteById:   db.prepare('SELECT * FROM cooking_notes WHERE id = ?'),
    insertCookingNote:    db.prepare(`INSERT INTO cooking_notes (id, title, body, type, category, image_url) VALUES (?, ?, ?, ?, ?, ?)`),
    updateCookingNote:    db.prepare(`UPDATE cooking_notes SET title=?, body=?, type=?, category=?, image_url=? WHERE id=?`),
    deleteCookingNote:    db.prepare('DELETE FROM cooking_notes WHERE id = ?'),
    insertNoteBullet:     db.prepare('INSERT INTO cooking_note_bullets (id, note_id, text, order_index) VALUES (?, ?, ?, ?)'),
    deleteNoteBullets:    db.prepare('DELETE FROM cooking_note_bullets WHERE note_id = ?'),
    insertNoteKeyword:    db.prepare('INSERT OR IGNORE INTO cooking_note_keywords (note_id, keyword) VALUES (?, ?)'),
    deleteNoteKeywords:   db.prepare('DELETE FROM cooking_note_keywords WHERE note_id = ?'),

    // user data
    getFavorites:      db.prepare('SELECT recipe_id FROM user_favorites WHERE user_id = ?'),
    replaceFavorites:  db.prepare('DELETE FROM user_favorites WHERE user_id = ?'),
    insertFavorite:    db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, recipe_id) VALUES (?, ?)'),
    getMakeSoon:       db.prepare('SELECT recipe_id FROM user_make_soon WHERE user_id = ?'),
    replaceMakeSoon:   db.prepare('DELETE FROM user_make_soon WHERE user_id = ?'),
    insertMakeSoon:    db.prepare('INSERT OR IGNORE INTO user_make_soon (user_id, recipe_id) VALUES (?, ?)'),
    getKitchen:        db.prepare('SELECT ingredient_name, storage_type FROM user_kitchen WHERE user_id = ?'),
    replaceKitchen:    db.prepare('DELETE FROM user_kitchen WHERE user_id = ?'),
    insertKitchenItem: db.prepare('INSERT OR IGNORE INTO user_kitchen (user_id, ingredient_name, storage_type) VALUES (?, ?, ?)'),
    insertCookLog:     db.prepare(`INSERT INTO user_cook_log (id, user_id, recipe_id, recipe_name, rating, notes, cooked_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    getCookLogById:    db.prepare('SELECT * FROM user_cook_log WHERE id = ?'),
  };
}

const uuid = () => crypto.randomUUID();

// ─── Grocery Category Mapping ─────────────────────────────────────────────────
// Used by POST /api/grocery-list to group ingredients into aisle sections.
// The lookup is pre-inverted at startup so categorise() is O(1) per ingredient.

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

// Pre-invert CATEGORY_MAP into a flat keyword→category lookup for O(1) categorisation
const KEYWORD_INDEX = new Map();
for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
  for (const kw of keywords) KEYWORD_INDEX.set(kw, cat);
}

function categorise(name) {
  const lower = name.toLowerCase().trim();
  // Exact match first
  if (KEYWORD_INDEX.has(lower)) return KEYWORD_INDEX.get(lower);
  // Substring match: check if any keyword appears in the ingredient name
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

// ─── Helper: format a recipe row from DB ──────────────────────────────────────
const fmtRecipe = r => ({ ...r, tags: JSON.parse(r.tags || '[]'), coverImage: r.cover_image_url });
const fmtCookbook = r => ({ ...r, recipes: JSON.parse(r.recipes || '[]'), coverImage: r.cover_image, spineColor: r.spine_color });

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    if (stmts.getUserByUsername.get(username.trim().toLowerCase())) return res.status(409).json({ error: 'Username already taken' });
    const id = uuid();
    stmts.insertUser.run(id, username.trim().toLowerCase(), null, password);
    const user  = stmts.getUserById.get(id);
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
    const user = stmts.getUserByUsername.get(username.trim().toLowerCase());
    if (!user)                       return res.status(401).json({ error: 'Invalid username or password' });
    if (user.role === 'suspended')   return res.status(403).json({ error: 'Your account has been suspended.' });
    if (password !== user.password_hash) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name || null, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = stmts.getUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.put('/api/user/display-name', authenticateToken, (req, res) => {
  stmts.updateDisplayName.run(req.body.display_name?.trim() || null, req.user.id);
  scheduleUpload();
  res.json({ success: true });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  res.json({ users: stmts.getAllUsers.all() });
});

app.post('/api/auth/create-user', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    if (stmts.getUserByUsername.get(username.trim().toLowerCase())) return res.status(409).json({ error: 'Username already taken' });
    const id = uuid();
    stmts.insertUser.run(id, username.trim().toLowerCase(), display_name?.trim() || null, password);
    const user = stmts.getUserById.get(id);
    scheduleUpload();
    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { role, password } = req.body;
  if (role     !== undefined) stmts.updateUserRole.run(role, req.params.id);
  if (password !== undefined) stmts.updateUserPassword.run(password, req.params.id);
  scheduleUpload();
  res.json({ user: stmts.getUserById.get(req.params.id) });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  // Delete all user data before removing the user row
  const deleteUser = db.transaction(id => {
    db.prepare('DELETE FROM user_favorites WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_make_soon WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_cook_log WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_kitchen WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  deleteUser(req.params.id);
  scheduleUpload();
  res.json({ deleted: true });
});

// ─── Recipes ──────────────────────────────────────────────────────────────────

// GET /api/recipes — returns all recipes with their ingredient name lists.
// Uses a single JOIN query instead of N+1 queries per recipe.
app.get('/api/recipes', (req, res) => {
  try {
    const rows = stmts.getAllRecipes.all();

    // Group the flat JOIN rows back into recipe objects
    const recipeMap = new Map();
    for (const row of rows) {
      if (!recipeMap.has(row.id)) {
        recipeMap.set(row.id, {
          id: row.id, name: row.name, cuisine: row.cuisine, time: row.time,
          servings: row.servings, calories: row.calories, coverImage: row.cover_image_url, status: row.status,
          cookbook: row.cookbook, reference: row.reference, created_at: row.created_at,
          tags: JSON.parse(row.tags || '[]'), ingredients: [],
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

// GET /api/recipes/:id — full recipe detail including ingredients, instructions, notes
app.get('/api/recipes/:id', (req, res) => {
  try {
    const recipe = stmts.getRecipeById.get(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json({
      recipe:          fmtRecipe(recipe),
      bodyIngredients: stmts.getIngredients.all(req.params.id).map(i => ({ ...i, optional: Boolean(i.optional) })),
      instructions:    stmts.getInstructions.all(req.params.id),
      notes:           stmts.getRecipeNotes.all(req.params.id),
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
    stmts.insertRecipe.run(
      id, details.name.trim(), details.cuisine || null, details.time || null,
      details.servings || null, details.calories || null, details.cover_image_url || null, details.status || null,
      details.cookbook || null, details.reference || null,
      JSON.stringify(Array.isArray(details.tags) ? details.tags : [])
    );
    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        stmts.insertIngredient.run(uuid(), id, ing.name.trim().toLowerCase(), ing.amount || null, ing.unit || null, ing.prep_note || null, ing.optional ? 1 : 0, ing.group_label || null, ing.order_index ?? 0);
      }
    }
    if (Array.isArray(instructions)) {
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        stmts.insertInstruction.run(uuid(), id, step.step_number, step.body_text.trim(), step.timer_seconds ?? null, step.group_label || null);
      }
    }
    if (Array.isArray(notes)) {
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        stmts.insertRecipeNote.run(uuid(), id, note.order_index ?? 0, text);
      }
    }
    scheduleUpload();
    res.status(201).json({ recipe: fmtRecipe(stmts.getRecipeById.get(id)) });
  } catch (err) {
    console.error('POST /api/recipes error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/recipes/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;
  try {
    stmts.updateRecipe.run(
      details.name, details.cuisine || null, details.time || null, details.servings || null,
      details.calories || null, details.cover_image_url || null, details.status || null, details.cookbook || null,
      details.reference || null, JSON.stringify(Array.isArray(details.tags) ? details.tags : []), id
    );
    if (ingredients !== undefined) {
      stmts.deleteIngredients.run(id);
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        stmts.insertIngredient.run(uuid(), id, ing.name.trim().toLowerCase(), ing.amount || null, ing.unit || null, ing.prep_note || null, ing.optional ? 1 : 0, ing.group_label || null, ing.order_index ?? 0);
      }
    }
    if (instructions !== undefined) {
      stmts.deleteInstructions.run(id);
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        stmts.insertInstruction.run(uuid(), id, step.step_number, step.body_text.trim(), step.timer_seconds ?? null, step.group_label || null);
      }
    }
    if (notes !== undefined) {
      stmts.deleteRecipeNotes.run(id);
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        stmts.insertRecipeNote.run(uuid(), id, note.order_index ?? 0, text);
      }
    }
    scheduleUpload();
    res.json({ recipe: fmtRecipe(stmts.getRecipeById.get(id)) });
  } catch (err) {
    console.error('PUT /api/recipes/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/recipes/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  // Delete child rows before the parent (foreign_keys = ON would block otherwise)
  stmts.deleteRecipeNotes.run(id);
  stmts.deleteInstructions.run(id);
  stmts.deleteIngredients.run(id);
  db.prepare('DELETE FROM user_favorites WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM user_make_soon WHERE recipe_id = ?').run(id);
  const result = stmts.deleteRecipe.run(id);
  if (!result.changes) return res.status(404).json({ error: 'Recipe not found' });
  scheduleUpload();
  res.json({ deleted: true });
});

// ─── Cookbooks ────────────────────────────────────────────────────────────────

app.get('/api/cookbooks', (req, res) => {
  try {
    res.json({ cookbooks: stmts.getAllCookbooks.all().map(fmtCookbook) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cookbooks', authenticateToken, requireAdmin, (req, res) => {
  const { title, author, coverImage, spineColor, notes } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const id = uuid();
  stmts.insertCookbook.run(id, title.trim(), author || '', coverImage || '', spineColor || '#C65D3B', notes || '');
  scheduleUpload();
  res.status(201).json({ cookbook: fmtCookbook(stmts.getCookbookById.get(id)) });
});

app.put('/api/cookbooks/:id', authenticateToken, requireAdmin, (req, res) => {
  const existing = stmts.getCookbookById.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cookbook not found' });
  const { title, author, coverImage, spineColor, notes, recipes } = req.body;
  stmts.updateCookbook.run(
    title ?? existing.title, author ?? existing.author,
    coverImage ?? existing.cover_image, spineColor ?? existing.spine_color,
    notes ?? existing.notes,
    recipes !== undefined ? JSON.stringify(recipes) : existing.recipes,
    req.params.id
  );
  scheduleUpload();
  res.json({ cookbook: fmtCookbook(stmts.getCookbookById.get(req.params.id)) });
});

// PUT /api/cookbooks/:id/entries — update just the recipes list inside a cookbook
app.put('/api/cookbooks/:id/entries', authenticateToken, requireAdmin, (req, res) => {
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) return res.status(400).json({ error: 'recipes must be an array' });
  stmts.updateCookbookEntries.run(JSON.stringify(recipes), req.params.id);
  const r = stmts.getCookbookById.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Cookbook not found' });
  scheduleUpload();
  res.json({ cookbook: fmtCookbook(r) });
});

app.delete('/api/cookbooks/:id', authenticateToken, requireAdmin, (req, res) => {
  stmts.deleteCookbook.run(req.params.id);
  scheduleUpload();
  res.json({ ok: true });
});

// ─── Cooking Notes ────────────────────────────────────────────────────────────
// Bullets and keywords are fetched with two extra queries (not N×2) then joined
// in JS using Maps — avoids the cartesian product of a 3-table JOIN.

app.get('/api/cooking-notes', (req, res) => {
  try {
    const notes    = stmts.getAllCookingNotes.all();
    const bullets  = stmts.getAllNoteBullets.all();
    const keywords = stmts.getAllNoteKeywords.all();

    // Group bullets and keywords by note_id
    const bulletMap  = new Map();
    const keywordMap = new Map();
    for (const b of bullets)  { if (!bulletMap.has(b.note_id))  bulletMap.set(b.note_id,  []); bulletMap.get(b.note_id).push({ text: b.text, order_index: b.order_index }); }
    for (const k of keywords) { if (!keywordMap.has(k.note_id)) keywordMap.set(k.note_id, []); keywordMap.get(k.note_id).push(k.keyword); }

    res.json({ notes: notes.map(n => ({ ...n, bullets: bulletMap.get(n.id) || [], keywords: keywordMap.get(n.id) || [] })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cooking-notes', authenticateToken, requireAdmin, (req, res) => {
  const { title, body, type, category, image_url, keywords = [], bullets = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!body?.trim())  return res.status(400).json({ error: 'body is required' });
  const id = uuid();
  stmts.insertCookingNote.run(id, title.trim(), body.trim(), type || 'rule', category || 'General Technique', image_url || null);
  for (const b  of bullets)  stmts.insertNoteBullet.run(uuid(), id, b.text, b.order_index ?? 0);
  for (const kw of keywords) if (kw.trim()) stmts.insertNoteKeyword.run(id, kw.trim().toLowerCase());
  scheduleUpload();
  res.status(201).json({ note: { ...stmts.getCookingNoteById.get(id), bullets, keywords } });
});

app.put('/api/cooking-notes/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, body, type, category, image_url, keywords = [], bullets = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  stmts.updateCookingNote.run(title.trim(), body?.trim(), type || 'rule', category || 'General Technique', image_url || null, id);
  stmts.deleteNoteBullets.run(id);
  stmts.deleteNoteKeywords.run(id);
  for (const b  of bullets)  stmts.insertNoteBullet.run(uuid(), id, b.text, b.order_index ?? 0);
  for (const kw of keywords) if (kw.trim()) stmts.insertNoteKeyword.run(id, kw.trim().toLowerCase());
  scheduleUpload();
  res.json({ note: { ...stmts.getCookingNoteById.get(id), bullets, keywords } });
});

app.delete('/api/cooking-notes/:id', authenticateToken, requireAdmin, (req, res) => {
  stmts.deleteNoteBullets.run(req.params.id);
  stmts.deleteNoteKeywords.run(req.params.id);
  const result = stmts.deleteCookingNote.run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Note not found' });
  scheduleUpload();
  res.json({ deleted: true });
});

// ─── User Data ────────────────────────────────────────────────────────────────

app.get('/api/user/favorites', authenticateToken, (req, res) => {
  res.json({ favorites: stmts.getFavorites.all(req.user.id).map(r => r.recipe_id) });
});

app.put('/api/user/favorites', authenticateToken, (req, res) => {
  const { favorites } = req.body;
  if (!Array.isArray(favorites)) return res.status(400).json({ error: 'favorites must be an array' });
  stmts.replaceFavorites.run(req.user.id);
  for (const id of favorites) stmts.insertFavorite.run(req.user.id, id);
  scheduleUpload();
  res.json({ success: true });
});

app.get('/api/user/make-soon', authenticateToken, (req, res) => {
  res.json({ makeSoon: stmts.getMakeSoon.all(req.user.id).map(r => r.recipe_id) });
});

app.put('/api/user/make-soon', authenticateToken, (req, res) => {
  const { makeSoon } = req.body;
  if (!Array.isArray(makeSoon)) return res.status(400).json({ error: 'makeSoon must be an array' });
  stmts.replaceMakeSoon.run(req.user.id);
  for (const id of makeSoon) stmts.insertMakeSoon.run(req.user.id, id);
  scheduleUpload();
  res.json({ success: true });
});

app.get('/api/user/kitchen', authenticateToken, (req, res) => {
  res.json({ kitchen: stmts.getKitchen.all(req.user.id) });
});

app.put('/api/user/kitchen', authenticateToken, (req, res) => {
  const { kitchen } = req.body;
  if (!Array.isArray(kitchen)) return res.status(400).json({ error: 'kitchen must be an array' });
  stmts.replaceKitchen.run(req.user.id);
  for (const item of kitchen) {
    if (!item.ingredient_name?.trim()) continue;
    stmts.insertKitchenItem.run(req.user.id, item.ingredient_name.toLowerCase().trim(), item.storage_type || 'fridge');
  }
  scheduleUpload();
  res.json({ success: true });
});

app.get('/api/user/cook-log', authenticateToken, (req, res) => {
  let sql    = 'SELECT * FROM user_cook_log WHERE user_id = ?';
  const params = [req.user.id];
  if (req.query.recipe_id) { sql += ' AND recipe_id = ?'; params.push(req.query.recipe_id); }
  sql += ' ORDER BY cooked_at DESC';
  res.json({ entries: db.prepare(sql).all(...params) });
});

app.post('/api/user/cook-log', authenticateToken, (req, res) => {
  const { recipe_id, recipe_name, rating, notes, cooked_at } = req.body;
  // Cookbook reference IDs (prefixed 'ref-') are not real recipe rows — store null instead
  const realId = recipe_id && !recipe_id.startsWith('ref-') && recipe_id.length > 10 ? recipe_id : null;
  const id = uuid();
  stmts.insertCookLog.run(id, req.user.id, realId, recipe_name?.trim() || null, rating ?? null, notes?.trim() || null, cooked_at || new Date().toISOString());
  scheduleUpload();
  res.json({ entry: stmts.getCookLogById.get(id) });
});

// ─── Grocery List ─────────────────────────────────────────────────────────────
// Accepts a list of recipe IDs, returns ingredients grouped by aisle category.
// Numeric amounts for the same ingredient+unit are summed; non-numeric amounts
// (e.g. "a handful") are listed as-is.

app.post('/api/grocery-list', (req, res) => {
  const { recipeIds } = req.body;
  if (!Array.isArray(recipeIds) || !recipeIds.length) return res.status(400).json({ error: 'recipeIds must be a non-empty array' });
  try {
    const placeholders = recipeIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.id AS recipe_id, r.name AS recipe_name,
             i.name AS ingredient_name, i.amount, i.unit, i.prep_note, i.optional
      FROM recipes r
      JOIN recipe_ingredients i ON i.recipe_id = r.id
      WHERE r.id IN (${placeholders})
      ORDER BY i.name ASC
    `).all(...recipeIds);

    if (!rows.length) return res.json({ categories: [], recipeNames: [] });

    const recipeNameMap = new Map();
    for (const row of rows) recipeNameMap.set(row.recipe_id, row.recipe_name);

    // Merge duplicate ingredients (same name + unit) across recipes
    const itemMap = new Map();
    for (const row of rows) {
      const key = `${row.ingredient_name.toLowerCase().trim()}||${(row.unit || '').toLowerCase().trim()}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          name: row.ingredient_name, amounts: [], rawAmounts: [],
          unit: row.unit || '', prep_note: row.prep_note || '',
          optional: Boolean(row.optional), recipes: [],
          category: categorise(row.ingredient_name),
        });
      }
      const entry = itemMap.get(key);
      if (!entry.recipes.includes(row.recipe_name)) entry.recipes.push(row.recipe_name);
      const n = row.amount ? parseFloat(row.amount) : NaN;
      if (!isNaN(n)) entry.amounts.push(n);
      else if (row.amount) entry.rawAmounts.push(row.amount);
    }

    // Build display amount string and group by category
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
      .sort((a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99))
      .map(([cat, items]) => ({
        name:  cat.charAt(0).toUpperCase() + cat.slice(1),
        emoji: CATEGORY_META[cat]?.emoji ?? '🛒',
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    res.json({ categories, recipeNames: Array.from(recipeNameMap.values()) });
  } catch (err) {
    console.error('grocery-list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Match Recipes ────────────────────────────────────────────────────────────
// Pure computation — no DB queries. The frontend sends its recipe list and fridge
// contents; we score and sort on the server so the logic lives in one place.

app.post('/api/match', (req, res) => {
  const { fridgeIngredients, recipes } = req.body;
  if (!Array.isArray(fridgeIngredients) || !Array.isArray(recipes)) return res.status(400).json({ error: 'Invalid payload' });
  const fridge = new Set(fridgeIngredients.map(i => i.toLowerCase().trim()));
  const matched = recipes.map(recipe => {
    const ings       = recipe.ingredients || [];
    const have       = ings.filter(i => fridge.has(i));
    const missing    = ings.filter(i => !fridge.has(i));
    const matchScore = ings.length === 0 ? 0 : have.length / ings.length;
    return { ...recipe, have, missing, matchScore, canMake: missing.length === 0 && ings.length > 0 };
  }).sort((a, b) => {
    if (a.canMake !== b.canMake) return a.canMake ? -1 : 1;
    return b.matchScore - a.matchScore;
  });
  res.json({ matched });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────

downloadDBFromDrive().then(() => {
  initDB();
  app.listen(PORT, () => console.log(`🍳 Hearth API running on port ${PORT}`));
});
