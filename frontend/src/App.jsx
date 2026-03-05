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

// ─── Error Boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  componentDidCatch(error, info) { this.setState({ error, info }); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff0f0', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00' }}>💥 Runtime Error</h2>
          <pre style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f99', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── localStorage helpers ──────────────────────────────────────────────────
const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const COMMON_UNITS = [
  'tsp', 'tbsp', 'cup', 'cups', 'ml', 'l', 'g', 'kg', 'oz', 'lb',
  'pinch', 'handful', 'bunch', 'clove', 'cloves', 'slice', 'slices',
  'piece', 'pieces', 'can', 'jar', 'bag', 'sprig', 'sprigs',
  'rasher', 'fillet', 'fillets', 'sheet', 'sheets',
];

// ── Tag filters — match against recipe's tags array only (not cuisine column)
const TAG_FILTERS = [
  { key: 'Meals',    label: '🍽 Meals'    },
  { key: 'Dessert',  label: '🍰 Desserts' },
  { key: 'Drinks',   label: '🍹 Drinks'   },
  { key: 'Pasta',    label: '🍝 Pasta'    },
  { key: 'Soup',     label: '🍲 Soup'     },
  { key: 'Marinade', label: '🫙 Marinade' },
  { key: 'Party',    label: '🎉 Party'    },
  { key: 'Snacks',   label: '🥨 Snacks'   },
];

// ── Progress filters — based on DB columns (recipe_incomplete, status)
const PROGRESS_FILTERS = [
  { key: '__incomplete',    label: '🚧 Incomplete'      },
  { key: '__needstweaking', label: '🔧 Needs Tweaking'  },
  { key: '__favorite',      label: '⭐ Favorite'         },
  { key: '__complete',      label: '✅ Complete'         },
];

// Cuisine filter chips — concise list for the filter panel
const CUISINE_FILTERS = [
  { key: 'Asian',          label: '🍜 Asian'         },
  { key: 'Indian',         label: '🫕 Indian'        },
  { key: 'Mediterranean',  label: '🫒 Mediterranean' },
  { key: 'Mexican',        label: '🌮 Mexican'       },
  { key: 'Middle Eastern', label: '🧆 Middle Eastern'},
];

// All cuisines available in the recipe editor dropdown
const ALL_CUISINES = ['Asian', 'Indian', 'Mediterranean', 'Mexican', 'Middle Eastern',].sort();

// ─── Helpers ───────────────────────────────────────────────────────────────
const pct = (score) => Math.round(score * 100);

const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

// ─── Recipe Summary Card ───────────────────────────────────────────────────
const toNum = (v) => { const n = Number(v); return (!isNaN(n) && v !== '' && v !== null && v !== undefined) ? n : null; };

