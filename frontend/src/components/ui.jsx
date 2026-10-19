import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';

// 8px movement threshold prevents tap-to-select being eaten by drag
export const DRAG_SENSORS = () => useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  componentDidCatch(error, info) { this.setState({ error, info }); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff0f0', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00' }}>Runtime Error</h2>
          <pre style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f99', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export const useAnchoredPopover = (opts = {}) => {
  const { preferSide = 'bottom', gap = 8, popoverW = 380, popoverH = 480 } = opts;
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openPopover = useCallback(() => {
    if (!anchorRef.current) { setOpen(true); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    let top;
    if (preferSide === 'bottom' && spaceBelow >= Math.min(popoverH, 300) + gap) {
      top = rect.bottom + gap;
    } else if (spaceAbove >= Math.min(popoverH, 300) + gap) {
      top = rect.top - Math.min(popoverH, spaceAbove - gap);
    } else {
      top = Math.max(8, (vh - popoverH) / 2);
    }

    let left = rect.left;
    if (left + popoverW > vw - 8) left = vw - popoverW - 8;
    if (left < 8) left = 8;

    if (vw <= 640) {
      top = Math.max(8, (vh - popoverH) / 2);
      left = (vw - Math.min(popoverW, vw - 16)) / 2;
    }

    setPos({ top, left });
    setOpen(true);
  }, [preferSide, gap, popoverW, popoverH]);

  return {
    anchorRef, open, setOpen, openPopover,
    popoverStyle: { position: 'fixed', top: pos.top, left: pos.left, width: Math.min(popoverW, window.innerWidth - 16), zIndex: 1000 },
  };
};

export const AnchoredPopover = ({ open, onClose, popoverStyle, children, maxHeight = 520 }) => {
  if (!open) return null;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
      <div
        style={{ ...popoverStyle, maxHeight, overflowY: 'auto', zIndex: 1000 }}
        className="anchored-popover"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
};

export const HScrollRow = ({ children, count }) => {
  const rowRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);

  const checkScroll = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      setIsMobile(window.innerWidth <= 640);
      checkScroll();
    });
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll, children]);

  const scroll = (dir) => {
    if (rowRef.current) rowRef.current.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  // Always render arrows on desktop so every row lines up the same way; they
  // simply sit disabled when there's nothing to scroll. Previously rows with
  // 4 or fewer cards had no arrows at all, so they didn't match the longer ones.
  const showArrows = !isMobile;

  return (
    <div className="hscroll-wrap">
      {showArrows && (
        <button
          className={`hscroll-arrow hscroll-arrow--left ${!canScrollLeft ? 'hscroll-arrow--disabled' : ''}`}
          onClick={() => scroll(-1)} disabled={!canScrollLeft} aria-label="Scroll left"
        >‹</button>
      )}
      <div className="hscroll-row" ref={rowRef}>
        {children}
      </div>
      {showArrows && (
        <button
          className={`hscroll-arrow hscroll-arrow--right ${!canScrollRight ? 'hscroll-arrow--disabled' : ''}`}
          onClick={() => scroll(1)} disabled={!canScrollRight} aria-label="Scroll right"
        >›</button>
      )}
    </div>
  );
};

export const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

export const SectionPencil = ({ isEditing, onEdit, onSave, onCancel, saving }) => (
  <span className="section-pencil-wrap">
    {isEditing ? (
      <>
        <button className="section-pencil section-pencil--confirm" onClick={onSave} disabled={saving} title={saving ? 'Saving...' : 'Save'}>
          {saving ? '...' : '✔'}
        </button>
        <button className="section-pencil section-pencil--cancel" onClick={onCancel} title="Cancel">✕</button>
      </>
    ) : (
      <button className="section-pencil" onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit">✎</button>
    )}
  </span>
);

export const AutoGrowTextarea = ({ value, onChange, placeholder, className, style, minRows = 2 }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      style={{ resize: 'none', overflow: 'hidden', width: '100%', display: 'block', ...style }}
    />
  );
};

/* --- Date field with an in-app calendar ----------------------------------
   The native <input type="date"> popup is drawn by the OS and cannot be
   styled, so it always looked foreign next to everything else. This renders
   its own calendar from the same tokens as the rest of the app.
   Dates are handled as local "YYYY-MM-DD" keys throughout; toISOString()
   converts to UTC first and can land a day off. */

