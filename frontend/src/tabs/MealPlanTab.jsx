import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function getMonday(d) {
  const r = new Date(d); r.setHours(0,0,0,0);
  const dow = r.getDay(); r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1)); return r;
}
function todayStr() { return fmtDate(new Date()); }
function isPast(s)  { return s < todayStr(); }
function isToday(s) { return s === todayStr(); }

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_SHORT   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMonthCells(year, month) {
  const first  = new Date(year, month, 1);
  const last   = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const total  = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { date: d, dateStr: fmtDate(d), inMonth: d.getMonth() === month };
  });
}

function getWeekCells(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, dateStr: fmtDate(d), inMonth: true };
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

function DroppableDayCell({ dateStr, date, plans, inMonth, isWeekView, onCellClick, onRemove, onMarkCooked, isSelected }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const today    = isToday(dateStr);
  const past     = isPast(dateStr);
  const maxPills = isWeekView ? 6 : 3;
  const show     = plans.slice(0, maxPills);
  const more     = plans.length - show.length;

  return (
    <div
      ref={setNodeRef}
      className={[
        'mp-cell',
        !inMonth    ? 'mp-cell--other'    : '',
        today       ? 'mp-cell--today'    : '',
        past        ? 'mp-cell--past'     : '',
        isOver      ? 'mp-cell--over'     : '',
        isSelected  ? 'mp-cell--selected' : '',
        isWeekView  ? 'mp-cell--week'     : '',
      ].join(' ')}
      onClick={() => onCellClick(dateStr)}
    >
      <div className="mp-cell__hd">
        <span className="mp-cell__num">{date.getDate()}</span>
        {isWeekView && (
          <span className="mp-cell__dow">{DOW_SHORT[(date.getDay() + 6) % 7]}</span>
        )}
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
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
          ref={inputRef}
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
          {onClose && (
            <button className="mp-detail__close" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      {plans.length === 0 ? (
        <p className="mp-detail__empty">
          {past ? 'Nothing was planned for this day.' : 'Tap + Add meal to plan something.'}
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
  const now  = new Date();
  const [viewMode,     setViewMode]     = useState('month'); // 'month' | 'week'
  const [year,         setYear]         = useState(now.getFullYear());
  const [month,        setMonth]        = useState(now.getMonth());
  const [weekStart,    setWeekStart]    = useState(() => getMonday(now));
  const [plans,        setPlans]        = useState([]);
  const [addModal,     setAddModal]     = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [activeDragId, setActiveDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const monthCells = useMemo(() => getMonthCells(year, month), [year, month]);
  const weekCells  = useMemo(() => getWeekCells(weekStart), [weekStart]);
  const cells      = viewMode === 'month' ? monthCells : weekCells;

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

  const activePlan    = activeDragId ? plans.find(p => p.id === activeDragId) : null;
  const selectedPlans = selectedDate ? (plansByDate[selectedDate] || []) : [];

  // ── Navigation ────────────────────────────────────────────────────────────

  const prevPeriod = () => {
    if (viewMode === 'month') {
      if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    } else {
      setWeekStart(d => addDays(d, -7));
    }
  };
  const nextPeriod = () => {
    if (viewMode === 'month') {
      if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    } else {
      setWeekStart(d => addDays(d, 7));
    }
  };
  const goToday = () => {
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth());
    setWeekStart(getMonday(n));
    setSelectedDate(todayStr());
  };

  const switchView = (mode) => {
    setViewMode(mode);
    if (mode === 'week') {
      // Jump to the week containing the selected date or today
      const anchor = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
      setWeekStart(getMonday(anchor));
    } else {
      const anchor = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
      setYear(anchor.getFullYear()); setMonth(anchor.getMonth());
    }
  };

  // ── Period label ──────────────────────────────────────────────────────────

  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : (() => {
        const end = addDays(weekStart, 6);
        if (weekStart.getMonth() === end.getMonth())
          return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${weekStart.getFullYear()}`;
        return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
      })();

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
    if (selectedDate === plan.planned_date.slice(0, 10)) setSelectedDate(newDate);

    await fetch(`${API}/api/meal-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ planned_date: newDate }),
    });
  }, [plans, session, selectedDate]);

  // ── Cell click ────────────────────────────────────────────────────────────

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

  const isWeekView = viewMode === 'week';

  return (
    <main className="view meal-plan-view">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mp-header">
        <div className="mp-header__left">
          <h2 className="mp-title">Meal Plan</h2>
          <p className="mp-subtitle">{periodLabel}</p>
        </div>
        <div className="mp-header__right">
          {/* View toggle */}
          <div className="mp-view-toggle">
            <button
              className={`mp-view-toggle__btn ${!isWeekView ? 'mp-view-toggle__btn--active' : ''}`}
              onClick={() => switchView('month')}
            >Month</button>
            <button
              className={`mp-view-toggle__btn ${isWeekView ? 'mp-view-toggle__btn--active' : ''}`}
              onClick={() => switchView('week')}
            >Week</button>
          </div>
          {/* Navigation */}
          <div className="mp-nav">
            <button className="mp-nav__btn" onClick={prevPeriod} aria-label="Previous">‹</button>
            <button className="mp-nav__btn mp-nav__btn--today" onClick={goToday}>Today</button>
            <button className="mp-nav__btn" onClick={nextPeriod} aria-label="Next">›</button>
          </div>
        </div>
      </div>

      {/* ── Calendar + Detail — split layout ────────────────────────────────── */}
      <div className="mp-body">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="mp-grid-wrap">
            {/* Day-of-week header row — only shown in month view */}
            {!isWeekView && (
              <div className="mp-dow-row">
                {DOW_SHORT.map(d => <span key={d} className="mp-dow">{d}</span>)}
              </div>
            )}

            <div className={`mp-grid ${isWeekView ? 'mp-grid--week' : ''}`}>
              {cells.map(({ date, dateStr, inMonth }) => (
                <DroppableDayCell
                  key={dateStr}
                  date={date}
                  dateStr={dateStr}
                  inMonth={inMonth}
                  isWeekView={isWeekView}
                  plans={plansByDate[dateStr] || []}
                  onCellClick={handleCellClick}
                  onRemove={removePlan}
                  onMarkCooked={markCooked}
                  isSelected={selectedDate === dateStr}
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

        {/* Day detail — always visible on mobile below calendar, sidebar on desktop */}
        <div className="mp-detail-wrap">
          {selectedDate ? (
            <DayDetailPanel
              dateStr={selectedDate}
              plans={selectedPlans}
              onClose={() => setSelectedDate(null)}
              onAddMeal={(date) => { setAddModal(date); }}
              onRemove={removePlan}
              onMarkCooked={markCooked}
            />
          ) : (
            <div className="mp-detail-empty">
              <p>Tap a day to see or add meals</p>
            </div>
          )}
        </div>
      </div>

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
