import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

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
      <button className="kpill__label" onClick={onToggle}>
        {active && <span className="kpill__check">✓ </span>}{item}
      </button>
      <button className="kpill__delete" onClick={onDelete} title="Remove from list">×</button>
    </span>
  );
}

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ label, items, activeSet, onToggle, onDelete, onAdd }) {
  const [showInput, setShowInput] = useState(false);
  const [input, setInput]         = useState('');

  const commit = () => {
    const v = input.toLowerCase().trim();
    if (v) { onAdd(label, v); setInput(''); setShowInput(false); }
  };

  return (
    <div className="kitchen-pill-group">
      <p className="kitchen-checklist__group-label">{label}</p>
      <div className="kitchen-checklist__items">
        {items.map(item => (
          <StaplePill key={item} item={item} active={activeSet.has(item)}
            onToggle={() => onToggle(item)} onDelete={() => onDelete(label, item)} />
        ))}
        {showInput ? (
          <span className="kitchen-custom-input-wrap">
            <input className="kitchen-custom-input" autoFocus value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setShowInput(false); setInput(''); } }}
              placeholder="type & press Enter" />
            <button className="kitchen-custom-add-btn" onClick={commit}>Add</button>
          </span>
        ) : (
          <button className="kitchen-chip kitchen-chip--add" onClick={() => setShowInput(true)}>+ add</button>
        )}
      </div>
    </div>
  );
}

// ─── UnCategorizedGroup — recipe ingredients not yet in any staples group ─────

