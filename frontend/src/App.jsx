import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

// ─── localStorage helpers ──────────────────────────────────────────────────
const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ─── Helpers ───────────────────────────────────────────────────────────────
const pct = (score) => Math.round(score * 100);

const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

// ─── Recipe Summary Card ───────────────────────────────────────────────────
const RecipeCard = ({ recipe, match, onClick }) => {
  const {
    name,
    coverImage,
    cuisine,
    calories,
    protein,
  } = recipe;

  const matchScore = match?.matchScore ?? null;
  const canMakeNow = Boolean(match?.canMake);

  return (
    <article className="recipe-card" onClick={() => onClick(recipe)}>
      <div className="recipe-card__image">
        {coverImage ? (
          <img src={coverImage} alt={name} loading="lazy" />
        ) : (
          <div className="recipe-card__image-placeholder">No photo</div>
        )}

        {matchScore !== null && (
          <div className={`recipe-card__score ${canMakeNow ? 'recipe-card__score--ready' : ''}`}>
            {pct(matchScore)}%
          </div>
        )}
      </div>

      <div className="recipe-card__body">
        <div className="recipe-card__title-row">
          <h3 className="recipe-card__title">{name}</h3>
          {canMakeNow && <span className="recipe-card__can-make">Can make</span>}
        </div>

        <div className="recipe-card__meta">
          {cuisine && <Badge>{cuisine}</Badge>}
        </div>

        <div className="recipe-card__nutrition">
          {typeof calories === 'number' && <span className="recipe-card__pill">{Math.round(calories)} kcal</span>}
          {typeof protein === 'number' && <span className="recipe-card__pill">{Math.round(protein)}g protein</span>}
        </div>
      </div>
    </article>
  );
};

// ─── Notion content renderer ───────────────────────────────────────────────
const NotionContent = ({ content }) => {
  if (!content || content.length === 0) return null;

  const out = [];
  for (let i = 0; i < content.length; i++) {
    const node = content[i];

    if (node.type === 'bulleted_list_item') {
      const items = [];
      while (i < content.length && content[i].type === 'bulleted_list_item') {
        items.push(content[i]);
        i++;
      }
      i--;
      out.push(
        <ul key={`ul-${i}`} className="notion-list">
          {items.map((it, idx) => <li key={idx}>{it.text}</li>)}
        </ul>
      );
      continue;
    }

    if (node.type === 'numbered_list_item') {
      const items = [];
      while (i < content.length && content[i].type === 'numbered_list_item') {
        items.push(content[i]);
        i++;
      }
      i--;
      out.push(
        <ol key={`ol-${i}`} className="notion-list">
          {items.map((it, idx) => <li key={idx}>{it.text}</li>)}
        </ol>
      );
      continue;
    }

    if (node.type === 'heading_1') out.push(<h1 key={i} className="notion-h1">{node.text}</h1>);
    else if (node.type === 'heading_2') out.push(<h2 key={i} className="notion-h2">{node.text}</h2>);
    else if (node.type === 'heading_3') out.push(<h3 key={i} className="notion-h3">{node.text}</h3>);
    else if (node.type === 'paragraph') out.push(<p key={i} className="notion-p">{node.text}</p>);
    else if (node.type === 'quote') out.push(<blockquote key={i} className="notion-quote">{node.text}</blockquote>);
    else if (node.type === 'divider') out.push(<hr key={i} className="notion-hr" />);
    else if (node.type === 'image') {
      if (node.url) {
        out.push(
          <figure key={i} className="notion-figure">
            <img src={node.url} alt={node.caption || 'Recipe image'} />
            {node.caption && <figcaption>{node.caption}</figcaption>}
          </figure>
        );
      }
    }
  }

  return <div className="notion-content">{out}</div>;
};

