import { useState, useMemo, useRef, useEffect } from 'react';

// ─── Curated lists ────────────────────────────────────────────────────────────

const PANTRY_SECTIONS = [
  {
    label: 'Oils & Fats',
    items: ['olive oil', 'vegetable oil', 'sesame oil', 'coconut oil', 'ghee'],
  },
  {
    label: 'Sauces & Condiments',
    items: ['soy sauce', 'fish sauce', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce',
            'hot sauce', 'sriracha', 'ketchup', 'mustard', 'dijon mustard', 'mayonnaise',
            'tomato paste', 'passata', 'canned tomatoes', 'pesto', 'tahini', 'peanut butter'],
  },
  {
    label: 'Vinegars',
    items: ['balsamic vinegar', 'rice vinegar', 'apple cider vinegar', 'white vinegar'],
  },
  {
    label: 'Sweeteners & Baking',
    items: ['honey', 'maple syrup', 'sugar', 'brown sugar', 'flour', 'cornstarch',
            'baking powder', 'baking soda', 'vanilla extract'],
  },
  {
    label: 'Spices & Herbs',
    items: ['salt', 'black pepper', 'white pepper', 'cumin', 'coriander', 'turmeric',
            'paprika', 'smoked paprika', 'chilli flakes', 'cayenne', 'cinnamon', 'nutmeg',
            'cardamom', 'garlic powder', 'onion powder', 'oregano', 'dried thyme',
            'dried rosemary', 'dried basil', 'bay leaves', 'garam masala', 'curry powder',
            'five spice', 'msg'],
  },
];

const STAPLES_SECTIONS = [
  {
    label: 'Grains & Pasta',
    items: ['white rice', 'brown rice', 'basmati rice', 'pasta', 'spaghetti', 'noodles',
            'udon', 'ramen', 'couscous', 'quinoa', 'oats', 'breadcrumbs', 'panko', 'tortillas'],
  },
  {
    label: 'Legumes & Canned',
    items: ['lentils', 'chickpeas', 'black beans', 'kidney beans', 'cannellini beans',
            'coconut milk', 'chicken stock', 'vegetable stock', 'beef stock'],
  },
];

const ALL_PRESET_ITEMS = new Set([
  ...PANTRY_SECTIONS.flatMap(g => g.items),
  ...STAPLES_SECTIONS.flatMap(g => g.items),
]);

const FRIDGE_SUGGESTIONS = [
  { label: 'Produce', items: ['onion', 'garlic', 'ginger', 'lemon', 'lime', 'tomato', 'carrot', 'celery', 'bell pepper', 'spinach', 'potato', 'mushrooms', 'zucchini', 'broccoli', 'cucumber', 'avocado', 'spring onion', 'kale', 'sweet potato'] },
  { label: 'Dairy & Eggs', items: ['eggs', 'milk', 'butter', 'cheddar', 'parmesan', 'feta', 'mozzarella', 'cream', 'sour cream', 'yogurt', 'cream cheese'] },
  { label: 'Meat & Fish', items: ['chicken breast', 'chicken thighs', 'ground beef', 'salmon', 'bacon', 'pork', 'shrimp', 'tuna', 'sausage'] },
  { label: 'Freezer', items: ['frozen peas', 'frozen spinach', 'frozen shrimp', 'frozen berries', 'frozen edamame', 'frozen corn', 'bread'] },
];

const isPantryItem = (name) => ALL_PRESET_ITEMS.has(name.toLowerCase().trim());

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ label, items, activeSet, onToggle, onAdd }) {
  const [showInput, setShowInput] = useState(false);
  const [input, setInput]         = useState('');

  const handleAdd = () => {
    const val = input.toLowerCase().trim();
    if (val) { onAdd(val); setInput(''); setShowInput(false); }
  };

  return (
    <div className="kitchen-pill-group">
      <p className="kitchen-checklist__group-label">{label}</p>
      <div className="kitchen-checklist__items">
        {items.map(item => (
          <button
            key={item}
            className={`kitchen-chip ${activeSet.has(item) ? 'kitchen-chip--active' : ''}`}
            onClick={() => onToggle(item)}
          >
            {activeSet.has(item) && <span className="kitchen-chip__check">✓ </span>}
            {item}
          </button>
        ))}
        {showInput ? (
          <span className="kitchen-custom-input-wrap">
            <input
              className="kitchen-custom-input"
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setShowInput(false); setInput(''); }
              }}
              placeholder="type & press Enter"
            />
            <button className="kitchen-custom-add-btn" onClick={handleAdd}>Add</button>
          </span>
        ) : (
          <button className="kitchen-chip kitchen-chip--add" onClick={() => setShowInput(true)}>
            + add yours
          </button>
        )}
      </div>
    </div>
  );
}

