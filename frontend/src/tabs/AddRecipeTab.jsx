import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Icon } from '../icons';
import { API, TAG_FILTERS, ALL_CUISINES } from '../constants';
import { haptic } from '../utils';
import { AutoGrowTextarea, DRAG_SENSORS } from '../components/ui';
import { IngFlatRow, IngGroupRow, StepSortableItem, CookbookAutocomplete } from '../components/IngredientEditor';
import { autoCategory } from '../KitchenTab';

// ─── Local recipe text parser ─────────────────────────────────────────────────

const UNITS = new Set([
  'cup','cups','c','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons',
  'oz','ounce','ounces','lb','lbs','pound','pounds','g','gram','grams','kg','kilogram','kilograms',
  'ml','milliliter','milliliters','l','liter','liters','qt','quart','quarts',
  'pt','pint','pints','gal','gallon','gallons',
  'clove','cloves','head','heads','stalk','stalks','bunch','bunches',
  'can','cans','package','packages','pkg','slice','slices','piece','pieces',
  'handful','pinch','dash','splash','sprig','sprigs','fillet','fillets',
  'strip','strips','sheet','sheets','jar','jars','bag','bags','stick','sticks',
  'knob','block','rasher','rashers',
]);

const INSTR_HEADER = /^(instructions?|directions?|method|steps?|how to (make|prepare|cook)|preparation|procedure)\s*:?\s*$/i;
const ING_HEADER   = /^(ingredients?)\s*:?\s*$/i;
const META_LINE    = /^(prep|cook|total|ready|servings?|serves?|yield|calories?|time|makes?|active)\b/i;
// Amount: integer, decimal, fraction (1/2), or unicode vulgar fractions
const AMT_RE       = /^([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s*[\/⁄]\s*\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?(?:\s*[\/⁄]\s*\d+)?)?)\s*/;

// Words that can precede an ingredient name as preparation descriptors
const PREP_WORDS = new Set([
  'chopped','diced','minced','sliced','grated','shredded','crushed','crumbled',
  'roasted','toasted','frozen','dried','cooked','boiled','fried','sautéed','sauteed',
  'melted','softened','beaten','peeled','pitted','seeded','stemmed','cored',
  'halved','quartered','mashed','pressed','torn','rinsed','drained',
  'roughly','finely','coarsely','thinly','thickly','lightly','freshly',
  'ripe','overripe','raw','warm','room-temperature','large','small','medium',
]);

function parseIngLine(raw) {
  let line = raw.replace(/^[-•·*–]\s*/, '').trim();
  let amount = '', unit = '', prepNote = '';

  const amtM = line.match(AMT_RE);
  if (amtM) { amount = amtM[1].trim(); line = line.slice(amtM[0].length).trim(); }

  // Unit word (only if amount was found)
  if (amount) {
    const firstWord = line.split(/\s+/)[0] || '';
    const norm = firstWord.toLowerCase().replace(/\.$/, '');
    if (UNITS.has(norm)) { unit = firstWord; line = line.slice(firstWord.length).trim(); }
  }

  // Strip leading prep adjectives (e.g. "chopped pecans" → name=pecans, prep=chopped)
  // Only strip if at least one word remains as the ingredient name
  const leadingPrep = [];
  let words = line.split(/\s+/);
  while (words.length > 1 && PREP_WORDS.has(words[0].toLowerCase().replace(/,\.?$/, ''))) {
    leadingPrep.push(words.shift().replace(/,\.?$/, ''));
  }
  if (leadingPrep.length > 0) line = words.join(' ');

  // Prep note: after comma or inside parens (trailing)
  const commaIdx = line.indexOf(',');
  const parenIdx = line.indexOf('(');
  let splitAt = -1;
  if (commaIdx > 0 && parenIdx > 0) splitAt = Math.min(commaIdx, parenIdx);
  else if (commaIdx > 0) splitAt = commaIdx;
  else if (parenIdx > 0) splitAt = parenIdx;

  if (splitAt > 0) {
    const trailing = line.slice(splitAt).replace(/[(),]/g, '').trim();
    prepNote = trailing;
    line     = line.slice(0, splitAt).trim();
  }

  // Combine leading + trailing prep notes
  const combined = [leadingPrep.join(' '), prepNote].filter(Boolean).join(', ');

  const name = line.toLowerCase().trim();
  if (!name) return null;
  return { name, amount, unit: unit.replace(/s\.?$/, ''), prep_note: combined, optional: /optional/i.test(raw) };
}

