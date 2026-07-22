/**
 * Hearth API â€” server.js
 *
 * Architecture:
 *  - PostgreSQL (Supabase) via pg Pool
 *  - Auth via Supabase Auth (tokens verified with supabaseAdmin.auth.getUser)
 */

const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const { Pool }   = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'https://hearth-z2lo.onrender.com' }));
app.use(express.json());

// â”€â”€â”€ Database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q    = (sql, params) => pool.query(sql, params);
const uuid = () => crypto.randomUUID();

// â”€â”€â”€ Schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function initDB() {
  // â”€â”€ Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username      TEXT UNIQUE NOT NULL,
      display_name  TEXT,
      email         TEXT UNIQUE,
      avatar_url    TEXT,
      role          TEXT NOT NULL DEFAULT 'guest'
                      CHECK (role IN ('admin','guest','suspended')),
      deleted_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS recipes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT NOT NULL,
      cuisine         TEXT,
      time_minutes    INTEGER,
      servings        INTEGER,
      cover_image_url TEXT,
      status          TEXT CHECK (status IN ('to try','made it','needs tweaking','archived')),
      reference       TEXT,
      source_url      TEXT,
      tags            TEXT[]  DEFAULT '{}',
      calories        INTEGER,
      created_by      UUID    REFERENCES users(id) ON DELETE SET NULL,
      visibility      TEXT    NOT NULL DEFAULT 'private'
                        CHECK (visibility IN ('private','shareable')),
      search_vector   TSVECTOR,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      amount      TEXT,
      unit        TEXT,
      prep_note   TEXT,
      optional    BOOLEAN DEFAULT FALSE,
      group_label TEXT,
      order_index INTEGER DEFAULT 0
    )`,

    `CREATE TABLE IF NOT EXISTS recipe_steps (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_number   INTEGER,
      body_text     TEXT,
      timer_seconds INTEGER,
      group_label   TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS recipe_notes (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      order_index INTEGER DEFAULT 0,
      body_text   TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS cookbooks (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT NOT NULL,
      author      TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      spine_color TEXT DEFAULT '#C65D3B',
      notes       TEXT DEFAULT '',
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS cookbook_recipes (
      cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
      recipe_id   UUID NOT NULL REFERENCES recipes(id)   ON DELETE CASCADE,
      order_index INTEGER DEFAULT 0,
      added_at    TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (cookbook_id, recipe_id)
    )`,

    // bullets: [{text, order_index}]  keywords: ['salt','acid',...]
    `CREATE TABLE IF NOT EXISTS cooking_notes (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      type       TEXT    DEFAULT 'rule',
      category   TEXT    DEFAULT 'General Technique',
      image_url  TEXT,
      keywords   TEXT[]  DEFAULT '{}',
      bullets    JSONB   DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_kitchen (
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ingredient_name TEXT NOT NULL,
      storage_type    TEXT DEFAULT 'fridge'
                        CHECK (storage_type IN ('fridge','freezer','pantry')),
      PRIMARY KEY (user_id, ingredient_name)
    )`,

    `CREATE TABLE IF NOT EXISTS user_favorites (
      user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      added_at  TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, recipe_id)
    )`,

    `CREATE TABLE IF NOT EXISTS user_make_soon (
      user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      added_at  TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, recipe_id)
    )`,

    `CREATE TABLE IF NOT EXISTS user_cook_log (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipe_id   UUID REFERENCES recipes(id) ON DELETE SET NULL,
      recipe_name TEXT,
      rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
      notes       TEXT,
      cooked_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  for (const sql of tables) await q(sql);

  // â”€â”€ Trigger functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await q(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$
  `);

  await q(`
    CREATE OR REPLACE FUNCTION recipes_search_update()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english',
        coalesce(NEW.name, '')    || ' ' ||
        coalesce(NEW.cuisine, '') || ' ' ||
        coalesce(array_to_string(NEW.tags, ' '), '')
      );
      RETURN NEW;
    END;
    $$
  `);

  // â”€â”€ Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const triggers = [
    `DROP TRIGGER IF EXISTS trg_recipes_updated_at    ON recipes`,
    `CREATE TRIGGER trg_recipes_updated_at
       BEFORE UPDATE ON recipes
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

    `DROP TRIGGER IF EXISTS trg_cookbooks_updated_at  ON cookbooks`,
    `CREATE TRIGGER trg_cookbooks_updated_at
       BEFORE UPDATE ON cookbooks
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

    `DROP TRIGGER IF EXISTS trg_cooking_notes_updated_at ON cooking_notes`,
    `CREATE TRIGGER trg_cooking_notes_updated_at
       BEFORE UPDATE ON cooking_notes
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

    `DROP TRIGGER IF EXISTS trg_recipes_search ON recipes`,
    `CREATE TRIGGER trg_recipes_search
       BEFORE INSERT OR UPDATE ON recipes
       FOR EACH ROW EXECUTE FUNCTION recipes_search_update()`,
  ];
  for (const sql of triggers) await q(sql);

  // â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const indexes = [
    // Recipe children â€” most queried FKs
    `CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id)`,
    `CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe       ON recipe_steps(recipe_id)`,
    `CREATE INDEX IF NOT EXISTS idx_recipe_notes_recipe       ON recipe_notes(recipe_id)`,

    // Cookbook join table â€” both directions
    `CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_cookbook ON cookbook_recipes(cookbook_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_recipe   ON cookbook_recipes(recipe_id)`,

    // User data â€” always filtered by user
    `CREATE INDEX IF NOT EXISTS idx_user_favorites_user  ON user_favorites(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_make_soon_user  ON user_make_soon(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_kitchen_user    ON user_kitchen(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cook_log_user_date   ON user_cook_log(user_id, cooked_at DESC)`,

    // Recipe filtering & sorting
    `CREATE INDEX IF NOT EXISTS idx_recipes_created_by   ON recipes(created_by)`,
    `CREATE INDEX IF NOT EXISTS idx_recipes_cuisine      ON recipes(cuisine)`,
    `CREATE INDEX IF NOT EXISTS idx_recipes_time         ON recipes(time_minutes)`,
    `CREATE INDEX IF NOT EXISTS idx_recipes_created_at   ON recipes(created_at DESC)`,

    // GIN indexes â€” full-text search and tag filtering
    `CREATE INDEX IF NOT EXISTS idx_recipes_search_vector ON recipes USING GIN(search_vector)`,
    `CREATE INDEX IF NOT EXISTS idx_recipes_tags          ON recipes USING GIN(tags)`,
  ];
  for (const sql of indexes) await q(sql);

  // Migrate status constraint from draft/published/archived to lifecycle values
  await q(`ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_status_check`);
  await q(`ALTER TABLE recipes ADD CONSTRAINT recipes_status_check CHECK (status IN ('to try','made it','needs tweaking','archived'))`);

  // Migrate users: drop password_hash (Supabase Auth manages credentials now)
  await q(`ALTER TABLE users DROP COLUMN IF EXISTS password_hash`);

  console.log('ðŸ—„ï¸  Database ready (12 tables, indexes, triggers)');
}

