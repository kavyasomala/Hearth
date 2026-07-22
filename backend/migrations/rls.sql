-- ─── Row Level Security Migration ─────────────────────────────────────────────
-- Run this once in: Supabase dashboard → SQL Editor → New query → Run
--
-- NOTE: The Node.js backend uses the service role key (SUPABASE_SECRET_KEY),
-- which bypasses RLS automatically. These policies protect against direct
-- database access from unauthorized clients (e.g., someone calling the
-- Supabase REST API directly with only an anon key).
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookbooks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookbook_recipes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_kitchen       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_make_soon     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cook_log      ENABLE ROW LEVEL SECURITY;

-- ── users: each user can only see and update their own row ──────────────────
CREATE POLICY "users: own row"
  ON users FOR ALL
  USING (auth.uid() = id);

-- ── recipes: owner has full access; shareable recipes are readable by all ───
CREATE POLICY "recipes: own"
  ON recipes FOR ALL
  USING (auth.uid() = created_by);

CREATE POLICY "recipes: read shareable"
  ON recipes FOR SELECT
  USING (visibility = 'shareable');

-- ── recipe child tables: access if you own the parent recipe ────────────────
CREATE POLICY "recipe_ingredients: own"
  ON recipe_ingredients FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE created_by = auth.uid()));

CREATE POLICY "recipe_steps: own"
  ON recipe_steps FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE created_by = auth.uid()));

CREATE POLICY "recipe_notes: own"
  ON recipe_notes FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE created_by = auth.uid()));

-- ── cookbooks: owner has full access ───────────────────────────────────────
CREATE POLICY "cookbooks: own"
  ON cookbooks FOR ALL
  USING (auth.uid() = created_by);

CREATE POLICY "cookbook_recipes: own"
  ON cookbook_recipes FOR ALL
  USING (cookbook_id IN (SELECT id FROM cookbooks WHERE created_by = auth.uid()));

-- ── cooking_notes: global knowledge base, readable by all authenticated users
CREATE POLICY "cooking_notes: authenticated read"
  ON cooking_notes FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── per-user tables: own rows only ─────────────────────────────────────────
CREATE POLICY "user_kitchen: own"
  ON user_kitchen FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "user_favorites: own"
  ON user_favorites FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "user_make_soon: own"
  ON user_make_soon FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "user_cook_log: own"
  ON user_cook_log FOR ALL
  USING (auth.uid() = user_id);