export const localDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Parsed from parts rather than Date.parse, which reads a bare "YYYY-MM-DD"
// as UTC midnight and so can render the previous day west of Greenwich.
const keyToDate = (key) => {
  const [y, m, d] = String(key || '').split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CAL_W = 252, CAL_H = 314;

export const DateField = ({ value, onChange, max, min, ariaLabel = 'Choose a date', id, dark = false }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => keyToDate(value) || new Date());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const todayKey = localDateKey(new Date());

  // Fixed coordinates off the trigger, because the calendar is portalled out
  // of the modal: .create-modal__body scrolls, and an absolutely positioned
  // popover inside it gets clipped at the modal edge.
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const below = r.bottom + 6;
    const top = (below + CAL_H <= vh - 8 || r.top - CAL_H - 6 < 8)
      ? Math.min(below, Math.max(8, vh - CAL_H - 8))   // below, nudged up if tight
      : r.top - CAL_H - 6;                             // flipped above
    setPos({ top, left: Math.min(Math.max(8, r.left), vw - CAL_W - 8) });
  }, []);

  // Reopening on a different value should land on that value's month.
  useEffect(() => { if (open) setView(keyToDate(value) || new Date()); }, [open, value]);

  useEffect(() => {
    if (!open) return;
    place();
    const calRef = () => document.getElementById('cal-popover');
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !calRef()?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey, true);
    // The trigger moves if the modal behind it scrolls, so follow it.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const label = (() => {
    if (value === todayKey) return 'Today';
    const d = keyToDate(value);
    return d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
             : 'Pick a date';
  })();

  // Six fixed weeks, so the popover never changes height as you page months.
  const cells = (() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  })();

  const blocked = (key) => (max && key > max) || (min && key < min);
  const stepMonth = (n) => setView(v => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const pick = (key) => { if (!blocked(key)) { onChange(key); setOpen(false); } };

  // Paging past the max month only ever shows disabled days.
  const nextBlocked = max && localDateKey(new Date(view.getFullYear(), view.getMonth() + 1, 1)) > max;
  const prevBlocked = min && localDateKey(new Date(view.getFullYear(), view.getMonth(), 0)) < min;

  return (
    <div className="date-field-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button" id={id}
        className={`date-field${open ? ' date-field--open' : ''}${dark ? ' date-field--dark' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog" aria-expanded={open} aria-label={`${ariaLabel}: ${label}`}
      >
        <span className="date-field__icon"><Icon name="calendar" size={15} strokeWidth={2} /></span>
        <span className="date-field__text">{label}</span>
      </button>

      {open && createPortal(
        <div
          id="cal-popover"
          className={`cal${dark ? ' cal--dark' : ''}`}
          role="dialog" aria-label={ariaLabel}
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="cal__hd">
            <button type="button" className="cal__nav" onClick={() => stepMonth(-1)}
              disabled={!!prevBlocked} aria-label="Previous month">‹</button>
            <span className="cal__month">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
            <button type="button" className="cal__nav" onClick={() => stepMonth(1)}
              disabled={!!nextBlocked} aria-label="Next month">›</button>
          </div>

          <div className="cal__grid cal__grid--head" aria-hidden="true">
            {WEEKDAYS.map((w, i) => <span key={i} className="cal__wd">{w}</span>)}
          </div>

          <div className="cal__grid">
            {cells.map(d => {
              const key = localDateKey(d);
              const outside = d.getMonth() !== view.getMonth();
              const cls = ['cal__day'];
              if (outside)          cls.push('cal__day--outside');
              if (key === todayKey) cls.push('cal__day--today');
              if (key === value)    cls.push('cal__day--on');
              return (
                <button
                  key={key} type="button" className={cls.join(' ')}
                  disabled={blocked(key)} onClick={() => pick(key)}
                  aria-current={key === todayKey ? 'date' : undefined}
                >{d.getDate()}</button>
              );
            })}
          </div>

          {!blocked(todayKey) && (
            <button type="button" className="cal__today" onClick={() => pick(todayKey)}>
              Jump to today
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
