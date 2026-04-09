import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { ThemeProvider } from "./hooks/useTheme";
import { initApiClient } from "./hooks/apiClient";
import { MODULE_REGISTRY } from "./moduleRegistry";
import React from "react";

export function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [activeModuleIds, setActiveModuleIds] = useState([]);

  useEffect(() => {
    async function init() {
      try {
        const config = await window.nexus.getConfig();
        initApiClient(config.FLASK_PORT);
        setActiveModuleIds(config.modules || []);
        setReady(true);
      } catch (err) {
        setInitError(err.message);
      }
    }
    init();
  }, []);

  if (initError) {
    return (
      <div
        style={{ padding: "32px", color: "#e05c5c", fontFamily: "monospace" }}
      >
        <strong>Initialization error:</strong> {initError}
      </div>
    );
  }

  if (!ready) {
    return null;
  }

  // Collect nav items and routes from active modules in registry order
  const navItems = [];
  const routes = [];
  for (const moduleId of activeModuleIds) {
    const mod = MODULE_REGISTRY[moduleId];
    if (mod) {
      navItems.push(...mod.navItems);
      routes.push(...mod.routes);
    }
  }

  // Default redirect: first route of first active module, or null if none
  const defaultPath = routes.length > 0 ? routes[0].path : null;

  return (
    <ThemeProvider>
      <HashRouter>
        <AppShell navItems={navItems}>
          <Routes>
            {routes.map(({ path, component: Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            {defaultPath && (
              <Route path="/" element={<Navigate to={defaultPath} replace />} />
            )}
          </Routes>
        </AppShell>
      </HashRouter>
    </ThemeProvider>
  );
}
