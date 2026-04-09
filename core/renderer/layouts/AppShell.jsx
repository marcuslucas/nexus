import styles from './AppShell.module.css';

/**
 * AppShell — the persistent layout frame.
 *
 * Phase 1: renders the sidebar container, topbar, and content slot.
 * Phase 2+: navItems will be populated from module manifests.
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
            <a key={item.id} href={item.path} className={styles.navItem}>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.topbarTitle}>Nexus Platform</span>
        </header>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