function parseRecipeText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Find where instructions begin
  let instrAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (INSTR_HEADER.test(lines[i]))                          { instrAt = i; break; }
    if (/^1[\.\)]\s+\S/.test(lines[i]) && i > 0)             { instrAt = i; break; }
  }

  let ingSection  = instrAt >= 0 ? lines.slice(0, instrAt)  : lines;
  let stepSection = instrAt >= 0 ? lines.slice(instrAt)      : [];

  // Heuristic split when no header: last ingredient-looking line → steps after
  if (instrAt < 0) {
    let lastIngAt = -1;
    for (let i = 0; i < ingSection.length; i++) {
      if (AMT_RE.test(ingSection[i].replace(/^[-•·*–]\s*/, ''))) lastIngAt = i;
    }
    if (lastIngAt >= 0 && lastIngAt < ingSection.length - 1) {
      stepSection = ingSection.slice(lastIngAt + 1);
      ingSection  = ingSection.slice(0, lastIngAt + 1);
    }
  }

  // Metadata + name from ingSection
  let name = '', servings = null, timeMinutes = null;
  const ingLines = [];
  let pastIngHeader = false;

  for (const line of ingSection) {
    if (ING_HEADER.test(line))  { pastIngHeader = true; continue; }
    if (INSTR_HEADER.test(line)) break;

    const srvM = line.match(/(?:serves?|servings?|makes?|yield)\s*:?\s*(\d+)/i);
    if (srvM) { servings = parseInt(srvM[1]); continue; }

    const timeM = line.match(/(\d+)\s*(?:–\s*\d+\s*)?(?:min(?:ute)?s?)/i);
    if (timeM && META_LINE.test(line)) { timeMinutes = parseInt(timeM[1]); continue; }

    if (META_LINE.test(line)) continue;

    const stripped = line.replace(/^[-•·*–]\s*/, '');
    if (AMT_RE.test(stripped) || pastIngHeader) {
      ingLines.push(line);
    } else if (!name) {
      name = line;  // first non-meta, non-amount line = title
    }
  }

  const ingredients = ingLines.map(parseIngLine).filter(Boolean);

  // Steps
  const steps = [];
  let stepNum = 1, buf = '';
  for (const line of stepSection) {
    if (INSTR_HEADER.test(line)) continue;
    const numM = line.match(/^(\d+)[\.\)]\s+([\s\S]+)/);
    if (numM) {
      if (buf) { steps.push({ step_number: stepNum++, body_text: buf.trim() }); buf = ''; }
      buf = numM[2];
    } else {
      buf = buf ? buf + ' ' + line : line;
    }
  }
  if (buf.trim()) steps.push({ step_number: stepNum, body_text: buf.trim() });

  return { name, servings, time_minutes: timeMinutes, ingredients, steps, notes: [] };
}

// Fuzzy-match a parsed ingredient name against the catalog.
// Returns { match: string, score: number } or null.
function fuzzyMatch(parsedName, catalogArr) {
  const lower = parsedName.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(w => w.length > 2); // skip short filler words
  let best = null, bestScore = 0;

  for (const catName of catalogArr) {
    const cat = catName.toLowerCase();
    let score = 0;
    if (cat === lower)            score = 100;
    else if (lower.includes(cat)) score = 85;
    else if (cat.includes(lower)) score = 80;
    else {
      const catWords = cat.split(/\s+/);
      const hits = words.filter(w => catWords.some(cw => cw.includes(w) || w.includes(cw)));
      score = words.length ? (hits.length / Math.max(words.length, catWords.length)) * 65 : 0;
    }
    if (score > bestScore) { bestScore = score; best = catName; }
  }
  return bestScore >= 40 ? { match: best, score: bestScore } : null;
}

// ─── Ingredient Resolver ──────────────────────────────────────────────────────
// unknowns: full parsed ingredient objects { name, amount, unit, prep_note, ... }
// onResolve receives: { [originalLowerName]: { action, mappedTo, name, amount, unit, prep_note } }

