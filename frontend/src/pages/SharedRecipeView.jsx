import React, { useState, useEffect } from 'react';
import { API } from '../constants';
import { Icon } from '../icons';

const SharedRecipeView = ({ token, authFetch, session, onRequestLogin }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/share/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Failed to load recipe'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const res = await authFetch(`${API}/api/share/${token}/save`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save');
      setSaved(true);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="shared-view shared-view--loading">
        <div className="loading-spinner" />
        <p>Loading recipe…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-view shared-view--error">
        <Icon name="alertTriangle" size={40} color="var(--warm-gray)" strokeWidth={1.5} />
        <h2>Link not found</h2>
        <p>This recipe link may have expired or been made private.</p>
        <a href="/" className="shared-view__home-btn">Open Hearth</a>
      </div>
    );
  }

  const { recipe, bodyIngredients = [], instructions = [] } = data;
  const sharerName = recipe.sharerName;

  if (saved) {
    return (
      <div className="shared-view shared-view--success">
        <div className="shared-view__check">
          <Icon name="check" size={28} color="white" strokeWidth={2.5} />
        </div>
        <h2>Saved!</h2>
        <p>{recipe.name} has been added to your Hearth recipes.</p>
        <a href="/" className="shared-view__home-btn">Open Hearth →</a>
      </div>
    );
  }

  const regularSteps = instructions.filter(s => !s._isGroup);

  return (
    <div className="shared-view">
      {recipe.coverImage ? (
        <div className="shared-view__hero">
          <img src={recipe.coverImage} alt={recipe.name} className="shared-view__hero-img" />
          <div className="shared-view__hero-scrim" />
        </div>
      ) : (
        <div className="shared-view__hero-blank" />
      )}

      <div className="shared-view__body">
        <a href="/" className="shared-view__brand" aria-label="Hearth home">
          <Icon name="flame" size={16} color="var(--terracotta)" strokeWidth={1.75} />
          <span>Hearth</span>
        </a>

        {sharerName && (
          <p className="shared-view__from">{sharerName} shared a recipe with you</p>
        )}

        <h1 className="shared-view__title">{recipe.name}</h1>

        {(recipe.cuisine || recipe.time_minutes || recipe.servings) && (
          <div className="shared-view__meta">
            {recipe.cuisine && <span>{recipe.cuisine}</span>}
            {recipe.time_minutes && <span>{recipe.time_minutes} min</span>}
            {recipe.servings && <span>{recipe.servings} servings</span>}
          </div>
        )}

        <div className="shared-view__cta">
          {session ? (
            <button className="shared-view__save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save to my library'}
            </button>
          ) : (
            <button className="shared-view__save-btn" onClick={onRequestLogin}>
              Sign in to save this recipe
            </button>
          )}
          {saveError && <p className="shared-view__save-error">{saveError}</p>}
        </div>

        {bodyIngredients.length > 0 && (
          <section className="shared-view__section">
            <h2 className="shared-view__section-title">Ingredients</h2>
            <ul className="shared-view__ings">
              {bodyIngredients.map(ing => (
                <li key={ing.id} className="shared-view__ing">
                  {(ing.amount || ing.unit) && (
                    <span className="shared-view__ing-qty">{[ing.amount, ing.unit].filter(Boolean).join(' ')}</span>
                  )}
                  <span className="shared-view__ing-name">
                    {ing.name}{ing.prep_note ? `, ${ing.prep_note}` : ''}
                    {ing.optional && <span className="shared-view__ing-opt"> (optional)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {regularSteps.length > 0 && (
          <section className="shared-view__section">
            <h2 className="shared-view__section-title">Instructions</h2>
            <ol className="shared-view__steps">
              {regularSteps.map((step, i) => (
                <li key={step.id} className="shared-view__step">
                  <span className="shared-view__step-num">{step.step_number || i + 1}</span>
                  <p className="shared-view__step-body">{step.body_text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(bodyIngredients.length > 0 || regularSteps.length > 0) && (
          <div className="shared-view__cta shared-view__cta--bottom">
            {session ? (
              <button className="shared-view__save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save to my library'}
              </button>
            ) : (
              <button className="shared-view__save-btn" onClick={onRequestLogin}>
                Sign in to save this recipe
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedRecipeView;