const RecipeCard = ({ recipe, match, onClick, isHearted, onToggleHeart }) => {
  const { name, coverImage, cuisine, time } = recipe;
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
        {onToggleHeart && (
          <button
            className={`recipe-card__heart ${isHearted ? 'recipe-card__heart--on' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleHeart(); }}
            title={isHearted ? 'Remove from Make Soon' : 'Add to Make Soon'}
          >♥</button>
        )}
      </div>
      <div className="recipe-card__body">
        <div className="recipe-card__title-row">
          <h3 className="recipe-card__title">{name}</h3>
          {cuisine && <span className="recipe-card__cuisine">{cuisine}</span>}
        </div>
        <div className="recipe-card__meta">
          {(recipe.tags || []).slice(0, 3).map(t => <span key={t} className="badge badge--tag">{t}</span>)}
          {canMakeNow && <span className="recipe-card__can-make">✓ Ready</span>}
        </div>
        <div className="recipe-card__stats">
          {time && <span className="recipe-card__stat"><span className="recipe-card__stat-icon">⏱</span>{time}</span>}
          {toNum(recipe.calories) !== null && <span className="recipe-card__stat"><span className="recipe-card__stat-icon">🔥</span>{recipe.calories} kcal</span>}
          {toNum(recipe.protein) !== null && <span className="recipe-card__stat"><span className="recipe-card__stat-icon">💪</span>{recipe.protein}g</span>}
        </div>
      </div>
    </article>
  );
};

// ─── Recipe Page — inline section editing ──────────────────────────────────

// Helper: save a section via PUT /api/recipes/:id
async function saveRecipeSection(recipeId, payload) {
  const res = await fetch(`${API}/api/recipes/${recipeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data;
}

// ── Title-only inline editor (name + status/progress)
const TitleEditor = ({ recipe, onSaved, onCancel }) => {
  const [name, setName] = useState(recipe.name || '');
  const [status, setStatus] = useState(recipe.status || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const STATUS_OPTIONS = ['', 'Incomplete', 'Needs Tweaking', 'Favorite', 'Complete'];
  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const data = await saveRecipeSection(recipe.id, {
        details: { name, cuisine: recipe.cuisine, time: recipe.time, servings: recipe.servings, calories: recipe.calories, protein: recipe.protein, cover_image_url: recipe.coverImage, status },
        tags: recipe.tags,
        ingredients: null, instructions: null, notes: null,
      });
      onSaved(data.recipe, recipe.tags);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="inline-editor inline-editor--title">
      <div className="inline-editor__actions">
        <button className="inline-editor__cancel" onClick={onCancel}>✕</button>
        <button className="inline-editor__save" onClick={save} disabled={saving}>{saving ? '…' : '✓'}</button>
      </div>
      {err && <p className="inline-editor__err">{err}</p>}
      <div className="title-edit-row">
        <input className="title-edit-input" value={name} onChange={e => setName(e.target.value)} placeholder="Recipe name" autoFocus />
        <select className="title-edit-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || '— status —'}</option>)}
        </select>
      </div>
    </div>
  );
};

// ── Hero field inline editor — clicking a pill on the hero makes it editable
const HeroFieldEditor = ({ recipe, field, onSaved, onClose }) => {
  // field: 'cuisine' | 'time' | 'servings' | 'tags'
  const [cuisine, setCuisine] = useState(recipe.cuisine || '');
  const [time, setTime] = useState(recipe.time || '');
  const [servings, setServings] = useState(recipe.servings || '');
  const [tags, setTags] = useState(recipe.tags || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const EDIT_TAG_OPTIONS = ['Meals','Dessert','Drinks','Pasta','Soup','Marinade','Party','Snacks'];
  const toggleTag = (t) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const newTags = field === 'tags' ? tags : recipe.tags;
      const data = await saveRecipeSection(recipe.id, {
        details: {
          name: recipe.name,
          cuisine: field === 'cuisine' ? cuisine : recipe.cuisine,
          time: field === 'time' ? time : recipe.time,
          servings: field === 'servings' ? servings : recipe.servings,
          calories: recipe.calories, protein: recipe.protein,
          cover_image_url: recipe.coverImage, status: recipe.status
        },
        tags: newTags,
        ingredients: null, instructions: null, notes: null,
      });
      onSaved(data.recipe, newTags);
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div className="hero-field-popup" ref={ref}>
      {err && <p className="hero-field-popup__err">{err}</p>}
      {field === 'cuisine' && (
        <select className="hero-field-popup__input" value={cuisine} onChange={e => setCuisine(e.target.value)} autoFocus>
          <option value="">— none —</option>
          {ALL_CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {field === 'time' && (
        <input className="hero-field-popup__input" value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 45 mins" autoFocus />
      )}
      {field === 'servings' && (
        <input className="hero-field-popup__input" value={servings} onChange={e => setServings(e.target.value)} placeholder="e.g. 4" autoFocus />
      )}
      {field === 'tags' && (
        <div className="hero-field-popup__tags">
          {EDIT_TAG_OPTIONS.map(t => (
            <button key={t} className={`meta-edit-tag ${tags.includes(t) ? 'meta-edit-tag--on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
          ))}
        </div>
      )}
      <div className="hero-field-popup__btns">
        <button className="hero-field-popup__cancel" onClick={onClose}>✕</button>
        <button className="hero-field-popup__save" onClick={save} disabled={saving}>{saving ? '…' : '✓'}</button>
      </div>
    </div>
  );
};

// ── Inline-editable Photo section
const PhotoEditor = ({ recipe, onSaved, onCancel }) => {
  const [url, setUrl] = useState(recipe.coverImage || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const data = await saveRecipeSection(recipe.id, {
        details: { name: recipe.name, cuisine: recipe.cuisine, time: recipe.time, servings: recipe.servings, calories: recipe.calories, protein: recipe.protein, cover_image_url: url, status: recipe.status },
        ingredients: null, instructions: null, notes: null,
      });
      onSaved(data.recipe);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="photo-editor-overlay">
      <input
        className="photo-editor-input"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Paste image URL…"
        autoFocus
      />
      {err && <p className="photo-editor-err">{err}</p>}
      <div className="photo-editor-btns">
        <button className="photo-editor-btn photo-editor-btn--cancel" onClick={onCancel}>Cancel</button>
        <button className="photo-editor-btn photo-editor-btn--save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save photo'}</button>
      </div>
    </div>
  );
};

// ── Inline-editable Ingredients section
// Flat list model: items are either type='group' (header row) or type='ing' (ingredient).
// Dragging works across the whole flat list. An ingredient "belongs to" the last group row above it.
const IngredientsEditor = ({ recipe, bodyIngredients, allIngredients, onSaved, onCancel }) => {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Build initial flat list from bodyIngredients, inserting group header rows
  const buildFlat = (bings) => {
    if (!bings || bings.length === 0) return [];
    const seenGroups = new Set();
    const flat = [];
    // Insert group headers in order of first appearance
    for (const ing of bings) {
      const g = ing.group_label || '';
      if (g && !seenGroups.has(g)) {
        seenGroups.add(g);
        flat.push({ _id: `grp-${g}-${Date.now()}-${Math.random()}`, _type: 'group', label: g });
      }
      flat.push({ ...ing, _id: `ing-${ing.id || Math.random()}`, _type: 'ing', _expanded: false });
    }
    return flat;
  };

  const [items, setItems] = useState(() => buildFlat(bodyIngredients));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const addIng = () => setItems(prev => [...prev, { _id: `ing-new-${Date.now()}`, _type: 'ing', name: '', amount: '', unit: '', prep_note: '', optional: false, _expanded: true }]);
  const addGroup = () => setItems(prev => [...prev, { _id: `grp-new-${Date.now()}`, _type: 'group', label: '' }]);
  const updateItem = (id, k, v) => setItems(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeItem = (id) => setItems(prev => prev.filter(i => i._id !== id));
  const toggleExpand = (id) => setItems(prev => prev.map(i => i._id === id ? { ...i, _expanded: !i._expanded } : i));

  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oi = prev.findIndex(i => i._id === active.id);
        const ni = prev.findIndex(i => i._id === over.id);
        return arrayMove(prev, oi, ni);
      });
    }
  };

  // Derive group_label for each ingredient: it's the label of the last group row above it
  const deriveGroupLabels = (flatItems) => {
    let currentGroup = '';
    return flatItems.map(item => {
      if (item._type === 'group') { currentGroup = item.label; return item; }
      return { ...item, group_label: currentGroup };
    });
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const withGroups = deriveGroupLabels(items);
      const ingredients = withGroups
        .filter(i => i._type === 'ing')
        .map((i, idx) => ({ ...i, order_index: idx }));
      const data = await saveRecipeSection(recipe.id, {
        details: { name: recipe.name, cuisine: recipe.cuisine, time: recipe.time, servings: recipe.servings, calories: recipe.calories, protein: recipe.protein, cover_image_url: recipe.coverImage, status: recipe.status },
        ingredients,
        instructions: null, notes: null,
      });
      onSaved(data.recipe);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="inline-editor inline-editor--ingredients">
      <div className="inline-editor__actions">
        <button className="inline-editor__cancel" onClick={onCancel} title="Cancel">✕</button>
        <button className="inline-editor__save" onClick={save} disabled={saving} title="Save">{saving ? '…' : '✓'}</button>
      </div>
      {err && <p className="inline-editor__err">{err}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(i => i._id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableItem key={item._id} id={item._id}>
              {item._type === 'group' ? (
                <div className="ie-group-row">
                  <input
                    className="ie-input ie-group-row__input"
                    value={item.label}
                    onChange={e => updateItem(item._id, 'label', e.target.value)}
                    placeholder="Group name (e.g. Sauce, Marinade)"
                  />
                  <button className="ie-row__remove" onClick={() => removeItem(item._id)}>✕</button>
                </div>
              ) : (
                <div className="ie-row">
                  <div className="ie-row__top">
                    <input className="ie-input ie-input--qty" value={item.amount || ''} onChange={e => updateItem(item._id, 'amount', e.target.value)} placeholder="qty" />
                    <UnitAutocomplete value={item.unit || ''} onChange={v => updateItem(item._id, 'unit', v)} />
                    <IngredientAutocomplete value={item.name || ''} onChange={v => updateItem(item._id, 'name', v)} allIngredients={allIngredients} />
                    <button className="ie-row__expand" onClick={() => toggleExpand(item._id)} title="Prep note / optional">{item._expanded ? '▴' : '▾'}</button>
                    <button className="ie-row__remove" onClick={() => removeItem(item._id)}>✕</button>
                  </div>
                  {item._expanded && (
                    <div className="ie-row__details">
                      <input className="ie-input ie-input--prep" value={item.prep_note || ''} onChange={e => updateItem(item._id, 'prep_note', e.target.value)} placeholder="Prep note (e.g. finely chopped)" />
                      <label className="ie-optional">
                        <input type="checkbox" checked={!!item.optional} onChange={e => updateItem(item._id, 'optional', e.target.checked)} />
                        Optional
                      </label>
                    </div>
                  )}
                </div>
              )}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <div className="ie-add-bar">
        <button className="ie-add-btn" onClick={addIng}>+ Add ingredient</button>
        <button className="ie-add-btn ie-add-btn--group" onClick={addGroup}>+ Add group</button>
      </div>
    </div>
  );
};

// ── Inline-editable Instructions section
const InstructionsEditor = ({ recipe, instructions, onSaved, onCancel }) => {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [steps, setSteps] = useState(() => (instructions || []).map((s, i) => ({ ...s, _id: `step-${i}` })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const addStep = () => setSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '' }]);
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setSteps(prev => { const oi = prev.findIndex(s => s._id === active.id); const ni = prev.findIndex(s => s._id === over.id); return arrayMove(prev, oi, ni); });
    }
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const data = await saveRecipeSection(recipe.id, {
        details: { name: recipe.name, cuisine: recipe.cuisine, time: recipe.time, servings: recipe.servings, calories: recipe.calories, protein: recipe.protein, cover_image_url: recipe.coverImage, status: recipe.status },
        ingredients: null,
        instructions: steps.map((s, idx) => ({ ...s, step_number: idx + 1 })),
        notes: null,
      });
      onSaved(data.recipe);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="inline-editor">
      <div className="inline-editor__actions">
        <button className="inline-editor__cancel" onClick={onCancel}>✕</button>
        <button className="inline-editor__save" onClick={save} disabled={saving}>{saving ? '…' : '✓'}</button>
      </div>
      {err && <p className="inline-editor__err">{err}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, idx) => (
            <SortableItem key={step._id} id={step._id}>
              <div className="ie-step-row">
                <span className="ie-step-num">{idx + 1}</span>
                <textarea className="ie-step-input" value={step.body_text} onChange={e => updateStep(step._id, e.target.value)} placeholder="Describe this step…" rows={2} />
                <button className="ie-row__remove" onClick={() => removeStep(step._id)}>✕</button>
              </div>
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>
      <button className="ie-add-btn" onClick={addStep}>+ Add step</button>
    </div>
  );
};

// ── Inline-editable Notes section
const NotesEditor = ({ recipe, notes, onSaved, onCancel }) => {
  const [notesList, setNotesList] = useState(() => (notes || []).map((n, i) => ({ ...n, _id: `note-${i}` })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const addNote = () => setNotesList(prev => [...prev, { _id: `note-new-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const data = await saveRecipeSection(recipe.id, {
        details: { name: recipe.name, cuisine: recipe.cuisine, time: recipe.time, servings: recipe.servings, calories: recipe.calories, protein: recipe.protein, cover_image_url: recipe.coverImage, status: recipe.status },
        ingredients: null, instructions: null,
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      });
      onSaved(data.recipe);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="inline-editor">
      <div className="inline-editor__actions">
        <button className="inline-editor__cancel" onClick={onCancel}>✕</button>
        <button className="inline-editor__save" onClick={save} disabled={saving}>{saving ? '…' : '✓'}</button>
      </div>
      {err && <p className="inline-editor__err">{err}</p>}
      {notesList.map(note => (
        <div key={note._id} className="ie-note-row">
          <input className="ie-input ie-input--note" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Works great with tofu instead of chicken" />
          <button className="ie-row__remove" onClick={() => removeNote(note._id)}>✕</button>
        </div>
      ))}
      <button className="ie-add-btn" onClick={addNote}>+ Add note</button>
    </div>
  );
};

// ── Section wrapper with hover pencil
const Section = ({ title, onEdit, editing, children, className = '' }) => (
  <div className={`rp-section-wrap ${className}`}>
    <div className="rp-section-header">
      <h2 className="rp2__section-title">{title}</h2>
      {!editing && onEdit && (
        <button className="rp-section-pencil" onClick={onEdit} title="Edit">✏</button>
      )}
    </div>
    {children}
  </div>
);

const RecipePage = ({ recipe: initialRecipe, bodyIngredients: initialIngs, instructions: initialInstructions, notes: initialNotes, loading, onBack, isHearted, onToggleHeart, onReload, allIngredients = [] }) => {
  const [recipe, setRecipe] = useState(initialRecipe);
  const [bodyIngredients, setBodyIngredients] = useState(initialIngs || []);
  const [instructions, setInstructions] = useState(initialInstructions || []);
  const [notes, setNotes] = useState(initialNotes || []);
  const [checkedIngs, setCheckedIngs] = useState(new Set());
  const [checkedSteps, setCheckedSteps] = useState(new Set());
  // Which section is in edit mode: null | 'photo' | 'meta' | 'ingredients' | 'instructions' | 'notes'
  const [editing, setEditing] = useState(null);

  // Sync when parent passes new data (e.g. after reload)
  useEffect(() => { if (initialRecipe) setRecipe(initialRecipe); }, [initialRecipe]);
  useEffect(() => { setBodyIngredients(initialIngs || []); }, [initialIngs]);
  useEffect(() => { setInstructions(initialInstructions || []); }, [initialInstructions]);
  useEffect(() => { setNotes(initialNotes || []); }, [initialNotes]);

  const ingGroups = useMemo(() => {
    const groups = {};
    for (const ing of bodyIngredients) {
      const key = ing.group_label || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ing);
    }
    return groups;
  }, [bodyIngredients]);

  const toggleIng = (id) => setCheckedIngs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleStep = (id) => setCheckedSteps(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const formatAmount = (ing) => [ing.amount, ing.unit].filter(Boolean).join(' ');

  const handleSaved = (updatedRecipe, updatedTags) => {
    setRecipe(r => ({ ...r, ...updatedRecipe, tags: updatedTags ?? updatedRecipe.tags ?? r.tags }));
    setEditing(null);
    if (onReload) onReload();
  };
  const handleIngsSaved = (updatedRecipe) => { setEditing(null); if (onReload) onReload(); };
  const handleInstrSaved = (updatedRecipe) => { setEditing(null); if (onReload) onReload(); };
  const handleNotesSaved = (updatedRecipe) => { setEditing(null); if (onReload) onReload(); };

  if (loading || !recipe) return (
    <main className="view rp2">
      <div style={{ padding: '40px 24px', color: 'var(--warm-gray)' }}>Loading recipe…</div>
    </main>
  );

  const heroField = editing && editing.startsWith('hero:') ? editing.slice(5) : null;

  const IngList = () => (
    bodyIngredients.length > 0 ? (
      Object.entries(ingGroups).map(([group, ings]) => (
        <div key={group} className="rp2__ing-group">
          {group && <p className="rp2__ing-group-label">{group}</p>}
          <ul className="rp-ing-list">
            {ings.map(ing => {
              const checked = checkedIngs.has(ing.id);
              return (
                <li key={ing.id} className={`rp-ing-item ${checked ? 'rp-ing-item--checked' : ''}`} onClick={() => toggleIng(ing.id)}>
                  <div className={`rp-ing-item__checkbox ${checked ? 'rp-ing-item__checkbox--checked' : ''}`}>{checked && '✓'}</div>
                  <div className="rp-ing-item__body">
                    <span className="rp-ing-item__text">{formatAmount(ing)} {ing.name}</span>
                    {ing.optional && <span className="rp-ing-item__optional">optional</span>}
                    {ing.prep_note && <span className="rp-ing-item__prep">{ing.prep_note}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))
    ) : <p style={{ color: 'var(--warm-gray)', fontSize: 14 }}>No ingredients yet.</p>
  );

  return (
    <main className="view rp2">
      {/* Hero photo with back/heart overlaid */}
      <div className="rp2__hero-wrap">
        <div className="rp2__hero">
          {recipe.coverImage
            ? <img className="rp2__hero-img" src={recipe.coverImage} alt={recipe.name} />
            : <div className="rp2__hero-placeholder">🍳</div>}

          {/* Top bar overlaid on hero */}
          <div className="rp2__hero-topbar">
            <button className="rp2__back-hero" onClick={onBack}>← Back</button>
            <button
              className={`rp2__hero-heart ${isHearted ? 'rp2__hero-heart--on' : ''}`}
              onClick={onToggleHeart}
            >♥</button>
          </div>

          {/* Bottom overlay: clickable pills */}
          <div className="rp2__hero-overlay">
            <div />
            <div className="rp2__hero-bottom">
              <div className="rp2__hero-tags">
                <span
                  className={`rp2__tag rp2__tag--editable ${heroField === 'cuisine' ? 'rp2__tag--editing' : ''}`}
                  onClick={() => setEditing(heroField === 'cuisine' ? null : 'hero:cuisine')}
                >{recipe.cuisine || '+ cuisine'}</span>
                <span
                  className={`rp2__tag rp2__tag--light rp2__tag--editable ${heroField === 'tags' ? 'rp2__tag--editing' : ''}`}
                  onClick={() => setEditing(heroField === 'tags' ? null : 'hero:tags')}
                >{(recipe.tags || []).join(', ') || '+ tags'}</span>
              </div>
              <div className="rp2__hero-pills">
                <span
                  className={`rp2__pill rp2__pill--editable ${heroField === 'time' ? 'rp2__pill--editing' : ''}`}
                  onClick={() => setEditing(heroField === 'time' ? null : 'hero:time')}
                >⏱ {recipe.time || 'time'}</span>
                <span
                  className={`rp2__pill rp2__pill--editable ${heroField === 'servings' ? 'rp2__pill--editing' : ''}`}
                  onClick={() => setEditing(heroField === 'servings' ? null : 'hero:servings')}
                >🍽 {recipe.servings ? `${recipe.servings} serv.` : 'servings'}</span>
              </div>
            </div>
          </div>

          {/* Photo edit button — small, bottom-right corner */}
          <button className="rp2__photo-edit-btn" onClick={() => setEditing(editing === 'photo' ? null : 'photo')} title="Change photo">✎</button>

          {/* Photo URL popup — small overlay on the image */}
          {editing === 'photo' && (
            <PhotoEditor
              recipe={recipe}
              onSaved={r => { setRecipe(prev => ({ ...prev, coverImage: r.coverImage || r.cover_image_url })); setEditing(null); }}
              onCancel={() => setEditing(null)}
            />
          )}

          {/* Hero field popup (cuisine / time / servings / tags) */}
          {heroField && (
            <HeroFieldEditor
              recipe={recipe}
              field={heroField}
              onSaved={(r, newTags) => { setRecipe(prev => ({ ...prev, ...r, tags: newTags ?? r.tags ?? prev.tags })); setEditing(null); if (onReload) onReload(); }}
              onClose={() => setEditing(null)}
            />
          )}
        </div>
      </div>

      {/* Title */}
      <div className="rp2__header">
        {editing === 'title' ? (
          <TitleEditor recipe={recipe} onSaved={(r, tags) => handleSaved(r, tags)} onCancel={() => setEditing(null)} />
        ) : (
          <div className="rp2__header-view">
            <div className="rp2__header-title-row">
              <h1 className="rp2__title">{recipe.name}</h1>
              <button className="rp-section-pencil" onClick={() => setEditing('title')} title="Edit name">✏</button>
            </div>
            {recipe.link && <a href={recipe.link} target="_blank" rel="noopener noreferrer" className="rp2__link">View original →</a>}
            {recipe.status && <span className="rp2__status-badge">{recipe.status}</span>}
          </div>
        )}
      </div>

      {/* Two-column body: ingredients left, instructions right */}
      <div className="rp2__body">
        {/* Ingredients sidebar */}
        <div className="rp2__ingredients">
          <Section title="Ingredients" onEdit={() => setEditing('ingredients')} editing={editing === 'ingredients'}>
            {editing === 'ingredients' ? (
              <IngredientsEditor recipe={recipe} bodyIngredients={bodyIngredients} allIngredients={allIngredients} onSaved={handleIngsSaved} onCancel={() => setEditing(null)} />
            ) : <IngList />}
          </Section>
        </div>

        {/* Instructions + Notes main column */}
        <div className="rp2__instructions-col">
          <Section title="Instructions" onEdit={() => setEditing('instructions')} editing={editing === 'instructions'}>
            {editing === 'instructions' ? (
              <InstructionsEditor recipe={recipe} instructions={instructions} onSaved={handleInstrSaved} onCancel={() => setEditing(null)} />
            ) : (
              instructions.length > 0 ? (
                <ol className="rp-steps">
                  {instructions.map(step => {
                    const done = checkedSteps.has(step.id);
                    return (
                      <li key={step.id} className={`rp-step ${done ? 'rp-step--done' : ''}`} onClick={() => toggleStep(step.id)}>
                        <span className="rp-step__num">{done ? '✓' : step.step_number}</span>
                        <p className="rp-step__body">{step.body_text}</p>
                      </li>
                    );
                  })}
                </ol>
              ) : <p style={{ color: 'var(--warm-gray)', fontSize: 14 }}>No instructions yet.</p>
            )}
          </Section>

          {(notes.length > 0 || editing === 'notes') && (
            <Section title="Notes & Tips" onEdit={() => setEditing('notes')} editing={editing === 'notes'}>
              {editing === 'notes' ? (
                <NotesEditor recipe={recipe} notes={notes} onSaved={handleNotesSaved} onCancel={() => setEditing(null)} />
              ) : (
                <ul className="rp2__notes-list">
                  {notes.map((n, i) => <li key={i} className="rp2__notes-item">{n.text ?? n.body_text ?? n}</li>)}
                </ul>
              )}
            </Section>
          )}
          {notes.length === 0 && editing !== 'notes' && (
            <button className="rp2__add-notes-btn" onClick={() => setEditing('notes')}>+ Add notes</button>
          )}
        </div>
      </div>
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
                {idx >= 0 && q ? (
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


// ─── Cuisine Dropdown ───────────────────────────────────────────────────────
const CuisineDropdown = ({ cuisines, value, onChange, onCreateNew }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return cuisines;
    return cuisines.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  }, [cuisines, search]);

  const trimmed = search.trim();
  const exactMatch = cuisines.some(c => c.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c) => { onChange(c === value ? '' : c); setOpen(false); setSearch(''); };
  const create = () => {
    if (!trimmed) return;
    onCreateNew(trimmed);
    onChange(trimmed);
    setOpen(false);
    setSearch('');
  };
  const clear = (e) => { e.stopPropagation(); onChange(''); setSearch(''); };

  return (
    <div className="cuisine-dd" ref={wrapRef}>
      <button
        className={`cuisine-dd__trigger ${value ? 'cuisine-dd__trigger--active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="cuisine-dd__globe">🌍</span>
        <span className="cuisine-dd__label">{value || 'Cuisine'}</span>
        {value
          ? <span className="cuisine-dd__x" onMouseDown={clear}>✕</span>
          : <span className={`cuisine-dd__arrow ${open ? 'cuisine-dd__arrow--open' : ''}`}>▾</span>}
      </button>
      {open && (
        <div className="cuisine-dd__panel">
          <input
            className="cuisine-dd__search"
            placeholder="Search cuisines…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="cuisine-dd__list">
            {filtered.map(c => (
              <button key={c} className={`cuisine-dd__option ${value === c ? 'cuisine-dd__option--active' : ''}`}
                onMouseDown={() => select(c)}
              >
                <span className="cuisine-dd__check">{value === c ? '✓' : ''}</span>
                {c}
              </button>
            ))}
            {showCreate && (
              <button className="cuisine-dd__option cuisine-dd__option--create" onMouseDown={create}>
                <span className="cuisine-dd__create-icon">+</span>
                Add "{trimmed}"
                <span className="cuisine-dd__create-badge">new</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Fridge Tab ─────────────────────────────────────────────────────────────
const ALL_TYPES = ['produce', 'meat', 'dairy', 'sauce', 'spice', 'alcohol', 'staple'];
const TYPE_META = {
  produce:  { label: 'Produce',       emoji: '🥦', group: 'fridge'  },
  meat:     { label: 'Meat & Fish',   emoji: '🥩', group: 'fridge'  },
  dairy:    { label: 'Dairy',         emoji: '🥛', group: 'fridge'  },
  sauce:    { label: 'Sauces',        emoji: '🫙', group: 'fridge'  },
  spice:    { label: 'Spices',        emoji: '🧂', group: 'pantry'  },
  alcohol:  { label: 'Alcohol',       emoji: '🍷', group: 'pantry'  },
  staple:   { label: 'Staples',       emoji: '🌾', group: 'pantry'  },
};

const FridgeTab = ({ allIngredients, fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples }) => {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState(null);
  const [typeOverrides, setTypeOverrides] = useState(() => LS.get('ingredientTypeOverrides', {}));
  const [renamingIng, setRenamingIng] = useState(null);

  useEffect(() => { LS.set('ingredientTypeOverrides', typeOverrides); }, [typeOverrides]);

  const allSelected = useMemo(
    () => new Set([...fridgeIngredients, ...pantryStaples]),
    [fridgeIngredients, pantryStaples]
  );

  const enriched = useMemo(() =>
    allIngredients.map(i => ({ ...i, type: typeOverrides[i.name] ?? i.type })),
    [allIngredients, typeOverrides]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (search.trim()) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    if (activeType) list = list.filter(i => i.type === activeType);
    return list;
  }, [enriched, search, activeType]);

  const grouped = useMemo(() => {
    const map = {};
    for (const ing of filtered) {
      const t = ing.type || 'other';
      if (!map[t]) map[t] = [];
      map[t].push(ing);
    }
    return map;
  }, [filtered]);

  const toggle = (name, type) => {
    const lower = name.toLowerCase();
    const isFridgeType = ['produce', 'meat', 'dairy', 'sauce'].includes(type);
    if (isFridgeType) {
      setFridgeIngredients(prev => prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]);
    } else {
      setPantryStaples(prev => prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]);
    }
  };

  const overrideType = (name, newType) => {
    setTypeOverrides(prev => ({ ...prev, [name]: newType }));
    setRenamingIng(null);
    const lower = name.toLowerCase();
    const newIsFridge = ['produce', 'meat', 'dairy', 'sauce'].includes(newType);
    if (newIsFridge) {
      setPantryStaples(prev => prev.filter(i => i !== lower));
    } else {
      setFridgeIngredients(prev => prev.filter(i => i !== lower));
    }
  };

  const totalSelected = fridgeIngredients.length + pantryStaples.length;

  return (
    <main className="view">
      <div className="fridge-header">
        <div>
          <h2 className="fridge-title">My Kitchen</h2>
          <p className="fridge-subtitle">
            {totalSelected > 0 ? `${totalSelected} ingredient${totalSelected !== 1 ? 's' : ''} selected` : 'Select what you have to get recipe suggestions'}
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => { setFridgeIngredients([]); setPantryStaples([]); }}>Clear all</button>
      </div>

      <div className="fridge-filter-bar">
        <div className="fridge-filter-bar__search-wrap">
          <span className="fridge-filter-bar__icon">🔍</span>
          <input
            className="fridge-filter-bar__search"
            type="search"
            placeholder="Search all ingredients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="fridge-filter-bar__clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="fridge-type-chips">
          <button className={`fridge-type-chip ${activeType === null ? 'fridge-type-chip--active' : ''}`} onClick={() => setActiveType(null)}>All</button>
          {ALL_TYPES.map(t => {
            const meta = TYPE_META[t];
            return (
              <button key={t} className={`fridge-type-chip ${activeType === t ? 'fridge-type-chip--active' : ''}`} onClick={() => setActiveType(prev => prev === t ? null : t)}>
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fridge-ingredient-grid">
        {Object.keys(grouped).length === 0 && (
          <p className="picker__empty">{search ? 'No ingredients match your search.' : 'No ingredients found.'}</p>
        )}
        {ALL_TYPES.concat(['other']).filter(t => grouped[t]?.length > 0).map(t => {
          const meta = TYPE_META[t] || { label: 'Other', emoji: '📦' };
          return (
            <div key={t} className="fridge-type-group">
              <h3 className="fridge-type-group__title">{meta.emoji} {meta.label}</h3>
              <div className="fridge-chip-grid">
                {grouped[t].map(ing => {
                  const lower = ing.name.toLowerCase();
                  const selected = allSelected.has(lower);
                  return (
                    <div key={ing.name} className="fridge-chip-wrap">
                      <button
                        className={`fridge-chip ${selected ? 'fridge-chip--selected' : ''}`}
                        onClick={() => toggle(ing.name, ing.type)}
                      >
                        {selected && <span className="fridge-chip__check">✓</span>}
                        {ing.name}
                      </button>
                      <button className="fridge-chip__type-btn" onClick={() => setRenamingIng(renamingIng === ing.name ? null : ing.name)} title="Change category">⋮</button>
                      {renamingIng === ing.name && (
                        <div className="fridge-chip__type-picker">
                          {ALL_TYPES.map(nt => (
                            <button key={nt} className={`fridge-chip__type-option ${ing.type === nt ? 'fridge-chip__type-option--active' : ''}`} onClick={() => overrideType(ing.name, nt)}>
                              {TYPE_META[nt].emoji} {TYPE_META[nt].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
};

// ─── Settings Tab ────────────────────────────────────────────────────────────
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Low Carb'];

const SettingsTab = ({ units, setUnits, dietaryFilters, setDietaryFilters }) => {
  const toggleDiet = (d) => setDietaryFilters(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  return (
    <main className="view">
      <h2 className="settings-title">Settings</h2>
      <div className="settings-section">
        <h3 className="settings-section__title">🔢 Units</h3>
        <p className="settings-section__hint">Choose your preferred measurement system</p>
        <div className="settings-toggle-row">
          <button className={`settings-toggle ${units === 'metric' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('metric')}>Metric <span className="settings-toggle__sub">g, ml, °C</span></button>
          <button className={`settings-toggle ${units === 'imperial' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('imperial')}>Imperial <span className="settings-toggle__sub">oz, fl oz, °F</span></button>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-section__title">🥗 Dietary Filters</h3>
        <p className="settings-section__hint">Hide recipes that don't match your diet</p>
        <div className="chip-grid">
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
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  return (
    <main className="view">
      <div className="grocery-header">
        <h2 className="grocery-title">Grocery List</h2>
        <p className="grocery-subtitle">Select recipes to build your shopping list</p>
      </div>

      <div className="grocery-recipe-picker">
        {recipes.map(r => {
          const m = matchById?.get(r.id);
          return (
            <button key={r.id} className={`grocery-recipe-chip ${selectedIds.includes(r.id) ? 'grocery-recipe-chip--selected' : ''}`} onClick={() => toggleRecipe(r.id)}>
              {selectedIds.includes(r.id) && <span>✓ </span>}
              {r.name}
              {m?.canMake && <span className="grocery-recipe-chip__ready"> · Ready</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="error-msg">{error}</p>}
      {loading && <p style={{ padding: '20px 0', color: 'var(--warm-gray)' }}>Building list…</p>}

      {categories.length > 0 && (
        <div>
          <div className="grocery-list-header">
            <h3>{recipeNames.join(', ')}</h3>
            <button className="btn btn--ghost btn--sm" onClick={copyList}>Copy list</button>
          </div>
          <div className="grocery-categories">
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
        </div>
      )}
    </main>
  );
};

// ─── Main App ───────────────────────────────────────────────────────────────
function AppInner() {
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
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [activeProgress, setActiveProgress] = useState(null);
  const [activeCuisine, setActiveCuisine] = useState('');
  const [heartedIds, setHeartedIds] = useState(() => LS.get('heartedIds', []));
  const [libraryPage, setLibraryPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => { LS.set('heartedIds', heartedIds); }, [heartedIds]);
  const toggleHeart = (id) => setHeartedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
      setAllIngredients(ingredients.sort((a, b) => a.name.localeCompare(b.name)));
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

  // Reset to page 1 when filters change
  useEffect(() => { setLibraryPage(1); }, [librarySearch, activeTag, activeProgress, activeCuisine]);

  const clearAllFilters = () => { setLibrarySearch(''); setActiveTag(null); setActiveProgress(null); setActiveCuisine(''); };
  const hasActiveFilters = librarySearch || activeTag || activeProgress || activeCuisine;

  const libraryRecipes = useMemo(() => {
    let list = recipes;
    const q = librarySearch.toLowerCase().trim();
    if (q) list = list.filter(r => r.name.toLowerCase().includes(q));

    // Cuisine filter
    if (activeCuisine) {
      // Match cuisine chip key against the recipe's cuisine field (case-insensitive, partial for 'Asian')
      if (activeCuisine === 'Asian') {
        const ASIAN = ['chinese','japanese','korean','thai','vietnamese','asian','malaysian','indonesian','filipino'];
        list = list.filter(r => ASIAN.some(a => (r.cuisine || '').toLowerCase().includes(a)));
      } else {
        list = list.filter(r => (r.cuisine || '').toLowerCase() === activeCuisine.toLowerCase());
      }
    }

    // Tag filter — tags array only, not cuisine column
    if (activeTag) {
      list = list.filter(r =>
        (r.tags || []).some(t => t.toLowerCase() === activeTag.toLowerCase())
      );
    }

    // Progress filter — all based on status string now
    if (activeProgress === '__incomplete') {
      list = list.filter(r => (r.status || '').toLowerCase() === 'incomplete');
    } else if (activeProgress === '__needstweaking') {
      list = list.filter(r => (r.status || '').toLowerCase().includes('tweak'));
    } else if (activeProgress === '__favorite') {
      list = list.filter(r => (r.status || '').toLowerCase() === 'favorite');
    } else if (activeProgress === '__complete') {
      // Complete = status is not incomplete, needs tweaking, or favorite
      const s = (r) => (r.status || '').toLowerCase();
      list = list.filter(r =>
        s(r) !== 'incomplete' &&
        !s(r).includes('tweak') &&
        s(r) !== 'favorite'
      );
    }

    return list;
  }, [recipes, librarySearch, activeTag, activeProgress, activeCuisine, matchById]);

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

      {view === 'recipe' && (
        <RecipePage
          recipe={selectedRecipe}
          bodyIngredients={recipeBodyIngredients}
          instructions={recipeInstructions}
          notes={recipeNotes}
          loading={recipeLoading}
          onBack={() => setView(lastView)}
          isHearted={selectedRecipe ? heartedIds.includes(selectedRecipe.id) : false}
          onToggleHeart={() => selectedRecipe && toggleHeart(selectedRecipe.id)}
          allIngredients={allIngredients.map(i => typeof i === 'string' ? i : i.name).filter(Boolean)}
          onReload={async () => {
            if (!selectedRecipe) return;
            try {
              const res = await fetch(`${API}/api/recipes/${selectedRecipe.id}`);
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
        <main className="view home-view">
          <div className="home-main">

            {/* ── Make Soon — always visible ── */}
            <div className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">♥ Make Soon</h2>
                {heartedIds.length > 0 && (
                  <button className="btn btn--ghost btn--sm" onClick={() => setHeartedIds([])}>Clear all</button>
                )}
              </div>
              {heartedIds.length === 0 ? (
                <div className="home-empty-cta" onClick={() => setView('recipes')}>
                  <span className="home-empty-cta__icon">♥</span>
                  <div>
                    <p className="home-empty-cta__title">No recipes saved yet</p>
                    <p className="home-empty-cta__sub">Browse recipes and tap ♥ to add them here for quick access</p>
                  </div>
                  <span className="home-empty-cta__arrow">→</span>
                </div>
              ) : (
                <div className="recipe-grid">
                  {recipes.filter(r => heartedIds.includes(r.id)).map(r => (
                    <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                      isHearted={true} onToggleHeart={() => toggleHeart(r.id)} />
                  ))}
                </div>
              )}
            </div>

            {/* ── What can I make ── */}
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
              ) : (() => {
                const goodMatches = matches.filter(m => m.matchScore > 0).slice(0, 6);
                return goodMatches.length > 0 ? (
                  <div className="recipe-grid">
                    {goodMatches.map(m => {
                      const r = recipes.find(x => x.id === m.id);
                      if (!r) return null;
                      return <RecipeCard key={r.id} recipe={r} match={m} onClick={openRecipe}
                        isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)} />;
                    })}
                  </div>
                ) : <p className="home-no-matches">No matches yet — try adding more ingredients in the Fridge tab.</p>;
              })()}
            </div>
          </div>

          {/* Right column: Insights + Quick Actions */}
          <aside className="home-sidebar">
            <div className="insights-card">
              <h3 className="insights-title">Recipe Insights</h3>
              <div className="insights-grid">
                <div className="insight-item insight-item--blue">
                  <span className="insight-item__number">{recipes.length}</span>
                  <span className="insight-item__label">Total recipes</span>
                  <span className="insight-item__icon">📚</span>
                </div>
                <div className="insight-item insight-item--green">
                  <span className="insight-item__number">{matches.filter(m => m.canMake).length}</span>
                  <span className="insight-item__label">Ready to cook</span>
                  <span className="insight-item__icon">✅</span>
                </div>
                <div className="insight-item insight-item--amber">
                  <span className="insight-item__number">{matches.filter(m => m.matchScore >= 0.7 && !m.canMake).length}</span>
                  <span className="insight-item__label">Almost ready</span>
                  <span className="insight-item__icon">🔥</span>
                </div>
                <div className="insight-item insight-item--purple">
                  <span className="insight-item__number">
                    {recipes.filter(r => {
                      const t = (r.time || '').toLowerCase();
                      const m = t.match(/(\d+)/);
                      return m && parseInt(m[1]) <= 30;
                    }).length}
                  </span>
                  <span className="insight-item__label">Under 30 min</span>
                  <span className="insight-item__icon">⏱</span>
                </div>
              </div>
            </div>

            <div className="quick-actions-card">
              <h3 className="insights-title">Quick Actions</h3>
              <div className="quick-actions-list">
                <button className="quick-action" onClick={() => setView('recipes')}>
                  <span className="quick-action__icon">📖</span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Browse all recipes</span>
                    <span className="quick-action__sub">{recipes.length} in your library</span>
                  </div>
                  <span className="quick-action__arrow">→</span>
                </button>
                <button className="quick-action" onClick={() => setView('fridge')}>
                  <span className="quick-action__icon">🧊</span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Update my fridge</span>
                    <span className="quick-action__sub">{fridgeIngredients.length + pantryStaples.length} ingredients tracked</span>
                  </div>
                  <span className="quick-action__arrow">→</span>
                </button>
                <button className="quick-action" onClick={() => setView('grocery')}>
                  <span className="quick-action__icon">🛒</span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Build grocery list</span>
                    <span className="quick-action__sub">Plan your weekly shop</span>
                  </div>
                  <span className="quick-action__arrow">→</span>
                </button>
                {matches.filter(m => m.canMake).length > 0 && (
                  <button className="quick-action quick-action--highlight" onClick={() => { clearAllFilters(); setView('recipes'); }}>
                    <span className="quick-action__icon">🎯</span>
                    <div className="quick-action__text">
                      <span className="quick-action__label">Cook something now</span>
                      <span className="quick-action__sub">{matches.filter(m => m.canMake).length} recipes you can make</span>
                    </div>
                    <span className="quick-action__arrow">→</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </main>
      )}

      {view === 'recipes' && (() => {
        return (
          <main className="view">
            <div className="library-header">
              <h2>All Recipes</h2>
              <p className="library-subtitle">{libraryRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
            </div>

            {/* ── Search + Filter Toggle ── */}
            <div className="recipes-search-row">
              <div className="filter-bar__search-wrap filter-bar__search-wrap--standalone">
                <span className="filter-bar__search-icon">🔍</span>
                <input
                  className="filter-bar__search"
                  type="search"
                  placeholder="Search recipes…"
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                />
                {librarySearch && (
                  <button className="filter-bar__clear-x" onClick={() => setLibrarySearch('')}>✕</button>
                )}
              </div>
              <button
                className={`filters-toggle-btn ${filtersOpen ? 'filters-toggle-btn--open' : ''} ${hasActiveFilters ? 'filters-toggle-btn--active' : ''}`}
                onClick={() => setFiltersOpen(o => !o)}
              >
                🔧 Filters {hasActiveFilters ? '·' : ''}
                <span className="filters-toggle-btn__arrow">{filtersOpen ? '▴' : '▾'}</span>
              </button>
              {hasActiveFilters && (
                <button className="filter-bar__reset" onClick={clearAllFilters}>✕ Clear</button>
              )}
            </div>

            {/* ── Filter Panel — collapses on mobile ── */}
            {filtersOpen && (
              <div className="filter-panel">
                {/* Tags */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Tags</span>
                  <div className="filter-panel__chips">
                    {TAG_FILTERS.map(({ key, label }) => (
                      <button
                        key={key}
                        className={`filter-bar__chip ${activeTag === key ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => { setActiveTag(prev => prev === key ? null : key); }}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* Progress */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Progress</span>
                  <div className="filter-panel__chips">
                    {PROGRESS_FILTERS.map(({ key, label }) => (
                      <button
                        key={key}
                        className={`filter-bar__chip ${activeProgress === key ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => { setActiveProgress(prev => prev === key ? null : key); }}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* Cuisine */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Cuisine</span>
                  <div className="filter-panel__chips">
                    {CUISINE_FILTERS.map(({ key, label }) => (
                      <button
                        key={key}
                        className={`filter-bar__chip ${activeCuisine === key ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => setActiveCuisine(prev => prev === key ? '' : key)}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Active filter summary pills */}
            {hasActiveFilters && (
              <div className="active-filter-pills">
                {activeTag && <span className="active-filter-pill">{TAG_FILTERS.find(f => f.key === activeTag)?.label} <button onClick={() => setActiveTag(null)}>✕</button></span>}
                {activeProgress && <span className="active-filter-pill">{PROGRESS_FILTERS.find(f => f.key === activeProgress)?.label} <button onClick={() => setActiveProgress(null)}>✕</button></span>}
                {activeCuisine && <span className="active-filter-pill">{CUISINE_FILTERS.find(f => f.key === activeCuisine)?.label || activeCuisine} <button onClick={() => setActiveCuisine('')}>✕</button></span>}
              </div>
            )}

            {(() => {
              const PAGE_SIZE = 20;
              const totalPages = Math.max(1, Math.ceil(libraryRecipes.length / PAGE_SIZE));
              const safePage = Math.min(libraryPage, totalPages);
              const pageRecipes = libraryRecipes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
              return (
                <>
                  <div className="recipe-grid">
                    {pageRecipes.map(r => (
                      <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                        isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)} />
                    ))}
                    {libraryRecipes.length === 0 && (
                      <div className="results-empty">
                        <p>No recipes match your filters.</p>
                        <button className="btn btn--ghost" onClick={clearAllFilters}>Show all</button>
                      </div>
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="pager">
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>← Prev</button>
                      <div className="pager__pages">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button key={p} className={`pager__num ${p === safePage ? 'pager__num--active' : ''}`} onClick={() => setLibraryPage(p)}>{p}</button>
                        ))}
                      </div>
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>Next →</button>
                    </div>
                  )}
                </>
              );
            })()}
          </main>
        );
      })()}

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

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}