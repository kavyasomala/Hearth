import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

import { Icon } from './icons';
import {
  API, COMMON_UNITS, TAG_FILTERS, PROGRESS_FILTERS, QUICK_CHIP_KEYS,
  GEO_CUISINES, CUISINE_ICON, ALL_CUISINES,
  DIETARY_OPTIONS, DIETARY_CONFLICTS, THEME_OPTIONS, STAR_LABELS,
  UNIT_CONVERSIONS, WEIGHT_UNITS, VOLUME_UNITS,
} from './constants';
import {
  LS, haptic, pct, toNum, pluralizeIng, checkDietaryConflicts,
  getDaysInMonth, getFirstDayOfMonth,
  unitType, formatWeight, formatVolume, consolidateItems,
} from './utils';
import {
  DRAG_SENSORS, ErrorBoundary, useAnchoredPopover, AnchoredPopover,
  HScrollRow, Badge, SectionPencil, AutoGrowTextarea,
} from './components/ui';
import KitchenTab from './KitchenTab';
import RecipeCard from './components/RecipeCard';
import MarkCookedModal from './components/MarkCookedModal';
import { HeroImage, HeroTagsButton } from './components/HeroComponents';
import {
  IngredientAutocomplete, UnitAutocomplete,
  SortableItem, StepSortableItem, StepGroupRow,
  IngFlatRow, IngGroupRow,
} from './components/IngredientEditor';
import ConvertRefButton from './components/ConvertRefButton';

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

  // rAF loop â€” reads from wall clock, works even after tab becomes hidden then visible
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
      <div className="rp2__step-num">{done ? 'âœ“' : step.step_number}</div>
      <div className="rp2__step-content">
        <div className="rp2__step-body-row">
          <p className="rp2__step-body">{cleanStepBody}</p>
          {(matchedNotes.length > 0 || manualTip) && (
            <div className="rp2__step-hints">
              <div className="rp2__step-hint-wrap">
                <button
                  className={`rp2__step-hint-btn ${showTips ? 'rp2__step-hint-btn--active' : ''}`}
                  onClick={e => { e.stopPropagation(); setShowTips(v => !v); }}
                  title={[...(manualTip ? ['Tip'] : []), ...matchedNotes.map(n => n.title)].join(' Â· ')}
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
                {timerState === 'done' ? 'âœ“ Done!' : fmtTime(remaining)}
              </span>
              {timerState === 'idle' && <button className="rp2__step-timer__btn rp2__step-timer__btn--start" onClick={startTimer}><Icon name="arrowRight" size={12} strokeWidth={2.5} /> Start</button>}
              {timerState === 'running' && <button className="rp2__step-timer__btn rp2__step-timer__btn--pause" onClick={pauseTimer}><Icon name="clock" size={12} strokeWidth={2.5} /> Pause</button>}
              {timerState === 'paused' && <button className="rp2__step-timer__btn rp2__step-timer__btn--start" onClick={startTimer}><Icon name="arrowRight" size={12} strokeWidth={2.5} /> Resume</button>}
              {timerState !== 'idle' && <button className="rp2__step-timer__btn rp2__step-timer__btn--reset" onClick={resetTimer}>â†º</button>}
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
      <span style={{ cursor: 'grab', fontSize: 16, color: 'var(--ash)', flexShrink: 0, userSelect: 'none', touchAction: 'none' }} {...attributes} {...listeners}>â ¿</span>
      <input className="editor-input" style={{ flex: 1 }} value={note.text} onChange={e => onUpdate(e.target.value)} placeholder="Add a tip or note..." />
      <button className="editor-remove-btn" onClick={onRemove}>âœ•</button>
    </div>
  );
};

