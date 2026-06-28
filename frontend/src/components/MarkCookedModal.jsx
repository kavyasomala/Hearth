import React, { useState, useMemo } from 'react';
import { Icon } from '../icons';
import { API } from '../constants';

const MarkCookedModal = ({ recipe, bodyIngredients = [], onSave, onClose, onUpdateKitchen, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [step, setStep] = useState(1); // 1 = rate/notes, 2 = ingredient cleanup
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Ingredient actions: 'remove' | 'keep' | null (undecided)
  const [ingActions, setIngActions] = useState({});

// Perishable ingredient categories â€” used in post-cook cleanup to suggest removal
const PERISHABLE_CATEGORY_MAP = {
  produce: ['onion','garlic','ginger','tomato','lemon','lime','spinach','carrot','celery',
    'potato','bell pepper','cucumber','zucchini','broccoli','cauliflower','mushroom','avocado',
    'lettuce','kale','cabbage','spring onion','scallion','shallot','chilli','chili','jalapeÃ±o',
    'leek','asparagus','eggplant','sweet potato','pumpkin','butternut squash','beetroot','radish',
    'green beans','peas','corn','coriander','cilantro','parsley','basil','mint','thyme','rosemary',
    'dill','chives','bay leaves','lemongrass','orange','apple','banana','mango','berry','strawberry',
    'blueberry','peach','pear','grape','cherry'],
  'meat & fish': ['chicken','beef','pork','lamb','turkey','duck','bacon','sausage','mince',
    'ground beef','steak','salmon','tuna','shrimp','prawns','cod','tilapia','fish','crab',
    'lobster','scallops','mussels','anchovies','ham','pancetta','prosciutto','chorizo','salami'],
  dairy: ['egg','eggs','milk','butter','cream','heavy cream','sour cream','yogurt','greek yogurt',
    'cheese','parmesan','cheddar','feta','mozzarella','ricotta','cream cheese','brie','gouda',
    'halloumi','creme fraiche','ghee','buttermilk','condensed milk','coconut milk','coconut cream'],
};
const perishableCatOf = (name) => {
  const lower = name.toLowerCase().trim();
  for (const [cat, kws] of Object.entries(PERISHABLE_CATEGORY_MAP)) {
    if (kws.some(k => lower.includes(k) || k.includes(lower))) return cat;
  }
  return null;
};

  // Perishable ingredients used in this recipe (suggests removal after cooking)
  const perishableIngs = useMemo(() => {
    if (!bodyIngredients?.length) return [];
    return bodyIngredients
      .filter(i => !i._isGroup)
      .map(i => ({ ...i, _cat: perishableCatOf(i.name) }))
      .filter(i => i._cat !== null);
  }, [bodyIngredients]);

  const setAction = (name, action) => setIngActions(p => ({ ...p, [name]: p[name] === action ? null : action }));

  const saveLog = async () => {
    setSaving(true); setError(null);
    try {
      const isRealRecipe = recipe.id && !String(recipe.id).startsWith('ref-');
      const payload = {
        recipe_name: recipe.name,
        rating: rating || null,
        notes: notes.trim() || null,
        cooked_at: new Date().toISOString(),
      };
      if (isRealRecipe) payload.recipe_id = recipe.id;
      const res = await apiFetch(`${API}/api/user/cook-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = 'Failed to save cook log';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        throw new Error(msg);
      }
      // If we have perishables to handle, go to step 2; else done
      if (perishableIngs.length > 0) {
        setStep(2);
        setSaving(false);
      } else {
        onSave({ toRemove: [] });
      }
    } catch (e) { setError(e.message); setSaving(false); }
  };

  const finishCleanup = () => {
    const toRemove = Object.entries(ingActions).filter(([, v]) => v === 'remove').map(([k]) => k);
    onSave({ toRemove });
  };

  const displayRating = hoverRating || rating;
  const RATING_LABELS = ['', "Didn't love it", 'It was okay', 'Pretty good!', 'Really good!', 'Perfect!'];
  const CAT_ICON = { produce: 'apple', 'meat & fish': 'beef', dairy: 'milk' };
  const CAT_LABEL = { produce: 'Produce', 'meat & fish': 'Meat & Fish', dairy: 'Dairy' };

  // Group perishables by category
  const grouped = useMemo(() => {
    const g = {};
    for (const i of perishableIngs) {
      if (!g[i._cat]) g[i._cat] = [];
      g[i._cat].push(i);
    }
    return g;
  }, [perishableIngs]);

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal cooked-modal" onClick={e => e.stopPropagation()}>

        {step === 1 && (<>
          <div className="create-modal__header">
            <h2 className="create-modal__title"><Icon name="chefHat" size={18} strokeWidth={2} /> Cooked it!</h2>
          </div>
          <div className="create-modal__body cooked-modal__body">
            {recipe?.coverImage && (
              <div className="cooked-modal__hero-img">
                <img src={recipe.coverImage} alt={recipe.name} />
              </div>
            )}
            <p className="cooked-modal__recipe-name">{recipe?.name}</p>
            <p className="cooked-modal__date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

            <div className="cooked-modal__rating-section">
              <p className="cooked-modal__label">How did it turn out? <span className="cooked-modal__optional">(optional)</span></p>
              <div className="cooked-modal__stars">
                {[1,2,3,4,5].map(n => (
                  <button key={n}
                    className={`cooked-modal__star ${n <= displayRating ? 'cooked-modal__star--on' : ''}`}
                    onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(r => r === n ? 0 : n)} type="button">â˜…</button>
                ))}
                {displayRating > 0 && <span className="cooked-modal__rating-label">{RATING_LABELS[displayRating]}</span>}
              </div>
            </div>

            <div className="cooked-modal__notes-section">
              <p className="cooked-modal__label">Notes <span className="cooked-modal__optional">(optional)</span></p>
              <textarea className="editor-textarea cooked-modal__notes-input" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Added more garlic, served with salad, would do again..." rows={3} />
            </div>

            {error && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {error}</p>}
          </div>
          <div className="create-modal__footer">
            <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary cooked-modal__save-btn" onClick={saveLog} disabled={saving}>
              {saving ? 'Saving...' : perishableIngs.length > 0 ? 'Next â†’' : 'âœ“ Save'}
            </button>
          </div>
        </>)}

        {step === 2 && (<>
          <div className="create-modal__header">
            <h2 className="create-modal__title"><Icon name="package" size={18} strokeWidth={2} /> Update Your Kitchen</h2>
          </div>
          <div className="create-modal__body cooked-modal__body">
            <p className="cooked-modal__cleanup-intro">
              You used these perishables -- what do you still have left?
            </p>
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="cooked-cleanup__group">
                <div className="cooked-cleanup__group-label">
                  <Icon name={CAT_ICON[cat] || 'list'} size={14} strokeWidth={2} /> {CAT_LABEL[cat]}
                </div>
                <div className="cooked-cleanup__items">
                  {items.map(ing => {
                    const action = ingActions[ing.name] ?? null;
                    return (
                      <div key={ing.name} className="cooked-cleanup__item">
                        <span className="cooked-cleanup__item-name">
                          {ing.name}
                        </span>
                        <div className="cooked-cleanup__btns">
                          <button
                            className={`cooked-cleanup__btn cooked-cleanup__btn--keep ${action === 'keep' ? 'cooked-cleanup__btn--active' : ''}`}
                            onClick={() => setAction(ing.name, 'keep')} type="button">
                            âœ“ Keep
                          </button>
                          <button
                            className={`cooked-cleanup__btn cooked-cleanup__btn--remove ${action === 'remove' ? 'cooked-cleanup__btn--active' : ''}`}
                            onClick={() => setAction(ing.name, 'remove')} type="button">
                            âœ• Used up
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="create-modal__footer">
            <button className="btn btn--ghost" onClick={() => onSave({ toRemove: [] })}>Skip</button>
            <button className="btn btn--primary" onClick={finishCleanup}>âœ“ Update Kitchen</button>
          </div>
        </>)}

      </div>
    </div>
  );
};

// --- Convert Reference Button (inline on RecipePage for cookbook refs) --------

export default MarkCookedModal;
