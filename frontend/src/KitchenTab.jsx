import { useState, useMemo, useCallback } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

// ─── Category system ──────────────────────────────────────────────────────────

const INVENTORY_KEY  = 'hearth_inventory_config';
const CATEGORY_ORDER = ['Produce','Dairy & Eggs','Meat & Fish','Frozen','Oils & Fats','Sauces & Condiments','Spices & Herbs','Grains & Pasta','Canned & Legumes','Baking','Other'];

const KEYWORD_CATEGORY = {
  'spring onion':'Produce','sweet potato':'Produce','bell pepper':'Produce','bok choy':'Produce','bean sprout':'Produce','pak choi':'Produce','brussels sprout':'Produce','baby spinach':'Produce','cherry tomato':'Produce','sun-dried tomato':'Produce',
  'artichoke':'Produce','arugula':'Produce','asparagus':'Produce','avocado':'Produce','banana':'Produce','beet':'Produce','blueberry':'Produce','broccoli':'Produce','cabbage':'Produce','carrot':'Produce','cauliflower':'Produce','celery':'Produce','chard':'Produce','cherry':'Produce','cilantro':'Produce','corn':'Produce','cucumber':'Produce','eggplant':'Produce','fennel':'Produce','garlic':'Produce','ginger':'Produce','grape':'Produce','jalapeño':'Produce','jalapeno':'Produce','kale':'Produce','leek':'Produce','lemon':'Produce','lettuce':'Produce','lime':'Produce','mango':'Produce','mint':'Produce','mushroom':'Produce','onion':'Produce','orange':'Produce','parsley':'Produce','peach':'Produce','pear':'Produce','pineapple':'Produce','plum':'Produce','potato':'Produce','pumpkin':'Produce','radish':'Produce','raspberry':'Produce','rocket':'Produce','scallion':'Produce','shallot':'Produce','spinach':'Produce','squash':'Produce','strawberry':'Produce','tomato':'Produce','turnip':'Produce','watercress':'Produce','yam':'Produce','zucchini':'Produce','chive':'Produce','dill':'Produce','basil':'Produce','coriander leaf':'Produce',
  'cream cheese':'Dairy & Eggs','sour cream':'Dairy & Eggs','half and half':'Dairy & Eggs','creme fraiche':'Dairy & Eggs','cottage cheese':'Dairy & Eggs',
  'butter':'Dairy & Eggs','buttermilk':'Dairy & Eggs','cheddar':'Dairy & Eggs','cheese':'Dairy & Eggs','cream':'Dairy & Eggs','egg':'Dairy & Eggs','feta':'Dairy & Eggs','fromage':'Dairy & Eggs','ghee':'Dairy & Eggs','gouda':'Dairy & Eggs','gruyere':'Dairy & Eggs','kefir':'Dairy & Eggs','mascarpone':'Dairy & Eggs','milk':'Dairy & Eggs','mozzarella':'Dairy & Eggs','parmesan':'Dairy & Eggs','provolone':'Dairy & Eggs','ricotta':'Dairy & Eggs','yogurt':'Dairy & Eggs','brie':'Dairy & Eggs','manchego':'Dairy & Eggs','whey':'Dairy & Eggs',
  'chicken breast':'Meat & Fish','chicken thigh':'Meat & Fish','chicken wing':'Meat & Fish','ground beef':'Meat & Fish','ground pork':'Meat & Fish','ground turkey':'Meat & Fish','ground lamb':'Meat & Fish','short rib':'Meat & Fish','fish sauce':'Sauces & Condiments',
  'anchovy':'Meat & Fish','bacon':'Meat & Fish','bass':'Meat & Fish','beef':'Meat & Fish','brisket':'Meat & Fish','chicken':'Meat & Fish','chorizo':'Meat & Fish','clam':'Meat & Fish','cod':'Meat & Fish','crab':'Meat & Fish','duck':'Meat & Fish','ham':'Meat & Fish','halibut':'Meat & Fish','lamb':'Meat & Fish','lobster':'Meat & Fish','mackerel':'Meat & Fish','mussel':'Meat & Fish','octopus':'Meat & Fish','oyster':'Meat & Fish','pancetta':'Meat & Fish','pepperoni':'Meat & Fish','pork':'Meat & Fish','prawn':'Meat & Fish','prosciutto':'Meat & Fish','ribs':'Meat & Fish','salami':'Meat & Fish','salmon':'Meat & Fish','sardine':'Meat & Fish','sausage':'Meat & Fish','scallop':'Meat & Fish','seitan':'Meat & Fish','shrimp':'Meat & Fish','snapper':'Meat & Fish','squid':'Meat & Fish','steak':'Meat & Fish','tempeh':'Meat & Fish','tilapia':'Meat & Fish','tofu':'Meat & Fish','trout':'Meat & Fish','tuna':'Meat & Fish','turkey':'Meat & Fish','veal':'Meat & Fish','venison':'Meat & Fish',
  'frozen':'Frozen','ice cream':'Frozen','sorbet':'Frozen','gelato':'Frozen',
  'olive oil':'Oils & Fats','sesame oil':'Oils & Fats','coconut oil':'Oils & Fats','vegetable oil':'Oils & Fats','canola oil':'Oils & Fats','avocado oil':'Oils & Fats','sunflower oil':'Oils & Fats',
  'lard':'Oils & Fats','shortening':'Oils & Fats','suet':'Oils & Fats',
  'soy sauce':'Sauces & Condiments','oyster sauce':'Sauces & Condiments','hoisin sauce':'Sauces & Condiments','hot sauce':'Sauces & Condiments','worcestershire sauce':'Sauces & Condiments','worcestershire':'Sauces & Condiments','coconut aminos':'Sauces & Condiments','rice vinegar':'Sauces & Condiments','apple cider vinegar':'Sauces & Condiments','balsamic vinegar':'Sauces & Condiments','white vinegar':'Sauces & Condiments','red wine vinegar':'Sauces & Condiments','dijon mustard':'Sauces & Condiments','peanut butter':'Sauces & Condiments','almond butter':'Sauces & Condiments','tomato paste':'Sauces & Condiments','tomato sauce':'Sauces & Condiments','maple syrup':'Sauces & Condiments','golden syrup':'Sauces & Condiments','corn syrup':'Sauces & Condiments',
  'aioli':'Sauces & Condiments','balsamic':'Sauces & Condiments','chutney':'Sauces & Condiments','dressing':'Sauces & Condiments','gochujang':'Sauces & Condiments','harissa':'Sauces & Condiments','hoisin':'Sauces & Condiments','honey':'Sauces & Condiments','jam':'Sauces & Condiments','jelly':'Sauces & Condiments','ketchup':'Sauces & Condiments','marmalade':'Sauces & Condiments','mayo':'Sauces & Condiments','mayonnaise':'Sauces & Condiments','miso':'Sauces & Condiments','molasses':'Sauces & Condiments','mustard':'Sauces & Condiments','passata':'Sauces & Condiments','pesto':'Sauces & Condiments','ponzu':'Sauces & Condiments','relish':'Sauces & Condiments','sambal':'Sauces & Condiments','sriracha':'Sauces & Condiments','tahini':'Sauces & Condiments','teriyaki':'Sauces & Condiments','treacle':'Sauces & Condiments','vinaigrette':'Sauces & Condiments','vinegar':'Sauces & Condiments','agave':'Sauces & Condiments',
  'smoked paprika':'Spices & Herbs','chilli flake':'Spices & Herbs','garlic powder':'Spices & Herbs','onion powder':'Spices & Herbs','curry powder':'Spices & Herbs','five spice':'Spices & Herbs','garam masala':'Spices & Herbs','ras el hanout':'Spices & Herbs','mixed spice':'Spices & Herbs','black pepper':'Spices & Herbs','white pepper':'Spices & Herbs','cayenne pepper':'Spices & Herbs','star anise':'Spices & Herbs','celery salt':'Spices & Herbs','fennel seed':'Spices & Herbs','bay leaf':'Spices & Herbs','bay leaves':'Spices & Herbs',
  'allspice':'Spices & Herbs','asafoetida':'Spices & Herbs','cardamom':'Spices & Herbs','cayenne':'Spices & Herbs','cinnamon':'Spices & Herbs','clove':'Spices & Herbs','coriander':'Spices & Herbs','cumin':'Spices & Herbs','fenugreek':'Spices & Herbs','juniper':'Spices & Herbs','mace':'Spices & Herbs','msg':'Spices & Herbs','nutmeg':'Spices & Herbs','oregano':'Spices & Herbs','paprika':'Spices & Herbs','pepper':'Spices & Herbs','saffron':'Spices & Herbs','sage':'Spices & Herbs','salt':'Spices & Herbs','sumac':'Spices & Herbs','thyme':'Spices & Herbs','turmeric':'Spices & Herbs','rosemary':'Spices & Herbs','tarragon':'Spices & Herbs','zaatar':'Spices & Herbs','caraway':'Spices & Herbs','spice':'Spices & Herbs',
  'basmati rice':'Grains & Pasta','brown rice':'Grains & Pasta','white rice':'Grains & Pasta','bread crumb':'Grains & Pasta',
  'barley':'Grains & Pasta','bread':'Grains & Pasta','breadcrumb':'Grains & Pasta','bun':'Grains & Pasta','cereal':'Grains & Pasta','couscous':'Grains & Pasta','cracker':'Grains & Pasta','farro':'Grains & Pasta','fettuccine':'Grains & Pasta','flour':'Grains & Pasta','freekeh':'Grains & Pasta','granola':'Grains & Pasta','linguine':'Grains & Pasta','noodle':'Grains & Pasta','oat':'Grains & Pasta','panko':'Grains & Pasta','pasta':'Grains & Pasta','penne':'Grains & Pasta','pita':'Grains & Pasta','polenta':'Grains & Pasta','quinoa':'Grains & Pasta','ramen':'Grains & Pasta','rice':'Grains & Pasta','rigatoni':'Grains & Pasta','rye':'Grains & Pasta','spelt':'Grains & Pasta','spaghetti':'Grains & Pasta','tortilla':'Grains & Pasta','udon':'Grains & Pasta','wheat':'Grains & Pasta','wrap':'Grains & Pasta',
  'black bean':'Canned & Legumes','kidney bean':'Canned & Legumes','white bean':'Canned & Legumes','pinto bean':'Canned & Legumes','butter bean':'Canned & Legumes','navy bean':'Canned & Legumes','cannellini bean':'Canned & Legumes','split pea':'Canned & Legumes','coconut milk':'Canned & Legumes','chicken stock':'Canned & Legumes','vegetable stock':'Canned & Legumes','beef stock':'Canned & Legumes','chicken broth':'Canned & Legumes','vegetable broth':'Canned & Legumes','beef broth':'Canned & Legumes','diced tomato':'Canned & Legumes','crushed tomato':'Canned & Legumes','canned tomato':'Canned & Legumes',
  'bean':'Canned & Legumes','broth':'Canned & Legumes','canned':'Canned & Legumes','chickpea':'Canned & Legumes','edamame':'Canned & Legumes','lentil':'Canned & Legumes','stock':'Canned & Legumes',
  'baking powder':'Baking','baking soda':'Baking','brown sugar':'Baking','caster sugar':'Baking','icing sugar':'Baking','powdered sugar':'Baking','dark chocolate':'Baking','milk chocolate':'Baking','white chocolate':'Baking','chocolate chip':'Baking','vanilla extract':'Baking','cream of tartar':'Baking','corn starch':'Baking','food coloring':'Baking',
  'bicarbonate':'Baking','cocoa':'Baking','chocolate':'Baking','confectioner':'Baking','gelatin':'Baking','pectin':'Baking','sugar':'Baking','vanilla':'Baking','yeast':'Baking','cornstarch':'Baking',
};

