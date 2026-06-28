import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../icons';
import { API } from '../constants';
import { haptic } from '../utils';
import { AutoGrowTextarea, Badge } from '../components/ui';

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
          <button className="ing-modal__close" onClick={onClose}>âœ•</button>
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
                  {form.type === t && <span className="chip__check">âœ“</span>}<Icon name={NOTE_TYPE_META[t].emoji} size={13} strokeWidth={2} /> {NOTE_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Description <span className="create-modal__required">*</span></label>
            <textarea className="editor-textarea" value={form.body} onChange={e => handleBodyChange(e.target.value)} placeholder="Describe the rule, technique, or tip..." rows={4} style={{ resize: 'vertical' }} />
          </div>
          <div className="create-modal__field">
            <label className="create-modal__field-label">Tooltip keywords <span style={{opacity:0.6, fontWeight:400}}>auto-generated Â· edit freely</span></label>
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
          <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : isNew ? '+ Add Note' : 'âœ“ Save'}</button>
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
        <span className="cn-card__chevron">{expanded ? 'â–´' : 'â–¾'}</span>
        {isAdmin && (
          <div className="cn-card__actions" onClick={e => e.stopPropagation()}>
            <button className="cn-card__action-btn" onClick={onEdit} title="Edit">âœŽ</button>
            <button className="cn-card__action-btn cn-card__action-btn--del" onClick={onDelete} title="Delete">âœ•</button>
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

// â”€â”€â”€ Cooking Notes Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export default CookingNotesTab;