// ─── Fridge Tab ─────────────────────────────────────────────────────────────
const FridgeTab = ({ allIngredients, fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples }) => {
  const [section, setSection] = useState('fridge'); // 'fridge' | 'pantry'
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const source = allIngredients;
    const filtered = source.filter(i => i.toLowerCase().includes(search.toLowerCase()));
    return filtered.reduce((acc, ing) => {
      const letter = ing[0]?.toUpperCase() || '#';
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(ing);
      return acc;
    }, {});
  }, [allIngredients, search]);

  const isFridge = section === 'fridge';
  const selected = isFridge ? fridgeIngredients : pantryStaples;
  const setSelected = isFridge ? setFridgeIngredients : setPantryStaples;

  const toggle = (ing) => {
    const lower = ing.toLowerCase();
    setSelected(prev => prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]);
  };

  return (
    <main className="view">
      <div className="fridge-header">
        <div>
          <h2 className="fridge-title">My Kitchen</h2>
          <p className="fridge-subtitle">Select what you have so we can suggest recipes</p>
        </div>
      </div>

      <div className="fridge-section-tabs">
        <button className={`fridge-tab ${section === 'fridge' ? 'fridge-tab--active' : ''}`} onClick={() => setSection('fridge')}>
          🧊 Fridge
          {fridgeIngredients.length > 0 && <span className="fridge-tab__count">{fridgeIngredients.length}</span>}
        </button>
        <button className={`fridge-tab ${section === 'pantry' ? 'fridge-tab--active' : ''}`} onClick={() => setSection('pantry')}>
          🫙 Pantry Staples
          {pantryStaples.length > 0 && <span className="fridge-tab__count">{pantryStaples.length}</span>}
        </button>
      </div>

      <p className="fridge-section-hint">
        {isFridge
          ? 'Perishables you currently have — update this regularly'
          : 'Things you always keep stocked (rice, soy sauce, olive oil…) — set once and forget'}
      </p>

      <div className="picker__search-row">
        <input
          className="picker__search"
          type="search"
          placeholder={`Search ingredients...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="picker__actions">
          <button className="btn btn--ghost" onClick={() => setSelected([])}>Clear</button>
          <button className="btn btn--ghost" onClick={() => setSelected(allIngredients.map(i => i.toLowerCase()))}>All</button>
        </div>
      </div>

      <div className="picker__grid-wrapper picker__grid-wrapper--full">
        {Object.entries(grouped).sort().map(([letter, items]) => (
          <div key={letter} className="picker__group">
            <div className="picker__group-label">{letter}</div>
            <div className="picker__chips">
              {items.map(ing => {
                const isSelected = selected.includes(ing.toLowerCase());
                return (
                  <button key={ing} className={`chip ${isSelected ? 'chip--selected' : ''}`} onClick={() => toggle(ing)}>
                    {isSelected && <span className="chip__check">✓</span>}
                    {ing}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && <p className="picker__empty">No ingredients match "{search}"</p>}
      </div>
    </main>
  );
};

// ─── Settings Tab ────────────────────────────────────────────────────────────
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Nut-Free'];

const SettingsTab = ({ units, setUnits, dietaryFilters, setDietaryFilters, lastSynced, onSync, recipes, onIngredientsSaved }) => {
  const toggleDiet = (d) => setDietaryFilters(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <main className="view">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-section">
        <h3 className="settings-section__title">⚖️ Units</h3>
        <p className="settings-section__hint">Choose your preferred measurement system</p>
        <div className="settings-toggle-row">
          <button className={`settings-toggle ${units === 'metric' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('metric')}>
            Metric <span className="settings-toggle__sub">g, ml, °C</span>
          </button>
          <button className={`settings-toggle ${units === 'imperial' ? 'settings-toggle--active' : ''}`} onClick={() => setUnits('imperial')}>
            Imperial <span className="settings-toggle__sub">oz, cups, °F</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">🥗 Dietary Filters</h3>
        <p className="settings-section__hint">Active filters hide non-matching recipes across the whole app</p>
        <div className="picker__chips" style={{ marginTop: 10 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} className={`chip ${dietaryFilters.includes(d) ? 'chip--selected' : ''}`} onClick={() => toggleDiet(d)}>
              {dietaryFilters.includes(d) && <span className="chip__check">✓</span>}
              {d}
            </button>
          ))}
        </div>
        {dietaryFilters.length > 0 && (
          <p className="settings-active-filters">
            Active: {dietaryFilters.join(', ')} — recipes without these tags will be hidden
          </p>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">🔄 Notion Sync</h3>
        <p className="settings-section__hint">
          {lastSynced ? `Last synced: ${new Date(lastSynced).toLocaleString()}` : 'Not yet synced this session'}
        </p>
        <button className="btn btn--primary" style={{ marginTop: 10 }} onClick={onSync}>
          Sync Now
        </button>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">🤖 AI Ingredient Parser</h3>
        <IngredientParser recipes={recipes || []} onSaved={onIngredientsSaved} />
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">ℹ️ About</h3>
        <p className="settings-section__hint">Recipe App v0.1 · Powered by Notion</p>
      </div>
    </main>
  );
};

