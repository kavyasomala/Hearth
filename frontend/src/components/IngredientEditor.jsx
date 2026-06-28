import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../icons';
import { COMMON_UNITS } from '../constants';
import { haptic } from '../utils';
import { AutoGrowTextarea, DRAG_SENSORS } from './ui';

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
        const name = typeof ing === 'string' ? ing : ing?.name;
        if (!name) return null;
        const lower = name.toLowerCase();
        if (!lower.includes(q)) return null;
        const score = lower.startsWith(q) ? 0 : lower.indexOf(q);
        return { ing: name, score };
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
      <input className="editor-input" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKeyDown} placeholder="soy sauce" autoComplete="off" />
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
      <input className="editor-input editor-input--sm" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKeyDown} placeholder="tbsp" autoComplete="off" />
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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={`sortable-item ${isDragging ? 'sortable-item--dragging' : ''}`}>
      <div className="sortable-handle" {...attributes} {...listeners}>â ¿</div>
      {children}
    </div>
  );
};

// Step sortable item -- the step number bubble IS the drag handle

const StepSortableItem = ({ id, stepNum, grouped, children, onSnap, onUnsnap, canSnap }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={`step-sortable-row ${grouped ? 'step-sortable-row--grouped' : ''} ${isDragging ? 'step-sortable-row--dragging' : ''}`}>
      {/* Snap/unsnap tab â€” only shown when relevant */}
      {grouped ? (
        <button
          className="step-snap-btn step-snap-btn--out"
          onClick={onUnsnap}
          title="Remove from group"
          type="button"
        >
          <Icon name="arrowRight" size={10} strokeWidth={2.5} />
        </button>
      ) : canSnap ? (
        <button
          className="step-snap-btn step-snap-btn--in"
          onClick={onSnap}
          title="Add to group above"
          type="button"
        >
          <Icon name="arrowRight" size={10} strokeWidth={2.5} />
        </button>
      ) : null}
      <span className="editor-step-num editor-step-num--drag" title="Drag to reorder" {...attributes} {...listeners}>{stepNum}</span>
      {children}
    </div>
  );
};

// Step group row -- draggable group header for instruction sections

const StepGroupRow = ({ grp, onLabelChange, onRemove, onAddStep }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: grp._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };
  return (
    <div className="step-group-row" ref={setNodeRef} style={style}>
      <span className="step-group-row__drag" {...attributes} {...listeners}>â ¿</span>
      <input
        className="step-group-row__label-input"
        value={grp.name}
        onChange={e => onLabelChange(e.target.value)}
        placeholder="Group name (e.g. For the sauce, Marinade)â€¦"
      />
      {onAddStep && (
        <button className="ing-group-row__add-btn" onClick={onAddStep} title="Add step to this group">ï¼‹</button>
      )}
      <button className="editor-remove-btn" onClick={onRemove} title="Remove group">âœ•</button>
    </div>
  );
};

// --- Recipe Editor ----------------------------------------------------------

const IngFlatRow = ({ ing, onUpdate, onRemove, allIngredients = [] }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ing._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };
  return (
    <div className="ing-flat-row" ref={setNodeRef} style={style}>
      {/* Invisible full-row drag handle â€” long press activates on mobile */}
      <span 
        className="ing-flat-row__drag" 
        {...attributes} 
        {...listeners} 
        tabIndex={-1}
        style={{
          opacity: isDragging ? 0.4 : 0.15,
          fontSize: 10,
          color: 'var(--ash)',
          letterSpacing: '0.05em',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          flexShrink: 0,
          transition: 'opacity 0.2s',
        }}
      >Â·Â·</span>
      <div className="ing-flat-row__fields">
        {/* Row 1 */}
        <div className="ing-flat-row__row1">
          <input className="editor-input ing-flat-row__qty" value={ing.amount} onChange={e => onUpdate('amount', e.target.value)} placeholder="Qty" />
          <div className="ing-flat-row__unit-wrap">
            <UnitAutocomplete value={ing.unit} onChange={v => onUpdate('unit', v)} />
          </div>
          <div className="ing-flat-row__name-wrap">
            <IngredientAutocomplete value={ing.name} onChange={v => onUpdate('name', v)} allIngredients={allIngredients} />
          </div>
        </div>
        {/* Row 2 */}
        <div className="ing-flat-row__row2">
          <input className="editor-input ing-flat-row__prep" value={ing.prep_note || ''} onChange={e => onUpdate('prep_note', e.target.value)} placeholder="Prep note (e.g. finely chopped)" />
          <button
            className={`ing-opt-toggle ${ing.optional ? 'ing-opt-toggle--on' : ''}`}
            onClick={() => onUpdate('optional', !ing.optional)}
            type="button"
            tabIndex={-1}
          >
            {ing.optional ? 'optional' : 'required'}
          </button>
          <button className="editor-remove-btn" onClick={onRemove} tabIndex={-1}>âœ•</button>
        </div>
      </div>
    </div>
  );
};

const IngGroupRow = ({ ing, onLabelChange, onRemove, onAddIngredient }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ing._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };
  return (
    <div className="ing-group-row" ref={setNodeRef} style={style}>
      <span className="ing-flat-row__drag ing-group-row__drag" {...attributes} {...listeners}>â ¿</span>
      <input className="ing-group-row__label-input" value={ing.name} onChange={e => onLabelChange(e.target.value)} placeholder="Group name..." />
      <button className="ing-group-row__add-btn" onClick={onAddIngredient} title="Add ingredient to this group">ï¼‹</button>
      <button className="editor-remove-btn" onClick={onRemove} title="Remove group">âœ•</button>
    </div>
  );
};

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

export { IngredientAutocomplete, UnitAutocomplete, SortableItem, StepSortableItem, StepGroupRow, IngFlatRow, IngGroupRow, CookbookAutocomplete };
