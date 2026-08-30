import React from 'react';
import { Icon } from '../icons';

/**
 * The single page header used by every tab.
 *
 * Before this, each tab rolled its own: title sizes ran 18px to 2rem, the space
 * beneath ran 12px to 40px, and the Add tab was centred while everything else
 * was left-aligned. All of that now comes from one place.
 *
 *   title    — the page name (required)
 *   subtitle — optional one-liner under it
 *   icon     — optional icon name, rendered before the title
 *   actions  — optional right-aligned node (buttons, chips, counts)
 *   compact  — tighter spacing for dense pages like Grocery
 */
export default function PageHeader({ title, subtitle, icon, actions, compact = false, children }) {
  return (
    <header className={`page-header${compact ? ' page-header--compact' : ''}`}>
      <div className="page-header__row">
        <h1 className="page-header__title">
          {icon && <Icon name={icon} size={22} strokeWidth={2} className="page-header__icon" />}
          {title}
        </h1>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      {children}
    </header>
  );
}
