// ─── App-Wide Constants ───────────────────────────────────────────────────────
// All static lookup tables, filter definitions, and config values in one place.
// Import what you need — nothing here has side effects.

// ─── API ─────────────────────────────────────────────────────────────────────

export const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ─── Recipe Filters ──────────────────────────────────────────────────────────

/** Tag-based filters — matched against recipe.tags array */
export const TAG_FILTERS = [
  { key: 'Meals',     label: 'Meals'     },
  { key: 'Desserts',  label: 'Desserts'  },
  { key: 'Drinks',    label: 'Drinks'    },
  { key: 'Pasta',     label: 'Pasta'     },
  { key: 'Soup',      label: 'Soup'      },
  { key: 'Marinade',  label: 'Marinade'  },
  { key: 'Party',     label: 'Party'     },
  { key: 'Breakfast', label: 'Breakfast' },
  { key: 'Snack',     label: 'Snack'     },
  { key: 'Salad',     label: 'Salad'     },
  { key: 'Bread',     label: 'Bread'     },
  { key: 'Sauce',     label: 'Sauce'     },
  { key: 'Sides',     label: 'Sides'     },
];

/** Progress/status filters — matched against DB columns */
export const PROGRESS_FILTERS = [
  { key: '__readytocook',   label: 'Ready to Cook',  icon: 'checkCircle' },
  { key: '__almostready',   label: 'Almost Ready',   icon: 'flame'       },
  { key: '__makesoon',      label: 'Make Soon',      icon: 'timer'       },
  { key: '__favorite',      label: 'Favorites',      icon: 'heart'       },
  { key: '__incomplete',    label: 'Incomplete',     icon: 'note'        },
  { key: '__needstweaking', label: 'Needs Tweaking', icon: 'tool'        },
  { key: '__complete',      label: 'Complete',       icon: 'checkCircle' },
  { key: '__totry',         label: 'To Try',         icon: 'bookMarked'  },
];

/** Tag keys that correspond to cuisine/quick-chip filters */
export const QUICK_CHIP_KEYS = new Set(TAG_FILTERS.map(f => f.key));

// ─── Cuisines ─────────────────────────────────────────────────────────────────

export const GEO_CUISINES = [
  'Asian', 'Indian', 'Italian', 'Mediterranean',
  'Mexican', 'Middle Eastern', 'Thai',
].sort();

export const ALL_CUISINES = [...GEO_CUISINES].sort();

export const CUISINE_ICON = {
  Asian:           'utensils',
  Indian:          'flame',
  Italian:         'chefHat',
  Mediterranean:   'leaf',
  Mexican:         'zap',
  'Middle Eastern':'mapPin',
  Thai:            'coffee',
};

// ─── Kitchen / Ingredient Types ───────────────────────────────────────────────

export const ALL_TYPES = ['produce', 'meat', 'dairy', 'sauce', 'spice', 'alcohol', 'staple'];

export const TYPE_META = {
  produce: { label: 'Produce',     icon: 'leaf',     group: 'fridge'  },
  meat:    { label: 'Meat & Fish', icon: 'utensils', group: 'fridge'  },
  dairy:   { label: 'Dairy',       icon: 'coffee',   group: 'fridge'  },
  sauce:   { label: 'Sauces',      icon: 'package',  group: 'fridge'  },
  spice:   { label: 'Spices',      icon: 'zap',      group: 'pantry'  },
  alcohol: { label: 'Alcohol',     icon: 'shuffle',  group: 'pantry'  },
  staple:  { label: 'Staples',     icon: 'list',     group: 'pantry'  },
};

// ─── Ingredient Input ─────────────────────────────────────────────────────────

export const COMMON_UNITS = [
  'tsp', 'tbsp', 'cup', 'cups', 'ml', 'l', 'g', 'kg', 'oz', 'lb',
  'pinch', 'handful', 'bunch', 'clove', 'cloves', 'slice', 'slices',
  'piece', 'pieces', 'can', 'jar', 'bag', 'sprig', 'sprigs',
  'rasher', 'fillet', 'fillets', 'sheet', 'sheets',
];

// ─── Cooking Notes ────────────────────────────────────────────────────────────

export const NOTE_TYPES = ['rule', 'theory', 'shortcut'];

export const NOTE_TYPE_META = {
  rule:     { label: 'Rule / Ratio', emoji: 'ruler',     color: '#f5ece0', border: '#d9c4a8' },
  theory:   { label: 'Theory',       emoji: 'lightbulb', color: '#f5ece0', border: '#d9c4a8' },
  shortcut: { label: 'Shortcut',     emoji: 'zap',       color: '#f0ebe3', border: '#d9c4a8' },
};

export const NOTE_CATEGORIES = [
  'General Technique', 'Pasta', 'Baking', 'Meat & Fish',
  'Sauces', 'Eggs', 'Vegetables', 'Bread', 'Desserts', 'Equipment',
];

// ─── Profile / Settings ───────────────────────────────────────────────────────

export const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Dairy-Free', 'Nut-Free', 'Gluten-Free'];

export const THEME_OPTIONS = [
  { key: 'default', label: 'Terracotta', color: '#C65D3B' },
  { key: 'sage',    label: 'Sage',       color: '#7a9e7e' },
  { key: 'navy',    label: 'Navy',       color: '#2E4057' },
  { key: 'plum',    label: 'Plum',       color: '#6B3FA0' },
];

// ─── Cookbooks ────────────────────────────────────────────────────────────────

export const COOKBOOK_SORTS = [
  { key: 'page',   label: 'Page #'         },
  { key: 'alpha',  label: 'A-Z'            },
  { key: 'recent', label: 'Recently Added' },
];

export const COOKBOOK_SPINE_COLORS = [
  '#C65D3B', '#2E2A27', '#7a9e7e', '#4a6fa5',
  '#8B4513', '#6B3FA0', '#B5451B', '#2C5F2E',
];

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const STAR_LABELS = [
  '', "Didn't love it", 'It was okay', 'Pretty good!', 'Really good!', 'Perfect!',
];

export const GITHUB_REPO = 'kavyasomala/RecipeApp';
