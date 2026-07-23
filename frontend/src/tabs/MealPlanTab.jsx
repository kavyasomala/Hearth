import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable, DragOverlay,
} from '@dnd-kit/core';
import { API } from '../constants';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayStr() { return fmtDate(new Date()); }
function isPast(s)  { return s < todayStr(); }
function isToday(s) { return s === todayStr(); }

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_SHORT   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);
  const startOffset  = (firstOfMonth.getDay() + 6) % 7; // Monday-based
  const totalCells   = Math.ceil((startOffset + lastOfMonth.getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(year, month, 1 - startOffset + i);
    return { date: d, dateStr: fmtDate(d), inMonth: d.getMonth() === month };
  });
}

// ─── DraggableMealPill ────────────────────────────────────────────────────────

function DraggableMealPill({ plan, onRemove, onMarkCooked, isOverlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  const past = isPast(plan.planned_date.slice(0, 10));

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      className={[
        'mp-pill',
        isDragging     ? 'mp-pill--dragging' : '',
        plan.cooked_at ? 'mp-pill--cooked'   : '',
        isOverlay      ? 'mp-pill--overlay'  : '',
      ].join(' ')}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      title={plan.title}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
    >
      {plan.cover_image_url
        ? <img  className="mp-pill__img" src={plan.cover_image_url} alt="" />
        : <span className="mp-pill__img mp-pill__img--ph">🍽</span>
      }
      <span className="mp-pill__title">{plan.title}</span>
      {plan.cooked_at && <span className="mp-pill__cooked-dot" title="Cooked">✓</span>}
      {!isOverlay && (
        <div className="mp-pill__acts" onPointerDown={e => e.stopPropagation()}>
          {past && !plan.cooked_at && (
            <button className="mp-pill__act" onClick={() => onMarkCooked(plan.id)} title="Mark cooked">✓</button>
          )}
          <button className="mp-pill__act mp-pill__act--rm" onClick={() => onRemove(plan.id)} title="Remove">✕</button>
        </div>
      )}
    </div>
  );
}

// ─── DroppableDayCell ─────────────────────────────────────────────────────────

function DroppableDayCell({ dateStr, date, plans, inMonth, onCellClick, onRemove, onMarkCooked }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const today = isToday(dateStr);
  const past  = isPast(dateStr);
  const show  = plans.slice(0, 3);
  const more  = plans.length - show.length;

  return (
    <div
      ref={setNodeRef}
      className={[
        'mp-cell',
        !inMonth ? 'mp-cell--other' : '',
        today    ? 'mp-cell--today' : '',
        past     ? 'mp-cell--past'  : '',
        isOver   ? 'mp-cell--over'  : '',
      ].join(' ')}
      onClick={() => onCellClick(dateStr)}
    >
      <div className="mp-cell__hd">
        <span className="mp-cell__num">{date.getDate()}</span>
        {inMonth && !past && plans.length === 0 && (
          <span className="mp-cell__add-hint">+</span>
        )}
      </div>
      <div className="mp-cell__body" onClick={e => e.stopPropagation()}>
        {show.map(p => (
          <DraggableMealPill
            key={p.id}
            plan={p}
            onRemove={onRemove}
            onMarkCooked={onMarkCooked}
          />
        ))}
        {more > 0 && (
          <button className="mp-cell__more" onClick={() => onCellClick(dateStr)}>
            +{more} more
          </button>
        )}
      </div>
    </div>
  );
}

// ─── AddMealModal ─────────────────────────────────────────────────────────────

const MEAL_TYPES = ['any', 'breakfast', 'lunch', 'dinner', 'snack'];

