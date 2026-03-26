import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { LS } from '../utils/helpers';
import useAuthFetch from '../hooks/useAuthFetch';
import { API } from '../utils/constants';

// ─── Context Definition ───────────────────────────────────────────────────────

const AppContext = createContext(null);

/**
 * useApp
 * Hook to access the global app context from any component.
 * Throws if used outside of AppProvider.
 */
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AppProvider = ({ children }) => {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState(() => LS.get('authToken', null));
  const [authUser,  setAuthUser]  = useState(() => LS.get('authUser',  null));
  const authFetch = useAuthFetch(authToken);

  const login = (token, user) => {
    LS.set('authToken', token);
    LS.set('authUser', user);
    setAuthToken(token);
    setAuthUser(user);
  };

  const logout = () => {
    LS.set('authToken', null);
    LS.set('authUser', null);
    setAuthToken(null);
    setAuthUser(null);
  };

  const updateAuthUser = (updatedUser) => {
    setAuthUser(updatedUser);
    LS.set('authUser', updatedUser);
  };

  const isAdmin = authUser?.role === 'admin';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [recipes,        setRecipes]        = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [cookbooks,      setCookbooks]      = useState([]);
  const [cookingNotes,   setCookingNotes]   = useState([]);
  const [cookLog,        setCookLog]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  // ── User Preferences ──────────────────────────────────────────────────────
  const [darkMode,          setDarkModeRaw]    = useState(() => LS.get('darkMode', false));
  const [dietaryFilters,    setDietaryFiltersRaw] = useState(() => LS.get('dietaryFilters', []));
  const [hideIncompatible,  setHideIncompatibleRaw] = useState(() => LS.get('hideIncompatible', false));
  const [heartedIds,        setHeartedIds]     = useState(() => LS.get('heartedIds', []));
  const [makeSoonIds,       setMakeSoonIds]    = useState(() => LS.get('makeSoonIds', []));
  const [tabBarTabs,        setTabBarTabsRaw]  = useState(() => LS.get('tabBarTabs', ['home', 'recipes', 'kitchen', 'grocery']));

  // Persist + apply dark mode
  const setDarkMode = (v) => { setDarkModeRaw(v); LS.set('darkMode', v); };
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const setDietaryFilters = (fn) => setDietaryFiltersRaw(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn;
    LS.set('dietaryFilters', next);
    return next;
  });

  const setHideIncompatible = (v) => { setHideIncompatibleRaw(v); LS.set('hideIncompatible', v); };
  const setTabBarTabs = (v) => { setTabBarTabsRaw(v); LS.set('tabBarTabs', v); };

  // ── Favorites & Make Soon ─────────────────────────────────────────────────
  const toggleHeart = useCallback((id) => {
    setHeartedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (authToken) {
        authFetch(`${API}/api/user/favorites`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorites: next }),
        }).catch(() => {});
      }
      return next;
    });
  }, [authToken, authFetch]);

  const toggleMakeSoon = useCallback((id) => {
    setMakeSoonIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (authToken) {
        authFetch(`${API}/api/user/make-soon`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ makeSoon: next }),
        }).catch(() => {});
      }
      return next;
    });
  }, [authToken, authFetch]);

  // ── Initial Data Load ──────────────────────────────────────────────────────
  // Tracks whether kitchen has been loaded from API yet
  // (prevents writing stale localStorage data back on first load)
  const kitchenLoadedFromAPI = useRef(false);

  const [fridgeIngredients, setFridgeIngredients] = useState(() => LS.get('fridgeIngredients', []));
  const [pantryStaples,     setPantryStaples]     = useState(() => LS.get('pantryStaples', []));

  // Debounced kitchen sync to API
  const kitchenSyncTimer = useRef(null);
  const syncKitchen = useCallback((fridge, pantry) => {
    if (!authToken) return;
    clearTimeout(kitchenSyncTimer.current);
    kitchenSyncTimer.current = setTimeout(() => {
      const kitchen = [
        ...fridge.map(n => ({ ingredient_name: n, storage_type: 'fridge' })),
        ...pantry.map(n => ({ ingredient_name: n, storage_type: 'pantry' })),
      ];
      authFetch(`${API}/api/user/kitchen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen }),
      }).catch(() => {});
    }, 800);
  }, [authToken, authFetch]);

  // Sync kitchen to localStorage and API whenever it changes
  useEffect(() => {
    LS.set('fridgeIngredients', fridgeIngredients);
    if (kitchenLoadedFromAPI.current) syncKitchen(fridgeIngredients, pantryStaples);
  }, [fridgeIngredients]); // eslint-disable-line

  useEffect(() => {
    LS.set('pantryStaples', pantryStaples);
    if (kitchenLoadedFromAPI.current) syncKitchen(fridgeIngredients, pantryStaples);
  }, [pantryStaples]); // eslint-disable-line

  const loadData = useCallback(async () => {
    try {
      // Load public data in parallel
      const [ingRes, recipeRes, notesRes, cbRes] = await Promise.all([
        fetch(`${API}/api/ingredients`),
        fetch(`${API}/api/recipes`),
        authFetch(`${API}/api/cooking-notes`),
        fetch(`${API}/api/cookbooks`),
      ]);

      if (!ingRes.ok || !recipeRes.ok) throw new Error('Failed to load data');

      const { ingredients } = await ingRes.json();
      const { recipes: recipeData } = await recipeRes.json();

      if (notesRes.ok) { const d = await notesRes.json(); setCookingNotes(d.notes || []); }
      if (cbRes.ok)    { const d = await cbRes.json();    setCookbooks(d.cookbooks || d || []); }

      setAllIngredients(ingredients.sort((a, b) => a.name.localeCompare(b.name)));
      setRecipes(recipeData);

      // Load user-specific data if logged in
      if (authToken) {
        const [logRes, favsRes, soonRes, kitRes] = await Promise.all([
          authFetch(`${API}/api/user/cook-log`),
          authFetch(`${API}/api/user/favorites`),
          authFetch(`${API}/api/user/make-soon`),
          authFetch(`${API}/api/user/kitchen`),
        ]);

        if (logRes.ok)  { const d = await logRes.json();  setCookLog(d.entries || []); }
        if (favsRes.ok) { const d = await favsRes.json(); setHeartedIds(d.favorites || []); }
        if (soonRes.ok) { const d = await soonRes.json(); setMakeSoonIds(d.makeSoon || []); }

        // Kitchen: API is source of truth — always overrides localStorage
        if (kitRes.ok) {
          const { kitchen } = await kitRes.json();
          kitchenLoadedFromAPI.current = false;
          setFridgeIngredients(kitchen.filter(k => k.storage_type === 'fridge').map(k => k.ingredient_name));
          setPantryStaples(kitchen.filter(k => k.storage_type === 'pantry').map(k => k.ingredient_name));
          setTimeout(() => { kitchenLoadedFromAPI.current = true; }, 200);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authToken, authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Value ──────────────────────────────────────────────────────────────────

  const value = {
    // Auth
    authToken, authUser, authFetch, login, logout, updateAuthUser, isAdmin,

    // Data
    recipes, setRecipes,
    allIngredients, setAllIngredients,
    cookbooks, setCookbooks,
    cookingNotes, setCookingNotes,
    cookLog, setCookLog,
    loading, error,
    loadData,

    // Kitchen
    fridgeIngredients, setFridgeIngredients,
    pantryStaples, setPantryStaples,

    // User prefs
    darkMode, setDarkMode,
    dietaryFilters, setDietaryFilters,
    hideIncompatible, setHideIncompatible,
    heartedIds, toggleHeart,
    makeSoonIds, setMakeSoonIds, toggleMakeSoon,
    tabBarTabs, setTabBarTabs,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
