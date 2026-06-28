import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

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

  const showArrows = !isMobile && (count ?? React.Children.count(children)) > 4;

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
