import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Icon } from '../icons';
import { API, TAG_FILTERS, ALL_CUISINES, COMMON_UNITS } from '../constants';
import { haptic } from '../utils';
import { DRAG_SENSORS, AutoGrowTextarea, SectionPencil } from '../components/ui';
import {
  IngFlatRow, IngGroupRow, StepSortableItem, StepGroupRow,
  IngredientAutocomplete, UnitAutocomplete, CookbookAutocomplete,
} from '../components/IngredientEditor';

const RecipeEditor = ({ recipe, bodyIngredients, instructions, notes, allIngredients, onBack, onSaved, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();

  const [details, setDetails] = useState({
    name: recipe?.name || '',
    cuisine: recipe?.cuisine || '',
    time: recipe?.time || '',
    servings: recipe?.servings || '',
    calories: recipe?.calories || '',
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

  const addStep = () => setSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null }]);
  const addTimerAfterStep = (afterId) => setSteps(prev => {
    const idx = prev.findIndex(s => s._id === afterId);
    const timer = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' };
    const next = [...prev]; next.splice(idx + 1, 0, timer); return next;
  });
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
        instructions: (() => {
          const result = []; let stepNum = 1;
          for (let i = 0; i < steps.length; i++) {
            const item = steps[i];
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
      const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
        {details.cover_image_url ? <img className="rp2__hero-img" src={details.cover_image_url} alt={details.name} /> : <div className="rp2__hero-placeholder"><Icon name="image" size={40} color="var(--ash)" strokeWidth={1.5} /></div>}
        <button className="ed-hero__img-btn" onClick={() => setShowImageInput(v => !v)} title="Change cover image">{details.cover_image_url ? <><Icon name="image" size={13} strokeWidth={2} /> Change</> : <><Icon name="image" size={13} strokeWidth={2} /> Add Photo</>}</button>
        {showImageInput && (
          <div className="ed-hero__img-popover">
            <p className="ed-hero__img-popover-label">Cover image URL</p>
            <input className="editor-input" autoFocus value={details.cover_image_url} onChange={e => setDetail('cover_image_url', e.target.value)} placeholder="https://..." onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setShowImageInput(false); }} />
            <button className="btn btn--primary btn--sm" style={{marginTop:6}} onClick={() => setShowImageInput(false)}>Done</button>
          </div>
        )}
        <div className="rp2__hero-overlay">
          <div className="rp2__hero-topbar">
            <button className="rp2__hero-btn" onClick={onBack}>â† Cancel</button>
            <button className="rp2__hero-btn rp2__hero-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : '✓ Save'}</button>
          </div>
          <div className="rp2__hero-bottom">
            <div className="rp2__hero-tags">{details.cuisine && <span className="rp2__tag">{details.cuisine}</span>}</div>
            <div className="rp2__hero-pills">
              {details.time && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="clock" size={13} strokeWidth={2} /></span>{details.time}</span>}
              {details.servings && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="utensils" size={13} strokeWidth={2} /></span>{details.servings} srv</span>}
              {details.calories && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="flame" size={13} strokeWidth={2} /></span>{details.calories} cal</span>}
            </div>
          </div>
        </div>
      </div>

      {saveError && <p className="editor-error" style={{margin:'8px 24px 0'}}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
      {saveSuccess && <p className="editor-success" style={{margin:'8px 24px 0'}}>✓ Saved successfully</p>}

      <div className="rp2__header ed-name-row">
        <input className="ed-title-input" value={details.name} onChange={e => setDetail('name', e.target.value)} placeholder="Recipe name..." />
      </div>

      <div className="ed-meta-row">
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</span>
          <select className="editor-input editor-select ed-meta-input" value={details.cuisine} onChange={e => setDetail('cuisine', e.target.value)}>
            <option value="">-- none --</option>
            {ALL_CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
            {[...QUICK_CHIP_KEYS].filter(k => !ALL_CUISINES.includes(k)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</span>
          <input className="editor-input ed-meta-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</span>
          <input className="editor-input ed-meta-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="flame" size={13} strokeWidth={2} /> Calories</span>
          <input className="editor-input ed-meta-input" value={details.calories} onChange={e => setDetail('calories', e.target.value)} placeholder="450" />
        </label>
      </div>

      <section className="editor-section">
        <h3 className="editor-section__title">Ingredients</h3>
        <datalist id="group-labels">{groupLabels.map(l => <option key={l} value={l} />)}</datalist>
        <div className="editor-ing-header"><span>Amount</span><span>Unit</span><span>Name</span><span>Group</span><span>Prep note</span><span>Opt?</span><span></span></div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onIngDragEnd}>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onStepDragEnd}>
          <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
            {steps.map((item, idx) => {
              if (item._isTimer) {
                return (
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
              }
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
        {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        {saveSuccess && <p className="editor-success">✓ Saved successfully</p>}
        <button className="btn btn--primary btn--large" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </main>
  );
};

export default RecipeEditor;