// â”€â”€â”€ Grocery Category Mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORY_MAP = {
  produce:       ['onion','garlic','ginger','tomato','tomatoes','lemon','lime','spinach','carrot','carrots','celery','potato','potatoes','bell pepper','cucumber','zucchini','broccoli','cauliflower','mushroom','mushrooms','avocado','lettuce','kale','cabbage','spring onion','scallion','shallot','shallots','chilli','chili','jalapeÃ±o','capsicum','leek','asparagus','eggplant','aubergine','sweet potato','pumpkin','butternut squash','beetroot','radish','green beans','peas','corn','coriander','cilantro','parsley','basil','mint','thyme','rosemary','dill','chives','bay leaves','lemongrass','orange','lime leaves','thai basil','apple','banana','mango','berry','berries','strawberry','blueberry','peach','pear','grape','cherry'],
  'meat & fish': ['chicken','beef','pork','lamb','turkey','duck','bacon','sausage','mince','ground beef','ground pork','steak','salmon','tuna','shrimp','prawns','cod','tilapia','fish','crab','lobster','scallops','mussels','anchovies','ham','pancetta','prosciutto','chorizo','salami','veal','brisket','ribs','meatball','swordfish','trout','halibut','clams','oysters','squid','calamari'],
  dairy:         ['egg','eggs','milk','butter','cream','heavy cream','double cream','sour cream','yogurt','greek yogurt','cheese','parmesan','cheddar','feta','mozzarella','ricotta','cream cheese','brie','gouda','halloumi','creme fraiche','ghee','buttermilk','condensed milk','coconut milk','coconut cream'],
  sauces:        ['soy sauce','fish sauce','oyster sauce','hoisin sauce','worcestershire sauce','hot sauce','sriracha','ketchup','mayonnaise','ranch','caesar dressing','tomato paste','tomato sauce','passata','canned tomatoes','diced tomatoes','peanut butter','tahini','miso','mustard','dijon mustard','bbq sauce','teriyaki sauce','sambal','chilli sauce','aioli','pesto','hummus','vinaigrette','maple syrup','honey'],
  spices:        ['salt','pepper','black pepper','cumin','coriander powder','turmeric','paprika','smoked paprika','chilli flakes','cayenne','cinnamon','nutmeg','cardamom','cloves','star anise','bay leaf','oregano','dried thyme','dried rosemary','dried basil','mixed herbs','curry powder','garam masala','five spice','white pepper','msg','sesame seeds','chilli powder','allspice','vanilla extract','baking powder','baking soda','yeast'],
  alcohol:       ['wine','red wine','white wine','beer','vodka','rum','whiskey','bourbon','gin','tequila','brandy','sake','mirin','rice wine','sherry','port','champagne','prosecco','vermouth','kahlua'],
  staples:       ['rice','pasta','noodles','flour','bread','breadcrumbs','panko','oats','quinoa','lentils','chickpeas','black beans','kidney beans','cannellini beans','split peas','couscous','polenta','cornmeal','tortilla','wrap','pita','stock','broth','chicken stock','beef stock','vegetable stock','oil','olive oil','sesame oil','vegetable oil','coconut oil','vinegar','balsamic vinegar','rice vinegar','apple cider vinegar','sugar','brown sugar','cornstarch','cornflour','chocolate','cocoa','dried pasta','udon','rice noodles','glass noodles','wonton wrappers','frozen peas','frozen corn','frozen spinach','frozen edamame','frozen berries','ice cream','frozen prawns','frozen shrimp'],
};
const CATEGORY_META = {
  produce:       { emoji: 'ðŸ¥¦', order: 1 },
  'meat & fish': { emoji: 'ðŸ¥©', order: 2 },
  dairy:         { emoji: 'ðŸ¥›', order: 3 },
  sauces:        { emoji: 'ðŸ«™', order: 4 },
  spices:        { emoji: 'ðŸ§‚', order: 5 },
  alcohol:       { emoji: 'ðŸ·', order: 6 },
  staples:       { emoji: 'ðŸŒ¾', order: 7 },
  other:         { emoji: 'ðŸ›’', order: 8 },
};

