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
];

// ── Progress filters — based on DB columns (recipe_incomplete, status)
const PROGRESS_FILTERS = [
  { key: '__incomplete',    label: '🚧 Incomplete'      },
  { key: '__needstweaking', label: '🔧 Needs Tweaking'  },
  { key: '__favorite',      label: '⭐ Favorite'         },
  { key: '__complete',      label: '✅ Complete'         },
];

const QUICK_CHIP_KEYS = new Set(TAG_FILTERS.map(f => f.key));

const GEO_CUISINES = [
  'Asian', 'Indian', 'Italian', 'Mediterranean', 'Mexican', 'Middle Eastern', 'American', 'French', 'Japanese', 'Thai',
].sort();

const CUISINE_EMOJI = {
  'Asian': '🥢', 'Indian': '🍛', 'Italian': '🍝', 'Mediterranean': '🫒',
  'Mexican': '🌮', 'Middle Eastern': '🥙', 'American': '🍔', 'French': '🥐',
  'Japanese': '🍱', 'Thai': '🍜',
};

const ALL_CUISINES = [
  ...GEO_CUISINES,
  'Dessert', 'Drinks', 'Marinade', 'Party', 'Pasta', 'Soup',
].sort();

// ─── Helpers ───────────────────────────────────────────────────────────────
const pct = (score) => Math.round(score * 100);
const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

// ─── Recipe Summary Card ───────────────────────────────────────────────────
const toNum = (v) => { const n = Number(v); return (!isNaN(n) && v !== '' && v !== null && v !== undefined) ? n : null; };

