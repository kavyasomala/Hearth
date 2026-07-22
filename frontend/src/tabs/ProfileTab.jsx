import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../icons';
import { API, DIETARY_OPTIONS, THEME_OPTIONS, STAR_LABELS } from '../constants';
import { haptic, LS, getDaysInMonth, getFirstDayOfMonth, checkDietaryConflicts } from '../utils';
import { Badge } from '../components/ui';

// ─── Invite User Modal ────────────────────────────────────────────────────────
const InviteUserModal = ({ onClose, onInvited, authFetch }) => {
  const apiFetch = authFetch || fetch;
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return setError('Email is required.');
    setSending(true); setError('');
    try {
      const res = await apiFetch(`${API}/api/auth/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onInvited(email.trim());
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--warm-white)', borderRadius: 16, padding: '24px 22px', width: '100%', maxWidth: 320, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--charcoal)' }}>
            <Icon name="users" size={18} strokeWidth={2} /> Invite a Friend
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--warm-gray)', padding: '2px 4px' }}>×</button>
        </div>
        {error && <div style={{ background: '#fff0ee', border: '1px solid #f5c2b8', borderRadius: 8, padding: '7px 10px', fontSize: '0.8rem', color: 'var(--terracotta-dark, #b84a2e)' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email address</label>
          <input className="editor-input" type="email" placeholder="friend@example.com" value={email}
            onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoFocus
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            style={{ padding: '8px 10px', fontSize: '0.9rem' }} />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--warm-gray)', margin: 0 }}>They'll get an email to set their password and join Hearth.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'none', border: '1.5px solid var(--border)', color: 'var(--warm-gray)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleInvite} disabled={sending}
            style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'var(--terracotta)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending...' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  );
};

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

  // ── Display name editing ──
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  // ── Admin: manage users ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  // ── Admin: tools ──
  const [recalcRunning, setRecalcRunning] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);

  // ── Feedback ──
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackList, setFeedbackList] = useState(() => LS.get('feedbackReports', []));
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

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

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiFetch(`${API}/api/admin/users`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    finally { setUsersLoading(false); }
  };

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
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete ${user.display_name || user.email}? This removes all their data.`)) return;
    await apiFetch(`${API}/api/admin/users/${user.id}`, { method: 'DELETE' });
    loadUsers();
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

  return (
    <main className="view profile-view">
      {showInvite && (
        <InviteUserModal
          authFetch={authFetch}
          onClose={() => setShowInvite(false)}
          onInvited={(email) => { setInviteSuccess(`Invite sent to ${email}`); loadUsers(); setTimeout(() => setInviteSuccess(''), 4000); }}
        />
      )}

      {/* ── Profile Hero ─────────────────────────────────────────── */}
      <div className="profile-hero">
        <div className="profile-hero__top">
          {authUser?.avatar_url ? (
            <img src={authUser.avatar_url} alt="Avatar" className="profile-avatar profile-avatar--lg" referrerPolicy="no-referrer" />
          ) : (
            <div className="profile-avatar profile-avatar--lg profile-avatar--initial">
              {(displayName || authUser?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <button onClick={onLogout} className="profile-signout-btn">Sign out</button>
        </div>

        {editingDisplayName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <input
              autoFocus
              className="login-modal__input"
              style={{ flex: '1 1 180px', padding: '8px 12px', fontSize: '1rem', margin: 0 }}
              placeholder="Your name"
              value={draftDisplayName}
              onChange={e => setDraftDisplayName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveDisplayName(); if (e.key === 'Escape') setEditingDisplayName(false); }}
            />
            <button onClick={handleSaveDisplayName} disabled={savingDisplayName} className="display-name-save-btn">
              {savingDisplayName ? '...' : '✓ Save'}
            </button>
            <button onClick={() => setEditingDisplayName(false)} className="display-name-cancel-btn">Cancel</button>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="profile-hero__name">{displayName || 'Set a display name'}</h2>
              {isAdmin && <span className="profile-hero__badge">Admin</span>}
              <button
                onClick={() => { setDraftDisplayName(authUser?.display_name || ''); setEditingDisplayName(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
                title="Edit display name"
              >✎</button>
            </div>
            {authUser?.email && <p className="profile-hero__email">{authUser.email}</p>}
          </div>
        )}
      </div>

      {/* ── Stats Row ────────────────────────────────────────────── */}
      <div className="profile-stats-row">
        <div className="profile-stat">
          <span className="profile-stat__num">{totalRecipes}</span>
          <span className="profile-stat__label">Recipes</span>
        </div>
        <div className="profile-stat-divider" />
        <div className="profile-stat">
          <span className="profile-stat__num">{cookHistory.length}</span>
          <span className="profile-stat__label">Times Cooked</span>
        </div>
        <div className="profile-stat-divider" />
        <div className="profile-stat">
          <span className="profile-stat__num">{recipeCounts.length}</span>
          <span className="profile-stat__label">Unique Dishes</span>
        </div>
      </div>

      {/* ── Dark Mode Quick Toggle ────────────────────────────────── */}
      <div className="profile-quick-bar">
        <span className="profile-quick-bar__label"><Icon name={darkMode ? 'moon' : 'sun'} size={14} strokeWidth={2} /> {darkMode ? 'Dark mode' : 'Light mode'}</span>
        <button
          className={`dark-mode-toggle__btn ${darkMode ? 'dark-mode-toggle__btn--on' : ''}`}
          onClick={() => setDarkMode && setDarkMode(!darkMode)}
          type="button"
        >
          <span className="dark-mode-toggle__track"><span className="dark-mode-toggle__thumb" /></span>
        </button>
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
              <button className={`history-view-toggle__btn ${historyView === 'timeline' ? 'history-view-toggle__btn--on' : ''}`} onClick={() => setHistoryView('timeline')} title="Timeline view">☰ Timeline</button>
              <button className={`history-view-toggle__btn ${historyView === 'calendar' ? 'history-view-toggle__btn--on' : ''}`} onClick={() => setHistoryView('calendar')} title="Calendar view">▦ Calendar</button>
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

      {/* ── Recipe Attempts ───────────────────────────────────────── */}
      <Section icon="repeat" title="Recipe Attempts">
        {recipeCounts.length === 0 ? (
          <div className="profile-empty">
            <span className="profile-empty__icon"><Icon name="repeat" size={36} strokeWidth={1.5} color="var(--ash)" /></span>
            <p className="profile-empty__text">No recipe attempts yet. Start cooking to track how often you make each dish!</p>
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

      {/* ── Admin: Manage Users ──────────────────────────────────── */}
      {isAdmin && (
        <Section icon="users" title="Manage Users" defaultOpen={false}>
          <div className="settings-section" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 className="settings-section__title" style={{ margin: 0 }}>Current Users</h4>
              <button
                onClick={() => { setInviteSuccess(''); setShowInvite(true); if (users.length === 0) loadUsers(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                <Icon name="userCircle" size={14} strokeWidth={2} /> Invite Friend
              </button>
            </div>
            {inviteSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem', color: '#166534', marginBottom: 12 }}>
                {inviteSuccess}
              </div>
            )}
            {users.length === 0 && !usersLoading && (
              <button onClick={loadUsers} className="btn btn--ghost btn--sm" style={{ marginBottom: 12 }}>Load users</button>
            )}
            {usersLoading ? (
              <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Loading...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {users.map(u => (
                  <div key={u.id} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--cream)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'suspended' ? '#c8c3bc' : u.role === 'admin' ? 'var(--terracotta)' : 'var(--sage)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {(u.display_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {u.display_name || u.email}
                          <button
                            className={`admin-pill-toggle ${u.role === 'admin' ? 'admin-pill-toggle--on' : 'admin-pill-toggle--off'}`}
                            title={u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                            onClick={async () => {
                              const isAdminNow = u.role === 'admin';
                              if (!window.confirm(isAdminNow ? `Remove admin from ${u.display_name || u.email}?` : `Make ${u.display_name || u.email} an admin?`)) return;
                              await apiFetch(`${API}/api/admin/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: isAdminNow ? 'guest' : 'admin' }) });
                              loadUsers();
                            }}
                          >
                            <span className="admin-pill-toggle__track"><span className="admin-pill-toggle__thumb" /></span>
                            <span className="admin-pill-toggle__label">Admin</span>
                          </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--warm-gray)' }}>
                          {u.display_name ? `${u.email} · ` : ''}<span style={{ textTransform: 'capitalize' }}>{u.role}</span>
                        </div>
                      </div>
                      {u.role !== 'admin' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button onClick={() => handleSuspend(u)} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--warm-white)', cursor: 'pointer', color: u.role === 'suspended' ? 'var(--sage)' : 'var(--warm-gray)', fontWeight: 500 }}>
                            {u.role === 'suspended' ? 'Restore' : 'Suspend'}
                          </button>
                          <button onClick={() => handleDelete(u)} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 999, border: '1px solid #f5c2b8', background: '#fff0ee', cursor: 'pointer', color: 'var(--terracotta-dark, #b84a2e)', fontWeight: 500 }}>
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Admin: Tools ─────────────────────────────────────────── */}
      {isAdmin && (
        <Section icon="tool" title="Admin Tools">
          <div className="settings-section">
            <h4 className="settings-section__title"><Icon name="repeat" size={15} strokeWidth={2} /> Recalculate Nutrition</h4>
            <p className="settings-section__hint">Clears all pre-populated calories/protein/fiber and recalculates from each recipe's ingredients.</p>
            <button
              className="btn btn--primary btn--sm"
              style={{ marginTop: 10 }}
              disabled={recalcRunning}
              onClick={async () => {
                if (!window.confirm('Clear ALL existing nutrition data and recalculate from ingredients?')) return;
                setRecalcRunning(true); setRecalcResult(null);
                try {
                  const res = await apiFetch(`${API}/api/admin/recalculate-nutrition`, { method: 'POST' });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed');
                  setRecalcResult(`Done — updated ${data.updated} of ${data.total} recipes`);
                } catch (e) { setRecalcResult(`Error: ${e.message}`); }
                setRecalcRunning(false);
              }}
            >{recalcRunning ? 'Running...' : 'Recalculate All'}</button>
            {recalcResult && <p style={{ marginTop: 10, fontSize: '0.85rem', color: recalcResult.startsWith('Done') ? 'var(--sage)' : 'var(--terracotta)' }}>{recalcResult}</p>}
          </div>
        </Section>
      )}

      {/* ── Feedback ─────────────────────────────────────────────── */}
      <Section icon="alertTriangle" title="Send Feedback" badge={feedbackList.filter(b => !b.done).length || null}>
        <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
          <p className="settings-section__hint">Found a bug or have a suggestion? Log it here.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              className="editor-input"
              style={{ flex: 1, fontSize: 14 }}
              placeholder="Describe what went wrong or what you'd like..."
              value={feedbackText}
              onChange={e => { setFeedbackText(e.target.value); setFeedbackSubmitted(false); }}
              onKeyDown={e => e.key === 'Enter' && submitFeedback()}
            />
            <button className="btn btn--primary btn--sm" disabled={!feedbackText.trim()} onClick={submitFeedback}>Submit</button>
          </div>
          {feedbackSubmitted && <p style={{ fontSize: 12, color: 'var(--sage)', marginTop: 6 }}>✓ Logged — thanks!</p>}
        </div>
        {feedbackList.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h4 className="settings-section__title" style={{ margin: 0 }}>Your reports ({feedbackList.filter(b => !b.done).length} open)</h4>
              {feedbackList.some(b => b.done) && (
                <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { const next = feedbackList.filter(b => !b.done); setFeedbackList(next); LS.set('feedbackReports', next); }}>
                  Clear resolved
                </button>
              )}
            </div>
            {feedbackList.map(bug => (
              <div key={bug.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: bug.done ? 'var(--cream)' : 'var(--warm-white)', border: `1.5px solid var(--border)`, borderLeft: `3px solid ${bug.done ? 'var(--sage)' : 'var(--terracotta-light)'}`, borderRadius: 10, opacity: bug.done ? 0.55 : 1 }}>
                <button
                  onClick={() => { const next = feedbackList.map(b => b.id === bug.id ? { ...b, done: !b.done } : b); setFeedbackList(next); LS.set('feedbackReports', next); }}
                  style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `1.5px solid ${bug.done ? 'var(--sage)' : 'var(--border)'}`, background: bug.done ? 'var(--sage)' : 'transparent', color: bug.done ? 'white' : 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >{bug.done ? '✓' : ''}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--charcoal)', margin: 0, textDecoration: bug.done ? 'line-through' : 'none', wordBreak: 'break-word' }}>{bug.text}</p>
                  <p style={{ fontSize: 11, color: 'var(--warm-gray)', margin: '2px 0 0' }}>{bug.date}</p>
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
          <h4 className="settings-section__title">🔗 Recipe Sharing</h4>
          <p className="settings-section__hint">Share any recipe via a link — friends get a beautiful preview with a one-tap "Save to Hearth" button.</p>
          <span className="roadmap-badge">In progress</span>
        </div>
        <div className="settings-section">
          <h4 className="settings-section__title">👥 Friend System</h4>
          <p className="settings-section__hint">Add friends by username, receive and save their shared recipes, browse what they're cooking.</p>
          <span className="roadmap-badge">Planned</span>
        </div>
        <div className="settings-section">
          <h4 className="settings-section__title">🔒 Row-Level Security</h4>
          <p className="settings-section__hint">Each user's recipes and data will be completely private by default — you choose what gets shared.</p>
          <span className="roadmap-badge">Planned</span>
        </div>
        <div className="settings-section">
          <h4 className="settings-section__title">🗑️ Account Deletion</h4>
          <p className="settings-section__hint">Full self-serve account deletion that removes all your data — a required step before App Store submission.</p>
          <span className="roadmap-badge">Planned</span>
        </div>
      </Section>

      {/* ── About Hearth ─────────────────────────────────────────── */}
      <Section icon="lightbulb" title="About Hearth">
        <div className="settings-section">
          <p className="settings-section__hint" style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--charcoal)' }}>
            Hearth is your personal kitchen companion — a place to collect the recipes you love, track what you cook, and actually use your grocery list.
          </p>
        </div>

        <div className="settings-section">
          <h4 className="settings-section__title">✨ What's in the app</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {[
              { icon: '🔗', label: 'Import any recipe from a URL', sub: 'Paste a link, Hearth scrapes the recipe automatically' },
              { icon: '⚖️', label: 'Live recipe scaling', sub: 'Tap servings to adjust ingredient amounts on the fly' },
              { icon: '🥬', label: 'Kitchen inventory', sub: 'Track fridge and pantry — see which recipes you can make right now' },
              { icon: '🛒', label: 'Smart grocery lists', sub: 'Consolidates ingredients across recipes with unit conversion' },
              { icon: '📚', label: 'Cookbooks', sub: 'Organize recipes into collections' },
              { icon: '📝', label: 'Cooking notes', sub: 'Per-recipe notes that persist across cook sessions' },
              { icon: '📅', label: 'Cooking history', sub: 'Timeline + calendar of every dish you\'ve made' },
            ].map(({ icon, label, sub }) => (
              <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--charcoal)' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--warm-gray)' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section settings-section--about" style={{ borderBottom: 'none' }}>
          <div className="about-cards">
            <div className="about-card">
              <span className="about-card__icon"><Icon name="barChart" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
              <div><div className="about-card__value">{totalRecipes}</div><div className="about-card__label">Recipes</div></div>
            </div>
            <div className="about-card">
              <span className="about-card__icon"><Icon name="chefHat" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
              <div><div className="about-card__value">{cookHistory.length}</div><div className="about-card__label">Times Cooked</div></div>
            </div>
            <div className="about-card">
              <span className="about-card__icon"><Icon name="zap" size={22} strokeWidth={2} color="var(--terracotta)" /></span>
              <div><div className="about-card__value">v2.0</div><div className="about-card__label">Version</div></div>
            </div>
          </div>
          <div className="about-stack-github-row">
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

    </main>
  );
};

export default ProfileTab;