const KEYWORD_INDEX = new Map();
for (const [cat, kws] of Object.entries(CATEGORY_MAP)) for (const kw of kws) KEYWORD_INDEX.set(kw, cat);

function categorise(name) {
  const lower = name.toLowerCase().trim();
  if (KEYWORD_INDEX.has(lower)) return KEYWORD_INDEX.get(lower);
  for (const [kw, cat] of KEYWORD_INDEX) if (lower.includes(kw)) return cat;
  return 'other';
}

// â”€â”€â”€ Auth Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // Upsert user in our table and return their role in one query
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || null;
  const username    = (user.email || '').split('@')[0];
  const role        = user.email === process.env.ADMIN_EMAIL ? 'admin' : 'guest';

  const { rows: [dbUser] } = await q(`
    INSERT INTO users (id, username, display_name, email, role)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      email        = EXCLUDED.email,
      display_name = COALESCE(NULLIF(users.display_name, ''), EXCLUDED.display_name),
      role         = CASE WHEN $5 = 'admin' THEN 'admin'::text ELSE users.role END
    RETURNING role, username, display_name, avatar_url
  `, [user.id, username, displayName, user.email, role]);

  req.user = { id: user.id, email: user.email, role: dbUser?.role || 'guest' };
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// tags and ingredients are native arrays from pg â€” no JSON.parse needed
const fmtRecipe = r => ({ ...r, coverImage: r.cover_image_url });

