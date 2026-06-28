import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Icon } from '../icons';
import { API, DIETARY_OPTIONS, THEME_OPTIONS, STAR_LABELS } from '../constants';
import { haptic, LS, getDaysInMonth, getFirstDayOfMonth, checkDietaryConflicts } from '../utils';
import { Badge } from '../components/ui';

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
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--warm-gray)', lineHeight: 1, padding: '2px 4px' }}>Ã—</button>
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

// â”€â”€â”€ Profile Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ProfileTab = ({ recipes, dietaryFilters, setDietaryFilters, units, setUnits, totalRecipes, hideIncompatible, setHideIncompatible, authFetch, authUser, onLogout, onAuthUserUpdate, darkMode = false, setDarkMode, tabBarTabs, setTabBarTabs }) => {
  const apiFetch = authFetch || fetch;
  const isAdmin = authUser?.role === 'admin';
  const [cookHistory, setCookHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(() => LS.get('showComingSoon', true));
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugText, setBugText] = useState('');
  const [bugList, setBugList] = useState(() => LS.get('bugReports', []));
  const [bugSubmitted, setBugSubmitted] = useState(false);
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
          onCreated={(uname) => { setAddFriendSuccess(`Account created for ${uname} âœ“`); loadUsers(); setTimeout(() => setAddFriendSuccess(''), 4000); }}
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
                {savingDisplayName ? '...' : 'âœ“ Save'}
              </button>
              <button onClick={() => setEditingDisplayName(false)} className="display-name-cancel-btn">
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="profile-header__title" style={{ margin: 0 }}>{authUser?.display_name || authUser?.username || 'Your Kitchen'}</h2>
              <button onClick={() => { setDraftDisplayName(authUser?.display_name || ''); setEditingDisplayName(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }} title="Edit display name">âœŽ</button>
            </div>
          )}
          <p className="profile-header__sub" style={{ marginTop: 2 }}>
            {authUser?.display_name ? <span style={{ color: 'var(--warm-gray)', fontSize: '0.8rem' }}>@{authUser.username} Â· </span> : null}
            {totalRecipes} recipes Â· {cookHistory.length} times cooked{isAdmin ? ' Â· admin' : ''}
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
                <button className={`history-view-toggle__btn ${historyView==='timeline'?'history-view-toggle__btn--on':''}`} onClick={() => setHistoryView('timeline')} title="Timeline view">â˜°</button>
                <button className={`history-view-toggle__btn ${historyView==='calendar'?'history-view-toggle__btn--on':''}`} onClick={() => setHistoryView('calendar')} title="Calendar view">â–¦</button>
              </div>
            )}
            <span className={`profile-settings-toggle__arrow ${historyOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
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
                                    {'â˜…'.repeat(entry.rating)}<span className="cook-timeline__rating-empty">{'â˜…'.repeat(5 - entry.rating)}</span>
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
                  <button className="cook-calendar__nav-btn" onClick={prevMonth}>â€¹</button>
                  <span className="cook-calendar__month-label">{MONTH_NAMES[calendarDate.month]} {calendarDate.year}</span>
                  <button className="cook-calendar__nav-btn" onClick={nextMonth}>â€º</button>
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
          <span className={`profile-settings-toggle__arrow ${attemptsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
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
            <span className={`profile-settings-toggle__arrow ${sharingOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
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
                              {u.display_name ? `@${u.username} Â· ` : ''}<span style={{ textTransform: 'capitalize' }}>{u.role}</span>
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
            <span className={`profile-settings-toggle__arrow ${adminToolsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
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
                      setRecalcResult(`âœ“ Done -- updated ${data.updated} of ${data.total} recipes`);
                    } catch (e) { setRecalcResult(`âš ï¸ ${e.message}`); }
                    setRecalcRunning(false);
                  }}
                >{recalcRunning ? 'Running...' : 'Recalculate All Nutrition'}</button>
                {recalcResult && <p style={{ marginTop: 10, fontSize: '0.85rem', color: recalcResult.startsWith('âœ“') ? 'var(--sage)' : 'var(--terracotta)' }}>{recalcResult}</p>}
              </div>

            </div>
          )}
        </section>
      )}

      {/* -- Coming Soon -- */}
      {showComingSoon && (
        <section className="profile-section profile-section--collapsible">
          <button className="profile-settings-toggle" onClick={() => setComingSoonOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="zap" size={15} strokeWidth={2} /> Coming Soon</span>
            <span className={`profile-settings-toggle__arrow ${comingSoonOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </button>
          {comingSoonOpen && (
            <div className="profile-settings-body">

              <div className="settings-section">
                <h4 className="settings-section__title">âš–ï¸ Recipe Proportions</h4>
                <p className="settings-section__hint">
                  Adjust any one ingredient's amount and the rest of the recipe scales automatically
                  while keeping whole-unit ingredients (like eggs) sensibly rounded. Calorie and
                  nutrition totals will recalculate in real time as amounts change.
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

              <div className="settings-section">
                <h4 className="settings-section__title">ðŸ’¬ Ingredient Reasoning on Hover</h4>
                <p className="settings-section__hint">
                  Hover over any ingredient in a recipe to see a short cooking note explaining why
                  that quantity or ratio was chosen â€” things like "balances acidity" or "adds depth
                  without overpowering." Purely culinary context, no dietary or allergy info.
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

              <div className="settings-section">
                <h4 className="settings-section__title">ðŸ”¢ Accurate Calorie Tracking</h4>
                <p className="settings-section__hint">
                  After cooking, log exactly how much of each high-calorie ingredient you actually
                  used and get an adjusted nutrition breakdown â€” useful when you deviate from the
                  recipe (e.g. used less oil, added extra cheese).
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

              <div className="settings-section">
                <h4 className="settings-section__title">ðŸ–¼ï¸ Local Image Upload</h4>
                <p className="settings-section__hint">
                  Upload a photo directly from your device to use as a recipe cover image, stored
                  as a base-64 string in the database â€” no external hosting or URL required.
                </p>
                <span className="roadmap-badge">Planned</span>
              </div>

            </div>
          )}
        </section>
      )}

      {/* -- Bug Reports -- */}
      {isAdmin && (
        <section className="profile-section profile-section--collapsible">
          <button className="profile-settings-toggle" onClick={() => setBugReportOpen(o => !o)}>
            <span className="profile-settings-toggle__title"><Icon name="alertTriangle" size={15} strokeWidth={2} /> Bug Reports <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--warm-gray)', marginLeft: 4 }}>({bugList.length})</span></span>
            <span className={`profile-settings-toggle__arrow ${bugReportOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
          </button>
          {bugReportOpen && (
            <div className="profile-settings-body">
              <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                <h4 className="settings-section__title">Report a Bug</h4>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    className="editor-input"
                    style={{ flex: 1, fontSize: 14 }}
                    placeholder="Describe what went wrong..."
                    value={bugText}
                    onChange={e => { setBugText(e.target.value); setBugSubmitted(false); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && bugText.trim()) {
                        const entry = { id: Date.now(), text: bugText.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), done: false };
                        const next = [entry, ...bugList];
                        setBugList(next);
                        LS.set('bugReports', next);
                        setBugText('');
                        setBugSubmitted(true);
                        setTimeout(() => setBugSubmitted(false), 2000);
                      }
                    }}
                  />
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={!bugText.trim()}
                    onClick={() => {
                      const entry = { id: Date.now(), text: bugText.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), done: false };
                      const next = [entry, ...bugList];
                      setBugList(next);
                      LS.set('bugReports', next);
                      setBugText('');
                      setBugSubmitted(true);
                      setTimeout(() => setBugSubmitted(false), 2000);
                    }}
                  >+ Add</button>
                </div>
                {bugSubmitted && <p style={{ fontSize: 12, color: 'var(--sage)', marginTop: 6 }}>âœ“ Logged!</p>}
              </div>
              {bugList.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h4 className="settings-section__title" style={{ margin: 0 }}>Open ({bugList.filter(b => !b.done).length})</h4>
                    {bugList.some(b => b.done) && (
                      <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '3px 10px' }}
                        onClick={() => { const next = bugList.filter(b => !b.done); setBugList(next); LS.set('bugReports', next); }}>
                        Clear fixed
                      </button>
                    )}
                  </div>
                  {bugList.map(bug => (
                    <div key={bug.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                      background: bug.done ? 'var(--cream)' : 'var(--warm-white)',
                      border: `1.5px solid ${bug.done ? 'var(--border)' : 'var(--border)'}`,
                      borderLeft: `3px solid ${bug.done ? 'var(--sage)' : 'var(--terracotta-light)'}`,
                      borderRadius: 10, opacity: bug.done ? 0.55 : 1,
                    }}>
                      <button
                        title={bug.done ? 'Mark as open' : 'Mark as fixed'}
                        onClick={() => {
                          const next = bugList.map(b => b.id === bug.id ? { ...b, done: !b.done } : b);
                          setBugList(next); LS.set('bugReports', next);
                        }}
                        style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          border: `1.5px solid ${bug.done ? 'var(--sage)' : 'var(--border)'}`,
                          background: bug.done ? 'var(--sage)' : 'transparent',
                          color: bug.done ? 'white' : 'transparent',
                          cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >{bug.done ? 'âœ“' : ''}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--charcoal)', margin: 0, textDecoration: bug.done ? 'line-through' : 'none', wordBreak: 'break-word' }}>{bug.text}</p>
                        <p style={{ fontSize: 11, color: 'var(--warm-gray)', margin: '2px 0 0' }}>{bug.date}</p>
                      </div>
                      <button className="editor-remove-btn" title="Delete"
                        onClick={() => { const next = bugList.filter(b => b.id !== bug.id); setBugList(next); LS.set('bugReports', next); }}
                      >âœ•</button>
                    </div>
                  ))}
                </div>
              )}
              {bugList.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 12 }}>No bugs logged yet. Nice!</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* -- 4. Settings -- */}
      <section className="profile-section profile-section--settings">
        <button className="profile-settings-toggle" onClick={() => setSettingsOpen(o => !o)}>
          <span className="profile-settings-toggle__title"><Icon name="settings" size={15} strokeWidth={2} /> Settings</span>
          <span className={`profile-settings-toggle__arrow ${settingsOpen ? 'profile-settings-toggle__arrow--open' : ''}`}>â–¾</span>
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
              <h4 className="settings-section__title"><Icon name="home" size={15} strokeWidth={2} /> Bottom Tab Bar</h4>
              <p className="settings-section__hint">Choose which 5 tabs appear on the bottom bar (Profile is always included)</p>
              {(() => {
                const ALL_TAB_OPTIONS = [
                  { key: 'home',      label: 'Home',      icon: 'home'      },
                  { key: 'recipes',   label: 'Recipes',   icon: 'bookOpen'  },
                  { key: 'kitchen',   label: 'Kitchen',   icon: 'package'   },
                  { key: 'grocery',   label: 'Grocery',   icon: 'cart'      },
                  { key: 'cookbooks', label: 'Cookbooks', icon: 'bookMarked'},
                  { key: 'notes',     label: 'Notes',     icon: 'lightbulb' },
                ];
                const selected = tabBarTabs || ['home', 'recipes', 'kitchen', 'grocery'];
                const toggle = (key) => {
                  if (key === 'profile') return; // always included
                  if (selected.includes(key)) {
                    if (selected.length <= 1) return; // keep at least 1
                    setTabBarTabs(selected.filter(k => k !== key));
                  } else {
                    if (selected.length >= 4) return; // max 4 + profile = 5
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
                          <button key={key}
                            className={`chip ${isOn ? 'chip--selected' : ''}`}
                            onClick={() => toggle(key)}
                            disabled={atMax}
                            style={{ opacity: atMax ? 0.4 : 1 }}
                          >
                            {isOn && <span className="chip__check">âœ“</span>}
                            <Icon name={icon} size={13} strokeWidth={2} /> {label}
                          </button>
                        );
                      })}
                      <button className="chip chip--selected" disabled style={{ opacity: 0.6 }}>
                        <span className="chip__check">âœ“</span>
                        <Icon name="user" size={13} strokeWidth={2} /> Profile
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 8 }}>
                      {selected.length}/4 selected Â· Profile is always shown
                    </p>
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
                    {dietaryFilters.includes(d) && <span className="chip__check">âœ“</span>}{d}
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

export default ProfileTab;
