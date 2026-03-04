import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

// ─── localStorage helpers ──────────────────────────────────────────────────
const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const CUISINES = [
  'American', 'British', 'Caribbean', 'Chinese', 'French', 'Greek',
  'Indian', 'Italian', 'Japanese', 'Korean', 'Lebanese', 'Mediterranean',
  'Mexican', 'Middle Eastern', 'Moroccan', 'Persian', 'Spanish',
  'Thai', 'Turkish', 'Vietnamese',
];

const COMMON_UNITS = [
  'tsp', 'tbsp', 'cup', 'cups', 'ml', 'l', 'g', 'kg', 'oz', 'lb',
  'pinch', 'handful', 'bunch', 'clove', 'cloves', 'slice', 'slices',
  'piece', 'pieces', 'can', 'jar', 'bag', 'sprig', 'sprigs',
  'rasher', 'fillet', 'fillets', 'sheet', 'sheets',
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const pct = (score) => Math.round(score * 100);

const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

// ─── Recipe Summary Card ───────────────────────────────────────────────────
const RecipeCard = ({ recipe, match, onClick }) => {
  const { name, coverImage, cuisine, calories, protein } = recipe;
  const matchScore = match?.matchScore ?? null;
  const canMakeNow = Boolean(match?.canMake);

  return (
    <article className="recipe-card" onClick={() => onClick(recipe)}>
      <div className="recipe-card__image">
        {coverImage
          ? <img src={coverImage} alt={name} loading="lazy" />
          : <div className="recipe-card__image-placeholder">No photo</div>}
        {matchScore !== null && (
          <div className={`recipe-card__score ${canMakeNow ? 'recipe-card__score--ready' : ''}`}>
            {pct(matchScore)}%
          </div>
        )}
      </div>
      <div className="recipe-card__body">
        <div className="recipe-card__title-row">
          <h3 className="recipe-card__title">{name}</h3>
          {canMakeNow && <span className="recipe-card__can-make">Can make</span>}
        </div>
        <div className="recipe-card__meta">
          {cuisine && <Badge>{cuisine}</Badge>}
        </div>
        <div className="recipe-card__nutrition">
          {typeof calories === 'number' && <span className="recipe-card__pill">{Math.round(calories)} kcal</span>}
          {typeof protein === 'number' && <span className="recipe-card__pill">{Math.round(protein)}g protein</span>}
        </div>
      </div>
    </article>
  );
};

// ─── Recipe Page ────────────────────────────────────────────────────────────
const RecipePage = ({ recipe, bodyIngredients, instructions, notes, onBack, onEdit, loading }) => {

  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [doneSteps, setDoneSteps] = useState(new Set());

  // Must be before any early returns — Rules of Hooks
  const ingredientGroups = useMemo(() => {
    if (!bodyIngredients?.length) return [];
    const groups = [];
    const seen = new Map();
    for (const ing of bodyIngredients) {
      const label = ing.group_label || '';
      if (!seen.has(label)) { seen.set(label, []); groups.push({ label, items: seen.get(label) }); }
      seen.get(label).push(ing);
    }
    return groups;
  }, [bodyIngredients]);

  const toggleIngredient = (key) => setCheckedIngredients(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleStep = (num) => setDoneSteps(prev => {
    const next = new Set(prev);
    next.has(num) ? next.delete(num) : next.add(num);
    return next;
  });

  if (loading) return (
    <main className="view"><div className="placeholder"><h2>Loading recipe…</h2></div></main>
  );
  if (!recipe) return (
    <main className="view"><div className="placeholder"><h2>Recipe not found</h2><button className="btn btn--ghost" onClick={onBack}>← Back</button></div></main>
  );

  return (
    <main className="view recipe-page">
      <div className="recipe-page__topbar">
        <button className="btn btn--ghost" onClick={onBack}>← Back</button>
        <button className="btn btn--ghost" onClick={onEdit}>✏️ Edit</button>
      </div>

      {/* Hero: photo left, details right */}
      <div className="recipe-page__hero">
        <div className="recipe-page__image">
          {recipe.coverImage
            ? <img src={recipe.coverImage} alt={recipe.name} />
            : <div className="recipe-page__image-placeholder">No photo</div>}
        </div>
        <div className="recipe-page__summary">
          <h2 className="recipe-page__title">{recipe.name}</h2>
          <div className="recipe-page__meta">
            {recipe.cuisine && <Badge>{recipe.cuisine}</Badge>}
            {typeof recipe.calories === 'number' && <Badge variant="info">{Math.round(recipe.calories)} kcal</Badge>}
            {typeof recipe.protein === 'number' && <Badge variant="info">{Math.round(recipe.protein)}g protein</Badge>}
            {recipe.time && <Badge variant="time">⏱ {recipe.time}</Badge>}
            {recipe.servings && <Badge variant="info">🍽 {recipe.servings}</Badge>}
          </div>
          {/* Ingredients inline in hero */}
          {ingredientGroups.length > 0 && (
            <div className="recipe-page__ing-preview">
              <h4 className="recipe-page__ing-title">Ingredients</h4>
              {ingredientGroups.map(({ label, items }) => (
                <div key={label}>
                  {label && <p className="recipe-page__ing-group-label">{label}</p>}
                  <ul className="rp-ing-list">
                    {items.map((ing, idx) => {
                      const key = `${label}-${idx}`;
                      const isChecked = checkedIngredients.has(key);
                      const amountStr = [ing.amount, ing.unit, ing.name].filter(Boolean).join(' ');
                      return (
                        <li key={key} className={`rp-ing-item ${isChecked ? 'rp-ing-item--checked' : ''}`} onClick={() => toggleIngredient(key)}>
                          <div className={`rp-ing-item__checkbox ${isChecked ? 'rp-ing-item__checkbox--checked' : ''}`}>{isChecked && '✓'}</div>
                          <div className="rp-ing-item__body">
                            <span className="rp-ing-item__text">{amountStr}</span>
                            {ing.optional && <span className="rp-ing-item__optional">Optional</span>}
                            {ing.prep_note && <span className="rp-ing-item__prep">{ing.prep_note}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions full width */}
      {instructions?.length > 0 && (
        <section className="rp-section">
          <h3 className="rp-section__title">Instructions</h3>
          <ol className="rp-steps">
            {[...instructions].sort((a, b) => a.step_number - b.step_number).map(step => {
              const done = doneSteps.has(step.step_number);
              return (
                <li key={step.step_number} className={`rp-step ${done ? 'rp-step--done' : ''}`} onClick={() => toggleStep(step.step_number)}>
                  <div className="rp-step__num">{done ? '✓' : step.step_number}</div>
                  <p className="rp-step__body">{step.body_text}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Notes cards */}
      {notes?.length > 0 && (
        <section className="rp-section">
          <h3 className="rp-section__title">Notes &amp; Modifications</h3>
          <div className="rp-notes-grid">
            {notes.map((n, i) => (
              <div key={i} className="rp-note-card">
                <span className="rp-note-card__icon">💡</span>
                <p>{n.text ?? n.body_text ?? n}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

// ─── Ingredient Autocomplete Input ─────────────────────────────────────────
const IngredientAutocomplete = ({ value, onChange, allIngredients }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => {
    const val = value ?? '';
    if (!val.trim()) return [];
    const q = val.toLowerCase();
    // Fuzzy: score by how early the match appears, prefer starts-with
    return allIngredients
      .map(ing => {
        if (!ing || typeof ing !== 'string') return null;
        const lower = ing.toLowerCase();
        if (!lower.includes(q)) return null;
        const score = lower.startsWith(q) ? 0 : lower.indexOf(q);
        return { ing, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map(x => x.ing);
  }, [value, allIngredients]);

  useEffect(() => { setHighlighted(0); }, [suggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (ing) => { onChange(ing); setOpen(false); };

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && suggestions[highlighted]) { e.preventDefault(); select(suggestions[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="ing-ac-wrap" ref={wrapperRef}>
      <input
        className="editor-input"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="soy sauce"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((ing, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = ing.toLowerCase().indexOf(q);
            return (
              <li
                key={ing}
                className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`}
                onMouseDown={() => select(ing)}
                onMouseEnter={() => setHighlighted(i)}
              >
                {idx >= 0 ? (
                  <>{ing.slice(0, idx)}<strong>{ing.slice(idx, idx + q.length)}</strong>{ing.slice(idx + q.length)}</>
                ) : ing}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const UnitAutocomplete = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => { 
    const val = value ?? '';
    if (!val.trim()) return COMMON_UNITS.slice(0, 8);
    const q = val.toLowerCase();
    return COMMON_UNITS
      .filter(u => u.toLowerCase().startsWith(q) || u.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value]);

  useEffect(() => { setHighlighted(0); }, [suggestions]);

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (u) => { onChange(u); setOpen(false); };

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && suggestions[highlighted]) { e.preventDefault(); select(suggestions[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="ing-ac-wrap" ref={wrapperRef}>
      <input
        className="editor-input editor-input--sm"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="tbsp"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((u, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = u.toLowerCase().indexOf(q);
            return (
              <li
                key={u}
                className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`}
                onMouseDown={() => select(u)}
                onMouseEnter={() => setHighlighted(i)}
              >
                {idx >= 0 && q ? (
                  <>{u.slice(0, idx)}<strong>{u.slice(idx, idx + q.length)}</strong>{u.slice(idx + q.length)}</>
                ) : u}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const SortableItem = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="sortable-item">
      <div className="sortable-handle" {...attributes} {...listeners}>⠿</div>
      {children}
    </div>
  );
};

// ─── Recipe Editor ──────────────────────────────────────────────────────────
const RecipeEditor = ({ recipe, bodyIngredients, instructions, notes, allIngredients, onBack, onSaved }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Details
  const [details, setDetails] = useState({
    name: recipe?.name || '',
    cuisine: recipe?.cuisine || '',
    time: recipe?.time || '',
    servings: recipe?.servings || '',
    calories: recipe?.calories ?? '',
    protein: recipe?.protein ?? '',
    cover_image_url: recipe?.coverImage || '',
  });

  // Ingredients — each needs a stable id for dnd-kit
  const [ings, setIngs] = useState(() =>
    (bodyIngredients || []).map((i, idx) => ({ ...i, _id: `ing-${idx}` }))
  );

  // Instructions
  const [steps, setSteps] = useState(() =>
    (instructions || []).map((s, idx) => ({ ...s, _id: `step-${idx}` }))
  );

  // Notes
  const [notesList, setNotesList] = useState(() =>
    (notes || []).map((n, idx) => ({ ...n, _id: `note-${idx}` }))
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));

  // ── Ingredient helpers ──
  const addIng = () => setIngs(prev => [...prev, {
    _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '',
  }]);
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setIngs(prev => {
        const oldIdx = prev.findIndex(i => i._id === active.id);
        const newIdx = prev.findIndex(i => i._id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  // ── Step helpers ──
  const addStep = () => setSteps(prev => [...prev, {
    _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '',
  }]);
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setSteps(prev => {
        const oldIdx = prev.findIndex(s => s._id === active.id);
        const newIdx = prev.findIndex(s => s._id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  // ── Note helpers ──
  const addNote = () => setNotesList(prev => [...prev, { _id: `note-new-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  // ── Save ──
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = {
        details,
        ingredients: ings.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: steps.map((s, idx) => ({ ...s, step_number: idx + 1 })),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      console.log('Saving payload:', JSON.stringify(payload, null, 2));
      const res = await fetch(`${API}/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaveSuccess(true);
      if (onSaved) onSaved(data.recipe);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Collect unique group labels for datalist autocomplete
  const groupLabels = [...new Set(ings.map(i => i.group_label).filter(Boolean))];

  return (
    <main className="view editor-page">
      <div className="editor-topbar">
        <button className="btn btn--ghost" onClick={onBack}>← Cancel</button>
        <h2 className="editor-title">Edit Recipe</h2>
        <button className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {saveError && <p className="editor-error">⚠️ {saveError}</p>}
      {saveSuccess && <p className="editor-success">✓ Saved successfully</p>}

      {/* ── Details ── */}
      <section className="editor-section">
        <h3 className="editor-section__title">Details</h3>
        <div className="editor-fields">
          <label className="editor-field editor-field--wide">
            <span>Recipe Name</span>
            <input className="editor-input" value={details.name} onChange={e => setDetail('name', e.target.value)} placeholder="e.g. Chicken Tikka Masala" />
          </label>
          <label className="editor-field">
            <span>Cuisine</span>
            <select className="editor-input editor-select" value={details.cuisine} onChange={e => setDetail('cuisine', e.target.value)}>
              <option value="">— select —</option>
              {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="editor-field">
            <span>Time</span>
            <input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="e.g. 45 mins" />
          </label>
          <label className="editor-field">
            <span>Servings</span>
            <input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="e.g. 4" />
          </label>
          <label className="editor-field">
            <span>Calories</span>
            <input className="editor-input" type="number" value={details.calories} onChange={e => setDetail('calories', e.target.value)} placeholder="kcal" />
          </label>
          <label className="editor-field">
            <span>Protein (g)</span>
            <input className="editor-input" type="number" value={details.protein} onChange={e => setDetail('protein', e.target.value)} placeholder="g" />
          </label>
          <label className="editor-field editor-field--wide">
            <span>Cover Image URL</span>
            <input className="editor-input" value={details.cover_image_url} onChange={e => setDetail('cover_image_url', e.target.value)} placeholder="https://…" />
          </label>
        </div>
      </section>

      {/* ── Ingredients ── */}
      <section className="editor-section">
        <h3 className="editor-section__title">Ingredients</h3>
        <datalist id="group-labels">
          {groupLabels.map(l => <option key={l} value={l} />)}
        </datalist>
        <div className="editor-ing-header">
          <span>Amount</span><span>Unit</span><span>Name</span><span>Group</span><span>Prep note</span><span>Opt?</span><span></span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
          <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
            {ings.map(ing => (
              <SortableItem key={ing._id} id={ing._id}>
                <div className="editor-ing-row">
                  <input className="editor-input editor-input--sm" value={ing.amount} onChange={e => updateIng(ing._id, 'amount', e.target.value)} placeholder="2" />
                  <UnitAutocomplete value={ing.unit} onChange={v => updateIng(ing._id, 'unit', v)} />
                  <IngredientAutocomplete
                    value={ing.name}
                    onChange={v => updateIng(ing._id, 'name', v)}
                    allIngredients={allIngredients.filter(Boolean)}
                  />
                  <input className="editor-input editor-input--sm" value={ing.group_label || ''} onChange={e => updateIng(ing._id, 'group_label', e.target.value)} placeholder="e.g. Sauce" list="group-labels" />
                  <input className="editor-input" value={ing.prep_note || ''} onChange={e => updateIng(ing._id, 'prep_note', e.target.value)} placeholder="finely chopped" />
                  <button
                    className={`editor-optional-btn ${ing.optional ? 'editor-optional-btn--on' : ''}`}
                    onClick={() => updateIng(ing._id, 'optional', !ing.optional)}
                    title="Mark as optional"
                  >{ing.optional ? '✓' : '○'}</button>
                  <button className="editor-remove-btn" onClick={() => removeIng(ing._id)}>✕</button>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn btn--ghost editor-add-btn" onClick={addIng}>+ Add Ingredient</button>
      </section>

      {/* ── Instructions ── */}
      <section className="editor-section">
        <h3 className="editor-section__title">Instructions</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
          <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
            {steps.map((step, idx) => (
              <SortableItem key={step._id} id={step._id}>
                <div className="editor-step-row">
                  <span className="editor-step-num">{idx + 1}</span>
                  <textarea
                    className="editor-textarea"
                    value={step.body_text}
                    onChange={e => updateStep(step._id, e.target.value)}
                    placeholder="Describe this step…"
                    rows={2}
                  />
                  <button className="editor-remove-btn" onClick={() => removeStep(step._id)}>✕</button>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
      </section>

      {/* ── Notes ── */}
      <section className="editor-section">
        <h3 className="editor-section__title">Notes &amp; Modifications</h3>
        {notesList.map(note => (
          <div key={note._id} className="editor-note-row">
            <input
              className="editor-input"
              value={note.text || ''}
              onChange={e => updateNote(note._id, e.target.value)}
              placeholder="e.g. Works great with tofu instead of chicken"
            />
            <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
          </div>
        ))}
        <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
      </section>

      {/* ── Bottom save bar ── */}
      <div className="editor-save-bar">
        {saveError && <p className="editor-error">⚠️ {saveError}</p>}
        {saveSuccess && <p className="editor-success">✓ Saved successfully</p>}
        <button className="btn btn--primary btn--large" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </main>
  );
};

// Remove the old FRIDGE_KEYWORDS / PANTRY_KEYWORDS / classifyIngredient — no longer needed

// ─── Fridge Tab ─────────────────────────────────────────────────────────────
const FRIDGE_TYPES  = ['produce', 'meat', 'dairy'];
const PANTRY_TYPES  = ['pantry', 'spice', 'sauce', 'alcohol'];

const FridgeTab = ({ allIngredients, fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples }) => {
  const [section, setSection] = useState('fridge');
  const [search, setSearch] = useState('');

  const fridgeList  = useMemo(() => allIngredients.filter(i => FRIDGE_TYPES.includes(i.type)),  [allIngredients]);
  const pantryList  = useMemo(() => allIngredients.filter(i => PANTRY_TYPES.includes(i.type)), [allIngredients]);
  const sourceList  = section === 'fridge' ? fridgeList : pantryList;

  const grouped = useMemo(() => {
    const filtered = sourceList.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return filtered.reduce((acc, ing) => {
      const letter = ing.name[0]?.toUpperCase() || '#';
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(ing.name);
      return acc;
    }, {});
  }, [sourceList, search]);

  const isFridge   = section === 'fridge';
  const selected   = isFridge ? fridgeIngredients : pantryStaples;
  const setSelected = isFridge ? setFridgeIngredients : setPantryStaples;

  const toggle = (name) => {
    const lower = name.toLowerCase();
    setSelected(prev => prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]);
  };

  return (
    <main className="view">
      <div className="fridge-header">
        <div>
          <h2 className="fridge-title">My Kitchen</h2>
          <p className="fridge-subtitle">Select what you have so we can suggest recipes</p>
        </div>
      </div>
      <div className="fridge-section-tabs">
        <button className={`fridge-tab ${section === 'fridge' ? 'fridge-tab--active' : ''}`} onClick={() => setSection('fridge')}>
          🧊 Fridge
          {fridgeIngredients.length > 0 && <span className="fridge-tab__count">{fridgeIngredients.length}</span>}
        </button>
        <button className={`fridge-tab ${section === 'pantry' ? 'fridge-tab--active' : ''}`} onClick={() => setSection('pantry')}>
          🫙 Pantry &amp; Spices
          {pantryStaples.length > 0 && <span className="fridge-tab__count">{pantryStaples.length}</span>}
        </button>
      </div>
      <p className="fridge-section-hint">
        {isFridge
          ? 'Fresh produce, meat & dairy — update this regularly'
          : 'Dry goods, sauces, spices & alcohol — set once and forget'}
      </p>
      <div className="picker__search-row">
        <input className="picker__search" type="search" placeholder="Search ingredients..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="picker__actions">
          <button className="btn btn--ghost" onClick={() => setSelected([])}>Clear</button>
          <button className="btn btn--ghost" onClick={() => setSelected(sourceList.map(i => i.name.toLowerCase()))}>All</button>
        </div>
      </div>
      <div className="picker__grid-wrapper picker__grid-wrapper--full">
        {Object.entries(grouped).sort().map(([letter, items]) => (
          <div key={letter} className="picker__group">
            <div className="picker__group-label">{letter}</div>
            <div className="picker__chips">
              {items.map(name => {
                const isSelected = selected.includes(name.toLowerCase());
                return (
                  <button key={name} className={`chip ${isSelected ? 'chip--selected' : ''}`} onClick={() => toggle(name)}>
                    {isSelected && <span className="chip__check">✓</span>}
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="picker__empty">
            {sourceList.length === 0
              ? 'No ingredients classified for this section yet'
              : `No ingredients match "${search}"`}
          </p>
        )}
      </div>
    </main>
  );
};

// ─── Settings Tab ────────────────────────────────────────────────────────────
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Nut-Free'];

const SettingsTab = ({ units, setUnits, dietaryFilters, setDietaryFilters }) => {
  const toggleDiet = (d) => setDietaryFilters(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <main className="view">
      <h2 className="settings-title">Settings</h2>
      <div className="settings-section">
        <h3 className="settings-section__title">⚖️ Units</h3>
        <p className="settings-section__hint">Choose your preferred measurement system</p>
        <div className="settings-toggle-row">
          <button className={`settings-toggle ${units === 'metric' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('metric')}>
            Metric <span className="settings-toggle__sub">g, ml, °C</span>
          </button>
          <button className={`settings-toggle ${units === 'imperial' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('imperial')}>
            Imperial <span className="settings-toggle__sub">oz, cups, °F</span>
          </button>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-section__title">🥗 Dietary Filters</h3>
        <p className="settings-section__hint">Active filters hide non-matching recipes across the whole app</p>
        <div className="picker__chips" style={{ marginTop: 10 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} className={`chip ${dietaryFilters.includes(d) ? 'chip--selected' : ''}`} onClick={() => toggleDiet(d)}>
              {dietaryFilters.includes(d) && <span className="chip__check">✓</span>}
              {d}
            </button>
          ))}
        </div>
        {dietaryFilters.length > 0 && (
          <p className="settings-active-filters">Active: {dietaryFilters.join(', ')} — recipes without these tags will be hidden</p>
        )}
      </div>
      <div className="settings-section">
        <h3 className="settings-section__title">ℹ️ About</h3>
        <p className="settings-section__hint">Recipe App v0.1 · Postgres backend</p>
      </div>
    </main>
  );
};

// ─── Grocery List Tab ────────────────────────────────────────────────────────
const GroceryListTab = ({ recipes, matchById }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recipeNames, setRecipeNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [error, setError] = useState(null);

  const toggleRecipe = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleChecked = (key) => setChecked(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Auto-fetch when selection changes
  useEffect(() => {
    if (!selectedIds.length) { setCategories([]); setRecipeNames([]); return; }
    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/grocery-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeIds: selectedIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to build list');
        if (!cancelled) {
          setCategories(data.categories || []);
          setRecipeNames(data.recipeNames || []);
          setChecked(new Set());
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch_();
    return () => { cancelled = true; };
  }, [selectedIds]);

  const copyList = () => {
    const lines = [`Grocery List — ${recipeNames.join(', ')}\n`];
    categories.forEach(cat => {
      lines.push(`\n${cat.emoji} ${cat.name}`);
      cat.items.forEach(item => {
        const tick = checked.has(`${cat.name}-${item.name}`) ? '✓' : '○';
        const amount = [item.amount, item.unit].filter(Boolean).join(' ');
        lines.push(`  ${tick} ${amount} ${item.name}${item.prep_note ? ` (${item.prep_note})` : ''}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const checkedCount = checked.size;

  return (
    <main className="view">
      <div className="grocery-header">
        <h2 className="grocery-title">Grocery List</h2>
        <p className="grocery-subtitle">Select recipes to build your shopping list</p>
      </div>

      <div className="grocery-recipe-selector">
        <h3 className="grocery-section-label">Choose recipes</h3>
        <div className="grocery-recipe-list">
          {recipes.filter(r => r.ingredients?.length > 0).map(r => {
            const match = matchById.get(r.id);
            const isSelected = selectedIds.includes(r.id);
            return (
              <button
                key={r.id}
                className={`grocery-recipe-chip ${isSelected ? 'grocery-recipe-chip--selected' : ''}`}
                onClick={() => toggleRecipe(r.id)}
              >
                {isSelected && <span>✓ </span>}
                {r.name}
                {match?.missing?.length > 0 && (
                  <span className="grocery-recipe-chip__missing"> · {match.missing.length} to buy</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="grocery-loading">⏳ Building list…</p>}
      {error && <p className="grocery-error">⚠️ {error}</p>}

      {categories.length > 0 && (
        <div className="grocery-list">
          <div className="grocery-list__header">
            <div>
              <h3 className="grocery-list__title">Shopping List</h3>
              <p className="grocery-list__subtitle">{recipeNames.join(', ')} · {checkedCount}/{totalItems} items checked</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={copyList}>Copy 📋</button>
          </div>
          <div className="grocery-progress">
            <div className="grocery-progress__bar" style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }} />
          </div>
          {categories.map(cat => (
            <div key={cat.name} className="grocery-category">
              <h4 className="grocery-category__title">{cat.emoji} {cat.name}</h4>
              {cat.items.map(item => {
                const key = `${cat.name}-${item.name}`;
                const isChecked = checked.has(key);
                const amountStr = [item.amount, item.unit].filter(Boolean).join(' ');
                return (
                  <div key={key} className={`grocery-item ${isChecked ? 'grocery-item--checked' : ''}`} onClick={() => toggleChecked(key)}>
                    <div className={`grocery-item__checkbox ${isChecked ? 'grocery-item__checkbox--checked' : ''}`}>{isChecked && '✓'}</div>
                    <div className="grocery-item__body">
                      <span className="grocery-item__name">{amountStr} {item.name}</span>
                      {item.prep_note && <span className="grocery-item__note">{item.prep_note}</span>}
                      {item.recipes?.length > 1 && (
                        <span className="grocery-item__recipes">used in {item.recipes.join(', ')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('home');
  const [lastView, setLastView] = useState('home');
  const [allIngredients, setAllIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fridgeIngredients, setFridgeIngredients] = useState(() => LS.get('fridgeIngredients', []));
  const [pantryStaples, setPantryStaples] = useState(() => LS.get('pantryStaples', []));
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeBodyIngredients, setRecipeBodyIngredients] = useState([]);
  const [recipeInstructions, setRecipeInstructions] = useState([]);
  const [recipeNotes, setRecipeNotes] = useState([]);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  const [units, setUnitsRaw] = useState(() => LS.get('units', 'metric'));
  const [dietaryFilters, setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));

  const setUnits = (v) => { setUnitsRaw(v); LS.set('units', v); };
  const setDietaryFilters = (fn) => setDietaryFiltersRaw(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn;
    LS.set('dietaryFilters', next);
    return next;
  });

  useEffect(() => { LS.set('fridgeIngredients', fridgeIngredients); }, [fridgeIngredients]);
  useEffect(() => { LS.set('pantryStaples', pantryStaples); }, [pantryStaples]);

  const loadData = useCallback(async () => {
    try {
      const [ingRes, recipeRes] = await Promise.all([
        fetch(`${API}/api/ingredients`),
        fetch(`${API}/api/recipes`),
      ]);
      if (!ingRes.ok || !recipeRes.ok) throw new Error('Failed to load data');
      const { ingredients } = await ingRes.json();
      const { recipes: recipeData } = await recipeRes.json();
      setAllIngredients(ingredients.sort());
      setRecipes(recipeData);
      setLastSynced(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allMyIngredients = useMemo(() => {
    return new Set([...fridgeIngredients, ...pantryStaples].map(i => i.toLowerCase().trim()));
  }, [fridgeIngredients, pantryStaples]);

  const allTags = useMemo(() => {    const tagSet = new Set();
    recipes.forEach(r => (r.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [recipes]);

  const libraryRecipes = useMemo(() => {
    let list = recipes;
    const q = librarySearch.toLowerCase().trim();
    if (q) list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.cuisine || '').toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q))
    );
    if (activeTag) list = list.filter(r => (r.tags || []).includes(activeTag) || (r.cuisine || '') === activeTag);
    return list;
  }, [recipes, librarySearch, activeTag]);

  const matches = useMemo(() => {
    if (allMyIngredients.size === 0) return [];
    const m = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const have = recipeIngredients.filter(i => allMyIngredients.has(i));
      const missing = recipeIngredients.filter(i => !allMyIngredients.has(i));
      const matchScore = recipeIngredients.length === 0 ? 0 : have.length / recipeIngredients.length;
      return { id: recipe.id, have, missing, matchScore, canMake: missing.length === 0 && recipeIngredients.length > 0 };
    });
    m.sort((a, b) => {
      if (a.canMake && !b.canMake) return -1;
      if (!a.canMake && b.canMake) return 1;
      return b.matchScore - a.matchScore;
    });
    return m;
  }, [allMyIngredients, recipes]);

  const matchById = useMemo(() => {
    const map = new Map();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  const openRecipe = async (recipe) => {
    setLastView(view);
    setView('recipe');
    setRecipeLoading(true);
    setSelectedRecipe(null);
    setRecipeBodyIngredients([]);
    setRecipeInstructions([]);
    setRecipeNotes([]);
    try {
      const res = await fetch(`${API}/api/recipes/${recipe.id}`);
      if (!res.ok) throw new Error('Failed to load recipe details');
      const data = await res.json();
      setSelectedRecipe(data.recipe);
      setRecipeBodyIngredients(data.bodyIngredients || []);
      setRecipeInstructions(data.instructions || []);
      setRecipeNotes(data.notes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRecipeLoading(false);
    }
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading your recipes...</p>
    </div>
  );

  if (error) return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h2>Couldn't connect to the server</h2>
      <p>{error}</p>
      <p className="error-hint">Make sure your backend is running and your .env is configured.</p>
      <button className="btn btn--primary" onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__bar">
          <div className="app-header__brand">
            <span className="app-header__logo">🍳</span>
            <div className="app-header__title-group">
              <span className="app-header__title">Recipe Library</span>
              <span className="app-header__subtitle">Your personal cookbook</span>
            </div>
          </div>
          <nav className="nav-tabs">
            {[
              { key: 'home', label: 'Home' },
              { key: 'recipes', label: 'All Recipes' },
              { key: 'fridge', label: 'Fridge' },
              { key: 'grocery', label: 'Grocery List' },
              { key: 'add', label: 'Add Recipe' },
              { key: 'settings', label: 'Settings' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`nav-tab ${view === key ? 'nav-tab--active' : ''}`}
                onClick={() => setView(key)}
                disabled={key === 'recipes' && recipes.length === 0}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {view === 'recipe' && !editingRecipe && (
        <RecipePage
          recipe={selectedRecipe}
          bodyIngredients={recipeBodyIngredients}
          instructions={recipeInstructions}
          notes={recipeNotes}
          loading={recipeLoading}
          onBack={() => setView(lastView)}
          onEdit={() => setEditingRecipe(true)}
        />
      )}

      {view === 'recipe' && editingRecipe && (
        <RecipeEditor
          recipe={selectedRecipe}
          bodyIngredients={recipeBodyIngredients}
          instructions={recipeInstructions}
          notes={recipeNotes}
          allIngredients={allIngredients}
          onBack={() => setEditingRecipe(false)}
          onSaved={async (updated) => {
            setSelectedRecipe(updated);
            setEditingRecipe(false);
            // Re-fetch the full recipe detail so the view page is fresh
            try {
              const res = await fetch(`${API}/api/recipes/${updated.id}`);
              const data = await res.json();
              setSelectedRecipe(data.recipe);
              setRecipeBodyIngredients(data.bodyIngredients || []);
              setRecipeInstructions(data.instructions || []);
              setRecipeNotes(data.notes || []);
            } catch {}
            loadData();
          }}
        />
      )}

      {view === 'fridge' && (
        <FridgeTab
          allIngredients={allIngredients}
          fridgeIngredients={fridgeIngredients}
          setFridgeIngredients={setFridgeIngredients}
          pantryStaples={pantryStaples}
          setPantryStaples={setPantryStaples}
        />
      )}

      {view === 'home' && (
        <main className="view">
          <div className="home-section">
            <div className="home-section__header">
              <h2 className="home-section__title">What can I make?</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setView('fridge')}>
                {fridgeIngredients.length + pantryStaples.length > 0
                  ? `${fridgeIngredients.length + pantryStaples.length} ingredients set`
                  : 'Set my ingredients →'}
              </button>
            </div>
            {allMyIngredients.size === 0 ? (
              <div className="home-empty-cta" onClick={() => setView('fridge')}>
                <span className="home-empty-cta__icon">🧊</span>
                <div>
                  <p className="home-empty-cta__title">Add your fridge &amp; pantry ingredients</p>
                  <p className="home-empty-cta__sub">We'll show you what you can cook right now</p>
                </div>
                <span className="home-empty-cta__arrow">→</span>
              </div>
            ) : (
              <div className="recipe-grid">
                {matches.slice(0, 4).map(m => {
                  const r = recipes.find(x => x.id === m.id);
                  if (!r) return null;
                  return <RecipeCard key={r.id} recipe={r} match={m} onClick={openRecipe} />;
                })}
                {matches.length === 0 && <p className="home-no-matches">No matches yet — try adding more ingredients in the Fridge tab.</p>}
              </div>
            )}
          </div>
          <div className="home-section">
            <h2 className="home-section__title">Recipe Stats</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-card__number">{recipes.length}</span>
                <span className="stat-card__label">Total Recipes</span>
              </div>
              <div className="stat-card stat-card--green">
                <span className="stat-card__number">{matches.filter(m => m.canMake).length}</span>
                <span className="stat-card__label">Can Make Now</span>
              </div>
              <div className="stat-card stat-card--amber">
                <span className="stat-card__number">{matches.filter(m => m.matchScore >= 0.5 && !m.canMake).length}</span>
                <span className="stat-card__label">Almost There</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__number" style={{ fontSize: '18px' }}>
                  {(() => {
                    const counts = {};
                    recipes.forEach(r => { if (r.cuisine) counts[r.cuisine] = (counts[r.cuisine] || 0) + 1; });
                    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    return top ? top[0] : '—';
                  })()}
                </span>
                <span className="stat-card__label">Top Cuisine</span>
              </div>
            </div>
          </div>
        </main>
      )}

      {view === 'recipes' && (
        <main className="view">
          <div className="library-header">
            <h2>All Recipes</h2>
            <p className="library-subtitle">{libraryRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="library-search-row">
            <input className="library-search" type="search" placeholder="Search by recipe or tag..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} />
            {librarySearch && <button className="btn btn--ghost library-search-clear" onClick={() => setLibrarySearch('')}>Clear</button>}
          </div>
          {allTags.length > 0 && (
            <div className="tag-filter-row">
              <button className={`tag-filter-chip ${activeTag === null ? 'tag-filter-chip--active' : ''}`} onClick={() => setActiveTag(null)}>All</button>
              {allTags.map(tag => (
                <button key={tag} className={`tag-filter-chip ${activeTag === tag ? 'tag-filter-chip--active' : ''}`} onClick={() => setActiveTag(prev => prev === tag ? null : tag)}>{tag}</button>
              ))}
            </div>
          )}
          <div className="recipe-grid">
            {libraryRecipes.map(r => <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe} />)}
            {libraryRecipes.length === 0 && (
              <div className="results-empty">
                <p>No recipes match your search{activeTag ? ` or tag "${activeTag}"` : ''}.</p>
                <button className="btn btn--ghost" onClick={() => { setLibrarySearch(''); setActiveTag(null); }}>Show all</button>
              </div>
            )}
          </div>
        </main>
      )}

      {view === 'grocery' && <GroceryListTab recipes={recipes} matchById={matchById} />}

      {view === 'add' && (
        <main className="view">
          <div className="placeholder">
            <h2>Add Recipe</h2>
            <p>Coming soon – paste an Instagram or TikTok link and we'll draft a recipe for you.</p>
          </div>
        </main>
      )}

      {view === 'settings' && (
        <SettingsTab
          units={units}
          setUnits={setUnits}
          dietaryFilters={dietaryFilters}
          setDietaryFilters={setDietaryFilters}
        />
      )}
    </div>
  );
}