function AddMealModal({ dateStr, recipes, onAdd, onClose }) {
  const [q,        setQ]    = useState('');
  const [mealType, setType] = useState('any');

  const filtered = useMemo(() => {
    const lq = q.toLowerCase().trim();
    return (lq ? recipes.filter(r => r.title.toLowerCase().includes(lq)) : recipes).slice(0, 40);
  }, [q, recipes]);

  const [y, m, d] = dateStr.split('-');
  const label = `${MONTH_NAMES[+m - 1]} ${+d}, ${y}`;

  return (
    <div className="mp-modal-bg" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal__hd">
          <div>
            <h3 className="mp-modal__title">Add meal</h3>
            <p className="mp-modal__date-label">{label}</p>
          </div>
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
                ? <img  className="mp-modal__item-img" src={r.cover_image_url} alt="" />
                : <div  className="mp-modal__item-img mp-modal__item-img--ph">🍽</div>
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

// ─── DayDetailPanel ───────────────────────────────────────────────────────────

function DayDetailPanel({ dateStr, plans, onClose, onAddMeal, onRemove, onMarkCooked }) {
  const [y, m, d] = dateStr.split('-');
  const label = `${MONTH_NAMES[+m - 1]} ${+d}`;
  const past  = isPast(dateStr);
  const today = isToday(dateStr);

  return (
    <div className="mp-detail">
      <div className="mp-detail__hd">
        <span className="mp-detail__label">{today ? 'Today' : label}</span>
        <div className="mp-detail__hd-acts">
          {!past && (
            <button className="btn btn--ghost btn--sm" onClick={() => onAddMeal(dateStr)}>
              + Add meal
            </button>
          )}
          <button className="mp-detail__close" onClick={onClose}>✕</button>
        </div>
      </div>

      {plans.length === 0 ? (
        <p className="mp-detail__empty">
          {past ? 'Nothing was planned for this day.' : 'Tap a recipe to add it.'}
        </p>
      ) : (
        <div className="mp-detail__list">
          {plans.map(p => (
            <div key={p.id} className={`mp-detail__card ${p.cooked_at ? 'mp-detail__card--cooked' : ''}`}>
              {p.cover_image_url
                ? <img className="mp-detail__img" src={p.cover_image_url} alt="" />
                : <div className="mp-detail__img mp-detail__img--ph">🍽</div>
              }
              <div className="mp-detail__body">
                <p className="mp-detail__title">{p.title}</p>
                {p.meal_type && p.meal_type !== 'any' && (
                  <span className="mp-detail__type">{p.meal_type}</span>
                )}
                {p.cooked_at && <span className="mp-detail__cooked">✓ Cooked</span>}
              </div>
              <div className="mp-detail__acts">
                {past && !p.cooked_at && (
                  <button className="mp-detail__act mp-detail__act--cook" onClick={() => onMarkCooked(p.id)}>
                    ✓ Cooked
                  </button>
                )}
                <button className="mp-detail__act mp-detail__act--rm" onClick={() => onRemove(p.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MealPlanTab ──────────────────────────────────────────────────────────────

export default function MealPlanTab({ session, recipes = [] }) {
  const now = new Date();
  const [year,         setYear]         = useState(now.getFullYear());
  const [month,        setMonth]        = useState(now.getMonth());
  const [plans,        setPlans]        = useState([]);
  const [addModal,     setAddModal]     = useState(null); // dateStr | null
  const [selectedDate, setSelectedDate] = useState(null); // dateStr | null
  const [activeDragId, setActiveDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const cells = useMemo(() => getMonthCells(year, month), [year, month]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!session || !cells.length) return;
    const start = cells[0].dateStr;
    const end   = cells[cells.length - 1].dateStr;
    const res = await fetch(`${API}/api/meal-plans?start=${start}&end=${end}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setPlans(await res.json());
  }, [session, cells]);

  useEffect(() => { load(); }, [load]);

  const plansByDate = useMemo(() => {
    const map = {};
    for (const p of plans) {
      const key = p.planned_date.slice(0, 10);
      (map[key] ??= []).push(p);
    }
    return map;
  }, [plans]);

  const activePlan = activeDragId ? plans.find(p => p.id === activeDragId) : null;

  // ── Month nav ─────────────────────────────────────────────────────────────

  const prevMonth = () => {
    setSelectedDate(null);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else               setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelectedDate(null);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else               setMonth(m => m + 1);
  };
  const goToday = () => {
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth());
    setSelectedDate(null);
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

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
    setPlans(prev => prev.map(p =>
      p.id === id ? { ...p, cooked_at: new Date().toISOString() } : p
    ));
    await fetch(`${API}/api/meal-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ cooked: true }),
    });
  }, [session]);

  // ── Drag ─────────────────────────────────────────────────────────────────

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
    if (selectedDate === plan.planned_date.slice(0, 10)) {
      setSelectedDate(newDate);
    }
    await fetch(`${API}/api/meal-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ planned_date: newDate }),
    });
  }, [plans, session, selectedDate]);

  // ── Cell interaction ──────────────────────────────────────────────────────

  const handleCellClick = useCallback((dateStr) => {
    const dayPlans = plansByDate[dateStr] || [];
    if (dayPlans.length > 0 || isPast(dateStr)) {
      setSelectedDate(s => s === dateStr ? null : dateStr);
    } else {
      setAddModal(dateStr);
    }
  }, [plansByDate]);

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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mp-header">
        <div>
          <h2 className="mp-title">Meal Plan</h2>
          <p className="mp-subtitle">{MONTH_NAMES[month]} {year}</p>
        </div>
        <div className="mp-nav">
          <button className="mp-nav__btn" onClick={prevMonth} aria-label="Previous month">‹</button>
          <button className="mp-nav__btn mp-nav__btn--today" onClick={goToday}>Today</button>
          <button className="mp-nav__btn" onClick={nextMonth} aria-label="Next month">›</button>
        </div>
      </div>

      {/* ── Calendar ────────────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mp-grid-wrap">
          <div className="mp-dow-row">
            {DOW_SHORT.map(d => <span key={d} className="mp-dow">{d}</span>)}
          </div>
          <div className="mp-grid">
            {cells.map(({ date, dateStr, inMonth }) => (
              <DroppableDayCell
                key={dateStr}
                date={date}
                dateStr={dateStr}
                inMonth={inMonth}
                plans={plansByDate[dateStr] || []}
                onCellClick={handleCellClick}
                onRemove={removePlan}
                onMarkCooked={markCooked}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activePlan && (
            <DraggableMealPill
              plan={activePlan}
              onRemove={() => {}}
              onMarkCooked={() => {}}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Day detail panel ─────────────────────────────────────────────────── */}
      {selectedDate && (
        <DayDetailPanel
          dateStr={selectedDate}
          plans={plansByDate[selectedDate] || []}
          onClose={() => setSelectedDate(null)}
          onAddMeal={(date) => { setAddModal(date); setSelectedDate(null); }}
          onRemove={removePlan}
          onMarkCooked={markCooked}
        />
      )}

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
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
