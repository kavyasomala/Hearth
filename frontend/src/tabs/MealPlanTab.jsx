import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable, DragOverlay,
} from '@dnd-kit/core';
import { API } from '../constants';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const dow = date.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function todayStr() { return fmtDate(new Date()); }
function isPast(dateStr) { return dateStr < todayStr(); }
function isToday(dateStr) { return dateStr === todayStr(); }

const SHORT_DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function dayLabel(d) {
  const dow = d.getDay();
  return `${SHORT_DAYS[dow === 0 ? 6 : dow - 1]} ${d.getDate()}`;
}

function weekRange(monday) {
  const sun = addDays(monday, 6);
  if (monday.getMonth() === sun.getMonth())
    return `${MONTH_SHORT[monday.getMonth()]} ${monday.getDate()}–${sun.getDate()}, ${monday.getFullYear()}`;
  return `${MONTH_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
}

// ─── MealCard ─────────────────────────────────────────────────────────────────

function MealCard({ plan, onRemove, onMarkCooked, isOverlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  const past = isPast(plan.planned_date.slice(0, 10));

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      className={[
        'mp-card',
        isDragging  ? 'mp-card--dragging' : '',
        plan.cooked_at ? 'mp-card--cooked'   : '',
        isOverlay   ? 'mp-card--overlay'  : '',
      ].join(' ')}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
    >
      {plan.cover_image_url
        ? <img className="mp-card__img" src={plan.cover_image_url} alt="" />
        : <div className="mp-card__img mp-card__img--placeholder">🍽</div>
      }
      <div className="mp-card__body">
        <p className="mp-card__title">{plan.title}</p>
        {plan.meal_type && plan.meal_type !== 'any' && (
          <span className="mp-card__type">{plan.meal_type}</span>
        )}
        {plan.cooked_at && <span className="mp-card__cooked-badge">✓ cooked</span>}
      </div>
      {!isOverlay && (
        <div className="mp-card__acts" onPointerDown={e => e.stopPropagation()}>
          {past && !plan.cooked_at && (
            <button className="mp-card__act mp-card__act--cook" onClick={() => onMarkCooked(plan.id)} title="Mark cooked">✓</button>
          )}
          <button className="mp-card__act mp-card__act--rm" onClick={() => onRemove(plan.id)} title="Remove">✕</button>
        </div>
      )}
    </div>
  );
}

// ─── DayColumn ────────────────────────────────────────────────────────────────

function DayColumn({ dateStr, date, plans, onAddMeal, onRemove, onMarkCooked }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const today = isToday(dateStr);
  const past  = isPast(dateStr);

  return (
    <div
      ref={setNodeRef}
      className={[
        'mp-day',
        today ? 'mp-day--today' : '',
        past  ? 'mp-day--past'  : '',
        isOver ? 'mp-day--over' : '',
      ].join(' ')}
    >
      <div className="mp-day__hd">
        <span className="mp-day__label">{dayLabel(date)}</span>
        {today && <span className="mp-day__today-pill">Today</span>}
      </div>
      <div className="mp-day__body">
        {plans.map(p => (
          <MealCard key={p.id} plan={p} onRemove={onRemove} onMarkCooked={onMarkCooked} />
        ))}
        {!past && (
          <button className="mp-day__add" onClick={() => onAddMeal(dateStr)}>+ Add</button>
        )}
      </div>
    </div>
  );
}

// ─── AddMealModal ─────────────────────────────────────────────────────────────

const MEAL_TYPES = ['any', 'breakfast', 'lunch', 'dinner', 'snack'];

function AddMealModal({ dateStr, recipes, onAdd, onClose }) {
  const [q, setQ]           = useState('');
  const [mealType, setType] = useState('any');

  const filtered = useMemo(() => {
    const lq = q.toLowerCase().trim();
    const list = lq ? recipes.filter(r => r.title.toLowerCase().includes(lq)) : recipes;
    return list.slice(0, 40);
  }, [q, recipes]);

  return (
    <div className="mp-modal-bg" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal__hd">
          <h3 className="mp-modal__title">
            Add meal · <span className="mp-modal__date">{dateStr}</span>
          </h3>
          <button className="mp-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="mp-modal__types">
          {MEAL_TYPES.map(t => (
            <button
              key={t}
              className={`chip ${mealType === t ? 'chip--selected' : ''}`}
              onClick={() => setType(t)}
            >
              {t === 'any' ? 'Any' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <input
          autoFocus
          className="mp-modal__search"
          placeholder="Search recipes…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        <div className="mp-modal__list">
          {filtered.map(r => (
            <button
              key={r.id}
              className="mp-modal__item"
              onClick={() => { onAdd(r.id, dateStr, mealType); onClose(); }}
            >
              {r.cover_image_url
                ? <img className="mp-modal__item-img" src={r.cover_image_url} alt="" />
                : <div className="mp-modal__item-img mp-modal__item-img--ph">🍽</div>
              }
              <span className="mp-modal__item-title">{r.title}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="mp-modal__empty">No recipes found</p>}
        </div>
      </div>
    </div>
  );
}

// ─── HistoryWeek ──────────────────────────────────────────────────────────────

function HistoryWeek({ monday, plansByDate, onMarkCooked }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { date: d, dateStr: fmtDate(d) };
  });
  const hasAny = days.some(({ dateStr }) => (plansByDate[dateStr] || []).length > 0);
  if (!hasAny) return null;

  return (
    <div className="mp-history-week">
      <p className="mp-history-week__label">{weekRange(monday)}</p>
      <div className="mp-calendar mp-calendar--history">
        {days.map(({ date, dateStr }) => {
          const plans = plansByDate[dateStr] || [];
          return (
            <div key={dateStr} className="mp-day mp-day--past mp-day--history">
              <div className="mp-day__hd">
                <span className="mp-day__label">{dayLabel(date)}</span>
              </div>
              <div className="mp-day__body">
                {plans.map(p => (
                  <div key={p.id} className={`mp-card mp-card--history ${p.cooked_at ? 'mp-card--cooked' : ''}`}>
                    {p.cover_image_url
                      ? <img className="mp-card__img" src={p.cover_image_url} alt="" />
                      : <div className="mp-card__img mp-card__img--placeholder">🍽</div>
                    }
                    <div className="mp-card__body">
                      <p className="mp-card__title">{p.title}</p>
                      {p.cooked_at
                        ? <span className="mp-card__cooked-badge">✓ cooked</span>
                        : <span className="mp-card__missed-badge">planned</span>
                      }
                    </div>
                    {!p.cooked_at && (
                      <button
                        className="mp-card__act mp-card__act--cook"
                        onClick={() => onMarkCooked(p.id)}
                        title="Mark cooked"
                      >✓</button>
                    )}
                  </div>
                ))}
                {plans.length === 0 && <p className="mp-day__empty">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MealPlanTab ──────────────────────────────────────────────────────────────

export default function MealPlanTab({ session, recipes = [] }) {
  const [weekStart,    setWeekStart]    = useState(() => getMonday(new Date()));
  const [plans,        setPlans]        = useState([]);
  const [addModal,     setAddModal]     = useState(null); // dateStr | null
  const [activeDragId, setActiveDragId] = useState(null);
  const [showHistory,  setShowHistory]  = useState(false);
  const [historyWeeks, setHistoryWeeks] = useState(4); // how many past weeks to load

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!session) return;
    const start = fmtDate(addDays(weekStart, showHistory ? -7 * historyWeeks : 0));
    const end   = fmtDate(addDays(weekStart, 13)); // current + next week
    const res = await fetch(`${API}/api/meal-plans?start=${start}&end=${end}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setPlans(await res.json());
  }, [session, weekStart, showHistory, historyWeeks]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const plansByDate = useMemo(() => {
    const map = {};
    for (const p of plans) {
      const key = p.planned_date.slice(0, 10);
      (map[key] ??= []).push(p);
    }
    return map;
  }, [plans]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { date: d, dateStr: fmtDate(d) };
    }), [weekStart]);

  const pastWeeks = useMemo(() =>
    showHistory
      ? Array.from({ length: historyWeeks }, (_, i) => getMonday(addDays(weekStart, -7 * (i + 1))))
      : [],
    [showHistory, historyWeeks, weekStart]);

  const activePlan = activeDragId ? plans.find(p => p.id === activeDragId) : null;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addMeal = useCallback(async (recipeId, date, mealType) => {
    if (!session) return;
    const res = await fetch(`${API}/api/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ recipe_id: recipeId, planned_date: date, meal_type: mealType }),
    });
    if (res.ok) {
      const p = await res.json();
      setPlans(prev => [...prev, p]);
    }
  }, [session]);

  const removePlan = useCallback(async (id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    await fetch(`${API}/api/meal-plans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }, [session]);

  const markCooked = useCallback(async (id) => {
    const now = new Date().toISOString();
    setPlans(prev => prev.map(p => p.id === id ? { ...p, cooked_at: now } : p));
    await fetch(`${API}/api/meal-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ cooked: true }),
    });
  }, [session]);

  // ── Drag ──────────────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => setActiveDragId(active.id);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveDragId(null);
    if (!over) return;
    const planId  = active.id;
    const newDate = over.id;
    const plan = plans.find(p => p.id === planId);
    if (!plan || plan.planned_date.slice(0, 10) === newDate) return;

    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, planned_date: newDate } : p
    ));
    await fetch(`${API}/api/meal-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ planned_date: newDate }),
    });
  }, [plans, session]);

  // ── Week nav ───────────────────────────────────────────────────────────────

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d,  7));
  const goToday  = () => setWeekStart(getMonday(new Date()));

  if (!session) {
    return (
      <main className="view">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)' }}>
          Sign in to use Meal Planner
        </div>
      </main>
    );
  }

  return (
    <main className="view meal-plan-view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mp-header">
        <div>
          <h2 className="mp-title">Meal Plan</h2>
          <p className="mp-subtitle">{weekRange(weekStart)}</p>
        </div>
        <div className="mp-nav">
          <button className="mp-nav__btn" onClick={prevWeek}>‹</button>
          <button className="mp-nav__btn mp-nav__btn--today" onClick={goToday}>Today</button>
          <button className="mp-nav__btn" onClick={nextWeek}>›</button>
        </div>
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mp-calendar">
          {weekDays.map(({ date, dateStr }) => (
            <DayColumn
              key={dateStr}
              date={date}
              dateStr={dateStr}
              plans={plansByDate[dateStr] || []}
              onAddMeal={setAddModal}
              onRemove={removePlan}
              onMarkCooked={markCooked}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activePlan && <MealCard plan={activePlan} onRemove={() => {}} onMarkCooked={() => {}} isOverlay />}
        </DragOverlay>
      </DndContext>

      {/* ── History ────────────────────────────────────────────────────────── */}
      <div className="mp-history-toggle">
        <button className="btn btn--ghost btn--sm" onClick={() => setShowHistory(h => !h)}>
          {showHistory ? '↑ Hide history' : '↓ Cooking history'}
        </button>
        {showHistory && historyWeeks < 12 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setHistoryWeeks(w => w + 4)}>
            Load more
          </button>
        )}
      </div>

      {showHistory && pastWeeks.map(monday => (
        <HistoryWeek
          key={fmtDate(monday)}
          monday={monday}
          plansByDate={plansByDate}
          onMarkCooked={markCooked}
        />
      ))}

      {/* ── Add modal ──────────────────────────────────────────────────────── */}
      {addModal && (
        <AddMealModal
          dateStr={addModal}
          recipes={recipes}
          onAdd={addMeal}
          onClose={() => setAddModal(null)}
        />
      )}
    </main>
  );
}
