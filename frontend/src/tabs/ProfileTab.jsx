import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../icons';
import { API, DIETARY_OPTIONS, STAR_LABELS } from '../constants';
import { LS, getDaysInMonth, getFirstDayOfMonth } from '../utils';
import { supabase } from '../supabase';

// ─── Collapsible Section ──────────────────────────────────────────────────────
const Section = ({ icon, title, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="profile-section profile-section--collapsible">
      <button className="profile-settings-toggle" onClick={() => setOpen(o => !o)}>
        <span className="profile-settings-toggle__title">
          <Icon name={icon} size={15} strokeWidth={2} /> {title}
          {badge != null && <span style={{ marginLeft: 6, fontSize: '0.75rem', fontWeight: 400, color: 'var(--warm-gray)' }}>({badge})</span>}
        </span>
        <span className={`profile-settings-toggle__arrow ${open ? 'profile-settings-toggle__arrow--open' : ''}`}>▾</span>
      </button>
      {open && <div className="profile-settings-body">{children}</div>}
    </section>
  );
};

// ─── Profile Tab ─────────────────────────────────────────────────────────────
const ProfileTab = ({ recipes, dietaryFilters, setDietaryFilters, units, setUnits, totalRecipes, hideIncompatible, setHideIncompatible, authFetch, authUser, onLogout, onAuthUserUpdate, darkMode = false, setDarkMode, tabBarTabs, setTabBarTabs }) => {
  const apiFetch = authFetch || fetch;
  const isAdmin = authUser?.role === 'admin';

  // ── Cook history ──
  const [cookHistory, setCookHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyView, setHistoryView] = useState('timeline');
  const [calendarDate, setCalendarDate] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });

  // ── Profile editing ──
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDraft, setEditDraft] = useState({ displayName: '', email: '', avatarUrl: '', password: '', confirmPassword: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // ── Feedback ──
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackList, setFeedbackList] = useState(() => LS.get('feedbackReports', []));
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // ── Account deletion ──
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const toggleDiet = (d) => setDietaryFilters(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`${API}/api/user/cook-log`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setCookHistory(data.entries || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const openEdit = () => {
    setEditDraft({
      displayName: authUser?.display_name || '',
      email: authUser?.email || '',
      avatarUrl: authUser?.avatar_url || '',
      password: '',
      confirmPassword: '',
    });
    setEditError('');
    setEditSuccess('');
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (editDraft.password && editDraft.password !== editDraft.confirmPassword) {
      setEditError('Passwords do not match.');
      return;
    }
    if (editDraft.password && editDraft.password.length < 6) {
      setEditError('Password must be at least 6 characters.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const supabaseUpdate = {};
      if (editDraft.email.trim() && editDraft.email.trim() !== authUser?.email) {
        supabaseUpdate.email = editDraft.email.trim();
      }
      if (editDraft.password) supabaseUpdate.password = editDraft.password;
      const metaChanges = {};
      if (editDraft.displayName.trim() !== (authUser?.display_name || '')) metaChanges.full_name = editDraft.displayName.trim();
      if (editDraft.avatarUrl.trim() !== (authUser?.avatar_url || '')) metaChanges.avatar_url = editDraft.avatarUrl.trim();
      if (Object.keys(metaChanges).length) supabaseUpdate.data = metaChanges;

      if (Object.keys(supabaseUpdate).length) {
        const { error } = await supabase.auth.updateUser(supabaseUpdate);
        if (error) throw error;
      }

      await apiFetch(`${API}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editDraft.displayName.trim() || null,
          avatar_url: editDraft.avatarUrl.trim() || null,
        }),
      });

      if (onAuthUserUpdate) onAuthUserUpdate({
        ...authUser,
        display_name: editDraft.displayName.trim() || authUser?.display_name,
        email: editDraft.email.trim() || authUser?.email,
        avatar_url: editDraft.avatarUrl.trim() || authUser?.avatar_url,
      });

      const emailChanged = supabaseUpdate.email;
      setEditSuccess(emailChanged ? 'Saved! Check your new email for a confirmation link.' : 'Profile updated.');
      setTimeout(() => { setEditSuccess(''); setEditingProfile(false); }, 2200);
    } catch (e) {
      setEditError(e.message || 'Something went wrong.');
    }
    setEditSaving(false);
  };

  // ── History derived data ──
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

  const cookStreak = useMemo(() => {
    if (cookHistory.length === 0) return 0;
    const dates = new Set(cookHistory.map(e => new Date(e.cooked_at).toLocaleDateString('en-CA')));
    let streak = 0;
    const d = new Date();
    while (dates.has(d.toLocaleDateString('en-CA'))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }, [cookHistory]);

  const favCookDay = useMemo(() => {
    if (cookHistory.length === 0) return null;
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const counts = Array(7).fill(0);
    cookHistory.forEach(e => counts[new Date(e.cooked_at).getDay()]++);
    return DAYS[counts.indexOf(Math.max(...counts))];
  }, [cookHistory]);

  const thisMonthCooks = useMemo(() => {
    const now = new Date();
    return cookHistory.filter(e => {
      const d = new Date(e.cooked_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [cookHistory]);

  const getRecipeName = (entry) => {
    const r = recipes.find(r => r.id === entry.recipe_id);
    return r?.name || entry.recipe_name || 'Unknown Recipe';
  };

  const prevMonth = () => setCalendarDate(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalendarDate(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const displayName = authUser?.display_name || authUser?.username || '';

  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    const entry = { id: Date.now(), text: feedbackText.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), done: false };
    const next = [entry, ...feedbackList];
    setFeedbackList(next);
    LS.set('feedbackReports', next);
    setFeedbackText('');
    setFeedbackSubmitted(true);
    setTimeout(() => setFeedbackSubmitted(false), 2500);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`${API}/api/user/account`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');
      onLogout();
    } catch (e) {
      setDeleteError(e.message);
      setDeleteLoading(false);
    }
  };

  const FEATURES = [
    { icon: 'link',       label: 'Import from URL',    sub: 'Paste a link, Hearth scrapes the recipe' },
    { icon: 'sliders',    label: 'Live Scaling',        sub: 'Tap servings to adjust amounts instantly' },
    { icon: 'package',    label: 'Kitchen Inventory',   sub: 'Track your fridge and pantry' },
    { icon: 'cart',       label: 'Grocery Lists',       sub: 'Smart consolidation with unit conversion' },
    { icon: 'bookMarked', label: 'Cookbooks',           sub: 'Organize recipes into collections' },
    { icon: 'lightbulb',  label: 'Cooking Notes',       sub: 'Notes that stick across every session' },
    { icon: 'calendar',   label: 'Cook History',        sub: 'Timeline and calendar of every dish' },
    { icon: 'barChart',   label: 'Nutrition',           sub: 'Auto-calculated from ingredients' },
    { icon: 'award',      label: 'Ratings & Notes',     sub: 'Log how each cook went' },
  ];

  return (
    <main className="view profile-view">

      {/* ── Profile Hero ─────────────────────────────────────────── */}
      <div className="profile-hero">
        <div className="profile-hero__main">
          <div className="profile-hero__identity">
            {authUser?.avatar_url ? (
              <img src={authUser.avatar_url} alt="Avatar" className="profile-avatar profile-avatar--lg" referrerPolicy="no-referrer" />
            ) : (
              <div className="profile-avatar profile-avatar--lg profile-avatar--initial">
                {(displayName || authUser?.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="profile-hero__info">
              <div className="profile-hero__name-row">
                <h2 className="profile-hero__name">{displayName || 'Set a display name'}</h2>
                {isAdmin && <span className="profile-hero__badge">Admin</span>}
                <button onClick={openEdit} className="profile-hero__edit-btn" title="Edit profile">✎</button>
              </div>
              {authUser?.email && <p className="profile-hero__email">{authUser.email}</p>}
              <p className="profile-hero__meta">
                {totalRecipes} {totalRecipes === 1 ? 'recipe' : 'recipes'} · {cookHistory.length} cooked · {isAdmin ? 'Admin' : 'Member'}
              </p>
            </div>
          </div>

          <div className="profile-hero__controls">
            <button onClick={onLogout} className="profile-signout-btn">Sign out</button>
            <div className="profile-dark-toggle">
              <Icon name={darkMode ? 'moon' : 'sun'} size={12} strokeWidth={2} color="var(--warm-gray)" />
              <button
                className={`dark-mode-toggle__btn dark-mode-toggle__btn--compact ${darkMode ? 'dark-mode-toggle__btn--on' : ''}`}
                onClick={() => setDarkMode && setDarkMode(!darkMode)}
                type="button"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span className="dark-mode-toggle__track"><span className="dark-mode-toggle__thumb" /></span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Inline Edit Panel ── */}
        {editingProfile && (
          <div className="profile-edit-panel">
            <div className="profile-edit-grid">
              <div className="profile-edit-field">
                <label className="profile-edit-label">Display Name</label>
                <input className="editor-input" value={editDraft.displayName} onChange={e => setEditDraft(d => ({ ...d, displayName: e.target.value }))} placeholder="Your name" />
              </div>
              <div className="profile-edit-field">
                <label className="profile-edit-label">Email</label>
                <input className="editor-input" type="email" value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))} placeholder="you@example.com" />
              </div>
              <div className="profile-edit-field profile-edit-field--full">
                <label className="profile-edit-label">Photo URL <span className="profile-edit-hint">paste a link to a photo</span></label>
                <input className="editor-input" type="url" value={editDraft.avatarUrl} onChange={e => setEditDraft(d => ({ ...d, avatarUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="profile-edit-field">
                <label className="profile-edit-label">New Password <span className="profile-edit-hint">leave blank to keep current</span></label>
                <input className="editor-input" type="password" value={editDraft.password} onChange={e => setEditDraft(d => ({ ...d, password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
              </div>
              {editDraft.password && (
                <div className="profile-edit-field">
                  <label className="profile-edit-label">Confirm Password</label>
                  <input className="editor-input" type="password" value={editDraft.confirmPassword} onChange={e => setEditDraft(d => ({ ...d, confirmPassword: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
                </div>
              )}
            </div>
            {editError && <p className="profile-edit-msg profile-edit-msg--error">{editError}</p>}
            {editSuccess && <p className="profile-edit-msg profile-edit-msg--success">{editSuccess}</p>}
            <div className="profile-edit-actions">
              <button onClick={() => setEditingProfile(false)} className="display-name-cancel-btn">Cancel</button>
              <button onClick={handleSaveProfile} disabled={editSaving} className="display-name-save-btn">
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cooking History ───────────────────────────────────────── */}
      <Section icon="calendar" title="Cooking History" defaultOpen={true}>
        {historyLoading ? (
          <div className="grocery-loading"><div className="loading-spinner" /><p>Loading history...</p></div>
        ) : cookHistory.length === 0 ? (
          <div className="profile-empty">
            <span className="profile-empty__icon"><Icon name="chefHat" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
            <p className="profile-empty__text">No cooking history yet. Mark a recipe as cooked to start your log!</p>
          </div>
        ) : (
          <>
            <div className="history-view-toggle" style={{ marginBottom: 14 }}>
              <button className={`history-view-toggle__btn ${historyView === 'timeline' ? 'history-view-toggle__btn--on' : ''}`} onClick={() => setHistoryView('timeline')}>☰ Timeline</button>
              <button className={`history-view-toggle__btn ${historyView === 'calendar' ? 'history-view-toggle__btn--on' : ''}`} onClick={() => setHistoryView('calendar')}>▦ Calendar</button>
            </div>
            {historyView === 'timeline' ? (
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
          </>
        )}
      </Section>

      {/* ── Cooking Stats ─────────────────────────────────────────── */}
      <Section icon="barChart" title="Cooking Stats">
        {cookHistory.length === 0 ? (
          <div className="profile-empty">
            <span className="profile-empty__icon"><Icon name="barChart" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
            <p className="profile-empty__text">Start cooking to unlock your personal stats and recipe breakdown!</p>
          </div>
        ) : (
          <>
            <div className="cook-stats-grid" style={{ marginBottom: 20 }}>
              <div className="cook-stat-card">
                <span className="cook-stat-card__num">{recipeCounts.length}</span>
                <span className="cook-stat-card__label">Unique dishes</span>
              </div>
              <div className="cook-stat-card">
                <span className="cook-stat-card__num">{cookStreak > 0 ? cookStreak : '—'}</span>
                <span className="cook-stat-card__label">Day streak</span>
              </div>
              <div className="cook-stat-card">
                <span className="cook-stat-card__num">{thisMonthCooks}</span>
                <span className="cook-stat-card__label">This month</span>
              </div>
              <div className="cook-stat-card cook-stat-card--wide">
                <span className="cook-stat-card__num cook-stat-card__num--text">{recipeCounts[0]?.name || '—'}</span>
                <span className="cook-stat-card__label">Most cooked</span>
              </div>
              <div className="cook-stat-card cook-stat-card--wide">
                <span className="cook-stat-card__num cook-stat-card__num--text">{favCookDay || '—'}</span>
                <span className="cook-stat-card__label">Favorite cook day</span>
              </div>
            </div>

            <p className="settings-section__title" style={{ marginBottom: 12 }}>Recipe Attempts</p>
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
          </>
        )}
      </Section>

      {/* ── Preferences ──────────────────────────────────────────── */}
      <Section icon="settings" title="Preferences">
        <div className="settings-section">
          <h4 className="settings-section__title"><Icon name="home" size={15} strokeWidth={2} /> Bottom Tab Bar</h4>
          <p className="settings-section__hint">Choose up to 4 tabs (Profile is always included)</p>
          {(() => {
            const ALL_TAB_OPTIONS = [
              { key: 'home',      label: 'Home',      icon: 'home'       },
              { key: 'recipes',   label: 'Recipes',   icon: 'bookOpen'   },
              { key: 'kitchen',   label: 'Kitchen',   icon: 'package'    },
              { key: 'grocery',   label: 'Grocery',   icon: 'cart'       },
              { key: 'cookbooks', label: 'Cookbooks', icon: 'bookMarked' },
              { key: 'notes',     label: 'Notes',     icon: 'lightbulb'  },
            ];
            const selected = tabBarTabs || ['home', 'recipes', 'kitchen', 'grocery'];
            const toggle = (key) => {
              if (selected.includes(key)) {
                if (selected.length <= 1) return;
                setTabBarTabs(selected.filter(k => k !== key));
              } else {
                if (selected.length >= 4) return;
                setTabBarTabs([...selected, key]);
              }
            };
            return (
              <div style={{ marginTop: 10 }}>
                <div className="picker__chips" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {ALL_TAB_OPTIONS.map(({ key, label, icon }) => {
                    const isOn = selected.includes(key);
                    const atMax = selected.length >= 4 && !isOn;
                    return (
                      <button key={key} className={`chip ${isOn ? 'chip--selected' : ''}`} onClick={() => toggle(key)} disabled={atMax} style={{ opacity: atMax ? 0.4 : 1 }}>
                        {isOn && <span className="chip__check">✓</span>}
                        <Icon name={icon} size={13} strokeWidth={2} /> {label}
                      </button>
                    );
                  })}
                  <button className="chip chip--selected" disabled style={{ opacity: 0.6 }}>
                    <span className="chip__check">✓</span>
                    <Icon name="user" size={13} strokeWidth={2} /> Profile
                  </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 8 }}>{selected.length}/4 selected · Profile is always shown</p>
              </div>
            );
          })()}
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
            <label className="dietary-hide-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={hideIncompatible} onChange={e => setHideIncompatible(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <span>Hide incompatible recipes from library</span>
            </label>
          )}
        </div>
      </Section>

      {/* ── Send Feedback ─────────────────────────────────────────── */}
      <Section icon="alertTriangle" title="Send Feedback">
        <div className="feedback-form">
          <textarea
            className="feedback-textarea"
            placeholder="Found a bug or have a suggestion? Tell us what's on your mind..."
            value={feedbackText}
            onChange={e => { setFeedbackText(e.target.value); setFeedbackSubmitted(false); }}
            rows={3}
          />
          <div className="feedback-form__footer">
            {feedbackSubmitted && <span className="feedback-success">✓ Logged — thanks!</span>}
            <button className="btn btn--primary btn--sm" disabled={!feedbackText.trim()} onClick={submitFeedback}>Submit</button>
          </div>
        </div>
        {feedbackList.length > 0 && (
          <div className="feedback-log">
            <div className="feedback-log__header">
              <span className="settings-section__title" style={{ margin: 0 }}>Your reports <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>({feedbackList.filter(b => !b.done).length} open)</span></span>
              {feedbackList.some(b => b.done) && (
                <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { const next = feedbackList.filter(b => !b.done); setFeedbackList(next); LS.set('feedbackReports', next); }}>
                  Clear resolved
                </button>
              )}
            </div>
            {feedbackList.map(bug => (
              <div key={bug.id} className={`feedback-item ${bug.done ? 'feedback-item--done' : ''}`}>
                <button className="feedback-item__check" data-done={bug.done}
                  onClick={() => { const next = feedbackList.map(b => b.id === bug.id ? { ...b, done: !b.done } : b); setFeedbackList(next); LS.set('feedbackReports', next); }}>
                  {bug.done ? '✓' : ''}
                </button>
                <div className="feedback-item__body">
                  <p className="feedback-item__text">{bug.text}</p>
                  <p className="feedback-item__date">{bug.date}</p>
                </div>
                <button className="editor-remove-btn" onClick={() => { const next = feedbackList.filter(b => b.id !== bug.id); setFeedbackList(next); LS.set('feedbackReports', next); }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── What's Coming ────────────────────────────────────────── */}
      <Section icon="zap" title="What's Coming">
        <div className="settings-section">
          <h4 className="settings-section__title">Recipe Sharing</h4>
          <p className="settings-section__hint">Share any recipe via a link — friends get a beautiful preview with a one-tap "Save to Hearth" button.</p>
          <span className="roadmap-badge">In progress</span>
        </div>
        <div className="settings-section">
          <h4 className="settings-section__title">Friend System</h4>
          <p className="settings-section__hint">Add friends, receive shared recipes, and browse what they're cooking.</p>
          <span className="roadmap-badge">Planned</span>
        </div>
        <div className="settings-section">
          <h4 className="settings-section__title">Private by Default</h4>
          <p className="settings-section__hint">Your recipes and data stay completely private — you choose what gets shared and with whom.</p>
          <span className="roadmap-badge">Planned</span>
        </div>
        <div className="settings-section">
          <h4 className="settings-section__title">Account Deletion</h4>
          <p className="settings-section__hint">Full self-serve account deletion — a required step before App Store submission.</p>
          <span className="roadmap-badge">Planned</span>
        </div>
      </Section>

      {/* ── About Hearth ─────────────────────────────────────────── */}
      <Section icon="lightbulb" title="About Hearth">
        <div className="settings-section">
          <p style={{ fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--charcoal)', margin: 0 }}>
            Hearth is your personal kitchen companion — a place to collect the recipes you love,
            track what you actually cook, and keep your grocery list in sync. Built for home cooks
            who want everything from fridge to table in one place.
          </p>
        </div>

        <div className="settings-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h4 className="settings-section__title" style={{ marginBottom: 14 }}>What's in the app</h4>
          <div className="feature-cards">
            {FEATURES.map(({ icon, label, sub }) => (
              <div key={label} className="feature-card">
                <Icon name={icon} size={20} strokeWidth={1.75} color="var(--terracotta)" />
                <p className="feature-card__label">{label}</p>
                <p className="feature-card__sub">{sub}</p>
              </div>
            ))}
          </div>
          <div className="about-stack-github-row" style={{ marginTop: 20 }}>
            <a className="about-github-btn" href="https://github.com/kavyasomala/Hearth" target="_blank" rel="noopener noreferrer">
              <svg className="about-github-btn__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              View on GitHub
            </a>
            <div className="about-stack">
              <span className="about-stack__badge">React</span>
              <span className="about-stack__badge">Node.js</span>
              <span className="about-stack__badge">PostgreSQL</span>
              <span className="about-stack__badge">Supabase</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Delete Account ───────────────────────────────────────── */}
      <Section icon="trash2" title="Delete Account">
        <div className="danger-zone">
          <p className="danger-zone__text">
            This permanently removes all your recipes, cookbooks, cook history, kitchen inventory, and your account.
            <strong> There is no undo.</strong>
          </p>
          <div className="danger-zone__form">
            <label className="profile-edit-label">
              Type <span style={{ fontFamily: 'monospace', background: 'var(--parchment)', padding: '1px 5px', borderRadius: 4 }}>DELETE</span> to confirm
            </label>
            <input
              className="editor-input"
              value={deleteConfirm}
              onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
              placeholder="DELETE"
              autoComplete="off"
              autoCapitalize="none"
            />
            {deleteError && <p className="profile-edit-msg profile-edit-msg--error">{deleteError}</p>}
            <button
              className="danger-zone__btn"
              disabled={deleteConfirm !== 'DELETE' || deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? 'Deleting...' : 'Delete my account'}
            </button>
          </div>
        </div>
      </Section>

    </main>
  );
};

export default ProfileTab;