// Returns cookbook.recipes as [{recipeId, name, page, image, tags, addedAt}] â€”
// same shape the frontend CookbooksTab has always expected.
const COOKBOOK_SELECT = `
  SELECT c.id, c.title, c.author, c.cover_image, c.spine_color, c.notes,
         c.created_by, c.created_at, c.updated_at,
         COALESCE(
           json_agg(json_build_object(
             'recipeId',  r.id,
             'name',      r.name,
             'page',      r.reference,
             'image',     r.cover_image_url,
             'tags',      r.tags,
             'addedAt',   EXTRACT(EPOCH FROM cr.added_at) * 1000
           ) ORDER BY cr.order_index) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS recipes
  FROM cookbooks c
  LEFT JOIN cookbook_recipes cr ON cr.cookbook_id = c.id
  LEFT JOIN recipes r ON r.id = cr.recipe_id`;

const fmtCookbook = r => ({ ...r, coverImage: r.cover_image, spineColor: r.spine_color });

// â”€â”€â”€ Auth Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const { rows: [user] } = await q('SELECT id, username, display_name, role, email, avatar_url FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.put('/api/user/display-name', authenticateToken, async (req, res) => {
  await q('UPDATE users SET display_name = $1 WHERE id = $2', [req.body.display_name?.trim() || null, req.user.id]);
  res.json({ success: true });
});

// â”€â”€â”€ Admin Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT id, username, display_name, role, email, created_at FROM users ORDER BY created_at ASC');
  res.json({ users: rows });
});

app.post('/api/auth/create-user', authenticateToken, requireAdmin, async (req, res) => {
  const { username, display_name } = req.body;
  if (!username?.trim()) return res.status(400).json({ error: 'Email is required' });
  try {
    const existing = await q('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'User already exists' });
    // Invite via Supabase Auth â€” user gets an email to set their password
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(username.trim());
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ user: { id: data.user.id, email: data.user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (role !== undefined) await q('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
  const { rows: [user] } = await q('SELECT id, username, display_name, role FROM users WHERE id = $1', [req.params.id]);
  res.json({ user });
});

// CASCADE handles: user_favorites, user_make_soon, user_cook_log, user_kitchen
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const result = await q('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'User not found' });
  res.json({ deleted: true });
});

// â”€â”€â”€ Recipe URL Import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseIsoDuration(iso) {
  if (!iso) return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?/i);
  if (!m) return null;
  const total = parseInt(m[1]||0)*1440 + parseInt(m[2]||0)*60 + parseInt(m[3]||0);
  return total > 0 ? total : null;
}

function extractJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item['@graph']) {
          const r = item['@graph'].find(n => [].concat(n['@type']||[]).includes('Recipe'));
          if (r) return r;
        }
        if ([].concat(item['@type']||[]).includes('Recipe')) return item;
      }
    } catch {}
  }
  return null;
}

function normalizeImport(data, sourceUrl) {
  const name = (data.name || '').trim();

  let cover_image_url = '';
  if (data.image) {
    const img = Array.isArray(data.image) ? data.image[0] : data.image;
    cover_image_url = typeof img === 'string' ? img : (img?.url || '');
  }

  const cookMins  = parseIsoDuration(data.cookTime);
  const prepMins  = parseIsoDuration(data.prepTime);
  const totalMins = parseIsoDuration(data.totalTime);
  const time_minutes = totalMins || (cookMins && prepMins ? cookMins + prepMins : cookMins || prepMins) || null;

  let servings = null;
  if (data.recipeYield) {
    const y = Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield;
    const n = String(y).match(/\d+/);
    if (n) servings = parseInt(n[0]);
  }

  // Keep ingredients as raw strings â€” user reviews in the editor
  const ingredients = (data.recipeIngredient || [])
    .map((raw, i) => ({ _id: `i${i}`, name: String(raw).trim(), amount: '', unit: '', prep_note: '', optional: false, group_label: '' }))
    .filter(ing => ing.name);

  const steps = [];
  let sn = 1;
  const flattenSteps = (items, label = '') => {
    for (const item of (items || [])) {
      const types = [].concat(item['@type'] || []);
      if (typeof item === 'string') {
        if (item.trim()) steps.push({ _id: `s${sn}`, step_number: sn++, body_text: item.trim(), group_label: label, timer_seconds: null });
      } else if (types.includes('HowToStep')) {
        const text = (item.text || item.name || '').replace(/<[^>]+>/g, '').trim();
        if (text) steps.push({ _id: `s${sn}`, step_number: sn++, body_text: text, group_label: label, timer_seconds: null });
      } else if (types.includes('HowToSection')) {
        flattenSteps(item.itemListElement || [], (item.name || '').trim());
      }
    }
  };
  flattenSteps(data.recipeInstructions || []);

  const rawCuisine = data.recipeCuisine || '';
  const cuisine = (Array.isArray(rawCuisine) ? rawCuisine[0] : rawCuisine).trim();

  let tags = [];
  if (data.keywords) {
    const kws = Array.isArray(data.keywords) ? data.keywords : String(data.keywords).split(/[,;]/);
    tags = kws.map(k => k.trim()).filter(Boolean).slice(0, 10);
  }
  if (data.recipeCategory) {
    const cats = [].concat(data.recipeCategory).map(c => c.trim()).filter(Boolean);
    tags = [...new Set([...tags, ...cats])].slice(0, 10);
  }

  const notes = data.description?.trim()
    ? [{ _id: 'n0', text: data.description.trim() }]
    : [];

  return { name, cover_image_url, time_minutes, servings, cuisine, tags, ingredients, steps, notes, source_url: sourceUrl };
}

