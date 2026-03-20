import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- Inline SVG Icons -----------------------------------------------------
const ICONS = {
  // insights + quick actions (existing)
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  flame:       ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z'],
  clock:       ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2'],
  heart:       ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  chefHat:     ['M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z', 'M6 17h12'],
  bookMarked:  ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20', 'M9 2v8l3-1.5L15 10V2'],
  bookOpen:    ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  package:     ['M16.5 9.4 7.55 4.24', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96 12 12.01l8.73-5.05', 'M12 22.08V12'],
  cart:        ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  utensils:    ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7'],
  shuffle:     ['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  arrowRight:  ['M5 12h14', 'M12 5l7 7-7 7'],
  sun:         ['M12 17A5 5 0 1 0 12 7a5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  // nutrition / recipe meta
  zap:         ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  dumbbell:    ['M6 4v16', 'M18 4v16', 'M6 8H2', 'M22 8h-4', 'M6 16H2', 'M22 16h-4', 'M6 4h12', 'M6 20h12'],
  leaf:        ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
  // make soon / timer
  timer:       ['M10 2h4', 'M12 14l4-4', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
  // search
  search:      ['M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z'],
  // filters
  tag:         ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  sliders:     ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  grid:        ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  coffee:      ['M18 8h1a4 4 0 0 1 0 8h-1', 'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z', 'M6 1v3', 'M10 1v3', 'M14 1v3'],
  folder:      ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
  // cooking notes
  lightbulb:   ['M9 18h6', 'M10 22h4', 'M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8a6 6 0 0 0-6-6 6 6 0 0 0-6 6 4.65 4.65 0 0 0 1.5 3.5c.76.76 1.23 1.52 1.41 2.5'],
  ruler:       ['M2 12h20', 'M12 2v20'],
  brain:       ['M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.07-4.73A3 3 0 0 1 4.46 8.1a2.5 2.5 0 0 1 .49-3.56A2.5 2.5 0 0 1 9.5 2z', 'M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.07-4.73 3 3 0 0 0 1.01-5.37 2.5 2.5 0 0 0-.49-3.56A2.5 2.5 0 0 0 14.5 2z'],
  flashlight:  ['M18 6 7 17l-5-5 11-11 5 5z', 'M8 12l-5 5 5-5z'],
  // add recipe sections
  imageIcon:   ['M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2z', 'M8.5 13.5l2.5-3 2 2.5 2.5-3 3 4H6z'],
  list:        ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  note:        ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  mapPin:      ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  // profile sections
  calendar:    ['M3 4h18v18H3z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  repeat:      ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
  settings:    ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M6.34 17.66l-1.41 1.41', 'M19.07 4.93l-1.41 1.41'],
  userCircle:  ['M18.39 14.56C16.71 13.7 14.53 13 12 13s-4.71.7-6.39 1.56A2.97 2.97 0 0 0 4 17v1h16v-1c0-1.16-.62-2.2-1.61-2.44z', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  tool:        ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  barChart:    ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  award:       ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M8.21 13.89 7 23l5-3 5 3-1.21-9.12'],
  person:      ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  users:       ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  // grocery empty
  shoppingBag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  // header flame
  campfire:    ['M12 2c0 0-4 4-4 8a4 4 0 0 0 8 0c0-4-4-8-4-8z', 'M8 20h8', 'M12 14v6'],
  // file / document
  fileText:    ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  // missing icons
  trash2:      ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M10 11v6', 'M14 11v6'],
  user:        ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  globe:       ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  alertTriangle: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  pencil:      ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  check:       ['M20 6 9 17l-5-5'],
  moon:        ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  image:       ['M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2z', 'M8.5 13.5l2.5-3 2 2.5 2.5-3 3 4H6z'],
  share2:      ['M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M8.59 13.51l6.83 3.98', 'M15.41 6.51l-6.82 3.98'],
  plus:        ['M12 5v14', 'M5 12h14'],
  home:        ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
};

const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 2 }) => {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}>
      {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
};

// --- Horizontal Scroll Row -------------------------------------------------
const HScrollRow = ({ children, count }) => {
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
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sensor config: 8px movement threshold prevents tap-to-select being eaten by drag
const DRAG_SENSORS = () => useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
import './App.css';

// --- Error Boundary --------------------------------------------------------
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  componentDidCatch(error, info) { this.setState({ error, info }); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff0f0', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00' }}>💥 Runtime Error</h2>
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

// --- localStorage helpers --------------------------------------------------
const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const COMMON_UNITS = [
  'tsp', 'tbsp', 'cup', 'cups', 'ml', 'l', 'g', 'kg', 'oz', 'lb',
  'pinch', 'handful', 'bunch', 'clove', 'cloves', 'slice', 'slices',
  'piece', 'pieces', 'can', 'jar', 'bag', 'sprig', 'sprigs',
  'rasher', 'fillet', 'fillets', 'sheet', 'sheets',
];

// -- Tag filters -- match against recipe's tags array only (not cuisine column)
const TAG_FILTERS = [
  { key: 'Meals',      label: 'Meals'      },
  { key: 'Desserts',   label: 'Desserts'   },
  { key: 'Drinks',     label: 'Drinks'     },
  { key: 'Pasta',      label: 'Pasta'      },
  { key: 'Soup',       label: 'Soup'       },
  { key: 'Marinade',   label: 'Marinade'   },
  { key: 'Party',      label: 'Party'      },
  { key: 'Breakfast',  label: 'Breakfast'  },
  { key: 'Snack',      label: 'Snack'      },
  { key: 'Salad',      label: 'Salad'      },
  { key: 'Bread',      label: 'Bread'      },
  { key: 'Sauce',      label: 'Sauce'      },
  { key: 'Sides',      label: 'Sides'      },
];

// -- Progress filters -- based on DB columns (recipe_incomplete, status)
const PROGRESS_FILTERS = [
  { key: '__readytocook',   label: 'Ready to Cook',   icon: 'checkCircle' },
  { key: '__almostready',   label: 'Almost Ready',    icon: 'flame'       },
  { key: '__makesoon',      label: 'Make Soon',       icon: 'timer'       },
  { key: '__favorite',      label: 'Favorites',       icon: 'heart'       },
  { key: '__incomplete',    label: 'Incomplete',      icon: 'note'        },
  { key: '__needstweaking', label: 'Needs Tweaking',  icon: 'tool'        },
  { key: '__complete',      label: 'Complete',        icon: 'checkCircle' },
  { key: '__totry',         label: 'To Try',          icon: 'bookMarked'  },
];

const QUICK_CHIP_KEYS = new Set(TAG_FILTERS.map(f => f.key));

const GEO_CUISINES = [
  'Asian', 'Indian', 'Italian', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Thai',
].sort();

const CUISINE_ICON = {
  'Asian': 'utensils', 'Indian': 'flame', 'Italian': 'chefHat', 'Mediterranean': 'leaf',
  'Mexican': 'zap', 'Middle Eastern': 'mapPin', 'Thai': 'coffee',
};

const ALL_CUISINES = [...GEO_CUISINES].sort();

// Shared unit → grams conversion
const UNIT_GRAMS = {
  'g': 1, 'kg': 1000, 'oz': 28.35, 'lb': 453.6,
  'cup': 240, 'cups': 240, 'ml': 1, 'l': 1000,
  'tbsp': 15, 'tsp': 5,
};

// Calculate nutrition totals from a recipe ingredient list.
// allIngredients = full objects from the DB (with .calories/.protein/.fiber per 100g, optional .grams_per_unit)
// Recipe ingredients have .name, .amount, .unit -- we look up nutrition from allIngredients by name match.
const calcNutrition = (ings, allIngredients = []) => {
  let totalCal = 0, totalProt = 0, totalFiber = 0, matched = 0;
  for (const ing of (ings || [])) {
    if (ing._isGroup) continue;
    const name = (ing.name || '').toLowerCase().trim();
    // Find matching ingredient in the DB (exact first, then substring)
    const dbIng = allIngredients.find(a => {
      const n = (typeof a === 'string' ? a : a.name || '').toLowerCase();
      return n === name;
    }) || allIngredients.find(a => {
      const n = (typeof a === 'string' ? a : a.name || '').toLowerCase();
      return name.includes(n) || n.includes(name);
    });
    if (!dbIng || typeof dbIng === 'string') continue;
    if (dbIng.calories == null) continue; // no nutrition data entered yet
    const amount = parseFloat(ing.amount) || 1;
    const unit = (ing.unit || '').toLowerCase().trim();
    let gramsTotal;
    if (UNIT_GRAMS[unit]) {
      // Known weight/volume unit -- straightforward
      gramsTotal = amount * UNIT_GRAMS[unit];
    } else if (dbIng.grams_per_unit) {
      // Unitless (e.g. "3 eggs") or unrecognised unit (e.g. "cloves") -- use grams_per_unit
      gramsTotal = amount * dbIng.grams_per_unit;
    } else {
      // No unit info at all -- skip rather than guess
      continue;
    }
    const factor = gramsTotal / 100;
    totalCal   += (dbIng.calories || 0) * factor;
    totalProt  += (dbIng.protein  || 0) * factor;
    totalFiber += (dbIng.fiber    || 0) * factor;
    matched++;
  }
  return matched > 0 ? { calories: Math.round(totalCal), protein: Math.round(totalProt), fiber: Math.round(totalFiber) } : null;
};

// --- Helpers ---------------------------------------------------------------
const pct = (score) => Math.round(score * 100);
// Auto-pluralize ingredient names -- only for clearly countable nouns
const pluralizeIng = (name, amount) => {
  if (!name) return name;
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 1) return name;
  const lower = name.toLowerCase().trim();

  // Never pluralize: mass nouns, liquids, powders, abstract quantities, and already-plural forms
  const NO_PLURALIZE = [
    // liquids & oils
    'water','milk','cream','oil','olive oil','coconut oil','sesame oil','vegetable oil','broth','stock',
    'juice','wine','beer','vinegar','coconut milk','coconut cream','buttermilk','condensed milk',
    // powders, salts, sugars
    'salt','pepper','sugar','flour','cornstarch','baking powder','baking soda','yeast','cocoa',
    'cumin','turmeric','paprika','cinnamon','nutmeg','cardamom','cayenne','oregano','thyme',
    // sauces & pastes
    'sauce','paste','honey','syrup','miso','tahini','butter','ghee','lard',
    // cheese & dairy
    'cheese','parmesan','cheddar','feta','mozzarella','ricotta','cream cheese','brie','gouda',
    'halloumi','creme fraiche','sour cream','yogurt','greek yogurt',
    // grains & starches
    'rice','pasta','bread','oats','quinoa','couscous','polenta',
    // already plural or invariant
    'beef','pork','lamb','turkey','duck','fish','salmon','tuna','cod','chicken','bacon',
    'spinach','kale','lettuce','basil','parsley','coriander','cilantro','dill','chives',
    'ginger','garlic','zest',
  ];
  if (NO_PLURALIZE.some(w => lower === w || lower.endsWith(' ' + w))) return name;

  // Already ends in s, es, ies -- don't double-pluralize
  if (lower.endsWith('s')) return name;

  // Standard English pluralization for countable nouns
  if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x') || lower.endsWith('z')) return name + 'es';
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(lower)) return name.slice(0, -1) + 'ies';
  if (lower.endsWith('fe')) return name.slice(0, -2) + 'ves';
  if (lower.endsWith('f') && !lower.endsWith('ff')) return name.slice(0, -1) + 'ves';
  return name + 's';
};
const Badge = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
);

// --- Recipe Summary Card ---------------------------------------------------
const toNum = (v) => { const n = Number(v); return (!isNaN(n) && v !== '' && v !== null && v !== undefined) ? n : null; };

const RecipeCard = ({ recipe, match, onClick, isHearted, onToggleHeart, isMakeSoon, onToggleMakeSoon, onMarkCooked, showScore, onConvertRef }) => {
  const { name, coverImage, cuisine, time } = recipe;
  const calories = toNum(recipe.calories);
  const protein  = toNum(recipe.protein);
  const matchScore = match?.matchScore ?? null;
  const canMakeNow = Boolean(match?.canMake);
  const tags = recipe.tags || [];
  const progress = recipe.status === 'incomplete' ? <Icon name="alertTriangle" size={12} strokeWidth={2} /> : recipe.status === 'needs tweaking' ? <Icon name="tool" size={12} strokeWidth={2} /> : recipe.status === 'complete' ? <Icon name="checkCircle" size={12} strokeWidth={2} /> : recipe.status === 'to try' ? <Icon name="bookMarked" size={12} strokeWidth={2} /> : null;
  const isCookbookRef = Boolean(recipe.cookbook && (!recipe.ingredients || recipe.ingredients.length === 0));

  return (
    <article className={`recipe-card ${isCookbookRef ? 'recipe-card--cb-ref' : ''}`} onClick={() => onClick(recipe)}>
      <div className="recipe-card__image">
        {coverImage
          ? <img src={coverImage} alt={name} loading="lazy" />
          : <div className="recipe-card__image-placeholder">No photo</div>}
        {isCookbookRef && (
          <div className="recipe-card__book-corner"><Icon name="bookOpen" size={12} strokeWidth={1.75} color="white" /></div>
        )}
        {showScore && matchScore !== null && (
          <div className={`recipe-card__score ${canMakeNow ? 'recipe-card__score--ready' : ''}`}>
            {pct(matchScore)}%
          </div>
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
          {calories !== null && <span className="recipe-card__stat"><span className="recipe-card__stat-icon"><Icon name="zap" size={12} strokeWidth={2} /></span>{Math.round(calories)} kcal</span>}
          {protein !== null && <span className="recipe-card__stat"><span className="recipe-card__stat-icon"><Icon name="dumbbell" size={12} strokeWidth={2} /></span>{Math.round(protein)}g</span>}
          {canMakeNow && <span className="recipe-card__can-make"><Icon name="checkCircle" size={11} strokeWidth={2} /> Ready</span>}
          {progress && <span className="recipe-card__progress">{progress}</span>}
        </div>
      </div>
    </article>
  );
};

// --- Section Pencil (inline edit trigger / confirm / cancel) ---------------
const SectionPencil = ({ isEditing, onEdit, onSave, onCancel, saving }) => (
  <span className="section-pencil-wrap">
    {isEditing ? (
      <>
        <button className="section-pencil section-pencil--confirm" onClick={onSave} disabled={saving} title={saving ? 'Saving...' : 'Save'}>
          {saving ? '...' : '✓'}
        </button>
        <button className="section-pencil section-pencil--cancel" onClick={onCancel} title="Cancel">✕</button>
      </>
    ) : (
      <button className="section-pencil" onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit">✎</button>
    )}
  </span>
);

// --- Hero Image (no reposition) --------------------------------------------
const HeroImage = ({ src, alt }) => (
  <div className="rp2__hero-img-wrap">
    <img className="rp2__hero-img" src={src} alt={alt} draggable={false} />
  </div>
);

// --- Ingredient Flat Row (sortable) ----------------------------------------
const IngFlatRow = ({ ing, onUpdate, onRemove, allIngredients = [] }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ing._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 10 : undefined };
  return (
    <div className="ing-flat-row" ref={setNodeRef} style={style}>
      <span className="ing-flat-row__drag" {...attributes} {...listeners}>⠿</span>
      {/* Desktop: grid row. Mobile: card layout */}
      <div className="ing-flat-row__fields">
        <div className="ing-flat-row__row1">
          <input className="editor-input ing-flat-row__qty" value={ing.amount} onChange={e => onUpdate('amount', e.target.value)} placeholder="Qty" />
          <div className="ing-flat-row__unit-wrap">
            <UnitAutocomplete value={ing.unit} onChange={v => onUpdate('unit', v)} />
          </div>
          <div className="ing-flat-row__name-wrap">
            <IngredientAutocomplete value={ing.name} onChange={v => onUpdate('name', v)} allIngredients={allIngredients} />
          </div>
        </div>
        <div className="ing-flat-row__row2">
          <input className="editor-input ing-flat-row__prep" value={ing.prep_note || ''} onChange={e => onUpdate('prep_note', e.target.value)} placeholder="Prep note (e.g. finely chopped)" />
          <button
            className={`ing-opt-toggle ${ing.optional ? 'ing-opt-toggle--on' : ''}`}
            onClick={() => onUpdate('optional', !ing.optional)}
            title={ing.optional ? 'Mark as required' : 'Mark as optional'}
            type="button"
          >
            {ing.optional ? 'optional' : 'required'}
          </button>
          <button className="editor-remove-btn" onClick={onRemove} title="Remove">✕</button>
        </div>
      </div>
    </div>
  );
};

// --- Ingredient Group Row (sortable separator) ------------------------------
const IngGroupRow = ({ ing, onLabelChange, onRemove, onAddIngredient }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ing._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };
  return (
    <div className="ing-group-row" ref={setNodeRef} style={style}>
      <span className="ing-flat-row__drag ing-group-row__drag" {...attributes} {...listeners}>⠿</span>
      <input className="ing-group-row__label-input" value={ing.name} onChange={e => onLabelChange(e.target.value)} placeholder="Group name..." />
      <button className="ing-group-row__add-btn" onClick={onAddIngredient} title="Add ingredient to this group">＋</button>
      <button className="editor-remove-btn" onClick={onRemove} title="Remove group">✕</button>
    </div>
  );
};

// --- Mark As Cooked Modal --------------------------------------------------
// PERISHABLE_TYPES: categories where "use up / remove" makes sense after cooking
const PERISHABLE_TYPES = new Set(['produce', 'meat & fish', 'dairy']);

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

  // Perishable ingredients used in this recipe
  const perishableIngs = useMemo(() => {
    if (!bodyIngredients?.length) return [];
    const CATEGORY_MAP = {
      produce: ['onion','garlic','ginger','tomato','lemon','lime','spinach','carrot','celery',
        'potato','bell pepper','cucumber','zucchini','broccoli','cauliflower','mushroom','avocado',
        'lettuce','kale','cabbage','spring onion','scallion','shallot','chilli','chili','jalapeño',
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
    const catOf = (name) => {
      const lower = name.toLowerCase().trim();
      for (const [cat, kws] of Object.entries(CATEGORY_MAP)) {
        if (kws.some(k => lower.includes(k) || k.includes(lower))) return cat;
      }
      return null;
    };
    return bodyIngredients
      .filter(i => !i._isGroup)
      .map(i => ({ ...i, _cat: catOf(i.name) }))
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
  const RATING_LABELS = ['', "Didn't love it", 'It was okay', 'Pretty good!', 'Really good!', 'Perfect! ⭐'];
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
                    onClick={() => setRating(r => r === n ? 0 : n)} type="button">★</button>
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
              {saving ? 'Saving...' : perishableIngs.length > 0 ? 'Next →' : '✓ Save'}
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
                            ✓ Keep
                          </button>
                          <button
                            className={`cooked-cleanup__btn cooked-cleanup__btn--remove ${action === 'remove' ? 'cooked-cleanup__btn--active' : ''}`}
                            onClick={() => setAction(ing.name, 'remove')} type="button">
                            ✕ Used up
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
            <button className="btn btn--primary" onClick={finishCleanup}>✓ Update Kitchen</button>
          </div>
        </>)}

      </div>
    </div>
  );
};

// --- Convert Reference Button (inline on RecipePage for cookbook refs) --------
const ConvertRefButton = ({ recipe, allIngredients, cookbooks, onConverted, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [showModal, setShowModal] = useState(false);
  const sensors = DRAG_SENSORS();
  const [details, setDetails] = useState({
    name: recipe?.name || '', cuisine: recipe?.cuisine || '', time: recipe?.time || '',
    servings: recipe?.servings || '', cover_image_url: recipe?.coverImage || '',
    cookbook: recipe?.cookbook || '', reference: recipe?.reference || '',
    status: recipe?.status || 'to try', tags: recipe?.tags || [],
  });
  const [ings, setIngs] = useState([{ _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const [steps, setSteps] = useState([{ _id: `step-${Date.now()}`, step_number: 1, body_text: '' }]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const toggleTag = (tag) => setDetails(prev => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag] }));
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); }); };
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); }); };
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const save = async () => {
    if (!details.name.trim()) { setSaveError('Recipe name is required.'); return; }
    setSaving(true); setSaveError(null);
    try {
      let grp = '';
      const flatIngs = ings.map(i => { if (i._isGroup) { grp = i.name || ''; return null; } return { ...i, group_label: grp }; }).filter(Boolean);
      const payload = {
        details: { ...details, calories: null, protein: null, fiber: null },
        ingredients: flatIngs.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: (() => {
          const result = []; let stepNum = 1;
          for (const item of steps) {
            if (item._isTimer) {
              const secs = (parseInt(item.h)||0)*3600 + (parseInt(item.m)||0)*60 + (parseInt(item.s)||0);
              if (result.length > 0) result[result.length-1].timer_seconds = secs > 0 ? secs : null;
            } else { result.push({ ...item, step_number: stepNum++, timer_seconds: item.timer_seconds ?? null }); }
          }
          return result;
        })(),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      // Update the existing recipe record
      const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowModal(false);
      if (onConverted) onConverted(data.recipe);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  if (!showModal) return (
    <button className="btn btn--primary rp2__cb-convert-btn" onClick={() => setShowModal(true)}>
      <Icon name="zap" size={14} strokeWidth={2} /> Convert to Full Recipe
    </button>
  );

  return (
    <div className="create-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="create-modal" onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="shuffle" size={18} strokeWidth={2} /> Convert to Full Recipe</h2>
          <button className="ing-modal__close" onClick={() => setShowModal(false)}>✕</button>
        </div>
        <div className="create-modal__body">
          {/* Name */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={details.name} onChange={e => setDetail('name', e.target.value)} autoFocus />
          </div>
          {/* Time + Servings */}
          <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="create-modal__field"><label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label><input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" /></div>
            <div className="create-modal__field"><label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label><input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" /></div>
          </div>
          {/* Cuisine */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {ALL_CUISINES.map(c => <button key={c} className={`chip ${details.cuisine===c?'chip--selected':''}`} onClick={() => setDetail('cuisine', details.cuisine===c?'':c)} type="button">{details.cuisine===c&&<span className="chip__check">✓</span>}{c}</button>)}
            </div>
          </div>
          {/* Tags */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="tag" size={13} strokeWidth={2} /> Tags</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {TAG_FILTERS.map(({ key, label }) => <button key={key} className={`chip ${details.tags.includes(key)?'chip--selected':''}`} onClick={() => toggleTag(key)} type="button">{details.tags.includes(key)&&<span className="chip__check">✓</span>}{label}</button>)}
            </div>
          </div>
          <p className="create-modal__field-hint">Calories, protein &amp; fiber auto-calculated from ingredients</p>
          {/* Ingredients */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Ingredients</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
              <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
                <div className="ing-flat-list">
                  {ings.map(ing => ing._isGroup
                    ? <IngGroupRow key={ing._id} ing={ing} onLabelChange={v => setIngs(prev => prev.map(i => i._id===ing._id?{...i,name:v}:i))} onRemove={() => removeIng(ing._id)} onAddIngredient={() => setIngs(prev => { const idx=prev.findIndex(i=>i._id===ing._id); const n={_id:`ing-new-${Date.now()}`,name:'',amount:'',unit:'',prep_note:'',optional:false,group_label:ing.name}; const nx=[...prev]; nx.splice(idx+1,0,n); return nx; })} />
                    : <IngFlatRow key={ing._id} ing={ing} onUpdate={(k,v) => updateIng(ing._id,k,v)} onRemove={() => removeIng(ing._id)} allIngredients={(allIngredients||[]).filter(Boolean)} />
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <div className="ing-flat-add-row">
              <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id:`ing-new-${Date.now()}`,name:'',amount:'',unit:'',prep_note:'',optional:false,group_label:'' }])}>+ Add Ingredient</button>
              <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id:`grp-${Date.now()}`,_isGroup:true,name:'New Group' }])}>+ Add Group</button>
            </div>
          </div>
          {/* Instructions */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Instructions</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
              <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                {steps.map((item, idx) => {
                  if (item._isTimer) return (
                    <div key={item._id} className="rp2__ed-timer-row">
                      <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                      <div className="rp2__ed-timer-row__inputs">
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setSteps(prev => prev.map(s => s._id===item._id?{...s,h:e.target.value}:s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">h</span>
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setSteps(prev => prev.map(s => s._id===item._id?{...s,m:e.target.value}:s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">m</span>
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setSteps(prev => prev.map(s => s._id===item._id?{...s,s:e.target.value}:s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">s</span>
                      </div>
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                    </div>
                  );
                  const stepNum = steps.slice(0, idx).filter(s => !s._isTimer).length + 1;
                  return (
                    <StepSortableItem key={item._id} id={item._id} stepNum={stepNum}>
                      <textarea className="editor-textarea" value={item.body_text} onChange={e => updateStep(item._id, e.target.value)} placeholder="Describe this step..." rows={2} />
                      <button className="rp2__ed-add-timer-btn" onClick={() => { const i = steps.findIndex(s => s._id===item._id); const t={_id:`timer-${'{'}Date.now(){'}'}`,_isTimer:true,h:'',m:'',s:''}; const n=[...steps]; n.splice(i+1,0,t); setSteps(n); }} title="Add timer"><Icon name="timer" size={13} strokeWidth={2} /></button>
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                    </StepSortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
            <button className="btn btn--ghost editor-add-btn" onClick={() => setSteps(prev => [...prev, { _id:`step-${Date.now()}`,step_number:prev.filter(s=>!s._isTimer).length+1,body_text:'',timer_seconds:null }])}>+ Add Step</button>
          </div>
          {/* Notes */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Notes &amp; Modifications</label>
            {notesList.map(note => (
              <div key={note._id} className="editor-note-row">
                <input className="editor-input" value={note.text||''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
              </div>
            ))}
            <button className="btn btn--ghost editor-add-btn" onClick={() => setNotesList(prev => [...prev, { _id:`note-${Date.now()}`,text:'' }])}>+ Add Note</button>
          </div>
          {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Convert Recipe'}</button>
        </div>
      </div>
    </div>
  );
};

// --- Step Item with integrated timer --------------------------------------
const StepItem = ({ step, done, isCurrent, enlarge, grouped, onToggle, matchedNotes = [] }) => {
  const [activeNote, setActiveNote] = useState(null);
  const hasTimer = step.timer_seconds && step.timer_seconds > 0;
  const [timerState, setTimerState] = useState('idle'); // 'idle' | 'running' | 'paused' | 'done'
  const [remaining, setRemaining] = useState(step.timer_seconds || 0);
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(step.timer_seconds || 0);
    setTimerState('idle');
  }, [step.timer_seconds]);

  const startTimer = (e) => { e.stopPropagation(); if (timerState === 'idle' || timerState === 'paused') setTimerState('running'); };
  const pauseTimer = (e) => { e.stopPropagation(); setTimerState('paused'); };
  const resetTimer = (e) => { e.stopPropagation(); setTimerState('idle'); setRemaining(step.timer_seconds || 0); };

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            setTimerState('done');
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const playBeep = (time, freq) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq; osc.type = 'sine';
                gain.gain.setValueAtTime(0.4, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
                osc.start(time); osc.stop(time + 0.4);
              };
              playBeep(ctx.currentTime, 880); playBeep(ctx.currentTime + 0.45, 1100); playBeep(ctx.currentTime + 0.9, 1320);
            } catch {}
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Timer done!', { body: `Step ${step.step_number}: ${(step.body_text || '').slice(0, 60)}`, icon: '🍳' });
            }
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerState]);

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const pct = hasTimer ? ((step.timer_seconds - remaining) / step.timer_seconds) * 100 : 0;

  return (
    <li className={`rp2__step ${done ? 'rp2__step--done' : ''} ${isCurrent ? 'rp2__step--current' : ''} ${enlarge ? 'rp2__step--enlarged' : ''} ${grouped ? 'rp2__step--grouped' : ''}`} onClick={onToggle}>
      <div className="rp2__step-num">{done ? '✓' : step.step_number}</div>
      <div className="rp2__step-content">
        <div className="rp2__step-body-row">
          <p className="rp2__step-body">{step.body_text}</p>
          {matchedNotes.length > 0 && (
            <div className="rp2__step-hints">
              {matchedNotes.map(n => (
                <div key={n.id} className="rp2__step-hint-wrap">
                  <button
                    className={`rp2__step-hint-btn ${activeNote?.id === n.id ? 'rp2__step-hint-btn--active' : ''}`}
                    onClick={e => { e.stopPropagation(); setActiveNote(prev => prev?.id === n.id ? null : n); }}
                    title={n.title}
                  ><Icon name="lightbulb" size={13} strokeWidth={2} /></button>
                  {activeNote?.id === n.id && (
                    <div className="rp2__step-hint-popover" onClick={e => e.stopPropagation()}>
                      <div className="rp2__step-hint-popover__title">{n.title}</div>
                      <p className="rp2__step-hint-popover__body">{n.body}</p>
                      {n.bullets?.length > 0 && (
                        <ul className="rp2__step-hint-popover__bullets">
                          {n.bullets.map((b, i) => <li key={i}>{b.text}</li>)}
                        </ul>
                      )}
                      {n.image_url && <img src={n.image_url} alt="" className="rp2__step-hint-popover__img" />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {hasTimer && !done && (
          <div className="rp2__step-timer" onClick={e => e.stopPropagation()}>
            {timerState === 'running' && (
              <div className="rp2__step-timer__bar"><div className="rp2__step-timer__fill" style={{ width: `${pct}%` }} /></div>
            )}
            <div className="rp2__step-timer__controls">
              <span className={`rp2__step-timer__display ${timerState === 'done' ? 'rp2__step-timer__display--done' : ''}`}>
                {timerState === 'done' ? '✓ Done!' : fmtTime(remaining)}
              </span>
              {timerState === 'idle' && <button className="rp2__step-timer__btn rp2__step-timer__btn--start" onClick={startTimer}>▶ Start</button>}
              {timerState === 'running' && <button className="rp2__step-timer__btn rp2__step-timer__btn--pause" onClick={pauseTimer}>⏸ Pause</button>}
              {timerState === 'paused' && <button className="rp2__step-timer__btn rp2__step-timer__btn--start" onClick={startTimer}>▶ Resume</button>}
              {timerState !== 'idle' && <button className="rp2__step-timer__btn rp2__step-timer__btn--reset" onClick={resetTimer}>↺</button>}
            </div>
          </div>
        )}
      </div>
    </li>
  );
};

// --- Ingredient Item with "used in steps" collapsible ----------------------
const IngredientItem = ({ ing, isChecked, amountStr, onToggle, instructions = [] }) => {
  const [showUsage, setShowUsage] = useState(false);

  // Find steps that mention this ingredient by name
  const usedInSteps = useMemo(() => {
    if (!ing.name || !instructions?.length) return [];
    const name = ing.name.toLowerCase().trim();
    // Also match common variations: plural, singular
    const words = name.split(/\s+/);
    const root = words[words.length - 1]; // e.g. "garlic cloves" → search "clove" too
    return instructions
      .filter(s => {
        const body = (s.body_text || '').toLowerCase();
        return body.includes(name) || (root.length > 3 && body.includes(root.slice(0, -1)));
      })
      .sort((a, b) => a.step_number - b.step_number);
  }, [ing.name, instructions]);

  const truncate = (text, len = 60) => text.length > len ? text.slice(0, len).trimEnd() + '…' : text;

  return (
    <li className={`rp2__ing-item ${isChecked ? 'rp2__ing-item--checked' : ''}`} onClick={onToggle}>
      <div className={`rp2__ing-check ${isChecked ? 'rp2__ing-check--done' : ''}`}>
        {isChecked && <Icon name="check" size={10} strokeWidth={3} />}
      </div>
      <div className="rp2__ing-text">
        <span className="rp2__ing-line">
          {amountStr && <span className="rp2__ing-amount">{amountStr} </span>}
          <span className="rp2__ing-name">
            {pluralizeIng(ing.name, ing.amount)}
            {ing.prep_note ? <span className="rp2__ing-prep">, {ing.prep_note}</span> : ''}
          </span>
          {ing.optional && <span className="rp2__ing-optional">optional</span>}
        </span>
        {usedInSteps.length > 0 && (
          <div className="rp2__ing-usage" onClick={e => e.stopPropagation()}>
            <button
              className="rp2__ing-usage-toggle"
              onClick={() => setShowUsage(v => !v)}
            >
              <span className={`rp2__ing-usage-toggle__arrow ${showUsage ? 'rp2__ing-usage-toggle__arrow--open' : ''}`}>▾</span>
              used in {usedInSteps.length} step{usedInSteps.length !== 1 ? 's' : ''}
            </button>
            {showUsage && (
              <ul className="rp2__ing-usage-list">
                {usedInSteps.map(s => (
                  <li key={s.step_number} className="rp2__ing-usage-item">
                    <strong>Step {s.step_number}</strong> — {truncate(s.body_text)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

// --- Recipe Page -------------------------------------------------------------
const RecipePage = ({ recipe, bodyIngredients, instructions, notes, onBack, onSaved, onDelete, loading, isHearted, onToggleHeart, isMakeSoon, onToggleMakeSoon, allIngredients = [], cookbooks = [], onMarkCooked, dietaryFilters = [], authFetch, isAdmin, cookingNotes = [] }) => {
  const apiFetch = authFetch || fetch;
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [doneSteps, setDoneSteps] = useState(new Set());
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCookedModal, setShowCookedModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [stayAwake, setStayAwake] = useState(false);
  const wakeLockRef = useRef(null);
  const ingDndSensors = DRAG_SENSORS();

  // -- Wake Lock --
  useEffect(() => {
    if (stayAwake) {
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => { wakeLockRef.current = lock; }).catch(() => {});
      }
    } else {
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    }
    return () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; } };
  }, [stayAwake]);

  // -- Per-section edit state --
  const [editingSection, setEditingSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // -- Draft state --
  const [draftName, setDraftName] = useState('');
  const [draftImageInput, setDraftImageInput] = useState('');
  const [draftIngs, setDraftIngs] = useState([]);
  const [draftSteps, setDraftSteps] = useState([]);
  const rpSensors = DRAG_SENSORS();
  const [draftNotes, setDraftNotes] = useState([]);
  const [draftMeta, setDraftMeta] = useState({});
  const [draftCookbook, setDraftCookbook] = useState({ cookbook: '', reference: '' });

  const isEdit = (s) => editingSection === s;

  const startEdit = (section) => {
    if (!isAdmin) return;
    setSaveError(null);
    if (section === 'title')        setDraftName(recipe.name || '');
    if (section === 'image')        setDraftImageInput(recipe.coverImage || '');
    if (section === 'ingredients') {
      // Build flat list: group separator rows interspersed with ingredient rows
      const ings = bodyIngredients || [];
      const flat = [];
      const seenGroups = new Set();
      for (let i = 0; i < ings.length; i++) {
        const ing = ings[i];
        const g = ing.group_label || '';
        if (g && !seenGroups.has(g)) {
          seenGroups.add(g);
          flat.push({ _id: `grp-exist-${g}-${i}`, _isGroup: true, name: g });
        }
        flat.push({ ...ing, _id: `ing-${i}` });
      }
      setDraftIngs(flat);
    }
    if (section === 'instructions') {
      // Build flat list: group headers interleaved with steps that carry their own group_label.
      // Steps belonging to a group are placed immediately after the group header row.
      const sorted = [...(instructions || [])].sort((a, b) => a.step_number - b.step_number);
      const flat = [];
      const seenGroups = new Set();
      // First pass: add all group headers
      for (const s of sorted) {
        const g = s.group_label || '';
        if (g && !seenGroups.has(g)) {
          seenGroups.add(g);
          // Will be inserted before the first step of this group below
        }
      }
      // Second pass: interleave headers and steps in sorted order, grouped steps follow their header
      const ungrouped = sorted.filter(s => !s.group_label);
      const grouped = sorted.filter(s => s.group_label);
      // Collect unique group labels in the order they first appear
      const groupOrder = [];
      for (const s of sorted) {
        if (s.group_label && !groupOrder.includes(s.group_label)) groupOrder.push(s.group_label);
      }
      // Build interleaved list: ungrouped steps and group sections in step_number order
      // Strategy: walk sorted steps; emit group header before first step of each group
      const emittedGroups = new Set();
      for (const s of sorted) {
        const g = s.group_label || '';
        if (g && !emittedGroups.has(g)) {
          emittedGroups.add(g);
          flat.push({ _id: `step-grp-exist-${g}`, _isGroup: true, name: g });
        }
        flat.push({ ...s, _id: `step-${s.step_number}`, timer_seconds: s.timer_seconds ?? null, group_label: g || null });
        if (s.timer_seconds && s.timer_seconds > 0) {
          const h = Math.floor(s.timer_seconds / 3600);
          const m = Math.floor((s.timer_seconds % 3600) / 60);
          const sec = s.timer_seconds % 60;
          flat.push({ _id: `timer-exist-${s.step_number}`, _isTimer: true, h: h || '', m: m || '', s: sec || '' });
        }
      }
      setDraftSteps(flat);
    }
    if (section === 'notes')        setDraftNotes((notes || []).map((n, idx) => ({ ...n, _id: `note-${idx}`, text: n.text ?? n.body_text ?? '' })));
    if (section === 'cookbook')      setDraftCookbook({ cookbook: recipe.cookbook || '', reference: recipe.reference || '' });
    if (['meta','meta-cuisine','meta-tags','meta-progress','meta-time','meta-servings'].includes(section)) setDraftMeta({
      time: recipe.time || '',
      servings: recipe.servings || '',
      cuisine: recipe.cuisine || '',
      tags: recipe.tags || [],
      status: recipe.status || '',
    });
    setEditingSection(section);
  };

  const cancelEdit = () => { setEditingSection(null); setSaveError(null); };

  const saveSection = async (section) => {
    setSaving(true); setSaveError(null);
    const isMeta = section === 'meta' || section.startsWith('meta-');

    // When saving ingredients, compute fresh nutrition from the new ingredient list
    let computedNutrition = { calories: recipe.calories ?? '', protein: recipe.protein ?? '', fiber: recipe.fiber ?? '' };
    if (section === 'ingredients') {
      const ingsToCalc = draftIngs
        .map(i => { if (i._isGroup) return null; return i; })
        .filter(Boolean);
      const nutrition = calcNutrition(ingsToCalc, allIngredients);
      if (nutrition) computedNutrition = nutrition;
    }

    try {
      const payload = {
        details: {
          name:            section === 'title' ? draftName : recipe.name,
          cuisine:         isMeta ? draftMeta.cuisine : (recipe.cuisine || ''),
          time:            isMeta ? draftMeta.time    : (recipe.time || ''),
          servings:        isMeta ? draftMeta.servings : (recipe.servings || ''),
          calories:        computedNutrition.calories,
          protein:         computedNutrition.protein,
          fiber:           computedNutrition.fiber,
          cover_image_url: section === 'image' ? draftImageInput : (recipe.coverImage || ''),
          status:          isMeta ? draftMeta.status : (recipe.status || ''),
          tags:            isMeta ? draftMeta.tags   : (recipe.tags || []),
          cookbook:        section === 'cookbook' ? draftCookbook.cookbook : (recipe.cookbook || ''),
          page_number:     section === 'cookbook' ? draftCookbook.reference : (recipe.reference || ''),
        },
        ingredients:  section === 'ingredients'  ? (() => {
          let grp = '';
          return draftIngs
            .map(i => { if (i._isGroup) { grp = i.name || ''; return null; } return { ...i, group_label: grp }; })
            .filter(Boolean)
            .map((i, idx) => ({ ...i, order_index: idx }));
        })() : (bodyIngredients || []),
        instructions: section === 'instructions' ? (() => {
          const result = [];
          let stepNum = 1;
          for (const item of draftSteps) {
            if (item._isGroup) continue; // headers are metadata only
            if (item._isTimer) {
              const h = parseInt(item.h) || 0;
              const m = parseInt(item.m) || 0;
              const s = parseInt(item.s) || 0;
              const secs = h * 3600 + m * 60 + s;
              if (result.length > 0) result[result.length - 1].timer_seconds = secs > 0 ? secs : null;
            } else {
              result.push({
                ...item,
                step_number: stepNum++,
                timer_seconds: item.timer_seconds ?? null,
                group_label: item.group_label || null,
              });
            }
          }
          return result;
        })() : (instructions || []),
        notes:        section === 'notes'        ? draftNotes.map((n, idx) => ({ ...n, order_index: idx }))  : (notes || []),
      };
      const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setEditingSection(null);
      if (onSaved) onSaved(data.recipe);
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  // -- Meta draft helpers --
  const toggleDraftTag = (tag) => setDraftMeta(prev => ({
    ...prev,
    tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  // -- Ingredient draft helpers --
  const addDraftIng  = () => setDraftIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateDraftIng = (id, k, v) => setDraftIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeDraftIng = (id) => setDraftIngs(prev => prev.filter(i => i._id !== id));

  const addDraftStep = () => setDraftSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null, group_label: null }]);
  const onDraftStepDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setDraftSteps(prev => {
      const oldIdx = prev.findIndex(s => s._id === active.id);
      const newIdx = prev.findIndex(s => s._id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;

      const moved = arrayMove(prev, oldIdx, newIdx);

      // After the move, determine the new group_label for the dragged item.
      // Only regular steps get a group_label; group headers and timers don't.
      const draggedItem = moved[newIdx];
      if (draggedItem._isGroup || draggedItem._isTimer) return moved;

      // Walk backwards from newIdx to find the nearest group header.
      // If a regular ungrouped step sits between the dragged item and any group header,
      // the dragged item is ungrouped.
      let newGroupLabel = null;
      for (let j = newIdx - 1; j >= 0; j--) {
        const item = moved[j];
        if (item._isTimer) continue; // skip timers
        if (item._isGroup) {
          newGroupLabel = item.name || null;
          break;
        }
        // Hit a regular step — check if IT is grouped under a header
        if (item.group_label) {
          // The step above is grouped — the dragged step is also in that group
          newGroupLabel = item.group_label;
        }
        break;
      }

      // Apply new group_label to the dragged step
      return moved.map((s, i) =>
        i === newIdx && !s._isGroup && !s._isTimer
          ? { ...s, group_label: newGroupLabel }
          : s
      );
    });
  };
  const addTimerAfterStep = (afterId) => setDraftSteps(prev => {
    const idx = prev.findIndex(s => s._id === afterId);
    const timer = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' };
    const next = [...prev];
    next.splice(idx + 1, 0, timer);
    return next;
  });
  const updateDraftStep = (id, v) => setDraftSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeDraftStep = (id) => setDraftSteps(prev => prev.filter(s => s._id !== id));

  // -- Note draft helpers --
  const addDraftNote    = () => setDraftNotes(prev => [...prev, { _id: `note-new-${Date.now()}`, text: '' }]);
  const updateDraftNote = (id, v) => setDraftNotes(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeDraftNote = (id) => setDraftNotes(prev => prev.filter(n => n._id !== id));

  const ingredientGroups = useMemo(() => {
    if (!bodyIngredients?.length) return [];
    const groups = [];
    const seen = new Map();
    for (const ing of bodyIngredients) {
      const label = ing.group_label || '';
      if (!seen.has(label)) { seen.set(label, []); groups.push({ label, items: seen.get(label) }); }
      seen.get(label).push(ing);
    }
    return groups;
  }, [bodyIngredients]);

  const toggleIngredient = (key) => setCheckedIngredients(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const toggleStep = (num) => setDoneSteps(prev => {
    const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next;
  });

  // -- Auto-calculate nutrition -- must be before any early returns (Rules of Hooks) --
  const autoNutrition = useMemo(() => {
    if (!bodyIngredients?.length) return { calories: null, protein: null, fiber: null };
    const r = calcNutrition(bodyIngredients, allIngredients);
    return r ?? { calories: null, protein: null, fiber: null };
  }, [bodyIngredients, allIngredients]);

  if (loading) return <main className="view"><div className="placeholder"><h2>Loading recipe...</h2></div></main>;
  if (!recipe) return <main className="view"><div className="placeholder"><h2>Recipe not found</h2><button className="btn btn--ghost" onClick={onBack}>← Back</button></div></main>;

  const calories = toNum(recipe.calories);
  const protein  = toNum(recipe.protein);
  const fiber    = toNum(recipe.fiber);

  const displayCalories = calories ?? autoNutrition.calories;
  const displayProtein  = protein  ?? autoNutrition.protein;
  const displayFiber    = fiber    ?? autoNutrition.fiber;
  // Show ~ if we're showing a live estimate (not yet saved to DB)
  const nutritionIsEstimate = calories === null && autoNutrition.calories !== null;
  const doneCount  = doneSteps.size;
  const totalSteps = instructions?.length ?? 0;

  // Dietary conflict warnings
  const dietaryWarnings = checkDietaryConflicts(bodyIngredients || [], dietaryFilters);

  return (
    <main className="view rp2">
      {saveError && <p className="editor-error" style={{ margin: '8px 20px 0' }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}

      {/* -- Delete Confirmation Modal -- */}
      {showDeleteConfirm && (
        <div className="create-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon"><Icon name="trash2" size={32} color="var(--terracotta)" strokeWidth={1.5} /></div>
            <h2 className="delete-confirm-modal__title">Delete "{recipe?.name}"?</h2>
            <p className="delete-confirm-modal__body">
              This will permanently delete the recipe along with all its ingredients, instructions, and notes.
              <strong> This cannot be undone.</strong>
            </p>
            {deleteError && <p className="editor-error" style={{ marginTop: 8 }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {deleteError}</p>}
            <div className="delete-confirm-modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn--danger" onClick={async () => {
                setDeleting(true); setDeleteError(null);
                try {
                  const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, { method: 'DELETE' });
                  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete(recipe.id);
                } catch (e) { setDeleteError(e.message); setDeleting(false); }
              }} disabled={deleting}>
                {deleting ? 'Deleting...' : <><Icon name="trash2" size={14} strokeWidth={2} /> Delete forever</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCookedModal && recipe && (
        <MarkCookedModal
          recipe={recipe}
          bodyIngredients={bodyIngredients}
          authFetch={apiFetch}
          onSave={({ toRemove }) => {
            setShowCookedModal(false);
            if (onMarkCooked) onMarkCooked(recipe.id, toRemove);
          }}
          onClose={() => setShowCookedModal(false)}
        />
      )}
      <div className="rp2__hero">
        {recipe.coverImage
          ? <HeroImage src={recipe.coverImage} alt={recipe.name} />
          : <div className="rp2__hero-placeholder"><Icon name="image" size={40} color="var(--ash)" strokeWidth={1.5} /></div>}

        <div className="rp2__hero-overlay">
          {/* == DESKTOP: original top-bar layout == */}
          <div className="rp2__hero-desktop-layout">
            <div className="rp2__hero-topbar">
              <button className="rp2__hero-btn" onClick={e => { e.stopPropagation(); onBack(); }}>← Back</button>
              <div className="rp2__hero-topbar-right">
                {isMakeSoon && onMarkCooked && (
                  <button className="rp2__hero-btn rp2__hero-cooked-btn"
                    onClick={e => { e.stopPropagation(); setShowCookedModal(true); }} title="Mark as Cooked"
                  ><Icon name="chefHat" size={15} strokeWidth={2} /> Cooked</button>
                )}
                {onToggleHeart && (
                  <button className={`rp2__hero-btn rp2__hero-heart ${isHearted ? 'rp2__hero-heart--on' : ''}`}
                    onClick={e => { e.stopPropagation(); onToggleHeart(); }}
                    title={isHearted ? 'Remove from favorites' : 'Save to favorites'}
                  ><Icon name="heart" size={14} strokeWidth={2} /></button>
                )}
                <button className={`rp2__hero-btn rp2__hero-soon ${isMakeSoon ? 'rp2__hero-soon--on' : ''}`}
                  onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
                  title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
                ><Icon name="timer" size={16} strokeWidth={2} /></button>
                {isAdmin && <div className="rp2__photo-btn-wrap">
                  <button className="rp2__hero-btn rp2__hero-soon rp2__hero-btn--photo"
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }} title="Change photo link">✎
                  </button>
                  {isEdit('image') && (
                    <div className="rp2__img-popover-down">
                      <p className="rp2__dark-pop-label">Cover image URL</p>
                      <input className="editor-input" autoFocus value={draftImageInput}
                        onChange={e => setDraftImageInput(e.target.value)} placeholder="https://..."
                        onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }} />
                      <div className="rp2__dark-pop-actions">
                        <button className="rp2__dark-save" onClick={() => saveSection('image')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                        <button className="rp2__dark-cancel" onClick={cancelEdit}>✕ Cancel</button>
                      </div>
                    </div>
                  )}
                </div>}
              </div>
            </div>
          </div>

          {/* == MOBILE: four-corner layout == */}
          {/* Top-left: Back */}
          <div className="rp2__hero-corner rp2__hero-corner--tl rp2__hero-mobile-only">
            <button className="rp2__hero-btn" onClick={e => { e.stopPropagation(); onBack(); }}>← Back</button>
          </div>
          {/* Top-right: Photo edit (admin) */}
          <div className="rp2__hero-corner rp2__hero-corner--tr rp2__hero-mobile-only">
            {isAdmin && <div className="rp2__photo-btn-wrap">
              <button className="rp2__hero-btn rp2__hero-soon rp2__hero-btn--photo"
                onClick={e => { e.stopPropagation(); startEdit(isEdit('image') ? null : 'image'); }} title="Change photo link">✎
              </button>
              {isEdit('image') && (
                <div className="rp2__img-popover-down">
                  <p className="rp2__dark-pop-label">Cover image URL</p>
                  <input className="editor-input" autoFocus value={draftImageInput}
                    onChange={e => setDraftImageInput(e.target.value)} placeholder="https://..."
                    onKeyDown={e => { if (e.key === 'Enter') saveSection('image'); if (e.key === 'Escape') cancelEdit(); }} />
                  <div className="rp2__dark-pop-actions">
                    <button className="rp2__dark-save" onClick={() => saveSection('image')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                    <button className="rp2__dark-cancel" onClick={cancelEdit}>✕ Cancel</button>
                  </div>
                </div>
              )}
            </div>}
          </div>
          {/* Bottom-left: Heart + Timer */}
          <div className="rp2__hero-corner rp2__hero-corner--bl rp2__hero-mobile-only">
            {onToggleHeart && (
              <button className={`rp2__hero-btn rp2__hero-heart ${isHearted ? 'rp2__hero-heart--on' : ''}`}
                onClick={e => { e.stopPropagation(); onToggleHeart(); }}
                title={isHearted ? 'Remove from favorites' : 'Save to favorites'}
              ><Icon name="heart" size={14} strokeWidth={2} /></button>
            )}
            <button className={`rp2__hero-btn rp2__hero-soon rp2__hero-soon--dark ${isMakeSoon ? 'rp2__hero-soon--on' : ''}`}
              onClick={e => { e.stopPropagation(); onToggleMakeSoon && onToggleMakeSoon(); }}
              title={isMakeSoon ? 'Remove from Make Soon' : 'Add to Make Soon'}
            ><Icon name="timer" size={16} strokeWidth={2} /></button>
          </div>
          {/* Bottom-right: Cooked */}
          <div className="rp2__hero-corner rp2__hero-corner--br rp2__hero-mobile-only">
            {isMakeSoon && onMarkCooked && (
              <button className="rp2__hero-btn rp2__hero-cooked-btn"
                onClick={e => { e.stopPropagation(); setShowCookedModal(true); }} title="Mark as Cooked"
              ><Icon name="chefHat" size={15} strokeWidth={2} /> Cooked</button>
            )}
          </div>

          {/* -- Desktop-only tags+pills row at bottom -- */}
          <div className="rp2__hero-bottom rp2__hero-bottom--desktop-only">

            {/* Tags area -- only show fields that have values; add button for adding more */}
            <div className="rp2__hero-tags">

              {/* Cuisine chip -- only shown when set */}
              {recipe.cuisine && (
                <div className="rp2__hero-tag-wrap">
                  <button className={`rp2__tag rp2__tag--clickable ${isEdit('meta-cuisine') ? 'rp2__tag--editing' : ''}`}
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-cuisine') ? null : 'meta-cuisine'); }}>
                    {recipe.cuisine}
                  </button>
                  {isEdit('meta-cuisine') && (
                    <div className="rp2__hero-dark-popover">
                      <p className="rp2__dark-pop-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</p>
                      <div className="rp2__dark-pop-chips">
                        <button className={`rp2__dark-chip ${draftMeta.cuisine === '' ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => setDraftMeta(p => ({...p, cuisine: ''}))}>None</button>
                        {GEO_CUISINES.map(c => (
                          <button key={c} className={`rp2__dark-chip ${draftMeta.cuisine === c ? 'rp2__dark-chip--on' : ''}`}
                            onClick={() => setDraftMeta(p => ({...p, cuisine: c}))}>{c}</button>
                        ))}
                      </div>
                      <div className="rp2__dark-pop-actions">
                        <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                        <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Individual tag chips -- one per tag, each clickable to edit */}
              {(recipe.tags || []).map(tag => {
                const tagDef = TAG_FILTERS.find(f => f.key === tag);
                return (
                  <div key={tag} className="rp2__hero-tag-wrap">
                    <button className={`rp2__tag rp2__tag--light rp2__tag--clickable ${isEdit('meta-tags') ? 'rp2__tag--editing' : ''}`}
                      onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-tags') ? null : 'meta-tags'); }}>
                      {tagDef ? tagDef.label : tag}
                    </button>
                  </div>
                );
              })}

              {/* Tags popover -- rendered once, attached to last chip or add button */}
              {isEdit('meta-tags') && (
                <div className="rp2__hero-tag-wrap">
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--wide">
                    <p className="rp2__dark-pop-label"><Icon name="tag" size={13} strokeWidth={2} /> Tags</p>
                    <div className="rp2__dark-pop-chips">
                      {TAG_FILTERS.map(({ key, label }) => (
                        <button key={key} className={`rp2__dark-chip ${(draftMeta.tags || []).includes(key) ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => toggleDraftTag(key)}>{label}</button>
                      ))}
                    </div>
                    <p className="rp2__dark-pop-label" style={{marginTop:10}}><Icon name="list" size={13} strokeWidth={2} /> Progress</p>
                    <div className="rp2__dark-pop-chips">
                      {[{key:'',label:'-- None'},{key:'complete',label:'Complete'},{key:'needs tweaking',label:'Needs Tweaking'},{key:'to try',label:'To Try'},{key:'incomplete',label:'Incomplete'}].map(({key,label}) => (
                        <button key={key} className={`rp2__dark-chip ${draftMeta.status === key ? 'rp2__dark-chip--on' : ''}`}
                          onClick={() => setDraftMeta(p => ({...p, status: key}))}>{label}</button>
                      ))}
                    </div>
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress chip -- only shown when set */}
              {(recipe.status && recipe.status !== '') && (
                <div className="rp2__hero-tag-wrap">
                  <button className={`rp2__tag rp2__tag--clickable ${recipe.status === 'incomplete' ? 'rp2__tag--warning' : recipe.status === 'needs tweaking' ? 'rp2__tag--warning' : recipe.status === 'complete' ? 'rp2__tag--success' : 'rp2__tag--light'} ${isEdit('meta-progress') ? 'rp2__tag--editing' : ''}`}
                    onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-progress') ? null : 'meta-progress'); }}>
                    {recipe.status === 'incomplete' ? 'Incomplete' : recipe.status === 'needs tweaking' ? 'Tweaking' : recipe.status === 'complete' ? 'Complete' : recipe.status === 'to try' ? 'To Try' : null}
                  </button>
                  {isEdit('meta-progress') && (
                    <div className="rp2__hero-dark-popover">
                      <p className="rp2__dark-pop-label"><Icon name="list" size={13} strokeWidth={2} /> Progress</p>
                      <div className="rp2__dark-pop-chips">
                        {[{key:'',label:'-- None'},{key:'complete',label:'Complete'},{key:'needs tweaking',label:'Needs Tweaking'},{key:'to try',label:'To Try'},{key:'incomplete',label:'Incomplete'}].map(({key,label}) => (
                          <button key={key} className={`rp2__dark-chip ${draftMeta.status === key ? 'rp2__dark-chip--on' : ''}`}
                            onClick={() => setDraftMeta(p => ({...p, status: key}))}>{label}</button>
                        ))}
                      </div>
                      <div className="rp2__dark-pop-actions">
                        <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                        <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* + Add tag button -- admin only */}
              {isAdmin && !isEdit('meta-tags') && (
                <div className="rp2__hero-tag-wrap">
                  <button className="rp2__tag rp2__tag--add"
                    onClick={e => { e.stopPropagation(); startEdit('meta-tags'); }}
                    title="Add tags">
                    + tag
                  </button>
                </div>
              )}
            </div>

            {/* Pills -- time and servings are clickable, nutrition is display-only */}
            <div className="rp2__hero-pills">

              {/* Time pill -- hide if empty for guests */}
              {(isAdmin || recipe.time) && <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-time') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-time') ? null : 'meta-time'); }}>
                  <span className="rp2__pill-icon"><Icon name="clock" size={13} strokeWidth={2} /></span>
                  {recipe.time || <span style={{opacity:0.6}}>+ Time</span>}
                </button>
                {isEdit('meta-time') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label"><Icon name="clock" size={13} strokeWidth={2} /> Cook Time</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.time}
                      onChange={e => setDraftMeta(p => ({...p, time: e.target.value}))}
                      placeholder="e.g. 45 mins"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>}

              {/* Servings pill -- hide if empty for guests */}
              {(isAdmin || recipe.servings) && <div className="rp2__hero-tag-wrap rp2__hero-tag-wrap--right">
                <button className={`rp2__pill rp2__pill--clickable ${isEdit('meta-servings') ? 'rp2__pill--editing' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(isEdit('meta-servings') ? null : 'meta-servings'); }}>
                  <span className="rp2__pill-icon"><Icon name="utensils" size={13} strokeWidth={2} /></span>
                  {recipe.servings ? `${recipe.servings} srv` : <span style={{opacity:0.6}}>+ Servings</span>}
                </button>
                {isEdit('meta-servings') && (
                  <div className="rp2__hero-dark-popover rp2__hero-dark-popover--right">
                    <p className="rp2__dark-pop-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</p>
                    <input className="rp2__dark-input" autoFocus value={draftMeta.servings}
                      onChange={e => setDraftMeta(p => ({...p, servings: e.target.value}))}
                      placeholder="e.g. 4"
                      onKeyDown={e => { if (e.key === 'Enter') saveSection('meta'); if (e.key === 'Escape') cancelEdit(); }} />
                    <div className="rp2__dark-pop-actions">
                      <button className="rp2__dark-save" onClick={() => saveSection('meta')} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="rp2__dark-cancel" onClick={cancelEdit}>✕</button>
                    </div>
                  </div>
                )}
              </div>}

              {/* Display-only nutrition pills */}
              {displayCalories !== null && <span className="rp2__pill" title={nutritionIsEstimate ? 'Estimated -- save ingredients to lock in' : 'Auto-calculated from ingredients'}><span className="rp2__pill-icon"><Icon name="zap" size={13} strokeWidth={2} /></span>{displayCalories} kcal{nutritionIsEstimate ? ' ~' : ''}</span>}
              {displayProtein  !== null && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="dumbbell" size={13} strokeWidth={2} /></span>{displayProtein}g prot{nutritionIsEstimate ? ' ~' : ''}</span>}
              {displayFiber    !== null && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="leaf" size={13} strokeWidth={2} /></span>{displayFiber}g fiber{nutritionIsEstimate ? ' ~' : ''}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* -- Title -- */}
      <div className="rp2__header">
        <div className="rp2__title-row">
          {isEdit('title') ? (
            <input
              className="rp2__title-input"
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveSection('title'); if (e.key === 'Escape') cancelEdit(); }}
            />
          ) : (
            <h1 className="rp2__title">{recipe.name}</h1>
          )}
          {isAdmin && <SectionPencil isEditing={isEdit('title')} onEdit={() => startEdit('title')} onSave={() => saveSection('title')} onCancel={cancelEdit} saving={saving} />}
          <div className="rp2__title-row-actions">
            <button
              className={`rp2__cooking-mode-btn ${stayAwake ? 'rp2__cooking-mode-btn--on' : ''}`}
              onClick={() => setStayAwake(s => !s)}
              title={stayAwake ? 'Screen will stay on -- click to disable' : 'Keep screen awake while cooking'}
            >
              {stayAwake ? <><Icon name="sun" size={14} strokeWidth={2} /> Awake</> : <Icon name="sun" size={14} strokeWidth={2} />}
            </button>
            {isAdmin && <button className="rp2__delete-btn" onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }} title="Delete recipe"><Icon name="trash2" size={15} strokeWidth={2} color="var(--warm-gray)" /></button>}
          </div>
        </div>

        {/* -- Dietary Conflict Warnings -- */}
        {dietaryWarnings.length > 0 && (
          <div className="dietary-warnings">
            {dietaryWarnings.map((w, i) => (
              <div key={i} className="dietary-warning">
                <span className="dietary-warning__icon">⚠️</span>
                <div className="dietary-warning__body">
                  <span className="dietary-warning__title">Contains {w.label}</span>
                  {w.conflicts.length > 1 ? (
                    <ul className="dietary-warning__list">
                      {w.conflicts.map((c, j) => <li key={j}>{c}</li>)}
                    </ul>
                  ) : (
                    <span className="dietary-warning__detail"> -- {w.conflicts[0]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Cookbook Reference Card -- shown INSTEAD of the two-column body for refs -- */}
      {recipe.cookbook && (!bodyIngredients?.length) && (!instructions?.length) && (
        <div className="rp2__body">
          <div className="rp2__cb-ref-view">
            <div className="rp2__cb-ref-card">
              <div className="rp2__cb-ref-card__icon"><Icon name="bookOpen" size={28} color="var(--terracotta)" strokeWidth={1.5} /></div>
              <div className="rp2__cb-ref-card__content">
                <p className="rp2__cb-ref-card__label">Find this recipe in</p>
                <h3 className="rp2__cb-ref-card__book">{recipe.cookbook}</h3>
                {recipe.reference && (
                  <p className="rp2__cb-ref-card__page">Page {recipe.reference}</p>
                )}
              </div>
            </div>
            <div className="rp2__cb-ref-convert">
              <p className="rp2__cb-ref-convert__hint">Ready to save the full recipe?</p>
              <ConvertRefButton recipe={recipe} allIngredients={allIngredients} cookbooks={cookbooks} onConverted={onSaved} authFetch={apiFetch} />
            </div>
          </div>
        </div>
      )}

      {/* -- Two-column body (only shown for full recipes) -- */}
      {!(recipe.cookbook && (!bodyIngredients?.length) && (!instructions?.length)) && (
      <div className="rp2__body">
        {showIngredientsModal && (
          <div className="ing-modal-overlay" onClick={() => { setShowIngredientsModal(false); cancelEdit(); }}>
            <div className="ing-modal ing-modal--wide" onClick={e => e.stopPropagation()}>
              <div className="ing-modal__header">
                <h2 className="ing-modal__title">Edit Ingredients</h2>
                <div className="ing-modal__header-actions">
                  {isEdit('ingredients') ? (
                    <>
                      <button className="ing-modal__save-btn" onClick={async () => { await saveSection('ingredients'); setShowIngredientsModal(false); }} disabled={saving}>{saving ? '...' : '✓ Save'}</button>
                      <button className="ing-modal__close" onClick={() => { setShowIngredientsModal(false); cancelEdit(); }}>✕</button>
                    </>
                  ) : (
                    <button className="ing-modal__close" onClick={() => setShowIngredientsModal(false)}>✕</button>
                  )}
                </div>
              </div>
              <div className="ing-modal__body">
                <DndContext
                  sensors={ingDndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    setDraftIngs(prev => arrayMove(prev, prev.findIndex(i => i._id === active.id), prev.findIndex(i => i._id === over.id)));
                  }}
                >
                  <SortableContext items={draftIngs.map(i => i._id)} strategy={verticalListSortingStrategy}>
                    <div className="ing-flat-list">
                      {/* Column headers -- desktop only */}
                      <div className="ing-flat-header ing-flat-header--desktop">
                        <span className="ing-flat-header__drag" />
                        <div className="ing-flat-header__cols">
                          <span className="ing-flat-header__qty-col">Qty</span>
                          <span className="ing-flat-header__unit-col">Unit</span>
                          <span className="ing-flat-header__name-col">Ingredient</span>
                          <span className="ing-flat-header__prep-col">Prep note</span>
                          <span className="ing-flat-header__opt-col">Optional</span>
                        </div>
                        <span className="ing-flat-header__rm" />
                      </div>
                      {draftIngs.map((ing) => {
                        if (ing._isGroup) {
                          // Group separator row
                          return (
                            <IngGroupRow key={ing._id} ing={ing}
                              onLabelChange={v => setDraftIngs(prev => prev.map(i => i._id === ing._id ? {...i, name: v} : i))}
                              onRemove={() => setDraftIngs(prev => prev.filter(i => i._id !== ing._id))}
                              onAddIngredient={() => setDraftIngs(prev => {
                                const groupName = ing.name;
                                // Find the last ingredient that belongs to this group
                                let insertIdx = prev.findIndex(i => i._id === ing._id);
                                for (let j = insertIdx + 1; j < prev.length; j++) {
                                  if (prev[j]._isGroup) break; // hit next group
                                  insertIdx = j; // last ingredient in this group
                                }
                                const newIng = { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: groupName };
                                const next = [...prev];
                                next.splice(insertIdx + 1, 0, newIng);
                                return next;
                              })}
                            />
                          );
                        }
                        return (
                          <IngFlatRow key={ing._id} ing={ing}
                            onUpdate={(k, v) => updateDraftIng(ing._id, k, v)}
                            onRemove={() => removeDraftIng(ing._id)}
                            allIngredients={allIngredients}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="ing-flat-add-row">
                  <button className="btn btn--ghost editor-add-btn" onClick={() => setDraftIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }])}>+ Add Ingredient</button>
                  <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setDraftIngs(prev => [...prev, { _id: `grp-${Date.now()}`, _isGroup: true, name: 'New Group' }])}>+ Add Group</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -- Ingredients -- */}
        <div className="rp2__ingredients">
          <div className="rp2__section-title-row">
            <h2 className="rp2__section-title rp2__section-title--sm">Ingredients</h2>
            {isAdmin && <button className="section-pencil" onClick={() => { startEdit('ingredients'); setShowIngredientsModal(true); }} title="Edit ingredients">✎</button>}
          </div>

          {ingredientGroups.length > 0
            ? ingredientGroups.map(({ label, items }) => (
                <div key={label || '__default'} className="rp2__ing-group">
                  {label && <p className="rp2__ing-group-label">{label}</p>}
                  <ul className="rp2__ing-list">
                    {items.map((ing, idx) => {
                      const key = `${label}-${idx}`;
                      const isChecked = checkedIngredients.has(key);
                      const amountStr = [ing.amount, ing.unit].filter(Boolean).join(' ');
                      return (
                        <IngredientItem
                          key={key}
                          ing={ing}
                          isChecked={isChecked}
                          amountStr={amountStr}
                          onToggle={() => toggleIngredient(key)}
                          instructions={instructions}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))
            : <p className="rp2__empty-hint">No ingredients yet.</p>
          }
        </div>

        {/* -- Instructions -- */}
        <div className="rp2__instructions">
          <div className="rp2__section-title-row">
            <h2 className="rp2__section-title rp2__section-title--sm">Instructions</h2>
            {!isEdit('instructions') && totalSteps > 0 && (
              <span className="rp2__progress-label rp2__progress-label--right">{doneCount}/{totalSteps} steps</span>
            )}
            {isAdmin && <SectionPencil isEditing={isEdit('instructions')} onEdit={() => startEdit('instructions')} onSave={() => saveSection('instructions')} onCancel={cancelEdit} saving={saving} />}
          </div>

          {!isEdit('instructions') && totalSteps > 0 && (
            <div className="rp2__progress-bar">
              <div className="rp2__progress-fill" style={{ width: `${(doneCount / totalSteps) * 100}%` }} />
            </div>
          )}

          {isEdit('instructions') ? (
            <div className="rp2__inline-editor">
              <DndContext sensors={rpSensors} collisionDetection={closestCenter} onDragEnd={onDraftStepDragEnd}>
                <SortableContext items={draftSteps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                  {draftSteps.map((item, idx) => {
                    if (item._isGroup) {
                      // Add a new step directly at the bottom of this group
                      const addToGroup = () => {
                        const grpName = item.name || '';
                        // Find the last step belonging to this group
                        let insertIdx = idx;
                        for (let j = idx + 1; j < draftSteps.length; j++) {
                          const s = draftSteps[j];
                          if (s._isGroup) break; // next group header — stop
                          if (!s._isTimer && s.group_label !== grpName) break; // step not in this group
                          insertIdx = j;
                        }
                        const newStep = { _id: `step-new-${Date.now()}`, body_text: '', timer_seconds: null, group_label: grpName };
                        setDraftSteps(prev => {
                          const next = [...prev];
                          next.splice(insertIdx + 1, 0, newStep);
                          return next;
                        });
                      };
                      return (
                        <StepGroupRow
                          key={item._id}
                          grp={item}
                          onLabelChange={v => setDraftSteps(prev => {
                            // Also update group_label on all steps that belong to this group
                            const oldName = item.name || '';
                            return prev.map(s =>
                              s._id === item._id ? { ...s, name: v } :
                              (!s._isGroup && !s._isTimer && s.group_label === oldName) ? { ...s, group_label: v } : s
                            );
                          })}
                          onRemove={() => setDraftSteps(prev => {
                            // Remove header but ungroup its steps (don't delete them)
                            const grpName = item.name || '';
                            return prev
                              .filter(s => s._id !== item._id)
                              .map(s => (!s._isGroup && !s._isTimer && s.group_label === grpName) ? { ...s, group_label: null } : s);
                          })}
                          onAddStep={addToGroup}
                        />
                      );
                    }

                    if (item._isTimer) {
                      return (
                        <div key={item._id} className="rp2__ed-timer-row" style={{ marginLeft: item.group_label ? 20 : 0 }}>
                          <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                          <div className="rp2__ed-timer-row__inputs">
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? {...s, h: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">h</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? {...s, m: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">m</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setDraftSteps(prev => prev.map(s => s._id === item._id ? {...s, s: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">s</span>
                          </div>
                          <button className="editor-remove-btn" onClick={() => {
                            setDraftSteps(prev => {
                              const i2 = prev.findIndex(s => s._id === item._id);
                              const next = prev.filter(s => s._id !== item._id);
                              if (i2 > 0 && !prev[i2 - 1]._isTimer) {
                                return next.map(s => s._id === prev[i2 - 1]._id ? { ...s, timer_seconds: null } : s);
                              }
                              return next;
                            });
                          }}>✕</button>
                        </div>
                      );
                    }

                    // Regular step — snap/unsnap into nearest group above
                    const isGrouped = !!item.group_label;
                    const stepNum = draftSteps.slice(0, idx).filter(s => !s._isTimer && !s._isGroup).length + 1;

                    // Find the nearest group header directly above (scanning through timers only)
                    // Also find any group in the whole list so we know if groups exist at all
                    let nearestGroupAbove = null;
                    for (let j = idx - 1; j >= 0; j--) {
                      if (draftSteps[j]._isGroup) { nearestGroupAbove = draftSteps[j].name || ''; break; }
                      if (!draftSteps[j]._isTimer) break;
                    }
                    // Show snap-in if ungrouped AND any group header exists anywhere above
                    const anyGroupAbove = !isGrouped && draftSteps.slice(0, idx).some(s => s._isGroup);
                    // Use nearest group if directly above, otherwise use last group defined above
                    if (!nearestGroupAbove && anyGroupAbove) {
                      for (let j = idx - 1; j >= 0; j--) {
                        if (draftSteps[j]._isGroup) { nearestGroupAbove = draftSteps[j].name || ''; break; }
                      }
                    }
                    const canSnap = !isGrouped && anyGroupAbove;

                    const handleSnap = () => setDraftSteps(prev =>
                      prev.map(s => s._id === item._id ? { ...s, group_label: nearestGroupAbove } : s)
                    );
                    const handleUnsnap = () => setDraftSteps(prev =>
                      prev.map(s => s._id === item._id ? { ...s, group_label: null } : s)
                    );

                    return (
                      <StepSortableItem key={item._id} id={item._id} stepNum={stepNum} grouped={isGrouped}
                        onSnap={handleSnap} onUnsnap={handleUnsnap} canSnap={canSnap}>
                        <textarea className="editor-textarea" value={item.body_text} onChange={e => updateDraftStep(item._id, e.target.value)} placeholder="Describe this step..." rows={2} />
                        <button className="rp2__ed-add-timer-btn" onClick={() => addTimerAfterStep(item._id)} title="Add timer after this step"><Icon name="timer" size={13} strokeWidth={2} /></button>
                        <button className="editor-remove-btn" onClick={() => removeDraftStep(item._id)}>✕</button>
                      </StepSortableItem>
                    );
                  })}
                </SortableContext>
              </DndContext>
              <div className="ing-flat-add-row">
                <button className="btn btn--ghost editor-add-btn" onClick={addDraftStep}>+ Add Step</button>
                <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setDraftSteps(prev => [...prev, { _id: `step-grp-${Date.now()}`, _isGroup: true, name: '' }])}>+ Add Group</button>
              </div>
            </div>
          ) : (
            instructions?.length > 0
              ? (() => {
                  const sorted = [...instructions].sort((a, b) => a.step_number - b.step_number);
                  const sortedUndone = sorted.filter(s => !doneSteps.has(s.step_number));
                  // Group steps — ungrouped steps interleaved with grouped sections
                  const sections = [];
                  for (const step of sorted) {
                    const lbl = step.group_label || '';
                    const last = sections[sections.length - 1];
                    if (!last || last.label !== lbl) sections.push({ label: lbl, steps: [step] });
                    else last.steps.push(step);
                  }
                  return (
                    <div className="rp2__steps-outer">
                      {sections.map((sec, si) => (
                        <div key={si} className={sec.label ? 'rp2__step-section' : 'rp2__step-section rp2__step-section--ungrouped'}>
                          {sec.label && <p className="rp2__step-section-label">{sec.label}</p>}
                          <ol className="rp2__steps">
                            {sec.steps.map((step, listIdx) => {
                              const done = doneSteps.has(step.step_number);
                              const isCurrent = !done && sortedUndone[0]?.step_number === step.step_number;
                              const isFirst = sorted[0]?.step_number === step.step_number;
                              const enlarge = isFirst && doneCount === 0 ? true : isCurrent;
                              const stepText = (step.body_text || '').toLowerCase();
                              const matchedNotes = cookingNotes.filter(n =>
                                (n.keywords || []).some(kw => stepText.includes(kw.toLowerCase()))
                              );
                              return (
                                <StepItem
                                  key={step.step_number}
                                  step={step}
                                  done={done}
                                  isCurrent={isCurrent}
                                  enlarge={enlarge}
                                  grouped={!!sec.label}
                                  onToggle={() => toggleStep(step.step_number)}
                                  matchedNotes={matchedNotes}
                                />
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                    </div>
                  );
                })()
              : <p className="rp2__empty-hint">No instructions yet.</p>
          )}

          {/* -- Notes + Cookbook -- side by side (desktop), stacked (mobile) -- */}
          <div className="rp2__notes-row">
            <div className="rp2__notes">
              <div className="rp2__section-title-row">
                <h2 className="rp2__section-title rp2__section-title--sm">Notes &amp; Tips</h2>
                {isAdmin && <SectionPencil isEditing={isEdit('notes')} onEdit={() => startEdit('notes')} onSave={() => saveSection('notes')} onCancel={cancelEdit} saving={saving} />}
              </div>

              {isEdit('notes') ? (
                <div className="rp2__inline-editor">
                  {draftNotes.map(n => (
                    <div key={n._id} className="rp2__ed-note-row">
                      <input className="editor-input" style={{flex:1}} value={n.text} onChange={e => updateDraftNote(n._id, e.target.value)} placeholder="Add a tip or note..." />
                      <button className="editor-remove-btn" onClick={() => removeDraftNote(n._id)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn--ghost editor-add-btn" onClick={addDraftNote}>+ Add Note</button>
                </div>
              ) : (
                notes?.length > 0
                  ? <ul className="rp2__notes-list">
                      {notes.map((n, i) => (
                        <li key={i} className="rp2__notes-item">{n.text ?? n.body_text ?? n}</li>
                      ))}
                    </ul>
                  : <p className="rp2__empty-hint">No notes yet.</p>
              )}
            </div>

            {/* Cookbook Reference -- editable */}
            <div className="rp2__cookbook">
              <div className="rp2__section-title-row">
                <h2 className="rp2__section-title rp2__cookbook-title">Cookbook</h2>
                {isAdmin && <SectionPencil isEditing={isEdit('cookbook')} onEdit={() => startEdit('cookbook')} onSave={() => saveSection('cookbook')} onCancel={cancelEdit} saving={saving} />}
              </div>
              {isEdit('cookbook') ? (
                <div className="rp2__cookbook-editor">
                  <CookbookAutocomplete value={draftCookbook.cookbook} onChange={v => setDraftCookbook(p => ({...p, cookbook: v}))} cookbooks={cookbooks} />
                  <input className="editor-input" value={draftCookbook.reference} onChange={e => setDraftCookbook(p => ({...p, reference: e.target.value}))} placeholder="Page number" style={{marginTop: 6}} />
                </div>
              ) : (recipe.cookbook || recipe.reference) ? (
                <div className="rp2__cookbook-text">
                  <span className="rp2__cookbook-text__book">{recipe.cookbook}</span>
                  {recipe.reference && <span className="rp2__cookbook-text__page">Page {recipe.reference}</span>}
                </div>
              ) : (
                <p className="rp2__empty-hint">No reference yet. Click ✎ to add.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </main>
  );
};

// --- Ingredient Autocomplete Input -----------------------------------------
const IngredientAutocomplete = ({ value, onChange, allIngredients }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => {
    const val = value ?? '';
    if (!val.trim()) return [];
    const q = val.toLowerCase();
    return allIngredients
      .map(ing => {
        const name = typeof ing === 'string' ? ing : ing?.name;
        if (!name) return null;
        const lower = name.toLowerCase();
        if (!lower.includes(q)) return null;
        const score = lower.startsWith(q) ? 0 : lower.indexOf(q);
        return { ing: name, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map(x => x.ing);
  }, [value, allIngredients]);

  useEffect(() => { setHighlighted(0); }, [suggestions]);
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (ing) => { onChange(ing); setOpen(false); };
  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && suggestions[highlighted]) { e.preventDefault(); select(suggestions[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="ing-ac-wrap" ref={wrapperRef}>
      <input className="editor-input" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="soy sauce" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((ing, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = ing.toLowerCase().indexOf(q);
            return (
              <li key={ing} className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`} onMouseDown={() => select(ing)} onMouseEnter={() => setHighlighted(i)}>
                {idx >= 0 ? (<>{ing.slice(0, idx)}<strong>{ing.slice(idx, idx + q.length)}</strong>{ing.slice(idx + q.length)}</>) : ing}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const UnitAutocomplete = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => {
    const val = value ?? '';
    if (!val.trim()) return COMMON_UNITS.slice(0, 8);
    const q = val.toLowerCase();
    return COMMON_UNITS.filter(u => u.toLowerCase().startsWith(q) || u.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);

  useEffect(() => { setHighlighted(0); }, [suggestions]);
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (u) => { onChange(u); setOpen(false); };
  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && suggestions[highlighted]) { e.preventDefault(); select(suggestions[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="ing-ac-wrap" ref={wrapperRef}>
      <input className="editor-input editor-input--sm" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="tbsp" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((u, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = u.toLowerCase().indexOf(q);
            return (
              <li key={u} className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`} onMouseDown={() => select(u)} onMouseEnter={() => setHighlighted(i)}>
                {idx >= 0 && q ? (<>{u.slice(0, idx)}<strong>{u.slice(idx, idx + q.length)}</strong>{u.slice(idx + q.length)}</>) : u}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const SortableItem = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };
  return (
    <div ref={setNodeRef} style={style} className="sortable-item">
      <div className="sortable-handle" {...attributes} {...listeners}>⠿</div>
      {children}
    </div>
  );
};

// Step sortable item -- the step number bubble IS the drag handle
const StepSortableItem = ({ id, stepNum, grouped, children, onSnap, onUnsnap, canSnap }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 10 : undefined };
  return (
    <div ref={setNodeRef} style={style} className={`step-sortable-row ${grouped ? 'step-sortable-row--grouped' : ''}`}>
      {/* Snap/unsnap tab — only shown when relevant */}
      {grouped ? (
        <button
          className="step-snap-btn step-snap-btn--out"
          onClick={onUnsnap}
          title="Remove from group"
          type="button"
        >
          <Icon name="arrowRight" size={10} strokeWidth={2.5} />
        </button>
      ) : canSnap ? (
        <button
          className="step-snap-btn step-snap-btn--in"
          onClick={onSnap}
          title="Add to group above"
          type="button"
        >
          <Icon name="arrowRight" size={10} strokeWidth={2.5} />
        </button>
      ) : null}
      <span className="editor-step-num editor-step-num--drag" title="Drag to reorder" {...attributes} {...listeners}>{stepNum}</span>
      {children}
    </div>
  );
};

// Step group row -- draggable group header for instruction sections
const StepGroupRow = ({ grp, onLabelChange, onRemove, onAddStep }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: grp._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };
  return (
    <div className="step-group-row" ref={setNodeRef} style={style}>
      <span className="step-group-row__drag" {...attributes} {...listeners}>⠿</span>
      <input
        className="step-group-row__label-input"
        value={grp.name}
        onChange={e => onLabelChange(e.target.value)}
        placeholder="Group name (e.g. For the sauce, Marinade)…"
      />
      {onAddStep && (
        <button className="ing-group-row__add-btn" onClick={onAddStep} title="Add step to this group">＋</button>
      )}
      <button className="editor-remove-btn" onClick={onRemove} title="Remove group">✕</button>
    </div>
  );
};

// --- Recipe Editor ----------------------------------------------------------
const RecipeEditor = ({ recipe, bodyIngredients, instructions, notes, allIngredients, onBack, onSaved, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();

  const [details, setDetails] = useState({
    name: recipe?.name || '',
    cuisine: recipe?.cuisine || '',
    time: recipe?.time || '',
    servings: recipe?.servings || '',
    calories: recipe?.calories ?? '',
    protein: recipe?.protein ?? '',
    cover_image_url: recipe?.coverImage || '',
  });

  const [ings, setIngs] = useState(() => (bodyIngredients || []).map((i, idx) => ({ ...i, _id: `ing-${idx}` })));
  const [steps, setSteps] = useState(() => (instructions || []).map((s, idx) => ({ ...s, _id: `step-${idx}` })));
  const [notesList, setNotesList] = useState(() => (notes || []).map((n, idx) => ({ ...n, _id: `note-${idx}` })));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));

  const addIng = () => setIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); });
    }
  };

  const addStep = () => setSteps(prev => [...prev, { _id: `step-new-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null }]);
  const addTimerAfterStep = (afterId) => setSteps(prev => {
    const idx = prev.findIndex(s => s._id === afterId);
    const timer = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' };
    const next = [...prev]; next.splice(idx + 1, 0, timer); return next;
  });
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); });
    }
  };

  const addNote = () => setNotesList(prev => [...prev, { _id: `note-new-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const save = async () => {
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const payload = {
        details,
        ingredients: ings.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: (() => {
          const result = []; let stepNum = 1;
          for (let i = 0; i < steps.length; i++) {
            const item = steps[i];
            if (item._isTimer) {
              const secs = (parseInt(item.h)||0)*3600 + (parseInt(item.m)||0)*60 + (parseInt(item.s)||0);
              if (result.length > 0) result[result.length-1].timer_seconds = secs > 0 ? secs : null;
            } else { result.push({ ...item, step_number: stepNum++, timer_seconds: item.timer_seconds ?? null }); }
          }
          return result;
        })(),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      const res = await apiFetch(`${API}/api/recipes/${recipe.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaveSuccess(true);
      if (onSaved) onSaved(data.recipe);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const groupLabels = [...new Set(ings.map(i => i.group_label).filter(Boolean))];

  return (
    <main className="view editor-page rp2">
      <div className="rp2__hero ed-hero">
        {details.cover_image_url ? <img className="rp2__hero-img" src={details.cover_image_url} alt={details.name} /> : <div className="rp2__hero-placeholder"><Icon name="image" size={40} color="var(--ash)" strokeWidth={1.5} /></div>}
        <button className="ed-hero__img-btn" onClick={() => setShowImageInput(v => !v)} title="Change cover image">{details.cover_image_url ? <><Icon name="image" size={13} strokeWidth={2} /> Change</> : <><Icon name="image" size={13} strokeWidth={2} /> Add Photo</>}</button>
        {showImageInput && (
          <div className="ed-hero__img-popover">
            <p className="ed-hero__img-popover-label">Cover image URL</p>
            <input className="editor-input" autoFocus value={details.cover_image_url} onChange={e => setDetail('cover_image_url', e.target.value)} placeholder="https://..." onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setShowImageInput(false); }} />
            <button className="btn btn--primary btn--sm" style={{marginTop:6}} onClick={() => setShowImageInput(false)}>Done</button>
          </div>
        )}
        <div className="rp2__hero-overlay">
          <div className="rp2__hero-topbar">
            <button className="rp2__hero-btn" onClick={onBack}>← Cancel</button>
            <button className="rp2__hero-btn rp2__hero-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : '✓ Save'}</button>
          </div>
          <div className="rp2__hero-bottom">
            <div className="rp2__hero-tags">{details.cuisine && <span className="rp2__tag">{details.cuisine}</span>}</div>
            <div className="rp2__hero-pills">
              {details.time && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="clock" size={13} strokeWidth={2} /></span>{details.time}</span>}
              {details.servings && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="utensils" size={13} strokeWidth={2} /></span>{details.servings} srv</span>}
              {details.calories !== '' && toNum(details.calories) !== null && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="zap" size={13} strokeWidth={2} /></span>{Math.round(toNum(details.calories))} kcal</span>}
              {details.protein !== '' && toNum(details.protein) !== null && <span className="rp2__pill"><span className="rp2__pill-icon"><Icon name="dumbbell" size={13} strokeWidth={2} /></span>{Math.round(toNum(details.protein))}g prot</span>}
            </div>
          </div>
        </div>
      </div>

      {saveError && <p className="editor-error" style={{margin:'8px 24px 0'}}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
      {saveSuccess && <p className="editor-success" style={{margin:'8px 24px 0'}}>✓ Saved successfully</p>}

      <div className="rp2__header ed-name-row">
        <input className="ed-title-input" value={details.name} onChange={e => setDetail('name', e.target.value)} placeholder="Recipe name..." />
      </div>

      <div className="ed-meta-row">
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</span>
          <select className="editor-input editor-select ed-meta-input" value={details.cuisine} onChange={e => setDetail('cuisine', e.target.value)}>
            <option value="">-- none --</option>
            {ALL_CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
            {[...QUICK_CHIP_KEYS].filter(k => !ALL_CUISINES.includes(k)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</span>
          <input className="editor-input ed-meta-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</span>
          <input className="editor-input ed-meta-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="zap" size={13} strokeWidth={2} /> Calories</span>
          <input className="editor-input ed-meta-input" type="number" value={details.calories} onChange={e => setDetail('calories', e.target.value)} placeholder="kcal" />
        </label>
        <label className="ed-meta-field">
          <span className="ed-meta-label"><Icon name="dumbbell" size={13} strokeWidth={2} /> Protein</span>
          <input className="editor-input ed-meta-input" type="number" value={details.protein} onChange={e => setDetail('protein', e.target.value)} placeholder="g" />
        </label>
      </div>

      <section className="editor-section">
        <h3 className="editor-section__title">Ingredients</h3>
        <datalist id="group-labels">{groupLabels.map(l => <option key={l} value={l} />)}</datalist>
        <div className="editor-ing-header"><span>Amount</span><span>Unit</span><span>Name</span><span>Group</span><span>Prep note</span><span>Opt?</span><span></span></div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
          <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
            {ings.map(ing => (
              <SortableItem key={ing._id} id={ing._id}>
                <div className="editor-ing-row">
                  <input className="editor-input editor-input--sm" value={ing.amount} onChange={e => updateIng(ing._id, 'amount', e.target.value)} placeholder="2" />
                  <UnitAutocomplete value={ing.unit} onChange={v => updateIng(ing._id, 'unit', v)} />
                  <IngredientAutocomplete value={ing.name} onChange={v => updateIng(ing._id, 'name', v)} allIngredients={allIngredients.filter(Boolean)} />
                  <input className="editor-input editor-input--sm" value={ing.group_label || ''} onChange={e => updateIng(ing._id, 'group_label', e.target.value)} placeholder="e.g. Sauce" list="group-labels" />
                  <input className="editor-input" value={ing.prep_note || ''} onChange={e => updateIng(ing._id, 'prep_note', e.target.value)} placeholder="finely chopped" />
                  <button className={`editor-optional-btn ${ing.optional ? 'editor-optional-btn--on' : ''}`} onClick={() => updateIng(ing._id, 'optional', !ing.optional)} title="Mark as optional">{ing.optional ? '✓' : '○'}</button>
                  <button className="editor-remove-btn" onClick={() => removeIng(ing._id)}>✕</button>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn btn--ghost editor-add-btn" onClick={addIng}>+ Add Ingredient</button>
      </section>

      <section className="editor-section">
        <h3 className="editor-section__title">Instructions</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
          <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
            {steps.map((item, idx) => {
              if (item._isTimer) {
                return (
                  <div key={item._id} className="rp2__ed-timer-row">
                    <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                    <div className="rp2__ed-timer-row__inputs">
                      <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, h: e.target.value} : s))} placeholder="0" />
                      <span className="rp2__ed-timer-row__sep">h</span>
                      <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, m: e.target.value} : s))} placeholder="0" />
                      <span className="rp2__ed-timer-row__sep">m</span>
                      <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, s: e.target.value} : s))} placeholder="0" />
                      <span className="rp2__ed-timer-row__sep">s</span>
                    </div>
                    <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                  </div>
                );
              }
              const stepNum = steps.slice(0, idx).filter(s => !s._isTimer).length + 1;
              return (
                <StepSortableItem key={item._id} id={item._id} stepNum={stepNum}>
                  <textarea className="editor-textarea" value={item.body_text} onChange={e => updateStep(item._id, e.target.value)} placeholder="Describe this step..." rows={2} />
                  <button className="rp2__ed-add-timer-btn" onClick={() => addTimerAfterStep(item._id)} title="Add timer"><Icon name="timer" size={13} strokeWidth={2} /></button>
                  <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                </StepSortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
        <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
      </section>

      <section className="editor-section">
        <h3 className="editor-section__title">Notes &amp; Modifications</h3>
        {notesList.map(note => (
          <div key={note._id} className="editor-note-row">
            <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Works great with tofu instead of chicken" />
            <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
          </div>
        ))}
        <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
      </section>

      <div className="editor-save-bar">
        {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        {saveSuccess && <p className="editor-success">✓ Saved successfully</p>}
        <button className="btn btn--primary btn--large" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </main>
  );
};

const CuisineDropdown = ({ cuisines, value, onChange, onCreateNew }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return cuisines;
    return cuisines.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  }, [cuisines, search]);

  const trimmed = search.trim();
  const exactMatch = cuisines.some(c => c.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c) => { onChange(c === value ? '' : c); setOpen(false); setSearch(''); };
  const create = () => { if (!trimmed) return; onCreateNew(trimmed); onChange(trimmed); setOpen(false); setSearch(''); };
  const clear = (e) => { e.stopPropagation(); onChange(''); setSearch(''); };

  return (
    <div className="cuisine-dd" ref={wrapRef}>
      <button className={`cuisine-dd__trigger ${value ? 'cuisine-dd__trigger--active' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="cuisine-dd__globe"><Icon name="globe" size={14} strokeWidth={2} /></span>
        <span className="cuisine-dd__label">{value || 'Cuisine'}</span>
        {value ? <span className="cuisine-dd__x" onMouseDown={clear}>✕</span> : <span className={`cuisine-dd__arrow ${open ? 'cuisine-dd__arrow--open' : ''}`}>▾</span>}
      </button>
      {open && (
        <div className="cuisine-dd__panel">
          <input className="cuisine-dd__search" autoFocus placeholder="Search cuisines..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="cuisine-dd__list">
            {filtered.map(c => (
              <button key={c} className={`cuisine-dd__option ${value === c ? 'cuisine-dd__option--active' : ''}`} onMouseDown={() => select(c)}>
                <span className="cuisine-dd__check">{value === c ? '✓' : ''}</span>{c}
              </button>
            ))}
            {showCreate && (
              <button className="cuisine-dd__option cuisine-dd__option--create" onMouseDown={create}>
                <span className="cuisine-dd__create-icon">+</span>Create "{trimmed}"<span className="cuisine-dd__create-badge">new</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Cookbook Autocomplete Input ------------------------------------------
const CookbookAutocomplete = ({ value, onChange, cookbooks = [] }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => {
    const val = value ?? '';
    if (!val.trim()) return cookbooks.slice(0, 6).map(c => c.title);
    const q = val.toLowerCase();
    return cookbooks
      .map(c => c.title)
      .filter(t => t.toLowerCase().includes(q))
      .slice(0, 6);
  }, [value, cookbooks]);

  useEffect(() => { setHighlighted(0); }, [suggestions]);
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (t) => { onChange(t); setOpen(false); };
  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && suggestions[highlighted]) { e.preventDefault(); select(suggestions[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="ing-ac-wrap" ref={wrapperRef}>
      <input className="editor-input" value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="e.g. Ottolenghi Simple" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <ul className="ing-ac-dropdown">
          {suggestions.map((t, i) => {
            const q = (value ?? '').toLowerCase();
            const idx = t.toLowerCase().indexOf(q);
            return (
              <li key={t} className={`ing-ac-option ${i === highlighted ? 'ing-ac-option--active' : ''}`} onMouseDown={() => select(t)} onMouseEnter={() => setHighlighted(i)}>
                {idx >= 0 && q ? (<>{t.slice(0, idx)}<strong>{t.slice(idx, idx + q.length)}</strong>{t.slice(idx + q.length)}</>) : t}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// --- Fridge Tab -------------------------------------------------------------
const ALL_TYPES = ['produce', 'meat', 'dairy', 'sauce', 'spice', 'alcohol', 'staple'];
const TYPE_META = {
  produce:  { label: 'Produce',     icon: 'leaf',     group: 'fridge'  },
  meat:     { label: 'Meat & Fish', icon: 'utensils', group: 'fridge'  },
  dairy:    { label: 'Dairy',       icon: 'coffee',   group: 'fridge'  },
  sauce:    { label: 'Sauces',      icon: 'package',  group: 'fridge'  },
  spice:    { label: 'Spices',      icon: 'zap',      group: 'pantry'  },
  alcohol:  { label: 'Alcohol',     icon: 'shuffle',  group: 'pantry'  },
  staple:   { label: 'Staples',     icon: 'list',     group: 'pantry'  },
};

const IngredientEditModal = ({ ing, onSave, onClose, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const isNew = !ing;
  const [form, setForm] = useState({
    name:           ing?.name           || '',
    type:           ing?.type           || 'staple',
    calories:       ing?.calories       ?? '',
    protein:        ing?.protein        ?? '',
    fiber:          ing?.fiber          ?? '',
    grams_per_unit: ing?.grams_per_unit ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState(null);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchNutrition = async () => {
    const query = form.name.trim();
    if (!query) { setFetchMsg({ type: 'err', text: 'Enter a name first' }); return; }
    setFetching(true); setFetchMsg(null);
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments,serving_quantity,serving_size`;
      const res = await fetch(url);
      const data = await res.json();
      const products = (data.products || []).filter(p =>
        p.nutriments && p.nutriments['energy-kcal_100g'] != null
      );
      if (!products.length) {
        setFetchMsg({ type: 'err', text: 'No nutrition data found -- try a simpler name' });
        setFetching(false); return;
      }
      const p = products[0];
      const n = p.nutriments;
      const cal  = Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0);
      const prot = Math.round((n['proteins_100g']   ?? 0) * 10) / 10;
      const fib  = Math.round((n['fiber_100g']       ?? 0) * 10) / 10;
      // Try to extract a sensible grams-per-unit from serving data
      const servingG = parseFloat(p.serving_quantity) || null;
      const updates = { calories: cal, protein: prot, fiber: fib };
      if (servingG && servingG > 0 && servingG < 1000) updates.grams_per_unit = Math.round(servingG);
      setForm(prev => ({ ...prev, ...updates }));
      const gpuNote = updates.grams_per_unit ? ` · ${updates.grams_per_unit}g/unit` : '';
      setFetchMsg({ type: 'ok', text: `Fetched from Open Food Facts${p.product_name ? ` · "${p.product_name}"` : ''}${gpuNote}` });
    } catch {
      setFetchMsg({ type: 'err', text: 'Fetch failed -- check your connection' });
    }
    setFetching(false);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        name:           form.name.trim(),
        type:           form.type,
        calories:       form.calories       === '' ? null : Number(form.calories),
        protein:        form.protein        === '' ? null : Number(form.protein),
        fiber:          form.fiber          === '' ? null : Number(form.fiber),
        grams_per_unit: form.grams_per_unit === '' ? null : Number(form.grams_per_unit),
      };
      const url = isNew ? `${API}/api/ingredients` : `${API}/api/ingredients/${encodeURIComponent(ing.name)}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave(data.ingredient || payload);
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="create-modal-overlay ing-edit-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header ing-edit-modal-header">
          <h2 className="create-modal__title" style={{ fontSize: '1rem', lineHeight: 1.3, wordBreak: 'break-word' }}>{isNew ? 'Add Ingredient' : `Edit: ${ing.name}`}</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap: 16 }}>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Name <span className="create-modal__required">*</span></label>
            <input className="editor-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Olive Oil" autoFocus={isNew} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Category</label>
            <div className="picker__chips" style={{ marginTop: 4 }}>
              {ALL_TYPES.map(t => (
                <button key={t} className={`chip ${form.type === t ? 'chip--selected' : ''}`} onClick={() => set('type', t)}>
                  {form.type === t && <span className="chip__check">✓</span>}{TYPE_META[t].icon && <Icon name={TYPE_META[t].icon} size={12} strokeWidth={2} />} {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="create-modal__field-label" style={{ margin: 0 }}>Nutrition <span style={{opacity:0.6,fontWeight:400}}>/ 100g</span></span>
              <button className="ing-fetch-btn" onClick={fetchNutrition} disabled={fetching}>
                {fetching ? <><Icon name="repeat" size={13} strokeWidth={2} /> Fetching...</> : <><Icon name="search" size={13} strokeWidth={2} /> Fetch Nutrition</>}
              </button>
            </div>
            {fetchMsg && <p className={`ing-fetch-msg ing-fetch-msg--${fetchMsg.type}`}>{fetchMsg.text}</p>}
            <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="zap" size={13} strokeWidth={2} /> Calories</label>
                <input className="editor-input" type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="kcal" />
              </div>
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="dumbbell" size={13} strokeWidth={2} /> Protein</label>
                <input className="editor-input" type="number" value={form.protein} onChange={e => set('protein', e.target.value)} placeholder="g" />
              </div>
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="leaf" size={13} strokeWidth={2} /> Fiber</label>
                <input className="editor-input" type="number" value={form.fiber} onChange={e => set('fiber', e.target.value)} placeholder="g" />
              </div>
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">
              <Icon name="dumbbell" size={13} strokeWidth={2} /> Grams per unit
              <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6 }}>optional</span>
            </label>
            <input
              className="editor-input"
              type="number"
              value={form.grams_per_unit}
              onChange={e => set('grams_per_unit', e.target.value)}
              placeholder="e.g. 50 for eggs, 5 for garlic cloves"
            />
            <p className="create-modal__field-hint" style={{ marginTop: 4 }}>
              Used when a recipe says "3 eggs" or "2 cloves" -- no weight unit. Leave blank for ingredients always measured by weight or volume.
            </p>
          </div>
          {error && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {error}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : isNew ? '+ Add Ingredient' : '✓ Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

// --- Always-expanded types ---------------------------------------------------
const ALWAYS_OPEN_TYPES = new Set(['produce', 'meat']);

const FridgeTab = ({ allIngredients, setAllIngredients, fridgeIngredients, setFridgeIngredients, pantryStaples, setPantryStaples, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [typeOverrides, setTypeOverrides] = useState(() => LS.get('ingredientTypeOverrides', {}));
  const [editingIng, setEditingIng] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Collapsible state for sections -- all collapsed except produce/meat by default
  const [collapsedTypes, setCollapsedTypes] = useState(() => {
    const init = {};
    ALL_TYPES.forEach(t => { if (!ALWAYS_OPEN_TYPES.has(t)) init[t] = true; });
    return init;
  });
  // Missing half collapsed state
  const [missingCollapsed, setMissingCollapsed] = useState(true);
  // Quick-add bar
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef(null);
  // Recently used
  const [recentlyUsed, setRecentlyUsed] = useState(() => LS.get('kitchenRecentlyUsed', []));

  useEffect(() => { LS.set('ingredientTypeOverrides', typeOverrides); }, [typeOverrides]);
  useEffect(() => { LS.set('kitchenRecentlyUsed', recentlyUsed); }, [recentlyUsed]);

  // Close quick-add dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (quickAddRef.current && !quickAddRef.current.contains(e.target)) setQuickAddOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = useMemo(() => new Set([...fridgeIngredients, ...pantryStaples]), [fridgeIngredients, pantryStaples]);
  const enriched = useMemo(() => allIngredients.map(i => ({ ...i, type: typeOverrides[i.name] ?? i.type })), [allIngredients, typeOverrides]);

  // Split into Have vs Missing
  const haveList = useMemo(() => enriched.filter(i => allSelected.has(i.name.toLowerCase())), [enriched, allSelected]);
  const missingList = useMemo(() => enriched.filter(i => !allSelected.has(i.name.toLowerCase())), [enriched, allSelected]);

  // Group by type
  const groupBy = (list) => {
    const map = {};
    for (const ing of list) { const t = ing.type || 'other'; if (!map[t]) map[t] = []; map[t].push(ing); }
    return map;
  };

  const haveGrouped = useMemo(() => groupBy(haveList), [haveList]);
  const missingGrouped = useMemo(() => groupBy(missingList), [missingList]);

  const toggle = (name, type) => {
    const lower = name.toLowerCase();
    const isFridgeType = ['produce', 'meat', 'dairy', 'sauce'].includes(type);
    const isOn = allSelected.has(lower);
    if (isOn) {
      // Remove from have
      setFridgeIngredients(prev => prev.filter(i => i !== lower));
      setPantryStaples(prev => prev.filter(i => i !== lower));
    } else {
      // Add to have -- also track in recently used
      setRecentlyUsed(prev => {
        const next = [lower, ...prev.filter(x => x !== lower)].slice(0, 12);
        return next;
      });
      if (isFridgeType) setFridgeIngredients(prev => [...prev, lower]);
      else setPantryStaples(prev => [...prev, lower]);
    }
  };

  // Quick-add: adds an ingredient from missing → have immediately
  const quickAddSuggestions = useMemo(() => {
    const q = quickAddValue.toLowerCase().trim();
    const missingNames = missingList.map(i => i.name.toLowerCase());
    if (!q) return missingList.slice(0, 8);
    return missingList.filter(i => i.name.toLowerCase().includes(q)).slice(0, 10);
  }, [quickAddValue, missingList]);

  const handleQuickAdd = (ing) => {
    toggle(ing.name, typeOverrides[ing.name] ?? ing.type);
    setQuickAddValue('');
    setQuickAddOpen(false);
  };

  const toggleSection = (type) => {
    if (ALWAYS_OPEN_TYPES.has(type)) return;
    setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const clearSection = (type) => {
    const names = (haveGrouped[type] || []).map(i => i.name.toLowerCase());
    setFridgeIngredients(prev => prev.filter(x => !names.includes(x)));
    setPantryStaples(prev => prev.filter(x => !names.includes(x)));
  };

  const handleSaveIng = (saved) => {
    if (editingIng === false) {
      setAllIngredients(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setAllIngredients(prev => prev.map(i => i.name === editingIng.name ? { ...i, ...saved } : i));
      if (saved.type !== editingIng.type) setTypeOverrides(prev => ({ ...prev, [saved.name]: saved.type }));
    }
    setEditingIng(null);
  };

  const handleDeleteIng = async (ing) => {
    try {
      const res = await apiFetch(`${API}/api/ingredients/${encodeURIComponent(ing.name)}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      setAllIngredients(prev => prev.filter(i => i.name !== ing.name));
      setFridgeIngredients(prev => prev.filter(x => x !== ing.name.toLowerCase()));
      setPantryStaples(prev => prev.filter(x => x !== ing.name.toLowerCase()));
    } catch (e) { alert('Could not delete: ' + e.message); }
    setDeleteTarget(null);
  };

  const renderGroup = (type, ings, side) => {
    const isCollapsed = side === 'have' ? collapsedTypes[type] : false;
    const isAlwaysOpen = ALWAYS_OPEN_TYPES.has(type);
    const haveCount = (haveGrouped[type] || []).length;
    return (
      <div key={type} className="fridge-group">
        <div className={`fridge-group__header ${!isAlwaysOpen ? 'fridge-group__header--collapsible' : ''}`}
          onClick={() => !isAlwaysOpen && toggleSection(type)}>
          <h3 className="fridge-group__title">
            {TYPE_META[type]?.icon && <Icon name={TYPE_META[type].icon} size={14} strokeWidth={2} />} {TYPE_META[type]?.label ?? type}
            {side === 'missing' && <span className="fridge-group__count">{ings.length}</span>}
            {side === 'have' && <span className="fridge-group__count">{ings.length}</span>}
          </h3>
          <div className="fridge-group__header-actions" onClick={e => e.stopPropagation()}>
            {side === 'have' && haveCount > 0 && (
              <button className="fridge-group__clear-btn" title={`Clear ${TYPE_META[type]?.label}`} onClick={() => clearSection(type)}>
                Clear
              </button>
            )}
            {!isAlwaysOpen && (
              <span className={`fridge-group__arrow ${isCollapsed ? '' : 'fridge-group__arrow--open'}`}>▾</span>
            )}
          </div>
        </div>
        {!isCollapsed && (
          <div className="fridge-chips">
            {ings.map(ing => {
              const isOn = allSelected.has(ing.name.toLowerCase());
              const hasNutrition = ing.calories != null || ing.protein != null || ing.fiber != null;
              return (
                <div key={ing.name} className="fridge-ing-wrap">
                  <div className="fridge-chip-group">
                    <button className={`chip ${isOn ? 'chip--selected' : ''}`} onClick={() => toggle(ing.name, typeOverrides[ing.name] ?? ing.type)}>
                      {isOn && <span className="chip__check">✓</span>}
                      {ing.name}
                      {hasNutrition && <span className="fridge-chip__nutrition-dot" title="Has nutrition data" />}
                    </button>
                    <div className="fridge-chip-actions">
                      <button className="fridge-chip-action fridge-chip-action--edit" title="Edit" onClick={() => setEditingIng({ ...ing, type: typeOverrides[ing.name] ?? ing.type })}>✎</button>
                      <button className="fridge-chip-action fridge-chip-action--del" title="Delete" onClick={() => setDeleteTarget(ing)}>✕</button>
                    </div>
                    {/* Mobile: always-visible × remove button */}
                    <button className="fridge-chip-remove-mobile" onClick={() => setDeleteTarget(ing)} title="Remove">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const recentIngredients = useMemo(() =>
    recentlyUsed.map(name => enriched.find(i => i.name.toLowerCase() === name)).filter(Boolean),
  [recentlyUsed, enriched]);

  return (
    <main className="view">
      {(editingIng !== null) && (
        <IngredientEditModal
          ing={editingIng === false ? null : editingIng}
          onSave={handleSaveIng}
          onClose={() => setEditingIng(null)}
          authFetch={apiFetch}
        />
      )}
      {deleteTarget && (
        <div className="create-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon"><Icon name="trash2" size={32} color="var(--terracotta)" strokeWidth={1.5} /></div>
            <h2 className="delete-confirm-modal__title">Remove "{deleteTarget.name}"?</h2>
            <p className="delete-confirm-modal__body">This will remove the ingredient from the database. <strong>This cannot be undone.</strong></p>
            <div className="delete-confirm-modal__actions">
              <button className="btn btn--ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={() => handleDeleteIng(deleteTarget)}><Icon name="trash2" size={14} strokeWidth={2} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="fridge-header">
        <div>
          <h2 className="fridge-title">My Kitchen</h2>
          <p className="fridge-subtitle">{allSelected.size} ingredients tracked · {missingList.length} missing</p>
        </div>
        <div className="fridge-header__actions">
          <button className="btn btn--primary btn--sm" onClick={() => setEditingIng(false)}>+ Add ingredient</button>
          <button className="btn btn--ghost btn--sm" onClick={() => { setFridgeIngredients([]); setPantryStaples([]); }}>Clear all</button>
        </div>
      </div>

      {/* Quick-Add Bar */}
      <div className="kitchen-quickadd-wrap" ref={quickAddRef}>
        <div className="kitchen-quickadd-bar">
          <span className="kitchen-quickadd-icon">＋</span>
          <input
            className="kitchen-quickadd-input"
            placeholder="Quick-add an ingredient to your kitchen..."
            value={quickAddValue}
            onChange={e => { setQuickAddValue(e.target.value); setQuickAddOpen(true); }}
            onFocus={() => setQuickAddOpen(true)}
          />
          {quickAddValue && <button className="fridge-filter-bar__clear" onClick={() => { setQuickAddValue(''); setQuickAddOpen(false); }}>✕</button>}
        </div>
        {quickAddOpen && quickAddSuggestions.length > 0 && (
          <div className="kitchen-quickadd-dropdown">
            {quickAddSuggestions.map(ing => (
              <button key={ing.name} className="kitchen-quickadd-option" onMouseDown={() => handleQuickAdd(ing)}>
                <span className="kitchen-quickadd-option__emoji">{TYPE_META[ing.type]?.icon ? <Icon name={TYPE_META[ing.type].icon} size={13} strokeWidth={2} /> : '·'}</span>
                {ing.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* -- ON HAND area (full width) -- */}
      <div className="kitchen-onhand-area">
        <div className="kitchen-onhand-header">
          <h2 className="kitchen-split__title">On Hand <span className="kitchen-split__count">{haveList.length}</span></h2>
        </div>
        <div className="fridge-groups kitchen-onhand-groups">
          {ALL_TYPES.filter(t => haveGrouped[t]?.length > 0).map(t => renderGroup(t, haveGrouped[t], 'have'))}
          {haveList.length === 0 && (
            <div className="fridge-empty"><p>Nothing added yet. Use quick-add above or tap ingredients below.</p></div>
          )}
        </div>
      </div>

      {/* -- MISSING -- full width bar -- */}
      <div className="kitchen-missing-section">
        <button className="kitchen-missing-header" onClick={() => setMissingCollapsed(p => !p)}>
          <h2 className="kitchen-split__title">Missing <span className="kitchen-split__count">{missingList.length}</span></h2>
          <span className={`fridge-group__arrow ${missingCollapsed ? '' : 'fridge-group__arrow--open'}`}>▾</span>
        </button>
        {!missingCollapsed && (
          <div className="fridge-groups">
            {ALL_TYPES.filter(t => missingGrouped[t]?.length > 0).map(t => renderGroup(t, missingGrouped[t], 'missing'))}
          </div>
        )}
      </div>
    </main>
  );
};

// --- Profile Tab -------------------------------------------------------------
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Dairy-Free', 'Nut-Free', 'Gluten-Free'];

// --- Dietary Conflict Detection --------------------------------------------
// Comprehensive ingredient classification for dietary conflict detection
const DIETARY_CONFLICTS = {
  'Vegetarian': {
    keywords: ['chicken','beef','pork','lamb','turkey','duck','fish','salmon','tuna','shrimp','prawn','lobster','crab','anchovy','anchovies','bacon','ham','sausage','pepperoni','salami','prosciutto','pancetta','lard','gelatin','meat','veal','bison','venison','rabbit','mutton'],
    label: 'meat/fish',
  },
  'Vegan': {
    keywords: ['chicken','beef','pork','lamb','turkey','duck','fish','salmon','tuna','shrimp','prawn','lobster','crab','anchovy','anchovies','bacon','ham','sausage','pepperoni','salami','prosciutto','pancetta','lard','gelatin','meat','veal','bison','venison','rabbit','mutton','milk','cream','butter','cheese','yogurt','egg','eggs','honey','whey','casein','ghee','mayo','mayonnaise'],
    label: 'animal products',
  },
  'Dairy-Free': {
    keywords: ['milk','cream','butter','cheese','yogurt','whey','casein','ghee','cheddar','mozzarella','parmesan','brie','feta','ricotta','mascarpone','sour cream','half and half','buttermilk','kefir','cream cheese','crème fraîche','condensed milk','evaporated milk'],
    label: 'dairy',
  },
  'Nut-Free': {
    keywords: ['almond','almonds','walnut','walnuts','pecan','pecans','cashew','cashews','pistachio','pistachios','hazelnut','hazelnuts','peanut','peanuts','macadamia','pine nut','pine nuts','brazil nut','brazil nuts','chestnut','chestnuts','nut butter','almond flour','almond milk','tahini','marzipan','praline'],
    label: 'nuts',
  },
  'Gluten-Free': {
    keywords: ['flour','wheat','bread','pasta','barley','rye','semolina','spelt','kamut','farro','bulgur','couscous','breadcrumb','breadcrumbs','soy sauce','teriyaki','panko','crouton','croutons','malt','beer','seitan','triticale'],
    label: 'gluten',
    exceptions: { 'soy sauce': 'Soy sauce (contains gluten)' },
  },
};

const checkDietaryConflicts = (ingredients, dietaryFilters) => {
  if (!dietaryFilters?.length || !ingredients?.length) return [];
  const warnings = [];
  for (const diet of dietaryFilters) {
    const rule = DIETARY_CONFLICTS[diet];
    if (!rule) continue;
    const conflicts = [];
    const unrecognized = [];
    for (const ing of ingredients) {
      const name = (ing.name || '').toLowerCase().trim();
      if (!name) continue;
      // Check for keyword match
      const matched = rule.keywords.find(k => name.includes(k));
      if (matched) {
        // Check if there's a special exception message
        const exceptionKey = Object.keys(rule.exceptions || {}).find(k => name.includes(k));
        if (exceptionKey) {
          conflicts.push(rule.exceptions[exceptionKey]);
        } else {
          conflicts.push(ing.name);
        }
      }
    }
    if (conflicts.length > 0) {
      warnings.push({ diet, label: rule.label, conflicts });
    }
  }
  return warnings;
};
const THEME_OPTIONS = [
  { key: 'default', label: 'Terracotta', color: '#C65D3B' },
  { key: 'sage',    label: 'Sage',       color: '#7a9e7e' },
  { key: 'navy',    label: 'Navy',       color: '#2E4057' },
  { key: 'plum',    label: 'Plum',       color: '#6B3FA0' },
];
const STAR_LABELS = ['', "Didn't love it", 'It was okay', 'Pretty good!', 'Really good!', 'Perfect!'];

// -- Calendar helpers
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const AddFriendModal = ({ onClose, onCreated, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!username.trim() || !password) return setError('Username and password required.');
    setCreating(true); setError('');
    try {
      const res = await apiFetch(`${API}/api/auth/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, display_name: displayName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onCreated(data.user.username);
      onClose();
    } catch (e) { setError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--warm-white)', borderRadius: 16, padding: '24px 22px', width: '100%', maxWidth: 320, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--charcoal)' }}><Icon name="users" size={18} strokeWidth={2} /> Add a Friend</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--warm-gray)', lineHeight: 1, padding: '2px 4px' }}>×</button>
        </div>
        {error && <div style={{ background: '#fff0ee', border: '1px solid #f5c2b8', borderRadius: 8, padding: '7px 10px', fontSize: '0.8rem', color: 'var(--terracotta-dark, #b84a2e)' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Username</label>
          <input className="editor-input" type="text" placeholder="e.g. priya" value={username}
            onChange={e => setUsername(e.target.value)} autoCapitalize="none" autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Password</label>
          <input className="editor-input" type="text" placeholder="Set a password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Display Name <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.7rem' }}>(optional)</span></label>
          <input className="editor-input" type="text" placeholder="e.g. Priya S." value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'none', border: '1.5px solid var(--border)', color: 'var(--warm-gray)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating}
            style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'var(--terracotta)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Adding...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileTab = ({ recipes, dietaryFilters, setDietaryFilters, units, setUnits, totalRecipes, hideIncompatible, setHideIncompatible, authFetch, authUser, onLogout, onAuthUserUpdate, darkMode = false, setDarkMode }) => {
  const apiFetch = authFetch || fetch;
  const isAdmin = authUser?.role === 'admin';
  const [cookHistory, setCookHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [recalcRunning, setRecalcRunning] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);
  const [historyView, setHistoryView] = useState('timeline');
  const [calendarDate, setCalendarDate] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });

  // Display name editing
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  // Sharing state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendSuccess, setAddFriendSuccess] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});

  const toggleDiet = (d) => setDietaryFilters(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleReveal = (id) => setRevealedPasswords(p => ({ ...p, [id]: !p[id] }));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setHistoryLoading(true);
      try {
        const res = await apiFetch(`${API}/api/user/cook-log`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled) setCookHistory(data.entries || []);
      } catch { if (!cancelled) setCookHistory([]); }
      finally { if (!cancelled) setHistoryLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiFetch(`${API}/api/admin/users`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    finally { setUsersLoading(false); }
  };

  useEffect(() => {
    if (sharingOpen && isAdmin) loadUsers();
  }, [sharingOpen]); // eslint-disable-line

  const handleSaveDisplayName = async () => {
    setSavingDisplayName(true);
    try {
      await apiFetch(`${API}/api/user/display-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: draftDisplayName.trim() || null }),
      });
      if (onAuthUserUpdate) onAuthUserUpdate({ ...authUser, display_name: draftDisplayName.trim() || null });
    } catch {}
    finally { setSavingDisplayName(false); setEditingDisplayName(false); }
  };

  const handleSuspend = async (user) => {
    const newRole = user.role === 'suspended' ? 'guest' : 'suspended';
    await apiFetch(`${API}/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete ${user.username}? This removes all their data.`)) return;
    await apiFetch(`${API}/api/admin/users/${user.id}`, { method: 'DELETE' });
    loadUsers();
  };

  // Group history by month for timeline
  const groupedHistory = useMemo(() => {
    const groups = {};
    for (const entry of cookHistory) {
      const d = new Date(entry.cooked_at);
      const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups);
  }, [cookHistory]);

  // Recipe attempts: count per recipe
  const recipeCounts = useMemo(() => {
    const counts = {};
    for (const entry of cookHistory) {
      const key = entry.recipe_id || entry.recipe_name;
      if (!key) continue;
      if (!counts[key]) counts[key] = { name: entry.recipe_name, id: entry.recipe_id, count: 0, lastCooked: null };
      counts[key].count++;
      const d = new Date(entry.cooked_at);
      if (!counts[key].lastCooked || d > counts[key].lastCooked) counts[key].lastCooked = d;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [cookHistory]);

  // Calendar: cook dates for current month
  const cookDatesInMonth = useMemo(() => {
    const { year, month } = calendarDate;
    const set = {};
    for (const entry of cookHistory) {
      const d = new Date(entry.cooked_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!set[day]) set[day] = [];
        const r = recipes.find(r => r.id === entry.recipe_id);
        set[day].push(r?.name || entry.recipe_name || 'Unknown');
      }
    }
    return set;
  }, [cookHistory, calendarDate, recipes]);

  const getRecipeName = (entry) => {
    const r = recipes.find(r => r.id === entry.recipe_id);
    return r?.name || entry.recipe_name || 'Unknown Recipe';
  };

  const prevMonth = () => setCalendarDate(p => p.month === 0 ? { year: p.year-1, month: 11 } : { ...p, month: p.month-1 });
  const nextMonth = () => setCalendarDate(p => p.month === 11 ? { year: p.year+1, month: 0 } : { ...p, month: p.month+1 });
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <main className="view profile-view">
      {showAddFriend && (
        <AddFriendModal
          authFetch={authFetch}
          onClose={() => setShowAddFriend(false)}
          onCreated={(uname) => { setAddFriendSuccess(`Account created for ${uname} ✓`); loadUsers(); setTimeout(() => setAddFriendSuccess(''), 4000); }}
        />
      )}
      {/* -- User header -- */}
      <div className="profile-header">
        <div style={{ flex: 1 }}>
          {editingDisplayName ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                autoFocus
                className="login-modal__input"
                style={{ margin: 0, flex: '1 1 140px', padding: '6px 10px', fontSize: '0.9rem' }}
                placeholder="Display name (or leave blank to use username)"
                value={draftDisplayName}
                onChange={e => setDraftDisplayName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveDisplayName(); if (e.key === 'Escape') setEditingDisplayName(false); }}
              />
              <button onClick={handleSaveDisplayName} disabled={savingDisplayName} className="display-name-save-btn">
                {savingDisplayName ? '...' : '✓ Save'}
              </button>
              <button onClick={() => setEditingDisplayName(false)} className="display-name-cancel-btn">
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="profile-header__title" style={{ margin: 0 }}>{authUser?.display_name || authUser?.username || 'Your Kitchen'}</h2>
              <button onClick={() => { setDraftDisplayName(authUser?.display_name || ''); setEditingDisplayName(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }} title="Edit display name">✎</button>
            </div>
          )}
          <p className="profile-header__sub" style={{ marginTop: 2 }}>
            {authUser?.display_name ? <span style={{ color: 'var(--warm-gray)', fontSize: '0.8rem' }}>@{authUser.username} · </span> : null}
            {totalRecipes} recipes · {cookHistory.length} times cooked{isAdmin ? ' · admin' : ''}
          </p>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 999, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--warm-gray)', cursor: 'pointer', flexShrink: 0 }}>
          Sign out
        </button>
      </div>

      {/* -- 1. Cooking History -- */}
      <section className="profile-section profile-section--collapsible">
        <button className="profile-settings-toggle" onClick={() => setHistoryOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="calendar" size={15} strokeWidth={2} /> Cooking History</span>
          <div className="profile-settings-toggle__right">
            {cookHistory.length > 0 && historyOpen && (
              <div className="history-view-toggle" onClick={e => e.stopPropagation()}>
                <button className={`history-view-toggle__btn ${historyView==='timeline'?'history-view-toggle__btn--on':''}`} onClick={() => setHistoryView('timeline')} title="Timeline view">☰</button>
                <button className={`history-view-toggle__btn ${historyView==='calendar'?'history-view-toggle__btn--on':''}`} onClick={() => setHistoryView('calendar')} title="Calendar view">▦</button>
              </div>
            )}
            <span className={`profile-settings-toggle__arrow ${historyOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>▾</span>
          </div>
        </button>

        {historyOpen && (
          <div className="profile-settings-body">
            {historyLoading ? (
              <div className="grocery-loading"><div className="loading-spinner" /><p>Loading history...</p></div>
            ) : cookHistory.length === 0 ? (
              <div className="profile-empty">
                <span className="profile-empty__icon"><Icon name="chefHat" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
                <p className="profile-empty__text">No cooking history yet. Mark a recipe as cooked to start your log!</p>
              </div>
            ) : historyView === 'timeline' ? (
              <div className="cook-timeline cook-timeline--scrollable">
                {groupedHistory.map(([month, entries]) => (
                  <div key={month} className="cook-timeline__month-group">
                    <div className="cook-timeline__month-label">{month}</div>
                    {entries.map((entry, i) => {
                      const d = new Date(entry.cooked_at);
                      const recipeName = getRecipeName(entry);
                      const recipe = recipes.find(r => r.id === entry.recipe_id);
                      return (
                        <div key={entry.id || i} className="cook-timeline__entry">
                          <div className="cook-timeline__dot" />
                          <div className="cook-timeline__line" />
                          <div className="cook-timeline__card">
                            <div className="cook-timeline__card-top">
                              {recipe?.coverImage ? (
                                <img className="cook-timeline__thumb" src={recipe.coverImage} alt={recipeName} />
                              ) : (
                                <div className="cook-timeline__thumb cook-timeline__thumb--placeholder"><Icon name="chefHat" size={18} color="var(--ash)" strokeWidth={1.5} /></div>
                              )}
                              <div className="cook-timeline__info">
                                <p className="cook-timeline__recipe-name">{recipeName}</p>
                                <p className="cook-timeline__date">{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                {entry.rating > 0 && (
                                  <div className="cook-timeline__rating">
                                    {'★'.repeat(entry.rating)}<span className="cook-timeline__rating-empty">{'★'.repeat(5 - entry.rating)}</span>
                                    <span className="cook-timeline__rating-label">{STAR_LABELS[entry.rating]}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {entry.notes && <p className="cook-timeline__notes">"{entry.notes}"</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="cook-calendar cook-calendar--gcal">
                <div className="cook-calendar__nav">
                  <button className="cook-calendar__nav-btn" onClick={prevMonth}>‹</button>
                  <span className="cook-calendar__month-label">{MONTH_NAMES[calendarDate.month]} {calendarDate.year}</span>
                  <button className="cook-calendar__nav-btn" onClick={nextMonth}>›</button>
                </div>
                <div className="cook-calendar__gcal-grid">
                  {DAY_NAMES.map(d => <div key={d} className="cook-calendar__gcal-day-header">{d}</div>)}
                  {Array.from({ length: getFirstDayOfMonth(calendarDate.year, calendarDate.month) }).map((_, i) => (
                    <div key={`empty-${i}`} className="cook-calendar__gcal-cell cook-calendar__gcal-cell--empty" />
                  ))}
                  {Array.from({ length: getDaysInMonth(calendarDate.year, calendarDate.month) }).map((_, i) => {
                    const day = i + 1;
                    const cooked = cookDatesInMonth[day];
                    const isToday = (() => { const t = new Date(); return t.getFullYear() === calendarDate.year && t.getMonth() === calendarDate.month && t.getDate() === day; })();
                    return (
                      <div key={day} className={`cook-calendar__gcal-cell ${cooked ? 'cook-calendar__gcal-cell--cooked' : ''} ${isToday ? 'cook-calendar__gcal-cell--today' : ''}`}>
                        <span className={`cook-calendar__gcal-date ${isToday ? 'cook-calendar__gcal-date--today' : ''}`}>{day}</span>
                        {cooked && cooked.map((name, j) => (
                          <div key={j} className="cook-calendar__gcal-event" title={name}>
                            <span className="cook-calendar__gcal-event-dot"><Icon name="chefHat" size={11} strokeWidth={1.75} color="var(--sage)" /></span>
                            <span className="cook-calendar__gcal-event-name">{name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* -- 2. Recipe Attempts -- */}
      <section className="profile-section profile-section--collapsible">
        <button className="profile-settings-toggle" onClick={() => setAttemptsOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="repeat" size={15} strokeWidth={2} /> Recipe Attempts</span>
          <span className={`profile-settings-toggle__arrow ${attemptsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>▾</span>
        </button>
        {attemptsOpen && (
          <div className="profile-attempts">
            {recipeCounts.length === 0 ? (
              <div className="profile-settings-body">
                <div className="profile-empty">
                  <span className="profile-empty__icon"><Icon name="repeat" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
                  <p className="profile-empty__text">No recipe attempts yet. Start cooking to track how often you make each dish!</p>
                </div>
              </div>
            ) : (
              <div className="attempts-list attempts-list--scrollable">
                {recipeCounts.map((item, i) => {
                  const recipe = recipes.find(r => r.id === item.id);
                  return (
                    <div key={item.id || i} className="attempts-row">
                      {recipe?.coverImage && <img className="attempts-row__thumb" src={recipe.coverImage} alt={item.name} />}
                      <div className="attempts-row__info">
                        <span className="attempts-row__name">{item.name}</span>
                        {item.lastCooked && <span className="attempts-row__last">Last: {item.lastCooked.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      </div>
                      <div className="attempts-row__count">
                        <span className="attempts-row__num">{item.count}</span>
                        <span className="attempts-row__label">{item.count === 1 ? 'time' : 'times'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* -- 3. Sharing Options (admin only) -- */}
      {isAdmin && (
        <section className="profile-section profile-section--collapsible">
          <button className="profile-settings-toggle" onClick={() => setSharingOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="users" size={15} strokeWidth={2} /> Sharing Options</span>
            <span className={`profile-settings-toggle__arrow ${sharingOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>▾</span>
          </button>
          {sharingOpen && (
            <div className="profile-settings-body">

              {/* Header row: title + Add Friend button */}
              <div className="settings-section" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h4 className="settings-section__title" style={{ margin: 0 }}><Icon name="userCircle" size={15} strokeWidth={2} /> Current Users</h4>
                  <button
                    onClick={() => { setAddFriendSuccess(''); setShowAddFriend(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    <Icon name="userCircle" size={14} strokeWidth={2} /> Add Friend
                  </button>
                </div>
                {addFriendSuccess && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem', color: '#166534', marginBottom: 10 }}>
                    {addFriendSuccess}
                  </div>
                )}
                {usersLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Loading...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 6 }}>
                    {users.map(u => (
                      <div key={u.id} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--cream)', overflow: 'hidden' }}>
                        {/* Top row: avatar + name + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'suspended' ? '#c8c3bc' : u.role === 'admin' ? 'var(--terracotta)' : 'var(--sage)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                            {(u.display_name || u.username)?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {u.display_name || u.username}
                              <button
                                className={`admin-pill-toggle ${u.role === 'admin' ? 'admin-pill-toggle--on' : 'admin-pill-toggle--off'}`}
                                title={u.role === 'admin' ? 'Revoke admin access' : 'Grant admin access'}
                                onClick={async () => {
                                  const isAdminNow = u.role === 'admin';
                                  const msg = isAdminNow
                                    ? `Remove admin from ${u.display_name || u.username}?`
                                    : `Make ${u.display_name || u.username} an admin? They'll be able to add/edit recipes.`;
                                  if (!window.confirm(msg)) return;
                                  await apiFetch(`${API}/api/admin/users/${u.id}`, {
                                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ role: isAdminNow ? 'guest' : 'admin' }),
                                  });
                                  loadUsers();
                                }}
                              >
                                <span className="admin-pill-toggle__track"><span className="admin-pill-toggle__thumb" /></span>
                                <span className="admin-pill-toggle__label">Admin</span>
                              </button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--warm-gray)' }}>
                              {u.display_name ? `@${u.username} · ` : ''}<span style={{ textTransform: 'capitalize' }}>{u.role}</span>
                            </div>
                          </div>
                          {u.role !== 'admin' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                              <button onClick={() => handleSuspend(u)} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--warm-white)', cursor: 'pointer', color: u.role === 'suspended' ? 'var(--sage)' : 'var(--warm-gray)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {u.role === 'suspended' ? 'Restore' : 'Suspend'}
                              </button>
                              <button onClick={() => handleDelete(u)} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 999, border: '1px solid #f5c2b8', background: '#fff0ee', cursor: 'pointer', color: 'var(--terracotta-dark, #b84a2e)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Password row */}
                        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--warm-white)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--warm-gray)', flexShrink: 0 }}>Password:</span>
                          <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', flex: 1, minWidth: 60, color: revealedPasswords[u.id] ? 'var(--charcoal)' : 'transparent', textShadow: revealedPasswords[u.id] ? 'none' : '0 0 6px rgba(0,0,0,0.35)', userSelect: revealedPasswords[u.id] ? 'text' : 'none', transition: 'all 0.2s' }}>
                            {u.password || '--'}
                          </span>
                          <button onClick={() => toggleReveal(u.id)} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--warm-gray)', flexShrink: 0 }}>
                            {revealedPasswords[u.id] ? 'Hide' : 'Reveal'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="profile-section profile-section--collapsible" style={{ marginBottom: 12 }}>
          <button className="profile-settings-toggle" onClick={() => setAdminToolsOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="tool" size={15} strokeWidth={2} /> Admin Tools</span>
            <span className={`profile-settings-toggle__arrow ${adminToolsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>▾</span>
          </button>
          {adminToolsOpen && (
            <div className="profile-settings-body">

              <div className="settings-section">
                <h4 className="settings-section__title"><Icon name="repeat" size={15} strokeWidth={2} /> Recalculate Nutrition</h4>
                <p className="settings-section__hint">Clears all pre-populated calories/protein/fiber and recalculates from each recipe's ingredients. Run this once to clear old data -- only recipes whose ingredients have nutrition info will get values.</p>
                <button
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 10, marginBottom: 16 }}
                  disabled={recalcRunning}
                  onClick={async () => {
                    if (!window.confirm('This will clear ALL existing calories/protein/fiber from every recipe and recalculate from ingredients. Continue?')) return;
                    setRecalcRunning(true); setRecalcResult(null);
                    try {
                      const res = await apiFetch(`${API}/api/admin/recalculate-nutrition`, { method: 'POST' });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed');
                      setRecalcResult(`✓ Done -- updated ${data.updated} of ${data.total} recipes`);
                    } catch (e) { setRecalcResult(`⚠️ ${e.message}`); }
                    setRecalcRunning(false);
                  }}
                >{recalcRunning ? 'Running...' : 'Recalculate All Nutrition'}</button>
                {recalcResult && <p style={{ marginTop: 10, fontSize: '0.85rem', color: recalcResult.startsWith('✓') ? 'var(--sage)' : 'var(--terracotta)' }}>{recalcResult}</p>}
              </div>

            </div>
          )}
        </section>
      )}

      {/* -- 4. Settings -- */}
      <section className="profile-section profile-section--settings">
        <button className="profile-settings-toggle" onClick={() => setSettingsOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="settings" size={15} strokeWidth={2} /> Settings</span>
          <span className={`profile-settings-toggle__arrow ${settingsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>▾</span>
        </button>

        {settingsOpen && (
          <div className="profile-settings-body">

            <div className="settings-section">
              <h4 className="settings-section__title"><Icon name="moon" size={15} strokeWidth={2} /> Appearance</h4>
              <p className="settings-section__hint">Switch between light and dark mode</p>
              <div className="dark-mode-toggle-row">
                <span className="dark-mode-toggle__label"><Icon name="sun" size={14} strokeWidth={2} /> Light</span>
                <button
                  className={`dark-mode-toggle__btn ${darkMode ? 'dark-mode-toggle__btn--on' : ''}`}
                  onClick={() => setDarkMode && setDarkMode(!darkMode)}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  type="button"
                >
                  <span className="dark-mode-toggle__track">
                    <span className="dark-mode-toggle__thumb" />
                  </span>
                </button>
                <span className="dark-mode-toggle__label"><Icon name="moon" size={14} strokeWidth={2} /> Dark</span>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="settings-section__title"><Icon name="leaf" size={15} strokeWidth={2} /> Dietary Restrictions</h4>
              <p className="settings-section__hint">Active filters warn you about conflicting ingredients on recipe pages</p>
              <div className="picker__chips" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                {DIETARY_OPTIONS.map(d => (
                  <button key={d} className={`chip ${dietaryFilters.includes(d) ? 'chip--selected' : ''}`} onClick={() => toggleDiet(d)}>
                    {dietaryFilters.includes(d) && <span className="chip__check">✓</span>}{d}
                  </button>
                ))}
              </div>
              {dietaryFilters.length > 0 && (
                <label className="dietary-hide-toggle" style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={hideIncompatible} onChange={e => setHideIncompatible(e.target.checked)} style={{ width:16, height:16, cursor:'pointer' }} />
                  <span>Hide incompatible recipes from library</span>
                </label>
              )}
            </div>

            <div className="settings-section settings-section--about">
              <h4 className="settings-section__title"><Icon name="lightbulb" size={15} strokeWidth={2} /> About Hearth</h4>
              <div className="about-cards">
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="barChart" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">{totalRecipes}</div>
                    <div className="about-card__label">Recipes</div>
                  </div>
                </div>
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="chefHat" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">{cookHistory.length}</div>
                    <div className="about-card__label">Times Cooked</div>
                  </div>
                </div>
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="zap" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">v1.0</div>
                    <div className="about-card__label">Version</div>
                  </div>
                </div>
                <div className="about-card">
                  <span className="about-card__icon"><Icon name="barChart" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
                  <div>
                    <div className="about-card__value">Supabase</div>
                    <div className="about-card__label">Database</div>
                  </div>
                </div>
              </div>
              <div className="about-stack-github-row">
                <a className="about-github-btn" href="https://github.com/kavyasomala/Hearth" target="_blank" rel="noopener noreferrer">
                  <svg className="about-github-btn__icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
                <div className="about-stack">
                  <span className="about-stack__badge">React</span>
                  <span className="about-stack__badge">Node.js</span>
                  <span className="about-stack__badge">PostgreSQL</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </section>
    </main>
  );
};

// --- Grocery List Tab --------------------------------------------------------

// Unit conversion to a common base (grams for weight, ml for volume)
const UNIT_CONVERSIONS = {
  // weight → grams
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, pound: 453.592, pounds: 453.592,
  // volume → ml
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  cup: 236.588, cups: 236.588,
  'fl oz': 29.5735, 'fluid oz': 29.5735,
};
const WEIGHT_UNITS = new Set(['g','gram','grams','kg','kilogram','kilograms','oz','ounce','ounces','lb','pound','pounds']);
const VOLUME_UNITS = new Set(['ml','milliliter','milliliters','l','liter','liters','litre','litres','tsp','teaspoon','teaspoons','tbsp','tablespoon','tablespoons','cup','cups','fl oz','fluid oz']);

const unitType = (u) => {
  const l = (u||'').toLowerCase().trim();
  if (WEIGHT_UNITS.has(l)) return 'weight';
  if (VOLUME_UNITS.has(l)) return 'volume';
  return 'other';
};

// Format grams back to a readable unit
const formatWeight = (g) => {
  if (g >= 900) return `${(g/1000).toFixed(2).replace(/\.?0+$/,'')} kg`;
  return `${Math.round(g)} g`;
};
const formatVolume = (ml) => {
  if (ml >= 900) return `${(ml/1000).toFixed(2).replace(/\.?0+$/,'')} L`;
  if (ml >= 14) return `${(ml/236.588).toFixed(2).replace(/\.?0+$/,'')} cups`;
  if (ml >= 5) return `${(ml/14.7868).toFixed(2).replace(/\.?0+$/,'')} tbsp`;
  return `${(ml/4.92892).toFixed(2).replace(/\.?0+$/,'')} tsp`;
};

// Consolidate items with same name, merging amounts where possible
const consolidateItems = (items) => {
  const map = {};
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (!map[key]) { map[key] = { ...item, _sources: [...(item._sources||[item])] }; continue; }
    const existing = map[key];
    const amt1 = parseFloat(existing.amount) || 0;
    const amt2 = parseFloat(item.amount) || 0;
    const t1 = unitType(existing.unit);
    const t2 = unitType(item.unit);
    if (t1 === t2 && t1 !== 'other' && t1 !== '') {
      // Convert both to base unit and sum
      const base1 = amt1 * (UNIT_CONVERSIONS[(existing.unit||'').toLowerCase().trim()] || 1);
      const base2 = amt2 * (UNIT_CONVERSIONS[(item.unit||'').toLowerCase().trim()] || 1);
      const total = base1 + base2;
      const formatted = t1 === 'weight' ? formatWeight(total) : formatVolume(total);
      const parts = formatted.split(' ');
      existing.amount = parts[0];
      existing.unit = parts.slice(1).join(' ');
      existing._sources.push(item);
    } else if (!existing.unit && !item.unit && amt1 && amt2) {
      existing.amount = String(amt1 + amt2);
      existing._sources.push(item);
    } else {
      // Can't merge -- append note
      const extra = [item.amount, item.unit].filter(Boolean).join(' ');
      existing._extra = existing._extra ? `${existing._extra} + ${extra}` : extra;
      existing._sources.push(item);
    }
  }
  return Object.values(map);
};

const GroceryListTab = ({ recipes, makeSoonIds, allMyIngredients, allIngredients, setFridgeIngredients, setPantryStaples }) => {
  const [categories, setCategories] = useState([]);
  const [recipeNames, setRecipeNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [error, setError] = useState(null);
  const [hideInKitchen, setHideInKitchen] = useState(false);

  const makeSoonRecipes = useMemo(() => recipes.filter(r => makeSoonIds.includes(r.id)), [recipes, makeSoonIds]);

  // Consolidate items per category
  const consolidatedCategories = useMemo(() =>
    categories.map(cat => ({ ...cat, items: consolidateItems(cat.items) })),
  [categories]);

  const toggleChecked = (key, itemName) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Auto-add to kitchen
        const lower = itemName.toLowerCase().trim();
        const known = allIngredients?.find(i => (typeof i === 'string' ? i : i.name).toLowerCase() === lower);
        const isFridgeType = known && typeof known === 'object' && ['produce','meat & fish','dairy'].includes(known.type);
        if (isFridgeType) {
          setFridgeIngredients(prev2 => prev2.includes(lower) ? prev2 : [...prev2, lower]);
        } else {
          setPantryStaples(prev2 => prev2.includes(lower) ? prev2 : [...prev2, lower]);
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!makeSoonIds.length) { setCategories([]); setRecipeNames([]); return; }
    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/grocery-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeIds: makeSoonIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to build list');
        if (!cancelled) {
          setCategories(data.categories || []);
          setRecipeNames(data.recipeNames || []);
          setChecked(new Set());
        }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetch_();
    return () => { cancelled = true; };
  }, [makeSoonIds]);

  const copyList = () => {
    const lines = [`Grocery List -- ${recipeNames.join(', ')}\n`];
    consolidatedCategories.forEach(cat => {
      const items = hideInKitchen
        ? cat.items.filter(item => !allMyIngredients.has(item.name.toLowerCase().trim()))
        : cat.items;
      if (!items.length) return;
      lines.push(`\n${cat.emoji} ${cat.name}`);
      items.forEach(item => {
        const inKitchen = allMyIngredients.has(item.name.toLowerCase().trim());
        const tick = checked.has(`${cat.name}-${item.name}`) || inKitchen ? '✓' : '○';
        const amount = [item.amount, item.unit].filter(Boolean).join(' ');
        const extra = item._extra ? ` + ${item._extra}` : '';
        lines.push(`  ${tick} ${amount}${extra} ${item.name}${item.prep_note ? ` (${item.prep_note})` : ''}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  const totalItems = consolidatedCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  const inKitchenCount = consolidatedCategories.reduce((sum, cat) =>
    sum + cat.items.filter(item => allMyIngredients.has(item.name.toLowerCase().trim())).length, 0);
  const checkedCount = checked.size;

  return (
    <main className="view grocery-view">
      <div className="fridge-header grocery-header">
        <div>
          <h2 className="fridge-title">Grocery List</h2>
          {makeSoonRecipes.length > 0 ? (
            <p className="fridge-subtitle">
              Shopping for: <span className="grocery-subtitle__meals">{makeSoonRecipes.map(r => r.name).join(', ')}</span>
            </p>
          ) : (
            <p className="fridge-subtitle">Add recipes to Make Soon to build your list</p>
          )}
        </div>
        {consolidatedCategories.length > 0 && (
          <div className="grocery-header__actions">
            <label className="grocery-toggle" title="Hide ingredients you already have in your kitchen">
              <input type="checkbox" checked={hideInKitchen} onChange={e => setHideInKitchen(e.target.checked)} />
              <span className="grocery-toggle__switch" />

            </label>
            <button className="grocery-copy-btn rp2__cooking-mode-btn" onClick={copyList} title="Copy list to clipboard"><Icon name="fileText" size={14} strokeWidth={2} /> Copy list</button>
          </div>
        )}
      </div>

      {makeSoonRecipes.length === 0 && (
        <div className="grocery-empty">
          <div className="grocery-empty__icon"><Icon name="timer" size={40} color="var(--warm-gray)" strokeWidth={1.5} /></div>
          <h3 className="grocery-empty__title">No recipes in Make Soon</h3>
          <p className="grocery-empty__sub">Tap ⏱ on any recipe to add it to Make Soon -- your grocery list will build automatically.</p>
        </div>
      )}

      {error && <p className="grocery-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {error}</p>}
      {loading && <div className="grocery-loading"><div className="loading-spinner" /><p>Building your list...</p></div>}

      {!loading && consolidatedCategories.length > 0 && (
        <>
          <div className="grocery-progress-bar-wrap">
            <div className="grocery-progress-bar">
              <div className="grocery-progress-fill" style={{ width: totalItems ? `${((checkedCount + inKitchenCount) / totalItems) * 100}%` : '0%' }} />
            </div>
            <span className="grocery-progress-label">{checkedCount + inKitchenCount}/{totalItems} got</span>
          </div>
          {inKitchenCount > 0 && (
            <div className="grocery-kitchen-banner">
              <span>✓ {inKitchenCount} of {totalItems} ingredients already in your kitchen</span>
            </div>
          )}
          <div className="grocery-list">
            {consolidatedCategories.map(cat => {
              const allItems = cat.items;
              const visibleItems = hideInKitchen
                ? allItems.filter(item => !allMyIngredients.has(item.name.toLowerCase().trim()))
                : allItems;
              if (!visibleItems.length) return null;
              return (
                <div key={cat.name} className="grocery-category">
                  <h3 className="grocery-category__title"><Icon name={({Produce:'leaf',Meat:'utensils','Meat & Fish':'utensils',Dairy:'coffee',Sauces:'package',Spices:'zap',Staples:'list',Alcohol:'shuffle'})[cat.name] || 'list'} size={14} strokeWidth={2} /> {cat.name}</h3>
                  <div className="grocery-items">
                    {visibleItems.map(item => {
                      const key = `${cat.name}-${item.name}`;
                      const inKitchen = allMyIngredients.has(item.name.toLowerCase().trim());
                      const isChecked = checked.has(key) || inKitchen;
                      const amountStr = [item.amount, item.unit].filter(Boolean).join(' ');
                      return (
                        <div
                          key={key}
                          className={`grocery-item ${isChecked ? 'grocery-item--checked' : ''} ${inKitchen ? 'grocery-item--in-kitchen' : ''}`}
                          onClick={() => !inKitchen && toggleChecked(key, item.name)}
                        >
                          <div className={`grocery-item__checkbox ${isChecked ? 'grocery-item__checkbox--checked' : ''}`}>
                            {isChecked && '✓'}
                          </div>
                          <div className="grocery-item__body">
                            <span className="grocery-item__name">
                              {amountStr && <span className="grocery-item__amount">{amountStr}</span>}
                              {item._extra && <span className="grocery-item__extra"> + {item._extra}</span>}
                              {' '}{item.name}
                            </span>
                            {item.prep_note && <span className="grocery-item__note">{item.prep_note}</span>}
                            {inKitchen && <span className="grocery-item__kitchen-tag">in kitchen</span>}
                            {!inKitchen && !isChecked && <span className="grocery-item__tap-hint">tap to check off → adds to kitchen</span>}
                            {item.recipes?.length > 1 && !inKitchen && (
                              <span className="grocery-item__recipes">for {item.recipes.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
};


// --- Cooking Notes Tab ------------------------------------------------------
const NOTE_TYPES = ['rule', 'theory', 'shortcut'];
const NOTE_TYPE_META = {
  rule:     { label: 'Rule / Ratio',   emoji: 'ruler',   color: '#f5ece0', border: '#d9c4a8' },
  theory:   { label: 'Theory',         emoji: 'lightbulb', color: '#f5ece0', border: '#d9c4a8' },
  shortcut: { label: 'Shortcut',       emoji: 'zap',     color: '#f0ebe3', border: '#d9c4a8' },
};
const NOTE_CATEGORIES = ['General Technique', 'Pasta', 'Baking', 'Meat & Fish', 'Sauces', 'Eggs', 'Vegetables', 'Bread', 'Desserts', 'Equipment'];

// Auto-extract keywords from a description string
const autoKeywordsFromDescription = (desc) => {
  const STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','being','have','has','had','do','does',
    'did','will','would','could','should','may','might','must','shall','can',
    'it','its','this','that','these','those','i','you','he','she','we','they',
    'not','no','so','if','as','by','from','up','out','more','also','than','then',
    'when','always','never','very','too','just','well','make','use','your','their',
  ]);
  const words = desc.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const seen = new Set();
  const keywords = [];
  for (const w of words) {
    if (w.length >= 4 && !STOP_WORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      keywords.push(w);
      if (keywords.length >= 8) break;
    }
  }
  return keywords;
};

const NoteFormModal = ({ note, onSave, onClose, authFetch }) => {
  const isNew = !note;
  const [form, setForm] = useState({
    title:     note?.title     || '',
    body:      note?.body      || '',
    type:      note?.type      || 'rule',
    image_url: note?.image_url || '',
    keywords:  (note?.keywords || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // When body changes, auto-populate keywords if field is empty or was auto-generated
  const handleBodyChange = (v) => {
    set('body', v);
    // Only auto-generate if user hasn't manually edited keywords
    const autoKw = autoKeywordsFromDescription(v).join(', ');
    setForm(p => ({ ...p, body: v, keywords: autoKw }));
  };

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim())  { setError('Description is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        title:     form.title.trim(),
        body:      form.body.trim(),
        type:      form.type,
        category:  note?.category || 'General Technique',
        image_url: form.image_url.trim() || null,
        keywords:  form.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        bullets:   [],
      };
      const url = isNew ? `${API}/api/cooking-notes` : `${API}/api/cooking-notes/${note.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave(data.note);
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title">{isNew ? 'Add Cooking Note' : 'Edit Note'}</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap: 14 }}>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Title <span className="create-modal__required">*</span></label>
            <input className="editor-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Pasta water salinity" autoFocus={isNew} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {NOTE_TYPES.map(t => (
                <button key={t} className={`chip ${form.type === t ? 'chip--selected' : ''}`} onClick={() => set('type', t)}>
                  {form.type === t && <span className="chip__check">✓</span>}<Icon name={NOTE_TYPE_META[t].emoji} size={13} strokeWidth={2} /> {NOTE_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Description <span className="create-modal__required">*</span></label>
            <textarea className="editor-textarea" value={form.body} onChange={e => handleBodyChange(e.target.value)} placeholder="Describe the rule, technique, or tip..." rows={4} style={{ resize: 'vertical' }} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Tooltip keywords <span style={{opacity:0.6, fontWeight:400}}>auto-generated · edit freely</span></label>
            <input className="editor-input" value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="e.g. pasta, salt, water, boil" />
            <p className="create-modal__field-hint" style={{ marginTop: 4 }}>These words trigger this note as a tooltip on recipe steps.</p>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Image URL <span style={{opacity:0.6, fontWeight:400}}>optional</span></label>
            <input className="editor-input" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
          </div>
          {error && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {error}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : isNew ? '+ Add Note' : '✓ Save'}</button>
        </div>
      </div>
    </div>
  );
};

const NoteCard = ({ note, isAdmin, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.rule;
  return (
    <div className="cn-card" style={{ '--cn-bg': meta.color, '--cn-border': meta.border }}>
      <div className="cn-card__header" onClick={() => setExpanded(e => !e)}>
        <span className="cn-card__type-badge"><Icon name={meta.emoji} size={13} strokeWidth={2} /></span>
        <span className="cn-card__title">{note.title}</span>
        <span className="cn-card__chevron">{expanded ? '▴' : '▾'}</span>
        {isAdmin && (
          <div className="cn-card__actions" onClick={e => e.stopPropagation()}>
            <button className="cn-card__action-btn" onClick={onEdit} title="Edit">✎</button>
            <button className="cn-card__action-btn cn-card__action-btn--del" onClick={onDelete} title="Delete">✕</button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="cn-card__body">
          <p className="cn-card__text">{note.body}</p>
          {note.bullets?.length > 0 && (
            <ul className="cn-card__bullets">
              {note.bullets.map((b, i) => <li key={i}>{b.text}</li>)}
            </ul>
          )}
          {note.image_url && <img src={note.image_url} alt="" className="cn-card__img" />}
          {note.keywords?.length > 0 && (
            <div className="cn-card__keywords">
              {note.keywords.map(k => <span key={k} className="cn-card__keyword">#{k}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CookingNotesTab = ({ notes, setNotes, authFetch, isAdmin }) => {
  const [editingNote, setEditingNote] = useState(null); // null = closed, false = new, obj = editing
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(notes.map(n => n.category).filter(Boolean))].sort((a, b) => a === 'All' ? -1 : a.localeCompare(b));
    return cats;
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notes.filter(n => {
      if (activeCategory !== 'All' && n.category !== activeCategory) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) ||
        (n.keywords || []).some(k => k.includes(q)) ||
        (n.bullets || []).some(b => b.text.toLowerCase().includes(q));
    });
  }, [notes, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const n of filtered) {
      const cat = n.category || 'General Technique';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(n);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleSave = (saved) => {
    setNotes(prev => {
      const exists = prev.find(n => n.id === saved.id);
      return exists ? prev.map(n => n.id === saved.id ? saved : n) : [...prev, saved];
    });
    setEditingNote(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await authFetch(`${API}/api/cooking-notes/${deleteTarget.id}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== deleteTarget.id));
    } catch {}
    setDeleteTarget(null);
  };

  return (
    <main className="view cn-tab">
      {editingNote !== null && (
        <NoteFormModal
          note={editingNote === false ? null : editingNote}
          onSave={handleSave}
          onClose={() => setEditingNote(null)}
          authFetch={authFetch}
        />
      )}
      {deleteTarget && (
        <div className="create-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <p>Delete <strong>"{deleteTarget.title}"</strong>?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn--ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="cn-tab__header">
        <div className="cn-tab__title-row">
          <h1 className="cn-tab__title">Cooking Notes</h1>
          {isAdmin && (
            <button className="btn btn--primary btn--sm" onClick={() => setEditingNote(false)}>+ Add Note</button>
          )}
        </div>
        <p className="cn-tab__subtitle">Rules, ratios, and theory -- the things that make cooking click.</p>
        <input className="editor-input cn-tab__search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." />
      </div>

      {notes.length === 0 ? (
        <div className="cn-tab__empty">
          <p>No notes yet.{isAdmin ? ' Add your first cooking note!' : ''}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="cn-tab__empty"><p>No notes match your search.</p></div>
      ) : (
        <div className="cn-tab__groups">
          {grouped.map(([cat, catNotes]) => (
            <div key={cat} className="cn-group">
              <h2 className="cn-group__title">{cat}</h2>
              <div className="cn-group__cards">
                {catNotes.map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    isAdmin={isAdmin}
                    onEdit={() => setEditingNote(n)}
                    onDelete={() => setDeleteTarget(n)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

// --- Site Footer ------------------------------------------------------------
const GITHUB_REPO = 'kavyasomala/RecipeApp'; // update with actual repo path

const SiteFooter = ({ onNav }) => {
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=1`)
      .then(r => r.json())
      .then(data => {
        const date = data?.[0]?.commit?.committer?.date;
        if (date) setLastUpdated(new Date(date));
      })
      .catch(() => {});
  }, []);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* Brand + tagline */}
        <div className="site-footer__brand">
          <div className="site-footer__logo"><Icon name="flame" size={16} color="var(--terracotta)" strokeWidth={1.75} /> Hearth</div>
          <p className="site-footer__tagline">A cozy corner for every recipe<br/>you love, tweak, and return to.</p>
        </div>

        {/* Nav columns */}
        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Recipes</h4>
          <ul className="site-footer__links">
            <li><button onClick={() => onNav('recipes')}>Browse recipes</button></li>
            <li><button onClick={() => onNav('home')}>Favorites</button></li>
            <li><button onClick={() => onNav('profile')}>Show cooked</button></li>
          </ul>
        </div>

        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Kitchen</h4>
          <ul className="site-footer__links">
            <li><button onClick={() => onNav('kitchen')}>What's in my kitchen</button></li>
            <li><button onClick={() => onNav('grocery')}>Grocery list</button></li>
            <li><button onClick={() => onNav('cookbooks')}>My cookbooks</button></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="site-footer__bottom">
        <span className="site-footer__credit">Built by Kavya <Icon name="heart" size={13} color="var(--terracotta)" strokeWidth={2} /></span>
        <span className="site-footer__updated">
          {lastUpdated ? `Last updated ${fmt(lastUpdated)}` : 'Last updated --'}
        </span>
      </div>
    </footer>
  );
};

// --- Cookbooks Tab ---------------------------------------------------------
// --- Cookbook helpers --------------------------------------------------------
const COOKBOOK_SORTS = [
  { key: 'page',   label: 'Page #' },
  { key: 'alpha',  label: 'A-Z' },
  { key: 'recent', label: 'Recently Added' },
];

// --- Add Reference Modal -----------------------------------------------------
const AddReferenceModal = ({ onSave, onClose, allTags, cookbookTitle = '', authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [name, setName]       = useState('');
  const [page, setPage]       = useState('');
  const [image, setImage]     = useState('');
  const [tags, setTags]       = useState([]);
  const [cuisine, setCuisine] = useState('');
  const [time, setTime]       = useState('');
  const [servings, setServings] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein]   = useState('');
  const [fiber, setFiber]       = useState('');
  const [status, setStatus]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgErr, setImgErr]     = useState(false);

  const toggle = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // Save directly to DB so it gets a real recipe_id for cook_log
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const payload = {
        details: {
          name: name.trim(),
          cuisine: cuisine || null,
          time: time.trim() || null,
          servings: servings.trim() || null,
          calories: calories !== '' ? Number(calories) : null,
          protein:  protein  !== '' ? Number(protein)  : null,
          fiber:    fiber    !== '' ? Number(fiber)     : null,
          cover_image_url: image.trim() || null,
          cookbook: cookbookTitle || null,
          reference: page.trim() || null,
          status: status || 'to try',
          tags,
        },
        ingredients: [],
        instructions: [],
        notes: [],
      };
      const res = await apiFetch(`${API}/api/recipes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave({ name: name.trim(), page: page.trim(), image: image.trim(), tags, recipeId: data.recipe.id, addedAt: Date.now() });
    } catch (e) { setSaveError(e.message); setSaving(false); }
  };

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="bookMarked" size={18} strokeWidth={2} /> Add Reference</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap: 14 }}>
          {/* Name + Page */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Roast Chicken" autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label">Page number</label>
              <input className="editor-input" value={page} onChange={e => setPage(e.target.value)} placeholder="e.g. 142" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label>
              <input className="editor-input" value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 45 mins" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label>
              <input className="editor-input" value={servings} onChange={e => setServings(e.target.value)} placeholder="e.g. 4" />
            </div>
          </div>

          {/* Nutrition row */}
          <div style={{ display:'flex', gap:12 }}>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="zap" size={13} strokeWidth={2} /> Calories</label>
              <input className="editor-input" type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="kcal" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="dumbbell" size={13} strokeWidth={2} /> Protein (g)</label>
              <input className="editor-input" type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="g" />
            </div>
            <div className="create-modal__field" style={{ flex:1 }}>
              <label className="create-modal__field-label"><Icon name="leaf" size={13} strokeWidth={2} /> Fiber (g)</label>
              <input className="editor-input" type="number" value={fiber} onChange={e => setFiber(e.target.value)} placeholder="g" />
            </div>
          </div>

          {/* Image */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Image URL <span style={{opacity:.5,fontWeight:400}}>(optional)</span></label>
            <input className="editor-input" value={image} onChange={e => { setImage(e.target.value); setImgErr(false); }} placeholder="https://..." />
            {image && !imgErr && <img src={image} alt="" onError={() => setImgErr(true)} style={{ width:72, height:72, objectFit:'cover', borderRadius:8, marginTop:6, border:'1.5px solid var(--border)' }} />}
          </div>

          {/* Cuisine chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {ALL_CUISINES.map(c => (
                <button key={c} className={`chip ${cuisine === c ? 'chip--selected' : ''}`} onClick={() => setCuisine(p => p === c ? '' : c)} type="button">
                  {cuisine === c && <span className="chip__check">✓</span>}{c}
                </button>
              ))}
            </div>
          </div>

          {/* Status/Progress chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Progress</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {[
                { key: 'to try',        label: 'To Try' },
                { key: 'complete',      label: 'Complete' },
                { key: 'needs tweaking',label: 'Needs Tweaking' },
                { key: 'incomplete',     label: 'Incomplete' },
              ].map(({ key, label }) => (
                <button key={key} className={`chip ${status === key ? 'chip--selected' : ''}`} onClick={() => setStatus(p => p === key ? '' : key)} type="button">
                  {status === key && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Tags</label>
            <div className="picker__chips" style={{ marginTop:6 }}>
              {TAG_FILTERS.map(({ key, label }) => (
                <button key={key} className={`chip ${tags.includes(key) ? 'chip--selected' : ''}`} onClick={() => toggle(key)} type="button">
                  {tags.includes(key) && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!name.trim() || saving}>
            {saving ? 'Adding...' : 'Add Reference'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Quick Add Modal ----------------------------------------------------------
const QuickAddModal = ({ onSave, onClose }) => {
  const [rows, setRows] = useState([{id:1,name:'',page:''},{id:2,name:'',page:''},{id:3,name:'',page:''}]);
  const nextId = useRef(4);
  const upd = (id,k,v) => setRows(p => p.map(r => r.id===id ? {...r,[k]:v} : r));
  const addRow = () => setRows(p => [...p, {id: nextId.current++, name:'', page:''}]);
  const rmRow  = id => setRows(p => p.filter(r => r.id !== id));
  const valid  = rows.filter(r => r.name.trim());
  const save   = () => { if (!valid.length) return; onSave(valid.map(r => ({ name: r.name.trim(), page: r.page.trim(), image:'', tags:[], recipeId:null, addedAt:Date.now() }))); };
  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="zap" size={18} strokeWidth={2} /> Quick Add</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap:8 }}>
          <p style={{ fontSize:13, color:'var(--warm-gray)', marginBottom:4 }}>Add multiple recipes at once -- leave rows blank to skip.</p>
          <div style={{ display:'flex', gap:8, padding:'0 0 4px', fontWeight:600, fontSize:12, color:'var(--warm-gray)' }}>
            <span style={{ flex:3 }}>Recipe name</span><span style={{ width:90 }}>Page #</span><span style={{ width:28 }} />
          </div>
          {rows.map((row,i) => (
            <div key={row.id} style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input className="editor-input" style={{ flex:3 }} value={row.name} onChange={e => upd(row.id,'name',e.target.value)} placeholder={`Recipe ${i+1}`} />
              <input className="editor-input" style={{ width:90 }} value={row.page} onChange={e => upd(row.id,'page',e.target.value)} placeholder="Page #" />
              {rows.length > 1 && <button className="editor-remove-btn" onClick={() => rmRow(row.id)}>✕</button>}
            </div>
          ))}
          <button className="btn btn--ghost editor-add-btn" onClick={addRow} style={{ marginTop:4 }}>+ Add row</button>
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!valid.length}>✓ Add {valid.length || ''} Recipes</button>
        </div>
      </div>
    </div>
  );
};

// --- Convert to Full Recipe Modal ---------------------------------------------
// --- Convert to Full Recipe Modal ---------------------------------------------
// Identical form to AddRecipeTab's create modal, pre-filled with cookbook entry data
const ConvertRecipeModal = ({ entry, cookbookTitle, allIngredients = [], onConverted, onClose, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();

  const [details, setDetails] = useState({
    name: entry.name || '',
    cuisine: '',
    time: '',
    servings: '',
    calories: '',
    protein: '',
    cover_image_url: entry.image || '',
    cookbook: cookbookTitle || '',
    reference: entry.page || '',
    status: 'to try',
    recipe_incomplete: false,
    tags: entry.tags || [],
  });
  const [ings, setIngs]           = useState([]);
  const [steps, setSteps]         = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgPreviewError, setImgPreviewError] = useState(false);

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const toggleTag = (tag) => setDetails(prev => ({
    ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  const addIng    = () => setIngs(prev => [...prev, { _id: `ing-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); });
    }
  };
  const addStep    = () => setSteps(prev => [...prev, { _id: `step-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null }]);
  const addTimerAfterStep = (afterId) => setSteps(prev => { const idx = prev.findIndex(s => s._id === afterId); const t = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' }; const n = [...prev]; n.splice(idx+1, 0, t); return n; });
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); }); };
  const addNote    = () => setNotesList(prev => [...prev, { _id: `note-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));
  const groupLabels = [...new Set(ings.filter(i => !i._isGroup).map(i => i.group_label).filter(Boolean))];
  

  const save = async () => {
    if (!details.name.trim()) { setSaveError('Recipe name is required.'); return; }
    setSaving(true); setSaveError(null);
    try {
      const nutrition = calcNutrition(ings, allIngredients);
      // Flatten groups
      let grp = '';
      const flatIngs = ings.map(i => {
        if (i._isGroup) { grp = i.name || ''; return null; }
        return { ...i, group_label: grp };
      }).filter(Boolean);

      const payload = {
        details: {
          name: details.name, cuisine: details.cuisine, time: details.time,
          servings: details.servings,
          calories: nutrition.calories,
          protein: nutrition.protein,
          fiber: nutrition.fiber,
          cover_image_url: details.cover_image_url,
          cookbook: details.cookbook, page_number: details.reference,
          status: details.status, recipe_incomplete: details.recipe_incomplete, tags: details.tags,
        },
        ingredients: flatIngs.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: (() => {
          const result = []; let stepNum = 1;
          for (const item of steps) {
            if (item._isTimer) {
              const secs = (parseInt(item.h)||0)*3600 + (parseInt(item.m)||0)*60 + (parseInt(item.s)||0);
              if (result.length > 0) result[result.length-1].timer_seconds = secs > 0 ? secs : null;
            } else { result.push({ ...item, step_number: stepNum++, timer_seconds: item.timer_seconds ?? null }); }
          }
          return result;
        })(),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      const res = await apiFetch(`${API}/api/recipes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onConverted(data.recipe);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title"><Icon name="shuffle" size={18} strokeWidth={2} /> Convert to Recipe</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="create-modal__body">
          {/* Image row */}
          <div className="create-modal__img-row">
            <div className="create-modal__img-preview">
              {details.cover_image_url && !imgPreviewError
                ? <img src={details.cover_image_url} alt="preview" onError={() => setImgPreviewError(true)} />
                : <span className="create-modal__img-placeholder"><Icon name="image" size={28} color="var(--ash)" strokeWidth={1.5} /></span>}
            </div>
            <div className="create-modal__img-input-wrap">
              <label className="create-modal__field-label">Cover image URL</label>
              <input className="editor-input" value={details.cover_image_url}
                onChange={e => { setDetail('cover_image_url', e.target.value); setImgPreviewError(false); }}
                placeholder="https://example.com/photo.jpg" />
              <p className="create-modal__field-hint">Paste any image URL -- see it previewed instantly</p>
            </div>
          </div>

          {/* Name */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={details.name}
              onChange={e => setDetail('name', e.target.value)} placeholder="e.g. Grandma's Lasagne" autoFocus />
          </div>

          {/* Time + Servings */}
          <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="create-modal__field">
              <label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label>
              <input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
            </div>
            <div className="create-modal__field">
              <label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label>
              <input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
            </div>
          </div>

          {/* Cuisine chips */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
            <div className="picker__chips" style={{ marginTop: 6 }}>
              {ALL_CUISINES.map(c => (
                <button key={c} className={`chip ${details.cuisine === c ? 'chip--selected' : ''}`}
                  onClick={() => setDetail('cuisine', details.cuisine === c ? '' : c)} type="button">
                  {details.cuisine === c && <span className="chip__check">✓</span>}{c}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="tag" size={13} strokeWidth={2} /> Tags</label>
            <div className="picker__chips" style={{ marginTop: 6 }}>
              {TAG_FILTERS.map(({ key, label }) => (
                <button key={key} className={`chip ${details.tags.includes(key) ? 'chip--selected' : ''}`} onClick={() => toggleTag(key)}>
                  {details.tags.includes(key) && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="create-modal__field">
            <label className="create-modal__field-label"><Icon name="list" size={13} strokeWidth={2} /> Progress</label>
            <div className="picker__chips" style={{ marginTop: 6 }}>
              {[
                { key: 'to try', label: 'To Try' },
                { key: 'complete', label: 'Complete' },
                { key: 'needs tweaking', label: 'Needs Tweaking' },
              ].map(({ key, label }) => (
                <button key={key} className={`chip ${details.status === key ? 'chip--selected' : ''}`}
                  onClick={() => setDetail('status', details.status === key ? '' : key)} type="button">
                  {details.status === key && <span className="chip__check">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>

          <p className="create-modal__field-hint">Calories, protein &amp; fiber will be auto-calculated from your ingredients</p>

          {/* Ingredients -- group style */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Ingredients</label>
            <datalist id="cv-group-labels">{groupLabels.map(l => <option key={l} value={l} />)}</datalist>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
              <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
                <div className="ing-flat-list">
                  {ings.map(ing => {
                    if (ing._isGroup) return (
                      <IngGroupRow key={ing._id} ing={ing}
                        onLabelChange={v => setIngs(prev => prev.map(i => i._id === ing._id ? { ...i, name: v } : i))}
                        onRemove={() => setIngs(prev => prev.filter(i => i._id !== ing._id))}
                        onAddIngredient={() => setIngs(prev => {
                          const grpName = ing.name;
                          let insertIdx = prev.findIndex(i => i._id === ing._id);
                          for (let j = insertIdx + 1; j < prev.length; j++) {
                            if (prev[j]._isGroup) break;
                            insertIdx = j;
                          }
                          const newIng = { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: grpName };
                          const next = [...prev]; next.splice(insertIdx + 1, 0, newIng); return next;
                        })}
                      />
                    );
                    return (
                      <IngFlatRow key={ing._id} ing={ing}
                        onUpdate={(k, v) => updateIng(ing._id, k, v)}
                        onRemove={() => removeIng(ing._id)}
                        allIngredients={allIngredients.filter(Boolean)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            <div className="ing-flat-add-row">
              <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }])}>+ Add Ingredient</button>
              <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setIngs(prev => [...prev, { _id: `grp-${Date.now()}`, _isGroup: true, name: 'New Group' }])}>+ Add Group</button>
            </div>
          </div>

          {/* Instructions */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Instructions</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
              <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                {steps.map((item, idx) => {
                  if (item._isTimer) return (
                    <div key={item._id} className="rp2__ed-timer-row">
                      <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                      <div className="rp2__ed-timer-row__inputs">
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, h: e.target.value} : s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">h</span>
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, m: e.target.value} : s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">m</span>
                        <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, s: e.target.value} : s))} placeholder="0" />
                        <span className="rp2__ed-timer-row__sep">s</span>
                      </div>
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                    </div>
                  );
                  const stepNum = steps.slice(0, idx).filter(s => !s._isTimer).length + 1;
                  return (
                    <StepSortableItem key={item._id} id={item._id} stepNum={stepNum}>
                      <textarea className="editor-textarea" value={item.body_text} onChange={e => updateStep(item._id, e.target.value)} placeholder="Describe this step..." rows={2} />
                      <button className="rp2__ed-add-timer-btn" onClick={() => addTimerAfterStep(item._id)} title="Add timer"><Icon name="timer" size={13} strokeWidth={2} /></button>
                      <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                    </StepSortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
            <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
          </div>

          {/* Notes */}
          <div className="create-modal__field">
            <label className="create-modal__field-label">Notes &amp; Modifications</label>
            {notesList.map(note => (
              <div key={note._id} className="editor-note-row">
                <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
              </div>
            ))}
            <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
          </div>

          {/* Cookbook reference -- pre-filled, editable */}
          <div className="create-modal__meta-grid">
            <div className="create-modal__field">
              <label className="create-modal__field-label"><Icon name="bookMarked" size={13} strokeWidth={2} /> Cookbook</label>
              <input className="editor-input" value={details.cookbook} onChange={e => setDetail('cookbook', e.target.value)} placeholder="Cookbook title" />
            </div>
            <div className="create-modal__field">
              <label className="create-modal__field-label">Page number</label>
              <input className="editor-input" value={details.reference} onChange={e => setDetail('reference', e.target.value)} placeholder="e.g. 142" />
            </div>
          </div>

          {saveError && <p className="editor-error" style={{ marginTop: 8 }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
        </div>

        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Creating...' : <><Icon name="zap" size={13} strokeWidth={2} /> Create Recipe</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- CookbookEditModal --------------------------------------------------------
const CookbookEditModal = ({ cookbook, onSave, onClose }) => {
  const isNew = !cookbook;
  const [form, setForm] = useState({ title:cookbook?.title||'', author:cookbook?.author||'', coverImage:cookbook?.coverImage||'', spineColor:cookbook?.spineColor||'#C65D3B', notes:cookbook?.notes||'' });
  const [imgError, setImgError] = useState(false);
  const SPINE_COLORS = ['#C65D3B','#2E2A27','#7a9e7e','#4a6fa5','#8B4513','#6B3FA0','#B5451B','#2C5F2E'];
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const save = () => { if (!form.title.trim()) return; onSave({...form, title:form.title.trim()}); };
  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2 className="create-modal__title">{isNew ? <><Icon name="bookOpen" size={18} strokeWidth={2} /> Add Cookbook</> : `Edit "${cookbook.title}"`}</h2>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="create-modal__body" style={{ gap:16 }}>
          <div className="create-modal__img-row">
            <div className="create-modal__img-preview cookbook-edit__cover-preview">
              {form.coverImage && !imgError ? <img src={form.coverImage} alt="cover" onError={() => setImgError(true)} /> : <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%' }}><Icon name="bookOpen" size={32} color="var(--ash)" strokeWidth={1.5} /></div>}
            </div>
            <div className="create-modal__img-input-wrap">
              <label className="create-modal__field-label">Cover image URL</label>
              <input className="editor-input" value={form.coverImage} onChange={e => { set('coverImage',e.target.value); setImgError(false); }} placeholder="https://..." />
              <p className="create-modal__field-hint">Paste a book cover URL</p>
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Cookbook title <span className="create-modal__required">*</span></label>
            <input className="editor-input create-modal__name-input" value={form.title} onChange={e => set('title',e.target.value)} placeholder="e.g. Ottolenghi Simple" autoFocus={isNew} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Author</label>
            <input className="editor-input" value={form.author} onChange={e => set('author',e.target.value)} placeholder="e.g. Yotam Ottolenghi" />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Spine colour</label>
            <div className="cookbook-spine-picker">
              {SPINE_COLORS.map(c => <button key={c} className={`cookbook-spine-swatch ${form.spineColor===c?'cookbook-spine-swatch--active':''}`} style={{ background:c }} onClick={() => set('spineColor',c)} type="button" />)}
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Notes</label>
            <input className="editor-input" value={form.notes} onChange={e => set('notes',e.target.value)} placeholder="Any notes about this book..." />
          </div>
        </div>
        <div className="create-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!form.title.trim()}>{isNew ? '+ Add Cookbook' : '✓ Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

// --- CookbookDetail -----------------------------------------------------------
// --- CbEntry Row -------------------------------------------------------------
const CbEntry = ({ entry, linked, entryTags, idx, onOpenRecipe, onMarkCooked, onConvert, onEdit, onRemove }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`cbentry ${linked ? 'cbentry--linked' : ''}`}>
      {/* Thumbnail */}
      <div className="cbentry__thumb-wrap">
        {(entry.image || linked?.coverImage)
          ? <img className="cbentry__thumb" src={entry.image || linked?.coverImage} alt={entry.name} />
          : <div className="cbentry__thumb cbentry__thumb--empty"><Icon name="bookOpen" size={16} color="var(--ash)" strokeWidth={1.5} /></div>}
      </div>

      {/* Name col -- plain text, never a link */}
      <div className="cbentry__name-col">
        <span className="cbentry__name">{entry.name}</span>
        {linked && <span className="cookbook-recipe-entry__saved-badge">✓ Saved</span>}
      </div>

      {/* Tags col */}
      <div className="cbentry__tags-col">
        {entryTags.slice(0, 4).map(t => <span key={t} className="cbentry__tag">{t}</span>)}
      </div>

      {/* Page col */}
      <div className="cbentry__page-col">
        {entry.page && <span className="cbentry__page">p. {entry.page}</span>}
      </div>

      {/* Actions col */}
      <div className="cbentry__actions">
        {/* Cook button -- always visible */}
        <button className="cbentry__action cbentry__action--cook" title="Mark as Cooked" onClick={onMarkCooked}>
          <Icon name="chefHat" size={14} strokeWidth={2} />
        </button>

        {/* View button -- for linked recipes */}
        {linked && (
          <button className="cbentry__action cbentry__action--view" onClick={() => onOpenRecipe(linked)} title="Open in Hearth">
            View →
          </button>
        )}

        {/* Actions menu -- for unlinked recipes (edit / convert / remove) */}
        {!linked && (
          <div className="cbentry__menu-wrap" ref={menuRef}>
            <button
              className="cbentry__action cbentry__action--menu"
              onClick={() => setMenuOpen(o => !o)}
              title="More actions"
            >
              Actions ▾
            </button>
            {menuOpen && (
              <div className="cbentry__menu-dropdown">
                <button className="cbentry__menu-item" onClick={() => { onConvert(); setMenuOpen(false); }}>
                  <Icon name="zap" size={12} strokeWidth={2} /> Convert
                </button>
                <button className="cbentry__menu-item" onClick={() => { onEdit(); setMenuOpen(false); }}>
                  <Icon name="pencil" size={12} strokeWidth={2} /> Edit
                </button>
                <button className="cbentry__menu-item cbentry__menu-item--danger" onClick={() => { onRemove(); setMenuOpen(false); }}>
                  <Icon name="trash2" size={12} strokeWidth={2} /> Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CookbookDetail = ({ cookbook, onBack, onEdit, onDelete, onOpenRecipe, recipes, onUpdateRecipes, allTags, allIngredients, setCookingRecipe, cookLog, onRecipeConverted, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddRef,   setShowAddRef]   = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [convertEntry, setConvertEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // the entry object being edited
  const [editName, setEditName] = useState('');
  const [editPage, setEditPage] = useState('');
  const [search,   setSearch]   = useState('');
  const [sortKey,  setSortKey]  = useState('page');

  const savedCount = useMemo(() => recipes.filter(r => r.cookbook && r.cookbook.toLowerCase().trim() === cookbook.title.toLowerCase().trim()).length, [recipes, cookbook]);
  const cookedIds  = useMemo(() => new Set((cookLog||[]).map(e => e.recipe_id)), [cookLog]);
  const cookedCount = useMemo(() => cookbook.recipes.filter(e => e.recipeId && cookedIds.has(e.recipeId)).length, [cookbook.recipes, cookedIds]);
  const pct = cookbook.recipes.length > 0 ? Math.round((cookedCount / cookbook.recipes.length) * 100) : 0;

  const sorted = useMemo(() => {
    const list = [...cookbook.recipes];
    if (sortKey === 'page')   list.sort((a,b) => (parseInt(a.page)||9999) - (parseInt(b.page)||9999));
    if (sortKey === 'alpha')  list.sort((a,b) => a.name.localeCompare(b.name));
    if (sortKey === 'recent') list.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    return list;
  }, [cookbook.recipes, sortKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(e => e.name.toLowerCase().includes(q) || (e.page||'').includes(q));
  }, [sorted, search]);

  const addEntries = (entries) => { onUpdateRecipes([...cookbook.recipes, ...entries]); setShowAddRef(false); setShowQuickAdd(false); };
  const removeEntry = (entry) => onUpdateRecipes(cookbook.recipes.filter(e => e !== entry));
  const startEdit = (entry) => { setEditingEntry(entry); setEditName(entry.name); setEditPage(entry.page||''); };
  const saveEdit = () => {
    if (!editName.trim()) return;
    const matched = recipes.find(r => r.name.toLowerCase() === editName.trim().toLowerCase());
    onUpdateRecipes(cookbook.recipes.map(e => e === editingEntry ? {...e, name:editName.trim(), page:editPage.trim(), recipeId:matched?.id||e.recipeId} : e));
    setEditingEntry(null);
  };

  return (
    <main className="view cookbook-detail">
      {showAddRef   && <AddReferenceModal onSave={e => addEntries([e])} onClose={() => setShowAddRef(false)} allTags={allTags} cookbookTitle={cookbook.title} authFetch={apiFetch} />}
      {showQuickAdd && <QuickAddModal onSave={addEntries} onClose={() => setShowQuickAdd(false)} />}
      {convertEntry && (
        <ConvertRecipeModal
          entry={convertEntry} cookbookTitle={cookbook.title} allIngredients={allIngredients} authFetch={apiFetch}
          onConverted={(newRecipe) => {
            onUpdateRecipes(cookbook.recipes.map(e => e === convertEntry ? {...e, recipeId:newRecipe.id, page: newRecipe.reference || e.page} : e));
            onRecipeConverted && onRecipeConverted(newRecipe);
            setConvertEntry(null);
          }}
          onClose={() => setConvertEntry(null)}
        />
      )}

      {showDeleteConfirm && (
        <div className="create-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon"><Icon name="trash2" size={32} color="var(--terracotta)" strokeWidth={1.5} /></div>
            <h2 className="delete-confirm-modal__title">Remove "{cookbook.title}"?</h2>
            <p className="delete-confirm-modal__body">This removes it from your shelf but won't delete any saved recipes.</p>
            <div className="delete-confirm-modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn--danger" onClick={onDelete}><Icon name="trash2" size={14} strokeWidth={2} /> Remove</button>
            </div>
          </div>
        </div>
      )}

      <div className="cookbook-detail__header">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Cookbooks</button>
        <div className="cookbook-detail__actions">
          <button className="btn btn--ghost btn--sm" onClick={onEdit}>✎ Edit</button>
          <button className="btn btn--ghost btn--sm" style={{ color:'var(--terracotta)' }} onClick={() => setShowDeleteConfirm(true)}><Icon name="trash2" size={14} strokeWidth={2} /> Remove</button>
        </div>
      </div>

      <div className="cookbook-detail__hero">
        <div className="cookbook-detail__cover">
          {cookbook.coverImage ? <img src={cookbook.coverImage} alt={cookbook.title} /> : <div className="cookbook-detail__cover-placeholder" style={{ background:cookbook.spineColor||'#C65D3B' }}><Icon name="bookOpen" size={32} color="#fff" strokeWidth={1.5} /></div>}
        </div>
        <div className="cookbook-detail__meta">
          <h1 className="cookbook-detail__title">{cookbook.title}</h1>
          {cookbook.author && <p className="cookbook-detail__author">by {cookbook.author}</p>}
          {cookbook.notes  && <p className="cookbook-detail__notes">{cookbook.notes}</p>}
          <div className="cookbook-detail__stats">
            <span className="cookbook-detail__stat"><strong>{cookbook.recipes.length}</strong> recipes listed</span>
            <span className="cookbook-detail__stat cookbook-detail__stat--saved"><strong>{savedCount}</strong> saved in Hearth</span>
          </div>
          {cookbook.recipes.length > 0 && (
            <div className="cbdetail-progress">
              <div className="cbdetail-progress__bar"><div className="cbdetail-progress__fill" style={{ width:`${pct}%` }} /></div>
              <span className="cbdetail-progress__label">{cookedCount} of {cookbook.recipes.length} cooked · {pct}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="cookbook-detail__recipes">
        <div className="cookbook-detail__recipes-header">
          <h2 className="cookbook-detail__recipes-title">Recipes</h2>
          <div className="cbdetail-toolbar">
            <div className="cookbook-sort-tabs">
              {COOKBOOK_SORTS.map(o => <button key={o.key} className={`cookbook-sort-tab ${sortKey===o.key?'cookbook-sort-tab--active':''}`} onClick={() => setSortKey(o.key)}>{o.label}</button>)}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowQuickAdd(true)}><Icon name="zap" size={13} strokeWidth={2} /> Quick Add</button>
            <button className="btn btn--primary btn--sm" onClick={() => setShowAddRef(true)}>+ Add Reference</button>
          </div>
        </div>

        <div className="cookbook-search-wrap">
          <input className="editor-input cookbook-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes in this book..." />
          {search && <button className="cookbook-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        {cookbook.recipes.length === 0 ? (
          <div className="cookbook-detail__empty"><p>No recipes listed yet. Add references to track what's in this book.</p></div>
        ) : filtered.length === 0 ? (
          <div className="cookbook-detail__empty"><p>No recipes match "{search}".</p></div>
        ) : (
          <div className="cookbook-recipe-list">
            {filtered.map((entry, idx) => {
              const linked  = entry.recipeId ? recipes.find(r => r.id === entry.recipeId) : null;
              const isEditing = editingEntry === entry;
              const entryTags = linked?.tags || entry.tags || [];

              if (isEditing) return (
                <div key={idx} className="cookbook-recipe-entry cookbook-recipe-entry--editing">
                  <input className="editor-input" style={{ flex:2 }} value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') setEditingEntry(null); }} placeholder="Recipe name" />
                  <input className="editor-input" style={{ width:90 }} value={editPage} onChange={e => setEditPage(e.target.value)} placeholder="Page #" onKeyDown={e => e.key==='Enter' && saveEdit()} />
                  <button className="btn btn--primary btn--sm" onClick={saveEdit}>Save</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditingEntry(null)}>Cancel</button>
                </div>
              );

              return (
                <CbEntry key={idx}
                  entry={entry} linked={linked} entryTags={entryTags} idx={idx}
                  onOpenRecipe={onOpenRecipe}
                  onMarkCooked={() => setCookingRecipe({ id: entry.recipeId || `ref-${idx}`, name: entry.name, coverImage: entry.image || linked?.coverImage || null })}
                  onConvert={() => setConvertEntry(entry)}
                  onEdit={() => startEdit(entry)}
                  onRemove={() => removeEntry(entry)}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

// --- CookbooksTab -------------------------------------------------------------
const CookbooksTab = ({ cookbooks, setCookbooks, recipes, onOpenRecipe, allTags, allIngredients, setCookingRecipe, cookLog, onRecipeConverted, isAdmin, authFetch }) => {
  const [selectedCookbook, setSelectedCookbook] = useState(null);
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [editingCookbook,  setEditingCookbook]  = useState(null);
  const [globalSearch,     setGlobalSearch]     = useState('');

  const handleSaveCookbook = async (data) => {
    try {
      if (editingCookbook) {
        const res = await authFetch(`${API}/api/cookbooks/${editingCookbook.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        if (res.ok) {
          const d = await res.json();
          setCookbooks(prev => prev.map(c => c.id === editingCookbook.id ? { ...c, ...d.cookbook } : c));
        }
      } else {
        const res = await authFetch(`${API}/api/cookbooks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, recipes: [] }),
        });
        if (res.ok) {
          const d = await res.json();
          setCookbooks(prev => [...prev, d.cookbook || { id: `cb-${Date.now()}`, recipes: [], ...data }]);
        } else {
          // Fallback to local if endpoint not yet available
          setCookbooks(prev => [...prev, { id: `cb-${Date.now()}`, recipes: [], ...data }]);
        }
      }
    } catch {
      // Fallback gracefully
      if (editingCookbook) setCookbooks(prev => prev.map(c => c.id === editingCookbook.id ? { ...c, ...data } : c));
      else setCookbooks(prev => [...prev, { id: `cb-${Date.now()}`, recipes: [], ...data }]);
    }
    setShowAddModal(false); setEditingCookbook(null);
  };

  const handleDeleteCookbook = async (id) => {
    setCookbooks(prev => prev.filter(c => c.id !== id));
    if (selectedCookbook?.id === id) setSelectedCookbook(null);
    try {
      await authFetch(`${API}/api/cookbooks/${id}`, { method: 'DELETE' });
    } catch { /* local delete already done */ }
  };

  const enrichedCookbooks = useMemo(() => cookbooks.map(cb => {
    const linked = recipes.filter(r => r.cookbook && r.cookbook.toLowerCase().trim() === cb.title.toLowerCase().trim());
    const entries = [...(cb.recipes||[])];
    for (const lr of linked) {
      const existingIdx = entries.findIndex(e => e.name.toLowerCase() === lr.name.toLowerCase());
      if (existingIdx < 0) {
        // New linked recipe not in list yet -- add it
        entries.push({ name: lr.name, page: lr.reference || '', image: lr.coverImage || '', tags: lr.tags || [], recipeId: lr.id, addedAt: Date.now() });
      } else {
        // Sync recipeId and page number from the live recipe record
        entries[existingIdx] = {
          ...entries[existingIdx],
          recipeId: lr.id,
          page: lr.reference || entries[existingIdx].page || '',
          tags: lr.tags?.length ? lr.tags : entries[existingIdx].tags,
        };
      }
    }
    return {...cb, recipes: entries, savedCount: linked.length};
  }), [cookbooks, recipes]);

  const globalResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    const out = [];
    for (const cb of enrichedCookbooks)
      for (const e of cb.recipes)
        if (e.name.toLowerCase().includes(q)) out.push({...e, _cbTitle:cb.title, _cbId:cb.id});
    return out;
  }, [globalSearch, enrichedCookbooks]);

  const currentCb = selectedCookbook ? enrichedCookbooks.find(c => c.id===selectedCookbook.id) : null;

  if (selectedCookbook && currentCb) {
    return <CookbookDetail
      cookbook={currentCb}
      onBack={() => setSelectedCookbook(null)}
      onEdit={() => { setEditingCookbook(currentCb); setShowAddModal(true); }}
      onDelete={() => handleDeleteCookbook(currentCb.id)}
      onOpenRecipe={onOpenRecipe}
      recipes={recipes}
      allIngredients={allIngredients}
      onUpdateRecipes={async (newRecipes) => {
        setCookbooks(prev => prev.map(c => c.id===currentCb.id ? {...c, recipes:newRecipes} : c));
        try {
          await authFetch(`${API}/api/cookbooks/${currentCb.id}/entries`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipes: newRecipes }),
          });
        } catch { /* local update already applied */ }
      }}
      allTags={allTags}
      setCookingRecipe={setCookingRecipe}
      cookLog={cookLog}
      onRecipeConverted={onRecipeConverted}
      authFetch={authFetch}
    />;
  }

  return (
    <main className="view cookbooks-tab">
      {(showAddModal||editingCookbook) && (
        <CookbookEditModal cookbook={editingCookbook} onSave={handleSaveCookbook} onClose={() => { setShowAddModal(false); setEditingCookbook(null); }} />
      )}

      <div className="cookbooks-header">
        <div>
          <h2 className="cookbooks-title">My Cookbooks</h2>
          <p className="cookbooks-subtitle">{cookbooks.length} {cookbooks.length===1?'cookbook':'cookbooks'} · {enrichedCookbooks.reduce((s,c) => s+c.recipes.length, 0)} recipes indexed</p>
        </div>
        {isAdmin && <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>+ Add Cookbook</button>}
      </div>

      {cookbooks.length > 0 && (
        <div className="cookbooks-global-search">
          <input className="editor-input" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Search recipes across all cookbooks..." />
          {globalSearch && <button className="cookbook-search-clear" onClick={() => setGlobalSearch('')}>✕</button>}
        </div>
      )}

      {globalSearch.trim() && (
        <div className="cookbooks-search-results">
          {globalResults.length === 0
            ? <p className="cookbooks-search-empty">No recipes found for "{globalSearch}"</p>
            : globalResults.map((e, i) => {
                const linked = e.recipeId ? recipes.find(r => r.id===e.recipeId) : null;
                return (
                  <div key={i} className="cbsearch-result">
                    <div className="cbsearch-result__info">
                      <span className="cbsearch-result__name">{e.name}</span>
                      <span className="cbsearch-result__meta">{e._cbTitle}{e.page ? ` · p. ${e.page}` : ''}</span>
                    </div>
                    <div className="cbsearch-result__actions">
                      {linked && <button className="btn btn--ghost btn--sm" onClick={() => onOpenRecipe(linked)}>View →</button>}
                      <button className="btn btn--ghost btn--sm" onClick={() => { setGlobalSearch(''); setSelectedCookbook(enrichedCookbooks.find(c => c.id===e._cbId)); }}>Open cookbook</button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {!globalSearch.trim() && (cookbooks.length === 0 ? (
        <div className="cookbooks-empty">
          <div className="cookbooks-empty__icon"><Icon name="bookOpen" size={40} color="var(--ash)" strokeWidth={1.5} /></div>
          <h3 className="cookbooks-empty__title">Start your cookbook shelf</h3>
          <p className="cookbooks-empty__sub">Add your physical cookbooks and track which recipes you've saved in Hearth</p>
          {isAdmin && <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>+ Add your first cookbook</button>}
        </div>
      ) : (
        <div className="cookbooks-grid">
          {enrichedCookbooks.map(cb => {
            const cookedCt = cb.recipes.filter(e => e.recipeId && (cookLog||[]).some(l => l.recipe_id===e.recipeId)).length;
            const p = cb.recipes.length > 0 ? Math.round((cookedCt/cb.recipes.length)*100) : 0;
            return (
              <button key={cb.id} className="cookbook-card" onClick={() => setSelectedCookbook(cb)}>
                <div className="cookbook-card__spine" style={{ background:cb.spineColor||'#C65D3B' }} />
                <div className="cookbook-card__cover">
                  {cb.coverImage ? <img src={cb.coverImage} alt={cb.title} className="cookbook-card__img" /> : <div className="cookbook-card__placeholder"><Icon name="bookOpen" size={28} color="var(--ash)" strokeWidth={1.5} /></div>}
                </div>
                <div className="cookbook-card__info">
                  <h3 className="cookbook-card__title">{cb.title}</h3>
                  {cb.author && <p className="cookbook-card__author">{cb.author}</p>}
                  <div className="cookbook-card__stats">
                    <span className="cookbook-card__stat">{cb.recipes?.length||0} recipes</span>
                    {cb.savedCount > 0 && <span className="cookbook-card__stat cookbook-card__stat--saved">✓ {cb.savedCount} saved</span>}
                  </div>
                  {cb.recipes.length > 0 && (
                    <div className="cbcard-progress">
                      <div className="cbcard-progress__bar"><div className="cbcard-progress__fill" style={{ width:`${p}%` }} /></div>
                      <span className="cbcard-progress__label">{cookedCt} cooked</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {isAdmin && <button className="cookbook-card cookbook-card--add" onClick={() => setShowAddModal(true)}>
            <div className="cookbook-card__add-icon"><Icon name="bookMarked" size={24} color="var(--terracotta)" strokeWidth={2} /></div>
            <p className="cookbook-card__add-label">Add cookbook</p>
          </button>}
        </div>
      ))}
    </main>
  );
};

// --- Add Recipe Tab ---------------------------------------------------------
const AddRecipeTab = ({ allIngredients, onSaved, cookbooks = [], authFetch }) => {
  const apiFetch = authFetch || fetch;
  const sensors = DRAG_SENSORS();
  const [showModal, setShowModal] = useState(false);

  // -- Link import state --
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkScraping, setLinkScraping] = useState(false);
  const [linkError, setLinkError] = useState(null);

  // -- Text import state --
  const [showTextModal, setShowTextModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [textParsing, setTextParsing] = useState(false);
  const [textError, setTextError] = useState(null);

  const openTextModal = () => { setPastedText(''); setTextError(null); setShowTextModal(true); };
  const closeTextModal = () => { setShowTextModal(false); setTextParsing(false); };

  const parseTextAndOpen = async () => {
    if (!pastedText.trim()) { setTextError('Please paste some recipe text'); return; }
    setTextParsing(true); setTextError(null);
    try {
      const res = await apiFetch(`${API}/api/parse-recipe-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');

      setDetails({
        name: data.name || '',
        cuisine: normaliseCuisine(data.cuisine),
        time: data.time || '',
        servings: data.servings || '',
        cover_image_url: data.image || '',
        cookbook: '', reference: '', status: 'to try', tags: [],
      });
      setIngs(
        data.ingredients?.length
          ? data.ingredients.map((i, idx) => ({
              _id: `ing-txt-${idx}-${Date.now()}`,
              name: i.name || '', amount: i.amount || '', unit: i.unit || '',
              prep_note: '', optional: false, group_label: '',
            }))
          : [{ _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]
      );
      setSteps(
        data.steps?.length
          ? data.steps.map((s, idx) => ({
              _id: `step-txt-${idx}-${Date.now()}`,
              step_number: idx + 1, body_text: s, timer_seconds: null,
            }))
          : [{ _id: `step-${Date.now()}`, step_number: 1, body_text: '' }]
      );
      setNotesList(
        data.description ? [{ _id: `note-txt-${Date.now()}`, text: data.description }] : []
      );
      setImgPreviewError(false);
      setSaveError(null);
      setShowTextModal(false);
      setShowModal(true);
    } catch (e) {
      setTextError(e.message);
    } finally {
      setTextParsing(false);
    }
  };

  const emptyForm = () => ({
    name: '', cuisine: '', time: '', servings: '',
    cover_image_url: '', cookbook: '', reference: '', status: '', tags: [],
  });

  const [details, setDetails] = useState(emptyForm);
  const [ings, setIngs] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [imgPreviewError, setImgPreviewError] = useState(false);

  // Map a scraped cuisine string to one of our known cuisines (best-effort)
  const normaliseCuisine = (raw) => {
    if (!raw) return '';
    const r = raw.toLowerCase();
    for (const c of ALL_CUISINES) {
      if (r.includes(c.toLowerCase())) return c;
    }
    return '';
  };

  const openLinkModal = () => { setLinkUrl(''); setLinkError(null); setShowLinkModal(true); };
  const closeLinkModal = () => { setShowLinkModal(false); setLinkScraping(false); };

  const scrapeAndOpen = async () => {
    if (!linkUrl.trim()) { setLinkError('Please paste a URL'); return; }
    setLinkScraping(true); setLinkError(null);
    try {
      const res = await apiFetch(`${API}/api/scrape-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scrape failed');

      // Pre-fill the manual form with scraped data
      setDetails({
        name: data.name || '',
        cuisine: normaliseCuisine(data.cuisine),
        time: data.time || '',
        servings: data.servings || '',
        cover_image_url: data.image || '',
        cookbook: '', reference: '', status: 'to try', tags: [],
      });
      setIngs(
        data.ingredients?.length
          ? data.ingredients.map((i, idx) => ({
              _id: `ing-link-${idx}-${Date.now()}`,
              name: i.name || '', amount: i.amount || '', unit: i.unit || '',
              prep_note: '', optional: false, group_label: '',
            }))
          : [{ _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]
      );
      setSteps(
        data.steps?.length
          ? data.steps.map((s, idx) => ({
              _id: `step-link-${idx}-${Date.now()}`,
              step_number: idx + 1, body_text: s, timer_seconds: null,
            }))
          : [{ _id: `step-${Date.now()}`, step_number: 1, body_text: '' }]
      );
      setNotesList(
        data.description
          ? [{ _id: `note-link-${Date.now()}`, text: data.description }]
          : []
      );
      setImgPreviewError(false);
      setSaveError(null);
      setShowLinkModal(false);
      setShowModal(true);
    } catch (e) {
      setLinkError(e.message);
    } finally {
      setLinkScraping(false);
    }
  };

  const setDetail = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const toggleTag = (tag) => setDetails(prev => ({
    ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
  }));

  const addIng  = () => setIngs(prev => [...prev, { _id: `ing-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
  const updateIng = (id, k, v) => setIngs(prev => prev.map(i => i._id === id ? { ...i, [k]: v } : i));
  const removeIng = (id) => setIngs(prev => prev.filter(i => i._id !== id));
  const onIngDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setIngs(prev => { const o = prev.findIndex(i => i._id === active.id); const n = prev.findIndex(i => i._id === over.id); return arrayMove(prev, o, n); });
    }
  };

  const addStep    = () => setSteps(prev => [...prev, { _id: `step-${Date.now()}`, step_number: prev.length + 1, body_text: '', timer_seconds: null }]);
  const addTimerAfterStep = (afterId) => setSteps(prev => { const idx = prev.findIndex(s => s._id === afterId); const t = { _id: `timer-${Date.now()}`, _isTimer: true, h: '', m: '', s: '' }; const n = [...prev]; n.splice(idx+1, 0, t); return n; });
  const updateStep = (id, v) => setSteps(prev => prev.map(s => s._id === id ? { ...s, body_text: v } : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s._id !== id));
  const onStepDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setSteps(prev => { const o = prev.findIndex(s => s._id === active.id); const n = prev.findIndex(s => s._id === over.id); return arrayMove(prev, o, n); }); };
  const addNote    = () => setNotesList(prev => [...prev, { _id: `note-${Date.now()}`, text: '' }]);
  const updateNote = (id, v) => setNotesList(prev => prev.map(n => n._id === id ? { ...n, text: v } : n));
  const removeNote = (id) => setNotesList(prev => prev.filter(n => n._id !== id));

  const openModal = () => {
    setDetails(emptyForm());
    setIngs([{ _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }]);
    setSteps([{ _id: `step-${Date.now()}`, step_number: 1, body_text: '' }]);
    setNotesList([]);
    setSaveError(null);
    setImgPreviewError(false);
    setShowModal(true);
  };
  const closeModal = () => setShowModal(false);

  const save = async () => {
    if (!details.name.trim()) { setSaveError('Recipe name is required.'); return; }
    setSaving(true); setSaveError(null);

    // Auto-calculate nutrition from ingredients
    const _nutrition = calcNutrition(ings, allIngredients);

    try {
      // Flatten grouped ingredients
      let grp = '';
      const flatIngs = ings.map(i => {
        if (i._isGroup) { grp = i.name || ''; return null; }
        return { ...i, group_label: grp };
      }).filter(Boolean);

      const payload = {
        details: {
          name: details.name, cuisine: details.cuisine, time: details.time,
          servings: details.servings,
          calories: _nutrition?.calories ?? null,
          protein: _nutrition?.protein ?? null,
          fiber: _nutrition?.fiber ?? null,
          cover_image_url: details.cover_image_url,
          cookbook: details.cookbook, page_number: details.reference,
          status: details.status, recipe_incomplete: details.recipe_incomplete, tags: details.tags,
        },
        ingredients: flatIngs.map((i, idx) => ({ ...i, order_index: idx })),
        instructions: (() => {
          const result = []; let stepNum = 1;
          for (const item of steps) {
            if (item._isTimer) {
              const secs = (parseInt(item.h)||0)*3600 + (parseInt(item.m)||0)*60 + (parseInt(item.s)||0);
              if (result.length > 0) result[result.length-1].timer_seconds = secs > 0 ? secs : null;
            } else { result.push({ ...item, step_number: stepNum++, timer_seconds: item.timer_seconds ?? null }); }
          }
          return result;
        })(),
        notes: notesList.map((n, idx) => ({ ...n, order_index: idx })),
      };
      const res = await apiFetch(`${API}/api/recipes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      closeModal();
      if (onSaved) onSaved(data.recipe);
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const groupLabels = [...new Set(ings.map(i => i.group_label).filter(Boolean))];

  return (
    <main className="view add-tab">
      <div className="add-tab__header">
        <h2 className="add-tab__title">Add a Recipe</h2>
        <p className="add-tab__sub">Grow your collection -- add a recipe by hand or from a link</p>
      </div>

      <div className="add-tab__cards add-tab__cards--three">
        {/* Manual card */}
        <button className="add-tab__card" onClick={openModal}>
          <span className="add-tab__card-icon"><Icon name="note" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Add Manually</h3>
          <p className="add-tab__card-desc">Type in the name, ingredients, steps, and notes yourself</p>
          <span className="add-tab__card-cta">Get started →</span>
        </button>

        {/* From link card */}
        <button className="add-tab__card" onClick={openLinkModal}>
          <span className="add-tab__card-icon"><Icon name="arrowRight" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Add from Link</h3>
          <p className="add-tab__card-desc">Paste any recipe URL and we'll pull in the name, ingredients, and steps automatically</p>
          <span className="add-tab__card-cta">Import →</span>
        </button>

        {/* From text card */}
        <button className="add-tab__card" onClick={openTextModal}>
          <span className="add-tab__card-icon"><Icon name="list" size={28} strokeWidth={1.5} /></span>
          <h3 className="add-tab__card-title">Add from Text</h3>
          <p className="add-tab__card-desc">Paste copied text -- we'll parse it automatically</p>
          <span className="add-tab__card-cta">Paste &amp; import →</span>
        </button>
      </div>

      {/* -- Text Import Modal -- */}
      {showTextModal && (
        <div className="create-modal-overlay" onClick={closeTextModal}>
          <div className="create-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="create-modal__header">
              <h2 className="create-modal__title"><Icon name="list" size={18} strokeWidth={2} /> Import from Text</h2>
              <button className="ing-modal__close" onClick={closeTextModal}>✕</button>
            </div>
            <div className="create-modal__body" style={{ gap: 14 }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--warm-gray)', margin: 0 }}>
                Paste copied recipe text below -- we'll extract the title, ingredients, and steps automatically.
              </p>
              <div className="create-modal__field">
                <label className="create-modal__field-label">Paste recipe text</label>
                <textarea
                  className="editor-textarea"
                  value={pastedText}
                  onChange={e => { setPastedText(e.target.value); setTextError(null); }}
                  placeholder={"e.g.\nCreamy Tuscan Chicken\n\nIngredients:\n- 4 chicken breasts\n- 1 cup heavy cream\n...\n\nInstructions:\n1. Season the chicken...\n2. Heat oil in a pan..."}
                  rows={12}
                  style={{ resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}
                  autoFocus
                />
              </div>
              {textError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {textError}</p>}
              {textParsing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--warm-gray)', fontSize: '0.88rem' }}>
                  <span className="link-import__spinner" />
                  Parsing recipe...
                </div>
              )}
            </div>
            <div className="create-modal__footer">
              <button className="btn btn--ghost" onClick={closeTextModal}>Cancel</button>
              <button className="btn btn--primary" onClick={parseTextAndOpen} disabled={textParsing || !pastedText.trim()}>
                {textParsing ? 'Parsing...' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Link Import Modal -- */}
      {showLinkModal && (
        <div className="create-modal-overlay" onClick={closeLinkModal}>
          <div className="create-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="create-modal__header">
              <h2 className="create-modal__title"><Icon name="arrowRight" size={18} strokeWidth={2} /> Import from Link</h2>
              <button className="ing-modal__close" onClick={closeLinkModal}>✕</button>
            </div>
            <div className="create-modal__body" style={{ gap: 14 }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--warm-gray)', margin: 0 }}>
                Paste the URL of any recipe page -- we'll extract the name, ingredients, steps, and image automatically using the page's structured data.
              </p>
              <div className="create-modal__field">
                <label className="create-modal__field-label">Recipe URL</label>
                <input
                  className="editor-input"
                  value={linkUrl}
                  onChange={e => { setLinkUrl(e.target.value); setLinkError(null); }}
                  onKeyDown={e => e.key === 'Enter' && scrapeAndOpen()}
                  placeholder="https://www.seriouseats.com/..."
                  autoFocus
                />
              </div>
              {linkError && <p className="editor-error"><Icon name="alertTriangle" size={14} strokeWidth={2} /> {linkError}</p>}
              {linkScraping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--warm-gray)', fontSize: '0.88rem' }}>
                  <span className="link-import__spinner" />
                  Fetching recipe data...
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--warm-gray)', margin: 0 }}>
                Works best with recipe sites that use structured data (most major food blogs, NYT Cooking, Serious Eats, BBC Good Food, etc). You can always edit anything after import.
              </p>
            </div>
            <div className="create-modal__footer">
              <button className="btn btn--ghost" onClick={closeLinkModal}>Cancel</button>
              <button className="btn btn--primary" onClick={scrapeAndOpen} disabled={linkScraping || !linkUrl.trim()}>
                {linkScraping ? 'Importing...' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Create Recipe Modal -- */}
      {showModal && (
        <div className="create-modal-overlay" onClick={closeModal}>
          <div className="create-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="create-modal__header">
              <h2 className="create-modal__title"><Icon name="note" size={18} strokeWidth={2} /> New Recipe</h2>
              <button className="ing-modal__close" onClick={closeModal}>✕</button>
            </div>

            <div className="create-modal__body">

              {/* Image row */}
              <div className="create-modal__img-row">
                <div className="create-modal__img-preview">
                  {details.cover_image_url && !imgPreviewError
                    ? <img src={details.cover_image_url} alt="preview" onError={() => setImgPreviewError(true)} />
                    : <span className="create-modal__img-placeholder"><Icon name="image" size={28} color="var(--ash)" strokeWidth={1.5} /></span>}
                </div>
                <div className="create-modal__img-input-wrap">
                  <label className="create-modal__field-label">Cover image URL</label>
                  <input className="editor-input" value={details.cover_image_url}
                    onChange={e => { setDetail('cover_image_url', e.target.value); setImgPreviewError(false); }}
                    placeholder="https://example.com/photo.jpg" />
                  <p className="create-modal__field-hint">Paste any image URL -- see it previewed instantly</p>
                </div>
              </div>

              {/* Name */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Recipe name <span className="create-modal__required">*</span></label>
                <input className="editor-input create-modal__name-input" value={details.name}
                  onChange={e => setDetail('name', e.target.value)} placeholder="e.g. Grandma's Lasagne" autoFocus />
              </div>

              {/* Time + Servings */}
              <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="clock" size={13} strokeWidth={2} /> Time</label>
                  <input className="editor-input" value={details.time} onChange={e => setDetail('time', e.target.value)} placeholder="45 mins" />
                </div>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="utensils" size={13} strokeWidth={2} /> Servings</label>
                  <input className="editor-input" value={details.servings} onChange={e => setDetail('servings', e.target.value)} placeholder="4" />
                </div>
              </div>

              {/* Cuisine chips */}
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="mapPin" size={13} strokeWidth={2} /> Cuisine</label>
                <div className="picker__chips" style={{ marginTop: 6 }}>
                  {ALL_CUISINES.map(c => (
                    <button key={c} className={`chip ${details.cuisine === c ? 'chip--selected' : ''}`}
                      onClick={() => setDetail('cuisine', details.cuisine === c ? '' : c)} type="button">
                      {details.cuisine === c && <span className="chip__check">✓</span>}{c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="tag" size={13} strokeWidth={2} /> Tags</label>
                <div className="picker__chips" style={{ marginTop: 6 }}>
                  {TAG_FILTERS.map(({ key, label }) => (
                    <button key={key} className={`chip ${details.tags.includes(key) ? 'chip--selected' : ''}`} onClick={() => toggleTag(key)} type="button">
                      {details.tags.includes(key) && <span className="chip__check">✓</span>}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div className="create-modal__field">
                <label className="create-modal__field-label"><Icon name="list" size={13} strokeWidth={2} /> Progress</label>
                <div className="picker__chips" style={{ marginTop: 6 }}>
                  {[
                    { key: '', label: '-- None' },
                    { key: 'complete', label: 'Complete' },
                    { key: 'needs tweaking', label: 'Needs Tweaking' },
                    { key: 'to try', label: 'To Try' },
                    { key: 'incomplete', label: 'Incomplete' },
                  ].map(({ key, label }) => (
                    <button key={key}
                      className={`chip ${details.status === key ? 'chip--selected' : ''}`}
                      onClick={() => setDetail('status', key)} type="button">
                      {details.status === key && <span className="chip__check">✓</span>}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nutrition note */}
              <p className="create-modal__field-hint" style={{ marginTop: -4 }}>
                Calories, protein &amp; fiber will be auto-calculated from your ingredients
              </p>

              {/* Ingredients -- group-style like edit modal */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Ingredients</label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
                  <SortableContext items={ings.map(i => i._id)} strategy={verticalListSortingStrategy}>
                    <div className="ing-flat-list">
                      <div className="ing-flat-header ing-flat-header--desktop">
                        <span className="ing-flat-header__drag" />
                        <div className="ing-flat-header__cols">
                          <span className="ing-flat-header__qty-col">Qty</span>
                          <span className="ing-flat-header__unit-col">Unit</span>
                          <span className="ing-flat-header__name-col">Ingredient</span>
                          <span className="ing-flat-header__prep-col">Prep note</span>
                          <span className="ing-flat-header__opt-col">Optional</span>
                        </div>
                        <span className="ing-flat-header__rm" />
                      </div>
                      {ings.map((ing) => {
                        if (ing._isGroup) {
                          return (
                            <IngGroupRow key={ing._id} ing={ing}
                              onLabelChange={v => setIngs(prev => prev.map(i => i._id === ing._id ? { ...i, name: v } : i))}
                              onRemove={() => setIngs(prev => prev.filter(i => i._id !== ing._id))}
                              onAddIngredient={() => setIngs(prev => {
                                const groupName = ing.name;
                                let insertIdx = prev.findIndex(i => i._id === ing._id);
                                for (let j = insertIdx + 1; j < prev.length; j++) {
                                  if (prev[j]._isGroup) break;
                                  insertIdx = j;
                                }
                                const newIng = { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: groupName };
                                const next = [...prev]; next.splice(insertIdx + 1, 0, newIng); return next;
                              })}
                            />
                          );
                        }
                        return (
                          <IngFlatRow key={ing._id} ing={ing}
                            onUpdate={(k, v) => updateIng(ing._id, k, v)}
                            onRemove={() => removeIng(ing._id)}
                            allIngredients={allIngredients}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="ing-flat-add-row">
                  <button className="btn btn--ghost editor-add-btn" onClick={() => setIngs(prev => [...prev, { _id: `ing-new-${Date.now()}`, name: '', amount: '', unit: '', prep_note: '', optional: false, group_label: '' }])}>+ Add Ingredient</button>
                  <button className="btn btn--ghost editor-add-btn ing-add-group-btn" onClick={() => setIngs(prev => [...prev, { _id: `grp-${Date.now()}`, _isGroup: true, name: 'New Group' }])}>+ Add Group</button>
                </div>
              </div>

              {/* Instructions */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Instructions</label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
                  <SortableContext items={steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                    {steps.map((item, idx) => {
                      if (item._isTimer) return (
                        <div key={item._id} className="rp2__ed-timer-row">
                          <span className="rp2__ed-timer-row__icon"><Icon name="timer" size={14} strokeWidth={2} /></span>
                          <div className="rp2__ed-timer-row__inputs">
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" value={item.h} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, h: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">h</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.m} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, m: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">m</span>
                            <input className="editor-input editor-input--sm rp2__ed-timer-row__num" type="number" min="0" max="59" value={item.s} onChange={e => setSteps(prev => prev.map(s => s._id === item._id ? {...s, s: e.target.value} : s))} placeholder="0" />
                            <span className="rp2__ed-timer-row__sep">s</span>
                          </div>
                          <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                        </div>
                      );
                      const stepNum = steps.slice(0, idx).filter(s => !s._isTimer).length + 1;
                      return (
                        <StepSortableItem key={item._id} id={item._id} stepNum={stepNum}>
                          <textarea className="editor-textarea" value={item.body_text} onChange={e => updateStep(item._id, e.target.value)} placeholder="Describe this step..." rows={2} />
                          <button className="rp2__ed-add-timer-btn" onClick={() => addTimerAfterStep(item._id)} title="Add timer"><Icon name="timer" size={13} strokeWidth={2} /></button>
                          <button className="editor-remove-btn" onClick={() => removeStep(item._id)}>✕</button>
                        </StepSortableItem>
                      );
                    })}
                  </SortableContext>
                </DndContext>
                <button className="btn btn--ghost editor-add-btn" onClick={addStep}>+ Add Step</button>
              </div>

              {/* Notes */}
              <div className="create-modal__field">
                <label className="create-modal__field-label">Notes &amp; Modifications</label>
                {notesList.map(note => (
                  <div key={note._id} className="editor-note-row">
                    <input className="editor-input" value={note.text || ''} onChange={e => updateNote(note._id, e.target.value)} placeholder="e.g. Great with oat milk instead of dairy" />
                    <button className="editor-remove-btn" onClick={() => removeNote(note._id)}>✕</button>
                  </div>
                ))}
                <button className="btn btn--ghost editor-add-btn" onClick={addNote}>+ Add Note</button>
              </div>

              {/* Cookbook reference */}
              <div className="create-modal__meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="create-modal__field">
                  <label className="create-modal__field-label"><Icon name="bookMarked" size={13} strokeWidth={2} /> Cookbook</label>
                  <CookbookAutocomplete value={details.cookbook} onChange={v => setDetail('cookbook', v)} cookbooks={cookbooks} />
                </div>
                <div className="create-modal__field">
                  <label className="create-modal__field-label">Page number</label>
                  <input className="editor-input" value={details.reference} onChange={e => setDetail('reference', e.target.value)} placeholder="e.g. 142" />
                </div>
              </div>

              {saveError && <p className="editor-error" style={{ marginTop: 8 }}><Icon name="alertTriangle" size={14} strokeWidth={2} /> {saveError}</p>}
            </div>

            {/* Modal footer */}
            <div className="create-modal__footer">
              <button className="btn btn--ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Creating...' : '✓ Create Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

// --- Login Modal -------------------------------------------------------------
const LoginModal = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim() || !password) return setError('Please enter your username and password.');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.token, data.user);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <div className="login-modal__header">
          <span className="login-modal__flame"><Icon name="flame" size={40} color="var(--terracotta)" strokeWidth={1.5} /></span>
          <div className="login-modal__title">Hearth</div>
          <div className="login-modal__subtitle">Sign in to continue</div>
        </div>
        <div className="login-modal__body">
          {error && <div className="login-modal__error">{error}</div>}
          <div className="login-modal__field">
            <label className="login-modal__label">Username</label>
            <input
              className="login-modal__input"
              type="text"
              placeholder="e.g. kavya"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
              autoCapitalize="none"
            />
          </div>
          <div className="login-modal__field">
            <label className="login-modal__label">Password</label>
            <input
              className="login-modal__input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <button className="login-modal__btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Create User Modal (admin only) ------------------------------------------
const CreateUserModal = ({ onClose, authFetch }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    if (!username.trim() || !password) return setError('Username and password are required.');
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await authFetch(`${API}/api/auth/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setSuccess(`Account created for ${data.user.username} ✓`);
      setUsername(''); setPassword('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="create-user-modal" onClick={e => e.stopPropagation()}>
        <div className="create-user-modal__header">
          <span className="create-user-modal__title"><Icon name="userCircle" size={18} strokeWidth={2} /> Create Account</span>
          <button className="ing-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="login-modal__body">
          {error && <div className="login-modal__error">{error}</div>}
          {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#166534' }}>{success}</div>}
          <div className="login-modal__field">
            <label className="login-modal__label">Username</label>
            <input className="login-modal__input" type="text" placeholder="e.g. PriyaK" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" />
          </div>
          <div className="login-modal__field">
            <label className="login-modal__label">Password</label>
            <input className="login-modal__input" type="password" placeholder="Set a password for them" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="login-modal__btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ----------------------------------------------------------------
function AppInner() {
  // --- Auth ------------------------------------------------------------------
  const [authToken, setAuthToken] = useState(() => LS.get('authToken', null));
  const [authUser, setAuthUser]   = useState(() => LS.get('authUser', null));
  const [showLogin, setShowLogin] = useState(false);
  const isAdmin = authUser?.role === 'admin';

  // Show login gate if no token
  useEffect(() => {
    if (!authToken) setShowLogin(true);
    else setShowLogin(false);
  }, [authToken]);

  const handleLogin = (token, user) => {
    LS.set('authToken', token);
    LS.set('authUser', user);
    setAuthToken(token);
    setAuthUser(user);
    setShowLogin(false);
  };

  const handleLogout = () => {
    LS.set('authToken', null);
    LS.set('authUser', null);
    setAuthToken(null);
    setAuthUser(null);
    setShowLogin(true);
  };

  // Authenticated fetch wrapper -- adds Bearer token automatically
  const authFetch = useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
    });
  }, [authToken]);

  const [view, setViewRaw] = useState('home');
  const [lastView, setLastView] = useState('home');

  // Always scroll to top when switching tabs
  const setView = useCallback((newView) => {
    setViewRaw(newView);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Swipe-right to go back (mobile) with visual feedback
  const swipeTouchStart = useRef(null);
  const [swipeDx, setSwipeDx] = useState(0);
  const handleSwipeTouchStart = useCallback((e) => {
    swipeTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeDx(0);
  }, []);
  const handleSwipeTouchMove = useCallback((e) => {
    if (!swipeTouchStart.current) return;
    const dx = e.touches[0].clientX - swipeTouchStart.current.x;
    const dy = Math.abs(e.touches[0].clientY - swipeTouchStart.current.y);
    if (dx > 0 && dy < 80) setSwipeDx(Math.min(dx, 120));
    else setSwipeDx(0);
  }, []);
  const handleSwipeTouchEnd = useCallback((e) => {
    if (!swipeTouchStart.current) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStart.current.y);
    const threshold = window.innerWidth * 0.35; // 35% of screen
    if (dx > threshold && dy < 100) {
      // Animate to full width then navigate
      setSwipeDx(window.innerWidth);
      setTimeout(() => { setSwipeDx(0); setView(lastView); }, 280);
    } else {
      setSwipeDx(0);
    }
    swipeTouchStart.current = null;
  }, [lastView]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showAllSoon] = useState(true);
  const [showAllMatch] = useState(true);
  const [showAllFav] = useState(true);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSearchSubmitted, setMobileSearchSubmitted] = useState(false);
  const mainScrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll-to-top detection
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.title = 'Hearth';
    // Point both the browser favicon and iOS touch icon at the same hearth-icon.png in /public
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/png';
    link.href = `${process.env.PUBLIC_URL || ''}/hearth-icon.png`;

    let appleLink = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) { appleLink = document.createElement('link'); appleLink.rel = 'apple-touch-icon'; document.head.appendChild(appleLink); }
    appleLink.href = `${process.env.PUBLIC_URL || ''}/hearth-icon.png`;
  }, []);
  const [allIngredients, setAllIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fridgeIngredients, setFridgeIngredients] = useState(() => LS.get('fridgeIngredients', []));
  const [pantryStaples, setPantryStaples] = useState(() => LS.get('pantryStaples', []));
  // Sync kitchen to backend whenever it changes (debounced)
  const kitchenSyncTimer = useRef(null);
  const syncKitchenToAPI = useCallback((fridge, pantry) => {
    if (!authToken) return;
    clearTimeout(kitchenSyncTimer.current);
    kitchenSyncTimer.current = setTimeout(() => {
      const kitchen = [
        ...fridge.map(n => ({ ingredient_name: n, storage_type: 'fridge' })),
        ...pantry.map(n => ({ ingredient_name: n, storage_type: 'pantry' })),
      ];
      authFetch(`${API}/api/user/kitchen`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen }),
      }).catch(() => {});
    }, 800);
  }, [authToken, authFetch]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeBodyIngredients, setRecipeBodyIngredients] = useState([]);
  const [recipeInstructions, setRecipeInstructions] = useState([]);
  const [recipeNotes, setRecipeNotes] = useState([]);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeTags, setActiveTags] = useState([]);
  const [activeCuisines, setActiveCuisines] = useState([]);
  const [activeProgresses, setActiveProgresses] = useState([]);
  const [maxCalories, setMaxCalories] = useState(null);   // null = off
  const [calDir, setCalDir] = useState('under');          // 'under'|'over'
  const [maxMinutes, setMaxMinutes] = useState(null);     // null = off
  const [activeCookbooks, setActiveCookbooks] = useState([]); // cookbook titles + '__uncategorized'
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customCuisines, setCustomCuisines] = useState(() => LS.get('customCuisines', []));
  const [heartedIds, setHeartedIds] = useState(() => LS.get('heartedIds', []));
  const [makeSoonIds, setMakeSoonIds] = useState(() => LS.get('makeSoonIds', []));
  const [cookingRecipe, setCookingRecipe] = useState(null); // recipe object to mark cooked
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryLayout, setLibraryLayout] = useState('grid'); // 'grid' | 'list'
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => { LS.set('customCuisines', customCuisines); }, [customCuisines]);

  const toggleHeart = useCallback((id) => {
    setHeartedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (authToken) authFetch(`${API}/api/user/favorites`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: next }) }).catch(() => {});
      return next;
    });
  }, [authToken, authFetch]);

  const toggleMakeSoon = useCallback((id) => {
    setMakeSoonIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (authToken) authFetch(`${API}/api/user/make-soon`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ makeSoon: next }) }).catch(() => {});
      return next;
    });
  }, [authToken, authFetch]);

  const [darkMode, setDarkModeRaw] = useState(() => LS.get('darkMode', false));
  const setDarkMode = (v) => { setDarkModeRaw(v); LS.set('darkMode', v); };

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [units, setUnitsRaw] = useState(() => LS.get('units', 'metric'));
  const [dietaryFilters, setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));
  const [hideIncompatible, setHideIncompatibleRaw] = useState(() => LS.get('hideIncompatible', false));
  const setHideIncompatible = (v) => { setHideIncompatibleRaw(v); LS.set('hideIncompatible', v); };
  const [cookbooks, setCookbooks] = useState([]);
  const [cookLog, setCookLog] = useState([]);
  const [cookingNotes, setCookingNotes] = useState([]);
  const setUnits = (v) => { setUnitsRaw(v); LS.set('units', v); };
  const setDietaryFilters = (fn) => setDietaryFiltersRaw(prev => { const next = typeof fn === 'function' ? fn(prev) : fn; LS.set('dietaryFilters', next); return next; });

  const kitchenLoadedFromAPI = useRef(false);

  useEffect(() => {
    LS.set('fridgeIngredients', fridgeIngredients);
    // Only sync to API after the initial load is done (prevent overwriting server data with stale localStorage)
    if (kitchenLoadedFromAPI.current) {
      syncKitchenToAPI(fridgeIngredients, pantryStaples);
    }
  }, [fridgeIngredients]); // eslint-disable-line
  useEffect(() => {
    LS.set('pantryStaples', pantryStaples);
    if (kitchenLoadedFromAPI.current) {
      syncKitchenToAPI(fridgeIngredients, pantryStaples);
    }
  }, [pantryStaples]); // eslint-disable-line

  const loadData = useCallback(async () => {
    try {
      const [ingRes, recipeRes, notesRes, cbRes] = await Promise.all([
        fetch(`${API}/api/ingredients`),
        fetch(`${API}/api/recipes`),
        authFetch ? authFetch(`${API}/api/cooking-notes`) : fetch(`${API}/api/cooking-notes`),
        fetch(`${API}/api/cookbooks`),
      ]);
      if (!ingRes.ok || !recipeRes.ok) throw new Error('Failed to load data');
      const { ingredients } = await ingRes.json();
      const { recipes: recipeData } = await recipeRes.json();
      if (notesRes.ok) { const d = await notesRes.json(); setCookingNotes(d.notes || []); }
      if (cbRes.ok) { const d = await cbRes.json(); setCookbooks(d.cookbooks || d || []); }
      setAllIngredients(ingredients.sort((a, b) => a.name.localeCompare(b.name)));
      setRecipes(recipeData);

      // Load user-specific data if logged in
      if (authToken) {
        const [logRes, favsRes, soonRes] = await Promise.all([
          authFetch(`${API}/api/user/cook-log`),
          authFetch(`${API}/api/user/favorites`),
          authFetch(`${API}/api/user/make-soon`),
        ]);
        if (logRes.ok)  { const d = await logRes.json();  setCookLog(d.entries || []); }
        if (favsRes.ok) { const d = await favsRes.json(); setHeartedIds(d.favorites || []); }
        if (soonRes.ok) { const d = await soonRes.json(); setMakeSoonIds(d.makeSoon || []); }
        // Re-fetch cooking notes with auth
        try { const r = await authFetch(`${API}/api/cooking-notes`); if (r.ok) { const d = await r.json(); setCookingNotes(d.notes || []); } } catch {}
        // Load kitchen from API — ALWAYS overrides localStorage so devices stay in sync
        try {
          const kitRes = await authFetch(`${API}/api/user/kitchen`);
          if (kitRes.ok) {
            const { kitchen } = await kitRes.json();
            const fridge = kitchen.filter(k => k.storage_type === 'fridge').map(k => k.ingredient_name);
            const pantry = kitchen.filter(k => k.storage_type === 'pantry').map(k => k.ingredient_name);
            // Temporarily disable sync so loading from API doesn't write stale data back
            kitchenLoadedFromAPI.current = false;
            setFridgeIngredients(fridge);
            setPantryStaples(pantry);
            // Re-enable sync after state settles
            setTimeout(() => { kitchenLoadedFromAPI.current = true; }, 200);
          }
        } catch {}
      }

      setLastSynced(Date.now());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [authToken, authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const allMyIngredients = useMemo(() => new Set([...fridgeIngredients, ...pantryStaples].map(i => i.toLowerCase().trim())), [fridgeIngredients, pantryStaples]);

  const allTags = useMemo(() => { const tagSet = new Set(); recipes.forEach(r => (r.tags || []).forEach(t => tagSet.add(t))); return Array.from(tagSet).sort(); }, [recipes]);

  const matches = useMemo(() => {
    if (allMyIngredients.size === 0) return [];
    const m = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const have = recipeIngredients.filter(i => allMyIngredients.has(i));
      const missing = recipeIngredients.filter(i => !allMyIngredients.has(i));
      const matchScore = recipeIngredients.length === 0 ? 0 : have.length / recipeIngredients.length;
      return { id: recipe.id, have, missing, matchScore, canMake: missing.length === 0 && recipeIngredients.length > 0 };
    });
    m.sort((a, b) => { if (a.canMake && !b.canMake) return -1; if (!a.canMake && b.canMake) return 1; return b.matchScore - a.matchScore; });
    return m;
  }, [allMyIngredients, recipes]);

  const matchById = useMemo(() => { const map = new Map(); for (const m of matches) map.set(m.id, m); return map; }, [matches]);

  useEffect(() => { setLibraryPage(1); }, [librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes, activeCookbooks]);
  const libraryRecipes = useMemo(() => {
    let list = recipes;
    const q = librarySearch.toLowerCase().trim();
    if (q) list = list.filter(r => r.name.toLowerCase().includes(q));
    if (activeCuisines.length) list = list.filter(r => activeCuisines.includes(r.cuisine || ''));
    if (activeTags.length) list = list.filter(r => activeTags.every(tag => (r.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())));
    if (activeProgresses.length) {
      list = list.filter(r => activeProgresses.some(p => {
        if (p === '__readytocook')  return matchById.get(r.id)?.canMake;
        if (p === '__almostready')  { const m = matchById.get(r.id); return m && m.matchScore >= 0.7 && !m.canMake; }
        if (p === '__makesoon') return makeSoonIds.includes(r.id);
        if (p === '__incomplete') return r.status === 'incomplete';
        if (p === '__needstweaking') return r.status === 'needs tweaking';
        if (p === '__favorite') return heartedIds.includes(r.id);
        if (p === '__complete') return !r.recipe_incomplete && r.status === 'complete';
        if (p === '__totry') return r.status === 'to try';
        return false;
      }));
    }
    if (maxCalories !== null) {
      const parseTime = v => { if (!v) return null; const n = parseFloat(v); return isNaN(n) ? null : n; };
      list = list.filter(r => {
        const c = toNum(r.calories);
        if (c === null) return true;
        return calDir === 'under' ? c <= maxCalories : c >= maxCalories;
      });
    }
    if (maxMinutes !== null) {
      list = list.filter(r => {
        if (!r.time) return true;
        const m = parseInt(r.time);
        return !isNaN(m) && m <= maxMinutes;
      });
    }
    // Cookbook filter
    if (activeCookbooks.length) {
      list = list.filter(r => {
        const cb = (r.cookbook || '').trim();
        return activeCookbooks.some(k => {
          if (k === '__uncategorized') return !cb;
          return cb.toLowerCase() === k.toLowerCase();
        });
      });
    }
    // Hide recipes with dietary conflicts if user opted in
    if (hideIncompatible && dietaryFilters.length > 0) {
      list = list.filter(r => {
        const ings = (r.ingredients || []).map(i => typeof i === 'string' ? { name: i } : i);
        const conflicts = checkDietaryConflicts(ings, dietaryFilters);
        return conflicts.length === 0;
      });
    }
    return list;
  }, [recipes, librarySearch, activeTags, activeCuisines, activeProgresses, maxCalories, calDir, maxMinutes, matchById, hideIncompatible, dietaryFilters, activeCookbooks, makeSoonIds]);

  const hasActiveFilters = !!(librarySearch || activeTags.length || activeCuisines.length || activeProgresses.length || maxCalories !== null || maxMinutes !== null || activeCookbooks.length);
  // Filter button highlight: only when filter chips/sliders are active (not search text)
  const hasActiveFilterChips = !!(activeTags.length || activeCuisines.length || activeProgresses.length || maxCalories !== null || maxMinutes !== null || activeCookbooks.length);
  const clearAllFilters = () => { setLibrarySearch(''); setActiveTags([]); setActiveCuisines([]); setActiveProgresses([]); setMaxCalories(null); setMaxMinutes(null); setActiveCookbooks([]); };

  const openRecipe = async (recipe) => {
    setLastView(view); setView('recipe'); setRecipeLoading(true);
    setSelectedRecipe(null); setRecipeBodyIngredients([]); setRecipeInstructions([]); setRecipeNotes([]);
    try {
      const res = await fetch(`${API}/api/recipes/${recipe.id}`);
      if (!res.ok) throw new Error('Failed to load recipe details');
      const data = await res.json();
      setSelectedRecipe(data.recipe); setRecipeBodyIngredients(data.bodyIngredients || []); setRecipeInstructions(data.instructions || []); setRecipeNotes(data.notes || []);
    } catch (e) { setError(e.message); } finally { setRecipeLoading(false); }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><p>Loading your recipes...</p></div>;

  if (error) return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h2>Couldn't connect to the server</h2>
      <p>{error}</p>
      <p className="error-hint">Make sure your backend is running and your .env is configured.</p>
      <button className="btn btn--primary" onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  return (
    <div className="app">
      {showLogin && <LoginModal onLogin={handleLogin} />}
      <header className="app-header">
        <div className="app-header__bar">
          {/* Mobile: back/search bar (recipes view) or logo */}
          <div className="app-header__mobile-left">
            {/* All pages: back button (non-home) + search pill always visible */}
            {!mobileSearchOpen ? (
              <>
                {view !== 'home' && (
                  <button className="app-header__back-btn" onClick={() => setView('home')} aria-label="Back to Home">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                )}
                {view === 'home' && (
                  <button className="app-header__brand app-header__brand--mobile-compact" onClick={() => setView('home')}>
                    <span className="app-header__logo"><Icon name="flame" size={20} color="var(--terracotta)" strokeWidth={1.75} /></span>
                  </button>
                )}
                {/* Search pill on ALL pages including Home */}
                <button className="app-header__mobile-search-pill" onClick={() => setMobileSearchOpen(true)}>
                  <Icon name="search" size={14} strokeWidth={2} />
                  <span>{mobileSearchSubmitted && mobileSearchQuery ? mobileSearchQuery : 'Search recipes...'}</span>
                </button>
              </>
            ) : (
              /* Search bar open — shown from any page */
              <div className="app-header__mobile-search-bar" style={{position:'relative'}}>
                <Icon name="search" size={14} strokeWidth={2} color="var(--warm-gray)" />
                <input
                  className="app-header__mobile-search-input"
                  placeholder="Search recipes..."
                  value={mobileSearchQuery}
                  autoFocus
                  style={{ fontSize: '16px', touchAction: 'manipulation' }}
                  onChange={e => { setMobileSearchQuery(e.target.value); setMobileSearchSubmitted(false); setLibrarySearch(e.target.value); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const q = mobileSearchQuery.toLowerCase().trim();
                      const hits = recipes.filter(r => r.name.toLowerCase().includes(q));
                      if (hits.length === 1) {
                        setMobileSearchOpen(false);
                        openRecipe(hits[0]);
                      } else {
                        setMobileSearchSubmitted(true);
                        setMobileSearchOpen(false);
                        setLibrarySearch(mobileSearchQuery);
                        setView('recipes');
                      }
                    }
                    if (e.key === 'Escape') { setMobileSearchOpen(false); }
                  }}
                />
                {mobileSearchQuery && (
                  <button className="app-header__mobile-search-clear" onClick={() => { setMobileSearchQuery(''); setMobileSearchSubmitted(false); setLibrarySearch(''); }}>✕</button>
                )}
                {!mobileSearchQuery && (
                  <button className="app-header__mobile-search-clear" onClick={() => { setMobileSearchOpen(false); setMobileSearchQuery(''); setLibrarySearch(''); }}>✕</button>
                )}
                {/* Autocomplete dropdown with images */}
                {mobileSearchQuery && !mobileSearchSubmitted && (() => {
                  const q = mobileSearchQuery.toLowerCase().trim();
                  const suggestions = recipes.filter(r => r.name.toLowerCase().includes(q)).slice(0, 6);
                  return suggestions.length > 0 ? (
                    <div className="mobile-search-dropdown">
                      {suggestions.map(r => (
                        <button key={r.id} className="mobile-search-dropdown__item" onMouseDown={e => {
                          e.preventDefault();
                          setMobileSearchOpen(false);
                          setMobileSearchQuery(r.name);
                          setMobileSearchSubmitted(true);
                          openRecipe(r);
                        }}>
                          {r.coverImage
                            ? <img src={r.coverImage} alt={r.name} className="mobile-search-dropdown__item-img" />
                            : <div className="mobile-search-dropdown__item-img-placeholder"><Icon name="image" size={16} color="var(--ash)" strokeWidth={1.5} /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mobile-search-dropdown__item-name">{r.name}</div>
                            {(r.cuisine || r.time) && <div className="mobile-search-dropdown__item-meta">{[r.cuisine, r.time].filter(Boolean).join(' · ')}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          {/* Desktop brand (always shown on desktop) */}
          <button className="app-header__brand app-header__brand--desktop" onClick={() => setView('home')}>
            <span className="app-header__logo"><Icon name="flame" size={20} color="var(--terracotta)" strokeWidth={1.75} /></span>
            <span className="app-header__title">Hearth</span>
          </button>
          {/* Desktop nav */}
          <nav className="nav-tabs">
            {[
              { key: 'home',      label: 'Home'         },
              { key: 'recipes',   label: 'Recipes'      },
              { key: 'kitchen',   label: 'Kitchen'      },
              { key: 'grocery',   label: 'Grocery'      },
              { key: 'cookbooks', label: 'Cookbooks'    },
              { key: 'notes',     label: 'Notes'        },
              ...(isAdmin ? [{ key: 'add', label: 'Add' }] : []),
            ].map(({ key, label }) => (
              <button key={key} className={`nav-tab ${view === key ? 'nav-tab--active' : ''}`} onClick={() => setView(key)} disabled={key === 'recipes' && recipes.length === 0}>
                {label}
              </button>
            ))}
          </nav>
          {/* User avatar -- desktop only */}
          {authUser && (
            <button className="header-user-btn header-user-btn--desktop-only" onClick={() => setView('profile')} title="Go to profile">
              <span className="header-user-btn__name">{authUser.display_name || authUser.username}</span>
            </button>
          )}
          {/* Mobile hamburger */}
          <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(o => !o)} aria-label="Menu">
            <span className={`mobile-menu-btn__bar ${mobileNavOpen ? 'mobile-menu-btn__bar--open-1' : ''}`} />
            <span className={`mobile-menu-btn__bar ${mobileNavOpen ? 'mobile-menu-btn__bar--open-2' : ''}`} />
            <span className={`mobile-menu-btn__bar ${mobileNavOpen ? 'mobile-menu-btn__bar--open-3' : ''}`} />
          </button>
        </div>
        {/* Mobile nav overlay — floats over content, does not push page down */}
        {mobileNavOpen && (
          <>
            {/* Backdrop to close on tap-outside */}
            <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
            <nav className="mobile-nav-overlay">
              {/* Brand header */}
              <div className="mobile-nav-overlay__brand">
                <span className="mobile-nav-overlay__flame"><Icon name="flame" size={22} color="var(--terracotta)" strokeWidth={1.75} /></span>
                <span className="mobile-nav-overlay__title">Hearth</span>
              </div>
              <div className="mobile-nav-overlay__divider" />
              {/* Nav items */}
              {[
                { key: 'home',      label: 'Home',      icon: 'home'      },
                { key: 'recipes',   label: 'Recipes',   icon: 'bookOpen'  },
                { key: 'kitchen',   label: 'Kitchen',   icon: 'package'   },
                { key: 'grocery',   label: 'Grocery',   icon: 'cart'      },
                { key: 'cookbooks', label: 'Cookbooks', icon: 'bookMarked'},
                { key: 'notes',     label: 'Notes',     icon: 'lightbulb' },
                ...(isAdmin ? [{ key: 'add', label: 'Add Recipe', icon: 'plus' }] : []),
              ].map(({ key, label, icon }) => (
                <button key={key}
                  className={`mobile-nav-item ${view === key ? 'mobile-nav-item--active' : ''}`}
                  onClick={() => { setView(key); setMobileNavOpen(false); }}
                  disabled={key === 'recipes' && recipes.length === 0}>
                  <Icon name={icon} size={16} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
              <div className="mobile-nav-overlay__divider" />
              {authUser && (
                <button
                  className={`mobile-nav-item ${view === 'profile' ? 'mobile-nav-item--active' : ''}`}
                  onClick={() => { setView('profile'); setMobileNavOpen(false); }}
                >
                  <Icon name="user" size={16} strokeWidth={1.75} /> Profile
                </button>
              )}
              {authUser && (
                <button className="mobile-nav-item mobile-nav-item--signout" onClick={() => { handleLogout(); setMobileNavOpen(false); }}>
                  <Icon name="arrowRight" size={16} strokeWidth={1.75} /> Sign out
                </button>
              )}
            </nav>
          </>
        )}
      </header>

      {view === 'recipe' && !editingRecipe && (
        <>
          {/* iOS-style: ghost of the PREVIOUS screen sits behind, dimmed, slightly pushed left */}
          <div style={{
            position:'fixed', inset:0, zIndex:1, overflow:'hidden', pointerEvents:'none',
            background: 'var(--parchment)',
          }}>
            {/* Dim overlay -- lightens as page slides away */}
            <div style={{
              position:'absolute', inset:0, zIndex:2,
              background:'rgba(0,0,0,0.18)',
              opacity: swipeDx > 0 ? Math.max(0, 1 - swipeDx / 300) : 1,
              transition: swipeDx === 0 ? 'opacity 0.3s ease' : 'none',
            }} />
            {/* Previous-screen indicator: subtle back chevron + label */}
            <div style={{
              position:'absolute', left:16, top:'50%', transform:'translateY(-50%)',
              zIndex:3, display:'flex', alignItems:'center', gap:6,
              color:'var(--warm-gray)', fontSize:14, fontWeight:600,
              opacity: swipeDx > 30 ? Math.min((swipeDx - 30) / 80, 1) : 0,
              transition: swipeDx === 0 ? 'opacity 0.2s ease' : 'none',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </div>
          </div>
          {/* Current recipe page -- slides right on swipe */}
          <div
            onTouchStart={handleSwipeTouchStart}
            onTouchMove={handleSwipeTouchMove}
            onTouchEnd={handleSwipeTouchEnd}
            style={{
              flex:1, display:'flex', flexDirection:'column',
              position:'relative', zIndex:2,
              transform: swipeDx > 0 ? `translateX(${Math.min(swipeDx, window.innerWidth)}px)` : 'none',
              transition: swipeDx === 0 ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
              boxShadow: swipeDx > 0 ? '-12px 0 32px rgba(0,0,0,0.22)' : 'none',
              willChange: 'transform',
            }}
          >
        <RecipePage
          recipe={selectedRecipe} bodyIngredients={recipeBodyIngredients} instructions={recipeInstructions} notes={recipeNotes} cookingNotes={cookingNotes}
          loading={recipeLoading} onBack={() => setView(lastView)}
          allIngredients={allIngredients}
          cookbooks={cookbooks}
          dietaryFilters={dietaryFilters}
          authFetch={authFetch}
          isAdmin={isAdmin}
          onMarkCooked={(recipeId, toRemove) => {
            setMakeSoonIds(prev => prev.filter(id => id !== recipeId));
            if (toRemove?.length) {
              const lower = toRemove.map(n => n.toLowerCase().trim());
              setFridgeIngredients(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
              setPantryStaples(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
            }
            authFetch(`${API}/api/user/cook-log`).then(r => r.json()).then(d => setCookLog(d.entries || [])).catch(() => {});
          }}
          isHearted={selectedRecipe ? heartedIds.includes(selectedRecipe.id) : false}
          onToggleHeart={() => selectedRecipe && toggleHeart(selectedRecipe.id)}
          isMakeSoon={selectedRecipe ? makeSoonIds.includes(selectedRecipe.id) : false}
          onToggleMakeSoon={() => selectedRecipe && toggleMakeSoon(selectedRecipe.id)}
          onDelete={(deletedId) => {
            setHeartedIds(prev => prev.filter(x => x !== deletedId));
            setMakeSoonIds(prev => prev.filter(x => x !== deletedId));
            // Remove any cookbook entry whose recipeId matches the deleted recipe
            setCookbooks(prev => prev.map(cb => ({
              ...cb,
              recipes: (cb.recipes || []).filter(e => e.recipeId !== deletedId),
            })));
            loadData();
            setView(lastView);
          }}
          onSaved={async (updated) => {
            setSelectedRecipe(updated);
            try {
              const res = await fetch(`${API}/api/recipes/${updated.id}`);
              const data = await res.json();
              setSelectedRecipe(data.recipe);
              setRecipeBodyIngredients(data.bodyIngredients || []);
              setRecipeInstructions(data.instructions || []);
              setRecipeNotes(data.notes || []);
            } catch {}
            loadData();
          }}
        />
          </div>
        </>
      )}

      {view === 'recipe' && editingRecipe && (
        <RecipeEditor
          recipe={selectedRecipe} bodyIngredients={recipeBodyIngredients} instructions={recipeInstructions} notes={recipeNotes}
          allIngredients={allIngredients}
          authFetch={authFetch}
          onBack={() => setEditingRecipe(false)}
          onSaved={async (updated) => {
            setSelectedRecipe(updated); setEditingRecipe(false);
            try {
              const res = await fetch(`${API}/api/recipes/${updated.id}`);
              const data = await res.json();
              setSelectedRecipe(data.recipe); setRecipeBodyIngredients(data.bodyIngredients || []); setRecipeInstructions(data.instructions || []); setRecipeNotes(data.notes || []);
            } catch {}
            loadData();
          }}
        />
      )}

      {view === 'kitchen' && (
        <FridgeTab allIngredients={allIngredients} setAllIngredients={setAllIngredients} fridgeIngredients={fridgeIngredients} setFridgeIngredients={setFridgeIngredients} pantryStaples={pantryStaples} setPantryStaples={setPantryStaples} authFetch={authFetch} />
      )}

      {/* ======================================================
          HOME VIEW
      ====================================================== */}
      {view === 'home' && (
        <main className="view home-view">

          {/* -- Left column -- */}
          <div className="home-main">

            {/* -- ⏱ Make Soon -- */}
            {(() => {
              const makeSoonRecipes = recipes.filter(r => makeSoonIds.includes(r.id));
              const visibleSoon = showAllSoon ? makeSoonRecipes : makeSoonRecipes.slice(0, 4);
              return (
                <div className="home-section">
                  <div className="home-section__header">
                    <h2 className="home-section__title">Make Soon</h2>
                    {makeSoonIds.length > 0 && (
                      <button className="btn btn--ghost btn--sm home-section__view-all" onClick={() => { setActiveTags([]); setActiveCuisines([]); setActiveProgresses(['__makesoon']); setActiveCookbooks([]); setLibrarySearch(''); setLibraryPage(1); setView('recipes'); }}>View all →</button>
                    )}
                  </div>
                  {makeSoonIds.length === 0 ? (
                    <div className="home-empty-cta" onClick={() => setView('recipes')}>
                      <span className="home-empty-cta__icon"><Icon name="list" size={32} strokeWidth={1.5} /></span>
                      <div>
                        <p className="home-empty-cta__title">Plan your week</p>
                        <p className="home-empty-cta__sub">Tap ⏱ on any recipe to add it here</p>
                      </div>
                      <span className="home-empty-cta__arrow">→</span>
                    </div>
                  ) : (
                    <HScrollRow count={makeSoonRecipes.length}>
                        {makeSoonRecipes.map(r => (
                          <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                            isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                            isMakeSoon={true} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                            onMarkCooked={(recipe) => setCookingRecipe(recipe)} />
                        ))}
                    </HScrollRow>
                  )}
                </div>
              );
            })()}

            {/* -- What can I make? -- */}
            {(() => {
              const goodMatches = matches.filter(m => m.matchScore > 0);
              const visibleMatch = showAllMatch ? goodMatches : goodMatches.slice(0, 4);
              return (
                <div className="home-section">
                  <div className="home-section__header">
                    <h2 className="home-section__title">What can I make?</h2>
                    {allMyIngredients.size > 0 ? (
                      <button className="btn btn--ghost btn--sm home-section__view-all" onClick={() => { setActiveProgresses(['__makesoon']); setActiveTags([]); setActiveCuisines([]); setActiveCookbooks([]); setLibrarySearch(''); setLibraryPage(1); setView('recipes'); }}>View all →</button>
                    ) : (
                      <button className="btn btn--ghost btn--sm" onClick={() => setView('kitchen')}>Set ingredients →</button>
                    )}
                  </div>
                  {allMyIngredients.size === 0 ? (
                    <div className="home-empty-cta" onClick={() => setView('kitchen')}>
                      <span className="home-empty-cta__icon"><Icon name="chefHat" size={32} strokeWidth={1.5} /></span>
                      <div>
                        <p className="home-empty-cta__title">Add your kitchen &amp; pantry ingredients</p>
                        <p className="home-empty-cta__sub">We'll show you what you can cook right now</p>
                      </div>
                      <span className="home-empty-cta__arrow">→</span>
                    </div>
                  ) : goodMatches.length > 0 ? (
                    <HScrollRow count={goodMatches.length}>
                      {goodMatches.map(m => {
                          const r = recipes.find(x => x.id === m.id);
                          if (!r) return null;
                          return <RecipeCard key={r.id} recipe={r} match={m} onClick={openRecipe}
                            isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                            isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                            showScore={true} />;
                        })}
                    </HScrollRow>
                  ) : <p className="home-no-matches">No matches yet -- try adding more ingredients in the Kitchen tab.</p>}
                </div>
              );
            })()}

                    </div>{/* end home-main */}

          {/* -- Right sidebar: Quick Actions FIRST, then Insights -- */}
          <aside className="home-sidebar">

          <div className="insights-card">
              <h3 className="insights-title">Recipe Insights</h3>
              <div className="insights-grid">
                <button className="insight-item insight-item--green insight-item--btn"
                  onClick={() => { setActiveProgresses(['__readytocook']); setView('recipes'); }}>
                  <span className="insight-item__number">{matches.filter(m => m.canMake).length}</span>
                  <span className="insight-item__label">Ready to cook</span>
                  <span className="insight-item__icon"><Icon name="checkCircle" size={16} color="var(--insight-green-ic)" /></span>
                </button>
                <button className="insight-item insight-item--amber insight-item--btn"
                  onClick={() => { setActiveProgresses(['__almostready']); setView('recipes'); }}>
                  <span className="insight-item__number">{matches.filter(m => m.matchScore >= 0.7 && !m.canMake).length}</span>
                  <span className="insight-item__label">Almost ready</span>
                  <span className="insight-item__icon"><Icon name="flame" size={16} color="var(--insight-amber-ic)" /></span>
                </button>
                <button className="insight-item insight-item--purple insight-item--btn"
                  onClick={() => { setMaxMinutes(30); setView('recipes'); }}>
                  <span className="insight-item__number">
                    {recipes.filter(r => { const t = (r.time || '').toLowerCase(); const m = t.match(/(\d+)/); return m && parseInt(m[1]) <= 30; }).length}
                  </span>
                  <span className="insight-item__label">Under 30 min</span>
                  <span className="insight-item__icon"><Icon name="clock" size={16} color="var(--insight-rust-ic)" /></span>
                </button>
                <button className="insight-item insight-item--orange insight-item--btn"
                  onClick={() => { setActiveProgresses(['__favorite']); setView('recipes'); }}>
                  <span className="insight-item__number">{heartedIds.filter(id => recipes.some(r => r.id === id)).length}</span>
                  <span className="insight-item__label">Favorites</span>
                  <span className="insight-item__icon"><Icon name="heart" size={16} color="var(--insight-gold-ic)" /></span>
                </button>
                <button className="insight-item insight-item--sage insight-item--btn" style={{ cursor: 'default' }}>
                  <span className="insight-item__number">
                    {(() => {
                      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                      return cookLog.filter(e => new Date(e.cooked_at) >= weekAgo).length;
                    })()}
                  </span>
                  <span className="insight-item__label">Cooked this week</span>
                  <span className="insight-item__icon"><Icon name="chefHat" size={16} color="var(--insight-sage-ic)" /></span>
                </button>
                <button className="insight-item insight-item--blue insight-item--btn"
                  onClick={() => { clearAllFilters(); setView('recipes'); }}>
                  <span className="insight-item__number">{recipes.length}</span>
                  <span className="insight-item__label">Total recipes</span>
                  <span className="insight-item__icon"><Icon name="bookMarked" size={16} color="var(--insight-brown-ic)" /></span>
                </button>
              </div>
            </div>

            <div className="quick-actions-card">
              <h3 className="insights-title">Quick Actions</h3>
              <div className="quick-actions-list">
                <button className="quick-action" onClick={() => setView('recipes')}>
                  <span className="quick-action__icon"><Icon name="bookOpen" size={18} strokeWidth={1.75} /></span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Browse all recipes</span>
                    <span className="quick-action__sub">{recipes.length} in your library</span>
                  </div>
                  <span className="quick-action__arrow"><Icon name="arrowRight" size={14} strokeWidth={1.75} /></span>
                </button>
                <button className="quick-action" onClick={() => setView('kitchen')}>
                  <span className="quick-action__icon"><Icon name="package" size={18} strokeWidth={1.75} /></span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Update my kitchen</span>
                    <span className="quick-action__sub">{fridgeIngredients.length + pantryStaples.length} ingredients tracked</span>
                  </div>
                  <span className="quick-action__arrow"><Icon name="arrowRight" size={14} strokeWidth={1.75} /></span>
                </button>
                <button className="quick-action" onClick={() => setView('grocery')}>
                  <span className="quick-action__icon"><Icon name="cart" size={18} strokeWidth={1.75} /></span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Build grocery list</span>
                    <span className="quick-action__sub">Plan your weekly shop</span>
                  </div>
                  <span className="quick-action__arrow"><Icon name="arrowRight" size={14} strokeWidth={1.75} /></span>
                </button>
                {matches.filter(m => m.canMake).length > 0 && (
                  <button className="quick-action quick-action--highlight" onClick={() => { setActiveTag(null); setActiveCuisine(''); setLibrarySearch(''); setView('recipes'); }}>
                    <span className="quick-action__icon"><Icon name="utensils" size={18} strokeWidth={1.75} /></span>
                    <div className="quick-action__text">
                      <span className="quick-action__label">Cook something now</span>
                      <span className="quick-action__sub">{matches.filter(m => m.canMake).length} recipes you can make</span>
                    </div>
                    <span className="quick-action__arrow"><Icon name="arrowRight" size={14} strokeWidth={1.75} /></span>
                  </button>
                )}
                <button className="quick-action quick-action--surprise" onClick={() => {
                  if (recipes.length === 0) return;
                  const r = recipes[Math.floor(Math.random() * recipes.length)];
                  openRecipe(r);
                }}>
                  <span className="quick-action__icon"><Icon name="shuffle" size={18} strokeWidth={1.75} /></span>
                  <div className="quick-action__text">
                    <span className="quick-action__label">Surprise me!</span>
                    <span className="quick-action__sub">Open a random recipe</span>
                  </div>
                  <span className="quick-action__arrow"><Icon name="arrowRight" size={14} strokeWidth={1.75} /></span>
                </button>
              </div>
            </div>

          </aside>
        </main>
      )}

      {view === 'recipes' && (() => {
        const allCuisinesPool = GEO_CUISINES; // strictly geo only -- DB cuisine values are not shown as filters
        const PAGE_SIZE = window.innerWidth <= 640 ? 12 : 24;
        const totalPages = Math.max(1, Math.ceil(libraryRecipes.length / PAGE_SIZE));
        const safePage = Math.min(libraryPage, totalPages);
        const pageRecipes = libraryRecipes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
        const toggleTag = k => setActiveTags(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const toggleCuisine = c => setActiveCuisines(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
        const toggleProgress = k => setActiveProgresses(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const toggleCookbook = k => setActiveCookbooks(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
        const activeCount = activeTags.length + activeCuisines.length + activeProgresses.length + (maxCalories !== null ? 1 : 0) + (maxMinutes !== null ? 1 : 0) + activeCookbooks.length;
        return (
          <main className="view">
            {/* -- Page header -- */}
            <div className="recipes-page-header">
              {mobileSearchSubmitted && mobileSearchQuery ? (
                <div className="recipes-page-header__search-results">
                  <h1 className="recipes-page-header__title">Search results for <em>"{mobileSearchQuery}"</em></h1>
                  <button className="recipes-page-header__clear" onClick={() => { setMobileSearchQuery(''); setMobileSearchSubmitted(false); setLibrarySearch(''); }}>✕ Clear</button>
                </div>
              ) : (
                <h1 className="recipes-page-header__title">All Recipes</h1>
              )}
            </div>

            {/* -- Search + Filter Toggle -- */}
            <div className="recipes-search-row">
              <div className="recipes-search-row__top recipes-search-row__top--desktop-search">
                <div className="filter-bar__search-wrap filter-bar__search-wrap--standalone">
                  <span className="filter-bar__search-icon"><Icon name="search" size={15} strokeWidth={2} /></span>
                  <input
                    className="filter-bar__search"
                    type="search"
                    placeholder="Search recipes..."
                    value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                  />
                  {librarySearch && (
                    <button className="filter-bar__clear-x" onClick={() => setLibrarySearch('')}>✕</button>
                  )}
                </div>
                <button
                  className={`layout-toggle-btn ${libraryLayout === 'list' ? 'layout-toggle-btn--active' : ''}`}
                  onClick={() => { setLibraryLayout(l => l === 'grid' ? 'list' : 'grid'); setLibraryPage(1); }}
                  title={libraryLayout === 'grid' ? 'Switch to list view' : 'Switch to gallery view'}
                >
                  {libraryLayout === 'grid' ? <Icon name="list" size={16} strokeWidth={2} /> : <Icon name="grid" size={16} strokeWidth={2} />}
                </button>
              </div>
              {/* Mobile: filters + layout toggle row (no search bar since it's in the header) */}
              <div className="recipes-search-row__top recipes-search-row__top--mobile-filters">
                <div className="recipes-search-row__bottom recipes-search-row__bottom--mobile-inline">
                  <button
                    className={`filters-toggle-btn ${filtersOpen ? 'filters-toggle-btn--open' : ''} ${hasActiveFilters ? 'filters-toggle-btn--active' : ''}`}
                    onClick={() => setFiltersOpen(o => !o)}
                  >
                    <><Icon name="sliders" size={14} strokeWidth={2} /> Filters{activeCount > 0 ? ` · ${activeCount}` : ''}</>
                    <span className="filters-toggle-btn__arrow">{filtersOpen ? '▴' : '▾'}</span>
                  </button>
                  {hasActiveFilters && (
                    <button className="filter-bar__reset" onClick={clearAllFilters}>✕ Clear</button>
                  )}
                </div>
                <button
                  className={`layout-toggle-btn ${libraryLayout === 'list' ? 'layout-toggle-btn--active' : ''}`}
                  onClick={() => { setLibraryLayout(l => l === 'grid' ? 'list' : 'grid'); setLibraryPage(1); }}
                  title={libraryLayout === 'grid' ? 'Switch to list view' : 'Switch to gallery view'}
                >
                  {libraryLayout === 'grid' ? <Icon name="list" size={16} strokeWidth={2} /> : <Icon name="grid" size={16} strokeWidth={2} />}
                </button>
              </div>
              <div className="recipes-search-row__bottom recipes-search-row__bottom--desktop-only">
                <button
                  className={`filters-toggle-btn ${filtersOpen ? 'filters-toggle-btn--open' : ''} ${hasActiveFilters ? 'filters-toggle-btn--active' : ''}`}
                  onClick={() => setFiltersOpen(o => !o)}
                >
                  <><Icon name="sliders" size={14} strokeWidth={2} /> Filters{activeCount > 0 ? ` · ${activeCount}` : ''}</>
                  <span className="filters-toggle-btn__arrow">{filtersOpen ? '▴' : '▾'}</span>
                </button>
                {hasActiveFilters && (
                  <button className="filter-bar__reset" onClick={clearAllFilters}>✕ Clear</button>
                )}
              </div>
            </div>

            {/* -- Filter Panel -- */}
            {filtersOpen && (
              <div className="filter-panel">

                {/* Cuisine -- rounded icon chips */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Cuisine</span>
                  <div className="filter-panel__chips">
                    {allCuisinesPool.map(c => (
                      <button key={c}
                        className={`filter-bar__chip ${activeCuisines.includes(c) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleCuisine(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Tags</span>
                  <div className="filter-panel__chips">
                    {TAG_FILTERS.map(({ key, label }) => (
                      <button key={key}
                        className={`filter-bar__chip ${activeTags.includes(key) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleTag(key)}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Progress */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Progress</span>
                  <div className="filter-panel__chips">
                    {PROGRESS_FILTERS.map(({ key, label }) => (
                      <button key={key}
                        className={`filter-bar__chip ${activeProgresses.includes(key) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleProgress(key)}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Cookbook */}
                <div className="filter-panel__group">
                  <span className="filter-panel__label">Cookbook</span>
                  <div className="filter-panel__chips">
                    <button
                      className={`filter-bar__chip ${activeCookbooks.includes('__uncategorized') ? 'filter-bar__chip--active' : ''}`}
                      onClick={() => toggleCookbook('__uncategorized')}
                    >No cookbook</button>
                    {cookbooks.map(cb => (
                      <button key={cb.title}
                        className={`filter-bar__chip ${activeCookbooks.includes(cb.title) ? 'filter-bar__chip--active' : ''}`}
                        onClick={() => toggleCookbook(cb.title)}
                      >{cb.title}</button>
                    ))}
                  </div>
                </div>

                {/* Calories slider */}
                <div className="filter-panel__group filter-panel__group--slider">
                  <div className="filter-panel__slider-header">
                    <span className="filter-panel__label">Calories</span>
                    <div className="filter-panel__cal-dir">
                      {['under','over'].map(d => (
                        <button key={d} className={`filter-panel__dir-btn ${calDir === d ? 'filter-panel__dir-btn--active' : ''}`}
                          onClick={() => setCalDir(d)}>{d}</button>
                      ))}
                    </div>
                    {maxCalories !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxCalories(null)}>✕ clear</button>}
                  </div>
                  <div className="filter-panel__slider-wrap">
                    <span className="filter-panel__slider-edge">100</span>
                    <div className="filter-panel__slider-track">
                      {maxCalories !== null && (
                        <div className="filter-panel__slider-bubble"
                          style={{ left: `${((maxCalories - 100) / 1400) * 100}%` }}>
                          {calDir} {maxCalories} kcal
                        </div>
                      )}
                      <input type="range" className="filter-panel__slider" min={100} max={1500} step={50}
                        value={maxCalories ?? 800}
                        onChange={e => setMaxCalories(Number(e.target.value))}
                        onMouseDown={() => { if (maxCalories === null) setMaxCalories(800); }}
                        onTouchStart={() => { if (maxCalories === null) setMaxCalories(800); }}
                      />
                    </div>
                    <span className="filter-panel__slider-edge">1500</span>
                  </div>
                </div>

                {/* Time slider */}
                <div className="filter-panel__group filter-panel__group--slider">
                  <div className="filter-panel__slider-header">
                    <span className="filter-panel__label">Time</span>
                    {maxMinutes !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxMinutes(null)}>✕ clear</button>}
                  </div>
                  <div className="filter-panel__slider-wrap">
                    <span className="filter-panel__slider-edge">10m</span>
                    <div className="filter-panel__slider-track">
                      {maxMinutes !== null && (
                        <div className="filter-panel__slider-bubble"
                          style={{ left: `${((maxMinutes - 10) / 170) * 100}%` }}>
                          under {maxMinutes} min
                        </div>
                      )}
                      <input type="range" className="filter-panel__slider" min={10} max={180} step={5}
                        value={maxMinutes ?? 60}
                        onChange={e => setMaxMinutes(Number(e.target.value))}
                        onMouseDown={() => { if (maxMinutes === null) setMaxMinutes(60); }}
                        onTouchStart={() => { if (maxMinutes === null) setMaxMinutes(60); }}
                      />
                    </div>
                    <span className="filter-panel__slider-edge">180m</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="active-filter-pills">
                {activeCuisines.map(c => <span key={c} className="active-filter-pill">{CUISINE_ICON[c] && <Icon name={CUISINE_ICON[c]} size={12} strokeWidth={2} />} {c} <button onClick={() => toggleCuisine(c)}>✕</button></span>)}
                {activeTags.map(k => <span key={k} className="active-filter-pill">{TAG_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleTag(k)}>✕</button></span>)}
                {activeProgresses.map(k => <span key={k} className="active-filter-pill">{PROGRESS_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleProgress(k)}>✕</button></span>)}
                {activeCookbooks.map(k => <span key={k} className="active-filter-pill">{k === '__uncategorized' ? 'No cookbook' : k} <button onClick={() => toggleCookbook(k)}>✕</button></span>)}
                {maxCalories !== null && <span className="active-filter-pill">{calDir} {maxCalories} kcal <button onClick={() => setMaxCalories(null)}>✕</button></span>}
                {maxMinutes !== null && <span className="active-filter-pill">under {maxMinutes} min <button onClick={() => setMaxMinutes(null)}>✕</button></span>}
              </div>
            )}

            <div className="recipes-grid-spacer" />

            {(() => {
              if (libraryRecipes.length === 0) return (
                <div className="results-empty">
                  <p>No recipes match your filters.</p>
                  <button className="btn btn--ghost btn--sm" style={{marginTop:12}} onClick={clearAllFilters}>Clear filters</button>
                </div>
              );
              return (
                <>
                  {libraryLayout === 'grid' ? (
                    <div className="recipe-grid">
                      {pageRecipes.map(r => (
                        <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                          isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                          isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                          showScore={activeProgresses.some(p => p === '__readytocook' || p === '__almostready')}
                          onConvertRef={(recipe) => setCookingRecipe({ ...recipe, _convertRef: true })}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="recipe-list-table">
                      <div className="recipe-list-table__header">
                        <span className="rlt__col rlt__col--name">Recipe</span>
                        <span className="rlt__col rlt__col--cuisine">Cuisine</span>
                        <span className="rlt__col rlt__col--tags">Tags</span>
                        <span className="rlt__col rlt__col--time">Time</span>
                        <span className="rlt__col rlt__col--cal">Calories</span>
                        <span className="rlt__col rlt__col--protein">Protein</span>
                        <span className="rlt__col rlt__col--status">Status</span>
                        <span className="rlt__col rlt__col--actions"></span>
                      </div>
                      {pageRecipes.map(r => {
                        const calories = toNum(r.calories);
                        const protein  = toNum(r.protein);
                        const match = matchById.get(r.id);
                        const canMakeNow = Boolean(match?.canMake);
                        const progress = r.recipe_incomplete ? <Icon name="alertTriangle" size={12} strokeWidth={2} /> : r.status === 'needs tweaking' ? <Icon name="tool" size={12} strokeWidth={2} /> : r.status === 'complete' ? <Icon name="checkCircle" size={12} strokeWidth={2} /> : r.status === 'to try' ? <Icon name="bookMarked" size={12} strokeWidth={2} /> : null;
                        const tags = r.tags || [];
                        return (
                          <div key={r.id} className={`recipe-list-table__row${makeSoonIds.includes(r.id) ? ' recipe-list-table__row--make-soon' : ''}`} onClick={() => openRecipe(r)}>
                            <span className="rlt__col rlt__col--name">
                              {r.coverImage
                                ? <img className="rlt__thumb" src={r.coverImage} alt="" loading="lazy" />
                                : <span className="rlt__thumb rlt__thumb--placeholder"><Icon name="image" size={20} color="var(--ash)" strokeWidth={1.5} /></span>}
                              <span className="rlt__name">{r.name}</span>
                              {canMakeNow && <span className="rlt__ready">✓</span>}
                            </span>
                            <span className="rlt__col rlt__col--cuisine">{r.cuisine || <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--tags">
                              {tags.length > 0
                                ? tags.slice(0, 3).map(t => {
                                    const def = TAG_FILTERS.find(f => f.key === t);
                                    return <span key={t} className="rlt__tag">{def ? def.label.split(' ')[0] : t}</span>;
                                  })
                                : <span className="rlt__empty">--</span>}
                              {tags.length > 3 && <span className="rlt__tag rlt__tag--more">+{tags.length - 3}</span>}
                            </span>
                            <span className="rlt__col rlt__col--time">{r.time || <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--cal">{calories !== null ? `${Math.round(calories)} kcal` : <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--protein">{protein !== null ? `${Math.round(protein)}g` : <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--status">{progress || <span className="rlt__empty">--</span>}</span>
                            <span className="rlt__col rlt__col--actions" onClick={e => e.stopPropagation()}>
                              <button
                                className={`rlt__heart ${heartedIds.includes(r.id) ? 'rlt__heart--on' : ''}`}
                                onClick={() => toggleHeart(r.id)}
                                title={heartedIds.includes(r.id) ? 'Remove from favorites' : 'Add to favorites'}
                              ><Icon name="heart" size={14} strokeWidth={2} /></button>
                              <button
                                className={`rlt__soon ${makeSoonIds.includes(r.id) ? 'rlt__soon--on' : ''}`}
                                onClick={() => toggleMakeSoon(r.id)}
                                title={makeSoonIds.includes(r.id) ? 'Remove from Make Soon' : 'Add to Make Soon'}
                              ><Icon name="timer" size={14} strokeWidth={2} /></button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {totalPages > 1 && (
                    <div className="pager">
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>← Prev</button>
                      <div className="pager__pages">
                        {(() => {
                          const pages = [];
                          for (let p = 1; p <= totalPages; p++) {
                            const isFirst2 = p <= 2;
                            const isLast2 = p >= totalPages - 1;
                            const isNearCurrent = Math.abs(p - safePage) <= 1;
                            const show = totalPages <= 7 || isFirst2 || isLast2 || isNearCurrent;
                            if (!show) continue;
                            // Check if gap before this page
                            const prevWasShown = p === 1 || (() => {
                              const pp = p - 1;
                              return totalPages <= 7 || pp <= 2 || pp >= totalPages - 1 || Math.abs(pp - safePage) <= 1;
                            })();
                            if (!prevWasShown) pages.push(<span key={`ellipsis-${p}`} className="pager__ellipsis">...</span>);
                            pages.push(<button key={p} className={`pager__num ${p === safePage ? 'pager__num--active' : ''}`} onClick={() => setLibraryPage(p)}>{p}</button>);
                          }
                          return pages;
                        })()}
                      </div>
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>Next →</button>
                    </div>
                  )}
                  <p className="recipes-total-count">{libraryRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
                </>
              );
            })()}
          </main>
        );
      })()}

      {view === 'grocery' && <GroceryListTab recipes={recipes} makeSoonIds={makeSoonIds} allMyIngredients={allMyIngredients} allIngredients={allIngredients} setFridgeIngredients={setFridgeIngredients} setPantryStaples={setPantryStaples} />}

      {view === 'add' && (
        <AddRecipeTab
          allIngredients={allIngredients}
          cookbooks={cookbooks}
          authFetch={authFetch}
          onSaved={(newRecipe) => {
            if (newRecipe?.id) setMakeSoonIds(prev => [...prev, newRecipe.id]);
            loadData();
            openRecipe(newRecipe);
          }}
        />
      )}

      {view === 'notes' && (
        <CookingNotesTab notes={cookingNotes} setNotes={setCookingNotes} authFetch={authFetch} isAdmin={isAdmin} />
      )}

      {view === 'cookbooks' && (
        <CookbooksTab
          cookbooks={cookbooks}
          setCookbooks={setCookbooks}
          recipes={recipes}
          onOpenRecipe={openRecipe}
          allTags={allTags}
          allIngredients={allIngredients}
          setCookingRecipe={setCookingRecipe}
          authFetch={authFetch}
          cookLog={cookLog}
          onRecipeConverted={(newRecipe) => { loadData(); openRecipe(newRecipe); }}
          isAdmin={isAdmin}
        />
      )}

      {view === 'profile' && (
        <ProfileTab
          recipes={recipes}
          dietaryFilters={dietaryFilters}
          setDietaryFilters={setDietaryFilters}
          units={units}
          setUnits={setUnits}
          totalRecipes={recipes.length}
          hideIncompatible={hideIncompatible}
          setHideIncompatible={setHideIncompatible}
          authFetch={authFetch}
          authUser={authUser}
          onLogout={handleLogout}
          onAuthUserUpdate={(updatedUser) => { setAuthUser(updatedUser); LS.set('authUser', updatedUser); }}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      )}

      {cookingRecipe && (
        <MarkCookedModal
          recipe={cookingRecipe}
          bodyIngredients={cookingRecipe._bodyIngredients || []}
          authFetch={authFetch}
          onSave={({ toRemove }) => {
            setMakeSoonIds(prev => prev.filter(id => id !== cookingRecipe.id));
            if (toRemove?.length) {
              const lower = toRemove.map(n => n.toLowerCase().trim());
              setFridgeIngredients(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
              setPantryStaples(prev => prev.filter(x => !lower.includes(x.toLowerCase().trim())));
            }
            setCookingRecipe(null);
            authFetch(`${API}/api/user/cook-log`).then(r => r.json()).then(d => setCookLog(d.entries || [])).catch(() => {});
          }}
          onClose={() => setCookingRecipe(null)}
        />
      )}

      {/* -- Mobile bottom tab bar -- */}
      <nav className="mobile-tab-bar">
        {[
          { key: 'home',     icon: 'home',     label: 'Home'     },
          { key: 'recipes',  icon: 'bookOpen', label: 'Recipes'  },
          { key: 'kitchen',  icon: 'package',  label: 'Kitchen'  },
          { key: 'grocery',  icon: 'cart',     label: 'Grocery'  },
          { key: 'profile',  icon: 'user',     label: 'Profile'  },
        ].map(({ key, icon, label }) => (
          <button key={key}
            className={`mobile-tab-bar__btn ${view === key ? 'mobile-tab-bar__btn--active' : ''}`}
            onClick={() => { setView(key); setMobileNavOpen(false); }}
          >
            <span className="mobile-tab-bar__btn-inner">
              <span className="mobile-tab-bar__icon"><Icon name={icon} size={22} strokeWidth={1.75} /></span>
              <span className="mobile-tab-bar__label">{label}</span>
            </span>
          </button>
        ))}
      </nav>

      {/* -- Scroll-to-top button -- */}
      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Scroll to top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
      )}

      {/* Footer: show on all pages except the recipe summary/editor */}
      {view !== 'recipe' && <SiteFooter onNav={setView} />}
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
