import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../icons';
import { API } from '../constants';
import { haptic, pluralizeIng, consolidateItems } from '../utils';

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
        const tick = checked.has(`${cat.name}-${item.name}`) || inKitchen ? '✓' : '○';
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
          <p className="grocery-empty__sub">Tap <span style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle',margin:'0 2px'}}><Icon name="timer" size={13} strokeWidth={2} /></span> on any recipe to add it to Make Soon — your grocery list will build automatically.</p>
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
              <span>✓ {inKitchenCount} of {totalItems} ingredients already in your kitchen</span>
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
                            {isChecked && '✓'}
                          </div>
                          <div className="grocery-item__body">
                            <span className="grocery-item__name">
                              {amountStr && <span className="grocery-item__amount">{amountStr}</span>}
                              {item._extra && <span className="grocery-item__extra"> + {item._extra}</span>}
                              {' '}{item.name}
                            </span>
                            {item.prep_note && <span className="grocery-item__note">{item.prep_note}</span>}
                            {inKitchen && <span className="grocery-item__kitchen-tag">in kitchen · tap to remove</span>}
                            {!inKitchen && !isChecked && <span className="grocery-item__tap-hint">tap to check off → adds to kitchen</span>}
                            {isChecked && !inKitchen && <span className="grocery-item__tap-hint">tap to uncheck → removes from kitchen</span>}
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

export default GroceryListTab;