const KEYWORD_ENTRIES = Object.entries(KEYWORD_CATEGORY).sort((a, b) => b[0].length - a[0].length);

export function autoCategory(name) {
  const lower = name.toLowerCase().trim();
  for (const [kw, cat] of KEYWORD_ENTRIES) {
    if (lower.includes(kw) || kw.includes(lower)) return cat;
  }
  return 'Other';
}

function norm(str) { return str.toLowerCase().trim(); }

// ─── Migration & storage ──────────────────────────────────────────────────────

const OLD_LABEL_MAP = {
  'Freezer': 'Frozen', 'Vinegars': 'Sauces & Condiments',
  'Sweeteners & Baking': 'Baking', 'Legumes & Canned': 'Canned & Legumes',
  'Miscellaneous': 'Other',
};

const DEFAULT_INVENTORY = [
  { label: 'Produce', items: ['onion','garlic','ginger','lemon','lime','tomato','carrot','celery','bell pepper','spinach','potato','mushrooms','zucchini','broccoli','cucumber','avocado','spring onion','kale','sweet potato'] },
  { label: 'Dairy & Eggs', items: ['eggs','milk','butter','cheddar','parmesan','feta','mozzarella','cream','sour cream','yogurt','cream cheese'] },
  { label: 'Meat & Fish', items: ['chicken breast','chicken thighs','ground beef','salmon','bacon','pork','shrimp','tuna','sausage'] },
  { label: 'Frozen', items: ['frozen peas','frozen spinach','frozen shrimp','frozen berries','frozen edamame','frozen corn'] },
  { label: 'Oils & Fats', items: ['olive oil','vegetable oil','sesame oil','coconut oil','ghee'] },
  { label: 'Sauces & Condiments', items: ['soy sauce','fish sauce','oyster sauce','hoisin sauce','worcestershire sauce','hot sauce','sriracha','ketchup','mustard','dijon mustard','mayonnaise','tomato paste','passata','pesto','tahini','peanut butter','balsamic vinegar','rice vinegar','apple cider vinegar','honey','maple syrup'] },
  { label: 'Spices & Herbs', items: ['salt','black pepper','cumin','coriander','turmeric','paprika','smoked paprika','chilli flakes','cayenne','cinnamon','nutmeg','cardamom','garlic powder','onion powder','oregano','dried thyme','dried rosemary','dried basil','bay leaves','garam masala','curry powder','five spice','msg'] },
  { label: 'Grains & Pasta', items: ['white rice','basmati rice','pasta','spaghetti','noodles','udon','ramen','couscous','quinoa','oats','breadcrumbs','panko','tortillas','flour'] },
  { label: 'Canned & Legumes', items: ['lentils','chickpeas','black beans','kidney beans','cannellini beans','coconut milk','chicken stock','vegetable stock','beef stock','canned tomatoes'] },
  { label: 'Baking', items: ['sugar','brown sugar','baking powder','baking soda','vanilla extract','dark chocolate','cocoa powder'] },
];

