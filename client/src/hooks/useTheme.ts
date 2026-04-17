import { useState, useEffect, useSyncExternalStore, useCallback } from "react";

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nutricore-theme';

const listeners = new Set<() => void>();

let currentTheme: Theme = 'dark';

function getStoredTheme(): Theme {
  return 'dark';
}

currentTheme = getStoredTheme();

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

if (typeof window !== 'undefined') {
  applyTheme(currentTheme);
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  return 'dark';
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme]);

  return { theme, toggleTheme };
}
