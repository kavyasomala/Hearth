import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Icon } from '../icons';
import { API, ALL_CUISINES, TAG_FILTERS } from '../constants';
import { haptic } from '../utils';
import { AutoGrowTextarea, DRAG_SENSORS } from './ui';
import { IngFlatRow, IngGroupRow, StepSortableItem } from './IngredientEditor';

const ConvertRefButton = ({ recipe, allIngredients, cookbooks, onConverted, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [showModal, setShowModal] = useState(false);
  const sensors = DRAG_SENSORS();
  const [details, setDetails] = useState({
    name: recipe?.name || '', cuisine: recipe?.cuisine || '', time: recipe?.time || '',
    servings: recipe?.servings || '', cover_image_url: recipe?.coverImage || '',
    cookbook: recipe?.cookbook || '', reference: recipe?.reference || '',
    status: recipe?.status || 'to try', tags: recipe?.tags || [],
  });
  const [ings, setIngs] = useState([{ _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const [steps, setSteps] = useState([{ _id: `step-${Date.now()}`, step_number: 1, body_text: '' }]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const toggleTag = (tag) => setDetails(prev => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag] }));
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); }); };
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); }); };
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const save = async () => {
    if (!details.name.trim()) { setSaveError('Recipe name is required.'); return; }
    setSaving(true); setSaveError(null);
    try {
      let grp = '';
      const flatIngs = ings.map(i => { if (i._isGroup) { grp = i.name || ''; return null; } return { ...i, group_label: grp }; }).filter(Boolean);
      const payload = {
        details,
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
      // Update the existing recipe record
      const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowModal(false);
      if (onConverted) onConverted(data.recipe);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  if (!showModal) return (
    <button className="btn btn--primary rp2__cb-convert-btn" onClick={() => setShowModal(true)}>
      <Icon name="zap" size={14} strokeWidth={2} /> Convert to Full Recipe
    </button>
  );

  return (
    <div className="create-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="create-modal" onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="shuffle" size={18} strokeWidth={2} /> Convert to Full Recipe</h2>
          <button className="ing-modal__close" onClick={() => setShowModal(false)}>âœ•</button>
        </div>
        <div className="create-modal__body">
          {/* Name */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={details.name} onChange={e => setDetail('name', e.target.value)} autoFocus />
          </div>
          {/* Time + Servings */}
          <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="create-modal__field"><label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label><input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" /></div>
            <div className="create-modal__field"><label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label><input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" /></div>
          </div>
          {/* Cuisine */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {ALL_CUISINES.map(c => <button key={c} className={`chip ${details.cuisine===c?'chip--selected':''}`} onClick={() => setDetail('cuisine', details.cuisine===c?'':c)} type="button">{details.cuisine===c&&<span className="chip__check">âœ“</span>}{c}</button>)}
            </div>
          </div>
          {/* Tags */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="tag" size={13} strokeWidth={2} /> Tags</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {TAG_FILTERS.map(({ key, label }) => <button key={key} className={`chip ${details.tags.includes(key)?'chip--selected':''}`} onClick={() => toggleTag(key)} type="button">{details.tags.includes(key)&&<span className="chip__check">âœ“</span>}{label}</button>)}
            </div>
          </div>
          {/* Ingredients */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Ingredients</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onIngDragEnd}>
              <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
                <div className="ing-flat-list">
                  {ings.map(ing => ing._isGroup
                    ? <IngGroupRow key={ing._id} ing={ing} onLabelChange={v => setIngs(prev => prev.map(i => i._id===ing._id?{...i,name:v}:i))} onRemove={() => removeIng(ing._id)} onAddIngredient={() => setIngs(prev => { const idx=prev.findIndex(i=>i._id===ing._id); const n={_id:`ing-new-${Date.now()}`,name:'',amount:'',unit:'',prep_note:'',optional:false,group_label:ing.name}; const nx=[...prev]; nx.splice(idx+1,0,n); return nx; })} />
                    : <IngFlatRow key={ing._id} ing={ing} onUpdate={(k,v) => updateIng(ing._id,k,v)} onRemove={() => removeIng(ing._id)} allIngredients={(allIngredients||[]).filter(Boolean)} />
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <div className="ing-flat-add-row">
              <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id:`ing-new-${Date.now()}`,name:'',amount:'',unit:'',prep_note:'',optional:false,group_label:'' }])}>+ Add Ingredient</button>
              <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id:`grp-${Date.now()}`,_isGroup:true,name:'New Group' }])}>+ Add Group</button>
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
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setSteps(prev => prev.map(s => s._id===item._id?{...s,h:e.target.value}:s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">h</span>
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setSteps(prev => prev.map(s => s._id===item._id?{...s,m:e.target.value}:s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">m</span>
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setSteps(prev => prev.map(s => s._id===item._id?{...s,s:e.target.value}:s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">s</span>
                      </div>
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>âœ•</button>
                    </div>
                  );
                  const stepNum = steps.slice(0, idx).filter(s => !s._isTimer).length + 1;
                  return (
                    <StepSortableItem key={item._id} id={item._id} stepNum={stepNum}>
                      <AutoGrowTextarea className="editor-textarea" value={item.body_text} onChange={e => updateStep(item._id, e.target.value)} placeholder="Describe this step..." minRows={2} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button className="rp2__ed-add-timer-btn" onClick={() => { const i = steps.findIndex(s => s._id===item._id); const t={_id:`timer-${'{'}Date.now(){'}'}`,_isTimer:true,h:'',m:'',s:''}; const n=[...steps]; n.splice(i+1,0,t); setSteps(n); }} title="Add timer"><Icon name="timer" size={13} strokeWidth={2} /></button>
                        <button className="rp2__ed-add-timer-btn" onClick={e => { e.stopPropagation(); setSteps(prev => prev.map(s => s._id === item._id ? { ...s, _showTip: !s._showTip, _tipAnchor: e.currentTarget.getBoundingClientRect() } : s)); }} title="Add tip" style={{ color: item._tip ? 'var(--terracotta)' : undefined, opacity: item._tip ? 1 : undefined }}><Icon name="lightbulb" size={13} strokeWidth={2} /></button>
                      </div>
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>âœ•</button>
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
            <button className="btn btn--ghost editor-add-btn" onClick={() => setSteps(prev => [...prev, { _id:`step-${Date.now()}`,step_number:prev.filter(s=>!s._isTimer).length+1,body_text:'',timer_seconds:null }])}>+ Add Step</button>
          </div>
          {/* Notes */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Notes &amp; Modifications</label>
            {notesList.map(note => (
              <div key={note._id} className="editor-note-row">
                <input className="editor-input" value={note.text||''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>âœ•</button>
              </div>
            ))}
            <button className="btn btn--ghost editor-add-btn" onClick={() => setNotesList(prev => [...prev, { _id:`note-${Date.now()}`,text:'' }])}>+ Add Note</button>
          </div>
          {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Convert Recipe'}</button>
        </div>
      </div>
    </div>
  );
};

// --- Auto-growing textarea (ghost-div approach â€” immune to drag collapsing) ---
// A hidden "ghost" div with identical text determines the correct height.
// The textarea reads that height via a CSS custom property on the wrapper.
// Because value never changes during a dnd-kit drag, height stays locked.

export default ConvertRefButton;
