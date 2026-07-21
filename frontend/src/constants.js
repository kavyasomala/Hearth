export const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const COMMON_UNITS = [
  'tsp', 'tbsp', 'cup', 'cups', 'ml', 'l', 'g', 'kg', 'oz', 'lb',
  'pinch', 'handful', 'bunch', 'clove', 'cloves', 'slice', 'slices',
  'piece', 'pieces', 'can', 'jar', 'bag', 'sprig', 'sprigs',
  'rasher', 'fillet', 'fillets', 'sheet', 'sheets',
];

export const TAG_FILTERS = [
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

export const PROGRESS_FILTERS = [
  { key: '__readytocook',   label: 'Ready to Cook',   icon: 'checkCircle' },
  { key: '__almostready',   label: 'Almost Ready',    icon: 'flame'       },
  { key: '__makesoon',      label: 'Make Soon',       icon: 'timer'       },
  { key: '__favorite',      label: 'Favorites',       icon: 'heart'       },
  { key: '__needstweaking', label: 'Needs Tweaking',  icon: 'tool'        },
  { key: '__complete',      label: 'Made It',         icon: 'checkCircle' },
  { key: '__archived',      label: 'Archived',        icon: 'archive'     },
  { key: '__totry',         label: 'To Try',          icon: 'bookMarked'  },
];

export const QUICK_CHIP_KEYS = new Set(TAG_FILTERS.map(f => f.key));

export const GEO_CUISINES = [
  'Asian', 'Indian', 'Italian', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Thai',
].sort();

export const CUISINE_ICON = {
  'Asian': 'utensils', 'Indian': 'flame', 'Italian': 'chefHat', 'Mediterranean': 'leaf',
  'Mexican': 'zap', 'Middle Eastern': 'mapPin', 'Thai': 'coffee',
};

export const ALL_CUISINES = [...GEO_CUISINES].sort();

export const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Dairy-Free', 'Nut-Free', 'Gluten-Free'];

export const DIETARY_CONFLICTS = {
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

export const THEME_OPTIONS = [
  { key: 'default', label: 'Terracotta', color: '#C65D3B' },
  { key: 'sage',    label: 'Sage',       color: '#7a9e7e' },
  { key: 'navy',    label: 'Navy',       color: '#2E4057' },
  { key: 'plum',    label: 'Plum',       color: '#6B3FA0' },
];

export const STAR_LABELS = ['', "Didn't love it", 'It was okay', 'Pretty good!', 'Really good!', 'Perfect!'];

export const UNIT_CONVERSIONS = {
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

export const WEIGHT_UNITS = new Set(['g','gram','grams','kg','kilogram','kilograms','oz','ounce','ounces','lb','pound','pounds']);
export const VOLUME_UNITS = new Set(['ml','milliliter','milliliters','l','liter','liters','litre','litres','tsp','teaspoon','teaspoons','tbsp','tablespoon','tablespoons','cup','cups','fl oz','fluid oz']);