function IngredientResolver({ unknowns, allIngredients, onResolve, onCancel }) {
  const [resolutions, setResolutions] = useState(() =>
    Object.fromEntries(unknowns.map(ing => [
      ing.name.toLowerCase(),
      { action: 'new', mappedTo: ing.name, name: ing.name, amount: ing.amount || '', unit: ing.unit || '', prep_note: ing.prep_note || '' },
    ]))
  );
  const [searches, setSearches] = useState(() =>
    Object.fromEntries(unknowns.map(ing => [ing.name.toLowerCase(), '']))
  );

  const setRes = (key, update) =>
    setResolutions(prev => ({ ...prev, [key]: { ...prev[key], ...update } }));

  const getSuggestions = (key, searchText) => {
    const q = (searchText || key).toLowerCase().trim();
    if (!q) return [];
    return allIngredients
      .map(ing => {
        const n = (typeof ing === 'string' ? ing : ing?.name) ?? '';
        const lower = n.toLowerCase();
        if (!lower.includes(q) && !q.includes(lower.slice(0, 3))) return null;
        return { name: n, score: lower.startsWith(q) ? 0 : 1 };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map(x => x.name);
  };

  return (
    <div className="ing-resolver">
      <div className="ing-resolver__hd">
        <h3 className="ing-resolver__title">Review Unrecognized Ingredients</h3>
        <p className="ing-resolver__sub">These weren't found in your kitchen catalog. Fix details, map to an existing ingredient, or add as new.</p>
      </div>
      <div className="ing-resolver__list">
        {unknowns.map(ing => {
          const key = ing.name.toLowerCase();
          const res = resolutions[key];
          const search = searches[key];
          const suggestions = getSuggestions(key, search);
          return (
            <div key={key} className="ing-resolver__row">
              <div className="ing-resolver__original">
                <span className="ing-resolver__original-label">Parsed as</span>
                <span className="ing-resolver__original-name">"{ing.name}"</span>
              </div>

              {/* Editable parsed details */}
              <div className="ing-resolver__edit-row">
                <input className="editor-input ing-resolver__edit-amt" placeholder="Amt"
                  value={res.amount} onChange={e => setRes(key, { amount: e.target.value })} />
                <input className="editor-input ing-resolver__edit-unit" placeholder="Unit"
                  value={res.unit} onChange={e => setRes(key, { unit: e.target.value })} />
                <input className="editor-input ing-resolver__edit-prep" placeholder="Prep note"
                  value={res.prep_note} onChange={e => setRes(key, { prep_note: e.target.value })} />
              </div>

              <div className="ing-resolver__actions">
                <button
                  className={`ing-resolver__tab${res.action === 'new' ? ' ing-resolver__tab--active' : ''}`}
                  onClick={() => setRes(key, { action: 'new', mappedTo: res.name })}
                >Add as new</button>
                <button
                  className={`ing-resolver__tab${res.action === 'map' ? ' ing-resolver__tab--active' : ''}`}
                  onClick={() => setRes(key, { action: 'map', mappedTo: '' })}
                >Map to existing</button>
              </div>

              {res.action === 'new' && (
                <div className="ing-resolver__new-wrap">
                  <span className="ing-resolver__new-hint">Catalog name:</span>
                  <input className="editor-input ing-resolver__edit-name" placeholder="Ingredient name"
                    value={res.name} onChange={e => setRes(key, { name: e.target.value })} />
                </div>
              )}

              {res.action === 'map' && (
                <div className="ing-resolver__map-wrap">
                  <input
                    className="editor-input ing-resolver__search"
                    placeholder="Search existing ingredients…"
                    value={search}
                    onChange={e => setSearches(prev => ({ ...prev, [key]: e.target.value }))}
                    autoFocus
                  />
                  {suggestions.length > 0 && (
                    <ul className="ing-ac-dropdown ing-resolver__dropdown">
                      {suggestions.map(s => (
                        <li key={s}
                          className={`ing-ac-option${res.mappedTo === s ? ' ing-ac-option--active' : ''}`}
                          onMouseDown={() => { setRes(key, { action: 'map', mappedTo: s }); setSearches(prev => ({ ...prev, [key]: s })); }}
                        >{s}</li>
                      ))}
                    </ul>
                  )}
                  {res.mappedTo && (
                    <p className="ing-resolver__selected">Will use: <strong>{res.mappedTo}</strong></p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="ing-resolver__footer">
        <button className="btn btn--primary" onClick={() => onResolve(resolutions)}>
          Continue to recipe →
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

const AddRecipeTab = ({ allIngredients, inventoryConfig, addIngredient, onSaved, cookbooks = [], authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();
  const [showModal, setShowModal] = useState(false);

  const emptyForm = () => ({
    name: '', cuisine: '', time: '', servings: '', calories: '',
    cover_image_url: '', cookbook: '', reference: '', status: '', tags: [],
  });

  const [details, setDetails] = useState(emptyForm);
  const [ings, setIngs] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgPreviewError, setImgPreviewError] = useState(false);

  const [importUrl, setImportUrl]       = useState('');
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState(null);
  const [importedFrom, setImportedFrom] = useState(null);

  // Text import
  const [pasteText, setPasteText]         = useState('');
  const [parsing, setParsing]             = useState(false);
  const [parseError, setParseError]       = useState(null);
  const [parsedData, setParsedData]       = useState(null);   // raw parsed recipe from API
  const [unknownIngs, setUnknownIngs]     = useState([]);     // names not in allIngredients
  const [showResolver, setShowResolver]   = useState(false);

  // Lowercase set for membership checks; original-case array for fuzzy matching
  const catalogNames = useMemo(
    () => new Set((inventoryConfig || []).flatMap(g => g.items.map(n => n.toLowerCase()))),
    [inventoryConfig]
  );
  const catalogArr = useMemo(
    () => (inventoryConfig || []).flatMap(g => g.items),
    [inventoryConfig]
  );

  const parseFromText = () => {
    if (!pasteText.trim()) return;
    setParsing(true); setParseError(null);
    try {
      const recipe = parseRecipeText(pasteText.trim());

      // Fuzzy-match each ingredient name against catalog
      const resolved = recipe.ingredients.map(ing => {
        const m = fuzzyMatch(ing.name, catalogArr);
        if (m && m.score >= 80) return { ...ing, name: m.match };  // auto-apply high-confidence
        return ing;  // low/medium — goes to resolver
      });
      recipe.ingredients = resolved;

      // Collect unknowns (full objects, deduplicated by name)
      const seen = new Set();
      const unknownObjs = resolved.filter(i => {
        const n = i.name?.toLowerCase().trim();
        if (!n || catalogNames.has(n) || seen.has(n)) return false;
        seen.add(n);
        return true;
      });

      setParsedData(recipe);
      if (unknownObjs.length > 0) {
        setUnknownIngs(unknownObjs);
        setShowResolver(true);
      } else {
        setImportedFrom('text');
        openModalWithData(recipe);
        setPasteText('');
      }
    } catch (e) { setParseError(e.message); }
    finally { setParsing(false); }
  };

  const applyResolutions = async (resolutions) => {
    if (!parsedData) return;
    // Add "new" ingredients to the catalog using the (possibly edited) name
    const newIngs = Object.entries(resolutions)
      .filter(([, r]) => r.action === 'new')
      .map(([, r]) => r.name || r.mappedTo)
      .filter(Boolean);
    if (newIngs.length > 0 && addIngredient) {
      await Promise.all(newIngs.map(name => addIngredient(name, autoCategory(name))));
    }
    // Apply resolutions: use edited amount/unit/prep_note + resolved name
    const resolved = {
      ...parsedData,
      ingredients: (parsedData.ingredients || []).map(ing => {
        const original = ing.name?.toLowerCase().trim();
        const res = resolutions[original];
        if (!res) return ing;
        const finalName = res.action === 'map' ? res.mappedTo : (res.name || original);
        return {
          ...ing,
          name:      finalName,
          amount:    res.amount    !== undefined ? res.amount    : ing.amount,
          unit:      res.unit      !== undefined ? res.unit      : ing.unit,
          prep_note: res.prep_note !== undefined ? res.prep_note : ing.prep_note,
        };
      }),
    };
    setShowResolver(false);
    setUnknownIngs([]);
    setParsedData(null);
    setImportedFrom('text');
    openModalWithData(resolved);
    setPasteText('');
  };

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const toggleTag = (tag) => setDetails(prev => ({
    ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  const addIng  = () => setIngs(prev => [...prev, { _id: `ing-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); });
    }
  };

  const addStep    = () => setSteps(prev => [...prev, { _id: `step-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null }]);
  const addTimerAfterStep = (afterId) => setSteps(prev => { const idx = prev.findIndex(s => s._id === afterId); const t = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' }; const n = [...prev]; n.splice(idx+1, 0, t); return n; });
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); }); };
  const addNote    = () => setNotesList(prev => [...prev, { _id: `note-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const openModal = () => {
    setDetails(emptyForm());
    setIngs([{ _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
    setSteps([{ _id: `step-${Date.now()}`, step_number: 1, body_text: '' }]);
    setNotesList([]);
    setSaveError(null);
    setImgPreviewError(false);
    setImportedFrom(null);
    setShowModal(true);
  };

  const openModalWithData = (data) => {
    setDetails({
      ...emptyForm(),
      name:            data.name            || '',
      cuisine:         data.cuisine         || '',
      time:            data.time_minutes    ? String(data.time_minutes) : '',
      servings:        data.servings        ? String(data.servings)     : '',
      cover_image_url: data.cover_image_url || '',
      tags:            Array.isArray(data.tags) ? data.tags : [],
      source_url:      data.source_url      || '',
    });
    setIngs(
      data.ingredients?.length
        ? data.ingredients.map((ing, i) => ({ _id: `imp-ing-${i}`, ...ing }))
        : [{ _id: 'imp-ing-empty', name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]
    );
    setSteps(
      data.steps?.length
        ? data.steps
        : [{ _id: 'imp-step-empty', step_number: 1, body_text: '' }]
    );
    setNotesList(data.notes || []);
    setSaveError(null);
    setImgPreviewError(false);
    setShowModal(true);
  };

  const importFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiFetch(`${API}/api/recipes/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      try { setImportedFrom(new URL(importUrl.trim()).hostname.replace(/^www\./, '')); } catch {}
      setImportUrl('');
      openModalWithData(data.recipe);
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const closeModal = () => setShowModal(false);

  const save = async () => {
    if (!details.name.trim()) { setSaveError('Recipe name is required.'); return; }
    setSaving(true); setSaveError(null);

    try {
      // Flatten grouped ingredients
      let grp = '';
      const flatIngs = ings.map(i => {
        if (i._isGroup) { grp = i.name || ''; return null; }
        return { ...i, group_label: grp };
      }).filter(Boolean);

      const payload = {
        details: {
          name: details.name, cuisine: details.cuisine, time: details.time,
          servings: details.servings, calories: details.calories,
          cover_image_url: details.cover_image_url,
          cookbook: details.cookbook, page_number: details.reference,
          status: details.status, recipe_incomplete: details.recipe_incomplete, tags: details.tags,
          source_url: details.source_url || undefined,
        },
        ingredients: flatIngs.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: (() => {
          const result = []; let stepNum = 1;
          for (const item of steps) {
            if (item._isTimer) {
              const secs = (parseInt(item.h)||0)*3600 + (parseInt(item.m)||0)*60 + (parseInt(item.s)||0);
              if (result.length > 0) result[result.length-1].timer_seconds = secs > 0 ? secs : null;
            } else {
              const bodyText = item._tip?.trim()
                ? item.body_text + '\n\u26D4TIP\u26D4' + item._tip.trim()
                : item.body_text;
              result.push({ ...item, body_text: bodyText, step_number: stepNum++, timer_seconds: item.timer_seconds ?? null });
            }
          }
          return result;
        })(),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      const res = await apiFetch(`${API}/api/recipes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      closeModal();
      if (onSaved) onSaved(data.recipe);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const groupLabels = [...new Set(ings.map(i => i.group_label).filter(Boolean))];

  return (
    <main className="view add-tab">
      <div className="add-tab__header">
        <h2 className="add-tab__title">Add a Recipe</h2>
        <p className="add-tab__sub">Grow your collection</p>
      </div>

      {/* Ingredient resolver overlay */}
      {showResolver && (
        <div className="create-modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="create-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <IngredientResolver
              unknowns={unknownIngs}
              allIngredients={allIngredients}
              onResolve={applyResolutions}
              onCancel={() => { setShowResolver(false); setUnknownIngs([]); setParsedData(null); }}
            />
          </div>
        </div>
      )}

      <div className="add-tab__cards">
        <button className="add-tab__card" onClick={openModal}>
          <span className="add-tab__card-icon"><Icon name="note" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Add Manually</h3>
          <p className="add-tab__card-desc">Type in the name, ingredients, steps, and notes yourself</p>
          <span className="add-tab__card-cta">Get started →</span>
        </button>

        <div className="add-tab__card add-tab__card--import">
          <span className="add-tab__card-icon"><Icon name="link" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Import from URL</h3>
          <p className="add-tab__card-desc">Paste a link from AllRecipes, NYT Cooking, Serious Eats, and more</p>
          <div className="add-tab__import-row" onClick={e => e.stopPropagation()}>
            <input
              className="editor-input add-tab__import-input"
              value={importUrl}
              onChange={e => { setImportUrl(e.target.value); setImportError(null); }}
              onKeyDown={e => e.key === 'Enter' && !importing && importFromUrl()}
              placeholder="https://..."
              disabled={importing}
            />
            <button
              className="btn btn--primary btn--sm add-tab__import-btn"
              onClick={importFromUrl}
              disabled={importing || !importUrl.trim()}
            >
              {importing ? <><span className="add-tab__import-spinner" /> Importing…</> : 'Import'}
            </button>
          </div>
          {importError && <p className="add-tab__import-error">{importError}</p>}
        </div>

        {/* Text paste import */}
        <div className="add-tab__card add-tab__card--import add-tab__card--text">
          <span className="add-tab__card-icon"><Icon name="fileText" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Paste Recipe Text</h3>
          <p className="add-tab__card-desc">Paste any recipe text — from a blog, cookbook scan, message, anywhere</p>
          <div className="add-tab__paste-wrap" onClick={e => e.stopPropagation()}>
            <textarea
              className="add-tab__paste-area"
              placeholder="Paste the full recipe here — ingredients, steps, everything…"
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setParseError(null); }}
              rows={5}
              disabled={parsing}
            />
            <button
              className="btn btn--primary btn--sm add-tab__import-btn"
              onClick={parseFromText}
              disabled={parsing || !pasteText.trim()}
            >
              {parsing ? <><span className="add-tab__import-spinner" /> Parsing…</> : 'Parse recipe'}
            </button>
          </div>
          {parseError && <p className="add-tab__import-error">{parseError}</p>}
        </div>
      </div>

      {/* -- Create Recipe Modal -- */}
      {showModal && (
        <div className="create-modal-overlay" onClick={() => {
          if (details.name || ings.some(i => i.name) || steps.some(s => s.body_text)) {
            if (!window.confirm('Discard this recipe?')) return;
          }
          closeModal();
        }}>
          <div className="create-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="create-modal__header">
              <h2 className="create-modal__title">
                <Icon name={importedFrom === 'text' ? 'fileText' : importedFrom ? 'link' : 'note'} size={18} strokeWidth={2} />
                {importedFrom === 'text' ? 'Parsed from text' : importedFrom ? `Imported from ${importedFrom}` : 'New Recipe'}
              </h2>
              <button className="ing-modal__close" onClick={() => {
                if (details.name || ings.some(i => i.name) || steps.some(s => s.body_text)) {
                  if (!window.confirm('Discard this recipe?')) return;
                }
                closeModal();
              }}>✕</button>
            </div>
            {importedFrom && (
              <div className="create-modal__import-banner">
                <Icon name="info" size={13} strokeWidth={2} />
                {importedFrom === 'text'
                  ? 'Parsed by AI — review ingredients and steps carefully before saving.'
                  : 'Ingredients are pre-filled as written — review and split out amounts before saving.'}
              </div>
            )}

            <div className="create-modal__body">

              {/* Image row */}
              <div className="create-modal__img-row">
                <div className="create-modal__img-preview">
                  {details.cover_image_url && !imgPreviewError
                    ? <img src={details.cover_image_url} alt="preview" onError={() => setImgPreviewError(true)} />
                    : <span className="create-modal__img-placeholder"><Icon name="image" size={28} color="var(--ash)" strokeWidth={1.5} /></span>}
                </div>
                <div className="create-modal__img-input-wrap">
                  <label className="create-modal__field-label">Cover image URL</label>
                  <input className="editor-input" value={details.cover_image_url}
                    onChange={e => { setDetail('cover_image_url', e.target.value); setImgPreviewError(false); }}
                    placeholder="https://example.com/photo.jpg" />
                  <p className="create-modal__field-hint">Paste any image URL -- see it previewed instantly</p>
                </div>
              </div>

              {/* Name */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
                <input className="editor-input create-modal__name-input" value={details.name}
                  onChange={e => setDetail('name', e.target.value)} placeholder="e.g. Grandma's Lasagne" autoFocus />
              </div>

              {/* Time + Servings + Calories */}
              <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label>
                  <input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
                </div>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label>
                  <input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
                </div>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="flame" size={13} strokeWidth={2} /> Calories</label>
                  <input className="editor-input" value={details.calories} onChange={e => setDetail('calories', e.target.value)} placeholder="450" />
                </div>
              </div>

              {/* Cuisine chips */}
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
                <div className="picker__chips" style={{ marginTop: 6 }}>
                  {ALL_CUISINES.map(c => (
                    <button key={c} className={`chip ${details.cuisine === c ? 'chip--selected' : ''}`}
                      onClick={() => setDetail('cuisine', details.cuisine === c ? '' : c)} type="button">
                      {details.cuisine === c && <span className="chip__check">✓</span>}{c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="tag" size={13} strokeWidth={2} /> Tags</label>
                <div className="picker__chips" style={{ marginTop: 6 }}>
                  {TAG_FILTERS.map(({ key, label }) => (
                    <button key={key} className={`chip ${details.tags.includes(key) ? 'chip--selected' : ''}`} onClick={() => toggleTag(key)} type="button">
                      {details.tags.includes(key) && <span className="chip__check">✓</span>}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="list" size={13} strokeWidth={2} /> Progress</label>
                <div className="picker__chips" style={{ marginTop: 6 }}>
                  {[
                    { key: '', label: '-- None' },
                    { key: 'to try', label: 'To Try' },
                    { key: 'made it', label: 'Made It' },
                    { key: 'needs tweaking', label: 'Needs Tweaking' },
                    { key: 'archived', label: 'Archived' },
                  ].map(({ key, label }) => (
                    <button key={key}
                      className={`chip ${details.status === key ? 'chip--selected' : ''}`}
                      onClick={() => setDetail('status', key)} type="button">
                      {details.status === key && <span className="chip__check">✓</span>}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nutrition note */}
              <p className="create-modal__field-hint" style={{ marginTop: -4 }}>
                Calories, protein &amp; fiber will be auto-calculated from your ingredients
              </p>

              {/* Ingredients -- group-style like edit modal */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Ingredients</label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onIngDragEnd}>
                  <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
                    <div className="ing-flat-list">
                      <div className="ing-flat-header ing-flat-header--desktop">
                        <span className="ing-flat-header__drag" />
                        <div className="ing-flat-header__cols">
                          <span className="ing-flat-header__qty-col">Qty</span>
                          <span className="ing-flat-header__unit-col">Unit</span>
                          <span className="ing-flat-header__name-col">Ingredient</span>
                          <span className="ing-flat-header__prep-col">Prep note</span>
                          <span className="ing-flat-header__opt-col">Optional</span>
                        </div>
                        <span className="ing-flat-header__rm" />
                      </div>
                      {ings.map((ing) => {
                        if (ing._isGroup) {
                          return (
                            <IngGroupRow key={ing._id} ing={ing}
                              onLabelChange={v => setIngs(prev => prev.map(i => i._id === ing._id ? { ...i, name: v } : i))}
                              onRemove={() => setIngs(prev => prev.filter(i => i._id !== ing._id))}
                              onAddIngredient={() => setIngs(prev => {
                                const groupName = ing.name;
                                let insertIdx = prev.findIndex(i => i._id === ing._id);
                                for (let j = insertIdx + 1; j < prev.length; j++) {
                                  if (prev[j]._isGroup) break;
                                  insertIdx = j;
                                }
                                const newIng = { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: groupName };
                                const next = [...prev]; next.splice(insertIdx + 1, 0, newIng); return next;
                              })}
                            />
                          );
                        }
                        return (
                          <IngFlatRow key={ing._id} ing={ing}
                            onUpdate={(k, v) => updateIng(ing._id, k, v)}
                            onRemove={() => removeIng(ing._id)}
                            allIngredients={allIngredients}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="ing-flat-add-row">
                  <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }])}>+ Add Ingredient</button>
                  <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setIngs(prev => [...prev, { _id: `grp-${Date.now()}`, _isGroup: true, name: 'New Group' }])}>+ Add Group</button>
                </div>
              </div>

              {/* Instructions */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Instructions</label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onStepDragEnd}>
                  <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                    {steps.map((item, idx) => {
                      if (item._isTimer) return (
                        <div key={item._id} className="rp2__ed-timer-row">
                          <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                          <div className="rp2__ed-timer-row__inputs">
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, h: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">h</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, m: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">m</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, s: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">s</span>
                          </div>
                          <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                        </div>
                      );
                      const stepNum = steps.slice(0, idx).filter(s => !s._isTimer).length + 1;
                      return (
                        <StepSortableItem key={item._id} id={item._id} stepNum={stepNum}>
                          <AutoGrowTextarea className="editor-textarea" value={item.body_text} onChange={e => updateStep(item._id, e.target.value)} placeholder="Describe this step..." minRows={2} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                            <button className="rp2__ed-add-timer-btn" onClick={() => addTimerAfterStep(item._id)} title="Add timer"><Icon name="timer" size={13} strokeWidth={2} /></button>
                            <button className="rp2__ed-add-timer-btn" onClick={e => { e.stopPropagation(); setSteps(prev => prev.map(s => s._id === item._id ? { ...s, _showTip: !s._showTip, _tipAnchor: e.currentTarget.getBoundingClientRect() } : s)); }} title="Add tip" style={{ color: item._tip ? 'var(--terracotta)' : undefined, opacity: item._tip ? 1 : undefined }}><Icon name="lightbulb" size={13} strokeWidth={2} /></button>
                          </div>
                          <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                          {item._showTip && createPortal((() => {
                            const ar = item._tipAnchor; const pw = 300, ph = 160;
                            const vw = window.innerWidth, vh = window.innerHeight;
                            let top = ar ? ar.bottom + 6 : vh/2-ph/2; let left = ar ? ar.left-pw+ar.width : vw/2-pw/2;
                            if (top+ph > vh-8) top = ar ? ar.top-ph-6 : 8; if (left < 8) left = 8; if (left+pw > vw-8) left = vw-pw-8;
                            return (<><div style={{ position:'fixed',inset:0,zIndex:8998 }} onClick={() => setSteps(prev => prev.map(s => s._id===item._id ? {...s,_showTip:false} : s))} /><div className="anchored-popover" style={{ position:'fixed',top,left,width:pw,zIndex:8999,padding:'12px 14px',display:'flex',flexDirection:'column',gap:8 }} onClick={e=>e.stopPropagation()}><label style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--warm-gray)' }}>Tip for this step</label><textarea className="editor-textarea" autoFocus rows={3} style={{ fontSize:13,resize:'none' }} value={item._tip||''} onChange={e=>setSteps(prev=>prev.map(s=>s._id===item._id?{...s,_tip:e.target.value}:s))} placeholder="e.g. don't overcrowd the pan..." /><div style={{ display:'flex',gap:6,justifyContent:'flex-end' }}>{item._tip && <button className="btn btn--ghost btn--sm" style={{ fontSize:11,padding:'3px 8px' }} onClick={()=>setSteps(prev=>prev.map(s=>s._id===item._id?{...s,_tip:'',_showTip:false}:s))}>Clear</button>}<button className="btn btn--primary btn--sm" style={{ fontSize:11,padding:'3px 10px' }} onClick={()=>setSteps(prev=>prev.map(s=>s._id===item._id?{...s,_showTip:false}:s))}>Done</button></div></div></>);
                          })(), document.body)}
                        </StepSortableItem>
                      );
                    })}
                  </SortableContext>
                </DndContext>
                <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
              </div>

              {/* Notes */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Notes &amp; Modifications</label>
                {notesList.map(note => (
                  <div key={note._id} className="editor-note-row">
                    <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                    <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
                  </div>
                ))}
                <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
              </div>

              {/* Cookbook reference */}
              <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="bookMarked" size={13} strokeWidth={2} /> Cookbook</label>
                  <CookbookAutocomplete value={details.cookbook} onChange={v => setDetail('cookbook', v)} cookbooks={cookbooks} />
                </div>
                <div className="create-modal__field">
                  <label className="create-modal__field-label">Page number</label>
                  <input className="editor-input" value={details.reference} onChange={e => setDetail('reference', e.target.value)} placeholder="e.g. 142" />
                </div>
              </div>

              {saveError && <p className="editor-error" style={{ marginTop: 8 }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
            </div>

            {/* Modal footer */}
            <div className="create-modal__footer">
              <button className="btn btn--ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Creating...' : '✓ Create Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

// --- Login Modal -------------------------------------------------------------
// ─── Login Modal ─────────────────────────────────────────────────────────────

export default AddRecipeTab;