app.post('/api/recipes/import-url', authenticateToken, requireAdmin, async (req, res) => {
  const { url } = req.body;
  if (!url?.startsWith('http')) return res.status(400).json({ error: 'A valid http/https URL is required.' });
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) throw new Error(`Site returned ${resp.status}`);
    const html = await resp.text();
    const jsonLd = extractJsonLd(html);
    if (!jsonLd) return res.status(422).json({
      error: 'No recipe data found on this page. Works best with AllRecipes, NYT Cooking, Serious Eats, Food52, Bon AppÃ©tit, and most major recipe sites.',
    });
    res.json({ recipe: normalizeImport(jsonLd, url) });
  } catch (err) {
    if (err.name === 'TimeoutError') return res.status(504).json({ error: 'The site took too long to respond.' });
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€â”€ Recipes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Single query via json_agg â€” one row per recipe regardless of ingredient count
app.get('/api/recipes', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT r.id, r.name, r.cuisine, r.time_minutes, r.servings, r.calories,
             r.cover_image_url, r.status, r.reference, r.source_url,
             r.tags, r.created_by, r.visibility, r.created_at, r.updated_at,
             COALESCE(
               json_agg(ri.name ORDER BY ri.order_index)
               FILTER (WHERE ri.name IS NOT NULL), '[]'
             ) AS ingredients
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      GROUP BY r.id
      ORDER BY r.name ASC
    `);
    res.json({ recipes: rows.map(fmtRecipe) });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

app.get('/api/recipes/:id', async (req, res) => {
  try {
    const { rows: [recipe] } = await q('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    const { rows: ings  } = await q('SELECT * FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY order_index ASC', [req.params.id]);
    const { rows: steps } = await q('SELECT * FROM recipe_steps       WHERE recipe_id = $1 ORDER BY step_number ASC',  [req.params.id]);
    const { rows: notes } = await q('SELECT id, order_index, body_text AS text FROM recipe_notes WHERE recipe_id = $1 ORDER BY order_index ASC', [req.params.id]);
    res.json({
      recipe:          fmtRecipe(recipe),
      bodyIngredients: ings.map(i => ({ ...i, optional: Boolean(i.optional) })),
      instructions:    steps,   // keep key name for frontend compat
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
    const { rows: [{ id }] } = await client.query(
      `INSERT INTO recipes
         (name, cuisine, time_minutes, servings, calories, cover_image_url,
          status, reference, source_url, tags, created_by, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        details.name.trim(),
        details.cuisine       || null,
        parseInt(details.time_minutes ?? details.time) || null,
        parseInt(details.servings)   || null,
        parseInt(details.calories)   || null,
        details.cover_image_url      || null,
        details.status               || null,
        details.reference            || null,
        details.source_url           || null,
        Array.isArray(details.tags) ? details.tags : [],
        req.user.id,
        details.visibility || 'private',
      ]
    );
    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id,name,amount,unit,prep_note,optional,group_label,order_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, ing.name.trim().toLowerCase(), ing.amount||null, ing.unit||null,
           ing.prep_note||null, Boolean(ing.optional), ing.group_label||null, ing.order_index??0]
        );
      }
    }
    if (Array.isArray(instructions)) {
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO recipe_steps (recipe_id,step_number,body_text,timer_seconds,group_label)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, step.step_number, step.body_text.trim(), step.timer_seconds??null, step.group_label||null]
        );
      }
    }
    if (Array.isArray(notes)) {
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        await client.query(
          `INSERT INTO recipe_notes (recipe_id,order_index,body_text) VALUES ($1,$2,$3)`,
          [id, note.order_index??0, text]
        );
      }
    }
    await client.query('COMMIT');
    const { rows: [recipe] } = await q('SELECT * FROM recipes WHERE id = $1', [id]);
    res.status(201).json({ recipe: fmtRecipe(recipe) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/recipes error:', err);
    // FK violation on created_by means the JWT carries a stale user ID (e.g. after a schema rebuild)
    if (err.code === '23503') return res.status(401).json({ error: 'Session expired â€” please log out and log back in.' });
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.put('/api/recipes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { details, ingredients, instructions, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE recipes SET
         name=$1, cuisine=$2, time_minutes=$3, servings=$4, calories=$5,
         cover_image_url=$6, status=$7, reference=$8, source_url=$9,
         tags=$10, visibility=$11
       WHERE id=$12`,
      [
        details.name,
        details.cuisine     || null,
        parseInt(details.time_minutes ?? details.time) || null,
        parseInt(details.servings)   || null,
        parseInt(details.calories)   || null,
        details.cover_image_url      || null,
        details.status               || null,
        details.reference            || null,
        details.source_url           || null,
        Array.isArray(details.tags) ? details.tags : [],
        details.visibility || 'private',
        id,
      ]
    );
    if (ingredients !== undefined) {
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
      for (const ing of ingredients) {
        if (!ing.name?.trim()) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id,name,amount,unit,prep_note,optional,group_label,order_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, ing.name.trim().toLowerCase(), ing.amount||null, ing.unit||null,
           ing.prep_note||null, Boolean(ing.optional), ing.group_label||null, ing.order_index??0]
        );
      }
    }
    if (instructions !== undefined) {
      await client.query('DELETE FROM recipe_steps WHERE recipe_id = $1', [id]);
      for (const step of instructions) {
        if (!step.body_text?.trim()) continue;
        await client.query(
          `INSERT INTO recipe_steps (recipe_id,step_number,body_text,timer_seconds,group_label)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, step.step_number, step.body_text.trim(), step.timer_seconds??null, step.group_label||null]
        );
      }
    }
    if (notes !== undefined) {
      await client.query('DELETE FROM recipe_notes WHERE recipe_id = $1', [id]);
      for (const note of notes) {
        const text = note.text?.trim() || note.body_text?.trim();
        if (!text) continue;
        await client.query(
          `INSERT INTO recipe_notes (recipe_id,order_index,body_text) VALUES ($1,$2,$3)`,
          [id, note.order_index??0, text]
        );
      }
    }
    await client.query('COMMIT');
    const { rows: [recipe] } = await q('SELECT * FROM recipes WHERE id = $1', [id]);
    res.json({ recipe: fmtRecipe(recipe) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/recipes/:id error:', err);
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// CASCADE handles: recipe_ingredients, recipe_steps, recipe_notes,
//                  cookbook_recipes, user_favorites, user_make_soon
// user_cook_log.recipe_id SET NULL (preserves cook history)
app.delete('/api/recipes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const result = await q('DELETE FROM recipes WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Recipe not found' });
  res.json({ deleted: true });
});

// â”€â”€â”€ Cookbooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/cookbooks', async (req, res) => {
  try {
    const { rows } = await q(`${COOKBOOK_SELECT} GROUP BY c.id ORDER BY c.title ASC`);
    res.json({ cookbooks: rows.map(fmtCookbook) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cookbooks', authenticateToken, requireAdmin, async (req, res) => {
  const { title, author, coverImage, spineColor, notes } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const { rows: [{ id }] } = await q(
    `INSERT INTO cookbooks (title,author,cover_image,spine_color,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [title.trim(), author||'', coverImage||'', spineColor||'#C65D3B', notes||'', req.user.id]
  );
  const { rows: [cb] } = await q(`${COOKBOOK_SELECT} WHERE c.id=$1 GROUP BY c.id`, [id]);
  res.status(201).json({ cookbook: fmtCookbook(cb) });
});

app.put('/api/cookbooks/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { rows: [existing] } = await q('SELECT * FROM cookbooks WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Cookbook not found' });
  const { title, author, coverImage, spineColor, notes } = req.body;
  await q(
    `UPDATE cookbooks SET title=$1,author=$2,cover_image=$3,spine_color=$4,notes=$5 WHERE id=$6`,
    [title??existing.title, author??existing.author, coverImage??existing.cover_image,
     spineColor??existing.spine_color, notes??existing.notes, req.params.id]
  );
  const { rows: [cb] } = await q(`${COOKBOOK_SELECT} WHERE c.id=$1 GROUP BY c.id`, [req.params.id]);
  res.json({ cookbook: fmtCookbook(cb) });
});

app.put('/api/cookbooks/:id/entries', authenticateToken, requireAdmin, async (req, res) => {
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) return res.status(400).json({ error: 'recipes must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cookbook_recipes WHERE cookbook_id = $1', [req.params.id]);
    for (let i = 0; i < recipes.length; i++) {
      // Accept both UUID strings and entry objects {recipeId, ...}
      const recipeId = typeof recipes[i] === 'string' ? recipes[i] : (recipes[i]?.recipeId || recipes[i]?.id);
      if (!recipeId) continue;
      await client.query(
        'INSERT INTO cookbook_recipes (cookbook_id,recipe_id,order_index) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [req.params.id, recipeId, i]
      );
    }
    await client.query('COMMIT');
    const { rows: [cb] } = await q(`${COOKBOOK_SELECT} WHERE c.id=$1 GROUP BY c.id`, [req.params.id]);
    if (!cb) return res.status(404).json({ error: 'Cookbook not found' });
    res.json({ cookbook: fmtCookbook(cb) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// CASCADE handles cookbook_recipes
app.delete('/api/cookbooks/:id', authenticateToken, requireAdmin, async (req, res) => {
  await q('DELETE FROM cookbooks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// â”€â”€â”€ Cooking Notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/cooking-notes', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM cooking_notes ORDER BY category ASC, created_at ASC');
    res.json({ notes: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cooking-notes', authenticateToken, requireAdmin, async (req, res) => {
  const { title, body, type, category, image_url, keywords=[], bullets=[] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!body?.trim())  return res.status(400).json({ error: 'body is required' });
  const { rows: [note] } = await q(
    `INSERT INTO cooking_notes (title,body,type,category,image_url,keywords,bullets)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title.trim(), body.trim(), type||'rule', category||'General Technique', image_url||null,
     keywords.map(k => k.trim().toLowerCase()).filter(Boolean),
     JSON.stringify(bullets)]
  );
  res.status(201).json({ note });
});

app.put('/api/cooking-notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, body, type, category, image_url, keywords=[], bullets=[] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const { rows: [note] } = await q(
    `UPDATE cooking_notes
     SET title=$1,body=$2,type=$3,category=$4,image_url=$5,keywords=$6,bullets=$7
     WHERE id=$8 RETURNING *`,
    [title.trim(), body?.trim(), type||'rule', category||'General Technique', image_url||null,
     keywords.map(k => k.trim().toLowerCase()).filter(Boolean),
     JSON.stringify(bullets), req.params.id]
  );
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

// No satellite tables to clean up
app.delete('/api/cooking-notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const result = await q('DELETE FROM cooking_notes WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Note not found' });
  res.json({ deleted: true });
});

