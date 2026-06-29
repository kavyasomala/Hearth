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

function loadLS(key, defaults) {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r); } catch {}
  return defaults.map(g => ({ label: g.label, items: [...g.items] }));
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const STAPLES_KEY = 'hearth_staples_config';
const FRIDGE_KEY  = 'hearth_fridge_config';

// ─── StaplePill — toggle active + hover-× to delete from list ────────────────

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

// ─── PillGroup — a labeled row of StaplePills + inline add ───────────────────

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
          <StaplePill
            key={item}
            item={item}
            active={activeSet.has(item)}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(label, item)}
          />
        ))}
        {showInput ? (
          <span className="kitchen-custom-input-wrap">
            <input
              className="kitchen-custom-input"
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setShowInput(false); setInput(''); } }}
              placeholder="type & press Enter"
            />
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
  const [staplesOpen,  setStaplesOpen]  = useState(false);
  const [staplesConfig, setStaplesConfig] = useState(() => loadLS(STAPLES_KEY, DEFAULT_STAPLES));
  const [fridgeConfig,  setFridgeConfig]  = useState(() => loadLS(FRIDGE_KEY,  DEFAULT_FRIDGE_SUGGESTIONS));

  const [fridgeInput,  setFridgeInput]  = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef(null);

  const pantrySet = useMemo(() => new Set(pantryStaples.map(s => s.toLowerCase())), [pantryStaples]);
  const fridgeSet = useMemo(() => new Set(fridgeIngredients.map(s => s.toLowerCase())), [fridgeIngredients]);
  const allTracked = useMemo(() => new Set([...pantrySet, ...fridgeSet]), [pantrySet, fridgeSet]);
  const allStapleItems = useMemo(() => new Set(staplesConfig.flatMap(g => g.items)), [staplesConfig]);

  // Recipe ingredients not yet tracked anywhere
  const recipeIngredientPool = useMemo(() => {
    const names = new Set();
    for (const r of recipes) for (const ing of (r.ingredients || [])) names.add(ing.toLowerCase().trim());
    return names;
  }, [recipes]);

  const notInStock = useMemo(() => {
    const out = [];
    for (const n of recipeIngredientPool) if (!allTracked.has(n)) out.push(n);
    return out.sort();
  }, [recipeIngredientPool, allTracked]);

  // ── Staples config mutations ──────────────────────────────────────────────

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

  const togglePantry = useCallback(item => {
    const lower = item.toLowerCase();
    setPantryStaples(prev => pantrySet.has(lower) ? prev.filter(x => x !== lower) : [...prev, lower]);
  }, [pantrySet, setPantryStaples]);

  // ── Fridge config mutations ───────────────────────────────────────────────

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

  const addFridgeFromInput = () => {
    const val = fridgeInput.toLowerCase().trim();
    if (!val) return;
    if (!fridgeSet.has(val)) setFridgeIngredients(prev => [...prev, val]);
    setFridgeInput('');
  };

  // ── Suggestions dropdown content ──────────────────────────────────────────

  // SuggestionGroup: items shown in dropdown, with hover-× to remove from config
  function SuggestionGroup({ group }) {
    const [showAdd, setShowAdd] = useState(false);
    const [addInput, setAddInput] = useState('');

    const commitAdd = () => {
      const v = addInput.toLowerCase().trim();
      if (v) { addFridgeSuggestion(group.label, v); toggleFridge(v); setAddInput(''); setShowAdd(false); }
    };

    return (
      <div className="kitchen-suggestions__group">
        <p className="kitchen-suggestions__label">{group.label}</p>
        <div className="kitchen-suggestions__chips">
          {group.items.map(item => (
            <span key={item} className={`kpill kpill--suggestion ${fridgeSet.has(item) ? 'kpill--active' : ''}`}>
              <button className="kpill__label" onMouseDown={e => { e.preventDefault(); toggleFridge(item); }}>
                {fridgeSet.has(item) && <span className="kpill__check">✓ </span>}{item}
              </button>
              <button
                className="kpill__delete"
                onMouseDown={e => { e.preventDefault(); deleteFridgeSuggestion(group.label, item); }}
                title="Remove suggestion"
              >×</button>
            </span>
          ))}
          {showAdd ? (
            <span className="kitchen-custom-input-wrap">
              <input
                className="kitchen-custom-input kitchen-custom-input--sm"
                autoFocus
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setShowAdd(false); setAddInput(''); } }}
                onMouseDown={e => e.stopPropagation()}
                placeholder="type & press Enter"
              />
              <button className="kitchen-custom-add-btn" onMouseDown={e => { e.preventDefault(); commitAdd(); }}>Add</button>
            </span>
          ) : (
            <button className="kitchen-chip kitchen-chip--add" onMouseDown={e => { e.preventDefault(); setShowAdd(true); }}>+ add</button>
          )}
        </div>
      </div>
    );
  }

  const filteredDropdown = useMemo(() => {
    const q = fridgeInput.toLowerCase().trim();

    // "Not in stock" from recipes — shown at top when no query, or filtered when searching
    const notInStockMatches = q
      ? notInStock.filter(n => n.includes(q))
      : notInStock;

    // Fridge suggestion groups, filtered by query
    const suggGroups = fridgeConfig.map(g => ({
      ...g,
      items: q ? g.items.filter(i => i.includes(q) && !fridgeSet.has(i)) : g.items,
    })).filter(g => g.items.length > 0);

    return { notInStockMatches, suggGroups };
  }, [fridgeInput, fridgeConfig, fridgeSet, notInStock]);

  const showDropdown = inputFocused || !!fridgeInput;

  useEffect(() => {
    const handler = (e) => { if (inputRef.current && !inputRef.current.contains(e.target)) setInputFocused(false); };
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
          <p className="kitchen-subtitle">{totalTracked} ingredient{totalTracked !== 1 ? 's' : ''} tracked · {notInStock.length} not in stock</p>
        </div>
        {totalTracked > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => { setFridgeIngredients([]); setPantryStaples([]); }}>
            Clear all
          </button>
        )}
      </div>

      {/* ── Fridge & Freezer ─────────────────────────────────────────────────── */}
      <section className="kitchen-section">
        <div className="kitchen-section__header">
          <div>
            <h3 className="kitchen-section__title">Fridge &amp; Freezer</h3>
            <p className="kitchen-section__sub">Update this when you shop — drives "What can I make?"</p>
          </div>
        </div>

        {fridgeIngredients.length > 0 && (
          <div className="kitchen-active-chips">
            {fridgeIngredients.map(item => (
              <button key={item} className="kitchen-chip kitchen-chip--active" onClick={() => toggleFridge(item)}>
                {item} <span className="kitchen-chip__remove">✕</span>
              </button>
            ))}
          </div>
        )}

        <div className="kitchen-fridge-input-wrap" ref={inputRef}>
          <div className="kitchen-fridge-input-row">
            <input
              className="kitchen-fridge-input"
              placeholder="Search or type an ingredient..."
              value={fridgeInput}
              onChange={e => setFridgeInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFridgeFromInput(); } }}
            />
            {fridgeInput && (
              <button className="btn btn--primary btn--sm" onClick={addFridgeFromInput}>Add</button>
            )}
          </div>

          {showDropdown && (
            <div className="kitchen-suggestions">
              {/* Not in stock from recipes */}
              {filteredDropdown.notInStockMatches.length > 0 && (
                <div className="kitchen-suggestions__group">
                  <p className="kitchen-suggestions__label">Not in stock · from your recipes</p>
                  <div className="kitchen-suggestions__chips">
                    {filteredDropdown.notInStockMatches.map(item => (
                      <button
                        key={item}
                        className="kitchen-chip kitchen-chip--missing"
                        onMouseDown={e => {
                          e.preventDefault();
                          if (allStapleItems.has(item)) setPantryStaples(prev => [...prev, item]);
                          else setFridgeIngredients(prev => fridgeSet.has(item) ? prev.filter(x => x !== item) : [...prev, item]);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Editable suggestion groups */}
              {filteredDropdown.suggGroups.map(group => (
                <SuggestionGroup key={group.label} group={group} />
              ))}
              {filteredDropdown.notInStockMatches.length === 0 && filteredDropdown.suggGroups.length === 0 && (
                <p className="kitchen-suggestions__empty">Press Enter to add "{fridgeInput}"</p>
              )}
            </div>
          )}
        </div>

        {fridgeIngredients.length === 0 && !showDropdown && (
          <p className="kitchen-empty-hint">Tap the box above to add what's in your fridge</p>
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
          </div>
        )}
      </section>
    </main>
  );
}
