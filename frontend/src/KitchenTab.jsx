import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_STAPLES = [
  { label: 'Oils & Fats', items: ['olive oil', 'vegetable oil', 'sesame oil', 'coconut oil', 'ghee'] },
  { label: 'Sauces & Condiments', items: ['soy sauce', 'fish sauce', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce', 'hot sauce', 'sriracha', 'ketchup', 'mustard', 'dijon mustard', 'mayonnaise', 'tomato paste', 'passata', 'canned tomatoes', 'pesto', 'tahini', 'peanut butter'] },
  { label: 'Vinegars', items: ['balsamic vinegar', 'rice vinegar', 'apple cider vinegar', 'white vinegar'] },
  { label: 'Sweeteners & Baking', items: ['honey', 'maple syrup', 'sugar', 'brown sugar', 'flour', 'cornstarch', 'baking powder', 'baking soda', 'vanilla extract'] },
  { label: 'Spices & Herbs', items: ['salt', 'black pepper', 'white pepper', 'cumin', 'coriander', 'turmeric', 'paprika', 'smoked paprika', 'chilli flakes', 'cayenne', 'cinnamon', 'nutmeg', 'cardamom', 'garlic powder', 'onion powder', 'oregano', 'dried thyme', 'dried rosemary', 'dried basil', 'bay leaves', 'garam masala', 'curry powder', 'five spice', 'msg'] },
  { label: 'Grains & Pasta', items: ['white rice', 'brown rice', 'basmati rice', 'pasta', 'spaghetti', 'noodles', 'udon', 'ramen', 'couscous', 'quinoa', 'oats', 'breadcrumbs', 'panko', 'tortillas'] },
  { label: 'Legumes & Canned', items: ['lentils', 'chickpeas', 'black beans', 'kidney beans', 'cannellini beans', 'coconut milk', 'chicken stock', 'vegetable stock', 'beef stock'] },
];

const DEFAULT_FRIDGE_SUGGESTIONS = [
  { label: 'Produce', items: ['onion', 'garlic', 'ginger', 'lemon', 'lime', 'tomato', 'carrot', 'celery', 'bell pepper', 'spinach', 'potato', 'mushrooms', 'zucchini', 'broccoli', 'cucumber', 'avocado', 'spring onion', 'kale', 'sweet potato'] },
  { label: 'Dairy & Eggs', items: ['eggs', 'milk', 'butter', 'cheddar', 'parmesan', 'feta', 'mozzarella', 'cream', 'sour cream', 'yogurt', 'cream cheese'] },
  { label: 'Meat & Fish', items: ['chicken breast', 'chicken thighs', 'ground beef', 'salmon', 'bacon', 'pork', 'shrimp', 'tuna', 'sausage'] },
  { label: 'Freezer', items: ['frozen peas', 'frozen spinach', 'frozen shrimp', 'frozen berries', 'frozen edamame', 'frozen corn', 'bread'] },
];

// All items in the default staples list — used to classify recipe ingredients
const ALL_DEFAULT_STAPLE_ITEMS = new Set(DEFAULT_STAPLES.flatMap(g => g.items));

function loadLS(key, defaults) {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r); } catch {}
  return defaults.map(g => ({ label: g.label, items: [...g.items] }));
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const STAPLES_KEY = 'hearth_staples_config';
const FRIDGE_KEY  = 'hearth_fridge_config';

// ─── StaplePill ───────────────────────────────────────────────────────────────

function StaplePill({ item, active, onToggle, onDelete }) {
  return (
    <span className={`kpill ${active ? 'kpill--active' : ''}`}>
      <button className="kpill__toggle" onClick={onToggle}>
        {active && <span className="kpill__check-mark">✓</span>}
        {item}
      </button>
      <button className="kpill__rm" onPointerDown={e => e.stopPropagation()} onClick={onDelete} title="Remove from list">✕</button>
    </span>
  );
}

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ label, items, activeSet, onToggle, onDelete }) {
  return (
    <div className="kitchen-pill-group">
      <p className="kitchen-checklist__group-label">{label}</p>
      <div className="kitchen-checklist__items">
        {items.map(item => (
          <StaplePill key={item} item={item} active={activeSet.has(item)}
            onToggle={() => onToggle(item)} onDelete={() => onDelete(label, item)} />
        ))}
      </div>
    </div>
  );
}

