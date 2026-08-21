/* ==================== STORE (Unified State Manager) ==================== */
/**
 * Unified state management with localStorage persistence
 * No external dependencies, works as a standalone module.
 * 
 * Features:
 * - Set/get/remove/clear with automatic localStorage sync
 * - Subscribe to changes on specific keys
 * - Batch updates
 * - Automatic initialization from localStorage
 * - Error handling with fallback
 * - Handles QuotaExceededError and SecurityError (private mode)
 * - Memory fallback when localStorage is unavailable
 */

(function(global) {
    'use strict';

    const STORE_PREFIX = ''; // يمكن إضافة بادئة إذا أردت

    class StoreManager {
        constructor() {
            this._state = {};
            this._listeners = {};
            this._initialized = false;
            this._memoryFallback = false;      // هل نستخدم الذاكرة بدلاً من localStorage؟
            this._storageFailed = false;       // هل فشلت محاولة localStorage؟
        }

        /**
         * دالة مساعدة آمنة للوصول إلى ErrorHandler
         */
        _safeErrorHandler(error, context) {
            if (global.ErrorHandler && typeof global.ErrorHandler.log === 'function') {
                global.ErrorHandler.log(error, context);
            } else if (typeof console !== 'undefined' && console.error) {
                console.error(`[Store] ${context}:`, error);
            }
        }

        /**
         * دالة مساعدة آمنة لتحليل JSON مع التعامل مع النصوص الخام
         * @param {string} raw - القيمة الخام من localStorage
         * @param {string} key - اسم المفتاح (للتسجيل فقط)
         * @returns {any}
         */
        _safeParse(raw, key) {
            if (raw === null || raw === undefined) return null;
            if (typeof raw !== 'string') return raw;
            
            try {
                return JSON.parse(raw);
            } catch (e) {
                // القيمة ليست JSON صالحاً (مثل "blue-gold" بدلاً من '"blue-gold"')
                // نستخدم القيمة الخام كنص، ونقوم بترحيلها تلقائياً إلى JSON صحيح
                console.warn(`[Store] Key "${key}" had invalid JSON, using raw value and migrating:`, raw);
                // ترحيل إلى JSON صحيح لتجنب الأخطاء المستقبلية
                try {
                    const correctJson = JSON.stringify(raw);
                    localStorage.setItem(key, correctJson);
                } catch (migrateErr) {}
                return raw;
            }
        }

        /**
         * دالة مساعدة للتعامل مع أخطاء التخزين
         */
        _handleStorageError(e, operation, key) {
            if (e.name === 'QuotaExceededError') {
                console.warn(`[Store] QuotaExceededError on ${operation} for key "${key}"`);
                this._showQuotaWarning();
                this._memoryFallback = true;
                return true; // تم التعامل مع الخطأ
            } else if (e.name === 'SecurityError') {
                console.warn(`[Store] SecurityError (private mode) on ${operation} for key "${key}"`);
                this._memoryFallback = true;
                return true;
            }
            return false; // خطأ آخر
        }

        /**
         * عرض تحذير للمستخدم عند امتلاء التخزين
         */
        _showQuotaWarning() {
            try {
                if (global.UI && typeof global.UI.showToast === 'function') {
                    global.UI.showToast('⚠️ مساحة التخزين ممتلئة، سيتم استخدام الذاكرة المؤقتة', '⚠️', 'warning');
                } else if (typeof alert === 'function') {
                    alert('⚠️ مساحة التخزين ممتلئة، سيتم استخدام الذاكرة المؤقتة');
                }
            } catch (e) {}
        }

        /**
         * محاولة الكتابة إلى localStorage مع fallback إلى الذاكرة
         * @returns {boolean} true إذا تم الحفظ بنجاح في localStorage، false إذا تم استخدام الذاكرة
         */
        _trySetItem(key, value) {
            if (this._storageFailed) return false;
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                const handled = this._handleStorageError(e, 'setItem', key);
                if (handled) {
                    this._storageFailed = true;
                    this._memoryFallback = true;
                    return false;
                }
                // خطأ غير متوقع
                this._safeErrorHandler(e, `store.setItem (${key})`);
                this._memoryFallback = true;
                return false;
            }
        }

        /**
         * محاولة القراءة من localStorage مع fallback إلى الذاكرة
         */
        _tryGetItem(key) {
            if (this._storageFailed) return null;
            try {
                return localStorage.getItem(key);
            } catch (e) {
                const handled = this._handleStorageError(e, 'getItem', key);
                if (handled) {
                    this._storageFailed = true;
                    this._memoryFallback = true;
                    return null;
                }
                this._safeErrorHandler(e, `store.getItem (${key})`);
                return null;
            }
        }

        /**
         * محاولة حذف من localStorage
         */
        _tryRemoveItem(key) {
            if (this._storageFailed) return false;
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                const handled = this._handleStorageError(e, 'removeItem', key);
                if (handled) {
                    this._storageFailed = true;
                    this._memoryFallback = true;
                    return false;
                }
                this._safeErrorHandler(e, `store.removeItem (${key})`);
                return false;
            }
        }

        /**
         * محاولة مسح localStorage بالكامل
         */
        _tryClear() {
            if (this._storageFailed) return false;
            try {
                localStorage.clear();
                return true;
            } catch (e) {
                const handled = this._handleStorageError(e, 'clear', 'all');
                if (handled) {
                    this._storageFailed = true;
                    this._memoryFallback = true;
                    return false;
                }
                this._safeErrorHandler(e, 'store.clear');
                return false;
            }
        }

        /**
         * Initialize store by loading all keys from localStorage (with fallback)
         */
        init() {
            if (this._initialized) return;
            this._initialized = true;
            
            if (this._storageFailed) {
                console.warn('[Store] Storage failed previously, using memory only');
                return;
            }

            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && !key.startsWith('_store_')) {
                        try {
                            const raw = localStorage.getItem(key);
                            if (raw !== null) {
                                // استخدم الدالة الآمنة للتحليل بدلاً من JSON.parse المباشر
                                this._state[key] = this._safeParse(raw, key);
                            }
                        } catch (parseErr) {
                            console.warn(`[Store] Failed to parse key "${key}":`, parseErr);
                        }
                    }
                }
            } catch (e) {
                const handled = this._handleStorageError(e, 'init', 'all');
                if (!handled) {
                    console.warn('[Store] Failed to read from localStorage:', e);
                }
                this._memoryFallback = true;
            }
        }

        /**
         * Set a value for a key, save to localStorage (or memory fallback), and notify listeners
         * @param {string} key
         * @param {any} value
         * @returns {StoreManager} this for chaining
         */
        set(key, value) {
            try {
                // تحديث الحالة الداخلية دائماً
                this._state[key] = value;
                
                // محاولة الحفظ في localStorage (إذا لم يكن fallback مفعلاً)
                if (!this._memoryFallback) {
                    const serialized = JSON.stringify(value);
                    this._trySetItem(key, serialized);
                }
                
                // إشعار المستمعين
                this._notify(key, value);
            } catch (e) {
                // في حالة حدوث خطأ غير متوقع، نستخدم الذاكرة كبديل
                this._safeErrorHandler(e, `store.set (${key})`);
                this._memoryFallback = true;
            }
            return this;
        }

        /**
         * Get a value by key (from memory state first, then localStorage if needed)
         * @param {string} key
         * @param {any} fallback - value to return if key not found
         * @returns {any}
         */
        get(key, fallback = null) {
            // إذا كان المفتاح موجوداً في الحالة الداخلية
            if (this._state.hasOwnProperty(key)) {
                return this._state[key];
            }
            
            // إذا لم نستخدم fallback للذاكرة، نحاول القراءة من localStorage مباشرة
            if (!this._memoryFallback) {
                try {
                    const raw = this._tryGetItem(key);
                    if (raw !== null) {
                        // استخدم الدالة الآمنة للتحليل
                        const parsed = this._safeParse(raw, key);
                        this._state[key] = parsed;
                        return parsed;
                    }
                } catch (e) {
                    this._safeErrorHandler(e, `store.get (${key})`);
                }
            }
            return fallback;
        }

        /**
         * Remove a key from store and localStorage (or memory)
         * @param {string} key
         * @returns {StoreManager}
         */
        remove(key) {
            try {
                delete this._state[key];
                if (!this._memoryFallback) {
                    this._tryRemoveItem(key);
                }
                this._notify(key, undefined);
            } catch (e) {
                this._safeErrorHandler(e, `store.remove (${key})`);
            }
            return this;
        }

        /**
         * Clear all keys from store and localStorage (or memory)
         * @returns {StoreManager}
         */
        clear() {
            try {
                const keysToNotify = Object.keys(this._state);
                this._state = {};
                if (!this._memoryFallback) {
                    this._tryClear();
                }
                keysToNotify.forEach(key => this._notify(key, undefined));
            } catch (e) {
                this._safeErrorHandler(e, 'store.clear');
            }
            return this;
        }

        /**
         * Subscribe to changes on a specific key
         * @param {string} key
         * @param {function} callback - function(newValue, key)
         * @returns {function} unsubscribe function
         */
        subscribe(key, callback) {
            if (!this._listeners[key]) {
                this._listeners[key] = [];
            }
            this._listeners[key].push(callback);
            // Return unsubscribe function
            return () => {
                const listeners = this._listeners[key];
                if (listeners) {
                    const index = listeners.indexOf(callback);
                    if (index !== -1) listeners.splice(index, 1);
                    if (listeners.length === 0) delete this._listeners[key];
                }
            };
        }

        /**
         * Internal: notify all subscribers of a key
         * @private
         */
        _notify(key, value) {
            const listeners = this._listeners[key];
            if (listeners && listeners.length) {
                const listenersCopy = [...listeners];
                for (const cb of listenersCopy) {
                    try {
                        cb(value, key);
                    } catch (e) {
                        this._safeErrorHandler(e, `store.subscriber (${key})`);
                    }
                }
            }
        }

        /**
         * Perform multiple set operations in one batch
         * @param {object} updates - object containing key-value pairs
         * @returns {StoreManager}
         */
        batch(updates) {
            for (const [key, value] of Object.entries(updates)) {
                this.set(key, value);
            }
            return this;
        }

        /**
         * Get all current state as a plain object (shallow copy)
         * @returns {object}
         */
        getAll() {
            return { ...this._state };
        }

        /**
         * Check if a key exists (in memory or localStorage)
         * @param {string} key
         * @returns {boolean}
         */
        has(key) {
            if (this._state.hasOwnProperty(key)) return true;
            if (!this._memoryFallback) {
                const raw = this._tryGetItem(key);
                return raw !== null;
            }
            return false;
        }

        /**
         * Check if storage is using memory fallback
         * @returns {boolean}
         */
        isUsingMemoryFallback() {
            return this._memoryFallback;
        }
    }

    // إنشاء نسخة واحدة (Singleton) وتعريضها للنطاق العام
    const storeInstance = new StoreManager();
    
    // التهيئة التلقائية عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => storeInstance.init());
    } else {
        storeInstance.init();
    }

    // تعريض الكائن العام
    global.Store = storeInstance;

    // للتوافق مع الكود القديم (إن وجد) - إضافة المراجع السريعة
    global.Store.set = storeInstance.set.bind(storeInstance);
    global.Store.get = storeInstance.get.bind(storeInstance);
    global.Store.remove = storeInstance.remove.bind(storeInstance);
    global.Store.clear = storeInstance.clear.bind(storeInstance);
    global.Store.subscribe = storeInstance.subscribe.bind(storeInstance);
    global.Store.batch = storeInstance.batch.bind(storeInstance);
    global.Store.getAll = storeInstance.getAll.bind(storeInstance);
    global.Store.has = storeInstance.has.bind(storeInstance);
    global.Store.isUsingMemoryFallback = storeInstance.isUsingMemoryFallback.bind(storeInstance);

    console.log('[Store] Unified Store Manager initialized (with fallback & error handling)');
})(window);