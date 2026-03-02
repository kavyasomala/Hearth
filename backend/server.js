const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// ─── GET all recipes from Notion ───────────────────────────────────────────
app.get('/api/recipes', async (req, res) => {
  try {
    const recipes = [];
    let cursor = undefined;

    // Paginate through all results
    while (true) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const props = page.properties;

        // --- Grab title (works for any property named "Name" or "Title") ---
        const titleProp = Object.values(props).find(p => p.type === 'title');
        const name = titleProp?.title?.map(t => t.plain_text).join('') || 'Untitled';

        // --- Grab ingredients multi-select (property name configurable via env) ---
        const ingredientsPropName = process.env.INGREDIENTS_PROPERTY || 'Ingredients';
        const ingredientsProp = props[ingredientsPropName];
        const ingredients = ingredientsProp?.multi_select?.map(i => i.name.toLowerCase().trim()) || [];

        // --- Grab optional extra properties if they exist ---
        const tagsProp = props['Tags'] || props['Category'] || props['Cuisine'];
        const tags = tagsProp?.multi_select?.map(t => t.name) || [];

        const timeProp = props['Time'] || props['Cook Time'] || props['Prep Time'];
        const time = timeProp?.select?.name || timeProp?.rich_text?.map(t => t.plain_text).join('') || null;

        const servingsProp = props['Servings'] || props['Serves'];
        const servings = servingsProp?.number || servingsProp?.rich_text?.map(t => t.plain_text).join('') || null;

        const coverImage = page.cover?.external?.url || page.cover?.file?.url || null;

        recipes.push({
          id: page.id,
          name,
          ingredients,
          tags,
          time,
          servings,
          coverImage,
          notionUrl: page.url,
        });
      }

      if (!response.has_more) break;
      cursor = response.next_cursor;
    }

    res.json({ recipes });
  } catch (err) {
    console.error('Notion API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET all unique ingredients across the database ────────────────────────
// Derived from actual recipe data rather than schema (more reliable)
app.get('/api/ingredients', async (req, res) => {
  try {
    const ingredientSet = new Set();
    let cursor = undefined;

    while (true) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const ingredientsPropName = process.env.INGREDIENTS_PROPERTY || 'Ingredients';
        const prop = page.properties[ingredientsPropName];
        if (prop?.multi_select) {
          prop.multi_select.forEach(i => ingredientSet.add(i.name));
        }
      }

      if (!response.has_more) break;
      cursor = response.next_cursor;
    }

    const ingredients = Array.from(ingredientSet).sort();
    res.json({ ingredients });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── MATCH recipes to fridge ingredients ──────────────────────────────────
app.post('/api/match', async (req, res) => {
  const { fridgeIngredients, recipes } = req.body;
  // fridgeIngredients: string[] (lowercased)
  // recipes: the array from /api/recipes

  const fridge = new Set(fridgeIngredients.map(i => i.toLowerCase().trim()));

  const matched = recipes.map(recipe => {
    const recipeIngredients = recipe.ingredients;
    const have = recipeIngredients.filter(i => fridge.has(i));
    const missing = recipeIngredients.filter(i => !fridge.has(i));
    const matchScore = recipeIngredients.length === 0 ? 0 : have.length / recipeIngredients.length;

    return {
      ...recipe,
      have,
      missing,
      matchScore,
      canMake: missing.length === 0 && recipeIngredients.length > 0,
    };
  });

  // Sort: can make first, then by match score descending
  matched.sort((a, b) => {
    if (a.canMake && !b.canMake) return -1;
    if (!a.canMake && b.canMake) return 1;
    return b.matchScore - a.matchScore;
  });

  res.json({ matched });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🍳 Recipe API running on http://localhost:${PORT}`));
