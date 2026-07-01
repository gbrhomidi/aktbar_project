/**
 * المنصة التعليمية الذكية - محرك الذكاء التكيفي
 * يدعم التكرار المتباعد (Spaced Repetition) وتحليل الأداء
 * لتقديم تجربة تعلم مخصصة لكل مستخدم
 */

window.AdaptiveAI = window.AdaptiveAI || {};

(function(global) {
    'use strict';

    // ========== مستويات الصعوبة بناءً على تاريخ المراجعة ==========
    const REVIEW_INTERVALS = {
        IMMEDIATE: 1,      // دقيقة واحدة - مراجعة فورية بعد الخطأ
        SHORT: 5,          // 5 دقائق
        MEDIUM: 30,        // 30 دقيقة
        LONG: 120,         // ساعتين
        EXTENDED: 360,     // 6 ساعات
        DAILY: 1440,       // يوم كامل
        WEEKLY: 10080      // أسبوع
    };

    // ========== المحرك التكيفي ==========
    const AdaptiveAI = {
        // ذاكرة التطبيق المؤقتة
        sessionCache: {
            askedQuestions: new Set(),      // الأسئلة التي طُرحت في الجلسة الحالية
            wrongAnswers: [],               // الأسئلة التي أخطأ فيها المستخدم
            correctAnswers: [],             // الأسئلة التي أجاب عليها بشكل صحيح
            lastCorrectPosition: -1,        // آخر موضع للإجابة الصحيحة
            performanceHistory: []          // سجل الأداء
        },

        // ========== توليد الأسئلة التكيفية ==========
        /**
         * اختيار الأسئلة بناءً على الوضع والأداء
         * @param {Array} allQuestions - جميع الأسئلة المتاحة
         * @param {number} count - عدد الأسئلة المطلوبة
         * @param {string} mode - وضع اللعبة ('practice', 'test')
         * @param {string} category - تصنيف محدد أو 'all'
         * @returns {Array} الأسئلة المختارة
         */
        async selectQuestions(allQuestions, count, mode = 'practice', category = 'all') {
            if (!allQuestions || allQuestions.length === 0) return [];

            let availableQuestions = [...allQuestions];

            // تصفية حسب التصنيف
            if (category && category !== 'all') {
                availableQuestions = availableQuestions.filter(q => q.category === category);
            }

            // إذا كان العدد المطلوب أكبر من المتاح، نعيد كل المتاح
            if (count <= 0 || count >= availableQuestions.length) {
                return this.shuffleArray(availableQuestions);
            }

            let selectedQuestions = [];

            if (mode === 'practice') {
                // في وضع التحدي: مزيج من الأسئلة الصعبة والعشوائية
                selectedQuestions = await this.selectForPractice(availableQuestions, count);
            } else if (mode === 'test') {
                // في وضع الاختبار: اختيار متوازن وعشوائي
                selectedQuestions = this.selectForTest(availableQuestions, count);
            } else {
                // افتراضياً: عشوائي
                selectedQuestions = this.shuffleArray(availableQuestions).slice(0, count);
            }

            // إعادة تعيين تتبع الجلسة
            this.sessionCache.askedQuestions = new Set();
            this.sessionCache.wrongAnswers = [];
            this.sessionCache.correctAnswers = [];
            this.sessionCache.lastCorrectPosition = -1;

            return selectedQuestions;
        },

        /**
         * اختيار أسئلة لوضع التحدي (مع التركيز على الأسئلة الصعبة)
         */
        async selectForPractice(availableQuestions, count) {
            let selected = [];
            let remaining = [...availableQuestions];

            try {
                // الحصول على الأسئلة التي تحتاج مراجعة (Spaced Repetition)
                const reviewData = await PlayerStatsManager.getQuestionsForReview();
                
                if (reviewData && reviewData.length > 0) {
                    // إضافة الأسئلة التي تحتاج مراجعة (حتى 60% من العدد المطلوب)
                    const reviewCount = Math.min(
                        Math.ceil(count * 0.6),
                        reviewData.length
                    );

                    for (let i = 0; i < reviewCount; i++) {
                        const questionId = reviewData[i].questionId;
                        const question = remaining.find(q => q.id == questionId);
                        if (question) {
                            selected.push(question);
                            remaining = remaining.filter(q => q.id != questionId);
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ خطأ في جلب بيانات المراجعة:', e);
            }

            // إكمال العدد بأسئلة عشوائية
            const remainingNeeded = count - selected.length;
            if (remainingNeeded > 0 && remaining.length > 0) {
                const randomQuestions = this.shuffleArray(remaining).slice(0, remainingNeeded);
                selected = selected.concat(randomQuestions);
            }

            // خلط النهائي
            return this.shuffleArray(selected);
        },

        /**
         * اختيار أسئلة لوضع الاختبار (عشوائي متوازن)
         */
        selectForTest(availableQuestions, count) {
            // توزيع متوازن من التصنيفات إن أمكن
            const categorized = {};
            
            availableQuestions.forEach(q => {
                const cat = q.category || 'بدون تصنيف';
                if (!categorized[cat]) categorized[cat] = [];
                categorized[cat].push(q);
            });

            const categories = Object.keys(categorized);
            let selected = [];

            if (categories.length > 1 && count >= categories.length) {
                // توزيع عادل بين التصنيفات
                const perCategory = Math.floor(count / categories.length);
                let remainder = count % categories.length;

                categories.forEach(cat => {
                    const catQuestions = this.shuffleArray(categorized[cat]);
                    let take = perCategory;
                    if (remainder > 0) {
                        take++;
                        remainder--;
                    }
                    selected = selected.concat(catQuestions.slice(0, Math.min(take, catQuestions.length)));
                });

                // إكمال العدد إذا نقص
                if (selected.length < count) {
                    const remaining = availableQuestions.filter(q => !selected.includes(q));
                    selected = selected.concat(
                        this.shuffleArray(remaining).slice(0, count - selected.length)
                    );
                }
            } else {
                // عشوائي بسيط
                selected = this.shuffleArray(availableQuestions).slice(0, count);
            }

            return this.shuffleArray(selected);
        },

        // ========== خلط الإجابات ==========
        /**
         * خلط الإجابات مع ضمان عدم تكرار الموضع الصحيح
         * @param {string} correctAnswer - الإجابة الصحيحة
         * @param {Array} wrongAnswers - الإجابات الخاطئة
         * @returns {Array} الإجابات مرتبة عشوائياً
         */
        shuffleAnswers(correctAnswer, wrongAnswers) {
            if (!wrongAnswers || wrongAnswers.length === 0) {
                return [correctAnswer];
            }

            // استخدام 3 إجابات خاطئة فقط كحد أقصى
            const selectedWrongs = wrongAnswers.slice(0, 3);
            let allAnswers = [correctAnswer, ...selectedWrongs];

            // خلط الإجابات
            let shuffled;
            let attempts = 0;
            const maxAttempts = 10;

            do {
                shuffled = this.fisherYatesShuffle([...allAnswers]);
                attempts++;
            } while (
                shuffled[0] === correctAnswer && 
                shuffled[0] === this.sessionCache.lastCorrectPosition && 
                attempts < maxAttempts
            );

            // تخزين الموضع الجديد للإجابة الصحيحة (0-3)
            this.sessionCache.lastCorrectPosition = shuffled.indexOf(correctAnswer);

            return shuffled;
        },

        /**
         * خوارزمية فيشر-ييتس للخلط العشوائي
         */
        fisherYatesShuffle(array) {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },

        /**
         * خلط مصفوفة كاملة
         */
        shuffleArray(array) {
            return this.fisherYatesShuffle(array);
        },

        // ========== تتبع الأداء ==========
        /**
         * تسجيل نتيجة إجابة
         * @param {object} question - السؤال المجاب
         * @param {boolean} isCorrect - هل الإجابة صحيحة
         * @param {number} timeTaken - الوقت المستغرق (بالثواني)
         */
        recordAnswer(question, isCorrect, timeTaken = 0) {
            if (!question || !question.id) return;

            // تسجيل في الجلسة الحالية
            this.sessionCache.askedQuestions.add(question.id);

            if (isCorrect) {
                this.sessionCache.correctAnswers.push({
                    questionId: question.id,
                    timeTaken,
                    timestamp: Date.now()
                });
            } else {
                this.sessionCache.wrongAnswers.push({
                    questionId: question.id,
                    timeTaken,
                    timestamp: Date.now()
                });
            }

            // تسجيل في التاريخ
            this.sessionCache.performanceHistory.push({
                questionId: question.id,
                isCorrect,
                timeTaken,
                timestamp: Date.now()
            });

            // تسجيل في قاعدة البيانات للمراجعة
            try {
                if (typeof PlayerStatsManager !== 'undefined') {
                    PlayerStatsManager.recordReview(question.id, isCorrect, 'practice');
                }
            } catch (e) {}
        },

        // ========== تحليل الأداء ==========
        /**
         * تحليل أداء الجلسة الحالية
         * @returns {object} إحصائيات الأداء
         */
        getSessionStats() {
            const total = this.sessionCache.correctAnswers.length + this.sessionCache.wrongAnswers.length;
            const correct = this.sessionCache.correctAnswers.length;
            const wrong = this.sessionCache.wrongAnswers.length;
            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

            // متوسط الوقت المستغرق
            const allTimes = [
                ...this.sessionCache.correctAnswers.map(a => a.timeTaken),
                ...this.sessionCache.wrongAnswers.map(a => a.timeTaken)
            ];
            const avgTime = allTimes.length > 0 
                ? Math.round((allTimes.reduce((a, b) => a + b, 0) / allTimes.length) * 10) / 10 
                : 0;

            return {
                total,
                correct,
                wrong,
                accuracy,
                avgTime,
                performanceLevel: this.getPerformanceLevel(accuracy, avgTime)
            };
        },

        /**
         * تحديد مستوى الأداء
         */
        getPerformanceLevel(accuracy, avgTime) {
            if (accuracy >= 90 && avgTime < 5) return 'ممتاز';
            if (accuracy >= 80) return 'جيد جداً';
            if (accuracy >= 65) return 'جيد';
            if (accuracy >= 50) return 'مقبول';
            return 'يحتاج تحسين';
        },

        /**
         * الحصول على توصيات للتحسين
         */
        getRecommendations() {
            const stats = this.getSessionStats();
            const recommendations = [];

            if (stats.accuracy < 70) {
                recommendations.push({
                    type: 'review',
                    message: 'ننصح بمراجعة الأسئلة التي أخطأت فيها',
                    icon: '📚'
                });
            }

            if (stats.avgTime > 10) {
                recommendations.push({
                    type: 'speed',
                    message: 'حاول زيادة سرعتك في الإجابة',
                    icon: '⏱️'
                });
            }

            if (this.sessionCache.wrongAnswers.length > 3) {
                recommendations.push({
                    type: 'focus',
                    message: 'خذ وقتك في قراءة السؤال جيداً قبل الإجابة',
                    icon: '🎯'
                });
            }

            if (stats.accuracy >= 90) {
                recommendations.push({
                    type: 'challenge',
                    message: 'أداء رائع! جرب اختباراً رسمياً',
                    icon: '🌟'
                });
            }

            return recommendations;
        },

        // ========== التكرار المتباعد (Spaced Repetition) ==========
        /**
         * الحصول على الأسئلة التي تحتاج مراجعة عاجلة
         */
        async getUrgentReviewQuestions() {
            try {
                if (typeof PlayerStatsManager !== 'undefined') {
                    const reviewData = await PlayerStatsManager.getQuestionsForReview();
                    
                    // تصفية الأسئلة التي تحتاج مراجعة فورية (أخطأ فيها 3 مرات أو أكثر)
                    const urgent = reviewData.filter(r => r.wrongCount >= 3);
                    
                    if (urgent.length > 0 && typeof DB !== 'undefined') {
                        const questionIds = urgent.map(r => r.questionId);
                        const questions = [];
                        
                        for (const id of questionIds) {
                            const q = await DB.questions.get(id);
                            if (q) questions.push(q);
                        }
                        
                        return questions;
                    }
                }
            } catch (e) {
                console.warn('⚠️ خطأ في جلب أسئلة المراجعة:', e);
            }
            
            return [];
        },

        /**
         * حساب وقت المراجعة التالي
         */
        calculateNextReview(wrongCount, lastWrongTime) {
            const now = Date.now();
            const lastTime = new Date(lastWrongTime).getTime();
            const hoursSinceLastWrong = (now - lastTime) / (1000 * 60 * 60);

            let nextInterval;
            if (wrongCount >= 5) {
                nextInterval = REVIEW_INTERVALS.IMMEDIATE;
            } else if (wrongCount >= 3) {
                nextInterval = REVIEW_INTERVALS.SHORT;
            } else if (wrongCount >= 2) {
                nextInterval = REVIEW_INTERVALS.MEDIUM;
            } else {
                nextInterval = REVIEW_INTERVALS.LONG;
            }

            // تحويل إلى دقائق
            const nextReviewMinutes = nextInterval - (hoursSinceLastWrong * 60);
            
            return {
                shouldReviewNow: nextReviewMinutes <= 0,
                nextReviewIn: Math.max(0, Math.round(nextReviewMinutes)),
                urgency: wrongCount >= 5 ? 'عاجل' : wrongCount >= 3 ? 'متوسط' : 'منخفض'
            };
        },

        // ========== تحليل التصنيفات ==========
        /**
         * تحليل أداء المستخدم حسب التصنيف
         */
        async getPerformanceByCategory() {
            const categoryPerformance = {};

            try {
                if (typeof DB !== 'undefined') {
                    // جلب سجل المراجعة
                    const reviews = await DB.reviewHistory.toArray();
                    
                    // جلب الأسئلة
                    const questions = await DB.questions.toArray();
                    const questionMap = {};
                    questions.forEach(q => { questionMap[q.id] = q; });

                    // تحليل حسب التصنيف
                    reviews.forEach(review => {
                        const question = questionMap[review.questionId];
                        if (!question) return;
                        
                        const category = question.category || 'بدون تصنيف';
                        
                        if (!categoryPerformance[category]) {
                            categoryPerformance[category] = {
                                category,
                                total: 0,
                                correct: 0,
                                wrong: 0,
                                accuracy: 0
                            };
                        }

                        categoryPerformance[category].total++;
                        if (review.correct) {
                            categoryPerformance[category].correct++;
                        } else {
                            categoryPerformance[category].wrong++;
                        }
                    });

                    // حساب الدقة لكل تصنيف
                    Object.values(categoryPerformance).forEach(perf => {
                        perf.accuracy = perf.total > 0 
                            ? Math.round((perf.correct / perf.total) * 100) 
                            : 0;
                    });
                }
            } catch (e) {
                console.warn('⚠️ خطأ في تحليل الأداء حسب التصنيف:', e);
            }

            return Object.values(categoryPerformance)
                .sort((a, b) => a.accuracy - b.accuracy); // الأضعف أولاً
        },

        /**
         * الحصول على أفضل وأسوأ تصنيف
         */
        async getBestAndWorstCategories() {
            const performance = await this.getPerformanceByCategory();
            
            if (performance.length === 0) return null;

            return {
                best: performance[performance.length - 1],
                worst: performance[0],
                all: performance
            };
        },

        // ========== اقتراحات ذكية ==========
        /**
         * اقتراح أسئلة للتركيز عليها
         */
        async getSuggestedFocusQuestions(limit = 5) {
            const suggestions = [];

            try {
                // 1. الأسئلة التي تحتاج مراجعة عاجلة
                const urgentQuestions = await this.getUrgentReviewQuestions();
                suggestions.push(...urgentQuestions);

                // 2. أسئلة من أضعف تصنيف
                if (suggestions.length < limit) {
                    const categoryPerf = await this.getPerformanceByCategory();
                    if (categoryPerf.length > 0) {
                        const weakestCategory = categoryPerf[0]; // الأضعف
                        
                        if (typeof DB !== 'undefined') {
                            const catQuestions = await DB.questions
                                .where('category')
                                .equals(weakestCategory.category)
                                .toArray();
                            
                            const shuffled = this.shuffleArray(catQuestions);
                            const needed = limit - suggestions.length;
                            suggestions.push(...shuffled.slice(0, needed));
                        }
                    }
                }

                // 3. أسئلة عشوائية للإكمال
                if (suggestions.length < limit && typeof DB !== 'undefined') {
                    const allQuestions = await DB.questions.toArray();
                    const remaining = allQuestions.filter(q => !suggestions.find(s => s.id === q.id));
                    const shuffled = this.shuffleArray(remaining);
                    const needed = limit - suggestions.length;
                    suggestions.push(...shuffled.slice(0, needed));
                }
            } catch (e) {
                console.warn('⚠️ خطأ في اقتراح الأسئلة:', e);
            }

            return suggestions.slice(0, limit);
        },

        // ========== إعادة تعيين ==========
        /**
         * إعادة تعيين ذاكرة الجلسة
         */
        resetSession() {
            this.sessionCache = {
                askedQuestions: new Set(),
                wrongAnswers: [],
                correctAnswers: [],
                lastCorrectPosition: -1,
                performanceHistory: []
            };
        },

        /**
         * الحصول على ملخص الجلسة
         */
        getSessionSummary() {
            const stats = this.getSessionStats();
            return {
                stats,
                wrongQuestions: this.sessionCache.wrongAnswers,
                recommendations: this.getRecommendations()
            };
        }
    };

    // ========== تعريض المحرك التكيفي ==========
    global.AdaptiveAI = AdaptiveAI;

    console.log('🧠 محرك الذكاء التكيفي جاهز');

})(window);