export function loadInventoryConfig() {
  try { const raw = localStorage.getItem(INVENTORY_KEY); if (raw) return JSON.parse(raw); } catch {}
  const catMap = {};
  const add = (label, items) => {
    const mapped = OLD_LABEL_MAP[label] || label;
    if (!catMap[mapped]) catMap[mapped] = new Set();
    items.forEach(i => catMap[mapped].add(norm(i)));
  };
  try { (JSON.parse(localStorage.getItem('hearth_fridge_config') || '[]')).forEach(g => add(g.label, g.items)); } catch {}
  try { (JSON.parse(localStorage.getItem('hearth_staples_config') || '[]')).forEach(g => add(g.label, g.items)); } catch {}
  const hasData = Object.values(catMap).some(s => s.size > 0);
  const source = hasData ? catMap : Object.fromEntries(DEFAULT_INVENTORY.map(g => [g.label, new Set(g.items)]));
  const config = [
    ...CATEGORY_ORDER.filter(c => source[c]).map(c => ({ label: c, items: [...source[c]] })),
    ...Object.keys(source).filter(k => !CATEGORY_ORDER.includes(k) && source[k].size > 0).map(k => ({ label: k, items: [...source[k]] })),
  ];
  try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(config)); } catch {}
  return config;
}

function saveConfig(config) {
  try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(config)); } catch {}
}

