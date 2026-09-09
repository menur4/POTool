import React from 'react';
import './Tabs.css';

/**
 * Controlled Tabs component for navigation between sections
 *
 * @param {Object} props
 * @param {Array} props.tabs - Array of tab definitions { id, label, disabled }
 * @param {string} props.activeTab - Currently active tab ID
 * @param {Function} props.onTabChange - Callback when tab changes
 * @param {'default'|'underline'|'pills'} props.variant - Visual variant
 * @param {'sm'|'md'|'lg'} props.size - Size of tabs
 * @param {string} props.className - Additional CSS class
 */
const Tabs = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`tabs ${className}`}>
      <div
        className={`tabs__list tabs__list--${variant} tabs__list--${size}`}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            className={`tabs__tab ${activeTab === tab.id ? 'tabs__tab--active' : ''} ${
              tab.disabled ? 'tabs__tab--disabled' : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
