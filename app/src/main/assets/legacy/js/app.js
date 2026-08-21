/**
 * المنصة التعليمية الذكية - نقطة الدخول الرئيسية (مُعالَج)
 */
if (window.__APP_INITIALIZED__) {
    console.warn('⚠️ التطبيق مهيأ مسبقاً - تم منع إعادة التهيئة');
} else {
    window.__APP_INITIALIZED__ = true;
}

(function(global) {
    'use strict';

    const App = {
        state: {
            initialized: false,
            ready: false,
            error: null,
            initTime: null,
            version: '3.0.0',
            buildDate: '2025-06-02'
        },

        environment: {
            isOnline: navigator.onLine,
            isMobile: /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent),
            isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
            isAndroid: /Android/i.test(navigator.userAgent),
            hasIndexedDB: !!window.indexedDB,
            hasSpeechSynthesis: !!window.speechSynthesis,
            hasWebAudio: !!(window.AudioContext || window.webkitAudioContext),
            userAgent: navigator.userAgent,
            language: navigator.language || 'ar',
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight
        },

        async init() {
            if (this.state.initialized) {
                console.log('ℹ️ التطبيق مهيأ مسبقاً');
                return;
            }

            this.state.initialized = true;
            this.state.initTime = Date.now();

            console.log('🚀 بدء تهيئة المنصة التعليمية الذكية...');
            console.log(`📦 الإصدار: ${this.state.version}`);

            try {
                await this.checkEnvironment();
                await this.loadSettings();
                this.applyInitialSettings();
                this.bindGlobalEvents();
                await this.startUIWithDelay();
                this.state.ready = true;
                const loadTime = Date.now() - this.state.initTime;
                console.log(`✅ التطبيق جاهز للاستخدام (${loadTime}ms)`);
            } catch (error) {
                console.error('❌ خطأ في تهيئة التطبيق:', error);
                this.state.error = error;
                this.handleInitError(error);
            }
        },

        async checkEnvironment() {
            console.log('🔍 فحص بيئة التشغيل...');
            if (!this.environment.hasIndexedDB) console.warn('⚠️ IndexedDB غير مدعوم');
            if (!this.environment.hasSpeechSynthesis) console.warn('⚠️ Speech Synthesis غير مدعوم');
            if (!this.environment.hasWebAudio) console.warn('⚠️ Web Audio API غير مدعوم');
            try {
                localStorage.setItem('__test__', '1');
                localStorage.removeItem('__test__');
            } catch (e) { console.warn('⚠️ localStorage غير متاح'); }
            this.environment.screenWidth = window.innerWidth;
            this.environment.screenHeight = window.innerHeight;
            console.log(`📐 أبعاد الشاشة: ${this.environment.screenWidth}x${this.environment.screenHeight}`);
        },

        async loadSettings() {
            console.log('⚙️ تحميل الإعدادات المحفوظة...');
            try {
                if (typeof Settings !== 'undefined' && typeof Settings.load === 'function') {
                    await Settings.load();
                    console.log('✅ الإعدادات محملة بنجاح');
                }
            } catch (e) {
                console.warn('⚠️ خطأ في تحميل الإعدادات:', e.message);
            }
        },

        applyInitialSettings() {
            console.log('🎨 تطبيق الإعدادات الأولية...');
            try {
                const settings = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : {};

                // Dark mode
                if (settings.darkMode !== undefined) {
                    this.applyDarkMode(settings.darkMode);
                } else {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    this.applyDarkMode(prefersDark);
                }

                // Theme
                if (settings.theme) {
                    this.applyTheme(settings.theme);
                } else {
                    this.applyTheme('forest-gold');
                }

                // Language
                if (settings.language) {
                    this.applyLanguage(settings.language);
                } else {
                    const navLang = navigator.language || 'ar';
                    this.applyLanguage(navLang.startsWith('ar') ? 'ar' : 'en');
                }

                // Sound
                if (settings.muteSound && typeof AudioManager !== 'undefined') {
                    AudioManager.setMute(true);
                }

                console.log('✅ الإعدادات الأولية مطبقة');
            } catch (e) {
                console.warn('⚠️ خطأ في تطبيق الإعدادات الأولية:', e.message);
            }
        },

        applyLanguage(lang) {
            if (lang === 'en') {
                document.documentElement.dir = 'ltr';
                document.documentElement.lang = 'en';
                document.body.style.direction = 'ltr';
            } else {
                document.documentElement.dir = 'rtl';
                document.documentElement.lang = 'ar';
                document.body.style.direction = 'rtl';
            }
            if (typeof I18n !== 'undefined' && I18n.setLanguage) {
                I18n.setLanguage(lang);
            }
            try { localStorage.setItem('app_language', lang); } catch (e) {}
        },

        applyTheme(themeName) {
            if (typeof ThemeManager !== 'undefined' && ThemeManager.setTheme) {
                ThemeManager.setTheme(themeName);
            } else {
                document.body.setAttribute('data-theme', themeName);
                document.documentElement.setAttribute('data-theme', themeName);
            }
            try { localStorage.setItem('app_theme', themeName); } catch (e) {}
        },

        applyDarkMode(enable) {
            if (typeof ThemeManager !== 'undefined' && ThemeManager.setDarkMode) {
                ThemeManager.setDarkMode(enable);
            } else {
                document.body.classList.toggle('dark', enable);
                document.body.classList.toggle('light', !enable);
            }
        },

        async startUIWithDelay() {
            console.log('🖥️ تجهيز واجهة المستخدم...');
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve, { once: true });
                });
            }
            await this.delay(300);
            try {
                if (typeof UI !== 'undefined' && typeof UI.init === 'function') {
                    await UI.init();
                    console.log('✅ واجهة المستخدم مهيأة');
                }
                if (typeof XPSystem !== 'undefined' && typeof XPSystem.init === 'function') {
                    await XPSystem.init();
                    console.log('✅ نظام XP مهيأ');
                }
                if (typeof AudioManager !== 'undefined' && typeof AudioManager.init === 'function') {
                    AudioManager.init();
                    console.log('✅ مدير الصوتيات مهيأ');
                }
                await this.startApplication();
            } catch (e) {
                console.error('❌ خطأ في تهيئة واجهة المستخدم:', e);
                throw e;
            }
        },

        async startApplication() {
            console.log('🎯 بدء تشغيل التطبيق...');
            const appContainer = document.getElementById('app-container');
            const homeScreen = document.getElementById('home-screen');
            if (homeScreen) homeScreen.classList.remove('hidden');
            if (appContainer) appContainer.classList.add('hidden');
            this.onAppReady();
        },

        onAppReady() {
            console.log('✅ التطبيق جاهز للاستخدام');
            this.showFirstTimeTips();
            this.updatePlayerInfo();
            this.updateQuestionCount();
            if (typeof AudioManager !== 'undefined' && !AudioManager.isMuted) {
                setTimeout(() => { try { AudioManager.play('button_click', 0.3); } catch(e) {} }, 500);
            }
            if (typeof Achievements !== 'undefined' && typeof Achievements.render === 'function') {
                setTimeout(() => { try { Achievements.render('achievements-list'); } catch(e) {} }, 1000);
            }
        },

        async updateQuestionCount() {
            try {
                if (typeof DB !== 'undefined' && DB.questions) {
                    const count = await DB.questions.count();
                    const badge = document.getElementById('question-count-badge');
                    const bankCount = document.getElementById('bank-questions-count');
                    if (badge) badge.textContent = count || 0;
                    if (bankCount) bankCount.textContent = count || 0;
                }
            } catch (e) {}
        },

        async updatePlayerInfo() {
            try {
                if (typeof XPSystem !== 'undefined') {
                    const progress = await XPSystem.getProgress();
                    if (progress && progress.levelInfo) {
                        const levelDisplay = document.getElementById('level-display');
                        if (levelDisplay) {
                            const badge = document.getElementById('question-count-badge');
                            const currentBadgeText = badge ? badge.textContent : '0';
                            levelDisplay.innerHTML = `${progress.levelInfo.icon} ${progress.levelInfo.name} <span id="question-count-badge" style="margin-right: 5px;">${currentBadgeText}</span>`;
                        }
                    }
                }
            } catch (e) {}
        },

        showFirstTimeTips() {
            try {
                const hasVisited = localStorage.getItem('smart_platform_visited');
                if (!hasVisited) {
                    setTimeout(() => this.showWelcomeTooltip(), 1500);
                    localStorage.setItem('smart_platform_visited', 'true');
                }
            } catch (e) {}
        },

        showWelcomeTooltip() {
            const lang = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data.language : 'ar';
            const isAr = lang === 'ar';
            const tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: fixed;
                bottom: 120px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.92);
                color: var(--gold);
                padding: 15px 25px;
                border-radius: 30px;
                border: 1px solid var(--gold);
                z-index: 9998;
                font-weight: 700;
                text-align: center;
                animation: fadeInUp 0.5s ease;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                max-width: 90%;
                font-size: 0.95rem;
                line-height: 1.6;
                pointer-events: auto;
            `;
            tooltip.innerHTML = isAr ? `
                <div style="font-size: 1.5rem; margin-bottom: 8px;">👋 أهلاً بك في المنصة!</div>
                <div>⚙️ ابدأ بإضافة أسئلتك من <span style="color: #fff;">إدارة الأسئلة</span></div>
                <div>🔄 ثم اختر <span style="color: #fff;">تحدي سريع</span> أو <span style="color: #fff;">📝 اختبر معلوماتك</span></div>
                <div style="font-size: 0.8rem; margin-top: 8px; opacity: 0.7;">اضغط للمتابعة</div>
            ` : `
                <div style="font-size: 1.5rem; margin-bottom: 8px;">👋 Welcome!</div>
                <div>⚙️ Start by adding questions from <span style="color: #fff;">Manage Questions</span></div>
                <div>🔄 Then choose <span style="color: #fff;">Quick Challenge</span> or <span style="color: #fff;">Test Your Knowledge</span></div>
                <div style="font-size: 0.8rem; margin-top: 8px; opacity: 0.7;">Tap to continue</div>
            `;
            document.body.appendChild(tooltip);
            const hideTooltip = () => {
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.3s ease';
                setTimeout(() => { if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip); }, 300);
            };
            tooltip.addEventListener('click', hideTooltip);
            setTimeout(hideTooltip, 7000);
        },

        bindGlobalEvents() {
            console.log('🔗 ربط الأحداث العامة...');
            document.addEventListener('keydown', (e) => {
                if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
                    e.preventDefault();
                    console.log('🛑 تم منع تحديث الصفحة');
                }
            });
            document.addEventListener('contextmenu', (e) => { e.preventDefault(); });
            const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeMediaQuery.addEventListener('change', (e) => {
                const settings = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : {};
                if (!settings.hasOwnProperty('darkMode') || settings.darkMode === undefined) {
                    this.applyDarkMode(e.matches);
                }
            });
            window.addEventListener('online', () => { this.environment.isOnline = true; });
            window.addEventListener('offline', () => { this.environment.isOnline = false; });
            window.addEventListener('beforeunload', () => {
                if (typeof Settings !== 'undefined' && typeof Settings.save === 'function') {
                    try { Settings.save(); } catch (e) {}
                }
            });
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.environment.screenWidth = window.innerWidth;
                    this.environment.screenHeight = window.innerHeight;
                }, 250);
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeAllModals();
            });
            console.log('✅ الأحداث العامة مربوطة');
        },

        closeAllModals() {
            const modals = document.querySelectorAll('.modal.active');
            modals.forEach(modal => modal.classList.remove('active'));
            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();
        },

        handleInitError(error) {
            console.error('❌ فشل في تهيئة التطبيق:', error);
            const homeScreen = document.getElementById('home-screen');
            const appContainer = document.getElementById('app-container');
            if (homeScreen) {
                homeScreen.classList.remove('hidden');
                if (appContainer) appContainer.classList.add('hidden');
            }
        },

        delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },
        getAppInfo() { return { version: this.state.version, buildDate: this.state.buildDate, ready: this.state.ready, environment: this.environment }; },
        restart() {
            console.log('🔄 إعادة تشغيل التطبيق...');
            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();
            if (typeof Game !== 'undefined') Game.quitGame?.();
            this.state.initialized = false;
            this.state.ready = false;
            window.__APP_INITIALIZED__ = false;
            this.init();
        },
        async clearAllData() {
            const isAr = (typeof Settings !== 'undefined' && Settings.data && Settings.data.language === 'ar');
            if (confirm(isAr ? '⚠️ هل أنت متأكد من مسح جميع البيانات؟' : '⚠️ Are you sure?')) {
                try {
                    if (typeof DB !== 'undefined') {
                        const tables = ['questions', 'categories', 'achievements', 'gameHistory', 'reviewHistory', 'xp', 'playerStats'];
                        for (const table of tables) {
                            if (DB[table] && typeof DB[table].clear === 'function') await DB[table].clear();
                        }
                    }
                    localStorage.clear();
                    alert(isAr ? '✅ تم مسح جميع البيانات. سيتم إعادة التحميل.' : '✅ All data cleared. Reloading...');
                    location.reload();
                } catch (e) {
                    alert((isAr ? '❌ حدث خطأ: ' : '❌ Error: ') + e.message);
                }
            }
        }
    };

    async function startApp() {
        const appContainer = document.getElementById('app-container');
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen) homeScreen.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        await App.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

    global.App = App;
    global.restartApp = () => App.restart();
    global.clearAllData = () => App.clearAllData();
    global.getAppInfo = () => App.getAppInfo();

    console.log('📋 المنصة التعليمية الذكية - الملف الرئيسي محمل وجاهز (v3.0)');

})(window);