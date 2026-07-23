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
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function getMonday(d) {
  const r = new Date(d); r.setHours(0,0,0,0);
  const dow = r.getDay(); r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1)); return r;
}
function todayStr() { return fmtDate(new Date()); }
function isPast(s)  { return s < todayStr(); }
function isToday(s) { return s === todayStr(); }

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DOW_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

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
    return { date: d, dateStr: fmtDate(d) };
  });
}

// ─── Month pill (compact, draggable) ─────────────────────────────────────────

function DraggablePill({ plan, onRemove, onMarkCooked, isOverlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  const past = isPast(plan.planned_date.slice(0, 10));
  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      className={['mp-pill', isDragging ? 'mp-pill--dragging' : '', plan.cooked_at ? 'mp-pill--cooked' : '', isOverlay ? 'mp-pill--overlay' : ''].join(' ')}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      title={plan.title}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
    >
      {plan.cover_image_url
        ? <img className="mp-pill__img" src={plan.cover_image_url} alt="" />
        : <span className="mp-pill__img mp-pill__img--ph">🍽</span>
      }
      <span className="mp-pill__title">{plan.title}</span>
      {plan.cooked_at && <span className="mp-pill__cooked-dot">✓</span>}
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

// ─── Month day cell ───────────────────────────────────────────────────────────

function DroppableDayCell({ dateStr, date, plans, inMonth, onCellClick, onRemove, onMarkCooked, isSelected }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const today   = isToday(dateStr);
  const past    = isPast(dateStr);
  const show    = plans.slice(0, 3);
  const more    = plans.length - show.length;

  return (
    <div
      ref={setNodeRef}
      className={['mp-cell', !inMonth ? 'mp-cell--other' : '', today ? 'mp-cell--today' : '', past ? 'mp-cell--past' : '', isOver ? 'mp-cell--over' : '', isSelected ? 'mp-cell--selected' : ''].join(' ')}
      onClick={() => onCellClick(dateStr)}
    >
      <div className="mp-cell__hd">
        <span className="mp-cell__num">{date.getDate()}</span>
        {inMonth && !past && plans.length === 0 && <span className="mp-cell__add-hint">+</span>}
      </div>
      <div className="mp-cell__body" onClick={e => e.stopPropagation()}>
        {show.map(p => (
          <DraggablePill key={p.id} plan={p} onRemove={onRemove} onMarkCooked={onMarkCooked} />
        ))}
        {more > 0 && (
          <button className="mp-cell__more" onClick={() => onCellClick(dateStr)}>+{more} more</button>
        )}
      </div>
    </div>
  );
}

// ─── Week column view: full cards ─────────────────────────────────────────────

function DraggableWeekCard({ plan, past, onRemove, onMarkCooked, onOpenRecipe, isOverlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      className={['mp-wcard', isDragging ? 'mp-wcard--dragging' : '', plan.cooked_at ? 'mp-wcard--cooked' : '', isOverlay ? 'mp-wcard--overlay' : ''].join(' ')}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      {/* Drag handle */}
      <div
        className="mp-wcard__drag"
        {...(isOverlay ? {} : listeners)}
        {...(isOverlay ? {} : attributes)}
        title="Drag to reschedule"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" opacity="0.35">
          <circle cx="3" cy="2.5" r="1.5"/><circle cx="7" cy="2.5" r="1.5"/>
          <circle cx="3" cy="7"   r="1.5"/><circle cx="7" cy="7"   r="1.5"/>
          <circle cx="3" cy="11.5" r="1.5"/><circle cx="7" cy="11.5" r="1.5"/>
        </svg>
      </div>
      {/* Clickable recipe body */}
      <button
        className="mp-wcard__body"
        onClick={() => onOpenRecipe?.({ id: plan.recipe_id, name: plan.title, cover_image_url: plan.cover_image_url })}
      >
        {plan.cover_image_url
          ? <img className="mp-wcard__img" src={plan.cover_image_url} alt="" />
          : <div className="mp-wcard__img mp-wcard__img--ph">🍽</div>
        }
        <div className="mp-wcard__info">
          <span className="mp-wcard__title">{plan.title}</span>
          {plan.meal_type && plan.meal_type !== 'any' && (
            <span className="mp-wcard__type">{plan.meal_type}</span>
          )}
          {plan.cooked_at && <span className="mp-wcard__cooked-label">✓ Cooked</span>}
        </div>
      </button>
      {/* Actions */}
      {!isOverlay && (
        <div className="mp-wcard__acts">
          {past && !plan.cooked_at && (
            <button className="mp-wcard__act mp-wcard__act--cook" onClick={() => onMarkCooked(plan.id)} title="Mark cooked">✓</button>
          )}
          <button className="mp-wcard__act mp-wcard__act--rm" onClick={() => onRemove(plan.id)} title="Remove">✕</button>
        </div>
      )}
    </div>
  );
}

function WeekColumnView({ weekCells, plansByDate, activeDragId, onAddMeal, onRemove, onMarkCooked, onOpenRecipe }) {
  return (
    <div className="mp-week-cols">
      {weekCells.map(({ date, dateStr }, i) => {
        const plans = plansByDate[dateStr] || [];
        const today = isToday(dateStr);
        const past  = isPast(dateStr);
        return (
          <WeekColumn
            key={dateStr}
            dateStr={dateStr}
            date={date}
            dow={DOW_FULL[i]}
            plans={plans}
            today={today}
            past={past}
            onAddMeal={onAddMeal}
            onRemove={onRemove}
            onMarkCooked={onMarkCooked}
            onOpenRecipe={onOpenRecipe}
          />
        );
      })}
    </div>
  );
}

function WeekColumn({ dateStr, date, dow, plans, today, past, onAddMeal, onRemove, onMarkCooked, onOpenRecipe }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  return (
    <div
      ref={setNodeRef}
      className={['mp-wcol', today ? 'mp-wcol--today' : '', past ? 'mp-wcol--past' : '', isOver ? 'mp-wcol--over' : ''].join(' ')}
    >
      <div className="mp-wcol__hd">
        <span className="mp-wcol__dow">{dow}</span>
        <span className="mp-wcol__date">{date.getDate()}</span>
      </div>
      <div className="mp-wcol__body">
        {plans.map(p => (
          <DraggableWeekCard
            key={p.id}
            plan={p}
            past={past}
            onRemove={onRemove}
            onMarkCooked={onMarkCooked}
            onOpenRecipe={onOpenRecipe}
          />
        ))}
        {plans.length === 0 && (
          <p className="mp-wcol__empty">No meals</p>
        )}
      </div>
      {!past && (
        <button className="mp-wcol__add" onClick={() => onAddMeal(dateStr)}>+ Add meal</button>
      )}
    </div>
  );
}

// ─── Add meal modal (matches create-modal style) ──────────────────────────────

const MEAL_TYPES = ['any', 'breakfast', 'lunch', 'dinner', 'snack'];

function AddMealModal({ dateStr, recipes, onAdd, onClose }) {
  const [q,        setQ]    = useState('');
  const [mealType, setType] = useState('any');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const filtered = useMemo(() => {
    const lq = q.toLowerCase().trim();
    return (lq ? recipes.filter(r => (r.name || r.title || '').toLowerCase().includes(lq)) : recipes).slice(0, 40);
  }, [q, recipes]);

  const [y, m, d] = dateStr.split('-');
  const label = `${MONTH_NAMES[+m - 1]} ${+d}, ${y}`;

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="mp-add-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-add-modal__hd">
          <div>
            <h3 className="mp-add-modal__title">Add meal</h3>
            <p className="mp-add-modal__date">{label}</p>
          </div>
          <button className="mp-add-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mp-add-modal__types">
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

        <div className="mp-add-modal__search-wrap">
          <input
            ref={inputRef}
            className="mp-add-modal__search"
            placeholder="Search recipes…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <div className="mp-add-modal__list">
          {filtered.map(r => (
            <button
              key={r.id}
              className="mp-add-modal__item"
              onClick={() => { onAdd(r.id, dateStr, mealType); onClose(); }}
            >
              {(r.coverImage || r.cover_image_url)
                ? <img className="mp-add-modal__item-img" src={r.coverImage || r.cover_image_url} alt="" />
                : <div className="mp-add-modal__item-img mp-add-modal__item-img--ph">🍽</div>
              }
              <span className="mp-add-modal__item-title">{r.name || r.title}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="mp-add-modal__empty">No recipes found</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

function DayDetailPanel({ dateStr, plans, onClose, onAddMeal, onRemove, onMarkCooked, onOpenRecipe }) {
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
            <button className="btn btn--ghost btn--sm" onClick={() => onAddMeal(dateStr)}>+ Add meal</button>
          )}
          {onClose && (
            <button className="mp-detail__close" onClick={onClose} title="Close">✕</button>
          )}
        </div>
      </div>

      {plans.length === 0 ? (
        <p className="mp-detail__empty">
          {past ? 'Nothing was planned.' : 'Tap + Add meal to plan something.'}
        </p>
      ) : (
        <div className="mp-detail__list">
          {plans.map(p => (
            <div
              key={p.id}
              className={`mp-detail__card ${p.cooked_at ? 'mp-detail__card--cooked' : ''}`}
            >
              <button
                className="mp-detail__card-body"
                onClick={() => onOpenRecipe?.({ id: p.recipe_id, name: p.title, cover_image_url: p.cover_image_url })}
                title="Open recipe"
              >
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
              </button>
              <div className="mp-detail__acts">
                {past && !p.cooked_at && (
                  <button className="mp-detail__act mp-detail__act--cook" onClick={() => onMarkCooked(p.id)} title="Mark cooked">✓</button>
                )}
                <button className="mp-detail__act mp-detail__act--rm" onClick={() => onRemove(p.id)} title="Remove">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MealPlanTab ──────────────────────────────────────────────────────────────

export default function MealPlanTab({ session, recipes = [], onOpenRecipe }) {
  const now = new Date();
  const [viewMode,     setViewMode]     = useState('month');
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
    const anchor = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
    if (mode === 'week') setWeekStart(getMonday(anchor));
    else { setYear(anchor.getFullYear()); setMonth(anchor.getMonth()); }
  };

  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : (() => {
        const end = addDays(weekStart, 6);
        return weekStart.getMonth() === end.getMonth()
          ? `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${weekStart.getFullYear()}`
          : `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
      })();

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addMeal = useCallback(async (recipeId, date, mealType) => {
    if (!session) return;
    const res = await fetch(`${API}/api/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ recipe_id: recipeId, planned_date: date, meal_type: mealType }),
    });
    if (res.ok) { const newPlan = await res.json(); setPlans(prev => [...prev, newPlan]); }
  }, [session]);

  const removePlan = useCallback(async (id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    await fetch(`${API}/api/meal-plans/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }, [session]);

  const markCooked = useCallback(async (id) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, cooked_at: new Date().toISOString() } : p));
    await fetch(`${API}/api/meal-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ cooked: true }),
    });
  }, [session]);

  // ── Drag ─────────────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => setActiveDragId(active.id);
  const handleDragEnd   = useCallback(async ({ active, over }) => {
    setActiveDragId(null);
    if (!over) return;
    const plan = plans.find(p => p.id === active.id);
    if (!plan || plan.planned_date.slice(0, 10) === over.id) return;
    setPlans(prev => prev.map(p => p.id === active.id ? { ...p, planned_date: over.id } : p));
    if (selectedDate === plan.planned_date.slice(0, 10)) setSelectedDate(over.id);
    await fetch(`${API}/api/meal-plans/${active.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ planned_date: over.id }),
    });
  }, [plans, session, selectedDate]);

  // ── Cell click (month view) ───────────────────────────────────────────────

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

  const isWeek = viewMode === 'week';

  return (
    <main className="view meal-plan-view">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mp-header">
        <div className="mp-header__left">
          <h2 className="mp-title">{periodLabel}</h2>
        </div>
        <div className="mp-header__right">
          <div className="mp-view-toggle">
            <button className={`mp-view-toggle__btn ${!isWeek ? 'mp-view-toggle__btn--active' : ''}`} onClick={() => switchView('month')}>Month</button>
            <button className={`mp-view-toggle__btn ${isWeek ? 'mp-view-toggle__btn--active' : ''}`}  onClick={() => switchView('week')}>Week</button>
          </div>
          <div className="mp-nav">
            <button className="mp-nav__btn" onClick={prevPeriod}>‹</button>
            <button className="mp-nav__btn mp-nav__btn--today" onClick={goToday}>Today</button>
            <button className="mp-nav__btn" onClick={nextPeriod}>›</button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className={`mp-body ${isWeek ? 'mp-body--week' : ''}`}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

          {isWeek ? (
            /* ── Week column view ─────────────────────────────────────────── */
            <div className="mp-grid-wrap mp-grid-wrap--week">
              <WeekColumnView
                weekCells={weekCells}
                plansByDate={plansByDate}
                activeDragId={activeDragId}
                onAddMeal={(d) => setAddModal(d)}
                onRemove={removePlan}
                onMarkCooked={markCooked}
                onOpenRecipe={onOpenRecipe}
              />
            </div>
          ) : (
            /* ── Month grid ───────────────────────────────────────────────── */
            <div className="mp-grid-wrap">
              <div className="mp-dow-row">
                {DOW_SHORT.map(d => <span key={d} className="mp-dow">{d}</span>)}
              </div>
              <div className="mp-grid">
                {monthCells.map(({ date, dateStr, inMonth }) => (
                  <DroppableDayCell
                    key={dateStr}
                    date={date}
                    dateStr={dateStr}
                    inMonth={inMonth}
                    plans={plansByDate[dateStr] || []}
                    onCellClick={handleCellClick}
                    onRemove={removePlan}
                    onMarkCooked={markCooked}
                    isSelected={selectedDate === dateStr}
                  />
                ))}
              </div>
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activePlan && (
              isWeek
                ? <DraggableWeekCard plan={activePlan} past={false} onRemove={() => {}} onMarkCooked={() => {}} isOverlay />
                : <DraggablePill plan={activePlan} onRemove={() => {}} onMarkCooked={() => {}} isOverlay />
            )}
          </DragOverlay>
        </DndContext>

        {/* Detail panel — month view only (week view is self-contained) */}
        {!isWeek && (
          <div className="mp-detail-wrap">
            {selectedDate ? (
              <DayDetailPanel
                dateStr={selectedDate}
                plans={selectedPlans}
                onClose={() => setSelectedDate(null)}
                onAddMeal={d => setAddModal(d)}
                onRemove={removePlan}
                onMarkCooked={markCooked}
                onOpenRecipe={onOpenRecipe}
              />
            ) : (
              <div className="mp-detail-empty">
                <p>Tap a day to see or add meals</p>
              </div>
            )}
          </div>
        )}
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