// ─── StaplesAddBar — single add control at the top of the staples section ─────
function StaplesAddBar({ groups, onAdd }) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState('');
  const [group, setGroup] = useState('');

  const commit = () => {
    const v = name.trim().toLowerCase();
    if (!v) return;
    onAdd(group || 'My Pantry', v);
    setName(''); setGroup(''); setOpen(false);
  };

  if (!open) return (
    <button className="kitchen-section-addbtn" onClick={() => setOpen(true)}>+ Add Staple</button>
  );

  return (
    <div className="kitchen-section-addform">
      <input autoFocus className="kitchen-custom-input" value={name}
        placeholder="e.g. miso paste"
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setOpen(false); setName(''); } }} />
      <select className="kitchen-group-select" value={group} onChange={e => setGroup(e.target.value)}>
        <option value="">My Pantry (default)</option>
        {groups.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
      </select>
      <button className="kitchen-custom-add-btn" onClick={commit}>Add</button>
      <button className="btn btn--ghost btn--sm" onClick={() => { setOpen(false); setName(''); }}>✕</button>
    </div>
  );
}

// ─── UnCategorizedGroup — recipe ingredients not yet in any staples group ─────

function UncategorizedGroup({ items, groupLabels, onAssign, onAddToFridge }) {
  const [openFor, setOpenFor] = useState(null);

  if (!items.length) return null;

  return (
    <div className="kitchen-pill-group">
      <p className="kitchen-checklist__group-label">Uncategorized · from your recipes</p>
      <p className="kitchen-uncategorized-hint">Tap to add to fridge or assign to a pantry group</p>
      <div className="kitchen-checklist__items">
        {items.map(item => (
          <span key={item} className="kitchen-uncat-wrap">
            <button
              className="kitchen-chip kitchen-chip--uncat"
              onClick={() => setOpenFor(openFor === item ? null : item)}
            >
              {item} <span className="kitchen-chip__arrow">▾</span>
            </button>
            {openFor === item && (
              <div className="kitchen-uncat-picker">
                <button className="kitchen-uncat-option kitchen-uncat-option--fridge"
                  onClick={() => { onAddToFridge(item); setOpenFor(null); }}>
                  + Add to Fridge
                </button>
                {groupLabels.map(label => (
                  <button key={label} className="kitchen-uncat-option"
                    onClick={() => { onAssign(item, label); setOpenFor(null); }}>
                    → {label}
                  </button>
                ))}
              </div>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── DraggablePill — a fridge suggestion pill that can be dragged ─────────────

function DraggablePill({ id, item, groupLabel, active, onToggle, onDelete, onEdit, onMoveToStaples }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { item, fromGroup: groupLabel },
  });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(item);
  const [showMenu, setShowMenu] = useState(false);
  const pillRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const dismiss = (e) => {
      if (pillRef.current && pillRef.current.contains(e.target)) return;
      setShowMenu(false);
    };
    window.addEventListener('touchstart', dismiss, { capture: true });
    return () => window.removeEventListener('touchstart', dismiss, { capture: true });
  }, [showMenu]);

  const commitEdit = () => {
    const v = editVal.trim().toLowerCase();
    if (v && v !== item) onEdit(groupLabel, item, v);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="kpill kpill--editing">
        <input
          autoFocus
          className="kpill__edit-input"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={commitEdit}
          size={Math.max(item.length, editVal.length) + 2}
        />
      </span>
    );
  }

  return (
    <span
      ref={(el) => { setNodeRef(el); pillRef.current = el; }}
      className={`kpill ${active ? 'kpill--active' : ''} ${isDragging ? 'kpill--dragging' : ''} ${showMenu ? 'kpill--menu-open' : ''}`}
      style={{ opacity: isDragging ? 0.25 : 1, touchAction: 'none' }}
      onDoubleClick={() => { setEditing(true); setEditVal(item); }}
    >
      <button
        className="kpill__toggle"
        {...listeners}
        {...attributes}
        onClick={() => { navigator.vibrate?.(3); onToggle(); setShowMenu(false); }}
      >
        {active && <span className="kpill__check-mark">✓</span>}
        {item}
      </button>
      <button
        className="kpill__mv"
        tabIndex={-1}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onMoveToStaples(); setShowMenu(false); }}
        title="Move to Pantry"
      >★</button>
      <button
        className="kpill__rm"
        tabIndex={-1}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Remove"
      >✕</button>
      <button
        className="kpill__more"
        tabIndex={-1}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          navigator.vibrate?.([8, 4, 8]);
          setShowMenu(m => !m);
        }}
        aria-label="More actions"
      >···</button>
    </span>
  );
}