// ─── InventoryPill ─────────────────────────────────────────────────────────────

function InventoryPill({ item, groupLabel, have, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${groupLabel}::${item}`,
    data: { item, fromGroup: groupLabel },
  });

  return (
    <span
      ref={setNodeRef}
      className={`inv-pill${have ? ' inv-pill--have' : ''}${isDragging ? ' inv-pill--dragging' : ''}`}
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: 'none' }}
    >
      <button
        className="inv-pill__name"
        {...listeners}
        {...attributes}
        onClick={onToggle}
      >
        {have && <span className="inv-pill__check">✓</span>}
        {item}
      </button>
      <button
        className="inv-pill__rm"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Remove"
      >✕</button>
    </span>
  );
}

// ─── CategoryGroup ─────────────────────────────────────────────────────────────

function CategoryGroup({ group, haveSet, onToggle, onDelete, isOver }) {
  const { setNodeRef } = useDroppable({ id: group.label });
  const haveCount = group.items.filter(i => haveSet.has(i)).length;

  return (
    <div
      ref={setNodeRef}
      className={`inv-group${isOver ? ' inv-group--over' : ''}`}
    >
      <div className="inv-group__hd">
        <span className="inv-group__label">{group.label}</span>
        <span className="inv-group__tally">{haveCount}/{group.items.length}</span>
      </div>
      <div className="inv-group__pills">
        {group.items.map(item => (
          <InventoryPill
            key={item}
            item={item}
            groupLabel={group.label}
            have={haveSet.has(item)}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(group.label, item)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── AddIngredientForm ─────────────────────────────────────────────────────────

function AddIngredientForm({ config, onAdd, onClose }) {
  const [name, setName]         = useState('');
  const [category, setCategory] = useState('');

  const suggested = useMemo(() => name.trim() ? autoCategory(name.trim()) : '', [name]);
  const resolvedCat = category || suggested || 'Other';

  const extraCats = config.map(g => g.label).filter(l => !CATEGORY_ORDER.includes(l));
  const allCats   = [...CATEGORY_ORDER, ...extraCats];

  const commit = () => {
    const lower = norm(name);
    if (!lower) return;
    onAdd(lower, resolvedCat);
    setName(''); setCategory('');
  };

  return (
    <div className="inv-add-form">
      <input
        autoFocus
        className="inv-add-form__name"
        placeholder="Ingredient name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onClose(); }}
      />
      {name.trim() && (
        <p className="inv-add-form__suggest">
          Category: <strong>{resolvedCat}</strong>{category ? '' : ' (auto-detected)'}
        </p>
      )}
      <div className="inv-cat-buttons">
        {allCats.map(c => (
          <button
            key={c}
            type="button"
            className={`inv-cat-btn${resolvedCat === c ? ' inv-cat-btn--active' : ''}`}
            onClick={() => setCategory(category === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="inv-add-form__btns">
        <button className="inv-add-form__submit" onClick={commit} disabled={!name.trim()}>
          Add to kitchen
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── KitchenTab ───────────────────────────────────────────────────────────────

export default function KitchenTab({ inventoryHave, setInventoryHave, inventoryConfig, setInventoryConfig }) {
  const [search, setSearch]           = useState('');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);
  const [overGroupId, setOverGroupId]   = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const updateConfig = useCallback(fn => {
    setInventoryConfig(prev => { const next = fn(prev); saveConfig(next); return next; });
  }, [setInventoryConfig]);

  const haveSet = useMemo(() => new Set(inventoryHave), [inventoryHave]);

  const toggleHave = useCallback(item => {
    setInventoryHave(prev =>
      haveSet.has(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  }, [haveSet, setInventoryHave]);

  const deleteItem = useCallback((groupLabel, item) => {
    updateConfig(prev =>
      prev
        .map(g => g.label === groupLabel ? { ...g, items: g.items.filter(i => i !== item) } : g)
        .filter(g => g.items.length > 0)
    );
    setInventoryHave(prev => prev.filter(x => x !== item));
  }, [updateConfig, setInventoryHave]);

  const addItem = useCallback((name, category) => {
    const allItems = inventoryConfig.flatMap(g => g.items);
    if (!allItems.includes(name)) {
      updateConfig(prev => {
        const existing = prev.find(g => g.label === category);
        if (existing) return prev.map(g => g.label === category ? { ...g, items: [...g.items, name] } : g);
        const newGroup  = { label: category, items: [name] };
        const idx       = CATEGORY_ORDER.indexOf(category);
        if (idx === -1) return [...prev, newGroup];
        const insertAfter = prev.findIndex(g => CATEGORY_ORDER.indexOf(g.label) > idx);
        if (insertAfter === -1) return [...prev, newGroup];
        const next = [...prev]; next.splice(insertAfter, 0, newGroup); return next;
      });
    }
    // Always mark as "have" when adding
    if (!haveSet.has(name)) setInventoryHave(prev => [...prev, name]);
    setAddFormOpen(false);
  }, [inventoryConfig, haveSet, updateConfig, setInventoryHave]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => setActiveDragId(active.id);
  const handleDragOver  = ({ over })  => setOverGroupId(over ? over.id : null);

  const handleDragEnd = ({ active, over }) => {
    setActiveDragId(null);
    setOverGroupId(null);
    if (!over || !active.data.current) return;
    const { item, fromGroup } = active.data.current;
    const toGroup = over.id;
    if (fromGroup === toGroup) return;
    updateConfig(prev =>
      prev.map(g => {
        if (g.label === fromGroup) return { ...g, items: g.items.filter(i => i !== item) };
        if (g.label === toGroup)   return { ...g, items: [...g.items, item] };
        return g;
      }).filter(g => g.items.length > 0)
    );
  };

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filteredConfig = useMemo(() => {
    if (!search.trim()) return inventoryConfig;
    const q = search.toLowerCase().trim();
    return inventoryConfig
      .map(g => ({ ...g, items: g.items.filter(i => i.includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [inventoryConfig, search]);

  const allItems  = useMemo(() => inventoryConfig.flatMap(g => g.items), [inventoryConfig]);
  const haveCount = useMemo(() => allItems.filter(i => haveSet.has(i)).length, [allItems, haveSet]);
  const activeDragItem = activeDragId ? activeDragId.split('::')[1] : null;

  return (
    <main className="view kitchen-view">
      <div className="kitchen-header">
        <div>
          <h2 className="kitchen-title">My Kitchen</h2>
          <p className="kitchen-subtitle">{haveCount} of {allItems.length} in stock</p>
        </div>
        {haveCount > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setInventoryHave([])}>
            Clear stock
          </button>
        )}
      </div>

      <div className="inv-toolbar">
        <input
          className="inv-search"
          placeholder="Search ingredients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="inv-add-btn" onClick={() => setAddFormOpen(p => !p)}>
          {addFormOpen ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {addFormOpen && (
        <AddIngredientForm config={inventoryConfig} onAdd={addItem} onClose={() => setAddFormOpen(false)} />
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="inv-groups">
          {filteredConfig.map(group => (
            <CategoryGroup
              key={group.label}
              group={group}
              haveSet={haveSet}
              onToggle={toggleHave}
              onDelete={deleteItem}
              isOver={overGroupId === group.label}
            />
          ))}
          {filteredConfig.length === 0 && search && (
            <div className="inv-empty-search">
              <p>No ingredients matching "{search}"</p>
              <button className="inv-add-btn" onClick={() => { setAddFormOpen(true); setSearch(''); }}>
                + Add as new ingredient
              </button>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeDragItem && (
            <span className="inv-pill inv-pill--have inv-pill--overlay">
              <button className="inv-pill__name">{activeDragItem}</button>
            </span>
          )}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
