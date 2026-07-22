import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Icon } from '../icons';
import { API, TAG_FILTERS, ALL_CUISINES, COMMON_UNITS } from '../constants';
import { haptic, toNum, pluralizeIng } from '../utils';
import { AutoGrowTextarea, DRAG_SENSORS, Badge, AnchoredPopover, useAnchoredPopover } from '../components/ui';
import { IngFlatRow, IngGroupRow, StepSortableItem, IngredientAutocomplete, UnitAutocomplete } from '../components/IngredientEditor';
import RecipeCard from '../components/RecipeCard';

const GITHUB_REPO = 'kavyasomala/RecipeApp'; // update with actual repo path

// ─── Site Footer ─────────────────────────────────────────────────────────────
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
          <div className="site-footer__logo"><Icon name="flame" size={16} color="var(--terracotta)" strokeWidth={1.75} /> Hearth</div>
          <p className="site-footer__tagline">A cozy corner for every recipe<br/>you love, tweak, and return to.</p>
        </div>

        {/* Nav columns */}
        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Recipes</h4>
          <ul className="site-footer__links">
            <li><button onClick={() => onNav('recipes')}>Browse recipes</button></li>
            <li><button onClick={() => onNav('home')}>Favorites</button></li>
            <li><button onClick={() => onNav('profile')}>Show cooked</button></li>
          </ul>
        </div>

        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Kitchen</h4>
          <ul className="site-footer__links">
            <li><button onClick={() => onNav('kitchen')}>What's in my kitchen</button></li>
            <li><button onClick={() => onNav('grocery')}>Grocery list</button></li>
            <li><button onClick={() => onNav('cookbooks')}>My cookbooks</button></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="site-footer__bottom">
        <span className="site-footer__credit">Built by Kavya <Icon name="heart" size={13} color="var(--terracotta)" strokeWidth={2} /></span>
        <span className="site-footer__updated">
          {lastUpdated ? `Last updated ${fmt(lastUpdated)}` : 'Last updated --'}
        </span>
      </div>
    </footer>
  );
};

// --- Cookbooks Tab ---------------------------------------------------------
// --- Cookbook helpers --------------------------------------------------------
const COOKBOOK_SORTS = [
  { key: 'page',   label: 'Page #' },
  { key: 'alpha',  label: 'A-Z' },
  { key: 'recent', label: 'Recently Added' },
];

