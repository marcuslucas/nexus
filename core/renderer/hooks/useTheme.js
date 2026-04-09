// core/renderer/hooks/useTheme.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { THEMES, DEFAULT_THEME } from "../styles/themes";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(
    () => localStorage.getItem("nexus-theme") || DEFAULT_THEME,
  );

  useEffect(() => {
    const theme = THEMES[themeId];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) =>
      root.style.setProperty(k, v),
    );
    root.dataset.theme = themeId;
    localStorage.setItem("nexus-theme", themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