// ─── KitchenTab ───────────────────────────────────────────────────────────────

export default function KitchenTab({ fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples, recipes = [] }) {
  const [pantryOpen,   setPantryOpen]   = useState(false);
  const [staplesOpen,  setStaplesOpen]  = useState(false);
  const [notStockOpen, setNotStockOpen] = useState(true);

  const [fridgeInput,  setFridgeInput]  = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef(null);

  const pantrySet = useMemo(() => new Set(pantryStaples.map(s => s.toLowerCase())), [pantryStaples]);
  const fridgeSet = useMemo(() => new Set(fridgeIngredients.map(s => s.toLowerCase())), [fridgeIngredients]);
  const allTracked = useMemo(() => new Set([...pantrySet, ...fridgeSet]), [pantrySet, fridgeSet]);

  // Custom items = anything in pantryStaples not in any preset list
  const customItems = useMemo(
    () => pantryStaples.filter(s => !ALL_PRESET_ITEMS.has(s)),
    [pantryStaples]
  );

  const recipeIngredientPool = useMemo(() => {
    const names = new Set();
    for (const r of recipes) {
      for (const ing of (r.ingredients || [])) names.add(ing.toLowerCase().trim());
    }
    return names;
  }, [recipes]);

  const notInStock = useMemo(() => {
    const missing = [];
    for (const name of recipeIngredientPool) {
      if (!allTracked.has(name)) missing.push(name);
    }
    return missing.sort();
  }, [recipeIngredientPool, allTracked]);

  const recipeCountFor = useMemo(() => {
    const counts = {};
    for (const r of recipes) {
      for (const ing of (r.ingredients || [])) {
        const n = ing.toLowerCase().trim();
        counts[n] = (counts[n] || 0) + 1;
      }
    }
    return counts;
  }, [recipes]);

  // ── Toggles ──────────────────────────────────────────────────────────────

  const togglePantry = (item) => {
    const lower = item.toLowerCase();
    setPantryStaples(prev => pantrySet.has(lower) ? prev.filter(x => x !== lower) : [...prev, lower]);
  };

  const addToPantry = (item) => {
    const lower = item.toLowerCase().trim();
    if (lower && !pantrySet.has(lower)) setPantryStaples(prev => [...prev, lower]);
  };

  const toggleFridge = (item) => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    setFridgeIngredients(prev => fridgeSet.has(lower) ? prev.filter(x => x !== lower) : [...prev, lower]);
  };

  const addToFridge = (item) => {
    const lower = item.toLowerCase().trim();
    if (lower && !fridgeSet.has(lower)) setFridgeIngredients(prev => [...prev, lower]);
  };

  const addFromRecipes = (item) => {
    const lower = item.toLowerCase().trim();
    if (allTracked.has(lower)) {
      setPantryStaples(prev => prev.filter(x => x !== lower));
      setFridgeIngredients(prev => prev.filter(x => x !== lower));
    } else if (isPantryItem(lower)) {
      setPantryStaples(prev => [...prev, lower]);
    } else {
      setFridgeIngredients(prev => [...prev, lower]);
    }
  };

  const addFridgeFromInput = () => {
    const val = fridgeInput.toLowerCase().trim();
    if (!val) return;
    if (!fridgeSet.has(val)) setFridgeIngredients(prev => [...prev, val]);
    setFridgeInput('');
  };

  const filteredSuggestions = useMemo(() => {
    const q = fridgeInput.toLowerCase().trim();
    const recipeMatches = q
      ? [...recipeIngredientPool].filter(n => n.includes(q) && !fridgeSet.has(n))
      : [];
    const staticGroups = FRIDGE_SUGGESTIONS.map(group => ({
      ...group,
      items: q ? group.items.filter(item => item.includes(q)) : group.items,
    })).filter(g => g.items.length > 0);
    if (recipeMatches.length > 0) {
      return [{ label: 'From your recipes', items: recipeMatches.slice(0, 10) }, ...staticGroups];
    }
    return staticGroups;
  }, [fridgeInput, recipeIngredientPool, fridgeSet]);

  useEffect(() => {
    const handler = (e) => { if (inputRef.current && !inputRef.current.contains(e.target)) setInputFocused(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalTracked = fridgeIngredients.length + pantryStaples.length;

  const pantryCheckedCount  = pantryStaples.filter(s => PANTRY_SECTIONS.flatMap(g => g.items).includes(s) || customItems.includes(s)).length;
  const staplesCheckedCount = pantryStaples.filter(s => STAPLES_SECTIONS.flatMap(g => g.items).includes(s)).length;

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

          {(inputFocused || fridgeInput) && filteredSuggestions.length > 0 && (
            <div className="kitchen-suggestions">
              {filteredSuggestions.map(group => (
                <div key={group.label} className="kitchen-suggestions__group">
                  <p className="kitchen-suggestions__label">{group.label}</p>
                  <div className="kitchen-suggestions__chips">
                    {group.items.map(item => (
                      <button
                        key={item}
                        className={`kitchen-chip ${fridgeSet.has(item) ? 'kitchen-chip--active' : ''}`}
                        onMouseDown={e => { e.preventDefault(); toggleFridge(item); }}
                      >
                        {fridgeSet.has(item) && <span className="kitchen-chip__check">✓ </span>}
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {fridgeIngredients.length === 0 && !inputFocused && !fridgeInput && (
          <p className="kitchen-empty-hint">Tap the box above to add what's in your fridge</p>
        )}
      </section>

      {/* ── Not in stock ─────────────────────────────────────────────────────── */}
      {notInStock.length > 0 && (
        <section className="kitchen-section">
          <button className="kitchen-section__header kitchen-section__header--btn" onClick={() => setNotStockOpen(p => !p)}>
            <div>
              <h3 className="kitchen-section__title">Not in stock</h3>
              <p className="kitchen-section__sub">
                From your recipes · {notInStock.length} ingredient{notInStock.length !== 1 ? 's' : ''} — tap to mark as having
              </p>
            </div>
            <span className={`kitchen-section__arrow ${notStockOpen ? 'kitchen-section__arrow--open' : ''}`}>▾</span>
          </button>

          {notStockOpen && (
            <div className="kitchen-not-in-stock">
              {notInStock.map(item => (
                <button key={item} className="kitchen-chip kitchen-chip--missing" onClick={() => addFromRecipes(item)}>
                  {item}
                  {recipeCountFor[item] > 1 && (
                    <span className="kitchen-chip__count">{recipeCountFor[item]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Pantry ───────────────────────────────────────────────────────────── */}
      <section className="kitchen-section kitchen-section--collapsible">
        <button className="kitchen-section__header kitchen-section__header--btn" onClick={() => setPantryOpen(p => !p)}>
          <div>
            <h3 className="kitchen-section__title">Pantry</h3>
            <p className="kitchen-section__sub">Sauces, oils, condiments · {pantryCheckedCount} marked</p>
          </div>
          <span className={`kitchen-section__arrow ${pantryOpen ? 'kitchen-section__arrow--open' : ''}`}>▾</span>
        </button>

        {pantryOpen && (
          <div className="kitchen-checklist">
            {PANTRY_SECTIONS.map(group => (
              <PillGroup
                key={group.label}
                label={group.label}
                items={group.items}
                activeSet={pantrySet}
                onToggle={togglePantry}
                onAdd={addToPantry}
              />
            ))}
            {/* Custom pantry items that don't belong to a preset group */}
            {customItems.length > 0 && (
              <div className="kitchen-pill-group">
                <p className="kitchen-checklist__group-label">My additions</p>
                <div className="kitchen-checklist__items">
                  {customItems.map(item => (
                    <button
                      key={item}
                      className="kitchen-chip kitchen-chip--active"
                      onClick={() => togglePantry(item)}
                    >
                      ✓ {item} <span className="kitchen-chip__remove">✕</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Staples ──────────────────────────────────────────────────────────── */}
      <section className="kitchen-section kitchen-section--collapsible">
        <button className="kitchen-section__header kitchen-section__header--btn" onClick={() => setStaplesOpen(p => !p)}>
          <div>
            <h3 className="kitchen-section__title">Staples</h3>
            <p className="kitchen-section__sub">Pasta, rice, canned goods · {staplesCheckedCount} marked</p>
          </div>
          <span className={`kitchen-section__arrow ${staplesOpen ? 'kitchen-section__arrow--open' : ''}`}>▾</span>
        </button>

        {staplesOpen && (
          <div className="kitchen-checklist">
            {STAPLES_SECTIONS.map(group => (
              <PillGroup
                key={group.label}
                label={group.label}
                items={group.items}
                activeSet={pantrySet}
                onToggle={togglePantry}
                onAdd={addToPantry}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
