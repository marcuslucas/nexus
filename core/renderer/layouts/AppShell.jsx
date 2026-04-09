import React from "react";
import { NavLink } from "react-router-dom";
import styles from "./AppShell.module.css";

/**
 * AppShell — the persistent layout frame.
 *
 * Phase 1: renders the sidebar container, topbar, and content slot.
 * Phase 2+: navItems populated from active module manifests via App.jsx.
 */
export function AppShell({ navItems = [], children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.brand}>NEXUS</span>
        </div>
        <nav className={styles.nav}>
          {navItems.length === 0 && (
            <span className={styles.navEmpty}>No modules loaded</span>
          )}
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                isActive
                  ? `${styles.navItem} ${styles.navItemActive}`
                  : styles.navItem
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.topbarTitle}>Nexus Platform</span>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
