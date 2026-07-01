/**
 * splash.js - Splash Screen Handler (نسخة متكاملة ومُعالجة)
 * 
 * الوظائف:
 * - عرض شاشة الترحيب مع الرسوم المتحركة.
 * - إخفاء الشاشة تلقائياً بعد مدة محددة (9 ثوانٍ).
 * - إخفاء الشاشة عند النقر المزدوج (تخطي سريع).
 * - تخزين حالة "تم التخطي" في Store API لتجنب إظهار الشاشة مرة أخرى في الجلسات القادمة.
 * - إطلاق حدث مخصص عند إخفاء الشاشة ليتكامل مع باقي التطبيق.
 * - معالجة التعارض مع app.js.
 * - تنظيف المستمعات بشكل صحيح.
 */

(function() {
    'use strict';

    // ========== الإعدادات ==========
    const SPLASH_DURATION = 9000;
    const STORAGE_KEY = 'splash_skipped';
    let splashFinished = false;
    let hideTimeout = null;

    // مراجع المستمعات للإزالة
    let doubleClickListener = null;
    let touchEndListener = null;
    let popStateListener = null;

    // الحصول على عناصر DOM
    const splashScreen = document.getElementById('splash-screen');
    const appContainer = document.getElementById('app-container');

    // ========== دالة مساعدة آمنة للوصول إلى Store ==========
    function safeStore() {
        return (typeof Store !== 'undefined' && Store && typeof Store.get === 'function' && typeof Store.set === 'function') ? Store : null;
    }

    // ========== دالة تخزين حالة التخطي باستخدام Store API ==========
    function setSplashSkipped() {
        const store = safeStore();
        if (store) {
            store.set(STORAGE_KEY, true);
        } else {
            // Fallback آمن باستخدام localStorage
            try {
                localStorage.setItem(STORAGE_KEY, 'true');
            } catch (e) {
                console.warn('[Splash] Failed to save to localStorage:', e);
            }
        }
    }

    // ========== التحقق مما إذا تم تخطي الشاشة من قبل ==========
    function wasSplashSkipped() {
        const store = safeStore();
        if (store) {
            return store.get(STORAGE_KEY, false) === true;
        } else {
            try {
                return localStorage.getItem(STORAGE_KEY) === 'true';
            } catch (e) {
                return false;
            }
        }
    }

    // ========== إزالة جميع المستمعات ==========
    function removeAllListeners() {
        if (splashScreen) {
            if (doubleClickListener) {
                splashScreen.removeEventListener('dblclick', doubleClickListener);
                doubleClickListener = null;
            }
            if (touchEndListener) {
                splashScreen.removeEventListener('touchend', touchEndListener);
                touchEndListener = null;
            }
        }
        if (popStateListener && typeof window !== 'undefined') {
            window.removeEventListener('popstate', popStateListener);
            popStateListener = null;
        }
    }

    // ========== دالة إخفاء الشاشة ==========
    function hideSplash() {
        if (splashFinished) return;
        splashFinished = true;

        // إلغاء المهلة إذا كانت موجودة
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        // إزالة المستمعات بعد الإخفاء
        removeAllListeners();

        // إخفاء شاشة الترحيب
        if (splashScreen && splashScreen.parentNode) {
            splashScreen.classList.add('hide');
            setTimeout(() => {
                if (splashScreen && splashScreen.parentNode) {
                    splashScreen.remove();
                }
            }, 600);
        }

        // إظهار حاوية التطبيق إذا كانت موجودة
        if (appContainer && typeof appContainer.classList !== 'undefined') {
            appContainer.classList.remove('hidden');
        }

        // تخزين حالة التخطي
        setSplashSkipped();

        // إطلاق حدث مخصص لإعلام باقي أجزاء التطبيق
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('splash-hidden', { detail: { timestamp: Date.now() } });
            window.dispatchEvent(event);
        }
    }

    // ========== دالة تخطي يدوي (النقر المزدوج) ==========
    function setupSkipListeners() {
        if (!splashScreen) return;

        // النقر المزدوج بالفأرة
        doubleClickListener = function(e) {
            e.preventDefault();
            hideSplash();
        };
        splashScreen.addEventListener('dblclick', doubleClickListener);

        // اللمس المزدوج على الأجهزة اللوحية
        let lastTap = 0;
        touchEndListener = function(e) {
            const now = Date.now();
            if (now - lastTap < 300) {
                e.preventDefault();
                hideSplash();
            }
            lastTap = now;
        };
        splashScreen.addEventListener('touchend', touchEndListener);
    }

    // ========== تهيئة شاشة الترحيب ==========
    function initSplash() {
        // إذا تم تخطي الشاشة سابقاً، اخفها فوراً ولا تظهر
        if (wasSplashSkipped()) {
            hideSplash();
            return;
        }

        // التأكد من أن شاشة الترحيب مرئية والتطبيق مخفي
        if (splashScreen && typeof splashScreen.classList !== 'undefined') {
            splashScreen.classList.remove('hide');
        }
        if (appContainer && typeof appContainer.classList !== 'undefined') {
            appContainer.classList.add('hidden');
        }

        // إعداد مستمعي التخطي
        setupSkipListeners();

        // إخفاء تلقائي بعد المدة المحددة
        hideTimeout = setTimeout(hideSplash, SPLASH_DURATION);
    }

    // بدء التهيئة عند تحميل الصفحة بالكامل (مرة واحدة فقط)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSplash);
    } else {
        initSplash();
    }

    // منع زر الرجوع من العودة إلى شاشة الترحيب بعد إخفائها (مع إمكانية الإزالة)
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
        window.history.pushState(null, '', window.location.href);
        popStateListener = function() {
            if (splashFinished) {
                window.history.pushState(null, '', window.location.href);
            }
        };
        window.addEventListener('popstate', popStateListener);
    }
})();
