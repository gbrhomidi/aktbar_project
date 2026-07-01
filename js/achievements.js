/**
 * المنصة التعليمية الذكية - نظام الإنجازات
 * يدعم تتبع الإنجازات وعرضها مع تأثيرات احتفالية
 * وتكامل كامل مع نظام XP والإحصائيات والصوت والإعدادات
 */

window.Achievements = window.Achievements || {};

(function(global) {
    'use strict';

    // ========== قائمة الإنجازات الكاملة ==========
    const ACHIEVEMENTS_LIST = [
        // ===== إنجازات الأسئلة =====
        {
            id: 'first_question',
            name: 'الخطوة الأولى',
            nameEn: 'First Step',
            desc: 'أضف أول سؤال إلى البنك',
            descEn: 'Add your first question to the bank',
            icon: '🎯',
            xp: 30,
            category: 'questions',
            condition: (stats) => stats.totalQuestions >= 1
        },
        {
            id: 'five_questions',
            name: 'باني الأسئلة',
            nameEn: 'Question Builder',
            desc: 'أضف 5 أسئلة إلى البنك',
            descEn: 'Add 5 questions to the bank',
            icon: '📝',
            xp: 50,
            category: 'questions',
            condition: (stats) => stats.totalQuestions >= 5
        },
        {
            id: 'ten_questions',
            name: 'جامع الأسئلة',
            nameEn: 'Question Collector',
            desc: 'أضف 10 أسئلة إلى البنك',
            descEn: 'Add 10 questions to the bank',
            icon: '📚',
            xp: 80,
            category: 'questions',
            condition: (stats) => stats.totalQuestions >= 10
        },
        {
            id: 'twentyfive_questions',
            name: 'مكتبة الأسئلة',
            nameEn: 'Question Library',
            desc: 'أضف 25 سؤالاً إلى البنك',
            descEn: 'Add 25 questions to the bank',
            icon: '📖',
            xp: 150,
            category: 'questions',
            condition: (stats) => stats.totalQuestions >= 25
        },
        {
            id: 'fifty_questions',
            name: 'موسوعة المعرفة',
            nameEn: 'Knowledge Encyclopedia',
            desc: 'أضف 50 سؤالاً إلى البنك',
            descEn: 'Add 50 questions to the bank',
            icon: '🏛️',
            xp: 300,
            category: 'questions',
            condition: (stats) => stats.totalQuestions >= 50
        },
        {
            id: 'hundred_questions',
            name: 'موسوعة شاملة',
            nameEn: 'Comprehensive Encyclopedia',
            desc: 'أضف 100 سؤال إلى البنك',
            descEn: 'Add 100 questions to the bank',
            icon: '🎓',
            xp: 500,
            category: 'questions',
            condition: (stats) => stats.totalQuestions >= 100
        },

        // ===== إنجازات التصنيفات =====
        {
            id: 'first_category',
            name: 'المنظم',
            nameEn: 'Organizer',
            desc: 'أنشئ أول تصنيف للأسئلة',
            descEn: 'Create your first category',
            icon: '📂',
            xp: 40,
            category: 'categories',
            condition: (stats) => stats.totalCategories >= 1
        },
        {
            id: 'three_categories',
            name: 'منظم محترف',
            nameEn: 'Professional Organizer',
            desc: 'أنشئ 3 تصنيفات مختلفة',
            descEn: 'Create 3 different categories',
            icon: '📁',
            xp: 80,
            category: 'categories',
            condition: (stats) => stats.totalCategories >= 3
        },
        {
            id: 'five_categories',
            name: 'خبير التصنيف',
            nameEn: 'Classification Expert',
            desc: 'أنشئ 5 تصنيفات مختلفة',
            descEn: 'Create 5 different categories',
            icon: '🗂️',
            xp: 150,
            category: 'categories',
            condition: (stats) => stats.totalCategories >= 5
        },

        // ===== إنجازات التحدي السريع =====
        {
            id: 'first_practice',
            name: 'المتدرب',
            nameEn: 'Trainee',
            desc: 'أكمل أول تحدي سريع',
            descEn: 'Complete your first quick challenge',
            icon: '🎮',
            xp: 50,
            category: 'practice',
            condition: (stats) => stats.totalChallenges >= 1
        },
        {
            id: 'five_practices',
            name: 'متحدي محترف',
            nameEn: 'Professional Challenger',
            desc: 'أكمل 5 تحديات سريعة',
            descEn: 'Complete 5 quick challenges',
            icon: '⚡',
            xp: 100,
            category: 'practice',
            condition: (stats) => stats.totalChallenges >= 5
        },
        {
            id: 'ten_practices',
            name: 'بطل التحديات',
            nameEn: 'Challenge Champion',
            desc: 'أكمل 10 تحديات سريعة',
            descEn: 'Complete 10 quick challenges',
            icon: '🏅',
            xp: 200,
            category: 'practice',
            condition: (stats) => stats.totalChallenges >= 10
        },

        // ===== إنجازات الاختبار =====
        {
            id: 'first_test',
            name: 'المختبر',
            nameEn: 'Examiner',
            desc: 'أكمل أول اختبار رسمي',
            descEn: 'Complete your first official test',
            icon: '📝',
            xp: 80,
            category: 'test',
            condition: (stats) => stats.totalTests >= 1
        },
        {
            id: 'five_tests',
            name: 'خبير الاختبارات',
            nameEn: 'Test Expert',
            desc: 'أكمل 5 اختبارات رسمية',
            descEn: 'Complete 5 official tests',
            icon: '📋',
            xp: 200,
            category: 'test',
            condition: (stats) => stats.totalTests >= 5
        },
        {
            id: 'perfect_score',
            name: 'الكمال',
            nameEn: 'Perfection',
            desc: 'احصل على درجة كاملة في اختبار',
            descEn: 'Get a perfect score in a test',
            icon: '💎',
            xp: 300,
            category: 'test',
            condition: (stats) => stats.perfectScores >= 1
        },
        {
            id: 'three_perfect',
            name: 'العبقري',
            nameEn: 'Genius',
            desc: 'احصل على درجة كاملة 3 مرات',
            descEn: 'Get a perfect score 3 times',
            icon: '👑',
            xp: 500,
            category: 'test',
            condition: (stats) => stats.perfectScores >= 3
        },
        {
            id: 'high_score_90',
            name: 'المتفوق',
            nameEn: 'Outstanding',
            desc: 'احصل على 90% أو أكثر في اختبار',
            descEn: 'Score 90% or above in a test',
            icon: '🌟',
            xp: 150,
            category: 'test',
            condition: (stats) => stats.highScores >= 1
        },

        // ===== إنجازات النجوم والنقاط =====
        {
            id: 'first_star',
            name: 'أول نجمة',
            nameEn: 'First Star',
            desc: 'اجمع أول نجمة في التحديات',
            descEn: 'Collect your first star',
            icon: '⭐',
            xp: 20,
            category: 'stars',
            condition: (stats) => stats.totalStars >= 1
        },
        {
            id: 'star_collector',
            name: 'جامع النجوم',
            nameEn: 'Star Collector',
            desc: 'اجمع 25 نجمة في التحديات',
            descEn: 'Collect 25 stars',
            icon: '🌟',
            xp: 100,
            category: 'stars',
            condition: (stats) => stats.totalStars >= 25
        },
        {
            id: 'star_master',
            name: 'سيد النجوم',
            nameEn: 'Star Master',
            desc: 'اجمع 50 نجمة في التحديات',
            descEn: 'Collect 50 stars',
            icon: '✨',
            xp: 200,
            category: 'stars',
            condition: (stats) => stats.totalStars >= 50
        },
        {
            id: 'star_legend',
            name: 'أسطورة النجوم',
            nameEn: 'Star Legend',
            desc: 'اجمع 100 نجمة في التحديات',
            descEn: 'Collect 100 stars',
            icon: '💫',
            xp: 400,
            category: 'stars',
            condition: (stats) => stats.totalStars >= 100
        },
        {
            id: 'score_100',
            name: 'مئة نقطة',
            nameEn: 'Hundred Points',
            desc: 'اجمع 100 نقطة في التحديات',
            descEn: 'Collect 100 points',
            icon: '💯',
            xp: 50,
            category: 'score',
            condition: (stats) => stats.totalScore >= 100
        },
        {
            id: 'score_500',
            name: 'خمسمئة نقطة',
            nameEn: 'Five Hundred Points',
            desc: 'اجمع 500 نقطة في التحديات',
            descEn: 'Collect 500 points',
            icon: '🏆',
            xp: 150,
            category: 'score',
            condition: (stats) => stats.totalScore >= 500
        },
        {
            id: 'score_1000',
            name: 'ألف نقطة',
            nameEn: 'Thousand Points',
            desc: 'اجمع 1000 نقطة في التحديات',
            descEn: 'Collect 1000 points',
            icon: '👑',
            xp: 300,
            category: 'score',
            condition: (stats) => stats.totalScore >= 1000
        },

        // ===== إنجازات خاصة =====
        {
            id: 'speed_demon',
            name: 'سريع البديهة',
            nameEn: 'Quick Thinker',
            desc: 'أجب على 5 أسئلة صحيحة بمتوسط أقل من 3 ثوانٍ',
            descEn: 'Answer 5 questions correctly with average under 3 seconds',
            icon: '⚡',
            xp: 200,
            category: 'special',
            condition: (stats) => stats.fastAnswers >= 5
        },
        {
            id: 'streak_5',
            name: 'سلسلة الانتصارات',
            nameEn: 'Winning Streak',
            desc: 'أجب على 5 أسئلة صحيحة متتالية',
            descEn: 'Answer 5 questions correctly in a row',
            icon: '🔥',
            xp: 150,
            category: 'special',
            condition: (stats) => stats.bestStreak >= 5
        },
        {
            id: 'streak_10',
            name: 'البطل الأسطوري',
            nameEn: 'Legendary Hero',
            desc: 'أجب على 10 أسئلة صحيحة متتالية',
            descEn: 'Answer 10 questions correctly in a row',
            icon: '🐉',
            xp: 350,
            category: 'special',
            condition: (stats) => stats.bestStreak >= 10
        },
        {
            id: 'night_owl',
            name: 'بومة الليل',
            nameEn: 'Night Owl',
            desc: 'أكمل تحدياً بعد منتصف الليل',
            descEn: 'Complete a challenge after midnight',
            icon: '🦉',
            xp: 100,
            category: 'special',
            condition: (stats) => stats.nightPlay === true
        },
        {
            id: 'early_bird',
            name: 'طائر الصباح',
            nameEn: 'Early Bird',
            desc: 'أكمل تحدياً قبل السادسة صباحاً',
            descEn: 'Complete a challenge before 6 AM',
            icon: '🐦',
            xp: 100,
            category: 'special',
            condition: (stats) => stats.earlyPlay === true
        }
    ];

    // ========== نظام الإنجازات ==========
    const Achievements = {
        list: ACHIEVEMENTS_LIST,
        unlockedIds: new Set(),
        recentlyUnlocked: [],

        // ========== التهيئة ==========
        /**
         * تهيئة نظام الإنجازات
         */
        async init() {
            console.log('🏆 تهيئة نظام الإنجازات...');
            
            try {
                if (typeof DB !== 'undefined') {
                    const unlocked = await DB.achievements.toArray();
                    // تخزين فقط المعرفات (وليس الكائنات الكاملة لأنها تحتوي على دوال)
                    this.unlockedIds = new Set(unlocked.map(a => a.id));
                    console.log(`✅ تم تحميل ${this.unlockedIds.size} إنجاز محقق`);
                }
            } catch (e) {
                console.warn('⚠️ خطأ في تحميل الإنجازات:', e);
                this.unlockedIds = new Set();
            }
        },

        // ========== التحقق من الإنجازات ==========
        /**
         * التحقق من الإنجازات وتحديثها
         * @param {object} stats - إحصائيات اللاعب الحالية
         * @returns {Array} الإنجازات الجديدة المحققة
         */
        async check(stats) {
            if (!stats) return [];

            const newUnlocks = [];
            this.recentlyUnlocked = [];

            try {
                for (const achievement of this.list) {
                    // تخطي الإنجازات المحققة مسبقاً
                    if (this.unlockedIds.has(achievement.id)) continue;

                    // التحقق من الشرط
                    if (achievement.condition(stats)) {
                        // تخزين فقط البيانات الأساسية (بدون دوال)
                        const achievementRecord = {
                            id: achievement.id,
                            name: achievement.name,
                            nameEn: achievement.nameEn,
                            desc: achievement.desc,
                            descEn: achievement.descEn,
                            icon: achievement.icon,
                            xp: achievement.xp,
                            category: achievement.category,
                            unlockedAt: new Date().toISOString()
                        };
                        
                        if (typeof DB !== 'undefined') {
                            await DB.achievements.put(achievementRecord);
                        }

                        // إضافة إلى القائمة المحلية
                        this.unlockedIds.add(achievement.id);
                        newUnlocks.push(achievement);
                        this.recentlyUnlocked.push(achievement);

                        // منح XP
                        if (typeof XPSystem !== 'undefined' && typeof XPSystem.addXP === 'function') {
                            await XPSystem.addXP(achievement.xp);
                        }
                    }
                }

                // عرض إشعارات الإنجازات الجديدة
                if (newUnlocks.length > 0) {
                    this.showUnlockNotifications(newUnlocks);
                    
                    // تأثير احتفالي
                    if (typeof confetti !== 'undefined') {
                        setTimeout(() => {
                            confetti({
                                particleCount: 100,
                                spread: 70,
                                origin: { y: 0.6 }
                            });
                        }, 300);
                    }
                }
            } catch (e) {
                console.warn('⚠️ خطأ في التحقق من الإنجازات:', e);
            }

            return newUnlocks;
        },

        // ========== عرض الإنجازات ==========
        /**
         * عرض الإنجازات في واجهة المستخدم
         * @param {string} containerId - معرف عنصر container
         * @param {string} category - تصنيف محدد أو 'all'
         */
        async render(containerId = 'achievements-list', category = 'all') {
            const container = document.getElementById(containerId);
            if (!container) return;

            // التأكد من تحميل الإنجازات المحققة من قاعدة البيانات (تحديث)
            if (typeof DB !== 'undefined') {
                try {
                    const unlocked = await DB.achievements.toArray();
                    this.unlockedIds = new Set(unlocked.map(a => a.id));
                } catch (e) {
                    console.warn('Failed to reload achievements:', e);
                }
            }

            const lang = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data.language : 'ar';
            const isArabic = lang === 'ar';

            // تصفية حسب التصنيف
            const filteredList = category === 'all' 
                ? this.list 
                : this.list.filter(a => a.category === category);

            // حساب الإحصائيات
            const totalUnlocked = this.unlockedIds.size;
            const totalAchievements = this.list.length;
            const percentage = Math.round((totalUnlocked / totalAchievements) * 100);

            // بناء HTML
            let html = `
                <!-- شريط التقدم العام -->
                <div style="
                    background: rgba(255, 215, 0, 0.1);
                    border: 1px dashed rgba(255, 215, 0, 0.5);
                    border-radius: 15px;
                    padding: 15px;
                    margin-bottom: 15px;
                    text-align: center;
                ">
                    <div style="font-size: 1.5rem; color: var(--gold); font-weight: 800; margin-bottom: 5px;">
                        🏆 ${totalUnlocked} / ${totalAchievements}
                    </div>
                    <div style="font-size: 0.85rem; color: #ccc; margin-bottom: 10px;">
                        ${isArabic ? 'إنجاز محقق' : 'Achievements Unlocked'} (${percentage}%)
                    </div>
                    <div style="
                        width: 100%;
                        height: 8px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 4px;
                        overflow: hidden;
                    ">
                        <div style="
                            width: ${percentage}%;
                            height: 100%;
                            background: linear-gradient(90deg, var(--gold), #ffed4e);
                            border-radius: 4px;
                            transition: width 0.5s ease;
                        "></div>
                    </div>
                </div>

                <!-- قائمة الإنجازات -->
                <div style="max-height: 350px; overflow-y: auto; padding-right: 5px;">
            `;

            // تصنيفات الإنجازات
            const categories = {
                'questions': { icon: '📚', name: isArabic ? 'الأسئلة' : 'Questions' },
                'categories': { icon: '📂', name: isArabic ? 'التصنيفات' : 'Categories' },
                'practice': { icon: '🎮', name: isArabic ? 'التحدي السريع' : 'Quick Challenge' },
                'test': { icon: '📝', name: isArabic ? 'الاختبارات' : 'Tests' },
                'stars': { icon: '⭐', name: isArabic ? 'النجوم' : 'Stars' },
                'score': { icon: '🏆', name: isArabic ? 'النقاط' : 'Score' },
                'special': { icon: '🌟', name: isArabic ? 'خاصة' : 'Special' }
            };

            // عرض كل تصنيف
            Object.entries(categories).forEach(([catKey, catInfo]) => {
                const catAchievements = filteredList.filter(a => a.category === catKey);
                if (catAchievements.length === 0) return;

                const catUnlocked = catAchievements.filter(a => this.unlockedIds.has(a.id)).length;
                const catTotal = catAchievements.length;

                html += `
                    <div style="margin-bottom: 15px;">
                        <div style="
                            color: var(--gold);
                            font-weight: 700;
                            font-size: 1rem;
                            margin-bottom: 8px;
                            padding: 5px 10px;
                            background: rgba(255, 215, 0, 0.1);
                            border-radius: 10px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <span>${catInfo.icon} ${catInfo.name}</span>
                            <span style="font-size: 0.8rem; opacity: 0.8;">${catUnlocked}/${catTotal}</span>
                        </div>
                `;

                catAchievements.forEach(achievement => {
                    const isUnlocked = this.unlockedIds.has(achievement.id);
                    const name = isArabic ? achievement.name : (achievement.nameEn || achievement.name);
                    const desc = isArabic ? achievement.desc : (achievement.descEn || achievement.desc);

                    html += `
                        <div class="achievement-item" style="
                            opacity: ${isUnlocked ? '1' : '0.55'};
                            padding: 12px;
                            margin: 6px 0;
                            background: ${isUnlocked ? 'rgba(255, 215, 0, 0.12)' : 'rgba(255, 255, 255, 0.03)'};
                            border-radius: 12px;
                            border: 1px ${isUnlocked ? 'solid' : 'dashed'} ${isUnlocked ? 'var(--gold)' : 'rgba(255, 215, 0, 0.3)'};
                            transition: all 0.3s ease;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        ">
                            <div style="font-size: 2rem; flex-shrink: 0;">
                                ${isUnlocked ? achievement.icon : '🔒'}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 700; color: ${isUnlocked ? 'var(--gold)' : '#aaa'};">
                                    ${name}
                                </div>
                                <div style="font-size: 0.8rem; color: ${isUnlocked ? '#ccc' : '#888'};">
                                    ${desc}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--gold); margin-top: 2px;">
                                    ${isUnlocked ? '✅ تم التحقيق' : '🔒 لم يتحقق بعد'} • ${achievement.xp} XP
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
            });

            html += `</div>`;

            // أزرار التصفية
            html += `
                <div style="
                    display: flex;
                    gap: 5px;
                    flex-wrap: wrap;
                    margin-top: 10px;
                    justify-content: center;
                ">
                    <button class="btn btn-small ${category === 'all' ? 'btn-primary' : ''}" 
                            onclick="Achievements.render('achievements-list', 'all')">
                        الكل
                    </button>
            `;

            Object.entries(categories).forEach(([catKey, catInfo]) => {
                html += `
                    <button class="btn btn-small ${category === catKey ? 'btn-primary' : ''}" 
                            onclick="Achievements.render('achievements-list', '${catKey}')">
                        ${catInfo.icon}
                    </button>
                `;
            });

            html += `</div>`;

            container.innerHTML = html;
        },

        // ========== إشعارات الإنجازات ==========
        /**
         * عرض إشعارات الإنجازات الجديدة
         */
        showUnlockNotifications(achievements) {
            achievements.forEach((achievement, index) => {
                setTimeout(() => {
                    this.showSingleNotification(achievement);
                }, index * 2500); // تأخير بين الإشعارات
            });
        },

        /**
         * عرض إشعار إنجاز واحد
         */
        showSingleNotification(achievement) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-120px);
                background: linear-gradient(135deg, rgba(13, 27, 62, 0.98), rgba(3, 7, 18, 0.98));
                border: 2px solid var(--gold);
                border-radius: 20px;
                padding: 15px 25px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 15px;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.5), 0 10px 30px rgba(0, 0, 0, 0.5);
                animation: achievementSlideIn 0.5s ease forwards;
                min-width: 280px;
                max-width: 90vw;
            `;

            const lang = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data.language : 'ar';
            const isArabic = lang === 'ar';
            const name = isArabic ? achievement.name : (achievement.nameEn || achievement.name);
            const desc = isArabic ? achievement.desc : (achievement.descEn || achievement.desc);

            notification.innerHTML = `
                <div style="font-size: 2.5rem; animation: bounce 0.6s ease infinite;">
                    ${achievement.icon}
                </div>
                <div>
                    <div style="color: var(--gold); font-weight: 800; font-size: 1.1rem;">
                        🏆 ${isArabic ? 'إنجاز جديد!' : 'New Achievement!'}
                    </div>
                    <div style="color: white; font-weight: 700; margin: 3px 0;">
                        ${name}
                    </div>
                    <div style="color: #ccc; font-size: 0.8rem;">
                        ${desc}
                    </div>
                    <div style="color: var(--gold); font-size: 0.75rem; margin-top: 3px;">
                        +${achievement.xp} XP
                    </div>
                </div>
            `;

            document.body.appendChild(notification);

            // تشغيل صوت الإنجاز مع احترام إعدادات الكتم
            if (typeof AudioManager !== 'undefined' && !AudioManager.isMuted) {
                AudioManager.play('achievement', 0.9);
            }

            // إخفاء الإشعار بعد فترة
            setTimeout(() => {
                notification.style.animation = 'achievementSlideOut 0.5s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }, 3000);
        },

        // ========== دوال مساعدة ==========
        getUnlockedCount() {
            return this.unlockedIds.size;
        },
        getTotalCount() {
            return this.list.length;
        },
        getCompletionPercentage() {
            return Math.round((this.unlockedIds.size / this.list.length) * 100);
        },
        isUnlocked(achievementId) {
            return this.unlockedIds.has(achievementId);
        },
        getByCategory(category) {
            return this.list.filter(a => a.category === category);
        },
        getRecentlyUnlocked() {
            return this.recentlyUnlocked;
        },
        clearRecentlyUnlocked() {
            this.recentlyUnlocked = [];
        },
        async getNextAchievements(limit = 3) {
            const locked = this.list.filter(a => !this.unlockedIds.has(a.id));
            locked.sort((a, b) => a.xp - b.xp);
            return locked.slice(0, limit).map(a => {
                const lang = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data.language : 'ar';
                return {
                    ...a,
                    name: lang === 'ar' ? a.name : (a.nameEn || a.name),
                    desc: lang === 'ar' ? a.desc : (a.descEn || a.desc)
                };
            });
        }
    };

    // ========== إضافة أنيميشن الإنجازات ==========
    const achievementStyles = document.createElement('style');
    achievementStyles.textContent = `
        @keyframes achievementSlideIn {
            0% {
                transform: translateX(-50%) translateY(-120px);
                opacity: 0;
            }
            60% {
                transform: translateX(-50%) translateY(10px);
                opacity: 1;
            }
            80% {
                transform: translateX(-50%) translateY(-5px);
            }
            100% {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }

        @keyframes achievementSlideOut {
            0% {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            100% {
                transform: translateX(-50%) translateY(-120px);
                opacity: 0;
            }
        }

        .achievement-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
        }
    `;
    document.head.appendChild(achievementStyles);

    // ========== تعريض نظام الإنجازات ==========
    global.Achievements = Achievements;

    console.log('🏆 نظام الإنجازات جاهز');

})(window);