// ─── DroppableGroup — a fridge suggestion group that accepts drops ────────────

function DroppableGroup({ group, fridgeSet, onToggle, onDelete, onEdit, onMoveToStaples, isOver }) {
  const { setNodeRef } = useDroppable({ id: group.label });

  return (
    <div
      ref={setNodeRef}
      className={`kitchen-pill-group ${isOver ? 'kitchen-pill-group--drop-target' : ''}`}
    >
      <p className="kitchen-checklist__group-label">
        {group.label}
        {isOver && <span className="kitchen-drop-hint"> · drop here</span>}
      </p>
      <div className="kitchen-checklist__items">
        {group.items.map(item => (
          <DraggablePill
            key={item}
            id={`${group.label}::${item}`}
            item={item}
            groupLabel={group.label}
            active={fridgeSet.has(item)}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(group.label, item)}
            onEdit={onEdit}
            onMoveToStaples={() => onMoveToStaples(group.label, item)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── KitchenTab ───────────────────────────────────────────────────────────────

export default function KitchenTab({ fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples, recipes = [] }) {
  const [fridgeOpen,    setFridgeOpen]    = useState(true);
  const [staplesOpen,   setStaplesOpen]   = useState(false);
  const [staplesConfig, setStaplesConfig] = useState(() => loadLS(STAPLES_KEY, DEFAULT_STAPLES));
  const [fridgeConfig,  setFridgeConfig]  = useState(() => loadLS(FRIDGE_KEY,  DEFAULT_FRIDGE_SUGGESTIONS));
  const [activeDragId,  setActiveDragId]  = useState(null);
  const [overGroupId,   setOverGroupId]   = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // Fridge search — only used for the dropdown overlay; doesn't affect the expanded pill grid
  const [fridgeSearch,        setFridgeSearch]        = useState('');
  const [fridgeSearchFocused, setFridgeSearchFocused] = useState(false);
  const searchRef = useRef(null);

  const pantrySet  = useMemo(() => new Set(pantryStaples.map(s => s.toLowerCase())), [pantryStaples]);
  const fridgeSet  = useMemo(() => new Set(fridgeIngredients.map(s => s.toLowerCase())), [fridgeIngredients]);
  const allTracked = useMemo(() => new Set([...pantrySet, ...fridgeSet]), [pantrySet, fridgeSet]);

  const allStapleItems = useMemo(() => new Set(staplesConfig.flatMap(g => g.items)), [staplesConfig]);
  const allFridgeConfigItems = useMemo(() => new Set(fridgeConfig.flatMap(g => g.items)), [fridgeConfig]);

  // Recipe ingredients
  const recipeIngredients = useMemo(() => {
    const names = new Set();
    for (const r of recipes) for (const ing of (r.ingredients || [])) names.add(ing.toLowerCase().trim());
    return names;
  }, [recipes]);

  // Uncategorized = in recipes, not in any fridge or staples group, not tracked
  const uncategorized = useMemo(() => {
    const out = [];
    for (const n of recipeIngredients) {
      if (!allTracked.has(n) && !allStapleItems.has(n) && !allFridgeConfigItems.has(n)) out.push(n);
    }
    return out.sort();
  }, [recipeIngredients, allTracked, allStapleItems, allFridgeConfigItems]);

  // ── Staples mutations ─────────────────────────────────────────────────────

  const updateStaples = useCallback(fn => {
    setStaplesConfig(prev => { const next = fn(prev); saveLS(STAPLES_KEY, next); return next; });
  }, []);

  const deleteStapleItem = useCallback((groupLabel, item) => {
    updateStaples(prev => prev.map(g => g.label === groupLabel ? { ...g, items: g.items.filter(i => i !== item) } : g));
    setPantryStaples(prev => prev.filter(x => x !== item.toLowerCase()));
  }, [updateStaples, setPantryStaples]);

  const addStapleItem = useCallback((groupLabel, item) => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    updateStaples(prev => {
      const exists = prev.some(g => g.label === groupLabel);
      if (exists) return prev.map(g => g.label === groupLabel && !g.items.includes(lower) ? { ...g, items: [...g.items, lower] } : g);
      return [...prev, { label: groupLabel, items: [lower] }];
    });
    setPantryStaples(prev => pantrySet.has(lower) ? prev : [...prev, lower]);
  }, [updateStaples, setPantryStaples, pantrySet]);

  const assignUncategorized = useCallback((item, groupLabel) => {
    addStapleItem(groupLabel, item);
  }, [addStapleItem]);

  const togglePantry = useCallback(item => {
    const lower = item.toLowerCase();
    setPantryStaples(prev => pantrySet.has(lower) ? prev.filter(x => x !== lower) : [...prev, lower]);
  }, [pantrySet, setPantryStaples]);

  // ── Fridge mutations ──────────────────────────────────────────────────────

  const updateFridge = useCallback(fn => {
    setFridgeConfig(prev => { const next = fn(prev); saveLS(FRIDGE_KEY, next); return next; });
  }, []);

  const deleteFridgeSuggestion = useCallback((groupLabel, item) => {
    updateFridge(prev => prev.map(g => g.label === groupLabel ? { ...g, items: g.items.filter(i => i !== item) } : g));
  }, [updateFridge]);

  const addFridgeSuggestion = useCallback((groupLabel, item) => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    updateFridge(prev => prev.map(g =>
      g.label === groupLabel && !g.items.includes(lower) ? { ...g, items: [...g.items, lower] } : g
    ));
  }, [updateFridge]);

  const editFridgeSuggestion = useCallback((groupLabel, oldItem, newItem) => {
    const lower = newItem.toLowerCase().trim();
    if (!lower || lower === oldItem) return;
    updateFridge(prev => prev.map(g =>
      g.label === groupLabel ? { ...g, items: g.items.map(i => i === oldItem ? lower : i) } : g
    ));
    setFridgeIngredients(prev => prev.map(x => x === oldItem ? lower : x));
  }, [updateFridge, setFridgeIngredients]);

  const toggleFridge = useCallback(item => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    setFridgeIngredients(prev => fridgeSet.has(lower) ? prev.filter(x => x !== lower) : [...prev, lower]);
  }, [fridgeSet, setFridgeIngredients]);

  const addFridgeFromSearch = () => {
    const val = fridgeSearch.toLowerCase().trim();
    if (!val) return;
    if (allStapleItems.has(val)) {
      setFridgeSearch(''); setFridgeSearchFocused(false); return;
    }
    if (!fridgeSet.has(val)) setFridgeIngredients(prev => [...prev, val]);
    // If not in any suggestion group, add to Miscellaneous so user can drag it later
    const inAnyGroup = fridgeConfig.some(g => g.items.includes(val));
    if (!inAnyGroup) {
      updateFridge(prev => {
        const hasMisc = prev.some(g => g.label === 'Miscellaneous');
        if (hasMisc) {
          return prev.map(g => g.label === 'Miscellaneous' && !g.items.includes(val)
            ? { ...g, items: [...g.items, val] } : g);
        }
        return [...prev, { label: 'Miscellaneous', items: [val] }];
      });
    }
    setFridgeSearch('');
    setFridgeSearchFocused(false);
  };

  const moveToStaples = useCallback((groupLabel, item) => {
    updateFridge(prev => prev.map(g =>
      g.label === groupLabel ? { ...g, items: g.items.filter(i => i !== item) } : g
    ).filter(g => !(g.label === 'Miscellaneous' && g.items.length === 0)));
    setFridgeIngredients(prev => prev.filter(x => x !== item));
    updateStaples(prev => {
      const hasMy = prev.some(g => g.label === 'My Pantry');
      if (hasMy) return prev.map(g => g.label === 'My Pantry' && !g.items.includes(item) ? { ...g, items: [...g.items, item] } : g);
      return [...prev, { label: 'My Pantry', items: [item] }];
    });
    setPantryStaples(prev => pantrySet.has(item) ? prev : [...prev, item]);
  }, [updateFridge, setFridgeIngredients, updateStaples, setPantryStaples, pantrySet]);

  const addToFridgeFromRecipe = useCallback((item) => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    if (!fridgeSet.has(lower)) setFridgeIngredients(prev => [...prev, lower]);
    const inAnyGroup = fridgeConfig.some(g => g.items.includes(lower));
    if (!inAnyGroup) {
      updateFridge(prev => {
        const hasMisc = prev.some(g => g.label === 'Miscellaneous');
        if (hasMisc) return prev.map(g => g.label === 'Miscellaneous' && !g.items.includes(lower) ? { ...g, items: [...g.items, lower] } : g);
        return [...prev, { label: 'Miscellaneous', items: [lower] }];
      });
    }
  }, [fridgeSet, setFridgeIngredients, fridgeConfig, updateFridge]);

  // ── Drag handlers for fridge suggestion groups ────────────────────────────

  const handleDragStart = ({ active }) => setActiveDragId(active.id);
  const handleDragOver  = ({ over })   => setOverGroupId(over ? over.id : null);

  const handleDragEnd = ({ active, over }) => {
    setActiveDragId(null);
    setOverGroupId(null);
    if (!over || !active.data.current) return;
    const { item, fromGroup } = active.data.current;
    const toGroup = over.id;
    if (fromGroup === toGroup) return;
    updateFridge(prev => prev.map(g => {
      if (g.label === fromGroup) return { ...g, items: g.items.filter(i => i !== item) };
      if (g.label === toGroup && !g.items.includes(item)) return { ...g, items: [...g.items, item] };
      return g;
    // Remove Miscellaneous group if empty after move
    }).filter(g => !(g.label === 'Miscellaneous' && g.items.length === 0)));
  };

  // ── Search dropdown content (only shown when typing) ──────────────────────

  const searchDropdown = useMemo(() => {
    const q = fridgeSearch.toLowerCase().trim();
    if (!q) return null;
    const allFridgeItems = fridgeConfig.flatMap(g => g.items);
    const matches = [
      ...allFridgeItems.filter(i => i.includes(q) && !allStapleItems.has(i)),
      ...[...recipeIngredients].filter(n => n.includes(q) && !allFridgeItems.includes(n) && !allStapleItems.has(n)),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);
    return matches;
  }, [fridgeSearch, fridgeConfig, recipeIngredients, allStapleItems]);

  const showSearchDropdown = fridgeSearchFocused && !!fridgeSearch && searchDropdown && searchDropdown.length > 0;

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setFridgeSearchFocused(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalTracked  = fridgeIngredients.length + pantryStaples.length;
  const staplesMarked = pantryStaples.filter(s => allStapleItems.has(s)).length;

  return (
    <main className="view kitchen-view">
      <div className="kitchen-header">
        <div>
          <h2 className="kitchen-title">My Kitchen</h2>
          <p className="kitchen-subtitle">{totalTracked} ingredient{totalTracked !== 1 ? 's' : ''} tracked</p>
        </div>
        {totalTracked > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => { setFridgeIngredients([]); setPantryStaples([]); }}>
            Clear all
          </button>
        )}
      </div>

      {/* ── Fridge & Freezer ─────────────────────────────────────────────────── */}
      <section className="kitchen-section kitchen-section--collapsible">
        {/* Header — collapses/expands the pill groups only */}
        <button className="kitchen-section__header kitchen-section__header--btn" onClick={() => setFridgeOpen(p => !p)}>
          <div>
            <h3 className="kitchen-section__title">Groceries</h3>
            <p className="kitchen-section__sub">
              {fridgeIngredients.length > 0 ? `${fridgeIngredients.length} item${fridgeIngredients.length !== 1 ? 's' : ''} · perishables & fresh · drives "What can I make?"` : 'Perishables, produce & fresh · search above to add'}
            </p>
          </div>
          <span className={`kitchen-section__arrow ${fridgeOpen ? 'kitchen-section__arrow--open' : ''}`}>▾</span>
        </button>

        {/* Search bar — always visible regardless of collapse state */}
        <div className="kitchen-fridge-search-wrap" ref={searchRef}>
          <div className="kitchen-fridge-input-row">
            <input
              className="kitchen-fridge-input"
              placeholder="Search or add to fridge…"
              value={fridgeSearch}
              onChange={e => setFridgeSearch(e.target.value)}
              onFocus={() => setFridgeSearchFocused(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addFridgeFromSearch(); }
                if (e.key === 'Escape') { setFridgeSearch(''); setFridgeSearchFocused(false); }
                if (e.key === 'ArrowDown' && showSearchDropdown) e.preventDefault();
              }}
            />
          </div>

          {/* Autocomplete dropdown — clean list style, appears when typing */}
          {showSearchDropdown && (
            <ul className="kitchen-fridge-autocomplete">
              {searchDropdown.map(item => (
                <li key={item}>
                  <button
                    className={`kitchen-fridge-autocomplete__item ${fridgeSet.has(item) ? 'kitchen-fridge-autocomplete__item--active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); toggleFridge(item); setFridgeSearch(''); setFridgeSearchFocused(false); }}
                  >
                    <span className="kitchen-fridge-autocomplete__icon">
                      {fridgeSet.has(item) ? '✓' : '+'}
                    </span>
                    {item}
                    {fridgeSet.has(item) && <span className="kitchen-fridge-autocomplete__badge">in fridge</span>}
                  </button>
                </li>
              ))}
              {fridgeSearch && !searchDropdown.find(i => i === fridgeSearch.toLowerCase().trim()) && (
                <li>
                  <button
                    className="kitchen-fridge-autocomplete__item kitchen-fridge-autocomplete__item--new"
                    onMouseDown={e => { e.preventDefault(); addFridgeFromSearch(); }}
                  >
                    <span className="kitchen-fridge-autocomplete__icon">+</span>
                    Add "{fridgeSearch.trim()}"
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>



        {/* Collapsible pill groups with drag-and-drop */}
        {fridgeOpen && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="kitchen-fridge-groups">
              {fridgeConfig.map(group => (
                <DroppableGroup
                  key={group.label}
                  group={group}
                  fridgeSet={fridgeSet}
                  onToggle={toggleFridge}
                  onDelete={deleteFridgeSuggestion}
                  onEdit={editFridgeSuggestion}
                  onMoveToStaples={moveToStaples}
                  isOver={overGroupId === group.label}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDragId && (() => {
                const item = activeDragId.split('::')[1];
                return <span className="kpill kpill--drag-overlay"><span className="kpill__toggle">{item}</span></span>;
              })()}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      {/* ── Staples ──────────────────────────────────────────────────────────── */}
      <section className="kitchen-section kitchen-section--collapsible">
        <button className="kitchen-section__header kitchen-section__header--btn" onClick={() => setStaplesOpen(p => !p)}>
          <div>
            <h3 className="kitchen-section__title">Staples</h3>
            <p className="kitchen-section__sub">Oils, sauces, grains, spices · {staplesMarked} marked</p>
          </div>
          <span className={`kitchen-section__arrow ${staplesOpen ? 'kitchen-section__arrow--open' : ''}`}>▾</span>
        </button>

        {staplesOpen && (
          <div className="kitchen-checklist">
            <StaplesAddBar groups={staplesConfig} onAdd={addStapleItem} />
            {staplesConfig.map(group => (
              <PillGroup
                key={group.label}
                label={group.label}
                items={group.items}
                activeSet={pantrySet}
                onToggle={togglePantry}
                onDelete={deleteStapleItem}
              />
            ))}
            <UncategorizedGroup
              items={uncategorized}
              groupLabels={staplesConfig.map(g => g.label)}
              onAssign={assignUncategorized}
              onAddToFridge={addToFridgeFromRecipe}
            />
          </div>
        )}
      </section>
    </main>
  );
}