// â”€â”€â”€ User Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/user/favorites', authenticateToken, async (req, res) => {
  const { rows } = await q('SELECT recipe_id FROM user_favorites WHERE user_id = $1 ORDER BY added_at DESC', [req.user.id]);
  res.json({ favorites: rows.map(r => r.recipe_id) });
});

app.put('/api/user/favorites', authenticateToken, async (req, res) => {
  const { favorites } = req.body;
  if (!Array.isArray(favorites)) return res.status(400).json({ error: 'favorites must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_favorites WHERE user_id = $1', [req.user.id]);
    for (const id of favorites)
      await client.query('INSERT INTO user_favorites (user_id,recipe_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.get('/api/user/make-soon', authenticateToken, async (req, res) => {
  const { rows } = await q('SELECT recipe_id FROM user_make_soon WHERE user_id = $1 ORDER BY added_at DESC', [req.user.id]);
  res.json({ makeSoon: rows.map(r => r.recipe_id) });
});

app.put('/api/user/make-soon', authenticateToken, async (req, res) => {
  const { makeSoon } = req.body;
  if (!Array.isArray(makeSoon)) return res.status(400).json({ error: 'makeSoon must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_make_soon WHERE user_id = $1', [req.user.id]);
    for (const id of makeSoon)
      await client.query('INSERT INTO user_make_soon (user_id,recipe_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
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
      await client.query(
        'INSERT INTO user_kitchen (user_id,ingredient_name,storage_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [req.user.id, item.ingredient_name.toLowerCase().trim(), item.storage_type||'fridge']
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.get('/api/user/cook-log', authenticateToken, async (req, res) => {
  if (req.query.recipe_id) {
    const { rows } = await q(
      'SELECT * FROM user_cook_log WHERE user_id=$1 AND recipe_id=$2 ORDER BY cooked_at DESC',
      [req.user.id, req.query.recipe_id]
    );
    return res.json({ entries: rows });
  }
  const { rows } = await q('SELECT * FROM user_cook_log WHERE user_id=$1 ORDER BY cooked_at DESC', [req.user.id]);
  res.json({ entries: rows });
});

app.post('/api/user/cook-log', authenticateToken, async (req, res) => {
  const { recipe_id, recipe_name, rating, notes, cooked_at } = req.body;
  const realId = recipe_id && !recipe_id.startsWith('ref-') && recipe_id.length > 10 ? recipe_id : null;
  const { rows: [entry] } = await q(
    `INSERT INTO user_cook_log (user_id,recipe_id,recipe_name,rating,notes,cooked_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, realId, recipe_name?.trim()||null, rating??null, notes?.trim()||null, cooked_at||new Date().toISOString()]
  );
  res.json({ entry });
});

// â”€â”€â”€ Grocery List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/api/grocery-list', async (req, res) => {
  const { recipeIds } = req.body;
  if (!Array.isArray(recipeIds) || !recipeIds.length)
    return res.status(400).json({ error: 'recipeIds must be a non-empty array' });
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
    const itemMap = new Map();
    for (const row of rows) {
      recipeNameMap.set(row.recipe_id, row.recipe_name);
      const key = `${row.ingredient_name.toLowerCase().trim()}||${(row.unit||'').toLowerCase().trim()}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { name: row.ingredient_name, amounts: [], rawAmounts: [], unit: row.unit||'',
          prep_note: row.prep_note||'', optional: Boolean(row.optional), recipes: [], category: categorise(row.ingredient_name) });
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
      catMap.get(item.category).push({ name: item.name, amount: displayAmount, unit: item.unit,
        prep_note: item.prep_note, optional: item.optional, recipes: item.recipes });
    }

    const categories = Array.from(catMap.entries())
      .sort((a, b) => (CATEGORY_META[a[0]]?.order??99) - (CATEGORY_META[b[0]]?.order??99))
      .map(([cat, items]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        emoji: CATEGORY_META[cat]?.emoji ?? 'ðŸ›’',
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    res.json({ categories, recipeNames: Array.from(recipeNameMap.values()) });
  } catch (err) {
    console.error('grocery-list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€â”€ Match Recipes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/api/match', (req, res) => {
  const { fridgeIngredients, recipes } = req.body;
  if (!Array.isArray(fridgeIngredients) || !Array.isArray(recipes))
    return res.status(400).json({ error: 'Invalid payload' });
  const fridge = new Set(fridgeIngredients.map(i => i.toLowerCase().trim()));
  const matched = recipes.map(recipe => {
    const ings    = recipe.ingredients || [];
    const have    = ings.filter(i => fridge.has(i));
    const missing = ings.filter(i => !fridge.has(i));
    return { ...recipe, have, missing,
      matchScore: ings.length === 0 ? 0 : have.length / ings.length,
      canMake: missing.length === 0 && ings.length > 0 };
  }).sort((a, b) => {
    if (a.canMake !== b.canMake) return a.canMake ? -1 : 1;
    return b.matchScore - a.matchScore;
  });
  res.json({ matched });
});

// â”€â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/health', (req, res) => res.json({ ok: true }));

// â”€â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

initDB().then(() => {
  // Admin role is granted automatically in authenticateToken when email === ADMIN_EMAIL
  app.listen(PORT, () => console.log('Hearth API running on port ' + PORT));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