// ─── Ingredient Picker (legacy, used in fridge matcher sidebar) ─────────────
const IngredientPicker = ({ allIngredients, selected, onChange }) => {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = allIngredients.filter(i =>
      i.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce((acc, ing) => {
      const letter = ing[0]?.toUpperCase() || '#';
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(ing);
      return acc;
    }, {});
  }, [allIngredients, search]);

  const toggle = (ing) => {
    const lower = ing.toLowerCase();
    onChange(prev =>
      prev.includes(lower) ? prev.filter(i => i !== lower) : [...prev, lower]
    );
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(allIngredients.map(i => i.toLowerCase()));

  return (
    <div className="picker">
      <div className="picker__header">
        <h2>What's in your fridge?</h2>
        <p className="picker__subtitle">
          {selected.length} ingredient{selected.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      <div className="picker__search-row">
        <input
          className="picker__search"
          type="search"
          placeholder="Search ingredients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="picker__actions">
          <button className="btn btn--ghost" onClick={clearAll}>Clear</button>
          <button className="btn btn--ghost" onClick={selectAll}>All</button>
        </div>
      </div>

      <div className="picker__grid-wrapper">
        {Object.entries(grouped).sort().map(([letter, items]) => (
          <div key={letter} className="picker__group">
            <div className="picker__group-label">{letter}</div>
            <div className="picker__chips">
              {items.map(ing => {
                const isSelected = selected.includes(ing.toLowerCase());
                return (
                  <button
                    key={ing}
                    className={`chip ${isSelected ? 'chip--selected' : ''}`}
                    onClick={() => toggle(ing)}
                  >
                    {isSelected && <span className="chip__check">✓</span>}
                    {ing}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="picker__empty">No ingredients match "{search}"</p>
        )}
      </div>
    </div>
  );
};


// ─── Grocery List Tab ────────────────────────────────────────────────────────
const GroceryListTab = ({ recipes, matchById }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recipeNames, setRecipeNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [error, setError] = useState(null);

  const toggleRecipe = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const toggleChecked = (key) => setChecked(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const buildList = async () => {
    if (!selectedIds.length) return;
    setLoading(true);
    setError(null);
    setCategories([]);
    setChecked(new Set());
    try {
      const res = await fetch(`${API}/api/grocery-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build list');
      setCategories(data.categories || []);
      setRecipeNames(data.recipeNames || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyList = () => {
    const lines = [`Grocery List — ${recipeNames.join(', ')}\n`];
    categories.forEach(cat => {
      lines.push(`\n${cat.emoji} ${cat.name}`);
      cat.items.forEach(item => {
        const tick = checked.has(`${cat.name}-${item.name}`) ? '✓' : '○';
        lines.push(`  ${tick} ${item.amount} ${item.name}${item.note ? ` (${item.note})` : ''}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const checkedCount = checked.size;

  return (
    <main className="view">
      <div className="grocery-header">
        <h2 className="grocery-title">Grocery List</h2>
        <p className="grocery-subtitle">Select recipes to build your shopping list</p>
      </div>

      <div className="grocery-recipe-selector">
        <h3 className="grocery-section-label">Choose recipes</h3>
        <div className="grocery-recipe-list">
          {recipes.filter(r => r.ingredients?.length > 0).map(r => {
            const match = matchById.get(r.id);
            const isSelected = selectedIds.includes(r.id);
            return (
              <button
                key={r.id}
                className={`grocery-recipe-chip ${isSelected ? 'grocery-recipe-chip--selected' : ''}`}
                onClick={() => toggleRecipe(r.id)}
              >
                {isSelected && <span>✓ </span>}
                {r.name}
                {match?.missing?.length > 0 && (
                  <span className="grocery-recipe-chip__missing"> · {match.missing.length} to buy</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="btn btn--primary grocery-build-btn"
        onClick={buildList}
        disabled={selectedIds.length === 0 || loading}
      >
        {loading ? '🤖 Building list...' : `Build List for ${selectedIds.length} recipe${selectedIds.length !== 1 ? 's' : ''}`}
      </button>

      {error && <p className="grocery-error">⚠️ {error}</p>}

      {categories.length > 0 && (
        <div className="grocery-list">
          <div className="grocery-list__header">
            <div>
              <h3 className="grocery-list__title">Shopping List</h3>
              <p className="grocery-list__subtitle">{recipeNames.join(', ')} · {checkedCount}/{totalItems} items checked</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={copyList}>Copy 📋</button>
          </div>
          <div className="grocery-progress">
            <div className="grocery-progress__bar" style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }} />
          </div>
          {categories.map(cat => (
            <div key={cat.name} className="grocery-category">
              <h4 className="grocery-category__title">{cat.emoji} {cat.name}</h4>
              {cat.items.map(item => {
                const key = `${cat.name}-${item.name}`;
                const isChecked = checked.has(key);
                return (
                  <div key={key} className={`grocery-item ${isChecked ? 'grocery-item--checked' : ''}`} onClick={() => toggleChecked(key)}>
                    <div className={`grocery-item__checkbox ${isChecked ? 'grocery-item__checkbox--checked' : ''}`}>{isChecked && '✓'}</div>
                    <div className="grocery-item__body">
                      <span className="grocery-item__name">{item.name}</span>
                      <span className="grocery-item__amount">{item.amount}</span>
                      {item.note && <span className="grocery-item__note">{item.note}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

// ─── AI Ingredient Parser (lives inside Settings tab) ─────────────────────
const IngredientParser = ({ recipes, onSaved }) => {
  const [step, setStep] = useState('select');
  const [selectedId, setSelectedId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState([]);
  const [recipeName, setRecipeName] = useState('');
  const [editList, setEditList] = useState('');
  const [error, setError] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  const unparsed = recipes.filter(r => !r.ingredients || r.ingredients.length === 0);

  const parse = async () => {
    if (!selectedId) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/parse-ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.message) throw new Error(data.message);
      setParsed(data.ingredients);
      setRecipeName(data.recipeName);
      setEditList(data.ingredients.join('\n'));
      setStep('preview');
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    const ingredients = editList.split('\n').map(s => s.trim()).filter(Boolean);
    setStep('saving');
    try {
      const res = await fetch(`${API}/api/save-ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: selectedId, ingredients }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSavedCount(c => c + 1);
      setStep('select');
      setSelectedId('');
      setEditList('');
      onSaved();
    } catch (e) {
      setError(e.message);
      setStep('preview');
    }
  };

  return (
    <div className="parser">
      <div className="parser__intro">
        <p className="parser__desc">Claude reads the recipe body and extracts ingredients automatically. You review before anything saves to Notion.</p>
        {unparsed.length > 0 && <p className="parser__count">{unparsed.length} recipe{unparsed.length !== 1 ? 's' : ''} have no ingredients tagged yet</p>}
        {savedCount > 0 && <p className="parser__saved">✅ {savedCount} recipe{savedCount !== 1 ? 's' : ''} updated this session</p>}
      </div>

      {(step === 'select' || step === 'preview') && step === 'select' && (
        <div className="parser__select">
          <select className="parser__dropdown" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— Choose a recipe —</option>
            {unparsed.length > 0 && (
              <optgroup label="No ingredients yet">
                {unparsed.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </optgroup>
            )}
            <optgroup label="All recipes">
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}{r.ingredients?.length > 0 ? ` (${r.ingredients.length} tagged)` : ''}</option>)}
            </optgroup>
          </select>
          <button className="btn btn--primary" onClick={parse} disabled={!selectedId || parsing} style={{ marginTop: 10 }}>
            {parsing ? '🤖 Parsing...' : 'Parse Ingredients'}
          </button>
          {error && <p className="parser__error">⚠️ {error}</p>}
        </div>
      )}

      {step === 'preview' && (
        <div className="parser__preview">
          <h4 className="parser__preview-title">Review: {recipeName}</h4>
          <p className="parser__preview-hint">Claude found {parsed.length} ingredients. Edit if needed — one per line.</p>
          <textarea className="parser__textarea" value={editList} onChange={e => setEditList(e.target.value)} rows={Math.max(6, parsed.length + 2)} />
          <div className="parser__preview-actions">
            <button className="btn btn--ghost" onClick={() => { setStep('select'); setError(null); }}>← Back</button>
            <button className="btn btn--primary" onClick={save}>Save to Notion ✓</button>
          </div>
          {error && <p className="parser__error">⚠️ {error}</p>}
        </div>
      )}

      {step === 'saving' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--warm-gray)' }}>Saving to Notion...</p>
        </div>
      )}
    </div>
  );
};

// ─── Recipe Detail Page ────────────────────────────────────────────────────
const RecipePage = ({ recipe, content, onBack, loading }) => {
  if (loading) {
    return (
      <main className="view">
        <div className="placeholder">
          <h2>Loading recipe…</h2>
        </div>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="view">
        <div className="placeholder">
          <h2>Recipe not found</h2>
          <button className="btn btn--ghost" onClick={onBack}>← Back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="view recipe-page">
      <button className="btn btn--ghost back-btn" onClick={onBack}>← Back</button>

      <div className="recipe-page__header">
        <div className="recipe-page__image">
          {recipe.coverImage ? (
            <img src={recipe.coverImage} alt={recipe.name} />
          ) : (
            <div className="recipe-page__image-placeholder">No photo</div>
          )}
        </div>

        <div className="recipe-page__summary">
          <h2 className="recipe-page__title">{recipe.name}</h2>
          <div className="recipe-page__meta">
            {recipe.cuisine && <Badge>{recipe.cuisine}</Badge>}
            {typeof recipe.calories === 'number' && <Badge variant="info">{Math.round(recipe.calories)} kcal</Badge>}
            {typeof recipe.protein === 'number' && <Badge variant="info">{Math.round(recipe.protein)}g protein</Badge>}
            {recipe.time && <Badge variant="time">⏱ {recipe.time}</Badge>}
            {recipe.servings && <Badge variant="info">🍽 {recipe.servings}</Badge>}
          </div>

          <a className="recipe-page__notion-link" href={recipe.notionUrl} target="_blank" rel="noreferrer">
            Open in Notion →
          </a>
        </div>
      </div>

      <NotionContent content={content} />
    </main>
  );
};

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('home'); // 'home' | 'recipes' | 'fridge' | 'grocery' | 'add' | 'settings' | 'recipe'
  const [lastView, setLastView] = useState('home');
  const [allIngredients, setAllIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fridgeIngredients, setFridgeIngredients] = useState(() => LS.get('fridgeIngredients', []));
  const [pantryStaples, setPantryStaples] = useState(() => LS.get('pantryStaples', []));
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeContent, setRecipeContent] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  // Settings (persisted)
  const [units, setUnitsRaw] = useState(() => LS.get('units', 'metric'));
  const [dietaryFilters, setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));

  const setUnits = (v) => { setUnitsRaw(v); LS.set('units', v); };
  const setDietaryFilters = (fn) => setDietaryFiltersRaw(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn;
    LS.set('dietaryFilters', next);
    return next;
  });

  // Persist fridge + pantry to localStorage
  useEffect(() => { LS.set('fridgeIngredients', fridgeIngredients); }, [fridgeIngredients]);
  useEffect(() => { LS.set('pantryStaples', pantryStaples); }, [pantryStaples]);

  // Load ingredients + recipes on mount
  const loadData = useCallback(async () => {
    try {
      const [ingRes, recipeRes] = await Promise.all([
        fetch(`${API}/api/ingredients`),
        fetch(`${API}/api/recipes`),
      ]);

      if (!ingRes.ok || !recipeRes.ok) throw new Error('Failed to load from Notion');

      const { ingredients } = await ingRes.json();
      const { recipes: recipeData } = await recipeRes.json();

      setAllIngredients(ingredients.sort());
      setRecipes(recipeData);
      setLastSynced(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // All ingredients = fridge + pantry combined for matching
  const allMyIngredients = useMemo(() => {
    const combined = new Set([...fridgeIngredients, ...pantryStaples].map(i => i.toLowerCase().trim()));
    return combined;
  }, [fridgeIngredients, pantryStaples]);

  // All unique tags across recipes
  const allTags = useMemo(() => {
    const tagSet = new Set();
    recipes.forEach(r => (r.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [recipes]);

  const libraryRecipes = useMemo(() => {
    let list = recipes;
    const q = librarySearch.toLowerCase().trim();
    if (q) {
      list = list.filter(r => {
        const nameMatch = r.name.toLowerCase().includes(q);
        const cuisineMatch = (r.cuisine || '').toLowerCase().includes(q);
        const tagMatch = (r.tags || []).some(t => t.toLowerCase().includes(q));
        return nameMatch || cuisineMatch || tagMatch;
      });
    }
    if (activeTag) {
      list = list.filter(r => (r.tags || []).includes(activeTag) || (r.cuisine || '') === activeTag);
    }
    return list;
  }, [recipes, librarySearch, activeTag]);

  const matches = useMemo(() => {
    if (allMyIngredients.size === 0) return [];

    const m = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const have = recipeIngredients.filter(i => allMyIngredients.has(i));
      const missing = recipeIngredients.filter(i => !allMyIngredients.has(i));
      const matchScore = recipeIngredients.length === 0 ? 0 : have.length / recipeIngredients.length;

      return {
        id: recipe.id,
        have,
        missing,
        matchScore,
        canMake: missing.length === 0 && recipeIngredients.length > 0,
      };
    });

    m.sort((a, b) => {
      if (a.canMake && !b.canMake) return -1;
      if (!a.canMake && b.canMake) return 1;
      return b.matchScore - a.matchScore;
    });

    return m;
  }, [allMyIngredients, recipes]);

  const matchById = useMemo(() => {
    const map = new Map();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  const openRecipe = async (recipe) => {
    setLastView(view);
    setView('recipe');
    setRecipeLoading(true);
    try {
      const res = await fetch(`${API}/api/recipes/${recipe.id}`);
      if (!res.ok) throw new Error('Failed to load recipe details');
      const data = await res.json();
      setSelectedRecipe(data.recipe);
      setRecipeContent(data.content || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRecipeLoading(false);
    }
  };

  const backFromRecipe = () => {
    setView(lastView);
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Connecting to your Notion kitchen...</p>
    </div>
  );

  if (error) return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h2>Couldn't connect to Notion</h2>
      <p>{error}</p>
      <p className="error-hint">Make sure your backend is running and your .env is configured.</p>
      <button className="btn btn--primary" onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__bar">
          <div className="app-header__brand">
            <span className="app-header__logo">🍳</span>
            <div className="app-header__title-group">
              <span className="app-header__title">Recipe Library</span>
              <span className="app-header__subtitle">Your personal cookbook, powered by Notion</span>
            </div>
          </div>
          <nav className="nav-tabs">
            {[
              { key: 'home', label: 'Home' },
              { key: 'recipes', label: 'All Recipes' },
              { key: 'fridge', label: 'Fridge' },
              { key: 'grocery', label: 'Grocery List' },
              { key: 'add', label: 'Add Recipe' },
              { key: 'settings', label: 'Settings' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`nav-tab ${view === key ? 'nav-tab--active' : ''}`}
                onClick={() => setView(key)}
                disabled={key === 'recipes' && recipes.length === 0}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Recipe Detail Page */}
      {view === 'recipe' && (
        <RecipePage
          recipe={selectedRecipe}
          content={recipeContent}
          loading={recipeLoading}
          onBack={backFromRecipe}
        />
      )}

      {/* Fridge Tab */}
      {view === 'fridge' && (
        <FridgeTab
          allIngredients={allIngredients}
          fridgeIngredients={fridgeIngredients}
          setFridgeIngredients={setFridgeIngredients}
          pantryStaples={pantryStaples}
          setPantryStaples={setPantryStaples}
        />
      )}

      {/* Home */}
      {view === 'home' && (
        <main className="view">
          <div className="home-section">
            <div className="home-section__header">
              <h2 className="home-section__title">What can I make?</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setView('fridge')}>
                {fridgeIngredients.length + pantryStaples.length > 0
                  ? `${fridgeIngredients.length + pantryStaples.length} ingredients set`
                  : 'Set my ingredients →'}
              </button>
            </div>
            {allMyIngredients.size === 0 ? (
              <div className="home-empty-cta" onClick={() => setView('fridge')}>
                <span className="home-empty-cta__icon">🧊</span>
                <div>
                  <p className="home-empty-cta__title">Add your fridge &amp; pantry ingredients</p>
                  <p className="home-empty-cta__sub">We'll show you what you can cook right now</p>
                </div>
                <span className="home-empty-cta__arrow">→</span>
              </div>
            ) : (
              <div className="recipe-grid">
                {matches.slice(0, 4).map(m => {
                  const r = recipes.find(x => x.id === m.id);
                  if (!r) return null;
                  return <RecipeCard key={r.id} recipe={r} match={m} onClick={openRecipe} />;
                })}
                {matches.length === 0 && (
                  <p className="home-no-matches">No matches yet — try adding more ingredients in the Fridge tab.</p>
                )}
              </div>
            )}
          </div>

          <div className="home-section">
            <h2 className="home-section__title">Recipe Stats</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-card__number">{recipes.length}</span>
                <span className="stat-card__label">Total Recipes</span>
              </div>
              <div className="stat-card stat-card--green">
                <span className="stat-card__number">{matches.filter(m => m.canMake).length}</span>
                <span className="stat-card__label">Can Make Now</span>
              </div>
              <div className="stat-card stat-card--amber">
                <span className="stat-card__number">{matches.filter(m => m.matchScore >= 0.5 && !m.canMake).length}</span>
                <span className="stat-card__label">Almost There</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__number" style={{ fontSize: '18px' }}>
                  {(() => {
                    const counts = {};
                    recipes.forEach(r => { if (r.cuisine) counts[r.cuisine] = (counts[r.cuisine] || 0) + 1; });
                    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    return top ? top[0] : '—';
                  })()}
                </span>
                <span className="stat-card__label">Top Cuisine</span>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* All Recipes */}
      {view === 'recipes' && (
        <main className="view">
          <div className="library-header">
            <h2>All Recipes</h2>
            <p className="library-subtitle">
              {libraryRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="library-search-row">
            <input
              className="library-search"
              type="search"
              placeholder="Search by recipe or tag..."
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
            />
            {librarySearch && (
              <button className="btn btn--ghost library-search-clear" onClick={() => setLibrarySearch('')}>Clear</button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="tag-filter-row">
              <button
                className={`tag-filter-chip ${activeTag === null ? 'tag-filter-chip--active' : ''}`}
                onClick={() => setActiveTag(null)}
              >All</button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-filter-chip ${activeTag === tag ? 'tag-filter-chip--active' : ''}`}
                  onClick={() => setActiveTag(prev => prev === tag ? null : tag)}
                >{tag}</button>
              ))}
            </div>
          )}
          <div className="recipe-grid">
            {libraryRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe} />
            ))}
            {libraryRecipes.length === 0 && (
              <div className="results-empty">
                <p>No recipes match your search{activeTag ? ` or tag "${activeTag}"` : ''}.</p>
                <button className="btn btn--ghost" onClick={() => { setLibrarySearch(''); setActiveTag(null); }}>Show all</button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Grocery List */}
      {view === 'grocery' && (
        <GroceryListTab recipes={recipes} matchById={matchById} />
      )}

      {/* Add Recipe */}
      {view === 'add' && (
        <main className="view">
          <div className="placeholder">
            <h2>Add Recipe</h2>
            <p>Coming soon – paste an Instagram or TikTok link and we'll draft a recipe for you.</p>
          </div>
        </main>
      )}

      {/* Settings */}
      {view === 'settings' && (
        <SettingsTab
          units={units}
          setUnits={setUnits}
          dietaryFilters={dietaryFilters}
          setDietaryFilters={setDietaryFilters}
          lastSynced={lastSynced}
          onSync={loadData}
          recipes={recipes}
          onIngredientsSaved={loadData}
        />
      )}
    </div>
  );
}
