import React, { useState, useCallback } from 'react';
import MainNavbar from './Navbar';

const SIDEBAR_KEY = 'sidebarCollapsed';

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch (e) { return false; }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch (e) { /* noop */ }
      return next;
    });
  }, []);

  return (
    <div className={`app-layout ${collapsed ? 'app-layout--collapsed' : ''}`}>
      <MainNavbar collapsed={collapsed} onToggle={toggle} />
      <main className="app-layout__main">{children}</main>
    </div>
  );
};

export default Layout;
