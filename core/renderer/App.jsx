import { useState, useEffect } from "react";
import { AppShell } from "./layouts/AppShell";
import { initApiClient } from "./hooks/apiClient";
import React from "react";
import { ThemeProvider } from "./hooks/useTheme";

/**
 * App — root component.
 *
 * Phase 1: initializes apiClient from config, renders AppShell with empty nav.
 * Phase 2+: reads module manifests from product config, populates navItems and routes.
 */
export function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const config = await window.nexus.getConfig();
        initApiClient(config.FLASK_PORT);
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

  return (
    <ThemeProvider>
      <AppShell navItems={[]}>
        {/* Phase 1: empty content area — routes added in Phase 2 */}
      </AppShell>
    </ThemeProvider>
  );
}
