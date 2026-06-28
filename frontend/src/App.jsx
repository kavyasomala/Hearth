import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './App.css';

import { Icon } from './icons';
import { API, PROGRESS_FILTERS, GEO_CUISINES, CUISINE_ICON, TAG_FILTERS } from './constants';
import { LS, toNum, checkDietaryConflicts } from './utils';
import { ErrorBoundary, HScrollRow } from './components/ui';
import RecipeCard from './components/RecipeCard';
import MarkCookedModal from './components/MarkCookedModal';
import KitchenTab from './KitchenTab';
import RecipePage from './pages/RecipePage';
import RecipeEditor from './pages/RecipeEditor';
import ProfileTab from './tabs/ProfileTab';
import GroceryListTab from './tabs/GroceryListTab';
import CookingNotesTab from './tabs/CookingNotesTab';
import CookbooksTab, { SiteFooter } from './tabs/CookbooksTab';
import AddRecipeTab from './tabs/AddRecipeTab';




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
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
      setSuccess(`Account created for ${data.user.username} âœ“`);
      setUsername(''); setPassword('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="create-user-modal" onClick={e => e.stopPropagation()}>
        <div className="create-user-modal__header">
          <span className="create-user-modal__title"><Icon name="userCircle" size={18} strokeWidth={2} /> Create Account</span>
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
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
// â”€â”€â”€ Main App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // --- Navigation & UI -------------------------------------------------------
  const [view, setViewRaw] = useState('home');
  const [lastView, setLastView] = useState('home');

  // Always scroll to top when switching tabs
  const setView = useCallback((newView) => {
    setViewRaw(newView);
    if (appScrollRef.current) {
      appScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  // Declared early so swipe callbacks can reference it
  const [editingRecipe, setEditingRecipe] = useState(false);

  // Swipe-right to go back (mobile) with visual feedback
  const swipeTouchStart = useRef(null);
  const [swipeDx, setSwipeDx] = useState(0);
  const handleSwipeTouchStart = useCallback((e) => {
    if (editingRecipe) return;
    swipeTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeDx(0);
  }, [editingRecipe]);
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSearchSubmitted, setMobileSearchSubmitted] = useState(false);
  const mainScrollRef = useRef(null);
  const appScrollRef = useRef(null); // ref to the scrollable app__scroll wrapper
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll-to-top detection â€” listen on app__scroll, not window
  useEffect(() => {
    const el = appScrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollTop(el.scrollTop > el.clientHeight * 0.8);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
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

    // Prevent pinch-zoom and page shake on mobile â€” set viewport meta
    let viewport = document.querySelector("meta[name='viewport']");
    if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; document.head.appendChild(viewport); }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  }, []);
  // --- Data ------------------------------------------------------------------
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
  // --- Recipe Detail ---------------------------------------------------------
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeBodyIngredients, setRecipeBodyIngredients] = useState([]);
  const [recipeInstructions, setRecipeInstructions] = useState([]);
  const [recipeNotes, setRecipeNotes] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // --- Library Filters -------------------------------------------------------
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
  // --- User Preferences & Interactions ---------------------------------------
  const [heartedIds, setHeartedIds] = useState(() => LS.get('heartedIds', []));
  const [makeSoonIds, setMakeSoonIds] = useState(() => LS.get('makeSoonIds', []));
  const [cookingRecipe, setCookingRecipe] = useState(null); // recipe object to mark cooked
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryLayout, setLibraryLayout] = useState('grid'); // 'grid' | 'list'

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

  // --- Settings & Appearance -------------------------------------------------
  const [darkMode, setDarkModeRaw] = useState(() => LS.get('darkMode', false));
  const setDarkMode = (v) => { setDarkModeRaw(v); LS.set('darkMode', v); };

  const [tabBarTabs, setTabBarTabsRaw] = useState(() => LS.get('tabBarTabs', ['home', 'recipes', 'kitchen', 'grocery']));
  const setTabBarTabs = (v) => { setTabBarTabsRaw(v); LS.set('tabBarTabs', v); };

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [units, setUnitsRaw] = useState(() => LS.get('units', 'metric'));
  const [dietaryFilters, setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));
  const [hideIncompatible, setHideIncompatibleRaw] = useState(() => LS.get('hideIncompatible', false));
  const setHideIncompatible = (v) => { setHideIncompatibleRaw(v); LS.set('hideIncompatible', v); };
  // --- App-Level Data (loaded from API) --------------------------------------
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
      const [recipeRes, notesRes, cbRes] = await Promise.all([
        fetch(`${API}/api/recipes`),
        authFetch ? authFetch(`${API}/api/cooking-notes`) : fetch(`${API}/api/cooking-notes`),
        fetch(`${API}/api/cookbooks`),
      ]);
      if (!recipeRes.ok) throw new Error('Failed to load data');
      const { recipes: recipeData } = await recipeRes.json();
      if (notesRes.ok) { const d = await notesRes.json(); setCookingNotes(d.notes || []); }
      if (cbRes.ok) { const d = await cbRes.json(); setCookbooks(d.cookbooks || d || []); }
      // Autocomplete pool: kitchen items first (exact match guaranteed), then recipe ingredients
      // Kitchen items are loaded separately via /api/user/kitchen after this block
      const recipeIngNames = [...new Set(recipeData.flatMap(r => r.ingredients || []))].sort();
      setAllIngredients(recipeIngNames.map(name => ({ name })));
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
        // Load kitchen from API â€” ALWAYS overrides localStorage so devices stay in sync
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

    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [authToken, authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const allMyIngredients = useMemo(() => new Set([...fridgeIngredients, ...pantryStaples].map(i => i.toLowerCase().trim())), [fridgeIngredients, pantryStaples]);

  const matches = useMemo(() => {
    if (allMyIngredients.size === 0) return [];
    const kitchenArr = [...allMyIngredients]; // array for substring checks
    // Substring match: "chicken" in kitchen matches "chicken thighs" in recipe, and vice versa
    const hasMatch = (recipeIng) => {
      const r = recipeIng.toLowerCase().trim();
      return kitchenArr.some(k => r.includes(k) || k.includes(r));
    };
    const m = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const have    = recipeIngredients.filter(i => hasMatch(i));
      const missing = recipeIngredients.filter(i => !hasMatch(i));
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
      list = list.filter(r => {
        const c = toNum(r.calories);
        if (c === null) return true;
        return calDir === 'under' ? c <= maxCalories : c >= maxCalories;
      });
    }
    if (maxMinutes !== null) {
      // Parse time strings like '45 mins', '1 hr 20 mins', '1.5 hours', '90 min'
      const parseMinutes = (t) => {
        if (!t) return null;
        const s = t.toLowerCase();
        const hrs  = parseFloat((s.match(/([\d.]+)\s*h/)  || [])[1] || 0);
        const mins = parseFloat((s.match(/([\d.]+)\s*m(?!o)/) || [])[1] || 0);
        const total = hrs * 60 + mins;
        return total > 0 ? total : null;
      };
      list = list.filter(r => {
        const mins = parseMinutes(r.time);
        // Exclude recipes with no time set â€” we can't confirm they're under the limit
        if (mins === null) return false;
        return mins <= maxMinutes;
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
      <div className="error-icon">âš ï¸</div>
      <h2>Couldn't connect to the server</h2>
      <p>{error}</p>
      <p className="error-hint">Make sure your backend is running and your .env is configured.</p>
      <button className="btn btn--primary" onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  return (
    <div className="app">
      {showLogin && <LoginModal onLogin={handleLogin} />}
      {/* app__scroll wraps everything EXCEPT the tab bar so keyboard never moves the bar */}
      <div className="app__scroll" ref={appScrollRef}>
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
              /* Search bar open â€” shown from any page */
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
                  <button className="app-header__mobile-search-clear" onClick={() => { setMobileSearchQuery(''); setMobileSearchSubmitted(false); setLibrarySearch(''); }}>âœ•</button>
                )}
                {!mobileSearchQuery && (
                  <button className="app-header__mobile-search-clear" onClick={() => { setMobileSearchOpen(false); setMobileSearchQuery(''); setLibrarySearch(''); }}>âœ•</button>
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
                            {(r.cuisine || r.time) && <div className="mobile-search-dropdown__item-meta">{[r.cuisine, r.time].filter(Boolean).join(' Â· ')}</div>}
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
        {/* Mobile nav overlay â€” floats over content, does not push page down */}
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
        <KitchenTab fridgeIngredients={fridgeIngredients} setFridgeIngredients={setFridgeIngredients} pantryStaples={pantryStaples} setPantryStaples={setPantryStaples} recipes={recipes} />
      )}

      {/* ======================================================
          HOME VIEW
      ====================================================== */}
      {view === 'home' && (
        <main className="view home-view">

          {/* -- Left column -- */}
          <div className="home-main">

            {/* -- â± Make Soon -- */}
            {(() => {
              const makeSoonRecipes = recipes.filter(r => makeSoonIds.includes(r.id));
              return (
                <div className="home-section">
                  <div className="home-section__header">
                    <h2 className="home-section__title">Make Soon</h2>
                    {makeSoonIds.length > 0 && (
                      <button className="btn btn--ghost btn--sm home-section__view-all" onClick={() => { setActiveTags([]); setActiveCuisines([]); setActiveProgresses(['__makesoon']); setActiveCookbooks([]); setLibrarySearch(''); setLibraryPage(1); setView('recipes'); }}>View all â†’</button>
                    )}
                  </div>
                  {makeSoonIds.length === 0 ? (
                    <div className="home-empty-cta" onClick={() => setView('recipes')}>
                      <span className="home-empty-cta__icon"><Icon name="list" size={32} strokeWidth={1.5} /></span>
                      <div>
                        <p className="home-empty-cta__title">Plan your week</p>
                        <p className="home-empty-cta__sub">Tap <span style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle',margin:'0 2px'}}><Icon name="timer" size={13} strokeWidth={2} /></span> on any recipe to add it here</p>
                      </div>
                      <span className="home-empty-cta__arrow">â†’</span>
                    </div>
                  ) : (
                    <HScrollRow count={makeSoonRecipes.length}>
                        {makeSoonRecipes.map(r => (
                          <RecipeCard key={r.id} recipe={r} match={matchById.get(r.id)} onClick={openRecipe}
                            isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                            isMakeSoon={true} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                            onMarkCooked={(recipe) => setCookingRecipe(recipe)} allIngredients={allIngredients} />
                        ))}
                    </HScrollRow>
                  )}
                </div>
              );
            })()}

            {/* -- What can I make? -- */}
            {(() => {
              const goodMatches = matches.filter(m => m.matchScore > 0);
              return (
                <div className="home-section">
                  <div className="home-section__header">
                    <h2 className="home-section__title">What can I make?</h2>
                    {allMyIngredients.size > 0 ? (
                      <button className="btn btn--ghost btn--sm home-section__view-all" onClick={() => { setActiveProgresses(['__makesoon']); setActiveTags([]); setActiveCuisines([]); setActiveCookbooks([]); setLibrarySearch(''); setLibraryPage(1); setView('recipes'); }}>View all â†’</button>
                    ) : (
                      <button className="btn btn--ghost btn--sm" onClick={() => setView('kitchen')}>Set ingredients â†’</button>
                    )}
                  </div>
                  {allMyIngredients.size === 0 ? (
                    <div className="home-empty-cta" onClick={() => setView('kitchen')}>
                      <span className="home-empty-cta__icon"><Icon name="chefHat" size={32} strokeWidth={1.5} /></span>
                      <div>
                        <p className="home-empty-cta__title">Add your kitchen &amp; pantry ingredients</p>
                        <p className="home-empty-cta__sub">We'll show you what you can cook right now</p>
                      </div>
                      <span className="home-empty-cta__arrow">â†’</span>
                    </div>
                  ) : goodMatches.length > 0 ? (
                    <HScrollRow count={goodMatches.length}>
                      {goodMatches.map(m => {
                          const r = recipes.find(x => x.id === m.id);
                          if (!r) return null;
                          return <RecipeCard key={r.id} recipe={r} match={m} onClick={openRecipe}
                            isHearted={heartedIds.includes(r.id)} onToggleHeart={() => toggleHeart(r.id)}
                            isMakeSoon={makeSoonIds.includes(r.id)} onToggleMakeSoon={() => toggleMakeSoon(r.id)}
                            showScore={true} allIngredients={allIngredients} />;
                        })}
                    </HScrollRow>
                  ) : <p className="home-no-matches">No matches yet -- try adding more ingredients in the Kitchen tab.</p>}
                </div>
              );
            })()}

                    </div>{/* end home-main */}
        </main>
      )}

      {view === 'recipes' && (() => {
        const allCuisinesPool = GEO_CUISINES; // strictly geo only -- DB cuisine values are not shown as filters
        const PAGE_SIZE = window.innerWidth <= 640 ? 12 : 25;
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
                  <button className="recipes-page-header__clear" onClick={() => { setMobileSearchQuery(''); setMobileSearchSubmitted(false); setLibrarySearch(''); }}>âœ• Clear</button>
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
                    <button className="filter-bar__clear-x" onClick={() => setLibrarySearch('')}>âœ•</button>
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
                    <><Icon name="sliders" size={14} strokeWidth={2} /> Filters{activeCount > 0 ? ` Â· ${activeCount}` : ''}</>
                    <span className="filters-toggle-btn__arrow">{filtersOpen ? 'â–´' : 'â–¾'}</span>
                  </button>
                  {hasActiveFilters && (
                    <button className="filter-bar__reset" onClick={clearAllFilters}>âœ• Clear</button>
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
                  <><Icon name="sliders" size={14} strokeWidth={2} /> Filters{activeCount > 0 ? ` Â· ${activeCount}` : ''}</>
                  <span className="filters-toggle-btn__arrow">{filtersOpen ? 'â–´' : 'â–¾'}</span>
                </button>
                {hasActiveFilters && (
                  <button className="filter-bar__reset" onClick={clearAllFilters}>âœ• Clear</button>
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
                    {maxCalories !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxCalories(null)}>âœ• clear</button>}
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
                    {maxMinutes !== null && <button className="filter-panel__clear-slider" onClick={() => setMaxMinutes(null)}>âœ• clear</button>}
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
                {activeCuisines.map(c => <span key={c} className="active-filter-pill">{CUISINE_ICON[c] && <Icon name={CUISINE_ICON[c]} size={12} strokeWidth={2} />} {c} <button onClick={() => toggleCuisine(c)}>âœ•</button></span>)}
                {activeTags.map(k => <span key={k} className="active-filter-pill">{TAG_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleTag(k)}>âœ•</button></span>)}
                {activeProgresses.map(k => <span key={k} className="active-filter-pill">{PROGRESS_FILTERS.find(f => f.key === k)?.label} <button onClick={() => toggleProgress(k)}>âœ•</button></span>)}
                {activeCookbooks.map(k => <span key={k} className="active-filter-pill">{k === '__uncategorized' ? 'No cookbook' : k} <button onClick={() => toggleCookbook(k)}>âœ•</button></span>)}
                {maxCalories !== null && <span className="active-filter-pill">{calDir} {maxCalories} kcal <button onClick={() => setMaxCalories(null)}>âœ•</button></span>}
                {maxMinutes !== null && <span className="active-filter-pill">under {maxMinutes} min <button onClick={() => setMaxMinutes(null)}>âœ•</button></span>}
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
                          allIngredients={allIngredients}
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
                              {canMakeNow && <span className="rlt__ready">âœ“</span>}
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
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>â† Prev</button>
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
                      <button className="pager__btn" onClick={() => setLibraryPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>Next â†’</button>
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
          tabBarTabs={tabBarTabs}
          setTabBarTabs={setTabBarTabs}
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

      {/* Footer: show on all pages except the recipe summary/editor, hidden on mobile */}
      {view !== 'recipe' && (
        <div className="site-footer-wrapper">
          <SiteFooter onNav={setView} />
        </div>
      )}

      {/* -- Scroll-to-top button -- */}
      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => {
          if (appScrollRef.current) appScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }} aria-label="Scroll to top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
      )}
      </div>{/* end app__scroll */}

      {/* -- Mobile bottom tab bar â€” outside scroll area so keyboard never moves it -- */}
      <nav className="mobile-tab-bar">
        {[
          { key: 'home',      icon: 'home',      label: 'Home'      },
          { key: 'recipes',   icon: 'bookOpen',  label: 'Recipes'   },
          { key: 'kitchen',   icon: 'package',   label: 'Kitchen'   },
          { key: 'grocery',   icon: 'cart',      label: 'Grocery'   },
          { key: 'cookbooks', icon: 'bookMarked', label: 'Cookbooks' },
          { key: 'notes',     icon: 'lightbulb', label: 'Notes'     },
          { key: 'profile',   icon: 'user',      label: 'Profile'   },
        ]
          .filter(t => t.key === 'profile' || tabBarTabs.includes(t.key))
          .map(({ key, icon, label }) => (
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
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}