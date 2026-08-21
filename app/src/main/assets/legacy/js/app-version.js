// ==================== APP-VERSION.JS ====================
window.AppVersion = (function() {
    'use strict';

    const STORAGE_KEY = 'appVersion';
    const CURRENT_VERSION = 3;

    function safeStore() {
        if (typeof Store !== 'undefined' && Store && typeof Store.get === 'function' && typeof Store.set === 'function') {
            return Store;
        }
        return null;
    }

    return {
        current: CURRENT_VERSION,

        init() {
            const store = safeStore();
            let saved = 1;
            if (store) {
                saved = Number(store.get(STORAGE_KEY, 1));
            } else {
                try {
                    saved = Number(localStorage.getItem(STORAGE_KEY)) || 1;
                } catch (e) {}
            }
            if (saved < this.current) {
                this.migrate(saved, this.current);
            }
            if (store) {
                store.set(STORAGE_KEY, this.current);
            } else {
                try {
                    localStorage.setItem(STORAGE_KEY, this.current);
                } catch (e) {}
            }
        },

        migrate(from, to) {
            console.log(`[AppVersion] Migration ${from} -> ${to}`);
        }
    };
})();
