/* المنصة التعليمية الذكية - طبقة قاعدة البيانات (مُعالَج بالكامل) */
window.DB = window.DB || {};
window.Settings = window.Settings || {};
window.XPSystem = window.XPSystem || {};
window.CategoryManager = window.CategoryManager || {};
window.PlayerStatsManager = window.PlayerStatsManager || {};
window.DataManager = window.DataManager || {};
window.QuestionParser = window.QuestionParser || {};
window.DBBackup = window.DBBackup || {};

(function(global) {
    'use strict';

    const DEFAULT_SETTINGS = {
        timePerQuestion: 15, questionCount: 10, maxWrong: 3, testDuration: 30,
        muteSound: false, darkMode: true, language: 'ar', theme: 'blue-gold',
        pauseCount: 5, playerName: '', playerAvatar: '', apiKey: '',
        difficulty: 'beginner', fromUnit: 1, toUnit: 10, fromLesson: 1, toLesson: 20,
        questionDifficulty: 'B', deviceName: 'Device-' + Math.floor(Math.random() * 9999)
    };

    const XP_LEVELS = [
        { level: 1, name: 'مبتدئ', nameEn: 'Beginner', xpNeeded: 0, icon: '🌱' },
        { level: 2, name: 'طالب', nameEn: 'Student', xpNeeded: 100, icon: '📚' },
        { level: 3, name: 'محترف', nameEn: 'Professional', xpNeeded: 300, icon: '⭐' },
        { level: 4, name: 'خبير', nameEn: 'Expert', xpNeeded: 600, icon: '🌟' },
        { level: 5, name: 'عبقري', nameEn: 'Genius', xpNeeded: 1000, icon: '👑' },
        { level: 6, name: 'أسطورة', nameEn: 'Legend', xpNeeded: 2000, icon: '🏆' }
    ];

    const DEFAULT_STATS = {
        totalQuestions: 0, totalCategories: 0, totalChallenges: 0, totalTests: 0,
        perfectScores: 0, totalStars: 0, totalScore: 0, totalCorrect: 0, totalWrong: 0,
        rounds: 0, perfectRounds: 0, fastAnswers: 0, bestStreak: 0, nightPlay: false, earlyPlay: false
    };

    let db = null;
    let useMemoryFallback = false;
    let dbReady = false;

    function safeStore() {
        return (typeof Store !== 'undefined' && Store && typeof Store.get === 'function') ? Store : null;
    }

    // ========== Memory Fallback ==========
    function setupMemoryFallback() {
        console.warn('⚠️ Memory fallback active');
        useMemoryFallback = true;
        const memoryStore = new Map();
        const _data = { questions: [], settings: [], categories: [], achievements: [], xp: [], gameHistory: [], reviewHistory: [], playerStats: [] };

        function createMemoryTable(store, tableName, arrayRef) {
            const prefix = tableName + '_';
            return {
                async get(id) {
                    const key = prefix + (typeof id === 'object' ? JSON.stringify(id) : id);
                    return store.get(key) || null;
                },
                async put(item) {
                    const key = prefix + (item.id || item.key || Date.now());
                    store.set(key, { ...item, _table: tableName });
                    const idx = arrayRef.findIndex(i => (i.id || i.key) === (item.id || item.key));
                    if (idx >= 0) arrayRef[idx] = item; else arrayRef.push(item);
                    return key;
                },
                async add(item) {
                    const id = Date.now() + Math.random();
                    const key = prefix + id;
                    const newItem = { ...item, id, _table: tableName };
                    store.set(key, newItem);
                    arrayRef.push(newItem);
                    return id;
                },
                async bulkAdd(items) {
                    for (const item of items) {
                        const id = Date.now() + Math.random();
                        const key = prefix + id;
                        store.set(key, { ...item, id, _table: tableName });
                        arrayRef.push({ ...item, id });
                    }
                },
                async delete(id) {
                    const key = prefix + id;
                    store.delete(key);
                    const idx = arrayRef.findIndex(i => i.id === id || i.key === id);
                    if (idx >= 0) arrayRef.splice(idx, 1);
                },
                async clear() {
                    arrayRef.length = 0;
                    for (const key of Array.from(store.keys())) {
                        if (key.startsWith(prefix)) store.delete(key);
                    }
                },
                async toArray() { return [...arrayRef]; },
                async toCollection() {
                    return {
                        async toArray() { return [...arrayRef]; },
                        async first() { return arrayRef[0] || null; },
                        async count() { return arrayRef.length; },
                        async modify(fn) {
                            for (let i = 0; i < arrayRef.length; i++) {
                                fn(arrayRef[i]);
                                const key = prefix + arrayRef[i].id;
                                store.set(key, { ...arrayRef[i], _table: tableName });
                            }
                        }
                    };
                },
                async where(field) {
                    return {
                        equals(value) {
                            const filtered = arrayRef.filter(item => item[field] === value);
                            return {
                                async toArray() { return filtered; },
                                async first() { return filtered[0] || null; },
                                async count() { return filtered.length; },
                                async delete() {
                                    for (const item of filtered) {
                                        const key = prefix + item.id;
                                        store.delete(key);
                                        const idx = arrayRef.findIndex(i => i.id === item.id);
                                        if (idx >= 0) arrayRef.splice(idx, 1);
                                    }
                                }
                            };
                        },
                        // FIX: إضافة equalsIgnoreCase لمنع خطأ console
                        equalsIgnoreCase(value) {
                            const filtered = arrayRef.filter(item =>
                                String(item[field] || '').toLowerCase() === String(value || '').toLowerCase()
                            );
                            return {
                                async toArray() { return filtered; },
                                async first() { return filtered[0] || null; },
                                async count() { return filtered.length; }
                            };
                        }
                    };
                },
                async orderBy(field) {
                    return {
                        async reverse() {
                            return {
                                async toArray() {
                                    return [...arrayRef].sort((a, b) => (b[field] || 0) - (a[field] || 0));
                                },
                                async limit(n) {
                                    return {
                                        async toArray() {
                                            return [...arrayRef].sort((a, b) => (b[field] || 0) - (a[field] || 0)).slice(0, n);
                                        }
                                    };
                                }
                            };
                        },
                        async toArray() {
                            return [...arrayRef].sort((a, b) => (a[field] || 0) - (b[field] || 0));
                        },
                        async limit(n) {
                            return {
                                async toArray() {
                                    return [...arrayRef].sort((a, b) => (a[field] || 0) - (b[field] || 0)).slice(0, n);
                                }
                            };
                        }
                    };
                },
                async count() { return arrayRef.length; }
            };
        }

        global.DB = {
            _data, _ready: true,
            questions: createMemoryTable(memoryStore, 'questions', _data.questions),
            settings: createMemoryTable(memoryStore, 'settings', _data.settings),
            categories: createMemoryTable(memoryStore, 'categories', _data.categories),
            achievements: createMemoryTable(memoryStore, 'achievements', _data.achievements),
            xp: createMemoryTable(memoryStore, 'xp', _data.xp),
            gameHistory: createMemoryTable(memoryStore, 'gameHistory', _data.gameHistory),
            reviewHistory: createMemoryTable(memoryStore, 'reviewHistory', _data.reviewHistory),
            playerStats: createMemoryTable(memoryStore, 'playerStats', _data.playerStats)
        };
        dbReady = true;
    }

    setupMemoryFallback();

    async function initDexie() {
        if (typeof Dexie === 'undefined') {
            console.warn('Dexie not available, using memory fallback');
            return false;
        }
        const DB_NAME = 'SmartLearningDB_v4';
        try {
            db = new Dexie(DB_NAME);
            db.version(1).stores({
                questions: '++id, category, unit, lesson, difficulty, [category+unit+lesson], [category+order], order',
                settings: 'key',
                categories: '++id, &name',
                achievements: 'id, unlockedAt',
                xp: 'id',
                gameHistory: '++id, date, mode, score, correct, wrong, total',
                reviewHistory: '++id, questionId, timestamp, correct, mode',
                playerStats: 'key'
            });
            await db.open();
            global.DB = {
                _ready: true,
                questions: db.questions,
                settings: db.settings,
                categories: db.categories,
                achievements: db.achievements,
                xp: db.xp,
                gameHistory: db.gameHistory,
                reviewHistory: db.reviewHistory,
                playerStats: db.playerStats
            };
            useMemoryFallback = false;
            dbReady = true;
            console.log('✅ Dexie opened successfully v4');
            return true;
        } catch (openErr) {
            console.warn('⚠️ Dexie open failed:', openErr.message);
            try { await Dexie.delete(DB_NAME); } catch(e){}
            return false;
        }
    }

    // ========== Settings ==========
    const Settings = {
        data: { ...DEFAULT_SETTINGS },

        async load() {
            try {
                const saved = await global.DB.settings.get('game');
                if (saved && saved.value) {
                    this.data = { ...DEFAULT_SETTINGS, ...saved.value };
                }
                const store = safeStore();
                if (store) {
                    const storeSettings = store.get('smart_platform_settings');
                    if (storeSettings && typeof storeSettings === 'object') {
                        this.data = { ...this.data, ...storeSettings };
                    }
                }
            } catch (e) {
                console.warn('⚠️ خطأ في تحميل الإعدادات:', e);
                this.data = { ...DEFAULT_SETTINGS };
            }
            return this.data;
        },

        async save(skipSync) {
            try {
                if (!skipSync && this.syncFromUI) this.syncFromUI();
                await global.DB.settings.put({ key: 'game', value: { ...this.data } });
                const store = safeStore();
                if (store) store.set('smart_platform_settings', { ...this.data });
            } catch (e) {
                console.warn('⚠️ خطأ في حفظ الإعدادات:', e);
            }
        },

        syncFromUI() {
            try {
                const timeEl = document.getElementById('time-per-question-display');
                if (timeEl) this.data.timePerQuestion = parseInt(timeEl.textContent) || 15;
                const countEl = document.getElementById('question-count-display');
                if (countEl) this.data.questionCount = parseInt(countEl.textContent) || 10;
                const wrongEl = document.getElementById('max-wrong-select');
                if (wrongEl) this.data.maxWrong = parseInt(wrongEl.value) || 0;
                const durationEl = document.getElementById('test-duration-display');
                if (durationEl) this.data.testDuration = parseInt(durationEl.textContent) || 30;
                const muteCheck = document.getElementById('mute-sound-checkbox');
                if (muteCheck) this.data.muteSound = muteCheck.checked;
                const darkCheck = document.getElementById('dark-mode-checkbox');
                if (darkCheck) this.data.darkMode = darkCheck.checked;
                const langSelect = document.getElementById('language-select');
                if (langSelect) this.data.language = langSelect.value || 'ar';
                const themeSelect = document.getElementById('theme-select');
                if (themeSelect) this.data.theme = themeSelect.value || 'blue-gold';
                const activeDiff = document.querySelector('[data-difficulty].active');
                if (activeDiff) this.data.questionDifficulty = activeDiff.getAttribute('data-difficulty');
                const devName = document.getElementById('device-name-input');
                if (devName) this.data.deviceName = devName.value || this.data.deviceName;
            } catch (e) {}
        },

        get(key, defaultValue) {
            return this.data[key] !== undefined ? this.data[key] : defaultValue;
        },

        async set(key, value) {
            this.data[key] = value;
            await this.save();
        },

        async reset() {
            this.data = { ...DEFAULT_SETTINGS };
            await this.save();
        }
    };

    // ========== XP System ==========
    const XPSystem = {
        levels: XP_LEVELS,
        async init() {
            try {
                const current = await global.DB.xp.get('current');
                if (!current) {
                    await global.DB.xp.put({ id: 'current', total: 0, level: 1, currentXP: 0, lastUpdated: new Date().toISOString() });
                }
            } catch (e) { console.warn('⚠️ خطأ في تهيئة XP:', e); }
        },
        async addXP(amount) {
            try {
                let current = await global.DB.xp.get('current') || { id: 'current', total: 0, level: 1, currentXP: 0 };
                current.total += amount; current.currentXP += amount; current.lastUpdated = new Date().toISOString();
                let leveledUp = false, newLevel = current.level, remainingXP = current.currentXP;
                for (const level of this.levels) {
                    if (level.level > current.level && remainingXP >= level.xpNeeded) {
                        newLevel = level.level; remainingXP -= level.xpNeeded; leveledUp = true;
                    }
                }
                if (leveledUp) { current.level = newLevel; current.currentXP = remainingXP; }
                await global.DB.xp.put(current);
                return { ...current, leveledUp, levelInfo: this.getLevelInfo(current.level) };
            } catch (e) { return { level: 1, currentXP: 0, leveledUp: false }; }
        },
        getLevelInfo(levelNum) { return this.levels.find(l => l.level === levelNum) || this.levels[0]; },
        async getCurrentLevel() {
            try { const current = await global.DB.xp.get('current'); if (current) return this.getLevelInfo(current.level); }
            catch (e) {} return this.levels[0];
        },
        async getProgress() {
            try {
                const current = await global.DB.xp.get('current');
                if (!current) return { level: 1, currentXP: 0, nextLevelXP: 100, percentage: 0 };
                const currentLevel = this.getLevelInfo(current.level);
                const nextLevel = this.levels.find(l => l.level === current.level + 1);
                const nextLevelXP = nextLevel ? nextLevel.xpNeeded : currentLevel.xpNeeded * 2;
                return { level: current.level, currentXP: current.currentXP, nextLevelXP, percentage: Math.min(100, Math.round((current.currentXP / nextLevelXP) * 100)), total: current.total, levelInfo: currentLevel, nextLevelInfo: nextLevel || null };
            } catch (e) { return { level: 1, currentXP: 0, nextLevelXP: 100, percentage: 0 }; }
        }
    };

    // ========== Category Manager ==========
    const CategoryManager = {
        async getCategories() {
            try { return await global.DB.categories.toArray() || []; }
            catch (e) { console.warn('⚠️ خطأ في جلب التصنيفات:', e); return []; }
        },
        async addCategory(name) {
            if (!name || !name.trim()) return null;
            const trimmedName = name.trim();
            try {
                const exists = await global.DB.categories.where('name').equalsIgnoreCase(trimmedName).count();
                if (exists > 0) { console.warn('⚠️ تصنيف موجود مسبقاً:', trimmedName); return null; }
                const id = await global.DB.categories.add({ name: trimmedName, createdAt: new Date().toISOString() });
                await this.updateStats();
                return id;
            } catch (e) { console.warn('⚠️ خطأ في إضافة التصنيف:', e); return null; }
        },
        async deleteCategory(id) {
            try {
                const category = await global.DB.categories.get(id);
                if (category) {
                    const questions = await global.DB.questions.where('category').equals(category.name).toArray();
                    for (const q of questions) { q.category = ''; await global.DB.questions.put(q); }
                }
                await global.DB.categories.delete(id);
                await this.updateStats();
                return true;
            } catch (e) { console.warn('⚠️ خطأ في حذف التصنيف:', e); return false; }
        },
        async updateCategory(id, newName) {
            if (!newName || !newName.trim()) return false;
            const trimmedName = newName.trim();
            try {
                const category = await global.DB.categories.get(id);
                if (!category) return false;
                const oldName = category.name;
                const questions = await global.DB.questions.where('category').equals(oldName).toArray();
                for (const q of questions) { q.category = trimmedName; await global.DB.questions.put(q); }
                category.name = trimmedName; category.updatedAt = new Date().toISOString();
                await global.DB.categories.put(category);
                return true;
            } catch (e) { console.warn('⚠️ خطأ في تحديث التصنيف:', e); return false; }
        },
        async getQuestionCounts() {
            try {
                const categories = await this.getCategories();
                const counts = {};
                for (const cat of categories) counts[cat.name] = await global.DB.questions.where('category').equals(cat.name).count();
                return counts;
            } catch (e) { return {}; }
        },
        async updateStats() {
            try {
                const categories = await this.getCategories();
                let stats = await global.DB.playerStats.get('main');
                if (!stats) stats = { key: 'main', ...DEFAULT_STATS };
                stats.totalCategories = categories.length;
                await global.DB.playerStats.put(stats);
            } catch (e) {}
        }
    };

    // ========== Player Stats Manager ==========
    const PlayerStatsManager = {
        async getStats() {
            try {
                let stats = await global.DB.playerStats.get('main');
                if (!stats) { stats = { key: 'main', ...DEFAULT_STATS }; await global.DB.playerStats.put(stats); }
                return stats;
            } catch (e) { return { key: 'main', ...DEFAULT_STATS }; }
        },
        async updateStats(updates) {
            try { let stats = await this.getStats(); Object.assign(stats, updates); await global.DB.playerStats.put(stats); return stats; }
            catch (e) { return null; }
        },
        async recordGame(gameData) {
            try {
                const record = { date: new Date().toISOString(), mode: gameData.mode || 'practice', score: gameData.score || 0, correct: gameData.correct || 0, wrong: gameData.wrong || 0, total: gameData.total || 0, stars: gameData.stars || 0, duration: gameData.duration || 0, streak: gameData.streak || 0, accuracy: gameData.total > 0 ? Math.round((gameData.correct / gameData.total) * 100) : 0 };
                await global.DB.gameHistory.add(record);
                const stats = await this.getStats();
                if (gameData.mode === 'test') { stats.totalTests++; if (gameData.correct === gameData.total && gameData.total > 0) stats.perfectScores++; }
                else { stats.totalChallenges++; }
                stats.totalStars += gameData.stars || 0; stats.totalScore += gameData.score || 0;
                stats.totalCorrect += gameData.correct || 0; stats.totalWrong += gameData.wrong || 0; stats.rounds++;
                if (gameData.correct === gameData.total && gameData.total > 0) stats.perfectRounds++;
                if (gameData.streak > stats.bestStreak) stats.bestStreak = gameData.streak;
                await global.DB.playerStats.put(stats);
                if (typeof Achievements !== 'undefined') {
                    const newUnlocks = await Achievements.check(stats);
                    if (newUnlocks.length > 0) return { record, newUnlocks };
                }
                return { record, newUnlocks: [] };
            } catch (e) { console.warn('⚠️ خطأ في تسجيل الجولة:', e); return null; }
        },
        async recordReview(questionId, correct, mode) {
            try { await global.DB.reviewHistory.add({ questionId, timestamp: new Date().toISOString(), correct, mode }); }
            catch (e) {}
        },
        async getGameHistory(limit) {
            try { return await global.DB.gameHistory.orderBy('date').reverse().limit(limit || 10).toArray(); }
            catch (e) { return []; }
        },
        async getQuestionsForReview() {
            try {
                const wrongReviews = await global.DB.reviewHistory.where('correct').equals(false).toArray();
                const questionStats = {};
                for (const review of wrongReviews) {
                    if (!questionStats[review.questionId]) questionStats[review.questionId] = { questionId: review.questionId, wrongCount: 0, lastWrong: review.timestamp };
                    questionStats[review.questionId].wrongCount++;
                    if (review.timestamp > questionStats[review.questionId].lastWrong) questionStats[review.questionId].lastWrong = review.timestamp;
                }
                return Object.values(questionStats).sort((a, b) => b.wrongCount - a.wrongCount);
            } catch (e) { return []; }
        }
    };

    // ========== Question Parser ==========
    const QuestionParser = {
        parseText(text) {
            if (typeof QuestionValidator !== 'undefined') {
                return QuestionValidator.parseWithAutoFix ? QuestionValidator.parseWithAutoFix(text) : [];
            }
            return [];
        },
        parseBlock(block) {
            if (typeof QuestionValidator !== 'undefined') {
                return QuestionValidator.parseBlock(block);
            }
            return null;
        }
    };

    // ========== DB Backup (محدث) ==========
    const DBBackup = {
        async exportQuestions() {
            try {
                const questions = await global.DB.questions.toArray();
                const data = { version: 3, exportedAt: new Date().toISOString(), count: questions.length, questions };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `smartlearning_backup_${Date.now()}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(`✅ تم تصدير ${questions.length} سؤال`);
            } catch (e) { console.warn('⚠️ خطأ في التصدير:', e); }
        },

        async exportQuestionsByCategory(categoryName) {
            try {
                const questions = await global.DB.questions.where('category').equals(categoryName).toArray();
                if (!questions || questions.length === 0) {
                    if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(`⚠️ لا توجد أسئلة في تصنيف "${categoryName}"`, '⚠️');
                    return false;
                }
                const data = { version: 3, exportedAt: new Date().toISOString(), category: categoryName, count: questions.length, questions };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `smartlearning_${categoryName}_${Date.now()}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(`✅ تم تصدير ${questions.length} سؤال من تصنيف "${categoryName}"`);
                return true;
            } catch (e) { console.warn('⚠️ خطأ في التصدير حسب التصنيف:', e); return false; }
        },

        async importQuestions(file, targetCategory = null) {
            try {
                if (!file) return 0;
                const text = await file.text();
                let questions = [];

                let isJson = false;
                try {
                    const data = JSON.parse(text);
                    questions = data.questions || data;
                    if (Array.isArray(questions)) {
                        isJson = true;
                    } else {
                        throw new Error('Not a valid JSON array');
                    }
                } catch (jsonError) {
                    console.log('File is not valid JSON, treating as text');
                    isJson = false;
                }

                if (!isJson) {
                    if (typeof QuestionValidator !== 'undefined' && QuestionValidator.parseWithAutoFix) {
                        questions = QuestionValidator.parseWithAutoFix(text);
                    } else {
                        throw new Error('No text parser available');
                    }
                }

                if (!Array.isArray(questions) || questions.length === 0) {
                    if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('⚠️ لم يتم العثور على أسئلة صالحة');
                    return 0;
                }

                if (typeof QuestionValidator !== 'undefined' && QuestionValidator.filterValid) {
                    questions = QuestionValidator.filterValid(questions);
                }

                let added = 0;
                for (const q of questions) {
                    try {
                        const finalCategory = (targetCategory !== null) ? targetCategory : (q.category || 'عام');
                        await global.DB.questions.add({
                            text: q.text,
                            correct: q.correct,
                            wrongs: q.wrongs || ['', '', ''],
                            category: finalCategory,
                            unit: q.unit || 1,
                            lesson: q.lesson || 1,
                            difficulty: q.difficulty || 'B',
                            image: q.image || null,
                            order: Date.now() + added
                        });
                        added++;
                    } catch (e) {
                        console.warn('فشل إضافة سؤال فردي:', e);
                    }
                }

                if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(`✅ تم استيراد ${added} سؤال`);
                if (typeof UI !== 'undefined' && UI.updateQuickStats) UI.updateQuickStats();
                return added;
            } catch (e) { 
                console.warn('⚠️ خطأ في الاستيراد:', e); 
                if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('❌ فشل الاستيراد: ' + (e.message || 'خطأ غير معروف'));
                return 0; 
            }
        },

        async importQuestionsFromText(file, targetCategory = null) {
            return this.importQuestions(file, targetCategory);
        }
    };

    async function safeResetDatabase() {
        let confirmed = false;
        if (typeof confirm === 'function') {
            confirmed = confirm('⚠️ تحذير: سيتم حذف جميع الأسئلة والتصنيفات وسجل الألعاب.\nهذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد؟');
        } else {
            const confirmText = prompt('اكتب DELETE لتأكيد حذف قاعدة البيانات');
            confirmed = confirmText === 'DELETE';
        }
        if (!confirmed) { if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('تم إلغاء العملية'); return; }
        try {
            if (!useMemoryFallback) { try { await Dexie.delete('SmartLearningDB_v4'); } catch(e){} }
            else { global.DB._data = { questions: [], settings: [], categories: [], achievements: [], xp: [], gameHistory: [], reviewHistory: [], playerStats: [] }; }
            if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('✅ تم حذف قاعدة البيانات - جاري إعادة التحميل...');
            setTimeout(() => location.reload(), 1500);
        } catch (e) { console.warn('⚠️ خطأ في الحذف:', e); }
    }

    const DataManager = {
        async exportAll() {
            try {
                const questions = await global.DB.questions.toArray();
                const categories = await global.DB.categories.toArray();
                const settings = { ...Settings.data };
                const stats = await PlayerStatsManager.getStats();
                return { version: '3.0', exportDate: new Date().toISOString(), data: { questions: questions.map(q => ({ text: q.text, correct: q.correct, wrongs: q.wrongs, category: q.category, unit: q.unit || 1, lesson: q.lesson || 1, difficulty: q.difficulty || 'B', image: q.image })), categories: categories.map(c => ({ name: c.name })), settings } };
            } catch (e) { return null; }
        },
        async importAll(data) {
            try {
                if (!data || !data.data) throw new Error('بيانات غير صالحة');
                if (data.data.questions && Array.isArray(data.data.questions)) {
                    for (const q of data.data.questions) {
                        if (q.text && q.correct) {
                            await global.DB.questions.add({ text: q.text, correct: q.correct, wrongs: q.wrongs || [], category: q.category || '', image: q.image || '', unit: q.unit || 1, lesson: q.lesson || 1, difficulty: q.difficulty || 'B', order: Date.now() });
                        }
                    }
                }
                if (data.data.categories && Array.isArray(data.data.categories)) {
                    for (const c of data.data.categories) { if (c.name) { try { await CategoryManager.addCategory(c.name); } catch (e) {} } }
                }
                if (data.data.settings) { Object.assign(Settings.data, data.data.settings); await Settings.save(true); }
                return true;
            } catch (e) { console.warn('⚠️ خطأ في استيراد البيانات:', e); return false; }
        },
        async bulkImportQuestions(questionsArray, categoryName) {
            try {
                if (!questionsArray || !questionsArray.length) return 0;
                let count = 0;
                for (const q of questionsArray) {
                    if (q.text && q.correct) {
                        await global.DB.questions.add({ text: q.text, correct: q.correct, wrongs: q.wrongs || [], category: categoryName || q.category || 'عام', image: q.image || '', unit: q.unit || 1, lesson: q.lesson || 1, difficulty: q.difficulty || 'B', order: Date.now() + count });
                        count++;
                    }
                }
                return count;
            } catch (e) { console.warn('⚠️ خطأ في الاستيراد الجماعي:', e); return 0; }
        }
    };

    global.Settings = Settings;
    global.XPSystem = XPSystem;
    global.CategoryManager = CategoryManager;
    global.PlayerStatsManager = PlayerStatsManager;
    global.DataManager = DataManager;
    global.QuestionParser = QuestionParser;
    global.DBBackup = DBBackup;
    global.safeResetDatabase = safeResetDatabase;

    (async function initialize() {
        try {
            await initDexie();
            await Settings.load();
            await XPSystem.init();
            if (typeof window.AppVersion !== 'undefined' && window.AppVersion && typeof window.AppVersion.init === 'function') {
                window.AppVersion.init();
            }
            console.log('✅ قاعدة البيانات جاهزة (الإصدار 4)');
        } catch (e) {
            console.warn('⚠️ خطأ في تهيئة قاعدة البيانات:', e);
        }
    })();

})(window);
