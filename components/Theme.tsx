"use client"

import { useEffect, useState } from 'react';

const Theme = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize from system preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  // Apply/remove `dark` class on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return { isDarkMode, toggleTheme };
}

export default Theme