// --- Add Reference Modal -----------------------------------------------------
const AddReferenceModal = ({ onSave, onClose, cookbookTitle = '', authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [name, setName]       = useState('');
  const [page, setPage]       = useState('');
  const [image, setImage]     = useState('');
  const [tags, setTags]       = useState([]);
  const [cuisine, setCuisine] = useState('');
  const [time, setTime]       = useState('');
  const [servings, setServings] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein]   = useState('');
  const [fiber, setFiber]       = useState('');
  const [status, setStatus]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgErr, setImgErr]     = useState(false);

  const toggle = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // Save directly to DB so it gets a real recipe_id for cook_log
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const payload = {
        details: {
          name: name.trim(),
          cuisine: cuisine || null,
          time: time.trim() || null,
          servings: servings.trim() || null,
          calories: calories !== '' ? Number(calories) : null,
          protein:  protein  !== '' ? Number(protein)  : null,
          fiber:    fiber    !== '' ? Number(fiber)     : null,
          cover_image_url: image.trim() || null,
          cookbook: cookbookTitle || null,
          reference: page.trim() || null,
          status: status || 'to try',
          tags,
        },
        ingredients: [],
        instructions: [],
        notes: [],
      };
      const res = await apiFetch(`${API}/api/recipes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave({ name: name.trim(), page: page.trim(), image: image.trim(), tags, recipeId: data.recipe.id, addedAt: Date.now() });
    } catch (e) { setSaveError(e.message); setSaving(false); }
  };

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="bookMarked" size={18} strokeWidth={2} /> Add Reference</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap: 14 }}>
          {/* Name + Page */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Roast Chicken" autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label">Page number</label>
              <input className="editor-input" value={page} onChange={e => setPage(e.target.value)} placeholder="e.g. 142" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label>
              <input className="editor-input" value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 45 mins" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label>
              <input className="editor-input" value={servings} onChange={e => setServings(e.target.value)} placeholder="e.g. 4" />
            </div>
          </div>

          {/* Nutrition row */}
          <div style={{ display:'flex', gap:12 }}>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="zap" size={13} strokeWidth={2} /> Calories</label>
              <input className="editor-input" type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="kcal" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="dumbbell" size={13} strokeWidth={2} /> Protein (g)</label>
              <input className="editor-input" type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="g" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="leaf" size={13} strokeWidth={2} /> Fiber (g)</label>
              <input className="editor-input" type="number" value={fiber} onChange={e => setFiber(e.target.value)} placeholder="g" />
            </div>
          </div>

          {/* Image */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Image URL <span style={{opacity:.5,fontWeight:400}}>(optional)</span></label>
            <input className="editor-input" value={image} onChange={e => { setImage(e.target.value); setImgErr(false); }} placeholder="https://..." />
            {image && !imgErr && <img src={image} alt="" onError={() => setImgErr(true)} style={{ width:72, height:72, objectFit:'cover', borderRadius:8, marginTop:6, border:'1.5px solid var(--border)' }} />}
          </div>

          {/* Cuisine chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {ALL_CUISINES.map(c => (
                <button key={c} className={`chip ${cuisine === c ? 'chip--selected' : ''}`} onClick={() => setCuisine(p => p === c ? '' : c)} type="button">
                  {cuisine === c && <span className="chip__check">✓</span>}{c}
                </button>
              ))}
            </div>
          </div>

          {/* Status/Progress chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Progress</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {[
                { key: 'to try',        label: 'To Try' },
                { key: 'complete',      label: 'Complete' },
                { key: 'needs tweaking',label: 'Needs Tweaking' },
                { key: 'incomplete',     label: 'Incomplete' },
              ].map(({ key, label }) => (
                <button key={key} className={`chip ${status === key ? 'chip--selected' : ''}`} onClick={() => setStatus(p => p === key ? '' : key)} type="button">
                  {status === key && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Tags</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {TAG_FILTERS.map(({ key, label }) => (
                <button key={key} className={`chip ${tags.includes(key) ? 'chip--selected' : ''}`} onClick={() => toggle(key)} type="button">
                  {tags.includes(key) && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!name.trim() || saving}>
            {saving ? 'Adding...' : 'Add Reference'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Quick Add Modal ----------------------------------------------------------
const QuickAddModal = ({ onSave, onClose }) => {
  const [rows, setRows] = useState([{id:1,name:'',page:''},{id:2,name:'',page:''},{id:3,name:'',page:''}]);
  const nextId = useRef(4);
  const upd = (id,k,v) => setRows(p => p.map(r => r.id===id ? {...r,[k]:v} : r));
  const addRow = () => setRows(p => [...p, {id: nextId.current++, name:'', page:''}]);
  const rmRow  = id => setRows(p => p.filter(r => r.id !== id));
  const valid  = rows.filter(r => r.name.trim());
  const save   = () => { if (!valid.length) return; onSave(valid.map(r => ({ name: r.name.trim(), page: r.page.trim(), image:'', tags:[], recipeId:null, addedAt:Date.now() }))); };
  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="zap" size={18} strokeWidth={2} /> Quick Add</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap:8 }}>
          <p style={{ fontSize:13, color:'var(--warm-gray)', marginBottom:4 }}>Add multiple recipes at once -- leave rows blank to skip.</p>
          <div style={{ display:'flex', gap:8, padding:'0 0 4px', fontWeight:600, fontSize:12, color:'var(--warm-gray)' }}>
            <span style={{ flex:3 }}>Recipe name</span><span style={{ width:90 }}>Page #</span><span style={{ width:28 }} />
          </div>
          {rows.map((row,i) => (
            <div key={row.id} style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input className="editor-input" style={{ flex:3 }} value={row.name} onChange={e => upd(row.id,'name',e.target.value)} placeholder={`Recipe ${i+1}`} />
              <input className="editor-input" style={{ width:90 }} value={row.page} onChange={e => upd(row.id,'page',e.target.value)} placeholder="Page #" />
              {rows.length > 1 && <button className="editor-remove-btn" onClick={() => rmRow(row.id)}>✕</button>}
            </div>
          ))}
          <button className="btn btn--ghost editor-add-btn" onClick={addRow} style={{ marginTop:4 }}>+ Add row</button>
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!valid.length}>✓ Add {valid.length || ''} Recipes</button>
        </div>
      </div>
    </div>
  );
};

// --- Convert to Full Recipe Modal ---------------------------------------------
// --- Convert to Full Recipe Modal ---------------------------------------------
// Identical form to AddRecipeTab's create modal, pre-filled with cookbook entry data
const ConvertRecipeModal = ({ entry, cookbookTitle, allIngredients = [], onConverted, onClose, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();

  const [details, setDetails] = useState({
    name: entry.name || '',
    cuisine: '',
    time: '',
    servings: '',
    calories: '',
    protein: '',
    cover_image_url: entry.image || '',
    cookbook: cookbookTitle || '',
    reference: entry.page || '',
    status: 'to try',
    recipe_incomplete: false,
    tags: entry.tags || [],
  });
  const [ings, setIngs]           = useState([]);
  const [steps, setSteps]         = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgPreviewError, setImgPreviewError] = useState(false);

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const toggleTag = (tag) => setDetails(prev => ({
    ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  const addIng    = () => setIngs(prev => [...prev, { _id: `ing-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
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
  const groupLabels = [...new Set(ings.filter(i => !i._isGroup).map(i => i.group_label).filter(Boolean))];
  

  const save = async () => {
    if (!details.name.trim()) { setSaveError('Recipe name is required.'); return; }
    setSaving(true); setSaveError(null);
    try {
      // Flatten groups
      let grp = '';
      const flatIngs = ings.map(i => {
        if (i._isGroup) { grp = i.name || ''; return null; }
        return { ...i, group_label: grp };
      }).filter(Boolean);

      const payload = {
        details: {
          name: details.name, cuisine: details.cuisine, time: details.time,
          servings: details.servings,
          cover_image_url: details.cover_image_url,
          cookbook: details.cookbook, page_number: details.reference,
          status: details.status, recipe_incomplete: details.recipe_incomplete, tags: details.tags,
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
      onConverted(data.recipe);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="shuffle" size={18} strokeWidth={2} /> Convert to Recipe</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>

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

          {/* Time + Servings */}
          <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="create-modal__field">
              <label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label>
              <input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
            </div>
            <div className="create-modal__field">
              <label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label>
              <input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
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
                <button key={key} className={`chip ${details.tags.includes(key) ? 'chip--selected' : ''}`} onClick={() => toggleTag(key)}>
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
                { key: 'to try', label: 'To Try' },
                { key: 'complete', label: 'Complete' },
                { key: 'needs tweaking', label: 'Needs Tweaking' },
              ].map(({ key, label }) => (
                <button key={key} className={`chip ${details.status === key ? 'chip--selected' : ''}`}
                  onClick={() => setDetail('status', details.status === key ? '' : key)} type="button">
                  {details.status === key && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          <p className="create-modal__field-hint">Calories, protein &amp; fiber will be auto-calculated from your ingredients</p>

          {/* Ingredients -- group style */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Ingredients</label>
            <datalist id="cv-group-labels">{groupLabels.map(l => <option key={l} value={l} />)}</datalist>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onIngDragEnd}>
              <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
                <div className="ing-flat-list">
                  {ings.map(ing => {
                    if (ing._isGroup) return (
                      <IngGroupRow key={ing._id} ing={ing}
                        onLabelChange={v => setIngs(prev => prev.map(i => i._id === ing._id ? { ...i, name: v } : i))}
                        onRemove={() => setIngs(prev => prev.filter(i => i._id !== ing._id))}
                        onAddIngredient={() => setIngs(prev => {
                          const grpName = ing.name;
                          let insertIdx = prev.findIndex(i => i._id === ing._id);
                          for (let j = insertIdx + 1; j < prev.length; j++) {
                            if (prev[j]._isGroup) break;
                            insertIdx = j;
                          }
                          const newIng = { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: grpName };
                          const next = [...prev]; next.splice(insertIdx + 1, 0, newIng); return next;
                        })}
                      />
                    );
                    return (
                      <IngFlatRow key={ing._id} ing={ing}
                        onUpdate={(k, v) => updateIng(ing._id, k, v)}
                        onRemove={() => removeIng(ing._id)}
                        allIngredients={allIngredients.filter(Boolean)}
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

          {/* Cookbook reference -- pre-filled, editable */}
          <div className="create-modal__meta-grid">
            <div className="create-modal__field">
              <label className="create-modal__field-label"><Icon name="bookMarked" size={13} strokeWidth={2} /> Cookbook</label>
              <input className="editor-input" value={details.cookbook} onChange={e => setDetail('cookbook', e.target.value)} placeholder="Cookbook title" />
            </div>
            <div className="create-modal__field">
              <label className="create-modal__field-label">Page number</label>
              <input className="editor-input" value={details.reference} onChange={e => setDetail('reference', e.target.value)} placeholder="e.g. 142" />
            </div>
          </div>

          {saveError && <p className="editor-error" style={{ marginTop: 8 }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        </div>

        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Creating...' : <><Icon name="zap" size={13} strokeWidth={2} /> Create Recipe</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- CookbookEditModal --------------------------------------------------------
const CookbookEditModal = ({ cookbook, onSave, onClose }) => {
  const isNew = !cookbook;
  const [form, setForm] = useState({ title:cookbook?.title||'', author:cookbook?.author||'', coverImage:cookbook?.coverImage||'', spineColor:cookbook?.spineColor||'#C65D3B', notes:cookbook?.notes||'' });
  const [imgError, setImgError] = useState(false);
  const SPINE_COLORS = ['#C65D3B','#2E2A27','#7a9e7e','#4a6fa5','#8B4513','#6B3FA0','#B5451B','#2C5F2E'];
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const save = () => { if (!form.title.trim()) return; onSave({...form, title:form.title.trim()}); };
  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title">{isNew ? <><Icon name="bookOpen" size={18} strokeWidth={2} /> Add Cookbook</> : `Edit "${cookbook.title}"`}</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap:16 }}>
          <div className="create-modal__img-row">
            <div className="create-modal__img-preview cookbook-edit__cover-preview">
              {form.coverImage && !imgError ? <img src={form.coverImage} alt="cover" onError={() => setImgError(true)} /> : <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%' }}><Icon name="bookOpen" size={32} color="var(--ash)" strokeWidth={1.5} /></div>}
            </div>
            <div className="create-modal__img-input-wrap">
              <label className="create-modal__field-label">Cover image URL</label>
              <input className="editor-input" value={form.coverImage} onChange={e => { set('coverImage',e.target.value); setImgError(false); }} placeholder="https://..." />
              <p className="create-modal__field-hint">Paste a book cover URL</p>
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Cookbook title <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={form.title} onChange={e => set('title',e.target.value)} placeholder="e.g. Ottolenghi Simple" autoFocus={isNew} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Author</label>
            <input className="editor-input" value={form.author} onChange={e => set('author',e.target.value)} placeholder="e.g. Yotam Ottolenghi" />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Spine colour</label>
            <div className="cookbook-spine-picker">
              {SPINE_COLORS.map(c => <button key={c} className={`cookbook-spine-swatch ${form.spineColor===c?'cookbook-spine-swatch--active':''}`} style={{ background:c }} onClick={() => set('spineColor',c)} type="button" />)}
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Notes</label>
            <input className="editor-input" value={form.notes} onChange={e => set('notes',e.target.value)} placeholder="Any notes about this book..." />
          </div>
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!form.title.trim()}>{isNew ? '+ Add Cookbook' : '✓ Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

// --- CookbookDetail -----------------------------------------------------------
// --- CbEntry Row -------------------------------------------------------------
const CbEntry = ({ entry, linked, entryTags, idx, onOpenRecipe, onMarkCooked, onConvert, onEdit, onRemove }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`cbentry ${linked ? 'cbentry--linked' : ''}`}>
      {/* Thumbnail */}
      <div className="cbentry__thumb-wrap">
        {(entry.image || linked?.coverImage)
          ? <img className="cbentry__thumb" src={entry.image || linked?.coverImage} alt={entry.name} />
          : <div className="cbentry__thumb cbentry__thumb--empty"><Icon name="bookOpen" size={16} color="var(--ash)" strokeWidth={1.5} /></div>}
      </div>

      {/* Name col -- plain text, never a link */}
      <div className="cbentry__name-col">
        <span className="cbentry__name">{entry.name}</span>
        {linked && <span className="cookbook-recipe-entry__saved-badge">✓ Saved</span>}
      </div>

      {/* Tags col */}
      <div className="cbentry__tags-col">
        {entryTags.slice(0, 4).map(t => <span key={t} className="cbentry__tag">{t}</span>)}
      </div>

      {/* Page col */}
      <div className="cbentry__page-col">
        {entry.page && <span className="cbentry__page">p. {entry.page}</span>}
      </div>

      {/* Actions col */}
      <div className="cbentry__actions">
        {/* Cook button -- always visible */}
        <button className="cbentry__action cbentry__action--cook" title="Mark as Cooked" onClick={onMarkCooked}>
          <Icon name="chefHat" size={14} strokeWidth={2} />
        </button>

        {/* View button -- for linked recipes */}
        {linked && (
          <button className="cbentry__action cbentry__action--view" onClick={() => onOpenRecipe(linked)} title="Open in Hearth">
            View →
          </button>
        )}

        {/* Actions menu -- for unlinked recipes (edit / convert / remove) */}
        {!linked && (
          <div className="cbentry__menu-wrap" ref={menuRef}>
            <button
              className="cbentry__action cbentry__action--menu"
              onClick={() => setMenuOpen(o => !o)}
              title="More actions"
            >
              Actions ▾
            </button>
            {menuOpen && (
              <div className="cbentry__menu-dropdown">
                <button className="cbentry__menu-item" onClick={() => { onConvert(); setMenuOpen(false); }}>
                  <Icon name="zap" size={12} strokeWidth={2} /> Convert
                </button>
                <button className="cbentry__menu-item" onClick={() => { onEdit(); setMenuOpen(false); }}>
                  <Icon name="pencil" size={12} strokeWidth={2} /> Edit
                </button>
                <button className="cbentry__menu-item cbentry__menu-item--danger" onClick={() => { onRemove(); setMenuOpen(false); }}>
                  <Icon name="trash2" size={12} strokeWidth={2} /> Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CookbookDetail = ({ cookbook, onBack, onEdit, onDelete, onOpenRecipe, recipes, onUpdateRecipes, allIngredients, setCookingRecipe, cookLog, onRecipeConverted, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddRef,   setShowAddRef]   = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [convertEntry, setConvertEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // the entry object being edited
  const [editName, setEditName] = useState('');
  const [editPage, setEditPage] = useState('');
  const [search,   setSearch]   = useState('');
  const [sortKey,  setSortKey]  = useState('page');

  // All cookbook entries are now linked recipes (recipeId always present via join table)
  const savedCount = cookbook.recipes.filter(e => e.recipeId).length;
  const cookedIds  = useMemo(() => new Set((cookLog||[]).map(e => e.recipe_id)), [cookLog]);
  const cookedCount = useMemo(() => cookbook.recipes.filter(e => e.recipeId && cookedIds.has(e.recipeId)).length, [cookbook.recipes, cookedIds]);
  const pct = cookbook.recipes.length > 0 ? Math.round((cookedCount / cookbook.recipes.length) * 100) : 0;

  const sorted = useMemo(() => {
    const list = [...cookbook.recipes];
    if (sortKey === 'page')   list.sort((a,b) => (parseInt(a.page)||9999) - (parseInt(b.page)||9999));
    if (sortKey === 'alpha')  list.sort((a,b) => a.name.localeCompare(b.name));
    if (sortKey === 'recent') list.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    return list;
  }, [cookbook.recipes, sortKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(e => e.name.toLowerCase().includes(q) || (e.page||'').includes(q));
  }, [sorted, search]);

  const addEntries = (entries) => { onUpdateRecipes([...cookbook.recipes, ...entries]); setShowAddRef(false); setShowQuickAdd(false); };
  const removeEntry = (entry) => onUpdateRecipes(cookbook.recipes.filter(e => e !== entry));
  const startEdit = (entry) => { setEditingEntry(entry); setEditName(entry.name); setEditPage(entry.page||''); };
  const saveEdit = () => {
    if (!editName.trim()) return;
    const matched = recipes.find(r => r.name.toLowerCase() === editName.trim().toLowerCase());
    onUpdateRecipes(cookbook.recipes.map(e => e === editingEntry ? {...e, name:editName.trim(), page:editPage.trim(), recipeId:matched?.id||e.recipeId} : e));
    setEditingEntry(null);
  };

  return (
    <main className="view cookbook-detail">
      {showAddRef   && <AddReferenceModal onSave={e => addEntries([e])} onClose={() => setShowAddRef(false)} cookbookTitle={cookbook.title} authFetch={apiFetch} />}
      {showQuickAdd && <QuickAddModal onSave={addEntries} onClose={() => setShowQuickAdd(false)} />}
      {convertEntry && (
        <ConvertRecipeModal
          entry={convertEntry} cookbookTitle={cookbook.title} allIngredients={allIngredients} authFetch={apiFetch}
          onConverted={(newRecipe) => {
            onUpdateRecipes(cookbook.recipes.map(e => e === convertEntry ? {...e, recipeId:newRecipe.id, page: newRecipe.reference || e.page} : e));
            onRecipeConverted && onRecipeConverted(newRecipe);
            setConvertEntry(null);
          }}
          onClose={() => setConvertEntry(null)}
        />
      )}

      {showDeleteConfirm && (
        <div className="create-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon"><Icon name="trash2" size={32} color="var(--terracotta)" strokeWidth={1.5} /></div>
            <h2 className="delete-confirm-modal__title">Remove "{cookbook.title}"?</h2>
            <p className="delete-confirm-modal__body">This removes it from your shelf but won't delete any saved recipes.</p>
            <div className="delete-confirm-modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn--danger" onClick={onDelete}><Icon name="trash2" size={14} strokeWidth={2} /> Remove</button>
            </div>
          </div>
        </div>
      )}

      <div className="cookbook-detail__header">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>â† Cookbooks</button>
        <div className="cookbook-detail__actions">
          <button className="btn btn--ghost btn--sm" onClick={onEdit}>✎ Edit</button>
          <button className="btn btn--ghost btn--sm" style={{ color:'var(--terracotta)' }} onClick={() => setShowDeleteConfirm(true)}><Icon name="trash2" size={14} strokeWidth={2} /> Remove</button>
        </div>
      </div>

      <div className="cookbook-detail__hero">
        <div className="cookbook-detail__cover">
          {cookbook.coverImage ? <img src={cookbook.coverImage} alt={cookbook.title} /> : <div className="cookbook-detail__cover-placeholder" style={{ background:cookbook.spineColor||'#C65D3B' }}><Icon name="bookOpen" size={32} color="#fff" strokeWidth={1.5} /></div>}
        </div>
        <div className="cookbook-detail__meta">
          <h1 className="cookbook-detail__title">{cookbook.title}</h1>
          {cookbook.author && <p className="cookbook-detail__author">by {cookbook.author}</p>}
          {cookbook.notes  && <p className="cookbook-detail__notes">{cookbook.notes}</p>}
          <div className="cookbook-detail__stats">
            <span className="cookbook-detail__stat"><strong>{cookbook.recipes.length}</strong> recipes listed</span>
            <span className="cookbook-detail__stat cookbook-detail__stat--saved"><strong>{savedCount}</strong> saved in Hearth</span>
          </div>
          {cookbook.recipes.length > 0 && (
            <div className="cbdetail-progress">
              <div className="cbdetail-progress__bar"><div className="cbdetail-progress__fill" style={{ width:`${pct}%` }} /></div>
              <span className="cbdetail-progress__label">{cookedCount} of {cookbook.recipes.length} cooked · {pct}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="cookbook-detail__recipes">
        <div className="cookbook-detail__recipes-header">
          <h2 className="cookbook-detail__recipes-title">Recipes</h2>
          <div className="cbdetail-toolbar">
            <div className="cookbook-sort-tabs">
              {COOKBOOK_SORTS.map(o => <button key={o.key} className={`cookbook-sort-tab ${sortKey===o.key?'cookbook-sort-tab--active':''}`} onClick={() => setSortKey(o.key)}>{o.label}</button>)}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowQuickAdd(true)}><Icon name="zap" size={13} strokeWidth={2} /> Quick Add</button>
            <button className="btn btn--primary btn--sm" onClick={() => setShowAddRef(true)}>+ Add Reference</button>
          </div>
        </div>

        <div className="cookbook-search-wrap">
          <input className="editor-input cookbook-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes in this book..." />
          {search && <button className="cookbook-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        {cookbook.recipes.length === 0 ? (
          <div className="cookbook-detail__empty"><p>No recipes listed yet. Add references to track what's in this book.</p></div>
        ) : filtered.length === 0 ? (
          <div className="cookbook-detail__empty"><p>No recipes match "{search}".</p></div>
        ) : (
          <div className="cookbook-recipe-list">
            {filtered.map((entry, idx) => {
              const linked  = entry.recipeId ? recipes.find(r => r.id === entry.recipeId) : null;
              const isEditing = editingEntry === entry;
              const entryTags = linked?.tags || entry.tags || [];

              if (isEditing) return (
                <div key={idx} className="cookbook-recipe-entry cookbook-recipe-entry--editing">
                  <input className="editor-input" style={{ flex:2 }} value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') setEditingEntry(null); }} placeholder="Recipe name" />
                  <input className="editor-input" style={{ width:90 }} value={editPage} onChange={e => setEditPage(e.target.value)} placeholder="Page #" onKeyDown={e => e.key==='Enter' && saveEdit()} />
                  <button className="btn btn--primary btn--sm" onClick={saveEdit}>Save</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditingEntry(null)}>Cancel</button>
                </div>
              );

              return (
                <CbEntry key={idx}
                  entry={entry} linked={linked} entryTags={entryTags} idx={idx}
                  onOpenRecipe={onOpenRecipe}
                  onMarkCooked={() => setCookingRecipe({ id: entry.recipeId || `ref-${idx}`, name: entry.name, coverImage: entry.image || linked?.coverImage || null })}
                  onConvert={() => setConvertEntry(entry)}
                  onEdit={() => startEdit(entry)}
                  onRemove={() => removeEntry(entry)}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

// --- CookbooksTab -------------------------------------------------------------
// ─── Cookbooks Tab ───────────────────────────────────────────────────────────
const CookbooksTab = ({ cookbooks, setCookbooks, recipes, onOpenRecipe, allIngredients, setCookingRecipe, cookLog, onRecipeConverted, isAdmin, session, authFetch }) => {
  const [selectedCookbook, setSelectedCookbook] = useState(null);
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [editingCookbook,  setEditingCookbook]  = useState(null);
  const [globalSearch,     setGlobalSearch]     = useState('');

  const handleSaveCookbook = async (data) => {
    try {
      if (editingCookbook) {
        const res = await authFetch(`${API}/api/cookbooks/${editingCookbook.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        if (res.ok) {
          const d = await res.json();
          setCookbooks(prev => prev.map(c => c.id === editingCookbook.id ? { ...c, ...d.cookbook } : c));
        }
      } else {
        const res = await authFetch(`${API}/api/cookbooks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, recipes: [] }),
        });
        if (res.ok) {
          const d = await res.json();
          setCookbooks(prev => [...prev, d.cookbook || { id: `cb-${Date.now()}`, recipes: [], ...data }]);
        } else {
          // Fallback to local if endpoint not yet available
          setCookbooks(prev => [...prev, { id: `cb-${Date.now()}`, recipes: [], ...data }]);
        }
      }
    } catch {
      // Fallback gracefully
      if (editingCookbook) setCookbooks(prev => prev.map(c => c.id === editingCookbook.id ? { ...c, ...data } : c));
      else setCookbooks(prev => [...prev, { id: `cb-${Date.now()}`, recipes: [], ...data }]);
    }
    setShowAddModal(false); setEditingCookbook(null);
  };

  const handleDeleteCookbook = async (id) => {
    setCookbooks(prev => prev.filter(c => c.id !== id));
    if (selectedCookbook?.id === id) setSelectedCookbook(null);
    try {
      await authFetch(`${API}/api/cookbooks/${id}`, { method: 'DELETE' });
    } catch { /* local delete already done */ }
  };

  const enrichedCookbooks = useMemo(() => cookbooks.map(cb => {
    // cookbook.recipes comes from the API as [{recipeId, name, page, image, tags, addedAt}]
    const entries = (cb.recipes || []).map(entry => {
      const lr = entry.recipeId ? recipes.find(r => r.id === entry.recipeId) : null;
      if (!lr) return entry;
      return {
        ...entry,
        image: lr.coverImage || entry.image || '',
        tags:  lr.tags?.length ? lr.tags : entry.tags,
        page:  lr.reference   || entry.page || '',
      };
    });
    return { ...cb, recipes: entries };
  }), [cookbooks, recipes]);

  const globalResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    const out = [];
    for (const cb of enrichedCookbooks)
      for (const e of cb.recipes)
        if (e.name.toLowerCase().includes(q)) out.push({...e, _cbTitle:cb.title, _cbId:cb.id});
    return out;
  }, [globalSearch, enrichedCookbooks]);

  const currentCb = selectedCookbook ? enrichedCookbooks.find(c => c.id===selectedCookbook.id) : null;

  if (selectedCookbook && currentCb) {
    return <CookbookDetail
      cookbook={currentCb}
      onBack={() => setSelectedCookbook(null)}
      onEdit={() => { setEditingCookbook(currentCb); setShowAddModal(true); }}
      onDelete={() => handleDeleteCookbook(currentCb.id)}
      onOpenRecipe={onOpenRecipe}
      recipes={recipes}
      allIngredients={allIngredients}
      onUpdateRecipes={async (newRecipes) => {
        setCookbooks(prev => prev.map(c => c.id===currentCb.id ? {...c, recipes:newRecipes} : c));
        try {
          await authFetch(`${API}/api/cookbooks/${currentCb.id}/entries`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipes: newRecipes }),
          });
        } catch { /* local update already applied */ }
      }}
      setCookingRecipe={setCookingRecipe}
      cookLog={cookLog}
      onRecipeConverted={onRecipeConverted}
      authFetch={authFetch}
    />;
  }

  return (
    <main className="view cookbooks-tab">
      {(showAddModal||editingCookbook) && (
        <CookbookEditModal cookbook={editingCookbook} onSave={handleSaveCookbook} onClose={() => { setShowAddModal(false); setEditingCookbook(null); }} />
      )}

      <div className="cookbooks-header">
        <div>
          <h2 className="cookbooks-title">My Cookbooks</h2>
          <p className="cookbooks-subtitle">{cookbooks.length} {cookbooks.length===1?'cookbook':'cookbooks'} · {enrichedCookbooks.reduce((s,c) => s+c.recipes.length, 0)} recipes indexed</p>
        </div>
        {(isAdmin || !!session) && <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>+ Add Cookbook</button>}
      </div>

      {cookbooks.length > 0 && (
        <div className="cookbooks-global-search">
          <input className="editor-input" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Search recipes across all cookbooks..." />
          {globalSearch && <button className="cookbook-search-clear" onClick={() => setGlobalSearch('')}>✕</button>}
        </div>
      )}

      {globalSearch.trim() && (
        <div className="cookbooks-search-results">
          {globalResults.length === 0
            ? <p className="cookbooks-search-empty">No recipes found for "{globalSearch}"</p>
            : globalResults.map((e, i) => {
                const linked = e.recipeId ? recipes.find(r => r.id===e.recipeId) : null;
                return (
                  <div key={i} className="cbsearch-result">
                    <div className="cbsearch-result__info">
                      <span className="cbsearch-result__name">{e.name}</span>
                      <span className="cbsearch-result__meta">{e._cbTitle}{e.page ? ` · p. ${e.page}` : ''}</span>
                    </div>
                    <div className="cbsearch-result__actions">
                      {linked && <button className="btn btn--ghost btn--sm" onClick={() => onOpenRecipe(linked)}>View →</button>}
                      <button className="btn btn--ghost btn--sm" onClick={() => { setGlobalSearch(''); setSelectedCookbook(enrichedCookbooks.find(c => c.id===e._cbId)); }}>Open cookbook</button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {!globalSearch.trim() && (cookbooks.length === 0 ? (
        <div className="cookbooks-empty">
          <div className="cookbooks-empty__icon"><Icon name="bookOpen" size={40} color="var(--ash)" strokeWidth={1.5} /></div>
          <h3 className="cookbooks-empty__title">Start your cookbook shelf</h3>
          <p className="cookbooks-empty__sub">Add your physical cookbooks and track which recipes you've saved in Hearth</p>
          {(isAdmin || !!session) && <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>+ Add your first cookbook</button>}
        </div>
      ) : (
        <div className="cookbooks-grid">
          {enrichedCookbooks.map(cb => {
            const cookedCt = cb.recipes.filter(e => e.recipeId && (cookLog||[]).some(l => l.recipe_id===e.recipeId)).length;
            const p = cb.recipes.length > 0 ? Math.round((cookedCt/cb.recipes.length)*100) : 0;
            return (
              <button key={cb.id} className="cookbook-card" onClick={() => setSelectedCookbook(cb)}>
                <div className="cookbook-card__spine" style={{ background:cb.spineColor||'#C65D3B' }} />
                <div className="cookbook-card__cover">
                  {cb.coverImage ? <img src={cb.coverImage} alt={cb.title} className="cookbook-card__img" /> : <div className="cookbook-card__placeholder"><Icon name="bookOpen" size={28} color="var(--ash)" strokeWidth={1.5} /></div>}
                </div>
                <div className="cookbook-card__info">
                  <h3 className="cookbook-card__title">{cb.title}</h3>
                  {cb.author && <p className="cookbook-card__author">{cb.author}</p>}
                  <div className="cookbook-card__stats">
                    <span className="cookbook-card__stat">{cb.recipes?.length||0} recipes</span>
                    {cb.savedCount > 0 && <span className="cookbook-card__stat cookbook-card__stat--saved">✓ {cb.savedCount} saved</span>}
                  </div>
                  {cb.recipes.length > 0 && (
                    <div className="cbcard-progress">
                      <div className="cbcard-progress__bar"><div className="cbcard-progress__fill" style={{ width:`${p}%` }} /></div>
                      <span className="cbcard-progress__label">{cookedCt} cooked</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {(isAdmin || !!session) && <button className="cookbook-card cookbook-card--add" onClick={() => setShowAddModal(true)}>
            <div className="cookbook-card__add-icon"><Icon name="bookMarked" size={24} color="var(--terracotta)" strokeWidth={2} /></div>
            <p className="cookbook-card__add-label">Add cookbook</p>
          </button>}
        </div>
      ))}
    </main>
  );
};

// --- Add Recipe Tab ---------------------------------------------------------
// ─── Add Recipe Tab ──────────────────────────────────────────────────────────

export { SiteFooter };
export default CookbooksTab;
