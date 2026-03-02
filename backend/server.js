const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// ─── Notion parsing helpers ────────────────────────────────────────────────
const plainText = (richText = []) => richText.map(t => t.plain_text).join('').trim();

const firstFileUrl = (files = []) => {
  const f = files?.[0];
  if (!f) return null;
  if (f.type === 'external') return f.external?.url || null;
  if (f.type === 'file') return f.file?.url || null;
  return null;
};

const getTitle = (props) => {
  const titleProp = Object.values(props).find(p => p.type === 'title');
  return plainText(titleProp?.title) || 'Untitled';
};

const getMultiSelect = (prop) => (prop?.multi_select || []).map(v => v.name);

const getSelectName = (prop) => prop?.select?.name || null;

const getNumber = (prop) => {
  if (!prop) return null;
  if (typeof prop.number === 'number') return prop.number;
  const rt = plainText(prop.rich_text);
  const n = Number(rt);
  return Number.isFinite(n) ? n : null;
};

const getPhotoUrl = (props, page) => {
  const photoProp = props['Photo?'] || props['Photo'] || props['Image'] || props['Photo'];
  if (photoProp?.type === 'files') {
    const url = firstFileUrl(photoProp.files);
    if (url) return url;
  }
  if (photoProp?.type === 'url' && photoProp.url) return photoProp.url;

  return page.cover?.external?.url || page.cover?.file?.url || null;
};

const normalizeRecipeSummary = (page) => {
  const props = page.properties || {};

  const ingredientsPropName = process.env.INGREDIENTS_PROPERTY || 'Ingredients';
  const ingredientsProp = props[ingredientsPropName];
  const ingredients = (ingredientsProp?.multi_select || []).map(i => i.name.toLowerCase().trim());

  const cuisine = getSelectName(props['Cuisine']) || (getMultiSelect(props['Cuisine'])?.[0] || null);
  const tagsProp = props['Tags'] || props['Category'];
  const tags = getMultiSelect(tagsProp);

  const calories = getNumber(props['Calories'] || props['Calorie'] || props['kcal']);
  const protein = getNumber(props['Protein'] || props['Protein (g)']);

  const timeProp = props['Time'] || props['Cook Time'] || props['Prep Time'];
  const time = getSelectName(timeProp) || plainText(timeProp?.rich_text) || null;

  const servingsProp = props['Servings'] || props['Serves'];
  const servings =
    (servingsProp?.number !== undefined && servingsProp?.number !== null)
      ? servingsProp.number
      : (plainText(servingsProp?.rich_text) || null);

  return {
    id: page.id,
    name: getTitle(props),
    ingredients,
    tags,
    cuisine,
    calories,
    protein,
    time,
    servings,
    coverImage: getPhotoUrl(props, page),
    notionUrl: page.url,
  };
};

const listAllBlocks = async (blockId) => {
  const blocks = [];
  let cursor = undefined;

  while (true) {
    const resp = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...resp.results);
    if (!resp.has_more) break;
    cursor = resp.next_cursor;
  }

  return blocks;
};

const blockToNode = (block) => {
  const t = block.type;
  const data = block[t];

  const textFrom = (rt) => plainText(rt || []);

  if (t === 'paragraph') return { type: 'paragraph', text: textFrom(data.rich_text) };
  if (t === 'heading_1') return { type: 'heading_1', text: textFrom(data.rich_text) };
  if (t === 'heading_2') return { type: 'heading_2', text: textFrom(data.rich_text) };
  if (t === 'heading_3') return { type: 'heading_3', text: textFrom(data.rich_text) };
  if (t === 'bulleted_list_item') return { type: 'bulleted_list_item', text: textFrom(data.rich_text) };
  if (t === 'numbered_list_item') return { type: 'numbered_list_item', text: textFrom(data.rich_text) };
  if (t === 'quote') return { type: 'quote', text: textFrom(data.rich_text) };
  if (t === 'divider') return { type: 'divider' };

  if (t === 'image') {
    const url = data.type === 'external' ? data.external?.url : data.file?.url;
    return { type: 'image', url: url || null, caption: textFrom(data.caption) };
  }

  // Fallback: ignore unsupported blocks for now.
  return null;
};

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
        recipes.push(normalizeRecipeSummary(page));
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

// ─── GET a single recipe detail (summary + Notion body) ────────────────────
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const pageId = req.params.id;
    const page = await notion.pages.retrieve({ page_id: pageId });
    const recipe = normalizeRecipeSummary(page);

    const blocks = await listAllBlocks(pageId);
    const content = blocks.map(blockToNode).filter(Boolean).filter(n => {
      if (!n.text) return true;
      return n.text.trim().length > 0;
    });

    res.json({ recipe, content });
  } catch (err) {
    console.error('Notion recipe detail error:', err.message);
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