// --- Recipe Page -------------------------------------------------------------
// â”€â”€â”€ Recipe Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (['meta','meta-cuisine','meta-tags','meta-progress','meta-time','meta-servings'].includes(section)) setDraftMeta({
      time: recipe.time || '',
      servings: recipe.servings || '',
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
        // Hit a regular step â€” check if IT is grouped under a header
        if (item.group_label) {
          // The step above is grouped â€” the dragged step is also in that group
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
  if (!recipe) return <main className="view"><div className="placeholder"><h2>Recipe not found</h2><button className="btn btn--ghost" onClick={onBack}>â† Back</button></div></main>;

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
              <button className="rp2__hero-btn" onClick={e => { e.stopPropagation(); onBack(); }}>â† Back</button>
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
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }} title="Change photo link">âœŽ
                  </button>
                  {isEdit('image') && (
                    <div className="rp2__img-popover-down">
                      <p className="rp2__dark-pop-label">Cover image URL</p>
                      <input className="editor-input" autoFocus value={draftImageInput}
                        onChange={e => setDraftImageInput(e.target.value)} placeholder="https://..."
                        onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }} />
                      <div className="rp2__dark-pop-actions">
                        <button className="rp2__dark-save" onClick={() => saveSection('image')} disabled={saving}>{saving ? '...' : 'âœ“ Save'}</button>
                        <button className="rp2__dark-cancel" onClick={cancelEdit}>âœ• Cancel</button>
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
                onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }} title="Change photo link">âœŽ
              </button>
              {isEdit('image') && (
                <div className="rp2__img-popover-down">
                  <p className="rp2__dark-pop-label">Cover image URL</p>
                  <input className="editor-input" autoFocus value={draftImageInput}
                    onChange={e => setDraftImageInput(e.target.value)} placeholder="https://..."
                    onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }} />
                  <div className="rp2__dark-pop-actions">
                    <button className="rp2__dark-save" onClick={() => saveSection('image')} disabled={saving}>{saving ? '...' : 'âœ“ Save'}</button>
                    <button className="rp2__dark-cancel" onClick={cancelEdit}>âœ• Cancel</button>
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

              {/* Combined edit popover â€” opens from either chip */}
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
                        {saving ? '...' : 'âœ“ Save'}
                      </button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>âœ•</button>
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
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : 'âœ“ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>âœ•</button>
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
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : 'âœ“ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>âœ•</button>
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
                      <button className="ing-modal__save-btn" onClick={async () => { await saveSection('ingredients'); setShowIngredientsModal(false); }} disabled={saving}>{saving ? '...' : 'âœ“ Save'}</button>
                      <button className="ing-modal__close" onClick={() => { setShowIngredientsModal(false); cancelEdit(); }}>âœ•</button>
                    </>
                  ) : (
                    <button className="ing-modal__close" onClick={() => setShowIngredientsModal(false)}>âœ•</button>
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
            {isAdmin && <button className="section-pencil" onClick={e => { startEdit('ingredients'); setShowIngredientsModal(true); }} title="Edit ingredients">âœŽ</button>}
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

          {/* Inline editor â€” desktop and mobile */}
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
                          if (s._isGroup) break; // next group header â€” stop
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
                          }}>âœ•</button>
                        </div>
                      );
                    }

                    // Regular step â€” snap/unsnap into nearest group above
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
                        <button className="editor-remove-btn" onClick={() => removeDraftStep(item._id)}>âœ•</button>
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
                  // Group steps â€” ungrouped steps interleaved with grouped sections
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
                        <button className="section-pencil section-pencil--confirm" onClick={() => saveSection('notes')} disabled={saving} title={saving ? 'Saving...' : 'Save'}>{saving ? '...' : 'âœ“'}</button>
                        <button className="section-pencil section-pencil--cancel" onClick={() => { cancelEdit(); setShowNotesModal(false); }} title="Cancel">âœ•</button>
                      </>
                    ) : (
                      <button className="section-pencil" onClick={e => { e.stopPropagation(); startEdit('notes'); if (window.innerWidth <= 640) { setNotesAnchorRect(e.currentTarget.getBoundingClientRect()); setShowNotesModal(true); } }} title="Edit">âœŽ</button>
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

              {/* Notes popover â€” portal anchored near the pencil icon */}
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
                        <button className="ing-modal__close" onClick={() => { cancelEdit(); setShowNotesModal(false); }}>âœ•</button>
                      </div>
                      <div className="create-modal__body" style={{ gap: 10, overflowY: 'auto', maxHeight: ph - 120 }}>
                        {draftNotes.map((n, idx) => (
                          <div key={n._id} className="rp2__ed-note-row">
                            <input className="editor-input" style={{ flex: 1, fontSize: 16 }} value={n.text} onChange={e => updateDraftNote(n._id, e.target.value)} placeholder="Add a tip or note..." autoFocus={idx === 0} />
                            <button className="editor-remove-btn" onClick={() => removeDraftNote(n._id)}>âœ•</button>
                          </div>
                        ))}
                        <button className="btn btn--ghost editor-add-btn" onClick={addDraftNote}>+ Add Note</button>
                      </div>
                      <div className="create-modal__footer">
                        <button className="btn btn--ghost" onClick={() => { cancelEdit(); setShowNotesModal(false); }}>Cancel</button>
                        <button className="btn btn--primary" onClick={async () => { await saveSection('notes'); setShowNotesModal(false); }} disabled={saving}>{saving ? 'Saving...' : 'âœ“ Save'}</button>
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
                        <button className="section-pencil section-pencil--confirm" onClick={() => saveSection('cookbook')} disabled={saving} title={saving ? 'Saving...' : 'Save'}>{saving ? '...' : 'âœ“'}</button>
                        <button className="section-pencil section-pencil--cancel" onClick={() => { cancelEdit(); setShowCookbookModal(false); }} title="Cancel">âœ•</button>
                      </>
                    ) : (
                      <button className="section-pencil" onClick={e => { e.stopPropagation(); startEdit('cookbook'); if (window.innerWidth <= 640) { setCookbookAnchorRect(e.currentTarget.getBoundingClientRect()); setShowCookbookModal(true); } }} title="Edit">âœŽ</button>
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
                <p className="rp2__empty-hint">No reference yet. Click âœŽ to add.</p>
              ))}

              {/* Desktop inline edit (fallback when modal not open) */}
              {isEdit('cookbook') && !showCookbookModal && (
                <div className="rp2__cookbook-editor">
                  <CookbookAutocomplete value={draftCookbook.cookbook} onChange={v => setDraftCookbook(p => ({...p, cookbook: v}))} cookbooks={cookbooks} />
                  <input className="editor-input" value={draftCookbook.reference} onChange={e => setDraftCookbook(p => ({...p, reference: e.target.value}))} placeholder="Page number" style={{marginTop: 6}} />
                </div>
              )}

              {/* Cookbook popover â€” portal anchored near the pencil icon */}
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
                        <button className="ing-modal__close" onClick={() => { cancelEdit(); setShowCookbookModal(false); }}>âœ•</button>
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
                        <button className="btn btn--primary" onClick={async () => { await saveSection('cookbook'); setShowCookbookModal(false); }} disabled={saving}>{saving ? 'Saving...' : 'âœ“ Save'}</button>
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
const RecipeEditor = ({ recipe, bodyIngredients, instructions, notes, allIngredients, onBack, onSaved, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();

  const [details, setDetails] = useState({
    name: recipe?.name || '',
    cuisine: recipe?.cuisine || '',
    time: recipe?.time || '',
    servings: recipe?.servings || '',
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
            <button className="rp2__hero-btn rp2__hero-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'âœ“ Save'}</button>
          </div>
          <div className="rp2__hero-bottom">
            <div className="rp2__hero-tags">{details.cuisine && <span className="rp2__tag">{details.cuisine}</span>}</div>
            <div className="rp2__hero-pills">
              {details.time && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="clock" size={13} strokeWidth={2} /></span>{details.time}</span>}
              {details.servings && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="utensils" size={13} strokeWidth={2} /></span>{details.servings} srv</span>}
            </div>
          </div>
        </div>
      </div>

      {saveError && <p className="editor-error" style={{margin:'8px 24px 0'}}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
      {saveSuccess && <p className="editor-success" style={{margin:'8px 24px 0'}}>âœ“ Saved successfully</p>}

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
                  <button className={`editor-optional-btn ${ing.optional ? 'editor-optional-btn--on' : ''}`} onClick={() => updateIng(ing._id, 'optional', !ing.optional)} title="Mark as optional">{ing.optional ? 'âœ“' : 'â—‹'}</button>
                  <button className="editor-remove-btn" onClick={() => removeIng(ing._id)}>âœ•</button>
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
                    <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>âœ•</button>
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
        <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
      </section>

      <section className="editor-section">
        <h3 className="editor-section__title">Notes &amp; Modifications</h3>
        {notesList.map(note => (
          <div key={note._id} className="editor-note-row">
            <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Works great with tofu instead of chicken" />
            <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>âœ•</button>
          </div>
        ))}
        <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
      </section>

      <div className="editor-save-bar">
        {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        {saveSuccess && <p className="editor-success">âœ“ Saved successfully</p>}
        <button className="btn btn--primary btn--large" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
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
        <span className="cuisine-dd__globe"><Icon name="globe" size={14} strokeWidth={2} /></span>
        <span className="cuisine-dd__label">{value || 'Cuisine'}</span>
        {value ? <span className="cuisine-dd__x" onMouseDown={clear}>âœ•</span> : <span className={`cuisine-dd__arrow ${open ? 'cuisine-dd__arrow--open' : ''}`}>â–¾</span>}
      </button>
      {open && (
        <div className="cuisine-dd__panel">
          <input className="cuisine-dd__search" autoFocus placeholder="Search cuisines..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="cuisine-dd__list">
            {filtered.map(c => (
              <button key={c} className={`cuisine-dd__option ${value === c ? 'cuisine-dd__option--active' : ''}`} onMouseDown={() => select(c)}>
                <span className="cuisine-dd__check">{value === c ? 'âœ“' : ''}</span>{c}
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

// --- Cookbook Autocomplete Input ------------------------------------------
const CookbookAutocomplete = ({ value, onChange, cookbooks = [] }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => {
    const val = value ?? '';
    if (!val.trim()) return cookbooks.slice(0, 6).map(c => c.title);
    const q = val.toLowerCase();
    return cookbooks
      .map(c => c.title)
      .filter(t => t.toLowerCase().includes(q))
      .slice(0, 6);
  }, [value, cookbooks]);

  useEffect(() => { setHighlighted(0); }, [suggestions]);
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (t) => { onChange(t); setOpen(false); };
  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && suggestions[highlighted]) { e.preventDefault(); select(suggestions[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="ing-ac-wrap" ref={wrapperRef}>
      <input className="editor-input" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="e.g. Ottolenghi Simple" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((t, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = t.toLowerCase().indexOf(q);
            return (
              <li key={t} className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`} onMouseDown={() => select(t)} onMouseEnter={() => setHighlighted(i)}>
                {idx >= 0 && q ? (<>{t.slice(0, idx)}<strong>{t.slice(idx, idx + q.length)}</strong>{t.slice(idx + q.length)}</>) : t}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// --- Profile Tab -------------------------------------------------------------
const AddFriendModal = ({ onClose, onCreated, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!username.trim() || !password) return setError('Username and password required.');
    setCreating(true); setError('');
    try {
      const res = await apiFetch(`${API}/api/auth/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, display_name: displayName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onCreated(data.user.username);
      onClose();
    } catch (e) { setError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--warm-white)', borderRadius: 16, padding: '24px 22px', width: '100%', maxWidth: 320, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--charcoal)' }}><Icon name="users" size={18} strokeWidth={2} /> Add a Friend</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--warm-gray)', lineHeight: 1, padding: '2px 4px' }}>Ã—</button>
        </div>
        {error && <div style={{ background: '#fff0ee', border: '1px solid #f5c2b8', borderRadius: 8, padding: '7px 10px', fontSize: '0.8rem', color: 'var(--terracotta-dark, #b84a2e)' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Username</label>
          <input className="editor-input" type="text" placeholder="e.g. priya" value={username}
            onChange={e => setUsername(e.target.value)} autoCapitalize="none" autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Password</label>
          <input className="editor-input" type="text" placeholder="Set a password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Display Name <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.7rem' }}>(optional)</span></label>
          <input className="editor-input" type="text" placeholder="e.g. Priya S." value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'none', border: '1.5px solid var(--border)', color: 'var(--warm-gray)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating}
            style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'var(--terracotta)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Adding...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€â”€ Profile Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ProfileTab = ({ recipes, dietaryFilters, setDietaryFilters, units, setUnits, totalRecipes, hideIncompatible, setHideIncompatible, authFetch, authUser, onLogout, onAuthUserUpdate, darkMode = false, setDarkMode, tabBarTabs, setTabBarTabs }) => {
  const apiFetch = authFetch || fetch;
  const isAdmin = authUser?.role === 'admin';
  const [cookHistory, setCookHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(() => LS.get('showComingSoon', true));
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugText, setBugText] = useState('');
  const [bugList, setBugList] = useState(() => LS.get('bugReports', []));
  const [bugSubmitted, setBugSubmitted] = useState(false);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [recalcRunning, setRecalcRunning] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);
  const [historyView, setHistoryView] = useState('timeline');
  const [calendarDate, setCalendarDate] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });

  // Display name editing
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  // Sharing state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendSuccess, setAddFriendSuccess] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});

  const toggleDiet = (d) => setDietaryFilters(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleReveal = (id) => setRevealedPasswords(p => ({ ...p, [id]: !p[id] }));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setHistoryLoading(true);
      try {
        const res = await apiFetch(`${API}/api/user/cook-log`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled) setCookHistory(data.entries || []);
      } catch { if (!cancelled) setCookHistory([]); }
      finally { if (!cancelled) setHistoryLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiFetch(`${API}/api/admin/users`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    finally { setUsersLoading(false); }
  };

  useEffect(() => {
    if (sharingOpen && isAdmin) loadUsers();
  }, [sharingOpen]); // eslint-disable-line

  const handleSaveDisplayName = async () => {
    setSavingDisplayName(true);
    try {
      await apiFetch(`${API}/api/user/display-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: draftDisplayName.trim() || null }),
      });
      if (onAuthUserUpdate) onAuthUserUpdate({ ...authUser, display_name: draftDisplayName.trim() || null });
    } catch {}
    finally { setSavingDisplayName(false); setEditingDisplayName(false); }
  };

  const handleSuspend = async (user) => {
    const newRole = user.role === 'suspended' ? 'guest' : 'suspended';
    await apiFetch(`${API}/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete ${user.username}? This removes all their data.`)) return;
    await apiFetch(`${API}/api/admin/users/${user.id}`, { method: 'DELETE' });
    loadUsers();
  };

  // Group history by month for timeline
  const groupedHistory = useMemo(() => {
    const groups = {};
    for (const entry of cookHistory) {
      const d = new Date(entry.cooked_at);
      const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups);
  }, [cookHistory]);

  // Recipe attempts: count per recipe
  const recipeCounts = useMemo(() => {
    const counts = {};
    for (const entry of cookHistory) {
      const key = entry.recipe_id || entry.recipe_name;
      if (!key) continue;
      if (!counts[key]) counts[key] = { name: entry.recipe_name, id: entry.recipe_id, count: 0, lastCooked: null };
      counts[key].count++;
      const d = new Date(entry.cooked_at);
      if (!counts[key].lastCooked || d > counts[key].lastCooked) counts[key].lastCooked = d;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [cookHistory]);

  // Calendar: cook dates for current month
  const cookDatesInMonth = useMemo(() => {
    const { year, month } = calendarDate;
    const set = {};
    for (const entry of cookHistory) {
      const d = new Date(entry.cooked_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!set[day]) set[day] = [];
        const r = recipes.find(r => r.id === entry.recipe_id);
        set[day].push(r?.name || entry.recipe_name || 'Unknown');
      }
    }
    return set;
  }, [cookHistory, calendarDate, recipes]);

  const getRecipeName = (entry) => {
    const r = recipes.find(r => r.id === entry.recipe_id);
    return r?.name || entry.recipe_name || 'Unknown Recipe';
  };

  const prevMonth = () => setCalendarDate(p => p.month === 0 ? { year: p.year-1, month: 11 } : { ...p, month: p.month-1 });
  const nextMonth = () => setCalendarDate(p => p.month === 11 ? { year: p.year+1, month: 0 } : { ...p, month: p.month+1 });
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <main className="view profile-view">
      {showAddFriend && (
        <AddFriendModal
          authFetch={authFetch}
          onClose={() => setShowAddFriend(false)}
          onCreated={(uname) => { setAddFriendSuccess(`Account created for ${uname} âœ“`); loadUsers(); setTimeout(() => setAddFriendSuccess(''), 4000); }}
        />
      )}
      {/* -- User header -- */}
      <div className="profile-header">
        <div style={{ flex: 1 }}>
          {editingDisplayName ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                autoFocus
                className="login-modal__input"
                style={{ margin: 0, flex: '1 1 140px', padding: '6px 10px', fontSize: '0.9rem' }}
                placeholder="Display name (or leave blank to use username)"
                value={draftDisplayName}
                onChange={e => setDraftDisplayName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveDisplayName(); if (e.key === 'Escape') setEditingDisplayName(false); }}
              />
              <button onClick={handleSaveDisplayName} disabled={savingDisplayName} className="display-name-save-btn">
                {savingDisplayName ? '...' : 'âœ“ Save'}
              </button>
              <button onClick={() => setEditingDisplayName(false)} className="display-name-cancel-btn">
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="profile-header__title" style={{ margin: 0 }}>{authUser?.display_name || authUser?.username || 'Your Kitchen'}</h2>
              <button onClick={() => { setDraftDisplayName(authUser?.display_name || ''); setEditingDisplayName(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }} title="Edit display name">âœŽ</button>
            </div>
          )}
          <p className="profile-header__sub" style={{ marginTop: 2 }}>
            {authUser?.display_name ? <span style={{ color: 'var(--warm-gray)', fontSize: '0.8rem' }}>@{authUser.username} Â· </span> : null}
            {totalRecipes} recipes Â· {cookHistory.length} times cooked{isAdmin ? ' Â· admin' : ''}
          </p>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 999, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--warm-gray)', cursor: 'pointer', flexShrink: 0 }}>
          Sign out
        </button>
      </div>

      {/* -- 1. Cooking History -- */}
      <section className="profile-section profile-section--collapsible">
        <button className="profile-settings-toggle" onClick={() => setHistoryOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="calendar" size={15} strokeWidth={2} /> Cooking History</span>
          <div className="profile-settings-toggle__right">
            {cookHistory.length > 0 && historyOpen && (
              <div className="history-view-toggle" onClick={e => e.stopPropagation()}>
                <button className={`history-view-toggle__btn ${historyView==='timeline'?'history-view-toggle__btn--on':''}`} onClick={() => setHistoryView('timeline')} title="Timeline view">â˜°</button>
                <button className={`history-view-toggle__btn ${historyView==='calendar'?'history-view-toggle__btn--on':''}`} onClick={() => setHistoryView('calendar')} title="Calendar view">â–¦</button>
              </div>
            )}
            <span className={`profile-settings-toggle__arrow ${historyOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </div>
        </button>

        {historyOpen && (
          <div className="profile-settings-body">
            {historyLoading ? (
              <div className="grocery-loading"><div className="loading-spinner" /><p>Loading history...</p></div>
            ) : cookHistory.length === 0 ? (
              <div className="profile-empty">
                <span className="profile-empty__icon"><Icon name="chefHat" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
                <p className="profile-empty__text">No cooking history yet. Mark a recipe as cooked to start your log!</p>
              </div>
            ) : historyView === 'timeline' ? (
              <div className="cook-timeline cook-timeline--scrollable">
                {groupedHistory.map(([month, entries]) => (
                  <div key={month} className="cook-timeline__month-group">
                    <div className="cook-timeline__month-label">{month}</div>
                    {entries.map((entry, i) => {
                      const d = new Date(entry.cooked_at);
                      const recipeName = getRecipeName(entry);
                      const recipe = recipes.find(r => r.id === entry.recipe_id);
                      return (
                        <div key={entry.id || i} className="cook-timeline__entry">
                          <div className="cook-timeline__dot" />
                          <div className="cook-timeline__line" />
                          <div className="cook-timeline__card">
                            <div className="cook-timeline__card-top">
                              {recipe?.coverImage ? (
                                <img className="cook-timeline__thumb" src={recipe.coverImage} alt={recipeName} />
                              ) : (
                                <div className="cook-timeline__thumb cook-timeline__thumb--placeholder"><Icon name="chefHat" size={18} color="var(--ash)" strokeWidth={1.5} /></div>
                              )}
                              <div className="cook-timeline__info">
                                <p className="cook-timeline__recipe-name">{recipeName}</p>
                                <p className="cook-timeline__date">{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                {entry.rating > 0 && (
                                  <div className="cook-timeline__rating">
                                    {'â˜…'.repeat(entry.rating)}<span className="cook-timeline__rating-empty">{'â˜…'.repeat(5 - entry.rating)}</span>
                                    <span className="cook-timeline__rating-label">{STAR_LABELS[entry.rating]}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {entry.notes && <p className="cook-timeline__notes">"{entry.notes}"</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="cook-calendar cook-calendar--gcal">
                <div className="cook-calendar__nav">
                  <button className="cook-calendar__nav-btn" onClick={prevMonth}>â€¹</button>
                  <span className="cook-calendar__month-label">{MONTH_NAMES[calendarDate.month]} {calendarDate.year}</span>
                  <button className="cook-calendar__nav-btn" onClick={nextMonth}>â€º</button>
                </div>
                <div className="cook-calendar__gcal-grid">
                  {DAY_NAMES.map(d => <div key={d} className="cook-calendar__gcal-day-header">{d}</div>)}
                  {Array.from({ length: getFirstDayOfMonth(calendarDate.year, calendarDate.month) }).map((_, i) => (
                    <div key={`empty-${i}`} className="cook-calendar__gcal-cell cook-calendar__gcal-cell--empty" />
                  ))}
                  {Array.from({ length: getDaysInMonth(calendarDate.year, calendarDate.month) }).map((_, i) => {
                    const day = i + 1;
                    const cooked = cookDatesInMonth[day];
                    const isToday = (() => { const t = new Date(); return t.getFullYear() === calendarDate.year && t.getMonth() === calendarDate.month && t.getDate() === day; })();
                    return (
                      <div key={day} className={`cook-calendar__gcal-cell ${cooked ? 'cook-calendar__gcal-cell--cooked' : ''} ${isToday ? 'cook-calendar__gcal-cell--today' : ''}`}>
                        <span className={`cook-calendar__gcal-date ${isToday ? 'cook-calendar__gcal-date--today' : ''}`}>{day}</span>
                        {cooked && cooked.map((name, j) => (
                          <div key={j} className="cook-calendar__gcal-event" title={name}>
                            <span className="cook-calendar__gcal-event-dot"><Icon name="chefHat" size={11} strokeWidth={1.75} color="var(--sage)" /></span>
                            <span className="cook-calendar__gcal-event-name">{name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* -- 2. Recipe Attempts -- */}
      <section className="profile-section profile-section--collapsible">
        <button className="profile-settings-toggle" onClick={() => setAttemptsOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="repeat" size={15} strokeWidth={2} /> Recipe Attempts</span>
          <span className={`profile-settings-toggle__arrow ${attemptsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
        </button>
        {attemptsOpen && (
          <div className="profile-attempts">
            {recipeCounts.length === 0 ? (
              <div className="profile-settings-body">
                <div className="profile-empty">
                  <span className="profile-empty__icon"><Icon name="repeat" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
                  <p className="profile-empty__text">No recipe attempts yet. Start cooking to track how often you make each dish!</p>
                </div>
              </div>
            ) : (
              <div className="attempts-list attempts-list--scrollable">
                {recipeCounts.map((item, i) => {
                  const recipe = recipes.find(r => r.id === item.id);
                  return (
                    <div key={item.id || i} className="attempts-row">
                      {recipe?.coverImage && <img className="attempts-row__thumb" src={recipe.coverImage} alt={item.name} />}
                      <div className="attempts-row__info">
                        <span className="attempts-row__name">{item.name}</span>
                        {item.lastCooked && <span className="attempts-row__last">Last: {item.lastCooked.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      </div>
                      <div className="attempts-row__count">
                        <span className="attempts-row__num">{item.count}</span>
                        <span className="attempts-row__label">{item.count === 1 ? 'time' : 'times'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* -- 3. Sharing Options (admin only) -- */}
      {isAdmin && (
        <section className="profile-section profile-section--collapsible">
          <button className="profile-settings-toggle" onClick={() => setSharingOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="users" size={15} strokeWidth={2} /> Sharing Options</span>
            <span className={`profile-settings-toggle__arrow ${sharingOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </button>
          {sharingOpen && (
            <div className="profile-settings-body">

              {/* Header row: title + Add Friend button */}
              <div className="settings-section" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h4 className="settings-section__title" style={{ margin: 0 }}><Icon name="userCircle" size={15} strokeWidth={2} /> Current Users</h4>
                  <button
                    onClick={() => { setAddFriendSuccess(''); setShowAddFriend(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    <Icon name="userCircle" size={14} strokeWidth={2} /> Add Friend
                  </button>
                </div>
                {addFriendSuccess && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem', color: '#166534', marginBottom: 10 }}>
                    {addFriendSuccess}
                  </div>
                )}
                {usersLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Loading...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 6 }}>
                    {users.map(u => (
                      <div key={u.id} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--cream)', overflow: 'hidden' }}>
                        {/* Top row: avatar + name + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'suspended' ? '#c8c3bc' : u.role === 'admin' ? 'var(--terracotta)' : 'var(--sage)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                            {(u.display_name || u.username)?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {u.display_name || u.username}
                              <button
                                className={`admin-pill-toggle ${u.role === 'admin' ? 'admin-pill-toggle--on' : 'admin-pill-toggle--off'}`}
                                title={u.role === 'admin' ? 'Revoke admin access' : 'Grant admin access'}
                                onClick={async () => {
                                  const isAdminNow = u.role === 'admin';
                                  const msg = isAdminNow
                                    ? `Remove admin from ${u.display_name || u.username}?`
                                    : `Make ${u.display_name || u.username} an admin? They'll be able to add/edit recipes.`;
                                  if (!window.confirm(msg)) return;
                                  await apiFetch(`${API}/api/admin/users/${u.id}`, {
                                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ role: isAdminNow ? 'guest' : 'admin' }),
                                  });
                                  loadUsers();
                                }}
                              >
                                <span className="admin-pill-toggle__track"><span className="admin-pill-toggle__thumb" /></span>
                                <span className="admin-pill-toggle__label">Admin</span>
                              </button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--warm-gray)' }}>
                              {u.display_name ? `@${u.username} Â· ` : ''}<span style={{ textTransform: 'capitalize' }}>{u.role}</span>
                            </div>
                          </div>
                          {u.role !== 'admin' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                              <button onClick={() => handleSuspend(u)} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--warm-white)', cursor: 'pointer', color: u.role === 'suspended' ? 'var(--sage)' : 'var(--warm-gray)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {u.role === 'suspended' ? 'Restore' : 'Suspend'}
                              </button>
                              <button onClick={() => handleDelete(u)} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 999, border: '1px solid #f5c2b8', background: '#fff0ee', cursor: 'pointer', color: 'var(--terracotta-dark, #b84a2e)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Password row */}
                        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--warm-white)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--warm-gray)', flexShrink: 0 }}>Password:</span>
                          <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', flex: 1, minWidth: 60, color: revealedPasswords[u.id] ? 'var(--charcoal)' : 'transparent', textShadow: revealedPasswords[u.id] ? 'none' : '0 0 6px rgba(0,0,0,0.35)', userSelect: revealedPasswords[u.id] ? 'text' : 'none', transition: 'all 0.2s' }}>
                            {u.password || '--'}
                          </span>
                          <button onClick={() => toggleReveal(u.id)} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--warm-gray)', flexShrink: 0 }}>
                            {revealedPasswords[u.id] ? 'Hide' : 'Reveal'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="profile-section profile-section--collapsible" style={{ marginBottom: 12 }}>
          <button className="profile-settings-toggle" onClick={() => setAdminToolsOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="tool" size={15} strokeWidth={2} /> Admin Tools</span>
            <span className={`profile-settings-toggle__arrow ${adminToolsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </button>
          {adminToolsOpen && (
            <div className="profile-settings-body">

              <div className="settings-section">
                <h4 className="settings-section__title"><Icon name="repeat" size={15} strokeWidth={2} /> Recalculate Nutrition</h4>
                <p className="settings-section__hint">Clears all pre-populated calories/protein/fiber and recalculates from each recipe's ingredients. Run this once to clear old data -- only recipes whose ingredients have nutrition info will get values.</p>
                <button
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 10, marginBottom: 16 }}
                  disabled={recalcRunning}
                  onClick={async () => {
                    if (!window.confirm('This will clear ALL existing calories/protein/fiber from every recipe and recalculate from ingredients. Continue?')) return;
                    setRecalcRunning(true); setRecalcResult(null);
                    try {
                      const res = await apiFetch(`${API}/api/admin/recalculate-nutrition`, { method: 'POST' });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed');
                      setRecalcResult(`âœ“ Done -- updated ${data.updated} of ${data.total} recipes`);
                    } catch (e) { setRecalcResult(`âš ï¸ ${e.message}`); }
                    setRecalcRunning(false);
                  }}
                >{recalcRunning ? 'Running...' : 'Recalculate All Nutrition'}</button>
                {recalcResult && <p style={{ marginTop: 10, fontSize: '0.85rem', color: recalcResult.startsWith('âœ“') ? 'var(--sage)' : 'var(--terracotta)' }}>{recalcResult}</p>}
              </div>

            </div>
          )}
        </section>
      )}

      {/* -- Coming Soon -- */}
      {showComingSoon && (
        <section className="profile-section profile-section--collapsible">
          <button className="profile-settings-toggle" onClick={() => setComingSoonOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="zap" size={15} strokeWidth={2} /> Coming Soon</span>
            <span className={`profile-settings-toggle__arrow ${comingSoonOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </button>
          {comingSoonOpen && (
            <div className="profile-settings-body">

              <div className="settings-section">
                <h4 className="settings-section__title">âš–ï¸ Recipe Proportions</h4>
                <p className="settings-section__hint">
                  Adjust any one ingredient's amount and the rest of the recipe scales automatically
                  while keeping whole-unit ingredients (like eggs) sensibly rounded. Calorie and
                  nutrition totals will recalculate in real time as amounts change.
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

              <div className="settings-section">
                <h4 className="settings-section__title">ðŸ’¬ Ingredient Reasoning on Hover</h4>
                <p className="settings-section__hint">
                  Hover over any ingredient in a recipe to see a short cooking note explaining why
                  that quantity or ratio was chosen â€” things like "balances acidity" or "adds depth
                  without overpowering." Purely culinary context, no dietary or allergy info.
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

              <div className="settings-section">
                <h4 className="settings-section__title">ðŸ”¢ Accurate Calorie Tracking</h4>
                <p className="settings-section__hint">
                  After cooking, log exactly how much of each high-calorie ingredient you actually
                  used and get an adjusted nutrition breakdown â€” useful when you deviate from the
                  recipe (e.g. used less oil, added extra cheese).
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

              <div className="settings-section">
                <h4 className="settings-section__title">ðŸ–¼ï¸ Local Image Upload</h4>
                <p className="settings-section__hint">
                  Upload a photo directly from your device to use as a recipe cover image, stored
                  as a base-64 string in the database â€” no external hosting or URL required.
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

            </div>
          )}
        </section>
      )}

      {/* -- Bug Reports -- */}
      {isAdmin && (
        <section className="profile-section profile-section--collapsible">
          <button className="profile-settings-toggle" onClick={() => setBugReportOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="alertTriangle" size={15} strokeWidth={2} /> Bug Reports <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--warm-gray)', marginLeft: 4 }}>({bugList.length})</span></span>
            <span className={`profile-settings-toggle__arrow ${bugReportOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </button>
          {bugReportOpen && (
            <div className="profile-settings-body">
              <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                <h4 className="settings-section__title">Report a Bug</h4>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    className="editor-input"
                    style={{ flex: 1, fontSize: 14 }}
                    placeholder="Describe what went wrong..."
                    value={bugText}
                    onChange={e => { setBugText(e.target.value); setBugSubmitted(false); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && bugText.trim()) {
                        const entry = { id: Date.now(), text: bugText.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), done: false };
                        const next = [entry, ...bugList];
                        setBugList(next);
                        LS.set('bugReports', next);
                        setBugText('');
                        setBugSubmitted(true);
                        setTimeout(() => setBugSubmitted(false), 2000);
                      }
                    }}
                  />
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={!bugText.trim()}
                    onClick={() => {
                      const entry = { id: Date.now(), text: bugText.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), done: false };
                      const next = [entry, ...bugList];
                      setBugList(next);
                      LS.set('bugReports', next);
                      setBugText('');
                      setBugSubmitted(true);
                      setTimeout(() => setBugSubmitted(false), 2000);
                    }}
                  >+ Add</button>
                </div>
                {bugSubmitted && <p style={{ fontSize: 12, color: 'var(--sage)', marginTop: 6 }}>âœ“ Logged!</p>}
              </div>
              {bugList.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h4 className="settings-section__title" style={{ margin: 0 }}>Open ({bugList.filter(b => !b.done).length})</h4>
                    {bugList.some(b => b.done) && (
                      <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '3px 10px' }}
                        onClick={() => { const next = bugList.filter(b => !b.done); setBugList(next); LS.set('bugReports', next); }}>
                        Clear fixed
                      </button>
                    )}
                  </div>
                  {bugList.map(bug => (
                    <div key={bug.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                      background: bug.done ? 'var(--cream)' : 'var(--warm-white)',
                      border: `1.5px solid ${bug.done ? 'var(--border)' : 'var(--border)'}`,
                      borderLeft: `3px solid ${bug.done ? 'var(--sage)' : 'var(--terracotta-light)'}`,
                      borderRadius: 10, opacity: bug.done ? 0.55 : 1,
                    }}>
                      <button
                        title={bug.done ? 'Mark as open' : 'Mark as fixed'}
                        onClick={() => {
                          const next = bugList.map(b => b.id === bug.id ? { ...b, done: !b.done } : b);
                          setBugList(next); LS.set('bugReports', next);
                        }}
                        style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          border: `1.5px solid ${bug.done ? 'var(--sage)' : 'var(--border)'}`,
                          background: bug.done ? 'var(--sage)' : 'transparent',
                          color: bug.done ? 'white' : 'transparent',
                          cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >{bug.done ? 'âœ“' : ''}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--charcoal)', margin: 0, textDecoration: bug.done ? 'line-through' : 'none', wordBreak: 'break-word' }}>{bug.text}</p>
                        <p style={{ fontSize: 11, color: 'var(--warm-gray)', margin: '2px 0 0' }}>{bug.date}</p>
                      </div>
                      <button className="editor-remove-btn" title="Delete"
                        onClick={() => { const next = bugList.filter(b => b.id !== bug.id); setBugList(next); LS.set('bugReports', next); }}
                      >âœ•</button>
                    </div>
                  ))}
                </div>
              )}
              {bugList.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 12 }}>No bugs logged yet. Nice!</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* -- 4. Settings -- */}
      <section className="profile-section profile-section--settings">
        <button className="profile-settings-toggle" onClick={() => setSettingsOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="settings" size={15} strokeWidth={2} /> Settings</span>
          <span className={`profile-settings-toggle__arrow ${settingsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
        </button>

        {settingsOpen && (
          <div className="profile-settings-body">

            <div className="settings-section">
              <h4 className="settings-section__title"><Icon name="moon" size={15} strokeWidth={2} /> Appearance</h4>
              <p className="settings-section__hint">Switch between light and dark mode</p>
              <div className="dark-mode-toggle-row">
                <span className="dark-mode-toggle__label"><Icon name="sun" size={14} strokeWidth={2} /> Light</span>
                <button
                  className={`dark-mode-toggle__btn ${darkMode ? 'dark-mode-toggle__btn--on' : ''}`}
                  onClick={() => setDarkMode && setDarkMode(!darkMode)}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  type="button"
                >
                  <span className="dark-mode-toggle__track">
                    <span className="dark-mode-toggle__thumb" />
                  </span>
                </button>
                <span className="dark-mode-toggle__label"><Icon name="moon" size={14} strokeWidth={2} /> Dark</span>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="settings-section__title"><Icon name="home" size={15} strokeWidth={2} /> Bottom Tab Bar</h4>
              <p className="settings-section__hint">Choose which 5 tabs appear on the bottom bar (Profile is always included)</p>
              {(() => {
                const ALL_TAB_OPTIONS = [
                  { key: 'home',      label: 'Home',      icon: 'home'      },
                  { key: 'recipes',   label: 'Recipes',   icon: 'bookOpen'  },
                  { key: 'kitchen',   label: 'Kitchen',   icon: 'package'   },
                  { key: 'grocery',   label: 'Grocery',   icon: 'cart'      },
                  { key: 'cookbooks', label: 'Cookbooks', icon: 'bookMarked'},
                  { key: 'notes',     label: 'Notes',     icon: 'lightbulb' },
                ];
                const selected = tabBarTabs || ['home', 'recipes', 'kitchen', 'grocery'];
                const toggle = (key) => {
                  if (key === 'profile') return; // always included
                  if (selected.includes(key)) {
                    if (selected.length <= 1) return; // keep at least 1
                    setTabBarTabs(selected.filter(k => k !== key));
                  } else {
                    if (selected.length >= 4) return; // max 4 + profile = 5
                    setTabBarTabs([...selected, key]);
                  }
                };
                return (
                  <div style={{ marginTop: 10 }}>
                    <div className="picker__chips" style={{ flexWrap: 'wrap', gap: 8 }}>
                      {ALL_TAB_OPTIONS.map(({ key, label, icon }) => {
                        const isOn = selected.includes(key);
                        const atMax = selected.length >= 4 && !isOn;
                        return (
                          <button key={key}
                            className={`chip ${isOn ? 'chip--selected' : ''}`}
                            onClick={() => toggle(key)}
                            disabled={atMax}
                            style={{ opacity: atMax ? 0.4 : 1 }}
                          >
                            {isOn && <span className="chip__check">âœ“</span>}
                            <Icon name={icon} size={13} strokeWidth={2} /> {label}
                          </button>
                        );
                      })}
                      <button className="chip chip--selected" disabled style={{ opacity: 0.6 }}>
                        <span className="chip__check">âœ“</span>
                        <Icon name="user" size={13} strokeWidth={2} /> Profile
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 8 }}>
                      {selected.length}/4 selected Â· Profile is always shown
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="settings-section">
              <h4 className="settings-section__title"><Icon name="leaf" size={15} strokeWidth={2} /> Dietary Restrictions</h4>
              <p className="settings-section__hint">Active filters warn you about conflicting ingredients on recipe pages</p>
              <div className="picker__chips" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                {DIETARY_OPTIONS.map(d => (
                  <button key={d} className={`chip ${dietaryFilters.includes(d) ? 'chip--selected' : ''}`} onClick={() => toggleDiet(d)}>
                    {dietaryFilters.includes(d) && <span className="chip__check">âœ“</span>}{d}
                  </button>
                ))}
              </div>
              {dietaryFilters.length > 0 && (
                <label className="dietary-hide-toggle" style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={hideIncompatible} onChange={e => setHideIncompatible(e.target.checked)} style={{ width:16, height:16, cursor:'pointer' }} />
                  <span>Hide incompatible recipes from library</span>
                </label>
              )}
            </div>

            <div className="settings-section settings-section--about">
              <h4 className="settings-section__title"><Icon name="lightbulb" size={15} strokeWidth={2} /> About Hearth</h4>
              <div className="about-cards">
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="barChart" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">{totalRecipes}</div>
                    <div className="about-card__label">Recipes</div>
                  </div>
                </div>
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="chefHat" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">{cookHistory.length}</div>
                    <div className="about-card__label">Times Cooked</div>
                  </div>
                </div>
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="zap" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">v1.0</div>
                    <div className="about-card__label">Version</div>
                  </div>
                </div>
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="barChart" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">Supabase</div>
                    <div className="about-card__label">Database</div>
                  </div>
                </div>
              </div>
              <div className="about-stack-github-row">
                <a className="about-github-btn" href="https://github.com/kavyasomala/Hearth" target="_blank" rel="noopener noreferrer">
                  <svg className="about-github-btn__icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
                <div className="about-stack">
                  <span className="about-stack__badge">React</span>
                  <span className="about-stack__badge">Node.js</span>
                  <span className="about-stack__badge">PostgreSQL</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </section>
    </main>
  );
};

// --- Grocery List Tab --------------------------------------------------------

// Unit conversion to a common base (grams for weight, ml for volume)
const GroceryListTab = ({ recipes, makeSoonIds, allMyIngredients, allIngredients, setFridgeIngredients, setPantryStaples }) => {
  const [categories, setCategories] = useState([]);
  const [recipeNames, setRecipeNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [error, setError] = useState(null);
  const [hideInKitchen, setHideInKitchen] = useState(false);

  const makeSoonRecipes = useMemo(() => recipes.filter(r => makeSoonIds.includes(r.id)), [recipes, makeSoonIds]);

  // Consolidate items per category
  const consolidatedCategories = useMemo(() =>
    categories.map(cat => ({ ...cat, items: consolidateItems(cat.items) })),
  [categories]);

  const toggleChecked = (key, itemName) => {
    const lower = itemName.toLowerCase().trim();
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Unchecking: remove from kitchen too
        next.delete(key);
        setFridgeIngredients(prev2 => prev2.filter(x => x !== lower));
        setPantryStaples(prev2 => prev2.filter(x => x !== lower));
      } else {
        next.add(key);
        // Auto-add to kitchen
        const known = allIngredients?.find(i => (typeof i === 'string' ? i : i.name).toLowerCase() === lower);
        const isFridgeType = known && typeof known === 'object' && ['produce', 'meat & fish', 'dairy', 'sauces'].includes(known.type);
        if (isFridgeType) {
          setFridgeIngredients(prev2 => prev2.includes(lower) ? prev2 : [...prev2, lower]);
        } else {
          setPantryStaples(prev2 => prev2.includes(lower) ? prev2 : [...prev2, lower]);
        }
      }
      return next;
    });
  };

  // Remove an ingredient that's in kitchen (came from kitchen, not manually checked)
  const removeFromKitchen = (itemName) => {
    const lower = itemName.toLowerCase().trim();
    setFridgeIngredients(prev => prev.filter(x => x !== lower));
    setPantryStaples(prev => prev.filter(x => x !== lower));
  };

  useEffect(() => {
    if (!makeSoonIds.length) { setCategories([]); setRecipeNames([]); return; }
    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/grocery-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeIds: makeSoonIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to build list');
        if (!cancelled) {
          setCategories(data.categories || []);
          setRecipeNames(data.recipeNames || []);
          setChecked(new Set());
        }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetch_();
    return () => { cancelled = true; };
  }, [makeSoonIds]);

  const copyList = () => {
    const lines = [`Grocery List -- ${recipeNames.join(', ')}\n`];
    consolidatedCategories.forEach(cat => {
      const items = hideInKitchen
        ? cat.items.filter(item => !allMyIngredients.has(item.name.toLowerCase().trim()))
        : cat.items;
      if (!items.length) return;
      lines.push(`\n${cat.emoji} ${cat.name}`);
      items.forEach(item => {
        const inKitchen = allMyIngredients.has(item.name.toLowerCase().trim());
        const tick = checked.has(`${cat.name}-${item.name}`) || inKitchen ? 'âœ“' : 'â—‹';
        const amount = [item.amount, item.unit].filter(Boolean).join(' ');
        const extra = item._extra ? ` + ${item._extra}` : '';
        lines.push(`  ${tick} ${amount}${extra} ${item.name}${item.prep_note ? ` (${item.prep_note})` : ''}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  const totalItems = consolidatedCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  const inKitchenCount = consolidatedCategories.reduce((sum, cat) =>
    sum + cat.items.filter(item => allMyIngredients.has(item.name.toLowerCase().trim())).length, 0);
  const checkedCount = checked.size;

  return (
    <main className="view grocery-view">
      <div className="fridge-header grocery-header">
        <div>
          <h2 className="fridge-title">Grocery List</h2>
          {makeSoonRecipes.length > 0 ? (
            <p className="fridge-subtitle">
              Shopping for: <span className="grocery-subtitle__meals">{makeSoonRecipes.map(r => r.name).join(', ')}</span>
            </p>
          ) : (
            <p className="fridge-subtitle">Add recipes to Make Soon to build your list</p>
          )}
        </div>
        {consolidatedCategories.length > 0 && (
          <div className="grocery-header__actions">
            <label className="grocery-toggle" title="Hide ingredients you already have in your kitchen">
              <input type="checkbox" checked={hideInKitchen} onChange={e => setHideInKitchen(e.target.checked)} />
              <span className="grocery-toggle__switch" />

            </label>
            <button className="grocery-copy-btn rp2__cooking-mode-btn" onClick={copyList} title="Copy list to clipboard"><Icon name="fileText" size={14} strokeWidth={2} /> Copy list</button>
          </div>
        )}
      </div>

      {makeSoonRecipes.length === 0 && (
        <div className="grocery-empty">
          <div className="grocery-empty__icon"><Icon name="timer" size={40} color="var(--warm-gray)" strokeWidth={1.5} /></div>
          <h3 className="grocery-empty__title">No recipes in Make Soon</h3>
          <p className="grocery-empty__sub">Tap <span style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle',margin:'0 2px'}}><Icon name="timer" size={13} strokeWidth={2} /></span> on any recipe to add it to Make Soon â€” your grocery list will build automatically.</p>
        </div>
      )}

      {error && <p className="grocery-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {error}</p>}
      {loading && <div className="grocery-loading"><div className="loading-spinner" /><p>Building your list...</p></div>}

      {!loading && consolidatedCategories.length > 0 && (
        <>
          <div className="grocery-progress-bar-wrap">
            <div className="grocery-progress-bar">
              <div className="grocery-progress-fill" style={{ width: totalItems ? `${((checkedCount + inKitchenCount) / totalItems) * 100}%` : '0%' }} />
            </div>
            <span className="grocery-progress-label">{checkedCount + inKitchenCount}/{totalItems} got</span>
          </div>
          {inKitchenCount > 0 && (
            <div className="grocery-kitchen-banner">
              <span>âœ“ {inKitchenCount} of {totalItems} ingredients already in your kitchen</span>
            </div>
          )}
          <div className="grocery-list">
            {consolidatedCategories.map(cat => {
              const allItems = cat.items;
              const visibleItems = hideInKitchen
                ? allItems.filter(item => !allMyIngredients.has(item.name.toLowerCase().trim()))
                : allItems;
              if (!visibleItems.length) return null;
              return (
                <div key={cat.name} className="grocery-category">
                  <h3 className="grocery-category__title"><Icon name={({Produce:'leaf',Meat:'utensils','Meat & Fish':'utensils',Dairy:'coffee',Sauces:'package',Spices:'zap',Staples:'list',Alcohol:'shuffle'})[cat.name] || 'list'} size={14} strokeWidth={2} /> {cat.name}</h3>
                  <div className="grocery-items">
                    {visibleItems.map(item => {
                      const key = `${cat.name}-${item.name}`;
                      const inKitchen = allMyIngredients.has(item.name.toLowerCase().trim());
                      const isChecked = checked.has(key) || inKitchen;
                      const amountStr = [item.amount, item.unit].filter(Boolean).join(' ');
                      return (
                        <div
                          key={key}
                          className={`grocery-item ${isChecked ? 'grocery-item--checked' : ''} ${inKitchen ? 'grocery-item--in-kitchen' : ''}`}
                          onClick={() => {
                            if (inKitchen) removeFromKitchen(item.name);
                            else toggleChecked(key, item.name);
                          }}
                        >
                          <div className={`grocery-item__checkbox ${isChecked ? 'grocery-item__checkbox--checked' : ''}`}>
                            {isChecked && 'âœ“'}
                          </div>
                          <div className="grocery-item__body">
                            <span className="grocery-item__name">
                              {amountStr && <span className="grocery-item__amount">{amountStr}</span>}
                              {item._extra && <span className="grocery-item__extra"> + {item._extra}</span>}
                              {' '}{item.name}
                            </span>
                            {item.prep_note && <span className="grocery-item__note">{item.prep_note}</span>}
                            {inKitchen && <span className="grocery-item__kitchen-tag">in kitchen Â· tap to remove</span>}
                            {!inKitchen && !isChecked && <span className="grocery-item__tap-hint">tap to check off â†’ adds to kitchen</span>}
                            {isChecked && !inKitchen && <span className="grocery-item__tap-hint">tap to uncheck â†’ removes from kitchen</span>}
                            {item.recipes?.length > 1 && !inKitchen && (
                              <span className="grocery-item__recipes">for {item.recipes.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
};


// --- Cooking Notes Tab ------------------------------------------------------
const NOTE_TYPES = ['rule', 'theory', 'shortcut'];
const NOTE_TYPE_META = {
  rule:     { label: 'Rule / Ratio',   emoji: 'ruler',   color: '#f5ece0', border: '#d9c4a8' },
  theory:   { label: 'Theory',         emoji: 'lightbulb', color: '#f5ece0', border: '#d9c4a8' },
  shortcut: { label: 'Shortcut',       emoji: 'zap',     color: '#f0ebe3', border: '#d9c4a8' },
};
const NOTE_CATEGORIES = ['General Technique', 'Pasta', 'Baking', 'Meat & Fish', 'Sauces', 'Eggs', 'Vegetables', 'Bread', 'Desserts', 'Equipment'];

// Auto-extract keywords from a description string
const autoKeywordsFromDescription = (desc) => {
  const STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','being','have','has','had','do','does',
    'did','will','would','could','should','may','might','must','shall','can',
    'it','its','this','that','these','those','i','you','he','she','we','they',
    'not','no','so','if','as','by','from','up','out','more','also','than','then',
    'when','always','never','very','too','just','well','make','use','your','their',
  ]);
  const words = desc.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const seen = new Set();
  const keywords = [];
  for (const w of words) {
    if (w.length >= 4 && !STOP_WORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      keywords.push(w);
      if (keywords.length >= 8) break;
    }
  }
  return keywords;
};

const NoteFormModal = ({ note, onSave, onClose, authFetch }) => {
  const isNew = !note;
  const [form, setForm] = useState({
    title:     note?.title     || '',
    body:      note?.body      || '',
    type:      note?.type      || 'rule',
    image_url: note?.image_url || '',
    keywords:  (note?.keywords || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // When body changes, auto-populate keywords if field is empty or was auto-generated
  const handleBodyChange = (v) => {
    set('body', v);
    // Only auto-generate if user hasn't manually edited keywords
    const autoKw = autoKeywordsFromDescription(v).join(', ');
    setForm(p => ({ ...p, body: v, keywords: autoKw }));
  };

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim())  { setError('Description is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        title:     form.title.trim(),
        body:      form.body.trim(),
        type:      form.type,
        category:  note?.category || 'General Technique',
        image_url: form.image_url.trim() || null,
        keywords:  form.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        bullets:   [],
      };
      const url = isNew ? `${API}/api/cooking-notes` : `${API}/api/cooking-notes/${note.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave(data.note);
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title">{isNew ? 'Add Cooking Note' : 'Edit Note'}</h2>
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
        </div>
        <div className="create-modal__body" style={{ gap: 14 }}>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Title <span className="create-modal__required">*</span></label>
            <input className="editor-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Pasta water salinity" autoFocus={isNew} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {NOTE_TYPES.map(t => (
                <button key={t} className={`chip ${form.type === t ? 'chip--selected' : ''}`} onClick={() => set('type', t)}>
                  {form.type === t && <span className="chip__check">âœ“</span>}<Icon name={NOTE_TYPE_META[t].emoji} size={13} strokeWidth={2} /> {NOTE_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Description <span className="create-modal__required">*</span></label>
            <textarea className="editor-textarea" value={form.body} onChange={e => handleBodyChange(e.target.value)} placeholder="Describe the rule, technique, or tip..." rows={4} style={{ resize: 'vertical' }} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Tooltip keywords <span style={{opacity:0.6, fontWeight:400}}>auto-generated Â· edit freely</span></label>
            <input className="editor-input" value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="e.g. pasta, salt, water, boil" />
            <p className="create-modal__field-hint" style={{ marginTop: 4 }}>These words trigger this note as a tooltip on recipe steps.</p>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Image URL <span style={{opacity:0.6, fontWeight:400}}>optional</span></label>
            <input className="editor-input" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
          </div>
          {error && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {error}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : isNew ? '+ Add Note' : 'âœ“ Save'}</button>
        </div>
      </div>
    </div>
  );
};

const NoteCard = ({ note, isAdmin, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.rule;
  return (
    <div className="cn-card" style={{ '--cn-bg': meta.color, '--cn-border': meta.border }}>
      <div className="cn-card__header" onClick={() => setExpanded(e => !e)}>
        <span className="cn-card__type-badge"><Icon name={meta.emoji} size={13} strokeWidth={2} /></span>
        <span className="cn-card__title">{note.title}</span>
        <span className="cn-card__chevron">{expanded ? 'â–´' : 'â–¾'}</span>
        {isAdmin && (
          <div className="cn-card__actions" onClick={e => e.stopPropagation()}>
            <button className="cn-card__action-btn" onClick={onEdit} title="Edit">âœŽ</button>
            <button className="cn-card__action-btn cn-card__action-btn--del" onClick={onDelete} title="Delete">âœ•</button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="cn-card__body">
          <p className="cn-card__text">{note.body}</p>
          {note.bullets?.length > 0 && (
            <ul className="cn-card__bullets">
              {note.bullets.map((b, i) => <li key={i}>{b.text}</li>)}
            </ul>
          )}
          {note.image_url && <img src={note.image_url} alt="" className="cn-card__img" />}
          {note.keywords?.length > 0 && (
            <div className="cn-card__keywords">
              {note.keywords.map(k => <span key={k} className="cn-card__keyword">#{k}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// â”€â”€â”€ Cooking Notes Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CookingNotesTab = ({ notes, setNotes, authFetch, isAdmin }) => {
  const [editingNote, setEditingNote] = useState(null); // null = closed, false = new, obj = editing
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(notes.map(n => n.category).filter(Boolean))].sort((a, b) => a === 'All' ? -1 : a.localeCompare(b));
    return cats;
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notes.filter(n => {
      if (activeCategory !== 'All' && n.category !== activeCategory) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) ||
        (n.keywords || []).some(k => k.includes(q)) ||
        (n.bullets || []).some(b => b.text.toLowerCase().includes(q));
    });
  }, [notes, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const n of filtered) {
      const cat = n.category || 'General Technique';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(n);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleSave = (saved) => {
    setNotes(prev => {
      const exists = prev.find(n => n.id === saved.id);
      return exists ? prev.map(n => n.id === saved.id ? saved : n) : [...prev, saved];
    });
    setEditingNote(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await authFetch(`${API}/api/cooking-notes/${deleteTarget.id}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== deleteTarget.id));
    } catch {}
    setDeleteTarget(null);
  };

  return (
    <main className="view cn-tab">
      {editingNote !== null && (
        <NoteFormModal
          note={editingNote === false ? null : editingNote}
          onSave={handleSave}
          onClose={() => setEditingNote(null)}
          authFetch={authFetch}
        />
      )}
      {deleteTarget && (
        <div className="create-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <p>Delete <strong>"{deleteTarget.title}"</strong>?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn--ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="cn-tab__header">
        <div className="cn-tab__title-row">
          <h1 className="cn-tab__title">Cooking Notes</h1>
          {isAdmin && (
            <button className="btn btn--primary btn--sm" onClick={() => setEditingNote(false)}>+ Add Note</button>
          )}
        </div>
        <p className="cn-tab__subtitle">Rules, ratios, and theory -- the things that make cooking click.</p>
        <input className="editor-input cn-tab__search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." />
      </div>

      {notes.length === 0 ? (
        <div className="cn-tab__empty">
          <p>No notes yet.{isAdmin ? ' Add your first cooking note!' : ''}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="cn-tab__empty"><p>No notes match your search.</p></div>
      ) : (
        <div className="cn-tab__groups">
          {grouped.map(([cat, catNotes]) => (
            <div key={cat} className="cn-group">
              <h2 className="cn-group__title">{cat}</h2>
              <div className="cn-group__cards">
                {catNotes.map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    isAdmin={isAdmin}
                    onEdit={() => setEditingNote(n)}
                    onDelete={() => setDeleteTarget(n)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

// --- Site Footer ------------------------------------------------------------
const GITHUB_REPO = 'kavyasomala/RecipeApp'; // update with actual repo path

// â”€â”€â”€ Site Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    ' Â· ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

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
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
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
                  {cuisine === c && <span className="chip__check">âœ“</span>}{c}
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
                  {status === key && <span className="chip__check">âœ“</span>}{label}
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
                  {tags.includes(key) && <span className="chip__check">âœ“</span>}{label}
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
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
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
              {rows.length > 1 && <button className="editor-remove-btn" onClick={() => rmRow(row.id)}>âœ•</button>}
            </div>
          ))}
          <button className="btn btn--ghost editor-add-btn" onClick={addRow} style={{ marginTop:4 }}>+ Add row</button>
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!valid.length}>âœ“ Add {valid.length || ''} Recipes</button>
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
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
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
                  {details.cuisine === c && <span className="chip__check">âœ“</span>}{c}
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
                  {details.tags.includes(key) && <span className="chip__check">âœ“</span>}{label}
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
                  {details.status === key && <span className="chip__check">âœ“</span>}{label}
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
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>âœ•</button>
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
            <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
          </div>

          {/* Notes */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Notes &amp; Modifications</label>
            {notesList.map(note => (
              <div key={note._id} className="editor-note-row">
                <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>âœ•</button>
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
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
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
          <button className="btn btn--primary" onClick={save} disabled={!form.title.trim()}>{isNew ? '+ Add Cookbook' : 'âœ“ Save Changes'}</button>
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
        {linked && <span className="cookbook-recipe-entry__saved-badge">âœ“ Saved</span>}
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
            View â†’
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
              Actions â–¾
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

  const savedCount = useMemo(() => recipes.filter(r => r.cookbook && r.cookbook.toLowerCase().trim() === cookbook.title.toLowerCase().trim()).length, [recipes, cookbook]);
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
          <button className="btn btn--ghost btn--sm" onClick={onEdit}>âœŽ Edit</button>
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
              <span className="cbdetail-progress__label">{cookedCount} of {cookbook.recipes.length} cooked Â· {pct}%</span>
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
          {search && <button className="cookbook-search-clear" onClick={() => setSearch('')}>âœ•</button>}
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
// â”€â”€â”€ Cookbooks Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CookbooksTab = ({ cookbooks, setCookbooks, recipes, onOpenRecipe, allIngredients, setCookingRecipe, cookLog, onRecipeConverted, isAdmin, authFetch }) => {
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
    const linked = recipes.filter(r => r.cookbook && r.cookbook.toLowerCase().trim() === cb.title.toLowerCase().trim());
    const entries = [...(cb.recipes||[])];
    for (const lr of linked) {
      const existingIdx = entries.findIndex(e => e.name.toLowerCase() === lr.name.toLowerCase());
      if (existingIdx < 0) {
        // New linked recipe not in list yet -- add it
        entries.push({ name: lr.name, page: lr.reference || '', image: lr.coverImage || '', tags: lr.tags || [], recipeId: lr.id, addedAt: Date.now() });
      } else {
        // Sync recipeId and page number from the live recipe record
        entries[existingIdx] = {
          ...entries[existingIdx],
          recipeId: lr.id,
          page: lr.reference || entries[existingIdx].page || '',
          tags: lr.tags?.length ? lr.tags : entries[existingIdx].tags,
        };
      }
    }
    return {...cb, recipes: entries, savedCount: linked.length};
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
          <p className="cookbooks-subtitle">{cookbooks.length} {cookbooks.length===1?'cookbook':'cookbooks'} Â· {enrichedCookbooks.reduce((s,c) => s+c.recipes.length, 0)} recipes indexed</p>
        </div>
        {isAdmin && <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>+ Add Cookbook</button>}
      </div>

      {cookbooks.length > 0 && (
        <div className="cookbooks-global-search">
          <input className="editor-input" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Search recipes across all cookbooks..." />
          {globalSearch && <button className="cookbook-search-clear" onClick={() => setGlobalSearch('')}>âœ•</button>}
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
                      <span className="cbsearch-result__meta">{e._cbTitle}{e.page ? ` Â· p. ${e.page}` : ''}</span>
                    </div>
                    <div className="cbsearch-result__actions">
                      {linked && <button className="btn btn--ghost btn--sm" onClick={() => onOpenRecipe(linked)}>View â†’</button>}
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
          {isAdmin && <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>+ Add your first cookbook</button>}
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
                    {cb.savedCount > 0 && <span className="cookbook-card__stat cookbook-card__stat--saved">âœ“ {cb.savedCount} saved</span>}
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
          {isAdmin && <button className="cookbook-card cookbook-card--add" onClick={() => setShowAddModal(true)}>
            <div className="cookbook-card__add-icon"><Icon name="bookMarked" size={24} color="var(--terracotta)" strokeWidth={2} /></div>
            <p className="cookbook-card__add-label">Add cookbook</p>
          </button>}
        </div>
      ))}
    </main>
  );
};

// --- Add Recipe Tab ---------------------------------------------------------
// â”€â”€â”€ Add Recipe Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AddRecipeTab = ({ allIngredients, onSaved, cookbooks = [], authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();
  const [showModal, setShowModal] = useState(false);

  const emptyForm = () => ({
    name: '', cuisine: '', time: '', servings: '',
    cover_image_url: '', cookbook: '', reference: '', status: '', tags: [],
  });

  const [details, setDetails] = useState(emptyForm);
  const [ings, setIngs] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgPreviewError, setImgPreviewError] = useState(false);

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
    setShowModal(true);
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

      <div className="add-tab__cards">
        <button className="add-tab__card" onClick={openModal}>
          <span className="add-tab__card-icon"><Icon name="note" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Add Manually</h3>
          <p className="add-tab__card-desc">Type in the name, ingredients, steps, and notes yourself</p>
          <span className="add-tab__card-cta">Get started â†’</span>
        </button>
      </div>

      {/* -- Create Recipe Modal -- */}
      {showModal && (
        <div className="create-modal-overlay" onClick={closeModal}>
          <div className="create-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="create-modal__header">
              <h2 className="create-modal__title"><Icon name="note" size={18} strokeWidth={2} /> New Recipe</h2>
              <button className="ing-modal__close" onClick={closeModal}>âœ•</button>
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
                      {details.cuisine === c && <span className="chip__check">âœ“</span>}{c}
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
                      {details.tags.includes(key) && <span className="chip__check">âœ“</span>}{label}
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
                    { key: 'complete', label: 'Complete' },
                    { key: 'needs tweaking', label: 'Needs Tweaking' },
                    { key: 'to try', label: 'To Try' },
                    { key: 'incomplete', label: 'Incomplete' },
                  ].map(({ key, label }) => (
                    <button key={key}
                      className={`chip ${details.status === key ? 'chip--selected' : ''}`}
                      onClick={() => setDetail('status', key)} type="button">
                      {details.status === key && <span className="chip__check">âœ“</span>}{label}
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
                          <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>âœ•</button>
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
                <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
              </div>

              {/* Notes */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Notes &amp; Modifications</label>
                {notesList.map(note => (
                  <div key={note._id} className="editor-note-row">
                    <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                    <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>âœ•</button>
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
                {saving ? 'Creating...' : 'âœ“ Create Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

// --- Login Modal -------------------------------------------------------------
// â”€â”€â”€ Login Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LoginModal = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim() || !password) return setError('Please enter your username and password.');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.token, data.user);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <div className="login-modal__header">
          <span className="login-modal__flame"><Icon name="flame" size={40} color="var(--terracotta)" strokeWidth={1.5} /></span>
          <div className="login-modal__title">Hearth</div>
          <div className="login-modal__subtitle">Sign in to continue</div>
        </div>
        <div className="login-modal__body">
          {error && <div className="login-modal__error">{error}</div>}
          <div className="login-modal__field">
            <label className="login-modal__label">Username</label>
            <input
              className="login-modal__input"
              type="text"
              placeholder="e.g. kavya"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
              autoCapitalize="none"
            />
          </div>
          <div className="login-modal__field">
            <label className="login-modal__label">Password</label>
            <input
              className="login-modal__input"
              type="password"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <button className="login-modal__btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Create User Modal (admin only) ------------------------------------------
const CreateUserModal = ({ onClose, authFetch }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    if (!username.trim() || !password) return setError('Username and password are required.');
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await authFetch(`${API}/api/auth/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setSuccess(`Account created for ${data.user.username} âœ“`);
      setUsername(''); setPassword('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="create-user-modal" onClick={e => e.stopPropagation()}>
        <div className="create-user-modal__header">
          <span className="create-user-modal__title"><Icon name="userCircle" size={18} strokeWidth={2} /> Create Account</span>
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
        </div>
        <div className="login-modal__body">
          {error && <div className="login-modal__error">{error}</div>}
          {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#166534' }}>{success}</div>}
          <div className="login-modal__field">
            <label className="login-modal__label">Username</label>
            <input className="login-modal__input" type="text" placeholder="e.g. PriyaK" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" />
          </div>
          <div className="login-modal__field">
            <label className="login-modal__label">Password</label>
            <input className="login-modal__input" type="password" placeholder="Set a password for them" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="login-modal__btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ----------------------------------------------------------------
// â”€â”€â”€ Main App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AppInner() {
  // --- Auth ------------------------------------------------------------------
  const [authToken, setAuthToken] = useState(() => LS.get('authToken', null));
  const [authUser, setAuthUser]   = useState(() => LS.get('authUser', null));
  const [showLogin, setShowLogin] = useState(false);
  const isAdmin = authUser?.role === 'admin';

  // Show login gate if no token
  useEffect(() => {
    if (!authToken) setShowLogin(true);
    else setShowLogin(false);
  }, [authToken]);

  const handleLogin = (token, user) => {
    LS.set('authToken', token);
    LS.set('authUser', user);
    setAuthToken(token);
    setAuthUser(user);
    setShowLogin(false);
  };

  const handleLogout = () => {
    LS.set('authToken', null);
    LS.set('authUser', null);
    setAuthToken(null);
    setAuthUser(null);
    setShowLogin(true);
  };

  // Authenticated fetch wrapper -- adds Bearer token automatically
  const authFetch = useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
    });
  }, [authToken]);

  // --- Navigation & UI -------------------------------------------------------
  const [view, setViewRaw] = useState('home');
  const [lastView, setLastView] = useState('home');

  // Always scroll to top when switching tabs
  const setView = useCallback((newView) => {
    setViewRaw(newView);
    if (appScrollRef.current) {
      appScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  // Declared early so swipe callbacks can reference it
  const [editingRecipe, setEditingRecipe] = useState(false);

  // Swipe-right to go back (mobile) with visual feedback
  const swipeTouchStart = useRef(null);
  const [swipeDx, setSwipeDx] = useState(0);
  const handleSwipeTouchStart = useCallback((e) => {
    if (editingRecipe) return;
    swipeTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeDx(0);
  }, [editingRecipe]);
  const handleSwipeTouchMove = useCallback((e) => {
    if (!swipeTouchStart.current) return;
    const dx = e.touches[0].clientX - swipeTouchStart.current.x;
    const dy = Math.abs(e.touches[0].clientY - swipeTouchStart.current.y);
    if (dx > 0 && dy < 80) setSwipeDx(Math.min(dx, 120));
    else setSwipeDx(0);
  }, []);
  const handleSwipeTouchEnd = useCallback((e) => {
    if (!swipeTouchStart.current) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStart.current.y);
    const threshold = window.innerWidth * 0.35; // 35% of screen
    if (dx > threshold && dy < 100) {
      // Animate to full width then navigate
      setSwipeDx(window.innerWidth);
      setTimeout(() => { setSwipeDx(0); setView(lastView); }, 280);
    } else {
      setSwipeDx(0);
    }
    swipeTouchStart.current = null;
  }, [lastView]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSearchSubmitted, setMobileSearchSubmitted] = useState(false);
  const mainScrollRef = useRef(null);
  const appScrollRef = useRef(null); // ref to the scrollable app__scroll wrapper
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll-to-top detection â€” listen on app__scroll, not window
  useEffect(() => {
    const el = appScrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollTop(el.scrollTop > el.clientHeight * 0.8);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.title = 'Hearth';
    // Point both the browser favicon and iOS touch icon at the same hearth-icon.png in /public
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/png';
    link.href = `${process.env.PUBLIC_URL || ''}/hearth-icon.png`;

    let appleLink = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) { appleLink = document.createElement('link'); appleLink.rel = 'apple-touch-icon'; document.head.appendChild(appleLink); }
    appleLink.href = `${process.env.PUBLIC_URL || ''}/hearth-icon.png`;

    // Prevent pinch-zoom and page shake on mobile â€” set viewport meta
    let viewport = document.querySelector("meta[name='viewport']");
    if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; document.head.appendChild(viewport); }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  }, []);
  // --- Data ------------------------------------------------------------------
  const [allIngredients, setAllIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fridgeIngredients, setFridgeIngredients] = useState(() => LS.get('fridgeIngredients', []));
  const [pantryStaples, setPantryStaples] = useState(() => LS.get('pantryStaples', []));
  // Sync kitchen to backend whenever it changes (debounced)
  const kitchenSyncTimer = useRef(null);
  const syncKitchenToAPI = useCallback((fridge, pantry) => {
    if (!authToken) return;
    clearTimeout(kitchenSyncTimer.current);
    kitchenSyncTimer.current = setTimeout(() => {
      const kitchen = [
        ...fridge.map(n => ({ ingredient_name: n, storage_type: 'fridge' })),
        ...pantry.map(n => ({ ingredient_name: n, storage_type: 'pantry' })),
      ];
      authFetch(`${API}/api/user/kitchen`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen }),
      }).catch(() => {});
    }, 800);
  }, [authToken, authFetch]);
  // --- Recipe Detail ---------------------------------------------------------
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeBodyIngredients, setRecipeBodyIngredients] = useState([]);
  const [recipeInstructions, setRecipeInstructions] = useState([]);
  const [recipeNotes, setRecipeNotes] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // --- Library Filters -------------------------------------------------------
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeTags, setActiveTags] = useState([]);
  const [activeCuisines, setActiveCuisines] = useState([]);
  const [activeProgresses, setActiveProgresses] = useState([]);
  const [maxCalories, setMaxCalories] = useState(null);   // null = off
  const [calDir, setCalDir] = useState('under');          // 'under'|'over'
  const [maxMinutes, setMaxMinutes] = useState(null);     // null = off
  const [activeCookbooks, setActiveCookbooks] = useState([]); // cookbook titles + '__uncategorized'
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customCuisines, setCustomCuisines] = useState(() => LS.get('customCuisines', []));
  // --- User Preferences & Interactions ---------------------------------------
  const [heartedIds, setHeartedIds] = useState(() => LS.get('heartedIds', []));
  const [makeSoonIds, setMakeSoonIds] = useState(() => LS.get('makeSoonIds', []));
  const [cookingRecipe, setCookingRecipe] = useState(null); // recipe object to mark cooked
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryLayout, setLibraryLayout] = useState('grid'); // 'grid' | 'list'

  useEffect(() => { LS.set('customCuisines', customCuisines); }, [customCuisines]);

  const toggleHeart = useCallback((id) => {
    setHeartedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (authToken) authFetch(`${API}/api/user/favorites`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: next }) }).catch(() => {});
      return next;
    });
  }, [authToken, authFetch]);

  const toggleMakeSoon = useCallback((id) => {
    setMakeSoonIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (authToken) authFetch(`${API}/api/user/make-soon`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ makeSoon: next }) }).catch(() => {});
      return next;
    });
  }, [authToken, authFetch]);

  // --- Settings & Appearance -------------------------------------------------
  const [darkMode, setDarkModeRaw] = useState(() => LS.get('darkMode', false));
  const setDarkMode = (v) => { setDarkModeRaw(v); LS.set('darkMode', v); };

  const [tabBarTabs, setTabBarTabsRaw] = useState(() => LS.get('tabBarTabs', ['home', 'recipes', 'kitchen', 'grocery']));
  const setTabBarTabs = (v) => { setTabBarTabsRaw(v); LS.set('tabBarTabs', v); };

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [units, setUnitsRaw] = useState(() => LS.get('units', 'metric'));
  const [dietaryFilters, setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));
  const [hideIncompatible, setHideIncompatibleRaw] = useState(() => LS.get('hideIncompatible', false));
  const setHideIncompatible = (v) => { setHideIncompatibleRaw(v); LS.set('hideIncompatible', v); };
  // --- App-Level Data (loaded from API) --------------------------------------
  const [cookbooks, setCookbooks] = useState([]);
  const [cookLog, setCookLog] = useState([]);
  const [cookingNotes, setCookingNotes] = useState([]);
  const setUnits = (v) => { setUnitsRaw(v); LS.set('units', v); };
  const setDietaryFilters = (fn) => setDietaryFiltersRaw(prev => { const next = typeof fn === 'function' ? fn(prev) : fn; LS.set('dietaryFilters', next); return next; });

  const kitchenLoadedFromAPI = useRef(false);

  useEffect(() => {
    LS.set('fridgeIngredients', fridgeIngredients);
    // Only sync to API after the initial load is done (prevent overwriting server data with stale localStorage)
    if (kitchenLoadedFromAPI.current) {
      syncKitchenToAPI(fridgeIngredients, pantryStaples);
    }
  }, [fridgeIngredients]); // eslint-disable-line
  useEffect(() => {
    LS.set('pantryStaples', pantryStaples);
    if (kitchenLoadedFromAPI.current) {
      syncKitchenToAPI(fridgeIngredients, pantryStaples);
    }
  }, [pantryStaples]); // eslint-disable-line

  const loadData = useCallback(async () => {
    try {
      const [recipeRes, notesRes, cbRes] = await Promise.all([
        fetch(`${API}/api/recipes`),
        authFetch ? authFetch(`${API}/api/cooking-notes`) : fetch(`${API}/api/cooking-notes`),
        fetch(`${API}/api/cookbooks`),
      ]);
      if (!recipeRes.ok) throw new Error('Failed to load data');
      const { recipes: recipeData } = await recipeRes.json();
      if (notesRes.ok) { const d = await notesRes.json(); setCookingNotes(d.notes || []); }
      if (cbRes.ok) { const d = await cbRes.json(); setCookbooks(d.cookbooks || d || []); }
      // Autocomplete pool: kitchen items first (exact match guaranteed), then recipe ingredients
      // Kitchen items are loaded separately via /api/user/kitchen after this block
      const recipeIngNames = [...new Set(recipeData.flatMap(r => r.ingredients || []))].sort();
      setAllIngredients(recipeIngNames.map(name => ({ name })));
      setRecipes(recipeData);

      // Load user-specific data if logged in
      if (authToken) {
        const [logRes, favsRes, soonRes] = await Promise.all([
          authFetch(`${API}/api/user/cook-log`),
          authFetch(`${API}/api/user/favorites`),
          authFetch(`${API}/api/user/make-soon`),
        ]);
        if (logRes.ok)  { const d = await logRes.json();  setCookLog(d.entries || []); }
        if (favsRes.ok) { const d = await favsRes.json(); setHeartedIds(d.favorites || []); }
        if (soonRes.ok) { const d = await soonRes.json(); setMakeSoonIds(d.makeSoon || []); }
        // Re-fetch cooking notes with auth
        try { const r = await authFetch(`${API}/api/cooking-notes`); if (r.ok) { const d = await r.json(); setCookingNotes(d.notes || []); } } catch {}
        // Load kitchen from API â€” ALWAYS overrides localStorage so devices stay in sync
        try {
          const kitRes = await authFetch(`${API}/api/user/kitchen`);
          if (kitRes.ok) {
            const { kitchen } = await kitRes.json();
            const fridge = kitchen.filter(k => k.storage_type === 'fridge').map(k => k.ingredient_name);
            const pantry = kitchen.filter(k => k.storage_type === 'pantry').map(k => k.ingredient_name);
            // Temporarily disable sync so loading from API doesn't write stale data back
            kitchenLoadedFromAPI.current = false;
            setFridgeIngredients(fridge);
            setPantryStaples(pantry);
            // Re-enable sync after state settles
            setTimeout(() => { kitchenLoadedFromAPI.current = true; }, 200);
          }
        } catch {}
      }

    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [authToken, authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const allMyIngredients = useMemo(() => new Set([...fridgeIngredients, ...pantryStaples].map(i => i.toLowerCase().trim())), [fridgeIngredients, pantryStaples]);

  const matches = useMemo(() => {
    if (allMyIngredients.size === 0) return [];
    const kitchenArr = [...allMyIngredients]; // array for substring checks
    // Substring match: "chicken" in kitchen matches "chicken thighs" in recipe, and vice versa
    const hasMatch = (recipeIng) => {
      const r = recipeIng.toLowerCase().trim();
      return kitchenArr.some(k => r.includes(k) || k.includes(r));
    };
    const m = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const have    = recipeIngredients.filter(i => hasMatch(i));
      const missing = recipeIngredients.filter(i => !hasMatch(i));
      const matchScore = recipeIngredients.length === 0 ? 0 : have.length / recipeIngredients.length;
      return { id: recipe.id, have, missing, matchScore, canMake: missing.length === 0 && recipeIngredients.length > 0 };
    });
    m.sort((a, b) => { if (a.canMake && !b.canMake) return -1; if (!a.canMake && b.canMake) return 1; return b.matchScore - a.matchScore; });
    return m;
  }, [allMyIngredients, recipes]);

  const matchById = useMemo(() => { const map = new Map(); for (const m of matches) map.set(m.id, m); return map; }, [matches]);

  useEffect(() => { setLibraryPage(1); }, [librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes, activeCookbooks]);
  const libraryRecipes = useMemo(() => {
    let list = recipes;
    const q = librarySearch.toLowerCase().trim();
    if (q) list = list.filter(r => r.name.toLowerCase().includes(q));
    if (activeCuisines.length) list = list.filter(r => activeCuisines.includes(r.cuisine || ''));
    if (activeTags.length) list = list.filter(r => activeTags.every(tag => (r.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())));
    if (activeProgresses.length) {
      list = list.filter(r => activeProgresses.some(p => {
        if (p === '__readytocook')  return matchById.get(r.id)?.canMake;
        if (p === '__almostready')  { const m = matchById.get(r.id); return m && m.matchScore >= 0.7 && !m.canMake; }
        if (p === '__makesoon') return makeSoonIds.includes(r.id);
        if (p === '__incomplete') return r.status === 'incomplete';
        if (p === '__needstweaking') return r.status === 'needs tweaking';
        if (p === '__favorite') return heartedIds.includes(r.id);
        if (p === '__complete') return !r.recipe_incomplete && r.status === 'complete';
        if (p === '__totry') return r.status === 'to try';
        return false;
      }));
    }
    if (maxCalories !== null) {
      list = list.filter(r => {
        const c = toNum(r.calories);
        if (c === null) return true;
        return calDir === 'under' ? c <= maxCalories : c >= maxCalories;
      });
    }
    if (maxMinutes !== null) {
      // Parse time strings like '45 mins', '1 hr 20 mins', '1.5 hours', '90 min'
      const parseMinutes = (t) => {
        if (!t) return null;
        const s = t.toLowerCase();
        const hrs  = parseFloat((s.match(/([\d.]+)\s*h/)  || [])[1] || 0);
        const mins = parseFloat((s.match(/([\d.]+)\s*m(?!o)/) || [])[1] || 0);
        const total = hrs * 60 + mins;
        return total > 0 ? total : null;
      };
      list = list.filter(r => {
        const mins = parseMinutes(r.time);
        // Exclude recipes with no time set â€” we can't confirm they're under the limit
        if (mins === null) return false;
        return mins <= maxMinutes;
      });
    }
    // Cookbook filter
    if (activeCookbooks.length) {
      list = list.filter(r => {
        const cb = (r.cookbook || '').trim();
        return activeCookbooks.some(k => {
          if (k === '__uncategorized') return !cb;
          return cb.toLowerCase() === k.toLowerCase();
        });
      });
    }
    // Hide recipes with dietary conflicts if user opted in
    if (hideIncompatible && dietaryFilters.length > 0) {
      list = list.filter(r => {
        const ings = (r.ingredients || []).map(i => typeof i === 'string' ? { name: i } : i);
        const conflicts = checkDietaryConflicts(ings, dietaryFilters);
        return conflicts.length === 0;
      });
    }
    return list;
  }, [recipes, librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes, matchById, hideIncompatible, dietaryFilters, activeCookbooks, makeSoonIds]);

  const hasActiveFilters = !!(librarySearch || activeTags.length || activeCuisines.length || activeProgresses.length || maxCalories !== null || maxMinutes !== null || activeCookbooks.length);
  // Filter button highlight: only when filter chips/sliders are active (not search text)
  const hasActiveFilterChips = !!(activeTags.length || activeCuisines.length || activeProgresses.length || maxCalories !== null || maxMinutes !== null || activeCookbooks.length);
  const clearAllFilters = () => { setLibrarySearch(''); setActiveTags([]); setActiveCuisines([]); setActiveProgresses([]); setMaxCalories(null); setMaxMinutes(null); setActiveCookbooks([]); };

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
      <div className="error-icon">âš ï¸</div>
      <h2>Couldn't connect to the server</h2>
      <p>{error}</p>
      <p className="error-hint">Make sure your backend is running and your .env is configured.</p>
      <button className="btn btn--primary" onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  return (
    <div className="app">
      {showLogin && <LoginModal onLogin={handleLogin} />}
      {/* app__scroll wraps everything EXCEPT the tab bar so keyboard never moves the bar */}
      <div className="app__scroll" ref={appScrollRef}>
      <header className="app-header">
        <div className="app-header__bar">
          {/* Mobile: back/search bar (recipes view) or logo */}
          <div className="app-header__mobile-left">
            {/* All pages: back button (non-home) + search pill always visible */}
            {!mobileSearchOpen ? (
              <>
                {view !== 'home' && (
                  <button className="app-header__back-btn" onClick={() => setView('home')} aria-label="Back to Home">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                )}
                {view === 'home' && (
                  <button className="app-header__brand app-header__brand--mobile-compact" onClick={() => setView('home')}>
                    <span className="app-header__logo"><Icon name="flame" size={20} color="var(--terracotta)" strokeWidth={1.75} /></span>
                  </button>
                )}
                {/* Search pill on ALL pages including Home */}
                <button className="app-header__mobile-search-pill" onClick={() => setMobileSearchOpen(true)}>
                  <Icon name="search" size={14} strokeWidth={2} />
                  <span>{mobileSearchSubmitted && mobileSearchQuery ? mobileSearchQuery : 'Search recipes...'}</span>
                </button>
              </>
            ) : (
              /* Search bar open â€” shown from any page */
              <div className="app-header__mobile-search-bar" style={{position:'relative'}}>
                <Icon name="search" size={14} strokeWidth={2} color="var(--warm-gray)" />
                <input
                  className="app-header__mobile-search-input"
                  placeholder="Search recipes..."
                  value={mobileSearchQuery}
                  autoFocus
                  style={{ fontSize: '16px', touchAction: 'manipulation' }}
                  onChange={e => { setMobileSearchQuery(e.target.value); setMobileSearchSubmitted(false); setLibrarySearch(e.target.value); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const q = mobileSearchQuery.toLowerCase().trim();
                      const hits = recipes.filter(r => r.name.toLowerCase().includes(q));
                      if (hits.length === 1) {
                        setMobileSearchOpen(false);
                        openRecipe(hits[0]);
                      } else {
                        setMobileSearchSubmitted(true);
                        setMobileSearchOpen(false);
                        setLibrarySearch(mobileSearchQuery);
                        setView('recipes');
                      }
                    }
                    if (e.key === 'Escape') { setMobileSearchOpen(false); }
                  }}
                />
                {mobileSearchQuery && (
                  <button className="app-header__mobile-search-clear" onClick={() => { setMobileSearchQuery(''); setMobileSearchSubmitted(false); setLibrarySearch(''); }}>âœ•</button>
                )}
                {!mobileSearchQuery && (
                  <button className="app-header__mobile-search-clear" onClick={() => { setMobileSearchOpen(false); setMobileSearchQuery(''); setLibrarySearch(''); }}>âœ•</button>
                )}
                {/* Autocomplete dropdown with images */}
                {mobileSearchQuery && !mobileSearchSubmitted && (() => {
                  const q = mobileSearchQuery.toLowerCase().trim();
                  const suggestions = recipes.filter(r => r.name.toLowerCase().includes(q)).slice(0, 6);
                  return suggestions.length > 0 ? (
                    <div className="mobile-search-dropdown">
                      {suggestions.map(r => (
                        <button key={r.id} className="mobile-search-dropdown__item" onMouseDown={e => {
                          e.preventDefault();
                          setMobileSearchOpen(false);
                          setMobileSearchQuery(r.name);
                          setMobileSearchSubmitted(true);
                          openRecipe(r);
                        }}>
                          {r.coverImage
                            ? <img src={r.coverImage} alt={r.name} className="mobile-search-dropdown__item-img" />
                            : <div className="mobile-search-dropdown__item-img-placeholder"><Icon name="image" size={16} color="var(--ash)" strokeWidth={1.5} /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mobile-search-dropdown__item-name">{r.name}</div>
                            {(r.cuisine || r.time) && <div className="mobile-search-dropdown__item-meta">{[r.cuisine, r.time].filter(Boolean).join(' Â· ')}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          {/* Desktop brand (always shown on desktop) */}
          <button className="app-header__brand app-header__brand--desktop" onClick={() => setView('home')}>
            <span className="app-header__logo"><Icon name="flame" size={20} color="var(--terracotta)" strokeWidth={1.75} /></span>
            <span className="app-header__title">Hearth</span>
          </button>
          {/* Desktop nav */}
          <nav className="nav-tabs">
            {[
              { key: 'home',      label: 'Home'         },
              { key: 'recipes',   label: 'Recipes'      },
              { key: 'kitchen',   label: 'Kitchen'      },
              { key: 'grocery',   label: 'Grocery'      },
              { key: 'cookbooks', label: 'Cookbooks'    },
              { key: 'notes',     label: 'Notes'        },
              ...(isAdmin ? [{ key: 'add', label: 'Add' }] : []),
            ].map(({ key, label }) => (
              <button key={key} className={`nav-tab ${view === key ? 'nav-tab--active' : ''}`} onClick={() => setView(key)} disabled={key === 'recipes' && recipes.length === 0}>
                {label}
              </button>
            ))}
          </nav>
          {/* User avatar -- desktop only */}
          {authUser && (
            <button className="header-user-btn header-user-btn--desktop-only" onClick={() => setView('profile')} title="Go to profile">
              <span className="header-user-btn__name">{authUser.display_name || authUser.username}</span>
            </button>
          )}
          {/* Mobile hamburger */}
          <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(o => !o)} aria-label="Menu">
            <span className={`mobile-menu-btn__bar ${mobileNavOpen ? 'mobile-menu-btn__bar--open-1' : ''}`} />
            <span className={`mobile-menu-btn__bar ${mobileNavOpen ? 'mobile-menu-btn__bar--open-2' : ''}`} />
            <span className={`mobile-menu-btn__bar ${mobileNavOpen ? 'mobile-menu-btn__bar--open-3' : ''}`} />
          </button>
        </div>
        {/* Mobile nav overlay â€” floats over content, does not push page down */}
        {mobileNavOpen && (
          <>
            {/* Backdrop to close on tap-outside */}
            <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
            <nav className="mobile-nav-overlay">
              {/* Brand header */}
              <div className="mobile-nav-overlay__brand">
                <span className="mobile-nav-overlay__flame"><Icon name="flame" size={22} color="var(--terracotta)" strokeWidth={1.75} /></span>
                <span className="mobile-nav-overlay__title">Hearth</span>
              </div>
              <div className="mobile-nav-overlay__divider" />
              {/* Nav items */}
              {[
                { key: 'home',      label: 'Home',      icon: 'home'      },
                { key: 'recipes',   label: 'Recipes',   icon: 'bookOpen'  },
                { key: 'kitchen',   label: 'Kitchen',   icon: 'package'   },
                { key: 'grocery',   label: 'Grocery',   icon: 'cart'      },
                { key: 'cookbooks', label: 'Cookbooks', icon: 'bookMarked'},
                { key: 'notes',     label: 'Notes',     icon: 'lightbulb' },
                ...(isAdmin ? [{ key: 'add', label: 'Add Recipe', icon: 'plus' }] : []),
              ].map(({ key, label, icon }) => (
                <button key={key}
                  className={`mobile-nav-item ${view === key ? 'mobile-nav-item--active' : ''}`}
                  onClick={() => { setView(key); setMobileNavOpen(false); }}
                  disabled={key === 'recipes' && recipes.length === 0}>
                  <Icon name={icon} size={16} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
              <div className="mobile-nav-overlay__divider" />
              {authUser && (
                <button
                  className={`mobile-nav-item ${view === 'profile' ? 'mobile-nav-item--active' : ''}`}
                  onClick={() => { setView('profile'); setMobileNavOpen(false); }}
                >
                  <Icon name="user" size={16} strokeWidth={1.75} /> Profile
                </button>
              )}
              {authUser && (
                <button className="mobile-nav-item mobile-nav-item--signout" onClick={() => { handleLogout(); setMobileNavOpen(false); }}>
                  <Icon name="arrowRight" size={16} strokeWidth={1.75} /> Sign out
                </button>
              )}
            </nav>
          </>
        )}
      </header>

      {view === 'recipe' && !editingRecipe && (
        <>
          {/* iOS-style: ghost of the PREVIOUS screen sits behind, dimmed, slightly pushed left */}
          <div style={{
            position:'fixed', inset:0, zIndex:1, overflow:'hidden', pointerEvents:'none',
            background: 'var(--parchment)',
          }}>
            {/* Dim overlay -- lightens as page slides away */}
            <div style={{
              position:'absolute', inset:0, zIndex:2,
              background:'rgba(0,0,0,0.18)',
              opacity: swipeDx > 0 ? Math.max(0, 1 - swipeDx / 300) : 1,
              transition: swipeDx === 0 ? 'opacity 0.3s ease' : 'none',
            }} />
            {/* Previous-screen indicator: subtle back chevron + label */}
            <div style={{
              position:'absolute', left:16, top:'50%', transform:'translateY(-50%)',
              zIndex:3, display:'flex', alignItems:'center', gap:6,
              color:'var(--warm-gray)', fontSize:14, fontWeight:600,
              opacity: swipeDx > 30 ? Math.min((swipeDx - 30) / 80, 1) : 0,
              transition: swipeDx === 0 ? 'opacity 0.2s ease' : 'none',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </div>
          </div>
          {/* Current recipe page -- slides right on swipe */}
          <div
            onTouchStart={handleSwipeTouchStart}
            onTouchMove={handleSwipeTouchMove}
            onTouchEnd={handleSwipeTouchEnd}
            style={{
              flex:1, display:'flex', flexDirection:'column',
              position:'relative', zIndex:2,
              transform: swipeDx > 0 ? `translateX(${Math.min(swipeDx, window.innerWidth)}px)` : 'none',
              transition: swipeDx === 0 ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
              boxShadow: swipeDx > 0 ? '-12px 0 32px rgba(0,0,0,0.22)' : 'none',
              willChange: 'transform',
            }}
          >
        <RecipePage
          recipe={selectedRecipe} bodyIngredients={recipeBodyIngredients} instructions={recipeInstructions} notes={recipeNotes} cookingNotes={cookingNotes}
          loading={recipeLoading} onBack={() => setView(lastView)}
          allIngredients={allIngredients}
          cookbooks={cookbooks}
          dietaryFilters={dietaryFilters}
          authFetch={authFetch}
          isAdmin={isAdmin}
          onMarkCooked={(recipeId, toRemove) => {
            setMakeSoonIds(prev => prev.filter(id => id !== recipeId));
            if (toRemove?.length) {
              const lower = toRemove.map(n => n.toLowerCase().trim());
              setFridgeIngredients(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
              setPantryStaples(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
            }
            authFetch(`${API}/api/user/cook-log`).then(r => r.json()).then(d => setCookLog(d.entries || [])).catch(() => {});
          }}
          isHearted={selectedRecipe ? heartedIds.includes(selectedRecipe.id) : false}
          onToggleHeart={() => selectedRecipe && toggleHeart(selectedRecipe.id)}
          isMakeSoon={selectedRecipe ? makeSoonIds.includes(selectedRecipe.id) : false}
          onToggleMakeSoon={() => selectedRecipe && toggleMakeSoon(selectedRecipe.id)}
          onDelete={(deletedId) => {
            setHeartedIds(prev => prev.filter(x => x !== deletedId));
            setMakeSoonIds(prev => prev.filter(x => x !== deletedId));
            // Remove any cookbook entry whose recipeId matches the deleted recipe
            setCookbooks(prev => prev.map(cb => ({
              ...cb,
              recipes: (cb.recipes || []).filter(e => e.recipeId !== deletedId),
            })));
            loadData();
            setView(lastView);
          }}
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
          </div>
        </>
      )}

      {view === 'recipe' && editingRecipe && (
        <RecipeEditor
          recipe={selectedRecipe} bodyIngredients={recipeBodyIngredients} instructions={recipeInstructions} notes={recipeNotes}
          allIngredients={allIngredients}
          authFetch={authFetch}
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
        <KitchenTab fridgeIngredients={fridgeIngredients} setFridgeIngredients={setFridgeIngredients} pantryStaples={pantryStaples} setPantryStaples={setPantryStaples} recipes={recipes} />
      )}

      {/* ======================================================
          HOME VIEW
      ====================================================== */}
      {view === 'home' && (
        <main className="view home-view">

          {/* -- Left column -- */}
          <div className="home-main">

            {/* -- â± Make Soon -- */}
            {(() => {
              const makeSoonRecipes = recipes.filter(r => makeSoonIds.includes(r.id));
              return (
                <div className="home-section">
                  <div className="home-section__header">
                    <h2 className="home-section__title">Make Soon</h2>
                    {makeSoonIds.length > 0 && (
                      <button className="btn btn--ghost btn--sm home-section__view-all" onClick={() => { setActiveTags([]); setActiveCuisines([]); setActiveProgresses(['__makesoon']); setActiveCookbooks([]); setLibrarySearch(''); setLibraryPage(1); setView('recipes'); }}>View all â†’</button>
                    )}
                  </div>
                  {makeSoonIds.length === 0 ? (
                    <div className="home-empty-cta" onClick={() => setView('recipes')}>
                      <span className="home-empty-cta__icon"><Icon name="list" size={32} strokeWidth={1.5} /></span>
                      <div>
                        <p className="home-empty-cta__title">Plan your week</p>
                        <p className="home-empty-cta__sub">Tap <span style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle',margin:'0 2px'}}><Icon name="timer" size={13} strokeWidth={2} /></span> on any recipe to add it here</p>
                      </div>
                      <span className="home-empty-cta__arrow">â†’</span>
                    </div>
                  ) : (
                    <HScrollRow count={makeSoonRecipes.length}>
                        {makeSoonRecipes.map(r => (
                          <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                            isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                            isMakeSoon={true} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                            onMarkCooked={(recipe) => setCookingRecipe(recipe)} allIngredients={allIngredients} />
                        ))}
                    </HScrollRow>
                  )}
                </div>
              );
            })()}

            {/* -- What can I make? -- */}
            {(() => {
              const goodMatches = matches.filter(m => m.matchScore > 0);
              return (
                <div className="home-section">
                  <div className="home-section__header">
                    <h2 className="home-section__title">What can I make?</h2>
                    {allMyIngredients.size > 0 ? (
                      <button className="btn btn--ghost btn--sm home-section__view-all" onClick={() => { setActiveProgresses(['__makesoon']); setActiveTags([]); setActiveCuisines([]); setActiveCookbooks([]); setLibrarySearch(''); setLibraryPage(1); setView('recipes'); }}>View all â†’</button>
                    ) : (
                      <button className="btn btn--ghost btn--sm" onClick={() => setView('kitchen')}>Set ingredients â†’</button>
                    )}
                  </div>
                  {allMyIngredients.size === 0 ? (
                    <div className="home-empty-cta" onClick={() => setView('kitchen')}>
                      <span className="home-empty-cta__icon"><Icon name="chefHat" size={32} strokeWidth={1.5} /></span>
                      <div>
                        <p className="home-empty-cta__title">Add your kitchen &amp; pantry ingredients</p>
                        <p className="home-empty-cta__sub">We'll show you what you can cook right now</p>
                      </div>
                      <span className="home-empty-cta__arrow">â†’</span>
                    </div>
                  ) : goodMatches.length > 0 ? (
                    <HScrollRow count={goodMatches.length}>
                      {goodMatches.map(m => {
                          const r = recipes.find(x => x.id === m.id);
                          if (!r) return null;
                          return <RecipeCard key={r.id} recipe={r} match={m} onClick={openRecipe}
                            isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                            isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                            showScore={true} allIngredients={allIngredients} />;
                        })}
                    </HScrollRow>
                  ) : <p className="home-no-matches">No matches yet -- try adding more ingredients in the Kitchen tab.</p>}
                </div>
              );
            })()}

                    </div>{/* end home-main */}
        </main>
      )}

      {view === 'recipes' && (() => {
        const allCuisinesPool = GEO_CUISINES; // strictly geo only -- DB cuisine values are not shown as filters
        const PAGE_SIZE = window.innerWidth <= 640 ? 12 : 25;
        const totalPages = Math.max(1, Math.ceil(libraryRecipes.length / PAGE_SIZE));
        const safePage = Math.min(libraryPage, totalPages);
        const pageRecipes = libraryRecipes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
        const toggleTag = k => setActiveTags(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const toggleCuisine = c => setActiveCuisines(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
        const toggleProgress = k => setActiveProgresses(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const toggleCookbook = k => setActiveCookbooks(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const activeCount = activeTags.length + activeCuisines.length + activeProgresses.length + (maxCalories !== null ? 1 : 0) + (maxMinutes !== null ? 1 : 0) + activeCookbooks.length;
        return (
          <main className="view">
            {/* -- Page header -- */}
            <div className="recipes-page-header">
              {mobileSearchSubmitted && mobileSearchQuery ? (
                <div className="recipes-page-header__search-results">
                  <h1 className="recipes-page-header__title">Search results for <em>"{mobileSearchQuery}"</em></h1>
                  <button className="recipes-page-header__clear" onClick={() => { setMobileSearchQuery(''); setMobileSearchSubmitted(false); setLibrarySearch(''); }}>âœ• Clear</button>
                </div>
              ) : (
                <h1 className="recipes-page-header__title">All Recipes</h1>
              )}
            </div>

            {/* -- Search + Filter Toggle -- */}
            <div className="recipes-search-row">
              <div className="recipes-search-row__top recipes-search-row__top--desktop-search">
                <div className="filter-bar__search-wrap filter-bar__search-wrap--standalone">
                  <span className="filter-bar__search-icon"><Icon name="search" size={15} strokeWidth={2} /></span>
                  <input
                    className="filter-bar__search"
                    type="search"
                    placeholder="Search recipes..."
                    value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                  />
                  {librarySearch && (
                    <button className="filter-bar__clear-x" onClick={() => setLibrarySearch('')}>âœ•</button>
                  )}
                </div>
                <button
                  className={`layout-toggle-btn ${libraryLayout === 'list' ? 'layout-toggle-btn--active' : ''}`}
                  onClick={() => { setLibraryLayout(l => l === 'grid' ? 'list' : 'grid'); setLibraryPage(1); }}
                  title={libraryLayout === 'grid' ? 'Switch to list view' : 'Switch to gallery view'}
                >
                  {libraryLayout === 'grid' ? <Icon name="list" size={16} strokeWidth={2} /> : <Icon name="grid" size={16} strokeWidth={2} />}
                </button>
              </div>
              {/* Mobile: filters + layout toggle row (no search bar since it's in the header) */}
              <div className="recipes-search-row__top recipes-search-row__top--mobile-filters">
                <div className="recipes-search-row__bottom recipes-search-row__bottom--mobile-inline">
                  <button
                    className={`filters-toggle-btn ${filtersOpen ? 'filters-toggle-btn--open' : ''} ${hasActiveFilters ? 'filters-toggle-btn--active' : ''}`}
                    onClick={() => setFiltersOpen(o => !o)}
                  >
                    <><Icon name="sliders" size={14} strokeWidth={2} /> Filters{activeCount > 0 ? ` Â· ${activeCount}` : ''}</>
                    <span className="filters-toggle-btn__arrow">{filtersOpen ? 'â–´' : 'â–¾'}</span>
                  </button>
                  {hasActiveFilters && (
                    <button className="filter-bar__reset" onClick={clearAllFilters}>âœ• Clear</button>
                  )}
                </div>
                <button
                  className={`layout-toggle-btn ${libraryLayout === 'list' ? 'layout-toggle-btn--active' : ''}`}
                  onClick={() => { setLibraryLayout(l => l === 'grid' ? 'list' : 'grid'); setLibraryPage(1); }}
                  title={libraryLayout === 'grid' ? 'Switch to list view' : 'Switch to gallery view'}
                >
                  {libraryLayout === 'grid' ? <Icon name="list" size={16} strokeWidth={2} /> : <Icon name="grid" size={16} strokeWidth={2} />}
                </button>
              </div>
              <div className="recipes-search-row__bottom recipes-search-row__bottom--desktop-only">
                <button
                  className={`filters-toggle-btn ${filtersOpen ? 'filters-toggle-btn--open' : ''} ${hasActiveFilters ? 'filters-toggle-btn--active' : ''}`}
                  onClick={() => setFiltersOpen(o => !o)}
                >
                  <><Icon name="sliders" size={14} strokeWidth={2} /> Filters{activeCount > 0 ? ` Â· ${activeCount}` : ''}</>
                  <span className="filters-toggle-btn__arrow">{filtersOpen ? 'â–´' : 'â–¾'}</span>
                </button>
                {hasActiveFilters && (
                  <button className="filter-bar__reset" onClick={clearAllFilters}>âœ• Clear</button>
                )}
              </div>
            </div>

            {/* -- Filter Panel -- */}
            {filtersOpen && (
              <div className="filter-panel">

                {/* Cuisine -- rounded icon chips */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Cuisine</span>
                  <div className="filter-panel__chips">
                    {allCuisinesPool.map(c => (
                      <button key={c}
                        className={`filter-bar__chip ${activeCuisines.includes(c) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleCuisine(c)}>
                        {c}
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

                {/* Cookbook */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Cookbook</span>
                  <div className="filter-panel__chips">
                    <button
                      className={`filter-bar__chip ${activeCookbooks.includes('__uncategorized') ? 'filter-bar__chip--active' : ''}`}
                      onClick={() => toggleCookbook('__uncategorized')}
                    >No cookbook</button>
                    {cookbooks.map(cb => (
                      <button key={cb.title}
                        className={`filter-bar__chip ${activeCookbooks.includes(cb.title) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleCookbook(cb.title)}
                      >{cb.title}</button>
                    ))}
                  </div>
                </div>

                {/* Calories slider */}
                <div className="filter-panel__group filter-panel__group--slider">
                  <div className="filter-panel__slider-header">
                    <span className="filter-panel__label">Calories</span>
                    <div className="filter-panel__cal-dir">
                      {['under','over'].map(d => (
                        <button key={d} className={`filter-panel__dir-btn ${calDir === d ? 'filter-panel__dir-btn--active' : ''}`}
                          onClick={() => setCalDir(d)}>{d}</button>
                      ))}
                    </div>
                    {maxCalories !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxCalories(null)}>âœ• clear</button>}
                  </div>
                  <div className="filter-panel__slider-wrap">
                    <span className="filter-panel__slider-edge">100</span>
                    <div className="filter-panel__slider-track">
                      {maxCalories !== null && (
                        <div className="filter-panel__slider-bubble"
                          style={{ left: `${((maxCalories - 100) / 1400) * 100}%` }}>
                          {calDir} {maxCalories} kcal
                        </div>
                      )}
                      <input type="range" className="filter-panel__slider" min={100} max={1500} step={50}
                        value={maxCalories ?? 800}
                        onChange={e => setMaxCalories(Number(e.target.value))}
                        onMouseDown={() => { if (maxCalories === null) setMaxCalories(800); }}
                        onTouchStart={() => { if (maxCalories === null) setMaxCalories(800); }}
                      />
                    </div>
                    <span className="filter-panel__slider-edge">1500</span>
                  </div>
                </div>

                {/* Time slider */}
                <div className="filter-panel__group filter-panel__group--slider">
                  <div className="filter-panel__slider-header">
                    <span className="filter-panel__label">Time</span>
                    {maxMinutes !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxMinutes(null)}>âœ• clear</button>}
                  </div>
                  <div className="filter-panel__slider-wrap">
                    <span className="filter-panel__slider-edge">10m</span>
                    <div className="filter-panel__slider-track">
                      {maxMinutes !== null && (
                        <div className="filter-panel__slider-bubble"
                          style={{ left: `${((maxMinutes - 10) / 170) * 100}%` }}>
                          under {maxMinutes} min
                        </div>
                      )}
                      <input type="range" className="filter-panel__slider" min={10} max={180} step={5}
                        value={maxMinutes ?? 60}
                        onChange={e => setMaxMinutes(Number(e.target.value))}
                        onMouseDown={() => { if (maxMinutes === null) setMaxMinutes(60); }}
                        onTouchStart={() => { if (maxMinutes === null) setMaxMinutes(60); }}
                      />
                    </div>
                    <span className="filter-panel__slider-edge">180m</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="active-filter-pills">
                {activeCuisines.map(c => <span key={c} className="active-filter-pill">{CUISINE_ICON[c] && <Icon name={CUISINE_ICON[c]} size={12} strokeWidth={2} />} {c} <button onClick={() => toggleCuisine(c)}>âœ•</button></span>)}
                {activeTags.map(k => <span key={k} className="active-filter-pill">{TAG_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleTag(k)}>âœ•</button></span>)}
                {activeProgresses.map(k => <span key={k} className="active-filter-pill">{PROGRESS_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleProgress(k)}>âœ•</button></span>)}
                {activeCookbooks.map(k => <span key={k} className="active-filter-pill">{k === '__uncategorized' ? 'No cookbook' : k} <button onClick={() => toggleCookbook(k)}>âœ•</button></span>)}
                {maxCalories !== null && <span className="active-filter-pill">{calDir} {maxCalories} kcal <button onClick={() => setMaxCalories(null)}>âœ•</button></span>}
                {maxMinutes !== null && <span className="active-filter-pill">under {maxMinutes} min <button onClick={() => setMaxMinutes(null)}>âœ•</button></span>}
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
                  {libraryLayout === 'grid' ? (
                    <div className="recipe-grid">
                      {pageRecipes.map(r => (
                        <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                          isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                          isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                          showScore={activeProgresses.some(p => p === '__readytocook' || p === '__almostready')}
                          onConvertRef={(recipe) => setCookingRecipe({ ...recipe, _convertRef: true })}
                          allIngredients={allIngredients}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="recipe-list-table">
                      <div className="recipe-list-table__header">
                        <span className="rlt__col rlt__col--name">Recipe</span>
                        <span className="rlt__col rlt__col--cuisine">Cuisine</span>
                        <span className="rlt__col rlt__col--tags">Tags</span>
                        <span className="rlt__col rlt__col--time">Time</span>
                        <span className="rlt__col rlt__col--cal">Calories</span>
                        <span className="rlt__col rlt__col--protein">Protein</span>
                        <span className="rlt__col rlt__col--status">Status</span>
                        <span className="rlt__col rlt__col--actions"></span>
                      </div>
                      {pageRecipes.map(r => {
                        const calories = toNum(r.calories);
                        const protein  = toNum(r.protein);
                        const match = matchById.get(r.id);
                        const canMakeNow = Boolean(match?.canMake);
                        const progress = r.recipe_incomplete ? <Icon name="alertTriangle" size={12} strokeWidth={2} /> : r.status === 'needs tweaking' ? <Icon name="tool" size={12} strokeWidth={2} /> : r.status === 'complete' ? <Icon name="checkCircle" size={12} strokeWidth={2} /> : r.status === 'to try' ? <Icon name="bookMarked" size={12} strokeWidth={2} /> : null;
                        const tags = r.tags || [];
                        return (
                          <div key={r.id} className={`recipe-list-table__row${makeSoonIds.includes(r.id) ? ' recipe-list-table__row--make-soon' : ''}`} onClick={() => openRecipe(r)}>
                            <span className="rlt__col rlt__col--name">
                              {r.coverImage
                                ? <img className="rlt__thumb" src={r.coverImage} alt="" loading="lazy" />
                                : <span className="rlt__thumb rlt__thumb--placeholder"><Icon name="image" size={20} color="var(--ash)" strokeWidth={1.5} /></span>}
                              <span className="rlt__name">{r.name}</span>
                              {canMakeNow && <span className="rlt__ready">âœ“</span>}
                            </span>
                            <span className="rlt__col rlt__col--cuisine">{r.cuisine || <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--tags">
                              {tags.length > 0
                                ? tags.slice(0, 3).map(t => {
                                    const def = TAG_FILTERS.find(f => f.key === t);
                                    return <span key={t} className="rlt__tag">{def ? def.label.split(' ')[0] : t}</span>;
                                  })
                                : <span className="rlt__empty">--</span>}
                              {tags.length > 3 && <span className="rlt__tag rlt__tag--more">+{tags.length - 3}</span>}
                            </span>
                            <span className="rlt__col rlt__col--time">{r.time || <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--cal">{calories !== null ? `${Math.round(calories)} kcal` : <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--protein">{protein !== null ? `${Math.round(protein)}g` : <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--status">{progress || <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--actions" onClick={e => e.stopPropagation()}>
                              <button
                                className={`rlt__heart ${heartedIds.includes(r.id) ? 'rlt__heart--on' : ''}`}
                                onClick={() => toggleHeart(r.id)}
                                title={heartedIds.includes(r.id) ? 'Remove from favorites' : 'Add to favorites'}
                              ><Icon name="heart" size={14} strokeWidth={2} /></button>
                              <button
                                className={`rlt__soon ${makeSoonIds.includes(r.id) ? 'rlt__soon--on' : ''}`}
                                onClick={() => toggleMakeSoon(r.id)}
                                title={makeSoonIds.includes(r.id) ? 'Remove from Make Soon' : 'Add to Make Soon'}
                              ><Icon name="timer" size={14} strokeWidth={2} /></button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {totalPages > 1 && (
                    <div className="pager">
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>â† Prev</button>
                      <div className="pager__pages">
                        {(() => {
                          const pages = [];
                          for (let p = 1; p <= totalPages; p++) {
                            const isFirst2 = p <= 2;
                            const isLast2 = p >= totalPages - 1;
                            const isNearCurrent = Math.abs(p - safePage) <= 1;
                            const show = totalPages <= 7 || isFirst2 || isLast2 || isNearCurrent;
                            if (!show) continue;
                            // Check if gap before this page
                            const prevWasShown = p === 1 || (() => {
                              const pp = p - 1;
                              return totalPages <= 7 || pp <= 2 || pp >= totalPages - 1 || Math.abs(pp - safePage) <= 1;
                            })();
                            if (!prevWasShown) pages.push(<span key={`ellipsis-${p}`} className="pager__ellipsis">...</span>);
                            pages.push(<button key={p} className={`pager__num ${p === safePage ? 'pager__num--active' : ''}`} onClick={() => setLibraryPage(p)}>{p}</button>);
                          }
                          return pages;
                        })()}
                      </div>
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>Next â†’</button>
                    </div>
                  )}
                  <p className="recipes-total-count">{libraryRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
                </>
              );
            })()}
          </main>
        );
      })()}

      {view === 'grocery' && <GroceryListTab recipes={recipes} makeSoonIds={makeSoonIds} allMyIngredients={allMyIngredients} allIngredients={allIngredients} setFridgeIngredients={setFridgeIngredients} setPantryStaples={setPantryStaples} />}

      {view === 'add' && (
        <AddRecipeTab
          allIngredients={allIngredients}
          cookbooks={cookbooks}
          authFetch={authFetch}
          onSaved={(newRecipe) => {
            if (newRecipe?.id) setMakeSoonIds(prev => [...prev, newRecipe.id]);
            loadData();
            openRecipe(newRecipe);
          }}
        />
      )}

      {view === 'notes' && (
        <CookingNotesTab notes={cookingNotes} setNotes={setCookingNotes} authFetch={authFetch} isAdmin={isAdmin} />
      )}

      {view === 'cookbooks' && (
        <CookbooksTab
          cookbooks={cookbooks}
          setCookbooks={setCookbooks}
          recipes={recipes}
          onOpenRecipe={openRecipe}
          allIngredients={allIngredients}
          setCookingRecipe={setCookingRecipe}
          authFetch={authFetch}
          cookLog={cookLog}
          onRecipeConverted={(newRecipe) => { loadData(); openRecipe(newRecipe); }}
          isAdmin={isAdmin}
        />
      )}

      {view === 'profile' && (
        <ProfileTab
          recipes={recipes}
          dietaryFilters={dietaryFilters}
          setDietaryFilters={setDietaryFilters}
          units={units}
          setUnits={setUnits}
          totalRecipes={recipes.length}
          hideIncompatible={hideIncompatible}
          setHideIncompatible={setHideIncompatible}
          authFetch={authFetch}
          authUser={authUser}
          onLogout={handleLogout}
          onAuthUserUpdate={(updatedUser) => { setAuthUser(updatedUser); LS.set('authUser', updatedUser); }}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          tabBarTabs={tabBarTabs}
          setTabBarTabs={setTabBarTabs}
        />
      )}

      {cookingRecipe && (
        <MarkCookedModal
          recipe={cookingRecipe}
          bodyIngredients={cookingRecipe._bodyIngredients || []}
          authFetch={authFetch}
          onSave={({ toRemove }) => {
            setMakeSoonIds(prev => prev.filter(id => id !== cookingRecipe.id));
            if (toRemove?.length) {
              const lower = toRemove.map(n => n.toLowerCase().trim());
              setFridgeIngredients(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
              setPantryStaples(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
            }
            setCookingRecipe(null);
            authFetch(`${API}/api/user/cook-log`).then(r => r.json()).then(d => setCookLog(d.entries || [])).catch(() => {});
          }}
          onClose={() => setCookingRecipe(null)}
        />
      )}

      {/* Footer: show on all pages except the recipe summary/editor, hidden on mobile */}
      {view !== 'recipe' && (
        <div className="site-footer-wrapper">
          <SiteFooter onNav={setView} />
        </div>
      )}

      {/* -- Scroll-to-top button -- */}
      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => {
          if (appScrollRef.current) appScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }} aria-label="Scroll to top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
      )}
      </div>{/* end app__scroll */}

      {/* -- Mobile bottom tab bar â€” outside scroll area so keyboard never moves it -- */}
      <nav className="mobile-tab-bar">
        {[
          { key: 'home',      icon: 'home',      label: 'Home'      },
          { key: 'recipes',   icon: 'bookOpen',  label: 'Recipes'   },
          { key: 'kitchen',   icon: 'package',   label: 'Kitchen'   },
          { key: 'grocery',   icon: 'cart',      label: 'Grocery'   },
          { key: 'cookbooks', icon: 'bookMarked', label: 'Cookbooks' },
          { key: 'notes',     icon: 'lightbulb', label: 'Notes'     },
          { key: 'profile',   icon: 'user',      label: 'Profile'   },
        ]
          .filter(t => t.key === 'profile' || tabBarTabs.includes(t.key))
          .map(({ key, icon, label }) => (
            <button key={key}
              className={`mobile-tab-bar__btn ${view === key ? 'mobile-tab-bar__btn--active' : ''}`}
              onClick={() => { setView(key); setMobileNavOpen(false); }}
            >
              <span className="mobile-tab-bar__btn-inner">
                <span className="mobile-tab-bar__icon"><Icon name={icon} size={22} strokeWidth={1.75} /></span>
                <span className="mobile-tab-bar__label">{label}</span>
              </span>
            </button>
          ))}
      </nav>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}