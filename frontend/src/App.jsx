import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ─── Helpers ───────────────────────────────────────────────────────────────
const pct = (score) => Math.round(score * 100);

const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

// ─── Recipe Card ───────────────────────────────────────────────────────────
const RecipeCard = ({ recipe, onClick }) => {
  const { name, have, missing, matchScore, canMake, coverImage, tags, time } = recipe;

  return (
    <article className={`card ${canMake ? 'card--ready' : ''}`} onClick={() => onClick(recipe)}>
      {coverImage && (
        <div className="card__image">
          <img src={coverImage} alt={name} loading="lazy" />
          {canMake && <div className="card__ready-badge">✓ Ready to make!</div>}
        </div>
      )}
      {!coverImage && canMake && <div className="card__ready-strip">✓ Ready to make!</div>}

      <div className="card__body">
        <h3 className="card__title">{name}</h3>

        <div className="card__meta">
          {tags.slice(0, 2).map(t => <Badge key={t}>{t}</Badge>)}
          {time && <Badge variant="time">⏱ {time}</Badge>}
        </div>

        <div className="card__progress">
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${pct(matchScore)}%`, '--score': matchScore }}
            />
          </div>
          <span className="progress-label">
            {have.length}/{have.length + missing.length} ingredients
          </span>
        </div>

        {missing.length > 0 && (
          <p className="card__missing">
            <span className="card__missing-label">Missing: </span>
            {missing.slice(0, 4).join(', ')}
            {missing.length > 4 && ` +${missing.length - 4} more`}
          </p>
        )}
      </div>
    </article>
  );
};

// ─── Recipe Detail Modal ────────────────────────────────────────────────────
const RecipeModal = ({ recipe, onClose }) => {
  if (!recipe) return null;
  const { name, have, missing, matchScore, canMake, coverImage, tags, time, servings, notionUrl } = recipe;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose}>✕</button>
        {coverImage && <img className="modal__image" src={coverImage} alt={name} />}
        <div className="modal__body">
          <h2 className="modal__title">{name}</h2>
          <div className="modal__meta">
            {tags.map(t => <Badge key={t}>{t}</Badge>)}
            {time && <Badge variant="time">⏱ {time}</Badge>}
            {servings && <Badge variant="info">🍽 {servings} servings</Badge>}
          </div>

          <div className={`modal__score ${canMake ? 'modal__score--ready' : ''}`}>
            {canMake ? '✓ You have everything!' : `${pct(matchScore)}% match — ${missing.length} ingredient${missing.length !== 1 ? 's' : ''} missing`}
          </div>

          {have.length > 0 && (
            <div className="modal__section">
              <h4>✅ You have ({have.length})</h4>
              <ul className="ingredient-list ingredient-list--have">
                {have.map(i => <li key={i}>{i}</li>)}
              </ul>
            </div>
          )}

          {missing.length > 0 && (
            <div className="modal__section">
              <h4>🛒 You need ({missing.length})</h4>
              <ul className="ingredient-list ingredient-list--missing">
                {missing.map(i => <li key={i}>{i}</li>)}
              </ul>
            </div>
          )}

          <a className="modal__notion-link" href={notionUrl} target="_blank" rel="noreferrer">
            Open full recipe in Notion →
          </a>
        </div>
      </div>
    </div>
  );
};

// ─── Ingredient Picker ──────────────────────────────────────────────────────
const IngredientPicker = ({ allIngredients, selected, onChange }) => {
  const [search, setSearch] = useState('');

  // Group ingredients alphabetically
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

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('fridge'); // 'fridge' | 'results'
  const [allIngredients, setAllIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fridgeIngredients, setFridgeIngredients] = useState([]);
  const [matched, setMatched] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'ready' | 'close'

  // Load ingredients + recipes on mount
  useEffect(() => {
    const load = async () => {
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
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const findRecipes = useCallback(async () => {
    if (fridgeIngredients.length === 0) return;
    setMatching(true);
    try {
      const res = await fetch(`${API}/api/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fridgeIngredients, recipes }),
      });
      const { matched: m } = await res.json();
      setMatched(m);
      setView('results');
    } catch (e) {
      setError(e.message);
    } finally {
      setMatching(false);
    }
  }, [fridgeIngredients, recipes]);

  const filteredRecipes = useMemo(() => {
    if (filter === 'ready') return matched.filter(r => r.canMake);
    if (filter === 'close') return matched.filter(r => !r.canMake && r.matchScore >= 0.5);
    return matched;
  }, [matched, filter]);

  const readyCount = matched.filter(r => r.canMake).length;
  const closeCount = matched.filter(r => !r.canMake && r.matchScore >= 0.5).length;

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
        <div className="app-header__inner">
          <button
            className={`tab ${view === 'fridge' ? 'tab--active' : ''}`}
            onClick={() => setView('fridge')}
          >
            🥦 My Fridge
          </button>
          <div className="app-header__logo">🍳</div>
          <button
            className={`tab ${view === 'results' ? 'tab--active' : ''}`}
            onClick={() => matched.length > 0 && setView('results')}
            disabled={matched.length === 0}
          >
            📖 Recipes
          </button>
        </div>
      </header>

      {/* Fridge View */}
      {view === 'fridge' && (
        <main className="view">
          <IngredientPicker
            allIngredients={allIngredients}
            selected={fridgeIngredients}
            onChange={setFridgeIngredients}
          />
          <div className="cta-bar">
            <button
              className="btn btn--primary btn--large"
              onClick={findRecipes}
              disabled={fridgeIngredients.length === 0 || matching}
            >
              {matching ? 'Finding recipes...' : `Find Recipes →`}
            </button>
          </div>
        </main>
      )}

      {/* Results View */}
      {view === 'results' && (
        <main className="view">
          <div className="results-header">
            <h2>
              {readyCount > 0
                ? `🎉 ${readyCount} recipe${readyCount !== 1 ? 's' : ''} ready to make!`
                : 'Your matches'}
            </h2>
            <p className="results-subtitle">
              {matched.length} recipes checked · {fridgeIngredients.length} ingredients in fridge
            </p>
          </div>

          <div className="filter-row">
            <button className={`filter-btn ${filter === 'all' ? 'filter-btn--active' : ''}`} onClick={() => setFilter('all')}>
              All ({matched.length})
            </button>
            <button className={`filter-btn ${filter === 'ready' ? 'filter-btn--active' : ''}`} onClick={() => setFilter('ready')}>
              ✓ Ready ({readyCount})
            </button>
            <button className={`filter-btn ${filter === 'close' ? 'filter-btn--active' : ''}`} onClick={() => setFilter('close')}>
              Almost ({closeCount})
            </button>
          </div>

          <div className="recipe-grid">
            {filteredRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={setSelectedRecipe} />
            ))}
            {filteredRecipes.length === 0 && (
              <div className="results-empty">
                <p>No recipes in this filter.</p>
                <button className="btn btn--ghost" onClick={() => setFilter('all')}>Show all</button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Recipe Modal */}
      <RecipeModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
    </div>
  );
}
