import React from 'react';
import { Icon } from '../icons';
import { TAG_FILTERS } from '../constants';

const HeroImage = ({ src, alt }) => (
  <div className="rp2__hero-img-wrap">
    <img className="rp2__hero-img" src={src} alt={alt} draggable={false} />
  </div>
);

const HeroTagsButton = ({ recipe }) => {
  const [open, setOpen] = React.useState(false);
  const allTags = [
    ...(recipe.cuisine ? [{ label: recipe.cuisine, type: 'cuisine' }] : []),
    ...(recipe.tags || []).map(t => ({
      label: TAG_FILTERS.find(f => f.key === t)?.label || t,
      type: 'tag',
    })),
    ...(recipe.status && recipe.status !== '' ? [{
      label: recipe.status,
      type: 'status',
    }] : []),
  ];
  if (!allTags.length) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="rp2__hero-btn"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <Icon name="tag" size={12} strokeWidth={2} /> Tags
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed',
            top: 'auto',
            left: 12,
            right: 12,
            marginTop: 8,
            background: 'rgba(20,20,20,0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: '14px 16px',
            zIndex: 300,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 7,
          }} onClick={e => e.stopPropagation()}>
            {allTags.map(({ label, type }) => (
              <span key={label} style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 999,
                color: 'white',
                whiteSpace: 'nowrap',
                background: type === 'cuisine'
                  ? 'rgba(212,120,72,0.5)'
                  : type === 'status'
                  ? 'rgba(122,170,126,0.5)'
                  : 'rgba(255,255,255,0.12)',
                border: `1px solid ${type === 'cuisine' ? 'rgba(212,120,72,0.6)' : type === 'status' ? 'rgba(122,170,126,0.6)' : 'rgba(255,255,255,0.2)'}`,
              }}>{label}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export { HeroImage, HeroTagsButton };