function UncategorizedGroup({ items, groupLabels, onAssign }) {
  const [openFor, setOpenFor] = useState(null); // item name that has picker open

  if (!items.length) return null;

  return (
    <div className="kitchen-pill-group">
      <p className="kitchen-checklist__group-label">Uncategorized · from your recipes</p>
      <p className="kitchen-uncategorized-hint">Tap an item to add it to a staples group</p>
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
                {groupLabels.map(label => (
                  <button key={label} className="kitchen-uncat-option"
                    onClick={() => { onAssign(item, label); setOpenFor(null); }}>
                    {label}
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

// ─── FridgeSuggestionGroup — in the expanded fridge panel ────────────────────

function FridgeSuggestionGroup({ group, fridgeSet, onToggle, onDelete, onAdd }) {
  const [showInput, setShowInput] = useState(false);
  const [input, setInput]         = useState('');

  const commit = () => {
    const v = input.toLowerCase().trim();
    if (v) { onAdd(group.label, v); onToggle(v); setInput(''); setShowInput(false); }
  };

  return (
    <div className="kitchen-pill-group">
      <p className="kitchen-checklist__group-label">{group.label}</p>
      <div className="kitchen-checklist__items">
        {group.items.map(item => (
          <span key={item} className={`kpill ${fridgeSet.has(item) ? 'kpill--active' : ''}`}>
            <button className="kpill__label" onClick={() => onToggle(item)}>
              {fridgeSet.has(item) && <span className="kpill__check">✓ </span>}{item}
            </button>
            <button className="kpill__delete" onClick={() => onDelete(group.label, item)} title="Remove suggestion">×</button>
          </span>
        ))}
        {showInput ? (
          <span className="kitchen-custom-input-wrap">
            <input className="kitchen-custom-input" autoFocus value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setShowInput(false); setInput(''); } }}
              placeholder="type & press Enter" />
            <button className="kitchen-custom-add-btn" onClick={commit}>Add</button>
          </span>
        ) : (
          <button className="kitchen-chip kitchen-chip--add" onClick={() => setShowInput(true)}>+ add</button>
        )}
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

  // Fridge search — only used for the dropdown overlay; doesn't affect the expanded pill grid
  const [fridgeSearch,        setFridgeSearch]        = useState('');
  const [fridgeSearchFocused, setFridgeSearchFocused] = useState(false);
  const searchRef = useRef(null);

  const pantrySet  = useMemo(() => new Set(pantryStaples.map(s => s.toLowerCase())), [pantryStaples]);
  const fridgeSet  = useMemo(() => new Set(fridgeIngredients.map(s => s.toLowerCase())), [fridgeIngredients]);
  const allTracked = useMemo(() => new Set([...pantrySet, ...fridgeSet]), [pantrySet, fridgeSet]);

  const allStapleItems = useMemo(() => new Set(staplesConfig.flatMap(g => g.items)), [staplesConfig]);

  // Recipe ingredients
  const recipeIngredients = useMemo(() => {
    const names = new Set();
    for (const r of recipes) for (const ing of (r.ingredients || [])) names.add(ing.toLowerCase().trim());
    return names;
  }, [recipes]);

  // Uncategorized = in recipes, not tracked anywhere, not in any current staples group
  const uncategorized = useMemo(() => {
    const out = [];
    for (const n of recipeIngredients) {
      if (!allTracked.has(n) && !allStapleItems.has(n)) out.push(n);
    }
    return out.sort();
  }, [recipeIngredients, allTracked, allStapleItems]);

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
    updateStaples(prev => prev.map(g =>
      g.label === groupLabel && !g.items.includes(lower) ? { ...g, items: [...g.items, lower] } : g
    ));
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

  const toggleFridge = useCallback(item => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    setFridgeIngredients(prev => fridgeSet.has(lower) ? prev.filter(x => x !== lower) : [...prev, lower]);
  }, [fridgeSet, setFridgeIngredients]);

  const addFridgeFromSearch = () => {
    const val = fridgeSearch.toLowerCase().trim();
    if (!val) return;
    if (!fridgeSet.has(val)) setFridgeIngredients(prev => [...prev, val]);
    setFridgeSearch('');
    setFridgeSearchFocused(false);
  };

  // ── Search dropdown content (only shown when typing) ──────────────────────

  const searchDropdown = useMemo(() => {
    const q = fridgeSearch.toLowerCase().trim();
    if (!q) return null;
    const allFridgeItems = fridgeConfig.flatMap(g => g.items);
    const matches = [
      ...allFridgeItems.filter(i => i.includes(q)),
      ...[...recipeIngredients].filter(n => n.includes(q) && !allFridgeItems.includes(n)),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);
    return matches;
  }, [fridgeSearch, fridgeConfig, recipeIngredients]);

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
            <h3 className="kitchen-section__title">Fridge &amp; Freezer</h3>
            <p className="kitchen-section__sub">
              {fridgeIngredients.length > 0 ? `${fridgeIngredients.length} item${fridgeIngredients.length !== 1 ? 's' : ''} · drives "What can I make?"` : 'Expand to browse or search to add'}
            </p>
          </div>
          <span className={`kitchen-section__arrow ${fridgeOpen ? 'kitchen-section__arrow--open' : ''}`}>▾</span>
        </button>

        {/* Search bar — always visible regardless of collapse state */}
        <div className="kitchen-fridge-search-wrap" ref={searchRef}>
          <div className="kitchen-fridge-input-row">
            <input
              className="kitchen-fridge-input"
              placeholder="Search ingredients..."
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

        {/* Active chips — always visible */}
        {fridgeIngredients.length > 0 && (
          <div className="kitchen-active-chips" style={{padding: '0 22px 12px'}}>
            {fridgeIngredients.map(item => (
              <button key={item} className="kitchen-chip kitchen-chip--active" onClick={() => toggleFridge(item)}>
                {item} <span className="kitchen-chip__remove">✕</span>
              </button>
            ))}
          </div>
        )}

        {/* Collapsible pill groups */}
        {fridgeOpen && (
          <div className="kitchen-fridge-groups">
            {fridgeConfig.map(group => (
              <FridgeSuggestionGroup
                key={group.label}
                group={group}
                fridgeSet={fridgeSet}
                onToggle={toggleFridge}
                onDelete={deleteFridgeSuggestion}
                onAdd={addFridgeSuggestion}
              />
            ))}
          </div>
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
            {staplesConfig.map(group => (
              <PillGroup
                key={group.label}
                label={group.label}
                items={group.items}
                activeSet={pantrySet}
                onToggle={togglePantry}
                onDelete={deleteStapleItem}
                onAdd={addStapleItem}
              />
            ))}
            <UncategorizedGroup
              items={uncategorized}
              groupLabels={staplesConfig.map(g => g.label)}
              onAssign={assignUncategorized}
            />
          </div>
        )}
      </section>
    </main>
  );
}
