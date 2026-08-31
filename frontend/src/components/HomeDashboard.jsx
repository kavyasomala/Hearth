import React, { useMemo, useState } from 'react';
import { Icon } from '../icons';

// ─── helpers ─────────────────────────────────────────────────────────────────

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// Local calendar date, NOT toISOString() — that converts to UTC first, which
// shifts the day for anyone east of Greenwich and would mis-file their plans.
const dayKey = (d) => {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Sunday of the current calendar week. "This week" has to mean the week you're
// in, not the next seven days — otherwise a meal planned for Sunday vanishes
// from the strip on Monday, which is exactly when you'd look for it.
export const startOfWeek = (d = new Date()) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Consecutive days ending today (or yesterday) with at least one cook logged.
 * Counting from yesterday means the streak doesn't visibly break at midnight
 * before you've had a chance to cook.
 */
function cookStreak(cookLog) {
  const days = new Set(cookLog.map(e => dayKey(e.cooked_at)));
  if (!days.size) return 0;

  const today = startOfDay(new Date());
  let cursor = new Date(today);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ─── Stat bar ────────────────────────────────────────────────────────────────

function StatBar({ displayName, cookLog, recipeCount }) {
  const { thisWeek, streak, total } = useMemo(() => {
    const weekAgo = startOfDay(new Date());
    weekAgo.setDate(weekAgo.getDate() - 6);          // today plus the previous 6
    return {
      thisWeek: cookLog.filter(e => new Date(e.cooked_at) >= weekAgo).length,
      streak:   cookStreak(cookLog),
      total:    cookLog.length,
    };
  }, [cookLog]);

  const firstName = (displayName || '').trim().split(/\s+/)[0];

  return (
    <div className="home-hello">
      <div className="home-hello__text">
        <h1 className="home-hello__greeting">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="home-hello__sub">
          {thisWeek > 0
            ? `You've cooked ${thisWeek} ${thisWeek === 1 ? 'meal' : 'meals'} this week.`
            : "Nothing cooked yet this week — let's fix that."}
        </p>
      </div>
      <div className="home-hello__stats">
        <div className="home-stat">
          <span className="home-stat__num">{streak}</span>
          <span className="home-stat__label">day{streak === 1 ? '' : 's'} streak</span>
        </div>
        <div className="home-stat">
          <span className="home-stat__num">{total}</span>
          <span className="home-stat__label">cooked</span>
        </div>
        <div className="home-stat">
          <span className="home-stat__num">{recipeCount}</span>
          <span className="home-stat__label">recipes</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tonight's pick ──────────────────────────────────────────────────────────

function TonightHero({ candidates, onOpen, onGoKitchen, hasKitchen }) {
  const [seed, setSeed] = useState(0);

  if (!candidates.length) {
    return (
      <div className="home-tonight home-tonight--empty" onClick={hasKitchen ? undefined : onGoKitchen}>
        <div className="home-tonight__empty-inner">
          <Icon name="chefHat" size={30} strokeWidth={1.5} />
          <p className="home-tonight__empty-title">
            {hasKitchen ? 'No matches yet' : 'Tell us what’s in your kitchen'}
          </p>
          <p className="home-tonight__empty-sub">
            {hasKitchen
              ? 'Add a few more ingredients and suggestions will show up here.'
              : 'We’ll suggest something you can cook right now.'}
          </p>
        </div>
      </div>
    );
  }

  const pick = candidates[seed % candidates.length];
  const { recipe, match } = pick;
  const pct = match ? Math.round(match.matchScore * 100) : null;

  return (
    <div className="home-tonight">
      <button
        className="home-tonight__card"
        onClick={() => onOpen(recipe)}
        style={recipe.coverImage ? { backgroundImage: `url(${recipe.coverImage})` } : undefined}
      >
        {!recipe.coverImage && <span className="home-tonight__noimg"><Icon name="utensils" size={28} strokeWidth={1.5} /></span>}
        <span className="home-tonight__scrim" />
        <span className="home-tonight__body">
          <span className="home-tonight__eyebrow">Tonight’s pick</span>
          <span className="home-tonight__name">{recipe.name}</span>
          <span className="home-tonight__meta">
            {recipe.cuisine && <span>{recipe.cuisine}</span>}
            {recipe.time && <span>{recipe.time}</span>}
            {pct !== null && <span>{pct}% of ingredients</span>}
          </span>
        </span>
      </button>
      {candidates.length > 1 && (
        <button className="home-tonight__reroll" onClick={() => setSeed(s => s + 1)} title="Show me another">
          <Icon name="shuffle" size={14} strokeWidth={2} /> Something else
        </button>
      )}
    </div>
  );
}

// ─── This week's plan ────────────────────────────────────────────────────────

function WeekStrip({ mealPlans, onOpenPlan }) {
  const days = useMemo(() => {
    const out = [];
    const weekStart = startOfWeek();
    const todayKey  = dayKey(new Date());
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = dayKey(d);
      out.push({
        date: d,
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        num:   d.getDate(),
        isToday: key === todayKey,
        isPast:  key < todayKey,
        meals: mealPlans.filter(m => String(m.planned_date).slice(0, 10) === key),
      });
    }
    return out;
  }, [mealPlans]);

  const planned = days.reduce((n, d) => n + d.meals.length, 0);

  return (
    <div className="home-section">
      <div className="home-section__header">
        <h2 className="home-section__title">This week</h2>
        <button className="btn btn--ghost btn--sm home-section__view-all" onClick={onOpenPlan}>
          {planned > 0 ? 'Open plan →' : 'Plan meals →'}
        </button>
      </div>
      <div className="home-week">
        {days.map(d => (
          <button
            key={d.key}
            className={`home-week__day${d.isToday ? ' home-week__day--today' : ''}${d.meals.length ? ' home-week__day--has' : ''}${d.isPast ? ' home-week__day--past' : ''}`}
            onClick={onOpenPlan}
          >
            <span className="home-week__dow">{d.label}</span>
            <span className="home-week__num">{d.num}</span>
            {d.meals.length > 0
              ? <span className="home-week__meal">{d.meals[0].title}</span>
              : <span className="home-week__meal home-week__meal--none">—</span>}
            {d.meals.length > 1 && <span className="home-week__more">+{d.meals.length - 1}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export { StatBar, TonightHero, WeekStrip };
