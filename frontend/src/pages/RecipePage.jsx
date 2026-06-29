import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Icon } from '../icons';
import { API, TAG_FILTERS, COMMON_UNITS, STAR_LABELS } from '../constants';
import { haptic, pct, toNum, pluralizeIng, checkDietaryConflicts, unitType, formatWeight, formatVolume } from '../utils';
import { DRAG_SENSORS, AutoGrowTextarea, Badge, SectionPencil, AnchoredPopover, useAnchoredPopover } from '../components/ui';
import { HeroImage, HeroTagsButton } from '../components/HeroComponents';
import MarkCookedModal from '../components/MarkCookedModal';
import ConvertRefButton from '../components/ConvertRefButton';
import { CookbookAutocomplete } from '../components/IngredientEditor';
import {
  IngredientAutocomplete, UnitAutocomplete,
  SortableItem, StepSortableItem, StepGroupRow,
  IngFlatRow, IngGroupRow,
} from '../components/IngredientEditor';

// --- Step Item with integrated timer --------------------------------------
const StepItem = ({ step, done, isCurrent, enlarge, grouped, onToggle, matchedNotes = [] }) => {
  const [showTips, setShowTips] = useState(false);
  // Parse manual tip embedded in body_text
  const [cleanStepBody, manualTip] = (step.body_text || '').split('\u26D4TIP\u26D4');
  const hasTimer = step.timer_seconds && step.timer_seconds > 0;
  const [timerState, setTimerState] = useState('idle'); // 'idle' | 'running' | 'paused' | 'done'
  const [remaining, setRemaining] = useState(step.timer_seconds || 0);
  // Store absolute end time so timer survives tab switches / phone lock
  const endTimeRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    setRemaining(step.timer_seconds || 0);
    setTimerState('idle');
    endTimeRef.current = null;
  }, [step.timer_seconds]);

  const startTimer = (e) => {
    e.stopPropagation();
    if (timerState === 'idle' || timerState === 'paused') {
      // Request notification permission so the alarm fires when tab is in background
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      // Set absolute end time from NOW + remaining seconds
      endTimeRef.current = Date.now() + remaining * 1000;
      setTimerState('running');
    }
  };
  const pauseTimer = (e) => {
    e.stopPropagation();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTimerState('paused');
    endTimeRef.current = null;
  };
  const resetTimer = (e) => {
    e.stopPropagation();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTimerState('idle');
    setRemaining(step.timer_seconds || 0);
    endTimeRef.current = null;
  };

  // rAF loop — reads from wall clock, works even after tab becomes hidden then visible
  useEffect(() => {
    if (timerState !== 'running') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setTimerState('done');
        // Beep
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const playBeep = (time, freq) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = freq; osc.type = 'sine';
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
            osc.start(time); osc.stop(time + 0.4);
          };
          playBeep(ctx.currentTime, 880); playBeep(ctx.currentTime + 0.45, 1100); playBeep(ctx.currentTime + 0.9, 1320);
        } catch {}
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Timer done!', { body: `Step ${step.step_number}: ${(step.body_text || '').slice(0, 60)}`, icon: 'ðŸ³' });
        }
        return; // stop loop
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    // Also re-sync when tab becomes visible again after being hidden
    const onVisible = () => { if (timerState === 'running') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timerState]);

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const pct = hasTimer ? ((step.timer_seconds - remaining) / step.timer_seconds) * 100 : 0;

  return (
    <li className={`rp2__step ${done ? 'rp2__step--done' : ''} ${isCurrent ? 'rp2__step--current' : ''} ${enlarge ? 'rp2__step--enlarged' : ''} ${grouped ? 'rp2__step--grouped' : ''}`} onClick={onToggle}>
      <div className="rp2__step-num">{done ? '✓' : step.step_number}</div>
      <div className="rp2__step-content">
        <div className="rp2__step-body-row">
          <p className="rp2__step-body">{cleanStepBody}</p>
          {(matchedNotes.length > 0 || manualTip) && (
            <div className="rp2__step-hints">
              <div className="rp2__step-hint-wrap">
                <button
                  className={`rp2__step-hint-btn ${showTips ? 'rp2__step-hint-btn--active' : ''}`}
                  onClick={e => { e.stopPropagation(); setShowTips(v => !v); }}
                  title={[...(manualTip ? ['Tip'] : []), ...matchedNotes.map(n => n.title)].join(' · ')}
                ><Icon name="lightbulb" size={13} strokeWidth={2} />{(matchedNotes.length + (manualTip ? 1 : 0)) > 1 && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{matchedNotes.length + (manualTip ? 1 : 0)}</span>}</button>
                {showTips && (
                  <div className="rp2__step-hint-popover" onClick={e => e.stopPropagation()}>
                    {manualTip && (
                      <div style={matchedNotes.length > 0 ? { marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' } : {}}>
                        <div className="rp2__step-hint-popover__title">Tip</div>
                        <p className="rp2__step-hint-popover__body">{manualTip}</p>
                      </div>
                    )}
                    {matchedNotes.map((n, i) => (
                      <div key={n.id} style={i > 0 ? { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' } : {}}>
                        <div className="rp2__step-hint-popover__title">{n.title}</div>
                        <p className="rp2__step-hint-popover__body">{n.body}</p>
                        {n.bullets?.length > 0 && (
                          <ul className="rp2__step-hint-popover__bullets">
                            {n.bullets.map((b, j) => <li key={j}>{b.text}</li>)}
                          </ul>
                        )}
                        {n.image_url && <img src={n.image_url} alt="" className="rp2__step-hint-popover__img" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {hasTimer && !done && (
          <div className="rp2__step-timer" onClick={e => e.stopPropagation()}>
            {timerState === 'running' && (
              <div className="rp2__step-timer__bar"><div className="rp2__step-timer__fill" style={{ width: `${pct}%` }} /></div>
            )}
            <div className="rp2__step-timer__controls">
              <span className={`rp2__step-timer__display ${timerState === 'done' ? 'rp2__step-timer__display--done' : ''}`}>
                {timerState === 'done' ? '✓ Done!' : fmtTime(remaining)}
              </span>
              {timerState === 'idle' && <button className="rp2__step-timer__btn rp2__step-timer__btn--start" onClick={startTimer}><Icon name="arrowRight" size={12} strokeWidth={2.5} /> Start</button>}
              {timerState === 'running' && <button className="rp2__step-timer__btn rp2__step-timer__btn--pause" onClick={pauseTimer}><Icon name="clock" size={12} strokeWidth={2.5} /> Pause</button>}
              {timerState === 'paused' && <button className="rp2__step-timer__btn rp2__step-timer__btn--start" onClick={startTimer}><Icon name="arrowRight" size={12} strokeWidth={2.5} /> Resume</button>}
              {timerState !== 'idle' && <button className="rp2__step-timer__btn rp2__step-timer__btn--reset" onClick={resetTimer}>↺</button>}
            </div>
          </div>
        )}
      </div>
    </li>
  );
};

const IngredientItem = ({ ing, isChecked, amountStr, onToggle }) => (
  <li className={`rp2__ing-item ${isChecked ? 'rp2__ing-item--checked' : ''}`} onClick={onToggle}>
    <div className={`rp2__ing-check ${isChecked ? 'rp2__ing-check--done' : ''}`}>
      {isChecked && <Icon name="check" size={10} strokeWidth={3} />}
    </div>
    <div className="rp2__ing-text">
      <span className="rp2__ing-line">
        {amountStr && <span className="rp2__ing-amount">{amountStr} </span>}
        <span className="rp2__ing-name">{pluralizeIng(ing.name, ing.amount)}{ing.prep_note ? <span className="rp2__ing-prep">, {ing.prep_note}</span> : ''}</span>
        {ing.optional && <span className="rp2__ing-optional">optional</span>}
      </span>
    </div>
  </li>
);

// --- Sortable Note Row (for drag-to-reorder notes inline editor) -----------
const SortableNoteRow = ({ note, onUpdate, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="rp2__ed-note-row">
      <span style={{ cursor: 'grab', fontSize: 16, color: 'var(--ash)', flexShrink: 0, userSelect: 'none', touchAction: 'none' }} {...attributes} {...listeners}>⠿</span>
      <input className="editor-input" style={{ flex: 1 }} value={note.text} onChange={e => onUpdate(e.target.value)} placeholder="Add a tip or note..." />
      <button className="editor-remove-btn" onClick={onRemove}>✕</button>
    </div>
  );
};

// --- Recipe Page -------------------------------------------------------------
// ─── Recipe Page ─────────────────────────────────────────────────────────────
const RecipePage = ({ recipe, bodyIngredients, instructions, notes, onBack, onSaved, onDelete, loading, isHearted, onToggleHeart, isMakeSoon, onToggleMakeSoon, allIngredients = [], cookbooks = [], onMarkCooked, dietaryFilters = [], authFetch, isAdmin, cookingNotes = [] }) => {
  const apiFetch = authFetch || fetch;
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [doneSteps, setDoneSteps] = useState(new Set());
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCookedModal, setShowCookedModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesAnchorRect, setNotesAnchorRect] = useState(null);
  const [showCookbookModal, setShowCookbookModal] = useState(false);
  const [cookbookAnchorRect, setCookbookAnchorRect] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [stayAwake, setStayAwake] = useState(false);
  const wakeLockRef = useRef(null);
  const ingDndSensors = DRAG_SENSORS();

  // -- Wake Lock --
  useEffect(() => {
    if (stayAwake) {
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => { wakeLockRef.current = lock; }).catch(() => {});
      }
    } else {
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    }
    return () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; } };
  }, [stayAwake]);

  // -- Per-section edit state --
  const [editingSection, setEditingSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // -- Draft state --
  const [draftName, setDraftName] = useState('');
  const [draftImageInput, setDraftImageInput] = useState('');
  const [draftIngs, setDraftIngs] = useState([]);
  const [draftSteps, setDraftSteps] = useState([]);
  const rpSensors = DRAG_SENSORS();
  const [draftNotes, setDraftNotes] = useState([]);
  const [draftMeta, setDraftMeta] = useState({});
  const [draftCookbook, setDraftCookbook] = useState({ cookbook: '', reference: '' });

  const isEdit = (s) => editingSection === s;

  const startEdit = (section) => {
    if (!isAdmin) return;
    setSaveError(null);
    if (section === 'title')        setDraftName(recipe.name || '');
    if (section === 'image')        setDraftImageInput(recipe.coverImage || '');
    if (section === 'ingredients') {
      // Build flat list: group separator rows interspersed with ingredient rows
      const ings = bodyIngredients || [];
      const flat = [];
      const seenGroups = new Set();
      for (let i = 0; i < ings.length; i++) {
        const ing = ings[i];
        const g = ing.group_label || '';
        if (g && !seenGroups.has(g)) {
          seenGroups.add(g);
          flat.push({ _id: `grp-exist-${g}-${i}`, _isGroup: true, name: g });
        }
        flat.push({ ...ing, _id: `ing-${i}` });
      }
      setDraftIngs(flat);
    }
    if (section === 'instructions') {
      // Build flat list: group headers interleaved with steps that carry their own group_label.
      // Steps belonging to a group are placed immediately after the group header row.
      const sorted = [...(instructions || [])].sort((a, b) => a.step_number - b.step_number);
      const flat = [];
      const seenGroups = new Set();
      // First pass: add all group headers
      for (const s of sorted) {
        const g = s.group_label || '';
        if (g && !seenGroups.has(g)) {
          seenGroups.add(g);
          // Will be inserted before the first step of this group below
        }
      }
      // Second pass: interleave headers and steps in sorted order, grouped steps follow their header
      const ungrouped = sorted.filter(s => !s.group_label);
      const grouped = sorted.filter(s => s.group_label);
      // Collect unique group labels in the order they first appear
      const groupOrder = [];
      for (const s of sorted) {
        if (s.group_label && !groupOrder.includes(s.group_label)) groupOrder.push(s.group_label);
      }
      // Build interleaved list: ungrouped steps and group sections in step_number order
      // Strategy: walk sorted steps; emit group header before first step of each group
      const emittedGroups = new Set();
      for (const s of sorted) {
        const g = s.group_label || '';
        if (g && !emittedGroups.has(g)) {
          emittedGroups.add(g);
          flat.push({ _id: `step-grp-exist-${g}`, _isGroup: true, name: g });
        }
        const [cleanBody, stepTip] = (s.body_text || '').split('\u26D4TIP\u26D4');
          flat.push({ ...s, _id: `step-${s.step_number}`, body_text: cleanBody, _tip: stepTip || '', _showTip: !!(stepTip), timer_seconds: s.timer_seconds ?? null, group_label: g || null });
        if (s.timer_seconds && s.timer_seconds > 0) {
          const h = Math.floor(s.timer_seconds / 3600);
          const m = Math.floor((s.timer_seconds % 3600) / 60);
          const sec = s.timer_seconds % 60;
          flat.push({ _id: `timer-exist-${s.step_number}`, _isTimer: true, h: h || '', m: m || '', s: sec || '' });
        }
      }
      setDraftSteps(flat);
    }
    if (section === 'notes')        setDraftNotes((notes || []).map((n, idx) => ({ ...n, _id: `note-${idx}`, text: n.text ?? n.body_text ?? '' })));
    if (section === 'cookbook')      setDraftCookbook({ cookbook: recipe.cookbook || '', reference: recipe.reference || '' });
    if (['meta','meta-cuisine','meta-tags','meta-progress','meta-time','meta-servings','meta-calories'].includes(section)) setDraftMeta({
      time: recipe.time || '',
      servings: recipe.servings || '',
      calories: recipe.calories || '',
      cuisine: recipe.cuisine || '',
      tags: recipe.tags || [],
      status: recipe.status || '',
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
          calories:        isMeta ? draftMeta.calories : (recipe.calories || ''),
          cover_image_url: section === 'image' ? draftImageInput : (recipe.coverImage || ''),
          status:          isMeta ? draftMeta.status : (recipe.status || ''),
          tags:            isMeta ? draftMeta.tags   : (recipe.tags || []),
          cookbook:        section === 'cookbook' ? draftCookbook.cookbook : (recipe.cookbook || ''),
          page_number:     section === 'cookbook' ? draftCookbook.reference : (recipe.reference || ''),
        },
        ingredients:  section === 'ingredients'  ? (() => {
          let grp = '';
          return draftIngs
            .map(i => { if (i._isGroup) { grp = i.name || ''; return null; } return { ...i, group_label: grp }; })
            .filter(Boolean)
            .map((i, idx) => ({ ...i, order_index: idx }));
        })() : (bodyIngredients || []),
        instructions: section === 'instructions' ? (() => {
          const result = [];
          let stepNum = 1;
          for (const item of draftSteps) {
            if (item._isGroup) continue; // headers are metadata only
            if (item._isTimer) {
              const h = parseInt(item.h) || 0;
              const m = parseInt(item.m) || 0;
              const s = parseInt(item.s) || 0;
              const secs = h * 3600 + m * 60 + s;
              if (result.length > 0) result[result.length - 1].timer_seconds = secs > 0 ? secs : null;
            } else {
              const bodyText = item._tip?.trim()
                ? item.body_text + '\n\u26D4TIP\u26D4' + item._tip.trim()
                : item.body_text;
              result.push({
                ...item,
                body_text: bodyText,
                step_number: stepNum++,
                timer_seconds: item.timer_seconds ?? null,
                group_label: item.group_label || null,
              });
            }
          }
          return result;
        })() : (instructions || []),
        notes:        section === 'notes'        ? draftNotes.map((n, idx) => ({ ...n, order_index: idx }))  : (notes || []),
      };
      const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setEditingSection(null);
      if (onSaved) onSaved(data.recipe);
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  // -- Meta draft helpers --
  const toggleDraftTag = (tag) => setDraftMeta(prev => ({
    ...prev,
    tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  // -- Ingredient draft helpers --
  const addDraftIng  = () => setDraftIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateDraftIng = (id, k, v) => setDraftIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeDraftIng = (id) => setDraftIngs(prev => prev.filter(i => i._id !== id));

  const addDraftStep = () => setDraftSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null, group_label: null }]);
  const onDraftStepDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setDraftSteps(prev => {
      const oldIdx = prev.findIndex(s => s._id === active.id);
      const newIdx = prev.findIndex(s => s._id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;

      const moved = arrayMove(prev, oldIdx, newIdx);

      // After the move, determine the new group_label for the dragged item.
      // Only regular steps get a group_label; group headers and timers don't.
      const draggedItem = moved[newIdx];
      if (draggedItem._isGroup || draggedItem._isTimer) return moved;

      // Walk backwards from newIdx to find the nearest group header.
      // If a regular ungrouped step sits between the dragged item and any group header,
      // the dragged item is ungrouped.
      let newGroupLabel = null;
      for (let j = newIdx - 1; j >= 0; j--) {
        const item = moved[j];
        if (item._isTimer) continue; // skip timers
        if (item._isGroup) {
          newGroupLabel = item.name || null;
          break;
        }
        // Hit a regular step — check if IT is grouped under a header
        if (item.group_label) {
          // The step above is grouped — the dragged step is also in that group
          newGroupLabel = item.group_label;
        }
        break;
      }

      // Apply new group_label to the dragged step
      return moved.map((s, i) =>
        i === newIdx && !s._isGroup && !s._isTimer
          ? { ...s, group_label: newGroupLabel }
          : s
      );
    });
  };
  const addTimerAfterStep = (afterId) => setDraftSteps(prev => {
    const idx = prev.findIndex(s => s._id === afterId);
    const timer = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' };
    const next = [...prev];
    next.splice(idx + 1, 0, timer);
    return next;
  });
  const updateDraftStep = (id, v) => setDraftSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeDraftStep = (id) => setDraftSteps(prev => prev.filter(s => s._id !== id));

  // -- Note draft helpers --
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

  if (loading) return <main className="view"><div className="placeholder"><h2>Loading recipe...</h2></div></main>;
  if (!recipe) return <main className="view"><div className="placeholder"><h2>Recipe not found</h2><button className="btn btn--ghost" onClick={onBack}>← Back</button></div></main>;

  const doneCount  = doneSteps.size;
  const totalSteps = instructions?.length ?? 0;

  // Dietary conflict warnings
  const dietaryWarnings = checkDietaryConflicts(bodyIngredients || [], dietaryFilters);

  return (
    <main className="view rp2">
      {saveError && <p className="editor-error" style={{ margin: '8px 20px 0' }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}

      {/* -- Delete Confirmation Modal -- */}
      {showDeleteConfirm && (
        <div className="create-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon"><Icon name="trash2" size={32} color="var(--terracotta)" strokeWidth={1.5} /></div>
            <h2 className="delete-confirm-modal__title">Delete "{recipe?.name}"?</h2>
            <p className="delete-confirm-modal__body">
              This will permanently delete the recipe along with all its ingredients, instructions, and notes.
              <strong> This cannot be undone.</strong>
            </p>
            {deleteError && <p className="editor-error" style={{ marginTop: 8 }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {deleteError}</p>}
            <div className="delete-confirm-modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn--danger" onClick={async () => {
                setDeleting(true); setDeleteError(null);
                try {
                  const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, { method: 'DELETE' });
                  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete(recipe.id);
                } catch (e) { setDeleteError(e.message); setDeleting(false); }
              }} disabled={deleting}>
                {deleting ? 'Deleting...' : <><Icon name="trash2" size={14} strokeWidth={2} /> Delete forever</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCookedModal && recipe && (
        <MarkCookedModal
          recipe={recipe}
          bodyIngredients={bodyIngredients}
          authFetch={apiFetch}
          onSave={({ toRemove }) => {
            setShowCookedModal(false);
            if (onMarkCooked) onMarkCooked(recipe.id, toRemove);
          }}
          onClose={() => setShowCookedModal(false)}
        />
      )}

      <div className="rp2__hero">
        {recipe.coverImage
          ? <HeroImage src={recipe.coverImage} alt={recipe.name} />
          : <div className="rp2__hero-placeholder"><Icon name="image" size={40} color="var(--ash)" strokeWidth={1.5} /></div>}

        <div className="rp2__hero-overlay">
          {/* == DESKTOP: original top-bar layout == */}
          <div className="rp2__hero-desktop-layout">
            <div className="rp2__hero-topbar">
              <button className="rp2__hero-btn" onClick={e => { e.stopPropagation(); onBack(); }}>← Back</button>
              <div className="rp2__hero-topbar-right">
                {isMakeSoon && onMarkCooked && (
                  <button className="rp2__hero-btn rp2__hero-cooked-btn"
                    onClick={e => { e.stopPropagation(); setShowCookedModal(true); }} title="Mark as Cooked"
                  ><Icon name="chefHat" size={15} strokeWidth={2} /> Cooked</button>
                )}
                {onToggleHeart && (
                  <button className={`rp2__hero-btn rp2__hero-heart ${isHearted ? 'rp2__hero-heart--on' : ''}`}
                    onClick={e => { e.stopPropagation(); onToggleHeart(); }}
                    title={isHearted ? 'Remove from favorites' : 'Save to favorites'}
                  ><Icon name="heart" size={14} strokeWidth={2} /></button>
                )}
                <button className={`rp2__hero-btn rp2__hero-soon ${isMakeSoon ? 'rp2__hero-soon--on' : ''}`}
                  onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
                  title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
                ><Icon name="timer" size={16} strokeWidth={2} /></button>
                {isAdmin && <div className="rp2__photo-btn-wrap">
                  <button className="rp2__hero-btn rp2__hero-soon rp2__hero-btn--photo"
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }} title="Change photo link">✎
                  </button>
                  {isEdit('image') && (
                    <div className="rp2__img-popover-down">
                      <p className="rp2__dark-pop-label">Cover image URL</p>
                      <input className="editor-input" autoFocus value={draftImageInput}
                        onChange={e => setDraftImageInput(e.target.value)} placeholder="https://..."
                        onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }} />
                      <div className="rp2__dark-pop-actions">
                        <button className="rp2__dark-save" onClick={() => saveSection('image')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                        <button className="rp2__dark-cancel" onClick={cancelEdit}>✕ Cancel</button>
                      </div>
                    </div>
                  )}
                </div>}
              </div>
            </div>
          </div>

          {/* == MOBILE: four-corner layout == */}
          {/* Top-left: Tags (mobile only) */}
          <div className="rp2__hero-corner rp2__hero-corner--tl rp2__hero-mobile-only">
            <HeroTagsButton recipe={recipe} />
          </div>
          {/* Top-right: Photo edit (admin) + Cooked */}
          <div className="rp2__hero-corner rp2__hero-corner--tr rp2__hero-mobile-only">
            {isMakeSoon && onMarkCooked && (
              <button className="rp2__hero-btn rp2__hero-cooked-btn"
                onClick={e => { e.stopPropagation(); setShowCookedModal(true); }} title="Mark as Cooked"
              ><Icon name="chefHat" size={15} strokeWidth={2} /> Cooked</button>
            )}
            {isAdmin && <div className="rp2__photo-btn-wrap">
              <button className="rp2__hero-btn rp2__hero-soon rp2__hero-btn--photo"
                onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }} title="Change photo link">✎
              </button>
              {isEdit('image') && (
                <div className="rp2__img-popover-down">
                  <p className="rp2__dark-pop-label">Cover image URL</p>
                  <input className="editor-input" autoFocus value={draftImageInput}
                    onChange={e => setDraftImageInput(e.target.value)} placeholder="https://..."
                    onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }} />
                  <div className="rp2__dark-pop-actions">
                    <button className="rp2__dark-save" onClick={() => saveSection('image')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                    <button className="rp2__dark-cancel" onClick={cancelEdit}>✕ Cancel</button>
                  </div>
                </div>
              )}
            </div>}
          </div>
          {/* Bottom-left: Heart + Timer */}
          <div className="rp2__hero-corner rp2__hero-corner--bl rp2__hero-mobile-only">
            {onToggleHeart && (
              <button className={`rp2__hero-btn rp2__hero-heart ${isHearted ? 'rp2__hero-heart--on' : ''}`}
                onClick={e => { e.stopPropagation(); onToggleHeart(); }}
                title={isHearted ? 'Remove from favorites' : 'Save to favorites'}
              ><Icon name="heart" size={14} strokeWidth={2} /></button>
            )}
            <button className={`rp2__hero-btn rp2__hero-soon rp2__hero-soon--dark ${isMakeSoon ? 'rp2__hero-soon--on' : ''}`}
              onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
              title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
            ><Icon name="timer" size={16} strokeWidth={2} /></button>
          </div>

          {/* -- Desktop-only tags+pills row at bottom -- */}
          <div className="rp2__hero-bottom rp2__hero-bottom--desktop-only">

            {/* Tags area -- only show fields that have values; add button for adding more */}
            <div className="rp2__hero-tags">

              {/* Cuisine chip */}
              {recipe.cuisine && (
                <div className="rp2__hero-tag-wrap">
                  <button
                    className={`rp2__tag rp2__tag--clickable ${isEdit('meta-tags') ? 'rp2__tag--editing' : ''}`}
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-tags') ? null : 'meta-tags'); }}
                  >
                    {recipe.cuisine}
                  </button>
                </div>
              )}

              {/* Progress icon chip */}
              {recipe.status && recipe.status !== '' && (
                <div className="rp2__hero-tag-wrap">
                  <button
                    className={`rp2__tag rp2__tag--clickable ${
                      recipe.status === 'incomplete' || recipe.status === 'needs tweaking'
                        ? 'rp2__tag--warning'
                        : recipe.status === 'complete'
                        ? 'rp2__tag--success'
                        : 'rp2__tag--light'
                    } ${isEdit('meta-tags') ? 'rp2__tag--editing' : ''}`}
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-tags') ? null : 'meta-tags'); }}
                    style={{ padding: '4px 8px' }}
                    title={recipe.status}
                  >
                    {recipe.status === 'incomplete' ? <Icon name="alertTriangle" size={12} strokeWidth={2} /> :
                    recipe.status === 'needs tweaking' ? <Icon name="tool" size={12} strokeWidth={2} /> :
                    recipe.status === 'complete' ? <Icon name="checkCircle" size={12} strokeWidth={2} /> :
                    recipe.status === 'to try' ? <Icon name="bookMarked" size={12} strokeWidth={2} /> : null}
                  </button>
                </div>
              )}

              {/* Combined edit popover — opens from either chip */}
              {isEdit('meta-tags') && (
                <div className="rp2__hero-tag-wrap">
                  <div className="rp2__hero-dark-popover" style={{ minWidth: 340 }}>

                    <p className="rp2__dark-pop-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</p>
                    <div className="rp2__dark-pop-chips">
                      <button className={`rp2__dark-chip ${draftMeta.cuisine === '' ? 'rp2__dark-chip--on' : ''}`}
                        onClick={() => setDraftMeta(p => ({...p, cuisine: ''}))}>None</button>
                      {GEO_CUISINES.map(c => (
                        <button key={c} className={`rp2__dark-chip ${draftMeta.cuisine === c ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => setDraftMeta(p => ({...p, cuisine: c}))}>{c}</button>
                      ))}
                    </div>

                    <p className="rp2__dark-pop-label" style={{ marginTop: 10 }}><Icon name="tag" size={13} strokeWidth={2} /> Tags</p>
                    <div className="rp2__dark-pop-chips">
                      {TAG_FILTERS.map(({ key, label }) => (
                        <button key={key} className={`rp2__dark-chip ${(draftMeta.tags || []).includes(key) ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => toggleDraftTag(key)}>{label}</button>
                      ))}
                    </div>

                    <p className="rp2__dark-pop-label" style={{ marginTop: 10 }}><Icon name="list" size={13} strokeWidth={2} /> Progress</p>
                    <div className="rp2__dark-pop-chips">
                      {[
                        { key: '', label: '-- None' },
                        { key: 'complete', label: 'Complete' },
                        { key: 'needs tweaking', label: 'Needs Tweaking' },
                        { key: 'to try', label: 'To Try' },
                        { key: 'incomplete', label: 'Incomplete' },
                      ].map(({ key, label }) => (
                        <button key={key} className={`rp2__dark-chip ${draftMeta.status === key ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => setDraftMeta(p => ({...p, status: key}))}>{label}</button>
                      ))}
                    </div>

                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>
                        {saving ? '...' : '✓ Save'}
                      </button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Pills -- time and servings are clickable, nutrition is display-only */}
            <div className="rp2__hero-pills">

              {/* Time pill -- hide if empty for guests */}
              {(isAdmin || recipe.time) && <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-time') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-time') ? null : 'meta-time'); }}>
                  <span className="rp2__pill-icon"><Icon name="clock" size={13} strokeWidth={2} /></span>
                  {recipe.time || <span style={{opacity:0.6}}>+ Time</span>}
                </button>
                {isEdit('meta-time') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label"><Icon name="clock" size={13} strokeWidth={2} /> Cook Time</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.time}
                      onChange={e => setDraftMeta(p => ({...p, time: e.target.value}))}
                      placeholder="e.g. 45 mins"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>}

              {/* Servings pill -- hide if empty for guests */}
              {(isAdmin || recipe.servings) && <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-servings') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-servings') ? null : 'meta-servings'); }}>
                  <span className="rp2__pill-icon"><Icon name="utensils" size={13} strokeWidth={2} /></span>
                  {recipe.servings ? `${recipe.servings} srv` : <span style={{opacity:0.6}}>+ Servings</span>}
                </button>
                {isEdit('meta-servings') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.servings}
                      onChange={e => setDraftMeta(p => ({...p, servings: e.target.value}))}
                      placeholder="e.g. 4"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>}

              {/* Calories pill */}
              {(isAdmin || recipe.calories) && <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-calories') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-calories') ? null : 'meta-calories'); }}>
                  <span className="rp2__pill-icon"><Icon name="flame" size={13} strokeWidth={2} /></span>
                  {recipe.calories ? `${recipe.calories} cal` : <span style={{opacity:0.6}}>+ Calories</span>}
                </button>
                {isEdit('meta-calories') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label"><Icon name="flame" size={13} strokeWidth={2} /> Calories per serving</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.calories}
                      onChange={e => setDraftMeta(p => ({...p, calories: e.target.value}))}
                      placeholder="e.g. 450"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>}

            </div>
          </div>
        </div>
      </div>

      {/* -- Title -- */}
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
          {isAdmin && <SectionPencil isEditing={isEdit('title')} onEdit={() => startEdit('title')} onSave={() => saveSection('title')} onCancel={cancelEdit} saving={saving} />}
          <div className="rp2__title-row-actions">
            <button
              className={`rp2__cooking-mode-btn ${stayAwake ? 'rp2__cooking-mode-btn--on' : ''}`}
              onClick={() => setStayAwake(s => !s)}
              title={stayAwake ? 'Screen will stay on -- click to disable' : 'Keep screen awake while cooking'}
            >
              {stayAwake ? <><Icon name="sun" size={14} strokeWidth={2} /> Awake</> : <Icon name="sun" size={14} strokeWidth={2} />}
            </button>
            {isAdmin && <button className="rp2__delete-btn" onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }} title="Delete recipe"><Icon name="trash2" size={15} strokeWidth={2} color="var(--warm-gray)" /></button>}
          </div>
        </div>

        {/* -- Dietary Conflict Warnings -- */}
        {dietaryWarnings.length > 0 && (
          <div className="dietary-warnings">
            {dietaryWarnings.map((w, i) => (
              <div key={i} className="dietary-warning">
                <span className="dietary-warning__icon">âš ï¸</span>
                <div className="dietary-warning__body">
                  <span className="dietary-warning__title">Contains {w.label}</span>
                  {w.conflicts.length > 1 ? (
                    <ul className="dietary-warning__list">
                      {w.conflicts.map((c, j) => <li key={j}>{c}</li>)}
                    </ul>
                  ) : (
                    <span className="dietary-warning__detail"> -- {w.conflicts[0]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Cookbook Reference Card -- shown INSTEAD of the two-column body for refs -- */}
      {recipe.cookbook && (!bodyIngredients?.length) && (!instructions?.length) && (
        <div className="rp2__body">
          <div className="rp2__cb-ref-view">
            <div className="rp2__cb-ref-card">
              <div className="rp2__cb-ref-card__icon"><Icon name="bookOpen" size={28} color="var(--terracotta)" strokeWidth={1.5} /></div>
              <div className="rp2__cb-ref-card__content">
                <p className="rp2__cb-ref-card__label">Find this recipe in</p>
                <h3 className="rp2__cb-ref-card__book">{recipe.cookbook}</h3>
                {recipe.reference && (
                  <p className="rp2__cb-ref-card__page">Page {recipe.reference}</p>
                )}
              </div>
            </div>
            <div className="rp2__cb-ref-convert">
              <p className="rp2__cb-ref-convert__hint">Ready to save the full recipe?</p>
              <ConvertRefButton recipe={recipe} allIngredients={allIngredients} cookbooks={cookbooks} onConverted={onSaved} authFetch={apiFetch} />
            </div>
          </div>
        </div>
      )}

      {/* -- Two-column body (only shown for full recipes) -- */}
      {!(recipe.cookbook && (!bodyIngredients?.length) && (!instructions?.length)) && (
      <div className="rp2__body">
        {showIngredientsModal && createPortal((() => {
          const vw = window.innerWidth, vh = window.innerHeight;
          const isMobile = vw <= 640;
          const mw = isMobile ? vw : Math.min(920, vw - 32);
          const mh = isMobile
            ? `calc(100dvh - ${60}px - env(safe-area-inset-top, 0px))`
            : `min(85dvh, ${vh - 40}px)`;
          return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 8999,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: isMobile ? 'stretch' : 'center',
              paddingTop: isMobile ? `calc(60px + env(safe-area-inset-top, 0px))` : 20,
              paddingBottom: isMobile ? 0 : 20,
              paddingLeft: isMobile ? 0 : 16,
              paddingRight: isMobile ? 0 : 16,
            }}
            onClick={() => { setShowIngredientsModal(false); cancelEdit(); }}
          >
            <div className="ing-modal ing-modal--wide" style={{ maxWidth: mw, maxHeight: mh, width: isMobile ? '100%' : undefined }} onClick={e => e.stopPropagation()}>
              <div className="ing-modal__header">
                <h2 className="ing-modal__title">Edit Ingredients</h2>
                <div className="ing-modal__header-actions">
                  {isEdit('ingredients') ? (
                    <>
                      <button className="ing-modal__save-btn" onClick={async () => { await saveSection('ingredients'); setShowIngredientsModal(false); }} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="ing-modal__close" onClick={() => { setShowIngredientsModal(false); cancelEdit(); }}>✕</button>
                    </>
                  ) : (
                    <button className="ing-modal__close" onClick={() => setShowIngredientsModal(false)}>✕</button>
                  )}
                </div>
              </div>
              <div className="ing-modal__body">
                <DndContext
                  sensors={ingDndSensors}
                  collisionDetection={closestCenter}
                  onDragStart={() => haptic([8])}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    setDraftIngs(prev => arrayMove(prev, prev.findIndex(i => i._id === active.id), prev.findIndex(i => i._id === over.id)));
                  }}
                >
                  <SortableContext items={draftIngs.map(i => i._id)} strategy={verticalListSortingStrategy}>
                    <div className="ing-flat-list">
                      {/* Column headers -- desktop only */}
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
                      {draftIngs.map((ing) => {
                        if (ing._isGroup) {
                          // Group separator row
                          return (
                            <IngGroupRow key={ing._id} ing={ing}
                              onLabelChange={v => setDraftIngs(prev => prev.map(i => i._id === ing._id ? {...i, name: v} : i))}
                              onRemove={() => setDraftIngs(prev => prev.filter(i => i._id !== ing._id))}
                              onAddIngredient={() => setDraftIngs(prev => {
                                const groupName = ing.name;
                                // Find the last ingredient that belongs to this group
                                let insertIdx = prev.findIndex(i => i._id === ing._id);
                                for (let j = insertIdx + 1; j < prev.length; j++) {
                                  if (prev[j]._isGroup) break; // hit next group
                                  insertIdx = j; // last ingredient in this group
                                }
                                const newIng = { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: groupName };
                                const next = [...prev];
                                next.splice(insertIdx + 1, 0, newIng);
                                return next;
                              })}
                            />
                          );
                        }
                        return (
                          <IngFlatRow key={ing._id} ing={ing}
                            onUpdate={(k, v) => updateDraftIng(ing._id, k, v)}
                            onRemove={() => removeDraftIng(ing._id)}
                            allIngredients={allIngredients}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="ing-flat-add-row">
                  <button className="btn btn--ghost editor-add-btn" onClick={() => setDraftIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }])}>+ Add Ingredient</button>
                  <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setDraftIngs(prev => [...prev, { _id: `grp-${Date.now()}`, _isGroup: true, name: 'New Group' }])}>+ Add Group</button>
                </div>
              </div>
            </div>
          </div>
          );
        })(), document.body)}

        {/* -- Ingredients -- */}
        <div className="rp2__ingredients">
          <div className="rp2__section-title-row">
            <h2 className="rp2__section-title rp2__section-title--sm">Ingredients</h2>
            {isAdmin && <button className="section-pencil" onClick={e => { startEdit('ingredients'); setShowIngredientsModal(true); }} title="Edit ingredients">✎</button>}
          </div>

          {ingredientGroups.length > 0
            ? ingredientGroups.map(({ label, items }) => (
                <div key={label || '__default'} className="rp2__ing-group">
                  {label && <p className="rp2__ing-group-label">{label}</p>}
                  <ul className="rp2__ing-list">
                    {items.map((ing, idx) => {
                      const key = `${label}-${idx}`;
                      const isChecked = checkedIngredients.has(key);
                      const amountStr = [ing.amount, ing.unit].filter(Boolean).join(' ');
                      return (
                        <IngredientItem
                          key={key}
                          ing={ing}
                          isChecked={isChecked}
                          amountStr={amountStr}
                          onToggle={() => toggleIngredient(key)}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))
            : <div className="rp2__empty-state">
                <Icon name="list" size={28} strokeWidth={1.5} color="var(--ash)" />
                <p>No ingredients added yet</p>
              </div>
          }
        </div>

        {/* -- Instructions -- */}
        <div className="rp2__instructions">
          <div className="rp2__section-title-row">
            <h2 className="rp2__section-title rp2__section-title--sm">Instructions</h2>
            {!isEdit('instructions') && totalSteps > 0 && (
              <span className="rp2__progress-label rp2__progress-label--right">{doneCount}/{totalSteps} steps</span>
            )}
            {isAdmin && <SectionPencil
              isEditing={isEdit('instructions')}
              onEdit={() => startEdit('instructions')}
              onSave={() => saveSection('instructions')}
              onCancel={cancelEdit}
              saving={saving}
            />}
          </div>

          {!isEdit('instructions') && totalSteps > 0 && (
            <div className="rp2__progress-bar">
              <div className="rp2__progress-fill" style={{ width: `${(doneCount / totalSteps) * 100}%` }} />
            </div>
          )}

          {/* Inline editor — desktop and mobile */}
          {isEdit('instructions') ? (
            <div className="rp2__inline-editor">
              <DndContext sensors={rpSensors} collisionDetection={closestCenter} onDragStart={() => haptic([8])} onDragEnd={onDraftStepDragEnd}>
                <SortableContext items={draftSteps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                  {draftSteps.map((item, idx) => {
                    if (item._isGroup) {
                      // Add a new step directly at the bottom of this group
                      const addToGroup = () => {
                        const grpName = item.name || '';
                        // Find the last step belonging to this group
                        let insertIdx = idx;
                        for (let j = idx + 1; j < draftSteps.length; j++) {
                          const s = draftSteps[j];
                          if (s._isGroup) break; // next group header — stop
                          if (!s._isTimer && s.group_label !== grpName) break; // step not in this group
                          insertIdx = j;
                        }
                        const newStep = { _id: `step-new-${Date.now()}`, body_text: '', timer_seconds: null, group_label: grpName };
                        setDraftSteps(prev => {
                          const next = [...prev];
                          next.splice(insertIdx + 1, 0, newStep);
                          return next;
                        });
                      };
                      return (
                        <StepGroupRow
                          key={item._id}
                          grp={item}
                          onLabelChange={v => setDraftSteps(prev => {
                            // Also update group_label on all steps that belong to this group
                            const oldName = item.name || '';
                            return prev.map(s =>
                              s._id === item._id ? { ...s, name: v } :
                              (!s._isGroup && !s._isTimer && s.group_label === oldName) ? { ...s, group_label: v } : s
                            );
                          })}
                          onRemove={() => setDraftSteps(prev => {
                            // Remove header but ungroup its steps (don't delete them)
                            const grpName = item.name || '';
                            return prev
                              .filter(s => s._id !== item._id)
                              .map(s => (!s._isGroup && !s._isTimer && s.group_label === grpName) ? { ...s, group_label: null } : s);
                          })}
                          onAddStep={addToGroup}
                        />
                      );
                    }

                    if (item._isTimer) {
                      return (
                        <div key={item._id} className="rp2__ed-timer-row" style={{ marginLeft: item.group_label ? 20 : 0 }}>
                          <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                          <div className="rp2__ed-timer-row__inputs">
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? {...s, h: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">h</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? {...s, m: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">m</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? {...s, s: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">s</span>
                          </div>
                          <button className="editor-remove-btn" onClick={() => {
                            setDraftSteps(prev => {
                              const i2 = prev.findIndex(s => s._id === item._id);
                              const next = prev.filter(s => s._id !== item._id);
                              if (i2 > 0 && !prev[i2 - 1]._isTimer) {
                                return next.map(s => s._id === prev[i2 - 1]._id ? { ...s, timer_seconds: null } : s);
                              }
                              return next;
                            });
                          }}>✕</button>
                        </div>
                      );
                    }

                    // Regular step — snap/unsnap into nearest group above
                    const isGrouped = !!item.group_label;
                    const stepNum = draftSteps.slice(0, idx).filter(s => !s._isTimer && !s._isGroup).length + 1;

                    // Find the nearest group header directly above (scanning through timers only)
                    // Also find any group in the whole list so we know if groups exist at all
                    let nearestGroupAbove = null;
                    for (let j = idx - 1; j >= 0; j--) {
                      if (draftSteps[j]._isGroup) { nearestGroupAbove = draftSteps[j].name || ''; break; }
                      if (!draftSteps[j]._isTimer) break;
                    }
                    // Show snap-in if ungrouped AND any group header exists anywhere above
                    const anyGroupAbove = !isGrouped && draftSteps.slice(0, idx).some(s => s._isGroup);
                    // Use nearest group if directly above, otherwise use last group defined above
                    if (!nearestGroupAbove && anyGroupAbove) {
                      for (let j = idx - 1; j >= 0; j--) {
                        if (draftSteps[j]._isGroup) { nearestGroupAbove = draftSteps[j].name || ''; break; }
                      }
                    }
                    const canSnap = !isGrouped && anyGroupAbove;

                    const handleSnap = () => setDraftSteps(prev =>
                      prev.map(s => s._id === item._id ? { ...s, group_label: nearestGroupAbove } : s)
                    );
                    const handleUnsnap = () => setDraftSteps(prev =>
                      prev.map(s => s._id === item._id ? { ...s, group_label: null } : s)
                    );

                    return (
                      <StepSortableItem key={item._id} id={item._id} stepNum={stepNum} grouped={isGrouped}
                        onSnap={handleSnap} onUnsnap={handleUnsnap} canSnap={canSnap}>
                        <AutoGrowTextarea className="editor-textarea" value={item.body_text} onChange={e => updateDraftStep(item._id, e.target.value)} placeholder="Describe this step..." minRows={2} />
                        {/* Timer + tip buttons stacked vertically */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          <button className="rp2__ed-add-timer-btn" onClick={() => addTimerAfterStep(item._id)} title="Add timer after this step"><Icon name="timer" size={13} strokeWidth={2} /></button>
                          <button
                            className="rp2__ed-add-timer-btn"
                            onClick={e => { e.stopPropagation(); setDraftSteps(prev => prev.map(s => s._id === item._id ? { ...s, _showTip: !s._showTip, _tipAnchor: e.currentTarget.getBoundingClientRect() } : s)); }}
                            title="Add tip to this step"
                            style={{ color: item._tip ? 'var(--terracotta)' : undefined, opacity: item._tip ? 1 : undefined }}
                          ><Icon name="lightbulb" size={13} strokeWidth={2} /></button>
                        </div>
                        <button className="editor-remove-btn" onClick={() => removeDraftStep(item._id)}>✕</button>
                        {/* Tip popup portal */}
                        {item._showTip && createPortal((() => {
                          const ar = item._tipAnchor;
                          const pw = 300, ph = 160;
                          const vw = window.innerWidth, vh = window.innerHeight;
                          let top = ar ? ar.bottom + 6 : vh / 2 - ph / 2;
                          let left = ar ? ar.left - pw + ar.width : vw / 2 - pw / 2;
                          if (top + ph > vh - 8) top = ar ? ar.top - ph - 6 : 8;
                          if (left < 8) left = 8;
                          if (left + pw > vw - 8) left = vw - pw - 8;
                          return (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 8998 }} onClick={() => setDraftSteps(prev => prev.map(s => s._id === item._id ? { ...s, _showTip: false } : s))} />
                              <div className="anchored-popover" style={{ position: 'fixed', top, left, width: pw, zIndex: 8999, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
                                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>Tip for this step</label>
                                <textarea
                                  className="editor-textarea"
                                  autoFocus
                                  rows={3}
                                  style={{ fontSize: 13, resize: 'none' }}
                                  value={item._tip || ''}
                                  onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? { ...s, _tip: e.target.value } : s))}
                                  placeholder="e.g. don't overcrowd the pan..."
                                />
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                  {item._tip && <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setDraftSteps(prev => prev.map(s => s._id === item._id ? { ...s, _tip: '', _showTip: false } : s))}>Clear</button>}
                                  <button className="btn btn--primary btn--sm" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setDraftSteps(prev => prev.map(s => s._id === item._id ? { ...s, _showTip: false } : s))}>Done</button>
                                </div>
                              </div>
                            </>
                          );
                        })(), document.body)}
                      </StepSortableItem>
                    );
                  })}
                </SortableContext>
              </DndContext>
              <div className="ing-flat-add-row">
                <button className="btn btn--ghost editor-add-btn" onClick={addDraftStep}>+ Add Step</button>
                <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setDraftSteps(prev => [...prev, { _id: `step-grp-${Date.now()}`, _isGroup: true, name: '' }])}>+ Add Group</button>
              </div>
            </div>
          ) : null}

          {/* Read-only steps view */}
          {!isEdit('instructions') && (
            instructions?.length > 0
              ? (() => {
                  const sorted = [...instructions].sort((a, b) => a.step_number - b.step_number);
                  const sortedUndone = sorted.filter(s => !doneSteps.has(s.step_number));
                  // Group steps — ungrouped steps interleaved with grouped sections
                  const sections = [];
                  for (const step of sorted) {
                    const lbl = step.group_label || '';
                    const last = sections[sections.length - 1];
                    if (!last || last.label !== lbl) sections.push({ label: lbl, steps: [step] });
                    else last.steps.push(step);
                  }
                  return (
                    <div className="rp2__steps-outer">
                      {sections.map((sec, si) => (
                        <div key={si} className={sec.label ? 'rp2__step-section' : 'rp2__step-section rp2__step-section--ungrouped'}>
                          {sec.label && <p className="rp2__step-section-label">{sec.label}</p>}
                          <ol className="rp2__steps">
                            {sec.steps.map((step, listIdx) => {
                              const done = doneSteps.has(step.step_number);
                              const isCurrent = !done && sortedUndone[0]?.step_number === step.step_number;
                              const isFirst = sorted[0]?.step_number === step.step_number;
                              const enlarge = isFirst && doneCount === 0 ? true : isCurrent;
                              const stepText = (step.body_text || '').toLowerCase();
                              const matchedNotes = cookingNotes.filter(n =>
                                (n.keywords || []).some(kw => stepText.includes(kw.toLowerCase()))
                              );
                              return (
                                <StepItem
                                  key={step.step_number}
                                  step={step}
                                  done={done}
                                  isCurrent={isCurrent}
                                  enlarge={enlarge}
                                  grouped={!!sec.label}
                                  onToggle={() => toggleStep(step.step_number)}
                                  matchedNotes={matchedNotes}
                                />
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                    </div>
                  );
                })()
              : <div className="rp2__empty-state">
                  <Icon name="bookOpen" size={28} strokeWidth={1.5} color="var(--ash)" />
                  <p>No instructions added yet</p>
                </div>
          )}

          {/* -- Notes + Cookbook -- side by side (desktop), stacked (mobile) -- */}
          <div className="rp2__notes-row">
            <div className="rp2__notes">
              <div className="rp2__section-title-row">
                <h2 className="rp2__section-title rp2__section-title--sm">Notes &amp; Tips</h2>
                {isAdmin && (
                  <span className="section-pencil-wrap">
                    {isEdit('notes') && !showNotesModal ? (
                      <>
                        <button className="section-pencil section-pencil--confirm" onClick={() => saveSection('notes')} disabled={saving} title={saving ? 'Saving...' : 'Save'}>{saving ? '...' : '✓'}</button>
                        <button className="section-pencil section-pencil--cancel" onClick={() => { cancelEdit(); setShowNotesModal(false); }} title="Cancel">✕</button>
                      </>
                    ) : (
                      <button className="section-pencil" onClick={e => { e.stopPropagation(); startEdit('notes'); if (window.innerWidth <= 640) { setNotesAnchorRect(e.currentTarget.getBoundingClientRect()); setShowNotesModal(true); } }} title="Edit">✎</button>
                    )}
                  </span>
                )}
              </div>

              {/* Read-only notes display */}
              {!isEdit('notes') && (
                notes?.length > 0
                  ? <ul className="rp2__notes-list">
                      {notes.map((n, i) => (
                        <li key={i} className="rp2__notes-item">{n.text ?? n.body_text ?? n}</li>
                      ))}
                    </ul>
                  : <div className="rp2__empty-state">
                      <Icon name="lightbulb" size={24} strokeWidth={1.5} color="var(--ash)" />
                      <p>No notes yet</p>
                    </div>
              )}

              {/* Desktop inline edit with drag-to-reorder */}
              {isEdit('notes') && !showNotesModal && (
                <div className="rp2__inline-editor">
                  <DndContext sensors={rpSensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                    if (over && active.id !== over.id) setDraftNotes(prev => arrayMove(prev, prev.findIndex(n => n._id === active.id), prev.findIndex(n => n._id === over.id)));
                  }}>
                    <SortableContext items={draftNotes.map(n => n._id)} strategy={verticalListSortingStrategy}>
                      {draftNotes.map(n => (
                        <SortableNoteRow key={n._id} note={n} onUpdate={v => updateDraftNote(n._id, v)} onRemove={() => removeDraftNote(n._id)} />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <button className="btn btn--ghost editor-add-btn" onClick={addDraftNote}>+ Add Note</button>
                </div>
              )}

              {/* Notes popover — portal anchored near the pencil icon */}
              {showNotesModal && isEdit('notes') && createPortal((() => {
                const pw = 360, ph = 400;
                const vw = window.innerWidth, vh = window.innerHeight;
                const ar = notesAnchorRect;
                let top, left;
                if (ar) {
                  top = ar.bottom + 8;
                  left = ar.right - Math.min(pw, vw - 16);
                  if (top + ph > vh - 8) top = Math.max(8, ar.top - ph - 8);
                  if (left < 8) left = 8;
                  if (left + Math.min(pw, vw - 16) > vw - 8) left = vw - Math.min(pw, vw - 16) - 8;
                } else {
                  top = Math.max(8, (vh - ph) / 2);
                  left = Math.max(8, (vw - Math.min(pw, vw - 16)) / 2);
                }
                const w = Math.min(pw, vw - 16);
                return (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 8999 }} onClick={() => { cancelEdit(); setShowNotesModal(false); }} />
                    <div className="anchored-popover create-modal" style={{ position: 'fixed', top, left, width: w, maxHeight: ph, zIndex: 9000 }} onClick={e => e.stopPropagation()}>
                      <div className="create-modal__header">
                        <h2 className="create-modal__title"><Icon name="note" size={18} strokeWidth={2} /> Notes &amp; Tips</h2>
                        <button className="ing-modal__close" onClick={() => { cancelEdit(); setShowNotesModal(false); }}>✕</button>
                      </div>
                      <div className="create-modal__body" style={{ gap: 10, overflowY: 'auto', maxHeight: ph - 120 }}>
                        {draftNotes.map((n, idx) => (
                          <div key={n._id} className="rp2__ed-note-row">
                            <input className="editor-input" style={{ flex: 1, fontSize: 16 }} value={n.text} onChange={e => updateDraftNote(n._id, e.target.value)} placeholder="Add a tip or note..." autoFocus={idx === 0} />
                            <button className="editor-remove-btn" onClick={() => removeDraftNote(n._id)}>✕</button>
                          </div>
                        ))}
                        <button className="btn btn--ghost editor-add-btn" onClick={addDraftNote}>+ Add Note</button>
                      </div>
                      <div className="create-modal__footer">
                        <button className="btn btn--ghost" onClick={() => { cancelEdit(); setShowNotesModal(false); }}>Cancel</button>
                        <button className="btn btn--primary" onClick={async () => { await saveSection('notes'); setShowNotesModal(false); }} disabled={saving}>{saving ? 'Saving...' : '✓ Save'}</button>
                      </div>
                    </div>
                  </>
                );
              })(), document.body)}
            </div>

            {/* Cookbook Reference -- editable */}
            <div className="rp2__cookbook">
              <div className="rp2__section-title-row">
                <h2 className="rp2__section-title rp2__cookbook-title">Cookbook</h2>
                {isAdmin && (
                  <span className="section-pencil-wrap">
                    {isEdit('cookbook') && !showCookbookModal ? (
                      <>
                        <button className="section-pencil section-pencil--confirm" onClick={() => saveSection('cookbook')} disabled={saving} title={saving ? 'Saving...' : 'Save'}>{saving ? '...' : '✓'}</button>
                        <button className="section-pencil section-pencil--cancel" onClick={() => { cancelEdit(); setShowCookbookModal(false); }} title="Cancel">✕</button>
                      </>
                    ) : (
                      <button className="section-pencil" onClick={e => { e.stopPropagation(); startEdit('cookbook'); if (window.innerWidth <= 640) { setCookbookAnchorRect(e.currentTarget.getBoundingClientRect()); setShowCookbookModal(true); } }} title="Edit">✎</button>
                    )}
                  </span>
                )}
              </div>

              {/* Read-only cookbook display */}
              {!isEdit('cookbook') && ((recipe.cookbook || recipe.reference) ? (
                <div className="rp2__cookbook-text">
                  <span className="rp2__cookbook-text__book">{recipe.cookbook}</span>
                  {recipe.reference && <span className="rp2__cookbook-text__page">Page {recipe.reference}</span>}
                </div>
              ) : (
                <p className="rp2__empty-hint">No reference yet. Click ✎ to add.</p>
              ))}

              {/* Desktop inline edit (fallback when modal not open) */}
              {isEdit('cookbook') && !showCookbookModal && (
                <div className="rp2__cookbook-editor">
                  <CookbookAutocomplete value={draftCookbook.cookbook} onChange={v => setDraftCookbook(p => ({...p, cookbook: v}))} cookbooks={cookbooks} />
                  <input className="editor-input" value={draftCookbook.reference} onChange={e => setDraftCookbook(p => ({...p, reference: e.target.value}))} placeholder="Page number" style={{marginTop: 6}} />
                </div>
              )}

              {/* Cookbook popover — portal anchored near the pencil icon */}
              {showCookbookModal && isEdit('cookbook') && createPortal((() => {
                const pw = 320, ph = 260;
                const vw = window.innerWidth, vh = window.innerHeight;
                const ar = cookbookAnchorRect;
                let top, left;
                if (ar) {
                  top = ar.bottom + 8;
                  left = ar.right - Math.min(pw, vw - 16);
                  if (top + ph > vh - 8) top = Math.max(8, ar.top - ph - 8);
                  if (left < 8) left = 8;
                  if (left + Math.min(pw, vw - 16) > vw - 8) left = vw - Math.min(pw, vw - 16) - 8;
                } else {
                  top = Math.max(8, (vh - ph) / 2);
                  left = Math.max(8, (vw - Math.min(pw, vw - 16)) / 2);
                }
                const w = Math.min(pw, vw - 16);
                return (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 8999 }} onClick={() => { cancelEdit(); setShowCookbookModal(false); }} />
                    <div className="anchored-popover create-modal" style={{ position: 'fixed', top, left, width: w, zIndex: 9000 }} onClick={e => e.stopPropagation()}>
                      <div className="create-modal__header">
                        <h2 className="create-modal__title"><Icon name="bookMarked" size={18} strokeWidth={2} /> Cookbook</h2>
                        <button className="ing-modal__close" onClick={() => { cancelEdit(); setShowCookbookModal(false); }}>✕</button>
                      </div>
                      <div className="create-modal__body" style={{ gap: 14 }}>
                        <div className="create-modal__field">
                          <label className="create-modal__field-label">Cookbook title</label>
                          <CookbookAutocomplete value={draftCookbook.cookbook} onChange={v => setDraftCookbook(p => ({...p, cookbook: v}))} cookbooks={cookbooks} />
                        </div>
                        <div className="create-modal__field">
                          <label className="create-modal__field-label">Page number</label>
                          <input className="editor-input" style={{ fontSize: 16 }} value={draftCookbook.reference} onChange={e => setDraftCookbook(p => ({...p, reference: e.target.value}))} placeholder="e.g. 142" />
                        </div>
                      </div>
                      <div className="create-modal__footer">
                        <button className="btn btn--ghost" onClick={() => { cancelEdit(); setShowCookbookModal(false); }}>Cancel</button>
                        <button className="btn btn--primary" onClick={async () => { await saveSection('cookbook'); setShowCookbookModal(false); }} disabled={saving}>{saving ? 'Saving...' : '✓ Save'}</button>
                      </div>
                    </div>
                  </>
                );
              })(), document.body)}
            </div>
          </div>
        </div>
      </div>
      )}
    </main>
  );
};


// --- Recipe Editor ----------------------------------------------------------

export default RecipePage;