const RecipeCard = ({ recipe, match, onClick, isHearted, onToggleHeart, isMakeSoon, onToggleMakeSoon }) => {
  const { name, coverImage, cuisine, time } = recipe;
  const calories = toNum(recipe.calories);
  const protein  = toNum(recipe.protein);
  const matchScore = match?.matchScore ?? null;
  const canMakeNow = Boolean(match?.canMake);
  const tags = recipe.tags || [];
  const progress = recipe.recipe_incomplete ? '🚧' : recipe.status === 'needs tweaking' ? '🔧' : recipe.status === 'complete' ? '✅' : null;

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
            title={isHearted ? 'Remove from Favorites' : 'Add to Favorites'}
          >{isHearted ? '♥' : '♡'}</button>
        )}
        <button
          className={`recipe-card__soon ${isMakeSoon ? 'recipe-card__soon--on' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
          title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
        >⏱</button>
      </div>
      <div className="recipe-card__body">
        <div className="recipe-card__title-row">
          <h3 className="recipe-card__title">{name}</h3>
          {cuisine && <span className="recipe-card__cuisine-tag">{cuisine}</span>}
        </div>
        <div className="recipe-card__stats">
          {time && <span className="recipe-card__stat"><span className="recipe-card__stat-icon">⏱</span>{time}</span>}
          {calories !== null && <span className="recipe-card__stat"><span className="recipe-card__stat-icon">🔥</span>{Math.round(calories)} kcal</span>}
          {protein !== null && <span className="recipe-card__stat"><span className="recipe-card__stat-icon">💪</span>{Math.round(protein)}g</span>}
          {canMakeNow && <span className="recipe-card__can-make">✓ Ready</span>}
          {progress && <span className="recipe-card__progress">{progress}</span>}
        </div>
      </div>
    </article>
  );
};

// ─── Section Pencil (inline edit trigger / confirm / cancel) ───────────────
const SectionPencil = ({ isEditing, onEdit, onSave, onCancel, saving }) => (
  <span className="section-pencil-wrap">
    {isEditing ? (
      <>
        <button className="section-pencil section-pencil--confirm" onClick={onSave} disabled={saving} title={saving ? 'Saving…' : 'Save'}>
          {saving ? '…' : '✓'}
        </button>
        <button className="section-pencil section-pencil--cancel" onClick={onCancel} title="Cancel">✕</button>
      </>
    ) : (
      <button className="section-pencil" onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit">✎</button>
    )}
  </span>
);

// ─── Recipe Page ────────────────────────────────────────────────────────────
const RecipePage = ({ recipe, bodyIngredients, instructions, notes, onBack, onSaved, loading, isHearted, onToggleHeart, isMakeSoon, onToggleMakeSoon }) => {
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [doneSteps, setDoneSteps] = useState(new Set());

  // ── Per-section edit state ──
  const [editingSection, setEditingSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // ── Draft state ──
  const [draftName, setDraftName] = useState('');
  const [draftImageInput, setDraftImageInput] = useState('');
  const [draftIngs, setDraftIngs] = useState([]);
  const [draftSteps, setDraftSteps] = useState([]);
  const [draftNotes, setDraftNotes] = useState([]);
  const [draftMeta, setDraftMeta] = useState({});

  const isEdit = (s) => editingSection === s;

  const startEdit = (section) => {
    setSaveError(null);
    if (section === 'title')        setDraftName(recipe.name || '');
    if (section === 'image')        setDraftImageInput(recipe.coverImage || '');
    if (section === 'ingredients')  setDraftIngs((bodyIngredients || []).map((i, idx) => ({ ...i, _id: `ing-${idx}` })));
    if (section === 'instructions') setDraftSteps((instructions || []).map((s, idx) => ({ ...s, _id: `step-${idx}` })));
    if (section === 'notes')        setDraftNotes((notes || []).map((n, idx) => ({ ...n, _id: `note-${idx}`, text: n.text ?? n.body_text ?? '' })));
    if (['meta','meta-cuisine','meta-tags','meta-progress','meta-time','meta-servings'].includes(section)) setDraftMeta({
      time: recipe.time || '',
      servings: recipe.servings || '',
      cuisine: recipe.cuisine || '',
      tags: recipe.tags || [],
      status: recipe.status || '',
      recipe_incomplete: recipe.recipe_incomplete || false,
    });
    setEditingSection(section);
  };

  const cancelEdit = () => { setEditingSection(null); setSaveError(null); };

  const saveSection = async (section) => {
    setSaving(true); setSaveError(null);
    const isMeta = section === 'meta' || section.startsWith('meta-');
    try {
      const payload = {
        details: {
          name:            section === 'title' ? draftName : recipe.name,
          cuisine:         isMeta ? draftMeta.cuisine : (recipe.cuisine || ''),
          time:            isMeta ? draftMeta.time    : (recipe.time || ''),
          servings:        isMeta ? draftMeta.servings : (recipe.servings || ''),
          calories:        recipe.calories ?? '',
          protein:         recipe.protein ?? '',
          cover_image_url: section === 'image' ? draftImageInput : (recipe.coverImage || ''),
          status:          isMeta ? draftMeta.status : (recipe.status || ''),
          recipe_incomplete: isMeta ? draftMeta.recipe_incomplete : (recipe.recipe_incomplete || false),
          tags:            isMeta ? draftMeta.tags   : (recipe.tags || []),
        },
        ingredients:  section === 'ingredients'  ? draftIngs.map((i, idx) => ({ ...i, order_index: idx }))  : (bodyIngredients || []),
        instructions: section === 'instructions' ? draftSteps.map((s, idx) => ({ ...s, step_number: idx + 1 })) : (instructions || []),
        notes:        section === 'notes'        ? draftNotes.map((n, idx) => ({ ...n, order_index: idx }))  : (notes || []),
      };
      const res = await fetch(`${API}/api/recipes/${recipe.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setEditingSection(null);
      if (onSaved) onSaved(data.recipe);
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  // ── Meta draft helpers ──
  const toggleDraftTag = (tag) => setDraftMeta(prev => ({
    ...prev,
    tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  // ── Ingredient draft helpers ──
  const addDraftIng  = () => setDraftIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateDraftIng = (id, k, v) => setDraftIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeDraftIng = (id) => setDraftIngs(prev => prev.filter(i => i._id !== id));

  // ── Step draft helpers ──
  const addDraftStep    = () => setDraftSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '' }]);
  const updateDraftStep = (id, v) => setDraftSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeDraftStep = (id) => setDraftSteps(prev => prev.filter(s => s._id !== id));

  // ── Note draft helpers ──
  const addDraftNote    = () => setDraftNotes(prev => [...prev, { _id: `note-new-${Date.now()}`, text: '' }]);
  const updateDraftNote = (id, v) => setDraftNotes(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeDraftNote = (id) => setDraftNotes(prev => prev.filter(n => n._id !== id));

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
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const toggleStep = (num) => setDoneSteps(prev => {
    const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next;
  });

  if (loading) return <main className="view"><div className="placeholder"><h2>Loading recipe…</h2></div></main>;
  if (!recipe) return <main className="view"><div className="placeholder"><h2>Recipe not found</h2><button className="btn btn--ghost" onClick={onBack}>← Back</button></div></main>;

  const calories   = toNum(recipe.calories);
  const protein    = toNum(recipe.protein);
  const fiber      = toNum(recipe.fiber);
  const doneCount  = doneSteps.size;
  const totalSteps = instructions?.length ?? 0;

  return (
    <main className="view rp2">
      {saveError && <p className="editor-error" style={{ margin: '8px 20px 0' }}>⚠️ {saveError}</p>}

      {/* ── Hero ── */}
      <div className="rp2__hero">
        {recipe.coverImage
          ? <img className="rp2__hero-img" src={recipe.coverImage} alt={recipe.name} />
          : <div className="rp2__hero-placeholder"><span>🍽</span></div>}

        <div className="rp2__hero-overlay">
          {/* ── Top bar ── */}
          <div className="rp2__hero-topbar">
            <button className="rp2__hero-btn" onClick={e => { e.stopPropagation(); onBack(); }}>← Back</button>
            <div className="rp2__hero-topbar-right">
              {onToggleHeart && (
                <button
                  className={`rp2__hero-btn rp2__hero-heart ${isHearted ? 'rp2__hero-heart--on' : ''}`}
                  onClick={e => { e.stopPropagation(); onToggleHeart(); }}
                  title={isHearted ? 'Remove from favorites' : 'Save to favorites'}
                >{isHearted ? '♥' : '♡'}</button>
              )}
              <button
                className={`rp2__hero-btn rp2__hero-soon ${isMakeSoon ? 'rp2__hero-soon--on' : ''}`}
                onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
                title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
              >⏱</button>
              {/* Change photo — popover opens DOWNWARD from topbar */}
              <div className="rp2__photo-btn-wrap">
                <button className="rp2__hero-btn" onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }}>
                  {isEdit('image') ? '✕ Cancel' : 'Change photo'}
                </button>
                {isEdit('image') && (
                  <div className="rp2__img-popover-down">
                    <p className="rp2__meta-pop-label">Cover image URL</p>
                    <input
                      className="editor-input"
                      autoFocus
                      value={draftImageInput}
                      onChange={e => setDraftImageInput(e.target.value)}
                      placeholder="https://…"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }}
                    />
                    <div className="rp2__meta-popover-actions">
                      <button className="rp2__meta-save-btn" onClick={() => saveSection('image')} disabled={saving}>{saving ? '…' : '✓ Save'}</button>
                      <button className="rp2__meta-cancel-btn" onClick={cancelEdit}>✕ Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom: tags (left, each clickable) + pills (right, time/servings clickable) ── */}
          <div className="rp2__hero-bottom">

            {/* Tags area — each item is individually clickable */}
            <div className="rp2__hero-tags">

              {/* Cuisine chip */}
              <div className="rp2__hero-tag-wrap">
                <button className={`rp2__tag rp2__tag--clickable ${isEdit('meta-cuisine') ? 'rp2__tag--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-cuisine') ? null : 'meta-cuisine'); }}>
                  {recipe.cuisine || <span style={{opacity:0.7}}>+ Cuisine</span>}
                </button>
                {isEdit('meta-cuisine') && (
                  <div className="rp2__hero-dark-popover">
                    <p className="rp2__dark-pop-label">🌍 Cuisine</p>
                    <div className="rp2__dark-pop-chips">
                      <button className={`rp2__dark-chip ${draftMeta.cuisine === '' ? 'rp2__dark-chip--on' : ''}`}
                        onClick={() => setDraftMeta(p => ({...p, cuisine: ''}))}>None</button>
                      {GEO_CUISINES.map(c => (
                        <button key={c} className={`rp2__dark-chip ${draftMeta.cuisine === c ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => setDraftMeta(p => ({...p, cuisine: c}))}>{c}</button>
                      ))}
                    </div>
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '…' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags chips */}
              <div className="rp2__hero-tag-wrap">
                <button className={`rp2__tag rp2__tag--light rp2__tag--clickable ${isEdit('meta-tags') ? 'rp2__tag--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-tags') ? null : 'meta-tags'); }}>
                  {(recipe.tags || []).length > 0 ? (recipe.tags || []).join(', ') : <span style={{opacity:0.7}}>+ Tags</span>}
                </button>
                {isEdit('meta-tags') && (
                  <div className="rp2__hero-dark-popover">
                    <p className="rp2__dark-pop-label">🏷 Tags</p>
                    <div className="rp2__dark-pop-chips">
                      {TAG_FILTERS.map(({ key, label }) => (
                        <button key={key} className={`rp2__dark-chip ${(draftMeta.tags || []).includes(key) ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => toggleDraftTag(key)}>{label}</button>
                      ))}
                    </div>
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '…' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress chip */}
              <div className="rp2__hero-tag-wrap">
                <button className={`rp2__tag rp2__tag--clickable ${recipe.recipe_incomplete ? 'rp2__tag--warning' : recipe.status === 'needs tweaking' ? 'rp2__tag--warning' : recipe.status === 'complete' ? 'rp2__tag--success' : 'rp2__tag--light'} ${isEdit('meta-progress') ? 'rp2__tag--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-progress') ? null : 'meta-progress'); }}>
                  {recipe.recipe_incomplete ? '🚧 Incomplete' : recipe.status === 'needs tweaking' ? '🔧 Tweaking' : recipe.status === 'complete' ? '✅ Complete' : <span style={{opacity:0.7}}>+ Progress</span>}
                </button>
                {isEdit('meta-progress') && (
                  <div className="rp2__hero-dark-popover">
                    <p className="rp2__dark-pop-label">📋 Progress</p>
                    <div className="rp2__dark-pop-chips">
                      {[{key:'',label:'— None'},{key:'complete',label:'✅ Complete'},{key:'needs tweaking',label:'🔧 Needs Tweaking'}].map(({key,label}) => (
                        <button key={key} className={`rp2__dark-chip ${draftMeta.status === key && !draftMeta.recipe_incomplete ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => setDraftMeta(p => ({...p, status: key, recipe_incomplete: false}))}>{label}</button>
                      ))}
                      <button className={`rp2__dark-chip ${draftMeta.recipe_incomplete ? 'rp2__dark-chip--on' : ''}`}
                        onClick={() => setDraftMeta(p => ({...p, recipe_incomplete: !p.recipe_incomplete, status: ''}))}>🚧 Incomplete</button>
                    </div>
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '…' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pills — time and servings are clickable, nutrition is display-only */}
            <div className="rp2__hero-pills">

              {/* Time pill */}
              <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-time') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-time') ? null : 'meta-time'); }}>
                  <span className="rp2__pill-icon">⏱</span>
                  {recipe.time || <span style={{opacity:0.6}}>+ Time</span>}
                </button>
                {isEdit('meta-time') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label">⏱ Cook Time</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.time}
                      onChange={e => setDraftMeta(p => ({...p, time: e.target.value}))}
                      placeholder="e.g. 45 mins"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '…' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Servings pill */}
              <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-servings') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-servings') ? null : 'meta-servings'); }}>
                  <span className="rp2__pill-icon">🍽</span>
                  {recipe.servings ? `${recipe.servings} srv` : <span style={{opacity:0.6}}>+ Servings</span>}
                </button>
                {isEdit('meta-servings') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label">🍽 Servings</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.servings}
                      onChange={e => setDraftMeta(p => ({...p, servings: e.target.value}))}
                      placeholder="e.g. 4"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '…' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Display-only nutrition pills */}
              {calories !== null && <span className="rp2__pill"><span className="rp2__pill-icon">🔥</span>{Math.round(calories)} kcal</span>}
              {protein  !== null && <span className="rp2__pill"><span className="rp2__pill-icon">💪</span>{Math.round(protein)}g prot</span>}
              {fiber    !== null && <span className="rp2__pill"><span className="rp2__pill-icon">🌿</span>{Math.round(fiber)}g fiber</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Title ── */}
      <div className="rp2__header">
        <div className="rp2__title-row">
          {isEdit('title') ? (
            <input
              className="rp2__title-input"
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveSection('title'); if (e.key === 'Escape') cancelEdit(); }}
            />
          ) : (
            <h1 className="rp2__title">{recipe.name}</h1>
          )}
          <SectionPencil isEditing={isEdit('title')} onEdit={() => startEdit('title')} onSave={() => saveSection('title')} onCancel={cancelEdit} saving={saving} />
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="rp2__body">

        {/* ── Ingredients ── */}
        <div className="rp2__ingredients">
          <div className="rp2__section-title-row">
            <h2 className="rp2__section-title">Ingredients</h2>
            <SectionPencil isEditing={isEdit('ingredients')} onEdit={() => startEdit('ingredients')} onSave={() => saveSection('ingredients')} onCancel={cancelEdit} saving={saving} />
          </div>

          {isEdit('ingredients') ? (
            <div className="rp2__ing-editor">
              {draftIngs.map((ing) => (
                <div key={ing._id} className="rp2__ing-edit-card">
                  <div className="rp2__ing-edit-row1">
                    <input className="editor-input editor-input--sm" value={ing.amount} onChange={e => updateDraftIng(ing._id, 'amount', e.target.value)} placeholder="Qty" />
                    <UnitAutocomplete value={ing.unit} onChange={v => updateDraftIng(ing._id, 'unit', v)} />
                    <IngredientAutocomplete value={ing.name} onChange={v => updateDraftIng(ing._id, 'name', v)} allIngredients={[]} />
                    <button className="editor-remove-btn" onClick={() => removeDraftIng(ing._id)} title="Remove">✕</button>
                  </div>
                  <div className="rp2__ing-edit-row2">
                    <input className="editor-input" style={{flex:1}} value={ing.group_label || ''} onChange={e => updateDraftIng(ing._id, 'group_label', e.target.value)} placeholder="Group (e.g. Sauce)" />
                    <input className="editor-input" style={{flex:2}} value={ing.prep_note || ''} onChange={e => updateDraftIng(ing._id, 'prep_note', e.target.value)} placeholder="Prep note (e.g. finely chopped)" />
                    <button className={`editor-optional-btn ${ing.optional ? 'editor-optional-btn--on' : ''}`} onClick={() => updateDraftIng(ing._id, 'optional', !ing.optional)} title="Optional">{ing.optional ? '✓' : '○'}</button>
                  </div>
                </div>
              ))}
              <button className="btn btn--ghost editor-add-btn" onClick={addDraftIng}>+ Add Ingredient</button>
            </div>
          ) : (
            ingredientGroups.length > 0
              ? ingredientGroups.map(({ label, items }) => (
                  <div key={label || '__default'} className="rp2__ing-group">
                    {label && <p className="rp2__ing-group-label">{label}</p>}
                    <ul className="rp2__ing-list">
                      {items.map((ing, idx) => {
                        const key = `${label}-${idx}`;
                        const isChecked = checkedIngredients.has(key);
                        const amountStr = [ing.amount, ing.unit].filter(Boolean).join(' ');
                        return (
                          <li key={key} className={`rp2__ing-item ${isChecked ? 'rp2__ing-item--checked' : ''}`} onClick={() => toggleIngredient(key)}>
                            <div className={`rp2__ing-check ${isChecked ? 'rp2__ing-check--done' : ''}`}>{isChecked && '✓'}</div>
                            <div className="rp2__ing-text">
                              {amountStr && <span className="rp2__ing-amount">{amountStr}</span>}
                              <span className="rp2__ing-name">{ing.name}</span>
                              {ing.prep_note && <span className="rp2__ing-prep">{ing.prep_note}</span>}
                              {ing.optional && <span className="rp2__ing-optional">optional</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              : <p className="rp2__empty-hint">No ingredients yet.</p>
          )}
        </div>

        {/* ── Instructions ── */}
        <div className="rp2__instructions">
          <div className="rp2__section-title-row">
            <h2 className="rp2__section-title">Instructions</h2>
            {!isEdit('instructions') && totalSteps > 0 && (
              <span className="rp2__progress-label rp2__progress-label--right">{doneCount}/{totalSteps} steps</span>
            )}
            <SectionPencil isEditing={isEdit('instructions')} onEdit={() => startEdit('instructions')} onSave={() => saveSection('instructions')} onCancel={cancelEdit} saving={saving} />
          </div>

          {!isEdit('instructions') && totalSteps > 0 && (
            <div className="rp2__progress-bar">
              <div className="rp2__progress-fill" style={{ width: `${(doneCount / totalSteps) * 100}%` }} />
            </div>
          )}

          {isEdit('instructions') ? (
            <div className="rp2__inline-editor">
              {draftSteps.map((step, idx) => (
                <div key={step._id} className="rp2__ed-step-row">
                  <span className="editor-step-num">{idx + 1}</span>
                  <textarea className="editor-textarea" value={step.body_text} onChange={e => updateDraftStep(step._id, e.target.value)} placeholder="Describe this step…" rows={2} />
                  <button className="editor-remove-btn" onClick={() => removeDraftStep(step._id)}>✕</button>
                </div>
              ))}
              <button className="btn btn--ghost editor-add-btn" onClick={addDraftStep}>+ Add Step</button>
            </div>
          ) : (
            instructions?.length > 0
              ? <ol className="rp2__steps">
                  {[...instructions].sort((a, b) => a.step_number - b.step_number).map(step => {
                    const done = doneSteps.has(step.step_number);
                    return (
                      <li key={step.step_number} className={`rp2__step ${done ? 'rp2__step--done' : ''}`} onClick={() => toggleStep(step.step_number)}>
                        <div className="rp2__step-num">{done ? '✓' : step.step_number}</div>
                        <p className="rp2__step-body">{step.body_text}</p>
                      </li>
                    );
                  })}
                </ol>
              : <p className="rp2__empty-hint">No instructions yet.</p>
          )}

          {/* ── Notes — lives under instructions ── */}
          <div className="rp2__notes">
            <div className="rp2__section-title-row">
              <h2 className="rp2__section-title">Notes &amp; Tips</h2>
              <SectionPencil isEditing={isEdit('notes')} onEdit={() => startEdit('notes')} onSave={() => saveSection('notes')} onCancel={cancelEdit} saving={saving} />
            </div>

            {isEdit('notes') ? (
              <div className="rp2__inline-editor">
                {draftNotes.map(n => (
                  <div key={n._id} className="rp2__ed-note-row">
                    <input className="editor-input" style={{flex:1}} value={n.text} onChange={e => updateDraftNote(n._id, e.target.value)} placeholder="Add a tip or note…" />
                    <button className="editor-remove-btn" onClick={() => removeDraftNote(n._id)}>✕</button>
                  </div>
                ))}
                <button className="btn btn--ghost editor-add-btn" onClick={addDraftNote}>+ Add Note</button>
              </div>
            ) : (
              notes?.length > 0
                ? <ul className="rp2__notes-list">
                    {notes.map((n, i) => (
                      <li key={i} className="rp2__notes-item">{n.text ?? n.body_text ?? n}</li>
                    ))}
                  </ul>
                : <p className="rp2__empty-hint">No notes yet.</p>
            )}
          </div>
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
      <input className="editor-input" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="soy sauce" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((ing, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = ing.toLowerCase().indexOf(q);
            return (
              <li key={ing} className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`} onMouseDown={() => select(ing)} onMouseEnter={() => setHighlighted(i)}>
                {idx >= 0 ? (<>{ing.slice(0, idx)}<strong>{ing.slice(idx, idx + q.length)}</strong>{ing.slice(idx + q.length)}</>) : ing}
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
    return COMMON_UNITS.filter(u => u.toLowerCase().startsWith(q) || u.toLowerCase().includes(q)).slice(0, 8);
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
      <input className="editor-input editor-input--sm" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="tbsp" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((u, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = u.toLowerCase().indexOf(q);
            return (
              <li key={u} className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`} onMouseDown={() => select(u)} onMouseEnter={() => setHighlighted(i)}>
                {idx >= 0 && q ? (<>{u.slice(0, idx)}<strong>{u.slice(idx, idx + q.length)}</strong>{u.slice(idx + q.length)}</>) : u}
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
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };
  return (
    <div ref={setNodeRef} style={style} className="sortable-item">
      <div className="sortable-handle" {...attributes} {...listeners}>⠿</div>
      {children}
    </div>
  );
};

// ─── Recipe Editor ──────────────────────────────────────────────────────────
const RecipeEditor = ({ recipe, bodyIngredients, instructions, notes, allIngredients, onBack, onSaved }) => {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const [details, setDetails] = useState({
    name: recipe?.name || '',
    cuisine: recipe?.cuisine || '',
    time: recipe?.time || '',
    servings: recipe?.servings || '',
    calories: recipe?.calories ?? '',
    protein: recipe?.protein ?? '',
    cover_image_url: recipe?.coverImage || '',
  });

  const [ings, setIngs] = useState(() => (bodyIngredients || []).map((i, idx) => ({ ...i, _id: `ing-${idx}` })));
  const [steps, setSteps] = useState(() => (instructions || []).map((s, idx) => ({ ...s, _id: `step-${idx}` })));
  const [notesList, setNotesList] = useState(() => (notes || []).map((n, idx) => ({ ...n, _id: `note-${idx}` })));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));

  const addIng = () => setIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); });
    }
  };

  const addStep = () => setSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '' }]);
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); });
    }
  };

  const addNote = () => setNotesList(prev => [...prev, { _id: `note-new-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const save = async () => {
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const payload = {
        details,
        ingredients: ings.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: steps.map((s, idx) => ({ ...s, step_number: idx + 1 })),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      console.log('Saving payload:', JSON.stringify(payload, null, 2));
      const res = await fetch(`${API}/api/recipes/${recipe.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaveSuccess(true);
      if (onSaved) onSaved(data.recipe);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const groupLabels = [...new Set(ings.map(i => i.group_label).filter(Boolean))];

  return (
    <main className="view editor-page rp2">
      <div className="rp2__hero ed-hero">
        {details.cover_image_url ? <img className="rp2__hero-img" src={details.cover_image_url} alt={details.name} /> : <div className="rp2__hero-placeholder"><span>🍽</span></div>}
        <button className="ed-hero__img-btn" onClick={() => setShowImageInput(v => !v)} title="Change cover image">{details.cover_image_url ? '🖼 Change' : '➕ Add Photo'}</button>
        {showImageInput && (
          <div className="ed-hero__img-popover">
            <p className="ed-hero__img-popover-label">Cover image URL</p>
            <input className="editor-input" autoFocus value={details.cover_image_url} onChange={e => setDetail('cover_image_url', e.target.value)} placeholder="https://…" onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setShowImageInput(false); }} />
            <button className="btn btn--primary btn--sm" style={{marginTop:6}} onClick={() => setShowImageInput(false)}>Done</button>
          </div>
        )}
        <div className="rp2__hero-overlay">
          <div className="rp2__hero-topbar">
            <button className="rp2__hero-btn" onClick={onBack}>← Cancel</button>
            <button className="rp2__hero-btn rp2__hero-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : '✓ Save'}</button>
          </div>
          <div className="rp2__hero-bottom">
            <div className="rp2__hero-tags">{details.cuisine && <span className="rp2__tag">{details.cuisine}</span>}</div>
            <div className="rp2__hero-pills">
              {details.time && <span className="rp2__pill"><span className="rp2__pill-icon">⏱</span>{details.time}</span>}
              {details.servings && <span className="rp2__pill"><span className="rp2__pill-icon">🍽</span>{details.servings} srv</span>}
              {details.calories !== '' && toNum(details.calories) !== null && <span className="rp2__pill"><span className="rp2__pill-icon">🔥</span>{Math.round(toNum(details.calories))} kcal</span>}
              {details.protein !== '' && toNum(details.protein) !== null && <span className="rp2__pill"><span className="rp2__pill-icon">💪</span>{Math.round(toNum(details.protein))}g prot</span>}
            </div>
          </div>
        </div>
      </div>

      {saveError && <p className="editor-error" style={{margin:'8px 24px 0'}}>⚠️ {saveError}</p>}
      {saveSuccess && <p className="editor-success" style={{margin:'8px 24px 0'}}>✓ Saved successfully</p>}

      <div className="rp2__header ed-name-row">
        <input className="ed-title-input" value={details.name} onChange={e => setDetail('name', e.target.value)} placeholder="Recipe name…" />
      </div>

      <div className="ed-meta-row">
        <label className="ed-meta-field">
          <span className="ed-meta-label">🌍 Cuisine</span>
          <select className="editor-input editor-select ed-meta-input" value={details.cuisine} onChange={e => setDetail('cuisine', e.target.value)}>
            <option value="">— none —</option>
            {ALL_CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
            {[...QUICK_CHIP_KEYS].filter(k => !ALL_CUISINES.includes(k)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label">⏱ Time</span>
          <input className="editor-input ed-meta-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label">🍽 Servings</span>
          <input className="editor-input ed-meta-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label">🔥 Calories</span>
          <input className="editor-input ed-meta-input" type="number" value={details.calories} onChange={e => setDetail('calories', e.target.value)} placeholder="kcal" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label">💪 Protein</span>
          <input className="editor-input ed-meta-input" type="number" value={details.protein} onChange={e => setDetail('protein', e.target.value)} placeholder="g" />
        </label>
      </div>

      <section className="editor-section">
        <h3 className="editor-section__title">Ingredients</h3>
        <datalist id="group-labels">{groupLabels.map(l => <option key={l} value={l} />)}</datalist>
        <div className="editor-ing-header"><span>Amount</span><span>Unit</span><span>Name</span><span>Group</span><span>Prep note</span><span>Opt?</span><span></span></div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
          <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
            {ings.map(ing => (
              <SortableItem key={ing._id} id={ing._id}>
                <div className="editor-ing-row">
                  <input className="editor-input editor-input--sm" value={ing.amount} onChange={e => updateIng(ing._id, 'amount', e.target.value)} placeholder="2" />
                  <UnitAutocomplete value={ing.unit} onChange={v => updateIng(ing._id, 'unit', v)} />
                  <IngredientAutocomplete value={ing.name} onChange={v => updateIng(ing._id, 'name', v)} allIngredients={allIngredients.filter(Boolean)} />
                  <input className="editor-input editor-input--sm" value={ing.group_label || ''} onChange={e => updateIng(ing._id, 'group_label', e.target.value)} placeholder="e.g. Sauce" list="group-labels" />
                  <input className="editor-input" value={ing.prep_note || ''} onChange={e => updateIng(ing._id, 'prep_note', e.target.value)} placeholder="finely chopped" />
                  <button className={`editor-optional-btn ${ing.optional ? 'editor-optional-btn--on' : ''}`} onClick={() => updateIng(ing._id, 'optional', !ing.optional)} title="Mark as optional">{ing.optional ? '✓' : '○'}</button>
                  <button className="editor-remove-btn" onClick={() => removeIng(ing._id)}>✕</button>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn btn--ghost editor-add-btn" onClick={addIng}>+ Add Ingredient</button>
      </section>

      <section className="editor-section">
        <h3 className="editor-section__title">Instructions</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
          <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
            {steps.map((step, idx) => (
              <SortableItem key={step._id} id={step._id}>
                <div className="editor-step-row">
                  <span className="editor-step-num">{idx + 1}</span>
                  <textarea className="editor-textarea" value={step.body_text} onChange={e => updateStep(step._id, e.target.value)} placeholder="Describe this step…" rows={2} />
                  <button className="editor-remove-btn" onClick={() => removeStep(step._id)}>✕</button>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
      </section>

      <section className="editor-section">
        <h3 className="editor-section__title">Notes &amp; Modifications</h3>
        {notesList.map(note => (
          <div key={note._id} className="editor-note-row">
            <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Works great with tofu instead of chicken" />
            <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
          </div>
        ))}
        <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
      </section>

      <div className="editor-save-bar">
        {saveError && <p className="editor-error">⚠️ {saveError}</p>}
        {saveSuccess && <p className="editor-success">✓ Saved successfully</p>}
        <button className="btn btn--primary btn--large" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </main>
  );
};

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
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c) => { onChange(c === value ? '' : c); setOpen(false); setSearch(''); };
  const create = () => { if (!trimmed) return; onCreateNew(trimmed); onChange(trimmed); setOpen(false); setSearch(''); };
  const clear = (e) => { e.stopPropagation(); onChange(''); setSearch(''); };

  return (
    <div className="cuisine-dd" ref={wrapRef}>
      <button className={`cuisine-dd__trigger ${value ? 'cuisine-dd__trigger--active' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="cuisine-dd__globe">🌍</span>
        <span className="cuisine-dd__label">{value || 'Cuisine'}</span>
        {value ? <span className="cuisine-dd__x" onMouseDown={clear}>✕</span> : <span className={`cuisine-dd__arrow ${open ? 'cuisine-dd__arrow--open' : ''}`}>▾</span>}
      </button>
      {open && (
        <div className="cuisine-dd__panel">
          <input className="cuisine-dd__search" autoFocus placeholder="Search cuisines…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="cuisine-dd__list">
            {filtered.map(c => (
              <button key={c} className={`cuisine-dd__option ${value === c ? 'cuisine-dd__option--active' : ''}`} onMouseDown={() => select(c)}>
                <span className="cuisine-dd__check">{value === c ? '✓' : ''}</span>{c}
              </button>
            ))}
            {showCreate && (
              <button className="cuisine-dd__option cuisine-dd__option--create" onMouseDown={create}>
                <span className="cuisine-dd__create-icon">+</span>Create "{trimmed}"<span className="cuisine-dd__create-badge">new</span>
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
  produce:  { label: 'Produce',     emoji: '🥦', group: 'fridge'  },
  meat:     { label: 'Meat & Fish', emoji: '🥩', group: 'fridge'  },
  dairy:    { label: 'Dairy',       emoji: '🥛', group: 'fridge'  },
  sauce:    { label: 'Sauces',      emoji: '🫙', group: 'fridge'  },
  spice:    { label: 'Spices',      emoji: '🧂', group: 'pantry'  },
  alcohol:  { label: 'Alcohol',     emoji: '🍷', group: 'pantry'  },
  staple:   { label: 'Staples',     emoji: '🌾', group: 'pantry'  },
};

const FridgeTab = ({ allIngredients, fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples }) => {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState(null);
  const [typeOverrides, setTypeOverrides] = useState(() => LS.get('ingredientTypeOverrides', {}));
  const [renamingIng, setRenamingIng] = useState(null);

  useEffect(() => { LS.set('ingredientTypeOverrides', typeOverrides); }, [typeOverrides]);

  const allSelected = useMemo(() => new Set([...fridgeIngredients, ...pantryStaples]), [fridgeIngredients, pantryStaples]);
  const enriched = useMemo(() => allIngredients.map(i => ({ ...i, type: typeOverrides[i.name] ?? i.type })), [allIngredients, typeOverrides]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search.trim()) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    if (activeType) list = list.filter(i => i.type === activeType);
    return list;
  }, [enriched, search, activeType]);

  const grouped = useMemo(() => {
    const map = {};
    for (const ing of filtered) { const t = ing.type || 'other'; if (!map[t]) map[t] = []; map[t].push(ing); }
    return map;
  }, [filtered]);

  const toggle = (name, type) => {
    const lower = name.toLowerCase();
    const isFridgeType = ['produce', 'meat', 'dairy', 'sauce'].includes(type);
    if (isFridgeType) { setFridgeIngredients(prev => prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]); }
    else { setPantryStaples(prev => prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]); }
  };

  const overrideType = (name, newType) => {
    setTypeOverrides(prev => ({ ...prev, [name]: newType }));
    const lower = name.toLowerCase();
    const isFridgeType = ['produce', 'meat', 'dairy', 'sauce'].includes(newType);
    if (isFridgeType) { setPantryStaples(prev => prev.filter(i => i !== lower)); setFridgeIngredients(prev => prev.includes(lower) ? prev : [...prev, lower]); }
    else { setFridgeIngredients(prev => prev.filter(i => i !== lower)); setPantryStaples(prev => prev.includes(lower) ? prev : [...prev, lower]); }
    setRenamingIng(null);
  };

  return (
    <main className="view">
      <div className="fridge-header">
        <div>
          <h2 className="fridge-title">My Ingredients</h2>
          <p className="fridge-subtitle">{fridgeIngredients.length} fridge · {pantryStaples.length} pantry items tracked</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => { setFridgeIngredients([]); setPantryStaples([]); }}>Clear all</button>
      </div>

      <div className="fridge-filter-bar">
        <div className="fridge-filter-bar__search-wrap">
          <span className="fridge-filter-bar__icon">🔍</span>
          <input className="fridge-filter-bar__search" placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="fridge-filter-bar__clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="fridge-type-chips">
          <button className={`fridge-type-chip ${!activeType ? 'fridge-type-chip--active' : ''}`} onClick={() => setActiveType(null)}>All</button>
          {ALL_TYPES.map(t => (
            <button key={t} className={`fridge-type-chip ${activeType === t ? 'fridge-type-chip--active' : ''}`} onClick={() => setActiveType(prev => prev === t ? null : t)}>
              {TYPE_META[t].emoji} {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="fridge-groups">
        {Object.entries(grouped).map(([type, ings]) => (
          <div key={type} className="fridge-group">
            <h3 className="fridge-group__title">
              {TYPE_META[type]?.emoji ?? '?'} {TYPE_META[type]?.label ?? type}
              <span className="fridge-group__count">{ings.filter(i => allSelected.has(i.name.toLowerCase())).length}/{ings.length}</span>
            </h3>
            <div className="fridge-chips">
              {ings.map(ing => {
                const isOn = allSelected.has(ing.name.toLowerCase());
                return (
                  <div key={ing.name} className="fridge-chip-wrap">
                    <button className={`chip ${isOn ? 'chip--selected' : ''}`} onClick={() => toggle(ing.name, typeOverrides[ing.name] ?? ing.type)}>
                      {isOn && <span className="chip__check">✓</span>}{ing.name}
                    </button>
                    <button className="fridge-retype-btn" title="Change category" onClick={() => setRenamingIng(prev => prev === ing.name ? null : ing.name)}>
                      {TYPE_META[typeOverrides[ing.name] ?? ing.type]?.emoji ?? '?'}
                    </button>
                    {renamingIng === ing.name && (
                      <div className="fridge-type-picker">
                        <p className="fridge-type-picker__label">Move <strong>{ing.name}</strong> to:</p>
                        <div className="fridge-type-picker__options">
                          {ALL_TYPES.map(nt => (
                            <button key={nt} className={`fridge-type-picker__opt ${(typeOverrides[ing.name] ?? ing.type) === nt ? 'fridge-type-picker__opt--active' : ''}`} onClick={() => overrideType(ing.name, nt)}>
                              {TYPE_META[nt].emoji} {TYPE_META[nt].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
          <button className={`settings-toggle ${units === 'metric' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('metric')}>Metric <span className="settings-toggle__sub">g, ml, °C</span></button>
          <button className={`settings-toggle ${units === 'imperial' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('imperial')}>Imperial <span className="settings-toggle__sub">oz, cups, °F</span></button>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-section__title">🥗 Dietary Filters</h3>
        <p className="settings-section__hint">Active filters hide non-matching recipes across the whole app</p>
        <div className="picker__chips" style={{ marginTop: 10 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} className={`chip ${dietaryFilters.includes(d) ? 'chip--selected' : ''}`} onClick={() => toggleDiet(d)}>
              {dietaryFilters.includes(d) && <span className="chip__check">✓</span>}{d}
            </button>
          ))}
        </div>
        {dietaryFilters.length > 0 && <p className="settings-active-filters">Active: {dietaryFilters.join(', ')} — recipes without these tags will be hidden</p>}
      </div>
      <div className="settings-section">
        <h3 className="settings-section__title">ℹ️ About</h3>
        <p className="settings-section__hint">Hearth v1.0 · Postgres backend</p>
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

  const toggleRecipe = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleChecked = (key) => setChecked(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  useEffect(() => {
    if (!selectedIds.length) { setCategories([]); setRecipeNames([]); return; }
    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/grocery-list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeIds: selectedIds }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to build list');
        if (!cancelled) { setCategories(data.categories || []); setRecipeNames(data.recipeNames || []); setChecked(new Set()); }
      } catch (e) { if (!cancelled) setError(e.message); } finally { if (!cancelled) setLoading(false); }
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
          const m = matchById.get(r.id);
          const isSelected = selectedIds.includes(r.id);
          return (
            <button key={r.id} className={`grocery-recipe-chip ${isSelected ? 'grocery-recipe-chip--on' : ''}`} onClick={() => toggleRecipe(r.id)}>
              {isSelected && <span>✓ </span>}{r.name}{m?.canMake && <span className="grocery-recipe-chip__ready"> ✓</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="grocery-error">⚠️ {error}</p>}
      {loading && <div className="grocery-loading"><div className="loading-spinner" /><p>Building your list…</p></div>}
      {!loading && categories.length > 0 && (
        <div className="grocery-list">
          <div className="grocery-list-header">
            <p className="grocery-list-for">For: {recipeNames.join(', ')}</p>
            <button className="btn btn--ghost btn--sm" onClick={copyList}>📋 Copy list</button>
          </div>
          {categories.map(cat => (
            <div key={cat.name} className="grocery-category">
              <h3 className="grocery-category__title">{cat.emoji} {cat.name}</h3>
              <div className="grocery-items">
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
                        {item.recipes?.length > 1 && <span className="grocery-item__recipes">used in {item.recipes.join(', ')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

// ─── Site Footer ────────────────────────────────────────────────────────────
const GITHUB_REPO = 'kavyasomala/RecipeApp'; // update with actual repo path

const SiteFooter = ({ onNav }) => {
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=1`)
      .then(r => r.json())
      .then(data => {
        const date = data?.[0]?.commit?.committer?.date;
        if (date) setLastUpdated(new Date(date));
      })
      .catch(() => {});
  }, []);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* Brand + tagline */}
        <div className="site-footer__brand">
          <div className="site-footer__logo">🔥 Hearth</div>
          <p className="site-footer__tagline">A cozy corner for every recipe<br/>you love, tweak, and return to.</p>
        </div>

        {/* Nav columns */}
        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Recipes</h4>
          <ul className="site-footer__links">
            <li><button onClick={() => onNav('recipes')}>Browse recipes</button></li>
            <li><button onClick={() => onNav('home')}>Favorites</button></li>
            <li><button className="site-footer__coming-soon" disabled>Show cooked <span>soon</span></button></li>
          </ul>
        </div>

        <div className="site-footer__col">
          <h4 className="site-footer__col-title">About</h4>
          <ul className="site-footer__links">
            <li><button onClick={() => onNav('kitchen')}>What's in my kitchen</button></li>
            <li><button className="site-footer__coming-soon" disabled>Share a recipe <span>soon</span></button></li>
            <li><button className="site-footer__coming-soon" disabled>My cookbooks <span>soon</span></button></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="site-footer__bottom">
        <span className="site-footer__credit">Built by Kavya ♥</span>
        <span className="site-footer__updated">
          {lastUpdated ? `Last updated ${fmt(lastUpdated)}` : 'Last updated —'}
        </span>
      </div>
    </footer>
  );
};

// ─── Main App ───────────────────────────────────────────────────────────────
function AppInner() {
  const [view, setView] = useState('home');
  const [lastView, setLastView] = useState('home');

  useEffect(() => { document.title = 'Hearth'; }, []);
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
  const [activeTags, setActiveTags] = useState([]);
  const [activeCuisines, setActiveCuisines] = useState([]);
  const [activeProgresses, setActiveProgresses] = useState([]);
  const [maxCalories, setMaxCalories] = useState(null);   // null = off
  const [calDir, setCalDir] = useState('under');          // 'under'|'over'
  const [maxMinutes, setMaxMinutes] = useState(null);     // null = off
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customCuisines, setCustomCuisines] = useState(() => LS.get('customCuisines', []));
  const [heartedIds, setHeartedIds] = useState(() => LS.get('heartedIds', []));
  const [makeSoonIds, setMakeSoonIds] = useState(() => LS.get('makeSoonIds', []));
  const [libraryPage, setLibraryPage] = useState(1);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => { LS.set('customCuisines', customCuisines); }, [customCuisines]);
  useEffect(() => { LS.set('heartedIds', heartedIds); }, [heartedIds]);
  useEffect(() => { LS.set('makeSoonIds', makeSoonIds); }, [makeSoonIds]);
  const toggleHeart = (id) => setHeartedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleMakeSoon = (id) => setMakeSoonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const [units, setUnitsRaw] = useState(() => LS.get('units', 'metric'));
  const [dietaryFilters, setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));
  const setUnits = (v) => { setUnitsRaw(v); LS.set('units', v); };
  const setDietaryFilters = (fn) => setDietaryFiltersRaw(prev => { const next = typeof fn === 'function' ? fn(prev) : fn; LS.set('dietaryFilters', next); return next; });

  useEffect(() => { LS.set('fridgeIngredients', fridgeIngredients); }, [fridgeIngredients]);
  useEffect(() => { LS.set('pantryStaples', pantryStaples); }, [pantryStaples]);

  const loadData = useCallback(async () => {
    try {
      const [ingRes, recipeRes] = await Promise.all([fetch(`${API}/api/ingredients`), fetch(`${API}/api/recipes`)]);
      if (!ingRes.ok || !recipeRes.ok) throw new Error('Failed to load data');
      const { ingredients } = await ingRes.json();
      const { recipes: recipeData } = await recipeRes.json();
      setAllIngredients(ingredients.sort((a, b) => a.name.localeCompare(b.name)));
      setRecipes(recipeData);
      setLastSynced(Date.now());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allMyIngredients = useMemo(() => new Set([...fridgeIngredients, ...pantryStaples].map(i => i.toLowerCase().trim())), [fridgeIngredients, pantryStaples]);

  const allTags = useMemo(() => { const tagSet = new Set(); recipes.forEach(r => (r.tags || []).forEach(t => tagSet.add(t))); return Array.from(tagSet).sort(); }, [recipes]);

  const matches = useMemo(() => {
    if (allMyIngredients.size === 0) return [];
    const m = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const have = recipeIngredients.filter(i => allMyIngredients.has(i));
      const missing = recipeIngredients.filter(i => !allMyIngredients.has(i));
      const matchScore = recipeIngredients.length === 0 ? 0 : have.length / recipeIngredients.length;
      return { id: recipe.id, have, missing, matchScore, canMake: missing.length === 0 && recipeIngredients.length > 0 };
    });
    m.sort((a, b) => { if (a.canMake && !b.canMake) return -1; if (!a.canMake && b.canMake) return 1; return b.matchScore - a.matchScore; });
    return m;
  }, [allMyIngredients, recipes]);

  const matchById = useMemo(() => { const map = new Map(); for (const m of matches) map.set(m.id, m); return map; }, [matches]);

  useEffect(() => { setLibraryPage(1); }, [librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes]);  const libraryRecipes = useMemo(() => {
    let list = recipes;
    const q = librarySearch.toLowerCase().trim();
    if (q) list = list.filter(r => r.name.toLowerCase().includes(q));
    if (activeCuisines.length) list = list.filter(r => activeCuisines.includes(r.cuisine || ''));
    if (activeTags.length) list = list.filter(r => activeTags.every(tag => (r.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())));
    if (activeProgresses.length) {
      list = list.filter(r => activeProgresses.some(p => {
        if (p === '__incomplete') return r.recipe_incomplete;
        if (p === '__needstweaking') return r.status === 'needs tweaking';
        if (p === '__favorite') return r.status === 'favorite';
        if (p === '__complete') return !r.recipe_incomplete && r.status === 'complete';
        return false;
      }));
    }
    if (maxCalories !== null) {
      const parseTime = v => { if (!v) return null; const n = parseFloat(v); return isNaN(n) ? null : n; };
      list = list.filter(r => {
        const c = toNum(r.calories);
        if (c === null) return true;
        return calDir === 'under' ? c <= maxCalories : c >= maxCalories;
      });
    }
    if (maxMinutes !== null) {
      list = list.filter(r => {
        if (!r.time) return true;
        const m = parseInt(r.time);
        return !isNaN(m) && m <= maxMinutes;
      });
    }
    return list;
  }, [recipes, librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes, matchById]);

  const hasActiveFilters = !!(librarySearch || activeTags.length || activeCuisines.length || activeProgresses.length || maxCalories !== null || maxMinutes !== null);
  const clearAllFilters = () => { setLibrarySearch(''); setActiveTags([]); setActiveCuisines([]); setActiveProgresses([]); setMaxCalories(null); setMaxMinutes(null); };

  useEffect(() => { setLibraryPage(1); }, [librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes]);

  const openRecipe = async (recipe) => {
    setLastView(view); setView('recipe'); setRecipeLoading(true);
    setSelectedRecipe(null); setRecipeBodyIngredients([]); setRecipeInstructions([]); setRecipeNotes([]);
    try {
      const res = await fetch(`${API}/api/recipes/${recipe.id}`);
      if (!res.ok) throw new Error('Failed to load recipe details');
      const data = await res.json();
      setSelectedRecipe(data.recipe); setRecipeBodyIngredients(data.bodyIngredients || []); setRecipeInstructions(data.instructions || []); setRecipeNotes(data.notes || []);
    } catch (e) { setError(e.message); } finally { setRecipeLoading(false); }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><p>Loading your recipes...</p></div>;

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
          <button className="app-header__brand" onClick={() => setView('home')}>
            <span className="app-header__logo">🔥</span>
            <span className="app-header__title">Hearth</span>
          </button>
          <nav className="nav-tabs">
            {[
              { key: 'home',     label: 'Home'         },
              { key: 'recipes',  label: 'Recipes'      },
              { key: 'kitchen',  label: 'Kitchen'      },
              { key: 'grocery',  label: 'Grocery'      },
              { key: 'log',      label: 'Cook Log'     },
              { key: 'profile',  label: 'Profile'      },
              { key: 'add',      label: 'Add'          },
              { key: 'settings', label: 'Settings'     },
            ].map(({ key, label }) => (
              <button key={key} className={`nav-tab ${view === key ? 'nav-tab--active' : ''}`} onClick={() => setView(key)} disabled={key === 'recipes' && recipes.length === 0}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {view === 'recipe' && !editingRecipe && (
        <RecipePage
          recipe={selectedRecipe} bodyIngredients={recipeBodyIngredients} instructions={recipeInstructions} notes={recipeNotes}
          loading={recipeLoading} onBack={() => setView(lastView)}
          isHearted={selectedRecipe ? heartedIds.includes(selectedRecipe.id) : false}
          onToggleHeart={() => selectedRecipe && toggleHeart(selectedRecipe.id)}
          isMakeSoon={selectedRecipe ? makeSoonIds.includes(selectedRecipe.id) : false}
          onToggleMakeSoon={() => selectedRecipe && toggleMakeSoon(selectedRecipe.id)}
          onSaved={async (updated) => {
            setSelectedRecipe(updated);
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

      {view === 'recipe' && editingRecipe && (
        <RecipeEditor
          recipe={selectedRecipe} bodyIngredients={recipeBodyIngredients} instructions={recipeInstructions} notes={recipeNotes}
          allIngredients={allIngredients.map(i => typeof i === 'string' ? i : i.name).filter(Boolean)}
          onBack={() => setEditingRecipe(false)}
          onSaved={async (updated) => {
            setSelectedRecipe(updated); setEditingRecipe(false);
            try {
              const res = await fetch(`${API}/api/recipes/${updated.id}`);
              const data = await res.json();
              setSelectedRecipe(data.recipe); setRecipeBodyIngredients(data.bodyIngredients || []); setRecipeInstructions(data.instructions || []); setRecipeNotes(data.notes || []);
            } catch {}
            loadData();
          }}
        />
      )}

      {view === 'kitchen' && (
        <FridgeTab allIngredients={allIngredients} fridgeIngredients={fridgeIngredients} setFridgeIngredients={setFridgeIngredients} pantryStaples={pantryStaples} setPantryStaples={setPantryStaples} />
      )}

      {/* ══════════════════════════════════════════════════════
          HOME VIEW
      ══════════════════════════════════════════════════════ */}
      {view === 'home' && (
        <main className="view home-view">

          {/* ── Left column ── */}
          <div className="home-main">

            {/* ── ⏱ Make Soon (persistent, always shown) ── */}
            <div className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">⏱ Make Soon</h2>
                {makeSoonIds.length > 0 && (
                  <button className="btn btn--ghost btn--sm" onClick={() => setMakeSoonIds([])}>Clear all</button>
                )}
              </div>
              {makeSoonIds.length === 0 ? (
                <div className="home-empty-cta" onClick={() => setView('recipes')}>
                  <span className="home-empty-cta__icon">⏱</span>
                  <div>
                    <p className="home-empty-cta__title">Plan your week</p>
                    <p className="home-empty-cta__sub">Tap ⏱ on any recipe to add it here</p>
                  </div>
                  <span className="home-empty-cta__arrow">→</span>
                </div>
              ) : (
                <div className="recipe-grid">
                  {recipes.filter(r => makeSoonIds.includes(r.id)).map(r => (
                    <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                      isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                      isMakeSoon={true} onToggleMakeSoon={() => toggleMakeSoon(r.id)} />
                  ))}
                </div>
              )}
            </div>

            {/* ── What can I make? ── */}
            <div className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">What can I make?</h2>
                <button className="btn btn--ghost btn--sm" onClick={() => setView('kitchen')}>
                  {fridgeIngredients.length + pantryStaples.length > 0
                    ? `${fridgeIngredients.length + pantryStaples.length} ingredients set`
                    : 'Set my ingredients →'}
                </button>
              </div>
              {allMyIngredients.size === 0 ? (
                <div className="home-empty-cta" onClick={() => setView('kitchen')}>
                  <span className="home-empty-cta__icon">🧊</span>
                  <div>
                    <p className="home-empty-cta__title">Add your kitchen &amp; pantry ingredients</p>
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
                        isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                        isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)} />;
                    })}
                  </div>
                ) : <p className="home-no-matches">No matches yet — try adding more ingredients in the Fridge tab.</p>;
              })()}
            </div>

            {/* ── ♥ Favorites ── */}
            <div className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">♥ Favorites</h2>
                {heartedIds.length > 0 && (
                  <button className="btn btn--ghost btn--sm" onClick={() => setView('recipes')}>View all →</button>
                )}
              </div>
              {heartedIds.length === 0 ? (
                <div className="home-empty-cta" onClick={() => setView('recipes')}>
                  <span className="home-empty-cta__icon">♡</span>
                  <div>
                    <p className="home-empty-cta__title">No favorites yet</p>
                    <p className="home-empty-cta__sub">Tap ♡ on any recipe to save it here</p>
                  </div>
                  <span className="home-empty-cta__arrow">→</span>
                </div>
              ) : (
                <div className="recipe-grid">
                  {recipes.filter(r => heartedIds.includes(r.id)).slice(0, 6).map(r => (
                    <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                      isHearted={true} onToggleHeart={() => toggleHeart(r.id)}
                      isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)} />
                  ))}
                </div>
              )}
            </div>

          </div>{/* end home-main */}

          {/* ── Right sidebar: Quick Actions FIRST, then Insights ── */}
          <aside className="home-sidebar">

          <div className="insights-card">
              <h3 className="insights-title">Recipe Insights</h3>
              <div className="insights-grid">
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
                    {recipes.filter(r => { const t = (r.time || '').toLowerCase(); const m = t.match(/(\d+)/); return m && parseInt(m[1]) <= 30; }).length}
                  </span>
                  <span className="insight-item__label">Under 30 min</span>
                  <span className="insight-item__icon">⏱</span>
                </div>
                <div className="insight-item insight-item--blue">
                  <span className="insight-item__number">{recipes.length}</span>
                  <span className="insight-item__label">Total recipes</span>
                  <span className="insight-item__icon">📚</span>
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
                <button className="quick-action" onClick={() => setView('kitchen')}>
                  <span className="quick-action__icon">🧊</span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Update my kitchen</span>
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
                  <button className="quick-action quick-action--highlight" onClick={() => { setActiveTag(null); setActiveCuisine(''); setLibrarySearch(''); setView('recipes'); }}>
                    <span className="quick-action__icon">🎯</span>
                    <div className="quick-action__text">
                      <span className="quick-action__label">Cook something now</span>
                      <span className="quick-action__sub">{matches.filter(m => m.canMake).length} recipes you can make</span>
                    </div>
                    <span className="quick-action__arrow">→</span>
                  </button>
                )}
                <button className="quick-action quick-action--surprise" onClick={() => {
                  if (recipes.length === 0) return;
                  const r = recipes[Math.floor(Math.random() * recipes.length)];
                  openRecipe(r);
                }}>
                  <span className="quick-action__icon">🎲</span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Surprise me!</span>
                    <span className="quick-action__sub">Open a random recipe</span>
                  </div>
                  <span className="quick-action__arrow">→</span>
                </button>
              </div>
            </div>

          </aside>
        </main>
      )}

      {view === 'recipes' && (() => {
        const allCuisinesFromData = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))].sort();
        const allCuisinesPool = [...new Set([...GEO_CUISINES, ...allCuisinesFromData, ...customCuisines])].filter(c => c !== 'Basic').sort();
        const PAGE_SIZE = 25;
        const totalPages = Math.max(1, Math.ceil(libraryRecipes.length / PAGE_SIZE));
        const safePage = Math.min(libraryPage, totalPages);
        const pageRecipes = libraryRecipes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
        const toggleTag = k => setActiveTags(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const toggleCuisine = c => setActiveCuisines(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
        const toggleProgress = k => setActiveProgresses(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const activeCount = activeTags.length + activeCuisines.length + activeProgresses.length + (maxCalories !== null ? 1 : 0) + (maxMinutes !== null ? 1 : 0);
        return (
          <main className="view">

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
                🔧 Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
                <span className="filters-toggle-btn__arrow">{filtersOpen ? '▴' : '▾'}</span>
              </button>
              {hasActiveFilters && (
                <button className="filter-bar__reset" onClick={clearAllFilters}>✕ Clear</button>
              )}
            </div>

            {/* ── Filter Panel ── */}
            {filtersOpen && (
              <div className="filter-panel">

                {/* Cuisine — rounded icon chips */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Cuisine</span>
                  <div className="filter-panel__cuisine-icons">
                    {allCuisinesPool.map(c => (
                      <button key={c} className={`cuisine-icon-btn ${activeCuisines.includes(c) ? 'cuisine-icon-btn--active' : ''}`}
                        onClick={() => toggleCuisine(c)}>
                        <span className="cuisine-icon-btn__emoji">{CUISINE_EMOJI[c] || '🍽'}</span>
                        <span className="cuisine-icon-btn__label">{c}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Tags</span>
                  <div className="filter-panel__chips">
                    {TAG_FILTERS.map(({ key, label }) => (
                      <button key={key}
                        className={`filter-bar__chip ${activeTags.includes(key) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleTag(key)}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Progress */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Progress</span>
                  <div className="filter-panel__chips">
                    {PROGRESS_FILTERS.map(({ key, label }) => (
                      <button key={key}
                        className={`filter-bar__chip ${activeProgresses.includes(key) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleProgress(key)}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Calories slider */}
                <div className="filter-panel__group">
                  <div className="filter-panel__slider-header">
                    <span className="filter-panel__label">Calories</span>
                    <div className="filter-panel__cal-dir">
                      {['under','over'].map(d => (
                        <button key={d} className={`filter-panel__dir-btn ${calDir === d ? 'filter-panel__dir-btn--active' : ''}`}
                          onClick={() => setCalDir(d)}>{d}</button>
                      ))}
                    </div>
                    {maxCalories !== null && <span className="filter-panel__slider-val">{maxCalories} kcal</span>}
                    {maxCalories !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxCalories(null)}>✕</button>}
                  </div>
                  <input type="range" className="filter-panel__slider" min={100} max={1500} step={50}
                    value={maxCalories ?? 800}
                    onChange={e => setMaxCalories(Number(e.target.value))}
                    onMouseDown={() => { if (maxCalories === null) setMaxCalories(800); }}
                    onTouchStart={() => { if (maxCalories === null) setMaxCalories(800); }}
                  />
                  <div className="filter-panel__slider-range"><span>100</span><span>1500 kcal</span></div>
                </div>

                {/* Time slider */}
                <div className="filter-panel__group">
                  <div className="filter-panel__slider-header">
                    <span className="filter-panel__label">Time</span>
                    {maxMinutes !== null && <span className="filter-panel__slider-val">under {maxMinutes} min</span>}
                    {maxMinutes !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxMinutes(null)}>✕</button>}
                  </div>
                  <input type="range" className="filter-panel__slider" min={10} max={180} step={5}
                    value={maxMinutes ?? 60}
                    onChange={e => setMaxMinutes(Number(e.target.value))}
                    onMouseDown={() => { if (maxMinutes === null) setMaxMinutes(60); }}
                    onTouchStart={() => { if (maxMinutes === null) setMaxMinutes(60); }}
                  />
                  <div className="filter-panel__slider-range"><span>10 min</span><span>180 min</span></div>
                </div>
              </div>
            )}

            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="active-filter-pills">
                {activeCuisines.map(c => <span key={c} className="active-filter-pill">{CUISINE_EMOJI[c] || '🌍'} {c} <button onClick={() => toggleCuisine(c)}>✕</button></span>)}
                {activeTags.map(k => <span key={k} className="active-filter-pill">{TAG_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleTag(k)}>✕</button></span>)}
                {activeProgresses.map(k => <span key={k} className="active-filter-pill">{PROGRESS_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleProgress(k)}>✕</button></span>)}
                {maxCalories !== null && <span className="active-filter-pill">{calDir} {maxCalories} kcal <button onClick={() => setMaxCalories(null)}>✕</button></span>}
                {maxMinutes !== null && <span className="active-filter-pill">under {maxMinutes} min <button onClick={() => setMaxMinutes(null)}>✕</button></span>}
              </div>
            )}

            <div className="recipes-grid-spacer" />

            {(() => {
              if (libraryRecipes.length === 0) return (
                <div className="results-empty">
                  <p>No recipes match your filters.</p>
                  <button className="btn btn--ghost btn--sm" style={{marginTop:12}} onClick={clearAllFilters}>Clear filters</button>
                </div>
              );
              return (
                <>
                  <div className="recipe-grid">
                    {pageRecipes.map(r => (
                      <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                        isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                        isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)} />
                    ))}
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
                  <p className="recipes-total-count">{libraryRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
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

      {view === 'log' && (
        <main className="view">
          <div className="placeholder-tab">
            <div className="placeholder-tab__icon">📓</div>
            <h2 className="placeholder-tab__title">Cook Log</h2>
            <p className="placeholder-tab__sub">Track every meal you make — dates, notes, photos, and ratings. Coming soon.</p>
            <div className="placeholder-tab__features">
              <div className="placeholder-tab__feature">📅 Log by date</div>
              <div className="placeholder-tab__feature">⭐ Rate your results</div>
              <div className="placeholder-tab__feature">📸 Attach a photo</div>
              <div className="placeholder-tab__feature">📝 Add cook notes</div>
            </div>
          </div>
        </main>
      )}

      {view === 'profile' && (
        <main className="view">
          <div className="placeholder-tab">
            <div className="placeholder-tab__icon">👤</div>
            <h2 className="placeholder-tab__title">Your Profile</h2>
            <p className="placeholder-tab__sub">Your personal recipe stats, cooking streaks, and dietary preferences in one place. Coming soon.</p>
            <div className="placeholder-tab__features">
              <div className="placeholder-tab__feature">🔥 Cooking streaks</div>
              <div className="placeholder-tab__feature">🥗 Dietary preferences</div>
              <div className="placeholder-tab__feature">📊 Recipe stats</div>
              <div className="placeholder-tab__feature">🏆 Achievements</div>
            </div>
          </div>
        </main>
      )}

      {view === 'settings' && <SettingsTab units={units} setUnits={setUnits} dietaryFilters={dietaryFilters} setDietaryFilters={setDietaryFilters} />}

      <SiteFooter onNav={setView} />
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
