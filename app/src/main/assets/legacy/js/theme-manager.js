// js/theme-manager.js - نسخة نهائية مع فصل تام بين الداكن والفاتح
window.ThemeManager = (function() {
    'use strict';

    const STORAGE_KEY = 'theme';
    const DARK_MODE_KEY = 'darkMode';
    const DEFAULT_THEME = 'forest-gold';
    const DEFAULT_DARK_MODE = false; // الوضع الفاتح هو الافتراضي

    let currentTheme = DEFAULT_THEME;
    let currentDarkMode = DEFAULT_DARK_MODE;

    function apply(theme, darkMode) {
        const root = document.documentElement;
        const body = document.body;

        if (!root || !body) {
            console.warn('[ThemeManager] DOM not ready');
            return;
        }

        const finalTheme = darkMode ? theme : 'light';
        
        console.log('[ThemeManager] Applying:', { theme, darkMode, finalTheme });
        
        root.setAttribute('data-theme', finalTheme);
        body.setAttribute('data-theme', finalTheme);

        if (darkMode) {
            body.classList.remove('light-mode');
        } else {
            body.classList.add('light-mode');
        }

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            const color = darkMode ? '#0a0c10' : '#fef7e8';
            meta.setAttribute('content', color);
        }

        const themeSelectContainer = document.getElementById('theme-select-container');
        if (themeSelectContainer) {
            themeSelectContainer.style.display = darkMode ? 'flex' : 'none';
        }

        try {
            localStorage.setItem(STORAGE_KEY, theme);
            localStorage.setItem(DARK_MODE_KEY, darkMode ? 'true' : 'false');
        } catch (e) {
            console.warn('[ThemeManager] Failed to save:', e);
        }

        currentTheme = theme;
        currentDarkMode = darkMode;

        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme, darkMode, finalTheme } }));
        console.log('✅ Theme applied:', finalTheme, 'DarkMode:', darkMode);
    }

    function load() {
        try {
            let storedTheme = localStorage.getItem(STORAGE_KEY);
            let storedDark = localStorage.getItem(DARK_MODE_KEY);
            
            if (storedTheme) currentTheme = storedTheme;
            if (storedDark !== null) currentDarkMode = storedDark === 'true';
        } catch (e) {
            console.warn('[ThemeManager] load error:', e);
        }
        apply(currentTheme, currentDarkMode);
    }

    function setTheme(theme) {
        console.log('[ThemeManager] setTheme:', theme);
        if (!theme) return;
        currentTheme = theme;
        apply(currentTheme, currentDarkMode);
    }

    function setDarkMode(enabled) {
        console.log('[ThemeManager] setDarkMode:', enabled);
        currentDarkMode = enabled;
        apply(currentTheme, currentDarkMode);
    }

    function toggleDarkMode() {
        setDarkMode(!currentDarkMode);
        return !currentDarkMode;
    }

    function getTheme() { return currentTheme; }
    function isDarkMode() { return currentDarkMode; }

    return { load, setTheme, setDarkMode, toggleDarkMode, getTheme, isDarkMode };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.load());
} else {
    ThemeManager.load();
}