/**
 * Import parsed CSV data into Supabase Postgres.
 *
 * - ingredients: looks up IDs from existing ingredients table (never modifies it)
 * - recipe_body_ingredients: clears then re-imports row by row
 * - instructions: clears then re-imports row by row
 * - notes: clears then re-imports row by row
 *
 * Expected CSV files in the current directory:
 *   - parsed-ingredients-clean.csv
 *   - parsed-instructions.csv
 *   - parsed-notes.csv
 *
 * Run:
 *   node importParsedData.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function readCsv(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  return ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase().trim());
}

function toInt(value, defaultVal = 0) {
  if (value === undefined || value === null || value === '') return defaultVal;
  const n = parseInt(value, 10);
  return isNaN(n) ? defaultVal : n;
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Reading CSV files...');
  const ingredientRows = readCsv('parsed-ingredients-clean.csv');
  const instructionRows = readCsv('parsed-instructions.csv');
  const noteRows = readCsv('parsed-notes.csv');

  console.log(
    `parsed-ingredients-clean.csv : ${ingredientRows.length} rows\n` +
    `parsed-instructions.csv      : ${instructionRows.length} rows\n` +
    `parsed-notes.csv             : ${noteRows.length} rows`
  );

  // Step 1: Load ingredient name -> id map
  console.log('\nLoading ingredients from DB...');
  const { rows: ingRows } = await query('SELECT id, name FROM ingredients');
  const ingredientMap = new Map();
  for (const row of ingRows) {
    ingredientMap.set(row.name.toLowerCase().trim(), row.id);
  }
  console.log(`Loaded ${ingredientMap.size} ingredients.`);

  // Step 2: Clear tables in one safe transaction
  console.log('\nClearing recipe_body_ingredients, instructions, notes...');
  const clearClient = await pool.connect();
  try {
    await clearClient.query('BEGIN');
    await clearClient.query('DELETE FROM recipe_body_ingredients');
    await clearClient.query('DELETE FROM instructions');
    await clearClient.query('DELETE FROM notes');
    await clearClient.query('COMMIT');
    console.log('Cleared.');
  } catch (err) {
    await clearClient.query('ROLLBACK');
    console.error('Failed to clear tables:', err.message);
    process.exit(1);
  } finally {
    clearClient.release();
  }

  // Step 3: Build recipe notion_id -> uuid map
  const { rows: recipeRows } = await query('SELECT id, notion_id FROM recipes');
  const recipeMap = new Map();
  for (const row of recipeRows) {
    recipeMap.set(row.notion_id.trim(), row.id);
  }
  console.log(`Loaded ${recipeMap.size} recipes.`);

  let insertedBodyIngredients = 0;
  let insertedInstructions = 0;
  let insertedNotes = 0;
  const failedIngredients = [];
  const failedInstructions = [];
  const failedNotes = [];

  // Step 4: Import recipe_body_ingredients
  console.log('\nImporting ingredients...');
  for (const row of ingredientRows) {
    const notionId = (row.notion_id || '').trim();
    if (!notionId) { failedIngredients.push({ row, error: 'Missing notion_id' }); continue; }

    const recipeId = recipeMap.get(notionId);
    if (!recipeId) { failedIngredients.push({ row, error: `Recipe not found: ${notionId}` }); continue; }

    const ingredientName = (row.name || '').toLowerCase().trim();
    if (!ingredientName) { failedIngredients.push({ row, error: 'Empty name' }); continue; }

    const ingredientId = ingredientMap.get(ingredientName);
    if (!ingredientId) { failedIngredients.push({ row, error: `Not in ingredients table: "${ingredientName}"` }); continue; }

    try {
      await query(`
        INSERT INTO recipe_body_ingredients
          (recipe_id, ingredient_id, amount, unit, prep_note, optional, group_label, order_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        recipeId,
        ingredientId,
        row.amount || null,
        row.unit || null,
        row.prep_note || null,
        toBool(row.optional),
        row.group_label || null,
        toInt(row.order_index, 0),
      ]);
      insertedBodyIngredients++;
    } catch (err) {
      failedIngredients.push({ row, error: err.message });
    }
  }
  console.log(`Ingredients: ${insertedBodyIngredients} inserted, ${failedIngredients.length} failed.`);

  // Step 5: Import instructions
  console.log('\nImporting instructions...');
  for (const row of instructionRows) {
    const notionId = (row.notion_id || '').trim();
    if (!notionId) { failedInstructions.push({ row, error: 'Missing notion_id' }); continue; }

    const recipeId = recipeMap.get(notionId);
    if (!recipeId) { failedInstructions.push({ row, error: `Recipe not found: ${notionId}` }); continue; }

    try {
      await query(`
        INSERT INTO instructions (recipe_id, step_number, body_text)
        VALUES ($1,$2,$3)
      `, [recipeId, toInt(row.step_number, 1), row.body_text || null]);
      insertedInstructions++;
    } catch (err) {
      failedInstructions.push({ row, error: err.message });
    }
  }
  console.log(`Instructions: ${insertedInstructions} inserted, ${failedInstructions.length} failed.`);

  // Step 6: Import notes
  console.log('\nImporting notes...');
  for (const row of noteRows) {
    const notionId = (row.notion_id || '').trim();
    if (!notionId) { failedNotes.push({ row, error: 'Missing notion_id' }); continue; }

    const recipeId = recipeMap.get(notionId);
    if (!recipeId) { failedNotes.push({ row, error: `Recipe not found: ${notionId}` }); continue; }

    try {
      await query(`
        INSERT INTO notes (recipe_id, order_index, body_text)
        VALUES ($1,$2,$3)
      `, [recipeId, toInt(row.order_index, 0), row.body_text || null]);
      insertedNotes++;
    } catch (err) {
      failedNotes.push({ row, error: err.message });
    }
  }
  console.log(`Notes: ${insertedNotes} inserted, ${failedNotes.length} failed.`);

  await pool.end();

  // Summary
  console.log('\n=== Import Summary ===');
  console.log(`recipe_body_ingredients inserted : ${insertedBodyIngredients}`);
  console.log(`instructions inserted            : ${insertedInstructions}`);
  console.log(`notes inserted                   : ${insertedNotes}`);

  if (failedIngredients.length) {
    console.log(`\nFailed ingredients (${failedIngredients.length}, first 10):`);
    failedIngredients.slice(0, 10).forEach(f =>
      console.log(`  [${f.row.recipe_name}] "${f.row.name}" -- ${f.error}`)
    );
  }
  if (failedInstructions.length) {
    console.log(`\nFailed instructions (${failedInstructions.length}, first 10):`);
    failedInstructions.slice(0, 10).forEach(f =>
      console.log(`  [${f.row.notion_id}] step ${f.row.step_number} -- ${f.error}`)
    );
  }
  if (failedNotes.length) {
    console.log(`\nFailed notes (${failedNotes.length}, first 10):`);
    failedNotes.slice(0, 10).forEach(f =>
      console.log(`  [${f.row.notion_id}] -- ${f.error}`)
    );
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
