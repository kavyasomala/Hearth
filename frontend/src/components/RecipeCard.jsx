import React, { useState } from 'react';
import { Icon } from '../icons';
import { pct } from '../utils';

const RecipeCard = ({ recipe, match, onClick, isHearted, onToggleHeart, isMakeSoon, onToggleMakeSoon, onMarkCooked, showScore, onConvertRef }) => {
  const { name, coverImage, cuisine, time } = recipe;
  const matchScore = match?.matchScore ?? null;
  const canMakeNow = Boolean(match?.canMake);
  const tags = recipe.tags || [];
  const progress = recipe.status === 'incomplete' ? <Icon name="alertTriangle" size={12} strokeWidth={2} /> : recipe.status === 'needs tweaking' ? <Icon name="tool" size={12} strokeWidth={2} /> : recipe.status === 'complete' ? <Icon name="checkCircle" size={12} strokeWidth={2} /> : recipe.status === 'to try' ? <Icon name="bookMarked" size={12} strokeWidth={2} /> : null;
  const isCookbookRef = Boolean(recipe.cookbook && (!recipe.ingredients || recipe.ingredients.length === 0));
  const [showMissing, setShowMissing] = useState(false);

  return (
    <>
      <article className={`recipe-card ${isCookbookRef ? 'recipe-card--cb-ref' : ''}`} onClick={() => onClick(recipe)}>
        <div className="recipe-card__image">
          {coverImage
            ? <img src={coverImage} alt={name} loading="lazy" />
            : <div className="recipe-card__image-placeholder">No photo</div>}
          {isCookbookRef && (
            <div className="recipe-card__book-corner"><Icon name="bookOpen" size={12} strokeWidth={1.75} color="white" /></div>
          )}
          {showScore && matchScore !== null && (
            <>
              <button
                className={`recipe-card__score ${canMakeNow ? 'recipe-card__score--ready' : ''}`}
                onClick={e => { e.stopPropagation(); setShowMissing(o => !o); }}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {pct(matchScore)}%
              </button>
              {showMissing && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={e => { e.stopPropagation(); setShowMissing(false); }} />
                  <div style={{
                    position: 'absolute', top: 44, right: 10,
                    background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                    padding: '12px 14px', zIndex: 300, minWidth: 180, maxWidth: 240,
                  }} onClick={e => e.stopPropagation()}>
                    {match?.missing?.length > 0 ? (
                      <>
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>
                          Missing {match.missing.length} ingredient{match.missing.length > 1 ? 's' : ''}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {match.missing.map(n => (
                            <span key={n} style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>Â· {n}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0 }}>âœ“ You have everything!</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {onToggleHeart && (
            <button
              className={`recipe-card__heart ${isHearted ? 'recipe-card__heart--on' : ''}`}
              onClick={e => { e.stopPropagation(); onToggleHeart(); }}
              title={isHearted ? 'Remove from Favorites' : 'Add to Favorites'}
            ><Icon name="heart" size={14} strokeWidth={2} /></button>
          )}
          <button
            className={`recipe-card__soon ${isMakeSoon ? 'recipe-card__soon--on' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
            title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
          ><Icon name="timer" size={14} strokeWidth={2} /></button>
          {isMakeSoon && onMarkCooked && (
            <button
              className="recipe-card__cooked-btn"
              onClick={e => { e.stopPropagation(); onMarkCooked(recipe); }}
              title="Mark as Cooked"
            ><Icon name="chefHat" size={14} strokeWidth={2} /></button>
          )}
        </div>
        <div className="recipe-card__body">
          <div className="recipe-card__title-row">
            <h3 className="recipe-card__title">{name}</h3>
            {cuisine && <span className="recipe-card__cuisine-tag">{cuisine}</span>}
          </div>
          <div className="recipe-card__stats">
            {time && <span className="recipe-card__stat"><span className="recipe-card__stat-icon"><Icon name="clock" size={12} strokeWidth={2} /></span>{time}</span>}
            {canMakeNow && <span className="recipe-card__can-make"><Icon name="checkCircle" size={11} strokeWidth={2} /> Ready</span>}
            {progress && <span className="recipe-card__progress">{progress}</span>}
          </div>
        </div>
      </article>
    </>
  );
};

// --- Section Pencil (inline edit trigger / confirm / cancel) ---------------

export default RecipeCard;
